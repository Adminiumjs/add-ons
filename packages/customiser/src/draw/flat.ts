/**
 * A CUSTOMER'S DESIGN, LAID OUT FLAT — in millimetres, with no screen in it.
 *
 * One design (its base, its ready-made design or the base's areas, and what
 * the customer chose) is turned into one sheet per side: the face (a page's
 * trim with its bleed and safe line, or a piece at its size and corners) and
 * every part on it, each where it is drawn, in the colour it is made in. Every
 * picture of a design is drawn from this sheet and nothing else: the
 * customer's editor, the gallery's cards, the shop's preview picture, the
 * proof, the print PDF and the files for the laser. So what the customer saw
 * is what the shop proofs and what the machine makes.
 *
 * Words are placed line by line, on their baseline, in the units the files
 * use: the editor draws them as text in the shop's font, the files as that
 * font's outlines, at the same baseline and anchor. A page's words hang from
 * the top of their box (as the print shop's editor sets them); a piece's sit
 * in the middle of theirs (as a laser studio centres them).
 *
 * No React and no DOM: the shop's side and the customer's side both read it.
 */
import { PT_MM, SCALE_MAX, sizeInMm, type PlacedPart } from '../rules/index.ts';
import { areaMode, hexOf, liveParts, paletteOf, readyOf, valueOf, type Catalogue, type EditPart, type Palette } from '../browser/catalogue.ts';
import { boxOfPlaced, paintOf, placedOn } from '../browser/placed.ts';
import type { DesignData } from '../browser/api.ts';
import type { Box } from './parts.ts';

export type Side = 'front' | 'back';

/** The thing that is made, flat: a page with its bleed and safe line, or a piece. */
export interface FlatFace {
  kind: 'page' | 'piece';
  width: number;
  height: number;
  corner: number;
  bleed: number;
  safe: number | null;
  /** The paper, the wood, the slate or the plastic. */
  colour: string;
  /** The face's edge, drawn round a piece. */
  edge: string;
}

/** One line of words, on its baseline: `x` is where its anchor is. */
export interface FlatLine {
  text: string;
  x: number;
  y: number;
}

interface ItemBase {
  /** Unique on the sheet: the part's code and side. */
  key: string;
  /** The part it draws. */
  code: string;
  /** The part's own box. */
  box: Box;
  /** Whether the customer may change it (it is a way into its field on the editor's stage). */
  live: boolean;
  /** Whether it is the shop's, shown with a padlock when pointed at (never a page's background). */
  locked: boolean;
}

export type FlatItem =
  | (ItemBase & { kind: 'text'; lines: FlatLine[]; anchor: 'start' | 'middle' | 'end'; font: string; sizeMm: number; weight: number; colour: string; dim: boolean })
  /** Where a logo, a photo or an area goes, before there is one: a dashed box and what it takes. */
  | (ItemBase & { kind: 'slot'; label: string; filled: boolean; page: boolean })
  /** A customer's own picture, from the design's file column, inside its box or filling it. */
  | (ItemBase & { kind: 'picture'; column: string; drawn: Box; fill: boolean; oneColour: boolean; colour: string; picture: 'logo' | 'photo'; threshold?: number })
  | (ItemBase & { kind: 'shape'; shape: 'rect' | 'ellipse' | 'door'; fill: string | null; stroke: string | null; line: number })
  /** A choice of motif, named in its frame. */
  | (ItemBase & { kind: 'choice'; label: string; colour: string });

export interface FlatSheet {
  side: Side;
  face: FlatFace;
  /** Back to front, in the order they are drawn. */
  items: FlatItem[];
}

/** The words a sheet's empty boxes say, in the reader's language. */
export interface FlatLabels {
  logo: string;
  photo: string;
  /** A picture the customer placed in the full editor, before its file is here. */
  image?: string;
}

