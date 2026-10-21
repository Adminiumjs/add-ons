/**
 * EVERY REQUEST THIS ADD-ON BUILDS, CHECKED BY STRIPE'S OWN MOCK SERVER.
 *
 * stripe-mock (github.com/stripe/stripe-mock) validates each request against
 * Stripe's OpenAPI description and refuses an unknown or mistyped field with
 * "Request validation error". It keeps no state, so it cannot pay anything:
 * the contract's behaviour is proved against the fake (`transport.*.test.ts`);
 * this file proves the WIRE. It also reads stripe-mock's fixtures back, which
 * are Stripe's own example objects, through the transport's parsers.
 *
 * Runs when `STRIPE_MOCK_URL` points at a stripe-mock (CI starts one as a
 * service; locally `docker run -p 12111:12111 stripe/stripe-mock:v0.206.0`).
 * Without it the suite is skipped by name, never passed.
 */
import { describe, expect, it } from 'vitest';

import type { PaymentHttpClient } from '@adminium/add-on-host/contracts';

import { createStripeProvider } from './transport.ts';
import { LISTENED_EVENTS } from './wire.ts';

const MOCK = process.env['STRIPE_MOCK_URL'];

/** The version this suite was last run against; CI pins the same image. */
export const STRIPE_MOCK_IMAGE = 'stripe/stripe-mock:v0.206.0';

interface Seen {
  method: string;
  path: string;
  status: number;
  error: string | null;
  body: string;
}

function mockClient(seen: Seen[]): PaymentHttpClient {
  return async (url, init) => {
    const target = new URL(url);
    expect(target.origin).toBe('https://api.stripe.com');
    const response = await fetch(`${MOCK}${target.pathname}${target.search}`, {
      method: init?.method ?? 'GET',
      headers: init?.headers ?? {},
      ...(init?.body === undefined ? {} : { body: init.body }),
    });
    const text = await response.text();
    let error: string | null = null;
    if (response.status >= 400) {
      try {
        error = String((JSON.parse(text) as { error?: { message?: string } }).error?.message ?? text);
      } catch {
        error = text;
      }
    }
    seen.push({ method: init?.method ?? 'GET', path: target.pathname, status: response.status, error, body: init?.body ?? '' });
    return { status: response.status, headers: response.headers, text: async () => text };
  };
}

describe.skipIf(MOCK === undefined)(`the Stripe wire, against ${STRIPE_MOCK_IMAGE}`, () => {
  const seen: Seen[] = [];
  const provider = createStripeProvider({
    http: mockClient(seen),
    credentials: { secret_key: 'rk_test_stripemock000001', webhook_secret: 'whsec_stripemock0000001' },
    mode: 'test',
  });

  it('checks a key with requests Stripe accepts', async () => {
    const answer = await provider.checkCredentials();
    expect(answer).toMatchObject({ ok: true, livemode: false, missing: [] });
    expect((answer as { accountId: string }).accountId).toMatch(/^acct_/);
  });

  it('reads the ways to pay from a real configuration object', async () => {
    const answer = await provider.methodsFor({ country: 'DE', currency: 'EUR', amount: '120.00' });
    expect(answer.ok).toBe(true);
  });

  it('makes a checkout with every field it sends accepted', async () => {
    const answer = await provider.createCheckout({
      payable: {
        reference: 'INV-0042',
        description: 'Invoice INV-0042',
        amount: '120.00',
        currency: 'EUR',
        customerEmail: 'lena@example.test',
        locale: 'de-DE',
      },
      methods: ['card'],
      successUrl: 'https://pay.example.test/pay/return',
      cancelUrl: 'https://pay.example.test/pay/cancel',
      attemptId: 'att_stripemock_1',
      idempotencyKey: 'att_stripemock_1:create',
    });
    expect(answer).toMatchObject({ ok: true });
    expect(new URL((answer as { url: string }).url).hostname).toBe('checkout.stripe.com');
  });

  it('sends the ways the rules leave out in a field Stripe accepts', async () => {
    // stripe-mock's default configuration has cards and Apple Pay on; a rule
    // that allows only Apple Pay makes the transport exclude cards.
    const before = seen.length;
    const answer = await provider.createCheckout({
      payable: { reference: 'INV-0043', description: '', amount: '12000', currency: 'JPY', customerEmail: null, locale: null },
      methods: ['apple_pay'],
      successUrl: 'https://pay.example.test/pay/return',
      cancelUrl: 'https://pay.example.test/pay/cancel',
      attemptId: 'att_stripemock_2',
      idempotencyKey: 'att_stripemock_2:create',
    });
    expect(answer).toMatchObject({ ok: true });
    expect(seen.slice(before).map((one) => `${one.method} ${one.path} ${one.status}`)).toEqual([
      'GET /v1/payment_method_configurations 200',
      'POST /v1/checkout/sessions 200',
    ]);
    expect(decodeURIComponent(seen.at(-1)!.body)).toContain('excluded_payment_method_types[0]=card');
  });

  it('reads, ends and refunds with requests Stripe accepts', async () => {
    expect((await provider.status('cs_test_stripemock')).ok).toBe(true);
    expect((await provider.expire('cs_test_stripemock')).ok).toBe(true);
    await provider.refund({ paymentRef: 'pi_stripemock', amount: '20.00', currency: 'EUR', reason: 'requested_by_customer', idempotencyKey: 'rf_1' });
    await provider.refund({ paymentRef: 'pi_stripemock', amount: '20.00', currency: 'EUR', reason: 'other', idempotencyKey: 'rf_2' });
    await provider.refundStatus('re_stripemock');
  });

  it(`asks for missed events with the ${LISTENED_EVENTS.length} listened types and a cursor`, async () => {
    expect((await provider.listMissedEvents(null)).ok).toBe(true);
    expect((await provider.listMissedEvents('evt_stripemock')).ok).toBe(true);
  });

  it('sent nothing Stripe refused as malformed', () => {
    expect(seen.length).toBeGreaterThan(15);
    const refused = seen.filter((one) => one.status === 400 || one.error?.includes('validation') === true);
    expect(refused).toEqual([]);
  });
});
