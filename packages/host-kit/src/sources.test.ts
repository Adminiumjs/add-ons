/**
 * The rules this package is subject to as a package, rather than as a kit.
 *
 * ── WHY A KIT OF GUARDS NEEDS GUARDS OF ITS OWN ─────────────────────────────
 *
 * Everything else in `src/guards/` checks a HOST. This file checks the kit, and
 * it exists because the kit is the one package in this repo where "it is only
 * test code" is a tempting and wrong answer.
 *
 * Half of what is here is genuinely test-only — the guards run in a host's
 * suite and never reach a browser. The other half does not: `config.ts`,
 * `slot-content.ts`, `AddOnSlot.tsx`, `styles.ts` and `index.ts` are VENDORED
 * INTO EVERY HOST AND SHIPPED, which is the same relationship an add-on's
 * client half has to the two shops. A die or a real clock in `AddOnSlot.tsx`
 * would be a die in every host that installs the kit — twelve of them, if the
 * retrofit plan lands — which is a worse blast radius than any single add-on
 * has ever had.
 *
 * `host/src/shared-rule.test.ts` is what noticed this package was answering
 * neither of its two questions, and its header explains at length why a package
 * that never imports the shared rule has a determinism claim resting on
 * nothing. It was right about this package: the kit shipped with no caller at
 * all. This file is the repair, and it is deliberately modelled line for line
 * on `shipping-dhl/src/sources.test.ts` rather than invented, because a second
 * shape of purity suite is the beginning of the drift the shared rule exists to
 * end.
 *
 * ── THE ONE JUDGEMENT CALL, SAID OUT LOUD ───────────────────────────────────
 *
 * `SHIPPED` here means THE RUNTIME HALF ONLY — the five modules a host vendors
 * into `src/add-ons/kit/`. `src/guards/**` is excluded on exactly the precedent
 * every add-on package uses for its own `testing/` directory: it is test
 * scaffolding, it is vendored into a host's `src/testing/kit/` where nothing
 * shipped may import it, and it necessarily SPELLS the things it forbids —
 * a lexicon guard that could not write the word `free` could not test for it.
 *
 * That exclusion is only safe because something else holds the line: the
 * install script refuses to place a guard file anywhere but the testing tree,
 * and a host's own `sources.test.ts` asserts nothing shipped imports it. If
 * either of those ever stops being true, this exclusion becomes a hole and the
 * fix is to narrow it here rather than to argue about it there.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  impuritiesIn,
  RAW_CONTROL_EXPLANATION,
  rawControlOffences,
} from '@adminium/add-on-host/testing';

const SRC = new URL('.', import.meta.url).pathname;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const ALL = walk(SRC).filter((f) => /\.(ts|tsx)$/.test(f));

/**
 * The half a host vendors and ships. See the header for why `guards/` is not
 * in it and what has to stay true for that to remain honest.
 */
const SHIPPED = ALL.filter(
  (f) => !f.includes('.test.') && !f.includes(`${'guards'}/`),
);

const read = (file: string) => readFileSync(file, 'utf8');

/**
 * The source with its comments removed.
 *
 * Every rule below is about what the CODE does, and the comments explaining
 * those rules necessarily quote the very things they forbid — this file's own
 * prose would fail its own grep otherwise.
 */
const codeOf = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const relative = (file: string) => file.slice(SRC.length);

describe('the kit is discovered, not assumed', () => {
  /*
   * THE GUARD ON THIS GUARD. Every sweep below is a `flatMap` over `SHIPPED`,
   * and a `flatMap` over nothing returns `[]` — which reads exactly like a
   * clean pass. A renamed directory, a changed extension filter or a walk that
   * throws would disarm this entire file silently, which is the failure mode
   * every gate in this repo is required to close.
   */
  it('found the runtime half it claims to be checking', () => {
    expect(SHIPPED.length).toBeGreaterThan(0);
    expect(SHIPPED.map(relative).sort()).toEqual([
      'AddOnSlot.tsx',
      'config.ts',
      'index.ts',
      'slot-content.ts',
      'styles.ts',
    ]);
  });

  it('found the guards it is deliberately not checking', () => {
    // If this ever goes to zero the exclusion above has stopped excluding
    // anything, and the file would pass for the wrong reason.
    expect(ALL.filter((f) => f.includes(`${'guards'}/`)).length).toBeGreaterThan(0);
  });
});

describe('the runtime half is deterministic (24 D11)', () => {
  /*
   * THE RULE IS `@adminium/add-on-host/testing`, not a pattern written out
   * here. That is not a style preference: four add-on packages each wrote their
   * own, none of the four checked `crypto.getRandomValues`, and every one of
   * them was green while a die sat in a shipped module. See that package's
   * `testing/purity.ts`, and `host/src/shared-rule.test.ts` for the guard that
   * fails if this line ever turns back into a regex.
   *
   * It matters more here than in an add-on. `AddOnSlot` re-measures the DOM on
   * every mutation, and a clock or a die inside that path would make a host's
   * own slot-render suite flaky in a way that reads as a bad test rather than
   * as a bad component.
   */
  it('reads no real clock and rolls no dice', () => {
    const offenders = SHIPPED.flatMap((file) =>
      impuritiesIn(codeOf(file)).map((means) => `${relative(file)} → ${means}`),
    );
    expect(offenders).toEqual([]);
  });
});

describe('the runtime half writes no physical direction (10 §4)', () => {
  /*
   * The kit ships a stylesheet rule and a component that sets attributes, so it
   * is exactly the kind of code that reaches for `left`/`right` without
   * thinking. `ar-EG` is one of the eight locales every host carries, and a
   * physical direction here would be a mirrored layout in twelve apps.
   */
  it('uses logical properties only', () => {
    const offenders = SHIPPED.flatMap((path) =>
      rawControlOffences(relative(path), read(path)),
    );
    expect(offenders, `\n${RAW_CONTROL_EXPLANATION}\n${offenders.join('\n')}\n`).toEqual([]);
  });
});
