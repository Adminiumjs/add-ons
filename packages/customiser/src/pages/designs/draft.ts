/**
 * A READY-MADE DESIGN, AS THE SHOP'S EDITOR HOLDS IT — with no screen in it.
 *
 * The editor works on a draft: the design's row, its parts, its palettes and
 * its layouts, read once when it opens. Every change makes a new draft, kept
 * in a history so Undo and Redo step through drafts (never through a
 * selection: undoing a click is not a thing anybody wants). "Save the design"
 * then writes what differs from the draft as it was read (`changesOf`).
 *
 * The rules a part keeps are the rule module's shapes (`src/rules/shapes.ts`),
 * written as it reads them: `chars`, `grows`, `unit`, `size` with `min` /
 * `max` (a piece, in millimetres) or `sizes` (a page, in points), `fonts`,
 * `colours`, `finishes`, `lines`; a picture's `picture`, `fit`, `colour`,
 * `file`; a choice's `choices`; a shape's `shape` and `fill`.
 *
 * Boxes are millimetres from the top-left of a page's trim (a page's parts
 * may run into the bleed) or of a piece.
 */
import type { DataRow } from '../shared/host.ts';
import { objectOf, type Box, type PartKind, type PartLike } from '../../draw/parts.ts';
import { codeFor, num, text, yes } from '../setup/facts.ts';

export type Side = 'front' | 'back';
export type Role = 'paper' | 'ink' | 'accent';
export const ROLES: readonly Role[] = ['paper', 'ink', 'accent'];

export interface PartDraft extends PartLike {
  /** The row it was read from; none until it is saved. */
  id: string | number | null;
  code: string;
  required: boolean;
  side: Side | null;
  layout: string | null;
  areaId: string | number | null;
  pieceId: string | number | null;
  featureId: string | number | null;
}

export interface PaletteDraft {
  key: string;
  id: string | number | null;
  code: string;
  name: string;
  colours: Record<Role, string>;
  /** The colour rows it was read from, by role. */
  colourIds: Partial<Record<Role, string | number>>;
}

export interface LayoutDraft {
  key: string;
  name: string;
}

export interface DesignDraft {
  id: string | number;
  name: string;
  state: 'draft' | 'published';
  tags: string[];
  layouts: LayoutDraft[];
  palettes: PaletteDraft[];
  /** In the order they are drawn: a later part sits on top. */
  parts: PartDraft[];
}

/** What the editor draws a design on: the base's face. */
export type { FaceFacts } from '../../draw/boxes.ts';
import type { FaceFacts } from '../../draw/boxes.ts';

/* ── reading the rows ──────────────────────────────────────────────────── */

const listOf = (raw: unknown): unknown[] => {
  const value = typeof raw === 'string' ? (() => { try { return JSON.parse(raw) as unknown; } catch { return null; } })() : raw;
  return Array.isArray(value) ? value : [];
};
const key = (value: unknown): string | number | null => (value === null || value === undefined || value === '' ? null : (value as string | number));

export function partOf(row: DataRow): PartDraft {
  const kind = row['kind'];
  const x = num(row['x_mm']);
  const y = num(row['y_mm']);
  const w = num(row['w_mm']);
  const h = num(row['h_mm']);
  const value = objectOf(row['value']);
  return {
    key: `row:${String(row['id'])}`,
    id: row['id'] as string | number,
    code: text(row['code']),
    name: text(row['name']),
    kind: kind === 'picture' || kind === 'colour' || kind === 'choice' || kind === 'shape' ? kind : 'text',
    locked: yes(row['locked']),
    required: yes(row['required']),
    side: row['side'] === 'back' ? 'back' : row['side'] === 'front' ? 'front' : null,
    layout: text(row['layout']) === '' ? null : text(row['layout']),
    areaId: key(row['area_id']),
    pieceId: key(row['piece_id']),
    featureId: key(row['feature_id']),
    box: x === null || y === null || w === null || h === null ? null : { x, y, w, h },
    rules: objectOf(row['rules']),
    value: Object.keys(value).length === 0 ? null : value,
  };
}

