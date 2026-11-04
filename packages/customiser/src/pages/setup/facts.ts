/**
 * THE SET-UP, AS DATA: what each step of a base's set-up reads and writes,
 * with no screen in it. The screens draw it; these functions decide it, and
 * `model.test.ts` holds them to the comp's figures.
 *
 * A base is kept in millimetres (`bases`, `base_areas`). The comp places an
 * area in per cent of the face; here it is kept in millimetres of the piece
 * or of the page's trim, the unit the rules and the production files read.
 */
import type { DataRow, DataValue } from '../shared/host.ts';

export const STEPS = ['base', 'areas', 'designs', 'fonts', 'prices', 'preview', 'publish'] as const;
export type Step = (typeof STEPS)[number];
export const isStep = (value: unknown): value is Step => typeof value === 'string' && (STEPS as readonly string[]).includes(value);

export type Kind = 'page' | 'piece' | 'kit' | 'printed';
export const KINDS: readonly Kind[] = ['page', 'piece', 'kit', 'printed'];
/** The kinds this release sets up in full; a 3D-printed item needs its model to print, which comes later. */
export const SET_UP_NOW: readonly Kind[] = ['page', 'piece', 'kit'];
export const kindOf = (row: DataRow | null): Kind => {
  const kind = row?.['kind'];
  return kind === 'page' || kind === 'kit' || kind === 'printed' ? kind : 'piece';
};

/** The two shop apps a Customiser serves, by their keys. */
export const APPS = ['maker', 'printing'] as const;
export type App = (typeof APPS)[number];

/** The outline's and a font's cap, as the comps and Adminium say: 2 MB each. */
export const OUTLINE_BYTES = 2 * 1024 * 1024;
export const FONT_BYTES = 2 * 1024 * 1024;

/* ── reading a row ─────────────────────────────────────────────────────── */

export const num = (value: DataValue | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};
export const text = (value: DataValue | undefined): string => (value === null || value === undefined ? '' : String(value));
export const yes = (value: DataValue | undefined): boolean => value === true || value === 1 || value === '1' || value === 'true';

/** A JSON column as an object, whether the database handed it parsed or as text. */
export function jsonOf(value: DataValue | undefined): Record<string, unknown> {
  // Some databases hand a JSON column back parsed; the kit's type says text.
  const held: unknown = value;
  if (typeof held === 'object' && held !== null && !Array.isArray(held)) return held as Record<string, unknown>;
  if (typeof value !== 'string') return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
const words = (value: unknown): string[] => (Array.isArray(value) ? value.filter((one): one is string => typeof one === 'string') : []);

/** A figure in millimetres as people read it: at most one decimal, none when whole. */
export const mm = (value: number): string => String(Math.round(value * 10) / 10);

/* ── what a base offers ────────────────────────────────────────────────── */

export interface Offered {
  fonts: string[];
  finishes: string[];
}
export function offeredOf(base: DataRow | null): Offered {
  const raw = jsonOf(base?.['offered']);
  return { fonts: words(raw['fonts']), finishes: words(raw['finishes']) };
}
/** The base's offer with one font or finish switched. */
export function toggled(offered: Offered, field: keyof Offered, value: string): Offered {
  const list = offered[field];
  return { ...offered, [field]: list.includes(value) ? list.filter((one) => one !== value) : [...list, value] };
}

/* ── the base step ─────────────────────────────────────────────────────── */

export interface Size {
  width: number;
  height: number;
}
export function sizeOf(base: DataRow | null): Size {
  return { width: num(base?.['width_mm']) ?? 0, height: num(base?.['height_mm']) ?? 0 };
}

/** A page's trim, bleed and safe line, as its row holds them (the settings' defaults where it holds none). */
export interface PageGuides extends Size {
  bleed: number;
  safe: number;
  sides: 1 | 2;
  corner: number;
}
export function guidesOf(base: DataRow | null, defaults: { bleed: number; safe: number } = { bleed: 3, safe: 4 }): PageGuides {
  return {
    ...sizeOf(base),
    bleed: num(base?.['bleed_mm']) ?? defaults.bleed,
    safe: num(base?.['safe_mm']) ?? defaults.safe,
    sides: num(base?.['sides']) === 2 ? 2 : 1,
    corner: num(base?.['corner_mm']) ?? 0,
  };
}

/** Whether the base is done: a page has its size; a piece has its size and its outline; a kit its size and its model. */
export function baseReady(base: DataRow | null): boolean {
  const kind = kindOf(base);
  const { width, height } = sizeOf(base);
  if (width <= 0 || height <= 0) return false;
  if (kind === 'page') return true;
  if (kind === 'piece') return text(base?.['outline_file']) !== '';
  // A kit is shown to shoppers as its model put together: it is ready once the model is in.
  if (kind === 'kit') return text(base?.['model_file']) !== '';
  return false;
}

/** The materials other bases of the same app are cut from, each once, by material and thickness. */
export function materialsIn(bases: readonly DataRow[]): { material: string; thickness: number }[] {
  const seen = new Map<string, { material: string; thickness: number }>();
  for (const base of bases) {
    const material = text(base['material']).trim();
    const thickness = num(base['thickness_mm']);
    if (material === '' || thickness === null || kindOf(base) === 'page') continue;
    seen.set(`${material.toLowerCase()}|${String(thickness)}`, { material, thickness });
  }
  return [...seen.values()].sort((a, b) => a.material.localeCompare(b.material) || a.thickness - b.thickness);
}

/* ── areas ─────────────────────────────────────────────────────────────── */

export type Takes = 'words' | 'logo' | 'both';
export type Shape = 'rect' | 'oval';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export function boxOf(area: DataRow): Box {
  return { x: num(area['x_mm']) ?? 0, y: num(area['y_mm']) ?? 0, w: num(area['w_mm']) ?? 0, h: num(area['h_mm']) ?? 0 };
}
/** The box as the area's columns, rounded to the half millimetre the comp moves in. */
export const boxValues = (box: Box): Record<string, number> => ({ x_mm: half(box.x), y_mm: half(box.y), w_mm: half(box.w), h_mm: half(box.h) });
const half = (value: number): number => Math.round(value * 2) / 2;
const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value));

