/**
 * THE TRANSPORT: `payment-provider@1` spoken to the Stripe API.
 *
 * The engine calls `createPaymentProvider({ http, credentials, mode })` for
 * every operation. `http` reaches only `api.stripe.com` and
 * `checkout.stripe.com` (the manifest's `network.allow`) and follows no
 * redirect; `credentials` is one mode's `secret_key` and `webhook_secret`,
 * decrypted for this call. Nothing here keeps state between calls: what a
 * checkout is, Stripe says.
 *
 * Every answer is data. A refusal is `{ ok: false, code, providerMessage,
 * retryable }`; nothing here throws for something Stripe said. Stripe's own
 * words reach staff only after every key-shaped string is taken out of them.
 *
 * How Stripe's states read:
 *   - session `open`                         → `pending` (`requires_action` while the bank asks for a step)
 *   - `open`, the last try declined          → `failed`, nothing taken; the page stays open, so a later
 *                                              success can still follow, and the engine records it
 *   - `complete` + `paid`                    → `succeeded`
 *   - `complete` + `unpaid` (a bank debit)   → `processing`, until Stripe says it settled or failed
 *   - `expired`                              → `expired`
 */

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
  type PaidWith,
  type PaymentEvent,
  type PaymentEventKind,
  type PaymentHttpResponse,
  type PaymentMethodInfo,
  type PaymentProvider,
  type PaymentProviderContext,
  type ProviderError,
  type RefundInput,
  type RefundState,
  type RefundStatus,
  type WebhookDelivery,
} from '@adminium/add-on-host/contracts';

import { stripeDecimal, stripeMinor } from './currency.ts';
import { formBody, type FormValue } from './form.ts';
import { checkoutLocale } from './locale.ts';
import { cardLabel, EXCLUDABLE, methodInfo } from './methods.ts';
import { verifyStripeSignature } from './signature.ts';
import {
  ACCOUNT_PERMISSION,
  LISTENED_EVENTS,
  PERMISSION_PROBES,
  permissionLabel,
  RESTRICTED_KEY,
  SESSION_LIFETIME_SECONDS,
  SIGNATURE_HEADER,
  STRIPE_API_ORIGIN,
  STRIPE_API_VERSION,
  STRIPE_PATHS,
} from './wire.ts';

/** The add-on's key, as its manifest says. */
export const STRIPE_ADD_ON_KEY = 'payments-stripe';

type Json = Record<string, unknown>;

/**
 * How a dispute stands, as the engine's contract carries it from the release
 * after 0.3.32 (`PaymentEvent.dispute`). Declared here, with the same shape,
 * so this add-on still builds against the published 0.3.32 contracts, which
 * lack it; against the newer ones the two declarations are the same field.
 */
interface DisputeOutcome {
  readonly status: 'open' | 'won' | 'lost' | 'closed';
  /** The amount disputed, as a decimal in major units ("120.00"). */
  readonly amount: string | null;
  readonly currency: string | null;
  /** When the dispute opened (epoch ms), so a refund that settled it is counted once even if the close is heard first. */
  readonly openedAt?: number | null;
}

type PaymentEventOut = PaymentEvent & { readonly dispute?: DisputeOutcome };

/**
 * A dispute's `status` read for the seller. `warning_closed` is an inquiry
 * closed with no chargeback. Any other status (`warning_needs_response`,
 * `needs_response`, `under_review`, …) is still open, except on
 * `charge.dispute.closed`, where an unknown one reads as closed.
 */
const DISPUTE_STATUSES: Readonly<Record<string, DisputeOutcome['status']>> = {
  won: 'won',
  lost: 'lost',
  warning_closed: 'closed',
};

export interface StripeProviderOptions {
  /** The clock (epoch ms), for `expires_at` and the signature window. Defaults to the system clock. */
  now?: () => number;
}

function isError(value: unknown): value is ProviderError {
  return typeof value === 'object' && value !== null && (value as { ok?: unknown }).ok === false;
}

function asObject(value: unknown): Json | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

