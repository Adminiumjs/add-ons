/**
 * What the shared suite cannot say about PayPal in particular: the two steps
 * (approve, then capture), the ended-order marker, the hosts of each mode,
 * the webhook certificate rules, and how PayPal refusals read.
 */
import { X509Certificate } from 'node:crypto';

import { beforeEach, describe, expect, it } from 'vitest';

import type { CheckoutInput, PaymentHttpClient, PaymentMode, ProviderError } from '@adminium/add-on-host/contracts';

import { paypalMinor, paypalValue } from './currency.ts';
import { crc32 } from './signature.ts';
import { createFakePaypal, FAKE_CERT_URL, type FakePaypal } from './testing/fake-paypal.ts';
import { testChain } from './testing/certs.ts';
import { createPaypalProvider, forgetPaypalCaches } from './transport.ts';
import { LISTENED_EVENTS, ORDER_LIFETIME_MS, VOID_MARKER } from './wire.ts';

const chain = testChain();
const trust = { anchors: [new X509Certificate(chain.rootPem)], intermediates: [] };
const credentials = { client_id: 'AunitClientId0001', client_secret: 'EunitClientSecret0001', webhook_id: '4JH86294D6297924G' };

// The test chain is made fresh on each run, so the clock starts an hour into
// its leaf's dates, never at a fixed day the chain may not cover yet.
const START = Date.parse(new X509Certificate(chain.chainPem).validFrom) + 3_600_000;
let clock = START;
const now = () => clock;
let paypal: FakePaypal;

function provider(http: PaymentHttpClient = paypal.http, mode: PaymentMode = 'test') {
  return createPaypalProvider({ http, credentials, mode }, { now, trust });
}

const input = (over: Partial<CheckoutInput> = {}): CheckoutInput => ({
  payable: { reference: 'INV-0042', description: 'Invoice for Lena Fischer', amount: '120.00', currency: 'EUR', customerEmail: 'lena@example.test', locale: 'ar-EG' },
  methods: ['paypal'],
  successUrl: 'https://pay.example.test/pay/return',
  cancelUrl: 'https://pay.example.test/pay/cancel',
  attemptId: 'att_7Hq2Lm9Xr4',
  idempotencyKey: 'att_7Hq2Lm9Xr4:create',
  ...over,
});

function code(answer: unknown): string {
  return (answer as ProviderError).ok === false ? (answer as ProviderError).code : 'answered';
}

async function made(over: Partial<CheckoutInput> = {}): Promise<string> {
  const answer = await provider().createCheckout(input(over));
  if (answer.ok !== true) throw new Error(`no checkout: ${(answer as ProviderError).providerMessage}`);
  return answer.ref;
}

beforeEach(() => {
  forgetPaypalCaches();
  clock = START;
  paypal = createFakePaypal({ now, clientId: credentials.client_id, clientSecret: credentials.client_secret, certPem: chain.chainPem, signingKeyPem: chain.leafKeyPem, merchantId: '4TQ8ZL2W7NP3A' });
});

describe('the credentials', () => {
  it('names the merchant, with an order nobody can capture', async () => {
    expect(await provider().checkCredentials()).toEqual({ ok: true, accountId: '4TQ8ZL2W7NP3A', livemode: false, missing: [] });
    const order = paypal.requests.find((one) => one.method === 'POST' && one.path === '/v2/checkout/orders')!;
    expect((order.body as { purchase_units: { custom_id: string }[] }).purchase_units[0]!.custom_id.endsWith(VOID_MARKER)).toBe(true);
  });

  it('refuses a wrong secret without repeating it', async () => {
    const answer = await createPaypalProvider({ http: paypal.http, credentials: { ...credentials, client_secret: 'EwrongSecret0000001' }, mode: 'test' }, { now, trust }).checkCredentials();
    expect(code(answer)).toBe('CREDENTIALS_REFUSED');
    expect((answer as ProviderError).providerMessage).not.toContain('EwrongSecret');
  });

  it('refuses before any call when nothing is saved', async () => {
    const never: PaymentHttpClient = async () => {
      throw new Error('no call may be made');
    };
    expect(code(await createPaypalProvider({ http: never, credentials: {}, mode: 'test' }).status('X'))).toBe('CREDENTIALS_REFUSED');
  });

  it('says so when the app may not take payments', async () => {
    paypal = createFakePaypal({ now, clientId: credentials.client_id, clientSecret: credentials.client_secret, certPem: chain.chainPem, signingKeyPem: chain.leafKeyPem, denyOrders: true });
    expect(code(await provider().checkCredentials())).toBe('PERMISSION_MISSING');
  });

  it('keeps one token across operations, and asks again for a refused one', async () => {
    await provider().checkCredentials();
    await provider().status((await made()) as string);
    expect(paypal.tokensIssued()).toBe(1);
    // A different fake has never issued that token: the transport asks again once.
    paypal = createFakePaypal({ now, clientId: credentials.client_id, clientSecret: credentials.client_secret, certPem: chain.chainPem, signingKeyPem: chain.leafKeyPem });
    expect((await provider().checkCredentials()).ok).toBe(true);
  });
});

