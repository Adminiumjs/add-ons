/**
 * PAYPAL'S OWN CURRENCY TABLE.
 *
 * Source: https://developer.paypal.com/reference/currency-codes/ (read
 * 2026-10-20, plan 70 facts §8). PayPal takes 24 currencies and nothing else.
 * HUF, JPY and TWD are whole units only: "no decimal places or fractions". So
 * an amount the Stripe add-on takes (HUF 10.45) is refused here. Nothing is
 * rounded: rounding a customer's amount is taking a different amount.
 *
 * BRL, CNY and MYR are "only for in-country PayPal accounts"; PayPal itself
 * refuses them for other accounts, and that refusal is passed on.
 */

import { decimalToMinor, minorToDecimal, providerError, type MinorAmount, type ProviderError } from '@adminium/add-on-host/contracts';

export const PAYPAL_CURRENCIES: ReadonlySet<string> = new Set([
  'AUD', 'BRL', 'CAD', 'CNY', 'CZK', 'DKK', 'EUR', 'HKD', 'HUF', 'ILS', 'JPY', 'MYR',
  'MXN', 'TWD', 'NZD', 'NOK', 'PHP', 'PLN', 'GBP', 'SGD', 'SEK', 'CHF', 'THB', 'USD',
]);

const WHOLE_UNITS = new Set(['HUF', 'JPY', 'TWD']);

/** Decimal places PayPal writes a currency with, or a refusal. */
export function paypalExponent(currency: string): number | ProviderError {
  const code = currency.toUpperCase();
  if (!PAYPAL_CURRENCIES.has(code)) return providerError('CURRENCY_UNSUPPORTED', `PayPal does not take payments in ${currency}.`);
  return WHOLE_UNITS.has(code) ? 0 : 2;
}

export function paypalMinor(amount: string, currency: string): MinorAmount | ProviderError {
  const exponent = paypalExponent(currency);
  if (typeof exponent !== 'number') return exponent;
  const minor = decimalToMinor(amount, exponent);
  if (minor === null) {
    return providerError(
      'AMOUNT_UNREPRESENTABLE',
      exponent === 0
        ? `${amount} ${currency} has a fraction, and PayPal takes ${currency} in whole units only.`
        : `${amount} ${currency} cannot be taken exactly: ${currency} has ${exponent} decimal places at PayPal.`,
    );
  }
  return { minor, currency };
}

export function paypalDecimal(minor: string, currency: string): string | ProviderError {
  const exponent = paypalExponent(currency);
  if (typeof exponent !== 'number') return exponent;
  return minorToDecimal(minor, exponent) ?? providerError('INVALID_REQUEST', `${minor} is not an amount in the smallest unit.`);
}

/** The amount as PayPal writes it in `value`: "120.00", "12000". */
export function paypalValue(amount: string, currency: string): { value: string; currency: string } | ProviderError {
  const minor = paypalMinor(amount, currency);
  if ('ok' in minor) return minor;
  const value = paypalDecimal(minor.minor, currency);
  return typeof value === 'string' ? { value, currency: currency.toUpperCase() } : value;
}

/** PayPal's `value` read back as a canonical decimal, or null when it is not one PayPal could send. */
export function readValue(value: unknown, currency: string | null): string | null {
  if (typeof value !== 'string' || currency === null) return null;
  const exponent = paypalExponent(currency);
  if (typeof exponent !== 'number') return null;
  const minor = decimalToMinor(value, exponent);
  return minor === null ? null : minorToDecimal(minor, exponent);
}
