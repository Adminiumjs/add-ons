/**
 * "MAKE THE PROOF" AND "MAKE THE FILES", IN THE SHOP'S BROWSER.
 *
 * Both are made from the design's newest version (its data, never a
 * picture), through the same flat sheet the customer's editor drew:
 *
 * - **a page** (Print): the proof is an A4 PDF of every side with its trim
 *   drawn; the files are a print PDF per side with bleed and crop marks;
 * - **a piece or a kit** (Maker): the proof is a picture of the piece as
 *   it will be made; the files are one SVG for the laser per piece, words
 *   and logos as outlines;
 * - **a 3D-printed item**: the proof is a picture of it, as for a piece; the
 *   file is a 3MF of its model with the words raised or cut in (`printed.ts`).
 *
 * The proof is kept on the version (`proof_file`), each file as a row of
 * `version_files` with the file in it, all through the add-on's own upload.
 * Making them again replaces what the version had.
 */
import type { CatalogueRows, DesignData } from '../browser/api.ts';
import { readCatalogue, type Catalogue } from '../browser/catalogue.ts';
import { oneColourCanvas } from '../browser/files.ts';
import { readValues, type DesignValues } from '../rules/index.ts';
import { sheetPng, type Painted } from '../draw/canvas.ts';
import { flatSheet, sheetsOf, type FlatOn, type FlatSheet } from '../draw/flat.ts';
import { kitPieces, onPiece } from '../draw/kit.ts';
import { fontAt, textPaths, type Font } from '../draw/outline.ts';
import { FontMissing, missingFonts, printPdf, printSize, proofPdf, type PdfAssets, type PdfPicture } from '../draw/pdf.ts';
import { engravedOf, layersOf, pieceSvg } from '../draw/svgfile.ts';
import { readSvg, type ReadSvg } from '../draw/svgread.ts';
import { fileBytes, filePicture } from '../pages/shared/stored.ts';
import { yes } from '../pages/setup/facts.ts';
import { starterBytes } from '../pages/setup/starter.ts';
import type { DataRow, DataValue } from '../pages/shared/host.ts';

/** The labels a sheet's empty boxes carry, for what is made: none, since nothing empty is made. */
const NO_LABELS = { logo: '', photo: '', image: '' };

/** A design's values as a row holds them (parsed or as text); none when they are not in the format. */
export function valuesOf(raw: unknown): DesignValues | null {
  const value = typeof raw === 'string' ? safeJson(raw) : raw;
  // The format is the row's own column; a copy of it inside the values says nothing more.
  const bare = typeof value === 'object' && value !== null && !Array.isArray(value) && 'format' in value ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'format')) : value;
  const read = readValues(bare);
  return read.ok ? read.values : null;
}
function safeJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** What a stored file is, by its first bytes. */
export function kindOfBytes(bytes: Uint8Array): 'png' | 'jpeg' | 'pdf' | 'svg' | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpeg';
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'pdf';
  const head = new TextDecoder().decode(bytes.slice(0, 512)).trimStart();
  return head.startsWith('<') && /<svg[\s>]/.test(new TextDecoder().decode(bytes.slice(0, 4096))) ? 'svg' : null;
}

/** A design's own files that pictures are drawn from, by column, read from the design's row. */
export const FILE_COLUMNS = ['logo_file', 'photo_file'] as const;

export interface Made {
  name: string;
  about: string;
  layers: string[] | null;
  kind: 'print' | 'machine';
  blob: Blob;
  /**
   * The customer's files a part on this file shows that the file cannot
   * carry, by column: a logo or a photo sent as a picture or a PDF has no
   * lines a laser can follow, so the file leaves it out and the shop engraves
   * it from the customer's own file. Empty for a print file, which carries
   * every picture.
   */
  leftOut: string[];
}