describe('the hosts of each mode', () => {
  it('a test provider calls the sandbox only, a live one the live API only', async () => {
    const seen: string[] = [];
    const recording: PaymentHttpClient = async (url) => {
      seen.push(new URL(url).hostname);
      return { status: 401, headers: { get: () => null }, text: async () => '{}' };
    };
    await provider(recording, 'test').status('X');
    await provider(recording, 'live').status('X');
    expect([...new Set(seen)]).toEqual(['api-m.sandbox.paypal.com', 'api-m.paypal.com']);
  });

  it('refuses to send a customer to a page of the other mode', async () => {
    const wrongPage: PaymentHttpClient = async (url, init) => {
      const answer = await paypal.http(url, init);
      if (!url.endsWith('/v2/checkout/orders')) return answer;
      const body = (await answer.text()).replace('www.sandbox.paypal.com', 'www.paypal.com');
      return { status: answer.status, headers: answer.headers, text: async () => body };
    };
    expect(code(await provider(wrongPage).createCheckout(input()))).toBe('UNAVAILABLE');
  });
});

describe('the order it asks for', () => {
  it('names a plain row once when its description is its number again', async () => {
    const base = input();
    await made({ payable: { ...base.payable, reference: 'ORD-1006', description: 'ORD-1006' } });
    const sent = paypal.requests.find((one) => one.method === 'POST' && one.path === '/v2/checkout/orders')!;
    expect((sent.body as { purchase_units: { description: string }[] }).purchase_units[0]!.description).toBe('ORD-1006');
  });

  it('captures in one unit, with the attempt, the amount, PAY_NOW, no shipping and the language', async () => {
    await made();
    const sent = paypal.requests.find((one) => one.method === 'POST' && one.path === '/v2/checkout/orders')!;
    expect(sent.headers['paypal-request-id']).toBe('att_7Hq2Lm9Xr4:create');
    expect(sent.body).toEqual({
      intent: 'CAPTURE',
      purchase_units: [{ reference_id: 'default', custom_id: 'att_7Hq2Lm9Xr4', description: 'INV-0042 · Invoice for Lena Fischer', amount: { currency_code: 'EUR', value: '120.00' } }],
      payment_source: {
        paypal: {
          email_address: 'lena@example.test',
          experience_context: {
            return_url: 'https://pay.example.test/pay/return',
            cancel_url: 'https://pay.example.test/pay/cancel',
            user_action: 'PAY_NOW',
            shipping_preference: 'NO_SHIPPING',
            locale: 'ar-EG',
          },
        },
      },
    });
  });

  it('ends six hours after it was made', async () => {
    const answer = await provider().createCheckout(input());
    expect(answer).toMatchObject({ ok: true, expiresAt: clock + ORDER_LIFETIME_MS });
  });

  it('writes whole-unit currencies without decimals', async () => {
    await made({ payable: { ...input().payable, amount: '12000', currency: 'JPY' }, idempotencyKey: 'jpy:create' });
    const sent = paypal.requests.filter((one) => one.method === 'POST' && one.path === '/v2/checkout/orders').at(-1)!;
    expect((sent.body as { purchase_units: { amount: unknown }[] }).purchase_units[0]!.amount).toEqual({ currency_code: 'JPY', value: '12000' });
  });

  it('refuses what PayPal cannot take, before any call', async () => {
    expect(code(await provider().createCheckout(input({ payable: { ...input().payable, amount: '45.250', currency: 'KWD' } })))).toBe('CURRENCY_UNSUPPORTED');
    expect(code(await provider().createCheckout(input({ payable: { ...input().payable, amount: '10.45', currency: 'HUF' } })))).toBe('AMOUNT_UNREPRESENTABLE');
    expect(code(await provider().createCheckout(input({ methods: ['card'] })))).toBe('INVALID_REQUEST');
    expect(paypal.requests).toEqual([]);
  });
});

