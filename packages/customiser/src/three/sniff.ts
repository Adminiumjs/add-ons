/**
 * WHAT A FILE IS, BY ITS BYTES: never by its name or what the sender says.
 *
 * The shop's set-up reads a picked file's first bytes before it uploads it,
 * so a refusal comes at once and in the shop's words; Adminium reads the
 * whole file again as it stores it (its own model and SVG readers).
 *
 * - an SVG: text whose first tag (after an XML line, comments or a doctype)
 *   is `<svg`;
 * - a GLB: the glTF binary's header (`glTF`, version 2, its own length the
 *   file's), as the glTF 2 standard writes it;
 * - an STL: a binary one is 84 bytes and 50 a triangle, exactly; a text one
 *   starts `solid` and holds a `facet`;
 * - a 3MF: a zip whose central directory names a 3MF package's parts (its
 *   relationships, its content types) and a model part. A zip renamed
 *   `.3mf` without them is not one.
 */
import { zipEntries } from './zip.ts';

export type ModelKind = 'glb' | 'stl' | '3mf';

const ascii = (bytes: Uint8Array, from: number, to: number): string => String.fromCharCode(...bytes.subarray(from, Math.min(to, bytes.length)));
const u32 = (bytes: Uint8Array, at: number): number => (bytes[at]! | (bytes[at + 1]! << 8) | (bytes[at + 2]! << 16) | (bytes[at + 3]! << 24)) >>> 0;

/** Whether the bytes are an SVG drawing. */
export function isSvg(bytes: Uint8Array): boolean {
  let text = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, 4096)).replace(/^﻿/, '');
  // Whatever may come before the drawing's own tag: an XML line, comments, a doctype, blank space.
  for (;;) {
    const before = text;
    text = text.replace(/^\s+/, '').replace(/^<\?xml[\s\S]*?\?>/, '').replace(/^<!--[\s\S]*?-->/, '').replace(/^<!DOCTYPE[^>]*>/i, '');
    if (text === before) break;
  }
  return /^<svg[\s>]/.test(text);
}

/** Whether the bytes are a binary glTF 2 model (a GLB) whose header says its own length. */
export function isGlb(bytes: Uint8Array): boolean {
  return bytes.length >= 20 && ascii(bytes, 0, 4) === 'glTF' && u32(bytes, 4) === 2 && u32(bytes, 8) === bytes.length;
}

/** Whether the bytes are an STL model, binary or text. */
export function isStl(bytes: Uint8Array): boolean {
  if (bytes.length >= 84 && 84 + u32(bytes, 80) * 50 === bytes.length) return true;
  const head = ascii(bytes, 0, 1024).replace(/^\s+/, '');
  return /^solid\b/i.test(head) && /\bfacet\b/i.test(ascii(bytes, 0, 4096));
}

/** Whether the bytes are a 3MF package: a zip, read from its directory within the caps, that names a 3MF's parts. */
export function is3mf(bytes: Uint8Array): boolean {
  try {
    const names = new Set(zipEntries(bytes).map((one) => one.name));
    return names.has('_rels/.rels') && names.has('[Content_Types].xml') && [...names].some((name) => /^3D\/[^/]+\.model$/i.test(name));
  } catch {
    return false;
  }
}

/** The kind of model the bytes are, or none. */
export function modelKindOf(bytes: Uint8Array): ModelKind | null {
  if (isGlb(bytes)) return 'glb';
  if (isStl(bytes)) return 'stl';
  if (is3mf(bytes)) return '3mf';
  return null;
}