/** What the shop's words say about what is made, in its language. */
export interface MakeWords {
  /** A side's name: "Front", "Back". */
  side: (side: 'front' | 'back') => string;
  /** "111 × 81 mm page · trim 85 × 55 · 3 mm bleed · crop marks". */
  printAbout: (size: { page: string; trim: string; bleed: string }) => string;
  /** "Shop sign · 110 × 40 mm", a piece's file. */
  pieceAbout: (name: string, size: string) => string;
  proof: { title: string; spec: string; note: string };
  /** The same words in English, printed where the shop's font has no letters for its language. */
  english?: Omit<MakeWords, 'english'>;
  /** The line at the foot of a print file. */
  slug: (side: string) => string;
}

/** The catalogue a version is drawn from: the shop's rows for its base. */
export function catalogueFor(rows: CatalogueRows, baseId: string | number): Catalogue | null {
  return readCatalogue(rows, baseId);
}

/** Files named for the design and its version: `design-91-v2-front-print.pdf`. Never the design's code, which is its key. */
export const fileStem = (designId: string | number, version: number): string => `design-${String(designId)}-v${String(version)}`;
const slug = (text: string): string => text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'piece';

/**
 * The shop's fonts, read from their files once each and set at each weight
 * asked. A starter font with no file of its own yet is read from the file
 * this package ships for it, so a fresh install makes its files with no
 * set-up first.
 */
export function fontBook(
  catalogue: Catalogue,
  read: (file: unknown) => Promise<Uint8Array | null> = fileBytes,
  starter: (family: string) => Promise<Uint8Array | null> = starterBytes,
): { load: (families: Iterable<string>) => Promise<void>; font: (family: string, weight: number) => Font | null } {
  const bytes = new Map<string, Uint8Array | null>();
  const made = new Map<string, Font | null>();
  return {
    async load(families) {
      for (const family of families) {
        if (bytes.has(family)) continue;
        const row = catalogue.fonts.find((one) => one.family === family);
        const own = row === undefined ? null : await read(row.row['file']);
        bytes.set(family, own ?? (row !== undefined && yes(row.row['starter'] as DataValue | undefined) ? await starter(family) : null));
      }
    },
    font(family, weight) {
      const key = `${family}@${String(weight)}`;
      if (!made.has(key)) {
        const file = bytes.get(family) ?? null;
        made.set(key, file === null ? null : fontAt(file, weight));
      }
      return made.get(key) ?? null;
    },
  };
}

/** The design's own pictures, read from its files: for the PDFs and the laser's files. */
export async function picturesOf(design: DataRow, read: (file: unknown) => Promise<Uint8Array | null> = fileBytes): Promise<{ pdf: Record<string, PdfPicture>; svg: Record<string, ReadSvg> }> {
  const pdf: Record<string, PdfPicture> = {};
  const svg: Record<string, ReadSvg> = {};
  for (const column of FILE_COLUMNS) {
    const bytes = await read(design[column]);
    if (bytes === null) continue;
    const kind = kindOfBytes(bytes);
    if (kind === 'svg') {
      const drawing = readSvg(new TextDecoder().decode(bytes));
      if (drawing !== null) {
        pdf[column] = { kind: 'svg', svg: drawing };
        svg[column] = drawing;
      }
    } else if (kind === 'png' || kind === 'jpeg') pdf[column] = { kind, bytes };
    else if (kind === 'pdf') pdf[column] = { kind: 'pdf', bytes };
  }
  return { pdf, svg };
}

/** The sheets of a version, every side it is made with, nothing empty on them. */
export function sheetsFor(catalogue: Catalogue, data: DesignData, holds: (column: string) => boolean): FlatSheet[] {
  return sheetsOf(catalogue, data, { empty: 'hide', labels: NO_LABELS, holds });
}

/** A kit's design on one of its pieces alone, as made: the parts cut on it, at its size. */
export const pieceSheetFor =
  (catalogue: Catalogue, data: DesignData, holds: (column: string) => boolean) =>
  (on: FlatOn): FlatSheet =>
    flatSheet(catalogue, data, { on, empty: 'hide', labels: NO_LABELS, holds });

