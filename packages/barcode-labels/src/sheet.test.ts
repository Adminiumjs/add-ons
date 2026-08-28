/**
 * THE SHEET: a real PDF, and the same bytes every time.
 *
 * ── WHAT IS ACTUALLY WORTH ASSERTING ABOUT A GENERATED DOCUMENT ────────────
 *
 * Not that it "looks right", which no headless suite can see. Three things,
 * each of which fails in a way nobody would otherwise notice:
 *
 *   IT IS A WELL-FORMED PDF. The cross-reference table is a list of byte
 *   offsets, and an offset that is wrong by one is a file that some readers
 *   open and others refuse. So the offsets are followed and checked to land on
 *   the object they claim, which is the only way to know the loop that collects
 *   them is still right.
 *
 *   IT IS THE SAME BYTES TWICE. `shipping-dhl` learnt this at the same seam:
 *   a document carrying a creation date differs between two runs of one demo,
 *   and then nothing about it can be asserted at all. The day printed on the
 *   label is the SHOP's, passed in, so changing it changes the file and
 *   changing nothing changes nothing.
 *
 *   THE BARS ARE THE ENCODING. The rectangles in the content stream have to be
 *   the dark runs of the same module string `codes.ts` would hand any other
 *   caller. A sheet drawn from a second encoding would be a sheet of a
 *   different barcode, and it would look completely fine.
 */

import { describe, expect, it } from 'vitest';

import { modulesFor, type AssignedCode } from './codes.ts';
import { encodeEan13, NOMINAL_MODULE_MM, QUIET_LEFT, QUIET_RIGHT } from './ean13.ts';
import { moduleCountFor, QUIET_MODULES } from './code128.ts';
import {
  CODE128_MAX_LENGTH,
  LABEL,
  LABELS_PER_SHEET,
  MAX_LABELS,
  MIN_MODULE_MM,
  PAGE,
  pt,
  USABLE_WIDTH_MM,
} from './geometry.ts';
import { runsOf } from './modules.ts';
import {
  labelSheetFilename,
  labelsFor,
  latinOnly,
  renderLabelSheet,
  undrawableCharacters,
  type SheetFacts,
} from './sheet.ts';

const EAN: AssignedCode = { sku: 'zinc-tray', symbology: 'ean13', code: '5901234123457' };
const C128: AssignedCode = { sku: 'ash-board', symbology: 'code128', code: 'ADM-4417' };

const facts = (over: Partial<SheetFacts> = {}): SheetFacts => ({
  assigned: EAN,
  entity: 'part',
  reference: 'zinc-tray',
  count: LABELS_PER_SHEET,
  on: '2026-08-05',
  ...over,
});

/** Every `x y w h re` in the document, as numbers. */
function rectangles(pdf: string): { x: number; y: number; w: number; h: number }[] {
  return [...pdf.matchAll(/^(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+) re$/gm)].map((match) => ({
    x: Number(match[1]),
    y: Number(match[2]),
    w: Number(match[3]),
    h: Number(match[4]),
  }));
}

/** Every `(text) Tj` in the document, unescaped. */
function texts(pdf: string): string[] {
  return [...pdf.matchAll(/\((?:[^\\()]|\\.)*\) Tj/g)].map((match) =>
    match[0].slice(1, -4).replace(/\\([\\()])/g, '$1'),
  );
}