/** The comp's standard size, for Enter in draw mode: a band across the middle of the face (25 %, 38 %, 50 % × 18 %). */
export function standardBox(size: Size): Box {
  return { x: size.width * 0.25, y: size.height * 0.38, w: size.width * 0.5, h: size.height * 0.18 };
}

/** The smallest an area may be drawn, as the comp's: 4 % across, 3 % down. A smaller drag draws nothing. */
export const drawnEnough = (box: Box, size: Size): boolean => box.w >= size.width * 0.04 && box.h >= size.height * 0.03;

/** The box a drag from one point to another draws, kept on the face. */
export function dragged(from: { x: number; y: number }, to: { x: number; y: number }, size: Size): Box {
  const a = { x: clamp(from.x, 0, size.width), y: clamp(from.y, 0, size.height) };
  const b = { x: clamp(to.x, 0, size.width), y: clamp(to.y, 0, size.height) };
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
}

/** The smallest an area may be resized to: 5 % across, 4 % down (the comp's). */
const least = (size: Size) => ({ w: size.width * 0.05, h: size.height * 0.04 });

/** A box moved by a distance, kept on the face. */
export function moved(box: Box, dx: number, dy: number, size: Size): Box {
  return { ...box, x: clamp(box.x + dx, 0, Math.max(0, size.width - box.w)), y: clamp(box.y + dy, 0, Math.max(0, size.height - box.h)) };
}
/** A box resized from its corner by a distance, kept on the face and never smaller than the least. */
export function resized(box: Box, dw: number, dh: number, size: Size): Box {
  const floor = least(size);
  return { ...box, w: clamp(box.w + dw, floor.w, Math.max(floor.w, size.width - box.x)), h: clamp(box.h + dh, floor.h, Math.max(floor.h, size.height - box.y)) };
}

/**
 * An arrow key on the focused face: one step moves the selected area (a
 * hundredth of the face, as the comp's 1 %), Shift five, and Alt resizes it
 * instead. Answers null for a key that is not an arrow.
 */
export function nudged(box: Box, key: string, how: { shift: boolean; alt: boolean }, size: Size): Box | null {
  const way: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const dir = way[key];
  if (dir === undefined) return null;
  const steps = how.shift ? 5 : 1;
  const dx = dir[0] * steps * (size.width / 100);
  const dy = dir[1] * steps * (size.height / 100);
  return how.alt ? resized(box, dx, dy, size) : moved(box, dx, dy, size);
}

