/**
 * THE TRANSPORT: `payment-provider@1` spoken to the PayPal REST API.
 *
 * The engine calls `createPaymentProvider({ http, credentials, mode })` for
 * every operation. `http` reaches only the hosts in the manifest's
 * `network.allow` and follows no redirect; `credentials` is one mode's
 * `client_id`, `client_secret` and `webhook_id`. A test-mode provider talks to
 * the sandbox hosts only, a live one to the live hosts only.
 *
 * PayPal takes money in two steps (Orders v2): the customer APPROVES on the
 * PayPal page, then Adminium CAPTURES. `complete` is the capture, and only the
 * engine calls it (the return page, the `CHECKOUT.ORDER.APPROVED` webhook and
 * the sweep, under one lock); `status` never captures. How it reads,
 * always from the CAPTURE, never from the order:
 *   - no capture yet (created, waiting, approved)      → `pending`
 *   - capture `COMPLETED` (or since refunded)            → `succeeded`
 *   - capture `PENDING`                                  → `processing`, with PayPal's reason
 *   - capture `DECLINED` / `FAILED`                      → `failed`
 *   - order `VOIDED`, ended by Adminium, or past 6 hours → `expired`
 *
 * PayPal has no call that cancels an order, so `expire` writes a marker into
 * the order's `custom_id` (a field PayPal lets a merchant change until the
 * order completes). `status` reads a marked order as expired and `complete`
 * never captures one. Since only Adminium can capture, a marked order can
 * never take money.
 */

import { createHash } from 'node:crypto';

import {
  providerError,
  type CheckoutCreated,
  type CheckoutInput,
  type CheckoutState,
  type CheckoutStatus,
  type CreatePaymentProvider,
  type CredentialCheck,
  type ExpireResult,
  type MethodList,
  type MinorAmount,
  type MissedEvents,
  type PaymentEvent,
  type PaymentEventKind,
  type PaymentHttpResponse,
  type PaymentProvider,
  type PaymentProviderContext,
  type ProviderError,
  type RefundInput,
  type RefundState,
  type RefundStatus,
  type WebhookDelivery,
} from '@adminium/add-on-host/contracts';

import { paypalDecimal, paypalMinor, paypalValue, readValue } from './currency.ts';
import { paypalLocale } from './locale.ts';
import { checkChain, signatureMatches, signedMessage, systemTrust, type CertTrust } from './signature.ts';
import {
  CERT_HOSTS,
  CERT_SUBJECTS,
  LISTENED_EVENTS,
  ORDER_LIFETIME_MS,
  PAYPAL_HOSTS,
  PAYPAL_PATHS,
  SIMULATOR_WEBHOOK_ID,
  VOID_MARKER,
  WEBHOOK_HEADERS,
} from './wire.ts';

/** The add-on's key, as its manifest says. */
export const PAYPAL_ADD_ON_KEY = 'payments-paypal';

type Json = Record<string, unknown>;

/**
 * How a dispute stands, as the engine's contract carries it from the release
 * after 0.3.32 (`PaymentEvent.dispute`). Declared here, with the same shape,
 * so this add-on still builds against the published 0.3.32 contracts, which
 * lack it; against the newer ones the two declarations are the same field.
 */
interface DisputeOutcome {
  readonly status: 'open' | 'won' | 'lost' | 'closed';
  /** The amount in dispute (or, once lost, given back), as a decimal in major units ("120.00"). */
  readonly amount: string | null;
  readonly currency: string | null;
}

type PaymentEventOut = PaymentEvent & { readonly dispute?: DisputeOutcome };

export interface PaypalProviderOptions {
  /** The clock (epoch ms). Defaults to the system clock. */
  now?: () => number;
  /** The roots and intermediates a webhook certificate must chain to. Defaults to the system roots and the pinned DigiCert intermediates. */
  trust?: CertTrust;
}

// ─── Kept between calls, inside this process only ───────────────────────────

/**
 * Access tokens, by mode and a hash of the client id and secret (so a
 * replaced secret is a new entry). A token never leaves this map: it is not
 * returned, logged or put in a message.
 */
const tokens = new Map<string, { token: string; until: number }>();

/** Webhook certificates by URL, for a day. */
const certificates = new Map<string, { pem: string; until: number }>();
const CERT_CACHE_MS = 24 * 60 * 60 * 1000;

