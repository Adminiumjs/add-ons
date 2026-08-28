/**
 * WHAT A BARCODE IS, ONCE THE SYMBOLOGY HAS FINISHED WITH IT.
 *
 * Both encoders in this package hand back the same thing: a run of MODULES, the
 * narrowest unit either symbology has. A module is dark or light; a bar is one
 * or more dark modules in a row and a space is one or more light ones. That is
 * the whole vocabulary, and everything downstream — the sheet renderer, the
 * suites, the on-screen preview — works in it.
 *
 * ── WHY IT IS A STRING OF `0` AND `1` AND NOT `boolean[]` ───────────────────
 *
 * Because of how the two standards are PUBLISHED, and therefore how a test can
 * pin one. Every reference that writes an EAN-13 encoding out writes it as a
 * bit string — `0001101` is what the L set's entry for zero looks like in every
 * table anybody can check this package against — and a suite holding
 * `[false,false,false,true,true,false,true]` beside it is a suite whose reader
 * has to do the transcription in their head, which is exactly where a wrong
 * digit hides.
 *
 * So the shape a reader compares against a reference is the shape the code
 * carries. `ean13.test.ts` pins whole 95-module strings and `code128.test.ts`
 * pins the element widths; both read as the tables they came from.
 *
 * A string also makes the one operation the renderer needs — collapse equal
 * neighbours into runs — a two-line loop rather than an index dance, and makes
 * an accidentally-empty encoding visible as `''` rather than as a plausible
 * `[]`.
 *
 * ── AND THE THING IT IS NOT ────────────────────────────────────────────────
 *
 * It is not a WIDTH. `111` is three narrow modules, which is drawn as one bar
 * three modules wide; nothing here says how wide a module is in millimetres,
 * because that is a question about paper and belongs to `sheet.ts`. Keeping the
 * two apart is what lets EAN-13 be drawn at the fixed magnification its
 * standard defines while Code 128 is fitted to the label it has to sit on.
 */

/** `1` is dark, `0` is light. Nothing else may appear. */
export type Modules = string;

/** One stretch of equal modules: where it starts, how many, and dark or light. */
export interface Run {
  readonly at: number;
  readonly width: number;
  readonly dark: boolean;
}

/**
 * Collapse equal neighbours, so the renderer emits one rectangle per bar
 * instead of one per module.
 *
 * LIGHT RUNS ARE RETURNED TOO, and a caller that only wants bars filters them.
 * Returning bars alone would have been smaller and would have thrown away the
 * check `sheet.test.ts` actually wants: that the runs tile the symbol exactly,
 * with no gap and no overlap. A list of bars cannot state that about itself.
 */
export function runsOf(modules: Modules): readonly Run[] {
  const out: Run[] = [];
  let at = 0;
  while (at < modules.length) {
    const dark = modules[at] === '1';
    let width = 1;
    while (at + width < modules.length && (modules[at + width] === '1') === dark) width += 1;
    out.push({ at, width, dark });
    at += width;
  }
  return out;
}

/**
 * Is this a module string at all?
 *
 * Every encoder in this package returns one and none of them can fail, so this
 * exists for the suites and for the one place a caller could get it wrong: a
 * string that arrived from somewhere else. `sheet.ts` refuses to draw anything
 * that is not modules, because a stray character would silently become a bar of
 * width one and a barcode that is one module wrong is a barcode that scans as a
 * different number.
 */
export function isModules(value: string): boolean {
  return value.length > 0 && /^[01]+$/.test(value);
}
