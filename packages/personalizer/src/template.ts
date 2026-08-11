/**
 * THE ENGINE (24 D5c). Pure, deterministic, DOM-free.
 *
 * Everything this add-on claims rests on four functions in this file:
 *
 *   `fit`            — does this line go in that area, and if not, what are the
 *                      ways out AND THEIR NUMBERS?
 *   `check`          — the whole personalization against the whole template.
 *   `previewSvg`     — the picture, as bytes, identical for identical values.
 *   `toProductionPaths` — what goes to the laser: cut and engrave geometry,
 *                      with the text already turned into outlines.
 *
 * ── NO CLOCK, NO DICE, NO DOM, NO NETWORK ───────────────────────────────────
 *
 * Not one of them reads `Date.now()`, calls `Math.random()`, touches
 * `document`, or fetches anything. `sources.test.ts` greps for all four. The
 * measuring that comp L did with a canvas is a committed table in `faces.ts`,
 * for the reason set out at the top of that file: a preview measured on the
 * reader's machine is a different preview on a different machine, and criterion
 * 17 asks for the opposite.
 *
 * ── THE PICTURE IS A STRING, AND THAT IS THE WHOLE DETERMINISM ARGUMENT ─────
 *
 * `previewSvg` returns SVG source. The shopper's canvas, the basket thumbnail,
 * the proof and the maker's order line all render THE SAME STRING, and
 * `digest` is a hash of exactly those bytes. So "the cart thumbnail, the proof
 * and the order line are the same picture" is not a claim about three renderers
 * agreeing — there is one renderer, it produces text, and the text is compared.
 *
 * ── WHAT IS A VERDICT AND WHAT IS A BLOCK ───────────────────────────────────
 *
 * `check` returns both, and the split is the reason criterion 18 can be
 * absolute. A VERDICT is about something the shopper typed, so there is always
 * a number to offer: a smaller size, a shorter line, a cut before the character
 * the studio has no letter for. A BLOCK is about something they have NOT typed
 * — a required area still empty — and "shorten it to N characters" is not
 * advice you can give about an empty box. So an empty required area stops "Add
 * to basket" with a plain reason instead, which is what comp L draws, and every
 * verdict without exception carries a remedy with a number in it.
 */

import type {
  Personalization,
  Template,
  Verdict,
  Zone,
  ZoneFinish,
} from '@adminium/add-on-host/contracts';

import { advanceMm, faceOf, lineInkMm, lineWidthMm, shape, type Face } from './faces.ts';
import { GLYPHS, hasGlyph, outlinePolyline, substituteFor } from './glyphs.ts';
import { MATERIALS, pieceFor, type Piece } from './pieces.ts';

export type { Personalization, Template, Verdict, Zone, ZoneFinish };

/** The smallest and largest cap height the studio will cut, in millimetres. */
export const FLOOR_MM = 3;
export const CEILING_MM = 60;

/** Sizes are offered, and remedied, in half millimetres. A rule reads in halves. */
export const STEP_MM = 0.5;

const down = (mm: number) => Math.floor(mm / STEP_MM) * STEP_MM;

/** Round to a tenth of a millimetre for anything a person reads. */
export const mm1 = (n: number): number => Math.round(n * 10) / 10;

// ── fitting ─────────────────────────────────────────────────────────────────

export interface FitOk {
  fits: true;
  widthMm: number;
  inkMm: number;
  capMm: number;
  /** True where it fits but sits below the face's smallest comfortable size. */
  fine: boolean;
}

export interface FitOver {
  fits: false;
  widthMm: number;
  capMm: number;
  /** How far past the area it runs, in millimetres. */
  overMm: number;
  /** How many characters past what fits at this size. Zero when nothing fits. */
  overChars: number;
  /** Both ways out, with their numbers. At least one is always present. */
  remedies: { setSizeMm?: number; shortenToChars?: number };
}

export type Fit = FitOk | FitOver;

/** The size range a zone allows, clamped into what the studio will cut. */
export function sizeRange(zone: Zone): { minMm: number; maxMm: number } {
  return {
    minMm: Math.max(FLOOR_MM, zone.constraints.minSizeMm ?? FLOOR_MM),
    maxMm: Math.min(CEILING_MM, zone.constraints.maxSizeMm ?? CEILING_MM),
  };
}

/** Does this line, at this size, in this face, go inside this area? */
function goesIn(text: string, zone: Zone, face: Face, capMm: number): boolean {
  return (
    lineWidthMm(text, face, capMm) <= zone.shape.wMm + 1e-6 &&
    lineInkMm(face, capMm) <= zone.shape.hMm + 1e-6
  );
}

/**
 * FIT, AND THE TWO REMEDIES.
 *
 * `setSizeMm` — the largest half millimetre, at or below the requested size and
 * not below the area's own minimum, at which the WHOLE line goes in. Absent
 * when there is no such size, and the caller then says so in words rather than
 * offering a button that would do nothing.
 *
 * `shortenToChars` — how many characters go in AT THE REQUESTED SIZE. Always
 * present on a failure, because there is always some prefix that fits, even if
 * it is none of it.
 *
 * Both are computed rather than estimated. The size search walks down in half
 * millimetres, which is at most a hundred and fifteen steps and is exact; a
 * proportional guess from the overflow ratio is one line shorter and gives the
 * shopper a button that does not quite work, which is the failure mode this
 * whole contract exists to prevent.
 */
