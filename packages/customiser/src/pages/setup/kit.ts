/**
 * A KIT'S SET-UP, AS DATA: its pieces, its model, its marked faces, and the
 * surfaces its areas sit on. No screen in it; `Kit.test.tsx` holds it.
 *
 * - The pieces are SVGs uploaded several at once, each numbered in turn
 *   ("01", "02", …), named after its file, measured from the drawing's own
 *   width and height (the comp's `measureSvg`).
 * - The model is one GLB of the kit put together.
 * - A marked face is a face of that model the shop named, with the kit's
 *   piece it is and the area it carries (the area holds the face's code).
 * - An area sits on a surface: a marked face or a piece. Its box is in
 *   millimetres of that surface, so the laser's file for the piece and the
 *   decal on the face are drawn from the same numbers.
 */
import type { DataRow } from '../shared/host.ts';
import type { MarkedFace } from '../../three/faces.ts';
import { num, text, type Size } from './facts.ts';

/** A kit piece's or the model's cap, as the comp says: 2 MB a piece, 30 MB the model. */
export const PIECE_BYTES = 2 * 1024 * 1024;
export const MODEL_BYTES = 30 * 1024 * 1024;

/** The thicknesses a kit is cut in, as the comp offers them. */
export const KIT_THICKNESSES = [3, 4, 6] as const;

/** The next piece's number, two figures, after the highest one there is. */
export function nextPieceCode(pieces: readonly DataRow[], plus = 0): string {
  const highest = pieces.reduce((top, piece) => Math.max(top, Number.parseInt(text(piece['code']), 10) || 0), 0);
  return String(highest + 1 + plus).padStart(2, '0');
}

/** A piece's name from its file's: the file name without `.svg`. */
export const pieceNameOf = (fileName: string): string => fileName.replace(/\.svg$/i, '').slice(0, 120) || fileName.slice(0, 120);

/** The laser's layers a piece's drawing names (`id="CUT"` and the like); a drawing that names none is cut whole. */
export function layersIn(svg: string): string[] {
  const found = ['CUT', 'SCORE', 'ENGRAVE'].filter((layer) => new RegExp(`\\b(?:id|inkscape:label)\\s*=\\s*["']${layer}["']`, 'i').test(svg));
  return found.length > 0 ? found : ['CUT'];
}

/** A file's size as the comp says it: "8.4 MB", or "640 KB" under a megabyte. */
export function megabytes(bytes: number): string {
  const mb = bytes / 1048576;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${String(Math.round(mb * 1024))} KB`;
}

/** A piece's size, from its row. */
export const pieceSize = (piece: DataRow): Size => ({ width: num(piece['width_mm']) ?? 0, height: num(piece['height_mm']) ?? 0 });

/** A piece as the comp lists it: "09 · Shop sign". */
export const pieceLabel = (piece: DataRow): string => `${text(piece['code'])} · ${text(piece['name'])}`;

/** The pieces in the shop's order. */
export const inPieceOrder = (pieces: readonly DataRow[]): DataRow[] => [...pieces].sort((a, b) => (num(a['position']) ?? 0) - (num(b['position']) ?? 0) || text(a['code']).localeCompare(text(b['code'])));

/* ── the surfaces an area sits on ──────────────────────────────────────── */

/** Where an area sits: a marked face of the model, or a piece of the kit (by its row's id). */
export type Surface = { kind: 'face'; code: string } | { kind: 'piece'; id: string };

/** A surface as a select's value: `face:sign`, `piece:9`. */
export const surfaceValue = (surface: Surface): string => (surface.kind === 'face' ? `face:${surface.code}` : `piece:${surface.id}`);
export function readSurface(value: string): Surface | null {
  if (value.startsWith('face:') && value.length > 5) return { kind: 'face', code: value.slice(5) };
  if (value.startsWith('piece:') && value.length > 6) return { kind: 'piece', id: value.slice(6) };
  return null;
}

/** The surface an area sits on: its marked face where the base has it, else its piece; none on a plain base. */
export function surfaceOfArea(area: DataRow, faces: readonly MarkedFace[]): Surface | null {
  const face = text(area['face']);
  if (face !== '' && faces.some((one) => one.code === face)) return { kind: 'face', code: face };
  const piece = text(area['piece_id']);
  return piece === '' ? null : { kind: 'piece', id: piece };
}

/** The columns an area keeps for its surface: a face names its piece too, so the laser's file finds the area. */
export function surfaceColumns(surface: Surface, faces: readonly MarkedFace[]): { face: string | null; piece_id: string | number | null } {
  if (surface.kind === 'piece') return { face: null, piece_id: idValue(surface.id) };
  const face = faces.find((one) => one.code === surface.code);
  return { face: surface.code, piece_id: face?.piece === null || face?.piece === undefined ? null : idValue(face.piece) };
}

/** An id as the row keeps it: a number where it is one. */
const idValue = (id: string): string | number => (/^\d+$/.test(id) ? Number(id) : id);

/** How big a surface is, in millimetres: a piece's own size; a face's piece's, else the face's measured size. */
export function surfaceSize(surface: Surface, faces: readonly MarkedFace[], pieces: readonly DataRow[]): Size {
  if (surface.kind === 'piece') {
    const piece = pieces.find((one) => text(one['id']) === surface.id);
    return piece === undefined ? { width: 0, height: 0 } : pieceSize(piece);
  }
  const face = faces.find((one) => one.code === surface.code);
  if (face === undefined) return { width: 0, height: 0 };
  const piece = face.piece === null ? undefined : pieces.find((one) => text(one['id']) === face.piece);
  return piece === undefined ? { width: face.size.w, height: face.size.h } : pieceSize(piece);
}

/** Every surface an area may sit on, in the order the "On:" picker lists them: the marked faces, then the pieces. */
export function surfacesOf(faces: readonly MarkedFace[], pieces: readonly DataRow[]): Surface[] {
  return [...faces.map((face): Surface => ({ kind: 'face', code: face.code })), ...inPieceOrder(pieces).map((piece): Surface => ({ kind: 'piece', id: text(piece['id']) }))];
}

/** Whether an area sits on a surface: its own, or (for a piece) a face that is that piece. */
export const sitsOn = (area: DataRow, surface: Surface, faces: readonly MarkedFace[]): boolean => {
  const own = surfaceOfArea(area, faces);
  return own !== null && surfaceValue(own) === surfaceValue(surface);
};

/** A face's code from its name, unique on the base: "Sign board" → `sign-board`. */
export function faceCode(name: string, taken: readonly string[]): string {
  const stem =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'face';
  let code = stem;
  for (let n = 2; taken.includes(code); n += 1) code = `${stem}-${String(n)}`;
  return code;
}
