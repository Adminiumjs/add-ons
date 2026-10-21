/**
 * What the shared suite cannot say about Stripe in particular: the key rules,
 * the session this add-on asks for, how Stripe's refusals read, and the
 * permission check.
 */
import { describe, expect, it } from 'vitest';

import type { PaymentHttpClient, ProviderError } from '@adminium/add-on-host/contracts';

import { stripeDecimal, stripeMinor } from './currency.ts';
import { createFakeStripe } from './testing/fake-stripe.ts';
import { createStripeProvider } from './transport.ts';
import { PERMISSION_PROBES, STRIPE_API_VERSION } from './wire.ts';

const KEY = 'rk_test_unitcase000001';
const SECRET = 'whsec_unitcase0000000001';
const payable = {
  reference: 'INV-0042',
  description: 'Invoice INV-0042 for Lena Fischer',
  amount: '120.00',
  currency: 'EUR',
  customerEmail: 'lena@example.test',
  locale: 'ar-EG',
};

function provider(http: PaymentHttpClient, overrides: Partial<{ key: string; mode: 'test' | 'live'; now: () => number }> = {}) {
  return createStripeProvider(
    { http, credentials: { secret_key: overrides.key ?? KEY, webhook_secret: SECRET }, mode: overrides.mode ?? 'test' },
    overrides.now === undefined ? {} : { now: overrides.now },
  );
}

function code(answer: unknown): string {
  return (answer as ProviderError).ok === false ? (answer as ProviderError).code : 'answered';
}

/** A client that answers every call with one status and body. */
function answering(status: number, body: unknown): PaymentHttpClient {
  return async () => ({ status, headers: { get: () => 'application/json' }, text: async () => JSON.stringify(body) });
}

const neverCalled: PaymentHttpClient = async () => {
  throw new Error('no call may be made');
};

describe('the key', () => {
  it('refuses a secret key before any call', async () => {
    const answer = await provider(neverCalled, { key: 'sk_test_abcdefghijklmnop' }).checkCredentials();
    expect(code(answer)).toBe('CREDENTIALS_REFUSED');
    expect((answer as ProviderError).providerMessage).not.toContain('abcdefghijklmnop');
  });

  it('refuses a key of the other mode before any call', async () => {
    expect(code(await provider(neverCalled, { key: 'rk_test_abcdefghijklmnop', mode: 'live' }).status('cs_x'))).toBe('MODE_MISMATCH');
    expect(code(await provider(neverCalled, { key: 'rk_live_abcdefghijklmnop' }).status('cs_x'))).toBe('MODE_MISMATCH');
  });

  it('refuses something that is not a key', async () => {
    expect(code(await provider(neverCalled, { key: 'hello' }).status('cs_x'))).toBe('CREDENTIALS_REFUSED');
  });

  it('sends the key, the pinned API version and nothing else that names it', async () => {
    const stripe = createFakeStripe();
    await provider(stripe.http).methodsFor({ country: null, currency: 'EUR', amount: '1.00' });
    const headers = stripe.requests[0]!.headers;
    expect(headers['authorization']).toBe(`Bearer ${KEY}`);
    expect(headers['stripe-version']).toBe(STRIPE_API_VERSION);
  });

  it('takes an answer for the other mode as a mismatch', async () => {
    expect(code(await provider(answering(200, { id: 'cs_1', livemode: true })).status('cs_1'))).toBe('MODE_MISMATCH');
  });
});