describe('the document is a PDF a reader will open', () => {
  const pdf = renderLabelSheet(facts());

  it('opens with a version header and closes with the end marker', () => {
    expect(pdf.startsWith('%PDF-1.4\n')).toBe(true);
    expect(pdf.endsWith('%%EOF\n')).toBe(true);
  });

  it('is entirely ASCII, so a byte offset is a character offset', () => {
    /*
     * The whole offset arithmetic rests on this. `latinOnly` is what keeps it
     * true for the host's own text; this is the assertion that says so.
     *
     * WRITTEN AS A CODE-POINT COMPARISON RATHER THAN AS `/^[\x00-\x7F]*$/`,
     * which is what stood here first. `packages/host/src/shared-rule.test.ts`
     * reported that spelling, and it was right to: a character class anchored
     * at NUL is how the shared C0 scanner in `testing/encoding.ts` is written,
     * so the two read as one rule stated twice. They are not the same question
     * — that one asks whether a SOURCE file is text a tool will read, this one
     * asks whether a GENERATED document is one byte per character — and asking
     * it a different way is what keeps them from being confused for each other.
     */
    const beyondAscii = [...pdf].filter((character) => character.codePointAt(0)! > 127);
    expect(beyondAscii).toEqual([]);
  });

  it('points every cross-reference offset at the object it claims', () => {
    const table = pdf.slice(pdf.lastIndexOf('\nxref\n') + 1);
    const offsets = [...table.matchAll(/^(\d{10}) 00000 n $/gm)].map((match) => Number(match[1]));
    expect(offsets.length).toBeGreaterThan(5);
    offsets.forEach((offset, at) => {
      expect(pdf.slice(offset, offset + 10), `object ${at + 1}`).toMatch(
        new RegExp(`^${at + 1} 0 obj`),
      );
    });
  });

  it('points `startxref` at the cross-reference table', () => {
    const startxref = Number(/startxref\n(\d+)\n/.exec(pdf)![1]);
    expect(pdf.slice(startxref, startxref + 4)).toBe('xref');
  });

  it('declares each stream’s real length', () => {
    const streams = [...pdf.matchAll(/<<\/Length (\d+)>>\nstream\n([\s\S]*?)endstream/g)];
    expect(streams.length).toBeGreaterThan(0);
    for (const [, declared, body] of streams) {
      expect(body!.length, 'a stream is not the length its object declares').toBe(Number(declared));
    }
  });

  it('embeds no font, and names the two every reader already has', () => {
    expect(pdf).toContain('/BaseFont/Helvetica>>');
    expect(pdf).toContain('/BaseFont/Helvetica-Bold>>');
    expect(pdf).not.toContain('/FontFile');
  });

  it('is A4', () => {
    expect(pdf).toContain(`/MediaBox[0 0 ${pt(PAGE.widthMm).toFixed(2)} ${pt(PAGE.heightMm).toFixed(2)}]`);
  });
});

describe('the same facts give the same bytes', () => {
  it('carries no creation date and no clock', () => {
    const pdf = renderLabelSheet(facts());
    expect(pdf).not.toContain('/CreationDate');
    expect(pdf).not.toContain('/ModDate');
  });

  it('renders identically twice', () => {
    expect(renderLabelSheet(facts())).toBe(renderLabelSheet(facts()));
  });

  it('changes when the shop’s day changes, and only then', () => {
    // The day is a HOST fact passed in — see `payloads.ts` on `ShopClock`. That
    // is what lets a document be dated and still be assertable.
    const monday = renderLabelSheet(facts({ on: '2026-08-05' }));
    const tuesday = renderLabelSheet(facts({ on: '2026-08-06' }));
    expect(monday).not.toBe(tuesday);
    expect(monday.length).toBe(tuesday.length);
    expect(renderLabelSheet(facts({ on: '2026-08-05' }))).toBe(monday);
  });

  it('writes every coordinate to the same number of places', () => {
    // `String(x)` would write `12` for one coordinate and `12.000000000000002`
    // for the next, which is what floating-point millimetre arithmetic produces
    // whenever it feels like it — and a document whose bytes depend on that
    // cannot be asserted at all.
    const pdf = renderLabelSheet(facts());
    for (const match of pdf.matchAll(/^(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+) re$/gm)) {
      for (const value of match.slice(1)) {
        expect(value, `${value} is not written to two places`).toMatch(/^-?\d+\.\d{2}$/);
      }
    }
  });
});

