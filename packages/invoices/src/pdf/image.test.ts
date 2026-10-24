/**
 * Pictures in, PDF image objects out.
 *
 * Every PNG here is built by the small encoder below rather than read from a
 * file, so each fixture says exactly what samples it holds, and the test can
 * say exactly what samples the PDF must carry. Rows are filtered in turn with
 * all five PNG filters (row n uses filter n mod 5), so a mistake in any one of
 * them shows up as wrong samples rather than as a picture that "looks fine".
 *
 * The JPEGs are real files: made with Pillow 12.1.1 (`Image.new` with a
 * gradient, `save('JPEG', quality=60)`, plus `progressive=True` for the SOF2
 * one) and pasted in as base64.
 */

import { crc32, deflateSync, inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { pdfImageOf, type PdfImage, type PictureInput } from './image.ts';

type Pixel = (x: number, y: number) => number[];

const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const ADAM7 = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2],
] as const;

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function filterRow(type: number, row: Uint8Array, prev: Uint8Array, bpp: number): number[] {
  const out: number[] = [];
  for (let at = 0; at < row.length; at += 1) {
    const a = at >= bpp ? row[at - bpp]! : 0;
    const b = prev[at]!;
    const c = at >= bpp ? prev[at - bpp]! : 0;
    const predicted = [0, a, b, (a + b) >> 1, paeth(a, b, c)][type]!;
    out.push((row[at]! - predicted) & 0xff);
  }
  return out;
}

function chunk(type: string, data: Uint8Array | number[]): number[] {
  const body = Uint8Array.from([...new TextEncoder().encode(type), ...data]);
  const length = body.length - 4;
  const crc = crc32(body);
  return [
    (length >>> 24) & 0xff, (length >>> 16) & 0xff, (length >>> 8) & 0xff, length & 0xff,
    ...body,
    (crc >>> 24) & 0xff, (crc >>> 16) & 0xff, (crc >>> 8) & 0xff, crc & 0xff,
  ];
}

interface PngSpec {
  readonly width: number;
  readonly height: number;
  readonly colorType: number;
  readonly bitDepth: number;
  readonly interlace?: boolean;
  readonly plte?: number[];
  readonly trns?: number[];
  readonly pixel: Pixel;
}

/** The filtered, uncompressed scanlines of a PNG. */
function scanlines(spec: PngSpec): Uint8Array {
  const channels = CHANNELS[spec.colorType]!;
  const bitsPerPixel = channels * spec.bitDepth;
  const bpp = Math.max(1, bitsPerPixel >> 3);
  const passes = spec.interlace === true ? ADAM7 : ([[0, 0, 1, 1]] as const);
  const raw: number[] = [];
  let rowNumber = 0;
  for (const [x0, y0, dx, dy] of passes) {
    const pw = Math.ceil((spec.width - x0) / dx);
    const ph = Math.ceil((spec.height - y0) / dy);
    if (pw <= 0 || ph <= 0) continue;
    const rowBytes = Math.ceil((pw * bitsPerPixel) / 8);
    let prev = new Uint8Array(rowBytes);
    for (let py = 0; py < ph; py += 1) {
      const row = new Uint8Array(rowBytes);
      for (let px = 0; px < pw; px += 1) {
        spec.pixel(x0 + px * dx, y0 + py * dy).forEach((value, channel) => {
          const bit = (px * channels + channel) * spec.bitDepth;
          if (spec.bitDepth === 16) {
            row[bit >> 3] = value >> 8;
            row[(bit >> 3) + 1] = value & 0xff;
          } else if (spec.bitDepth === 8) {
            row[bit >> 3] = value;
          } else {
            row[bit >> 3]! |= value << (8 - spec.bitDepth - (bit & 7));
          }
        });
      }
      const type = rowNumber % 5;
      rowNumber += 1;
      raw.push(type, ...filterRow(type, row, prev, bpp));
      prev = row;
    }
  }
  return Uint8Array.from(raw);
}