describe('the checkout it asks for', () => {
  it('pins the amount, the attempt, one hour, the extras off and the language', async () => {
    const at = Date.UTC(2026, 9, 21, 10, 0, 0);
    const stripe = createFakeStripe({ now: () => at });
    const made = await provider(stripe.http, { now: () => at }).createCheckout({
      payable,
      methods: ['card', 'link'],
      successUrl: 'https://pay.example.test/pay/r',
      cancelUrl: 'https://pay.example.test/pay/c',
      attemptId: 'att_7Hq2Lm9Xr4',
      idempotencyKey: 'att_7Hq2Lm9Xr4:create',
    });
    expect(code(made)).toBe('answered');
    const sent = stripe.requests.find((one) => one.method === 'POST' && one.path === '/v1/checkout/sessions')!;
    expect(sent.headers['idempotency-key']).toBe('att_7Hq2Lm9Xr4:create');
    expect(sent.params).toMatchObject({
      mode: 'payment',
      ui_mode: 'hosted_page',
      line_items: [{ quantity: '1', price_data: { currency: 'eur', unit_amount: '12000', product_data: { name: 'INV-0042' } } }],
      client_reference_id: 'att_7Hq2Lm9Xr4',
      metadata: { attempt: 'att_7Hq2Lm9Xr4' },
      payment_intent_data: { metadata: { attempt: 'att_7Hq2Lm9Xr4' } },
      expires_at: String(at / 1000 + 3600),
      locale: 'auto',
      customer_email: 'lena@example.test',
      adaptive_pricing: { enabled: 'false' },
      automatic_tax: { enabled: 'false' },
      allow_promotion_codes: 'false',
      payment_method_configuration: 'pmc_test_default',
    });
  });

  it('leaves out every switched-on way the rules do not allow, PayPal included', async () => {
    const stripe = createFakeStripe({ enabled: ['card', 'link', 'sepa_debit', 'klarna', 'paypal', 'apple_pay'] });
    await provider(stripe.http).createCheckout({
      payable,
      methods: ['card', 'link', 'apple_pay'],
      successUrl: 'https://pay.example.test/pay/r',
      cancelUrl: 'https://pay.example.test/pay/c',
      attemptId: 'att_1',
      idempotencyKey: 'att_1:create',
    });
    const sent = stripe.requests.find((one) => one.method === 'POST' && one.path === '/v1/checkout/sessions')!;
    expect(sent.params['excluded_payment_method_types']).toEqual(['sepa_debit', 'klarna', 'paypal']);
  });

  it('refuses a checkout no way to pay is allowed for', async () => {
    const answer = await provider(neverCalled).createCheckout({
      payable,
      methods: [],
      successUrl: 'https://x.test/r',
      cancelUrl: 'https://x.test/c',
      attemptId: 'a',
      idempotencyKey: 'k',
    });
    expect(code(answer)).toBe('INVALID_REQUEST');
  });

  it('refuses a held currency before any call', async () => {
    const answer = await provider(neverCalled).createCheckout({
      payable: { ...payable, amount: '45.250', currency: 'KWD' },
      methods: ['card'],
      successUrl: 'https://x.test/r',
      cancelUrl: 'https://x.test/c',
      attemptId: 'a',
      idempotencyKey: 'k',
    });
    expect(code(answer)).toBe('CURRENCY_UNSUPPORTED');
  });
});