describe('the bars are the encoding, and nothing else', () => {
  it('draws one rectangle per dark run, per label', () => {
    const dark = runsOf(modulesFor(EAN)).filter((run) => run.dark).length;
    expect(rectangles(renderLabelSheet(facts({ count: 1 }))).length).toBe(dark);
    expect(rectangles(renderLabelSheet(facts({ count: 7 }))).length).toBe(dark * 7);
  });

  it('uses the module string any other caller would get', () => {
    // A sheet drawn from a second encoding would be a sheet of a different
    // barcode, and would look entirely correct.
    expect(modulesFor(EAN)).toBe(encodeEan13(EAN.code));
  });

  it('tiles the symbol with no gap and no overlap', () => {
    const rects = rectangles(renderLabelSheet(facts({ count: 1 })))
      .slice()
      .sort((a, b) => a.x - b.x);
    const runs = runsOf(modulesFor(EAN)).filter((run) => run.dark);
    expect(rects).toHaveLength(runs.length);
    const module = pt(NOMINAL_MODULE_MM);
    runs.forEach((run, at) => {
      expect(rects[at]!.w, `run ${at}`).toBeCloseTo(run.width * module, 1);
    });
  });

  it('draws an EAN-13 at the nominal module width its standard fixes', () => {
    // Not stretched to the label. A magnification outside the range the
    // standard allows would look completely fine and scan badly.
    const narrow = Math.min(...rectangles(renderLabelSheet(facts({ count: 1 }))).map((r) => r.w));
    expect(narrow).toBeCloseTo(pt(NOMINAL_MODULE_MM), 2);
  });

  it('drops the three guard patterns below every other bar', () => {
    const heights = new Set(
      rectangles(renderLabelSheet(facts({ count: 1 }))).map((rect) => rect.h.toFixed(2)),
    );
    // Two heights and no more: the ordinary bars, and the guards.
    expect(heights.size).toBe(2);
    const [short, tall] = [...heights].map(Number).sort((a, b) => a - b);
    expect(tall! - short!).toBeCloseTo(pt(5 * NOMINAL_MODULE_MM), 2);
  });

  it('fits an EAN-13 and both its quiet zones inside the label', () => {
    const width = (95 + QUIET_LEFT + QUIET_RIGHT) * NOMINAL_MODULE_MM;
    expect(width).toBeLessThan(USABLE_WIDTH_MM);
    const rects = rectangles(renderLabelSheet(facts({ count: 1 })));
    const left = Math.min(...rects.map((rect) => rect.x));
    const right = Math.max(...rects.map((rect) => rect.x + rect.w));
    expect(left).toBeGreaterThanOrEqual(pt(LABEL.padMm + QUIET_LEFT * NOMINAL_MODULE_MM) - 0.5);
    expect(right).toBeLessThanOrEqual(pt(LABEL.widthMm - LABEL.padMm) + 0.5);
  });

  it('never draws a Code 128 module narrower than a scanner can read', () => {
    // The floor cannot bite, because `CODE128_MAX_LENGTH` is derived from it —
    // and this is the only place that claim is actually tested, at the longest
    // code the form accepts.
    const longest: AssignedCode = {
      sku: 'a',
      symbology: 'code128',
      code: 'X'.repeat(CODE128_MAX_LENGTH),
    };
    const rects = rectangles(renderLabelSheet(facts({ assigned: longest, count: 1 })));
    const narrow = Math.min(...rects.map((rect) => rect.w));
    expect(narrow).toBeGreaterThanOrEqual(pt(MIN_MODULE_MM) - 0.01);
    expect(moduleCountFor(CODE128_MAX_LENGTH) * MIN_MODULE_MM).toBeLessThanOrEqual(
      USABLE_WIDTH_MM,
    );
    expect(moduleCountFor(CODE128_MAX_LENGTH + 1) * MIN_MODULE_MM).toBeGreaterThan(
      USABLE_WIDTH_MM,
    );
  });

  it('caps a short Code 128 at the same nominal width as an EAN-13', () => {
    // Otherwise a four-character reference comes out with bars twice the width
    // of the EAN-13 on the sticker beside it.
    const short: AssignedCode = { sku: 'a', symbology: 'code128', code: 'A1' };
    const rects = rectangles(renderLabelSheet(facts({ assigned: short, count: 1 })));
    expect(Math.min(...rects.map((rect) => rect.w))).toBeCloseTo(pt(NOMINAL_MODULE_MM), 2);
    // …and the quiet zones are even on this symbology, unlike EAN-13's.
    expect(QUIET_MODULES).toBe(10);
  });
});

describe('the words on a label', () => {
  it('prints the reference, what kind of record it is, and the day', () => {
    const printed = texts(renderLabelSheet(facts({ count: 1 })));
    expect(printed).toContain('zinc-tray');
    expect(printed).toContain('part');
    expect(printed).toContain('2026-08-05');
  });

  it('prints an EAN-13 in the one-six-six grouping the standard uses', () => {
    const printed = texts(renderLabelSheet(facts({ count: 1 })));
    expect(printed).toContain('5');
    expect(printed).toContain('901234');
    expect(printed).toContain('123457');
    // …and never as one run of thirteen, which is what a reader would get from
    // a renderer that had not read the standard.
    expect(printed).not.toContain('5901234123457');
  });

  it('prints a Code 128 reference as one run under its bars', () => {
    const printed = texts(renderLabelSheet(facts({ assigned: C128, count: 1 })));
    expect(printed).toContain('ADM-4417');
  });

  it('escapes the three characters a PDF string literal cares about', () => {
    const pdf = renderLabelSheet(facts({ reference: 'A(1)\\B', count: 1 }));
    expect(pdf).toContain('(A\\(1\\)\\\\B) Tj');
    expect(texts(pdf)).toContain('A(1)\\B');
  });

  it('emits nothing at all for an empty line rather than an empty text run', () => {
    const pdf = renderLabelSheet(facts({ entity: '', count: 1 }));
    expect(pdf).not.toContain('() Tj');
  });
});