export function fit(text: string, zone: Zone, face: Face, capMm: number): Fit {
  const widthMm = mm1(lineWidthMm(text, face, capMm));

  if (goesIn(text, zone, face, capMm)) {
    return {
      fits: true,
      widthMm,
      inkMm: mm1(lineInkMm(face, capMm)),
      capMm,
      fine: capMm < face.smallestMm,
    };
  }

  const { minMm } = sizeRange(zone);
  let setSizeMm: number | undefined;
  for (let mm = down(Math.min(capMm, CEILING_MM)); mm >= minMm - 1e-9; mm -= STEP_MM) {
    if (goesIn(text, zone, face, mm)) {
      setSizeMm = Math.round(mm * 10) / 10;
      break;
    }
  }

  /*
   * COUNTED IN WHAT THE SHOPPER TYPED, NOT IN WHAT THE LASER CUTS.
   *
   * This walked the SHAPED string — the text after an uppercase-only face has
   * had it — and the number came back as an index into that. The surface then
   * applied it to the RAW string, and the two are the same length for every
   * character but one: German `ß` uppercases to `SS`. On the house sign, which
   * offers `quarry`, "Straße é" shapes to "STRASSE É" and the cut computed at
   * index 8 landed past the end of an eight-character line, so the button that
   * was meant to remove the `é` returned the line unchanged and the failure
   * stayed on screen with a remedy that had visibly done nothing.
   *
   * One character of the shopper's own text at a time, each measured through
   * `lineWidthMm` so its shaped expansion is priced whole. The number is then
   * an index into the string the button actually slices.
   */
  let shortenToChars = 0;
  let running = 0;
  for (const ch of text) {
    running += lineWidthMm(ch, face, capMm);
    if (running > zone.shape.wMm + 1e-6) break;
    shortenToChars += 1;
  }
  // The height of the line does not change as it is shortened, so a line too
  // TALL for its area cannot be fixed by shortening at all — and offering that
  // button would be a lie. Only the size remedy applies there.
  const tooTall = lineInkMm(face, capMm) > zone.shape.hMm + 1e-6;

  const remedies: FitOver['remedies'] = {};
  if (setSizeMm !== undefined) remedies.setSizeMm = setSizeMm;
  /*
   * ZERO IS NOT A REMEDY, and it used to be offered as one.
   *
   * `shortenToChars` counts the characters that go in AT THIS SIZE, and when
   * the very first one is already wider than the area that count is nought. The
   * surface then drew "Shorten it to 0" — a button that empties the field and
   * trips `required-empty`, which is not a way out of anything. The same
   * arithmetic mistake reached ar-EG through the no-letter path, where it was
   * the outcome of a shopper's first keystroke.
   *
   * Withholding it is safe rather than merely tidy: when nothing fits at any
   * length, either the size search found a size that takes the whole wording —
   * which is the remedy — or it did not, and the branch below offers the floor
   * explicitly so a failure with no way out remains unreachable.
   */
  if (!tooTall && shortenToChars > 0) remedies.shortenToChars = shortenToChars;
  // A line that is too tall for its area and has no smaller size available
  // would leave nothing to offer. That cannot happen — the area's own minimum
  // is at least the studio's floor and the floor always fits vertically in a
  // zone the maker drew — but a contract violation must not be reachable by
  // reasoning, so the floor is offered explicitly.
  if (remedies.setSizeMm === undefined && remedies.shortenToChars === undefined) {
    remedies.setSizeMm = minMm;
  }

  return {
    fits: false,
    widthMm,
    capMm,
    overMm: mm1(Math.max(0, lineWidthMm(text, face, capMm) - zone.shape.wMm)),
    overChars: Math.max(0, [...text].length - shortenToChars),
    remedies,
  };
}

// ── the whole personalization ───────────────────────────────────────────────

/**
 * Why one machine-readable reason code per verdict: the SENTENCE is the host's
 * to translate, and an engine that returned English would make eight locales
 * impossible. `reason` still carries a plain English sentence, because the
 * contract's `Verdict` declares one and a conformance suite reads it; the
 * surface renders `code` and the numbers through its own bundle and never shows
 * `reason` to a shopper.
 */
export type VerdictCode =
  | 'overrun'
  | 'too-many'
  /** A mark the studio has no shape for, but DOES have a plain form of. */
  | 'no-letter'
  /** A letter with no plain form at all — `é`, or a script this alphabet lacks. */
  | 'no-letter-stuck'
  | 'too-small';

export interface CodedVerdict {
  zone: string;
  ok: boolean;
  code?: VerdictCode;
  /** For both no-letter codes: the characters the studio has no letter for. */
  chars?: string[];
  /** For `no-letter`: what the studio cuts in place of each of them. */
  swaps?: readonly { from: string; to: string }[];
  /** For `too-many`: the limit the area carries. */
  limit?: number;
  /**
   * THE NUMBER EVERY FAILING VERDICT OWES THE SHOPPER, as a character count.
   *
   * `Verdict.remedies.shortenToChars` — the contract's own field, which the
   * conformance suite asserts is a number on every failure — mirrored onto the
   * machine-readable half. It was NOT here, and the omission was invisible in
   * exactly the way criterion 18 exists to prevent: the engine computed the
   * number for `no-letter` and the suite asserted it was 3 for "Café Row",
   * while the surface, which reads `detail` and never `verdicts`, could not
   * reach it and drew a sentence with no button under it. A remedy a suite can
   * see and a shopper cannot is not a remedy.
   */
  shortenToChars?: number;
  fit?: Fit;
}

/**
 * A FAILURE WITH NO NUMBER TO OFFER — the one thing that is not a verdict.
 *
 * `required-empty` is the original: "shorten it to N" is not advice about an
 * empty box, so an empty required area stops "add to basket" in plain words.
 *
 * `no-letter` joins it, and the case that put it here is worth writing down.
 * When the first character of a line is one the alphabet has no shape for AND
 * no plain form of, the old code emitted `shortenToChars: 0` and the surface
 * drew "Shorten it to 0" beside "everything before it is fine" — both false,
 * and pressing the button emptied the field and tripped `required-empty`. In
 * ar-EG that was the outcome of the FIRST KEYSTROKE for a shopper typing their
 * own name. There is no number that helps there, so this is refused in words:
 * the alphabet is Latin, and the sentence says so.
 */
