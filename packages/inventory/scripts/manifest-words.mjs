/**
 * The manifest's words, in eight languages.
 *
 * The manifest is written in English. This fills in the rest:
 *
 *   1. every table, column and choice gets its English name from
 *      `src/i18n/labels.ts` (a table's `label` / `labelPlural`, a column's
 *      `label`, an enum column's `rules.enumLabels.labels`);
 *   2. every text the manifest holds as a map of languages (`{"en-US": …}`),
 *      and every page title, gets the seven other languages from
 *      `src/i18n/manifest/<locale>.json`.
 *
 *   node scripts/manifest-words.mjs           writes manifest.json
 *   node scripts/manifest-words.mjs --check   writes nothing; fails when it is behind
 *   node scripts/manifest-words.mjs --list    prints every English text with where it stands
 *
 * A dictionary is keyed by `<kind>|<English>`: the same English word is one
 * thing as a table ("Count") and another as a button, and a language may need
 * two words for it. `src/manifest-words.test.ts` runs the check.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { columnLabel, tableLabel, valueLabel } from '../src/i18n/labels.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
export const MANIFEST = resolve(HERE, '../manifest.json');
export const DICTIONARIES = resolve(HERE, '../src/i18n/manifest');
export const LOCALES = ['en-US', 'de-DE', 'fr-FR', 'da-DK', 'cs-CZ', 'ar-EG', 'zh-CN', 'zh-TW'];
const OTHERS = LOCALES.slice(1);

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
/** A text held in several languages: an object whose every key is a language tag, English among them. */
const isWords = (value) => isRecord(value) && typeof value['en-US'] === 'string' && Object.keys(value).every((key) => /^[a-z]{2}-[A-Z]{2}$/.test(key));

/** What kind of text stands at a path: the dictionaries keep one word list for each. */
function kindAt(path) {
  const at = path.join('.');
  if (/^requiredSchema\.tables\.[^.]+\.label$/.test(at)) return 'table';
  if (/^requiredSchema\.tables\.[^.]+\.labelPlural$/.test(at)) return 'tables';
  if (/\.columns\.[^.]+\.label$/.test(at)) return 'column';
  if (/\.rules\.(enumLabels\.labels\.[^.]+|options\.values\.[^.]+\.label)$/.test(at)) return 'value';
  if (/\.states\.actions\.[^.]+\.label$/.test(at) || /\.bulk\.[^.]+\.label$/.test(at)) return 'action';
  if (/^seeds\./.test(at)) return 'seed';
  if (/navGroups\./.test(at)) return 'nav';
  if (/^addOn\.recordTabs\.[^.]+\.labels$/.test(at)) return 'nav';
  if (/^addOn\.recordTabs\.[^.]+\.actions\.[^.]+\.labels$/.test(at)) return 'action';
  if (/^(addOn\.)?pages\.[^.]+\.titles$/.test(at)) return 'page';
  if (/\.layout\.items\.[^.]+\.config\.titles$/.test(at)) return 'widget';
  if (/\.toolbar\.links\.[^.]+\.labels$/.test(at)) return 'action';
  if (/^automations\./.test(at)) return 'automation';
  if (/^emailTemplates\.[^.]+\.locales\./.test(at)) return 'email';
  return 'text';
}

/** Arrays are walked by what names their entries (`ref`, `id`, `key`, `value`), so a path reads the same after a row moves. */
const stepOf = (entry, n) => (isRecord(entry) ? String(entry.ref ?? entry.id ?? entry.key ?? entry.value ?? entry.table ?? n) : String(n));

function walk(node, path, visit) {
  if (Array.isArray(node)) {
    node.forEach((entry, n) => walk(entry, [...path, stepOf(entry, n)], visit));
    return;
  }
  if (!isRecord(node)) return;
  for (const [key, value] of Object.entries(node)) {
    if (key === '@t' && isWords(value)) visit(value, [...path]);
    else if (isWords(value)) visit(value, [...path, key]);
    else walk(value, [...path, key], visit);
  }
}

const words = (english) => ({ 'en-US': english });

