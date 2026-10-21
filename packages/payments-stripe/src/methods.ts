/**
 * The ways to pay a Stripe account can switch on, as staff read them.
 *
 * Ids are Stripe's own (the keys of a Payment Method Configuration). The
 * labels name each way the way its owner writes it; a card is described by
 * its scheme elsewhere (`paidWithOf`). Link is written "Link (Stripe)" so it
 * is never read as the pay link Adminium makes.
 *
 * `delayed`: the money arrives after the customer leaves the page (a bank
 * debit, a voucher paid at a shop), so the checkout reads `processing` until
 * Stripe says it settled or failed.
 */

export interface StripeMethod {
  readonly label: string;
  readonly delayed: boolean;
}

export const STRIPE_METHODS: Readonly<Record<string, StripeMethod>> = {
  card: { label: 'Cards', delayed: false },
  apple_pay: { label: 'Apple Pay', delayed: false },
  google_pay: { label: 'Google Pay', delayed: false },
  link: { label: 'Link (Stripe)', delayed: false },
  paypal: { label: 'PayPal', delayed: false },
  klarna: { label: 'Klarna', delayed: false },
  ideal: { label: 'iDEAL', delayed: false },
  bancontact: { label: 'Bancontact', delayed: false },
  eps: { label: 'EPS', delayed: false },
  p24: { label: 'Przelewy24', delayed: false },
  blik: { label: 'BLIK', delayed: false },
  twint: { label: 'TWINT', delayed: false },
  mobilepay: { label: 'MobilePay', delayed: false },
  revolut_pay: { label: 'Revolut Pay', delayed: false },
  amazon_pay: { label: 'Amazon Pay', delayed: false },
  cashapp: { label: 'Cash App Pay', delayed: false },
  affirm: { label: 'Affirm', delayed: false },
  afterpay_clearpay: { label: 'Afterpay / Clearpay', delayed: false },
  alipay: { label: 'Alipay', delayed: false },
  wechat_pay: { label: 'WeChat Pay', delayed: false },
  sepa_debit: { label: 'SEPA Direct Debit', delayed: true },
  bacs_debit: { label: 'Bacs Direct Debit', delayed: true },
  us_bank_account: { label: 'ACH Direct Debit', delayed: true },
  acss_debit: { label: 'Pre-authorized debit (Canada)', delayed: true },
  au_becs_debit: { label: 'BECS Direct Debit', delayed: true },
  multibanco: { label: 'Multibanco', delayed: true },
  boleto: { label: 'Boleto', delayed: true },
  oxxo: { label: 'OXXO', delayed: true },
  konbini: { label: 'Konbini', delayed: true },
  customer_balance: { label: 'Bank transfer (Stripe)', delayed: true },
  pay_by_bank: { label: 'Pay by bank', delayed: false },
};

/** A way Stripe reports that this table does not know: its id, made readable. */
export function methodInfo(id: string): StripeMethod {
  return STRIPE_METHODS[id] ?? { label: id.replace(/_/g, ' ').replace(/^./, (first) => first.toUpperCase()), delayed: false };
}

/**
 * The ways a Checkout Session can leave out (`excluded_payment_method_types`,
 * OpenAPI `2026-09-30.endive`). Apple Pay and Google Pay ride on cards and
 * Link has no switch per session, so the rules cannot remove those three on
 * their own; the dashboard can.
 */
export const EXCLUDABLE = new Set([
  'acss_debit', 'affirm', 'afterpay_clearpay', 'alipay', 'alma', 'amazon_pay', 'au_becs_debit', 'bacs_debit',
  'bancontact', 'billie', 'bizum', 'blik', 'boleto', 'card', 'cashapp', 'crypto', 'customer_balance', 'eps', 'fpx',
  'giropay', 'grabpay', 'ideal', 'kakao_pay', 'klarna', 'konbini', 'kr_card', 'mb_way', 'mobilepay', 'multibanco',
  'naver_pay', 'nz_bank_account', 'oxxo', 'p24', 'pay_by_bank', 'payco', 'paynow', 'paypal', 'paypay', 'payto', 'pix',
  'promptpay', 'revolut_pay', 'samsung_pay', 'satispay', 'scalapay', 'sepa_debit', 'sequra', 'sofort', 'sunbit',
  'swish', 'twint', 'upi', 'us_bank_account', 'wechat_pay', 'zip',
]);

/** Card schemes as Stripe reports them on a charge → how staff read them. */
const BRANDS: Readonly<Record<string, string>> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  discover: 'Discover',
  diners: 'Diners Club',
  jcb: 'JCB',
  unionpay: 'UnionPay',
  cartes_bancaires: 'Cartes Bancaires',
  eftpos_au: 'eftpos',
  interac: 'Interac',
};

/** "Visa ••4242", or "Card ••4242" for a scheme this table does not know. */
export function cardLabel(brand: string | null, last4: string | null): string {
  const name = brand === null ? 'Card' : (BRANDS[brand] ?? 'Card');
  return last4 !== null && /^\d{4}$/.test(last4) ? `${name} ••${last4}` : name;
}
