/**
 * THE SHOP'S CATALOGUE, AS THE CUSTOMER'S EDITOR SHOWS IT.
 *
 * The rows come from the add-on's public entries (`api.ts`); this reads them
 * once into what a screen draws: the base, its ready-made designs with their
 * parts in the shop's order, the palettes and their colours, the finishes,
 * the fonts and the priced features. Every rule of a part is read by the same
 * module the server asks (`src/rules/`), so what a field allows is what an
 * order is held to.
 *
 * It also builds the facts `checkDesign` is handed for the design on screen,
 * the same facts the server reads, with what only the browser knows (a
 * font's widths) added.
 */
import { checkDesign, type DesignAnswer, type DesignValues, type FileFact, type Measure, type PartValue, type PictureRules, type TextRules } from '../rules/index.ts';
import { inOrder, isObject, json, num, sameKey, str, yes } from '../rules/read.ts';
import { choiceRules, pictureRules, shapeRules, startValue, textRules } from '../rules/shapes.ts';
import type { CatalogueRows, DesignData, Row } from './api.ts';

export type BaseKind = 'page' | 'piece' | 'kit' | 'printed';

export interface Base {
  id: string | number;
  app: string | null;
  row: Row;
  name: string;
  kind: BaseKind;
  width: number;
  height: number;
  depth: number | null;
  corner: number;
  bleed: number;
  safe: number | null;
  sides: number;
  material: string | null;
  thickness: number | null;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One part a customer meets: a ready-made design's part, or an area of a plain base. */
export interface EditPart {
  code: string;
  name: string;
  kind: 'text' | 'picture' | 'colour' | 'choice' | 'shape';
  locked: boolean;
  required: boolean;
  side: 'front' | 'back';
  layout: string | null;
  box: Box | null;
  text: TextRules | null;
  picture: PictureRules | null;
  choices: string[];
  /** The palette a colour part's choices come from. */
  palette: string | null;
  shape: { shape: string | null; fill: string | null; background: boolean } | null;
  start: PartValue | null;
  feature: string | null;
  placeholder: string;
  upper: boolean;
  /** What a locked part says it is ("Engraved ring, 1 mm"). */
  fixed: string;
  /** An area of a plain base, which may be left plain. */
  fromArea: boolean;
}

export interface Colour {
  code: string;
  role: string | null;
  name: string;
  hex: string;
}

export interface Palette {
  id: string | number;
  code: string;
  name: string;
  colours: Colour[];
}

export interface Layout {
  key: string;
  name: string;
}

export interface Ready {
  id: string | number;
  row: Row;
  name: string;
  /** The design's preview picture, where the shop has made one: what its card shows of its front. */
  picture: string | null;
  tags: string[];
  layouts: Layout[];
  palettes: Palette[];
  parts: EditPart[];
  rows: Row[];
}

export interface Font {
  id: string | number;
  row: Row;
  family: string;
  name: string;
  smallest: number | null;
}

export interface Catalogue {
  base: Base;
  rows: CatalogueRows;
  ready: Ready[];
  /** The base's own areas, as parts: what "Start with a plain piece" offers. */
  plain: EditPart[];
  fonts: Font[];
  /** Colours by palette code, for colour parts and finishes, outside any one design. */
  shared: Record<string, Colour[]>;
  /** The finishes a part may offer, by code. */
  finishes: Record<string, Colour>;
  /** Priced features by key. */
  features: Record<string, { code: string; name: string }>;
}

const asKey = (value: unknown): string | number => (typeof value === 'number' ? value : String(value ?? ''));

function rulesOf(raw: unknown): Record<string, unknown> {
  const value = json(raw);
  return isObject(value) ? value : {};
}

function boxOf(row: Row): Box | null {
  const [x, y, w, h] = [num(row['x_mm']), num(row['y_mm']), num(row['w_mm']), num(row['h_mm'])];
  return w === null || h === null ? null : { x: x ?? 0, y: y ?? 0, w, h };
}

function baseOf(row: Row): Base {
  const kind = (['page', 'piece', 'kit', 'printed'] as const).find((one) => one === row['kind']) ?? 'piece';
  return {
    id: asKey(row['id']),
    app: str(row['app']),
    row,
    name: str(row['name']) ?? '',
    kind,
    width: num(row['width_mm']) ?? 0,
    height: num(row['height_mm']) ?? 0,
    depth: num(row['depth_mm']),
    corner: num(row['corner_mm']) ?? 0,
    bleed: num(row['bleed_mm']) ?? 0,
    safe: num(row['safe_mm']),
    sides: Math.max(1, num(row['sides']) ?? 1),
    material: str(row['material']),
    thickness: num(row['thickness_mm']),
  };
}

function featureOf(raw: unknown, features: Catalogue['features']): string | null {
  return raw === null || raw === undefined || raw === '' ? null : (features[String(raw)]?.code ?? null);
}

function partOf(row: Row, features: Catalogue['features']): EditPart {
  const kind = (['text', 'picture', 'colour', 'choice', 'shape'] as const).find((one) => one === row['kind']) ?? 'shape';
  const raw = rulesOf(row['rules']);
  const start = startValue(row['value']);
  const choice = kind === 'colour' || kind === 'choice' ? choiceRules(row['rules']) : null;
  return {
    code: str(row['code']) ?? '',
    name: str(row['name']) ?? str(row['code']) ?? '',
    kind,
    locked: yes(row['locked']) || kind === 'shape',
    required: yes(row['required']),
    side: row['side'] === 'back' ? 'back' : 'front',
    layout: str(row['layout']),
    box: boxOf(row),
    text: kind === 'text' ? textRules(row['rules']) : null,
    picture: kind === 'picture' ? pictureRules(row['rules']) : null,
    choices: choice?.choices ?? (start?.choice === undefined ? [] : [start.choice]),
    palette: choice?.palette ?? null,
    shape: kind === 'shape' ? { ...shapeRules(row['rules']), background: yes(raw['background']) } : null,
    start,
    feature: featureOf(row['feature_id'], features),
    placeholder: str(raw['placeholder']) ?? '',
    upper: yes(raw['upper']),
    fixed: start?.text ?? '',
    fromArea: false,
  };
}

/** An area of a plain base, as a part: words, a logo, or either. */
function areaPart(row: Row, features: Catalogue['features']): EditPart {
  const takes = row['takes'];
  const raw = rulesOf(row['rules']);
  const text = takes === 'logo' ? null : textRules(row['rules']);
  if (text !== null && takes === 'both' && text.alsoLogo === null) text.alsoLogo = pictureRules({});
  return {
    code: str(row['code']) ?? '',
    name: str(row['name']) ?? str(row['code']) ?? '',
    kind: takes === 'logo' ? 'picture' : 'text',
    locked: false,
    required: yes(row['required']),
    side: row['side'] === 'back' ? 'back' : 'front',
    layout: null,
    box: boxOf(row),
    text,
    picture: takes === 'logo' ? pictureRules(row['rules']) : null,
    choices: [],
    palette: null,
    shape: null,
    start: null,
    feature: featureOf(row['feature_id'], features),
    placeholder: str(raw['placeholder']) ?? '',
    upper: yes(raw['upper']),
    fixed: '',
    fromArea: true,
  };
}

function coloursOf(palette: Row, rows: readonly Row[]): Colour[] {
  return inOrder(rows.filter((one) => sameKey(one['palette_id'], palette['id']))).map((one) => ({ code: str(one['code']) ?? '', role: str(one['role']), name: str(one['name']) ?? str(one['code']) ?? '', hex: str(one['hex']) ?? '#000000' }));
}

function layoutsOf(raw: unknown): Layout[] {
  const value = json(raw);
  return Array.isArray(value) ? value.filter(isObject).map((one) => ({ key: str(one['key']) ?? '', name: str(one['name']) ?? str(one['key']) ?? '' })).filter((one) => one.key !== '') : [];
}

function wordsOf(raw: unknown): string[] {
  const value = json(raw);
  return Array.isArray(value) ? value.filter((one): one is string => typeof one === 'string') : [];
}

/** The catalogue for one base, from its rows. Null when the base is not one the shop offers. */
export function readCatalogue(rows: CatalogueRows, baseId: string | number, only?: readonly (string | number)[]): Catalogue | null {
  const baseRow = rows.bases.find((one) => sameKey(one['id'], baseId));
  if (baseRow === undefined) return null;
  const base = baseOf(baseRow);
  const features: Catalogue['features'] = Object.fromEntries(rows.features.map((one) => [String(one['id']), { code: str(one['code']) ?? '', name: str(one['name']) ?? '' }]));
  const shared: Record<string, Colour[]> = {};
  for (const palette of inOrder(rows.palettes.filter((one) => one['ready_design_id'] === null || one['ready_design_id'] === undefined))) shared[str(palette['code']) ?? ''] = coloursOf(palette, rows.colours);
  const finishes = Object.fromEntries((shared['finishes'] ?? []).map((one) => [one.code, one]));
  const ready = inOrder(rows.ready.filter((one) => sameKey(one['base_id'], base.id) && (only === undefined || only.some((id) => sameKey(id, one['id'])))))
    .map((row): Ready => {
      const partRows = inOrder(rows.parts.filter((one) => sameKey(one['ready_design_id'], row['id'])));
      return {
        id: asKey(row['id']),
        row,
        name: str(row['name']) ?? '',
        picture: str(row['preview_url']),
        tags: wordsOf(row['tags']),
        layouts: layoutsOf(row['layouts']),
        palettes: inOrder(rows.palettes.filter((one) => sameKey(one['ready_design_id'], row['id']))).map((one) => ({ id: asKey(one['id']), code: str(one['code']) ?? '', name: str(one['name']) ?? '', colours: coloursOf(one, rows.colours) })),
        parts: partRows.map((one) => partOf(one, features)),
        rows: partRows,
      };
    });
  const plain = inOrder(rows.areas.filter((one) => sameKey(one['base_id'], base.id))).map((one) => areaPart(one, features));
  const fonts = rows.fonts.map((one) => ({ id: asKey(one['id']), row: one, family: str(one['family']) ?? '', name: str(one['name']) ?? str(one['family']) ?? '', smallest: num(one['smallest_mm']) }));
  return { base, rows, ready, plain, fonts, shared, finishes, features };
}

/** The ready-made design a design starts from, or none for the plain base. */
export const readyOf = (catalogue: Catalogue, id: string | number | null): Ready | null => (id === null ? null : (catalogue.ready.find((one) => sameKey(one.id, id)) ?? null));

/** Every part of a design, live or not: its ready-made design's, or the base's areas. */
export const partsOf = (catalogue: Catalogue, ready: Ready | null): EditPart[] => (ready === null ? catalogue.plain : ready.parts);

/** The layout a design shows: its own choice, else the design's first. */
export const layoutOf = (ready: Ready | null, values: DesignValues): string | null => values.layout ?? ready?.layouts[0]?.key ?? null;

/** How many sides a design is made with. */
export const sidesOf = (catalogue: Catalogue, values: DesignValues): number => Math.min(Math.max(1, values.sides ?? 1), catalogue.base.sides);

/** The parts on screen: on the sides made, in the layout chosen. */
export function liveParts(catalogue: Catalogue, ready: Ready | null, values: DesignValues): EditPart[] {
  const layout = layoutOf(ready, values);
  const sides = sidesOf(catalogue, values);
  return partsOf(catalogue, ready).filter((part) => (part.side !== 'back' || sides >= 2) && (part.layout === null || layout === null || part.layout === layout));
}

/** The palette a design is coloured with. */
export function paletteOf(ready: Ready | null, values: DesignValues): Palette | null {
  if (ready === null || ready.palettes.length === 0) return null;
  return ready.palettes.find((one) => one.code === values.palette) ?? ready.palettes[0]!;
}

/** A palette role's colour (`ink`, `accent`), or a colour written out. */
export function hexOf(palette: Palette | null, role: string | null | undefined): string | null {
  if (role === null || role === undefined) return null;
  if (/^#[0-9a-fA-F]{6}$/.test(role)) return role;
  return palette?.colours.find((one) => one.role === role || one.code === role)?.hex ?? null;
}

/** A design's first values: the shop's starting choices, and the layout and palette the design opens with. */
export function freshValues(catalogue: Catalogue, ready: Ready | null, sides?: number): DesignValues {
  const values: DesignValues = { parts: {} };
  if (sides !== undefined && sides >= 2 && catalogue.base.sides >= 2) values.sides = 2;
  if (ready !== null && ready.layouts.length > 1) values.layout = ready.layouts[0]!.key;
  if (ready !== null && ready.palettes.length > 1) values.palette = ready.palettes[0]!.code;
  return values;
}

/** The part's value, as the design holds it or as the shop starts it. */
export const valueOf = (values: DesignValues, part: EditPart): PartValue => values.parts[part.code] ?? part.start ?? {};

/** Whether a part that takes words or a logo has been given one of them yet. */
export function areaMode(values: DesignValues, part: EditPart): 'words' | 'logo' | null {
  const value = values.parts[part.code];
  if (value === undefined) return null;
  return value.mode ?? (value.file !== undefined ? 'logo' : 'words');
}

/** The facts the rules are asked about this design: the same the server reads, with the browser's own measure. */
export function factsFor(catalogue: Catalogue, design: DesignData, files: readonly FileFact[], measure?: Measure) {
  const ready = readyOf(catalogue, design.ready_design_id);
  return {
    design: { format: 1, app: catalogue.base.app, base_id: design.base_id, ready_design_id: design.ready_design_id, values: design.values },
    ready: ready?.row ?? null,
    parts: ready?.rows ?? [],
    base: catalogue.base.row,
    areas: catalogue.rows.areas,
    palettes: catalogue.rows.palettes,
    features: catalogue.rows.features,
    colours: catalogue.rows.colours,
    files,
    settings: catalogue.rows.settings?.[0] ?? {},
    ...(measure === undefined ? {} : { measure }),
  };
}

/** The rules' answer for the design on screen. */
export const answerFor = (catalogue: Catalogue, design: DesignData, files: readonly FileFact[], measure?: Measure): DesignAnswer => checkDesign(factsFor(catalogue, design, files, measure));

/** Whether a design holds anything the customer gave it. */
export const isEmpty = (values: DesignValues): boolean => Object.values(values.parts).every((one) => (one.text ?? '').trim() === '' && one.file === undefined && one.choice === undefined) && (values.placed ?? []).length === 0;

/** The words a design carries, joined, for a list of designs. */
export function wordsIn(catalogue: Catalogue | null, design: DesignData): string {
  // A design made in the full editor: the words it placed.
  if (design.values.placed !== undefined) return design.values.placed.map((one) => (one.kind === 'text' ? (one.text ?? '').trim() : '')).filter((one) => one !== '').join(' · ');
  const parts = catalogue === null ? [] : liveParts(catalogue, readyOf(catalogue, design.ready_design_id), design.values);
  const words = (parts.length === 0 ? Object.values(design.values.parts) : parts.filter((one) => !one.locked && one.kind === 'text').map((one) => design.values.parts[one.code] ?? {}))
    .map((one) => (one.text ?? '').trim())
    .filter((one) => one !== '');
  return words.join(' · ');
}
