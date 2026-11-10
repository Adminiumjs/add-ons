/**
 * WHETHER A DESIGN MAY BE MADE AS IT IS, WHAT IT COSTS EXTRA, AND WHAT THE
 * CUSTOMER SHOULD KNOW.
 *
 * `checkDesign` is handed a customer's design, the ready-made design and the
 * base it sits on (with their parts, areas, palettes and priced features), what
 * is known of its files and the shop's settings. It answers three things:
 *
 * - **refusals**, from Adminium's closed list, each with the part it is about:
 *   what stops the design being ordered. The server refuses on exactly these;
 *   the customer's editor shows them and holds "Add to basket" on them.
 * - **advice** the customer sees and the server never refuses on: a logo too
 *   small to read or that may print blurry at its size, lines too fine to
 *   engrave, words hard to read on their colour, words past the safe line.
 * - **features used**: the codes of the priced features the design takes (a
 *   part with a feature, filled; a second side), which the order line must pay
 *   for, no more and no less.
 *
 * It is a plain function of what it is handed: no page, no clock, no fonts, no
 * network. The same design gives the same answer in the browser and on the
 * server. Some advice needs what only the browser knows (a picture's pixels,
 * its finest line, the palette's colours, a font's widths); without it, that
 * advice is simply not given.
 */
import { contrast, READABLE } from './colour.ts';
import { inOrder, num, sameKey, str, yes, type Row } from './read.ts';
import { STARTER_FAMILIES } from './starter.ts';
import {
  choiceRules,
  DESIGN_FORMAT,
  PLACED_LINES_MAX,
  PLACED_SIZE_MAX,
  PLACED_SIZE_MIN,
  PICTURE_KINDS,
  TEXT_MAX,
  type PlacedPart,
  KIND_OF_TYPE,
  LOGO_SMALLEST_MM,
  pictureRules,
  readValues,
  SCALE_MAX,
  SCALE_MIN,
  shapeRules,
  smallestLetterOf,
  startValue,
  textRules,
  VECTOR_KINDS,
  type ChoiceRules,
  type DesignValues,
  type PartKind,
  type PartValue,
  type PictureRules,
  type ShapeRules,
  type TextRules,
} from './shapes.ts';
import { charCount, charLimit, lineCount, printed, sizeAllowed, sizeInMm, sizeThatFits } from './text.ts';

/** Why a design does not stand: Adminium's closed list, which names each in every language. */
export const REASONS = ['too-long', 'required-empty', 'font-not-allowed', 'size-out-of-range', 'colour-not-allowed', 'choice-not-allowed', 'part-locked', 'file-missing', 'file-kind', 'design-unknown', 'format-unknown'] as const;
export type Reason = (typeof REASONS)[number];

/** One file the design holds: what Adminium knows of it, and what the browser measured where it could. */
export interface FileFact {
  /** The design's column that holds it. */
  column: string;
  /** Its type as stored (`image/png`); empty when the file is not there. */
  kind: string;
  /** Its size in bytes; 0 when the file is not there. */
  size: number;
  /** Its width and height in pixels (a vector's own units), where known. */
  px?: readonly [number, number];
  /** Its finest line once made one colour, as a share of its width, where measured. */
  thinnest?: number;
}

/** How wide a line of words is, in millimetres, in a font at a size: only the browser, which has the fonts, can say. */
export type Measure = (line: string, font: string, sizeMm: number, weight: number) => number;

export interface DesignFacts {
  design: Row;
  ready: Row | null;
  parts: readonly Row[];
  base: Row | null;
  areas: readonly Row[];
  palettes: readonly Row[];
  features: readonly Row[];
  /** The palettes' colours, for the advice on words hard to read. */
  colours?: readonly Row[];
  files: readonly FileFact[];
  settings: Row;
  measure?: Measure;
  /**
   * The fonts of the design's own app (its `app`), where they were read. A
   * design set in the full editor may use these and the starter fonts, never
   * a font another app on the install uploaded. Not read: not checked.
   */
  fonts?: readonly Row[];
}

