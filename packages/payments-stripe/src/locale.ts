/**
 * Adminium's eight locales → the Stripe Checkout `locale` enum.
 *
 * Source: the `locale` enum in the Checkout Sessions create call (OpenAPI
 * `2026-09-30.endive`; plan 70 facts §9). Stripe Checkout has no Arabic, so
 * an Arabic pay page hands over with `auto` (the browser's language) and the
 * pay page says so before the redirect ("The Stripe page is not in Arabic.").
 */

const MAP: Readonly<Record<string, string>> = {
  'en-US': 'en',
  'ar-EG': 'auto',
  'cs-CZ': 'cs',
  'da-DK': 'da',
  'de-DE': 'de',
  'fr-FR': 'fr',
  'zh-CN': 'zh',
  'zh-TW': 'zh-TW',
};

/** The Checkout locale for one of Adminium's, or `auto` for anything else. */
export function checkoutLocale(locale: string | null): string {
  if (locale === null) return 'auto';
  return MAP[locale] ?? 'auto';
}
