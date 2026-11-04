/**
 * A PRINTED PAGE'S PDF FILES: the print file of each side, and the proof.
 *
 * - **The print file** (one a side): the page at its trim with its bleed all
 *   round and ten millimetres of margin beyond, crop marks at the corners
 *   from a millimetre outside the bleed, and the trim and bleed boxes set,
 *   so the press imposes it as it is. "111 × 81 mm page" for a business card.
 * - **The proof**: an A4 page of every side, drawn larger, with the trim in
 *   red, the bleed tinted and the safe line dashed in blue, as the
 *   customer's proof shows it, and a line saying what those lines are.
 *
 * Every word is drawn as the outlines of its font (`outline.ts`), so the
 * press needs no fonts; a logo stays a drawing (an SVG's shapes, a PDF's
 * first page), a photo goes in whole at its own resolution. Made from the
 * flat sheet, so it is what the customer saw.
 */
import { clip, concatTransformationMatrix, endPath, PDFDocument, popGraphicsState, pushGraphicsState, rectangle, rgb, type PDFPage } from 'pdf-lib';

import { fitted } from './canvas.ts';
import type { FlatItem, FlatSheet } from './flat.ts';
import { linePath, missingIn, textPaths, type Font } from './outline.ts';
import { frameInto, times, type Matrix, type ReadSvg } from './svgread.ts';

/** Points in a millimetre. */
export const MM = 72 / 25.4;
/** The print file's margin round the bleed, in millimetres, where the crop marks are. */
export const PRINT_MARGIN = 10;
/** A4, in points. */
export const A4 = { w: 595.28, h: 841.89 } as const;

/** A customer's picture, ready to go into a PDF, by what it is. */
export type PdfPicture = { kind: 'png' | 'jpeg'; bytes: Uint8Array } | { kind: 'pdf'; bytes: Uint8Array } | { kind: 'svg'; svg: ReadSvg };

export interface PdfAssets {
  /** The font a family is set in at a weight; none where the shop has no file for it. */
  font: (family: string, weight: number) => Font | null;
  pictures: Readonly<Record<string, PdfPicture>>;
}

/** A family the sheets set words in that has no font file: a file cannot be made without it. */
export class FontMissing extends Error {
  readonly families: readonly string[];
  constructor(families: readonly string[]) {
    super(`No font file for ${families.join(', ')}`);
    this.families = families;
  }
}

/** The families the sheets set words in that the assets have no font for. */
export function missingFonts(sheets: readonly FlatSheet[], assets: Pick<PdfAssets, 'font'>): string[] {
  const out = new Set<string>();
  for (const sheet of sheets) for (const item of sheet.items) if (item.kind === 'text' && assets.font(item.font, item.weight) === null) out.add(item.font);
  return [...out];
}

const colour = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);
  return rgb(r ?? 0, g ?? 0, b ?? 0);
};

/** Where a sheet is drawn on a page: its trim's top-left, in points from the page's bottom-left, and points a millimetre. */
interface Place {
  x: number;
  top: number;
  k: number;
}
const at = (place: Place, x: number, y: number): { x: number; y: number } => ({ x: place.x + x * place.k, y: place.top - y * place.k });

/** A box of the sheet as a PDF rectangle. */
const rectOf = (place: Place, box: { x: number; y: number; w: number; h: number }) => {
  const corner = at(place, box.x, box.y + box.h);
  return { x: corner.x, y: corner.y, width: box.w * place.k, height: box.h * place.k };
};

/** The matrix that draws a shape of the sheet (millimetres, y down) moved by `m` through `drawSvgPath`, which flips y itself. */
const sheetMatrix = (place: Place, m: Matrix): Matrix => times(times([place.k, 0, 0, -place.k, place.x, place.top], m), [1, 0, 0, -1, 0, 0]);