export interface Refusal {
  part?: string;
  reason: Reason;
}

export type Advice =
  | { part: string; kind: 'logo-small'; acrossMm: number; smallestMm: number }
  | { part: string; kind: 'blurry'; px: [number, number]; dpi: number; boxMm: [number, number]; needs: number }
  | { part: string; kind: 'fine-detail'; lineMm: number; smallestMm: number }
  | { part: string; kind: 'hard-to-read'; ratio: number; better: string | null }
  | { part: string; kind: 'past-safe-line'; smaller: number | null };

export interface DesignAnswer {
  /** Whether it may be ordered: exactly when nothing refuses it. */
  ok: boolean;
  refusals: Refusal[];
  advice: Advice[];
  /** The priced features it takes, by code, each once, sorted. */
  used: string[];
}

/** The sharpness a picture needs at its printed size, and the thinnest line the machine keeps, when the settings say nothing. */
export const DEFAULT_MIN_DPI = 150;
export const DEFAULT_SMALLEST_LINE_MM = 0.2;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One part a customer may meet, read once from its row: a ready-made design's part, or an area of a plain base. */
interface Part {
  code: string;
  kind: PartKind;
  locked: boolean;
  required: boolean;
  side: string | null;
  layout: string | null;
  box: Box | null;
  text: TextRules | null;
  picture: PictureRules | null;
  choice: ChoiceRules | null;
  shape: ShapeRules | null;
  start: PartValue | null;
  feature: unknown;
  /** The area it sits on, whose own rules (a 3D printer's smallest letters) it keeps too. */
  area: Row | null;
}

/** A part's name as Adminium can show it: a short word, or nothing. */
const shown = (code: string): string | undefined => (code.length >= 1 && code.length <= 64 ? code : undefined);
const round = (value: number, places: number): number => Math.round(value * 10 ** places) / 10 ** places;

function boxOf(row: Row): Box | null {
  const [x, y, w, h] = [num(row['x_mm']), num(row['y_mm']), num(row['w_mm']), num(row['h_mm'])];
  return w === null || h === null ? null : { x: x ?? 0, y: y ?? 0, w, h };
}

function fromPart(row: Row, areas: readonly Row[]): Part {
  const kind = (['text', 'picture', 'colour', 'choice', 'shape'] as const).find((one) => one === row['kind']) ?? 'shape';
  return {
    code: String(row['code'] ?? ''),
    kind,
    // A shape is always the shop's.
    locked: yes(row['locked']) || kind === 'shape',
    required: yes(row['required']),
    side: str(row['side']),
    layout: str(row['layout']),
    box: boxOf(row),
    text: kind === 'text' ? textRules(row['rules']) : null,
    picture: kind === 'picture' ? pictureRules(row['rules']) : null,
    choice: kind === 'colour' || kind === 'choice' ? choiceRules(row['rules']) : null,
    shape: kind === 'shape' ? shapeRules(row['rules']) : null,
    start: startValue(row['value']),
    feature: row['feature_id'],
    area: areas.find((area) => row['area_id'] !== null && row['area_id'] !== undefined && sameKey(area['id'], row['area_id'])) ?? null,
  };
}

/** An area of a plain base, as a part: words, a logo, or either (words, with a logo in their place). */
function fromArea(row: Row): Part {
  const takes = row['takes'];
  const text = takes === 'logo' ? null : textRules(row['rules']);
  if (text !== null && takes === 'both' && text.alsoLogo === null) text.alsoLogo = pictureRules({});
  return {
    code: String(row['code'] ?? ''),
    kind: takes === 'logo' ? 'picture' : 'text',
    locked: false,
    required: yes(row['required']),
    side: str(row['side']),
    layout: null,
    box: boxOf(row),
    text,
    picture: takes === 'logo' ? pictureRules(row['rules']) : null,
    choice: null,
    shape: null,
    start: null,
    feature: row['feature_id'],
    area: row,
  };
}

