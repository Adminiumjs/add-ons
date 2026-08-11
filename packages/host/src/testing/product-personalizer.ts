/**
 * `describeProductPersonalizer` — the conformance suite for
 * `product-personalizer@1`, mirrored from
 * `packages/add-on-contracts/src/testing/index.ts` in the Adminium monorepo.
 *
 * IT CARRIES THREE ASSERTIONS THE OTHER TWO CONTRACTS DO NOT NEED, and each of
 * them is a numbered acceptance criterion rather than a nicety:
 *
 *   AC17 — `render` is DETERMINISTIC. Same values, same angle ⇒ the same
 *   picture. This is what lets the cart thumbnail, the proof and the order line
 *   be one image instead of three that happen to look alike, and it is why
 *   D5c overruled comp L's `document.createElement("canvas").getContext("2d")`
 *   text measurement: canvas advances depend on the platform and on which fonts
 *   happen to be installed, so a preview measured that way is a different
 *   picture on a different machine.
 *
 *   AC18 — every FAILING verdict carries a remedy WITH A NUMBER. "It doesn't
 *   fit" is not a verdict, it is a shrug; the surface renders each remedy as a
 *   button and the number is what the button does.
 *
 *   AC19 — the production file carries OUTLINES, NEVER A FONT. The upstream
 *   suite checks the filename's extension, which catches an implementation that
 *   ships a `.otf` beside its geometry and nothing else. This mirror goes
 *   further where the implementation can let it: an optional `readProduction`
 *   fixture hands the suite the file's actual bytes, and the bytes are then
 *   checked for the things a font reference looks like in an SVG or a DXF —
 *   `font-family`, `@font-face`, a `<text>` element, a `.ttf`/`.otf`/`.woff`
 *   path. An implementation that cannot produce its bytes headlessly omits the
 *   fixture and gets the weaker check; the one in this repo supplies them.
 *
 * The strengthening is deliberate and is recorded here rather than pushed
 * upstream silently: the upstream suite is the floor every implementation must
 * clear, and this is the same floor with one plank a host-side reviewer can
 * actually stand on.
 */

import { describe, expect, it } from 'vitest';

import type {
  Personalization,
  ProductPersonalizer,
  ProductRef,
  Template,
} from '../contracts/product-personalizer.ts';
import { personalizationSchema, templateSchema } from './schemas.ts';

export interface ProductPersonalizerFixtures {
  product: ProductRef;
  template: Template;
  /** Values that fit every zone. */
  valid: Personalization;
  /** Values that overrun at least one zone — must yield a numbered remedy. */
  overrun: Personalization;
  angle: string;
  /**
   * The production file's own bytes, for the implementations that can produce
   * them without a browser. Omit and AC19 falls back to the filename check.
   */
  readProduction?: (fileId: string) => string | Promise<string>;
}

/**
 * What a font reference looks like in a machine file, in the formats v1 emits.
 *
 * EXPORTED, AND THE EXPORT IS THE FIX. This list and the one in the
 * personalizer's own `template.test.ts` were written a day apart and then
 * drifted: this one grew `\bfont-weight\b` — the pattern that catches an
 * implementation styling a `<tspan>` rather than naming a family — and the
 * engine's suite kept checking four. Two lists for one rule means the weaker
 * one is the real gate wherever it runs first, and nothing anywhere compares
 * them. An implementation that wants the same rule imports it from here.
 */
export const FONT_REFERENCE: readonly RegExp[] = [
  /font-family/i,
  /@font-face/i,
  /<text\b/i,
  /\.(ttf|otf|woff2?)\b/i,
  /\bfont-weight\b/i,
  /*
   * THE SHORTHAND, WHICH THE FIVE ABOVE DO NOT CATCH.
   *
   * `style="font: bold 12px Inter"` sets a family, a weight and a size in one
   * declaration, and it is `font`, not `font-family` or `font-weight` — so a
   * production file carrying it cleared all five patterns. Latent rather than
   * shipped: the real file this checks is 9045 bytes of `<path>` with no text
   * element in it at all, which is exactly why nobody would have noticed the
   * hole until an implementation started using the shorthand.
   *
   * Anchored on the colon and on a word boundary because `font` is a prefix of
   * every longhand: `font-family` must not match here as well and be reported
   * twice, and `--brand-font: …` is a custom property naming a font and not a
   * declaration setting one — though it, too, would be caught by the family
   * pattern the moment it were used.
   */
  /(?<![\w-])font\s*:/i,
];