describe('the two steps', () => {
  it('captures nothing before the customer approves', async () => {
    const ref = await made();
    expect(await provider().complete(ref, `${ref}:capture`)).toMatchObject({ status: 'pending', amount: null });
    expect(paypal.requests.some((one) => one.path.endsWith('/capture'))).toBe(false);
  });

  it('captures once when two callers complete at the same moment', async () => {
    const ref = await made();
    paypal.approve(ref);
    const [a, b] = await Promise.all([provider().complete(ref, `${ref}:capture`), provider().complete(ref, `${ref}:capture-b`)]);
    expect([a, b].map((one) => (one.ok ? one.status : one.code))).toEqual(['succeeded', 'succeeded']);
    expect(paypal.events().filter((one) => one.type === 'PAYMENT.CAPTURE.COMPLETED')).toHaveLength(1);
  });

  it('reads a declined funding source as failed, and nothing taken', async () => {
    const ref = await made();
    paypal.approve(ref);
    paypal.declineNextCapture(ref);
    expect(await provider().complete(ref, `${ref}:capture`)).toMatchObject({ status: 'failed', amount: null, paymentRef: null });
  });

  it('reads a held capture as processing, with the reason in words', async () => {
    const ref = await made();
    paypal.approve(ref, 'PENDING');
    expect(await provider().complete(ref, `${ref}:capture`)).toMatchObject({
      status: 'processing',
      amount: '120.00',
      paidWith: { method: 'paypal', label: 'PayPal', delayed: true },
      failureMessage: 'The customer paid with an eCheck, which has not cleared yet.',
    });
  });

  it('never captures an order it ended, even if the customer approves it afterwards', async () => {
    const ref = await made();
    expect(await provider().expire(ref)).toEqual({ ok: true, ref, status: 'expired' });
    paypal.approve(ref);
    expect(await provider().complete(ref, `${ref}:capture`)).toMatchObject({ status: 'expired', amount: null });
    expect(paypal.requests.some((one) => one.path.endsWith('/capture'))).toBe(false);
  });

  it('reads an order past six hours as ended, and does not capture it', async () => {
    const ref = await made();
    paypal.approve(ref);
    clock += ORDER_LIFETIME_MS + 1000;
    expect(await provider().complete(ref, `${ref}:capture`)).toMatchObject({ status: 'expired' });
  });
});

describe('refunds', () => {
  it('names the capture it refunded, read back from PayPal', async () => {
    const ref = await made();
    paypal.approve(ref);
    const state = await provider().complete(ref, `${ref}:capture`);
    if (state.ok !== true || state.paymentRef === null) throw new Error('not paid');
    const refund = await provider().refund({ paymentRef: state.paymentRef, amount: '20.00', currency: 'EUR', reason: 'requested_by_customer', idempotencyKey: 'rf-1' });
    if (refund.ok !== true) throw new Error('no refund');
    expect(await provider().refundStatus(refund.ref)).toMatchObject({ status: 'succeeded', amount: '20.00', currency: 'EUR', paymentRef: state.paymentRef });
    const sent = paypal.requests.find((one) => one.path.endsWith('/refund'))!;
    expect(sent.headers['paypal-request-id']).toBe('rf-1');
    expect(sent.body).toEqual({ amount: { currency_code: 'EUR', value: '20.00' } });
  });
});

