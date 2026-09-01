/**
 * THE PROSE IS SWEPT TOO — because the two documents that DESCRIBE the
 * vocabulary ban were the two that broke it.
 *
 * ── WHAT WAS ACTUALLY THERE ─────────────────────────────────────────────────
 *
 * The root `README.md` explained the ban by listing the banned words, and
 * `packages/personalizer/README.md` reached twice for the ordinary English
 * adjective meaning "at liberty to" — "three surfaces free to choose their own
 * width" — in a paragraph about keeping bytes honest. Both are substring hits.
 * The release sweep is a case-insensitive grep with no word boundary and no
 * sense of irony: a document that names a banned word while banning it is the
 * first thing that grep finds.
 *
 * Each package already sweeps its own `dist/` (`built-output.test.ts`), and
 * every locale bundle is checked at source. Nothing looked at the Markdown, so
 * nothing could have caught this.
 *
 * ── WHY `pro` IS NOT IN THIS LIST, AND THAT IS A DECISION ───────────────────
 *
 * The full ban carries `pro` as a substring, and in the string bundles that is
 * affordable: the copy is short, it is written around the run, and
 * `testing/lexicon.ts` forgives a named handful of whole words with a sentence
 * each. In PROSE about a codebase it is not affordable and not useful. These
 * documents say `product`, `production`, `proof`, `provides`, `properties`,
 * `promise`, `prove`, `produce` and `toProductionPaths` on nearly every page,
 * because those are the names of the things being described. A carve-out list
 * longer than the ban is a list nobody audits, which is the failure mode 24 D10
 * is written against.
 *
 * So this gate takes the seven runs that have no ordinary-English homograph in
 * this vocabulary, and it takes them WITHOUT a word boundary, which is the
 * whole point: `explanation` carries `plan`, `frontier` carries `tier`, and
 * both are real failures the moment somebody reaches for them.
 *
 * ── THE `pro` HALF, NOW CLOSED (32-add-on-distribution.md D1) ───────────────
 *
 * It used to stay only where it could be paid for — over the built bundles.
 * Publishing changes the stakes: a package README and its `description` become
 * the npm LISTING PAGE, which is marketplace copy on somebody else's site, read
 * by people who never open this repo. So both are swept here now, each in the
 * form it can afford:
 *
 *  - **Markdown** keeps the eight substrings above and gains `pro` as a
 *    TOKEN (`\bpro\b`), the same shape `host-kit`'s `WORD_BANNED` uses.
 *    Measured: zero hits across every document. Swapping in the substring
 *    instead would have fired 50 times on `product`, `production`, `proof`,
 *    `provides` and `promise` — the exact carve-out-list-nobody-audits failure
 *    the section above argues against.
 *  - **`package.json` `description`** takes the FULL nine-run list, `pro` as a
 *    substring included, because the copy is one sentence and is written around
 *    the run — the same trade the locale bundles make. Measured clean on all
 *    eight packages.
 *
 * WHAT IS DELIBERATELY NOT SWEPT: the tarball's contents as a whole. The
 * `LICENSE` staged into every package at pack time is the AGPL, whose preamble
 * says `free` twenty-two times. A sweep written over `package/**` rather than
 * over named surfaces turns all six packages red the moment the licence is
 * staged — and the correct response to that would be to weaken the gate.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/** The repo root: `packages/host/src` → up three. */
const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

/**
 * The sweep's own runs, minus the one that cannot be paid for in prose.
 *
 * Case-insensitive substrings, no word boundary, nothing dropped — the way the
 * release grep reads them. `/mo` is here because the sweep bans it as a link
 * path and a path is not a word.
 */
const BANNED = ['pricing', 'plan', 'tier', 'billing', 'upgrade', 'free', 'premium', '/mo'];

/** Every Markdown file this repo ships, ignoring anything installed. */
function docs(dir: string = ROOT, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
      continue;
    }
    const path = join(dir, entry.name);
    if (entry.isDirectory()) docs(path, out);
    else if (entry.name.endsWith('.md') && statSync(path).isFile()) out.push(path);
  }
  return out;
}

const WORDISH = /[\p{L}\p{N}_$/]/u;

/** The whole word around a hit, so the failure message names what to reword. */
function tokenAround(text: string, index: number, length: number): string {
  let start = index;
  while (start > 0 && WORDISH.test(text[start - 1]!)) start -= 1;
  let end = index + length;
  while (end < text.length && WORDISH.test(text[end]!)) end += 1;
  return text.slice(start, end);
}

describe('the documents describe the bans without tripping them', () => {
  const files = docs();

  it('finds Markdown to check at all', () => {
    expect(files.length, 'the sweep matched no documents, so it proves nothing').toBeGreaterThan(4);
  });

  it.each(files.map((file) => ({ file: file.slice(ROOT.length) })))(
    '$file carries no banned run',
    ({ file }) => {
      const text = readFileSync(join(ROOT, file), 'utf8');
      const offences: string[] = [];
      for (const banned of BANNED) {
        for (const match of text.matchAll(new RegExp(banned.replace('/', '\\/'), 'gi'))) {
          const line = text.slice(0, match.index).split('\n').length;
          offences.push(
            `line ${line}: “${tokenAround(text, match.index, match[0].length)}” carries “${banned}”`,
          );
        }
      }
      expect(offences, `\n  ${offences.join('\n  ')}\n`).toEqual([]);
    },
  );

  it.each(files.map((file) => ({ file: file.slice(ROOT.length) })))(
    '$file carries no bare “pro”',
    ({ file }) => {
      // Token-anchored, unlike everything above. See the header: as a substring
      // this run is unaffordable in prose about a codebase, and as a word it is
      // free.
      const text = readFileSync(join(ROOT, file), 'utf8');
      const offences = [...text.matchAll(/\bpro\b/gi)].map(
        (match) => `line ${text.slice(0, match.index).split('\n').length}: “${match[0]}”`,
      );
      expect(offences, `\n  ${offences.join('\n  ')}\n`).toEqual([]);
    },
  );
});

describe('the npm listing copy carries no banned run', () => {
  // A published package's `description` is the one line npm shows in search
  // results. It is marketplace copy on somebody else's site, so it is held to
  // the FULL list including `pro` — affordable here because it is a sentence.
  const packages = readdirSync(join(ROOT, 'packages'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  it('finds packages to check at all', () => {
    expect(packages.length, 'no packages found, so this proves nothing').toBeGreaterThan(3);
  });

  it.each(packages.map((name) => ({ name })))('$name', ({ name }) => {
    const pkg = JSON.parse(
      readFileSync(join(ROOT, 'packages', name, 'package.json'), 'utf8'),
    ) as { description?: string };
    const description = pkg.description ?? '';
    expect(description.length, `${name} has no description; npm would list it blank`).toBeGreaterThan(0);

    const offences: string[] = [];
    for (const banned of [...BANNED, 'pro']) {
      for (const match of description.matchAll(new RegExp(banned.replace('/', '\\/'), 'gi'))) {
        offences.push(`“${tokenAround(description, match.index, match[0].length)}” carries “${banned}”`);
      }
    }
    expect(offences, `\n  ${offences.join('\n  ')}\n`).toEqual([]);
  });
});