/** A design's draft, from its row, its parts, its own palettes and their colours. */
export function draftOf(design: DataRow, parts: readonly DataRow[], palettes: readonly DataRow[], colours: readonly DataRow[]): DesignDraft {
  const mine = parts.filter((row) => String(row['ready_design_id']) === String(design['id']));
  const order = (a: DataRow, b: DataRow): number => (num(a['position']) ?? 0) - (num(b['position']) ?? 0) || (num(a['id']) ?? 0) - (num(b['id']) ?? 0);
  return {
    id: design['id'] as string | number,
    name: text(design['name']),
    state: design['state'] === 'published' ? 'published' : 'draft',
    tags: listOf(design['tags']).filter((one): one is string => typeof one === 'string'),
    layouts: listOf(design['layouts']).flatMap((one) => (typeof one === 'object' && one !== null && typeof (one as { key?: unknown }).key === 'string' ? [{ key: (one as { key: string }).key, name: String((one as { name?: unknown }).name ?? (one as { key: string }).key) }] : [])),
    palettes: palettes
      .filter((row) => String(row['ready_design_id']) === String(design['id']))
      .sort(order)
      .map((row) => {
        const own = colours.filter((one) => String(one['palette_id']) === String(row['id']));
        const of = (role: Role): DataRow | undefined => own.find((one) => one['role'] === role) ?? own.find((one) => one['code'] === role);
        return {
          key: `row:${String(row['id'])}`,
          id: row['id'] as string | number,
          code: text(row['code']),
          name: text(row['name']),
          colours: { paper: text(of('paper')?.['hex']) || '#ffffff', ink: text(of('ink')?.['hex']) || '#191920', accent: text(of('accent')?.['hex']) || '#c0562f' },
          colourIds: Object.fromEntries(ROLES.flatMap((role) => (of(role) === undefined ? [] : [[role, of(role)!['id'] as string | number]]))),
        };
      }),
    parts: [...mine].sort(order).map(partOf),
  };
}

/** The parts drawn on one side in one layout. A part with no side is on the front; a part with no layout is in every one. */
export function partsOn(draft: DesignDraft, side: Side, layout: string | null): PartDraft[] {
  return draft.parts.filter((part) => (part.side ?? 'front') === side && (part.layout === null || layout === null || part.layout === layout));
}

/* ── the history ───────────────────────────────────────────────────────── */

export interface History {
  past: DesignDraft[];
  present: DesignDraft;
  future: DesignDraft[];
  /** A gesture's own name: changes under the same name are one step (a drag, a word typed). */
  token: string | null;
}
export const HISTORY_LIMIT = 50;

export const historyOf = (draft: DesignDraft): History => ({ past: [], present: draft, future: [], token: null });

/** A new draft into the history; one under the token of the step before replaces that step's result. */
export function commit(history: History, next: DesignDraft, token?: string): History {
  if (next === history.present) return history;
  if (token !== undefined && token === history.token) return { ...history, present: next, future: [] };
  const past = [...history.past, history.present];
  return { past: past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past, present: next, future: [], token: token ?? null };
}
/** The end of a gesture: the next change starts a step of its own. */
export const endGesture = (history: History): History => (history.token === null ? history : { ...history, token: null });
export function undo(history: History): History {
  const last = history.past[history.past.length - 1];
  if (last === undefined) return history;
  return { past: history.past.slice(0, -1), present: last, future: [history.present, ...history.future], token: null };
}
export function redo(history: History): History {
  const [next, ...rest] = history.future;
  if (next === undefined) return history;
  return { past: [...history.past, history.present], present: next, future: rest, token: null };
}

/* ── moving and sizing: the shared drawing's (`src/draw/boxes.ts`) ──────── */

export { limitsOf, movedBox, nudgedBox, resizedBox, textHeightMm } from '../../draw/boxes.ts';
import { tenth, textHeightMm } from '../../draw/boxes.ts';

/* ── changing a draft ──────────────────────────────────────────────────── */

let made = 0;
/** A key for a part, palette or layout made in this editor, never one a saved row has. */
export const freshKey = (what: string): string => `new:${what}:${String((made += 1))}`;

export function patchPart(draft: DesignDraft, partKey: string, patch: Partial<Omit<PartDraft, 'key' | 'id'>>): DesignDraft {
  return { ...draft, parts: draft.parts.map((part) => (part.key === partKey ? { ...part, ...patch } : part)) };
}
export function patchRules(draft: DesignDraft, partKey: string, change: (rules: Record<string, unknown>) => Record<string, unknown>): DesignDraft {
  return { ...draft, parts: draft.parts.map((part) => (part.key === partKey ? { ...part, rules: change({ ...part.rules }) } : part)) };
}
export const removePart = (draft: DesignDraft, partKey: string): DesignDraft => ({ ...draft, parts: draft.parts.filter((part) => part.key !== partKey) });

