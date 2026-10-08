/**
 * Every language the screens ship, section by section.
 *
 * A screen's one file must hold its own words and nobody else's, so each
 * section is a value of its own, imported by name: a screen that asks for
 * `SHARED`, `REFUSAL` and `LOOKUP` is built with those three and the bundler
 * leaves the others out.
 */
import * as arEG from './ar-EG.ts';
import * as csCZ from './cs-CZ.ts';
import * as daDK from './da-DK.ts';
import * as deDE from './de-DE.ts';
import * as enUS from './en-US.ts';
import * as frFR from './fr-FR.ts';
import * as zhCN from './zh-CN.ts';
import * as zhTW from './zh-TW.ts';

export type Section = 'shared' | 'refusal' | 'discounts' | 'lookup' | 'issue' | 'rules';
export type Words = Readonly<Record<string, string>>;
/** One section in every language, by language tag. en-US is the fallback. */
export type InEveryLanguage = Readonly<Record<string, Words>>;

export const SHARED: InEveryLanguage = { 'en-US': enUS.shared, 'de-DE': deDE.shared, 'fr-FR': frFR.shared, 'da-DK': daDK.shared, 'cs-CZ': csCZ.shared, 'ar-EG': arEG.shared, 'zh-CN': zhCN.shared, 'zh-TW': zhTW.shared };
export const REFUSAL: InEveryLanguage = { 'en-US': enUS.refusal, 'de-DE': deDE.refusal, 'fr-FR': frFR.refusal, 'da-DK': daDK.refusal, 'cs-CZ': csCZ.refusal, 'ar-EG': arEG.refusal, 'zh-CN': zhCN.refusal, 'zh-TW': zhTW.refusal };
export const DISCOUNTS: InEveryLanguage = { 'en-US': enUS.discounts, 'de-DE': deDE.discounts, 'fr-FR': frFR.discounts, 'da-DK': daDK.discounts, 'cs-CZ': csCZ.discounts, 'ar-EG': arEG.discounts, 'zh-CN': zhCN.discounts, 'zh-TW': zhTW.discounts };
export const LOOKUP: InEveryLanguage = { 'en-US': enUS.lookup, 'de-DE': deDE.lookup, 'fr-FR': frFR.lookup, 'da-DK': daDK.lookup, 'cs-CZ': csCZ.lookup, 'ar-EG': arEG.lookup, 'zh-CN': zhCN.lookup, 'zh-TW': zhTW.lookup };
export const ISSUE: InEveryLanguage = { 'en-US': enUS.issue, 'de-DE': deDE.issue, 'fr-FR': frFR.issue, 'da-DK': daDK.issue, 'cs-CZ': csCZ.issue, 'ar-EG': arEG.issue, 'zh-CN': zhCN.issue, 'zh-TW': zhTW.issue };
export const RULES: InEveryLanguage = { 'en-US': enUS.rules, 'de-DE': deDE.rules, 'fr-FR': frFR.rules, 'da-DK': daDK.rules, 'cs-CZ': csCZ.rules, 'ar-EG': arEG.rules, 'zh-CN': zhCN.rules, 'zh-TW': zhTW.rules };

export const LOCALE_TAGS = ['en-US', 'de-DE', 'fr-FR', 'da-DK', 'cs-CZ', 'ar-EG', 'zh-CN', 'zh-TW'] as const;
