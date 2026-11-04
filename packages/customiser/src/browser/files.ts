/**
 * A CUSTOMER'S LOGO OR PHOTO, READ IN THE BROWSER BEFORE AND AFTER IT IS SENT.
 *
 * The checks of a picture at its printed size need what only the browser can
 * read: how many pixels it has, and how fine its finest line is once it is
 * made one colour for the laser. This reads both, and nothing here ever puts a
 * customer's file into the page as markup:
 *
 * - a PNG or a JPEG is decoded as a picture;
 * - an SVG is drawn as a picture too (an image of it, never its markup): a
 *   picture never runs a script and never fetches anything, whatever the file
 *   holds. Once the design is kept, its own copy is read back through the
 *   design's link: the copy Adminium cleaned, which is the one that is made;
 * - a PDF is not drawn: its first page's size is read from the file's own
 *   words (`/MediaBox`), and its finest line is left to the proof.
 *
 * What kind a file is comes from its first bytes, never its name, as the
 * server reads it (a photo renamed `.png` is still a photo of its own kind).
 */

/** The most a customer's file may weigh: the design's file columns' own cap. */
export const PICTURE_MAX_BYTES = 10 * 1024 * 1024;
/** The longest side a picture is measured at: fine enough for a line a thousandth of its width. */
const MEASURE_SIDE = 1024;
/** The share of the dark pixels the finest line is read at: a speck of dust is not a line, a field of shading is. */
const FINEST_SHARE = 0.05;

/** A kind a file's first bytes say it is. */
export type Sniffed = 'png' | 'jpeg' | 'svg' | 'pdf' | 'heic' | 'other';

/** The stored type of each kind a part takes. */
export const TYPE_OF: Readonly<Record<string, string>> = { png: 'image/png', jpeg: 'image/jpeg', jpg: 'image/jpeg', svg: 'image/svg+xml', pdf: 'application/pdf' };

const ascii = (bytes: Uint8Array, from: number, length: number): string => String.fromCharCode(...bytes.slice(from, from + length));

/** What a file is, from its first bytes. */
export function sniff(head: Uint8Array): Sniffed {
  if (head.length >= 4 && head[0] === 0x89 && ascii(head, 1, 3) === 'PNG') return 'png';
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg';
  if (ascii(head, 0, 5) === '%PDF-') return 'pdf';
  if (ascii(head, 4, 4) === 'ftyp' && ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(ascii(head, 8, 4))) return 'heic';
  // An SVG is text: past a byte-order mark, an XML declaration or comments, its first element is <svg>.
  const text = new TextDecoder('utf-8', { fatal: false }).decode(head).replace(/^﻿/, '');
  if (/^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*(?:<!DOCTYPE[^>]*>\s*)?<svg[\s>/]/i.test(text)) return 'svg';
  return 'other';
}

/** A file's bytes, however the page can read them. */
export function bytesOf(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('unreadable'));
    reader.readAsArrayBuffer(blob);
  });
}

/** The first kilobyte of a file. */
export async function headOf(file: Blob): Promise<Uint8Array> {
  return new Uint8Array(await bytesOf(file.slice(0, 1024)));
}

/** The whole file, telling how much of it is read as it goes (the share, 0 to 1). */
export function readWithProgress(file: Blob, onProgress: (share: number) => void): Promise<ArrayBuffer> {
  if (typeof FileReader === 'undefined') return bytesOf(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
    };
    reader.onload = () => {
      onProgress(1);
      resolve(reader.result as ArrayBuffer);
    };
    reader.onerror = () => reject(reader.error ?? new Error('unreadable'));
    reader.readAsArrayBuffer(file);
  });
}

/** A PDF's first page, in points, from its own words; null where it does not say. */
export function pdfPageSize(text: string): [number, number] | null {
  const match = /\/MediaBox\s*\[\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*\]/.exec(text);
  if (match === null) return null;
  const [x0, y0, x1, y1] = match.slice(1, 5).map(Number) as [number, number, number, number];
  const [w, h] = [Math.abs(x1 - x0), Math.abs(y1 - y0)];
  return w > 0 && h > 0 ? [Math.round(w), Math.round(h)] : null;
}

/** A picture's lightness, one value a pixel (0 black, 255 white), as if it lay on white paper. */
export interface Lightness {
  data: Uint8Array;
  width: number;
  height: number;
}

/** What the browser could read of a picture. */
export interface Picture {
  /** Its size in pixels (a vector's own units; a PDF's points). */
  px?: [number, number];
  /** Its lightness at the size it is measured, for the finest line and the one-colour picture. */
  light?: Lightness;
}

/** Lightness from a canvas's pixels (red, green, blue, alpha), laid on white. */
export function lightnessOf(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): Lightness {
  const data = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const [r, g, b, a] = [rgba[i * 4]!, rgba[i * 4 + 1]!, rgba[i * 4 + 2]!, rgba[i * 4 + 3]! / 255];
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    data[i] = Math.round(lum * a + 255 * (1 - a));
  }
  return { data, width, height };
}

/** Whether a pixel is engraved: darker than the line the customer set (in per cent of white). */
const isDark = (value: number, threshold: number): boolean => (value / 255) * 100 < threshold;

