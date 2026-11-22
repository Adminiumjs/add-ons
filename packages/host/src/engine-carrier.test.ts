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
