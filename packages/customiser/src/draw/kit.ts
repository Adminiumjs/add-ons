/**
 * A KIT'S DESIGN, PIECE BY PIECE AND FACE BY FACE — no screen in it.
 *
 * A kit is cut as flat pieces and shown put together. Its design is laid out
 * on each surface it sits on, from the same flat sheet everything else is
 * drawn from (`flat.ts`):
 *
 * - a piece's sheet: the parts cut on that piece, at its size (the laser's
 *   file for the piece, and the piece in "Pieces");
 * - a marked face's sheet: the parts on that face and on the piece it is, at
 *   the piece's size (the decal laid on the model in "Assembled").
 *
 * "Pieces" lays every piece flat in rows, as the comp's `piecesScene` does:
 * left to right, 10 mm apart, a new row past 470 mm.
 */
import type { Catalogue } from '../browser/catalogue.ts';
import type { MarkedFace } from '../three/faces.ts';
import { num, str } from '../rules/read.ts';
import type { FlatOn } from './flat.ts';

/** A piece of a kit as it is drawn: its row's id, its number, its name and its size. */
export interface KitPiece {
  id: string;
  code: string;
  name: string;
  width: number;
  height: number;
  /** Its cleaned SVG, as the row keeps it. */
  file: unknown;
}

/** The kit's pieces, in the shop's order. */
export function kitPieces(catalogue: Catalogue): KitPiece[] {
  return catalogue.rows.pieces
    .filter((row) => row['base_id'] === undefined || String(row['base_id']) === String(catalogue.base.id))
    .map((row) => ({ id: String(row['id']), code: str(row['code']) ?? '', name: str(row['name']) ?? '', width: Math.max(num(row['width_mm']) ?? 0, 1), height: Math.max(num(row['height_mm']) ?? 0, 1), file: row['file'], position: num(row['position']) ?? 0 }))
    .sort((a, b) => a.position - b.position || a.code.localeCompare(b.code))
    .map(({ position: _position, ...piece }) => piece);
}

/** A piece alone, at its size. */
export const onPiece = (piece: KitPiece): FlatOn => ({ piece: piece.id, face: null, width: piece.width, height: piece.height });

/** A marked face alone: the parts on it and on its piece, at the piece's size (the face's own, measured, without one). */
export function onFace(face: MarkedFace, pieces: readonly KitPiece[]): FlatOn {
  const piece = face.piece === null ? undefined : pieces.find((one) => one.id === face.piece);
  return { piece: face.piece, face: face.code, width: piece?.width ?? Math.max(face.size.w, 1), height: piece?.height ?? Math.max(face.size.h, 1) };
}

/** The pieces any part of the design is on: what the laser engraves. */
export function carryingPieces(catalogue: Catalogue, parts: readonly { piece: string | null; face: string | null }[]): Set<string> {
  const out = new Set<string>();
  for (const part of parts) {
    if (part.piece !== null) out.add(part.piece);
    const face = part.face === null ? undefined : catalogue.base.faces.find((one) => one.code === part.face);
    if (face?.piece !== null && face?.piece !== undefined) out.add(face.piece);
  }
  return out;
}

/** Where each piece lies when they are laid flat, in millimetres, and the size of them all. */
export interface Laid {
  placed: (KitPiece & { x: number; y: number })[];
  width: number;
  height: number;
}

/** The comp's rows: left to right, `gap` apart, a new row once a piece would pass `across`. */
export function layPieces(pieces: readonly KitPiece[], across = 470, gap = 10): Laid {
  let [x, y, row, width] = [0, 0, 0, 0];
  const placed: Laid['placed'] = [];
  for (const piece of pieces) {
    if (x > 0 && x + piece.width > across) {
      x = 0;
      y += row + gap;
      row = 0;
    }
    placed.push({ ...piece, x, y });
    x += piece.width + gap;
    width = Math.max(width, x - gap);
    row = Math.max(row, piece.height);
  }
  return { placed, width: Math.max(width, 1), height: Math.max(y + row, 1) };
}
