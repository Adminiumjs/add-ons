/**
 * WHETHER WORDS STAND OUT FROM WHAT IS BEHIND THEM.
 *
 * Advice only: the customer is told "Hard to read" when the words' colour is
 * too close to the colour under them (under 3 : 1, as the comp measures it),
 * and offered the palette role that reads best. The server never refuses on
 * it, and needs no colours to answer.
 */

/** The relative luminance of a colour written `#rrggbb`, or none when it is not one. */
export function luminance(hex: string): number | null {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** How far apart two colours are, from 1 (the same) to 21 (black on white). */
export function contrast(a: string, b: string): number | null {
  const [x, y] = [luminance(a), luminance(b)];
  if (x === null || y === null) return null;
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Words read when their contrast is at least this. */
export const READABLE = 3;