/**
 * A part locked or opened. A locked text keeps words of its own: locking one
 * that has none starts it with its sample, as the comp does, so the customer
 * never sees an empty locked line.
 */
export function setLocked(draft: DesignDraft, partKey: string, locked: boolean): DesignDraft {
  return {
    ...draft,
    parts: draft.parts.map((part) => {
      if (part.key !== partKey) return part;
      if (!locked || part.kind !== 'text' || typeof part.value?.['text'] === 'string') return { ...part, locked };
      return { ...part, locked, value: { ...(part.value ?? {}), text: typeof part.rules['placeholder'] === 'string' ? part.rules['placeholder'] : part.name } };
    }),
  };
}

/** A list rule with one value switched on or off; the last one stays (a part offers at least one). */
export function toggledIn(list: unknown, value: string | number): (string | number)[] {
  const now = Array.isArray(list) ? (list as (string | number)[]) : [];
  if (now.includes(value)) return now.length > 1 ? now.filter((one) => one !== value) : now;
  return [...now, value];
}

/**
 * A list rule switched, and its start value kept among it: switching off the
 * font a part starts in starts it in the first one left.
 */
export function toggleRule(rules: Record<string, unknown>, list: 'fonts' | 'finishes' | 'colours' | 'sizes' | 'choices', value: string | number): Record<string, unknown> {
  const next = toggledIn(rules[list], value);
  const sorted = list === 'sizes' ? [...(next as number[])].sort((a, b) => a - b) : next;
  const start = ({ fonts: 'font', finishes: 'finish', colours: 'colour', sizes: 'size' } as const)[list as 'fonts'];
  const out: Record<string, unknown> = { ...rules, [list]: sorted };
  if (start !== undefined && !sorted.includes(rules[start] as string | number) && sorted[0] !== undefined) out[start] = sorted[0];
  return out;
}

/** A layer brought forward (`1`) or sent back (`-1`) among the parts of its own side and layout. */
export function zMoved(draft: DesignDraft, partKey: string, dir: 1 | -1): DesignDraft {
  const part = draft.parts.find((one) => one.key === partKey);
  if (part === undefined) return draft;
  const peers = draft.parts.filter((one) => (one.side ?? 'front') === (part.side ?? 'front') && one.layout === part.layout);
  const at = peers.indexOf(part);
  const other = peers[at + dir];
  if (other === undefined) return draft;
  const parts = [...draft.parts];
  const i = parts.indexOf(part);
  const j = parts.indexOf(other);
  parts[i] = other;
  parts[j] = part;
  return { ...draft, parts };
}

/* ── what "Add …" puts on the design ───────────────────────────────────── */

export type Tool = 'text' | 'logo' | 'motif' | 'shape' | 'rect' | 'ellipse' | 'line';
/** The motifs Birch Row's pieces offer, by code: each is drawn as the dashboard's icon of the same name. */
export const MOTIFS = ['sprout', 'leaf', 'wheat', 'moon', 'star', 'lamp', 'heart', 'library', 'book-open'] as const;

export interface AddFacts {
  face: FaceFacts;
  side: Side;
  layout: string | null;
  fonts: readonly string[];
  finishes: readonly string[];
  /** The priced feature a logo uses ("Your own logo"), where the shop has one. */
  logoFeature: string | number | null;
  /** The new part's name, in the screen's words. */
  name: string;
  /** The sample words a new text starts with. */
  sample: string;
  /** What a new shape says it is ("Engraved frame, 1 mm"), for a piece. */
  shapeSays: string;
}

/**
 * A new part, as each comp starts one. A piece (Birch Row's `addRmPart`): a
 * band of text across the middle in the base's first font and finish, a logo
 * box, a motif, a frame. A page (Marlow's `addObj`): a text part of 9 pt, a
 * logo box, a rectangle, an ellipse, a line, each centred on the card.
 */
