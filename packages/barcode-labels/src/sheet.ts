/**
 * THE LABEL SHEET: a real PDF, assembled byte by byte.
 *
 * ── WHY BY HAND ────────────────────────────────────────────────────────────
 *
 * 25 D11 again: no runtime dependency the host has not got, and the host has
 * React. `packages/shipping-dhl/src/label.ts` writes a complete PDF 1.4 in
 * about twenty-five lines with nothing at all, and this is the same file with
 * more pages and rectangles instead of only text. Six object kinds, offsets
 * collected while they are concatenated so the cross-reference table is exact,
 * and the two base-14 fonts every reader already has.
 *
 * ── THE WHOLE TRICK IS `re` AND `f` ────────────────────────────────────────
 *
 * A bar is a filled rectangle. `x y w h re` adds one to the current path and
 * `f` fills it, so a barcode is a fill colour, a run of `re`s and one `f`. No
 * image, no font, nothing embedded, and the result is vector — which is what
 * makes it scan: a bitmap barcode at the wrong resolution has bar edges that
 * land between printer dots, and that is the classic reason a printed label
 * reads on one machine and not the next.
 *
 * ── DETERMINISM, WHICH IS A REQUIREMENT AND NOT AN AESTHETIC ───────────────
 *
 * The same facts must give the same bytes, or `sheet.test.ts` cannot assert a
 * document at all. So:
 *
 *   NO CLOCK. There is no `/CreationDate` and nothing here reads one. The day
 *   printed on the label arrives as `on` — the SHOP's own day, off the host's
 *   `ShopClock` — which is a value passed in and not a machine being asked. The
 *   distinction is the one `@adminium/add-on-host`'s `payloads.ts` makes at
 *   length: a clock is a host fact, and an add-on that dated a document off its
 *   own would be dating it off somebody else's Tuesday.
 *
 *   NO DICE, so no object identifiers, no random names, nothing generated.
 *
 *   EVERY NUMBER FORMATTED THE SAME WAY. `mm()` puts every coordinate through
 *   the same two-decimal conversion, so a value that happens to land on an
 *   integer is written `12.00` like all the others rather than `12`.
 *
 * ── AND THE TEXT IS LATIN, WHICH IS A LIMIT AND IS SAID OUT LOUD ───────────
 *
 * The fonts are Helvetica and Helvetica-Bold, two of the fourteen every PDF
 * reader is required to have. Not embedding a font is what keeps this bundle
 * from carrying a megabyte of glyphs and what keeps the sheet openable
 * anywhere — and the price is that the alphabet is Latin. A row reference
 * written in another script has no glyphs here.
 *
 * SO IT IS DROPPED RATHER THAN GUESSED AT, AND THE COUNT IS RETURNED. Emitting
 * the bytes anyway would put whatever a reader's default encoding made of them
 * on the sticker; substituting a question mark would be this add-on inventing
 * somebody's reference. `latinOnly` says how many characters it could not draw,
 * both surfaces print that sentence, and the barcode itself is unaffected —
 * bars are rectangles and have no alphabet.
 */

import type { AssignedCode } from './codes.ts';
import { modulesFor } from './codes.ts';
import {
  CENTRE_GUARD,
  GUARD_SPANS,
  humanReadableGroups,
  NOMINAL_MODULE_MM,
  QUIET_LEFT,
  QUIET_RIGHT,
  START_GUARD,
} from './ean13.ts';
import { QUIET_MODULES } from './code128.ts';
import {
  GRID,
  LABEL,
  LABELS_PER_SHEET,
  MAX_LABELS,
  MIN_MODULE_MM,
  PAGE,
  pt,
  USABLE_WIDTH_MM,
} from './geometry.ts';
import { runsOf } from './modules.ts';