/** A page's print files, one a side. */
export async function makePrintFiles(sheets: readonly FlatSheet[], assets: PdfAssets, stem: string, words: MakeWords, slugFont: Font | null): Promise<Made[]> {
  const out: Made[] = [];
  for (const sheet of sheets) {
    const bytes = await printPdf(sheet, assets, { font: slugFont, text: words.slug(words.side(sheet.side)) });
    out.push({ name: `${stem}-${sheet.side}-print.pdf`, about: words.printAbout(printSize(sheet.face)), layers: null, kind: 'print', blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }), leftOut: [] });
  }
  return out;
}

/** A page's proof: one A4 PDF of every side. */
export async function makePageProof(sheets: readonly FlatSheet[], assets: PdfAssets, words: MakeWords, labelFont: Font | null): Promise<Blob> {
  const en = words.english ?? words;
  const bytes = await proofPdf(sheets, assets, { ...words.proof, sides: { front: words.side('front'), back: words.side('back') }, english: { ...en.proof, sides: { front: en.side('front'), back: en.side('back') } } }, labelFont);
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

/** A one-colour picture of a sheet: its own key, the file it is made from, and the line and the ink it is made at. */
export interface LaserPicture {
  key: string;
  column: string;
  threshold: number;
  ink: string;
}

/**
 * The sheet with each one-colour picture painted from a picture of its own,
 * the customer's file as the laser makes it: at the line they set, or the
 * shop's starting line where they set none. Every other item is as it was.
 */
export function laserSheet(sheet: FlatSheet, startThreshold: number): { sheet: FlatSheet; laser: LaserPicture[] } {
  const laser: LaserPicture[] = [];
  const items = sheet.items.map((item) => {
    if (item.kind !== 'picture' || !item.oneColour) return item;
    const key = `one-colour:${item.key}`;
    laser.push({ key, column: item.column, threshold: item.threshold ?? startThreshold, ink: item.colour });
    return { ...item, column: key };
  });
  return { sheet: { ...sheet, items }, laser };
}

/**
 * A piece's proof: the piece as it will be made, painted at 1440 pixels
 * across with a margin. A logo set to one colour is shown as the laser cuts
 * it, never as uploaded: the customer approves what is made.
 */
export async function makePieceProof(sheet: FlatSheet, design: DataRow, startThreshold = 50): Promise<Blob | null> {
  const painted: Record<string, Painted> = {};
  for (const column of FILE_COLUMNS) {
    const picture = await filePicture(design[column]);
    if (picture !== null) painted[column] = picture;
  }
  const made = laserSheet(sheet, startThreshold);
  for (const one of made.laser) {
    const source = painted[one.column];
    if (source === undefined) continue;
    const canvas = oneColourCanvas(source.image, source.width, source.height, one.threshold, one.ink);
    // A page that cannot draw the laser's picture cannot paint the proof either: nothing is made in full colour instead.
    if (canvas === null) return null;
    painted[one.key] = { image: canvas, width: source.width, height: source.height };
  }
  return await sheetPng(made.sheet, 1440, painted, 40);
}

const mmSize = (w: number, h: number): string => `${String(Math.round(w * 10) / 10)} × ${String(Math.round(h * 10) / 10)} mm`;

/**
 * A piece's or a kit's files for the laser. A flat piece is one file, cut
 * from its outline. A kit is a file a piece, each cut from that piece's own
 * outline and engraved with the parts the design puts on that piece.
 */
export async function makeLaserFiles(catalogue: Catalogue, sheet: FlatSheet, font: (family: string, weight: number) => Font | null, logos: Readonly<Record<string, ReadSvg>>, stem: string, words: MakeWords, read: (file: unknown) => Promise<Uint8Array | null> = fileBytes, pieceSheet?: (on: FlatOn) => FlatSheet): Promise<Made[]> {
  // A kit's design is laid out on each piece at the piece's own size: the file for a piece is drawn from its own sheet.
  const kit = catalogue.base.kind === 'kit' && pieceSheet !== undefined ? kitPieces(catalogue).map((piece) => ({ piece, sheet: pieceSheet(onPiece(piece)) })) : null;
  const missing = missingFonts(kit === null ? [sheet] : kit.map((one) => one.sheet), { font });
  if (missing.length > 0) throw new FontMissing(missing);
  let parts = engravedOf(sheet);
  const outlineOf = async (file: unknown): Promise<ReadSvg | null> => {
    const bytes = await read(file);
    return bytes === null ? null : readSvg(new TextDecoder().decode(bytes));
  };
  const fileOf = async (name: string, width: number, height: number, corner: number, outline: ReadSvg | null, codes: ReadonlySet<string> | null): Promise<Made> => {
    const on = <T extends { code: string }>(list: readonly T[]): T[] => (codes === null ? [...list] : list.filter((one) => codes.has(one.code)));
    const wordPaths = on(parts.words).flatMap((item) => textPaths(item, font(item.font, item.weight)!));
    const drawn = on(parts.pictures).flatMap((item) => (logos[item.column] === undefined ? [] : [{ item, svg: logos[item.column]! }]));
    // A picture with no drawing behind it (a PNG, a JPEG or a PDF) is not in the file: said beside it, never dropped in silence.
    const leftOut = [...new Set(on(parts.pictures).flatMap((item) => (logos[item.column] === undefined ? [item.column] : [])))];
    const input = { width, height, corner, outline, words: wordPaths, logos: drawn, lines: on(parts.lines) };
    return { name, about: words.pieceAbout(name, mmSize(width, height)), layers: layersOf(input), kind: 'machine', blob: new Blob([pieceSvg(input)], { type: 'image/svg+xml' }), leftOut };
  };
  const base = catalogue.base;
  if (kit !== null) {
    const out: Made[] = [];
    for (const { piece, sheet: own } of kit) {
      parts = engravedOf(own);
      const name = `${stem}-${piece.code || piece.id}-${slug(piece.name)}.svg`;
      const made = await fileOf(name, piece.width, piece.height, 0, await outlineOf(piece.file), null);
      out.push({ ...made, about: words.pieceAbout(piece.name, mmSize(piece.width, piece.height)) });
    }
    return out;
  }
  if (base.kind === 'kit') {
    // Which piece each part of the design is on, as its ready-made design or the base's areas say.
    const pieceOf = new Map<string, string>();
    for (const row of [...(catalogue.ready.flatMap((one) => one.rows)), ...catalogue.rows.areas]) if (row['piece_id'] !== null && row['piece_id'] !== undefined) pieceOf.set(String(row['code']), String(row['piece_id']));
    const pieces = [...catalogue.rows.pieces].sort((a, b) => Number(a['position'] ?? 0) - Number(b['position'] ?? 0));
    const out: Made[] = [];
    for (const piece of pieces) {
      const codes = new Set([...pieceOf].filter(([, id]) => id === String(piece['id'])).map(([code]) => code));
      const name = `${stem}-${String(piece['code'] ?? piece['id'])}-${slug(String(piece['name'] ?? ''))}.svg`;
      const made = await fileOf(name, Number(piece['width_mm'] ?? 0), Number(piece['height_mm'] ?? 0), 0, await outlineOf(piece['file']), codes);
      out.push({ ...made, about: words.pieceAbout(String(piece['name'] ?? ''), mmSize(Number(piece['width_mm'] ?? 0), Number(piece['height_mm'] ?? 0))) });
    }
    return out;
  }
  const made = await fileOf(`${stem}-${slug(base.name)}.svg`, base.width, base.height, base.corner, await outlineOf(base.row['outline_file']), null);
  return [{ ...made, about: words.pieceAbout(base.name, mmSize(base.width, base.height)) }];
}
