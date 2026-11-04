/**
 * A READY-MADE DESIGN'S PARTS, AS THINGS TO DRAW — in millimetres, with no
 * screen in it.
 *
 * The shop's design editor draws a design from its parts; the customer's
 * editor and the previews draw the same parts with a customer's values in.
 * This turns one part (its kind, its rules, its start value and its box) into
 * what is drawn: lines of words at a size and a colour, a box a customer's
 * logo or a motif goes in, or a shape. No React and no page: a picture made
 * from it on the shop's side reads the same answer.
 *
 * Where things sit is the part's own box, in millimetres from the top-left of
 * a page's trim or of a piece. A page's colours are its palette's roles
 * (paper, ink, accent); a piece's are its finishes (engraved, painted).
 */
import { PT_MM } from '../rules/shapes.ts';
import { isObject, json, num, str, words, yes } from '../rules/read.ts';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type PartKind = 'text' | 'picture' | 'colour' | 'choice' | 'shape';

/** One part as a design holds it, whichever table it came from. */
export interface PartLike {
  key: string;
  kind: PartKind;
  name: string;
  box: Box | null;
  rules: Readonly<Record<string, unknown>>;
  value: Readonly<Record<string, unknown>> | null;
  locked: boolean;
}

/** The colours a design is drawn in: a page's palette by role, and a piece's finishes by code. */
export interface Look {
  page: boolean;
  /** A page's palette: `paper`, `ink`, `accent`, each a colour value. */
  roles: Readonly<Record<string, string>>;
  /** A piece's finishes by code ("engraved"), each a colour value. */
  finishes: Readonly<Record<string, string>>;
}

export type Drawn =
  | { kind: 'text'; key: string; box: Box; lines: string[]; font: string; sizeMm: number; weight: number; align: 'start' | 'center' | 'end'; colour: string }
  | { kind: 'slot'; key: string; box: Box; slot: 'logo' | 'photo' | 'choice'; label: string }
  | { kind: 'shape'; key: string; box: Box; shape: 'rect' | 'ellipse' | 'ring'; fill: string | null; stroke: string | null; background: boolean }
  /** A customer's own picture, drawn from its address in the page (never its markup), inside its box or filling it. */
  | { kind: 'image'; key: string; box: Box; href: string; fill: boolean };

/** Where a page's words and shapes take their colour when the palette names none: the ink. */
const INK = '#191920';
/** An engraved line on a piece, when the base offers no finish. */
const BURNT = '#3a2414';

/** The size a text part is drawn at, in millimetres: its start size, else its first allowed one. */
export function textSizeMm(rules: Readonly<Record<string, unknown>>): number {
  const sizes = Array.isArray(rules['sizes']) ? (rules['sizes'] as unknown[]).filter((one): one is number => typeof one === 'number') : [];
  const size = num(rules['size']) ?? sizes[0] ?? num(rules['min']) ?? 4;
  return rules['unit'] === 'pt' ? size * PT_MM : size;
}

/** What a part says on the shop's drawing: a locked part its own words, an open one its sample (the comp's "Sample words"). */
export function wordsOf(part: Pick<PartLike, 'rules' | 'value' | 'locked' | 'name'>): string {
  const told = str(part.value?.['text']) ?? '';
  const sample = str(part.rules['placeholder']) ?? '';
  const said = part.locked ? told || sample : sample || told;
  const shown = said === '' ? part.name : said;
  return yes(part.rules['upper']) ? shown.toUpperCase() : shown;
}

/** One part, as it is drawn; none for a part with no place (a colour the whole design takes). */
export function drawPart(part: PartLike, look: Look, labels: { logo: string; photo: string; choice: (code: string) => string }): Drawn | null {
  if (part.box === null || part.kind === 'colour') return null;
  const rules = part.rules;
  const box = part.box;
  if (part.kind === 'text') {
    const role = str(rules['colour']) ?? 'ink';
    const finish = str(rules['finish']) ?? words(rules['finishes'])?.[0] ?? null;
    const colour = look.page ? (look.roles[role] ?? look.roles['ink'] ?? INK) : ((finish === null ? undefined : look.finishes[finish]) ?? Object.values(look.finishes)[0] ?? BURNT);
    const align = rules['align'] === 'center' || rules['align'] === 'end' ? rules['align'] : look.page ? 'start' : 'center';
    return { kind: 'text', key: part.key, box, lines: wordsOf(part).split(/\r?\n/), font: str(rules['font']) ?? words(rules['fonts'])?.[0] ?? 'sans-serif', sizeMm: textSizeMm(rules), weight: num(rules['weight']) ?? 400, align, colour };
  }
  if (part.kind === 'picture') {
    const photo = rules['picture'] === 'photo';
    return { kind: 'slot', key: part.key, box, slot: photo ? 'photo' : 'logo', label: photo ? labels.photo : labels.logo };
  }
  if (part.kind === 'choice') {
    const start = str(part.value?.['choice']) ?? words(rules['choices'])?.[0] ?? '';
    return { kind: 'slot', key: part.key, box, slot: 'choice', label: start === '' ? part.name : labels.choice(start) };
  }
  const shape = rules['shape'] === 'ellipse' || rules['shape'] === 'oval' ? 'ellipse' : rules['shape'] === 'ring' ? 'ring' : 'rect';
  if (look.page) {
    const role = str(rules['fill']) ?? 'accent';
    return { kind: 'shape', key: part.key, box, shape, fill: look.roles[role] ?? INK, stroke: null, background: yes(rules['background']) };
  }
  // On a piece a shape is cut or engraved as a line, never filled.
  return { kind: 'shape', key: part.key, box, shape, fill: null, stroke: Object.values(look.finishes)[0] ?? BURNT, background: false };
}

/** A part's rules or start value as an object, whether the row holds it parsed or as text. */
export function objectOf(raw: unknown): Record<string, unknown> {
  const value = json(raw);
  return isObject(value) ? { ...value } : {};
}
