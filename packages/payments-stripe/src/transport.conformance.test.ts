/**
 * The `payment-provider@1` conformance suite, run against this transport and
 * the fake Stripe (`testing/fake-stripe.ts`), with a driver that pays,
 * declines, settles and fails refunds the way Stripe's own test tools do.
 */
import { paymentProviderConformance, type PaymentAmountCase } from '@adminium/add-on-host/testing';

import { createStripeProvider } from './transport.ts';
import { createFakeStripe } from './testing/fake-stripe.ts';

const credentials = { secret_key: 'rk_test_conformance0001', webhook_secret: 'whsec_conformance000000001' };
const stripe = createFakeStripe();

/** The shared table, with Stripe's own answers: three-decimal currencies are held. */
const AMOUNTS: readonly PaymentAmountCase[] = [
  { amount: '120.00', currency: 'EUR', expect: 'exact' },
  { amount: '120.005', currency: 'EUR', expect: 'refused' },
  { amount: '12000', currency: 'JPY', expect: 'exact' },
  { amount: '12000.5', currency: 'JPY', expect: 'refused' },
  { amount: '45.250', currency: 'KWD', expect: 'refused' },
  { amount: '45.2505', currency: 'KWD', expect: 'refused' },
  { amount: '0.30', currency: 'EUR', expect: 'exact' },
  { amount: '1200', currency: 'ISK', expect: 'exact' },
  { amount: '1200.50', currency: 'ISK', expect: 'refused' },
  { amount: '10.45', currency: 'HUF', expect: 'exact' },
  { amount: '5', currency: 'UGX', expect: 'refused' },
];

paymentProviderConformance({
  name: 'Card payments (Stripe)',
  make: () => createStripeProvider({ http: stripe.http, credentials, mode: 'test' }),
  credentials,
  mode: 'test',
  payable: {
    reference: 'INV-0042',
    description: 'Invoice INV-0042',
    amount: '120.00',
    currency: 'EUR',
    customerEmail: null,
    locale: 'en-US',
  },
  methods: ['card', 'link', 'sepa_debit'],
  amounts: AMOUNTS,
  successUrl: 'https://pay.example.test/pay/return',
  cancelUrl: 'https://pay.example.test/pay/cancel',
  driver: {
    pay: async (ref, outcome) => stripe.pay(ref, outcome),
    payLate: async (ref) => stripe.payLate(ref),
    settle: async (ref) => stripe.settle(ref),
    failRefund: async (ref) => stripe.failRefund(ref),
    latestDelivery: (ref) => stripe.latestDelivery(ref, credentials.webhook_secret),
  },
});
