/**
 * The engine's own suite (24 D9 — every engine ships its vitest suite in the
 * same commit).
 *
 * IT DRIVES THE SAMPLE PERSONALIZATIONS rather than values invented per case,
 * so the wording that overruns in a suite is the wording that overruns on the
 * screen. They are named for what each one shows — `sampleThat('overruns')` —
 * rather than for a particular shop's order reference, which is what they used
 * to be named for and which was never true of any second host.
 *
 * The four things this file exists to prove, in the order the criteria are
 * numbered:
 *
 *   17 — the picture is byte-identical for identical values, and different for
 *        different ones, wherever it is drawn.
 *   18 — no failing verdict without a remedy AND its number, and the numbers
 *        are the ones that actually work: applying a remedy makes the next
 *        verdict pass.
 *   19 — the production file carries outlines and names no font.
 *   D18 — the preview is 2D. No WebGL, no mesh, no `.stl`, in the source and in
 *        the bundle (`sources.test.ts` and `built-output.test.ts` carry that
 *        half; this file asserts the shape of what is drawn).
 */

import { FONT_REFERENCE } from '@adminium/add-on-host/testing';
import { describe, expect, it } from 'vitest';

import { FACE_IDS, FACES, faceOf, lineWidthMm } from './faces.ts';
import { GLYPHS, hasGlyph, outlinePolyline, SUBSTITUTES } from './glyphs.ts';
import { PIECES } from './pieces.ts';
import {
  COASTER_TEMPLATE,
  PIECE_NAME_KEYS,
  SIGN_TEMPLATE,
  TEMPLATES,
  sampleFor,
  sampleThat,
} from './seed.ts';
import { LOCALE_TAGS, personalizerStrings, type MessageKey } from './i18n/strings.ts';
import {
  check,
  digestOf,
  esc,
  fit,
  isRequired,
  previewSvg,
  productionSvg,
  remediesFor,
  settingsFor,
  toProductionPaths,
  type Personalization,
} from './template.ts';

const TOP = COASTER_TEMPLATE.zones[0]!;
const DATE = COASTER_TEMPLATE.zones[1]!;

const withValues = (values: Record<string, string>, over: Partial<Personalization> = {}) => ({
  templateId: 'walnut-coasters',
  values,
  font: 'fenwick',
  sizeMm: 7,
  finish: 'engraved' as const,
  ...over,
});

// ── the measured table ──────────────────────────────────────────────────────

describe('the measured face table', () => {
  it('carries every printable ASCII code for all five faces', () => {
    for (const face of Object.values(FACES)) {
      expect(face.advance, face.id).toHaveLength(95);
      expect(face.advance.every((n) => n > 0), `${face.id} has a zero advance`).toBe(true);
    }
  });

  it('measures in cap height, so "eleven millimetres" is what a rule reads', () => {
    // A capital H at 11 mm stands 11 mm tall in every face, whatever each
    // face's own relationship between cap height and type size happens to be.
    // That is the whole reason `advanceMm` divides by `cap` rather than taking
    // the size as an em.
    for (const face of Object.values(FACES)) {
      const emAt11 = 11 / (face.cap / 1000);
      expect(emAt11).toBeGreaterThan(11);
    }
  });

  it('gives a wider face wider words, which is what a shopper is choosing between', () => {
    const width = (id: string) => lineWidthMm('The Hartleys', faceOf(id), 7);
    // Alder is the narrowest of the five at this size and Fenwick the widest.
    // Quarry sits between them DESPITE being the condensed face, because it is
    // cut only in capitals and measures "THE HARTLEYS" — which is the sort of
    // thing a table of five real measurements says and a table of five copies
    // of one row could not.
    expect(width('alder')).toBeLessThan(width('row'));
    expect(width('row')).toBeLessThan(width('quarry'));
    expect(width('quarry')).toBeLessThan(width('fenwick'));
  });

  it('has no letter for a character the studio cannot cut, and says so rather than guessing', () => {
    expect(hasGlyph('é')).toBe(false);
    expect(hasGlyph('中')).toBe(false);
    expect(hasGlyph('A')).toBe(true);
    expect(hasGlyph(' ')).toBe(true);
  });
});

// ── fit, and the remedies with their numbers (AC18) ─────────────────────────

