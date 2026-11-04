/**
 * WHAT THE BROWSER READS OF A CUSTOMER'S FILE: its kind from its bytes, a
 * PDF's page from its words, and the finest line a picture has once it is
 * made one colour — the figure the rules turn into "Some lines are too fine to
 * engrave".
 */
import { describe, expect, it } from 'vitest';

import { finestLine, lightnessOf, pdfPageSize, sniff, type Lightness } from './files.ts';

const bytes = (...parts: (string | number[])[]): Uint8Array => new Uint8Array(parts.flatMap((part) => (typeof part === 'string' ? [...part].map((char) => char.charCodeAt(0)) : part)));
/** A picture drawn by a rule: the lightness of each pixel. */
const picture = (width: number, height: number, at: (x: number, y: number) => number): Lightness => {
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) data[y * width + x] = at(x, y);
  return { data, width, height };
};

describe('a file’s kind, from its first bytes and never its name', () => {
  it('knows a PNG, a JPEG, a PDF and an SVG, however the SVG starts', () => {
    expect(sniff(bytes([0x89], 'PNG', [0x0d, 0x0a, 0x1a, 0x0a]))).toBe('png');
    expect(sniff(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg');
    expect(sniff(bytes('%PDF-1.7\n'))).toBe('pdf');
    for (const svg of ['<svg xmlns="http://www.w3.org/2000/svg"/>', '<svg/>', '﻿<?xml version="1.0"?>\n<!-- made in a drawing app --><svg viewBox="0 0 10 10">', '<!DOCTYPE svg><svg>']) expect(sniff(new TextEncoder().encode(svg)), svg).toBe('svg');
  });

  it('knows an iPhone’s photo (HEIC), and anything else is none of them', () => {
    expect(sniff(bytes([0, 0, 0, 24], 'ftypheic'))).toBe('heic');
    expect(sniff(bytes([0, 0, 0, 24], 'ftypmif1'))).toBe('heic');
    expect(sniff(bytes([0, 0, 0, 24], 'ftypisom'))).toBe('other');
    expect(sniff(bytes('just words, not a picture'))).toBe('other');
    expect(sniff(bytes('<html><svg></svg></html>'))).toBe('other');
    expect(sniff(bytes('GIF89a'))).toBe('other');
  });
});

describe('a PDF’s page', () => {
  it('is read from its own /MediaBox, in points', () => {
    expect(pdfPageSize('%PDF-1.4\n1 0 obj << /Type /Page /MediaBox [0 0 595.28 841.89] >>')).toEqual([595, 842]);
    expect(pdfPageSize('/MediaBox [ -10 -10 90 50 ]')).toEqual([100, 60]);
    expect(pdfPageSize('%PDF-1.4 nothing here')).toBeNull();
  });
});

describe('the finest line, once made one colour', () => {
  it('lays a see-through picture on white paper', () => {
    expect([...lightnessOf(new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 0, 255, 255, 255, 255, 0, 0, 0, 128]), 4, 1).data]).toEqual([0, 255, 255, 127]);
  });

  it('is nothing where nothing is dark', () => {
    expect(finestLine(picture(20, 20, () => 255), 50)).toBeUndefined();
  });

  it('is a solid shape’s own width: a 40 px square on 100 px is 0.4 of the picture across', () => {
    const square = picture(100, 100, (x, y) => (x >= 30 && x < 70 && y >= 30 && y < 70 ? 0 : 255));
    expect(finestLine(square, 50)).toBeCloseTo(0.4, 2);
  });

  it('finds fine shading where it is a twentieth of the ink, and drops it when the line moves past its tone', () => {
    // A bold block, and hatching of 1 px lines in a grey of 74 % (the comp's Old Mill art).
    const hatch = Math.round(0.74 * 255);
    const mill = picture(400, 200, (x, y) => (x < 150 && y < 150 ? 0 : x >= 200 && x % 4 === 0 ? hatch : 255));
    expect(finestLine(mill, 82)).toBeCloseTo(1 / 400, 4);
    expect(finestLine(mill, 60)).toBeCloseTo(150 / 400, 2);
  });

  it('reads a slanted line a little wider than it is, never finer: 5 px across a stroke 3.5 px wide at 45°', () => {
    const stroke = picture(120, 120, (x, y) => (Math.abs(x - y) <= 2 ? 0 : 255));
    const share = finestLine(stroke, 50)!;
    expect(share * 120).toBeGreaterThanOrEqual(5 / Math.SQRT2);
    expect(share * 120).toBeCloseTo(5, 5);
  });

  it('is not fooled by a speck: one stray pixel is not a line', () => {
    const specked = picture(100, 100, (x, y) => ((x >= 10 && x < 90 && y >= 10 && y < 90) || (x === 95 && y === 95) ? 0 : 255));
    expect(finestLine(specked, 50)).toBeCloseTo(0.8, 2);
  });
});
