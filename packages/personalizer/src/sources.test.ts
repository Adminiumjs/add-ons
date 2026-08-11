/**
 * The rules that are easier to break than to notice.
 *
 * Several of this wave's non-negotiables are about an ABSENCE — no real call,
 * no real clock, no physical CSS direction, no 3D anywhere near the preview —
 * and an absence is invisible in review. This suite greps this package's own
 * `src/` for each of them, so the claim is checked rather than remembered.
 *
 * `built-output.test.ts` does the same over `dist/`, because criterion 16 asks
 * for the BUNDLE and a source check cannot see what a dependency dragged in.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  foreignImportsIn,
  impuritiesIn,
  offendingAddresses,
  sendersIn,
  type InertOrigin,
} from '@adminium/add-on-host/testing';

import { INERT_ORIGINS } from './add-on-facts.ts';

const SRC = fileURLToPath(new URL('.', import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const ALL = walk(SRC);
const relative = (file: string) => file.slice(SRC.length);

/** Everything the bundle can reach: not a test, not a test helper. */
const SHIPPABLE = ALL.filter(
  (file) => /\.tsx?$/.test(file) && !file.includes('.test.') && !file.includes(`${'testing'}/`),
);
const STYLES = ALL.filter((file) => file.endsWith('.css'));

/** Comments stripped — every rule below is about what the CODE does. */
const codeOf = (file: string) =>
  readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * The one address this add-on names, and why it can never cause a request.
 *
 * `template.ts` writes an `<svg xmlns="http://www.w3.org/2000/svg">` because
 * that is how an SVG document declares which language it is written in. An XML
 * namespace is an IDENTIFIER: no agent dereferences it, and the W3C's own
 * documents say so. Nothing else here is allowed a URL — this add-on declares
 * no `network` block and has nowhere to send anything.
 */
/**
 * READ OFF THE ADD-ON'S OWN DECLARATION, never written out here.
 *
 * `add-on-facts.ts` carries the reasoning: an address this package names is a
 * fact about this package, and both hosts discover it by vendoring the file
 * rather than by keeping a copy of it in an exemption list of their own.
 * Declaring it there and asserting it here is what keeps the two in step —
 * this suite is the one that fails if an origin is declared and then named
 * nowhere, or named and not declared.
 */
const INERT: readonly InertOrigin[] = INERT_ORIGINS;

