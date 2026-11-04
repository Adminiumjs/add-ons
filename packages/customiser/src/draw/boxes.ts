/**
 * WHERE A PART MAY GO ON A FACE, AND HOW FAR A DRAG OR A KEY MOVES IT — in
 * millimetres, with no screen in it.
 *
 * The shop's design editor and the customer's full editor move and size
 * parts the same way: on a page as far as its bleed, on a piece inside it, to
 * the tenth of a millimetre; an arrow key moves half a millimetre on a page
 * (Shift: five), a hundredth of a piece; Alt + arrows resize.
 */
import { PT_MM } from '../rules/shapes.ts';
import type { Box } from './parts.ts';

export interface FaceFacts {
  kind: 'page' | 'piece';
  width: number;
  height: number;
  bleed: number;
  safe: number;
  sides: 1 | 2;
}


const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value));
/** A figure to the tenth of a millimetre; never a negative zero. */
export const tenth = (value: number): number => Math.round(value * 10) / 10 + 0;

/** Where a part may go: inside a piece, or on a page as far as its bleed. */
export function limitsOf(face: FaceFacts): Box {
  const edge = face.kind === 'page' ? face.bleed : 0;
  return { x: -edge, y: -edge, w: face.width + edge * 2, h: face.height + edge * 2 };
}
/** The smallest a part may be made by its corner: 2 % of the face across and down, and half a millimetre (a printed rule). */
const least = (face: FaceFacts) => ({ w: Math.max(0.5, face.width * 0.02), h: Math.max(0.5, face.height * 0.02) });

export function movedBox(box: Box, dx: number, dy: number, face: FaceFacts): Box {
  const room = limitsOf(face);
  return { ...box, x: tenth(clamp(box.x + dx, room.x, Math.max(room.x, room.x + room.w - box.w))), y: tenth(clamp(box.y + dy, room.y, Math.max(room.y, room.y + room.h - box.h))) };
}
export function resizedBox(box: Box, dw: number, dh: number, face: FaceFacts): Box {
  const room = limitsOf(face);
  const floor = least(face);
  return { ...box, w: tenth(clamp(box.w + dw, floor.w, Math.max(floor.w, room.x + room.w - box.x))), h: tenth(clamp(box.h + dh, floor.h, Math.max(floor.h, room.y + room.h - box.y))) };
}

/**
 * An arrow key on the focused design: a page moves the selected part half a
 * millimetre (Shift: five), as Marlow's editor does; a piece moves it a
 * hundredth of the face (Shift: five), as Birch Row's. Alt + arrows resize
 * it instead. Null for a key that is not an arrow.
 */
export function nudgedBox(box: Box, key: string, how: { shift: boolean; alt: boolean }, face: FaceFacts): Box | null {
  const way: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const dir = way[key];
  if (dir === undefined) return null;
  const steps = how.shift ? 5 : 1;
  const dx = dir[0] * steps * (face.kind === 'page' ? 0.5 : face.width / 100);
  const dy = dir[1] * steps * (face.kind === 'page' ? 0.5 : face.height / 100);
  return how.alt ? resizedBox(box, dx, dy, face) : movedBox(box, dx, dy, face);
}

/** A text's height at a size in points over some lines (Marlow's 1.25 line height), for a page's words. */
export const textHeightMm = (sizePt: number, lines: number): number => Math.round(sizePt * PT_MM * 1.25 * Math.max(1, lines) * 100) / 100;