export type Block =
  | { zone: string; code: 'required-empty' }
  | { zone: string; code: 'no-letter'; chars: string[] };

export interface Check {
  verdicts: Verdict[];
  /** The same list with the machine detail the surface needs to draw buttons. */
  detail: CodedVerdict[];
  blocks: Block[];
  /**
   * Nothing has been typed into any area at all — the shopper wants the piece
   * as the shop makes it, with no lettering. See `check`.
   */
  plain: boolean;
}

/**
 * ONE WAY OUT OF ONE FAILURE, AS A VALUE THE SURFACE MUST PUT ON A BUTTON.
 *
 * ── WHY THIS TYPE EXISTS, WHICH IS THE WHOLE OF CRITERION 18 ────────────────
 *
 * The surface used to decide, per verdict code, which buttons a failure gets:
 * one branch per code, each reading whichever field of `CodedVerdict` it
 * happened to know about. Two things follow from that and both were real.
 *
 *   1. A CODE COULD SILENTLY GET FEWER BUTTONS THAN THE ENGINE OFFERED. An
 *      `overrun` carries BOTH remedies (D5c), and the guard asked only whether
 *      the screen had at least one `.lp-remedy` in it. A verifier wrapped the
 *      SIZE button in `false &&`, deleting a working way out for every shopper
 *      whose wording will not fit at any length, and the suite stayed green
 *      because the SHORTEN button still satisfied "more than zero".
 *   2. A NEW CODE GOT NONE AT ALL. `no-letter` split into a swappable half and
 *      a stuck half; the swappable half had no branch, so the engine computed
 *      "we cut ' for ’" and the screen drew a sentence with nothing under it.
 *
 * Both are the same defect: the list of remedies lived in the surface, where no
 * suite could compare it with the engine's. It lives HERE now, `remediesFor` is
 * the only thing that builds it, the surface renders whatever it returns
 * without knowing the codes, and `surfaces.test.tsx` asserts every member
 * reaches the screen CARRYING ITS OWN VALUE. A remedy the engine offers cannot
 * be dropped by the surface any more, because the surface no longer chooses.
 *
 * `swap` is why this is a union rather than a number. `Verdict.remedies` in
 * `product-personalizer@1` carries a size and a character count and nothing
 * else, and "cut this mark instead of that one" is neither — the contract's
 * limit, honestly. So the add-on's own invariant is the stronger one: every
 * failing verdict that is not accompanied by a block has at least one remedy
 * here, whatever kind it is.
 */
export type Remedy =
  | { kind: 'size'; sizeMm: number }
  | { kind: 'shorten'; chars: number }
  | { kind: 'swap'; from: string; to: string };

/**
 * Every way out of one verdict, in the order the surface should offer them.
 *
 * Size before length wherever both apply: keeping a customer's whole wording
 * and setting it smaller is the answer a maker gives first, and deleting
 * characters is the one they give when that is not enough.
 *
 * An empty list means one of exactly two things and never a third: the verdict
 * passed, or it is a `Block` — refused in words because no number helps. That
 * pairing is asserted in `template.test.ts` rather than left to be read.
 */
export function remediesFor(entry: CodedVerdict): readonly Remedy[] {
  if (entry.ok) return [];
  const out: Remedy[] = [];

  if (entry.code === 'no-letter') {
    for (const swap of entry.swaps ?? []) out.push({ kind: 'swap', ...swap });
    return out;
  }

  const size = entry.fit !== undefined && !entry.fit.fits ? entry.fit.remedies.setSizeMm : undefined;
  if (size !== undefined) out.push({ kind: 'size', sizeMm: size });
  if (entry.shortenToChars !== undefined) out.push({ kind: 'shorten', chars: entry.shortenToChars });
  return out;
}

/**
 * THE SIZE A FRESH PERSONALIZATION STARTS AT.
 *
 * Four fifths of what the FIRST area will take, rounded to a half millimetre.
 * The first area is the one the piece cannot be cut without, so it is the one
 * whose comfortable size sets the tone; four fifths leaves a shopper room to
 * push it up as well as down, which a maximum would not.
 */
export function defaultSizeMm(t: Template): number {
  const first = t.zones.find((zone) => TEXT_KINDS.has(zone.kind));
  if (first === undefined) return 8;
  const { minMm, maxMm } = sizeRange(first);
  return Math.max(minMm, Math.round(maxMm * 0.8 * 2) / 2);
}

/**
 * The face and size actually in force for a zone.
 *
 * ONE SIZE AND ONE FACE FOR THE WHOLE PERSONALIZATION, because that is what the
 * contract's `Personalization` carries — `font`, `sizeMm` and `finish`, once
 * each. Comp L draws a stepper per area, and the honest way to have both is
 * this: the shopper picks a size, and each area takes as much of it as its own
 * range allows. A date area capped at five and a half millimetres stays at five
 * and a half while the line above it goes to nine, which is what a maker
 * setting those limits meant by setting them.
 */
export function settingsFor(
  p: Personalization,
  zone: Zone,
): { face: Face; capMm: number; finish: ZoneFinish } {
  const allowed = zone.constraints.fonts;
  const wanted = p.font;
  const faceId = wanted !== undefined && (allowed === undefined || allowed.includes(wanted))
    ? wanted
    : allowed?.[0];
  const { minMm, maxMm } = sizeRange(zone);
  const capMm = Math.min(maxMm, Math.max(minMm, p.sizeMm ?? Math.min(maxMm, zone.shape.hMm * 0.62)));
  return { face: faceOf(faceId), capMm, finish: p.finish ?? zone.finish };
}

