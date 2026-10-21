/**
 * Adminium's eight locales → PayPal's `experience_context.locale`.
 *
 * PayPal lists all eight as BCP-47 codes (developer.paypal.com/reference/
 * locale-codes, read 2026-10-20, plan 70 facts §9), so they pass through as
 * they are. The locale is a hint: PayPal also weighs the buyer's country.
 * Anything else is left out, and PayPal chooses.
 */

const SUPPORTED = new Set(['en-US', 'ar-EG', 'cs-CZ', 'da-DK', 'de-DE', 'fr-FR', 'zh-CN', 'zh-TW']);

export function paypalLocale(locale: string | null): string | null {
  return locale !== null && SUPPORTED.has(locale) ? locale : null;
}