describe('how Stripe reads', () => {
  it('names the card that paid, never its number', async () => {
    const stripe = createFakeStripe();
    const p = provider(stripe.http);
    const made = await p.createCheckout({ payable, methods: ['card'], successUrl: 'https://x.test/r', cancelUrl: 'https://x.test/c', attemptId: 'a1', idempotencyKey: 'a1:create' });
    if (made.ok !== true) throw new Error('no checkout');
    stripe.pay(made.ref, 'succeeds');
    const state = await p.status(made.ref);
    expect(state).toMatchObject({ status: 'succeeded', amount: '120.00', currency: 'EUR', paidWith: { method: 'card', label: 'Visa ••4242', delayed: false } });
  });

  it('reads a decline as failed with the reason, and nothing taken', async () => {
    const stripe = createFakeStripe();
    const p = provider(stripe.http);
    const made = await p.createCheckout({ payable, methods: ['card'], successUrl: 'https://x.test/r', cancelUrl: 'https://x.test/c', attemptId: 'a2', idempotencyKey: 'a2:create' });
    if (made.ok !== true) throw new Error('no checkout');
    stripe.pay(made.ref, 'fails');
    expect(await p.status(made.ref)).toMatchObject({ status: 'failed', amount: null, failureMessage: 'Your card was declined.' });
  });

  it('reads a refund made in the Stripe dashboard', async () => {
    const stripe = createFakeStripe();
    const p = provider(stripe.http);
    const made = await p.createCheckout({ payable, methods: ['card'], successUrl: 'https://x.test/r', cancelUrl: 'https://x.test/c', attemptId: 'a3', idempotencyKey: 'a3:create' });
    if (made.ok !== true) throw new Error('no checkout');
    stripe.pay(made.ref, 'succeeds');
    const state = await p.status(made.ref);
    if (state.ok !== true || state.paymentRef === null) throw new Error('not paid');
    const refundId = stripe.refundInDashboard(state.paymentRef, 2000);
    expect(await p.refundStatus(refundId)).toMatchObject({ status: 'succeeded', amount: '20.00', currency: 'EUR', paymentRef: state.paymentRef });
    const missed = await p.listMissedEvents(null);
    if (missed.ok !== true) throw new Error('no events');
    expect(missed.events.find((one) => one.refundRef === refundId)).toMatchObject({ kind: 'refund', paymentRef: state.paymentRef });
  });

  it('turns Stripe refusals into the contract codes', async () => {
    const error = (status: number, extra: Record<string, unknown> = {}) => answering(status, { error: { type: 'invalid_request_error', message: 'm', ...extra } });
    expect(code(await provider(error(401)).status('cs_1'))).toBe('CREDENTIALS_REFUSED');
    expect(code(await provider(error(403)).status('cs_1'))).toBe('PERMISSION_MISSING');
    expect(code(await provider(error(404, { code: 'resource_missing' })).status('cs_1'))).toBe('NOT_FOUND');
    expect(code(await provider(error(429)).status('cs_1'))).toBe('RATE_LIMITED');
    expect(code(await provider(error(500)).status('cs_1'))).toBe('UNAVAILABLE');
    expect(code(await provider(error(400, { param: 'line_items[0][price_data][currency]' })).status('cs_1'))).toBe('CURRENCY_UNSUPPORTED');
    const refund = await provider(error(400, { param: 'amount' })).refund({ paymentRef: 'pi_1', amount: '1.00', currency: 'EUR', reason: 'other', idempotencyKey: 'k' });
    expect(code(refund)).toBe('REFUND_REFUSED');
    const retry = await provider(error(503)).status('cs_1');
    expect((retry as ProviderError).retryable).toBe(true);
  });

  it('takes every key-shaped string out of Stripe words', async () => {
    const answer = await provider(answering(401, { error: { message: `Invalid API Key provided: ${KEY} and rk_live_9999XYZ, ${SECRET}` } })).status('cs_1');
    const message = (answer as ProviderError).providerMessage;
    expect(message).not.toContain(KEY);
    expect(message).not.toContain('rk_live_');
    expect(message).not.toContain('whsec_');
  });

  it('reads an unreachable Stripe as retryable', async () => {
    const answer = await provider(async () => {
      throw new Error('ECONNRESET');
    }).status('cs_1');
    expect(answer).toMatchObject({ ok: false, code: 'UNAVAILABLE', retryable: true });
  });
});

describe('the permission check', () => {
  it('names the account and nothing missing for a complete key', async () => {
    expect(await provider(createFakeStripe({ accountId: 'acct_1Q2w3E4r' }).http).checkCredentials()).toEqual({
      ok: true,
      accountId: 'acct_1Q2w3E4r',
      livemode: false,
      missing: [],
    });
  });

  it('names each missing permission in the Stripe dashboard words, and creates nothing', async () => {
    const stripe = createFakeStripe({ missing: ['Charges and Refunds: write', 'Events: read', 'Webhook endpoints: read'] });
    const answer = await provider(stripe.http).checkCredentials();
    expect(answer).toMatchObject({ ok: true, missing: ['Charges and Refunds: write', 'Events: read'] });
    expect(stripe.events()).toEqual([]);
  });

  it('cannot name the account without Accounts: read, and says so', async () => {
    const answer = await provider(createFakeStripe({ missing: ['Accounts: read', 'Disputes: read'] }).http).checkCredentials();
    expect(code(answer)).toBe('PERMISSION_MISSING');
    expect((answer as ProviderError).providerMessage).toContain('Disputes: read, Accounts: read');
  });

  it('probes every permission the guide lists', () => {
    expect(PERMISSION_PROBES.map((one) => one.name)).toEqual([
      'Checkout Sessions: write',
      'Checkout Sessions: read',
      'PaymentIntents: read',
      'Charges and Refunds: write',
      'Events: read',
      'Disputes: read',
      'Payment Method Configurations: read',
      'Webhook endpoints: read',
    ]);
  });
});

