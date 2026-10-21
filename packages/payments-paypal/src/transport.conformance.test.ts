/**
 * The `payment-provider@1` conformance suite, run against this transport and
 * the fake PayPal (`testing/fake-paypal.ts`). The driver plays the customer
 * approving on the PayPal page and then, because PayPal takes money in two
 * steps, the engine's return-page step: `complete`, which captures.
 */
import { X509Certificate } from 'node:crypto';

import { paymentProviderConformance, type PaymentAmountCase } from '@adminium/add-on-host/testing';

import { createFakePaypal } from './testing/fake-paypal.ts';
import { testChain } from './testing/certs.ts';
import { CERT_SUBJECT } from './wire.ts';
import { createPaypalProvider } from './transport.ts';

const chain = testChain();
const credentials = { client_id: 'AconformanceClient01', client_secret: 'EconformanceSecret01', webhook_id: '8PT597110X687430LKGECATA' };
const paypal = createFakePaypal({ clientId: credentials.client_id, clientSecret: credentials.client_secret, certPem: chain.chainPem, signingKeyPem: chain.leafKeyPem });
const trust = { anchors: [new X509Certificate(chain.rootPem)], subject: CERT_SUBJECT };
const make = () => createPaypalProvider({ http: paypal.http, credentials, mode: 'test' }, { trust });

/** PayPal's own answers: 24 currencies, HUF/JPY/TWD whole units. */
const AMOUNTS: readonly PaymentAmountCase[] = [
  { amount: '120.00', currency: 'EUR', expect: 'exact' },
  { amount: '120.005', currency: 'EUR', expect: 'refused' },
  { amount: '12000', currency: 'JPY', expect: 'exact' },
  { amount: '12000.5', currency: 'JPY', expect: 'refused' },
  { amount: '45.250', currency: 'KWD', expect: 'refused' },
  { amount: '45.2505', currency: 'KWD', expect: 'refused' },
  { amount: '0.30', currency: 'EUR', expect: 'exact' },
  { amount: '10', currency: 'HUF', expect: 'exact' },
  { amount: '10.45', currency: 'HUF', expect: 'refused' },
  { amount: '500', currency: 'TWD', expect: 'exact' },
  { amount: '1200', currency: 'ISK', expect: 'refused' },
];

paymentProviderConformance({
  name: 'Wallet payments (PayPal)',
  make,
  credentials,
  mode: 'test',
  payable: { reference: 'INV-0042', description: 'Invoice INV-0042', amount: '120.00', currency: 'EUR', customerEmail: null, locale: 'en-US' },
  methods: ['paypal'],
  amounts: AMOUNTS,
  successUrl: 'https://pay.example.test/pay/return',
  cancelUrl: 'https://pay.example.test/pay/cancel',
  driver: {
    pay: async (ref, outcome) => {
      paypal.approve(ref, outcome === 'succeeds' ? 'COMPLETED' : 'DECLINED');
      await make().complete(ref, `${ref}:capture`);
    },
    payLate: async (ref) => {
      paypal.approve(ref, 'PENDING');
      await make().complete(ref, `${ref}:capture`);
    },
    settle: async (ref) => paypal.settle(ref),
    failRefund: async (ref) => paypal.failRefund(ref),
    latestDelivery: async (ref) => paypal.latestDelivery(ref, credentials.webhook_id),
  },
});
