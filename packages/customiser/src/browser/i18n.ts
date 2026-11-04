/**
 * THE EDITOR'S WORDS, IN THE CUSTOMER'S LANGUAGE.
 *
 * The editor runs on a shop's own page, with no Adminium around it to
 * translate, so it carries its words in all eight languages
 * (`strings/<tag>.ts`) and reads them itself. Every sentence is written once,
 * beside the call that shows it: `t('editor.save', 'Save and come back')`;
 * `scripts/page-strings.mjs` gathers those calls into the English file the
 * others are translated from.
 *
 * A sentence may name values (`{name}`) and plurals
 * (`{n, plural, one {# thing} other {# things}}`), chosen by the language's
 * own plural rules. The shop's own words (a part's name, a design's name) are
 * values, never translated: they stay as the shop typed them.
 */
import * as arEG from './strings/ar-EG.ts';
import * as csCZ from './strings/cs-CZ.ts';
import * as daDK from './strings/da-DK.ts';
import * as deDE from './strings/de-DE.ts';
import * as enUS from './strings/en-US.ts';
import * as frFR from './strings/fr-FR.ts';
import * as zhCN from './strings/zh-CN.ts';
import * as zhTW from './strings/zh-TW.ts';

export const LOCALES = ['en-US', 'de-DE', 'fr-FR', 'da-DK', 'cs-CZ', 'ar-EG', 'zh-CN', 'zh-TW'] as const;
export type Locale = (typeof LOCALES)[number];

const WORDS: Readonly<Record<Locale, Readonly<Record<string, string>>>> = {
  'en-US': enUS.editor,
  'de-DE': deDE.editor,
  'fr-FR': frFR.editor,
  'da-DK': daDK.editor,
  'cs-CZ': csCZ.editor,
  'ar-EG': arEG.editor,
  'zh-CN': zhCN.editor,
  'zh-TW': zhTW.editor,
};

export type Vars = Readonly<Record<string, string | number>>;
export type Translate = (key: string, english: string, vars?: Vars) => string;

/** The language shipped nearest to the one asked: the same tag, else the same language, else English. */
export function localeOf(asked: string | undefined): Locale {
  if (asked === undefined) return 'en-US';
  const exact = LOCALES.find((one) => one.toLowerCase() === asked.toLowerCase());
  if (exact !== undefined) return exact;
  const lower = asked.toLowerCase();
  if (lower.startsWith('zh')) return lower.includes('tw') || lower.includes('hk') || lower.includes('hant') ? 'zh-TW' : 'zh-CN';
  return LOCALES.find((one) => one.slice(0, 2) === lower.slice(0, 2)) ?? 'en-US';
}

export const isRightToLeft = (locale: Locale): boolean => locale === 'ar-EG';

/** One sentence with its values filled in, plurals chosen by the language's rules. */
export function format(message: string, vars: Vars, locale: Locale): string {
  let out = '';
  let at = 0;
  while (at < message.length) {
    const open = message.indexOf('{', at);
    if (open < 0) {
      out += message.slice(at);
      break;
    }
    out += message.slice(at, open);
    // The matching brace, past any branches inside it.
    let depth = 0;
    let close = open;
    for (; close < message.length; close += 1) {
      if (message[close] === '{') depth += 1;
      else if (message[close] === '}' && (depth -= 1) === 0) break;
    }
    const inner = message.slice(open + 1, close);
    const [name = '', kind, ...rest] = inner.split(',');
    const value = vars[name.trim()];
    if (kind !== undefined && kind.trim() === 'plural') {
      const n = typeof value === 'number' ? value : Number(value ?? 0);
      const branches = rest.join(',');
      const pick = new Map<string, string>();
      for (const match of branches.matchAll(/(=\d+|\w+)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g)) pick.set(match[1]!, match[2]!);
      const branch = pick.get(`=${String(n)}`) ?? pick.get(new Intl.PluralRules(locale).select(n)) ?? pick.get('other') ?? '';
      out += format(branch.replaceAll('#', new Intl.NumberFormat(locale).format(n)), vars, locale);
    } else out += value === undefined ? `{${inner}}` : String(value);
    at = close + 1;
  }
  return out;
}

/** The translator for a language: its sentence for a key, else the English written at the call. */
export function translator(locale: Locale): Translate {
  const words = WORDS[locale];
  return (key, english, vars = {}) => format(words[key] ?? english, vars, locale);
}

/** A date as the comps write it, with its weekday: "Thu 6 Aug · 16:12". */
export function shortWhen(iso: string | null, locale: Locale): string {
  if (iso === null) return '';
  const when = new Date(iso.includes('T') || iso.endsWith('Z') ? iso : iso.replace(' ', 'T') + 'Z');
  if (Number.isNaN(when.getTime())) return iso;
  // The comps' English is British: "Thu 6 Aug", the weekday first, no comma.
  const tag = locale === 'en-US' ? 'en-GB' : locale;
  const day = new Intl.DateTimeFormat(tag, { weekday: 'short', day: 'numeric', month: 'short' }).format(when).replace(',', '');
  const time = new Intl.DateTimeFormat(tag, { hour: '2-digit', minute: '2-digit', hour12: false }).format(when);
  return `${day} · ${time}`;
}

/** A length in millimetres, as the comps write it: "6 mm", "9.5 mm". */
export const mm = (value: number, locale: Locale): string => `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} mm`;
/** A size in points: "13 pt". */
export const pt = (value: number, locale: Locale): string => `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} pt`;