export interface FlatOptions {
  side?: Side;
  /** Empty parts show their example words (a gallery card), are dimmed (the stage), or are left out (a proof, a file). */
  empty?: 'sample' | 'dim' | 'hide';
  labels: FlatLabels;
  /** Whether this page holds the file a column names (a picture is drawn from it); a box without one says it holds one. */
  holds?: (column: string) => boolean;
}

/** The wood, slate or plastic a piece is cut from, and the colour its engraving burns to. */
const MATERIALS: readonly { test: RegExp; face: string; edge: string; engraved: string }[] = [
  { test: /walnut/i, face: '#6b4428', edge: '#3b2413', engraved: '#24130a' },
  { test: /ply|birch/i, face: '#d9b98a', edge: '#a8845a', engraved: '#6a4321' },
  { test: /slate/i, face: '#3b4248', edge: '#272c30', engraved: '#c3cacf' },
  { test: /oak/i, face: '#c9a26b', edge: '#9a7444', engraved: '#4a2f16' },
];
const PLAIN_MATERIAL = { face: '#e9e4da', edge: '#b9b2a5', engraved: '#3a3530' };
const PAINT: Readonly<Record<string, string>> = { 'paint-white': '#f3f1ea', 'paint-black': '#15120e' };
/** A page's words when the palette names no ink. */
const INK = '#191920';
const PAGE_EDGE = '#d0d0d6';

/** Where the first line's baseline sits below the top of its line, and how far apart lines are: a share of the size. */
export const BASELINE = 0.82;
export const LINE_STEP = 1.25;

/** A colour mixed toward another by a share (0 to 1). */
export function mix(hex: string, toward: string, share: number): string {
  const parse = (value: string) => [1, 3, 5].map((at) => parseInt(value.slice(at, at + 2), 16));
  const [a, b] = [parse(hex), parse(toward)];
  return `#${a.map((one, i) => Math.round(one + ((b[i] ?? 0) - one) * share).toString(16).padStart(2, '0')).join('')}`;
}

/** The sides a design is made with, front first. */
export function sidesMade(catalogue: Catalogue, design: DesignData): Side[] {
  return catalogue.base.kind === 'page' && catalogue.base.sides >= 2 && (design.values.sides ?? 1) >= 2 ? ['front', 'back'] : ['front'];
}

/** The lines of a text part, each on its baseline, as a page or a piece sets them. */
export function placeLines(lines: readonly string[], box: Box, sizeMm: number, align: 'start' | 'center' | 'end', page: boolean): { anchor: 'start' | 'middle' | 'end'; lines: FlatLine[] } {
  const anchor = page ? (align === 'center' ? 'middle' : align === 'end' ? 'end' : 'start') : 'middle';
  const x = anchor === 'middle' ? box.x + box.w / 2 : anchor === 'end' ? box.x + box.w : box.x;
  const step = sizeMm * LINE_STEP;
  // A page's words hang from the top of their box; a piece's block of lines sits in its middle.
  const top = page ? box.y : box.y + box.h / 2 - ((lines.length - 1) * step + sizeMm) / 2;
  return { anchor, lines: lines.map((text, index) => ({ text, x, y: top + sizeMm * BASELINE + index * step })) };
}

