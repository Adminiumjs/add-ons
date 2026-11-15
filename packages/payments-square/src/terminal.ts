/**
 * CARD READERS: `card-terminal@1` spoken to Square's Terminal API, with the
 * admin's own Square access token, driven from the server: the till asks
 * Adminium, Adminium asks Square, Square puts the amount on the Terminal.
 *
 * A charge is a Terminal checkout; its reference is the checkout's id. How
 * Square's states read (proven against the sandbox's test devices):
 *   - `PENDING`                         → `waiting` (`offline` when the device says so)
 *   - `IN_PROGRESS`, `CANCEL_REQUESTED` → `on_reader`
 *   - `COMPLETED`                       → `succeeded`, read off its payment: taken in all
 *                                         (`total_money`), the tip apart (`tip_money`)
 *   - `CANCELED`                        → `cancelled`, with Square's reason in words
 *                                         (the customer cancelled, nobody took it in time)
 * A Terminal lets the customer try another card after a decline, so a checkout
 * never ends "declined": it ends taken or cancelled.
 *
 * Pairing runs Square's way round: Square makes a device code, the person
 * types it on the Terminal (`show`), and the code turns `PAIRED` with the
 * device's id. Square has no call that unpairs a Terminal (it is signed out on
 * the device), so unpairing forgets it here and says nothing to Square.
 *
 * An Interac card (Canada) is refunded on the Terminal with the card, so its
 * refund is refused here. Square keeps a completed checkout for 30 days; the
 * engine keeps its own copy of what was taken.
 */

import {
  isoExponent,
  decimalToMinor,
  minorToDecimal,
  providerError,
  type CardTerminal,
  type CreateCardTerminal,
  type MinorAmount,
  type PaymentEvent,
  type PaymentHttpClient,
  type PaymentMode,
  type PaymentProviderContext,
  type ProviderError,
  type Reader,
  type ReaderChargeState,
  type ReaderChargeStatus,
  type RefundState,
  type RefundStatus,
} from '@adminium/add-on-host/contracts';

export const SQUARE_ADD_ON_KEY = 'payments-square';

/** The API version every call names: Square answers in this version's shapes, whatever the app's default. */
export const SQUARE_VERSION = '2025-10-16';

export const SQUARE_HOSTS: Readonly<Record<PaymentMode, string>> = {
  test: 'https://connect.squareupsandbox.com',
  live: 'https://connect.squareup.com',
};

type Json = Record<string, unknown>;

function isError(value: unknown): value is ProviderError {
  return typeof value === 'object' && value !== null && (value as { ok?: unknown }).ok === false;
}
function asObject(value: unknown): Json | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : null;
}
function text(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}
function list(value: unknown): Json[] {
  return Array.isArray(value) ? value.map(asObject).filter((one): one is Json => one !== null) : [];
}
function epoch(value: unknown): number | null {
  const at = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  return Number.isFinite(at) ? at : null;
}

/** Square's limits on a key and a reference, by field. A longer one is hashed, the same way every time. */
const IDEMPOTENCY_MAX = { checkout: 64, deviceCode: 128, refund: 45 } as const;
const REFERENCE_MAX = 40;

async function fitted(value: string, max: number): Promise<string> {
  if (value.length <= max) return value;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return `h${[...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`.slice(0, max);
}

/** Square's card brands, in the words a receipt uses. */
const BRANDS: Readonly<Record<string, string>> = {
  VISA: 'Visa',
  MASTERCARD: 'Mastercard',
  AMERICAN_EXPRESS: 'American Express',
  DISCOVER: 'Discover',
  DISCOVER_DINERS: 'Diners Club',
  JCB: 'JCB',
  CHINA_UNIONPAY: 'UnionPay',
  SQUARE_GIFT_CARD: 'Square gift card',
  EFTPOS: 'eftpos',
  FELICA: 'FeliCa',
  INTERAC: 'Interac',
  EBT: 'EBT',
};

/** Why Square ended a checkout, said to staff. A cancel from Adminium needs no words. */
const CANCEL_WORDS: Readonly<Record<string, string>> = {
  BUYER_CANCELED: 'The customer cancelled on the reader.',
  TIMED_OUT: 'Nobody took the payment on the reader in time.',
};