async function drawItem(doc: PDFDocument, page: PDFPage, item: FlatItem, place: Place, assets: PdfAssets): Promise<void> {
  if (item.kind === 'text') {
    const font = assets.font(item.font, item.weight);
    if (font === null) throw new FontMissing([item.font]);
    for (const d of textPaths(item, font)) page.drawSvgPath(d, { x: place.x, y: place.top, scale: place.k, color: colour(item.colour) });
    return;
  }
  if (item.kind === 'shape') {
    const box = rectOf(place, item.box);
    const paint = { ...(item.fill === null ? {} : { color: colour(item.fill) }), ...(item.stroke === null ? {} : { borderColor: colour(item.stroke), borderWidth: item.line * place.k }) };
    if (item.shape === 'ellipse') page.drawEllipse({ x: box.x + box.width / 2, y: box.y + box.height / 2, xScale: box.width / 2, yScale: box.height / 2, ...paint });
    else page.drawRectangle({ ...box, ...paint });
    return;
  }
  if (item.kind !== 'picture') return; // An empty logo box and a motif's name are never printed.
  const picture = assets.pictures[item.column];
  if (picture === undefined) return;
  page.pushOperators(pushGraphicsState());
  if (item.fill) {
    const box = rectOf(place, item.box);
    page.pushOperators(rectangle(box.x, box.y, box.width, box.height), clip(), endPath());
  }
  if (picture.kind === 'svg') {
    const frame = frameInto(picture.svg.view, item.drawn, item.fill ? 'slice' : 'meet');
    for (const shape of picture.svg.shapes) {
      if (shape.fill === null && shape.stroke === null) continue;
      page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...sheetMatrix(place, times(frame, shape.matrix))));
      page.drawSvgPath(shape.d, { x: 0, y: 0, ...(shape.fill === null ? {} : { color: colour(shape.fill) }), ...(shape.stroke === null ? {} : { borderColor: colour(shape.stroke), borderWidth: shape.strokeWidth }) });
      page.pushOperators(popGraphicsState());
    }
  } else if (picture.kind === 'pdf') {
    const [first] = await doc.embedPdf(picture.bytes, [0]);
    if (first !== undefined) {
      const box = fitted({ width: first.width, height: first.height }, item.drawn, item.fill);
      page.drawPage(first, rectOf(place, box));
    }
  } else {
    const image = picture.kind === 'png' ? await doc.embedPng(picture.bytes) : await doc.embedJpg(picture.bytes);
    const box = fitted({ width: image.width, height: image.height }, item.drawn, item.fill);
    page.drawImage(image, rectOf(place, box));
  }
  page.pushOperators(popGraphicsState());
}

/** The sheet drawn on a page: its paper across the bleed, every part, cut to the bleed. */
async function drawSheet(doc: PDFDocument, page: PDFPage, sheet: FlatSheet, place: Place, assets: PdfAssets): Promise<void> {
  const { face } = sheet;
  const bleed = { x: -face.bleed, y: -face.bleed, w: face.width + 2 * face.bleed, h: face.height + 2 * face.bleed };
  const box = rectOf(place, bleed);
  page.pushOperators(pushGraphicsState(), rectangle(box.x, box.y, box.width, box.height), clip(), endPath());
  page.drawRectangle({ ...box, color: colour(face.colour) });
  for (const item of sheet.items) await drawItem(doc, page, item, place, assets);
  page.pushOperators(popGraphicsState());
}

/** A line of the page's own words, as outlines, at a size in points, its baseline `y` from the page's bottom. */
function label(page: PDFPage, font: Font | null, said: string | readonly [string, string], x: number, y: number, sizePt: number, hex = '#191920'): void {
  if (font === null) return;
  // In the shop's language where its font has every letter of it, else in English.
  const text = typeof said === 'string' ? said : missingIn(font, said[0]).length === 0 ? said[0] : said[1];
  if (text === '' || missingIn(font, text).length > 0) return;
  // Set in millimetres (y down) from the page's top-left, then drawn at the page's points.
  const { d } = linePath(font, text, 0, 0, sizePt / MM, 'start');
  if (d !== '') page.drawSvgPath(d, { x, y, scale: MM, color: colour(hex) });
}

const fixedMm = (value: number): string => String(Math.round(value * 100) / 100);