/** What one run of labels needs to know. Everything here comes from the host. */
export interface SheetFacts {
  /** The row's code, already checked: see `codes.ts`. */
  readonly assigned: AssignedCode;
  /**
   * What the host calls this kind of record — `part`, `piece`, `item`. Printed
   * small, above the reference, so somebody holding a sheet knows what the
   * reference is a reference to.
   */
  readonly entity: string;
  /** The row's own identifier, as the host knows it. */
  readonly reference: string;
  /** How many labels to draw. Clamped: see `labelsFor`. */
  readonly count: number;
  /** The shop's own day, ISO `YYYY-MM-DD`. Never read from a clock. */
  readonly on: string;
}

// ── the alphabet the base-14 fonts have ─────────────────────────────────────

/**
 * Keep what Helvetica can draw, and say how much went.
 *
 * ASCII 32 to 126, which is exactly the range Code 128 set B carries — so a
 * code that passed `codes.ts` is always printable, and the only text that can
 * lose characters is the row reference and the entity word, both of which come
 * from the host.
 */
export function latinOnly(text: string): { readonly text: string; readonly dropped: number } {
  let kept = '';
  let dropped = 0;
  for (const character of text) {
    const at = character.codePointAt(0)!;
    if (at >= 32 && at <= 126) kept += character;
    else dropped += 1;
  }
  return { text: kept, dropped };
}

/**
 * HOW WIDE A DIGIT IS, AND WHY THIS IS THE ONLY WIDTH IN THE FILE.
 *
 * Centring text needs its width, and a font's widths live in a metrics file:
 * ninety-five numbers for the printable ASCII range, which this package would
 * have to carry as a hand-copied table with nothing able to check it. What that
 * table would buy is centred text, which is worth very little.
 *
 * So the layout is built to need exactly one width. Helvetica gives every digit
 * the same advance — 556 units of a 1000-unit em, tabular by design so that
 * columns of figures line up — which is the one metric that can be stated in a
 * line and is true of all ten characters it is used for. The digit groups under
 * an EAN-13 are centred with it, because their position under the halves of the
 * symbol is part of the symbology's own layout.
 *
 * EVERYTHING ELSE IS LEFT-ALIGNED, and that is the decision rather than a
 * shortcoming: the reference and the day sit against the label's inner edge,
 * and a Code 128's human-readable line starts where its first bar starts. All
 * three read as deliberate, and none of them needs a number nobody can check.
 */
const HELVETICA_DIGIT_EM = 0.556;

/** How wide a run of digits is, in millimetres, at a font size in points. */
function digitsWidthMm(digits: string, sizePt: number): number {
  return (digits.length * HELVETICA_DIGIT_EM * sizePt) / pt(1);
}

// ── the page ────────────────────────────────────────────────────────────────

/**
 * Every coordinate goes through here.
 *
 * Two decimal places of a point is a hundredth of a point, which is far finer
 * than any printer, and — the reason it exists — it is a FIXED spelling. A
 * `String(x)` would write `12` for one coordinate and `12.000000000000002` for
 * the next, and the second is what floating-point millimetre arithmetic
 * produces roughly whenever it feels like it. A document whose bytes depend on
 * that cannot be asserted.
 */
function mm(value: number): string {
  return pt(value).toFixed(2);
}

/** Text inside a PDF string literal escapes exactly three characters. */
function pdfText(value: string): string {
  return value.replace(/([\\()])/g, '\\$1');
}

/** Where the labels start, so the block of them is centred on the page. */
const MARGIN_X_MM =
  (PAGE.widthMm - (GRID.columns * LABEL.widthMm + (GRID.columns - 1) * GRID.gutterMm)) / 2;
const MARGIN_Y_MM = (PAGE.heightMm - GRID.rows * LABEL.heightMm) / 2;

/** The bottom-left corner of the nth label on a sheet, counting across then down. */
function cornerOf(index: number): { readonly x: number; readonly y: number } {
  const column = index % GRID.columns;
  const row = Math.floor(index / GRID.columns);
  return {
    x: MARGIN_X_MM + column * (LABEL.widthMm + GRID.gutterMm),
    y: PAGE.heightMm - MARGIN_Y_MM - (row + 1) * LABEL.heightMm,
  };
}

// ── one label ───────────────────────────────────────────────────────────────

