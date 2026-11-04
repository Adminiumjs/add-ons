/**
 * HOW A PRINTED ITEM'S WORDS LOOK STOOD UP OR SUNK, AS NUMBERS: no three.js
 * in it, so the pages that work out a preview and the stage that draws it
 * read the same rules.
 */

/** How many slices a raised word is stood up from: one a fifth of a millimetre, three to eight. */
export const sliceCount = (depth: number): number => Math.max(3, Math.min(8, Math.ceil(depth / 0.2)));

/** A colour mixed toward black by a share (0 to 1): the side of a raised letter, the floor of a cut one. */
export function darker(hex: string, share: number): string {
  const n = /^#([0-9a-f]{6})$/i.exec(hex)?.[1];
  if (n === undefined) return hex;
  const value = Number.parseInt(n, 16);
  const part = (shift: number): string => Math.round(((value >> shift) & 255) * (1 - share)).toString(16).padStart(2, '0');
  return `#${part(16)}${part(8)}${part(0)}`;
}
