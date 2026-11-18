/**
 * Every language the screens ship, section by section: the list of pages,
 * the funnels, the editor, and the words they share.
 */
import * as arEG from './ar-EG.ts';
import * as csCZ from './cs-CZ.ts';
import * as daDK from './da-DK.ts';
import * as deDE from './de-DE.ts';
import * as enUS from './en-US.ts';
import * as frFR from './fr-FR.ts';
import * as zhCN from './zh-CN.ts';
import * as zhTW from './zh-TW.ts';

export type Section = 'shared' | 'list' | 'funnels' | 'editor';
export type Words = Readonly<Record<string, string>>;
/** One section in every language, by language tag. en-US is the fallback. */
export type InEveryLanguage = Readonly<Record<string, Words>>;

const of = (section: Section): InEveryLanguage => ({ 'en-US': enUS[section], 'de-DE': deDE[section], 'fr-FR': frFR[section], 'da-DK': daDK[section], 'cs-CZ': csCZ[section], 'ar-EG': arEG[section], 'zh-CN': zhCN[section], 'zh-TW': zhTW[section] });

export const SHARED: InEveryLanguage = of('shared');
export const LIST: InEveryLanguage = of('list');
export const FUNNELS: InEveryLanguage = of('funnels');
export const EDITOR: InEveryLanguage = of('editor');

export const LOCALE_TAGS = ['en-US', 'de-DE', 'fr-FR', 'da-DK', 'cs-CZ', 'ar-EG', 'zh-CN', 'zh-TW'] as const;
