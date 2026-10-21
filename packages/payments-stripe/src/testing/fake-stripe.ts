/**
 * A FAKE STRIPE, for the conformance suite and the transport's own cases.
 *
 * stripe-mock (Stripe's official mock server) checks every request against
 * Stripe's API description, but it keeps no state: a session it "creates" is
 * a fixture, and paying it is impossible. The contract's cases need a
 * checkout that is paid, declined, settled late and refunded, so this fake
 * keeps state and answers in Stripe's own wire format: form-encoded requests,
 * `{ error: { type, code, message, param } }` refusals, lower-case currencies,
 * amounts in the smallest unit, events newest first, `Stripe-Signature`
 * webhooks. Where its answers and stripe-mock's could differ in shape, the
 * stripe-mock suite is the judge.
 *
 * Test only. It is under `testing/`, which nothing shipped imports.
 */

import type { PaymentHttpClient, PaymentHttpResponse, WebhookDelivery } from '@adminium/add-on-host/contracts';

import { signStripeWebhook } from '../signature.ts';

type Json = Record<string, unknown>;

export interface FakeStripeOptions {
  /** The clock (epoch ms). */
  now?: () => number;
  /** Permission names (`PERMISSION_PROBES[].name`) the key is missing. */
  missing?: readonly string[];
  /** The ways to pay switched on in the default configuration. */
  enabled?: readonly string[];
  accountId?: string;
}

interface Session {
  id: string;
  status: 'open' | 'complete' | 'expired';
  payment_status: 'paid' | 'unpaid';
  amount_total: number;
  currency: string;
  client_reference_id: string | null;
  metadata: Json;
  expires_at: number;
  intent: string | null;
  params: Json;
}

interface Intent {
  id: string;
  status: string;
  amount: number;
  amount_received: number;
  currency: string;
  last_payment_error: Json | null;
  charge: string | null;
}

interface Charge {
  id: string;
  created: number;
  payment_method_details: Json;
}

interface Refund {
  id: string;
  payment_intent: string;
  amount: number;
  currency: string;
  status: string;
  failure_reason: string | null;
  created: number;
}

interface FakeEvent {
  id: string;
  type: string;
  created: number;
  object: Json;
  delivered: boolean;
}

/** `a[b][0][c]=1` → `{ a: { b: [ { c: '1' } ] } }`. */
export function parseForm(body: string): Json {
  const out: Json = {};
  for (const [key, value] of new URLSearchParams(body)) {
    const parts = key.replace(/\]/g, '').split('[');
    let node: Record<string, unknown> | unknown[] = out;
    parts.forEach((part, index) => {
      const last = index === parts.length - 1;
      const next = parts[index + 1];
      const container = node as Record<string, unknown>;
      if (last) {
        container[part] = value;
        return;
      }
      if (container[part] === undefined) container[part] = next !== undefined && /^\d+$/.test(next) ? [] : {};
      node = container[part] as Record<string, unknown>;
    });
  }
  return out;
}

function respond(status: number, body: unknown): PaymentHttpResponse {
  const text = JSON.stringify(body);
  return {
    status,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
    text: () => Promise.resolve(text),
  };
}

function refusal(status: number, type: string, message: string, extra: Json = {}): PaymentHttpResponse {
  return respond(status, { error: { type, message, ...extra } });
}

export interface FakeStripe {
  readonly http: PaymentHttpClient;
  /** Every request the transport made, in order. */
  readonly requests: { method: string; path: string; params: Json; headers: Record<string, string> }[];
  pay(sessionId: string, outcome: 'succeeds' | 'fails'): void;
  payLate(sessionId: string): void;
  settle(sessionId: string): void;
  failRefund(refundId: string): void;
  /** A refund made in the Stripe dashboard (no idempotency key, no Adminium). */
  refundInDashboard(intentId: string, amount: number): string;
  latestDelivery(sessionId: string, webhookSecret: string): Promise<WebhookDelivery | null>;
  markDelivered(eventId: string): void;
  events(): readonly { id: string; type: string }[];
}