/** Zones a shopper actually types into. Colour and image zones are cutline. */
const TEXT_KINDS = new Set(['text-line', 'text-block']);

/**
 * ── AN EMPTY PANEL IS A PLAIN PIECE, NOT A HALF-FINISHED ONE (24 D19) ───────
 *
 * `required-empty` is a real rule and it used to fire on arrival. That made
 * switching this add-on ON take a capability away: with it off, a shopper can
 * put a walnut coaster in the basket with the note box untouched and get a
 * plain coaster, which is a thing Birch Row sells. With it on, "Add to basket"
 * was disabled from the moment the page opened and a danger note read "Fill in
 * Top line first." — a piece that was buyable a second ago, refused, because an
 * add-on arrived. D19 says an add-on's arrival is a GAIN, and there is no
 * reading of gain under which a purchasable product stops being purchasable.
 *
 * The maker's flag is still honoured, and it means what a maker means by it:
 * an area the piece cannot be CUT without ONCE YOU ARE LETTERING IT. So the
 * block fires the moment a shopper types anything anywhere — a date typed with
 * the name left blank is a half-finished piece and is refused, which is the
 * case the flag was written for — and does not fire when the whole panel is
 * untouched, which is not personalization at all.
 *
 * `plain` is on the result rather than worked out again by each surface: the
 * host's button and the panel's own foot both read it, and two copies of this
 * reasoning is how a button and the panel above it come to disagree.
 */
export function check(p: Personalization, t: Template): Check {
  const verdicts: Verdict[] = [];
  const detail: CodedVerdict[] = [];
  const blocks: Block[] = [];
  const plain = t.zones
    .filter((zone) => TEXT_KINDS.has(zone.kind))
    .every((zone) => (p.values[zone.id] ?? '').trim() === '');

  for (const zone of t.zones) {
    if (!TEXT_KINDS.has(zone.kind)) continue;
    const raw = p.values[zone.id] ?? '';
    const { face, capMm } = settingsFor(p, zone);

    if (raw.trim() === '') {
      if (isRequired(zone) && !plain) blocks.push({ zone: zone.id, code: 'required-empty' });
      verdicts.push({ zone: zone.id, ok: true });
      detail.push({ zone: zone.id, ok: true });
      continue;
    }

    /*
     * ── THE CHARACTERS THE ALPHABET HAS NO SHAPE FOR ────────────────────────
     *
     * Two kinds, and they get two answers, because ONE answer was wrong for
     * both. What used to happen was a single "shorten it to N" where N is the
     * index of the first missing character — which is a real remedy when the
     * missing character is an `é` in the middle of a line, a rewrite of
     * somebody's name when it is a curly apostrophe, and a dead end that empties
     * the field when it is at index 0.
     *
     *   SWAPPABLE — a typographic mark with an exact plain form the studio does
     *   cut: `’` for `'`, `—` for `-`. Every one of them is offered as itself,
     *   as a button that names both characters, and applying them all clears
     *   the zone. Nothing is deleted and nothing is rewritten silently.
     *
     *   STUCK — a letter with no plain form. `é`, and every letter of a script
     *   this alphabet does not carry. There is a cut before the first of them
     *   IF anything precedes it, and if nothing does there is no number in the
     *   world to offer, so it becomes a block.
     *
     * Swappable is handled FIRST and alone, so every remedy this function
     * offers is one that actually clears the failure it is attached to: with a
     * swappable mark still in the line, a cut at the first stuck letter would
     * leave the line failing for the other reason.
     */
    const shaped = [...shape(raw, face)];
    const missing = shaped.filter((ch) => !hasGlyph(ch));
    if (missing.length > 0) {
      const chars = [...new Set(missing)];
      const swaps = chars.flatMap((from) => {
        const to = substituteFor(from);
        return to === undefined ? [] : [{ from, to }];
      });

      if (swaps.length > 0) {
        verdicts.push({
          zone: zone.id,
          ok: false,
          reason: `the studio cuts ${swaps.map((s) => `${s.to} for ${s.from}`).join(', ')}`,
          /*
           * EMPTY, AND THE EMPTINESS IS THE CONTRACT'S LIMIT RATHER THAN A
           * MISSING REMEDY. `Verdict.remedies` in `product-personalizer@1`
           * carries a size and a character count and nothing else; this remedy
           * is neither, it is "cut this mark instead of that one". Putting
           * `shortenToChars` here to satisfy the shape would hand a host a
           * button that deletes the rest of a customer's name.
           *
           * The add-on's own invariant is the stronger one and it is machine-
           * checked: `remediesFor` returns at least one remedy for every failing
           * verdict this function emits, and `surfaces.test.tsx` asserts each of
           * them reaches the screen carrying its own value.
           */
          remedies: {},
        });
        detail.push({ zone: zone.id, ok: false, code: 'no-letter', chars, swaps });
        continue;
      }

      /*
       * AN INDEX INTO WHAT THE SHOPPER TYPED, for the same reason `fit`'s
       * shortening is: this read the SHAPED string and the button slices the
       * RAW one, and `ß` uppercases to two characters, so on the house sign's
       * uppercase-only face the two indices part company and the cut lands in
       * the wrong place. Walking the raw code points and shaping each one keeps
       * the number meaningful to the only string anything applies it to.
       */
      const firstStuck = [...raw].findIndex((ch) => [...shape(ch, face)].some((c) => !hasGlyph(c)));
      if (firstStuck > 0) {
        verdicts.push({
          zone: zone.id,
          ok: false,
          reason: `the studio has no letter for ${chars.join(' ')}`,
          remedies: { shortenToChars: firstStuck },
        });
        detail.push({
          zone: zone.id,
          ok: false,
          code: 'no-letter-stuck',
          chars,
          // The same number the verdict carries, so the surface can put a button
          // on it. One source, cut once — see `CodedVerdict.shortenToChars`.
          shortenToChars: firstStuck,
        });
        continue;
      }

      // Nothing precedes the first one, so there is no prefix to keep and no
      // number to offer. Refused in words instead — see `Block`.
      verdicts.push({
        zone: zone.id,
        ok: false,
        reason: `the studio has no letter for ${chars.join(' ')}`,
        remedies: {},
      });
      detail.push({ zone: zone.id, ok: false, code: 'no-letter-stuck', chars });
      blocks.push({ zone: zone.id, code: 'no-letter', chars });
      continue;
    }

    const limit = zone.constraints.maxChars;
    if (limit !== undefined && [...raw].length > limit) {
      verdicts.push({
        zone: zone.id,
        ok: false,
        reason: `${[...raw].length - limit} characters over the ${limit} this area takes`,
        remedies: { shortenToChars: limit },
      });
      detail.push({ zone: zone.id, ok: false, code: 'too-many', limit, shortenToChars: limit });
      continue;
    }

    const f = fit(raw, zone, face, capMm);
    if (f.fits) {
      verdicts.push({ zone: zone.id, ok: true });
      detail.push({ zone: zone.id, ok: true, code: f.fine ? 'too-small' : undefined, fit: f });
      continue;
    }
    verdicts.push({
      zone: zone.id,
      ok: false,
      reason: `${f.overMm} mm wider than the area at ${f.capMm} mm`,
      remedies: f.remedies,
    });
    detail.push({
      zone: zone.id,
      ok: false,
      code: 'overrun',
      fit: f,
      ...(f.remedies.shortenToChars === undefined
        ? {}
        : { shortenToChars: f.remedies.shortenToChars }),
    });
  }

  return { verdicts, detail, blocks, plain };
}

