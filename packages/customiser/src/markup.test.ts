/**
 * NO RAW MARKUP A CUSTOMER COULD SLIP IN.
 *
 * A customer's words, a file's name and a shop's labels all end up on a
 * screen: the customer's editor, the shop's set-up, the order line's panel,
 * the proof. They stay inert text only while two things hold, both checked
 * here as the engine checks its own render layer (`packages/llm/src/
 * injection.test.ts`, "no render surface interpolates a string into raw
 * HTML"):
 *
 * 1. NO SINK. Nothing in the Customiser's sources hands a string to the page
 *    as markup: no `dangerouslySetInnerHTML`, no `innerHTML =`, no
 *    `insertAdjacentHTML`, no `document.write`. React writes text as text;
 *    an SVG file is read for its shapes (`DOMParser`, never put on the page)
 *    or shown as a picture (`<img>`, `<image href>`), which runs no script.
 * 2. NO MARKUP IN WHAT SHIPS AS WORDS OR DATA. No sentence in the eight
 *    languages, no word of the manifest and no sample row carries a tag, an
 *    event handler or a `javascript:` address. Those are the strings copied
 *    into apps and shown to everyone; one with markup in it would be the
 *    first place a sink, added one day, turned into a hole.
 *
 * If raw markup is ever really needed (a rich-text note), sanitise it at that
 * one sink with a real sanitiser and narrow the scan here with the reason.
 * Do not delete the test.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');
const walk = (dir: string): string[] => readdirSync(dir).flatMap((entry) => (statSync(join(dir, entry)).isDirectory() ? walk(join(dir, entry)) : [join(dir, entry)]));

/** React's escape hatch and the DOM's own, as the engine's gate spells them: an assignment, never a read. */
const SINKS = /dangerouslySetInnerHTML|__html\s*:|\.(?:inner|outer)HTML\s*=(?!=)|insertAdjacentHTML|document\.write\(|createContextualFragment/;

/** Markup in a string: a tag opened (`<svg`, `<script`, `<img`…), an event handler, a script address. */
const MARKUP = /<\s*\/?\s*[a-zA-Z][\w:-]*[\s/>]|\bon[a-z]+\s*=|javascript\s*:/i;

/** Every string in a value, keys as well: a key is a place text can sit too. */
function strings(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((item, at) => strings(item, `${path}[${String(at)}]`));
  if (value !== null && typeof value === 'object') return Object.entries(value).flatMap(([key, item]) => [[`${path}.${key} (as a key)`, key] as [string, string], ...strings(item, `${path}.${key}`)]);
  return [];
}

describe('the Customiser hands no string to the page as markup', () => {
  it('has no raw-HTML sink in anything it ships', () => {
    const shipped = walk(SRC).filter((file) => /\.tsx?$/.test(file) && !file.includes('.test.') && !file.includes('/testing/'));
    expect(shipped.length).toBeGreaterThan(100);
    const offenders = shipped.filter((file) => SINKS.test(readFileSync(file, 'utf8')));
    expect(offenders, 'a raw-HTML sink on a surface that shows a customer’s words').toEqual([]);
  });

  it('the gate catches each sink and each kind of markup, and passes the words that look like them', () => {
    for (const sink of ['<div dangerouslySetInnerHTML={{ __html: words }} />', 'el.innerHTML = words', "el.insertAdjacentHTML('beforeend', words)", 'document.write(words)']) expect(sink).toMatch(SINKS);
    expect('if (el.innerHTML === "") return').not.toMatch(SINKS);
    for (const markup of ['<svg onload=alert(1)>', '"><script>alert(1)</script>', '<img src=x onerror=alert(1)>', 'go to javascript:alert(1)', '</g><foreignObject>', 'onclick = run()']) expect(markup).toMatch(MARKUP);
    for (const words of ['Letters under 4 mm won’t print cleanly', '5 < 6 and 7 > 3', 'Send it as an SVG drawing', 'The Hartleys · 2019', '{n, plural, one {# line} other {# lines}}', 'Gem det som JPEG eller PNG', 'ارفع ملف SVG', '最多 2 MB']) expect(words).not.toMatch(MARKUP);
  });
});

describe('no word or sample carries markup', () => {
  const STRINGS = [...walk(join(SRC, 'browser', 'strings')), ...walk(join(SRC, 'pages', 'strings'))].filter((file) => /\/[a-z]{2}-[A-Z]{2}\.ts$/.test(file));
  const DATA = ['manifest.json', 'seeds/maker.sample.json', 'seeds/printing.sample.json'].map((file) => join(ROOT, file));

  it('reads the eight languages of the editor and the screens, the manifest and both samples', () => {
    expect(STRINGS).toHaveLength(16);
    for (const file of DATA) expect(existsSync(file), file).toBe(true);
  });

  it('in the eight languages, a sentence is words: no tag, no handler, no script address', async () => {
    const found: string[] = [];
    for (const file of STRINGS) {
      const module = (await import(file)) as Record<string, Readonly<Record<string, string>>>;
      for (const [section, words] of Object.entries(module)) for (const [key, sentence] of Object.entries(words)) if (MARKUP.test(sentence)) found.push(`${file.slice(SRC.length)} · ${section}.${key}: ${sentence}`);
    }
    expect(found).toEqual([]);
  });

  it('in the manifest and the samples, every string and key is free of markup', () => {
    const found: string[] = [];
    for (const file of DATA) for (const [path, text] of strings(JSON.parse(readFileSync(file, 'utf8')))) if (MARKUP.test(text)) found.push(`${file.slice(ROOT.length)}${path}: ${text.slice(0, 120)}`);
    expect(found).toEqual([]);
  });
});
