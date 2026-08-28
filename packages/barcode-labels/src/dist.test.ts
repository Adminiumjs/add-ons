/**
 * The release grep, run where the release runs it: over BUILT OUTPUT.
 *
 * Every other guard in this package reads sources. That is one inference away
 * from the thing that ships — a bundler keeps a comment, a constant is folded,
 * a string arrives from somewhere else — and the sweep (17 §2) does not read
 * sources at all. So this suite builds the add-on and greps the bytes, with the
 * FULL release list: `bannedSubstringsIn` plus the union of the per-locale
 * tiering words, which catch the spellings no ASCII fragment can see.
 *
 * IT IS NOT A FORMALITY, AND IT WAS NOT ONE FOR THE SIBLING PACKAGE EITHER. A
 * Vite library build does NOT strip comments that sit inside an expression, so
 * `holiday-calendars` shipped five occurrences of "product" and "promising"
 * written inside `register()`'s object literal while every source-level check
 * was green. The words were in prose ABOUT the add-on, in a file nobody would
 * think to sweep, and the release grep would have found them.
 *
 * That trap is sharper here than anywhere else in the repository, because this
 * add-on's whole subject is the thing a shop sells and the ordinary English
 * word for it carries a banned run. Every one of them was reworded rather than
 * carved out — see `testing/lexicon.ts` — and this suite is what says so about
 * the bytes rather than about the sources.
 *
 * It also closes the manifest's loop: `manifest.test.ts` proves the manifest
 * names the filename `vite.config.ts` says it writes, and this proves the build
 * actually wrote it, at the path the manifest declares, resolved the way an
 * installer resolves it (24 AC10: package-root-relative).
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };
import { OUTPUT } from '../vite.config.ts';
import {
  foreignImportsIn,
  impuritiesIn,
  offendingAddresses,
  sendersIn,
} from '@adminium/add-on-host/testing';

import { buildForReal, DIST, ROOT } from './testing/build.ts';
import { bannedHitsIn, tieringHitsIn } from './testing/lexicon.ts';

beforeAll(() => {
  buildForReal();
}, 180_000);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/**
 * EVERY FILE IN `dist/`, with no extension filter of any kind.
 *
 * The published artefact is whatever is in this directory. A gate that decides
 * some of it does not count is a gate with a hole in the shape of whatever was
 * excluded — which is how a 258 KB verbatim copy of the sources once shipped
 * past this same check in a sibling package, as a sourcemap the walk skipped.
 */
const built = (): string[] => walk(DIST);
const relative = (file: string) => file.slice(DIST.length + 1);

/** Every path the manifest tells an installer to load, package-root-relative. */
const DECLARED_ENTRY_POINTS = manifest.addOn.slots.map((fill) => fill.client);

