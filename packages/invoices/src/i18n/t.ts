/**
 * A message lookup, and the reason it exists rather than a hook from the host.
 *
 * A slot fill is handed a payload and nothing else. It cannot import the host's
 * `useT` — that would be a runtime dependency on the host's module graph, which
 * 24 D7 does not allow — so it has to work out the reader's language for
 * itself. The one thing the host guarantees is `<html lang>`, stamped by its
 * i18n provider; this module reads that attribute and re-renders when it moves.
 *
 * `useSyncExternalStore` over a `MutationObserver` rather than reading the
 * attribute during render: the host sets `lang` in an effect, so a plain read
 * would be one render behind on every language switch and both surfaces would
 * sit in the old language until something else moved.
 *
 * This is the fifth copy of this seam in the repository and it is a copy on
 * purpose — see `@adminium/add-on-host`'s own header. What is NOT copied is the
 * rule about digits: `describeNumerals` lives in the shared mirror and is run
 * against this seam by `numerals.test.ts`, because three of four add-ons
 * shipped the same digit defect independently.
 *
 * ── WHAT THIS COPY LEAVES OUT, AND IT IS A WHOLE SECTION ───────────────────
 *
 * There is no date formatter here, and the four siblings all have one. This
 * add-on renders exactly one date — the day printed at the foot of a label —
 * and it renders it as the ISO day it arrived as, because the label is drawn in
 * base-14 Helvetica and has a Latin alphabet and nothing else (see `sheet.ts`).
 * A localised date on a sticker whose reader might be anywhere is also the
 * wrong thing: `05/08/2026` is two different days depending on who picks the
 * box up, and `2026-08-05` is one day everywhere.
 *
 * The consequence is that this package builds no `Date` at all, anywhere —
 * which `sources.test.ts` asserts, and which is a stronger statement than the
 * "only at the formatting seam" the sibling packages can make.
 */

import { useCallback, useSyncExternalStore } from 'react';

import { strings, type LocaleTag, type StringKey } from './strings.ts';

const DEFAULT_LOCALE: LocaleTag = 'en-US';

function isLocaleTag(value: string | null): value is LocaleTag {
  return value !== null && value in strings;
}

/**
 * Resolve the document's `lang` to a locale we have.
 *
 * `zh` is split by script rather than by prefix, because Simplified and
 * Traditional are separately translated and falling one through to the other
 * would silently ship the wrong Chinese.
 */
export function localeFromLang(lang: string | null): LocaleTag {
  if (isLocaleTag(lang)) return lang;
  if (lang === null || lang.length === 0) return DEFAULT_LOCALE;
  const lower = lang.toLowerCase();
  if (lower.startsWith('zh')) return /hant|tw|hk|mo/.test(lower) ? 'zh-TW' : 'zh-CN';
  const prefix = lower.split('-')[0];
  const hit = (Object.keys(strings) as LocaleTag[]).find(
    (tag) => tag.toLowerCase().split('-')[0] === prefix,
  );
  return hit ?? DEFAULT_LOCALE;
}

function currentLocale(): LocaleTag {
  if (typeof document === 'undefined') return DEFAULT_LOCALE;
  return localeFromLang(document.documentElement.getAttribute('lang'));
}

function subscribe(onChange: () => void): () => void {
  if (typeof MutationObserver === 'undefined') return () => {};
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributeFilter: ['lang'] });
  return () => observer.disconnect();
}

export type TFunction = (key: StringKey, params?: Record<string, string | number>) => string;

/**
 * Pure lookup with `{placeholder}` substitution — no plurals, by design.
 *
 * A NUMBER SUBSTITUTED INTO COPY IS FORMATTED, NEVER `String()`d, and this one
 * line is what decides whether an Arabic reader sees ٢٤ or 24. Three of the
 * four add-ons that existed before this one shipped the same defect at the same
 * seam, in copy sitting next to host strings that were formatted correctly;
 * fixing it here rather than at each call site fixes the call sites nobody has
 * written yet.
 *
 * A caller that has ALREADY formatted its value passes a STRING and is left
 * alone. That is not only for money and clock faces — it is how this package
 * renders the one figure that must NOT be transliterated: see below.
 *
 * ── THE DIGITS THIS ADD-ON MUST NOT TOUCH ──────────────────────────────────
 *
 * A barcode number is an IDENTIFIER, and so is a single digit OF one. When the
 * check-digit refusal says which digit the last place should hold, that digit
 * has to be readable against the number the operator has just typed into the
 * box above it — which is in Latin digits, because both symbologies are, and
 * because the label will print it in Latin digits whatever language the screen
 * is in.
 *
 * So it is passed as a STRING and this function leaves it alone, and the panel
 * renders it inside the `Typed` atom, whose `dir="auto"` is the marker a host's
 * Arabic-page numeral guard reads as "somebody else's text". That is the same
 * arrangement `holiday-calendars` uses for a year and `shipping-dhl` for a
 * clock face: the rule "format every number" has its exceptions handled by
 * formatting DIFFERENTLY, never by quietly not formatting.
 *
 * Everything that is genuinely a COUNT — how many labels, how many sheets, how
 * many characters a font cannot draw — goes through as a number and is
 * formatted.
 */
export function translate(
  locale: LocaleTag,
  key: StringKey,
  params?: Record<string, string | number>,
): string {
  const raw = strings[locale][key] ?? strings[DEFAULT_LOCALE][key] ?? key;
  if (params === undefined) return raw;
  const nf = new Intl.NumberFormat(locale);
  return raw.replace(/\{(\w+)\}/g, (whole, name: string) => {
    if (!(name in params)) return whole;
    const value = params[name];
    return typeof value === 'number' ? nf.format(value) : String(value);
  });
}

export function useLocale(): LocaleTag {
  return useSyncExternalStore(subscribe, currentLocale, () => DEFAULT_LOCALE);
}

export function useT(): TFunction {
  const locale = useLocale();
  return useCallback((key, params) => translate(locale, key, params), [locale]);
}

/**
 * A count rendered on its own, outside any sentence.
 *
 * The same formatter `translate` uses, reached the same way, so a figure in a
 * chip and the same figure inside a sentence cannot come out in two different
 * scripts on one screen. That pair — a formatted number in the copy and a
 * `String()`d one in the markup beside it — is exactly what the hosts' tours
 * found in two add-ons.
 */
export function useNumber(): (value: number) => string {
  const locale = useLocale();
  return useCallback((value: number) => new Intl.NumberFormat(locale).format(value), [locale]);
}
