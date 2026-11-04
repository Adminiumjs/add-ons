/**
 * THE SHEET PAINTED, HELD TO THE SHEET.
 *
 * A preview picture and a piece's proof picture are the flat sheet painted on
 * a canvas. Painted through a recording pen, every word lands on the sheet's
 * own baseline and anchor at the picture's scale, a picture sits inside or
 * fills its box, and the face is painted in its own colour.
 */
import { describe, expect, it } from 'vitest';

import { fitted, paintSheet, pixelsPerMm, type Pen } from './canvas.ts';
import type { FlatSheet } from './flat.ts';

/** A pen that keeps what it was asked to paint. */
function recorder(): Pen & { calls: { call: string; args: unknown[]; fill: unknown; font: string; align: string }[] } {
  const calls: { call: string; args: unknown[]; fill: unknown; font: string; align: string }[] = [];
  const pen = {
    fillStyle: '' as Pen['fillStyle'],
    strokeStyle: '' as Pen['strokeStyle'],
    lineWidth: 1,
    globalAlpha: 1,
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    calls,
  } as Pen & { calls: typeof calls };
  for (const call of ['save', 'restore', 'beginPath', 'closePath', 'rect', 'roundRect', 'ellipse', 'fill', 'stroke', 'clip', 'fillRect', 'fillText', 'setLineDash', 'drawImage'] as const) {
    (pen as unknown as Record<string, unknown>)[call] = (...args: unknown[]) => calls.push({ call, args, fill: pen.fillStyle, font: pen.font, align: pen.textAlign });
  }
  return pen;
}

const SHEET: FlatSheet = {
  side: 'front',
  face: { kind: 'page', width: 85, height: 55, corner: 0, bleed: 3, safe: 4, colour: '#f6efe2', edge: '#d0d0d6' },
  items: [
    { kind: 'text', key: 'name-front', code: 'name', box: { x: 6, y: 8, w: 50, h: 6 }, live: true, locked: false, lines: [{ text: 'Nell Fairweather', x: 6, y: 12.92 }], anchor: 'start', font: 'Manrope', sizeMm: 6, weight: 700, colour: '#1f2a44', dim: false },
    { kind: 'picture', key: 'logo-front', code: 'logo', box: { x: 60, y: 8, w: 20, h: 20 }, live: true, locked: false, column: 'logo_file', drawn: { x: 60, y: 8, w: 20, h: 20 }, fill: false, oneColour: false, colour: '#000000', picture: 'logo' },
  ],
};

describe('a sheet painted', () => {
  it('paints the face in its colour, each word on its baseline at the scale, and the logo inside its box', () => {
    const pen = recorder();
    const image = {} as CanvasImageSource;
    paintSheet(pen, SHEET, 10, { logo_file: { image, width: 200, height: 100 } });
    const face = pen.calls.find((one) => one.call === 'fill');
    expect(face?.fill).toBe('#f6efe2');
    const words = pen.calls.find((one) => one.call === 'fillText');
    expect(words).toMatchObject({ args: ['Nell Fairweather', 60, 129.2], fill: '#1f2a44', align: 'left' });
    expect(words!.font).toContain('700 60px "Manrope"');
    // A picture twice as wide as high, inside a square box: as wide as the box, half as high, in its middle.
    expect(pen.calls.find((one) => one.call === 'drawImage')?.args).toEqual([image, 600, 130, 200, 100]);
  });

  it('fills a box with a picture by cutting it to the box', () => {
    expect(fitted({ width: 200, height: 100 }, { x: 0, y: 0, w: 10, h: 10 }, true)).toEqual({ x: -5, y: 0, w: 20, h: 10 });
    expect(fitted({ width: 100, height: 200 }, { x: 0, y: 0, w: 10, h: 10 }, false)).toEqual({ x: 2.5, y: 0, w: 5, h: 10 });
  });

  it('is sized so its longest side is the pixels asked, never more than 12 a millimetre', () => {
    expect(pixelsPerMm(SHEET, 850)).toBe(10);
    expect(pixelsPerMm(SHEET, 5000)).toBe(12);
  });
});
