/**
 * EVERY ADD-ON IS IN `TRADEMARKS.md`, INCLUDING THE ONES THAT NAME NOTHING.
 *
 * ── THE DEFECT ──────────────────────────────────────────────────────────────
 *
 * 24 AC6, as amended 2026-08-09, is unconditional: the repository's trademark
 * file lists every package, and one that references no mark says exactly that
 * rather than being absent. For the whole of wave 4b the Live Personalizer had
 * no row in the table and no section — and the prose around the table still
 * said "three packages" and "what used to be three TRADEMARKS.md files", so the
 * file read as complete while being one add-on short.
 *
 * Nothing could have caught it. The file is prose, nobody asserted anything
 * about it, and the one thing a reader most needs from it — that the list is
 * the WHOLE list — is precisely the thing prose cannot state about itself.
 *
 * ── WHY THIS IS A RULE AND NOT A ROW ────────────────────────────────────────
 *
 * The fix for "the fourth add-on is missing" is not to add the fourth add-on.
 * Twelve guards in this wave were written against the examples their author had
 * open and went blind on the next one. So the packages are DISCOVERED — every
 * directory under `packages/` with a `manifest.json` is an add-on, by the same
 * definition the installer uses — and each discovered package must appear, by
 * the name its own manifest declares. A fifth add-on added tomorrow fails this
 * file tomorrow, with no edit here.
 *
 * ── WHAT IT CANNOT DECIDE ───────────────────────────────────────────────────
 *
 * Whether the WORDS are right. It knows that a section exists, that it is not a
 * stub, and that it takes a position on affiliation; it cannot know whether the
 * mark named in it is the mark the code references, or whether a sentence
 * inside it is true. That is a reading, and the file says who has to do it.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const PACKAGES = fileURLToPath(new URL('../..', import.meta.url));
const TRADEMARKS = join(PACKAGES, '..', 'TRADEMARKS.md');

/**
 * Every add-on's declared marks, imported. `COMPANY_MARKS` is what the HOSTS
 * read to decide whether a surface names a company (AC6); this file is what
 * keeps that declaration and the prose from drifting apart.
 */
const FACTS = import.meta.glob<{ COMPANY_MARKS?: readonly { mark: string; owner: string }[] }>(
  '../../*/src/add-on-facts.ts',
  { eager: true },
);

function declaredMarks(dir: string): readonly { mark: string; owner: string }[] | null {
  const entry = Object.entries(FACTS).find(([path]) => path.includes(`/${dir}/`));
  return entry === undefined ? null : (entry[1].COMPANY_MARKS ?? null);
}

/** Every add-on in the repository: a package directory with a manifest. */
function addOns(): { dir: string; name: string; key: string }[] {
  return readdirSync(PACKAGES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ dir: entry.name, manifest: join(PACKAGES, entry.name, 'manifest.json') }))
    .filter((entry) => existsSync(entry.manifest))
    .map((entry) => {
      const manifest = JSON.parse(readFileSync(entry.manifest, 'utf8')) as {
        name?: string;
        key?: string;
      };
      return { dir: entry.dir, name: manifest.name ?? '', key: manifest.key ?? '' };
    })
    .sort((a, b) => (a.dir < b.dir ? -1 : 1));
}

/** The `# Heading` section a name opens, up to the next level-one heading. */
function sectionFor(text: string, name: string): string | null {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.startsWith(`# ${name}`));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^# /.test(line));
  return [lines[start], ...(end === -1 ? rest : rest.slice(0, end))].join('\n');
}

const FILE = readFileSync(TRADEMARKS, 'utf8');
const found = addOns();

describe('TRADEMARKS.md lists every add-on in this repository (24 AC6)', () => {
  it('found the add-ons at all', () => {
    // Guard on the guard: a discovery that returns nothing would agree with an
    // empty file forever, which is this file's own failure mode.
    expect(found.length, 'no packages with a manifest were found').toBeGreaterThan(3);
    expect(found.every((addOn) => addOn.name !== '')).toBe(true);
  });

  it.each(found)('$dir has a row in the table', ({ dir, name }) => {
    const row = FILE.split('\n').find(
      (line) => line.startsWith('|') && line.includes(`packages/${dir}`),
    );
    expect(row, `no table row names packages/${dir}`).toBeDefined();
    expect(row ?? '', `the row for packages/${dir} does not call it "${name}"`).toContain(name);
  });

  it.each(found)('$dir has a section of its own, and it says something', ({ dir, name }) => {
    const section = sectionFor(FILE, name);
    expect(section, `no "# ${name}" section — an add-on that names no company says so`).not.toBeNull();
    // A heading with nothing under it satisfies the letter of AC6 and none of
    // its point. Every existing section is thousands of characters.
    expect((section ?? '').length, `the "${name}" section is a stub`).toBeGreaterThan(500);
    // Every section takes a position: it disclaims affiliation, or it states
    // that there is no company to disclaim one with.
    expect(
      /affiliat/i.test(section ?? ''),
      `the "${name}" section says nothing about affiliation`,
    ).toBe(true);
    expect(existsSync(join(PACKAGES, dir, 'TRADEMARKS.md')), `packages/${dir} has no pointer`).toBe(
      true,
    );
  });

  it.each(found)('$dir declares the same marks here and to its hosts', ({ dir, name }) => {
    /*
     * THE TWO STATEMENTS OF THE SAME FACT, HELD TOGETHER.
     *
     * `add-on-facts.ts` tells whatever host vendors this add-on which words are
     * marks, so that the host's tour can insist the not-affiliated line is on
     * the same surface. This table tells a reader. They are written in
     * different files by different people at different times, and a mark added
     * to one and not the other is a screen naming a company that no gate knows
     * is a company — which is the shape of every hole this wave has found.
     */
    const marks = declaredMarks(dir);
    expect(marks, `packages/${dir}/src/add-on-facts.ts exports no COMPANY_MARKS`).not.toBeNull();
    const row =
      FILE.split('\n').find((line) => line.startsWith('|') && line.includes(`packages/${dir}`)) ??
      '';
    for (const { mark } of marks ?? []) {
      expect(row, `the table row for ${name} does not name the mark ${mark}`).toContain(mark);
    }
    if ((marks ?? []).length === 0) {
      expect(row, `${name} declares no mark, so its row must say *(none)*`).toContain('*(none)*');
    }
  });

  it('names no package that is not here any more', () => {
    const dirs = new Set(found.map((addOn) => `packages/${addOn.dir}`));
    const orphans = FILE.split('\n')
      .filter((line) => line.startsWith('|'))
      .flatMap((line) => [...line.matchAll(/packages\/[\w-]+/g)].map((match) => match[0]))
      .filter((path) => !dirs.has(path));
    expect(orphans, 'the table names a package that no longer exists').toEqual([]);
  });
});