/**
 * Where things sit inside a label, measured up from its own bottom-left.
 *
 * Written as one object rather than as constants scattered through the drawing
 * code, so that the vertical order — reference at the top, bars, the digits
 * under them, the day at the foot — can be read off in one place and checked
 * against the label's own height.
 */
const INSIDE = {
  referenceBaselineMm: LABEL.heightMm - LABEL.padMm - 2.4,
  entityBaselineMm: LABEL.heightMm - LABEL.padMm - 5.6,
  barBottomMm: 9.4,
  barHeightMm: 15.4,
  /** How far the three guard patterns drop below every other bar, in modules. */
  guardDropModules: 5,
  humanBaselineMm: 6.9,
  footBaselineMm: 3.2,
  referenceSizePt: 7,
  entitySizePt: 5.5,
  humanSizePt: 7,
  footSizePt: 5.5,
} as const;

/**
 * HOW WIDE A MODULE IS, WHICH IS THE ONE PLACE THE TWO SYMBOLOGIES DIVERGE.
 *
 * EAN-13 HAS A SIZE AND CODE 128 DOES NOT, and that is not a detail of this
 * implementation — it is the difference between a symbology designed for retail
 * point of sale, where the standard fixes a nominal module and a magnification
 * range around it, and one designed for whatever a shop needs to carry. So:
 *
 *   EAN-13 is drawn at its nominal 0.33 mm, always, and centred in the label
 *   with its quiet zones. Stretching it to fill the label would push it past
 *   the magnification range the standard allows, silently, on a label that
 *   still looked fine.
 *
 *   CODE 128 is fitted to the label, capped at the same 0.33 mm so that a short
 *   reference does not come out with bars twice the width of the EAN-13 on the
 *   sticker beside it, and floored by `MIN_MODULE_MM`. The floor cannot bite,
 *   because `CODE128_MAX_LENGTH` is derived from it — and `sheet.test.ts`
 *   asserts that at the longest code the form accepts, which is the only way to
 *   know the two files still agree.
 */
function moduleWidthMm(symbology: AssignedCode['symbology'], modules: number): number {
  if (symbology === 'ean13') return NOMINAL_MODULE_MM;
  const total = modules + QUIET_MODULES * 2;
  return Math.max(MIN_MODULE_MM, Math.min(NOMINAL_MODULE_MM, USABLE_WIDTH_MM / total));
}

/** The quiet zone either side, in modules. EAN-13's are uneven; Code 128's are not. */
function quietOf(symbology: AssignedCode['symbology']): { left: number; right: number } {
  return symbology === 'ean13'
    ? { left: QUIET_LEFT, right: QUIET_RIGHT }
    : { left: QUIET_MODULES, right: QUIET_MODULES };
}

/** Does this module index fall inside one of EAN-13's three guard patterns? */
function isGuard(at: number): boolean {
  return GUARD_SPANS.some((span) => at >= span.from && at < span.to);
}

/**
 * One label's content-stream operators, with the label's own origin added in.
 *
 * Returned as a list of lines rather than a joined string so the caller can
 * concatenate twenty-four of them without an intermediate copy per label, and
 * so a suite can count the rectangles in one label without parsing a page.
 */
