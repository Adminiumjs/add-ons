/**
 * THE CARD READER HALF: `card-terminal@1` spoken to Stripe Terminal, with the
 * same key the payment half uses (`stripeClient`), driven from the server
 * (no SDK in a browser): the till asks Adminium, Adminium asks Stripe.
 *
 * A charge is a PaymentIntent for `card_present`, handed to a reader with
 * `process_payment_intent`. Its reference is `<payment intent>:<reader>`, so
 * one read tells where the money stands (the intent) and where the reader is
 * (online, its action failed). Both calls carry the attempt's key (one
 * PaymentIntent, one hand-over, however often they are sent).
 *
 * How Stripe's states read:
 *   - intent `succeeded`                                  → `succeeded`, with the tip apart
 *   - intent `canceled`                                   → `cancelled`
 *   - the reader's action failed for this intent          → `declined`, in Stripe's words
 *   - the reader offline while the intent waits           → `offline`
 *   - anything else (on the reader, the bank answering)   → `on_reader`
 *
 * Pairing runs Stripe's way round: the reader shows a registration code the
 * person types into Studio (`enter`). A cancel takes the action off the
 * reader and cancels the intent, unless the card was taken first: then it is
 * a payment. An Interac card (Canada) is refunded on the reader with the card,
 * so its refund is refused here.
 */

import {
  providerError,
  type CardTerminal,
  type CreateCardTerminal,
  type PaymentProviderContext,
  type ProviderError,
  type Reader,
  type ReaderChargeState,
  type ReaderChargeStatus,
  type RefundInput,
  type RefundState,
} from '@adminium/add-on-host/contracts';

import { stripeDecimal, stripeMinor } from './currency.ts';
import { clockOf, createStripeProvider, stripeClient, type StripeProviderOptions } from './transport.ts';

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

/** Stripe's refusals that say something of the reader, by `error.code`. */
const READER_ERRORS: Readonly<Record<string, { code: 'READER_BUSY' | 'READER_OFFLINE'; message: string }>> = {
  terminal_reader_busy: { code: 'READER_BUSY', message: 'The reader is taking another payment.' },
  terminal_reader_offline: { code: 'READER_OFFLINE', message: 'The reader is offline.' },
  terminal_reader_timeout: { code: 'READER_OFFLINE', message: 'The reader did not answer.' },
};

/** A pairing waits this long for the person to type the reader's code. */
const PAIRING_MS = 10 * 60_000;