describe('the add-on calls nothing and reads no clock (24 D11, D5c)', () => {
  /*
   * D11 AS A RULE, NOT A WORD LIST. This was a grep for five spellings until a
   * verifier put `new Image(); img.src = "https://…"` into a sibling package
   * and every gate in three repos stayed green. See `egress.ts` in
   * `@adminium/add-on-host/testing`: an ADDRESS nobody declared inert, an API
   * whose only purpose is to issue a request, and — in the hosts, which have a
   * page to render — the VALUE handed to every URL sink at run time.
   */
  it('names no address outside the ones declared inert', () => {
    const offenders = [...SHIPPABLE, ...STYLES].flatMap((file) =>
      offendingAddresses(codeOf(file), INERT).map((url) => `${relative(file)} → ${url}`),
    );
    expect(offenders).toEqual([]);
  });

  it('carries nothing that can issue a request', () => {
    const offenders = SHIPPABLE.flatMap((file) => [
      ...sendersIn(codeOf(file)).map((means) => `${relative(file)} → ${means}`),
      ...foreignImportsIn(codeOf(file)).map((spec) => `${relative(file)} → ${spec}`),
    ]);
    expect(offenders).toEqual([]);
  });

  /**
   * THE ONE THAT MAKES CRITERION 17 POSSIBLE. A clock or a dice roll anywhere
   * in the engine and the picture stops being a function of its values, which
   * is the whole determinism claim.
   */
  it('reads no clock and rolls no dice', () => {
    /*
     * THE RULE IS `@adminium/add-on-host/testing` NOW, not a pattern written
     * out here. The private copy that used to stand on this line is the one the
     * final pass proved blind: appending
     *
     *     export const zzSeed = crypto.getRandomValues(new Uint8Array(4))[0];
     *
     * to `template.ts` — the engine this criterion rests on — left this package
     * at 157 of 157 green and compiled the die into both bundles. See
     * `host/src/shared-rule.test.ts` for the guard that now fails if this line
     * turns back into a regex.
     */
    const offenders = SHIPPABLE.flatMap((file) =>
      impuritiesIn(codeOf(file)).map((means) => `${relative(file)} → ${means}`),
    );
    expect(offenders).toEqual([]);
  });

  /**
   * AND ONE THING BEYOND THE SHARED RULE, WHICH IS WHY IT IS A SEPARATE TEST.
   *
   * `new Date(x)` with an argument is deliberately allowed by the shared rule —
   * it is arithmetic over a value the caller passed in, and it is how the other
   * three add-ons write a pinned instant. This add-on has no instants at all:
   * a template, a set of zones and some typed words, none of which is a date.
   * So the stricter claim holds here and is worth keeping, but it is stated as
   * an EXTRA rather than as a rival copy of the rule above — a plain substring,
   * not a pattern, so nobody reading it mistakes it for the rule.
   */
  it('constructs no date at all, which is stricter than the shared rule asks', () => {
    const offenders = SHIPPABLE.filter((file) => codeOf(file).includes('new Date'));
    expect(offenders.map(relative)).toEqual([]);
  });

  it('pulls in no Node built-in, because this runs in a browser', () => {
    const offenders = SHIPPABLE.filter((file) => /from\s*['"]node:/.test(codeOf(file)));
    expect(offenders.map(relative)).toEqual([]);
  });

  it('imports nothing at runtime the host does not already have (D7)', () => {
    const allowed = /^(react|react-dom|react\/jsx-runtime|lucide-react|@adminium\/add-on-host(\/contracts)?)$/;
    const offenders: string[] = [];
    for (const file of SHIPPABLE) {
      // ANCHORED AT AN IMPORT STATEMENT, not at the word `from`. The string
      // bundle contains English prose — "Shown from", "come back from" — and a
      // bare `from '…'` pattern read those as module specifiers, which is a
      // guard that fails on correct code and would have been turned off.
      for (const [, spec] of codeOf(file).matchAll(
        /^\s*(?:import|export)[^'"]*\bfrom\s*['"]([^.'"][^'"]*)['"]/gm,
      )) {
        if (!allowed.test(spec)) offenders.push(`${relative(file)} → ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

/**
 * D5c, as a grep. The whole reason the metric table is committed is that comp
 * L measured text with a canvas and a canvas measures differently on different
 * machines. A `getContext("2d")` reappearing anywhere in this package would put
 * that back without anybody noticing, because it would still LOOK right.
 */
describe('the engine measures from the table, never from the DOM (D5c)', () => {
  it('creates no canvas and measures no text with one', () => {
    const offenders = SHIPPABLE.filter((file) =>
      /getContext\s*\(|measureText\s*\(|new OffscreenCanvas|document\.fonts/.test(codeOf(file)),
    );
    expect(
      offenders.map(relative),
      'text metrics come from the committed table in faces.ts (24 D5c)',
    ).toEqual([]);
  });

  /**
   * The engine proper touches no DOM at all. The UI does — it is React — so
   * this is aimed at the four modules that must stay pure, by name, because
   * that is what makes them testable headlessly and what D9 asks for.
   */
  it('keeps the engine modules free of the document entirely', () => {
    const ENGINE = ['template.ts', 'faces.ts', 'glyphs.ts', 'pieces.ts', 'seed.ts', 'store.ts'];
    for (const name of ENGINE) {
      const file = SHIPPABLE.find((candidate) => relative(candidate) === name);
      expect(file, `${name} is missing`).toBeDefined();
      expect(/\bdocument\b|\bwindow\b|\bnavigator\b/.test(codeOf(file!)), name).toBe(false);
    }
  });
});

/**
 * D18: the preview is a 2D composite and stays one. This is criterion 16's
 * source half — the bundle half is in `built-output.test.ts`, because a
 * dependency could drag any of these in without a line of ours mentioning it.
 */
describe('the preview is 2D and stays 2D (24 D18, AC16)', () => {
  it('has no WebGL context, no mesh, no model format anywhere', () => {
    const FORBIDDEN = /webgl|WebGLRenderingContext|from\s*['"]three|\bgltf\b|\.stl\b|BufferGeometry|THREE\./i;
    const offenders = SHIPPABLE.filter((file) => FORBIDDEN.test(codeOf(file)));
    expect(offenders.map(relative)).toEqual([]);
  });

  it('draws with SVG, which is what the 2D composite is made of', () => {
    const engine = readFileSync(join(SRC, 'template.ts'), 'utf8');
    expect(engine).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
  });
});

/**
 * CSS LOGICAL PROPERTIES ONLY. The whole surface mirrors for Arabic with no RTL
 * stylesheet, and a single `margin-left` is enough to break one panel in one
 * language, which is exactly the kind of thing nobody notices until a reader
 * complains.
 */
describe('the stylesheet is direction-agnostic', () => {
  const PHYSICAL =
    /(^|[^-\w])(margin|padding|border)-(left|right)\b|(^|[^-\w])(left|right|width|height)\s*:/;

  it('uses logical properties everywhere', () => {
    const offenders: string[] = [];
    for (const file of STYLES) {
      const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
      for (const line of css.split('\n')) {
        // `max-width` inside a media query is a viewport question, not a
        // direction one, and there is no logical form of it.
        if (line.includes('@media')) continue;
        if (PHYSICAL.test(line)) offenders.push(`${relative(file)} · ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('prefixes every class so it cannot restyle whichever host mounts it', () => {
    for (const file of STYLES) {
      const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
      // A class name starts with a letter. `scale(.97)` does not, and a
      // pattern that read it as one would fail on a transform.
      const classes = [...css.matchAll(/\.([A-Za-z][\w-]*)/g)].map((match) => match[1]!);
      for (const name of new Set(classes)) {
        expect(name.startsWith('lp-') || name === 'lp', `.${name} is not prefixed`).toBe(true);
      }
    }
  });
});

describe('D10c — it names no other online marketplace, in code or comment', () => {
  it('mentions none, anywhere in the package', () => {
    const MARKETPLACES = /\betsy\b|\bshopify\b|\bebay\b|notonthehighstreet|\bfolksy\b/i;
    // The SUITES name them — that is what a grep for them looks like — so the
    // check is over what ships, which is the thing the ruling is about.
    const offenders = ALL.filter(
      (file) =>
        /\.(tsx?|css|json|md|html)$/.test(file) &&
        !file.includes('.test.') &&
        MARKETPLACES.test(readFileSync(file, 'utf8')),
    );
    expect(offenders.map(relative)).toEqual([]);
  });
});