/**
 * The finest line a picture has once made one colour, as a share of its
 * width; undefined when nothing is dark at all.
 *
 * Each dark pixel's line is as wide as the shortest run of dark through it,
 * across, down and along both diagonals (a diagonal step is the square root
 * of two pixels long), so a line at any angle is read at its own width. The
 * finest line is read where the thinnest twentieth of the ink starts: one
 * stray pixel is not a line, and shading that is a twentieth of the logo is.
 */
export function finestLine(light: Lightness, threshold: number): number | undefined {
  const { data, width, height } = light;
  const dark = new Uint8Array(width * height);
  let inked = 0;
  for (let i = 0; i < dark.length; i += 1)
    if (isDark(data[i]!, threshold)) {
      dark[i] = 1;
      inked += 1;
    }
  if (inked === 0) return undefined;
  const run = new Float32Array(width * height).fill(Number.POSITIVE_INFINITY);
  const walk = (dx: number, dy: number, step: number): void => {
    const seen = new Uint8Array(width * height);
    for (let y = 0; y < height; y += 1)
      for (let x = 0; x < width; x += 1) {
        const at = y * width + x;
        if (dark[at] === 0 || seen[at] === 1) continue;
        // Back to the start of this run, then along it.
        let [sx, sy] = [x, y];
        while (sx - dx >= 0 && sx - dx < width && sy - dy >= 0 && sy - dy < height && dark[(sy - dy) * width + (sx - dx)] === 1) [sx, sy] = [sx - dx, sy - dy];
        const cells: number[] = [];
        for (let [cx, cy] = [sx, sy]; cx >= 0 && cx < width && cy >= 0 && cy < height && dark[cy * width + cx] === 1; cx += dx, cy += dy) cells.push(cy * width + cx);
        const length = cells.length * step;
        for (const cell of cells) {
          seen[cell] = 1;
          if (length < run[cell]!) run[cell] = length;
        }
      }
  };
  walk(1, 0, 1);
  walk(0, 1, 1);
  walk(1, 1, Math.SQRT2);
  walk(1, -1, Math.SQRT2);
  const widths = new Float32Array(inked);
  for (let i = 0, at = 0; i < run.length; i += 1) if (dark[i] === 1) widths[at++] = run[i]!;
  widths.sort();
  const finest = widths[Math.min(widths.length - 1, Math.floor(widths.length * FINEST_SHARE))]!;
  return finest / width;
}

/** A picture drawn from a file's bytes, where the page can draw one. */
function decoded(blob: Blob): Promise<HTMLImageElement | null> {
  if (typeof Image === 'undefined' || typeof URL.createObjectURL !== 'function') return Promise.resolve(null);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    // A page that never answers is given a few seconds: the file is still sent, only not measured.
    const done = (out: HTMLImageElement | null): void => {
      clearTimeout(wait);
      URL.revokeObjectURL(url);
      resolve(out);
    };
    const wait = setTimeout(() => done(null), 4000);
    image.onload = () => done(image);
    image.onerror = () => done(null);
    image.src = url;
  });
}

/** A canvas of a size, where the page has one that draws. */
function canvasOf(width: number, height: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  let context: CanvasRenderingContext2D | null = null;
  try {
    context = canvas.getContext('2d', { willReadFrequently: true });
  } catch {
    context = null;
  }
  return context === null ? null : { canvas, context };
}

/** What the browser reads of a picture: its pixels and its lightness (none of a PDF but its page size). */
export async function readPicture(blob: Blob, kind: string): Promise<Picture> {
  if (kind === 'pdf') {
    const size = pdfPageSize(new TextDecoder('latin1').decode(new Uint8Array(await bytesOf(blob.slice(0, 256 * 1024)))));
    return size === null ? {} : { px: size };
  }
  const image = await decoded(blob);
  if (image === null) return {};
  const [w, h] = [image.naturalWidth || image.width, image.naturalHeight || image.height];
  if (!(w > 0) || !(h > 0)) return {};
  const px: [number, number] = [w, h];
  // A vector is drawn at the measuring size whatever its own units; a photo never larger than it is.
  const scale = kind === 'svg' ? MEASURE_SIDE / Math.max(w, h) : Math.min(1, MEASURE_SIDE / Math.max(w, h));
  const [cw, ch] = [Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale))];
  const drawn = canvasOf(cw, ch);
  if (drawn === null) return { px };
  try {
    drawn.context.drawImage(image, 0, 0, cw, ch);
    return { px, light: lightnessOf(drawn.context.getImageData(0, 0, cw, ch).data, cw, ch) };
  } catch {
    return { px };
  }
}

/**
 * The picture as the laser makes it: every pixel darker than the line in the
 * engraving's colour, the rest left as the material. A picture's address of
 * its own (a `blob:`), or null where the page cannot draw one.
 */
export async function oneColourPicture(light: Lightness, threshold: number, ink: string): Promise<string | null> {
  const drawn = canvasOf(light.width, light.height);
  if (drawn === null || typeof URL.createObjectURL !== 'function') return null;
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(ink.slice(at, at + 2), 16)) as [number, number, number];
  const pixels = drawn.context.createImageData(light.width, light.height);
  for (let i = 0; i < light.data.length; i += 1) {
    if (!isDark(light.data[i]!, threshold)) continue;
    pixels.data.set([r, g, b, 255], i * 4);
  }
  drawn.context.putImageData(pixels, 0, 0);
  return new Promise((resolve) => {
    try {
      drawn.canvas.toBlob((made) => resolve(made === null ? null : URL.createObjectURL(made)), 'image/png');
    } catch {
      resolve(null);
    }
  });
}