function labelOperators(facts: SheetFacts, originX: number, originY: number): string[] {
  const { assigned } = facts;
  const modules = modulesFor(assigned);
  const width = moduleWidthMm(assigned.symbology, modules.length);
  const quiet = quietOf(assigned.symbology);
  const blockMm = (quiet.left + modules.length + quiet.right) * width;

  // The whole block, quiet zones included, centred inside the label's margins.
  // Centring the SYMBOL alone would push an EAN-13's wider left quiet zone
  // towards the edge, which is the margin a scanner actually needs.
  const blockLeft = originX + LABEL.padMm + (USABLE_WIDTH_MM - blockMm) / 2;
  const symbolLeft = blockLeft + quiet.left * width;

  const out: string[] = [];
  out.push('0 0 0 rg');

  const ean = assigned.symbology === 'ean13';
  for (const run of runsOf(modules)) {
    if (!run.dark) continue;
    const drop = ean && isGuard(run.at) ? INSIDE.guardDropModules * width : 0;
    out.push(
      `${mm(symbolLeft + run.at * width)} ${mm(originY + INSIDE.barBottomMm - drop)} ` +
        `${mm(run.width * width)} ${mm(INSIDE.barHeightMm + drop)} re`,
    );
  }
  out.push('f');

  const entity = latinOnly(facts.entity).text;
  const reference = latinOnly(facts.reference).text;
  out.push(
    text(
      'F2',
      INSIDE.referenceSizePt,
      originX + LABEL.padMm,
      originY + INSIDE.referenceBaselineMm,
      reference,
    ),
  );
  out.push(
    text(
      'F1',
      INSIDE.entitySizePt,
      originX + LABEL.padMm,
      originY + INSIDE.entityBaselineMm,
      entity,
    ),
  );

  if (ean) {
    const groups = humanReadableGroups(assigned.code);
    const leadWidth = digitsWidthMm(groups.lead, INSIDE.humanSizePt);
    // The undrawn first digit goes in the left quiet zone, hard against the
    // start guard — that is where the standard puts it, and it is how a reader
    // can tell an EAN-13 from the twelve-digit symbology it grew out of.
    out.push(
      text(
        'F1',
        INSIDE.humanSizePt,
        symbolLeft - leadWidth - width,
        originY + INSIDE.humanBaselineMm,
        groups.lead,
      ),
    );
    const halfModules = 42;
    const leftCentre = symbolLeft + (START_GUARD.length + halfModules / 2) * width;
    const rightCentre =
      symbolLeft +
      (START_GUARD.length + halfModules + CENTRE_GUARD.length + halfModules / 2) * width;
    for (const [centre, digits] of [
      [leftCentre, groups.left],
      [rightCentre, groups.right],
    ] as const) {
      out.push(
        text(
          'F1',
          INSIDE.humanSizePt,
          centre - digitsWidthMm(digits, INSIDE.humanSizePt) / 2,
          originY + INSIDE.humanBaselineMm,
          digits,
        ),
      );
    }
  } else {
    // Code 128's human-readable line has no position the standard fixes, so it
    // starts where the first bar starts. Aligned rather than centred, for the
    // reason `HELVETICA_DIGIT_EM` gives.
    out.push(
      text(
        'F1',
        INSIDE.humanSizePt,
        symbolLeft,
        originY + INSIDE.humanBaselineMm,
        assigned.code,
      ),
    );
  }

  out.push('0.45 0.45 0.45 rg');
  out.push(
    text('F1', INSIDE.footSizePt, originX + LABEL.padMm, originY + INSIDE.footBaselineMm, facts.on),
  );
  return out;
}

/** One `BT … ET` text run. Empty text emits nothing, so a blank line costs no bytes. */
function text(font: string, size: number, x: number, y: number, value: string): string {
  if (value === '') return '';
  return `BT /${font} ${size} Tf ${mm(x)} ${mm(y)} Td (${pdfText(value)}) Tj ET`;
}

// ── the document ────────────────────────────────────────────────────────────

/**
 * How many labels a run actually draws, and over how many sheets.
 *
 * Clamped rather than validated, and the difference is on purpose: the number
 * comes off a form where somebody can type anything, and the honest response to
 * "0" or "1000" is a sheet with the nearest sensible number of labels on it,
 * with the form saying what it did. A refusal would be a rule with no reason
 * behind it — unlike the two in `codes.ts`, which prevent a barcode that does
 * not work.
 */
export function labelsFor(count: number): { readonly labels: number; readonly sheets: number } {
  /*
   * `Number.isFinite` FIRST, AND IT IS NOT BELT AND BRACES. The number arrives
   * from `Number.parseInt` over a text box, and an empty box parses to `NaN` —
   * which every comparison below is false against, so `Math.min`/`Math.max`
   * pass it straight through. The sheet count then came out `NaN`, the page
   * loop ran zero times, and the result was a PDF whose page tree said
   * `/Count NaN` and held no pages: a file a reader refuses to open, produced
   * by clearing a field. The suite for this line is what found it.
   */
  if (!Number.isFinite(count)) return { labels: 1, sheets: 1 };
  const labels = Math.min(MAX_LABELS, Math.max(1, Math.floor(count)));
  return { labels, sheets: Math.ceil(labels / LABELS_PER_SHEET) };
}

