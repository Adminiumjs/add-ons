/**
 * WHAT A PART MAY BE, AND WHAT A DESIGN SAVES — the two shapes every user of
 * the rules reads and writes.
 *
 * **A part's rules** (`ready_parts.rules`, and `base_areas.rules` for the
 * areas a plain piece or a blank page offers) are JSON, one shape per kind of
 * part:
 *
 * - `text`: `chars` (the most characters at the design's `size`), `grows`
 *   (whether smaller letters fit more: on for laser pieces, off for printed
 *   pages), `unit` (`mm` on a piece, `pt` on a page), the sizes allowed (a
 *   `min`–`max` range, or a list `sizes`), `fonts` and the starting `font`,
 *   `colours` (palette roles) and `colour`, `finishes` and `finish`, `lines`
 *   (most lines, 1 when not said), `align`, `weight`, `upper`, a
 *   `placeholder`, and `alsoLogo` (the picture rules, where the part takes
 *   words or a logo).
 * - `picture`: `picture` (`logo` or `photo`), `fit` (`inside` or `fill`),
 *   `file` (the design's file column it is kept in), `colour` (`one` for
 *   engraving, `full`), `accept` (the kinds of file it takes), `smallestMm`
 *   (below this across, a logo is too small to read).
 * - `colour` and `choice`: `choices` (the codes it offers), and for a colour
 *   the `palette` they come from.
 * - `shape`: drawn by the shop and never changed by a customer.
 *
 * An area may add `smallestLetterMm`: the smallest letters a 3D printer keeps.
 *
 * **A design's values** (`designs.values`, saved with `format` 1) are
 * `{ layout?, palette?, finish?, sides?, parts: { <part code>: value } }`, a
 * value holding what the customer chose for one part: `text`, `font`, `size`,
 * `colour`, `finish`, `choice`, `mode` (`words` or `logo`, where a part takes
 * either), and for a picture `file` (the design's file column holding it),
 * `fit`, `scale` (per cent of its box), `nx` / `ny` (millimetres it is nudged
 * from the middle of its box) and `threshold` (where light becomes dark, for
 * one colour).
 *
 * A design made in the full editor (a printed page started blank, or a
 * ready-made design whose parts the customer moved) holds its parts itself,
 * in `placed`, and nothing in `parts`: each a box in millimetres from the
 * trim's top-left on one side (`id`, `side`, `kind`, `x`, `y`, `w`, `h`, a
 * `name` for its layer), words (`text`, `font`, `size` in points, `weight`,
 * `align`), a colour (`colour`: a palette role, or a colour written out
 * `#rrggbb`; a shape's fill, the words' ink), or a picture (`file`, the
 * design's file column holding it, and `fit`). Their order is the order they
 * are drawn in, the first at the back. Nothing else: a design that holds
 * anything else was not saved in this format.
 */
import { isObject, json, num, numbers, str, words, yes, type Row } from './read.ts';

/** The version of the shape a design's data is written in. A design keeps the number it was saved with. */
export const DESIGN_FORMAT = 1;

/** A point in millimetres. */
export const PT_MM = 25.4 / 72;
/** Where a logo's size in its box may go, in per cent (the comp's slider). */
export const SCALE_MIN = 30;
export const SCALE_MAX = 100;
/** The most characters any part takes, when its rules name none. */
export const TEXT_MAX = 400;
/** Below this many millimetres across, an engraved logo is too small to read (the comp's figure). */
export const LOGO_SMALLEST_MM = 15;
/** The kinds of file a picture takes when its rules name none. */
export const PICTURE_KINDS = ['png', 'jpeg', 'pdf', 'svg'] as const;
/** A stored file's type, by the short name a part's rules use. */
export const KIND_OF_TYPE: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'image/svg+xml': 'svg',
};
/** The kinds drawn from their own lines and curves: sharp at any size. */
export const VECTOR_KINDS: readonly string[] = ['pdf', 'svg'];

export type PartKind = 'text' | 'picture' | 'colour' | 'choice' | 'shape';
export type Align = 'start' | 'center' | 'end';
export type Fit = 'inside' | 'fill';

export interface PictureRules {
  picture: 'logo' | 'photo';
  fit: Fit;
  file: string;
  colour: 'one' | 'full' | null;
  accept: readonly string[];
  smallestMm: number | null;
  finishes: string[] | null;
  finish: string | null;
}

export interface TextRules {
  chars: number;
  grows: boolean;
  unit: 'mm' | 'pt';
  size: number;
  min: number | null;
  max: number | null;
  sizes: number[] | null;
  fonts: string[] | null;
  font: string | null;
  colours: string[] | null;
  colour: string | null;
  finishes: string[] | null;
  finish: string | null;
  lines: number;
  align: Align;
  weight: number;
  alsoLogo: PictureRules | null;
}

