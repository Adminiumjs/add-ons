/**
 * A FAKE PAYPAL, for the conformance suite and the transport's own cases.
 *
 * It keeps state and answers in PayPal's own wire format (Orders v2,
 * Payments v2, Webhooks v1): JSON bodies, `PayPal-Request-Id` replays,
 * `{ name, message, details: [{ issue, description }] }` refusals, amounts as
 * decimal `value` strings, HATEOAS `links`, and webhooks signed the way PayPal
 * signs them, with a certificate served from a pinned host. The OpenAPI suite
 * checks the transport's REQUESTS against PayPal's published descriptions;
 * this fake supplies the behaviour no description holds.
 *
 * Test only. It is under `testing/`, which nothing shipped imports.
 */
import { sign } from 'node:crypto';

import type { PaymentHttpClient, PaymentHttpResponse, WebhookDelivery } from '@adminium/add-on-host/contracts';

import { signedMessage } from '../signature.ts';

type Json = Record<string, unknown>;

export const FAKE_API = 'https://api-m.sandbox.paypal.com';
export const FAKE_CERT_URL = 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-360caa42-fca2a594-a5cafa77';

export interface FakePaypalOptions {
  now?: () => number;
  clientId: string;
  clientSecret: string;
  merchantId?: string;
  /** What the certificate address serves. */
  certPem: string;
  /** The key deliveries are signed with. */
  signingKeyPem: string;
  /** Orders may not be made (an app without Accept payments). */
  denyOrders?: boolean;
}

type CaptureAs = 'COMPLETED' | 'DECLINED' | 'PENDING';

interface Order {
  id: string;
  status: string;
  createTime: number;
  unit: Json;
  captureAs: CaptureAs;
  capture: string | null;
  declineOnCapture: boolean;
}

interface Capture {
  id: string;
  order: string;
  status: string;
  reason: string | null;
  value: string;
  currency: string;
  createTime: number;
  updateTime: number;
}

interface Refund {
  id: string;
  capture: string;
  status: string;
  value: string;
  currency: string;
  createTime: number;
}

interface FakeEvent {
  id: string;
  type: string;
  at: number;
  resourceType: string;
  resource: Json;
}

const iso = (ms: number) => new Date(Math.floor(ms / 1000) * 1000).toISOString().replace('.000Z', 'Z');

function respond(status: number, body?: unknown): PaymentHttpResponse {
  const text = body === undefined ? '' : JSON.stringify(body);
  return { status, headers: { get: (name: string) => (name.toLowerCase() === 'content-type' && body !== undefined ? 'application/json' : null) }, text: () => Promise.resolve(text) };
}

function issue(status: number, name: string, code: string, description: string): PaymentHttpResponse {
  return respond(status, { name, message: 'The requested action could not be performed.', debug_id: 'f00dbabe', details: [{ issue: code, description }] });
}

/** Cents as PayPal writes them, for a currency with or without decimals. */
const WHOLE = new Set(['HUF', 'JPY', 'TWD']);
const toCents = (value: string, currency: string) => (WHOLE.has(currency) ? Math.round(Number(value)) : Math.round(Number(value) * 100));
const fromCents = (cents: number, currency: string) => (WHOLE.has(currency) ? String(cents) : (cents / 100).toFixed(2));

export interface FakePaypal {
  readonly http: PaymentHttpClient;
  readonly requests: { method: string; path: string; headers: Record<string, string>; body: unknown }[];
  /** The customer approves on the PayPal page; the capture that follows will end as `captureAs`. */
  approve(orderId: string, captureAs?: CaptureAs): void;
  /** The next capture call is refused with INSTRUMENT_DECLINED (the order stays approved). */
  declineNextCapture(orderId: string): void;
  /** A held capture clears. */
  settle(orderId: string): void;
  failRefund(refundId: string): void;
  latestDelivery(orderId: string, webhookId: string): WebhookDelivery | null;
  deliveryFor(eventId: string, webhookId: string, options?: { certUrl?: string; keyPem?: string }): WebhookDelivery;
  events(): readonly { id: string; type: string }[];
  /** PayPal sends an event Adminium did not cause (a dispute, a reversal); answers its id. */
  raise(type: string, resourceType: string, resource: Record<string, unknown>): string;
  tokensIssued(): number;
}