/** The design laid out flat on one side. */
export function flatSheet(catalogue: Catalogue, design: DesignData, options: FlatOptions): FlatSheet {
  const side = options.side ?? 'front';
  const empty = options.empty ?? 'sample';
  const holds = options.holds ?? (() => false);
  const { base } = catalogue;
  const page = base.kind === 'page';
  const ready = readyOf(catalogue, design.ready_design_id);
  const palette = paletteOf(ready, design.values);
  const all = liveParts(catalogue, ready, design.values);
  const material = MATERIALS.find((one) => one.test.test(base.material ?? '')) ?? PLAIN_MATERIAL;
  // A printed item takes the colour its colour part chose.
  const colourPart = all.find((part) => part.kind === 'colour');
  const chosenColour = colourPart === undefined ? undefined : (valueOf(design.values, colourPart).choice ?? colourPart.start?.choice);
  const plastic = colourPart === undefined ? null : (Object.values(catalogue.shared).flat().find((one) => one.code === chosenColour) ?? null);
  const face: FlatFace = {
    kind: page ? 'page' : 'piece',
    width: Math.max(base.width, 1),
    height: Math.max(base.height, 1),
    corner: page ? 0 : base.corner,
    bleed: page ? base.bleed : 0,
    safe: page ? base.safe : null,
    colour: page ? (hexOf(palette, 'paper') ?? '#ffffff') : (plastic?.hex ?? material.face),
    edge: page ? PAGE_EDGE : plastic === null ? material.edge : mix(plastic.hex, '#000000', 0.3),
  };

  const inkFor = (part: EditPart): string => {
    const value = valueOf(design.values, part);
    if (page) return hexOf(palette, value.colour ?? part.text?.colour ?? 'ink') ?? INK;
    if (plastic !== null) return mix(plastic.hex, '#000000', 0.42);
    const finish = value.finish ?? design.values.finish ?? part.text?.finish ?? part.picture?.finish ?? 'engraved';
    return PAINT[finish] ?? material.engraved;
  };

  // A design made in the full editor holds its own parts, back to front, and nothing else is drawn.
  if (page && design.values.placed !== undefined) return { side, face, items: placedItems(placedOn(design.values, side), palette, options.labels, holds) };

  const items: FlatItem[] = [];
  for (const part of all) {
    if (part.side !== side || part.box === null || part.kind === 'colour') continue;
    const box = part.box;
    const value = valueOf(design.values, part);
    const common: ItemBase = { key: `${part.code}-${part.side}`, code: part.code, box, live: !part.locked, locked: part.locked && !(part.shape?.background ?? false) };
    if (part.kind === 'shape' && part.shape !== null) {
      const shape = part.shape.shape === 'ellipse' || part.shape.shape === 'ring' || part.shape.shape === 'oval' ? 'ellipse' : part.shape.shape === 'door' ? 'door' : 'rect';
      items.push({ ...common, kind: 'shape', shape, fill: page ? hexOf(palette, part.shape.fill) : null, stroke: page ? null : inkFor(part), line: page ? 0 : shape === 'door' ? 0.8 : 1 });
      continue;
    }
    if (part.kind === 'picture' && part.picture !== null) {
      const rules = part.picture;
      const label = rules.picture === 'photo' ? options.labels.photo : options.labels.logo;
      if (value.file !== undefined && holds(rules.file)) items.push(pictureItem(common, value, rules, page, inkFor(part)));
      else items.push({ ...common, kind: 'slot', label: value.file === undefined ? label : `${label} ✓`, filled: value.file !== undefined, page });
      continue;
    }
    if (part.kind === 'choice') {
      items.push({ ...common, kind: 'choice', label: value.choice ?? part.start?.choice ?? '', colour: inkFor(part) });
      continue;
    }
    if (part.kind !== 'text' || part.text === null) continue;
    const rules = part.text;
    const mode = areaMode(design.values, part);
    if (mode === 'logo') {
      const logo = rules.alsoLogo;
      if (logo !== null && value.file !== undefined && holds(logo.file)) items.push(pictureItem(common, value, logo, page, inkFor(part)));
      else items.push({ ...common, kind: 'slot', label: value.file === undefined ? options.labels.logo : `${options.labels.logo} ✓`, filled: value.file !== undefined, page });
      continue;
    }
    const typed = (value.text ?? '').trim();
    const shown = typed !== '' ? typed : empty === 'hide' || (part.fromArea && mode === null && empty !== 'sample') ? '' : part.placeholder;
    if (shown === '') {
      // An area a customer left plain is a dashed box on the stage, and nothing at all on what is made.
      if (part.fromArea && empty !== 'hide') items.push({ ...common, kind: 'slot', label: part.name, filled: false, page });
      continue;
    }
    const size = sizeInMm(rules, value.size ?? rules.size) || box.h * 0.7;
    const placed = placeLines((part.upper ? shown.toLocaleUpperCase() : shown).split(/\r?\n/), box, size, rules.align, page);
    items.push({ ...common, kind: 'text', ...placed, font: value.font ?? rules.font ?? 'Manrope', sizeMm: size, weight: rules.weight, colour: inkFor(part), dim: typed === '' && empty === 'dim' });
  }
  return { side, face, items };
}