function encodePng(spec: PngSpec, idat = new Uint8Array(deflateSync(scanlines(spec)))): Uint8Array {
  const { width, height } = spec;
  const ihdr = [
    (width >>> 24) & 0xff, (width >>> 16) & 0xff, (width >>> 8) & 0xff, width & 0xff,
    (height >>> 24) & 0xff, (height >>> 16) & 0xff, (height >>> 8) & 0xff, height & 0xff,
    spec.bitDepth, spec.colorType, 0, 0, spec.interlace === true ? 1 : 0,
  ];
  // The image data split across two IDAT chunks, as real encoders do.
  const half = idat.length >> 1;
  return Uint8Array.from([
    137, 80, 78, 71, 13, 10, 26, 10,
    ...chunk('IHDR', ihdr),
    ...(spec.plte === undefined ? [] : chunk('PLTE', spec.plte)),
    ...(spec.trns === undefined ? [] : chunk('tRNS', spec.trns)),
    ...chunk('IDAT', idat.subarray(0, half)),
    ...chunk('IDAT', idat.subarray(half)),
    ...chunk('IEND', []),
  ]);
}

function asPicture(bytes: Uint8Array, mediaType = 'image/png'): PictureInput {
  return { mediaType, dataUrl: `data:${mediaType};base64,${Buffer.from(bytes).toString('base64')}`, width: 1, height: 1 };
}

/** What the PDF's colour and mask streams must hold, sample by sample. */
function expected(spec: PngSpec, colour: (samples: number[]) => number[], alpha: (samples: number[]) => number) {
  const colourOut: number[] = [];
  const alphaOut: number[] = [];
  for (let y = 0; y < spec.height; y += 1) {
    for (let x = 0; x < spec.width; x += 1) {
      const samples = spec.pixel(x, y);
      colourOut.push(...colour(samples));
      alphaOut.push(alpha(samples));
    }
  }
  return { colour: colourOut, alpha: alphaOut };
}

function streams(image: PdfImage): { colour: number[]; alpha: number[] | null } {
  return {
    colour: Array.from(inflateSync(image.data)),
    alpha: image.mask === null ? null : Array.from(inflateSync(image.mask.data)),
  };
}

const W = 13;
const H = 11;
const wave = (x: number, y: number, k: number, range: number) => (x * 37 + y * 91 + k * 53 + x * y * 7) % range;
/** A 16-bit sample whose high AND low bytes both vary, so taking the wrong byte shows. */
const wave16 = (x: number, y: number, k: number) => (wave(x, y, k, 256) << 8) | wave(x, y, k + 5, 256);

interface Case {
  readonly name: string;
  readonly spec: PngSpec;
  readonly space: string;
  readonly colour: (samples: number[]) => number[];
  readonly alpha: ((samples: number[]) => number) | null;
}

const PALETTE = Array.from({ length: 6 * 3 }, (_, at) => (at * 47) % 256);
const PALETTE_ALPHA = [0, 128, 255, 64];