describe('how PayPal refusals read', () => {
  /** A client that hands out a token, then answers every call with one status and body. */
  function answering(status: number, body: unknown): PaymentHttpClient {
    return async (url) => {
      if (url.endsWith('/v1/oauth2/token')) return { status: 200, headers: { get: () => null }, text: async () => JSON.stringify({ access_token: 'A21AAsecretToken123', expires_in: 3600 }) };
      return { status, headers: { get: () => null }, text: async () => JSON.stringify(body) };
    };
  }
  const issue = (name: string, code: string) => ({ name, message: 'm', details: [{ issue: code, description: 'd' }] });

  it('turns them into the contract codes', async () => {
    expect(code(await provider(answering(403, issue('NOT_AUTHORIZED', 'PERMISSION_DENIED'))).status('X'))).toBe('PERMISSION_MISSING');
    expect(code(await provider(answering(404, issue('RESOURCE_NOT_FOUND', 'INVALID_RESOURCE_ID'))).status('X'))).toBe('NOT_FOUND');
    expect(code(await provider(answering(422, issue('UNPROCESSABLE_ENTITY', 'CURRENCY_NOT_SUPPORTED'))).status('X'))).toBe('CURRENCY_UNSUPPORTED');
    expect(code(await provider(answering(422, issue('UNPROCESSABLE_ENTITY', 'SOMETHING'))).status('X'))).toBe('INVALID_REQUEST');
    expect(code(await provider(answering(429, issue('RATE_LIMIT_REACHED', 'X'))).status('X'))).toBe('RATE_LIMITED');
    expect(code(await provider(answering(503, issue('SERVICE_UNAVAILABLE', 'X'))).status('X'))).toBe('UNAVAILABLE');
    const refund = await provider(answering(422, issue('UNPROCESSABLE_ENTITY', 'REFUND_TIME_LIMIT_EXCEEDED'))).refund({ paymentRef: 'C', amount: '1.00', currency: 'EUR', reason: 'other', idempotencyKey: 'k' });
    expect(code(refund)).toBe('REFUND_REFUSED');
  });

  it('takes the secret and the token out of PayPal words', async () => {
    const answer = await provider(answering(400, { name: 'INVALID_REQUEST', message: `bad ${credentials.client_secret} Bearer A21AAsecretToken123 A21AAotherToken` })).status('X');
    const message = (answer as ProviderError).providerMessage;
    expect(message).not.toContain(credentials.client_secret);
    expect(message).not.toContain('A21AA');
  });
});

