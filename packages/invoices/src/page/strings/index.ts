// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Every locale this page ships, one chunk each.
 *
 * en-US is EAGER because it is the fallback: a key with no translation in
 * the reader's language still has to render a word. The other seven are
 * dynamic imports, so a reader downloads one — 191 KiB of strings in a single
 * bundle would be seven eighths waste on every open.
 */
import enUS from './en-US.js';

export const EN_US = enUS;

export const LOCALE_CHUNKS: Record<string, () => Promise<{ default: Record<string, string> }>> = {
  'ar-EG': () => import('./ar-EG.js'),
  'cs-CZ': () => import('./cs-CZ.js'),
  'da-DK': () => import('./da-DK.js'),
  'de-DE': () => import('./de-DE.js'),
  'fr-FR': () => import('./fr-FR.js'),
  'zh-CN': () => import('./zh-CN.js'),
  'zh-TW': () => import('./zh-TW.js'),
};
