/**
 * The Square card reader transport against a recorded Square: every call it
 * makes is answered from a table of the shapes the sandbox answered with
 * (read 2026-11-15), so this runs in a clean clone with no token. The sandbox
 * suite (`terminal.sandbox.test.ts`) proves the same against Square itself.
 */
import { describe, expect, it } from 'vitest';

import type { PaymentHttpClient } from '@adminium/add-on-host/contracts';
import { CARD_TERMINAL_ANSWER_SCHEMAS } from '@adminium/add-on-host/testing';

import { createSquareTerminal, SQUARE_HOSTS, SQUARE_VERSION } from './terminal.ts';

const TOKEN = 'EAAAlTestTokenOfTheRecordedSquare01';

interface Sent {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | null;
}

type Route = (sent: Sent) => { status: number; body: unknown } | undefined;

/** A Square that answers from `routes`, in order, and records every call. */
function fakeSquare(routes: Route[]): { http: PaymentHttpClient; sent: Sent[] } {
  const sent: Sent[] = [];
  const http: PaymentHttpClient = async (url, init) => {
    const one: Sent = { method: init?.method ?? 'GET', url, headers: init?.headers ?? {}, body: init?.body === undefined ? null : (JSON.parse(init.body) as Record<string, unknown>) };
    sent.push(one);
    for (const route of routes) {
      const answer = route(one);
      if (answer !== undefined) return { status: answer.status, headers: new Headers(), text: async () => JSON.stringify(answer.body) };
    }
    return { status: 404, headers: new Headers(), text: async () => JSON.stringify({ errors: [{ category: 'INVALID_REQUEST_ERROR', code: 'NOT_FOUND', detail: `no route for ${one.method} ${url}` }] }) };
  };
  return { http, sent };
}

const at = (method: string, path: string, answer: { status: number; body: unknown }): Route => (sent) => (sent.method === method && new URL(sent.url).pathname + new URL(sent.url).search === path ? answer : undefined);
const atPath = (method: string, pathname: string, answer: { status: number; body: unknown }): Route => (sent) => (sent.method === method && new URL(sent.url).pathname === pathname ? answer : undefined);

const make = (http: PaymentHttpClient, mode: 'test' | 'live' = 'test') => createSquareTerminal({ http, credentials: { access_token: TOKEN }, mode }, { now: () => Date.UTC(2026, 10, 15, 22) });

const checkout = (over: Record<string, unknown> = {}) => ({
  checkout: { id: 'TVKWm6HzcWK2pWCE', amount_money: { amount: 1250, currency: 'USD' }, device_options: { device_id: '995CS397A6475287' }, status: 'PENDING', ...over },
});

const payment = {
  payment: {
    id: 'IzkiSyrPQ6umj1eQacFrJ4qKYKfZY',
    amount_money: { amount: 1250, currency: 'USD' },
    tip_money: { amount: 250, currency: 'USD' },
    total_money: { amount: 1500, currency: 'USD' },
    status: 'COMPLETED',
    card_details: { status: 'CAPTURED', card: { card_brand: 'AMERICAN_EXPRESS', last_4: '1111' }, auth_result_code: 'Z0kpWQ' },
  },
};

