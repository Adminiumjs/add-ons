/**
 * A DESIGN MADE IN THE FULL EDITOR: its own parts, placed by the customer.
 *
 * A printed page may be started blank, or a ready-made design taken past what
 * its form allows ("Switch to the full editor"): then the design holds its
 * parts itself (`values.placed`, `src/rules/shapes.ts`), each a box on a side
 * of the page with its words, colour or picture. This turns a filled-in
 * design into placed parts and back, makes a new part where the customer adds
 * one, and draws placed parts as the shared drawing draws any part.
 *
 * Going back to the form keeps the words: every placed part that came from a
 * part of the form gives it back its words (and a picture its file), by the
 * part's code, which the placed part keeps as its id. The moves are lost: the
 * form cannot say where a part was moved to.
 */
import type { DesignValues, PartValue, PlacedKind, PlacedPart } from '../rules/index.ts';
import { PT_MM } from '../rules/index.ts';
import { printed } from '../rules/text.ts';
import type { Drawn } from '../draw/parts.ts';
import { liveParts, valueOf, type Catalogue, type EditPart, type Palette, type Ready } from './catalogue.ts';
import type { Upload } from './ui/pictures.ts';

/** A blank page's colours, when no ready-made design gives it a palette: white paper, near-black ink, a warm accent. */
export const PLAIN: Readonly<Record<string, string>> = { paper: '#ffffff', ink: '#191920', accent: '#c0562f' };
/** The colours anything may take, beside the palette's own (the comp's twelve). */
export const SWATCHES: readonly string[] = ['#191920', '#4a4a54', '#8b8b96', '#ffffff', '#f2e9dc', '#c8a35a', '#0b7d59', '#1c59e0', '#4f46e5', '#9f1239', '#cf273c', '#b25e09'];
/** The weights words may be set in. */
export const WEIGHTS: readonly number[] = [400, 500, 600, 700, 800];

/** Words' height in millimetres at a size in points over some lines: Marlow's 1.25 line height. */
export const textHeight = (sizePt: number, lines: number): number => Math.round(sizePt * PT_MM * 1.25 * Math.max(1, lines) * 100) / 100;

