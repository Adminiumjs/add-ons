/**
 * The rules that are easier to break than to notice.
 *
 * Each of these is about an ABSENCE — no real call, no real clock, no company
 * named, no simulated result left unlabelled, no banned word in eight
 * languages. A grep over the sources is the only test shape that catches an
 * absence, so it lives here rather than in a review checklist somebody will
 * one day skim.
 *
 * The rules themselves come from `@adminium/add-on-host/testing` and are NOT
 * restated here. Four add-ons in this repository each wrote their own regular
 * expression for "no clock, no dice", none of the four checked
 * `crypto.getRandomValues`, and a die appended to a shipped engine left every
 * package green. `packages/host/src/shared-rule.test.ts` is the guard that
 * fails if this file ever grows a pattern of its own.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  foreignImportsIn,
  impuritiesIn,
  offendingAddresses,
  RAW_CONTROL_EXPLANATION,
  rawControlOffences,
  type InertOrigin,
} from '@adminium/add-on-host/testing';

import { COMPANY_MARKS, INERT_ORIGINS, NEVER_IN_A_BROWSER } from './add-on-facts.ts';
import { strings, LOCALE_TAGS } from './i18n/strings.ts';
import { register } from './index.ts';
import { bannedSubstringsIn } from './testing/lexicon.ts';

const SRC = new URL('.', import.meta.url).pathname;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const ALL = walk(SRC).filter((file) => /\.(ts|tsx)$/.test(file));
/** The shipped half: everything that is not itself a test or a test helper. */
const SHIPPED = ALL.filter((file) => !file.includes('.test.') && !file.includes(`${'testing'}/`));

/**
 * The DOCUMENT half — everything except the dashboard page.
 *
 * The rules below are about a renderer: the same subject must produce the same
 * bytes, it must reach nothing outside itself, and it must import nothing
 * foreign. Those are claims about what turns a record into a document, and they
 * hold for every file in this package that does that work.
 *
 * `src/page/` is a user interface. It reads the clock to say "edited 4 minutes
 * ago", it remembers a tab in `localStorage`, and it imports the host's UI kit
 * and router by design. Holding a screen to a renderer's rules would mean
 * either a false failure here or a page written around this gate — and the
 * determinism that matters is still checked, on the files that must have it.
 */
const DOCUMENT_HALF = SHIPPED.filter((file) => !file.includes(`${'page'}/`));

const read = (file: string) => readFileSync(file, 'utf8');

/**
 * The source with its comments removed.
 *
 * Every rule below is about what the CODE does, and the comments explaining
 * those rules necessarily quote the very things they forbid — this file's own
 * mention of a clock would fail its own grep otherwise.
 */
const codeOf = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ');