export function addPart(draft: DesignDraft, tool: Tool, facts: AddFacts): { draft: DesignDraft; key: string } {
  const { face } = facts;
  const W = face.width;
  const H = face.height;
  const font = facts.fonts[0];
  const centred = (w: number, h: number): Box => ({ x: tenth((W - w) / 2), y: tenth((H - h) / 2), w: tenth(w), h: Math.round(h * 100) / 100 });
  const pct = (x: number, y: number, w: number, h: number): Box => ({ x: tenth((W * x) / 100), y: tenth((H * y) / 100), w: tenth((W * w) / 100), h: tenth((H * h) / 100) });
  const u = W / 85;
  const start = { required: false, locked: false, value: null as Record<string, unknown> | null, areaId: null, pieceId: null, featureId: null as string | number | null };
  let part: Omit<PartDraft, 'key' | 'id' | 'code' | 'name' | 'side' | 'layout'>;
  if (face.kind === 'page') {
    switch (tool) {
      case 'logo':
        part = { ...start, kind: 'picture', box: centred(20 * u, 20 * u), rules: { picture: 'logo', fit: 'inside', file: 'logo_file' } };
        break;
      case 'rect':
        part = { ...start, kind: 'shape', locked: true, box: centred(30 * u, 20 * u), rules: { shape: 'rect', fill: 'accent' } };
        break;
      case 'ellipse':
        part = { ...start, kind: 'shape', locked: true, box: centred(22 * u, 22 * u), rules: { shape: 'ellipse', fill: 'accent' } };
        break;
      case 'line':
        part = { ...start, kind: 'shape', locked: true, box: centred(40 * u, 0.6), rules: { shape: 'rect', fill: 'ink' } };
        break;
      default:
        part = { ...start, kind: 'text', box: centred(45 * u, textHeightMm(9, 1)), rules: { chars: 30, grows: false, unit: 'pt', size: 9, sizes: [9], ...(font === undefined ? {} : { fonts: [font], font }), weight: 700, colours: ['ink'], colour: 'ink', align: 'start', lines: 1, placeholder: facts.sample } };
    }
  } else {
    switch (tool) {
      case 'logo':
        part = { ...start, kind: 'picture', box: pct(30, 40, 40, 34), featureId: facts.logoFeature, rules: { picture: 'logo', fit: 'inside', colour: 'one', file: 'logo_file' } };
        break;
      case 'motif':
        part = { ...start, kind: 'choice', box: pct(35, 40, 30, 30), value: { choice: 'sprout' }, rules: { choices: ['sprout', 'leaf', 'wheat'] } };
        break;
      case 'shape':
      case 'rect':
      case 'ellipse':
      case 'line':
        part = { ...start, kind: 'shape', locked: true, box: pct(8, 8, 84, 84), value: { text: facts.shapeSays }, rules: { shape: 'rect' } };
        break;
      default:
        part = {
          ...start,
          kind: 'text',
          box: pct(30, 40, 40, 20),
          rules: { chars: 16, grows: true, unit: 'mm', size: Math.max(5, Math.round(W / 14)), min: 4, max: Math.max(8, Math.round(W / 9)), ...(font === undefined ? {} : { fonts: [font], font }), finishes: facts.finishes.slice(0, 1), ...(facts.finishes[0] === undefined ? {} : { finish: facts.finishes[0] }), placeholder: facts.sample },
        };
    }
  }
  const key = freshKey('part');
  const codes = draft.parts.map((one) => one.code);
  const made: PartDraft = { ...part, key, id: null, code: codeFor(facts.name, codes, 'part'), name: facts.name, side: face.kind === 'page' ? facts.side : null, layout: facts.layout };
  return { draft: { ...draft, parts: [...draft.parts, made] }, key };
}

/* ── the design's own palettes and layouts ─────────────────────────────── */

export function addPalette(draft: DesignDraft, name: string, from: PaletteDraft | undefined): { draft: DesignDraft; key: string } {
  const key = freshKey('palette');
  const colours = from?.colours ?? { paper: '#ffffff', ink: '#191920', accent: '#c0562f' };
  const palette: PaletteDraft = { key, id: null, code: codeFor(name, draft.palettes.map((one) => one.code), 'palette'), name, colours: { ...colours }, colourIds: {} };
  return { draft: { ...draft, palettes: [...draft.palettes, palette] }, key };
}
export function patchPalette(draft: DesignDraft, paletteKey: string, patch: { name?: string; colour?: [Role, string] }): DesignDraft {
  return {
    ...draft,
    palettes: draft.palettes.map((palette) => (palette.key !== paletteKey ? palette : { ...palette, ...(patch.name === undefined ? {} : { name: patch.name }), colours: patch.colour === undefined ? palette.colours : { ...palette.colours, [patch.colour[0]]: patch.colour[1] } })),
  };
}
export const removePalette = (draft: DesignDraft, paletteKey: string): DesignDraft => (draft.palettes.length <= 1 ? draft : { ...draft, palettes: draft.palettes.filter((one) => one.key !== paletteKey) });