describe('webhooks', () => {
  it('refuses a signature older than five minutes', async () => {
    const at = Date.UTC(2026, 9, 21, 10, 0, 0);
    const stripe = createFakeStripe({ now: () => at });
    const p = provider(stripe.http, { now: () => at });
    const made = await p.createCheckout({ payable, methods: ['card'], successUrl: 'https://x.test/r', cancelUrl: 'https://x.test/c', attemptId: 'w1', idempotencyKey: 'w1:create' });
    if (made.ok !== true) throw new Error('no checkout');
    stripe.pay(made.ref, 'succeeds');
    const delivery = await stripe.latestDelivery(made.ref, SECRET);
    expect(code(await provider(stripe.http, { now: () => at + 4 * 60_000 }).verifyWebhook(delivery!))).toBe('answered');
    expect(code(await provider(stripe.http, { now: () => at + 6 * 60_000 }).verifyWebhook(delivery!))).toBe('SIGNATURE_INVALID');
  });

  it('accepts any of several signatures while a secret is being rolled', async () => {
    const at = Date.UTC(2026, 9, 21, 10, 0, 0);
    const stripe = createFakeStripe({ now: () => at });
    const p = provider(stripe.http, { now: () => at });
    const made = await p.createCheckout({ payable, methods: ['card'], successUrl: 'https://x.test/r', cancelUrl: 'https://x.test/c', attemptId: 'w2', idempotencyKey: 'w2:create' });
    if (made.ok !== true) throw new Error('no checkout');
    stripe.pay(made.ref, 'succeeds');
    const delivery = (await stripe.latestDelivery(made.ref, SECRET))!;
    const header = delivery.headers['stripe-signature']!;
    const rolled = header.replace('v1=', `v1=${'0'.repeat(64)},v1=`);
    expect(code(await p.verifyWebhook({ ...delivery, headers: { 'stripe-signature': rolled } }))).toBe('answered');
  });
});

describe('the currency table', () => {
  it.each([
    ['120.50', 'EUR', '12050'],
    ['12000', 'JPY', '12000'],
    ['1200', 'ISK', '120000'],
    ['10.45', 'HUF', '1045'],
    ['10.45', 'TWD', '1045'],
    ['5000', 'MGA', '5000'],
  ])('%s %s → %s', (amount, currency, minor) => {
    expect(stripeMinor(amount, currency)).toEqual({ minor, currency });
  });

  it.each(['BHD', 'JOD', 'KWD', 'OMR', 'TND', 'UGX'])('holds %s', (currency) => {
    expect(code(stripeMinor('1', currency))).toBe('CURRENCY_UNSUPPORTED');
    expect(code(stripeDecimal('1000', currency))).toBe('CURRENCY_UNSUPPORTED');
  });

  it('refuses more than Stripe takes in one payment', () => {
    expect(code(stripeMinor('1000000.00', 'EUR'))).toBe('AMOUNT_UNREPRESENTABLE');
    expect(stripeMinor('999999.99', 'EUR')).toEqual({ minor: '99999999', currency: 'EUR' });
  });

  it('reads Stripe lower-case codes back', () => {
    expect(stripeDecimal('120000', 'isk')).toBe('1200.00');
    expect(stripeDecimal('12050', 'eur')).toBe('120.50');
  });
});
