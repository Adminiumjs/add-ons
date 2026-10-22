/**
 * The mirrored `payment-provider@1` suite, run against the mirrored demo
 * provider: proof that the copy in this repo still holds the contract the
 * engine holds (the engine runs the same suite against the same demo). A
 * Stripe or PayPal add-on runs it against itself with its own driver.
 */
import {
  PAYMENT_AMOUNT_CASES,
  createDemoPaymentBackend,
  createDemoPaymentProvider,
  paymentProviderConformance,
} from './testing/index.ts';

const credentials = { secretKey: 'demo_test_hostmirror1', webhookSecret: 'demo_whsec_hostmirror1' };
const backend = createDemoPaymentBackend();

paymentProviderConformance({
  name: 'demo (host mirror)',
  make: () => createDemoPaymentProvider({ http: backend.http, credentials, mode: 'test' }),
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
  methods: ['card', 'bank_debit'],
  amounts: PAYMENT_AMOUNT_CASES,
  successUrl: 'https://pay.example.test/pay/return',
  cancelUrl: 'https://pay.example.test/pay/cancel',
  driver: {
    pay: (ref, outcome) => backend.pay(ref, outcome),
    payLate: (ref) => backend.pay(ref, 'settles-late'),
    settle: (ref) => backend.settleNow(ref),
    failRefund: (ref) => backend.failRefund(ref),
    latestDelivery: async (ref) => {
      const event = [...backend.events()].reverse().find((one) => one.checkoutRef === ref);
      return event === undefined ? null : backend.deliveryFor(event.id, credentials.webhookSecret);
    },
  },
});
