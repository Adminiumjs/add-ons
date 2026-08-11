/**
 * A small message lookup, and the reason it exists rather than a hook from the
 * host.
 *
 * A slot fill is handed a payload and nothing else. It cannot import the host's
 * `useT` — that would be a runtime dependency on the host's module graph, which
 * 24 D7 does not allow — so it works out the reader's language for itself. The
 * one thing every host guarantees is `<html lang>` and `<html dir>`, stamped by
 * its own i18n provider; this module reads that attribute and re-renders when
 * it changes.
 *
 * `useSyncExternalStore` over a `MutationObserver` rather than reading the
 * attribute during render: a host sets `lang` in an effect, so a plain read
 * would be one render behind on every language switch and the add-on's panel
 * would sit in the old language until something else moved it.
 *
 * The same file as the delivery add-on's, which is the point: two add-ons in
 * one repo solving the identical problem the identical way is a convention, and
 * the moment it becomes a third the pair should move into `packages/host`.
 */

import { useCallback, useSyncExternalStore } from 'react';

import { personalizerStrings, type LocaleTag, type MessageKey } from './strings.ts';

const DEFAULT_LOCALE: LocaleTag = 'en-US';

function isLocaleTag(value: string | null): value is LocaleTag {
  return value !== null && value in personalizerStrings;
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
  const hit = (Object.keys(personalizerStrings) as LocaleTag[]).find(
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

export type TFunction = (key: MessageKey, params?: Record<string, string | number>) => string;

/**
 * Pure lookup with `{placeholder}` substitution — no plurals, by design.
 *
 * A NUMBER SUBSTITUTED INTO COPY IS FORMATTED, NEVER `String()`d. Every host
 * fixed this at its own `t` seam; an add-on has its own seam and therefore had
 * its own copy of the bug, and this one shipped it: the basket line and the
 * maker's order line both passed a raw `capMm` to `addon.personalizer.sizeUnit`
 * and drew "8.5 مم" beside the host's own "٣ مم" — two renderings of the same
 * measurement, on one row, in one language.
 *
 * Fixing it HERE rather than at the two call sites somebody noticed fixes the
 * ones nobody has written yet. A caller that has already formatted its value
 * passes a STRING and is left alone, which is what keeps `useNumber`'s own
 * output and the host's money strings coming out right.
 */
export function translate(
  locale: LocaleTag,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const raw = personalizerStrings[locale][key] ?? personalizerStrings[DEFAULT_LOCALE][key] ?? key;
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
 * A ZONE'S NAME, WHICH IS SOMETIMES DATA AND SOMETIMES COPY.
 *
 * The areas the studio has already drawn are named by this package, so their
 * names are keys and translate — "Top line" is not a proper noun, and leaving
 * it in English on an Arabic page would be the one untranslated line on the
 * screen. The moment a maker RENAMES an area in the set-up panel it becomes
 * their own words, in their own language, and must be rendered exactly as
 * typed.
 *
 * The distinction is the key prefix, checked rather than guessed: a name that
 * is one of this add-on's own keys resolves through the bundle, and anything
 * else is a maker's text and is returned untouched.
 */
export function zoneLabel(t: TFunction, name: string): string {
  return name.startsWith('addon.personalizer.zone.')
    ? t(name as MessageKey)
    : name;
}

/**
 * Numbers in the reader's own numerals.
 *
 * Millimetres and character counts are set in the mono face by the surface, but
 * the DIGITS still belong to the reader's locale — Arabic-Indic where that is
 * what a reader expects — so the formatting is here rather than in a template
 * literal at each call site.
 */
export function useNumber(): (value: number, opts?: Intl.NumberFormatOptions) => string {
  const locale = useLocale();
  return useCallback(
    (value, opts) => new Intl.NumberFormat(locale, opts).format(value),
    [locale],
  );
}