/** Builds the card reader half for one operation. */
export function createStripeTerminal(context: PaymentProviderContext, options: StripeProviderOptions = {}): CardTerminal {
  const now = clockOf(options);
  const { request, call, refusal } = stripeClient(context, options);
  const payments = createStripeProvider(context, options);

  /** One call whose refusal may name the reader (busy, offline), read off Stripe's error code first. Sent once. */
  async function readerRequest(method: 'POST', path: string, form: Record<string, string | number | boolean>, idempotencyKey?: string): Promise<Json | ProviderError> {
    const answer = await call(method, path, form, idempotencyKey);
    if (isError(answer)) return answer;
    if (answer.status < 200 || answer.status >= 300) {
      const code = text(asObject(answer.body?.['error'])?.['code']);
      const reader = code === null ? undefined : READER_ERRORS[code];
      if (reader !== undefined) return providerError(reader.code, reader.message, true);
      return refusal(answer.status, answer.body, false);
    }
    if (answer.body === null) return providerError('UNAVAILABLE', 'Stripe answered with something that is not JSON.', true);
    if (typeof answer.body['livemode'] === 'boolean' && answer.body['livemode'] !== (context.mode === 'live')) {
      return providerError('MODE_MISMATCH', `Stripe answered for ${answer.body['livemode'] ? 'live' : 'test'} payments, and this call was for ${context.mode}.`);
    }
    return answer.body;
  }

  function readerOf(body: Json): Reader {
    const seen = typeof body['last_seen_at'] === 'number' ? (body['last_seen_at'] as number) : null;
    return {
      id: text(body['id']) ?? '',
      label: text(body['label']) ?? '',
      locationId: text(body['location']) ?? text(asObject(body['location'])?.['id']),
      model: text(body['device_type']),
      online: text(body['status']) === 'online',
      lastSeenAt: seen,
    };
  }

  function chargeOf(intent: Json, reader: Json | null): ReaderChargeState | ProviderError {
    const pi = text(intent['id']);
    const currency = text(intent['currency'])?.toUpperCase() ?? null;
    if (pi === null || currency === null) return providerError('UNAVAILABLE', 'Stripe sent a payment Adminium cannot read.');
    const readerId = reader === null ? '' : (text(reader['id']) ?? '');
    const status = text(intent['status']);
    const action = asObject(reader?.['action']);
    const forThis = text(asObject(action?.['process_payment_intent'])?.['payment_intent']) === pi;
    const charge = asObject(intent['latest_charge']);
    const details = asObject(charge?.['payment_method_details']);
    const card = asObject(details?.['card_present']) ?? asObject(details?.['interac_present']);
    const tipMinor = asObject(asObject(intent['amount_details'])?.['tip'])?.['amount'];
    let state: ReaderChargeStatus;
    if (status === 'succeeded') state = 'succeeded';
    else if (status === 'canceled') state = 'cancelled';
    else if (forThis && text(action?.['status']) === 'failed') state = 'declined';
    else if (status === 'requires_payment_method' && intent['last_payment_error'] !== undefined && intent['last_payment_error'] !== null && !(forThis && text(action?.['status']) === 'in_progress')) state = 'declined';
    else if (reader !== null && text(reader['status']) === 'offline') state = 'offline';
    else state = 'on_reader';
    const taken = state === 'succeeded';
    const amount = taken ? stripeDecimal(String(intent['amount_received'] ?? intent['amount'] ?? ''), currency) : null;
    const tip = taken ? (typeof tipMinor === 'number' ? stripeDecimal(String(tipMinor), currency) : '0') : null;
    const failure = text(asObject(intent['last_payment_error'])?.['message']) ?? text(action?.['failure_message']);
    return {
      ok: true,
      ref: readerId === '' ? pi : `${pi}:${readerId}`,
      status: state,
      amount: isError(amount) ? null : amount,
      tip: tip === null || isError(tip) ? (taken ? '0' : null) : tip,
      currency,
      paymentRef: taken ? pi : null,
      brand: taken ? (text(card?.['brand']) === null ? null : text(card!['brand'])!.replace(/^./, (c) => c.toUpperCase())) : null,
      last4: taken ? text(card?.['last4']) : null,
      approvalCode: taken ? text(asObject(card?.['receipt'])?.['authorization_code']) : null,
      interac: asObject(details?.['interac_present']) !== null,
      failureMessage: state === 'declined' ? (failure ?? 'The card was declined.') : null,
    };
  }

  /** The intent and the reader a reference names. */
  async function read(ref: string): Promise<ReaderChargeState | ProviderError> {
    const [pi, readerId] = ref.split(':');
    if (pi === undefined || !/^pi_[A-Za-z0-9]+$/.test(pi)) return providerError('NOT_FOUND', 'No such charge.');
    const intent = await request('GET', `/v1/payment_intents/${encodeURIComponent(pi)}?expand[]=latest_charge`);
    if (isError(intent)) return intent;
    const reader = readerId === undefined || readerId === '' ? null : await request('GET', `/v1/terminal/readers/${encodeURIComponent(readerId)}`);
    return chargeOf(intent, reader === null || isError(reader) ? null : reader);
  }

  return {
    key: 'payments-stripe',
    mode: context.mode,
    checkCredentials: async () => {
      const checked = await payments.checkCredentials();
      if (isError(checked)) return checked;
      // The card reader half needs Terminal: a key without it is told so by name.
      const probe = await call('GET', '/v1/terminal/readers?limit=1');
      if (isError(probe)) return probe;
      const missing = probe.status === 403 ? [...checked.missing, 'Payment Intents: write', 'Terminal Readers: write', 'Terminal Locations: read'] : checked.missing;
      return { ...checked, missing };
    },
    async listLocations() {
      const body = await request('GET', '/v1/terminal/locations?limit=100');
      if (isError(body)) return body;
      const data = Array.isArray(body['data']) ? (body['data'] as unknown[]) : [];
      return { ok: true, locations: data.map(asObject).filter((one): one is Json => one !== null).map((one) => ({ id: text(one['id']) ?? '', name: text(one['display_name']) ?? '' })).filter((one) => one.id !== '' && one.name !== '') };
    },
    async listReaders(locationId) {
      const body = await request('GET', `/v1/terminal/readers?limit=100${locationId == null ? '' : `&location=${encodeURIComponent(locationId)}`}`);
      if (isError(body)) return body;
      const data = Array.isArray(body['data']) ? (body['data'] as unknown[]) : [];
      return { ok: true, readers: data.map(asObject).filter((one): one is Json => one !== null).map(readerOf) };
    },
    async startPairing(input) {
      // Stripe's way round: the reader shows the code; the pairing carries what the reader is to be called, and where.
      const pairing = Buffer.from(JSON.stringify({ label: input.label, location: input.locationId })).toString('base64url');
      return { ok: true, way: 'enter', code: null, pairing, expiresAt: now() + PAIRING_MS };
    },
    async finishPairing(input) {
      let held: { label?: unknown; location?: unknown };
      try {
        held = JSON.parse(Buffer.from(input.pairing, 'base64url').toString('utf8')) as { label?: unknown; location?: unknown };
      } catch {
        return providerError('INVALID_REQUEST', 'This pairing is not one Adminium started.');
      }
      if (typeof held.label !== 'string' || input.code === null || input.code.trim() === '') return providerError('INVALID_REQUEST', 'Type the code the reader shows.');
      if (typeof held.location !== 'string') return providerError('INVALID_REQUEST', 'Choose the location the reader is at.');
      const reader = await request('POST', '/v1/terminal/readers', { registration_code: input.code.trim(), label: held.label, location: held.location });
      if (isError(reader)) return reader;
      return { ok: true, state: 'paired', reader: readerOf(reader) };
    },
    async unpairReader(readerId) {
      const body = await request('DELETE', `/v1/terminal/readers/${encodeURIComponent(readerId)}`);
      return isError(body) ? body : { ok: true };
    },
    async sendToReader(input) {
      const minor = stripeMinor(input.amount, input.currency);
      if (isError(minor)) return minor;
      const intent = await request(
        'POST',
        '/v1/payment_intents',
        // In person only: `allowed_payment_method_types` (the pinned API version takes no `payment_method_types`); Interac in Canada.
        { amount: minor.minor, currency: input.currency.toLowerCase(), 'allowed_payment_method_types[]': input.currency === 'CAD' ? ['card_present', 'interac_present'] : 'card_present', capture_method: 'automatic', 'metadata[adminium_attempt]': input.attemptId },
        `${input.idempotencyKey}:intent`,
      );
      if (isError(intent)) return intent;
      const pi = text(intent['id']);
      if (pi === null) return providerError('UNAVAILABLE', 'Stripe made a payment Adminium cannot read.', true);
      if (text(intent['status']) === 'succeeded' || text(intent['status']) === 'canceled') return read(`${pi}:${input.readerId}`);
      const handed = await readerRequest(
        'POST',
        `/v1/terminal/readers/${encodeURIComponent(input.readerId)}/process_payment_intent`,
        { payment_intent: pi, ...(input.tipping ? {} : { 'process_config[skip_tipping]': true }) },
        `${input.idempotencyKey}:reader`,
      );
      if (isError(handed)) {
        // The reader refused it (busy, offline): nothing is on it, so the intent is cancelled at once.
        if (handed.code === 'READER_BUSY' || handed.code === 'READER_OFFLINE') await request('POST', `/v1/payment_intents/${encodeURIComponent(pi)}/cancel`, {});
        return handed;
      }
      return read(`${pi}:${input.readerId}`);
    },
    readerStatus: (ref) => read(ref),
    async cancelOnReader(ref) {
      const [pi, readerId] = ref.split(':');
      const before = await read(ref);
      if (isError(before) || before.status === 'succeeded' || before.status === 'cancelled') return before;
      if (readerId !== undefined && readerId !== '') {
        const off = await readerRequest('POST', `/v1/terminal/readers/${encodeURIComponent(readerId)}/cancel_action`, {});
        // A reader off the network keeps the amount until it comes back: said so, never assumed taken off.
        if (isError(off) && off.code === 'READER_OFFLINE') return off;
      }
      // Taken a moment before the cancel: that is a payment.
      const after = await read(ref);
      if (isError(after) || after.status === 'succeeded') return after;
      const cancelled = await request('POST', `/v1/payment_intents/${encodeURIComponent(pi!)}/cancel`, {});
      if (isError(cancelled) && cancelled.code !== 'INVALID_REQUEST') return cancelled;
      return read(ref);
    },
    async refund(input: RefundInput): Promise<RefundState | ProviderError> {
      const intent = await request('GET', `/v1/payment_intents/${encodeURIComponent(input.paymentRef)}?expand[]=latest_charge`);
      if (!isError(intent) && asObject(asObject(asObject(intent['latest_charge'])?.['payment_method_details'])?.['interac_present']) !== null) {
        return providerError('REFUND_REFUSED', 'An Interac payment is refunded on the reader with the card. Refund it in cash or store credit.');
      }
      return payments.refund(input);
    },
    refundStatus: (ref) => payments.refundStatus(ref),
    listEvents: async (cursor) => {
      const missed = await payments.listMissedEvents(cursor);
      return isError(missed) ? missed : { ok: true, events: missed.events, cursor: missed.cursor, more: missed.more };
    },
    toMinor: (amount, currency) => payments.toMinor(amount, currency),
    fromMinor: (minor, currency) => payments.fromMinor(minor, currency),
  };
}

/** The server half's export for `card-terminal@1`. */
export const createCardTerminal: CreateCardTerminal = (context) => createStripeTerminal(context);
