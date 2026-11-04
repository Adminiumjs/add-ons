/**
 * NO ENGLISH LEFT IN ANOTHER LANGUAGE.
 *
 * Each string file's own test already checks every key is there in every
 * language and that only a handful of sentences read the same as the
 * English. A sentence half translated, or one English word left inside a
 * German one, passes both. This test reads every word a person sees, in all
 * three places they are written (the customer's editor, the shop's screens,
 * the manifest with its mail), and fails on English found in another
 * language:
 *
 * - a sentence the same as the English, unless every word in it is a name
 *   that language uses as it is (listed below, with the languages it holds
 *   for);
 * - in German, French, Danish and Czech, an English word no one of those
 *   languages has (`the`, `your`, `this`…);
 * - in Arabic and Chinese, any word written in Latin letters that is not a
 *   file kind or a unit (SVG, PDF, mm…), the names those languages print as
 *   they are.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import * as editorAr from './browser/strings/ar-EG.ts';
import * as editorCs from './browser/strings/cs-CZ.ts';
import * as editorDa from './browser/strings/da-DK.ts';
import * as editorDe from './browser/strings/de-DE.ts';
import * as editorEn from './browser/strings/en-US.ts';
import * as editorFr from './browser/strings/fr-FR.ts';
import * as editorZhCN from './browser/strings/zh-CN.ts';
import * as editorZhTW from './browser/strings/zh-TW.ts';
import * as pages from './pages/strings/index.ts';

type Locale = 'en-US' | 'de-DE' | 'fr-FR' | 'da-DK' | 'cs-CZ' | 'ar-EG' | 'zh-CN' | 'zh-TW';
const OTHERS: readonly Locale[] = ['de-DE', 'fr-FR', 'da-DK', 'cs-CZ', 'ar-EG', 'zh-CN', 'zh-TW'];

/** One sentence in every language, named by where it is written. */
type Sentence = { where: string; words: Partial<Record<Locale, string>> };

const EDITOR: Record<Locale, Readonly<Record<string, string>>> = { 'en-US': editorEn.editor, 'de-DE': editorDe.editor, 'fr-FR': editorFr.editor, 'da-DK': editorDa.editor, 'cs-CZ': editorCs.editor, 'ar-EG': editorAr.editor, 'zh-CN': editorZhCN.editor, 'zh-TW': editorZhTW.editor };
const SECTIONS = { shared: pages.SHARED, setup: pages.SETUP, designs: pages.DESIGNS, panel: pages.PANEL };

const fromTables = (where: string, all: Readonly<Record<string, Readonly<Record<string, string>>>>): Sentence[] =>
  Object.keys(all['en-US'] ?? {}).map((key) => ({ where: `${where} ${key}`, words: Object.fromEntries(Object.entries(all).map(([tag, words]) => [tag, words[key]])) }));

/**
 * The manifest's words: every object keyed by language (a label, a mail in
 * one language), its strings read leaf by leaf. A mail's link and footer are
 * `{{…}}` fillings, not words, and drop out with the fillings below.
 */
const fromManifest = (): Sentence[] => {
  const manifest: unknown = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  const found: Sentence[] = [];
  const leaves = (value: unknown, path: string, into: Map<string, string>): void => {
    if (typeof value === 'string') {
      // A mail's block names and the filling a button waits for are names in code, never read.
      if (!/\.(?:block|onlyWith|url)$/.test(path)) into.set(path, value);
    }
    else if (Array.isArray(value)) value.forEach((item, at) => leaves(item, `${path}[${at}]`, into));
    else if (value && typeof value === 'object') for (const [key, inner] of Object.entries(value)) leaves(inner, `${path}.${key}`, into);
  };
  const visit = (value: unknown, path: string): void => {
    if (Array.isArray(value)) value.forEach((item, at) => visit(item, `${path}[${at}]`));
    else if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      if ('en-US' in record && 'de-DE' in record) {
        const by = new Map<Locale, Map<string, string>>();
        for (const tag of ['en-US', ...OTHERS] as Locale[]) {
          const into = new Map<string, string>();
          leaves(record[tag], '', into);
          by.set(tag, into);
        }
        for (const leaf of by.get('en-US')?.keys() ?? []) found.push({ where: `manifest ${path}${leaf}`, words: Object.fromEntries([...by].map(([tag, into]) => [tag, into.get(leaf)])) });
        return;
      }
      for (const [key, inner] of Object.entries(record)) visit(inner, `${path}.${key}`);
    }
  };
  visit(manifest, '');
  return found;
};

