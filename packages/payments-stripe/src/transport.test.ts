/**
 * What the shared suite cannot say about Stripe in particular: the key rules,
 * the session this add-on asks for, how Stripe's refusals read, and the
 * permission check.
 */
import { describe, expect, it } from 'vitest';

import type { PaymentHttpClient, ProviderError } from '@adminium/add-on-host/contracts';

import { stripeDecimal, stripeMinor } from './currency.ts';
import { signStripeWebhook } from './signature.ts';
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
    const stripe = createFakeStripe({ missing: ['Charges and Refunds: write', 'Events: read', 'Webhook Endpoints, Event Destinations: read'] });
    const answer = await provider(stripe.http).checkCredentials();
    expect(answer).toMatchObject({ ok: true, missing: ['Charges and Refunds: write', 'Events: read'] });
    expect(stripe.events()).toEqual([]);
  });

  it('sees a missing WRITE permission, which a lookup of a made-up object hid', async () => {
    for (const write of ['Charges and Refunds: write', 'Checkout Sessions: write']) {
      const stripe = createFakeStripe({ missing: [write] });
      expect(await provider(stripe.http).checkCredentials(), write).toMatchObject({ ok: true, missing: [write] });
      expect(stripe.events()).toEqual([]);
    }
  });

  it('probes a write with a POST of no parameter at all, so nothing is looked up or made', async () => {
    const stripe = createFakeStripe();
    await provider(stripe.http).checkCredentials();
    const posts = stripe.requests.filter((one) => one.method === 'POST');
    expect(posts.map((one) => one.path).sort()).toEqual(['/v1/checkout/sessions', '/v1/refunds']);
    expect(posts.map((one) => one.params)).toEqual([{}, {}]);
    expect(stripe.events()).toEqual([]);
  });

  it('reads the answers of a probe: 400 without a permission code is allowed, the permission code is missing whatever the status', async () => {
    const answeringFor = (writes: { status: number; body: unknown }): PaymentHttpClient => async (url, init) => {
      const path = new URL(url).pathname;
      const reply = init?.method === 'POST' ? writes : path === '/v1/account' ? { status: 200, body: { id: 'acct_1', object: 'account' } } : { status: 200, body: { object: 'list', data: [] } };
      return { status: reply.status, headers: { get: () => 'application/json' }, text: async () => JSON.stringify(reply.body) };
    };
    const missingParam = { status: 400, body: { error: { type: 'invalid_request_error', code: 'parameter_missing', message: 'Missing required param: mode.' } } };
    expect(await provider(answeringFor(missingParam)).checkCredentials()).toMatchObject({ ok: true, missing: [] });
    const refused = { status: 400, body: { error: { type: 'invalid_request_error', code: 'more_permissions_required', message: 'Permission denied.' } } };
    expect(await provider(answeringFor(refused)).checkCredentials()).toMatchObject({ ok: true, missing: ['Checkout Sessions: write', 'Charges and Refunds: write'] });
    const broken = { status: 500, body: { error: { type: 'api_error', message: 'Something went wrong.' } } };
    expect(code(await provider(answeringFor(broken)).checkCredentials())).toBe('UNAVAILABLE');
  });

  it('cannot name the account without Accounts: read, and says where each missing one is on the form', async () => {
    const answer = await provider(createFakeStripe({ missing: ['Accounts: read', 'Payment Disputes: read', 'Checkout Sessions: read'] }).http).checkCredentials();
    expect(code(answer)).toBe('PERMISSION_MISSING');
    expect((answer as ProviderError).providerMessage).toBe(
      'The key cannot say which Stripe account it belongs to. Give it: Checkout Sessions: read, Payment Disputes: read (under Core), Accounts: read (under Connect, In your account).',
    );
  });

  it('probes every permission the guide lists, by the names on the Stripe form', () => {
    expect(PERMISSION_PROBES.map((one) => one.name)).toEqual([
      'Checkout Sessions: write',
      'Checkout Sessions: read',
      'Payment Intents: read',
      'Charges and Refunds: write',
      'Events: read',
      'Payment Disputes: read',
      'Payment Method Configurations: read',
      'Webhook Endpoints, Event Destinations: read',
    ]);
  });
});