export interface ChoiceRules {
  choices: string[] | null;
  palette: string | null;
}

export interface ShapeRules {
  shape: string | null;
  /** The palette role it is filled with ("paper", "accent"). */
  fill: string | null;
}

/** One value a customer chose for one part. */
export interface PartValue {
  text?: string;
  font?: string;
  size?: number;
  colour?: string;
  finish?: string;
  choice?: string;
  mode?: 'words' | 'logo';
  file?: string;
  fit?: string;
  scale?: number;
  nx?: number;
  ny?: number;
  threshold?: number;
}

export type PlacedKind = 'text' | 'image' | 'rect' | 'ellipse' | 'line';

/** One part of a design made in the full editor. */
export interface PlacedPart {
  id: string;
  side: 'front' | 'back';
  kind: PlacedKind;
  x: number;
  y: number;
  w: number;
  h: number;
  name?: string;
  text?: string;
  font?: string;
  size?: number;
  weight?: number;
  align?: Align;
  colour?: string;
  file?: string;
  fit?: Fit;
}

export interface DesignValues {
  layout?: string;
  palette?: string;
  finish?: string;
  sides?: number;
  parts: Record<string, PartValue>;
  /** The parts of a design made in the full editor, back to front. */
  placed?: PlacedPart[];
}

/** The most parts a design made in the full editor holds, and the longest name a part or its id may have. */
export const PLACED_MAX = 60;
export const PLACED_ID_MAX = 32;
export const PLACED_NAME_MAX = 80;
/** The sizes words may be set at in the full editor, in points. */
export const PLACED_SIZE_MIN = 4;
export const PLACED_SIZE_MAX = 200;
/** The most lines words may run to in the full editor. */
export const PLACED_LINES_MAX = 20;

const PLACED_KINDS: readonly PlacedKind[] = ['text', 'image', 'rect', 'ellipse', 'line'];
const PLACED_TEXT_KEYS = ['id', 'side', 'kind', 'name', 'text', 'font', 'align', 'colour', 'file', 'fit'] as const;
const PLACED_NUMBER_KEYS = ['x', 'y', 'w', 'h', 'size', 'weight'] as const;

/** A full editor's parts in format 1, or null when they are not in the shape. */
function readPlaced(raw: unknown): PlacedPart[] | null {
  if (!Array.isArray(raw) || raw.length > PLACED_MAX) return null;
  const out: PlacedPart[] = [];
  const ids = new Set<string>();
  for (const one of raw) {
    if (!isObject(one)) return null;
    for (const [key, field] of Object.entries(one)) {
      if ((PLACED_TEXT_KEYS as readonly string[]).includes(key)) {
        if (typeof field !== 'string') return null;
      } else if ((PLACED_NUMBER_KEYS as readonly string[]).includes(key)) {
        if (typeof field !== 'number' || !Number.isFinite(field)) return null;
      } else return null;
    }
    const { id, side, kind, align, fit, name } = one as Record<string, unknown>;
    if (typeof id !== 'string' || id === '' || id.length > PLACED_ID_MAX || ids.has(id)) return null;
    if (side !== 'front' && side !== 'back') return null;
    if (!PLACED_KINDS.includes(kind as PlacedKind)) return null;
    if (['x', 'y', 'w', 'h'].some((key) => typeof (one as Record<string, unknown>)[key] !== 'number')) return null;
    if (align !== undefined && align !== 'start' && align !== 'center' && align !== 'end') return null;
    if (fit !== undefined && fit !== 'inside' && fit !== 'fill') return null;
    if (typeof name === 'string' && name.length > PLACED_NAME_MAX) return null;
    ids.add(id);
    out.push(one as unknown as PlacedPart);
  }
  return out;
}

const TEXT_KEYS = ['text', 'font', 'colour', 'finish', 'choice', 'mode', 'file', 'fit'] as const;
const NUMBER_KEYS = ['size', 'scale', 'nx', 'ny', 'threshold'] as const;

/**
 * A design's values in format 1, or what is wrong: `bad` names the part whose
 * value is not in the shape (none when the whole is not).
 */
