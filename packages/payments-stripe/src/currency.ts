/**
 * STRIPE'S OWN CURRENCY TABLE: how an amount is written in its smallest unit.
 *
 * Source: https://docs.stripe.com/currencies (read 2026-10-20). Each provider owns its table, because they disagree: HUF and TWD take
 * two decimals here and none at PayPal.
 *
 * An amount that cannot be held exactly is REFUSED, never rounded: rounding a
 * customer's amount is taking a different amount.
 *
 * Held, not guessed. Where Stripe's own page contradicts itself, the currency
 * is refused with a sentence until a sandbox call settles it, because a wrong
 * exponent charges a customer a hundred times too much or too little:
 *   - BHD, JOD, KWD, OMR and TND (three decimals): the rule is gone from the page.
 *   - UGX: in the zero-decimal list AND in the "two decimals, always 00" table.
 */

import { decimalToMinor, minorToDecimal, providerError, type MinorAmount, type ProviderError } from '@adminium/add-on-host/contracts';

/** Charged in whole units: the amount is sent as it is. */
const ZERO_DECIMAL = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

/**
 * Written with two decimals that must be `00`: Stripe cannot charge a
 * fraction of these, but takes the amount times a hundred.
 */
const WHOLE_BUT_TWO_DECIMALS = new Set(['ISK']);

/** Refused until a sandbox call proves how Stripe takes them (see above). */
export const HELD_CURRENCIES: ReadonlyMap<string, string> = new Map([
  ['BHD', 'three decimals'],
  ['JOD', 'three decimals'],
  ['KWD', 'three decimals'],
  ['OMR', 'three decimals'],
  ['TND', 'three decimals'],
  ['UGX', 'its smallest unit'],
]);

/** Stripe's limit on one charge: eight digits in the smallest unit. */
const MAX_MINOR_DIGITS = 8;

function exponentOf(currency: string): number | ProviderError {
  if (!/^[A-Z]{3}$/.test(currency)) return providerError('CURRENCY_UNSUPPORTED', `${currency} is not a currency code.`);
  const held = HELD_CURRENCIES.get(currency);
  if (held !== undefined) {
    return providerError(
      'CURRENCY_UNSUPPORTED',
      `Payments in ${currency} are held: the Stripe pages do not agree on how ${currency} is written in ${held}, so no payment is taken in it until that is checked.`,
    );
  }
  if (ZERO_DECIMAL.has(currency)) return 0;
  return 2;
}

/** "120.50 EUR" → 12050. "12000 JPY" → 12000. "1200 ISK" → 120000. */
export function stripeMinor(amount: string, currency: string): MinorAmount | ProviderError {
  const exponent = exponentOf(currency);
  if (typeof exponent !== 'number') return exponent;
  if (WHOLE_BUT_TWO_DECIMALS.has(currency)) {
    const whole = decimalToMinor(amount, 0);
    if (whole === null) return providerError('AMOUNT_UNREPRESENTABLE', `${amount} ${currency} has a fraction, and Stripe charges ${currency} in whole units only.`);
    return limit({ minor: whole === '0' ? '0' : `${whole}00`, currency }, amount);
  }
  const minor = decimalToMinor(amount, exponent);
  if (minor === null) {
    return providerError('AMOUNT_UNREPRESENTABLE', `${amount} ${currency} cannot be charged exactly: ${currency} has ${exponent} decimal places at Stripe.`);
  }
  return limit({ minor, currency }, amount);
}

function limit(minor: MinorAmount, amount: string): MinorAmount | ProviderError {
  if (minor.minor.length > MAX_MINOR_DIGITS) {
    return providerError('AMOUNT_UNREPRESENTABLE', `${amount} ${minor.currency} is more than Stripe takes in one payment.`);
  }
  return minor;
}

/** The other way: 12050 EUR → "120.50". Stripe sends currencies in lower case; this takes either. */
export function stripeDecimal(minor: string, currency: string): string | ProviderError {
  const code = currency.toUpperCase();
  if (WHOLE_BUT_TWO_DECIMALS.has(code)) {
    const asTwo = minorToDecimal(minor, 2);
    return asTwo ?? providerError('INVALID_REQUEST', `${minor} is not an amount in the smallest unit.`);
  }
  // A held currency is refused this way too: no attempt is ever made in one,
  // and reading it with a guessed exponent would misstate what was taken.
  const exponent = exponentOf(code);
  if (typeof exponent !== 'number') return exponent;
  return minorToDecimal(minor, exponent) ?? providerError('INVALID_REQUEST', `${minor} is not an amount in the smallest unit.`);
}