export function takesOf(area: DataRow): Takes {
  const takes = area['takes'];
  return takes === 'logo' || takes === 'both' ? takes : 'words';
}

/** The words an area's rules hold, as its form edits them. */
export interface WordsRules {
  chars: number;
  min: number;
  max: number;
  fonts: string[];
  finishes: string[];
}

/**
 * What a new area starts with, as the comp's (`addArea`): 20 characters, a
 * size between 4 and a tenth of the piece across, the base's first two fonts
 * and finishes. On a page the sizes are points and the limit is fixed; on a
 * piece they are millimetres and smaller letters fit more.
 */
export function startRules(kind: Kind, size: Size, offered: Offered): Record<string, unknown> {
  const page = kind === 'page';
  const designSize = page ? 9 : Math.max(5, Math.round(size.width / 16));
  return {
    chars: 20,
    grows: !page,
    unit: page ? 'pt' : 'mm',
    size: designSize,
    min: page ? 7 : 4,
    max: page ? 14 : Math.max(8, Math.round(size.width / 10)),
    fonts: offered.fonts.slice(0, 2),
    ...(offered.fonts[0] === undefined ? {} : { font: offered.fonts[0] }),
    finishes: page ? [] : offered.finishes.slice(0, 2),
    ...(page || offered.finishes[0] === undefined ? {} : { finish: offered.finishes[0] }),
  };
}

/** The rules of a logo, as an area that takes one keeps them: fitted inside its box, one colour where it is engraved. */
export const logoRules = (kind: Kind): Record<string, unknown> => ({ picture: 'logo', fit: 'inside', colour: kind === 'page' ? 'full' : 'one', file: 'logo_file' });

export function wordsRulesOf(area: DataRow): WordsRules {
  const rules = jsonOf(area['rules']);
  const of = (key: string, fallback: number): number => (typeof rules[key] === 'number' ? (rules[key] as number) : fallback);
  return { chars: of('chars', 20), min: of('min', 4), max: of('max', 8), fonts: words(rules['fonts']), finishes: words(rules['finishes']) };
}

/**
 * The rules an area keeps after one change of its form: what it takes
 * (words, a logo, or either), a stepper moved, a font or a finish switched.
 * A part that takes words or a logo keeps both sets: its words, and the
 * logo's under `alsoLogo`.
 */
export function rulesFor(area: DataRow, kind: Kind, size: Size, offered: Offered, change: { takes?: Takes; set?: Partial<Pick<WordsRules, 'chars' | 'min' | 'max'>>; toggle?: { field: 'fonts' | 'finishes'; value: string } }): Record<string, unknown> {
  const current = jsonOf(area['rules']);
  const takes = change.takes ?? takesOf(area);
  if (takes === 'logo') return logoRules(kind);
  const { picture: _p, fit: _f, colour: _c, file: _file, alsoLogo: _a, ...wordsPart } = current;
  void _p;
  void _f;
  void _c;
  void _file;
  void _a;
  const base = 'chars' in wordsPart ? wordsPart : startRules(kind, size, offered);
  const next: Record<string, unknown> = { ...base, ...(change.set ?? {}) };
  if (change.toggle !== undefined) {
    const list = words(next[change.toggle.field]);
    const has = list.includes(change.toggle.value);
    // The last one stays: an area that takes words offers at least one font, as the comp keeps it.
    const after = has ? (list.length > 1 ? list.filter((one) => one !== change.toggle!.value) : list) : [...list, change.toggle.value];
    next[change.toggle.field] = after;
    const chosen = change.toggle.field === 'fonts' ? 'font' : 'finish';
    if (!after.includes(String(next[chosen] ?? ''))) {
      if (after[0] === undefined) delete next[chosen];
      else next[chosen] = after[0];
    }
  }
  if (typeof next['min'] === 'number' && typeof next['max'] === 'number' && next['min'] > next['max']) next['max'] = next['min'];
  if (typeof next['size'] === 'number' && typeof next['min'] === 'number' && typeof next['max'] === 'number') next['size'] = clamp(next['size'] as number, next['min'] as number, next['max'] as number);
  return takes === 'both' ? { ...next, alsoLogo: logoRules(kind) } : next;
}