export function readValues(raw: unknown): { ok: true; values: DesignValues } | { ok: false; bad: string | null } {
  const value = raw === null || raw === undefined ? {} : json(raw);
  if (!isObject(value)) return { ok: false, bad: null };
  for (const key of Object.keys(value)) if (!['layout', 'palette', 'finish', 'sides', 'parts', 'placed'].includes(key)) return { ok: false, bad: null };
  const placed = value['placed'] === undefined ? undefined : readPlaced(value['placed']);
  if (placed === null) return { ok: false, bad: null };
  for (const key of ['layout', 'palette', 'finish'] as const) if (value[key] !== undefined && typeof value[key] !== 'string') return { ok: false, bad: null };
  if (value['sides'] !== undefined && (typeof value['sides'] !== 'number' || !Number.isInteger(value['sides']))) return { ok: false, bad: null };
  const parts = value['parts'] ?? {};
  if (!isObject(parts)) return { ok: false, bad: null };
  // No prototype: a part named `constructor` or `__proto__` is a key like any other, never something inherited.
  const out = Object.create(null) as Record<string, PartValue>;
  for (const [code, one] of Object.entries(parts)) {
    if (!isObject(one)) return { ok: false, bad: code };
    for (const [key, field] of Object.entries(one)) {
      if ((TEXT_KEYS as readonly string[]).includes(key)) {
        if (typeof field !== 'string') return { ok: false, bad: code };
      } else if ((NUMBER_KEYS as readonly string[]).includes(key)) {
        if (typeof field !== 'number' || !Number.isFinite(field)) return { ok: false, bad: code };
      } else return { ok: false, bad: code };
    }
    if (one['mode'] !== undefined && one['mode'] !== 'words' && one['mode'] !== 'logo') return { ok: false, bad: code };
    out[code] = one as PartValue;
  }
  return {
    ok: true,
    values: {
      ...(value['layout'] === undefined ? {} : { layout: value['layout'] as string }),
      ...(value['palette'] === undefined ? {} : { palette: value['palette'] as string }),
      ...(value['finish'] === undefined ? {} : { finish: value['finish'] as string }),
      ...(value['sides'] === undefined ? {} : { sides: value['sides'] as number }),
      parts: out,
      ...(placed === undefined ? {} : { placed }),
    },
  };
}

/** A part's rules as JSON, or nothing when the shop's row holds none it can read. */
const rulesOf = (raw: unknown): Record<string, unknown> => {
  const value = json(raw);
  return isObject(value) ? value : {};
};

export function pictureRules(raw: unknown, fallback: 'logo' | 'photo' = 'logo'): PictureRules {
  const r = isObject(raw) ? raw : rulesOf(raw);
  const picture = r['picture'] === 'photo' ? 'photo' : r['picture'] === 'logo' ? 'logo' : fallback;
  return {
    picture,
    fit: r['fit'] === 'fill' ? 'fill' : r['fit'] === 'inside' ? 'inside' : picture === 'photo' ? 'fill' : 'inside',
    file: str(r['file']) ?? (picture === 'photo' ? 'photo_file' : 'logo_file'),
    colour: r['colour'] === 'one' ? 'one' : r['colour'] === 'full' ? 'full' : null,
    accept: words(r['accept']) ?? PICTURE_KINDS,
    smallestMm: num(r['smallestMm']),
    finishes: words(r['finishes']),
    finish: str(r['finish']),
  };
}

export function textRules(raw: unknown): TextRules {
  const r = rulesOf(raw);
  const size = num(r['size']) ?? 0;
  const align = r['align'];
  return {
    chars: Math.max(0, Math.floor(num(r['chars']) ?? TEXT_MAX)),
    grows: yes(r['grows']),
    unit: r['unit'] === 'pt' ? 'pt' : 'mm',
    size,
    min: num(r['min']),
    max: num(r['max']),
    sizes: numbers(r['sizes']),
    fonts: words(r['fonts']),
    font: str(r['font']),
    colours: words(r['colours']),
    colour: str(r['colour']),
    finishes: words(r['finishes']),
    finish: str(r['finish']),
    lines: Math.max(1, Math.floor(num(r['lines']) ?? 1)),
    align: align === 'center' || align === 'end' ? align : 'start',
    weight: num(r['weight']) ?? 400,
    alsoLogo: isObject(r['alsoLogo']) ? pictureRules(r['alsoLogo']) : null,
  };
}

export function choiceRules(raw: unknown): ChoiceRules {
  const r = rulesOf(raw);
  return { choices: words(r['choices']), palette: str(r['palette']) };
}

export function shapeRules(raw: unknown): ShapeRules {
  const r = rulesOf(raw);
  return { shape: str(r['shape']), fill: str(r['fill']) };
}

/** An area's own floor for letters (a 3D printer's smallest), in millimetres. */
export const smallestLetterOf = (area: Row | null): number | null => (area === null ? null : num(rulesOf(area['rules'])['smallestLetterMm']));

/** A part's start value, as the shop set it: only where it is a value of the shape. */
export function startValue(raw: unknown): PartValue | null {
  const value = json(raw);
  if (!isObject(value)) return null;
  const checked = readValues({ parts: { start: value } });
  return checked.ok ? (checked.values.parts['start'] ?? null) : null;
}
