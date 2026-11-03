/**
 * Every language the shop's screens ship, section by section: one section a
 * part of the screens, and the words they share. Only the shared words are
 * here yet; the set-up and the design editor add their own sections.
 */
import * as arEG from './ar-EG.ts';
import * as csCZ from './cs-CZ.ts';
import * as daDK from './da-DK.ts';
import * as deDE from './de-DE.ts';
import * as enUS from './en-US.ts';
import * as frFR from './fr-FR.ts';
import * as zhCN from './zh-CN.ts';
import * as zhTW from './zh-TW.ts';

export type Section = 'shared';
export type Words = Readonly<Record<string, string>>;
/** One section in every language, by language tag. en-US is the fallback. */
export type InEveryLanguage = Readonly<Record<string, Words>>;

const of = (section: Section): InEveryLanguage => ({ 'en-US': enUS[section], 'de-DE': deDE[section], 'fr-FR': frFR[section], 'da-DK': daDK[section], 'cs-CZ': csCZ[section], 'ar-EG': arEG[section], 'zh-CN': zhCN[section], 'zh-TW': zhTW[section] });

export const SHARED: InEveryLanguage = of('shared');

export const LOCALE_TAGS = ['en-US', 'de-DE', 'fr-FR', 'da-DK', 'cs-CZ', 'ar-EG', 'zh-CN', 'zh-TW'] as const;