describe('the base-14 alphabet, which is the cost of embedding no font', () => {
  it('keeps printable ASCII and counts what it drops', () => {
    expect(latinOnly('ADM-4417')).toEqual({ text: 'ADM-4417', dropped: 0 });
    expect(latinOnly('café')).toEqual({ text: 'caf', dropped: 1 });
    expect(latinOnly('标签 A1')).toEqual({ text: ' A1', dropped: 2 });
  });

  it('leaves the bars alone, because bars have no alphabet', () => {
    const latin = renderLabelSheet(facts({ reference: 'zinc', count: 1 }));
    const other = renderLabelSheet(facts({ reference: '标签', count: 1 }));
    expect(rectangles(latin).length).toBe(rectangles(other).length);
  });

  it('reports what a surface has to tell somebody about', () => {
    expect(undrawableCharacters({ entity: 'part', reference: 'zinc-tray' })).toBe(0);
    expect(undrawableCharacters({ entity: 'часть', reference: '标签' })).toBe(7);
  });

  it('does not count the code, which is inside the range by construction', () => {
    // Counting it could only ever return zero, and would suggest to a reader
    // that it might not.
    expect(undrawableCharacters({ entity: '', reference: '' })).toBe(0);
  });

  it('drops rather than substituting, so nothing invents somebody’s reference', () => {
    const pdf = renderLabelSheet(facts({ reference: 'a标b', count: 1 }));
    expect(texts(pdf)).toContain('ab');
    expect(pdf).not.toContain('?');
  });
});

describe('how many labels, and over how many sheets', () => {
  it('lays twenty-four to a sheet', () => {
    expect(LABELS_PER_SHEET).toBe(24);
    expect(labelsFor(24)).toEqual({ labels: 24, sheets: 1 });
    expect(labelsFor(25)).toEqual({ labels: 25, sheets: 2 });
    expect(labelsFor(48)).toEqual({ labels: 48, sheets: 2 });
  });

  it('clamps rather than refusing, because the number comes off a free-text box', () => {
    // A refusal would be a rule with no reason behind it, unlike the two in
    // `codes.ts`, which prevent a barcode that does not work.
    expect(labelsFor(0)).toEqual({ labels: 1, sheets: 1 });
    expect(labelsFor(-5)).toEqual({ labels: 1, sheets: 1 });
    expect(labelsFor(Number.NaN)).toEqual({ labels: 1, sheets: 1 });
    expect(labelsFor(1e9)).toEqual({ labels: MAX_LABELS, sheets: 10 });
    expect(labelsFor(3.7)).toEqual({ labels: 3, sheets: 1 });
  });

  it('writes one page object per sheet, and says so in the page tree', () => {
    const pdf = renderLabelSheet(facts({ count: 30 }));
    expect(pdf).toContain('/Count 2');
    expect([...pdf.matchAll(/\/Type\/Page\//g)]).toHaveLength(2);
    expect([...pdf.matchAll(/<<\/Length \d+>>/g)]).toHaveLength(2);
  });

  it('fills the last sheet only as far as it needs to', () => {
    const dark = runsOf(modulesFor(EAN)).filter((run) => run.dark).length;
    expect(rectangles(renderLabelSheet(facts({ count: 25 }))).length).toBe(dark * 25);
  });

  it('lays every label inside the page', () => {
    const rects = rectangles(renderLabelSheet(facts({ count: LABELS_PER_SHEET })));
    for (const rect of rects) {
      expect(rect.x).toBeGreaterThan(0);
      expect(rect.y).toBeGreaterThan(0);
      expect(rect.x + rect.w).toBeLessThan(pt(PAGE.widthMm));
      expect(rect.y + rect.h).toBeLessThan(pt(PAGE.heightMm));
    }
  });
});

describe('the filename', () => {
  it('is built from the code, so two rows do not overwrite one another', () => {
    expect(labelSheetFilename(EAN)).toBe('labels-5901234123457.pdf');
    expect(labelSheetFilename(C128)).toBe('labels-ADM-4417.pdf');
  });

  it('survives a shell and a file manager', () => {
    // Set B carries spaces, slashes and brackets, all of which a shop
    // reference may legitimately contain and none of which belongs in a name.
    expect(labelSheetFilename({ sku: 'a', symbology: 'code128', code: 'WAL COAST 06' })).toBe(
      'labels-WAL-COAST-06.pdf',
    );
    expect(labelSheetFilename({ sku: 'a', symbology: 'code128', code: 'A/B (2)' })).toBe(
      'labels-A-B-2.pdf',
    );
    expect(labelSheetFilename({ sku: 'a', symbology: 'code128', code: '///' })).toBe(
      'labels-code128.pdf',
    );
  });
});
