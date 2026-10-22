/**
 * EVERY REQUEST THIS ADD-ON BUILDS, CHECKED AGAINST PAYPAL'S OWN DESCRIPTIONS.
 *
 * A whole flow runs against the fake (check the keys, make an order, approve
 * and capture it, refund part, end another, read the sweep), and every
 * request it made is held to the published OpenAPI description of its
 * operation (`testing/paypal-openapi.json`, trimmed from
 * paypal/paypal-rest-api-specifications at the commit its `source` names).
 */
import { X509Certificate } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { createFakePaypal } from './testing/fake-paypal.ts';
import { testChain } from './testing/certs.ts';
import { eventsQueryIssues, OPENAPI_SOURCE, operationOf, requestIssues } from './testing/openapi.ts';
import { createPaypalProvider, forgetPaypalCaches } from './transport.ts';

describe(`the PayPal wire, against ${Object.entries(OPENAPI_SOURCE.files).map(([file, version]) => `${file.split('/').at(-1)} ${version}`).join(', ')}`, () => {
  it('sends only bodies and queries the descriptions allow', async () => {
    forgetPaypalCaches();
    const chain = testChain();
    const credentials = { client_id: 'AopenapiClient00001', client_secret: 'EopenapiSecret00001', webhook_id: 'WH0OPENAPI' };
    const paypal = createFakePaypal({ clientId: credentials.client_id, clientSecret: credentials.client_secret, certPem: chain.chainPem, signingKeyPem: chain.leafKeyPem });
    const provider = () => createPaypalProvider({ http: paypal.http, credentials, mode: 'test' }, { trust: { anchors: [new X509Certificate(chain.rootPem)], intermediates: [] } });

    expect((await provider().checkCredentials()).ok).toBe(true);
    const make = (attempt: string, currency = 'EUR', amount = '120.00', locale: string | null = 'de-DE', email: string | null = 'lena@example.test') =>
      provider().createCheckout({
        payable: { reference: 'INV-0042', description: 'Invoice INV-0042', amount, currency, customerEmail: email, locale },
        methods: ['paypal'],
        successUrl: 'https://pay.example.test/pay/return',
        cancelUrl: 'https://pay.example.test/pay/cancel',
        attemptId: attempt,
        idempotencyKey: `${attempt}:create`,
      });
    const first = await make('att_openapi_1');
    const second = await make('att_openapi_2', 'JPY', '12000', null, null);
    if (first.ok !== true || second.ok !== true) throw new Error('no order');
    paypal.approve(first.ref);
    const paid = await provider().complete(first.ref, `${first.ref}:capture`);
    if (paid.ok !== true || paid.paymentRef === null) throw new Error('not captured');
    await provider().refund({ paymentRef: paid.paymentRef, amount: '20.00', currency: 'EUR', reason: 'requested_by_customer', idempotencyKey: 'rf-openapi' });
    await provider().expire(second.ref);
    await provider().listMissedEvents(null);

    const checked = paypal.requests.map((one) => ({ one, operation: operationOf(one.method, one.path) }));
    const issues = checked.flatMap(({ one, operation }) => {
      if (operation !== null) return requestIssues(operation, one.body).map((issue) => `${operation}: ${issue}`);
      if (one.path.startsWith('/v1/notifications/webhooks-events')) return eventsQueryIssues(one.path.split('?')[1] ?? '').map((issue) => `events: ${issue}`);
      return [];
    });
    expect(issues).toEqual([]);
    const operations = new Set(checked.map(({ operation }) => operation).filter((one) => one !== null));
    expect([...operations].sort()).toEqual([
      'PATCH /v2/checkout/orders/{id}',
      'POST /v2/checkout/orders',
      'POST /v2/checkout/orders/{id}/capture',
      'POST /v2/payments/captures/{capture_id}/refund',
    ]);
  });

  it('would catch a misspelt or read-only field', () => {
    expect(requestIssues('POST /v2/checkout/orders', { intent: 'CAPTURE', purchase_units: [{ amount: { currency_code: 'EUR', value: '1.00' }, custom_idd: 'x' }] })).toEqual([
      'body.purchase_units[0].custom_idd: is not a field PayPal describes',
    ]);
    expect(requestIssues('POST /v2/checkout/orders', { intent: 'SALE', purchase_units: [] }).length).toBeGreaterThan(0);
  });
});