/**
 * Is this area one the piece cannot be cut without?
 *
 * THE CONTRACT HAS NO `required` FLAG, AND THIS IS NOT THE PLACE TO INVENT
 * ONE. A field added here would have to be added to
 * `@adminium/add-on-contracts`, to the manifest schema and to both hosts before
 * it meant anything anywhere else, and the whole point of freezing the registry
 * before anything shipped was to stop a v1 contract growing a member per
 * add-on. So the flag travels in the id, which the contract declares as an
 * opaque string and every host passes through untouched: `top:required`.
 *
 * The maker's setup panel writes it and reads it back; a shopper never sees it.
 * What they see is comp L's sentence — "This one is cut into every coaster, so
 * it can't be left empty" — and "Add to basket" refusing until it is filled.
 */
export const REQUIRED_SUFFIX = ':required';

export function isRequired(zone: Zone): boolean {
  return zone.id.endsWith(REQUIRED_SUFFIX);
}

// ── the picture ─────────────────────────────────────────────────────────────

export interface PreviewOptions {
  angle: string;
  widthPx: number;
  /** Draw the maker's zone guides over the piece. */
  guides?: boolean;
  /** The zone being edited — a dashed `--info` outline. */
  editing?: string;
  /** Zones whose content does not fit — a solid `--danger` outline. */
  bad?: readonly string[];
  /** Blow the detail angle up. 1 is the whole piece. */
  zoom?: number;
}

/** The four angles a maker puts up, and how each one is drawn. */
export const ANGLES = ['front', 'three', 'top', 'detail'] as const;
export type AngleId = (typeof ANGLES)[number];

const ANGLE_TRANSFORM: Readonly<Record<string, { skewX: number; scaleY: number; zoom: number }>> = {
  front: { skewX: 0, scaleY: 1, zoom: 1 },
  three: { skewX: -13, scaleY: 0.84, zoom: 0.94 },
  top: { skewX: 0, scaleY: 0.46, zoom: 0.92 },
  detail: { skewX: 0, scaleY: 1, zoom: 2.1 },
};

/** Everything that reaches an attribute is escaped, shopper text most of all. */
export function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const n2 = (n: number) => String(Math.round(n * 100) / 100);

/**
 * THE SAME PICTURE, WITH A NAME ON IT — and why the name is not in the bytes.
 *
 * `previewSvg` emitted `role="img"` and nothing else, so the flagship surface
 * of this add-on had no accessible name at all: a screen reader announced
 * "image" on the product page, again on the basket thumbnail, again on the
 * maker's order line, again in the proof and again on the set-up page, and the
 * shopper never learned what any of them said. It is a picture OF WORDS, and
 * the words were the one thing it did not pass on.
 *
 * THE NAME IS ADDED HERE, NOT WRITTEN BY `previewSvg`, because a name is in the
 * READER'S language and a picture is not. `PreviewRef.digest` is contractually
 * "same values + same angle ⇒ same image"; a locale in those bytes would make
 * that false, and the file id an order carries would change when a shopper
 * switched language. So the digest is taken over the picture, and the name goes
 * on afterwards, at the seam where a locale exists.
 *
 * BOTH `aria-label` AND `<title>`, deliberately. `aria-label` is what names it
 * on a page, and it cannot collide the way an id for `aria-labelledby` would
 * when the same picture appears twice (the basket line and the order line are
 * byte-identical by design — that is criterion 17). `<title>` is the only name
 * an SVG carries once it has left the page as a file.
 */
export function nameSvg(svg: string, name: string): string {
  const at = svg.indexOf('>');
  if (at < 0 || name === '') return svg;
  const escaped = esc(name);
  const open = svg.slice(0, at);
  const rest = svg.slice(at + 1);
  return `${open} aria-label="${escaped}"><title>${escaped}</title>${rest}`;
}