/** The design's layouts, by key, in the shop's order. */
export function layoutsOf(ready: Row | null): string[] {
  const raw = ready === null ? null : ready['layouts'];
  const value = typeof raw === 'string' ? (() => { try { return JSON.parse(raw) as unknown; } catch { return null; } })() : raw;
  return Array.isArray(value) ? value.map((one) => (typeof one === 'object' && one !== null ? str((one as Record<string, unknown>)['key']) : null)).filter((key): key is string => key !== null) : [];
}

/** What the design is checked against, once its linkage holds. */
interface Context {
  facts: DesignFacts;
  values: DesignValues;
  parts: Part[];
  /** The parts this design shows: on its sides, in its layout. */
  live: Part[];
  palette: Row | null;
  minDpi: number;
  smallestLine: number;
  refusals: Refusal[];
  advice: Advice[];
  used: Set<string>;
}

const refuse = (context: Pick<Context, 'refusals'>, reason: Reason, part?: string): void => {
  const named = part === undefined ? undefined : shown(part);
  if (context.refusals.some((one) => one.reason === reason && one.part === named)) return;
  context.refusals.push(named === undefined ? { reason } : { part: named, reason });
};

const only = (reason: Reason, part?: string): DesignAnswer => {
  const answer: DesignAnswer = { ok: false, refusals: [], advice: [], used: [] };
  refuse(answer, reason, part);
  return answer;
};

export function checkDesign(facts: DesignFacts): DesignAnswer {
  const { design, ready, base } = facts;
  // The shape it was saved in: a design of another format is never read as this one.
  if (num(design['format']) !== DESIGN_FORMAT) return only('format-unknown');
  const read = readValues(design['values']);
  if (!read.ok) return only('format-unknown', read.bad ?? undefined);
  const values = read.values;

  /*
   * What it is made on. A design names its base, and a ready-made design on
   * that same base when it starts from one; every one of them is the design's
   * own app's. A design that points at another app's rows is a design this
   * shop does not know.
   */
  const named = (column: string) => design[column] !== null && design[column] !== undefined && design[column] !== '';
  if (base === null || !named('base_id') || !sameKey(base['id'], design['base_id'])) return only('design-unknown');
  if (!sameKey(base['app'], design['app'])) return only('design-unknown');
  if (named('ready_design_id')) {
    if (ready === null || !sameKey(ready['id'], design['ready_design_id'])) return only('design-unknown');
    if (!sameKey(ready['app'], design['app']) || !sameKey(ready['base_id'], base['id'])) return only('design-unknown');
  } else if (ready !== null) return only('design-unknown');

  const context: Context = {
    facts,
    values,
    parts: [],
    live: [],
    palette: null,
    minDpi: num(facts.settings['min_dpi']) ?? DEFAULT_MIN_DPI,
    smallestLine: num(facts.settings['smallest_line_mm']) ?? DEFAULT_SMALLEST_LINE_MM,
    refusals: [],
    advice: [],
    used: new Set<string>(),
  };
  const areas = facts.areas.filter((area) => sameKey(area['base_id'], base['id']));
  context.parts = ready === null ? inOrder(areas).map(fromArea) : inOrder(facts.parts.filter((part) => sameKey(part['ready_design_id'], ready['id']))).map((row) => fromPart(row, areas));

  // The layout, the sides and the palette it chose, each one the design offers.
  const layouts = layoutsOf(ready);
  const layout = values.layout ?? layouts[0] ?? null;
  if (values.layout !== undefined && !layouts.includes(values.layout)) refuse(context, 'choice-not-allowed');
  const sides = values.sides ?? 1;
  const baseSides = num(base['sides']) ?? 1;
  if (sides < 1 || sides > Math.max(1, baseSides)) refuse(context, 'choice-not-allowed');
  const palettes = inOrder(facts.palettes.filter((palette) => ready !== null && sameKey(palette['ready_design_id'], ready['id'])));
  context.palette = (values.palette === undefined ? palettes[0] : palettes.find((palette) => palette['code'] === values.palette)) ?? null;
  if (values.palette !== undefined && context.palette === null) refuse(context, 'colour-not-allowed');
  context.live = context.parts.filter((part) => (part.side !== 'back' || sides >= 2) && (part.layout === null || layout === null || part.layout === layout));

  if (values.placed !== undefined) checkPlaced(context, values.placed, base);
  else {
    // A value for a part the design does not have (no part at all), or one only the shop sets.
    for (const code of Object.keys(values.parts)) {
      if (context.parts.filter((part) => part.code === code).every((part) => part.locked)) refuse(context, 'part-locked', code);
    }

    for (const part of context.live) {
      if (part.locked) continue;
      const value = values.parts[part.code] ?? part.start;
      if (part.kind === 'text') checkText(context, part, value);
      else if (part.kind === 'picture') checkPicture(context, part, part.picture!, value);
      else if (part.kind === 'colour' || part.kind === 'choice') checkChoice(context, part, value);
    }
  }

  // A second side costs what the base says it costs.
  if (sides >= 2) costs(context, base['back_feature_id'], undefined);

  const used = [...context.used].sort();
  return { ok: context.refusals.length === 0, refusals: context.refusals, advice: context.advice, used };
}