const CASES: Case[] = [
  {
    name: 'RGBA 8-bit',
    spec: { width: W, height: H, colorType: 6, bitDepth: 8, pixel: (x, y) => [wave(x, y, 0, 256), wave(x, y, 1, 256), wave(x, y, 2, 256), x % 3 === 0 ? 0 : wave(x, y, 3, 256)] },
    space: '/DeviceRGB',
    colour: (s) => s.slice(0, 3),
    alpha: (s) => s[3]!,
  },
  {
    name: 'RGB 8-bit',
    spec: { width: W, height: H, colorType: 2, bitDepth: 8, pixel: (x, y) => [wave(x, y, 0, 256), wave(x, y, 1, 256), wave(x, y, 2, 256)] },
    space: '/DeviceRGB',
    colour: (s) => s,
    alpha: null,
  },
  {
    name: 'grey 8-bit',
    spec: { width: W, height: H, colorType: 0, bitDepth: 8, pixel: (x, y) => [wave(x, y, 0, 256)] },
    space: '/DeviceGray',
    colour: (s) => s,
    alpha: null,
  },
  {
    name: 'grey and alpha 8-bit',
    spec: { width: W, height: H, colorType: 4, bitDepth: 8, pixel: (x, y) => [wave(x, y, 0, 256), wave(x, y, 1, 256)] },
    space: '/DeviceGray',
    colour: (s) => [s[0]!],
    alpha: (s) => s[1]!,
  },
  {
    name: 'palette with tRNS, 4-bit',
    spec: { width: W, height: H, colorType: 3, bitDepth: 4, plte: PALETTE, trns: PALETTE_ALPHA, pixel: (x, y) => [wave(x, y, 0, 6)] },
    space: '/DeviceRGB',
    colour: (s) => PALETTE.slice(s[0]! * 3, s[0]! * 3 + 3),
    alpha: (s) => PALETTE_ALPHA[s[0]!] ?? 255,
  },
  {
    name: 'RGBA 16-bit',
    spec: { width: W, height: H, colorType: 6, bitDepth: 16, pixel: (x, y) => [wave16(x, y, 0), wave16(x, y, 1), wave16(x, y, 2), wave16(x, y, 3)] },
    space: '/DeviceRGB',
    colour: (s) => s.slice(0, 3).map((v) => v >> 8),
    alpha: (s) => s[3]! >> 8,
  },
  {
    name: '1-bit grey',
    spec: { width: W, height: H, colorType: 0, bitDepth: 1, pixel: (x, y) => [wave(x, y, 0, 2)] },
    space: '/DeviceGray',
    colour: (s) => [s[0]! * 255],
    alpha: null,
  },
  {
    name: '2-bit grey with a tRNS key',
    spec: { width: W, height: H, colorType: 0, bitDepth: 2, trns: [0, 2], pixel: (x, y) => [wave(x, y, 0, 4)] },
    space: '/DeviceGray',
    colour: (s) => [s[0]! * 85],
    alpha: (s) => (s[0] === 2 ? 0 : 255),
  },
  {
    name: 'RGB 16-bit with a tRNS key',
    spec: { width: W, height: H, colorType: 2, bitDepth: 16, trns: [0x01, 0x00, 0x02, 0x00, 0x03, 0x00], pixel: (x, y) => (x === y ? [0x100, 0x200, 0x300] : [wave16(x, y, 0), 0x200, 0x300]) },
    space: '/DeviceRGB',
    colour: (s) => s.map((v) => v >> 8),
    alpha: (s) => (s[0] === 0x100 && s[1] === 0x200 && s[2] === 0x300 ? 0 : 255),
  },
  {
    name: 'Adam7-interlaced RGBA 8-bit',
    spec: { width: W, height: H, colorType: 6, bitDepth: 8, interlace: true, pixel: (x, y) => [wave(x, y, 0, 256), wave(x, y, 1, 256), wave(x, y, 2, 256), wave(x, y, 3, 256)] },
    space: '/DeviceRGB',
    colour: (s) => s.slice(0, 3),
    alpha: (s) => s[3]!,
  },
  {
    name: 'Adam7-interlaced 1-bit grey, 3×2 so some passes are empty',
    spec: { width: 3, height: 2, colorType: 0, bitDepth: 1, interlace: true, pixel: (x, y) => [(x + y) % 2] },
    space: '/DeviceGray',
    colour: (s) => [s[0]! * 255],
    alpha: null,
  },
];

