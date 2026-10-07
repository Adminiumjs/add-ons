/**
 * Every language the screens ship, section by section.
 *
 * A screen's one file must hold its own words and nobody else's, so each
 * section is a value of its own, imported by name: a screen that asks for
 * `SHARED`, `REFUSAL` and `RECEIVE` is built with those three and the bundler
 * leaves the other four out. (One object holding every section would be kept
 * whole in all five files — four fifths of each would be another screen's
 * words.)
 */
import * as arEG from './ar-EG.ts';
import * as csCZ from './cs-CZ.ts';
import * as daDK from './da-DK.ts';
import * as deDE from './de-DE.ts';
import * as enUS from './en-US.ts';
import * as frFR from './fr-FR.ts';
import * as zhCN from './zh-CN.ts';
import * as zhTW from './zh-TW.ts';

export type Section = 'shared' | 'refusal' | 'receive' | 'transfer' | 'opening' | 'counts' | 'rules';
export type Words = Readonly<Record<string, string>>;
/** One section in every language, by language tag. en-US is the fallback. */
export type InEveryLanguage = Readonly<Record<string, Words>>;

export const SHARED: InEveryLanguage = { 'en-US': enUS.shared, 'de-DE': deDE.shared, 'fr-FR': frFR.shared, 'da-DK': daDK.shared, 'cs-CZ': csCZ.shared, 'ar-EG': arEG.shared, 'zh-CN': zhCN.shared, 'zh-TW': zhTW.shared };
export const REFUSAL: InEveryLanguage = { 'en-US': enUS.refusal, 'de-DE': deDE.refusal, 'fr-FR': frFR.refusal, 'da-DK': daDK.refusal, 'cs-CZ': csCZ.refusal, 'ar-EG': arEG.refusal, 'zh-CN': zhCN.refusal, 'zh-TW': zhTW.refusal };
export const RECEIVE: InEveryLanguage = { 'en-US': enUS.receive, 'de-DE': deDE.receive, 'fr-FR': frFR.receive, 'da-DK': daDK.receive, 'cs-CZ': csCZ.receive, 'ar-EG': arEG.receive, 'zh-CN': zhCN.receive, 'zh-TW': zhTW.receive };
export const TRANSFER: InEveryLanguage = { 'en-US': enUS.transfer, 'de-DE': deDE.transfer, 'fr-FR': frFR.transfer, 'da-DK': daDK.transfer, 'cs-CZ': csCZ.transfer, 'ar-EG': arEG.transfer, 'zh-CN': zhCN.transfer, 'zh-TW': zhTW.transfer };
export const OPENING: InEveryLanguage = { 'en-US': enUS.opening, 'de-DE': deDE.opening, 'fr-FR': frFR.opening, 'da-DK': daDK.opening, 'cs-CZ': csCZ.opening, 'ar-EG': arEG.opening, 'zh-CN': zhCN.opening, 'zh-TW': zhTW.opening };
export const COUNTS: InEveryLanguage = { 'en-US': enUS.counts, 'de-DE': deDE.counts, 'fr-FR': frFR.counts, 'da-DK': daDK.counts, 'cs-CZ': csCZ.counts, 'ar-EG': arEG.counts, 'zh-CN': zhCN.counts, 'zh-TW': zhTW.counts };
export const RULES: InEveryLanguage = { 'en-US': enUS.rules, 'de-DE': deDE.rules, 'fr-FR': frFR.rules, 'da-DK': daDK.rules, 'cs-CZ': csCZ.rules, 'ar-EG': arEG.rules, 'zh-CN': zhCN.rules, 'zh-TW': zhTW.rules };

/** Every section by name: for the tests, which read them all. A screen imports its own by name instead. */
export const LOCALE_TAGS = ['en-US', 'de-DE', 'fr-FR', 'da-DK', 'cs-CZ', 'ar-EG', 'zh-CN', 'zh-TW'] as const;