/**
 * The feature a filled part (or the second side) takes, by its code. A
 * feature the shop's rows do not hold, or one it no longer sells, is a set-up
 * nobody can order: the browser is never shown such a row, and the server
 * reads it and says the same.
 */
function costs(context: Context, feature: unknown, part: string | undefined): void {
  if (feature === null || feature === undefined || feature === '') return;
  const row = context.facts.features.find((one) => sameKey(one['id'], feature));
  const code = row === undefined || (row['active'] !== undefined && row['active'] !== null && !yes(row['active'])) ? null : str(row['code']);
  if (code === null || code === '') refuse(context, 'design-unknown', part);
  else context.used.add(code);
}

function checkText(context: Context, part: Part, value: PartValue | null): void {
  const rules = part.text!;
  const mode = value?.mode ?? (value?.file !== undefined ? 'logo' : 'words');
  if (mode === 'logo') {
    // A part that takes words or a logo, holding a logo.
    if (rules.alsoLogo === null) refuse(context, 'choice-not-allowed', part.code);
    else checkPicture(context, part, rules.alsoLogo, value);
    return;
  }
  const text = value?.text;
  const count = charCount(text);
  if (count === 0) {
    if (part.required) refuse(context, 'required-empty', part.code);
  } else if (rules.alsoLogo === null) {
    costs(context, part.feature, part.code);
  }
  const size = value?.size ?? rules.size;
  const floor = smallestLetterOf(part.area);
  if (value?.size !== undefined && !sizeAllowed(rules, size)) refuse(context, 'size-out-of-range', part.code);
  else if (count > 0 && floor !== null && sizeInMm(rules, size) < floor - 1e-6) refuse(context, 'size-out-of-range', part.code);
  if (count > charLimit(rules, sizeAllowed(rules, size) ? size : rules.size) || lineCount(text) > rules.lines) refuse(context, 'too-long', part.code);
  const fonts = rules.fonts ?? (rules.font === null ? [] : [rules.font]);
  if (value?.font !== undefined && !fonts.includes(value.font)) refuse(context, 'font-not-allowed', part.code);
  const colours = rules.colours ?? (rules.colour === null ? [] : [rules.colour]);
  if (value?.colour !== undefined && !colours.includes(value.colour)) refuse(context, 'colour-not-allowed', part.code);
  finishOf(context, part, rules, value);
  if (count > 0) {
    readable(context, part, rules, value);
    safeLine(context, part, rules, value, size);
  }
}