describe('the build writes what the manifest promises', () => {
  it('emits the one half, under the name the manifest uses', () => {
    for (const path of Object.values(OUTPUT)) {
      expect(existsSync(join(ROOT, path)), `${path} is missing from the build`).toBe(true);
    }
  });

  it('puts a real file at every entry point the manifest declares (AC10)', () => {
    // Driven from `manifest.json` rather than from `OUTPUT`, so this fails when
    // the manifest names something the build does not write — the failure mode
    // an installer hits at load time and nobody hits before.
    for (const path of DECLARED_ENTRY_POINTS) {
      expect(existsSync(join(ROOT, path)), `${path} is declared but not built`).toBe(true);
    }
  });

  it('ships nothing but that one module', () => {
    // No server half, no sourcemap, no stray asset: what the manifest names is
    // the whole of the artefact, which is what makes "grep all of `dist/`" a
    // complete gate rather than a sample of one.
    expect(built().map(relative).sort()).toEqual(['client.js']);
  });

  it('emits no sourcemap, and no reference to one', () => {
    // `sourcesContent` is a verbatim copy of the sources, comments and all. The
    // published artefact is not a debugging session.
    expect(built().filter((file) => file.endsWith('.map')).map(relative)).toEqual([]);
    for (const file of built()) {
      expect(readFileSync(file, 'utf8')).not.toContain('sourceMappingURL');
    }
  });

  it('leaves the bundle a single self-contained ESM file', () => {
    // D7. A second entry sharing a generated chunk would make the client import
    // a sibling the manifest does not name, and the host loads only what the
    // manifest names — which matters more here than usual, because TWO slots
    // are pointed at this one file.
    const client = readFileSync(join(ROOT, OUTPUT.client), 'utf8');
    const relativeImports = [...client.matchAll(/from\s*["'](\.[^"']*)["']/g)].map((m) => m[1]);
    expect(relativeImports).toEqual([]);
  });

  it('imports nothing but the runtime the host already has (D7)', () => {
    // React, and nothing else. An add-on that brought a barcode library would
    // put somebody else's symbol tables in a page — which is a large part of
    // why `ean13.ts` and `code128.ts` are written out by hand.
    const client = readFileSync(join(ROOT, OUTPUT.client), 'utf8');
    const packages = [...client.matchAll(/from\s*["']([^."'][^"']*)["']/g)].map((m) => m[1]!);
    for (const specifier of packages) {
      expect(/^react($|\/)/.test(specifier), `the bundle imports ${specifier}`).toBe(true);
    }
    expect(packages.length, 'the bundle imports nothing at all — did it build?').toBeGreaterThan(0);
  });

  it('carries no test-only module, so the lexicon cannot ship', () => {
    // `testing/lexicon.ts` spells every banned word out. A bundle that reached
    // it would fail the grep below on the file that DEFINES the grep.
    const client = readFileSync(join(ROOT, OUTPUT.client), 'utf8');
    expect(client).not.toContain('SUBSTRING_BANNED');
    expect(client).not.toContain('ALLOWED_TOKENS');
  });

  it('carries no test fixture, including the word the Code 128 anchor uses', () => {
    // `code128.test.ts` pins a published encoding whose example string is a
    // proper noun this add-on's copy never uses. It is a fixture and belongs in
    // no artefact; this is what keeps that claim true rather than assumed.
    expect(readFileSync(join(ROOT, OUTPUT.client), 'utf8')).not.toContain('Wikipedia');
  });
});

describe('the tables really are in the bundle, which is the whole product', () => {
  const client = () => readFileSync(join(ROOT, OUTPUT.client), 'utf8');

  it('carries both symbologies’ tables, so nothing has to be fetched to draw one', () => {
    // The claim on the shelf card is that the symbols are drawn here. These are
    // four entries a reader can check against a published table, and their
    // presence in the bytes is what makes the claim checkable rather than
    // architectural.
    for (const entry of ['0001101', '1110010', '211214', '233111']) {
      expect(client().includes(entry), `${entry} is not in the bundle`).toBe(true);
    }
  });

  it('carries the parity table the undrawn first digit rides on', () => {
    // Tree-shaking this away would leave an encoder that drew twelve digits and
    // silently lost the thirteenth, which no screen would show.
    for (const row of ['LLLLLL', 'LGGLLG']) {
      expect(client().includes(row), `${row} was shaken out of the bundle`).toBe(true);
    }
  });

  it('carries both slot ids, because two fills are the point of the package', () => {
    expect(client()).toContain('settings.add-on.panel');
    expect(client()).toContain('record.actions');
  });

  it('carries the sentences that state this add-on’s limits', () => {
    // A build that shook these away would ship a form that looked as though it
    // could label a whole catalogue, and a sheet whose Latin-only alphabet
    // nobody had been told about.
    for (const key of [
      'addon.barcode-labels.scope.oneRow',
      'addon.barcode-labels.scope.families',
      'addon.barcode-labels.sheet.latin',
      'addon.barcode-labels.note.noAllocation',
      'addon.barcode-labels.record.readOnly',
    ]) {
      expect(client().includes(key), `${key} was shaken out of the bundle`).toBe(true);
    }
  });

  it('carries all eight locales', () => {
    for (const locale of ['en-US', 'de-DE', 'fr-FR', 'cs-CZ', 'da-DK', 'zh-CN', 'zh-TW', 'ar-EG']) {
      expect(client().includes(locale), `${locale} is not in the bundle`).toBe(true);
    }
  });
});

describe('the vocabulary ban, over built output', () => {
  it('has something to grep', () => {
    expect(built().length).toBeGreaterThan(0);
  });

  it('contains none of the banned substrings, case-insensitively', () => {
    const offenders: string[] = [];
    for (const file of built()) {
      const bytes = readFileSync(file, 'utf8');
      for (const { word, at } of bannedHitsIn(bytes)) {
        offenders.push(
          `${relative(file)} · "${word}" · …${bytes.slice(Math.max(0, at - 70), at + 70)}…`,
        );
      }
    }
    expect(offenders, `\n${offenders.join('\n\n')}\n`).toEqual([]);
  });

  it('never calls this add-on premium or pro in any locale’s own words', () => {
    // All eight bundles land in one built file, so the per-locale tables are
    // greped as one union here. This is what catches the spellings that contain
    // no banned ASCII fragment at all.
    const offenders: string[] = [];
    for (const file of built()) {
      const bytes = readFileSync(file, 'utf8');
      for (const { pattern, at } of tieringHitsIn(bytes)) {
        offenders.push(
          `${relative(file)} · /${pattern}/ · …${bytes.slice(Math.max(0, at - 70), at + 70)}…`,
        );
      }
    }
    expect(offenders, `\n${offenders.join('\n\n')}\n`).toEqual([]);
  });
});

/**
 * D11 OVER THE ARTEFACT, WHICH IS WHERE A MUTANT ACTUALLY REACHES.
 *
 * A sibling package's "no real third-party call" was once a grep for four
 * spellings. A verifier put `new Image(); img.src = "https://…"` into one of its
 * components and every gate in three repositories stayed green, all the way
 * into a live host app's bundle. The sources are checked in `sources.test.ts`;
 * these are the bytes, which is the last place it can be caught and the only
 * place a folded constant or a surviving comment shows up.
 *
 * NO ADDRESS AT ALL is the right allow-list for this add-on. It declares no
 * `network` block and no `outbound-http` capability, so the first URL to appear
 * in these bytes is a finding whatever it points at — including one written in
 * a COMMENT, because this build keeps comments inside expressions and a comment
 * in `dist/` is a byte in `dist/`.
 */
describe('nothing in the artefact can reach a host we do not control (24 D11)', () => {
  it('names no address at all, in any emitted file', () => {
    const offences = built().flatMap((file) =>
      offendingAddresses(readFileSync(file, 'utf8'), []).map((url) => `${relative(file)} → ${url}`),
    );
    expect(offences).toEqual([]);
  });

  it('carries nothing that can issue a request', () => {
    const offences = built().flatMap((file) => [
      ...sendersIn(readFileSync(file, 'utf8')).map((means) => `${relative(file)} → ${means}`),
      ...foreignImportsIn(readFileSync(file, 'utf8')).map((spec) => `${relative(file)} → ${spec}`),
    ]);
    expect(offences).toEqual([]);
  });

  it('reads something, so an empty result is never a pass', () => {
    expect(built().length).toBeGreaterThan(0);
    expect(readFileSync(join(ROOT, OUTPUT.client), 'utf8').length).toBeGreaterThan(10_000);
  });

  it('would report the mutant, which held none of the four words', () => {
    const mutant = 'const img=new Image();img.src="https://tracking.example-analytics.net/p?c="+c;';
    expect(offendingAddresses(mutant, [])).toEqual(['https://tracking.example-analytics.net/p?c=']);
    expect(sendersIn(mutant)).toEqual(['new Image — an image beacon']);
    expect(/fetch\(|XMLHttpRequest|new WebSocket|navigator\.sendBeacon/.test(mutant)).toBe(false);
  });
});

/**
 * ── AND NO CLOCK IN THE BYTES EITHER ───────────────────────────────────────
 *
 * `sources.test.ts` runs `impuritiesIn` over the sources and this add-on has no
 * server half for anything to hide in, so the source check is close to
 * complete. What it cannot see is a constant the bundler folded or a helper it
 * inlined.
 *
 * THE ASSERTION HERE IS THE ABSOLUTE ONE, which no sibling package can make:
 * every other add-on in this repository builds a `Date` at the seam where
 * `Intl.DateTimeFormat` demands one, and each has to carve that one call out.
 * This package formats no date at all — the one it prints is the ISO day the
 * host handed it, printed as it arrived — so the bundle may contain no `Date`
 * construction whatsoever. A sheet whose date could move would be a sheet
 * nobody could assert, and this is the last place that can be checked.
 */
describe('the artefact reads no clock and has no date in it at all', () => {
  it('constructs no Date, under any spelling', () => {
    /*
     * THE SHARED RULE, POINTED AT THE BYTES. `impuritiesIn` is the same
     * function `sources.test.ts` runs over the sources — imported rather than
     * respelled, because a private regular expression here would be a second
     * rule and `shared-rule.test.ts` reports it as one.
     */
    const client = readFileSync(join(ROOT, OUTPUT.client), 'utf8');
    expect(impuritiesIn(client)).toEqual([]);
    // …and the stricter half, which is this package's own: not even the
    // argument-taking construction the shared rule allows.
    expect(client).not.toContain('new Date(');
    expect(client).not.toContain('Date.UTC(');
  });
});