export function createFakeStripe(options: FakeStripeOptions = {}): FakeStripe {
  const now = options.now ?? (() => Date.now());
  const seconds = () => Math.floor(now() / 1000);
  const missing = new Set(options.missing ?? []);
  const enabled = new Set(options.enabled ?? ['card', 'link', 'apple_pay', 'google_pay', 'sepa_debit', 'klarna']);
  const accountId = options.accountId ?? 'acct_1FakeShop00';

  const sessions = new Map<string, Session>();
  const intents = new Map<string, Intent>();
  const charges = new Map<string, Charge>();
  const refunds = new Map<string, Refund>();
  const idempotent = new Map<string, { path: string; body: string; status: number; answer: unknown }>();
  const events: FakeEvent[] = [];
  const requests: FakeStripe['requests'] = [];
  let counter = 0;
  const id = (prefix: string) => `${prefix}_test_${(counter += 1).toString(36).padStart(10, '0')}`;

  function intentBody(intent: Intent): Json {
    const charge = intent.charge === null ? null : charges.get(intent.charge)!;
    return {
      id: intent.id,
      object: 'payment_intent',
      status: intent.status,
      amount: intent.amount,
      amount_received: intent.amount_received,
      currency: intent.currency,
      livemode: false,
      last_payment_error: intent.last_payment_error,
      latest_charge: charge === null ? null : { id: charge.id, object: 'charge', created: charge.created, payment_method_details: charge.payment_method_details, livemode: false },
    };
  }

  function sessionBody(session: Session, expand: boolean): Json {
    const intent = session.intent === null ? null : intents.get(session.intent)!;
    return {
      id: session.id,
      object: 'checkout.session',
      status: session.status,
      payment_status: session.payment_status,
      amount_total: session.amount_total,
      currency: session.currency,
      client_reference_id: session.client_reference_id,
      metadata: session.metadata,
      expires_at: session.expires_at,
      livemode: false,
      ui_mode: 'hosted_page',
      url: session.status === 'open' ? `https://checkout.stripe.com/c/pay/${session.id}` : null,
      payment_intent: intent === null ? null : expand ? intentBody(intent) : intent.id,
    };
  }

  function refundBody(refund: Refund): Json {
    return {
      id: refund.id,
      object: 'refund',
      amount: refund.amount,
      currency: refund.currency,
      payment_intent: refund.payment_intent,
      status: refund.status,
      failure_reason: refund.failure_reason,
      created: refund.created,
    };
  }

  function emit(type: string, object: Json): void {
    events.push({ id: id('evt'), type, created: seconds(), object, delivered: false });
  }

  function age(session: Session): Session {
    if (session.status === 'open' && seconds() >= session.expires_at) {
      session.status = 'expired';
      emit('checkout.session.expired', sessionBody(session, false));
    }
    return session;
  }

  function refundedSoFar(intentId: string): number {
    let total = 0;
    for (const one of refunds.values()) if (one.payment_intent === intentId && one.status !== 'failed' && one.status !== 'canceled') total += one.amount;
    return total;
  }

  const http: PaymentHttpClient = async (url, init) => {
    const parsed = new URL(url);
    const method = (init?.method ?? 'GET').toUpperCase();
    const headers = Object.fromEntries(Object.entries(init?.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
    const params = method === 'POST' ? parseForm(init?.body ?? '') : Object.fromEntries(parsed.searchParams);
    requests.push({ method, path: `${parsed.pathname}${parsed.search}`, params, headers });

    if (parsed.origin !== 'https://api.stripe.com') return refusal(404, 'invalid_request_error', 'Unrecognized request URL.');
    const key = (headers['authorization'] ?? '').replace(/^Bearer /, '');
    if (!/^rk_test_[A-Za-z0-9]{10,}$/.test(key)) {
      return refusal(401, 'invalid_request_error', `Invalid API Key provided: ${key.slice(0, 8)}********${key.slice(-4)}`);
    }

    const replayKey = headers['idempotency-key'];
    if (method === 'POST' && replayKey !== undefined) {
      const seen = idempotent.get(replayKey);
      if (seen !== undefined) {
        if (seen.path !== parsed.pathname || seen.body !== (init?.body ?? '')) {
          return refusal(400, 'idempotency_error', 'Keys for idempotent requests can only be used with the same parameters they were first used with.');
        }
        return respond(seen.status, seen.answer);
      }
    }
    const answer = route(method, parsed.pathname, params, parsed.searchParams);
    if (method === 'POST' && replayKey !== undefined && answer.status < 500) {
      idempotent.set(replayKey, { path: parsed.pathname, body: init?.body ?? '', status: answer.status, answer: JSON.parse(await answer.text()) });
    }
    return answer;
  };

  function denied(permission: string): PaymentHttpResponse | null {
    if (!missing.has(permission)) return null;
    return refusal(403, 'invalid_request_error', `The provided key 'rk_test_*********abcd' does not have the required permissions for this endpoint on account '${accountId}'. Having the '${permission}' permission would allow this request to continue.`);
  }

  const list = (data: unknown[], hasMore = false) => respond(200, { object: 'list', data, has_more: hasMore, url: '/v1/x' });

  function route(method: string, path: string, params: Json, query: URLSearchParams): PaymentHttpResponse {
    const parts = path.split('/').filter(Boolean);
    if (method === 'GET' && path === '/v1/account') return denied('Accounts: read') ?? respond(200, { id: accountId, object: 'account' });
    if (method === 'GET' && path === '/v1/payment_intents') return denied('PaymentIntents: read') ?? list([]);
    if (method === 'GET' && path === '/v1/disputes') return denied('Disputes: read') ?? list([]);
    if (method === 'GET' && path === '/v1/webhook_endpoints') return denied('Webhook endpoints: read') ?? list([]);
    if (method === 'GET' && path === '/v1/payment_method_configurations') {
      const block = denied('Payment Method Configurations: read');
      if (block !== null) return block;
      const config: Json = { id: 'pmc_test_default', object: 'payment_method_configuration', active: true, is_default: true, livemode: false, name: 'Default' };
      for (const method of ['card', 'link', 'apple_pay', 'google_pay', 'sepa_debit', 'klarna', 'paypal', 'ideal']) {
        const on = enabled.has(method);
        config[method] = { available: on, display_preference: { overridable: true, preference: on ? 'on' : 'off', value: on ? 'on' : 'off' } };
      }
      return list([config]);
    }
    if (method === 'GET' && path === '/v1/checkout/sessions') return denied('Checkout Sessions: read') ?? list([]);
    if (method === 'POST' && path === '/v1/checkout/sessions') {
      const block = denied('Checkout Sessions: write');
      if (block !== null) return block;
      const line = ((params['line_items'] as Json[] | undefined) ?? [])[0] ?? {};
      const price = (line['price_data'] as Json | undefined) ?? {};
      const session: Session = {
        id: id('cs'),
        status: 'open',
        payment_status: 'unpaid',
        amount_total: Number(price['unit_amount']) * Number(line['quantity'] ?? 1),
        currency: String(price['currency']),
        client_reference_id: (params['client_reference_id'] as string | undefined) ?? null,
        metadata: (params['metadata'] as Json | undefined) ?? {},
        expires_at: Number(params['expires_at'] ?? seconds() + 86400),
        intent: null,
        params,
      };
      sessions.set(session.id, session);
      return respond(200, sessionBody(session, false));
    }
    if (parts[0] === 'v1' && parts[1] === 'checkout' && parts[2] === 'sessions' && parts[3] !== undefined) {
      const session = sessions.get(parts[3]);
      if (method === 'POST' && parts[4] === 'expire') {
        const block = denied('Checkout Sessions: write');
        if (block !== null) return block;
        if (session === undefined) return refusal(404, 'invalid_request_error', `No such checkout.session: '${parts[3]}'`, { code: 'resource_missing', param: 'session' });
        age(session);
        if (session.status !== 'open') return refusal(400, 'invalid_request_error', 'Only Checkout Sessions with a status in ["open"] can be expired.');
        session.status = 'expired';
        emit('checkout.session.expired', sessionBody(session, false));
        return respond(200, sessionBody(session, false));
      }
      if (method === 'GET') {
        const block = denied('Checkout Sessions: read');
        if (block !== null) return block;
        if (session === undefined) return refusal(404, 'invalid_request_error', `No such checkout.session: '${parts[3]}'`, { code: 'resource_missing', param: 'session' });
        return respond(200, sessionBody(age(session), query.getAll('expand[]').includes('payment_intent')));
      }
    }
    if (method === 'POST' && path === '/v1/refunds') {
      const block = denied('Charges and Refunds: write');
      if (block !== null) return block;
      const intent = intents.get(String(params['payment_intent']));
      if (intent === undefined) return refusal(400, 'invalid_request_error', `No such payment_intent: '${String(params['payment_intent'])}'`, { code: 'resource_missing', param: 'payment_intent' });
      if (intent.status !== 'succeeded') return refusal(400, 'invalid_request_error', 'This PaymentIntent does not have a successful charge to refund.', { code: 'charge_not_refundable' });
      const left = intent.amount_received - refundedSoFar(intent.id);
      const amount = params['amount'] === undefined ? left : Number(params['amount']);
      if (left <= 0) return refusal(400, 'invalid_request_error', 'Charge has already been refunded.', { code: 'charge_already_refunded' });
      if (amount > left) return refusal(400, 'invalid_request_error', `Refund amount (${amount}) is greater than unrefunded amount on charge (${left})`, { param: 'amount' });
      const refund: Refund = { id: id('re'), payment_intent: intent.id, amount, currency: intent.currency, status: 'succeeded', failure_reason: null, created: seconds() };
      refunds.set(refund.id, refund);
      emit('refund.created', refundBody(refund));
      return respond(200, refundBody(refund));
    }
    if (method === 'GET' && parts[0] === 'v1' && parts[1] === 'refunds' && parts[2] !== undefined) {
      const refund = refunds.get(parts[2]);
      if (refund === undefined) return refusal(404, 'invalid_request_error', `No such refund: '${parts[2]}'`, { code: 'resource_missing', param: 'id' });
      return respond(200, refundBody(refund));
    }
    if (method === 'GET' && path === '/v1/events') {
      const block = denied('Events: read');
      if (block !== null) return block;
      const types = [...query.entries()].filter(([name]) => /^types\[\d+\]$/.test(name)).map(([, value]) => value);
      const undeliveredOnly = query.get('delivery_success') === 'false';
      const limit = Number(query.get('limit') ?? 10);
      let pool = events.filter((one) => (types.length === 0 || types.includes(one.type)) && (!undeliveredOnly || !one.delivered));
      const before = query.get('ending_before');
      if (before !== null) {
        const at = events.findIndex((one) => one.id === before);
        pool = pool.filter((one) => events.indexOf(one) > at);
        // The page next to the cursor: the oldest `limit` after it, sent newest first.
        const page = pool.slice(0, limit);
        return list(page.reverse().map(eventBody), pool.length > limit);
      }
      const newestFirst = [...pool].reverse();
      return list(newestFirst.slice(0, limit).map(eventBody), newestFirst.length > limit);
    }
    return refusal(404, 'invalid_request_error', `Unrecognized request URL (${method}: ${path}).`);
  }

  function eventBody(event: FakeEvent): Json {
    return { id: event.id, object: 'event', type: event.type, created: event.created, livemode: false, api_version: '2026-09-30.endive', data: { object: event.object } };
  }

  function mustSession(sessionId: string): Session {
    const session = sessions.get(sessionId);
    if (session === undefined) throw new Error(`no fake session ${sessionId}`);
    return age(session);
  }

  function newIntent(session: Session, status: string, details: Json): Intent {
    const charge: Charge = { id: id('ch'), created: seconds(), payment_method_details: details };
    charges.set(charge.id, charge);
    const intent: Intent = {
      id: id('pi'),
      status,
      amount: session.amount_total,
      amount_received: status === 'succeeded' ? session.amount_total : 0,
      currency: session.currency,
      last_payment_error: null,
      charge: charge.id,
    };
    intents.set(intent.id, intent);
    session.intent = intent.id;
    return intent;
  }

  const visa = { type: 'card', card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 } };

  return {
    http,
    requests,
    pay(sessionId, outcome) {
      const session = mustSession(sessionId);
      if (session.status !== 'open') throw new Error(`fake session ${sessionId} is ${session.status}`);
      if (outcome === 'fails') {
        const intent = newIntent(session, 'requires_payment_method', { type: 'card', card: { brand: 'visa', last4: '0002' } });
        intent.last_payment_error = { type: 'card_error', code: 'card_declined', message: 'Your card was declined.' };
        return;
      }
      newIntent(session, 'succeeded', visa);
      session.status = 'complete';
      session.payment_status = 'paid';
      emit('checkout.session.completed', sessionBody(session, false));
    },
    payLate(sessionId) {
      const session = mustSession(sessionId);
      newIntent(session, 'processing', { type: 'sepa_debit', sepa_debit: { last4: '3000' } });
      session.status = 'complete';
      emit('checkout.session.completed', sessionBody(session, false));
    },
    settle(sessionId) {
      const session = mustSession(sessionId);
      const intent = intents.get(session.intent ?? '');
      if (intent === undefined || intent.status !== 'processing') throw new Error(`fake session ${sessionId} has nothing to settle`);
      intent.status = 'succeeded';
      intent.amount_received = intent.amount;
      session.payment_status = 'paid';
      emit('checkout.session.async_payment_succeeded', sessionBody(session, false));
    },
    failRefund(refundId) {
      const refund = refunds.get(refundId);
      if (refund === undefined) throw new Error(`no fake refund ${refundId}`);
      refund.status = 'failed';
      refund.failure_reason = 'expired_or_canceled_card';
      emit('refund.failed', refundBody(refund));
    },
    refundInDashboard(intentId, amount) {
      const intent = intents.get(intentId);
      if (intent === undefined) throw new Error(`no fake payment ${intentId}`);
      const refund: Refund = { id: id('re'), payment_intent: intentId, amount, currency: intent.currency, status: 'succeeded', failure_reason: null, created: seconds() };
      refunds.set(refund.id, refund);
      emit('refund.created', refundBody(refund));
      return refund.id;
    },
    async latestDelivery(sessionId, webhookSecret) {
      const event = [...events].reverse().find((one) => one.object['id'] === sessionId);
      if (event === undefined) return null;
      const rawBody = JSON.stringify(eventBody(event));
      return { rawBody, headers: { 'stripe-signature': await signStripeWebhook(rawBody, webhookSecret, seconds()) } };
    },
    markDelivered(eventId) {
      const event = events.find((one) => one.id === eventId);
      if (event !== undefined) event.delivered = true;
    },
    events() {
      return events.map((one) => ({ id: one.id, type: one.type }));
    },
  };
}