/**
 * A minimal PDF 1.4 holding one sheet per page.
 *
 * The cross-reference table needs each object's byte offset, so the objects are
 * concatenated in order while the offsets are collected — which is the whole
 * reason this is a loop rather than a template literal. Every byte is ASCII
 * (see `latinOnly`), so `String.length` is the byte length and the offsets are
 * exact.
 *
 * NOTHING IS DRAWN IN A LABEL'S MARGIN AND THERE IS NO CUT LINE, which is a
 * decision somebody printing on plain paper will notice. A sheet of these is
 * die-cut, so a printed rectangle would land ON the sticker rather than between
 * two of them, and every label would go out with a box around it.
 */
export function renderLabelSheet(facts: SheetFacts): string {
  const { labels, sheets } = labelsFor(facts.count);

  const streams: string[] = [];
  for (let sheet = 0; sheet < sheets; sheet += 1) {
    const onThisSheet = Math.min(LABELS_PER_SHEET, labels - sheet * LABELS_PER_SHEET);
    const operators: string[] = [];
    for (let at = 0; at < onThisSheet; at += 1) {
      const corner = cornerOf(at);
      operators.push(...labelOperators(facts, corner.x, corner.y));
    }
    streams.push(`${operators.filter((line) => line !== '').join('\n')}\n`);
  }

  /*
   * The object numbering, stated once so the two places that have to agree —
   * the page objects' `/Contents` and the `/Pages` node's `/Kids` — are written
   * from the same arithmetic rather than from two counts that drift.
   */
  const firstPage = 5;
  const firstStream = firstPage + sheets;
  const kids = streams.map((_, at) => `${firstPage + at} 0 R`).join(' ');

  const objects: string[] = [
    '<</Type/Catalog/Pages 2 0 R>>',
    `<</Type/Pages/Kids[${kids}]/Count ${sheets}>>`,
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold>>',
    ...streams.map(
      (_, at) =>
        `<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${mm(PAGE.widthMm)} ${mm(PAGE.heightMm)}]` +
        `/Resources<</Font<</F1 3 0 R/F2 4 0 R>>>>/Contents ${firstStream + at} 0 R>>`,
    ),
    ...streams.map((stream) => `<</Length ${stream.length}>>\nstream\n${stream}endstream`),
  ];

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, at) => {
    offsets.push(out.length);
    out += `${at + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) out += `${String(offset).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
  return out;
}

/**
 * A filename that survives a shell, a download and somebody's file manager.
 *
 * A Code 128 code may legitimately contain a space, a slash or a bracket — set
 * B carries all of them — so the code cannot go into a filename as it stands.
 * Everything outside letters, digits, dot, dash and underscore becomes a dash,
 * runs of dashes collapse, and the result is trimmed. Two rows whose codes
 * differ only in punctuation therefore produce the same filename, which is a
 * cost worth paying: a filename is a convenience and the code is printed on
 * every label in the document.
 */
export function labelSheetFilename(assigned: AssignedCode): string {
  const safe = assigned.code
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `labels-${safe === '' ? assigned.symbology : safe}.pdf`;
}

/**
 * How many characters of a sheet's text the base-14 fonts cannot draw.
 *
 * Both surfaces call it to decide whether to say so, rather than each running
 * `latinOnly` over the same two strings and one of them forgetting. The CODE is
 * deliberately not counted: a code that passed `codes.ts` is inside the
 * printable ASCII range by construction, so counting it could only ever return
 * zero and would suggest to a reader that it might not.
 */
export function undrawableCharacters(facts: Pick<SheetFacts, 'entity' | 'reference'>): number {
  return latinOnly(facts.entity).dropped + latinOnly(facts.reference).dropped;
}