/** Forgets every cached token and certificate. Tests call it between cases. */
export function forgetPaypalCaches(): void {
  tokens.clear();
  certificates.clear();
}

function isError(value: unknown): value is ProviderError {
  return typeof value === 'object' && value !== null && (value as { ok?: unknown }).ok === false;
}

function asObject(value: unknown): Json | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : null;
}

function list(value: unknown): Json[] {
  return Array.isArray(value) ? value.map(asObject).filter((one): one is Json => one !== null) : [];
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function link(body: Json | null, rel: string): string | null {
  return text(list(body?.['links']).find((one) => one['rel'] === rel)?.['href']);
}

/** Why PayPal holds a capture, in a sentence (`capture_status_details.reason`). */
const PENDING_REASONS: Readonly<Record<string, string>> = {
  BUYER_COMPLAINT: 'The customer has opened a complaint about this payment.',
  CHARGEBACK: 'The payment is being charged back.',
  ECHECK: 'The customer paid with an eCheck, which has not cleared yet.',
  INTERNATIONAL_WITHDRAWAL: 'PayPal is waiting for the seller to withdraw the money in this currency.',
  OTHER: 'PayPal is holding the payment.',
  PENDING_REVIEW: 'PayPal is reviewing the payment.',
  RECEIVING_PREFERENCE_MANDATES_MANUAL_ACTION: 'The seller must accept this payment by hand in PayPal, for example because of its currency.',
  REFUNDED: 'The payment was refunded.',
  TRANSACTION_APPROVED_AWAITING_FUNDING: 'The customer approved the payment, and PayPal is waiting for the money.',
  UNILATERAL: 'The PayPal account the money goes to is not confirmed yet.',
  VERIFICATION_REQUIRED: 'The PayPal account the money goes to must be verified first.',
  DECLINED_BY_RISK_FRAUD_FILTERS: 'PayPal declined the payment on a risk check.',
};

/**
 * How a resolved dispute ended for the seller, by `dispute_outcome.outcome_code`
 * (PayPal Disputes API v1, `customer_disputes_v1.json`, read 2026-10-22).
 * `ACCEPTED` and `DENIED` are deprecated there but may still arrive.
 * `RESOLVED_WITH_PAYOUT` (PayPal paid one side out itself) and
 * `NONE` (closed with no decision) say nothing certain about the money: they,
 * and any code not listed, read as closed.
 */
const DISPUTE_OUTCOMES: Readonly<Record<string, DisputeOutcome['status']>> = {
  RESOLVED_BUYER_FAVOUR: 'lost',
  ACCEPTED: 'lost',
  RESOLVED_SELLER_FAVOUR: 'won',
  CANCELED_BY_BUYER: 'won',
  DENIED: 'won',
};

const REFUND_STATUSES: Readonly<Record<string, RefundStatus>> = {
  COMPLETED: 'succeeded',
  PENDING: 'pending',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

/** Builds the provider for one operation. */
export function createPaypalProvider(context: PaymentProviderContext, options: PaypalProviderOptions = {}): PaymentProvider {
  const now = options.now ?? (() => Date.now());
  const hosts = PAYPAL_HOSTS[context.mode];
  const live = context.mode === 'live';
  const trust = options.trust ?? systemTrust();
  const clientId = context.credentials['client_id'] ?? '';
  const clientSecret = context.credentials['client_secret'] ?? '';
  const cacheKey = `${context.mode}:${createHash('sha256').update(`${clientId}\u0000${clientSecret}`).digest('hex')}`;

  function scrub(message: string): string {
    let out = message.replace(/Bearer\s+\S+/gi, 'Bearer [a token]').replace(/\bA21AA[A-Za-z0-9_-]+/g, '[a token]');
    const cached = tokens.get(cacheKey)?.token;
    for (const value of [...Object.values(context.credentials), ...(cached === undefined ? [] : [cached])]) {
      if (value.length >= 6) out = out.split(value).join('[a saved secret]');
    }
    return out.slice(0, 2000);
  }

  function refusal(status: number, body: Json | null, refunding: boolean): ProviderError {
    const details = list(body?.['details']);
    const issue = text(details[0]?.['issue']);
    const words = [
      text(body?.['message']) ?? text(body?.['error_description']) ?? `PayPal answered ${status}.`,
      issue === null ? null : `${issue}: ${text(details[0]?.['description']) ?? ''}`.trim(),
    ]
      .filter((one) => one !== null)
      .join(' ');
    const message = scrub(words);
    const name = text(body?.['name']);
    if (status === 401) return providerError('CREDENTIALS_REFUSED', message);
    if (status === 403) return providerError('PERMISSION_MISSING', message);
    if (status === 404 || name === 'RESOURCE_NOT_FOUND') return providerError('NOT_FOUND', message);
    if (status === 429) return providerError('RATE_LIMITED', message, true);
    if (status === 409 || status >= 500) return providerError('UNAVAILABLE', message, true);
    if (issue !== null && /CURRENCY/.test(issue)) return providerError('CURRENCY_UNSUPPORTED', message);
    if (refunding && status === 422) return providerError('REFUND_REFUSED', message);
    return providerError('INVALID_REQUEST', message);
  }

  async function send(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    headers: Record<string, string>,
    body?: string,
  ): Promise<{ status: number; body: Json | null } | ProviderError> {
    let response: PaymentHttpResponse;
    try {
      response = await context.http(`${hosts.api}${path}`, { method, headers, ...(body === undefined ? {} : { body }) });
    } catch {
      return providerError('UNAVAILABLE', 'PayPal could not be reached.', true);
    }
    const raw = await response.text();
    let parsed: Json | null = null;
    if (raw !== '') {
      try {
        parsed = asObject(JSON.parse(raw));
      } catch {
        return providerError('UNAVAILABLE', 'PayPal answered with something that is not JSON.', true);
      }
    }
    return { status: response.status, body: parsed };
  }

  async function token(): Promise<string | ProviderError> {
    if (clientId === '' || clientSecret === '') {
      return providerError('CREDENTIALS_REFUSED', `No client ID and secret are saved for ${context.mode} payments.`);
    }
    const cached = tokens.get(cacheKey);
    if (cached !== undefined && cached.until > now()) return cached.token;
    const answer = await send(
      'POST',
      PAYPAL_PATHS.token,
      {
        authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      'grant_type=client_credentials',
    );
    if (isError(answer)) return answer;
    if (answer.status === 401 || answer.status === 400) {
      return providerError('CREDENTIALS_REFUSED', `PayPal refused this client ID and secret for ${context.mode} payments.`);
    }
    if (answer.status < 200 || answer.status >= 300) return refusal(answer.status, answer.body, false);
    const value = text(answer.body?.['access_token']);
    const lifetime = answer.body?.['expires_in'];
    if (value === null) return providerError('UNAVAILABLE', 'PayPal sent no access token.', true);
    const seconds = typeof lifetime === 'number' ? lifetime : 300;
    tokens.set(cacheKey, { token: value, until: now() + Math.max(0, seconds - 60) * 1000 });
    return value;
  }

  async function request(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    payload?: unknown,
    requestId?: string,
  ): Promise<Json | { empty: true } | ProviderError> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const bearer = await token();
      if (isError(bearer)) return bearer;
      const headers: Record<string, string> = { authorization: `Bearer ${bearer}`, prefer: 'return=representation' };
      if (payload !== undefined) headers['content-type'] = 'application/json';
      if (requestId !== undefined) headers['paypal-request-id'] = requestId;
      const answer = await send(method, path, headers, payload === undefined ? undefined : JSON.stringify(payload));
      if (isError(answer)) return answer;
      // A token PayPal ended early: drop it and try once with a new one.
      if (answer.status === 401 && attempt === 0) {
        tokens.delete(cacheKey);
        continue;
      }
      if (answer.status < 200 || answer.status >= 300) return refusal(answer.status, answer.body, path.endsWith('/refund'));
      return answer.body ?? { empty: true };
    }
    return providerError('CREDENTIALS_REFUSED', `PayPal refused this client ID and secret for ${context.mode} payments.`);
  }

  function issueOf(error: ProviderError, issue: string): boolean {
    return error.providerMessage.includes(issue);
  }

  // ─── Reading PayPal's objects ─────────────────────────────────────────────

  function unitOf(order: Json): Json | null {
    return list(order['purchase_units'])[0] ?? null;
  }

  function captureOf(order: Json): Json | null {
    return list(asObject(unitOf(order)?.['payments'])?.['captures']).at(-1) ?? null;
  }

  function attemptOf(order: Json): { attemptId: string | null; voided: boolean } {
    const custom = text(unitOf(order)?.['custom_id']);
    if (custom === null) return { attemptId: null, voided: false };
    const voided = custom.endsWith(VOID_MARKER);
    return { attemptId: voided ? custom.slice(0, -VOID_MARKER.length) : custom, voided };
  }

  function createdAt(order: Json): number | null {
    const at = Date.parse(text(order['create_time']) ?? '');
    return Number.isNaN(at) ? null : at;
  }

  function stateOf(order: Json, override?: { status: CheckoutStatus; message: string }): CheckoutState | ProviderError {
    const ref = text(order['id']);
    if (ref === null) return providerError('UNAVAILABLE', 'PayPal sent an order with no id.');
    const capture = captureOf(order);
    const captureStatus = text(capture?.['status']);
    const reason = text(asObject(capture?.['status_details'])?.['reason']);
    const { attemptId, voided } = attemptOf(order);
    let status: CheckoutStatus;
    if (captureStatus !== null) {
      status =
        captureStatus === 'COMPLETED' || captureStatus === 'PARTIALLY_REFUNDED' || captureStatus === 'REFUNDED'
          ? 'succeeded'
          : captureStatus === 'PENDING'
            ? 'processing'
            : 'failed';
    } else {
      const orderStatus = text(order['status']);
      const created = createdAt(order);
      const tooOld = created !== null && now() - created > ORDER_LIFETIME_MS;
      status = orderStatus === 'VOIDED' || voided || tooOld ? 'expired' : orderStatus === 'COMPLETED' ? 'failed' : 'pending';
    }
    if (override !== undefined && captureStatus === null) status = override.status;
    const moved = status === 'succeeded' || status === 'processing';
    const money = asObject(capture?.['amount']);
    const currency = moved ? (text(money?.['currency_code'])?.toUpperCase() ?? null) : null;
    const amount = moved ? readValue(money?.['value'], currency) : null;
    const settled = Date.parse(text(capture?.['update_time']) ?? text(capture?.['create_time']) ?? '');
    let failureMessage: string | null = null;
    if (override !== undefined && captureStatus === null) failureMessage = override.message;
    else if (status === 'failed') failureMessage = reason === null ? 'PayPal declined the payment, and nothing was taken.' : (PENDING_REASONS[reason] ?? 'PayPal declined the payment, and nothing was taken.');
    else if (status === 'processing') failureMessage = PENDING_REASONS[reason ?? 'OTHER'] ?? PENDING_REASONS['OTHER']!;
    return {
      ok: true,
      ref,
      status,
      attemptId,
      amount,
      currency: amount === null ? null : currency,
      livemode: live,
      paymentRef: moved || status === 'failed' ? text(capture?.['id']) : null,
      paidWith: moved ? { method: 'paypal', label: 'PayPal', delayed: status === 'processing' } : null,
      settledAt: status === 'succeeded' && !Number.isNaN(settled) ? settled : null,
      failureMessage: failureMessage === null ? null : scrub(failureMessage),
    };
  }

  function refundOf(body: Json, paymentRef?: string): RefundState | ProviderError {
    const ref = text(body['id']);
    const money = asObject(body['amount']);
    const currency = text(money?.['currency_code'])?.toUpperCase() ?? null;
    const amount = readValue(money?.['value'], currency);
    const status = REFUND_STATUSES[text(body['status']) ?? ''];
    const up = link(body, 'up');
    const capture = paymentRef ?? (up === null ? null : decodeURIComponent(up.split('/').filter(Boolean).at(-1) ?? ''));
    if (ref === null || currency === null || amount === null || status === undefined || capture === null || capture === '') {
      return providerError('UNAVAILABLE', 'PayPal sent a refund Adminium cannot read.');
    }
    return {
      ok: true,
      ref,
      paymentRef: capture,
      status,
      amount,
      currency,
      failureMessage: status === 'failed' ? 'PayPal could not make the refund.' : status === 'cancelled' ? 'The refund was cancelled at PayPal.' : null,
    };
  }

  /** An amount object (`{ value, currency_code }`) read as a decimal and its currency, or both null. */
  function moneyOf(value: unknown): { amount: string | null; currency: string | null } {
    const money = asObject(value);
    const currency = text(money?.['currency_code'])?.toUpperCase() ?? null;
    const amount = readValue(money?.['value'], currency);
    return amount === null ? { amount: null, currency: null } : { amount, currency };
  }

  /** How a `CUSTOMER.DISPUTE.*` event leaves the dispute. */
  function disputeOf(type: string, resource: Json): DisputeOutcome {
    if (type !== 'CUSTOMER.DISPUTE.RESOLVED') return { status: 'open', ...moneyOf(resource['dispute_amount']) };
    const outcome = asObject(resource['dispute_outcome']);
    const status = DISPUTE_OUTCOMES[text(outcome?.['outcome_code']) ?? ''] ?? 'closed';
    // Lost: what went back to the customer, when PayPal says; else the amount disputed.
    const refunded = status === 'lost' ? moneyOf(outcome?.['amount_refunded']) : { amount: null, currency: null };
    return { status, ...(refunded.amount !== null ? refunded : moneyOf(resource['dispute_amount'])) };
  }

  function eventOf(event: Json): PaymentEventOut | ProviderError {
    const eventId = text(event['id']);
    const type = text(event['event_type']);
    const at = Date.parse(text(event['create_time']) ?? '');
    if (eventId === null || type === null || Number.isNaN(at)) return providerError('INVALID_REQUEST', 'The event is missing its id, type or time.');
    const resource = asObject(event['resource']) ?? {};
    let kind: PaymentEventKind = 'other';
    let checkoutRef: string | null = null;
    let paymentRef: string | null = null;
    let refundRef: string | null = null;
    let dispute: DisputeOutcome | null = null;
    if (type.startsWith('CHECKOUT.ORDER.')) {
      kind = 'checkout';
      checkoutRef = text(resource['id']);
    } else if (type === 'PAYMENT.CAPTURE.REFUNDED') {
      kind = 'refund';
      refundRef = text(resource['id']);
      const up = link(resource, 'up');
      paymentRef = up === null ? null : (up.split('/').filter(Boolean).at(-1) ?? null);
    } else if (type === 'PAYMENT.CAPTURE.REVERSED') {
      // The capture taken back (a chargeback, or PayPal reversing it): the money is gone.
      kind = 'dispute';
      paymentRef = text(resource['id']);
      dispute = { status: 'lost', ...moneyOf(resource['amount']) };
    } else if (type.startsWith('CUSTOMER.DISPUTE.')) {
      // The resource is the dispute; the capture it is about is the seller's transaction id.
      kind = 'dispute';
      paymentRef = text(list(resource['disputed_transactions'])[0]?.['seller_transaction_id']);
      dispute = disputeOf(type, resource);
    } else if (type.startsWith('PAYMENT.CAPTURE.')) {
      kind = 'checkout';
      paymentRef = text(resource['id']);
      checkoutRef = text(asObject(asObject(resource['supplementary_data'])?.['related_ids'])?.['order_id']);
    }
    const clip = (value: string | null) => (value === null ? null : value.slice(0, 255));
    return {
      ok: true,
      eventId: eventId.slice(0, 255),
      type: type.slice(0, 120),
      kind,
      checkoutRef: clip(checkoutRef),
      paymentRef: clip(paymentRef),
      refundRef: clip(refundRef),
      // A PayPal event carries no mode: the endpoint and the webhook id it was signed for are this mode's.
      livemode: live,
      occurredAt: at,
      ...(dispute === null ? {} : { dispute }),
    };
  }

  async function certificate(url: string): Promise<string | ProviderError> {
    const cached = certificates.get(url);
    if (cached !== undefined && cached.until > now()) return cached.pem;
    let response: PaymentHttpResponse;
    try {
      response = await context.http(url, { method: 'GET' });
    } catch {
      return providerError('UNAVAILABLE', 'The signing certificate could not be fetched from PayPal.', true);
    }
    if (response.status !== 200) return providerError('SIGNATURE_INVALID', 'PayPal did not send the signing certificate.');
    const pem = await response.text();
    if (certificates.size >= 20) certificates.clear();
    certificates.set(url, { pem, until: now() + CERT_CACHE_MS });
    return pem;
  }

  async function voidOrder(order: Json): Promise<{ empty: true } | Json | ProviderError> {
    const { attemptId } = attemptOf(order);
    const ref = text(order['id']) ?? '';
    const op = text(unitOf(order)?.['custom_id']) === null ? 'add' : 'replace';
    return request('PATCH', PAYPAL_PATHS.order(ref), [
      { op, path: "/purchase_units/@reference_id=='default'/custom_id", value: `${(attemptId ?? 'adminium').slice(0, 240)}${VOID_MARKER}` },
    ]);
  }

  const provider: PaymentProvider = {
    key: PAYPAL_ADD_ON_KEY,
    mode: context.mode,

    /**
     * A token proves the client id and secret; the merchant id comes from an
     * order made for 1.00 USD that no one can approve or capture: it is
     * marked ended at once, and PayPal discards an order nobody approves.
     */
    async checkCredentials(): Promise<CredentialCheck | ProviderError> {
      const bearer = await token();
      if (isError(bearer)) return bearer;
      const order = await request(
        'POST',
        PAYPAL_PATHS.orders,
        {
          intent: 'CAPTURE',
          purchase_units: [{ reference_id: 'default', custom_id: `adminium-check${VOID_MARKER}`, amount: { currency_code: 'USD', value: '1.00' } }],
        },
        `adminium-check-${cacheKey.slice(-24)}-${Math.floor(now() / 3_600_000)}`,
      );
      if (isError(order)) {
        if (order.code === 'PERMISSION_MISSING') {
          return providerError('PERMISSION_MISSING', 'The REST app may not take payments. In the PayPal developer dashboard, switch on Accept payments for it.');
        }
        return order;
      }
      if ('empty' in order) return providerError('UNAVAILABLE', 'PayPal did not say which account the app belongs to.');
      const merchant = text(asObject(unitOf(order)?.['payee'])?.['merchant_id']);
      if (merchant === null) return providerError('UNAVAILABLE', 'PayPal did not say which account the app belongs to.');
      return { ok: true, accountId: merchant.slice(0, 255), livemode: live, missing: [] };
    },

    async createCheckout(input: CheckoutInput): Promise<CheckoutCreated | ProviderError> {
      const money = paypalValue(input.payable.amount, input.payable.currency);
      if (isError(money)) return money;
      if (!input.methods.includes('paypal')) return providerError('INVALID_REQUEST', 'No way to pay is allowed for this payment.');
      if (input.idempotencyKey.length > 108) return providerError('INVALID_REQUEST', 'The request id is longer than PayPal keeps.');
      const locale = paypalLocale(input.payable.locale);
      const description = [input.payable.reference.trim(), input.payable.description.trim()].filter((one) => one !== '').join(' · ');
      const order = await request(
        'POST',
        PAYPAL_PATHS.orders,
        {
          intent: 'CAPTURE',
          purchase_units: [
            {
              reference_id: 'default',
              custom_id: input.attemptId.slice(0, 240),
              ...(description === '' ? {} : { description: description.slice(0, 127) }),
              amount: { currency_code: money.currency, value: money.value },
            },
          ],
          payment_source: {
            paypal: {
              ...(input.payable.customerEmail === null ? {} : { email_address: input.payable.customerEmail }),
              experience_context: {
                return_url: input.successUrl,
                cancel_url: input.cancelUrl,
                user_action: 'PAY_NOW',
                shipping_preference: 'NO_SHIPPING',
                ...(locale === null ? {} : { locale }),
              },
            },
          },
        },
        input.idempotencyKey,
      );
      if (isError(order)) return order;
      if ('empty' in order) return providerError('UNAVAILABLE', 'PayPal made the order but sent nothing back.');
      const ref = text(order['id']);
      const url = link(order, 'payer-action') ?? link(order, 'approve');
      if (ref === null || url === null) return providerError('UNAVAILABLE', 'PayPal made the order but sent no page to send the customer to.');
      let host: string;
      try {
        host = new URL(url).hostname;
      } catch {
        host = '';
      }
      if (host !== hosts.checkout) return providerError('UNAVAILABLE', `PayPal sent a page outside ${hosts.checkout}.`);
      const created = createdAt(order) ?? now();
      return { ok: true, ref, url, expiresAt: created + ORDER_LIFETIME_MS };
    },

    async status(ref: string): Promise<CheckoutState | ProviderError> {
      const order = await request('GET', PAYPAL_PATHS.order(ref));
      if (isError(order)) return order;
      if ('empty' in order) return providerError('UNAVAILABLE', 'PayPal sent an empty order.');
      return stateOf(order);
    },

    /** The capture. Only an approved order that Adminium has not ended is captured. */
    async complete(ref: string, idempotencyKey: string): Promise<CheckoutState | ProviderError> {
      const order = await request('GET', PAYPAL_PATHS.order(ref));
      if (isError(order)) return order;
      if ('empty' in order) return providerError('UNAVAILABLE', 'PayPal sent an empty order.');
      const state = stateOf(order);
      if (isError(state) || captureOf(order) !== null || state.status !== 'pending' || text(order['status']) !== 'APPROVED') return state;
      const captured = await request('POST', PAYPAL_PATHS.capture(ref), {}, idempotencyKey);
      if (!isError(captured)) {
        if ('empty' in captured) return provider.status(ref);
        return stateOf(captured);
      }
      // Captured already (another caller, or a retry after PayPal forgot the key): read it.
      if (issueOf(captured, 'ORDER_ALREADY_CAPTURED')) return provider.status(ref);
      if (issueOf(captured, 'INSTRUMENT_DECLINED') || issueOf(captured, 'PAYER_ACTION_REQUIRED')) {
        return stateOf(order, { status: 'failed', message: 'PayPal declined the way the customer chose to pay, and nothing was taken.' });
      }
      return captured;
    },

    async expire(ref: string): Promise<ExpireResult | ProviderError> {
      const order = await request('GET', PAYPAL_PATHS.order(ref));
      if (isError(order)) return order;
      if ('empty' in order) return providerError('UNAVAILABLE', 'PayPal sent an empty order.');
      const state = stateOf(order);
      if (isError(state)) return state;
      if (state.status === 'succeeded' || state.status === 'processing' || text(order['status']) === 'COMPLETED') {
        return providerError('ALREADY_COMPLETED', 'The customer finished paying before the checkout could be ended.');
      }
      if (state.status === 'expired') return { ok: true, ref, status: 'expired' };
      const patched = await voidOrder(order);
      if (isError(patched)) {
        const again = await provider.status(ref);
        if (!isError(again) && (again.status === 'succeeded' || again.status === 'processing')) {
          return providerError('ALREADY_COMPLETED', 'The customer finished paying before the checkout could be ended.');
        }
        return patched;
      }
      return { ok: true, ref, status: 'expired' };
    },

    async refund(input: RefundInput): Promise<RefundState | ProviderError> {
      const money = paypalValue(input.amount, input.currency);
      if (isError(money)) return money;
      const body = await request(
        'POST',
        PAYPAL_PATHS.refundCapture(input.paymentRef),
        { amount: { currency_code: money.currency, value: money.value } },
        input.idempotencyKey,
      );
      if (isError(body)) return body;
      if ('empty' in body) return providerError('UNAVAILABLE', 'PayPal made the refund but sent nothing back.');
      return refundOf(body, input.paymentRef);
    },

    async refundStatus(ref: string): Promise<RefundState | ProviderError> {
      const body = await request('GET', PAYPAL_PATHS.refund(ref));
      if (isError(body)) return body;
      if ('empty' in body) return providerError('UNAVAILABLE', 'PayPal sent an empty refund.');
      return refundOf(body);
    },

    async verifyWebhook(delivery: WebhookDelivery): Promise<PaymentEvent | ProviderError> {
      const webhookId = context.credentials['webhook_id'] ?? '';
      if (webhookId === '') return providerError('SIGNATURE_INVALID', `No webhook ID is saved for ${context.mode} payments.`);
      const header = (name: string) => delivery.headers[name] ?? '';
      const id = header(WEBHOOK_HEADERS.id);
      const time = header(WEBHOOK_HEADERS.time);
      const signature = header(WEBHOOK_HEADERS.signature);
      const certUrl = header(WEBHOOK_HEADERS.certUrl);
      if (id === '' || time === '' || signature === '' || certUrl === '') return providerError('SIGNATURE_INVALID', 'The delivery carries no PayPal signature.');
      if (header(WEBHOOK_HEADERS.algorithm) !== 'SHA256withRSA') return providerError('SIGNATURE_INVALID', 'The delivery is signed with a method Adminium does not take.');
      let address: URL;
      try {
        address = new URL(certUrl);
      } catch {
        return providerError('SIGNATURE_INVALID', 'The certificate address cannot be read.');
      }
      if (address.protocol !== 'https:' || address.port !== '' || address.username !== '' || !CERT_HOSTS[context.mode].includes(address.hostname)) {
        return providerError('SIGNATURE_INVALID', `The certificate address is not a PayPal ${context.mode} address.`);
      }
      const pem = await certificate(address.href);
      if (isError(pem)) return pem;
      const leaf = checkChain(pem, now(), trust, CERT_SUBJECTS[context.mode]);
      if (typeof leaf === 'string') return providerError('SIGNATURE_INVALID', leaf);
      const signedFor = [webhookId, ...(live ? [] : [SIMULATOR_WEBHOOK_ID])];
      if (!signedFor.some((one) => signatureMatches(signedMessage(id, time, one, delivery.rawBody), signature, leaf))) {
        return providerError('SIGNATURE_INVALID', 'The signature does not match this webhook.');
      }
      let event: Json | null;
      try {
        event = asObject(JSON.parse(delivery.rawBody));
      } catch {
        event = null;
      }
      if (event === null) return providerError('INVALID_REQUEST', 'The event is not JSON.');
      return eventOf(event);
    },

    /**
     * PayPal lists events by time, not by a cursor, and cannot filter by
     * delivery. The cursor is the newest event time read so far plus the ids
     * at exactly that time, so a page that ends on a shared second repeats
     * nothing. A first sweep starts three days back, PayPal's retry window.
     */
    async listMissedEvents(cursor: string | null): Promise<MissedEvents | ProviderError> {
      const [since, seenText] = cursor === null ? [new Date(now() - 3 * 24 * 60 * 60 * 1000).toISOString(), ''] : cursor.split('|', 2);
      const seen = new Set((seenText ?? '').split(',').filter((one) => one !== ''));
      const sinceMs = Date.parse(since ?? '');
      if (Number.isNaN(sinceMs)) return providerError('INVALID_REQUEST', 'The sweep cursor is not a time.');
      const query = new URLSearchParams({ page_size: '100', start_time: new Date(sinceMs).toISOString(), end_time: new Date(now()).toISOString() });
      const body = await request('GET', `${PAYPAL_PATHS.events}?${query.toString()}`);
      if (isError(body)) return body;
      const raw = 'empty' in body ? [] : list(body['events']);
      const wanted = new Set<string>(LISTENED_EVENTS);
      const events: PaymentEvent[] = [];
      for (const one of raw) {
        if (!wanted.has(text(one['event_type']) ?? '')) continue;
        const event = eventOf(one);
        if (isError(event) || event.occurredAt < sinceMs || (event.occurredAt === sinceMs && seen.has(event.eventId))) continue;
        events.push(event);
      }
      events.sort((a, b) => a.occurredAt - b.occurredAt || (a.eventId < b.eventId ? -1 : 1));
      const kept = events.slice(0, 500);
      const newest = kept.at(-1);
      let next = cursor;
      if (newest !== undefined) {
        const atNewest = kept.filter((one) => one.occurredAt === newest.occurredAt).map((one) => one.eventId);
        const carried = newest.occurredAt === sinceMs ? [...seen] : [];
        next = `${new Date(newest.occurredAt).toISOString()}|${[...new Set([...carried, ...atNewest])].join(',')}`.slice(0, 1024);
      }
      return { ok: true, events: kept, cursor: next, more: !('empty' in body) && link(body, 'next') !== null };
    },

    /** One way: the customer pays with their PayPal account. Venmo and Pay Later are not offered on the PayPal page this add-on uses. */
    async methodsFor(): Promise<MethodList | ProviderError> {
      return { ok: true, methods: [{ id: 'paypal', label: 'PayPal', delayed: false }] };
    },

    toMinor(amount: string, currency: string): MinorAmount | ProviderError {
      return paypalMinor(amount, currency);
    },

    fromMinor(minor: string, currency: string): string | ProviderError {
      return paypalDecimal(minor, currency);
    },
  };
  return provider;
}

/** The server half's export: the factory the engine calls per operation. */
export const createPaymentProvider: CreatePaymentProvider = (context) => createPaypalProvider(context);