/** A pairing code lasts as long as Square says (`pair_by`); this is the fallback. */
const PAIRING_MS = 5 * 60_000;
/** How far back the first event read looks. */
const FIRST_LOOK_MS = 72 * 3_600_000;
/** Each read looks this far behind the last one, so an event written late is not passed over. */
const OVERLAP_MS = 10 * 60_000;
/** How long a checkout waits on the Terminal before Square times it out. */
const CHECKOUT_DEADLINE = 'PT5M';

export interface SquareTerminalOptions {
  readonly now?: () => number;
}

/** Builds the card reader half for one operation. */
export function createSquareTerminal(context: PaymentProviderContext, options: SquareTerminalOptions = {}): CardTerminal {
  const now = options.now ?? (() => Date.now());
  const base = SQUARE_HOSTS[context.mode];
  const token = (context.credentials['access_token'] ?? '').trim();
  const http: PaymentHttpClient = context.http;

  /** Square's words, with the token taken out should a message ever carry it. */
  function words(body: Json | null, fallback: string): string {
    const first = list(body?.['errors'])[0];
    const said = text(first?.['detail']) ?? text(first?.['code']) ?? fallback;
    return token === '' ? said : said.split(token).join('[token]');
  }

  /** A refusal from Square's status and error list. */
  function refusal(status: number, body: Json | null, refund: boolean): ProviderError {
    const codes = list(body?.['errors']).map((one) => `${text(one['category']) ?? ''}:${text(one['code']) ?? ''}`);
    const has = (part: string): boolean => codes.some((code) => code.includes(part));
    if (status === 401 || has('AUTHENTICATION_ERROR')) {
      return providerError('CREDENTIALS_REFUSED', `Square refused the access token for ${context.mode === 'test' ? 'the sandbox (test payments)' : 'live payments'}: ${words(body, 'not authorized')}. A sandbox token works only for test payments, a production token only for live ones.`);
    }
    if (status === 403 || has('INSUFFICIENT_SCOPES')) return providerError('PERMISSION_MISSING', words(body, 'The access token lacks a permission this needs.'));
    if (status === 404 || has(':NOT_FOUND')) return providerError('NOT_FOUND', words(body, 'Square has no such thing.'));
    if (status === 429 || has('RATE_LIMIT')) return providerError('RATE_LIMITED', words(body, 'Square asked to slow down.'), true);
    if (status >= 500) return providerError('UNAVAILABLE', words(body, 'Square did not answer.'), true);
    if (has('CURRENCY')) return providerError('CURRENCY_UNSUPPORTED', words(body, 'Square takes no payments in this currency here.'));
    if (refund) return providerError('REFUND_REFUSED', words(body, 'Square refused the refund.'));
    return providerError('INVALID_REQUEST', words(body, 'Square refused the request.'));
  }

  /** One call, answered as Square answered it. A network failure is `UNAVAILABLE`. */
  async function call(method: 'GET' | 'POST', path: string, body?: Json): Promise<{ status: number; body: Json | null } | ProviderError> {
    if (token === '') return providerError('CREDENTIALS_REFUSED', 'No Square access token is saved for this mode.');
    let response;
    try {
      response = await http(`${base}${path}`, {
        method,
        headers: { authorization: `Bearer ${token}`, 'square-version': SQUARE_VERSION, accept: 'application/json', ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      return providerError('UNAVAILABLE', 'Square could not be reached.', true);
    }
    let parsed: Json | null = null;
    try {
      parsed = asObject(JSON.parse(await response.text()));
    } catch {
      parsed = null;
    }
    return { status: response.status, body: parsed };
  }

  /** One call whose refusal is data, and whose answer is Square's JSON. */
  async function request(method: 'GET' | 'POST', path: string, body?: Json, refund = false): Promise<Json | ProviderError> {
    const answer = await call(method, path, body);
    if (isError(answer)) return answer;
    if (answer.status < 200 || answer.status >= 300) return refusal(answer.status, answer.body, refund);
    if (answer.body === null) return providerError('UNAVAILABLE', 'Square answered with something that is not JSON.', true);
    return answer.body;
  }

  function toMinor(amount: string, currency: string): MinorAmount | ProviderError {
    const exponent = isoExponent(currency);
    if (exponent === null) return providerError('CURRENCY_UNSUPPORTED', `${currency} is not a currency Square takes.`);
    const minor = decimalToMinor(amount, exponent);
    if (minor === null) return providerError('AMOUNT_UNREPRESENTABLE', `${amount} ${currency} cannot be charged exactly in ${currency}'s smallest unit.`);
    return { minor, currency };
  }
  function fromMinor(minor: string, currency: string): string | ProviderError {
    const exponent = isoExponent(currency);
    if (exponent === null) return providerError('CURRENCY_UNSUPPORTED', `${currency} is not a currency Square takes.`);
    return minorToDecimal(minor, exponent) ?? providerError('AMOUNT_UNREPRESENTABLE', `${minor} is not an amount in ${currency}'s smallest unit.`);
  }
  /** Square's money object as a decimal string, or null. */
  function money(value: unknown): { amount: string; currency: string } | null {
    const held = asObject(value);
    const currency = text(held?.['currency']);
    const minor = held?.['amount'];
    if (currency === null || typeof minor !== 'number' || !Number.isInteger(minor)) return null;
    const amount = fromMinor(String(minor), currency);
    return isError(amount) ? null : { amount, currency };
  }

  /** What a Terminal reads as, from the Devices API, by the id a checkout names. Null when Square does not say. */
  async function deviceOf(deviceId: string): Promise<Json | null> {
    const answer = await request('GET', `/v2/devices/${encodeURIComponent(`device:${deviceId}`)}`);
    return isError(answer) ? null : asObject(answer['device']);
  }

  function readerOf(code: Json, device: Json | null): Reader {
    const attributes = asObject(device?.['attributes']);
    const category = text(asObject(device?.['status'])?.['category']);
    return {
      id: text(code['device_id']) ?? '',
      label: text(code['name']) ?? text(attributes?.['name']) ?? '',
      locationId: text(code['location_id']),
      model: attributes === null ? 'Square Terminal' : [text(attributes['manufacturer']), text(attributes['model'])].filter((part) => part !== null).join(' ') || 'Square Terminal',
      // Square says a Terminal is offline only through the Devices API; one it does not list there is not called offline.
      online: category !== 'OFFLINE',
      lastSeenAt: epoch(attributes?.['updated_at']) ?? epoch(code['status_changed_at']),
    };
  }

  async function chargeOf(checkout: Json): Promise<ReaderChargeState | ProviderError> {
    const id = text(checkout['id']);
    const asked = money(checkout['amount_money']);
    if (id === null || asked === null) return providerError('UNAVAILABLE', 'Square sent a checkout Adminium cannot read.');
    const status = text(checkout['status']);
    const blank = { ok: true as const, ref: id, amount: null, tip: null, currency: asked.currency, paymentRef: null, brand: null, last4: null, approvalCode: null, interac: false, failureMessage: null };
    if (status === 'COMPLETED') {
      const paymentId = text((checkout['payment_ids'] as unknown[] | undefined)?.[0]);
      if (paymentId === null) return { ...blank, status: 'on_reader' };
      const paid = await request('GET', `/v2/payments/${encodeURIComponent(paymentId)}`);
      if (isError(paid)) return paid;
      const payment = asObject(paid['payment']) ?? {};
      const card = asObject(asObject(payment['card_details'])?.['card']);
      const brand = text(card?.['card_brand']);
      const total = money(payment['total_money']) ?? money(payment['amount_money']);
      return {
        ...blank,
        status: 'succeeded',
        amount: total?.amount ?? null,
        tip: money(payment['tip_money'])?.amount ?? '0',
        paymentRef: paymentId,
        brand: brand === null ? null : (BRANDS[brand] ?? brand.charAt(0) + brand.slice(1).toLowerCase().replace(/_/g, ' ')),
        last4: text(card?.['last_4']),
        approvalCode: text(asObject(payment['card_details'])?.['auth_result_code']),
        interac: brand === 'INTERAC',
      };
    }
    if (status === 'CANCELED') {
      const reason = text(checkout['cancel_reason']);
      return { ...blank, status: 'cancelled', failureMessage: reason === null ? null : (CANCEL_WORDS[reason] ?? null) };
    }
    if (status === 'IN_PROGRESS' || status === 'CANCEL_REQUESTED') return { ...blank, status: 'on_reader' };
    // PENDING: Square has handed it to the Terminal, or holds it until the Terminal comes back.
    const deviceId = text(asObject(checkout['device_options'])?.['device_id']);
    const device = deviceId === null ? null : await deviceOf(deviceId);
    const offline = text(asObject(device?.['status'])?.['category']) === 'OFFLINE';
    const state: ReaderChargeStatus = offline ? 'offline' : 'waiting';
    return { ...blank, status: state };
  }

  async function read(ref: string): Promise<ReaderChargeState | ProviderError> {
    if (!/^[A-Za-z0-9_-]{1,192}$/.test(ref)) return providerError('NOT_FOUND', 'No such checkout.');
    const answer = await request('GET', `/v2/terminals/checkouts/${encodeURIComponent(ref)}`);
    if (isError(answer)) return answer;
    const checkout = asObject(answer['checkout']);
    return checkout === null ? providerError('UNAVAILABLE', 'Square sent a checkout Adminium cannot read.') : chargeOf(checkout);
  }

  function refundOf(body: Json): RefundState | ProviderError {
    const refund = asObject(body['refund']) ?? body;
    const id = text(refund['id']);
    const paymentId = text(refund['payment_id']);
    const amount = money(refund['amount_money']);
    if (id === null || paymentId === null || amount === null) return providerError('UNAVAILABLE', 'Square sent a refund Adminium cannot read.');
    const said = text(refund['status']);
    const status: RefundStatus = said === 'COMPLETED' ? 'succeeded' : said === 'REJECTED' || said === 'FAILED' ? 'failed' : 'pending';
    return { ok: true, ref: id, paymentRef: paymentId, status, amount: amount.amount, currency: amount.currency, failureMessage: status === 'failed' ? `Square ${said === 'REJECTED' ? 'rejected' : 'could not make'} the refund.` : null };
  }

  return {
    key: SQUARE_ADD_ON_KEY,
    mode: context.mode,
    async checkCredentials() {
      const me = await request('GET', '/v2/merchants/me');
      if (isError(me)) return me;
      const accountId = text(asObject(me['merchant'])?.['id']);
      if (accountId === null) return providerError('UNAVAILABLE', 'Square did not say whose account this is.');
      // Pairing needs device codes; a token without that permission is told so by name.
      const probe = await call('GET', '/v2/devices/codes?product_type=TERMINAL_API');
      if (isError(probe)) return probe;
      const missing = probe.status === 403 ? ['DEVICE_CREDENTIAL_MANAGEMENT'] : [];
      return { ok: true, accountId, livemode: context.mode === 'live', missing };
    },
    async listLocations() {
      const body = await request('GET', '/v2/locations');
      if (isError(body)) return body;
      return {
        ok: true,
        locations: list(body['locations'])
          .filter((one) => text(one['status']) !== 'INACTIVE')
          .map((one) => ({ id: text(one['id']) ?? '', name: text(one['name']) ?? '' }))
          .filter((one) => one.id !== '' && one.name !== ''),
      };
    },
    async listReaders(locationId) {
      const codes: Json[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < 20; page += 1) {
        const query = new URLSearchParams({ product_type: 'TERMINAL_API', status: 'PAIRED', ...(locationId == null ? {} : { location_id: locationId }), ...(cursor === null ? {} : { cursor }) });
        const body = await request('GET', `/v2/devices/codes?${query.toString()}`);
        if (isError(body)) return body;
        codes.push(...list(body['device_codes']));
        cursor = text(body['cursor']);
        if (cursor === null) break;
      }
      const devices = await request('GET', `/v2/devices?${new URLSearchParams(locationId == null ? {} : { location_id: locationId }).toString()}`);
      const bySerial = new Map(isError(devices) ? [] : list(devices['devices']).map((device) => [text(asObject(device['attributes'])?.['manufacturers_id']) ?? '', device] as const));
      return { ok: true, readers: codes.filter((code) => text(code['device_id']) !== null).map((code) => readerOf(code, bySerial.get(text(code['device_id'])!) ?? null)) };
    },
    async startPairing(input) {
      const key = await fitted(`pair:${input.label}:${input.locationId ?? ''}:${now()}`, IDEMPOTENCY_MAX.deviceCode);
      const body = await request('POST', '/v2/devices/codes', { idempotency_key: key, device_code: { product_type: 'TERMINAL_API', name: input.label, ...(input.locationId === null ? {} : { location_id: input.locationId }) } });
      if (isError(body)) return body;
      const code = asObject(body['device_code']);
      const id = text(code?.['id']);
      const shown = text(code?.['code']);
      if (id === null || shown === null) return providerError('UNAVAILABLE', 'Square sent a pairing code Adminium cannot read.');
      return { ok: true, way: 'show', code: shown, pairing: id, expiresAt: epoch(code?.['pair_by']) ?? now() + PAIRING_MS };
    },
    async finishPairing(input) {
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(input.pairing)) return providerError('INVALID_REQUEST', 'This pairing is not one Adminium started.');
      const body = await request('GET', `/v2/devices/codes/${encodeURIComponent(input.pairing)}`);
      if (isError(body)) return body;
      const code = asObject(body['device_code']) ?? {};
      const status = text(code['status']);
      if (status === 'EXPIRED') return providerError('INVALID_REQUEST', 'The code ran out before the Terminal took it. Start again for a new code.');
      if (status !== 'PAIRED' || text(code['device_id']) === null) return { ok: true, state: 'waiting' };
      return { ok: true, state: 'paired', reader: readerOf(code, await deviceOf(text(code['device_id'])!)) };
    },
    // Square has no call that unpairs a Terminal: it is signed out on the device. Adminium forgets it.
    unpairReader: async () => ({ ok: true }),
    async sendToReader(input) {
      const minor = toMinor(input.amount, input.currency);
      if (isError(minor)) return minor;
      const body = await request('POST', '/v2/terminals/checkouts', {
        idempotency_key: await fitted(input.idempotencyKey, IDEMPOTENCY_MAX.checkout),
        checkout: {
          amount_money: { amount: Number(minor.minor), currency: input.currency },
          reference_id: await fitted(input.attemptId, REFERENCE_MAX),
          deadline_duration: CHECKOUT_DEADLINE,
          device_options: { device_id: input.readerId, skip_receipt_screen: true, tip_settings: { allow_tipping: input.tipping } },
        },
      });
      if (isError(body)) return body;
      const checkout = asObject(body['checkout']);
      return checkout === null ? providerError('UNAVAILABLE', 'Square made a checkout Adminium cannot read.', true) : chargeOf(checkout);
    },
    readerStatus: (ref) => read(ref),
    async cancelOnReader(ref) {
      const before = await read(ref);
      if (isError(before) || before.status === 'succeeded' || before.status === 'cancelled') return before;
      const cancelled = await request('POST', `/v2/terminals/checkouts/${encodeURIComponent(ref)}/cancel`);
      // Taken a moment before the cancel: Square refuses the cancel, and the read says it is a payment.
      if (isError(cancelled) && cancelled.code !== 'INVALID_REQUEST') return cancelled;
      // A cancel while the customer is on the Terminal is a request: the checkout reads `on_reader` until Square ends it.
      return read(ref);
    },
    async refund(input) {
      const paid = await request('GET', `/v2/payments/${encodeURIComponent(input.paymentRef)}`);
      if (isError(paid)) return paid;
      if (text(asObject(asObject(asObject(paid['payment'])?.['card_details'])?.['card'])?.['card_brand']) === 'INTERAC') {
        return providerError('REFUND_REFUSED', 'An Interac payment is refunded on the Terminal with the card. Refund it in cash or store credit.');
      }
      const minor = toMinor(input.amount, input.currency);
      if (isError(minor)) return minor;
      const body = await request(
        'POST',
        '/v2/refunds',
        { idempotency_key: await fitted(input.idempotencyKey, IDEMPOTENCY_MAX.refund), payment_id: input.paymentRef, amount_money: { amount: Number(minor.minor), currency: input.currency }, reason: input.reason.replace(/_/g, ' ') },
        true,
      );
      return isError(body) ? body : refundOf(body);
    },
    async refundStatus(ref) {
      if (!/^[A-Za-z0-9_-]{1,192}$/.test(ref)) return providerError('NOT_FOUND', 'No such refund.');
      const answer = await call('GET', `/v2/refunds/${encodeURIComponent(ref)}`);
      if (isError(answer)) return answer;
      // Square answers an id it never made `INVALID_VALUE`, not 404: that is no such refund.
      if (answer.status === 400 && list(answer.body?.['errors']).some((one) => text(one['field']) === 'refund_id')) return providerError('NOT_FOUND', 'No such refund.');
      if (answer.status < 200 || answer.status >= 300 || answer.body === null) return refusal(answer.status, answer.body, false);
      return refundOf(answer.body);
    },
    async listEvents(cursor) {
      // Refunds and disputes made at Square, read by time: a reader payment sends no webhook.
      let held: { since?: unknown; refunds?: unknown; disputes?: unknown; newest?: unknown } = {};
      try {
        held = cursor === null ? {} : (JSON.parse(cursor) as typeof held);
      } catch {
        held = {};
      }
      const since = typeof held.since === 'number' ? held.since : now() - FIRST_LOOK_MS;
      let newest = typeof held.newest === 'number' ? held.newest : since;
      const events: PaymentEvent[] = [];
      const livemode = context.mode === 'live';
      const refundsCursor = typeof held.refunds === 'string' ? held.refunds : null;
      const disputesCursor = typeof held.disputes === 'string' ? held.disputes : null;
      const first = cursor === null || (refundsCursor === null && disputesCursor === null);
      let nextRefunds: string | null = null;
      let nextDisputes: string | null = null;
      if (first || refundsCursor !== null) {
        const query = new URLSearchParams({ begin_time: new Date(since).toISOString(), sort_order: 'ASC', ...(refundsCursor === null ? {} : { cursor: refundsCursor }) });
        const body = await request('GET', `/v2/refunds?${query.toString()}`);
        if (isError(body)) return body;
        for (const refund of list(body['refunds'])) {
          const id = text(refund['id']);
          const at = epoch(refund['updated_at']) ?? epoch(refund['created_at']) ?? now();
          if (id === null) continue;
          newest = Math.max(newest, at);
          events.push({ ok: true, eventId: `refund:${id}:${text(refund['status']) ?? ''}`, type: 'refund.updated', kind: 'refund', checkoutRef: null, paymentRef: text(refund['payment_id']), refundRef: id, livemode, occurredAt: at });
        }
        nextRefunds = text(body['cursor']);
      }
      if (first || disputesCursor !== null) {
        const body = await request('GET', `/v2/disputes${disputesCursor === null ? '' : `?cursor=${encodeURIComponent(disputesCursor)}`}`);
        if (isError(body)) return body;
        for (const dispute of list(body['disputes'])) {
          const id = text(dispute['id']);
          const at = epoch(dispute['updated_at']) ?? epoch(dispute['created_at']) ?? 0;
          if (id === null || at < since) continue;
          newest = Math.max(newest, at);
          events.push({ ok: true, eventId: `dispute:${id}:${text(dispute['state']) ?? ''}`, type: 'dispute.updated', kind: 'dispute', checkoutRef: null, paymentRef: text(asObject(dispute['disputed_payment'])?.['payment_id']), refundRef: null, livemode, occurredAt: at });
        }
        nextDisputes = text(body['cursor']);
      }
      const more = nextRefunds !== null || nextDisputes !== null;
      const next = more ? { since, newest, refunds: nextRefunds, disputes: nextDisputes } : { since: Math.max(since, newest - OVERLAP_MS) };
      return { ok: true, events, cursor: JSON.stringify(next), more };
    },
    toMinor,
    fromMinor,
  };
}

/** The server half's export for `card-terminal@1`. */
export const createCardTerminal: CreateCardTerminal = (context) => createSquareTerminal(context);