/** The finish a part is made in: its own choice, the design's, or the shop's; one of those the part offers. */
function finishOf(context: Context, part: Part, rules: Pick<TextRules, 'finishes' | 'finish'>, value: PartValue | null): string | null {
  const finish = value?.finish ?? context.values.finish ?? rules.finish;
  if (finish === null || finish === undefined) return null;
  const offered = rules.finishes ?? (rules.finish === null ? null : [rules.finish]);
  // A part that offers no finish is made as the design is; only a choice made on the part itself must be one it offers.
  if (offered === null ? value?.finish !== undefined : !offered.includes(finish)) refuse(context, 'colour-not-allowed', part.code);
  return finish;
}

function checkPicture(context: Context, part: Part, rules: PictureRules, value: PartValue | null): void {
  if (value?.file === undefined) {
    if (part.required) refuse(context, 'required-empty', part.code);
    return;
  }
  // A picture is kept in the design's own file column; the part names which.
  const file = value.file === rules.file ? context.facts.files.find((one) => one.column === rules.file) : undefined;
  if (file === undefined || file.size <= 0 || file.kind === '') {
    refuse(context, 'file-missing', part.code);
    return;
  }
  const kind = KIND_OF_TYPE[file.kind.toLowerCase()];
  if (kind === undefined || !rules.accept.includes(kind)) refuse(context, 'file-kind', part.code);
  // A 3D-printed item's words and logo are raised from its face or cut into it: only a drawing (an SVG) has edges to raise.
  else if (raisedOrCut(context) && kind !== 'svg') refuse(context, 'file-kind', part.code);
  const fit = value.fit ?? rules.fit;
  if (fit !== 'inside' && fit !== 'fill') refuse(context, 'choice-not-allowed', part.code);
  const scale = value.scale ?? SCALE_MAX;
  if (scale < SCALE_MIN || scale > SCALE_MAX) refuse(context, 'size-out-of-range', part.code);
  if (value.threshold !== undefined && (value.threshold < 1 || value.threshold > 99)) refuse(context, 'choice-not-allowed', part.code);
  const finish = finishOf(context, part, rules, value);
  costs(context, part.feature, part.code);
  if (part.box !== null && kind !== undefined) pictureAdvice(context, part, rules, file, kind, fit === 'fill' ? 'fill' : 'inside', scale / 100, finish);
}

/**
 * Whether a design's pictures are raised from, or cut into, a 3D-printed
 * item: every part of a printed base is, its marked faces carrying its words
 * and logo as solid shapes (raised unless the face says cut in).
 */
function raisedOrCut(context: Context): boolean {
  return context.facts.base?.['kind'] === 'printed';
}

/** What the customer should know about a picture at its printed size. */
function pictureAdvice(context: Context, part: Part, rules: PictureRules, file: FileFact, kind: string, fit: 'inside' | 'fill', scale: number, finish: string | null): void {
  const [w, h] = [part.box!.w * scale, part.box!.h * scale];
  const engraved = rules.colour === 'one' && (finish === null || finish === 'engraved');
  const smallest = rules.smallestMm ?? (rules.colour === 'one' ? LOGO_SMALLEST_MM : null);
  if (rules.picture === 'logo' && smallest !== null && Math.min(w, h) < smallest - 1e-6) context.advice.push({ part: part.code, kind: 'logo-small', acrossMm: round(Math.min(w, h), 1), smallestMm: smallest });
  if (file.px === undefined || !(file.px[0] > 0) || !(file.px[1] > 0)) return;
  // Millimetres a pixel takes on the product: the fit's scale (inside the box, or filling it).
  const mmPerPx = (fit === 'fill' ? Math.max : Math.min)(w / file.px[0], h / file.px[1]);
  if (!VECTOR_KINDS.includes(kind)) {
    const dpi = Math.round(25.4 / mmPerPx);
    if (dpi < context.minDpi) context.advice.push({ part: part.code, kind: 'blurry', px: [file.px[0], file.px[1]], dpi, boxMm: [round(w, 1), round(h, 1)], needs: context.minDpi });
  }
  if (engraved && file.thinnest !== undefined && file.thinnest > 0) {
    const line = file.thinnest * file.px[0] * mmPerPx;
    if (line < context.smallestLine - 1e-9) context.advice.push({ part: part.code, kind: 'fine-detail', lineMm: round(line, 2), smallestMm: context.smallestLine });
  }
}