/** The English names of tables, columns and choices, written where the manifest keeps them. */
function nameEverything(manifest) {
  const missing = [];
  for (const table of manifest.requiredSchema.tables) {
    const named = tableLabel(table.ref);
    if (named === undefined) missing.push(table.ref);
    else {
      // After `columns`, where a reader of the file looks for them; an object keeps the order its keys were set in.
      const { label: _one, labelPlural: _many, ...rest } = table;
      for (const key of Object.keys(table)) delete table[key];
      const { ref, ...after } = rest;
      Object.assign(table, { ref, label: { ...(isWords(_one) ? _one : {}), ...words(named[0]) }, labelPlural: { ...(isWords(_many) ? _many : {}), ...words(named[1]) }, ...after });
    }
    for (const column of table.columns) {
      if (column.role === 'pk') continue;
      const label = columnLabel(table.ref, column.ref);
      if (label === undefined) missing.push(`${table.ref}.${column.ref}`);
      else column.label = { ...(isWords(column.label) ? column.label : {}), ...words(label) };
      if (column.type !== 'enum') continue;
      const labels = {};
      for (const value of column.enum) {
        const said = valueLabel(table.ref, column.ref, value);
        if (said === undefined) missing.push(`${table.ref}.${column.ref} = ${value}`);
        else labels[value] = { ...(isWords(column.rules?.enumLabels?.labels?.[value]) ? column.rules.enumLabels.labels[value] : {}), ...words(said) };
      }
      column.rules = { ...(column.rules ?? {}), enumLabels: { ...(column.rules?.enumLabels ?? {}), labels } };
    }
  }
  if (missing.length > 0) throw new Error(`src/i18n/labels.ts names no:\n  ${missing.join('\n  ')}`);
}

/** A page's title in the other languages sits beside it, as `titles`. */
function titlePages(manifest) {
  for (const page of [...(manifest.pages ?? []), ...(manifest.addOn?.pages ?? [])]) {
    if (typeof page.title?.fallback !== 'string') continue;
    const { titles, ...rest } = page;
    for (const key of Object.keys(page)) delete page[key];
    const out = {};
    for (const [key, value] of Object.entries(rest)) {
      out[key] = value;
      if (key === 'title') out.titles = { ...(isRecord(titles) ? titles : {}), ...words(value.fallback) };
    }
    Object.assign(page, out);
  }
}

/**
 * A card of the Overview says its title, its line under the figure and its
 * empty words as plain English, with the other languages in a map beside
 * each (`title` / `titles`). A toolbar link likewise (`label` / `labels`).
 */
const BESIDE = [
  ['title', 'titles'],
  ['subtitle', 'subtitles'],
  ['metricLabel', 'metricLabels'],
];
function wordCards(manifest) {
  const beside = (holder, plain, many) => {
    if (typeof holder[plain] !== 'string') return;
    const kept = isRecord(holder[many]) ? holder[many] : {};
    const out = {};
    for (const [key, value] of Object.entries(holder)) {
      if (key === many) continue;
      out[key] = value;
      if (key === plain) out[many] = { ...kept, ...words(value) };
    }
    for (const key of Object.keys(holder)) delete holder[key];
    Object.assign(holder, out);
  };
  for (const page of manifest.pages ?? []) {
    for (const link of page.config?.layout?.toolbar?.links ?? []) beside(link, 'label', 'labels');
    for (const item of page.config?.layout?.items ?? []) {
      if (!isRecord(item.config)) continue;
      for (const [plain, many] of BESIDE) beside(item.config, plain, many);
      if (isRecord(item.config.emptyState)) {
        beside(item.config.emptyState, 'titleKey', 'titles');
        beside(item.config.emptyState, 'bodyKey', 'bodies');
      }
    }
  }
}

/** The fields of an email a person reads. A text that is only placeholders (`{{row.item_name}}`) is the same in every language. */
const EMAIL_FIELDS = new Set(['subject', 'preheader', 'text', 'label', 'title', 'meta', 'note', 'amount', 'footer', 'value']);
const saysSomething = (text) => /\p{L}/u.test(text.replace(/\{\{[^}]*\}\}/g, ''));
function emailWords(node, visit, key = '') {
  if (typeof node === 'string') return EMAIL_FIELDS.has(key) && saysSomething(node) ? visit(node) : node;
  if (Array.isArray(node)) return node.map((entry) => emailWords(entry, visit, key));
  if (!isRecord(node)) return node;
  // Where the rows come from is a description of tables, not words.
  return Object.fromEntries(Object.entries(node).map(([name, value]) => [name, name === 'from' ? value : emailWords(value, visit, name)]));
}
/** Each email in the seven other languages: the English one, sentence by sentence. */
function wordEmails(manifest, dictionary, untold) {
  for (const template of manifest.emailTemplates ?? []) {
    const english = template.locales?.['en-US'];
    if (!isRecord(english)) continue;
    const locales = { 'en-US': english };
    for (const locale of OTHERS) {
      locales[locale] = emailWords(english, (text) => {
        const said = dictionary[locale][`email|${text}`];
        if (typeof said === 'string' && said !== '') return said;
        untold.set(locale, [...(untold.get(locale) ?? []), `email|${text}`]);
        return text;
      });
    }
    template.locales = locales;
  }
}