const ALL: Sentence[] = [...fromTables('editor', EDITOR), ...Object.entries(SECTIONS).flatMap(([section, all]) => fromTables(`pages ${section}`, all)), ...fromManifest()];

/** A sentence with its fillings, counted forms and braces taken out: what is left is words. */
const wordsOf = (sentence: string): string =>
  sentence
    .replace(/[\w.]+@[\w.]+/g, ' ')
    .replace(/\{\{[^}]*\}\}/g, ' ')
    .replace(/\{\s*\w+\s*,\s*(?:plural|select)\s*,/g, ' ')
    .replace(/(?:=\d+|zero|one|two|few|many|other)\s*\{/g, ' ')
    .replace(/\{\s*\w+\s*\}/g, ' ')
    .replace(/[{}#]/g, ' ');

/** Whole words in Latin letters only: `it` inside the Czech "Zrušit" is not a word. */
const latinWords = (sentence: string): string[] => (wordsOf(sentence).match(/[\p{L}\p{N}’']+/gu) ?? []).filter((word) => /^[A-Za-z][A-Za-z0-9’']*$/.test(word));

/**
 * Names every language prints as they are: file kinds, units, keys on the
 * keyboard, materials and the names of file formats' parts. Arabic and
 * Chinese write these in Latin letters too.
 */
const KINDS_AND_UNITS = new Set(['svg', 'pdf', 'png', 'jpeg', 'jpg', 'tiff', 'heic', 'woff', 'woff2', 'stl', '3mf', 'glb', 'gltf', 'cmyk', 'rgb', 'dpi', 'mm', 'pt', 'px', 'mb', 'kb', 'a4', 'a5', 'a6', 'a3', 'dl', 'id', 'url', 'webgl', 'pla', 'draco', 'meshopt', 'alt', 'enter', 'esc', 'shift', 'tab', 'adminium', 'customiser']);

/**
 * English words none of German, French, Danish or Czech has as a word of its
 * own, so one found there is English left behind. Words one of those
 * languages does have (`in`, `on`, `a`, `for`, `to`, `will`…) are left out
 * here, or named for that language in `NATIVE` below.
 */
const ENGLISH_ONLY = new Set(['the', 'your', 'you', 'with', 'this', 'that', 'these', 'those', 'isn’t', "isn't", 'can’t', "can't", 'won’t', "won't", 'don’t', "don't", 'it’s', "it's", 'there', 'here', 'what', 'which', 'from', 'have', 'has', 'been', 'would', 'should', 'could', 'please', 'save', 'saved', 'design’s', 'shop', 'shop’s', 'customer', 'customers', 'words', 'word', 'add', 'choose', 'upload', 'delete', 'cancel', 'back', 'next', 'done', 'open', 'close', 'yes', 'and', 'of', 'or', 'it', 'is', 'are', 'be', 'by', 'at', 'as', 'an', 'into', 'out', 'up', 'only', 'any', 'all', 'none', 'more', 'fewer', 'less', 'one', 'two', 'three', 'each', 'every', 'their', 'they', 'them', 'our', 'we', 'us', 'my', 'me', 'its', 'not', 'can', 'may', 'must', 'make', 'made', 'how', 'why', 'who', 'where', 'when', 'than', 'then', 'too', 'very', 'just', 'still', 'yet', 'try', 'again', 'let', 'show', 'hide', 'turn', 'see', 'look', 'piece', 'pieces', 'area', 'areas', 'face', 'faces', 'side', 'sides', 'front', 'line', 'lines', 'letters', 'size', 'colour', 'colours', 'font', 'fonts', 'file', 'files', 'picture', 'proof', 'proofs', 'order', 'orders', 'ready', 'blank', 'start', 'page', 'pages', 'base', 'bases', 'kit', 'kits', 'item', 'items', 'raised', 'cut', 'engrave', 'engraved', 'print', 'printed', 'flat', 'assembled', 'thickness', 'width', 'height', 'depth', 'safe', 'edge', 'outline', 'layer', 'layers', 'price', 'prices', 'priced', 'feature', 'features']);

/**
 * Words each language uses as English writes them, its own or borrowed long
 * ago: they pass both checks below. Every one is a word that language's
 * readers use in a shop's software today, never a stand-in for a translation.
 */
const NATIVE: Record<string, ReadonlySet<string>> = {
  'de-DE': new Set(['app', 'code', 'design', 'designs', 'logo', 'logos', 'name', 'material', 'layout', 'layouts', 'link', 'status', 'text', 'filter', 'token', 'ok', 'font', 'fonts', 'shop', 'kit', 'kits', 'optional', 'ellipse', 'oval', 'zoom', 'palette', 'version', 'phase', 'in', 'an', 'so', 'die', 'man', 'add', 'on']),
  'fr-FR': new Set(['code', 'design', 'logo', 'logos', 'message', 'texte', 'type', 'format', 'photo', 'photos', 'total', 'note', 'ok', 'options', 'position', 'version', 'versions', 'image', 'source', 'motif', 'motifs', 'accent', 'ellipse', 'zoom', 'palette', 'palettes', 'rectangle', 'style', 'licence', 'action', 'phase', 'grotesque', 'face', 'faces', 'page', 'pages', 'base', 'bases', 'kit', 'kits', 'me', 'us', 'as', 'an']),
  'da-DK': new Set(['app', 'design', 'designs', 'logo', 'link', 'status', 'format', 'navn', 'ok', 'version', 'filter', 'type', 'total', 'layout', 'layouts', 'side', 'note', 'accent', 'medium', 'zoom', 'ellipse', 'oval', 'model', 'upload', 'start', 'have', 'print', 'kit', 'kits', 'at', 'as', 'by', 'me', 'an', 'front']),
  'cs-CZ': new Set(['logo', 'design', 'status', 'text', 'ok', 'font', 'model', 'licence', 'a', 'to', 'by']),
};

const LATIN = new Set(['de-DE', 'fr-FR', 'da-DK', 'cs-CZ']);

/** What is still English in one sentence of one language, in words a reader can act on; empty when nothing is. */
export const englishIn = (tag: Locale, sentence: string, english: string): string[] => {
  const words = latinWords(sentence);
  const passes = (word: string): boolean => KINDS_AND_UNITS.has(word.toLowerCase()) || /^\d/.test(word);
  if (!LATIN.has(tag)) return words.filter((word) => !passes(word));
  const native = NATIVE[tag] ?? new Set<string>();
  const found: string[] = [];
  if (sentence === english && words.some((word) => !passes(word) && !native.has(word.toLowerCase()))) found.push('the same as the English');
  for (const word of words) if (ENGLISH_ONLY.has(word.toLowerCase()) && !native.has(word.toLowerCase())) found.push(word);
  return found;
};

describe('every word a person reads', () => {
  it('is gathered from the editor, the screens and the manifest, mail among it', () => {
    expect(ALL.filter((one) => one.where.startsWith('editor')).length).toBeGreaterThan(300);
    expect(ALL.filter((one) => one.where.startsWith('pages')).length).toBeGreaterThan(500);
    expect(ALL.filter((one) => one.where.startsWith('manifest')).length).toBeGreaterThan(200);
    expect(ALL.some((one) => one.where.includes('emailTemplates') && one.where.includes('subject'))).toBe(true);
  });

  it('is in every language, with no English left in another', () => {
    const left: string[] = [];
    for (const sentence of ALL) {
      const english = sentence.words['en-US'] ?? '';
      for (const tag of OTHERS) {
        const words = sentence.words[tag];
        if (words === undefined) {
          left.push(`${tag} · ${sentence.where}: missing`);
          continue;
        }
        const found = englishIn(tag, words, english);
        if (found.length > 0) left.push(`${tag} · ${sentence.where}: ${found.join(', ')} · ${words}`);
      }
    }
    expect(left).toEqual([]);
  });

  it('catches English left inside a sentence, and lets a shared name pass', () => {
    expect(englishIn('de-DE', 'Ihr Logo for the front', 'Your logo on the front')).toContain('the');
    expect(englishIn('fr-FR', 'Add to basket', 'Add to basket')).toContain('the same as the English');
    expect(englishIn('zh-CN', '上传 your logo', 'Upload your logo')).toEqual(['your', 'logo']);
    expect(englishIn('ar-EG', 'ارفع ملف SVG بدقة {dpi} dpi', 'Send an SVG at {dpi} dpi')).toEqual([]);
    expect(englishIn('de-DE', 'Logo', 'Logo')).toEqual([]);
    expect(englishIn('cs-CZ', 'Přidejte své logo, a to hned', 'Add your logo')).toEqual([]);
  });
});