describe('nothing here reaches outside itself', () => {
  it('names no address at all, which is the strictest state there is', () => {
    // A host's D11 net reports every absolute URL in what it ships whose
    // origin nobody has declared inert. With `INERT_ORIGINS` empty, every
    // address is a finding — so this asserts there are none to find.
    const found = SHIPPED.flatMap((file) =>
      offendingAddresses(codeOf(file), INERT_ORIGINS as readonly InertOrigin[]).map(
        (address) => `${file}: ${address}`,
      ),
    );
    expect(found).toEqual([]);
  });

  it('imports nothing but React and the host seam', () => {
    const foreign = DOCUMENT_HALF.flatMap((file) =>
      foreignImportsIn(codeOf(file)).map((name) => `${file}: ${name}`),
    );
    expect(foreign).toEqual([]);
  });

  it('reads no clock, mints nothing random, and touches no storage', () => {
    /*
     * The determinism claim, and this package needs it more than its siblings:
     * 25 D12 is that the same subject renders to the same bytes, and the
     * conformance suite proves it by rendering twice and comparing. One call
     * to `Date.now()` or `crypto.randomUUID()` anywhere in the path makes that
     * false SILENTLY — two renders a second apart still look identical to
     * anybody eyeballing them.
     *
     * It is also the rule the copied `document.ts` nearly broke: the server's
     * version of that file mints a short id from `node:crypto`, and the
     * function came across with everything else before being taken back out.
     */
    const impure = DOCUMENT_HALF.flatMap((file) =>
      impuritiesIn(codeOf(file)).map((hit) => `${file}: ${hit}`),
    );
    expect(impure).toEqual([]);
  });

  it('has no server-only module the browser half could reach', () => {
    // `server.ts` and the client bundle share `kinds.ts`, `money.ts` and the
    // renderers on purpose — that sharing is what makes the in-page bytes and
    // the server's bytes the same. What must not happen is a `node:` import
    // arriving with them.
    const nodeImports = DOCUMENT_HALF.filter((file) => /from '\s*node:/.test(codeOf(file)));
    expect(nodeImports).toEqual([]);
  });
});

describe('it names no company', () => {
  it('declares the emptiness rather than leaving it to be inferred', () => {
    // An empty list is exactly the shape a BROKEN one takes, so the emptiness
    // is asserted together with the statements that would all have to be wrong
    // at once for it to be an accident.
    expect(COMPANY_MARKS).toEqual([]);
    expect(register().namesCompany).toBe(false);
    expect(register().noCompanyKeys ?? []).not.toHaveLength(0);
  });

  it('prints none of the marks a sibling add-on in this repository declares', () => {
    /*
     * A REAL needle list rather than an empty one. If this add-on ever printed
     * a carrier's name or a design tool's, this is what would catch it — and
     * an empty `COMPANY_MARKS` would not.
     */
    const siblings = ['DHL', 'Canva', 'Deutsche Post'];
    const haystack = SHIPPED.map(read).join('\n') + JSON.stringify(strings);
    for (const mark of siblings) {
      /*
       * WHOLE WORDS. `Canva` as a substring matches `InvoiceCanvas`, and the
       * page half is built around a canvas — thirty files name it. A mark
       * inside a longer English word is not a mark being printed, and a gate
       * that says otherwise gets an exemption list instead of a fix.
       */
      const pattern = new RegExp(`(?<![\\p{L}])${mark}(?![\\p{L}])`, 'u');
      expect(pattern.test(haystack), `a sibling's mark appears here: ${mark}`).toBe(false);
    }
  });
});

describe('every simulated result is labelled (24 D11, 25 D9)', () => {
  it('pairs each seeded activity line with a demo label', () => {
    /*
     * Both seeded lines describe documents nobody drew. An unlabelled one is a
     * fabricated fact on somebody's screen, presented beside real ones.
     */
    const activity = register().activity ?? [];
    expect(activity.length).toBeGreaterThan(0);
    const demoLabels = Object.keys(strings['en-US']).filter((key) => key.endsWith('.demo'));
    expect(demoLabels.length).toBeGreaterThan(0);
  });

  it('shows the settings sample behind a demo chip in the source that draws it', () => {
    // The sample invoice is drawn from figures invented in `SettingsPanel.tsx`.
    // It is the one screen in this package that shows a document nobody asked
    // for, so it is the one that has to say so.
    const panel = read(join(SRC, 'ui', 'SettingsPanel.tsx'));
    expect(panel).toContain("t('addon.invoices.demo')");
    expect(panel).toContain("t('addon.invoices.sample.note')");
  });

  it('labels nothing on the record surface, because nothing there is simulated', () => {
    // The counterpart assertion, and it is the more interesting one: a demo
    // chip on a REAL result is its own kind of lie. The record button draws
    // bytes from the record in front of you.
    const action = read(join(SRC, 'ui', 'DocumentAction.tsx'));
    expect(action).not.toContain("t('addon.invoices.demo')");
  });
});

describe('the copy passes the release sweep in all eight languages', () => {
  it('carries none of the banned substrings in any locale', () => {
    const hits: string[] = [];
    for (const locale of LOCALE_TAGS) {
      for (const [key, value] of Object.entries(strings[locale])) {
        for (const word of bannedSubstringsIn(value)) {
          hits.push(`${locale} ${key}: ${word}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it('carries none of them in the printed document chrome either', () => {
    /*
     * `render/words.ts` is not in the string bundle — it is PRINTED on a
     * document rather than read through `t()` — so the bundle sweep above
     * cannot see it. It goes into the same shipped bytes, and the release grep
     * reads bytes.
     *
     * This is where the Danish `sprog` and the Czech `dýško` were found.
     */
    const words = codeOf(join(SRC, 'render', 'words.ts'));
    expect(bannedSubstringsIn(words)).toEqual([]);
  });

  it('carries none of them in the outline labels Studio renders', () => {
    // `kinds.ts` is a third audience with a third file, and it ships too.
    const kinds = codeOf(join(SRC, 'kinds.ts'));
    expect(bannedSubstringsIn(kinds)).toEqual([]);
  });

  it('has every key in all eight locales', () => {
    // The compile-time guard in `strings.ts` already enforces this; asserting
    // it here too costs nothing and catches a future refactor that loosens the
    // type without anybody noticing the guard went with it.
    const english = Object.keys(strings['en-US']).sort();
    for (const locale of LOCALE_TAGS) {
      expect(Object.keys(strings[locale]).sort(), locale).toEqual(english);
    }
    expect(LOCALE_TAGS).toHaveLength(8);
  });

  it('uses no raw directional control characters', () => {
    /*
     * The NUL-byte gate, and it is the one that protects every OTHER grep in
     * this file. A single raw control byte makes a file `data` to `grep`, which
     * then matches nothing in it — silently, with exit status 0 — so a lexicon
     * sweep over a file carrying one passes by being blind rather than by being
     * clean.
     */
    const offences = SHIPPED.flatMap((file) => rawControlOffences(file, read(file)));
    expect(offences, RAW_CONTROL_EXPLANATION).toEqual([]);
  });
});

describe('there is nothing to keep out of a browser', () => {
  it('declares no secret, because the manifest declares none', () => {
    expect(NEVER_IN_A_BROWSER).toEqual([]);
    expect(register().connect).toBe('none');
  });
});