function checkChoice(context: Context, part: Part, value: PartValue | null): void {
  const rules = part.choice!;
  const choice = value?.choice;
  const reason = part.kind === 'colour' ? 'colour-not-allowed' : 'choice-not-allowed';
  if (choice === undefined || choice === '') {
    if (part.required) refuse(context, 'required-empty', part.code);
    return;
  }
  // With no list, only the shop's own start is a choice.
  const offered = rules.choices ?? (part.start?.choice === undefined ? [] : [part.start.choice]);
  if (!offered.includes(choice)) refuse(context, reason, part.code);
  costs(context, part.feature, part.code);
}

/** The colour of a palette role in the design's palette, or a colour written out. */
function hexOf(context: Context, role: string | null): string | null {
  if (role === null) return null;
  if (/^#[0-9a-fA-F]{6}$/.test(role)) return role;
  const palette = context.palette;
  if (palette === null || context.facts.colours === undefined) return null;
  const row = context.facts.colours.find((one) => sameKey(one['palette_id'], palette['id']) && one['code'] === role);
  return row === undefined ? null : str(row['hex']);
}

/** What lies under the middle of a part: the shop's last shape there, the paper, or nothing known (a picture). */
function under(context: Context, part: Part): string | null {
  const box = part.box!;
  const [cx, cy] = [box.x + box.w / 2, box.y + box.h / 2];
  const below = context.live.slice(0, context.live.indexOf(part)).filter((one) => one.side === part.side).reverse();
  for (const one of below) {
    const b = one.box;
    if (b === null || cx < b.x || cx > b.x + b.w || cy < b.y || cy > b.y + b.h) continue;
    if (one.kind === 'shape') {
      if (one.shape!.shape === 'ellipse') {
        const [ex, ey] = [(cx - (b.x + b.w / 2)) / (b.w / 2), (cy - (b.y + b.h / 2)) / (b.h / 2)];
        if (ex * ex + ey * ey > 1) continue;
      }
      return hexOf(context, one.shape!.fill);
    }
    if (one.kind === 'picture') {
      if (context.values.parts[one.code]?.file !== undefined) return null;
      continue;
    }
  }
  return hexOf(context, 'paper') ?? '#ffffff';
}

function readable(context: Context, part: Part, rules: TextRules, value: PartValue | null): void {
  if (part.box === null || context.facts.colours === undefined) return;
  const role = value?.colour ?? rules.colour ?? 'ink';
  const [ink, behind] = [hexOf(context, role), under(context, part)];
  if (ink === null || behind === null) return;
  const ratio = contrast(ink, behind);
  if (ratio === null || ratio >= READABLE) return;
  const better = (rules.colours ?? [])
    .map((one) => ({ one, ratio: (() => { const hex = hexOf(context, one); return hex === null ? 0 : (contrast(hex, behind) ?? 0); })() }))
    .filter((one) => one.ratio >= READABLE)
    .sort((a, b) => b.ratio - a.ratio)[0];
  context.advice.push({ part: part.code, kind: 'hard-to-read', ratio: round(ratio, 2), better: better?.one ?? null });
}

function safeLine(context: Context, part: Part, rules: TextRules, value: PartValue | null, size: number): void {
  const measure = context.facts.measure;
  const base = context.facts.base!;
  const safe = num(base['safe_mm']);
  const width = num(base['width_mm']);
  if (measure === undefined || safe === null || width === null || part.box === null) return;
  const font = value?.font ?? rules.font ?? '';
  const lines = printed(value?.text).split(/\r?\n/);
  const box = part.box;
  const fits = (at: number): boolean => {
    const wide = Math.max(...lines.map((line) => measure(line, font, sizeInMm(rules, at), rules.weight)));
    const x0 = rules.align === 'center' ? box.x + (box.w - wide) / 2 : rules.align === 'end' ? box.x + box.w - wide : box.x;
    return x0 >= safe - 0.01 && x0 + wide <= width - safe + 0.01;
  };
  if (fits(size)) return;
  context.advice.push({ part: part.code, kind: 'past-safe-line', smaller: sizeThatFits(rules, printed(value?.text), size, fits) });
}

/** The palette roles every page knows, and a colour written out. */
const ROLES = ['paper', 'ink', 'accent'];
const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * A design made in the full editor: its own parts, on a page only. Each part
 * stays on a side the design is made with, has a size, and lies on the page
 * or its bleed; words are as long as any part takes and set at a size from 4
 * to 200 pt; a colour is a palette role or a colour written out; a picture is
 * one the design keeps, of a kind a picture may be. None of them is a priced
 * feature: the second side is the only one, as for any design. The design's
 * form parts were given up for these, so a value for one is refused.
 */
function checkPlaced(context: Context, placed: readonly PlacedPart[], base: Row): void {
  if (base['kind'] !== 'page') {
    refuse(context, 'choice-not-allowed');
    return;
  }
  for (const code of Object.keys(context.values.parts)) refuse(context, 'part-locked', code);
  const sides = context.values.sides ?? 1;
  const [width, height, bleed] = [num(base['width_mm']) ?? 0, num(base['height_mm']) ?? 0, num(base['bleed_mm']) ?? 0];
  const palette = context.palette;
  const roles = [...ROLES, ...(palette === null || context.facts.colours === undefined ? [] : context.facts.colours.filter((one) => sameKey(one['palette_id'], palette['id'])).map((one) => String(one['code'] ?? '')))];
  for (const part of placed) {
    if (part.side === 'back' && sides < 2) refuse(context, 'choice-not-allowed', part.id);
    const onPage = part.w > 0 && part.h > 0 && part.w <= (width + 2 * bleed) * 2 && part.h <= (height + 2 * bleed) * 2 && part.x < width + bleed && part.y < height + bleed && part.x + part.w > -bleed && part.y + part.h > -bleed;
    if (!onPage) refuse(context, 'size-out-of-range', part.id);
    if (part.colour !== undefined && !HEX.test(part.colour) && !roles.includes(part.colour)) refuse(context, 'colour-not-allowed', part.id);
    if (part.kind === 'text') {
      if (charCount(part.text) > TEXT_MAX || lineCount(part.text) > PLACED_LINES_MAX) refuse(context, 'too-long', part.id);
      // Another app's upload is never this shop's to offer; its own stays, offered or not, switched on or off (the editor offers only the base's that are on).
      const own = context.facts.fonts;
      if (part.font !== undefined && own !== undefined && !STARTER_FAMILIES.includes(part.font) && !own.some((font) => font['family'] === part.font)) refuse(context, 'font-not-allowed', part.id);
      if (part.size !== undefined && (part.size < PLACED_SIZE_MIN || part.size > PLACED_SIZE_MAX)) refuse(context, 'size-out-of-range', part.id);
    } else if (part.kind === 'image') {
      const file = part.file === undefined ? undefined : context.facts.files.find((one) => one.column === part.file);
      if (file === undefined || file.size <= 0 || file.kind === '') {
        refuse(context, 'file-missing', part.id);
        continue;
      }
      const kind = KIND_OF_TYPE[file.kind.toLowerCase()];
      if (kind === undefined || !(PICTURE_KINDS as readonly string[]).includes(kind)) {
        refuse(context, 'file-kind', part.id);
        continue;
      }
      const shown: Part = { code: part.id, kind: 'picture', locked: false, required: false, side: part.side, layout: null, box: { x: part.x, y: part.y, w: part.w, h: part.h }, text: null, picture: null, choice: null, shape: null, start: null, feature: null, area: null };
      pictureAdvice(context, shown, pictureRules({ fit: part.fit ?? 'inside' }), file, kind, part.fit === 'fill' ? 'fill' : 'inside', 1, null);
    }
  }
}