/** A colour a placed part names, as paint: a palette role, else the colour written out. */
export function paintOf(palette: Palette | null, colour: string | undefined, fallback: string): string {
  const role = colour ?? fallback;
  if (/^#[0-9a-fA-F]{6}$/.test(role)) return role;
  return palette?.colours.find((one) => one.role === role || one.code === role)?.hex ?? PLAIN[role] ?? PLAIN['ink']!;
}

/** The parts placed on one side, back to front. */
export const placedOn = (values: DesignValues, side: 'front' | 'back'): PlacedPart[] => (values.placed ?? []).filter((one) => one.side === side);

/** A placed part's box, its words' height taken from their size and lines. */
export function boxOfPlaced(part: PlacedPart): { x: number; y: number; w: number; h: number } {
  if (part.kind !== 'text') return { x: part.x, y: part.y, w: part.w, h: part.h };
  const lines = Math.max(1, printed(part.text).split(/\r?\n/).length);
  return { x: part.x, y: part.y, w: part.w, h: textHeight(part.size ?? 9, lines) };
}

const round = (value: number): number => Math.round(value * 10) / 10 + 0;

/** A key for a new part, never one the design has. */
export function freshId(values: DesignValues, stem: string): string {
  const used = new Set((values.placed ?? []).map((one) => one.id));
  for (let n = 1; ; n += 1) if (!used.has(`${stem}${String(n)}`)) return `${stem}${String(n)}`;
}

/** What a customer's own new part starts as: centred on the page, at the comp's sizes for a business card, scaled to the page. */
export function newPart(kind: Exclude<PlacedKind, 'image'>, values: DesignValues, side: 'front' | 'back', page: { width: number; height: number }, font: string, names: Readonly<Record<Exclude<PlacedKind, 'image'>, string>>, words: string): PlacedPart {
  const u = page.width / 85;
  const id = freshId(values, kind === 'text' ? 't' : 's');
  if (kind === 'text') {
    const w = round(45 * u);
    const h = textHeight(9, 1);
    return { id, side, kind, name: names.text, x: round((page.width - w) / 2), y: round((page.height - h) / 2), w, h, text: words, font, size: 9, weight: 700, align: 'start', colour: 'ink' };
  }
  const [w, h] = kind === 'rect' ? [30 * u, 20 * u] : kind === 'ellipse' ? [22 * u, 22 * u] : [40 * u, 0.6];
  return { id, side, kind, name: names[kind], x: round((page.width - w) / 2), y: round((page.height - h) / 2), w: round(w), h: kind === 'line' ? 0.6 : round(h), colour: kind === 'line' ? 'ink' : 'accent' };
}

/** A picture the customer adds: as wide as forty millimetres of a card (never wider than the page inside a margin), as tall as its own shape. */
export function newImage(values: DesignValues, side: 'front' | 'back', page: { width: number; height: number }, column: string, name: string, px: readonly [number, number] | undefined): PlacedPart {
  const w = round(Math.min(40 * (page.width / 85), page.width - 8));
  const h = round(px === undefined || !(px[0] > 0) ? w : (w * px[1]) / px[0]);
  return { id: freshId(values, 'i'), side, kind: 'image', name, x: round((page.width - w) / 2), y: round((page.height - h) / 2), w, h, file: column, fit: 'inside' };
}

/**
 * A filled-in design, as placed parts: every part on its sides in its layout,
 * where the form put it, with what the customer gave it. Words a customer left
 * empty go unless the design needs them (then its example words stand in);
 * an empty picture box and the design-wide colour and choice parts go too.
 */
export function toPlaced(catalogue: Catalogue, ready: Ready | null, values: DesignValues): DesignValues {
  const placed: PlacedPart[] = [];
  const used = new Set<string>();
  const idFor = (part: EditPart): string => {
    const id = used.has(part.code) ? `${part.code}-${part.side}` : part.code;
    used.add(id);
    return id.slice(0, 32);
  };
  for (const part of liveParts(catalogue, ready, values)) {
    const box = part.box;
    if (box === null) continue;
    const value: PartValue = valueOf(values, part);
    const name = part.name.slice(0, 80);
    if (part.kind === 'shape' && part.shape !== null) {
      placed.push({ id: idFor(part), side: part.side, kind: part.shape.shape === 'ellipse' || part.shape.shape === 'ring' ? 'ellipse' : 'rect', name, ...box, ...(part.shape.fill === null ? {} : { colour: part.shape.fill }) });
      continue;
    }
    if (part.kind === 'text' && part.text !== null && (value.mode ?? 'words') === 'words') {
      const typed = printed(value.text);
      const text = part.locked ? part.fixed : typed !== '' ? (value.text ?? '') : part.required ? part.placeholder : '';
      if (printed(text) === '') continue;
      const rules = part.text;
      const size = value.size ?? rules.size;
      const lines = Math.max(1, text.split(/\r?\n/).length);
      placed.push({ id: idFor(part), side: part.side, kind: 'text', name, x: box.x, y: box.y, w: box.w, h: textHeight(size, lines), text: part.upper ? text.toLocaleUpperCase() : text, font: value.font ?? rules.font ?? rules.fonts?.[0] ?? 'Manrope', size, weight: rules.weight, align: rules.align, colour: value.colour ?? rules.colour ?? 'ink' });
      continue;
    }
    const rules = part.picture ?? part.text?.alsoLogo ?? null;
    if (rules !== null && value.file !== undefined) placed.push({ id: idFor(part), side: part.side, kind: 'image', name, ...box, file: value.file, fit: value.fit === 'fill' ? 'fill' : value.fit === 'inside' ? 'inside' : rules.fit });
  }
  const { layout: _layout, ...rest } = values;
  void _layout;
  return { ...rest, parts: {}, placed };
}

/** Back to the form: the design's own parts again, each given back the words or the picture its placed part held. */
export function backToForm(catalogue: Catalogue, ready: Ready | null, values: DesignValues): DesignValues {
  const placed = values.placed ?? [];
  const parts: Record<string, PartValue> = {};
  for (const part of liveParts(catalogue, ready, { ...values, placed: undefined })) {
    if (part.locked) continue;
    const from = placed.find((one) => one.id === part.code || one.id === `${part.code}-${part.side}`);
    if (from === undefined) continue;
    if (part.kind === 'text' && from.kind === 'text' && from.text !== undefined && printed(from.text) !== part.placeholder) parts[part.code] = { text: from.text };
    else if (from.kind === 'image' && from.file !== undefined && (part.picture ?? part.text?.alsoLogo) !== null) parts[part.code] = { file: from.file, ...(from.fit === undefined ? {} : { fit: from.fit }), ...(part.kind === 'text' ? { mode: 'logo' as const } : {}) };
  }
  const { placed: _placed, ...rest } = values;
  void _placed;
  return { ...rest, parts };
}

/** Placed parts as the shared drawing draws them, a customer's pictures drawn from their address in the page. */
export function drawnOfPlaced(parts: readonly PlacedPart[], palette: Palette | null, pictures: Readonly<Record<string, Upload>>, label: { image: string }): Drawn[] {
  return parts.map((part): Drawn => {
    const box = boxOfPlaced(part);
    if (part.kind === 'text') return { kind: 'text', key: part.id, box, lines: (part.text ?? '').split(/\r?\n/), font: part.font ?? 'Manrope', sizeMm: (part.size ?? 9) * PT_MM, weight: part.weight ?? 400, align: part.align ?? 'start', colour: paintOf(palette, part.colour, 'ink') };
    if (part.kind === 'image') {
      const held = part.file === undefined ? undefined : pictures[part.file];
      if (held?.url !== undefined) return { kind: 'image', key: part.id, box, href: held.url, fill: part.fit === 'fill' };
      return { kind: 'slot', key: part.id, box, slot: 'logo', label: held === undefined || held.name === '' ? label.image : held.name };
    }
    return { kind: 'shape', key: part.id, box, shape: part.kind === 'ellipse' ? 'ellipse' : 'rect', fill: paintOf(palette, part.colour, part.kind === 'line' ? 'ink' : 'accent'), stroke: null, background: false };
  });
}