describe('webhooks', () => {
  async function paidDelivery() {
    const ref = await made();
    paypal.approve(ref);
    await provider().complete(ref, `${ref}:capture`);
    return { ref, delivery: paypal.latestDelivery(ref, credentials.webhook_id)! };
  }

  it('reads a capture event with its order and its capture', async () => {
    const { ref, delivery } = await paidDelivery();
    expect(await provider().verifyWebhook(delivery)).toMatchObject({ ok: true, type: 'PAYMENT.CAPTURE.COMPLETED', kind: 'checkout', checkoutRef: ref, livemode: false });
  });

  it('reads a refund event with the capture it refunded', async () => {
    const { ref } = await paidDelivery();
    const state = await provider().status(ref);
    if (state.ok !== true || state.paymentRef === null) throw new Error('not paid');
    await provider().refund({ paymentRef: state.paymentRef, amount: '120.00', currency: 'EUR', reason: 'other', idempotencyKey: 'rf-all' });
    const refundEvent = paypal.events().find((one) => one.type === 'PAYMENT.CAPTURE.REFUNDED')!;
    expect(await provider().verifyWebhook(paypal.deliveryFor(refundEvent.id, credentials.webhook_id))).toMatchObject({ kind: 'refund', paymentRef: state.paymentRef });
  });

  it('refuses a certificate from anywhere but the pinned hosts', async () => {
    const { delivery } = await paidDelivery();
    for (const certUrl of ['https://evil.example/cert.pem', 'http://api.sandbox.paypal.com/cert', 'https://api.sandbox.paypal.com:8443/cert', 'https://api.paypal.com/cert']) {
      const answer = await provider().verifyWebhook({ ...delivery, headers: { ...delivery.headers, 'paypal-cert-url': certUrl } });
      expect(code(answer), certUrl).toBe('SIGNATURE_INVALID');
    }
  });

  it('refuses a certificate that is not rooted in a trusted root', async () => {
    const { ref } = await paidDelivery();
    const event = [...paypal.events()].reverse().find((one) => one.type === 'PAYMENT.CAPTURE.COMPLETED')!;
    const rogueUrl = 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-rogue';
    const serving: PaymentHttpClient = async (url, init) =>
      url === rogueUrl ? { status: 200, headers: { get: () => null }, text: async () => chain.rogueChainPem } : paypal.http(url, init);
    const forged = paypal.deliveryFor(event.id, credentials.webhook_id, { certUrl: rogueUrl, keyPem: chain.rogueKeyPem });
    expect(code(await provider(serving).verifyWebhook(forged))).toBe('SIGNATURE_INVALID');
    expect(ref).toBeTruthy();
  });

  it('completes a leaf served alone from a pinned intermediate, never from an address, and refuses it with none pinned', async () => {
    const { delivery } = await paidDelivery();
    const fetched: string[] = [];
    const leafOnly: PaymentHttpClient = async (url, init) => {
      fetched.push(url);
      return url === FAKE_CERT_URL ? { status: 200, headers: { get: () => null }, text: async () => chain.leafPem } : paypal.http(url, init);
    };
    const pinned = { anchors: [new X509Certificate(chain.rootPem)], intermediates: [new X509Certificate(chain.intermediatePem)] };
    const withPin = createPaypalProvider({ http: leafOnly, credentials, mode: 'test' }, { now, trust: pinned });
    expect(await withPin.verifyWebhook(delivery)).toMatchObject({ ok: true, kind: 'checkout' });
    expect(fetched).toEqual([FAKE_CERT_URL]);
    forgetPaypalCaches();
    const answer = await provider(leafOnly).verifyWebhook(delivery);
    expect(answer).toMatchObject({ ok: false, code: 'SIGNATURE_INVALID', providerMessage: 'The certificate chain does not end in a trusted root.' });
    // A pinned intermediate that does not itself hang from a trusted root completes nothing.
    forgetPaypalCaches();
    const unrooted = createPaypalProvider({ http: leafOnly, credentials, mode: 'test' }, { now, trust: { anchors: [new X509Certificate(chain.rogueChainPem)], intermediates: pinned.intermediates } });
    expect(code(await unrooted.verifyWebhook(delivery))).toBe('SIGNATURE_INVALID');
  });

  it('refuses a certificate outside its dates', async () => {
    const { delivery } = await paidDelivery();
    clock = Date.UTC(2040, 0, 1);
    expect(code(await provider().verifyWebhook(delivery))).toBe('SIGNATURE_INVALID');
  });

  it('refuses another signing method, another webhook, and an unsigned delivery', async () => {
    const { delivery } = await paidDelivery();
    expect(code(await provider().verifyWebhook({ ...delivery, headers: { ...delivery.headers, 'paypal-auth-algo': 'SHA1withRSA' } }))).toBe('SIGNATURE_INVALID');
    const other = createPaypalProvider({ http: paypal.http, credentials: { ...credentials, webhook_id: 'ANOTHERWEBHOOK00' }, mode: 'test' }, { now, trust });
    expect(code(await other.verifyWebhook(delivery))).toBe('SIGNATURE_INVALID');
    expect(code(await provider().verifyWebhook({ rawBody: delivery.rawBody, headers: {} }))).toBe('SIGNATURE_INVALID');
  });

  it('takes a simulator event (signed for WEBHOOK_ID) in test mode only', async () => {
    const ref = await made();
    paypal.approve(ref);
    const approved = paypal.events().find((one) => one.type === 'CHECKOUT.ORDER.APPROVED')!;
    const simulated = paypal.deliveryFor(approved.id, 'WEBHOOK_ID');
    expect(await provider().verifyWebhook(simulated)).toMatchObject({ ok: true, kind: 'checkout', checkoutRef: ref });
    const liveUrl = 'https://api.paypal.com/v1/notifications/certs/CERT-live';
    const serving: PaymentHttpClient = async (url, init) =>
      url === liveUrl ? { status: 200, headers: { get: () => null }, text: async () => chain.chainPem } : paypal.http(url, init);
    const live = createPaypalProvider({ http: serving, credentials, mode: 'live' }, { now, trust });
    expect(code(await live.verifyWebhook(paypal.deliveryFor(approved.id, 'WEBHOOK_ID', { certUrl: liveUrl })))).toBe('SIGNATURE_INVALID');
    expect(await live.verifyWebhook(paypal.deliveryFor(approved.id, credentials.webhook_id, { certUrl: liveUrl }))).toMatchObject({ ok: true, livemode: true });
    expect(FAKE_CERT_URL).toContain('api.sandbox.paypal.com');
  });
});