/** The id of an expandable field, whether Stripe sent the object or only its id. */
function idOf(value: unknown): string | null {
  return text(value) ?? text(asObject(value)?.['id']);
}

/**
 * Stripe's words with every key-shaped string removed. A 401 quotes the key
 * it refused (masked, but still its prefix and last four), and nothing a key
 * looks like may reach a log or a screen.
 */
function scrub(message: string, credentials: Readonly<Record<string, string>>): string {
  let out = message
    .replace(/\b(?:sk|rk|pk)_(?:test|live)_[A-Za-z0-9*]+/g, '[a Stripe key]')
    .replace(/\bwhsec_[A-Za-z0-9+/=*]+/g, '[a signing secret]');
  for (const value of Object.values(credentials)) {
    if (value.length >= 6) out = out.split(value).join('[a saved secret]');
  }
  return out.slice(0, 2000);
}

/** Why a refund failed, in a sentence (Stripe's `failure_reason` values). */
const REFUND_FAILURES: Readonly<Record<string, string>> = {
  lost_or_stolen_card: 'The card was reported lost or stolen, so the money could not go back to it.',
  expired_or_canceled_card: 'The card has expired or was closed, so the money could not go back to it.',
  charge_for_pending_refund_disputed: 'The customer disputed the payment while the refund was on its way.',
  insufficient_funds: 'The Stripe balance was too low to make the refund.',
  declined: 'The bank that issued the card declined the refund.',
  merchant_request: 'The refund was cancelled in the Stripe dashboard.',
  unknown: 'Stripe did not say why the refund failed.',
};

/** The sentence for a refund refused for permission. */
const REFUND_PERMISSION_MISSING = 'The Stripe key may not give refunds. Give it Charges and Refunds: write, then try again.';

/** Stripe refusals of a refund that have a sentence of their own, by `error.code`. */
const REFUND_REFUSALS: Readonly<Record<string, string>> = {
  charge_disputed: 'The customer already got this money back through a dispute.',
};

/**
 * True when Stripe refused a call because the key lacks a permission. Stripe
 * answers 403 with `code: more_permissions_required` ("Permission denied …
 * Enabling Charges and Refunds Write …", seen in a sandbox 2026-10-22); the
 * code and the older "required permissions" wording count whatever the status.
 */
function permissionRefused(status: number, body: Json | null): boolean {
  const error = asObject(body?.['error']) ?? {};
  return status === 403 || text(error['code']) === 'more_permissions_required' || /required permissions/i.test(text(error['message']) ?? '');
}

/**
 * Stripe words shown for a refused refund, without what means nothing to the
 * person who asked for it: addresses (the Stripe dashboard, the docs) and
 * Stripe object ids (`ch_…`, `pi_…`, `re_…`, `acct_…`, `req_…`).
 */