/**
 * The outline of the piece itself, in millimetres, as an SVG path.
 *
 * `inset` pulls the whole outline in by that many millimetres, which is what a
 * SCORE is: the same shape, run lightly, a few millimetres inside the edge.
 */
export function pieceOutline(piece: Piece, inset = 0): string {
  const w = piece.widthMm - inset * 2;
  const h = piece.heightMm - inset * 2;
  const o = inset;
  if (piece.shape === 'ellipse') {
    const rx = w / 2;
    const ry = h / 2;
    return `M ${n2(o)} ${n2(o + ry)} A ${n2(rx)} ${n2(ry)} 0 1 0 ${n2(o + w)} ${n2(o + ry)} A ${n2(rx)} ${n2(ry)} 0 1 0 ${n2(o)} ${n2(o + ry)} Z`;
  }
  const r = piece.shape === 'round' ? Math.max(0.5, (piece.radiusMm ?? 6) - inset / 2) : 0;
  return [
    `M ${n2(o + r)} ${n2(o)}`,
    `H ${n2(o + w - r)}`,
    r > 0 ? `A ${n2(r)} ${n2(r)} 0 0 1 ${n2(o + w)} ${n2(o + r)}` : '',
    `V ${n2(o + h - r)}`,
    r > 0 ? `A ${n2(r)} ${n2(r)} 0 0 1 ${n2(o + w - r)} ${n2(o + h)}` : '',
    `H ${n2(o + r)}`,
    r > 0 ? `A ${n2(r)} ${n2(r)} 0 0 1 ${n2(o)} ${n2(o + h - r)}` : '',
    `V ${n2(o + r)}`,
    r > 0 ? `A ${n2(r)} ${n2(r)} 0 0 1 ${n2(o + r)} ${n2(o)}` : '',
    'Z',
  ]
    .filter(Boolean)
    .join(' ');
}

function circlePath(cx: number, cy: number, r: number): string {
  return `M ${n2(cx - r)} ${n2(cy)} A ${n2(r)} ${n2(r)} 0 1 0 ${n2(cx + r)} ${n2(cy)} A ${n2(r)} ${n2(r)} 0 1 0 ${n2(cx - r)} ${n2(cy)} Z`;
}

/** Where a zone lands on one angle, in millimetres of the piece. */
export function zoneBox(
  zone: Zone,
  angle: string,
  piece: Piece,
): { xMm: number; yMm: number; wMm: number; hMm: number; skewDeg: number } | null {
  const at = zone.perAngle[angle];
  if (at === undefined) return null;
  return {
    xMm: (at.xPct / 100) * piece.widthMm,
    yMm: (at.yPct / 100) * piece.heightMm,
    wMm: (at.wPct / 100) * piece.widthMm,
    hMm: (at.hPct / 100) * piece.heightMm,
    skewDeg: at.skewDeg ?? 0,
  };
}

/**
 * THE PICTURE, AS BYTES.
 *
 * A 2D composite and nothing else (24 D18): a material-textured tile, the piece
 * outline over it, and the shopper's words as SVG text sitting inside a zone,
 * skewed on the angled views and styled per finish. There is no WebGL context
 * here, no mesh, no `.stl` and no `three` — `sources.test.ts` and
 * `built-output.test.ts` both grep for all four, in the source and in the built
 * bundle, because criterion 16 asks for the bundle.
 *
 * EVERY `<text>` CARRIES `textLength`, and that is not a nicety. It is what
 * makes the drawn width equal the width `fit` computed, on a machine with a
 * different font list, in a different browser, in an RTL document. The engine
 * decides how wide the words are; the browser is told.
 */
