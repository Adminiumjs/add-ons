/**
 * WHAT A PAGE NEEDS BEFORE IT SHOWS A PIECE IN 3D, WITHOUT three.js IN IT.
 *
 * - `loadThree`: the 3D stage's own file, fetched the first time a piece is
 *   shown in 3D and kept (a print shop's pages never call it);
 * - `hasWebGL`: whether this device can draw in 3D at all, asked once a page;
 * - `reducedMotion`: whether the person asked for less motion (the stage then
 *   starts flat);
 * - the piece as the stage draws it (`pieceModel`): its outline, read once an
 *   address, and its top painted from the design's flat sheet.
 *
 * The 3D stage's file shares no code with this one (it reads the outline
 * itself), so the editor's own file stays one file and the stage's another.
 */
import { paintSheet, pixelsPerMm, type Painted, type Pen } from '../draw/canvas.ts';
import type { FlatSheet } from '../draw/flat.ts';
import type { ReadSvg } from '../draw/svgread.ts';
import type { PieceModel } from './piece.ts';

export type ThreeChunk = typeof import('./stage3d.ts');

let chunk: Promise<ThreeChunk> | null = null;

/** The 3D stage's file, fetched once. */
export function loadThree(): Promise<ThreeChunk> {
  chunk ??= import('./stage3d.ts').catch((error: unknown) => {
    chunk = null;
    throw error;
  });
  return chunk;
}

let webgl: boolean | null = null;

/**
 * Whether this device draws WebGL: a canvas gives a context that answers as
 * one (a stand-in canvas that only paints in 2D does not).
 */
export function hasWebGL(): boolean {
  if (webgl !== null) return webgl;
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const context = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as { getParameter?: unknown } | null;
    webgl = context !== null && typeof context.getParameter === 'function';
  } catch {
    webgl = false;
  }
  return webgl;
}

/** Forget what was found, for a test that draws a device with or without WebGL. */
export function forgetWebGL(): void {
  webgl = null;
}

export const reducedMotion = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const outlines = new Map<string, Promise<ReadSvg | null>>();

/** A piece's outline, read once an address (or a file's id) for every stage and still on the page. */
export function outlineOnce(key: string, text: () => Promise<string | null>): Promise<ReadSvg | null> {
  let found = outlines.get(key);
  if (found === undefined) {
    // Read by the 3D stage's own file, which the outline is only ever drawn by.
    found = Promise.all([text(), loadThree()])
      .then(([svg, three]) => (svg === null ? null : three.readSvg(svg)))
      .catch(() => null);
    outlines.set(key, found);
  }
  return found;
}

const pictures = new Map<string, Promise<Painted | null>>();

/** A picture this page holds (a `blob:` or the shop's address), loaded once, ready to paint. */
export function paintedOnce(url: string): Promise<Painted | null> {
  let found = pictures.get(url);
  if (found === undefined) {
    found = new Promise<Painted | null>((resolve) => {
      if (typeof Image === 'undefined') return resolve(null);
      const image = new Image();
      image.onload = () => resolve({ image, width: image.naturalWidth || image.width, height: image.naturalHeight || image.height });
      image.onerror = () => resolve(null);
      image.src = url;
    });
    pictures.set(url, found);
  }
  return found;
}

/** The longest side of the top's picture, in pixels. */
const TOP_PIXELS = 1024;

/** The design's flat sheet painted as the piece's top; none where this page cannot paint. */
export function topCanvas(sheet: FlatSheet, painted: Readonly<Record<string, Painted>>): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const k = pixelsPerMm(sheet, TOP_PIXELS);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sheet.face.width * k));
  canvas.height = Math.max(1, Math.round(sheet.face.height * k));
  let context: CanvasRenderingContext2D | null = null;
  try {
    context = canvas.getContext('2d');
  } catch {
    context = null;
  }
  if (context === null || typeof context.fillText !== 'function') return null;
  // Painted edge to edge: the top's own shape is the outline, so the sheet's corners and edge line are left to it.
  paintSheet(context as unknown as Pen, { ...sheet, face: { ...sheet.face, kind: 'page' } }, k, painted);
  return canvas;
}

/** A flat piece as the stage draws it: the sheet's face, the outline, the thickness and the painted top. */
export function pieceModel(sheet: FlatSheet, outline: ReadSvg | null, thickness: number | null, painted: Readonly<Record<string, Painted>>): PieceModel {
  return {
    width: sheet.face.width,
    height: sheet.face.height,
    corner: sheet.face.corner,
    thickness: thickness ?? 4,
    outline,
    face: sheet.face.colour,
    edge: sheet.face.edge,
    top: topCanvas(sheet, painted),
  };
}