/**
 * What is drawn before any screen of the add-on has loaded — a group's
 * heading in the shared rail, the Stock tab on another table's record, its
 * empty words and its button — says its other languages beside the message.
 */
function wordMessages(manifest) {
  const beside = (holder, message, many) => {
    if (typeof holder?.[message]?.fallback !== 'string') return;
    const kept = isRecord(holder[many]) ? holder[many] : {};
    const out = {};
    for (const [key, value] of Object.entries(holder)) {
      if (key === many) continue;
      out[key] = value;
      if (key === message) out[many] = { ...kept, ...words(value.fallback) };
    }
    for (const key of Object.keys(holder)) delete holder[key];
    Object.assign(holder, out);
  };
  for (const group of manifest.addOn?.navGroups ?? []) beside(group, 'label', 'labels');
  for (const tab of manifest.addOn?.recordTabs ?? []) {
    beside(tab, 'label', 'labels');
    beside(tab, 'empty', 'empties');
    for (const action of tab.actions ?? []) beside(action, 'label', 'labels');
  }
}

export function dictionaries() {
  return Object.fromEntries(OTHERS.map((locale) => {
    const file = resolve(DICTIONARIES, `${locale}.json`);
    return [locale, existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}];
  }));
}

/** Every English text of the manifest that is said in several languages: its kind, itself, and each place it stands. */
export function listed(manifest) {
  const found = new Map();
  walk(manifest, [], (value, path) => {
    const key = `${kindAt(path)}|${value['en-US']}`;
    found.set(key, [...(found.get(key) ?? []), path.join('.')]);
  });
  for (const template of manifest.emailTemplates ?? []) {
    emailWords(template.locales?.['en-US'], (text) => {
      found.set(`email|${text}`, [...(found.get(`email|${text}`) ?? []), `emailTemplates.${template.key}`]);
      return text;
    });
  }
  return found;
}

/** The manifest with every name and every language in: the text `manifest.json` should hold. */
export function worded(source, dictionary = dictionaries()) {
  const manifest = JSON.parse(source);
  nameEverything(manifest);
  titlePages(manifest);
  wordCards(manifest);
  wordMessages(manifest);
  const untold = new Map();
  wordEmails(manifest, dictionary, untold);
  walk(manifest, [], (value, path) => {
    const key = `${kindAt(path)}|${value['en-US']}`;
    for (const locale of OTHERS) {
      const said = dictionary[locale][key];
      if (typeof said === 'string' && said !== '') value[locale] = said;
      else untold.set(locale, [...(untold.get(locale) ?? []), key]);
    }
    // English first, then the others in one fixed order.
    const ordered = Object.fromEntries(LOCALES.filter((locale) => value[locale] !== undefined).map((locale) => [locale, value[locale]]));
    for (const locale of Object.keys(value)) delete value[locale];
    Object.assign(value, ordered);
  });
  return { text: `${JSON.stringify(manifest, null, 2)}\n`, manifest, untold };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const source = readFileSync(MANIFEST, 'utf8');
  const { text, manifest, untold } = worded(source);
  if (process.argv.includes('--list')) {
    const out = [...listed(manifest)].map(([key, places]) => ({ key, kind: key.slice(0, key.indexOf('|')), english: key.slice(key.indexOf('|') + 1), places: places.slice(0, 3), uses: places.length }));
    console.log(JSON.stringify(out, null, 1));
  } else {
    for (const [locale, keys] of untold) console.error(`${locale}: ${String(new Set(keys).size)} texts not translated, e.g. ${[...new Set(keys)].slice(0, 3).join(' · ')}`);
    if (process.argv.includes('--check')) {
      if (untold.size > 0 || text !== source) {
        console.error('manifest.json is behind its words: run `node scripts/manifest-words.mjs`.');
        process.exit(1);
      }
    } else if (untold.size > 0 && !process.argv.includes('--english')) {
      console.error('Nothing written: a dictionary in src/i18n/manifest/ is short. (`--english` writes the names alone.)');
      process.exit(1);
    } else {
      writeFileSync(MANIFEST, text);
    }
  }
}