export function describeProductPersonalizer(
  impl: ProductPersonalizer,
  fixtures: ProductPersonalizerFixtures,
): void {
  describe(`product-personalizer@1 conformance — ${impl.key}`, () => {
    it('has a non-empty key', () => {
      expect(impl.key).toMatch(/^[a-z][a-z0-9-]*$/);
    });

    it('reports availability as data, never as an exception', () => {
      expect(impl.available(fixtures.product).ok).toBe(true);
    });

    it('is fixtured with a template of the declared shape', () => {
      const parsed = templateSchema.safeParse(fixtures.template);
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    });

    it('accepts a personalization of the declared shape', () => {
      const parsed = personalizationSchema.safeParse(fixtures.valid);
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    });

    it('passes every zone for values that fit', () => {
      const verdicts = impl.validate(fixtures.valid, fixtures.template);
      expect(verdicts.length).toBeGreaterThan(0);
      expect(
        verdicts.filter((v) => !v.ok),
        'the "valid" fixture should not fail a zone',
      ).toEqual([]);
    });

    /** AC18 — and the reason a bare "doesn't fit" is a contract violation. */
    it('gives every failing verdict a reason and at least one remedy WITH a number', () => {
      const verdicts = impl.validate(fixtures.overrun, fixtures.template);
      const failures = verdicts.filter((v) => !v.ok);
      expect(failures.length).toBeGreaterThan(0);
      for (const failure of failures) {
        if (failure.ok) continue;
        expect(failure.reason.trim().length).toBeGreaterThan(0);
        const { setSizeMm, shortenToChars } = failure.remedies;
        expect(
          typeof setSizeMm === 'number' || typeof shortenToChars === 'number',
          `zone ${failure.zone} failed with no numbered remedy`,
        ).toBe(true);
        if (typeof setSizeMm === 'number') expect(setSizeMm).toBeGreaterThan(0);
        if (typeof shortenToChars === 'number') expect(shortenToChars).toBeGreaterThanOrEqual(0);
      }
    });

    /** AC17, both halves: equal input ⇒ equal picture, different ⇒ different. */
    it('renders deterministically — same values and angle give the same picture', async () => {
      const a = await impl.render(fixtures.valid, { angle: fixtures.angle, widthPx: 480 });
      const b = await impl.render(fixtures.valid, { angle: fixtures.angle, widthPx: 480 });
      expect(b.digest).toBe(a.digest);
      expect(b.fileId).toBe(a.fileId);
      expect(a.angle).toBe(fixtures.angle);
      expect(a.widthPx).toBe(480);
    });

    it('renders a different picture for different values', async () => {
      const a = await impl.render(fixtures.valid, { angle: fixtures.angle, widthPx: 480 });
      const b = await impl.render(fixtures.overrun, { angle: fixtures.angle, widthPx: 480 });
      expect(b.digest).not.toBe(a.digest);
    });

    /** AC19 — outlines, not fonts. */
    it('produces a production file that names no font', async () => {
      const file = await impl.productionFile(fixtures.valid);
      expect(file.bytes).toBeGreaterThan(0);
      expect(file.filename).not.toMatch(/\.(ttf|otf|woff2?)$/i);

      if (fixtures.readProduction === undefined) return;
      const body = await fixtures.readProduction(file.fileId);
      expect(body.length).toBeGreaterThan(0);
      for (const pattern of FONT_REFERENCE) {
        expect(
          pattern.test(body),
          `the production file matches ${pattern} — text must come out as outlines`,
        ).toBe(false);
      }
      // …and it does contain geometry, so "no font" is not passing by being empty.
      expect(body).toMatch(/<path\b/i);
    });
  });
}
