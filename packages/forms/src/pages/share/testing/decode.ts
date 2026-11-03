/**
 * Read a QR code back from the SVG Adminium's encoder drew: paint its path's
 * runs into pixels, then hand them to a decoder that knows nothing of how
 * the code was made. What comes out is what a phone's camera reads.
 */
import decodeQR from 'qr/decode.js';

/** Pixels a module, in the picture handed to the decoder. */
const SCALE = 4;

export function decodeSvg(svg: string): string {
  const across = Number(/viewBox="0 0 (\d+) \d+"/.exec(svg)?.[1]);
  const path = /<path[^>]* d="([^"]*)"/.exec(svg)?.[1] ?? '';
  if (!Number.isInteger(across) || across <= 0 || path === '') throw new Error('Not a code this encoder drew.');
  const side = across * SCALE;
  const data = new Uint8ClampedArray(side * side * 4).fill(255);
  for (const [, x, y, run] of path.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    for (let module = 0; module < Number(run); module += 1) {
      for (let dy = 0; dy < SCALE; dy += 1) {
        for (let dx = 0; dx < SCALE; dx += 1) {
          const at = ((Number(y) * SCALE + dy) * side + (Number(x) + module) * SCALE + dx) * 4;
          data[at] = 0;
          data[at + 1] = 0;
          data[at + 2] = 0;
        }
      }
    }
  }
  return decodeQR({ width: side, height: side, data });
}