function plainRefusal(message: string): string {
  const out = message
    .replace(/\s*\([^()]*\bhttps?:\/\/[^()]*\)/g, '')
    .replace(/\bhttps?:\/\/\S+/g, '')
    .replace(/\brequest:?\s+req_[A-Za-z0-9]+:?/gi, '')
    .replace(/['"`]?\b(?:ch|pi|re|pyr|py|acct|req|cus|txn|dp|du)_[A-Za-z0-9]+\b['"`]?/g, '')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/(?:\s*\b(?:see|at|visit)\s*)+([.;]|$)/gi, '$1')
    .trim();
  return out === '' || /^[.,;:!?]+$/.test(out) ? 'Stripe refused the refund.' : out;
}

const REFUND_STATUSES: Readonly<Record<string, RefundStatus>> = {
  pending: 'pending',
  requires_action: 'requires_action',
  succeeded: 'succeeded',
  failed: 'failed',
  canceled: 'cancelled',
};

/** Builds the provider for one operation. */
export function createStripeProvider(context: PaymentProviderContext, options: StripeProviderOptions = {}): PaymentProvider {
  const now = options.now ?? (() => Date.now());
  const live = context.mode === 'live';

  /** The saved key, or the refusal that stops the call before it is made. */
  function key(): string | ProviderError {
    const value = context.credentials['secret_key'] ?? '';
    if (value === '') return providerError('CREDENTIALS_REFUSED', `No restricted key is saved for ${context.mode} payments.`);
    if (/^sk_/.test(value)) {
      return providerError(
        'CREDENTIALS_REFUSED',
        'This is a secret key (sk_…). Adminium takes a restricted key (rk_…) only, so a key that leaks opens as little of the account as it can.',
      );
    }
    const match = RESTRICTED_KEY.exec(value);
    if (match === null) return providerError('CREDENTIALS_REFUSED', 'That is not a restricted key: it starts with rk_test_ or rk_live_.');
    if ((match[1] === 'live') !== live) {
      return providerError('MODE_MISMATCH', `This is a ${match[1]} key, and it was saved for ${context.mode} payments.`);
    }
    return value;
  }

  function refusal(status: number, body: Json | null, refunding: boolean): ProviderError {
    const error = asObject(body?.['error']) ?? {};
    const raw = scrub(text(error['message']) ?? `Stripe answered ${status}.`, context.credentials);
    const message = refunding ? plainRefusal(raw) : raw;
    const code = text(error['code']);
    const type = text(error['type']);
    const param = text(error['param']) ?? '';
    if (status === 401) return providerError('CREDENTIALS_REFUSED', message);
    if (permissionRefused(status, body)) return providerError('PERMISSION_MISSING', refunding ? REFUND_PERMISSION_MISSING : message);
    if (refunding && code !== null && REFUND_REFUSALS[code] !== undefined) return providerError('REFUND_REFUSED', REFUND_REFUSALS[code]);
    if (code === 'resource_missing' || status === 404) return providerError('NOT_FOUND', message);
    if (status === 429 || code === 'rate_limit') return providerError('RATE_LIMITED', message, true);
    if (status === 409 || code === 'idempotency_key_in_use' || code === 'lock_timeout') return providerError('UNAVAILABLE', message, true);
    if (status >= 500) return providerError('UNAVAILABLE', message, true);
    if (type === 'idempotency_error') return providerError('INVALID_REQUEST', message);
    if (/currency/.test(param)) return providerError('CURRENCY_UNSUPPORTED', message);
    if (refunding) return providerError('REFUND_REFUSED', message);
    return providerError('INVALID_REQUEST', message);
  }

  /** One call, answered as Stripe answered it: the status and the body (null when it is not JSON). */
  async function call(
    method: 'GET' | 'POST',
    path: string,
    form?: { readonly [field: string]: FormValue },
    idempotencyKey?: string,
  ): Promise<{ status: number; body: Json | null } | ProviderError> {
    const secret = key();
    if (isError(secret)) return secret;
    const headers: Record<string, string> = { authorization: `Bearer ${secret}`, 'stripe-version': STRIPE_API_VERSION };
    // Every POST is a form, even one with no field: Stripe refuses a POST with no content type.
    if (method === 'POST') headers['content-type'] = 'application/x-www-form-urlencoded';
    if (idempotencyKey !== undefined) headers['idempotency-key'] = idempotencyKey;
    let response: PaymentHttpResponse;
    try {
      response = await context.http(`${STRIPE_API_ORIGIN}${path}`, {
        method,
        headers,
        ...(method === 'POST' ? { body: formBody(form ?? {}) } : {}),
      });
    } catch {
      return providerError('UNAVAILABLE', 'Stripe could not be reached.', true);
    }
    let body: Json | null;
    try {
      body = asObject(JSON.parse(await response.text()));
    } catch {
      body = null;
    }
    return { status: response.status, body };
  }

  async function request(
    method: 'GET' | 'POST',
    path: string,
    form?: { readonly [field: string]: FormValue },
    idempotencyKey?: string,
  ): Promise<Json | ProviderError> {
    const answer = await call(method, path, form, idempotencyKey);
    if (isError(answer)) return answer;
    const { status, body } = answer;
    if (status < 200 || status >= 300) return refusal(status, body, path === STRIPE_PATHS.refunds && method === 'POST');
    if (body === null) return providerError('UNAVAILABLE', 'Stripe answered with something that is not JSON.', true);
    if (typeof body['livemode'] === 'boolean' && body['livemode'] !== live) {
      return providerError('MODE_MISMATCH', `Stripe answered for ${body['livemode'] ? 'live' : 'test'} payments, and this call was for ${context.mode}.`);
    }
    return body;
  }

  // ─── Reading Stripe's objects ─────────────────────────────────────────────

  function amountOf(minor: unknown, currency: string | null): string | null {
    if (currency === null || (typeof minor !== 'number' && typeof minor !== 'string')) return null;
    const decimal = stripeDecimal(String(minor), currency);
    return isError(decimal) ? null : decimal;
  }

  function paidWithOf(charge: Json | null): PaidWith | null {
    const details = asObject(charge?.['payment_method_details']);
    const type = text(details?.['type']);
    if (type === null) return null;
    if (type === 'card') {
      const card = asObject(details?.['card']);
      return { method: 'card', label: cardLabel(text(card?.['brand']), text(card?.['last4'])), delayed: false };
    }
    const info = methodInfo(type);
    return { method: type.slice(0, 64), label: info.label.slice(0, 120), delayed: info.delayed };
  }

  function statusOf(session: Json, intent: Json | null): CheckoutStatus {
    const state = text(session['status']);
    const intentStatus = text(intent?.['status']);
    if (state === 'expired') return 'expired';
    if (state === 'open') {
      if (intentStatus === 'requires_action') return 'requires_action';
      if (intentStatus === 'requires_payment_method' && asObject(intent?.['last_payment_error']) !== null) return 'failed';
      return 'pending';
    }
    const paid = text(session['payment_status']);
    if (paid === 'paid' || intentStatus === 'succeeded') return 'succeeded';
    if (intentStatus === 'requires_payment_method' || intentStatus === 'canceled') return 'failed';
    if (intentStatus === 'requires_action') return 'requires_action';
    if (paid === 'no_payment_required') return 'failed';
    return 'processing';
  }

  function stateOf(session: Json): CheckoutState | ProviderError {
    const ref = text(session['id']);
    if (ref === null) return providerError('UNAVAILABLE', 'Stripe sent a checkout with no id.');
    const intent = asObject(session['payment_intent']);
    const charge = asObject(intent?.['latest_charge']);
    const status = statusOf(session, intent);
    const currency = text(session['currency'])?.toUpperCase() ?? null;
    const moved = status === 'succeeded' || status === 'processing';
    const minor = !moved
      ? null
      : status === 'succeeded'
        ? (intent?.['amount_received'] ?? session['amount_total'])
        : (intent?.['amount'] ?? session['amount_total']);
    const amount = amountOf(minor, currency);
    const lastError = asObject(intent?.['last_payment_error']);
    const metadata = asObject(session['metadata']);
    const paidWith = moved ? paidWithOf(charge) : null;
    const created = typeof charge?.['created'] === 'number' ? (charge['created'] as number) * 1000 : null;
    return {
      ok: true,
      ref,
      status,
      attemptId: text(session['client_reference_id']) ?? text(metadata?.['attempt']),
      amount,
      currency: amount === null ? null : currency,
      livemode: session['livemode'] === true,
      paymentRef: idOf(session['payment_intent']),
      paidWith,
      settledAt: status === 'succeeded' && paidWith?.delayed !== true ? created : null,
      failureMessage:
        status === 'failed'
          ? scrub(text(lastError?.['message']) ?? 'The payment did not go through, and nothing was taken.', context.credentials)
          : null,
    };
  }

  function refundOf(body: Json): RefundState | ProviderError {
    const ref = text(body['id']);
    const currency = text(body['currency'])?.toUpperCase() ?? null;
    const amount = amountOf(body['amount'], currency);
    const status = REFUND_STATUSES[text(body['status']) ?? ''];
    const paymentRef = idOf(body['payment_intent']) ?? idOf(body['charge']);
    if (ref === null || currency === null || amount === null || status === undefined || paymentRef === null) {
      return providerError('UNAVAILABLE', 'Stripe sent a refund Adminium cannot read.');
    }
    const reason = text(body['failure_reason']);
    return {
      ok: true,
      ref,
      paymentRef,
      status,
      amount,
      currency,
      failureMessage: status === 'failed' || status === 'cancelled' ? (REFUND_FAILURES[reason ?? 'unknown'] ?? REFUND_FAILURES['unknown']!) : null,
    };
  }

  function eventOf(event: Json): PaymentEventOut | ProviderError {
    const eventId = text(event['id']);
    const type = text(event['type']);
    const created = event['created'];
    if (eventId === null || type === null || typeof created !== 'number') {
      return providerError('INVALID_REQUEST', 'The event is missing its id, type or time.');
    }
    const object = asObject(asObject(event['data'])?.['object']) ?? {};
    let kind: PaymentEventKind = 'other';
    let checkoutRef: string | null = null;
    let paymentRef: string | null = null;
    let refundRef: string | null = null;
    let dispute: DisputeOutcome | null = null;
    if (type.startsWith('checkout.session.')) {
      kind = 'checkout';
      checkoutRef = text(object['id']);
      paymentRef = idOf(object['payment_intent']);
    } else if (type.startsWith('refund.')) {
      kind = 'refund';
      refundRef = text(object['id']);
      paymentRef = idOf(object['payment_intent']);
    } else if (type === 'charge.refunded') {
      kind = 'refund';
      paymentRef = idOf(object['payment_intent']);
      const refunds = asObject(object['refunds'])?.['data'];
      refundRef = Array.isArray(refunds) ? idOf(refunds[0]) : null;
    } else if (type.startsWith('charge.dispute.')) {
      kind = 'dispute';
      paymentRef = idOf(object['payment_intent']);
      const currency = text(object['currency'])?.toUpperCase() ?? null;
      const amount = amountOf(object['amount'], currency);
      const status = DISPUTE_STATUSES[text(object['status']) ?? ''] ?? (type === 'charge.dispute.closed' ? 'closed' : 'open');
      // The dispute's own `created` (seconds), the same on every event about it.
      const opened = object['created'];
      const openedAt = typeof opened === 'number' && Number.isFinite(opened) && opened > 0 ? Math.round(opened * 1000) : null;
      dispute = { status, amount, currency: amount === null ? null : currency, openedAt };
    } else if (type.startsWith('payment_intent.')) {
      kind = 'checkout';
      paymentRef = text(object['id']);
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
      livemode: event['livemode'] === true,
      occurredAt: Math.max(0, Math.round(created * 1000)),
      ...(dispute === null ? {} : { dispute }),
    };
  }

  /** The configuration Checkout uses (the account's default), with the ways it has switched on. */
  async function configuration(): Promise<{ id: string; methods: PaymentMethodInfo[] } | ProviderError> {
    const body = await request('GET', `${STRIPE_PATHS.paymentMethodConfigurations}?limit=100`);
    if (isError(body)) return body;
    const all = Array.isArray(body['data']) ? body['data'].map(asObject).filter((one): one is Json => one !== null) : [];
    const chosen = all.find((one) => one['is_default'] === true && one['active'] !== false) ?? all.find((one) => one['active'] !== false);
    const id = text(chosen?.['id']);
    if (chosen === undefined || id === null) {
      return providerError('PERMISSION_MISSING', 'Stripe sent no payment method configuration for this account.');
    }
    const methods: PaymentMethodInfo[] = [];
    for (const [method, value] of Object.entries(chosen)) {
      const preference = asObject(asObject(value)?.['display_preference']);
      if (preference === null || text(preference['value']) !== 'on') continue;
      const info = methodInfo(method);
      methods.push({ id: method.slice(0, 64), label: info.label.slice(0, 120), delayed: info.delayed });
    }
    return { id, methods: methods.slice(0, 100) };
  }

  const provider: PaymentProvider = {
    key: STRIPE_ADD_ON_KEY,
    mode: context.mode,

    /**
     * Each probe in `PERMISSION_PROBES`, read by its status: 2xx is allowed; a
     * permission refusal is missing; a write's 400 that is NOT a permission
     * refusal (the missing parameter) is allowed, because Stripe checks the
     * permission first. Anything else stops the check with what Stripe said.
     */
    async checkCredentials(): Promise<CredentialCheck | ProviderError> {
      const missing: (typeof PERMISSION_PROBES)[number][] = [];
      for (const probe of PERMISSION_PROBES) {
        const answer = await call(probe.method, probe.path);
        if (isError(answer)) return answer;
        if (answer.status >= 200 && answer.status < 300) continue;
        if (answer.status !== 401 && permissionRefused(answer.status, answer.body)) {
          if (probe.optional !== true) missing.push(probe);
          continue;
        }
        if (probe.method === 'POST' && answer.status === 400) continue;
        return refusal(answer.status, answer.body, false);
      }
      const account = await request('GET', STRIPE_PATHS.account);
      if (isError(account)) {
        if (account.code !== 'PERMISSION_MISSING') return account;
        return providerError(
          'PERMISSION_MISSING',
          `The key cannot say which Stripe account it belongs to. Give it: ${[...missing, ACCOUNT_PERMISSION].map(permissionLabel).join(', ')}.`,
        );
      }
      const accountId = text(account['id']);
      if (accountId === null) return providerError('UNAVAILABLE', 'Stripe did not say which account the key belongs to.');
      return { ok: true, accountId: accountId.slice(0, 255), livemode: live, missing: missing.map((probe) => probe.name) };
    },

    async createCheckout(input: CheckoutInput): Promise<CheckoutCreated | ProviderError> {
      const minor = stripeMinor(input.payable.amount, input.payable.currency);
      if (isError(minor)) return minor;
      if (input.methods.length === 0) return providerError('INVALID_REQUEST', 'No way to pay is allowed for this payment.');
      const config = await configuration();
      if (isError(config)) return config;
      const excluded = config.methods
        .map((one) => one.id)
        .filter((id) => EXCLUDABLE.has(id) && !input.methods.includes(id));
      const at = Math.floor(now() / 1000);
      const name = input.payable.reference.trim() === '' ? 'Payment' : input.payable.reference.trim().slice(0, 250);
      const description = input.payable.description.trim();
      const form: { [field: string]: FormValue } = {
        mode: 'payment',
        ui_mode: 'hosted_page',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: minor.currency.toLowerCase(),
              unit_amount: minor.minor,
              product_data: { name, ...(description === '' ? {} : { description: description.slice(0, 500) }) },
            },
          },
        ],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        client_reference_id: input.attemptId.slice(0, 200),
        metadata: { attempt: input.attemptId },
        payment_intent_data: { metadata: { attempt: input.attemptId } },
        expires_at: at + SESSION_LIFETIME_SECONDS,
        locale: checkoutLocale(input.payable.locale),
        payment_method_configuration: config.id,
        adaptive_pricing: { enabled: false },
        automatic_tax: { enabled: false },
        allow_promotion_codes: false,
        ...(input.payable.customerEmail === null ? {} : { customer_email: input.payable.customerEmail }),
        ...(excluded.length === 0 ? {} : { excluded_payment_method_types: excluded }),
      };
      const body = await request('POST', STRIPE_PATHS.sessions, form, input.idempotencyKey);
      if (isError(body)) return body;
      const ref = text(body['id']);
      const url = text(body['url']);
      if (ref === null || url === null) return providerError('UNAVAILABLE', 'Stripe made the checkout but sent no page to send the customer to.');
      const expires = body['expires_at'];
      return { ok: true, ref, url, expiresAt: typeof expires === 'number' ? expires * 1000 : null };
    },

    async status(ref: string): Promise<CheckoutState | ProviderError> {
      const body = await request('GET', `${STRIPE_PATHS.session(ref)}?expand[]=payment_intent&expand[]=payment_intent.latest_charge`);
      return isError(body) ? body : stateOf(body);
    },

    /** One step at Stripe: a paid session needs nothing more, so this reads it. */
    complete(ref: string): Promise<CheckoutState | ProviderError> {
      return provider.status(ref);
    },

    async expire(ref: string): Promise<ExpireResult | ProviderError> {
      const body = await request('POST', STRIPE_PATHS.expireSession(ref));
      if (!isError(body)) {
        const state = stateOf(body);
        return isError(state) ? state : { ok: true, ref: state.ref, status: state.status };
      }
      if (body.code !== 'INVALID_REQUEST') return body;
      // Stripe ends only an open session. Read it to say why this one was not.
      const state = await provider.status(ref);
      if (isError(state)) return body;
      if (state.status === 'succeeded' || state.status === 'processing') {
        return providerError('ALREADY_COMPLETED', 'The customer finished paying before the checkout could be ended.');
      }
      return { ok: true, ref: state.ref, status: state.status };
    },

    async refund(input: RefundInput): Promise<RefundState | ProviderError> {
      const minor = stripeMinor(input.amount, input.currency);
      if (isError(minor)) return minor;
      const body = await request(
        'POST',
        STRIPE_PATHS.refunds,
        {
          payment_intent: input.paymentRef,
          amount: minor.minor,
          ...(input.reason === 'other' ? {} : { reason: input.reason }),
        },
        input.idempotencyKey,
      );
      return isError(body) ? body : refundOf(body);
    },

    async refundStatus(ref: string): Promise<RefundState | ProviderError> {
      const body = await request('GET', STRIPE_PATHS.refund(ref));
      return isError(body) ? body : refundOf(body);
    },

    async verifyWebhook(delivery: WebhookDelivery): Promise<PaymentEvent | ProviderError> {
      const secret = context.credentials['webhook_secret'] ?? '';
      if (secret === '') return providerError('SIGNATURE_INVALID', `No webhook signing secret is saved for ${context.mode} payments.`);
      const verdict = await verifyStripeSignature(delivery.rawBody, delivery.headers[SIGNATURE_HEADER], secret, Math.floor(now() / 1000));
      if (verdict !== 'ok') {
        const why: Record<typeof verdict, string> = {
          missing: 'The delivery carries no Stripe signature.',
          malformed: 'The Stripe signature header cannot be read.',
          'too-old': 'The signature is more than five minutes old.',
          mismatch: 'The signature does not match the saved signing secret.',
        };
        return providerError('SIGNATURE_INVALID', why[verdict]);
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

    async listMissedEvents(cursor: string | null): Promise<MissedEvents | ProviderError> {
      const query = new URLSearchParams({ delivery_success: 'false', limit: '100' });
      LISTENED_EVENTS.forEach((type, index) => query.append(`types[${index}]`, type));
      if (cursor !== null) query.append('ending_before', cursor);
      const body = await request('GET', `${STRIPE_PATHS.events}?${query.toString()}`);
      if (isError(body)) return body;
      // Stripe lists newest first; `ending_before` asks for the ones made after the cursor.
      const data = Array.isArray(body['data']) ? body['data'].map(asObject).filter((one): one is Json => one !== null) : [];
      const events: PaymentEvent[] = [];
      for (const one of [...data].reverse()) {
        const event = eventOf(one);
        if (!isError(event)) events.push(event);
      }
      const newest = text(data[0]?.['id']);
      return {
        ok: true,
        events: events.slice(0, 500),
        cursor: newest ?? cursor,
        // The first sweep starts at the newest page and walks forward from there.
        more: cursor !== null && body['has_more'] === true,
      };
    },

    async methodsFor(): Promise<MethodList | ProviderError> {
      const config = await configuration();
      return isError(config) ? config : { ok: true, methods: config.methods };
    },

    toMinor(amount: string, currency: string): MinorAmount | ProviderError {
      return stripeMinor(amount, currency);
    },

    fromMinor(minor: string, currency: string): string | ProviderError {
      return stripeDecimal(minor, currency);
    },
  };
  return provider;
}

/** The server half's export: the factory the engine calls per operation. */
export const createPaymentProvider: CreatePaymentProvider = (context) => createStripeProvider(context);