describe('PNG pictures', () => {
  for (const testCase of CASES) {
    it(`draws ${testCase.name} sample for sample`, () => {
      const image = pdfImageOf(asPicture(encodePng(testCase.spec)));
      expect(image).not.toBeNull();
      expect(image!.width).toBe(testCase.spec.width);
      expect(image!.height).toBe(testCase.spec.height);
      expect(image!.entries).toContain(`/ColorSpace${testCase.space}`);
      expect(image!.entries).toContain('/BitsPerComponent 8');
      expect(image!.entries).toContain('/Filter/FlateDecode');
      const want = expected(testCase.spec, testCase.colour, testCase.alpha ?? (() => 255));
      const got = streams(image!);
      expect(got.colour).toEqual(want.colour);
      if (testCase.alpha === null) {
        expect(got.alpha).toBeNull();
      } else {
        expect(got.alpha).toEqual(want.alpha);
        expect(image!.mask!.entries).toContain('/ColorSpace/DeviceGray');
      }
    });
  }

  it('writes no mask for an RGBA picture whose every pixel is opaque', () => {
    const spec: PngSpec = { width: 4, height: 4, colorType: 6, bitDepth: 8, pixel: (x, y) => [x * 60, y * 60, 9, 255] };
    expect(pdfImageOf(asPicture(encodePng(spec)))!.mask).toBeNull();
  });

  it('trusts the file’s own size over the size it was handed', () => {
    const spec: PngSpec = { width: 5, height: 3, colorType: 0, bitDepth: 8, pixel: () => [7] };
    const image = pdfImageOf({ ...asPicture(encodePng(spec)), width: 500, height: 300 });
    expect([image!.width, image!.height]).toEqual([5, 3]);
  });

  it('gives null, never a throw, for a broken PNG', () => {
    const good = encodePng(CASES[0]!.spec);
    const badSignature = good.slice();
    badSignature[1] = 0x51;
    const truncatedIdat = encodePng(CASES[0]!.spec, new Uint8Array(deflateSync(scanlines(CASES[0]!.spec))).subarray(0, 40));
    const unknownColourType = encodePng({ ...CASES[2]!.spec, colorType: 5 } as PngSpec, new Uint8Array(deflateSync(new Uint8Array(200))));
    const cutMidChunk = good.subarray(0, good.length - 40);
    const tooShortData = encodePng(CASES[1]!.spec, new Uint8Array(deflateSync(scanlines(CASES[1]!.spec).subarray(0, 100))));
    for (const bytes of [badSignature, truncatedIdat, unknownColourType, cutMidChunk, tooShortData, new Uint8Array(0)]) {
      expect(() => pdfImageOf(asPicture(bytes))).not.toThrow();
      expect(pdfImageOf(asPicture(bytes))).toBeNull();
    }
  });

  it('refuses a picture of more than 16,777,216 pixels before decoding it', () => {
    const spec: PngSpec = { width: 4097, height: 4096, colorType: 0, bitDepth: 8, pixel: () => [0] };
    expect(pdfImageOf(asPicture(encodePng(spec, new Uint8Array(deflateSync(new Uint8Array(10))))))).toBeNull();
  });

  it('gives null for a data URL that is not base64 or is not a picture', () => {
    const png = encodePng(CASES[2]!.spec);
    const base = asPicture(png);
    expect(pdfImageOf({ ...base, dataUrl: base.dataUrl.replace(';base64', '') })).toBeNull();
    expect(pdfImageOf({ ...base, dataUrl: base.dataUrl.replace(',', ',@@') })).toBeNull();
    expect(pdfImageOf({ ...base, dataUrl: 'not a data url' })).toBeNull();
    expect(pdfImageOf(asPicture(new TextEncoder().encode('GIF89a and so on')))).toBeNull();
  });

  it('decodes the same picture to the same bytes, every time', () => {
    const picture = asPicture(encodePng(CASES[0]!.spec));
    const one = pdfImageOf(picture)!;
    const two = pdfImageOf(picture)!;
    expect(Buffer.from(one.data).equals(Buffer.from(two.data))).toBe(true);
    expect(Buffer.from(one.mask!.data).equals(Buffer.from(two.mask!.data))).toBe(true);
  });
});

const JPEG_GREY_16X8 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//wAALCAAIABABAREA/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/AMTw/Yfd4rsdUvf7A8Ny3cfFw+Ibfj/lo2cHoRwAW54OMd6//9k=';
const JPEG_RGB_16X8 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAAIABADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDMtfDvT5P0rYtfDvT5P0oorKvi6vc5cqx1bTU//9k=';
const JPEG_CMYK_ADOBE_8X8 =
  '/9j/7gAOQWRvYmUAZAAAAAAA/9sAQwANCQoLCggNCwoLDg4NDxMgFRMSEhMnHB4XIC4pMTAuKS0sMzpKPjM2RjcsLUBXQUZMTlJTUjI+WmFaUGBKUVJP/8AAFAgACAAIBEMRAE0RAFkRAEsRAP/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/aAA4EQwBNAFkASwAAPwCz8Qf+Wv41Z/4Tr/pt+tdPXp1f/9k=';