describe('disputes', () => {
  async function capture(): Promise<string> {
    const ref = await made();
    paypal.approve(ref);
    const state = await provider().complete(ref, `${ref}:capture`);
    if (state.ok !== true || state.paymentRef === null) throw new Error('not paid');
    return state.paymentRef;
  }

  /** A `CUSTOMER.DISPUTE.*` resource as PayPal sends it (Disputes API v1 `dispute`). */
  const disputeResource = (captureId: string, extra: Record<string, unknown> = {}) => ({
    dispute_id: 'PP-D-27803',
    create_time: '2026-10-22T11:21:00.000Z',
    update_time: '2026-10-22T11:21:00.000Z',
    disputed_transactions: [{ buyer_transaction_id: '3BC38643YC807283D', seller_transaction_id: captureId, transaction_status: 'COMPLETED', gross_amount: { currency_code: 'EUR', value: '120.00' } }],
    reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
    status: 'OPEN',
    dispute_amount: { currency_code: 'EUR', value: '120.00' },
    dispute_life_cycle_stage: 'CHARGEBACK',
    ...extra,
  });

  const verified = (eventId: string) => provider().verifyWebhook(paypal.deliveryFor(eventId, credentials.webhook_id));

  it('names the capture a dispute is about, not the dispute, and reads it as open', async () => {
    const captureId = await capture();
    for (const type of ['CUSTOMER.DISPUTE.CREATED', 'CUSTOMER.DISPUTE.UPDATED']) {
      const answer = await verified(paypal.raise(type, 'dispute', disputeResource(captureId)));
      expect(answer).toMatchObject({ ok: true, type, kind: 'dispute', paymentRef: captureId, checkoutRef: null, dispute: { status: 'open', amount: '120.00', currency: 'EUR' } });
    }
  });

  it('reads how a resolved dispute ended for the seller', async () => {
    const captureId = await capture();
    const outcomes: [string | null, string][] = [
      ['RESOLVED_BUYER_FAVOUR', 'lost'],
      ['ACCEPTED', 'lost'],
      ['RESOLVED_SELLER_FAVOUR', 'won'],
      ['CANCELED_BY_BUYER', 'won'],
      ['DENIED', 'won'],
      ['RESOLVED_WITH_PAYOUT', 'closed'],
      ['NONE', 'closed'],
      ['SOMETHING_NEW', 'closed'],
      [null, 'closed'],
    ];
    for (const [outcome, status] of outcomes) {
      const resource = disputeResource(captureId, { status: 'RESOLVED', ...(outcome === null ? {} : { dispute_outcome: { outcome_code: outcome } }) });
      const answer = await verified(paypal.raise('CUSTOMER.DISPUTE.RESOLVED', 'dispute', resource));
      expect(answer, String(outcome)).toMatchObject({ ok: true, kind: 'dispute', paymentRef: captureId, dispute: { status, amount: '120.00', currency: 'EUR' } });
    }
  });

  it('takes what went back to the customer for a lost dispute, when PayPal says it', async () => {
    const captureId = await capture();
    const resource = disputeResource(captureId, { status: 'RESOLVED', dispute_outcome: { outcome_code: 'RESOLVED_BUYER_FAVOUR', amount_refunded: { currency_code: 'EUR', value: '45.5' } } });
    expect(await verified(paypal.raise('CUSTOMER.DISPUTE.RESOLVED', 'dispute', resource))).toMatchObject({ dispute: { status: 'lost', amount: '45.50', currency: 'EUR' } });
  });

  it('reads a reversed capture as a lost dispute over the capture amount', async () => {
    const captureId = await capture();
    const resource = { id: captureId, status: 'REVERSED', amount: { currency_code: 'EUR', value: '120.00' } };
    expect(await verified(paypal.raise('PAYMENT.CAPTURE.REVERSED', 'capture', resource))).toMatchObject({
      ok: true,
      kind: 'dispute',
      paymentRef: captureId,
      dispute: { status: 'lost', amount: '120.00', currency: 'EUR' },
    });
  });

  it('carries no dispute on any other event, and nulls for an amount it cannot read', async () => {
    const captureId = await capture();
    const completed = paypal.events().find((one) => one.type === 'PAYMENT.CAPTURE.COMPLETED')!;
    expect(await verified(completed.id)).not.toHaveProperty('dispute');
    const resource = disputeResource(captureId, { dispute_amount: { currency_code: 'XYZ', value: 'lots' } });
    expect(await verified(paypal.raise('CUSTOMER.DISPUTE.CREATED', 'dispute', resource))).toMatchObject({ dispute: { status: 'open', amount: null, currency: null } });
  });

  it('asks for the dispute events and a declined capture', () => {
    expect(LISTENED_EVENTS).toEqual(expect.arrayContaining(['PAYMENT.CAPTURE.DECLINED', 'CUSTOMER.DISPUTE.CREATED', 'CUSTOMER.DISPUTE.UPDATED', 'CUSTOMER.DISPUTE.RESOLVED']));
  });
});