/** One side's print file: trim with bleed, ten millimetres round it, crop marks, its boxes set. */
export async function printPdf(sheet: FlatSheet, assets: PdfAssets, slug: { font: Font | null; text: string }): Promise<Uint8Array> {
  const { face } = sheet;
  const missing = missingFonts([sheet], assets);
  if (missing.length > 0) throw new FontMissing(missing);
  const doc = await PDFDocument.create();
  const edge = face.bleed + PRINT_MARGIN;
  const page = doc.addPage([(face.width + 2 * edge) * MM, (face.height + 2 * edge) * MM]);
  const place: Place = { x: edge * MM, top: page.getHeight() - edge * MM, k: MM };
  page.setTrimBox(edge * MM, edge * MM, face.width * MM, face.height * MM);
  page.setBleedBox(PRINT_MARGIN * MM, PRINT_MARGIN * MM, (face.width + 2 * face.bleed) * MM, (face.height + 2 * face.bleed) * MM);
  await drawSheet(doc, page, sheet, place, assets);
  // Crop marks: from a millimetre outside the bleed to a millimetre short of the page's edge, in line with the trim.
  const black = rgb(0, 0, 0);
  for (const [cx, cy] of [
    [0, 0],
    [face.width, 0],
    [0, face.height],
    [face.width, face.height],
  ] as const) {
    const dx = cx === 0 ? -1 : 1;
    const dy = cy === 0 ? -1 : 1;
    page.drawLine({ start: at(place, cx + dx * (face.bleed + 1), cy), end: at(place, cx + dx * (edge - 1), cy), thickness: 0.25, color: black });
    page.drawLine({ start: at(place, cx, cy + dy * (face.bleed + 1)), end: at(place, cx, cy + dy * (edge - 1)), thickness: 0.25, color: black });
  }
  label(page, slug.font, slug.text, PRINT_MARGIN * MM, 4 * MM, 5, '#000000');
  doc.setTitle(slug.text);
  doc.setCreator('Customiser');
  return await doc.save();
}

/** The words a proof's page says, in the shop's language. */
export interface ProofWords {
  title: string;
  spec: string;
  sides: Readonly<Record<'front' | 'back', string>>;
  note: string;
  /** The same in English: what is printed where the font has no letters for the shop's language. */
  english?: Omit<ProofWords, 'english'>;
}

/** The proof: every side on one A4 page, larger, with the trim, bleed and safe line drawn. */
export async function proofPdf(sheets: readonly FlatSheet[], assets: PdfAssets, words: ProofWords, font: Font | null): Promise<Uint8Array> {
  const missing = missingFonts(sheets, assets);
  if (missing.length > 0) throw new FontMissing(missing);
  const doc = await PDFDocument.create();
  const page = doc.addPage([A4.w, A4.h]);
  const left = 56;
  const en = words.english ?? words;
  label(page, font, [words.title, en.title], left, A4.h - 56, 15);
  label(page, font, [words.spec, en.spec], left, A4.h - 74, 9.5, '#4a4a54');
  let top = A4.h - 112;
  for (const sheet of sheets) {
    const { face } = sheet;
    // As large as fits the page across, at most 160 % of its size.
    const k = Math.min(1.6 * MM, (A4.w - 2 * left) / (face.width + 2 * face.bleed), (A4.h - 220) / sheets.length / (face.height + 2 * face.bleed));
    label(page, font, [words.sides[sheet.side], en.sides[sheet.side]], left, top + 4, 10.5);
    const place: Place = { x: left + face.bleed * k, top: top - 12 - face.bleed * k, k };
    await drawSheet(doc, page, sheet, place, assets);
    const bleed = rectOf(place, { x: -face.bleed, y: -face.bleed, w: face.width + 2 * face.bleed, h: face.height + 2 * face.bleed });
    const trim = rectOf(place, { x: 0, y: 0, w: face.width, h: face.height });
    // The bleed tinted, the trim in red, the safe line dashed in blue: the customer's proof's own lines.
    const red = colour('#cf273c');
    page.drawRectangle({ ...bleed, color: red, opacity: 0.16 });
    page.drawRectangle({ ...trim, borderColor: red, borderWidth: 0.8 });
    if (face.safe !== null && face.safe > 0) page.drawRectangle({ ...rectOf(place, { x: face.safe, y: face.safe, w: face.width - 2 * face.safe, h: face.height - 2 * face.safe }), borderColor: colour('#1c59e0'), borderWidth: 0.8, borderDashArray: [3, 2.4] });
    top -= 12 + bleed.height + 34;
  }
  label(page, font, [words.note, en.note], left, 60, 9, '#4a4a54');
  doc.setTitle(words.title);
  doc.setCreator('Customiser');
  return await doc.save();
}

/** What a print file says about itself: "111 × 81 mm page · trim 85 × 55 · 3 mm bleed". */
export function printSize(face: FlatSheet['face']): { page: string; trim: string; bleed: string } {
  const edge = face.bleed + PRINT_MARGIN;
  return { page: `${fixedMm(face.width + 2 * edge)} × ${fixedMm(face.height + 2 * edge)}`, trim: `${fixedMm(face.width)} × ${fixedMm(face.height)}`, bleed: fixedMm(face.bleed) };
}