const JPEG_RGB_PROGRESSIVE_16X8 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wgARCAAIABADASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAT/xAAVAQEBAAAAAAAAAAAAAAAAAAACA//aAAwDAQACEAMQAAABlsBL/8QAFhAAAwAAAAAAAAAAAAAAAAAAAAIE/9oACAEBAAEFAlnFnP/EABcRAAMBAAAAAAAAAAAAAAAAAAACAwT/2gAIAQMBAT8By3c//8QAFhEBAQEAAAAAAAAAAAAAAAAAAgAD/9oACAECAQE/AXqr/8QAFBABAAAAAAAAAAAAAAAAAAAAEP/aAAgBAQAGPwI//8QAFRABAQAAAAAAAAAAAAAAAAAAAGH/2gAIAQEAAT8hmm//2gAMAwEAAgADAAAAEPv/xAAVEQEBAAAAAAAAAAAAAAAAAAAhAP/aAAgBAwEBPxAjf//EABURAQEAAAAAAAAAAAAAAAAAAABR/9oACAECAQE/EL3/xAAWEAADAAAAAAAAAAAAAAAAAAAAMcH/2gAIAQEAAT8QRIiT/9k=';

function jpeg(base64: string): PictureInput {
  return { mediaType: 'image/jpeg', dataUrl: `data:image/jpeg;base64,${base64}`, width: 1, height: 1 };
}

describe('JPEG pictures', () => {
  it('passes a grey baseline JPEG through as DCTDecode, DeviceGray', () => {
    const image = pdfImageOf(jpeg(JPEG_GREY_16X8))!;
    expect([image.width, image.height]).toEqual([16, 8]);
    expect(image.entries).toContain('/ColorSpace/DeviceGray');
    expect(image.entries).toContain('/BitsPerComponent 8');
    expect(image.entries).toContain('/Filter/DCTDecode');
    expect(image.mask).toBeNull();
    expect(Buffer.from(image.data).equals(Buffer.from(JPEG_GREY_16X8, 'base64'))).toBe(true);
  });

  it('passes an RGB baseline JPEG and a progressive one through as DeviceRGB', () => {
    for (const source of [JPEG_RGB_16X8, JPEG_RGB_PROGRESSIVE_16X8]) {
      const image = pdfImageOf(jpeg(source))!;
      expect([image.width, image.height]).toEqual([16, 8]);
      expect(image.entries).toContain('/ColorSpace/DeviceRGB');
      expect(image.entries).not.toContain('/Decode');
    }
  });

  it('inverts an Adobe CMYK JPEG with a Decode array', () => {
    const image = pdfImageOf(jpeg(JPEG_CMYK_ADOBE_8X8))!;
    expect([image.width, image.height]).toEqual([8, 8]);
    expect(image.entries).toContain('/ColorSpace/DeviceCMYK');
    expect(image.entries).toContain('/Decode[1 0 1 0 1 0 1 0]');
  });

  it('gives null, never a throw, for garbage that starts like a JPEG', () => {
    const real = Buffer.from(JPEG_RGB_16X8, 'base64');
    const cut = real.subarray(0, 30).toString('base64');
    const garbage = Buffer.from([0xff, 0xd8, 0xff, 0x12, 0x34, 0x00]).toString('base64');
    const lossless = Buffer.from(real);
    // Turn the SOF0 marker into SOF3 (lossless), which a PDF cannot carry.
    lossless[lossless.indexOf(Buffer.from([0xff, 0xc0])) + 1] = 0xc3;
    for (const source of [cut, garbage, lossless.toString('base64'), '']) {
      expect(() => pdfImageOf(jpeg(source))).not.toThrow();
      expect(pdfImageOf(jpeg(source))).toBeNull();
    }
  });
});