/** A new layout copied from one: every part of that layout, the same codes, so a customer's words carry across. */
export function addLayout(draft: DesignDraft, from: string | null, name: string): { draft: DesignDraft; key: string } {
  const key = codeFor(name, draft.layouts.map((one) => one.key), 'layout');
  const source = from ?? draft.layouts[0]?.key ?? null;
  // A part in no layout is in every one already; only the source layout's own parts are copied.
  const copies = draft.parts.filter((part) => source !== null && part.layout === source).map((part) => ({ ...part, key: freshKey('part'), id: null, layout: key }));
  return { draft: { ...draft, layouts: [...draft.layouts, { key, name }], parts: [...draft.parts, ...copies] }, key };
}
export const renameLayout = (draft: DesignDraft, layoutKey: string, name: string): DesignDraft => ({ ...draft, layouts: draft.layouts.map((one) => (one.key === layoutKey ? { ...one, name } : one)) });
export function removeLayout(draft: DesignDraft, layoutKey: string): DesignDraft {
  if (draft.layouts.length <= 1) return draft;
  return { ...draft, layouts: draft.layouts.filter((one) => one.key !== layoutKey), parts: draft.parts.filter((part) => part.layout !== layoutKey) };
}

/* ── a new design, a copy ──────────────────────────────────────────────── */

/**
 * The rows a new design starts with. A page (Marlow's `newDesign`): the paper
 * edge to edge on each side, a name in 11 pt, one palette and one layout. A
 * piece (Birch Row, F17): a part for each of the base's areas, with the
 * area's own rules, so the design starts as the plain piece does.
 */
export function startParts(face: FaceFacts, areas: readonly DataRow[], words: { paper: string; name: string; sample: string }, font: string | undefined): Omit<PartDraft, 'key' | 'id'>[] {
  const blank = { required: false, locked: false, value: null, areaId: null, pieceId: null, featureId: null, layout: null, side: null };
  if (face.kind === 'page') {
    const paper = (side: Side): Omit<PartDraft, 'key' | 'id'> => ({ ...blank, code: 'paper', name: words.paper, kind: 'shape' as PartKind, locked: true, side, layout: 'std', box: { x: -face.bleed, y: -face.bleed, w: face.width + face.bleed * 2, h: face.height + face.bleed * 2 }, rules: { shape: 'rect', fill: 'paper', background: true } });
    const name: Omit<PartDraft, 'key' | 'id'> = {
      ...blank,
      code: 'name',
      name: words.name,
      kind: 'text',
      required: true,
      side: 'front',
      layout: 'std',
      box: { x: 6, y: 6, w: tenth(face.width - 12), h: textHeightMm(11, 1) },
      rules: { chars: 30, grows: false, unit: 'pt', size: 11, sizes: [11], ...(font === undefined ? {} : { fonts: [font], font }), weight: 800, colours: ['ink', 'accent'], colour: 'ink', align: 'start', lines: 1, placeholder: words.sample },
    };
    return face.sides === 2 ? [paper('front'), name, paper('back')] : [paper('front'), name];
  }
  return areas.map((area) => {
    const takes = area['takes'];
    const rules = objectOf(area['rules']);
    return {
      ...blank,
      code: text(area['code']),
      name: text(area['name']),
      kind: takes === 'logo' ? 'picture' : 'text',
      required: yes(area['required']),
      areaId: area['id'] as string | number,
      featureId: key(area['feature_id']),
      box: { x: num(area['x_mm']) ?? 0, y: num(area['y_mm']) ?? 0, w: num(area['w_mm']) ?? 0, h: num(area['h_mm']) ?? 0 },
      rules,
    } satisfies Omit<PartDraft, 'key' | 'id'>;
  });
}

/* ── what "Save the design" writes ─────────────────────────────────────── */

type Values = Record<string, string | number | boolean | null>;

export interface Changes {
  design: Values | null;
  parts: { create: Values[]; update: [string | number, Values][]; remove: (string | number)[] };
  palettes: { create: { key: string; values: Values; colours: Values[] }[]; update: [string | number, Values][]; remove: (string | number)[] };
  colours: { update: [string | number, Values][]; create: Values[] };
}