export function previewSvg(p: Personalization, t: Template, opts: PreviewOptions): string {
  const piece = pieceFor(t.productKey);
  const material = MATERIALS[piece.material];
  const view = ANGLE_TRANSFORM[opts.angle] ?? ANGLE_TRANSFORM.front!;
  const zoom = (opts.zoom ?? 1) * view.zoom;

  const pad = Math.max(piece.widthMm, piece.heightMm) * 0.08;
  const boxW = piece.widthMm + pad * 2;
  const boxH = piece.heightMm + pad * 2;
  const px = opts.widthPx;
  const height = Math.round((px * boxH) / boxW);
  const uid = `p${digestOf(`${t.productKey}|${opts.angle}`)}`;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n2(boxW)} ${n2(boxH)}" width="${px}" height="${height}" role="img">`,
  );
  parts.push(
    `<defs><linearGradient id="${uid}g" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0" stop-color="${material.from}"/><stop offset="1" stop-color="${material.to}"/>` +
      `</linearGradient>` +
      `<clipPath id="${uid}c"><path d="${pieceOutline(piece)}"/></clipPath></defs>`,
  );

  const cx = boxW / 2;
  const cy = boxH / 2;
  const t1 = `translate(${n2(cx)} ${n2(cy)}) scale(${n2(zoom)} ${n2(zoom * view.scaleY)}) skewX(${view.skewX}) translate(${n2(-piece.widthMm / 2)} ${n2(-piece.heightMm / 2)})`;
  parts.push(`<g transform="${t1}">`);

  // The edge that reads as thickness, on the angled views only.
  if (view.skewX !== 0) {
    parts.push(
      `<g transform="translate(0 ${n2(piece.heightMm * 0.035)})"><path d="${pieceOutline(piece)}" fill="${material.edge}"/></g>`,
    );
  }
  parts.push(`<path d="${pieceOutline(piece)}" fill="url(#${uid}g)"/>`);

  if (material.grain !== undefined) {
    const g = material.grain;
    const lines: string[] = [];
    for (let i = 0; i < g.count; i += 1) {
      // Deterministic pseudo-grain: a fixed irrational step, never a dice roll.
      const y = ((i + 0.5) / g.count) * piece.heightMm;
      const wobble = ((i * 0.6180339887) % 1) * piece.heightMm * 0.045;
      lines.push(
        `<path d="M 0 ${n2(y - wobble)} Q ${n2(piece.widthMm / 2)} ${n2(y + wobble)} ${n2(piece.widthMm)} ${n2(y - wobble * 0.4)}" fill="none" stroke="${g.stroke}" stroke-width="${n2(piece.heightMm * 0.008)}" stroke-opacity="${g.opacity}"/>`,
      );
    }
    parts.push(`<g clip-path="url(#${uid}c)">${lines.join('')}</g>`);
  }

  for (const hole of piece.holes ?? []) {
    parts.push(`<path d="${circlePath(hole.xMm, hole.yMm, hole.rMm)}" fill="#00000055"/>`);
  }

  for (const zone of t.zones) {
    const box = zoneBox(zone, opts.angle, piece);
    if (box === null) continue;
    const value = (p.values[zone.id] ?? '').trim();
    const { face, capMm, finish } = settingsFor(p, zone);

    if (opts.guides === true) {
      const bad = (opts.bad ?? []).includes(zone.id);
      const editing = opts.editing === zone.id;
      const stroke = bad ? 'var(--danger)' : editing ? 'var(--info)' : 'var(--info)';
      parts.push(
        `<rect x="${n2(box.xMm)}" y="${n2(box.yMm)}" width="${n2(box.wMm)}" height="${n2(box.hMm)}" rx="${n2(Math.min(2, box.hMm / 6))}" fill="none" stroke="${stroke}" stroke-width="${n2(piece.heightMm * 0.006)}"${bad ? '' : ` stroke-dasharray="${n2(piece.heightMm * 0.018)} ${n2(piece.heightMm * 0.013)}"`} stroke-opacity="${bad || editing ? 1 : 0.55}"/>`,
      );
    }

    if (value === '') continue;
    const text = esc(shape(value, face));
    const widthMm = lineWidthMm(value, face, capMm);
    const x = box.xMm + box.wMm / 2;
    const y = box.yMm + box.hMm / 2 + capMm / 2;
    const common =
      `x="${n2(x)}" y="${n2(y)}" text-anchor="middle" font-family="${face.css.replace(/"/g, "'")}" ` +
      `font-weight="${face.weight}" font-size="${n2(capMm / (face.cap / 1000))}" ` +
      `textLength="${n2(widthMm)}" lengthAdjust="spacingAndGlyphs"`;
    const skew = box.skewDeg !== 0 ? ` transform="rotate(${n2(box.skewDeg)} ${n2(x)} ${n2(y)})"` : '';
    const italic = face.slantDeg !== 0 ? ' font-style="italic"' : '';

    parts.push(`<g${skew}>`);
    if (finish === 'engraved') {
      // A darkened, slightly inset cut: a light ghost below and behind it does
      // the work a soft inner shadow would in a bitmap.
      parts.push(
        `<text ${common}${italic} fill="${material.raised}" fill-opacity="0.32" dy="${n2(capMm * 0.05)}">${text}</text>`,
      );
      parts.push(`<text ${common}${italic} fill="${material.engraved}">${text}</text>`);
    } else if (finish === 'raised') {
      parts.push(
        `<text ${common}${italic} fill="#00000055" dy="${n2(capMm * 0.06)}">${text}</text>`,
      );
      parts.push(`<text ${common}${italic} fill="${material.raised}">${text}</text>`);
    } else if (finish === 'printed') {
      parts.push(`<text ${common}${italic} fill="${material.printed}">${text}</text>`);
    } else {
      parts.push(
        `<text ${common}${italic} fill="${material.paint.white}" stroke="${material.paint.white}" stroke-width="${n2(capMm * 0.02)}" stroke-opacity="0.5">${text}</text>`,
      );
    }
    parts.push('</g>');
  }

  parts.push('</g></svg>');
  return parts.join('');
}

/**
 * FNV-1a over the picture's own bytes, in base 36.
 *
 * Not a cryptographic hash and not pretending to be one: it identifies a
 * picture so that two of them can be compared, which is what criterion 17 asks
 * for. Written out rather than imported because an add-on takes no runtime
 * dependency the host does not already have (24 D7).
 */
export function digestOf(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(7, '0');
}

// ── what goes to the machine ────────────────────────────────────────────────

export type LayerId = 'cut' | 'score' | 'engrave';

export interface ProductionPath {
  layer: LayerId;
  /** Millimetre geometry, in the piece's own coordinates. */
  d: string;
  /** Cut and score are measured in length; engrave in area. */
  lengthMm?: number;
  areaMm2?: number;
}

export interface ProductionFile {
  productKey: string;
  widthMm: number;
  heightMm: number;
  materialId: string;
  paths: readonly ProductionPath[];
  /** Per layer, for the list the maker reads. */
  layers: readonly { layer: LayerId; count: number; lengthMm: number; areaMm2: number }[];
}

/** The shoelace area of a closed polygon, always positive. */
function polyArea(points: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < points.length - 2; i += 2) {
    sum += points[i]! * points[i + 3]! - points[i + 2]! * points[i + 1]!;
  }
  return Math.abs(sum) / 2;
}