describe('fit', () => {
  it('fits the seeded line that is meant to fit, and reports its width', () => {
    const f = fit('The Hartleys', TOP, faceOf('fenwick'), 7);
    expect(f.fits).toBe(true);
    if (f.fits) {
      expect(f.widthMm).toBeLessThanOrEqual(TOP.shape.wMm);
      expect(f.widthMm).toBeGreaterThan(40);
      expect(f.fine).toBe(false);
    }
  });

  /**
   * THE CRITERION, BY NAME. `BR-2284` asks for "The Ellingham-Brookes" at 7 mm
   * on a 75 mm area — 123 mm of words — and the answer is not "it doesn't fit":
   * it is both ways out, each with the number that makes it work.
   */
  it('turns an overrun into TWO remedies, both carrying a number', () => {
    const f = fit('The Ellingham-Brookes', TOP, faceOf('fenwick'), 7);
    expect(f.fits).toBe(false);
    if (f.fits) return;

    expect(f.overMm).toBeGreaterThan(0);
    expect(f.overChars).toBeGreaterThan(0);
    expect(typeof f.remedies.setSizeMm).toBe('number');
    expect(typeof f.remedies.shortenToChars).toBe('number');
    // Half millimetres, because that is what a rule reads and what the stepper
    // offers. A remedy the size control cannot express is not a remedy.
    expect((f.remedies.setSizeMm! * 2) % 1).toBe(0);
  });

  it('offers remedies that WORK — applying either one makes the next fit pass', () => {
    const text = 'The Ellingham-Brookes';
    const f = fit(text, TOP, faceOf('fenwick'), 7);
    if (f.fits) throw new Error('the fixture stopped overrunning');

    const smaller = fit(text, TOP, faceOf('fenwick'), f.remedies.setSizeMm!);
    expect(smaller.fits, 'the size remedy did not fit').toBe(true);

    const shorter = fit(
      [...text].slice(0, f.remedies.shortenToChars!).join(''),
      TOP,
      faceOf('fenwick'),
      7,
    );
    expect(shorter.fits, 'the shorten remedy did not fit').toBe(true);
  });

  it('offers the LARGEST size that works, not merely a size that works', () => {
    const f = fit('The Ellingham-Brookes', TOP, faceOf('fenwick'), 7);
    if (f.fits) throw new Error('the fixture stopped overrunning');
    const at = f.remedies.setSizeMm!;
    expect(fit('The Ellingham-Brookes', TOP, faceOf('fenwick'), at + 0.5).fits).toBe(false);
  });

  it('offers the LONGEST prefix that works, not merely a prefix that works', () => {
    const text = 'The Ellingham-Brookes';
    const f = fit(text, TOP, faceOf('fenwick'), 7);
    if (f.fits) throw new Error('the fixture stopped overrunning');
    const n = f.remedies.shortenToChars!;
    expect(fit([...text].slice(0, n + 1).join(''), TOP, faceOf('fenwick'), 7).fits).toBe(false);
  });

  it('does not offer to shorten a line that is too TALL, because shortening cannot help', () => {
    // A one-character line at a size far above the area's height: no amount of
    // shortening changes how tall a letter stands, and a button that did
    // nothing would be exactly the defect this contract is written against.
    const f = fit('M', { ...DATE, constraints: { ...DATE.constraints } }, faceOf('row'), 40);
    expect(f.fits).toBe(false);
    if (f.fits) return;
    expect(f.remedies.shortenToChars).toBeUndefined();
    expect(typeof f.remedies.setSizeMm).toBe('number');
  });

  it('never returns a failure with no remedy at all', () => {
    const cases: [string, number][] = [
      ['The Ellingham-Brookes', 7],
      ['MMMMMMMMMMMMMMMMMMMMMMMM', 9],
      ['W', 60],
      ['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 5],
    ];
    for (const [text, size] of cases) {
      for (const zone of [TOP, DATE]) {
        const f = fit(text, zone, faceOf('quarry'), size);
        if (f.fits) continue;
        const { setSizeMm, shortenToChars } = f.remedies;
        expect(
          typeof setSizeMm === 'number' || typeof shortenToChars === 'number',
          `"${text}" at ${size} mm in ${zone.id} failed with nothing to offer`,
        ).toBe(true);
      }
    }
  });

  it('warns rather than refuses below the face’s smallest comfortable size', () => {
    const f = fit('est. 2019', DATE, faceOf('alder'), 4);
    expect(f.fits).toBe(true);
    if (f.fits) expect(f.fine).toBe(true);
  });
});

// ── the whole personalization ───────────────────────────────────────────────

describe('check', () => {
  it('passes the seeded order that is meant to pass', () => {
    const { verdicts, blocks } = check(sampleThat('comfortable'), COASTER_TEMPLATE);
    expect(verdicts.filter((v) => !v.ok)).toEqual([]);
    expect(blocks).toEqual([]);
  });

  it('fails the seeded order that is meant to overrun, with numbers', () => {
    const { verdicts } = check(sampleThat('overruns'), COASTER_TEMPLATE);
    const failed = verdicts.filter((v) => !v.ok);
    expect(failed).toHaveLength(1);
    const only = failed[0]!;
    if (only.ok) return;
    expect(only.zone).toBe(COASTER_TEMPLATE.zones[0]!.id);
    expect(only.remedies.setSizeMm).toBeGreaterThan(0);
    expect(only.remedies.shortenToChars).toBeGreaterThan(0);
  });

  it('counts characters against the area’s own limit before it measures anything', () => {
    const { verdicts } = check(withValues({ [TOP.id]: 'x'.repeat(30) }), COASTER_TEMPLATE);
    const failed = verdicts.find((v) => !v.ok);
    expect(failed).toBeDefined();
    if (failed === undefined || failed.ok) return;
    // The remedy is the LIMIT, which is the number the counter beside the field
    // is already showing — not a width the shopper cannot see.
    expect(failed.remedies.shortenToChars).toBe(24);
  });

  /*
   * ── A MARK WITH NO SHAPE, AND ITS THREE HONEST ANSWERS ─────────────────────
   *
   * There used to be ONE answer to all of them — "shorten it to N", where N is
   * the index of the first character the alphabet has no shape for — and it was
   * right in only one of the three cases below. In the second it deleted the
   * back half of somebody's surname because their keyboard chose a rounder
   * apostrophe. In the third N was nought: the surface drew "Shorten it to 0"
   * beside "everything before it is fine", both false, and pressing it emptied
   * the field and tripped the empty-area refusal. An Arabic shopper typing
   * their own name got that on the FIRST KEYSTROKE.
   */
  it('offers the cut before a letter it has no plain form of', () => {
    const { verdicts, detail } = check(withValues({ [TOP.id]: 'Café Row' }), COASTER_TEMPLATE);
    const failed = verdicts.find((v) => !v.ok);
    expect(failed).toBeDefined();
    if (failed === undefined || failed.ok) return;
    expect(failed.remedies.shortenToChars).toBe(3);

    const entry = detail.find((d) => d.code === 'no-letter-stuck');
    expect(entry?.chars).toEqual(['é']);
    expect(remediesFor(entry!)).toEqual([{ kind: 'shorten', chars: 3 }]);
  });

  it('offers the substitution, not the deletion, for a mark it has a plain form of', () => {
    // O’Brien with the typographic apostrophe every phone and word processor
    // inserts, and an em dash. A top-ten engraving request; the old answer was
    // "shorten it to 1".
    const { detail } = check(withValues({ [TOP.id]: 'O’Brien — 2019' }), COASTER_TEMPLATE);
    const entry = detail.find((d) => !d.ok);
    expect(entry?.code).toBe('no-letter');
    expect(remediesFor(entry!)).toEqual([
      { kind: 'swap', from: '’', to: "'" },
      { kind: 'swap', from: '—', to: '-' },
    ]);

    // AND APPLYING THEM ALL CLEARS IT, which is the only thing that makes them
    // remedies rather than suggestions. Nothing of what was typed is lost.
    let text = 'O’Brien — 2019';
    for (const remedy of remediesFor(entry!)) {
      if (remedy.kind === 'swap') text = text.split(remedy.from).join(remedy.to);
    }
    expect(text).toBe("O'Brien - 2019");
    expect(check(withValues({ [TOP.id]: text }), COASTER_TEMPLATE).verdicts.filter((v) => !v.ok))
      .toEqual([]);
  });

  it('refuses in words when the first character is one it cannot cut', () => {
    const { verdicts, detail, blocks } = check(withValues({ [TOP.id]: 'مرحبا' }), COASTER_TEMPLATE);
    const failed = verdicts.find((v) => !v.ok);
    expect(failed).toBeDefined();
    if (failed === undefined || failed.ok) return;
    // NO NUMBER, because there is no prefix to keep. "Shorten it to 0" is a
    // button that empties the field, which is not a way out of anything.
    expect(failed.remedies.shortenToChars).toBeUndefined();
    expect(remediesFor(detail.find((d) => !d.ok)!)).toEqual([]);
    expect(blocks).toContainEqual({
      zone: TOP.id,
      code: 'no-letter',
      chars: ['م', 'ر', 'ح', 'ب', 'ا'],
    });
  });

  /**
   * THE INVARIANT THAT MAKES CRITERION 18 ABSOLUTE, said once over the whole
   * engine rather than case by case.
   *
   * Every failing verdict either carries at least one way out, or is refused in
   * words by a `Block` on the same area. There is no third state — and the
   * third state is exactly what shipped: a verdict with an empty `remedies`,
   * rendered as a sentence with nothing under it.
   */
  /**
   * A REMEDY IS A NUMBER YOU CAN APPLY TO THE STRING THE BUTTON SLICES.
   *
   * Both shortening numbers were computed over the SHAPED text — what an
   * uppercase-only face turns the wording into — and both are applied by the
   * surface to the RAW text. The two are the same length for every character in
   * Unicode but one: German `ß` uppercases to `SS`. On the house sign, which
   * offers `quarry`, "Straße é" shapes to nine characters and is eight, so the
   * cut computed at 8 sliced nothing off and the shopper pressed a button that
   * visibly did nothing.
   *
   * The case walks every face, because the defect is invisible on four of five.
   */
  it('offers a cut that lands, on an uppercase-only face and a lower-case one', () => {
    for (const face of FACE_IDS) {
      for (const text of ['Straße é', 'Weiß & Söhne', 'Café Row', 'The Ellingham-Brookes']) {
        const zone = SIGN_TEMPLATE.zones[0]!;
        const { detail } = check(
          { templateId: 'house-sign', values: { [zone.id]: text }, font: face, sizeMm: 22 },
          SIGN_TEMPLATE,
        );
        for (const entry of detail) {
          if (entry.ok) continue;
          for (const remedy of remediesFor(entry)) {
            if (remedy.kind !== 'shorten') continue;
            const cut = [...text].slice(0, remedy.chars).join('');
            expect(cut.length, `${face}/${text}: the cut removed nothing`).toBeLessThan(text.length);
            // …and it removed the thing it was offered for.
            const after = check(
              { templateId: 'house-sign', values: { [zone.id]: cut }, font: face, sizeMm: 22 },
              SIGN_TEMPLATE,
            );
            expect(
              after.detail.find((d) => !d.ok)?.code,
              `${face}/${text}: “${cut}” still fails the same way`,
            ).not.toBe(entry.code);
          }
        }
      }
    }
  });

  it('never fails an area without either a remedy or a block on it', () => {
    const values = [
      'Café Row',
      'O’Brien — 2019',
      'مرحبا',
      'The Ellingham-Brookes',
      'x'.repeat(30),
      'M'.repeat(24),
      '',
      '“Quoted” · 2019',
      'Ω',
      'A é ’',
    ];
    for (const text of values) {
      const { detail, blocks } = check(withValues({ [TOP.id]: text }), COASTER_TEMPLATE);
      for (const entry of detail) {
        if (entry.ok) continue;
        const remedied = remediesFor(entry).length > 0;
        const blocked = blocks.some((block) => block.zone === entry.zone);
        expect(remedied || blocked, `“${text}” fails ${entry.code} with no way out`).toBe(true);
        // And no remedy is ever the one that empties the field.
        for (const remedy of remediesFor(entry)) {
          if (remedy.kind === 'shorten') expect(remedy.chars, text).toBeGreaterThan(0);
        }
      }
    }
  });

  /**
   * A BLOCK IS NOT A VERDICT, and this is the assertion that keeps criterion 18
   * absolute. An empty required area has no number to offer, so it stops the
   * basket instead of producing a verdict with an empty `remedies`.
   */
  it('blocks an empty required area rather than returning a numberless verdict', () => {
    const { verdicts, blocks } = check(withValues({ [DATE.id]: 'est. 2019' }), COASTER_TEMPLATE);
    expect(blocks).toEqual([{ zone: TOP.id, code: 'required-empty' }]);
    expect(verdicts.filter((v) => !v.ok)).toEqual([]);
    expect(isRequired(TOP)).toBe(true);
    expect(isRequired(DATE)).toBe(false);
  });

  it('leaves an optional area empty without complaint', () => {
    const { verdicts, blocks } = check(withValues({ [TOP.id]: 'The Hartleys' }), COASTER_TEMPLATE);
    expect(blocks).toEqual([]);
    expect(verdicts.filter((v) => !v.ok)).toEqual([]);
  });

  it('falls back to a font the area allows when asked for one it does not', () => {
    const { face } = settingsFor(withValues({}, { font: 'quarry' }), TOP);
    expect(TOP.constraints.fonts).not.toContain('quarry');
    expect(face.id).toBe('fenwick');
  });

  it('clamps a size outside the area’s range instead of drawing outside it', () => {
    expect(settingsFor(withValues({}, { sizeMm: 90 }), TOP).capMm).toBe(9);
    expect(settingsFor(withValues({}, { sizeMm: 1 }), TOP).capMm).toBe(4);
  });
});

// ── the picture (AC17) ──────────────────────────────────────────────────────

describe('the preview', () => {
  const line = sampleThat('comfortable');

  it('is byte-identical for identical values and angle', () => {
    const a = previewSvg(line, COASTER_TEMPLATE, { angle: 'front', widthPx: 480 });
    const b = previewSvg(line, COASTER_TEMPLATE, { angle: 'front', widthPx: 480 });
    expect(b).toBe(a);
    expect(digestOf(b)).toBe(digestOf(a));
  });

  it('is a different picture when a single character changes', () => {
    const a = previewSvg(line, COASTER_TEMPLATE, { angle: 'front', widthPx: 480 });
    const b = previewSvg(
      { ...line, values: { ...line.values, date: 'est. 2018' } },
      COASTER_TEMPLATE,
      { angle: 'front', widthPx: 480 },
    );
    expect(digestOf(b)).not.toBe(digestOf(a));
  });

  it('is a different picture at a different angle, and the same at the same one', () => {
    const front = previewSvg(line, COASTER_TEMPLATE, { angle: 'front', widthPx: 480 });
    const three = previewSvg(line, COASTER_TEMPLATE, { angle: 'three', widthPx: 480 });
    expect(digestOf(three)).not.toBe(digestOf(front));
    expect(previewSvg(line, COASTER_TEMPLATE, { angle: 'three', widthPx: 480 })).toBe(three);
  });

  /**
   * THE MECHANISM BEHIND THE DETERMINISM CLAIM. Every `<text>` is told exactly
   * how wide to be, so the browser's font list cannot change the picture's
   * layout — which is what makes a committed metric table safe to rely on and
   * what D5c chose over `measureText`.
   */
  it('tells the browser the width rather than asking it', () => {
    const svg = previewSvg(line, COASTER_TEMPLATE, { angle: 'front', widthPx: 480 });
    const texts = svg.match(/<text\b[^>]*>/g) ?? [];
    expect(texts.length).toBeGreaterThan(0);
    for (const tag of texts) {
      expect(tag).toContain('textLength="');
      expect(tag).toContain('lengthAdjust="spacingAndGlyphs"');
    }
    const width = lineWidthMm('The Hartleys', faceOf('fenwick'), 7);
    expect(svg).toContain(`textLength="${Math.round(width * 100) / 100}"`);
  });

  it('is 2D, and carries nothing that would make it anything else (D18)', () => {
    const svg = previewSvg(line, COASTER_TEMPLATE, { angle: 'three', widthPx: 480 });
    expect(svg.startsWith('<svg')).toBe(true);
    for (const forbidden of ['canvas', 'webgl', 'three', 'gltf', '.stl', 'mesh']) {
      expect(svg.toLowerCase(), `the preview mentions ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('escapes what the shopper typed, everywhere it lands', () => {
    const svg = previewSvg(
      withValues({ [TOP.id]: '<b>&"Row"' }),
      COASTER_TEMPLATE,
      { angle: 'front', widthPx: 480 },
    );
    expect(svg).not.toContain('<b>');
    expect(svg).toContain('&lt;b&gt;');
    expect(esc(`<a href="x">'`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;');
  });

  it('draws the maker’s guides only when it is asked to', () => {
    const plain = previewSvg(line, COASTER_TEMPLATE, { angle: 'front', widthPx: 480 });
    const guided = previewSvg(line, COASTER_TEMPLATE, {
      angle: 'front',
      widthPx: 480,
      guides: true,
      bad: [TOP.id],
    });
    expect(plain).not.toContain('var(--info)');
    expect(guided).toContain('var(--danger)');
  });
});

// ── what goes to the machine (AC19) ─────────────────────────────────────────

describe('the production file', () => {
  const line = sampleThat('comfortable');

  it('carries a cut layer, a score layer and an engrave layer, each measured', () => {
    const file = toProductionPaths(line, COASTER_TEMPLATE);
    expect(file.layers.map((l) => l.layer)).toEqual(['cut', 'score', 'engrave']);
    const cut = file.layers.find((l) => l.layer === 'cut')!;
    const engrave = file.layers.find((l) => l.layer === 'engrave')!;
    expect(cut.lengthMm).toBeGreaterThan(300);
    expect(engrave.areaMm2).toBeGreaterThan(0);
    // Twenty-one letters and a space and a full stop: every letter that has ink
    // contributes at least one contour, so the engrave layer is not one blob.
    expect(engrave.count).toBeGreaterThan(15);
    expect(file.widthMm).toBe(PIECES['walnut-coasters']!.widthMm);
  });

  it('cuts the holes a piece has, and none where it has none', () => {
    const sign = toProductionPaths(sampleThat('the-house-sign'), SIGN_TEMPLATE);
    expect(sign.paths.filter((p) => p.layer === 'cut')).toHaveLength(3);
    expect(sign.layers.some((l) => l.layer === 'score')).toBe(false);
  });

  /**
   * THE CRITERION. Outlines, and nothing that could resolve to a typeface.
   *
   * THE PATTERNS COME FROM THE CONTRACT'S OWN SUITE, imported rather than
   * retyped. A copy stood here for a day and then drifted: the mirror's list
   * grew `\bfont-weight\b` and this one stayed at four, so the engine's suite —
   * the one a maintainer runs while editing the engine — was quietly the
   * weaker of the two gates. One list, one rule, and a pattern added upstream
   * bites here on the next run.
   */
  it('names no font, in any of the ways a file can name one', () => {
    const svg = productionSvg(line, COASTER_TEMPLATE);
    expect(FONT_REFERENCE.length).toBeGreaterThanOrEqual(5);
    for (const pattern of FONT_REFERENCE) {
      expect(pattern.test(svg), `the production file matches ${pattern}`).toBe(false);
    }
    expect(svg).toContain('<path');
    expect(svg.match(/<path/g)!.length).toBeGreaterThan(15);
  });

  /*
   * AND THE PATTERNS BITE, which is the half the assertion above cannot show.
   * `productionSvg` is 9 KB of `<path>` with no text element anywhere in it, so
   * every pattern returns false whether it is right or wrong — a list that had
   * quietly stopped matching would read exactly like a clean file, forever.
   *
   * The last of these is the round-6 hole: `style="font: bold 12px Inter"` sets
   * a family in one declaration and is neither `font-family` nor `font-weight`,
   * so it cleared all five of the patterns that stood here.
   */
  it('would catch a font named in any of those ways', () => {
    const named = (markup: string) => FONT_REFERENCE.some((pattern) => pattern.test(markup));
    for (const shape of [
      '<text x="4" y="9">Ivy</text>',
      '<tspan style="font-family: Inter">Ivy</tspan>',
      '@font-face { src: url(inter.woff2) }',
      '<style>.a{font-weight:700}</style>',
      'href="/fonts/Inter-Bold.otf"',
      '<tspan style="font: bold 12px Inter">Ivy</tspan>',
      '<g style="font:italic 700 14px/1.2 Georgia, serif">',
    ]) {
      expect(named(shape), `no pattern matched: ${shape}`).toBe(true);
    }
    // …and the outlines this add-on really emits are not a font reference.
    for (const shape of [
      '<path d="M12 4 L18 9 Z" fill="#111"/>',
      '<rect width="95" height="95" rx="4"/>',
      '<g transform="translate(4 9)">',
    ]) {
      expect(named(shape), `reported on an outline: ${shape}`).toBe(false);
    }
  });

  it('is measured in millimetres, because a laser is', () => {
    const svg = productionSvg(line, COASTER_TEMPLATE);
    expect(svg).toContain('width="95mm"');
    expect(svg).toContain('height="95mm"');
    expect(svg).toContain('viewBox="0 0 95 95"');
  });

  /**
   * THE JOIN BETWEEN THE PICTURE AND THE FILE. The preview draws real type and
   * the file carries the studio's own cut alphabet, so the letterforms differ —
   * what must not differ is where the words are and how wide they are, because
   * that is what the shopper approved.
   */
  it('places the words where the picture puts them, to the same width', () => {
    const face = faceOf('fenwick');
    const width = lineWidthMm('The Hartleys', face, 7);
    const file = toProductionPaths(line, COASTER_TEMPLATE);
    const engraved = file.paths.filter((p) => p.layer === 'engrave');
    const xs = engraved.flatMap((p) =>
      [...p.d.matchAll(/[ML] (-?[\d.]+) (-?[\d.]+)/g)].map((m) => Number(m[1])),
    );
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const expectedLeft = TOP.shape.xMm + (TOP.shape.wMm - width) / 2;
    // Within a stroke width either side: the outline of the first letter starts
    // half a stroke before the skeleton does, which is what an outline is.
    expect(left).toBeGreaterThan(expectedLeft - face.strokeRatio * 7);
    expect(right).toBeLessThan(expectedLeft + width + face.strokeRatio * 7);
  });

  it('is deterministic, like the picture', () => {
    expect(productionSvg(line, COASTER_TEMPLATE)).toBe(productionSvg(line, COASTER_TEMPLATE));
  });

  it('leaves an empty area out of the file entirely', () => {
    const empty = productionSvg(withValues({ [TOP.id]: 'The Hartleys' }), COASTER_TEMPLATE);
    const both = productionSvg(line, COASTER_TEMPLATE);
    expect(empty.length).toBeLessThan(both.length);
  });

  it('skips a character it has no letter for rather than cutting a blank box', () => {
    const withAccent = productionSvg(withValues({ [TOP.id]: 'Café' }), COASTER_TEMPLATE);
    const without = productionSvg(withValues({ [TOP.id]: 'Caf' }), COASTER_TEMPLATE);
    expect(withAccent).toBe(without);
  });
});

// ── the cut alphabet ────────────────────────────────────────────────────────

describe('the studio’s cut alphabet', () => {
  it('has a letter for every printable ASCII character the metric table carries', () => {
    const missing: string[] = [];
    for (let code = 32; code <= 126; code += 1) {
      const ch = String.fromCharCode(code);
      if (!hasGlyph(ch)) missing.push(ch);
    }
    /*
     * EMPTY, AND THE EMPTINESS IS THE ASSERTION.
     *
     * This case used to expect `'$%*<=>@[\]^_`{|}~'` — seventeen characters the
     * table happened not to carry, written down as though they were a decision.
     * They were not. `faces.ts` has a MEASURED ADVANCE for every one of them, so
     * the engine was placing them at a real width and the alphabet had no shape
     * to put there, and what a shopper got for typing `=` on a house sign was
     * "we have no letter for that" with truncation as the only way out. A
     * coverage test whose expectation is the list of things not covered passes
     * by agreeing with the hole.
     *
     * The rule is now the plain one: if the metric table carries a character,
     * the alphabet cuts it. A skeleton is a dozen numbers; a shopper deleting
     * half a name because a table was short is not.
     */
    expect(missing.join(''), 'the metric table carries these and the alphabet does not').toBe('');
  });

  /**
   * EVERY SWAPPABLE MARK SURVIVES AN UPPERCASE-ONLY FACE UNCHANGED.
   *
   * The surface applies a swap as `raw.split(from).join(to)`, and `from` is read
   * off the SHAPED text — what `quarry` turns the wording into. That is only
   * sound while shaping cannot alter the mark: a substitution keyed on a
   * character that uppercases to something else would produce a button whose
   * `from` is not in the string it slices, and the button would do nothing.
   *
   * Every entry in the table today is punctuation and passes trivially. The
   * case exists because the table is the thing that will grow — a ligature or a
   * dotted `ı` is exactly the sort of entry somebody adds next, and it is the
   * sort that uppercases into two characters.
   */
  it('has no substitution a capital-only face would change under it', () => {
    for (const [from, to] of Object.entries(SUBSTITUTES)) {
      expect(from.toUpperCase(), `${from} is not itself in capitals`).toBe(from);
      // And what it becomes is something the studio actually cuts, or the
      // remedy trades one refusal for another.
      for (const ch of to) expect(hasGlyph(ch), `${from} → ${to} is not cuttable`).toBe(true);
    }
  });

  it('turns a stroke into a closed contour a laser can follow', () => {
    const contour = outlinePolyline([0, 0, 10, 0], 1);
    expect(contour.length).toBeGreaterThanOrEqual(10);
    expect(contour.slice(0, 2)).toEqual(contour.slice(-2));
  });

  it('clamps a sharp join instead of throwing the outline off the sheet', () => {
    // A hairpin: without the miter clamp the join runs out to many times the
    // stroke width, which on a laser is a cut through the piece rather than an
    // ugly corner.
    const contour = outlinePolyline([0, 0, 10, 0.2, 0, 0.4], 1);
    const xs = contour.filter((_, i) => i % 2 === 0);
    expect(Math.max(...xs)).toBeLessThan(14);
  });

  it('keeps every glyph inside its own stated ink width', () => {
    for (const [ch, glyph] of Object.entries(GLYPHS)) {
      for (const stroke of glyph.s) {
        for (let i = 0; i < stroke.length; i += 2) {
          expect(stroke[i]!, `${ch} runs outside its ink width`).toBeLessThanOrEqual(
            glyph.w + 0.001,
          );
          expect(stroke[i]!, `${ch} runs left of its origin`).toBeGreaterThanOrEqual(-0.07);
        }
      }
    }
  });

  it('keeps every glyph between the descender and the ascender', () => {
    for (const [ch, glyph] of Object.entries(GLYPHS)) {
      for (const stroke of glyph.s) {
        for (let i = 1; i < stroke.length; i += 2) {
          expect(stroke[i]!, `${ch} descends too far`).toBeGreaterThanOrEqual(-0.32);
          expect(stroke[i]!, `${ch} ascends too far`).toBeLessThanOrEqual(1.05);
        }
      }
    }
  });
});

// ── the sample the maker checks their own set-up with ───────────────────────

describe('the maker’s sample', () => {
  it('fits both areas of every piece the studio has set up', () => {
    for (const template of [COASTER_TEMPLATE, SIGN_TEMPLATE]) {
      const { verdicts, blocks } = check(sampleFor(template), template);
      expect(verdicts.filter((v) => !v.ok), template.productKey).toEqual([]);
      expect(blocks, template.productKey).toEqual([]);
    }
  });
});

/**
 * EVERY SEEDED PIECE HAS A NAME, IN EVERY LANGUAGE.
 *
 * The set-up route used to render the PRODUCT KEY as a chip's label —
 * `walnut-coasters`, `house-sign` — on a maker-facing screen, in all eight
 * locales. It draws the list from `TEMPLATES` now and names each one through
 * `PIECE_NAME_KEYS`, and this is what stops a third seeded template quietly
 * going back to showing its slug: a template with no entry, or an entry whose
 * key is missing from a locale, is red here rather than a machine key on a
 * screen.
 */
describe('the pieces this add-on seeds are named, not slugged', () => {
  it('gives every seeded template a name key that resolves in all eight', () => {
    for (const template of TEMPLATES) {
      const key = PIECE_NAME_KEYS[template.productKey];
      expect(key, `${template.productKey} has no name key`).toBeDefined();
      for (const locale of LOCALE_TAGS) {
        const name = personalizerStrings[locale][key as MessageKey] as string | undefined;
        expect(name, `${key} is missing from ${locale}`).toBeDefined();
        // A name, not the key wearing a disguise.
        expect(name).not.toContain(template.productKey);
      }
    }
  });
});
