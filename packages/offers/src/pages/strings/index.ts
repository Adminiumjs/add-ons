/**
 * Every language the screens ship, section by section.
 *
 * A screen's one file must hold its own words and nobody else's, so each
 * section is a value of its own, imported by name: a screen that asks for
 * `SHARED`, `REFUSAL` and `LOOKUP` is built with those three and the bundler
 * leaves the others out.
 */
import * as enUS from './en-US.ts';

export type Section = 'shared' | 'refusal' | 'discounts' | 'lookup' | 'issue' | 'rules';
export type Words = Readonly<Record<string, string>>;
/** One section in every language, by language tag. en-US is the fallback. */
export type InEveryLanguage = Readonly<Record<string, Words>>;

export const SHARED: InEveryLanguage = { 'en-US': enUS.shared };
export const REFUSAL: InEveryLanguage = { 'en-US': enUS.refusal };
export const DISCOUNTS: InEveryLanguage = { 'en-US': enUS.discounts };
export const LOOKUP: InEveryLanguage = { 'en-US': enUS.lookup };
export const ISSUE: InEveryLanguage = { 'en-US': enUS.issue };
export const RULES: InEveryLanguage = { 'en-US': enUS.rules };

export const LOCALE_TAGS = ['en-US'] as const;
