/**
 * A FLAT SHEET PAINTED AS A PICTURE: the ready-made design's preview picture
 * and the proof picture of a piece.
 *
 * The same sheet the editor draws, painted onto a canvas in the browser that
 * makes it: the shop's words in the shop's fonts (loaded into the page
 * first), a customer's logo from its file, every part where the sheet puts
 * it. A page is painted as printed (trimmed); a piece with its edge.
 *
 * Painted through a plain drawing context, so a test can hold what is
 * painted to the sheet without a canvas.
 */
import { cssFamily } from '../browser/ui/fonts.ts';
import type { FlatItem, FlatSheet } from './flat.ts';

/** The calls of a canvas's 2D context this paints with. */
export interface Pen {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  globalAlpha: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  save(): void;
  restore(): void;
  beginPath(): void;
  closePath(): void;
  rect(x: number, y: number, w: number, h: number): void;
  roundRect(x: number, y: number, w: number, h: number, radii?: number): void;
  ellipse(x: number, y: number, rx: number, ry: number, rotation: number, start: number, end: number): void;
  fill(): void;
  stroke(): void;
  clip(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  setLineDash(segments: number[]): void;
  drawImage(image: CanvasImageSource, x: number, y: number, w: number, h: number): void;
}

/** A picture ready to paint, with its own size (for fitting it in its box). */
export interface Painted {
  image: CanvasImageSource;
  width: number;
  height: number;
}

/** How many pixels a millimetre takes, so the longer side is at most `longest` pixels (and at most 12 a millimetre). */
export const pixelsPerMm = (sheet: FlatSheet, longest: number): number => Math.min(12, longest / Math.max(sheet.face.width, sheet.face.height));

/** A canvas's own coordinates: the drawing is the thing made, always left to right, whatever the page's direction. */
const ALIGN: Readonly<Record<'start' | 'middle' | 'end', CanvasTextAlign>> = { start: 'left', middle: 'center', end: 'right' };

/** The box a picture takes inside its frame: inside it whole, or filling it (cut by the frame). */
export function fitted(picture: { width: number; height: number }, frame: { x: number; y: number; w: number; h: number }, fill: boolean): { x: number; y: number; w: number; h: number } {
  const ratio = picture.width > 0 && picture.height > 0 ? picture.width / picture.height : 1;
  const wide = frame.w / frame.h < ratio;
  const w = fill === wide ? frame.h * ratio : frame.w;
  const h = fill === wide ? frame.h : frame.w / ratio;
  return { x: frame.x + (frame.w - w) / 2, y: frame.y + (frame.h - h) / 2, w, h };
}

/** Paints the sheet at `k` pixels a millimetre, from the top-left of the face. */
export function paintSheet(pen: Pen, sheet: FlatSheet, k: number, pictures: Readonly<Record<string, Painted>> = {}): void {
  const { face } = sheet;
  const [w, h] = [face.width * k, face.height * k];
  pen.save();
  pen.beginPath();
  if (face.kind === 'page') pen.rect(0, 0, w, h);
  else pen.roundRect(0, 0, w, h, face.corner * k);
  pen.fillStyle = face.colour;
  pen.fill();
  pen.clip();
  for (const item of sheet.items) paintItem(pen, item, k, pictures);
  pen.restore();
  if (face.kind === 'piece') {
    pen.beginPath();
    pen.roundRect(0, 0, w, h, face.corner * k);
    pen.strokeStyle = face.edge;
    pen.lineWidth = Math.max(1, 0.6 * k);
    pen.stroke();
  }
}

function paintItem(pen: Pen, item: FlatItem, k: number, pictures: Readonly<Record<string, Painted>>): void {
  const box = { x: item.box.x * k, y: item.box.y * k, w: item.box.w * k, h: item.box.h * k };
  pen.save();
  if (item.kind === 'text') {
    pen.globalAlpha = item.dim ? 0.4 : 1;
    pen.font = `${String(item.weight)} ${String(item.sizeMm * k)}px ${cssFamily(item.font)}`;
    pen.fillStyle = item.colour;
    pen.textAlign = ALIGN[item.anchor];
    pen.textBaseline = 'alphabetic';
    for (const line of item.lines) pen.fillText(line.text, line.x * k, line.y * k);
  } else if (item.kind === 'slot') {
    const ink = item.page ? '#3a3a44' : '#2a2018';
    pen.setLineDash([1.2 * k, 0.9 * k]);
    pen.strokeStyle = ink;
    pen.globalAlpha = 0.5;
    pen.lineWidth = 0.35 * k;
    pen.beginPath();
    pen.rect(box.x, box.y, box.w, box.h);
    pen.stroke();
    pen.setLineDash([]);
    pen.globalAlpha = 0.75;
    pen.fillStyle = ink;
    pen.font = `600 ${String(Math.max(1.6, Math.min(item.box.h * 0.16, 3.4)) * k)}px ${cssFamily('Manrope')}`;
    pen.textAlign = 'center';
    pen.textBaseline = 'middle';
    pen.fillText(item.label, box.x + box.w / 2, box.y + box.h / 2);
  } else if (item.kind === 'picture') {
    const picture = pictures[item.column];
    if (picture !== undefined) {
      const frame = { x: item.drawn.x * k, y: item.drawn.y * k, w: item.drawn.w * k, h: item.drawn.h * k };
      if (item.fill) {
        pen.beginPath();
        pen.rect(box.x, box.y, box.w, box.h);
        pen.clip();
      }
      const at = fitted(picture, frame, item.fill);
      pen.drawImage(picture.image, at.x, at.y, at.w, at.h);
    }
  } else if (item.kind === 'choice') {
    pen.strokeStyle = item.colour;
    pen.lineWidth = 0.8 * k;
    pen.beginPath();
    pen.roundRect(box.x + box.w * 0.2, box.y + box.h * 0.2, box.w * 0.6, box.h * 0.6, Math.min(box.w, box.h) * 0.12);
    pen.stroke();
    pen.fillStyle = item.colour;
    pen.font = `400 ${String(Math.min(item.box.h * 0.14, 4) * k)}px ${cssFamily('Manrope')}`;
    pen.textAlign = 'center';
    pen.textBaseline = 'middle';
    pen.fillText(item.label, box.x + box.w / 2, box.y + box.h / 2);
  } else {
    pen.lineWidth = item.line * k;
    const outline = (x: number, y: number, bw: number, bh: number): void => {
      pen.beginPath();
      if (item.shape === 'ellipse') pen.ellipse(x + bw / 2, y + bh / 2, Math.max(0, bw / 2 - (item.line * k) / 2), Math.max(0, bh / 2 - (item.line * k) / 2), 0, 0, Math.PI * 2);
      else pen.rect(x, y, bw, bh);
      if (item.fill !== null) {
        pen.fillStyle = item.fill;
        pen.fill();
      }
      if (item.stroke !== null) {
        pen.strokeStyle = item.stroke;
        pen.stroke();
      }
    };
    outline(box.x, box.y, box.w, box.h);
    if (item.shape === 'door') {
      outline(box.x + box.w * 0.15, box.y + box.h * 0.1, box.w * 0.7, box.h * 0.35);
      outline(box.x + box.w * 0.15, box.y + box.h * 0.52, box.w * 0.7, box.h * 0.38);
    }
  }
  pen.restore();
}

/** The sheet as a PNG, painted in this page with the fonts it has loaded. Null where the page cannot paint. */
export async function sheetPng(sheet: FlatSheet, longest: number, pictures: Readonly<Record<string, Painted>> = {}, pad = 0): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const k = pixelsPerMm(sheet, longest);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sheet.face.width * k + pad * 2);
  canvas.height = Math.round(sheet.face.height * k + pad * 2);
  const context = canvas.getContext('2d');
  if (context === null) return null;
  context.translate(pad, pad);
  paintSheet(context as unknown as Pen, sheet, k, pictures);
  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}