function polyPath(points: readonly number[]): string {
  const parts: string[] = [];
  for (let i = 0; i < points.length; i += 2) {
    parts.push(`${i === 0 ? 'M' : 'L'} ${n2(points[i]!)} ${n2(points[i + 1]!)}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

/**
 * ONE ZONE'S WORDS, AS OUTLINES.
 *
 * The pen walks the measured advance table in `faces.ts` — the same table the
 * preview forces `textLength` to — so each letter starts at the millimetre the
 * picture puts it at and the line as a whole is the same width. The letterform
 * is the studio's own cut alphabet (`glyphs.ts`), because this package cannot
 * lift outlines out of somebody's typeface and a file that named one would fail
 * criterion 19 at the last step.
 *
 * The glyph is centred in its advance and scaled to the cap height, then its
 * skeleton is offset by the face's stroke weight into a closed contour. Slanted
 * faces shear about the baseline, which is what a slant is.
 */
export function textOutlines(
  text: string,
  face: Face,
  capMm: number,
  originXMm: number,
  baselineYMm: number,
): number[][] {
  const contours: number[][] = [];
  const half = (face.strokeRatio * capMm) / 2;
  const tan = Math.tan((face.slantDeg * Math.PI) / 180);
  let pen = originXMm;

  for (const ch of shape(text, face)) {
    const advance = advanceMm(ch, face, capMm);
    if (advance === null) continue;
    const glyph = GLYPHS[ch];
    if (glyph !== undefined && glyph.s.length > 0) {
      const inkW = glyph.w * capMm;
      const left = pen + (advance - inkW) / 2;
      for (const stroke of glyph.s) {
        const placed: number[] = [];
        for (let i = 0; i < stroke.length; i += 2) {
          const gx = stroke[i]! * capMm;
          const gy = stroke[i + 1]! * capMm;
          // SVG's y runs down the page; the alphabet's runs up from a baseline.
          placed.push(left + gx + gy * tan, baselineYMm - gy);
        }
        const contour = outlinePolyline(placed, half);
        if (contour.length > 0) contours.push(contour);
      }
    }
    pen += advance;
  }
  return contours;
}

/**
 * WHAT GOES TO THE LASER.
 *
 * Three layers, and the file stops there. Money and machine control are not in
 * this engine (D5c): it produces geometry, it never drives hardware, and the
 * screen that shows it says so in one line — "This is a file, not a machine —
 * send it to your laser the way you always do."
 */
export function toProductionPaths(p: Personalization, t: Template): ProductionFile {
  const piece = pieceFor(t.productKey);
  const paths: ProductionPath[] = [];

  const outline = pieceOutline(piece);
  paths.push({
    layer: 'cut',
    d: outline,
    lengthMm: mm1(2 * (piece.widthMm + piece.heightMm) - (8 - 2 * Math.PI) * (piece.radiusMm ?? 0)),
  });
  for (const hole of piece.holes ?? []) {
    paths.push({
      layer: 'cut',
      d: circlePath(hole.xMm, hole.yMm, hole.rMm),
      lengthMm: mm1(2 * Math.PI * hole.rMm),
    });
  }
  if (piece.scoreInsetMm !== undefined) {
    const inset = piece.scoreInsetMm;
    paths.push({
      layer: 'score',
      d: pieceOutline(piece, inset),
      lengthMm: mm1(2 * (piece.widthMm - inset * 2 + (piece.heightMm - inset * 2))),
    });
  }

  for (const zone of t.zones) {
    if (!TEXT_KINDS.has(zone.kind)) continue;
    const value = (p.values[zone.id] ?? '').trim();
    if (value === '') continue;
    const { face, capMm } = settingsFor(p, zone);
    const widthMm = lineWidthMm(value, face, capMm);
    const originX = zone.shape.xMm + (zone.shape.wMm - widthMm) / 2;
    const baselineY = zone.shape.yMm + zone.shape.hMm / 2 + capMm / 2;
    for (const contour of textOutlines(value, face, capMm, originX, baselineY)) {
      paths.push({ layer: 'engrave', d: polyPath(contour), areaMm2: mm1(polyArea(contour)) });
    }
  }

  const layers = (['cut', 'score', 'engrave'] as LayerId[])
    .map((layer) => {
      const own = paths.filter((path) => path.layer === layer);
      return {
        layer,
        count: own.length,
        lengthMm: mm1(own.reduce((sum, path) => sum + (path.lengthMm ?? 0), 0)),
        areaMm2: mm1(own.reduce((sum, path) => sum + (path.areaMm2 ?? 0), 0)),
      };
    })
    .filter((entry) => entry.count > 0);

  return {
    productKey: t.productKey,
    widthMm: piece.widthMm,
    heightMm: piece.heightMm,
    materialId: piece.material,
    paths,
    layers,
  };
}

/** The colours the maker's layer list uses. Layers, not the interface's accent. */
export const LAYER_COLOUR: Readonly<Record<LayerId, string>> = {
  cut: '#cf273c',
  score: '#1c59e0',
  engrave: '#0b7d59',
};

/**
 * The production file as SVG source.
 *
 * PATHS ONLY — no `<text>`, no `font-family`, no `@font-face`, nothing that
 * could resolve to a typeface on the machine that opens it (criterion 19). The
 * conformance suite reads these bytes back and greps them for all four.
 */
export function productionSvg(p: Personalization, t: Template): string {
  const file = toProductionPaths(p, t);
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n2(file.widthMm)}mm" height="${n2(file.heightMm)}mm" viewBox="0 0 ${n2(file.widthMm)} ${n2(file.heightMm)}">`,
  ];
  for (const layer of ['cut', 'score', 'engrave'] as LayerId[]) {
    const own = file.paths.filter((path) => path.layer === layer);
    if (own.length === 0) continue;
    out.push(`<g id="${layer}" data-layer="${layer}">`);
    for (const path of own) {
      out.push(
        layer === 'engrave'
          ? `<path d="${path.d}" fill="${LAYER_COLOUR[layer]}" fill-rule="evenodd"/>`
          : `<path d="${path.d}" fill="none" stroke="${LAYER_COLOUR[layer]}" stroke-width="0.1"/>`,
      );
    }
    out.push('</g>');
  }
  out.push('</svg>');
  return out.join('');
}