const jsonText = (value: unknown): string | null => (value === null || value === undefined ? null : JSON.stringify(value));

/** A part as the columns of its row, in the place it is drawn. */
export function partValues(part: PartDraft, design: { id: string | number; app: string | null }, position: number): Values {
  return {
    app: design.app,
    ready_design_id: design.id,
    code: part.code,
    name: part.name,
    kind: part.kind,
    locked: part.locked,
    required: part.required,
    side: part.side,
    layout: part.layout,
    area_id: part.areaId,
    piece_id: part.pieceId,
    feature_id: part.featureId,
    x_mm: part.box?.x ?? null,
    y_mm: part.box?.y ?? null,
    w_mm: part.box?.w ?? null,
    h_mm: part.box?.h ?? null,
    rules: jsonText(part.rules),
    value: part.value === null ? null : jsonText(part.value),
    position,
  };
}

const sameValues = (a: Values, b: Values): boolean => Object.keys(a).every((column) => a[column] === b[column]);

/** What differs between the draft as it was read and as it is now, as the writes that make it so. */
export function changesOf(before: DesignDraft, now: DesignDraft, app: string | null, roleNames: Readonly<Record<Role, string>> = { paper: 'Paper', ink: 'Ink', accent: 'Accent' }): Changes {
  const head = (draft: DesignDraft): Values => ({ name: draft.name.trim() === '' ? before.name : draft.name.trim(), state: draft.state, tags: jsonText(draft.tags), layouts: draft.layouts.length === 0 ? null : jsonText(draft.layouts) });
  // Only what changed is written: the list may have shown or hidden the design meanwhile.
  const [was, is] = [head(before), head(now)];
  const moved = Object.fromEntries(Object.entries(is).filter(([column, value]) => was[column] !== value));
  const design = Object.keys(moved).length === 0 ? null : moved;
  const ref = { id: now.id, app };
  const old = new Map(before.parts.map((part, index) => [part.key, partValues(part, ref, index + 1)]));
  const parts: Changes['parts'] = { create: [], update: [], remove: [] };
  now.parts.forEach((part, index) => {
    const values = partValues(part, ref, index + 1);
    const held = old.get(part.key);
    if (part.id === null || held === undefined) parts.create.push(values);
    else if (!sameValues(values, held)) parts.update.push([part.id, values]);
  });
  const kept = new Set(now.parts.map((part) => part.key));
  for (const part of before.parts) if (!kept.has(part.key) && part.id !== null) parts.remove.push(part.id);

  const palettes: Changes['palettes'] = { create: [], update: [], remove: [] };
  const colours: Changes['colours'] = { update: [], create: [] };
  const oldPalettes = new Map(before.palettes.map((palette) => [palette.key, palette]));
  now.palettes.forEach((palette, index) => {
    const values: Values = { app, ready_design_id: now.id, kind: 'colours', code: palette.code, name: palette.name, position: index + 1 };
    const old = oldPalettes.get(palette.key);
    if (palette.id === null || old === undefined) {
      palettes.create.push({ key: palette.key, values, colours: ROLES.map((role, at) => ({ app, code: role, role, name: roleNames[role], hex: palette.colours[role], position: at + 1 })) });
      return;
    }
    if (old.name !== palette.name || before.palettes.indexOf(old) !== index) palettes.update.push([palette.id, values]);
    for (const [at, role] of ROLES.entries()) {
      if (palette.colours[role] === old.colours[role] && palette.colourIds[role] !== undefined) continue;
      const id = palette.colourIds[role];
      if (id === undefined) colours.create.push({ app, palette_id: palette.id, code: role, role, name: roleNames[role], hex: palette.colours[role], position: at + 1 });
      else colours.update.push([id, { hex: palette.colours[role] }]);
    }
  });
  const keptPalettes = new Set(now.palettes.map((palette) => palette.key));
  for (const palette of before.palettes) if (!keptPalettes.has(palette.key) && palette.id !== null) palettes.remove.push(palette.id);
  return { design, parts, palettes, colours };
}

export const hasChanges = (changes: Changes): boolean =>
  changes.design !== null || changes.parts.create.length + changes.parts.update.length + changes.parts.remove.length + changes.palettes.create.length + changes.palettes.update.length + changes.palettes.remove.length + changes.colours.update.length + changes.colours.create.length > 0;