describe('the Square card reader transport, offline', () => {
  it('calls the host of its mode, with the pinned API version and the token, and never repeats the token', async () => {
    for (const mode of ['test', 'live'] as const) {
      const square = fakeSquare([at('GET', '/v2/merchants/me', { status: 401, body: { errors: [{ category: 'AUTHENTICATION_ERROR', code: 'UNAUTHORIZED', detail: `This request could not be authorized: ${TOKEN}` }] } })]);
      const answer = await make(square.http, mode).checkCredentials();
      expect(square.sent[0]!.url.startsWith(SQUARE_HOSTS[mode])).toBe(true);
      expect(square.sent[0]!.headers).toMatchObject({ authorization: `Bearer ${TOKEN}`, 'square-version': SQUARE_VERSION });
      expect(answer).toMatchObject({ ok: false, code: 'CREDENTIALS_REFUSED' });
      expect(JSON.stringify(answer)).not.toContain(TOKEN);
      expect(!answer.ok && answer.providerMessage).toContain(mode === 'test' ? 'sandbox' : 'live');
    }
  });

  it('says whose account it is, and names the permission pairing needs when the token lacks it', async () => {
    const square = fakeSquare([
      at('GET', '/v2/merchants/me', { status: 200, body: { merchant: { id: 'MLV58YS5PEP72' } } }),
      at('GET', '/v2/devices/codes?product_type=TERMINAL_API', { status: 403, body: { errors: [{ category: 'AUTHENTICATION_ERROR', code: 'INSUFFICIENT_SCOPES' }] } }),
    ]);
    const answer = await make(square.http).checkCredentials();
    expect(CARD_TERMINAL_ANSWER_SCHEMAS.checkCredentials.safeParse(answer).success).toBe(true);
    expect(answer).toEqual({ ok: true, accountId: 'MLV58YS5PEP72', livemode: false, missing: ['DEVICE_CREDENTIAL_MANAGEMENT'] });
  });

  it('answers a refusal as data: rate limits and outages may be tried again, a network failure too', async () => {
    const limited = fakeSquare([at('GET', '/v2/locations', { status: 429, body: { errors: [{ category: 'RATE_LIMIT_ERROR', code: 'RATE_LIMITED' }] } })]);
    expect(await make(limited.http).listLocations()).toMatchObject({ ok: false, code: 'RATE_LIMITED', retryable: true });
    const down = fakeSquare([at('GET', '/v2/locations', { status: 503, body: {} })]);
    expect(await make(down.http).listLocations()).toMatchObject({ ok: false, code: 'UNAVAILABLE', retryable: true });
    const gone: PaymentHttpClient = async () => {
      throw new Error('ECONNRESET');
    };
    expect(await make(gone).listLocations()).toMatchObject({ ok: false, code: 'UNAVAILABLE', retryable: true });
    expect(await createSquareTerminal({ http: gone, credentials: {}, mode: 'test' }).listLocations()).toMatchObject({ ok: false, code: 'CREDENTIALS_REFUSED' });
  });

  it('puts the amount on the Terminal in minor units, with its key and reference made to fit, and no receipt screen', async () => {
    const square = fakeSquare([atPath('POST', '/v2/terminals/checkouts', { status: 200, body: checkout() }), atPath('GET', '/v2/devices/device:995CS397A6475287', { status: 200, body: { device: { status: { category: 'AVAILABLE' } } } })]);
    const long = 'k'.repeat(90);
    const sent = await make(square.http).sendToReader({ readerId: '995CS397A6475287', amount: '12.50', currency: 'USD', attemptId: 'pat_'.padEnd(60, 'a'), idempotencyKey: long, tipping: true });
    expect(CARD_TERMINAL_ANSWER_SCHEMAS.sendToReader.safeParse(sent).success).toBe(true);
    expect(sent).toMatchObject({ ok: true, ref: 'TVKWm6HzcWK2pWCE', status: 'waiting', amount: null, currency: 'USD' });
    const body = square.sent[0]!.body as { idempotency_key: string; checkout: Record<string, unknown> };
    expect(body.checkout).toMatchObject({ amount_money: { amount: 1250, currency: 'USD' }, deadline_duration: 'PT5M', device_options: { device_id: '995CS397A6475287', skip_receipt_screen: true, tip_settings: { allow_tipping: true } } });
    expect(body.idempotency_key.length).toBeLessThanOrEqual(64);
    expect((body.checkout['reference_id'] as string).length).toBeLessThanOrEqual(40);
    // The same long key is hashed the same way every time: one checkout however often it is sent.
    await make(square.http).sendToReader({ readerId: '995CS397A6475287', amount: '12.50', currency: 'USD', attemptId: 'pat_'.padEnd(60, 'a'), idempotencyKey: long, tipping: true });
    expect((square.sent[2]!.body as { idempotency_key: string }).idempotency_key).toBe(body.idempotency_key);
  });

  it('reads each checkout state as the contract says it', async () => {
    const read = async (over: Record<string, unknown>, device: string = 'AVAILABLE') =>
      make(
        fakeSquare([
          atPath('GET', '/v2/terminals/checkouts/TVKWm6HzcWK2pWCE', { status: 200, body: checkout(over) }),
          atPath('GET', '/v2/payments/IzkiSyrPQ6umj1eQacFrJ4qKYKfZY', { status: 200, body: payment }),
          atPath('GET', '/v2/devices/device:995CS397A6475287', { status: 200, body: { device: { status: { category: device } } } }),
        ]).http,
      ).readerStatus('TVKWm6HzcWK2pWCE');
    expect(await read({ status: 'PENDING' })).toMatchObject({ status: 'waiting' });
    expect(await read({ status: 'PENDING' }, 'OFFLINE')).toMatchObject({ status: 'offline' });
    expect(await read({ status: 'IN_PROGRESS' })).toMatchObject({ status: 'on_reader' });
    expect(await read({ status: 'CANCEL_REQUESTED' })).toMatchObject({ status: 'on_reader' });
    const taken = await read({ status: 'COMPLETED', payment_ids: ['IzkiSyrPQ6umj1eQacFrJ4qKYKfZY'] });
    expect(CARD_TERMINAL_ANSWER_SCHEMAS.readerStatus.safeParse(taken).success).toBe(true);
    expect(taken).toMatchObject({ status: 'succeeded', amount: '15.00', tip: '2.50', paymentRef: 'IzkiSyrPQ6umj1eQacFrJ4qKYKfZY', brand: 'American Express', last4: '1111', approvalCode: 'Z0kpWQ', interac: false });
    expect(await read({ status: 'CANCELED', cancel_reason: 'BUYER_CANCELED' })).toMatchObject({ status: 'cancelled', failureMessage: 'The customer cancelled on the reader.' });
    expect(await read({ status: 'CANCELED', cancel_reason: 'TIMED_OUT' })).toMatchObject({ status: 'cancelled', failureMessage: 'Nobody took the payment on the reader in time.' });
    expect(await read({ status: 'CANCELED', cancel_reason: 'SELLER_CANCELED' })).toMatchObject({ status: 'cancelled', failureMessage: null });
  });

  it('answers an unknown or malformed checkout NOT_FOUND without asking Square for a path it should not', async () => {
    const square = fakeSquare([]);
    expect(await make(square.http).readerStatus('../v2/payments')).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    expect(square.sent).toHaveLength(0);
    expect(await make(square.http).readerStatus('nope_unknown')).toMatchObject({ ok: false, code: 'NOT_FOUND' });
  });

  it('answers a cancel after the card was taken as the payment, and asks Square nothing more', async () => {
    const square = fakeSquare([
      atPath('GET', '/v2/terminals/checkouts/TVKWm6HzcWK2pWCE', { status: 200, body: checkout({ status: 'COMPLETED', payment_ids: ['IzkiSyrPQ6umj1eQacFrJ4qKYKfZY'] }) }),
      atPath('GET', '/v2/payments/IzkiSyrPQ6umj1eQacFrJ4qKYKfZY', { status: 200, body: payment }),
    ]);
    expect(await make(square.http).cancelOnReader('TVKWm6HzcWK2pWCE')).toMatchObject({ status: 'succeeded' });
    expect(square.sent.some((one) => one.url.endsWith('/cancel'))).toBe(false);
  });

  it('refuses an Interac refund online, and reads a refund as the contract says it', async () => {
    const interac = { payment: { ...payment.payment, card_details: { card: { card_brand: 'INTERAC', last_4: '4321' } } } };
    const refused = fakeSquare([atPath('GET', '/v2/payments/IzkiSyrPQ6umj1eQacFrJ4qKYKfZY', { status: 200, body: interac })]);
    const input = { paymentRef: 'IzkiSyrPQ6umj1eQacFrJ4qKYKfZY', amount: '12.50', currency: 'USD', reason: 'requested_by_customer' as const, idempotencyKey: 'x'.repeat(70) };
    expect(await make(refused.http).refund(input)).toMatchObject({ ok: false, code: 'REFUND_REFUSED' });
    expect(refused.sent.some((one) => one.url.endsWith('/v2/refunds'))).toBe(false);

    const made = fakeSquare([
      atPath('GET', '/v2/payments/IzkiSyrPQ6umj1eQacFrJ4qKYKfZY', { status: 200, body: payment }),
      atPath('POST', '/v2/refunds', { status: 200, body: { refund: { id: 'R1', status: 'PENDING', amount_money: { amount: 1250, currency: 'USD' }, payment_id: 'IzkiSyrPQ6umj1eQacFrJ4qKYKfZY' } } }),
    ]);
    const refund = await make(made.http).refund(input);
    expect(CARD_TERMINAL_ANSWER_SCHEMAS.refund.safeParse(refund).success).toBe(true);
    expect(refund).toEqual({ ok: true, ref: 'R1', paymentRef: 'IzkiSyrPQ6umj1eQacFrJ4qKYKfZY', status: 'pending', amount: '12.50', currency: 'USD', failureMessage: null });
    // Square takes a refund key of at most 45 characters.
    expect((made.sent[1]!.body as { idempotency_key: string }).idempotency_key.length).toBeLessThanOrEqual(45);

    const tooMuch = fakeSquare([
      atPath('GET', '/v2/payments/IzkiSyrPQ6umj1eQacFrJ4qKYKfZY', { status: 200, body: payment }),
      atPath('POST', '/v2/refunds', { status: 400, body: { errors: [{ category: 'INVALID_REQUEST_ERROR', code: 'REFUND_AMOUNT_INVALID', detail: 'The requested refund amount exceeds the amount available to refund.' }] } }),
    ]);
    expect(await make(tooMuch.http).refund(input)).toMatchObject({ ok: false, code: 'REFUND_REFUSED', providerMessage: 'The requested refund amount exceeds the amount available to refund.' });
    const unknown = fakeSquare([atPath('GET', '/v2/refunds/R404', { status: 400, body: { errors: [{ category: 'INVALID_REQUEST_ERROR', code: 'INVALID_VALUE', field: 'refund_id' }] } })]);
    expect(await make(unknown.http).refundStatus('R404')).toMatchObject({ ok: false, code: 'NOT_FOUND' });
  });

  it('converts amounts exactly in each currency, or refuses them', () => {
    const terminal = make(fakeSquare([]).http);
    expect(terminal.toMinor('12.50', 'USD')).toEqual({ minor: '1250', currency: 'USD' });
    expect(terminal.toMinor('1200', 'JPY')).toEqual({ minor: '1200', currency: 'JPY' });
    expect(terminal.toMinor('12.505', 'USD')).toMatchObject({ ok: false, code: 'AMOUNT_UNREPRESENTABLE' });
    expect(terminal.toMinor('12.5', 'JPY')).toMatchObject({ ok: false, code: 'AMOUNT_UNREPRESENTABLE' });
    expect(terminal.toMinor('1', 'XYZ')).toMatchObject({ ok: false, code: 'CURRENCY_UNSUPPORTED' });
    expect(terminal.fromMinor('1500', 'USD')).toBe('15.00');
  });

  it('pairs the show way: a device code to type on the Terminal, waiting until Square says it is paired, refused once it ran out', async () => {
    const code = { id: 'V3FQ2JK7CS0JE', name: 'Front counter', code: 'DEVGSF', product_type: 'TERMINAL_API', location_id: 'L2KY26GH0RXFB', pair_by: '2026-11-15T22:27:22.000Z', status: 'UNPAIRED' };
    const square = fakeSquare([atPath('POST', '/v2/devices/codes', { status: 200, body: { device_code: code } })]);
    const started = await make(square.http).startPairing({ label: 'Front counter', locationId: 'L2KY26GH0RXFB' });
    expect(CARD_TERMINAL_ANSWER_SCHEMAS.startPairing.safeParse(started).success).toBe(true);
    expect(started).toEqual({ ok: true, way: 'show', code: 'DEVGSF', pairing: 'V3FQ2JK7CS0JE', expiresAt: Date.parse('2026-11-15T22:27:22.000Z') });
    expect(square.sent[0]!.body).toMatchObject({ device_code: { product_type: 'TERMINAL_API', name: 'Front counter', location_id: 'L2KY26GH0RXFB' } });

    const finish = (status: string, extra: Record<string, unknown> = {}) =>
      make(
        fakeSquare([
          atPath('GET', '/v2/devices/codes/V3FQ2JK7CS0JE', { status: 200, body: { device_code: { ...code, status, ...extra } } }),
          atPath('GET', '/v2/devices/device:995CS397A6475287', { status: 200, body: { device: { attributes: { manufacturer: 'Square', model: 'T2', updated_at: '2026-11-15T21:53:24.549Z' }, status: { category: 'AVAILABLE' } } } }),
        ]).http,
      ).finishPairing({ pairing: 'V3FQ2JK7CS0JE', code: null });
    expect(await finish('UNPAIRED')).toEqual({ ok: true, state: 'waiting' });
    expect(await finish('EXPIRED')).toMatchObject({ ok: false, code: 'INVALID_REQUEST' });
    const paired = await finish('PAIRED', { device_id: '995CS397A6475287' });
    expect(CARD_TERMINAL_ANSWER_SCHEMAS.finishPairing.safeParse(paired).success).toBe(true);
    expect(paired).toEqual({ ok: true, state: 'paired', reader: { id: '995CS397A6475287', label: 'Front counter', locationId: 'L2KY26GH0RXFB', model: 'Square T2', online: true, lastSeenAt: Date.parse('2026-11-15T21:53:24.549Z') } });
  });

  it('lists the paired Terminals, offline where the Devices API says so', async () => {
    const square = fakeSquare([
      atPath('GET', '/v2/devices/codes', { status: 200, body: { device_codes: [{ id: 'C1', name: 'Front', device_id: 'S1', location_id: 'L1', status: 'PAIRED' }, { id: 'C2', name: 'Back', device_id: 'S2', location_id: 'L1', status: 'PAIRED' }] } }),
      atPath('GET', '/v2/devices', { status: 200, body: { devices: [{ attributes: { manufacturers_id: 'S2', model: 'T2', manufacturer: 'Square' }, status: { category: 'OFFLINE' } }] } }),
    ]);
    const list = await make(square.http).listReaders(null);
    expect(CARD_TERMINAL_ANSWER_SCHEMAS.listReaders.safeParse(list).success).toBe(true);
    expect(list.ok && list.readers.map((one) => [one.id, one.label, one.online])).toEqual([
      ['S1', 'Front', true],
      ['S2', 'Back', false],
    ]);
  });

  it('reads refunds and disputes made at Square as events, page by page, and starts again a little behind the newest', async () => {
    const square = fakeSquare([
      atPath('GET', '/v2/refunds', { status: 200, body: { refunds: [{ id: 'R1', status: 'COMPLETED', payment_id: 'P1', updated_at: '2026-11-15T21:00:00.000Z' }] } }),
      atPath('GET', '/v2/disputes', {
        status: 200,
        body: { disputes: [{ id: 'D1', state: 'LOST', amount_money: { amount: 1500, currency: 'USD' }, disputed_payment: { payment_id: 'P2' }, created_at: '2026-11-14T10:00:00.000Z', updated_at: '2026-11-15T20:00:00.000Z' }], cursor: 'more-disputes' },
      }),
    ]);
    const first = await make(square.http).listEvents(null);
    expect(CARD_TERMINAL_ANSWER_SCHEMAS.listEvents.safeParse(first).success).toBe(true);
    if (!first.ok) throw new Error(first.providerMessage);
    expect(first.events).toEqual([
      { ok: true, eventId: 'refund:R1:COMPLETED', type: 'refund.updated', kind: 'refund', checkoutRef: null, paymentRef: 'P1', refundRef: 'R1', livemode: false, occurredAt: Date.parse('2026-11-15T21:00:00.000Z') },
      {
        ok: true,
        eventId: 'dispute:D1:LOST',
        type: 'dispute.updated',
        kind: 'dispute',
        checkoutRef: null,
        paymentRef: 'P2',
        refundRef: null,
        livemode: false,
        occurredAt: Date.parse('2026-11-15T20:00:00.000Z'),
        dispute: { status: 'lost', amount: '15.00', currency: 'USD', openedAt: Date.parse('2026-11-14T10:00:00.000Z') },
      },
    ]);
    expect(first.more).toBe(true);
    // The next page reads only the list that has more.
    await make(square.http).listEvents(first.cursor);
    expect(square.sent.slice(2).map((one) => new URL(one.url).pathname)).toEqual(['/v2/disputes']);
    expect(new URL(square.sent[2]!.url).searchParams.get('cursor')).toBe('more-disputes');
  });
});
