/**
 * The client a shop's screens reach Adminium's shipping routes through.
 *
 * The fake key below is assembled at run time and matches no real provider's
 * format, so nothing here can trip a secret scanner or be mistaken for a key.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { classifyBookFailure } from './contracts/shipping-carrier.ts';
import {
  createEngineCarrier,
  ENGINE_BAD_ANSWER,
  ENGINE_NO_ANSWER,
  ENGINE_NO_DOWNLOAD,
  ENGINE_OTHER_CARRIER,
  EngineCarrierError,
  scrubCredentials,
  type EngineRequest,
  type EngineSend,
} from './engine-carrier.ts';
import { foreignImportsIn, offendingAddresses, sendersIn } from './testing/egress.ts';

const KEY = ['planted', 'carrier', 'key', 'value', '7741'].join('-');

const BOOKING = {
  id: 'b1',
  state: 'booked',
  test: true,
  purpose: 'outbound',
  parcelNumber: 1,
  carrier: 'shipping-shippo',
  service: 'Ground',
  tracking: 'T123',
  carrierName: 'USPS',
  reason: null,
  duplicates: 0,
  createdAt: 1,
  calledAt: 2,
  checkedAt: null,
  releaseAfter: null,
  applied: true,
  label: { state: 'ready', size: 'a4', sizeGot: 'a6', sizeDiffers: true, customsInvoice: false },
  amount: '7.25',
  currency: 'USD',
};

const RATE = { rateId: 'r1', code: 'ground', service: 'Ground', amountDecimal: '7.25', currency: 'USD', withinLimit: true };
const QUOTE = { quoteId: 'q1', carrier: 'shipping-shippo', mode: 'test', expiresAt: 99, pricesHidden: false, rates: [RATE] };
const ACCESS = {
  appUpdated: true,
  carrier: 'shipping-shippo',
  mode: 'test',
  manages: false,
  mayBook: true,
  mayCancel: false,
  mayCustoms: false,
  pricesHidden: true,
  booking: 'open',
};
const QUOTE_REQUEST = {
  source: { table: 'orders', id: '42' },
  parcel: { weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10, contents: 'Mugs' },
};

type Call = { path: string; init: EngineRequest };

function client(status: number, body: unknown) {
  const calls: Call[] = [];
  const send: EngineSend = async (path, init) => {
    calls.push({ path, init });
    return { status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) };
  };
  return { calls, engine: createEngineCarrier({ send, appKey: 'maker-shop', addOnKey: 'shipping-shippo' }) };
}

const caught = async (run: () => Promise<unknown>): Promise<EngineCarrierError> => {
  try {
    await run();
  } catch (error) {
    return error as EngineCarrierError;
  }
  throw new Error('expected a failure');
};

describe('the routes it asks', () => {
  it('reaches only this app\'s shipping routes, with the right verbs and bodies', async () => {
    const quote = client(200, { data: QUOTE });
    await quote.engine.quote({ ...QUOTE_REQUEST, purpose: 'return', parcelNumber: 2 });
    expect(quote.calls[0]!.path).toBe('/api/v1/apps/maker-shop/shipping/quotes');
    expect(quote.calls[0]!.init.method).toBe('POST');
    expect(JSON.parse(quote.calls[0]!.init.body!)).toEqual({ ...QUOTE_REQUEST, purpose: 'return', parcelNumber: 2 });

    const list = client(200, { data: { bookings: [BOOKING], bookable: false, blockedBy: 'booking' } });
    const read = await list.engine.bookings({ table: 'orders', id: '4 2', purpose: 'return', parcelNumber: 2 });
    expect(list.calls[0]!.path).toBe('/api/v1/apps/maker-shop/shipping/bookings?table=orders&id=4+2&purpose=return&parcelNumber=2');
    expect(list.calls[0]!.init.method).toBe('GET');
    expect(read.blockedBy).toBe('booking');

    const check = client(200, { data: { outcome: 'no-match', booking: BOOKING } });
    await check.engine.checkBooking('a/b');
    expect(check.calls[0]!.path).toBe('/api/v1/apps/maker-shop/shipping/bookings/a%2Fb/check');
    // A JSON content type with an empty body is a 400 from the server.
    expect(check.calls[0]!.init.headers['content-type']).toBeUndefined();

    const release = client(200, { data: BOOKING });
    await release.engine.releaseBooking('b1');
    expect(JSON.parse(release.calls[0]!.init.body!)).toEqual({ declaration: 'no-label-exists' });
  });

  it('says whether the active carrier is the one it serves', async () => {
    expect((await client(200, { data: ACCESS }).engine.access()).activeHere).toBe(true);
    expect((await client(200, { data: { ...ACCESS, carrier: 'shipping-dhl' } }).engine.access()).activeHere).toBe(false);
  });

  it('refuses a quote from another carrier', async () => {
    const { engine } = client(200, { data: { ...QUOTE, carrier: 'shipping-dhl' } });
    const error = await caught(() => engine.quote(QUOTE_REQUEST));
    expect(error.code).toBe(ENGINE_OTHER_CARRIER);
  });
});

describe('the labels that need a person', () => {
  const ITEM = { reasons: ['unknown', 'duplicates'], reference: 'NL-1049', source: { table: 'orders', id: '42' }, orderGone: false, booking: { ...BOOKING, state: 'unknown', tracking: null } };

  it('asks once, by GET, with no body', async () => {
    const { calls, engine } = client(200, { data: { items: [ITEM], more: true } });
    const read = await engine.attention();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.path).toBe('/api/v1/apps/maker-shop/shipping/attention');
    expect(calls[0]!.init.method).toBe('GET');
    expect(calls[0]!.init.body).toBeUndefined();
    expect(read.more).toBe(true);
    expect(read.items[0]).toMatchObject({ reasons: ['unknown', 'duplicates'], reference: 'NL-1049', source: { table: 'orders', id: '42' }, booking: { id: 'b1', state: 'unknown', tracking: null } });
  });

  it('reads an item field by field, so nothing else of it reaches a screen', async () => {
    const reply = { ...ITEM, token: KEY, source: { ...ITEM.source, url: KEY }, booking: { ...ITEM.booking, carrierToken: KEY, label: { ...BOOKING.label, url: KEY } } };
    const { engine } = client(200, { data: { items: [reply], more: false, key: KEY } });
    const read = await engine.attention();
    expect(JSON.stringify(read)).not.toContain(KEY);
    expect(Object.keys(read.items[0]!).sort()).toEqual(['booking', 'orderGone', 'reasons', 'reference', 'source']);
    expect(read.items[0]!.source).toEqual({ table: 'orders', id: '42' });
  });

  it('says when a row\'s order was deleted', async () => {
    const { engine } = client(200, { data: { items: [{ ...ITEM, orderGone: true }, ITEM], more: false } });
    expect((await engine.attention()).items.map((item) => item.orderGone)).toEqual([true, false]);
  });

  it('keeps a row whose reason this build has no word for', async () => {
    const { engine } = client(200, { data: { items: [{ ...ITEM, reasons: ['some-later-reason', 'quiet', 7] }, { ...ITEM, reasons: ['some-later-reason'] }], more: false } });
    const read = await engine.attention();
    expect(read.items.map((item) => item.reasons)).toEqual([['quiet'], []]);
  });

  it('gives someone who may not see money no amount when the engine sends none', async () => {
    const { amount: _amount, currency: _currency, ...priceless } = BOOKING;
    const { engine } = client(200, { data: { items: [{ ...ITEM, booking: priceless }], more: false } });
    const [item] = (await engine.attention()).items;
    expect(item!.booking).not.toHaveProperty('amount');
    expect(item!.booking).not.toHaveProperty('currency');
  });

  it.each([
    ['no items', { more: false }],
    ['no more', { items: [] }],
    ['a row with no source', { items: [{ ...ITEM, source: null }], more: false }],
    ['a row with no reasons list', { items: [{ ...ITEM, reasons: 'unknown' }], more: false }],
    ['a row that does not say whether its order is there', { items: [{ reasons: ITEM.reasons, reference: ITEM.reference, source: ITEM.source, booking: ITEM.booking }], more: false }],
    ['a row whose order flag is not a yes or no', { items: [{ ...ITEM, orderGone: 'yes' }], more: false }],
    ['a broken booking', { items: [{ ...ITEM, booking: { id: 'b1' } }], more: false }],
  ])('calls %s a bad answer', async (_name, data) => {
    const error = await caught(() => client(200, { data }).engine.attention());
    expect(error.code).toBe(ENGINE_BAD_ANSWER);
    expect(error.retryable).toBe(true);
  });

  it('passes a refusal on, and says when nobody answered', async () => {
    const refused = await caught(() => client(403, { error: { code: 'FORBIDDEN', message: 'No.' } }).engine.attention());
    expect(refused.code).toBe('FORBIDDEN');
    expect(refused.status).toBe(403);
    const send: EngineSend = async () => {
      throw new Error(`failed with ${KEY}`);
    };
    const silent = await caught(() => createEngineCarrier({ send, appKey: 'maker-shop', addOnKey: 'shipping-shippo' }).attention());
    expect(silent.code).toBe(ENGINE_NO_ANSWER);
    expect(silent.message).not.toContain(KEY);
  });
});

describe('labels and tracking', () => {
  const TRACK = { status: 'TRANSIT', statusAt: 5, checkedAt: 6, flag: null, newNumber: true };

  it('reads a booking\'s label and track, and nothing else of them', async () => {
    const reply = { ...BOOKING, label: { ...BOOKING.label, url: KEY }, track: { ...TRACK, token: KEY } };
    const { engine } = client(200, { data: { bookings: [reply], bookable: false, blockedBy: 'booking' } });
    const [booking] = (await engine.bookings({ table: 'orders', id: '42' })).bookings;
    expect(booking!.label).toEqual(BOOKING.label);
    expect(booking!.track).toEqual(TRACK);
    expect(JSON.stringify(booking)).not.toContain(KEY);
  });

  it('keeps a booking with no tracking record readable', async () => {
    const { engine } = client(200, { data: { bookings: [{ ...BOOKING, track: null }, BOOKING], bookable: false, blockedBy: 'booking' } });
    const { bookings } = await engine.bookings({ table: 'orders', id: '42' });
    expect(bookings[0]!.track).toBeNull();
    expect('track' in bookings[1]!).toBe(false);
  });

  it('treats a booking with no label field as a bad answer', async () => {
    const { label: _label, ...old } = BOOKING;
    const { engine } = client(200, { data: old });
    const error = await caught(() => engine.book({ quoteId: 'q1', rateId: 'r1' }));
    expect(error.code).toBe(ENGINE_BAD_ANSWER);
    expect(classifyBookFailure(error).outcome).toBe('unknown');
  });

  it('retries an owed label with a bodyless POST', async () => {
    const { engine, calls } = client(200, { data: BOOKING });
    await engine.fetchDocument('b/1', 'label');
    expect(calls[0]!.path).toBe('/api/v1/apps/maker-shop/shipping/bookings/b%2F1/documents/label');
    expect(calls[0]!.init.method).toBe('POST');
    expect(calls[0]!.init.body).toBeUndefined();
    expect(calls[0]!.init.headers['content-type']).toBeUndefined();
  });

  it('downloads through the app\'s sender, so the install header rides along', async () => {
    const file = new Blob(['%PDF'], { type: 'application/pdf' });
    const calls: Call[] = [];
    const send: EngineSend = async (path, init) => {
      calls.push({ path, init });
      return { status: 200, text: async () => '', blob: async () => file };
    };
    const engine = createEngineCarrier({ send, appKey: 'maker-shop', addOnKey: 'shipping-shippo' });
    expect(await engine.downloadDocument('b1', 'label')).toBe(file);
    expect(calls[0]!.init.method).toBe('GET');
    expect(calls[0]!.path).toBe('/api/v1/apps/maker-shop/shipping/bookings/b1/documents/label');
  });

  it('says so when the app\'s sender cannot hand back a file', async () => {
    const { engine } = client(200, 'bytes');
    expect((await caught(() => engine.downloadDocument('b1', 'label'))).code).toBe(ENGINE_NO_DOWNLOAD);
  });

  it('reads a refused download as the engine\'s own code', async () => {
    const { engine } = client(410, { error: { code: 'LABEL_GONE', message: 'Deleted.' } });
    expect((await caught(() => engine.downloadDocument('b1', 'label'))).code).toBe('LABEL_GONE');
  });

  it('reads one parcel\'s refresh and the open-parcels refresh', async () => {
    const one = client(200, { data: { outcome: 'updated', track: TRACK } });
    expect(await one.engine.refreshBooking('b1')).toEqual({ outcome: 'updated', track: TRACK });
    expect(one.calls[0]!.path).toBe('/api/v1/apps/maker-shop/shipping/bookings/b1/refresh');

    const summary = { outcome: 'done', checked: 25, updated: 3, failed: 1, remaining: 4, more: true, oldestCheckedAt: 9, neverChecked: 2, retryAt: null };
    const open = client(200, { data: { ...summary, token: KEY } });
    expect(await open.engine.refreshOpenParcels()).toEqual(summary);
    expect(open.calls[0]!.path).toBe('/api/v1/apps/maker-shop/shipping/tracking/refresh');
  });
});

describe('a refusal that can only come before a purchase', () => {
  it.each(['SESSION_EXPIRED', 'TABLE_FORBIDDEN', 'APP_SCREENS_ONLY', 'READ_ONLY_MODE', 'APP_INSTALL_AMBIGUOUS', 'CSRF_FAILED'])('reads %s as a clear no', async (code) => {
    const { engine } = client(code === 'SESSION_EXPIRED' ? 401 : code === 'APP_INSTALL_AMBIGUOUS' ? 409 : 403, { error: { code, message: 'No.' } });
    const error = await caught(() => engine.book({ quoteId: 'q1', rateId: 'r1' }));
    expect(classifyBookFailure(error).outcome).toBe('refused');
  });
});

describe('a person who may not see prices', () => {
  it('gets no price, even from a reply that wrongly holds one', async () => {
    const hidden = { ...QUOTE, pricesHidden: true, rates: [RATE] };
    const quote = await client(200, { data: hidden }).engine.quote(QUOTE_REQUEST);
    expect(quote.pricesHidden).toBe(true);
    expect(JSON.stringify(quote)).not.toContain('7.25');
    expect(JSON.stringify(quote)).not.toContain('USD');
    expect(quote.rates[0]!.priced).toBe(false);
  });

  it('keeps the exact decimal for someone who may', async () => {
    const quote = await client(200, { data: QUOTE }).engine.quote(QUOTE_REQUEST);
    expect(quote.rates[0]).toMatchObject({ priced: true, amountDecimal: '7.25', currency: 'USD' });
  });
});

describe('buying a label', () => {
  const BOOK = { quoteId: 'q1', rateId: 'r1' };

  it('returns a booking whose result is unknown as data, not a failure', async () => {
    const booked = await client(200, { data: { ...BOOKING, state: 'unknown', tracking: null } }).engine.book(BOOK);
    expect(booked.state).toBe('unknown');
  });

  it('asks once, whatever goes wrong', async () => {
    let calls = 0;
    const send: EngineSend = async () => {
      calls += 1;
      throw new Error('socket closed');
    };
    const engine = createEngineCarrier({ send, appKey: 'a', addOnKey: 'b' });
    const error = await caught(() => engine.book(BOOK));
    expect(calls).toBe(1);
    expect(error.code).toBe(ENGINE_NO_ANSWER);
    expect(classifyBookFailure(error)).toMatchObject({ outcome: 'unknown', retryable: false });
  });

  it.each([
    ['a server error', 500, { error: { code: 'INTERNAL', message: 'boom' } }],
    ['a gateway page', 502, '<html>Bad gateway</html>'],
    ['a carrier that did not answer', 502, { error: { code: 'CARRIER_UNAVAILABLE', message: 'no answer' } }],
    ['a client error with no engine code', 404, '<html>Not found</html>'],
    ['a write conflict', 409, { error: { code: 'CONFLICT', message: 'try again' } }],
    ['a refusal this build does not know', 409, { error: { code: 'SOMETHING_NEW', message: 'new' } }],
    ['a repeat of a purchase whose quote is already spent', 404, { error: { code: 'QUOTE_NOT_FOUND', message: 'gone' } }],
    ['a parcel that already has a booking', 409, { error: { code: 'BOOKING_EXISTS', message: 'held' } }],
    ['an earlier label that went through', 409, { error: { code: 'ALREADY_BOUGHT', message: 'bought', details: { booking: BOOKING } } }],
    ['a carrier refusal with no booking to back it', 422, { error: { code: 'CARRIER_REFUSED', message: 'no' } }],
    ['a carrier refusal whose booking was settled as bought', 422, { error: { code: 'CARRIER_REFUSED', message: 'no', details: { booking: BOOKING } } }],
    ['a success with no data', 200, { ok: true }],
    ['a success that is not JSON', 200, 'done'],
    ['a booking in a shape it cannot read', 200, { data: { id: 'b1' } }],
  ])('reads %s as unknown, because a label may have been paid for', async (_name, status, body) => {
    const error = await caught(() => client(status, body).engine.book(BOOK));
    expect(classifyBookFailure(error)).toMatchObject({ outcome: 'unknown', retryable: false });
  });

  it.each([
    ['QUOTE_EXPIRED', 409, 'rate-expired'],
    ['ADDRESS_INCOMPLETE', 422, 'address'],
    ['CARRIER_NOT_CHECKED', 409, 'credentials'],
    ['OWNER_BOOKS', 403, undefined],
    ['CSRF_FAILED', 403, undefined],
  ])('reads %s as a clear no', async (code, status, reason) => {
    const error = await caught(() => client(status, { error: { code, message: 'no' } }).engine.book(BOOK));
    expect(error.outcome).toBe('refused');
    expect(error.reason).toBe(reason);
    expect(error.retryable).toBe(false);
  });

  it('reads a carrier\'s no as clear when the saved booking says refused, in the carrier\'s words', async () => {
    const error = await caught(() =>
      client(422, {
        error: {
          code: 'CARRIER_REFUSED',
          message: 'The carrier refused this label.',
          details: { booking: { ...BOOKING, state: 'refused', tracking: null }, reason: 'address', carrierMessage: 'Postcode not found' },
        },
      }).engine.book(BOOK),
    );
    expect(classifyBookFailure(error)).toMatchObject({ outcome: 'refused', reason: 'address', carrierMessage: 'Postcode not found', retryable: false });
  });

  it('passes on the booking that holds the parcel, and the wait', async () => {
    const holding = await caught(() =>
      client(409, { error: { code: 'BOOKING_EXISTS', message: 'held', details: { booking: { ...BOOKING, state: 'unknown' } } } }).engine.book(BOOK),
    );
    expect(holding.booking?.state).toBe('unknown');
    const waiting = await caught(() =>
      client(429, { error: { code: 'QUOTES_TOO_FAST', message: 'slow', details: { retryAfterSeconds: 12 } } }).engine.quote(QUOTE_REQUEST),
    );
    expect(waiting.retryAfterSeconds).toBe(12);
    expect(waiting.retryable).toBe(true);
  });

  it('never lets a broken reply on another call pass as bought', async () => {
    const error = await caught(() => client(200, { data: { bookings: 'none' } }).engine.bookings({ table: 'orders', id: '1' }));
    expect(error.code).toBe(ENGINE_BAD_ANSWER);
  });
});

describe('no carrier key passes through', () => {
  const planted = { api_key: KEY, apiKey: KEY, credentials: { api_token: KEY }, secret: KEY };

  it('drops every field it does not name, on each kind of reply', async () => {
    const results = await Promise.all([
      client(200, { data: { ...ACCESS, ...planted } }).engine.access(),
      client(200, { data: { ...QUOTE, ...planted, rates: [{ ...RATE, ...planted }] } }).engine.quote(QUOTE_REQUEST),
      client(200, { data: { ...BOOKING, ...planted } }).engine.book({ quoteId: 'q', rateId: 'r' }),
      client(200, { data: { bookings: [{ ...BOOKING, ...planted }], bookable: true, blockedBy: null, ...planted } }).engine.bookings({ table: 't', id: '1' }),
      client(200, { data: { outcome: 'found', booking: { ...BOOKING, ...planted }, ...planted } }).engine.checkBooking('b1'),
    ]);
    expect(JSON.stringify(results)).not.toContain(KEY);
  });

  it('keeps it out of a refusal, including the booking a refusal names', async () => {
    const error = await caught(() =>
      client(409, {
        error: {
          code: 'BOOKING_EXISTS',
          message: `carrier said: Authorization: Bearer ${KEY}`,
          details: { ...planted, booking: { ...BOOKING, ...planted, reason: `api_key=${KEY}` } },
        },
      }).engine.book({ quoteId: 'q', rateId: 'r' }),
    );
    const everything = JSON.stringify({ ...error, message: error.message, stack: error.stack });
    expect(everything).not.toContain(KEY);
    expect(error.booking?.reason).toBe('api_key=[hidden]');
  });

  it('scrubs free text a carrier wrote', async () => {
    const booking = await client(200, {
      data: { ...BOOKING, service: `Ground token=${KEY} api_token=${KEY}`, carrierName: `password: ${KEY}`, reason: `ShippoToken ${KEY}` },
    }).engine.book({ quoteId: 'q', rateId: 'r' });
    expect(booking.reason).toBe('[hidden]');
    expect(booking.carrierName).toBe('password: [hidden]');
    expect(booking.service).not.toContain(`api_token=${KEY}`);
  });

  it('recognises each credential shape, and leaves ordinary words alone', () => {
    const shaped = ['shippo', 'live', 'abc123'].join('_');
    for (const text of [`Bearer ${KEY}`, `Basic ${KEY}`, `ShippoToken ${KEY}`, shaped, `api-key: ${KEY}`, `"api_secret":"${KEY}"`, `account_number=${KEY}`]) {
      const scrubbed = scrubCredentials(text);
      expect(scrubbed).toContain('[hidden]');
      expect(scrubbed).not.toContain(KEY);
    }
    const plain = 'The postcode does not match the city. Basic parcels only.';
    expect(scrubCredentials(plain)).toBe(plain);
  });

  it('never quotes a transport error, which can hold the request it failed on', async () => {
    const send: EngineSend = async () => {
      throw new Error(`failed with header ${KEY}`);
    };
    const error = await caught(() => createEngineCarrier({ send, appKey: 'a', addOnKey: 'b' }).access());
    expect(JSON.stringify({ ...error, message: error.message, stack: error.stack })).not.toContain(KEY);
  });

  it('sends only the fields it names, whatever a caller added', async () => {
    const { calls, engine } = client(200, { data: QUOTE });
    await engine.quote({
      ...QUOTE_REQUEST,
      ...planted,
      source: { ...QUOTE_REQUEST.source, ...planted },
      parcel: { ...QUOTE_REQUEST.parcel, ...planted },
    } as typeof QUOTE_REQUEST);
    expect(JSON.stringify(calls)).not.toContain(KEY);
  });

  it('has no way to send, log or store anything of its own', () => {
    const code = readFileSync(new URL('./engine-carrier.ts', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(sendersIn(code)).toEqual([]);
    expect(foreignImportsIn(code)).toEqual([]);
    expect(offendingAddresses(code, [])).toEqual([]);
    expect(code).not.toMatch(/\bconsole\b|localStorage|sessionStorage|indexedDB/);
  });
});