describe('refunds Stripe refuses', () => {
  const refundWith = (status: number, error: Record<string, unknown>) =>
    provider(answering(status, { error: { type: 'invalid_request_error', ...error } })).refund({ paymentRef: 'pi_3Q2w3E4r5T6y7U8i', amount: '20.00', currency: 'EUR', reason: 'other', idempotencyKey: 'rf-1' });

  it('says a charged-back payment went back to the customer through a dispute', async () => {
    const answer = await refundWith(400, { code: 'charge_disputed', message: 'Charge ch_3Q2w3E4r5T6y7U8i1a2b3c4d has been charged back; cannot issue a refund.' });
    expect(answer).toMatchObject({ ok: false, code: 'REFUND_REFUSED', providerMessage: 'The customer already got this money back through a dispute.' });
  });

  it('says which permission a refund needs, whatever status Stripe used', async () => {
    const message =
      "Permission denied. The provided key 'rk_test_*********abcd' does not have the required permissions for this endpoint on account 'acct_1Q2w3E4r'. Enabling Charges and Refunds Write ('charge_write') would allow this request to continue.";
    for (const status of [403, 400]) {
      expect(await refundWith(status, { code: 'more_permissions_required', message }), String(status)).toMatchObject({
        ok: false,
        code: 'PERMISSION_MISSING',
        providerMessage: 'The Stripe key may not give refunds. Give it Charges and Refunds: write, then try again.',
      });
    }
  });

  it('passes any other refusal on without addresses or Stripe ids', async () => {
    const answer = await refundWith(400, {
      code: 'charge_already_refunded',
      message: "Charge ch_3Q2w3E4r5T6y7U8i has already been refunded (see https://dashboard.stripe.com/test/payments/pi_3Q2w3E4r5T6y7U8i). Request req_AbC123dEf: https://docs.stripe.com/error-codes/charge-already-refunded",
    });
    expect(answer).toMatchObject({ ok: false, code: 'REFUND_REFUSED' });
    const words = (answer as ProviderError).providerMessage;
    expect(words).toBe('Charge has already been refunded.');
    expect(words).not.toMatch(/https?:|ch_|pi_|req_|acct_|re_/);
  });

  it('keeps Stripe words that hold nothing to take out', async () => {
    const answer = await refundWith(400, { param: 'amount', message: 'Refund amount (€9,999.99) is greater than charge amount (€30.00)' });
    expect(answer).toMatchObject({ code: 'REFUND_REFUSED', providerMessage: 'Refund amount (€9,999.99) is greater than charge amount (€30.00)' });
  });
});

describe('disputes', () => {
  const at = Date.UTC(2026, 9, 22, 11, 21, 0);
  const SECONDS = Math.floor(at / 1000);

  async function delivered(type: string, dispute: Record<string, unknown>) {
    const body = JSON.stringify({
      id: `evt_${type.replace(/\W/g, '')}${String(dispute['status'])}`,
      object: 'event',
      type,
      created: SECONDS,
      livemode: false,
      data: { object: { id: 'du_1Q2w3E4r', object: 'dispute', payment_intent: 'pi_3Q2w3E4r', charge: 'ch_3Q2w3E4r', amount: 12000, currency: 'eur', reason: 'fraudulent', ...dispute } },
    });
    const signature = await signStripeWebhook(body, SECRET, SECONDS);
    return provider(neverCalled, { now: () => at }).verifyWebhook({ rawBody: body, headers: { 'stripe-signature': signature } });
  }

  it.each([
    ['charge.dispute.created', 'needs_response', 'open'],
    ['charge.dispute.created', 'warning_needs_response', 'open'],
    ['charge.dispute.updated', 'under_review', 'open'],
    ['charge.dispute.closed', 'won', 'won'],
    ['charge.dispute.closed', 'lost', 'lost'],
    ['charge.dispute.closed', 'warning_closed', 'closed'],
    ['charge.dispute.closed', 'something_new', 'closed'],
  ])('%s with status %s reads as %s, with the amount disputed', async (type, status, outcome) => {
    expect(await delivered(type, { status })).toMatchObject({
      ok: true,
      kind: 'dispute',
      paymentRef: 'pi_3Q2w3E4r',
      dispute: { status: outcome, amount: '120.00', currency: 'EUR' },
    });
  });

  it('writes a whole-unit currency as Stripe takes it, and nulls an amount it cannot read', async () => {
    expect(await delivered('charge.dispute.closed', { status: 'lost', amount: 5000, currency: 'jpy' })).toMatchObject({ dispute: { status: 'lost', amount: '5000', currency: 'JPY' } });
    expect(await delivered('charge.dispute.created', { status: 'needs_response', amount: 'lots' })).toMatchObject({ dispute: { status: 'open', amount: null, currency: null } });
  });

  it('carries no dispute on any other event', async () => {
    const body = JSON.stringify({ id: 'evt_1', object: 'event', type: 'checkout.session.completed', created: SECONDS, livemode: false, data: { object: { id: 'cs_1', object: 'checkout.session', payment_intent: 'pi_1' } } });
    const answer = await provider(neverCalled, { now: () => at }).verifyWebhook({ rawBody: body, headers: { 'stripe-signature': await signStripeWebhook(body, SECRET, SECONDS) } });
    expect(answer).toMatchObject({ ok: true, kind: 'checkout' });
    expect(answer).not.toHaveProperty('dispute');
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