/** A code for a new area or feature, from its name, unique among those already there. */
export function codeFor(name: string, taken: readonly string[], fallback: string): string {
  const stem =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || fallback;
  let code = stem;
  for (let n = 2; taken.includes(code); n += 1) code = `${stem}-${String(n)}`;
  return code;
}

/* ── publish ───────────────────────────────────────────────────────────── */

export interface PublishFacts {
  base: DataRow | null;
  areas: number;
  shown: number;
  hidden: number;
  fonts: number;
  features: number;
}

/** What a base needs before it is offered: a finished base, an area or a ready-made design, and a font (the comp's `ok`). */
export function canPublish(facts: PublishFacts): boolean {
  return baseReady(facts.base) && (facts.areas > 0 || facts.shown > 0) && facts.fonts > 0;
}
export const isPublished = (base: DataRow | null): boolean => base?.['state'] === 'published';

/** Every step but the two drawn elsewhere, and whether each is done, for the stepper's ticks and Publish's list. */
export function stepDone(step: Step, facts: PublishFacts): boolean {
  switch (step) {
    case 'base':
      return baseReady(facts.base);
    case 'areas':
      return facts.areas > 0;
    case 'designs':
      return facts.shown > 0;
    case 'fonts':
      return facts.fonts > 0;
    default:
      return false;
  }
}

/* ── fonts ─────────────────────────────────────────────────────────────── */

/** Whether the first four bytes are WOFF2's own: a renamed file is not a font. */
export const isWoff2 = (bytes: Uint8Array): boolean => bytes.length >= 4 && bytes[0] === 0x77 && bytes[1] === 0x4f && bytes[2] === 0x46 && bytes[3] === 0x32;

/** A font's family name from its file's name, as the comp makes it: dashes to spaces, "Regular" and "webfont" dropped, words capitalised. */
export function familyFromFile(fileName: string): string {
  const name = fileName
    .replace(/\.woff2$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b(regular|webfont)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(^|\s)(\p{Ll})/gu, (_all, space: string, letter: string) => `${space}${letter.toUpperCase()}`);
  return name.slice(0, 80);
}

/** How many of the ready-made designs' parts offer a font, by family. */
export function fontUse(parts: readonly DataRow[]): Map<string, Set<string>> {
  const used = new Map<string, Set<string>>();
  for (const part of parts) {
    const rules = jsonOf(part['rules']);
    for (const family of new Set([...words(rules['fonts']), ...(typeof rules['font'] === 'string' ? [rules['font']] : [])])) {
      const designs = used.get(family) ?? new Set<string>();
      designs.add(text(part['ready_design_id']));
      used.set(family, designs);
    }
  }
  return used;
}

/* ── an outline's size ─────────────────────────────────────────────────── */

/**
 * The size an SVG says it is, in millimetres: its `width` and `height` with
 * their units, else its `viewBox` read as millimetres (the comp's
 * `measureSvg`). Null when it says neither.
 */
export function svgSize(source: string): Size | null {
  const toMm = (raw: string): number => {
    const found = /([\d.]+)\s*(mm|cm|in|px|pt)?/.exec(raw);
    if (found === null) return 0;
    const n = Number(found[1]);
    switch (found[2]) {
      case 'mm':
        return n;
      case 'cm':
        return n * 10;
      case 'in':
        return n * 25.4;
      case 'pt':
        return (n * 25.4) / 72;
      default:
        return (n * 25.4) / 96;
    }
  };
  const tag = /<svg\b[^>]*>/i.exec(source)?.[0] ?? '';
  const width = /\swidth\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
  const height = /\sheight\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
  let w = width === undefined ? 0 : toMm(width);
  let h = height === undefined ? 0 : toMm(height);
  if (w <= 0 || h <= 0) {
    const box = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(tag);
    if (box !== null) {
      w = Number(box[1]);
      h = Number(box[2]);
    }
  }
  return w > 0 && h > 0 ? { width: Math.round(w * 10) / 10, height: Math.round(h * 10) / 10 } : null;
}

/** Whether a picked file is an SVG by its name or type (Adminium then reads its bytes). */
export const looksSvg = (file: { name: string; type: string }): boolean => file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