describe('the sweep', () => {
  it('moves forward through events that share a second, repeating none', async () => {
    const a = await made({ attemptId: 'a', idempotencyKey: 'a:create' });
    paypal.approve(a);
    await provider().complete(a, 'a:capture');
    const first = await provider().listMissedEvents(null);
    if (first.ok !== true) throw new Error('no events');
    expect(first.events.map((one) => one.type)).toEqual(['CHECKOUT.ORDER.APPROVED', 'PAYMENT.CAPTURE.COMPLETED']);
    const b = await made({ attemptId: 'b', idempotencyKey: 'b:create' });
    paypal.approve(b);
    const second = await provider().listMissedEvents(first.cursor);
    if (second.ok !== true) throw new Error('no events');
    expect(second.events.map((one) => one.checkoutRef)).toEqual([b]);
    clock += 5000;
    await provider().complete(b, 'b:capture');
    const third = await provider().listMissedEvents(second.cursor);
    if (third.ok !== true) throw new Error('no events');
    expect(third.events.map((one) => one.type)).toEqual(['PAYMENT.CAPTURE.COMPLETED']);
  });
});

describe('the currency table', () => {
  it.each([
    ['120.50', 'EUR', '12050'],
    ['12000', 'JPY', '12000'],
    ['10', 'HUF', '10'],
    ['500', 'TWD', '500'],
  ])('%s %s → %s', (amount, currency, minor) => {
    expect(paypalMinor(amount, currency)).toEqual({ minor, currency });
  });

  it('takes the 24 PayPal currencies and nothing else', () => {
    expect(code(paypalMinor('1.00', 'ZAR'))).toBe('CURRENCY_UNSUPPORTED');
    expect(code(paypalMinor('1.00', 'KWD'))).toBe('CURRENCY_UNSUPPORTED');
    expect(paypalValue('120', 'EUR')).toEqual({ value: '120.00', currency: 'EUR' });
  });

  it('checks a body with the CRC-32 PayPal names', () => {
    expect(crc32('123456789')).toBe(0xcbf43926);
  });
});