export function createFakePaypal(options: FakePaypalOptions): FakePaypal {
  const now = options.now ?? (() => Date.now());
  const merchant = options.merchantId ?? 'FAKEMERCHANT1';
  const orders = new Map<string, Order>();
  const captures = new Map<string, Capture>();
  const refunds = new Map<string, Refund>();
  const replays = new Map<string, { status: number; body: unknown }>();
  const events: FakeEvent[] = [];
  const requests: FakePaypal['requests'] = [];
  const issuedTokens = new Set<string>();
  let counter = 0;
  const id = (prefix: string) => `${prefix}${(counter += 1).toString(36).toUpperCase().padStart(15, '0')}`;

  function captureBody(capture: Capture): Json {
    return {
      id: capture.id,
      status: capture.status,
      ...(capture.reason === null ? {} : { status_details: { reason: capture.reason } }),
      amount: { currency_code: capture.currency, value: capture.value },
      final_capture: true,
      supplementary_data: { related_ids: { order_id: capture.order } },
      create_time: iso(capture.createTime),
      update_time: iso(capture.updateTime),
      links: [{ href: `${FAKE_API}/v2/payments/captures/${capture.id}`, rel: 'self', method: 'GET' }],
    };
  }

  function orderBody(order: Order): Json {
    const capture = order.capture === null ? null : captures.get(order.capture)!;
    return {
      id: order.id,
      intent: 'CAPTURE',
      status: order.status,
      create_time: iso(order.createTime),
      purchase_units: [
        {
          ...order.unit,
          payee: { merchant_id: merchant, email_address: 'shop@example.test' },
          ...(capture === null ? {} : { payments: { captures: [captureBody(capture)] } }),
        },
      ],
      links: [
        { href: `${FAKE_API}/v2/checkout/orders/${order.id}`, rel: 'self', method: 'GET' },
        ...(order.status === 'PAYER_ACTION_REQUIRED' ? [{ href: `https://www.sandbox.paypal.com/checkoutnow?token=${order.id}`, rel: 'payer-action', method: 'GET' }] : []),
      ],
    };
  }

  function refundBody(refund: Refund): Json {
    return {
      id: refund.id,
      status: refund.status,
      amount: { currency_code: refund.currency, value: refund.value },
      create_time: iso(refund.createTime),
      links: [
        { href: `${FAKE_API}/v2/payments/refunds/${refund.id}`, rel: 'self', method: 'GET' },
        { href: `${FAKE_API}/v2/payments/captures/${refund.capture}`, rel: 'up', method: 'GET' },
      ],
    };
  }

  function emit(type: string, resourceType: string, resource: Json): void {
    events.push({ id: `WH-${id('')}`, type, at: now(), resourceType, resource });
  }

  function eventBody(event: FakeEvent): Json {
    return { id: event.id, event_version: '1.0', create_time: iso(event.at), resource_type: event.resourceType, event_type: event.type, summary: event.type, resource: event.resource };
  }

  function route(method: string, path: string, query: URLSearchParams, body: Json | unknown[] | null): PaymentHttpResponse {
    const parts = path.split('/').filter(Boolean);
    if (method === 'POST' && path === '/v2/checkout/orders') {
      if (options.denyOrders === true) return issue(403, 'NOT_AUTHORIZED', 'PERMISSION_DENIED', 'You do not have permission to access or perform operations on this resource.');
      const request = body as Json;
      const unit = { ...((request['purchase_units'] as Json[])[0] ?? {}) };
      const order: Order = {
        id: id(''),
        status: asObject(request['payment_source']) === null ? 'CREATED' : 'PAYER_ACTION_REQUIRED',
        createTime: now(),
        unit,
        captureAs: 'COMPLETED',
        capture: null,
        declineOnCapture: false,
      };
      orders.set(order.id, order);
      return respond(201, orderBody(order));
    }
    if (parts[0] === 'v2' && parts[1] === 'checkout' && parts[2] === 'orders' && parts[3] !== undefined) {
      const order = orders.get(parts[3]);
      if (order === undefined) return issue(404, 'RESOURCE_NOT_FOUND', 'INVALID_RESOURCE_ID', 'Specified resource ID does not exist.');
      if (method === 'GET' && parts.length === 4) return respond(200, orderBody(order));
      if (method === 'PATCH' && parts.length === 4) {
        if (order.status === 'COMPLETED') return issue(422, 'UNPROCESSABLE_ENTITY', 'ORDER_ALREADY_COMPLETED', 'The order cannot be patched after it is completed.');
        for (const op of (body as Json[]) ?? []) {
          if (String(op['path']).endsWith('/custom_id') && (op['op'] === 'replace' || op['op'] === 'add')) order.unit['custom_id'] = op['value'];
        }
        return respond(204);
      }
      if (method === 'POST' && parts[4] === 'capture') {
        if (order.status === 'COMPLETED') return issue(422, 'UNPROCESSABLE_ENTITY', 'ORDER_ALREADY_CAPTURED', 'Order already captured.If intent=CAPTURE only one capture per order is allowed.');
        if (order.status !== 'APPROVED') return issue(422, 'UNPROCESSABLE_ENTITY', 'ORDER_NOT_APPROVED', 'Payer has not yet approved the Order for payment.');
        if (order.declineOnCapture) {
          order.declineOnCapture = false;
          return issue(422, 'UNPROCESSABLE_ENTITY', 'INSTRUMENT_DECLINED', 'The instrument presented was either declined by the processor or bank, or it cannot be used for this payment.');
        }
        const amount = order.unit['amount'] as Json;
        const capture: Capture = {
          id: id('CAP'),
          order: order.id,
          status: order.captureAs,
          reason: order.captureAs === 'PENDING' ? 'ECHECK' : null,
          value: String(amount['value']),
          currency: String(amount['currency_code']),
          createTime: now(),
          updateTime: now(),
        };
        captures.set(capture.id, capture);
        order.capture = capture.id;
        order.status = 'COMPLETED';
        emit(capture.status === 'COMPLETED' ? 'PAYMENT.CAPTURE.COMPLETED' : capture.status === 'PENDING' ? 'PAYMENT.CAPTURE.PENDING' : 'PAYMENT.CAPTURE.DENIED', 'capture', captureBody(capture));
        return respond(201, orderBody(order));
      }
    }
    if (method === 'POST' && parts[0] === 'v2' && parts[1] === 'payments' && parts[2] === 'captures' && parts[4] === 'refund') {
      const capture = captures.get(parts[3] ?? '');
      if (capture === undefined) return issue(404, 'RESOURCE_NOT_FOUND', 'INVALID_RESOURCE_ID', 'Specified resource ID does not exist.');
      if (capture.status !== 'COMPLETED' && capture.status !== 'PARTIALLY_REFUNDED') return issue(422, 'UNPROCESSABLE_ENTITY', 'CAPTURE_FULLY_REFUNDED', 'The capture has already been fully refunded.');
      const already = [...refunds.values()].filter((one) => one.capture === capture.id && one.status !== 'FAILED' && one.status !== 'CANCELLED').reduce((sum, one) => sum + toCents(one.value, one.currency), 0);
      const left = toCents(capture.value, capture.currency) - already;
      const asked = asObject((body as Json | null)?.['amount']);
      const cents = asked === null ? left : toCents(String(asked['value']), capture.currency);
      if (cents > left) return issue(422, 'UNPROCESSABLE_ENTITY', 'REFUND_AMOUNT_EXCEEDED', 'The refund amount must be less than or equal to the capture amount that has not yet been refunded.');
      const refund: Refund = { id: id('RF'), capture: capture.id, status: 'COMPLETED', value: fromCents(cents, capture.currency), currency: capture.currency, createTime: now() };
      refunds.set(refund.id, refund);
      capture.status = cents === left ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
      emit('PAYMENT.CAPTURE.REFUNDED', 'refund', refundBody(refund));
      return respond(201, refundBody(refund));
    }
    if (method === 'GET' && parts[0] === 'v2' && parts[1] === 'payments' && parts[2] === 'refunds') {
      const refund = refunds.get(parts[3] ?? '');
      return refund === undefined ? issue(404, 'RESOURCE_NOT_FOUND', 'INVALID_RESOURCE_ID', 'Specified resource ID does not exist.') : respond(200, refundBody(refund));
    }
    if (method === 'GET' && path === '/v1/notifications/webhooks-events') {
      const start = Date.parse(query.get('start_time') ?? '1970-01-01T00:00:00Z');
      const end = Date.parse(query.get('end_time') ?? '2999-01-01T00:00:00Z');
      const size = Number(query.get('page_size') ?? 10);
      const inRange = events.filter((one) => Math.floor(one.at / 1000) * 1000 >= start && one.at <= end + 999).reverse();
      return respond(200, { events: inRange.slice(0, size).map(eventBody), count: Math.min(size, inRange.length), links: inRange.length > size ? [{ href: 'next-page', rel: 'next', method: 'GET' }] : [] });
    }
    return issue(404, 'RESOURCE_NOT_FOUND', 'INVALID_RESOURCE_ID', `No route for ${method} ${path}.`);
  }

  const http: PaymentHttpClient = async (url, init) => {
    const parsed = new URL(url);
    const method = (init?.method ?? 'GET').toUpperCase();
    const headers = Object.fromEntries(Object.entries(init?.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
    let body: Json | unknown[] | null = null;
    if (init?.body !== undefined && init.body !== '' && headers['content-type'] === 'application/json') body = JSON.parse(init.body) as Json;
    requests.push({ method, path: `${parsed.pathname}${parsed.search}`, headers, body: body ?? init?.body ?? null });

    if (url === FAKE_CERT_URL) return { status: 200, headers: { get: () => 'application/x-pem-file' }, text: async () => options.certPem };
    if (parsed.origin !== FAKE_API) return respond(404, { name: 'RESOURCE_NOT_FOUND' });

    if (method === 'POST' && parsed.pathname === '/v1/oauth2/token') {
      const expected = `Basic ${btoa(`${options.clientId}:${options.clientSecret}`)}`;
      if (headers['authorization'] !== expected || init?.body !== 'grant_type=client_credentials') {
        return respond(401, { error: 'invalid_client', error_description: 'Client Authentication failed' });
      }
      const token = `A21AA${id('TOKEN')}fake`;
      issuedTokens.add(token);
      return respond(200, { scope: 'https://uri.paypal.com/services/payments/payment', access_token: token, token_type: 'Bearer', app_id: 'APP-80W284485P519543T', expires_in: 32400, nonce: 'n' });
    }
    const bearer = (headers['authorization'] ?? '').replace(/^Bearer /, '');
    if (!issuedTokens.has(bearer)) return respond(401, { error: 'invalid_token', error_description: 'Token signature verification failed' });

    const requestId = headers['paypal-request-id'];
    const replayKey = requestId === undefined ? null : `${method} ${parsed.pathname} ${requestId}`;
    if (replayKey !== null && replays.has(replayKey)) {
      const seen = replays.get(replayKey)!;
      return respond(seen.status === 201 ? 200 : seen.status, seen.body);
    }
    const answer = route(method, parsed.pathname, parsed.searchParams, body);
    if (replayKey !== null && answer.status < 300) {
      const text = await answer.text();
      replays.set(replayKey, { status: answer.status, body: text === '' ? undefined : JSON.parse(text) });
    }
    return answer;
  };

  function mustOrder(orderId: string): Order {
    const order = orders.get(orderId);
    if (order === undefined) throw new Error(`no fake order ${orderId}`);
    return order;
  }

  function deliveryFor(eventId: string, webhookId: string, extra: { certUrl?: string; keyPem?: string } = {}): WebhookDelivery {
    const event = events.find((one) => one.id === eventId);
    if (event === undefined) throw new Error(`no fake event ${eventId}`);
    const rawBody = JSON.stringify(eventBody(event));
    const transmissionId = `t-${eventId}`;
    const time = iso(now());
    const signature = sign('sha256', new TextEncoder().encode(signedMessage(transmissionId, time, webhookId, rawBody)), extra.keyPem ?? options.signingKeyPem).toString('base64');
    return {
      rawBody,
      headers: {
        'paypal-transmission-id': transmissionId,
        'paypal-transmission-time': time,
        'paypal-transmission-sig': signature,
        'paypal-cert-url': extra.certUrl ?? FAKE_CERT_URL,
        'paypal-auth-algo': 'SHA256withRSA',
      },
    };
  }

  return {
    http,
    requests,
    approve(orderId, captureAs = 'COMPLETED') {
      const order = mustOrder(orderId);
      if (order.status !== 'PAYER_ACTION_REQUIRED' && order.status !== 'CREATED') throw new Error(`fake order ${orderId} is ${order.status}`);
      order.status = 'APPROVED';
      order.captureAs = captureAs;
      emit('CHECKOUT.ORDER.APPROVED', 'checkout-order', orderBody(order));
    },
    declineNextCapture(orderId) {
      mustOrder(orderId).declineOnCapture = true;
    },
    settle(orderId) {
      const capture = captures.get(mustOrder(orderId).capture ?? '');
      if (capture === undefined || capture.status !== 'PENDING') throw new Error(`fake order ${orderId} has nothing held`);
      capture.status = 'COMPLETED';
      capture.reason = null;
      capture.updateTime = now();
      emit('PAYMENT.CAPTURE.COMPLETED', 'capture', captureBody(capture));
    },
    failRefund(refundId) {
      const refund = refunds.get(refundId);
      if (refund === undefined) throw new Error(`no fake refund ${refundId}`);
      refund.status = 'FAILED';
    },
    latestDelivery(orderId, webhookId) {
      const event = [...events].reverse().find((one) => one.resource['id'] === orderId || asObject(asObject(one.resource['supplementary_data'])?.['related_ids'])?.['order_id'] === orderId);
      return event === undefined ? null : deliveryFor(event.id, webhookId);
    },
    deliveryFor,
    events() {
      return events.map((one) => ({ id: one.id, type: one.type }));
    },
    raise(type, resourceType, resource) {
      emit(type, resourceType, resource);
      return events.at(-1)!.id;
    },
    tokensIssued() {
      return issuedTokens.size;
    },
  };
}

function asObject(value: unknown): Json | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : null;
}