/** The parts a customer placed in the full editor, laid out as any part: words hang from their box's top on a page. */
function placedItems(parts: readonly PlacedPart[], palette: Palette | null, labels: FlatLabels, holds: (column: string) => boolean): FlatItem[] {
  return parts.map((part): FlatItem => {
    const box = boxOfPlaced(part);
    const common: ItemBase = { key: `${part.id}-${part.side}`, code: part.id, box, live: false, locked: false };
    if (part.kind === 'text') {
      const sizeMm = (part.size ?? 9) * PT_MM;
      return { ...common, kind: 'text', ...placeLines((part.text ?? '').split(/\r?\n/), box, sizeMm, part.align ?? 'start', true), font: part.font ?? 'Manrope', sizeMm, weight: part.weight ?? 400, colour: paintOf(palette, part.colour, 'ink'), dim: false };
    }
    if (part.kind === 'image') {
      if (part.file !== undefined && holds(part.file)) return { ...common, kind: 'picture', column: part.file, drawn: box, fill: part.fit === 'fill', oneColour: false, colour: '#000000', picture: 'logo' };
      return { ...common, kind: 'slot', label: labels.image ?? labels.logo, filled: part.file !== undefined, page: true };
    }
    // A line is a thin bar of its colour; a rectangle or an oval is filled with it.
    return { ...common, kind: 'shape', shape: part.kind === 'ellipse' ? 'ellipse' : 'rect', fill: paintOf(palette, part.colour, part.kind === 'line' ? 'ink' : 'accent'), stroke: null, line: 0 };
  });
}

/** A customer's picture in its box: at its size in the box and nudged where they put it, inside it or filling it. */
function pictureItem(common: ItemBase, value: { scale?: number; nx?: number; ny?: number; fit?: string; threshold?: number }, rules: { file: string; fit: string; colour: 'one' | 'full' | null; picture: 'logo' | 'photo' }, page: boolean, colour: string): FlatItem {
  const box = common.box;
  const k = (value.scale ?? SCALE_MAX) / 100;
  const [w, h] = [box.w * k, box.h * k];
  const drawn = { x: box.x + (box.w - w) / 2 + (value.nx ?? 0), y: box.y + (box.h - h) / 2 + (value.ny ?? 0), w, h };
  return { ...common, kind: 'picture', column: rules.file, drawn, fill: (value.fit ?? rules.fit) === 'fill', oneColour: !page && rules.colour === 'one', colour, picture: rules.picture, ...(value.threshold === undefined ? {} : { threshold: value.threshold }) };
}

/** Every part of a design that may carry the customer's words or picture, by side: what a proof's facts name. */
export function sheetsOf(catalogue: Catalogue, design: DesignData, options: Omit<FlatOptions, 'side'>): FlatSheet[] {
  return sidesMade(catalogue, design).map((side) => flatSheet(catalogue, design, { ...options, side }));
}

/** The box a sheet is drawn in, in millimetres: the face, with the bleed round a page when it is shown. */
export function sheetView(face: FlatFace, withBleed: boolean): Box {
  const margin = face.kind === 'page' && withBleed ? face.bleed : 0;
  // Written as a subtraction: `-margin` would be a negative zero where there is no bleed.
  return { x: 0 - margin, y: 0 - margin, w: face.width + 2 * margin, h: face.height + 2 * margin };
}
