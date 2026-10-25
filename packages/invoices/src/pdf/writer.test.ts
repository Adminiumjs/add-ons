import { createHash } from 'node:crypto';
import { crc32, deflateSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import {
  HELVETICA_BOLD_WIDTHS,
  HELVETICA_WIDTHS,
  undrawnCharacters,
  widthOf,
  winAnsiByte,
  centralEuropeanByte,
} from './helvetica.ts';
import { pdfImageOf } from './image.ts';
import { box, image, paragraph, rule, text, textRight, wrap } from './primitives.ts';
import { ascii, literal, runsOf, writePdf, type Page } from './writer.ts';

const LATIN1 = new TextDecoder('latin1');
const FRAME = { widthPt: 595, heightPt: 842 };

/**
 * The cross-reference table, walked back to the objects it points at.
 *
 * A copy of the assertion `describeDocumentRenderer` makes over a finished
 * document, applied here to the writer alone — so a byte-offset defect is
 * caught by the smallest suite that can see it rather than by the largest.
 */
function parseXrefBack(bytes: Uint8Array): number[] {
  const source = LATIN1.decode(bytes);
  const declared = /startxref\s+(\d+)\s+%%EOF/.exec(source.slice(source.lastIndexOf('startxref')));
  expect(declared, 'no startxref/%%EOF trailer').not.toBeNull();
  const at = Number(declared![1]);
  expect(source.startsWith('xref', at), 'startxref does not point at the table').toBe(true);

  const header = /^xref\s+(\d+)\s+(\d+)\s+/.exec(source.slice(at))!;
  expect(Number(header[1])).toBe(0);
  const count = Number(header[2]);

  let cursor = at + header[0].length;
  const offsets: number[] = [];
  for (let n = 0; n < count; n += 1) {
    const entry = source.slice(cursor, cursor + 20);
    expect(entry, `entry ${String(n)} is not twenty bytes`).toMatch(
      /^\d{10} \d{5} [nf][\r\n ][\r\n]$/,
    );
    if (n > 0) {
      const offset = Number(entry.slice(0, 10));
      expect(
        source.startsWith(`${String(n)} 0 obj`, offset),
        `object ${String(n)} is not at ${String(offset)}`,
      ).toBe(true);
      offsets.push(offset);
    }
    cursor += 20;
  }
  return offsets;
}

function onePage(stream: number[]): Page {
  return { widthPt: FRAME.widthPt, heightPt: FRAME.heightPt, stream };
}

describe('the WinAnsi encoding', () => {
  it('draws printable ASCII and the Latin-1 upper half as themselves', () => {
    expect(winAnsiByte(' ')).toBe(0x20);
    expect(winAnsiByte('~')).toBe(0x7e);
    expect(winAnsiByte('é')).toBe(0xe9);
    expect(winAnsiByte('ß')).toBe(0xdf);
    expect(winAnsiByte('ø')).toBe(0xf8);
    expect(winAnsiByte('ÿ')).toBe(0xff);
  });

  it('maps the punctuation Windows put where Latin-1 has control codes', () => {
    // The euro is the one everybody meets: it is 0x80 in WinAnsi and U+20AC in
    // Unicode, and a writer that passed the code point through would emit a
    // three-byte UTF-8 sequence into a single-byte encoding.
    expect(winAnsiByte('€')).toBe(0x80);
    expect(winAnsiByte('—')).toBe(0x97);
    expect(winAnsiByte('’')).toBe(0x92);
  });

  it('draws nothing for the six positions WinAnsi leaves undefined', () => {
    // 0x7F and 0x81/0x8D/0x8F/0x90/0x9D. There is no character that maps to
    // them, so this asserts the complement: 0x20..0xFF is 224 positions and
    // the table holds 218 of them.
    expect(Object.keys(HELVETICA_WIDTHS)).toHaveLength(218);
    expect(Object.keys(HELVETICA_BOLD_WIDTHS)).toHaveLength(218);
    for (const undefinedByte of [0x7f, 0x81, 0x8d, 0x8f, 0x90, 0x9d]) {
      expect(HELVETICA_WIDTHS[undefinedByte]).toBeUndefined();
      expect(HELVETICA_BOLD_WIDTHS[undefinedByte]).toBeUndefined();
    }
  });

  it('refuses what Helvetica has no glyph for, once each and in order', () => {
    expect(undrawnCharacters('Acme GmbH')).toEqual([]);
    expect(undrawnCharacters('Müller & Söhne — €1.200,50')).toEqual([]);
    expect(undrawnCharacters('発票 مرحبا 発票')).toEqual(['発', '票', 'م', 'ر', 'ح', 'ب', 'ا']);
    // Whitespace is not a glyph anybody needs to be told about.
    expect(undrawnCharacters('a\tb\nc')).toEqual([]);
  });
});

describe('the Helvetica metrics', () => {
  it('gives every digit the same advance, which is what lines a money column up', () => {
    const widths = [...'0123456789'].map((d) => widthOf(d, 10));
    expect(new Set(widths).size).toBe(1);
    expect(widths[0]).toBeCloseTo(5.56, 5);
  });

  it('carries the widths that are easy to get wrong', () => {
    // WinAnsi 0x27 is `quotesingle` (191), not `quoteright` (222); 0x60 is
    // `grave` (333), not `quoteleft`. Getting these two the other way round is
    // the classic AFM transcription error.
    expect(HELVETICA_WIDTHS[0x27]).toBe(191);
    expect(HELVETICA_WIDTHS[0x60]).toBe(333);
    expect(HELVETICA_WIDTHS[0x40]).toBe(1015);
    expect(HELVETICA_BOLD_WIDTHS[0x40]).toBe(975);
  });

  it('measures bold as wider than regular for the same word', () => {
    expect(widthOf('Total', 10, 'bold')).toBeGreaterThan(widthOf('Total', 10, 'regular'));
  });

  it('scales linearly with the point size', () => {
    expect(widthOf('Subtotal', 20)).toBeCloseTo(widthOf('Subtotal', 10) * 2, 6);
  });
});

describe('the writer', () => {
  it('writes a PDF 1.4 whose xref walks back to every object', () => {
    const bytes = writePdf([onePage(text(FRAME, 40, 60, 'Invoice INV-1042', { sizePt: 11 }))]);
    expect(LATIN1.decode(bytes).startsWith('%PDF-1.4')).toBe(true);
    expect(LATIN1.decode(bytes).endsWith('%%EOF\n')).toBe(true);
    // Catalog, pages, one page, one stream, two fonts.
    expect(parseXrefBack(bytes)).toHaveLength(6);
  });

  it('keeps the table correct when the text is NOT ASCII — the whole point of the file', () => {
    /*
     * The xref trap. `Müller` is six characters and, WinAnsi-encoded, six
     * bytes — but the file also carries `€` and `—`, and a writer that had
     * built this as a UTF-8 string would have offsets short by one byte per
     * high character for every object AFTER the stream. The fonts are emitted
     * after the streams so that there are such objects.
     */
    const ops = [
      ...text(FRAME, 40, 60, 'Müller & Söhne', { sizePt: 11 }),
      ...text(FRAME, 40, 80, '— Zahlung: €1.200,50 —', { sizePt: 11 }),
    ];
    const bytes = writePdf([onePage(ops)]);
    const offsets = parseXrefBack(bytes);

    const source = LATIN1.decode(bytes);
    const firstHigh = [...source].findIndex((c) => c.charCodeAt(0) > 0x7f);
    expect(firstHigh, 'the fixture has no high byte and proves nothing').toBeGreaterThan(0);
    expect(
      offsets.filter((offset) => offset > firstHigh).length,
      'no object sits after the drawn text, so the assertion cannot bite',
    ).toBeGreaterThan(0);
  });

  it('renders the same page to the same bytes, every time', () => {
    const page = () => onePage(text(FRAME, 40, 60, 'Müller', { sizePt: 11 }));
    expect(Array.from(writePdf([page()]))).toEqual(Array.from(writePdf([page()])));
  });

  it('escapes the three characters that would end a string literal early', () => {
    const bytes = Uint8Array.from(literal('a(b)c\\d'));
    expect(LATIN1.decode(bytes)).toBe('(a\\(b\\)c\\\\d)');
  });

  it('numbers multiple pages and points each at its own stream', () => {
    const bytes = writePdf([
      onePage(text(FRAME, 40, 60, 'Page one', { sizePt: 11 })),
      onePage(text(FRAME, 40, 60, 'Page two', { sizePt: 11 })),
    ]);
    const source = LATIN1.decode(bytes);
    expect(source).toContain('/Count 2');
    expect(source).toContain('/Kids[3 0 R 4 0 R]');
    expect(source).toContain('/Contents 5 0 R');
    expect(source).toContain('/Contents 6 0 R');
    // Catalog, pages, two pages, two streams, two fonts.
    expect(parseXrefBack(bytes)).toHaveLength(8);
  });

  it('declares a stream length in BYTES, not characters', () => {
    const ops = text(FRAME, 40, 60, 'üüüü', { sizePt: 11 });
    const bytes = writePdf([onePage(ops)]);
    const source = LATIN1.decode(bytes);
    const declared = Number(/<<\/Length (\d+)>>/.exec(source)![1]);
    expect(declared).toBe(ops.length);
    // And the declared length really does span the stream: the bytes between
    // `stream\n` and `\nendstream` are exactly that many.
    const start = source.indexOf('stream\n') + 'stream\n'.length;
    expect(source.indexOf('\nendstream') - start).toBe(declared);
  });

  it('refuses to write a file with no pages rather than one a viewer rejects', () => {
    expect(() => writePdf([])).toThrow();
  });
});

describe('the primitives', () => {
  it('right-aligns a column of differently-shaped figures on one edge', () => {
    // The assertion the width table exists for. `1.00` and `8,888.88` share no
    // digit shapes with each other and must still end at the same x.
    const style = { sizePt: 10 } as const;
    const rightEdge = 540;
    const lefts = ['$1.00', '$8,888.88', '−$204.12'].map(
      (figure) => rightEdge - widthOf(figure, style.sizePt),
    );
    for (const [at, figure] of ['$1.00', '$8,888.88', '−$204.12'].entries()) {
      const ops = LATIN1.decode(Uint8Array.from(textRight(FRAME, rightEdge, 100, figure, style)));
      const tm = /1 0 0 1 ([\d.]+) /.exec(ops)!;
      expect(Number(tm[1])).toBeCloseTo(lefts[at]!, 2);
      expect(Number(tm[1]) + widthOf(figure, style.sizePt)).toBeCloseTo(rightEdge, 2);
    }
  });

  it('converts top-down y to PDF’s bottom-up origin once, in one place', () => {
    const ops = LATIN1.decode(Uint8Array.from(text(FRAME, 40, 60, 'x', { sizePt: 10 })));
    expect(ops).toContain(`1 0 0 1 40 ${String(FRAME.heightPt - 60)} Tm`);
  });

  it('wraps on spaces, and breaks a single over-long token by character', () => {
    const style = { sizePt: 10 } as const;
    const wrapped = wrap('Design system audit and implementation review', 120, style);
    expect(wrapped.length).toBeGreaterThan(1);
    for (const line of wrapped) expect(widthOf(line, style.sizePt)).toBeLessThanOrEqual(120);

    // A part number with no spaces: it is broken rather than allowed to run
    // over the money column beside it.
    const long = wrap('PART-000000000000000000000000000000000', 60, style);
    expect(long.length).toBeGreaterThan(1);
    for (const line of long) expect(widthOf(line, style.sizePt)).toBeLessThanOrEqual(60);
    expect(long.join('')).toBe('PART-000000000000000000000000000000000');
  });

  it('keeps hard newlines as breaks the author asked for', () => {
    expect(wrap('Acme Corporation\n400 Market Street', 400, { sizePt: 10 })).toEqual([
      'Acme Corporation',
      '400 Market Street',
    ]);
  });

  it('reports where a paragraph ended so the next block can start there', () => {
    const drawn = paragraph(FRAME, 40, 100, 'one two three four five', 60, { sizePt: 10 }, 12);
    expect(drawn.y).toBeGreaterThan(100);
    expect((drawn.y - 100) % 12).toBe(0);
  });

  it('draws a rule and a box with balanced graphics state', () => {
    for (const ops of [rule(FRAME, 40, 100, 500), box(FRAME, 40, 100, 500, 20, '#4f46e5')]) {
      const source = LATIN1.decode(Uint8Array.from(ops));
      expect(source.startsWith('q\n')).toBe(true);
      expect(source.trimEnd().endsWith('Q')).toBe(true);
      // An unbalanced q/Q leaks a colour into everything drawn after it.
      expect((source.match(/\bq\b/g) ?? []).length).toBe((source.match(/\bQ\b/g) ?? []).length);
    }
  });

  it('draws nothing at all for an empty string', () => {
    expect(text(FRAME, 40, 60, '', { sizePt: 10 })).toEqual([]);
  });

  it('encodes PDF syntax as ASCII and never as anything wider', () => {
    expect(ascii('BT /F1 11 Tf')).toEqual([...'BT /F1 11 Tf'].map((c) => c.charCodeAt(0)));
  });
});

describe('the Central European face', () => {
  it('draws the Czech, Polish and Hungarian letters WinAnsi lacks', () => {
    expect(undrawnCharacters('Částka k úhradě · Łódź · Győr · Dušan Šťastný')).toEqual([]);
    expect(centralEuropeanByte('č')).not.toBeNull();
    // A letter WinAnsi has stays in WinAnsi.
    expect(centralEuropeanByte('é')).toBeNull();
  });

  it('advances an accented letter as its base letter, and ď as its own', () => {
    expect(widthOf('č', 10)).toBeCloseTo(widthOf('c', 10), 6);
    expect(widthOf('Ř', 10, 'bold')).toBeCloseTo(widthOf('R', 10, 'bold'), 6);
    expect(widthOf('ď', 10)).toBeCloseTo(6.43, 6);
  });

  it('cuts a string into runs, one face each', () => {
    expect(runsOf('Částka 5 Kč')).toEqual([
      { face: 'central', text: 'Č' },
      { face: 'winansi', text: 'ástka 5 K' },
      { face: 'central', text: 'č' },
    ]);
  });

  it('declares the second face only for a page that draws in it', () => {
    const plain = LATIN1.decode(writePdf([onePage(text(FRAME, 40, 60, 'Müller', { sizePt: 11 }))]));
    expect(plain).not.toContain('/F3');
    const czech = writePdf([onePage(text(FRAME, 40, 60, 'Částka', { sizePt: 11 }))]);
    const source = LATIN1.decode(czech);
    expect(source).toContain('/F3 ');
    expect(source).toContain('/Differences[33/Aogonek');
    // Catalog, pages, one page, one stream, four fonts — and the table still walks.
    expect(parseXrefBack(czech)).toHaveLength(8);
  });
});


/** A PNG of `width` × `height` pixels from raw, unfiltered rows (filter 0). */
function pngOf(width: number, height: number, colorType: number, rows: Uint8Array): Uint8Array {
  const channels = { 0: 1, 2: 3, 6: 4 }[colorType as 0 | 2 | 6];
  const stride = width * channels;
  const raw = new Uint8Array(height * (stride + 1));
  for (let y = 0; y < height; y += 1) raw.set(rows.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  const chunk = (type: string, data: Uint8Array): number[] => {
    const body = Uint8Array.from([...ascii(type), ...data]);
    const crc = crc32(body);
    const n = body.length - 4;
    return [n >>> 24, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff, ...body, crc >>> 24, (crc >>> 16) & 0xff, (crc >>> 8) & 0xff, crc & 0xff];
  };
  const ihdr = Uint8Array.from([0, 0, width >>> 8, width & 0xff, 0, 0, height >>> 8, height & 0xff, 8, colorType, 0, 0, 0]);
  const out: number[] = [137, 80, 78, 71, 13, 10, 26, 10, ...chunk('IHDR', ihdr)];
  // Pushed in slices: a two-megabyte spread into one call is the very failure
  // the writer has to avoid, and the fixture must not commit it first.
  const idat = chunk('IDAT', new Uint8Array(deflateSync(raw)));
  for (let at = 0; at < idat.length; at += 8192) out.push(...idat.slice(at, at + 8192));
  out.push(...chunk('IEND', new Uint8Array(0)));
  return Uint8Array.from(out);
}

const dataUrlOf = (bytes: Uint8Array, type: string) => `data:${type};base64,${Buffer.from(bytes).toString('base64')}`;

/** A signature-like 6 × 4 RGBA picture: ink on a transparent ground. */
const SIGNATURE = pngOf(6, 4, 6, Uint8Array.from({ length: 6 * 4 * 4 }, (_, at) => (at % 4 === 3 ? (at % 7 === 0 ? 255 : 0) : 20)));
const GREY_JPEG =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//wAALCAAIABABAREA/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/AMTw/Yfd4rsdUvf7A8Ny3cfFw+Ibfj/lo2cHoRwAW54OMd6//9k=';

describe('pictures in the writer', () => {
  it('writes a page with no picture to exactly the bytes it always had', () => {
    /*
     * Taken from the writer before it could draw a picture. A document that
     * draws none must not move a byte: no `/XObject` entry, the same object
     * numbers, the same order.
     */
    const plain = writePdf([onePage([...text(FRAME, 40, 60, 'Müller & Söhne', { sizePt: 11 }), ...rule(FRAME, 40, 70, 500)])]);
    expect(LATIN1.decode(plain)).toBe(
      '%PDF-1.4\n1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n2 0 obj\n<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n3 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 5 0 R/F2 6 0 R>>>>/Contents 4 0 R>>\nendobj\n4 0 obj\n<</Length 107>>\nstream\nq\nBT\n/F1 11 Tf\n1 0 0 1 40 782 Tm\n(Müller & Söhne) Tj\nET\nQ\nq\n0.9 0.91 0.92 RG\n0.75 w\n40 772 m\n540 772 l\nS\nQ\n\nendstream\nendobj\n5 0 obj\n<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>\nendobj\n6 0 obj\n<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold/Encoding/WinAnsiEncoding>>\nendobj\nxref\n0 7\n0000000000 65535 f \n0000000009 00000 n \n0000000054 00000 n \n0000000105 00000 n \n0000000226 00000 n \n0000000382 00000 n \n0000000470 00000 n \ntrailer\n<</Size 7/Root 1 0 R>>\nstartxref\n563\n%%EOF\n',
    );
    const twoPagesCentral = writePdf([
      onePage(text(FRAME, 40, 60, 'Částka', { sizePt: 11, weight: 'bold' })),
      { ...onePage(box(FRAME, 40, 100, 500, 20, '#4f46e5')), images: [] },
    ]);
    expect(twoPagesCentral.length).toBe(2507);
    expect(createHash('sha256').update(twoPagesCentral).digest('hex')).toBe(
      '4f251af8be2d2ee2788b2ccb379f79639e942d6f60392a15287cc75cb760dd9f',
    );
  });

  it('draws an RGBA PNG with its mask and a JPEG, and the table still walks', () => {
    const signature = pdfImageOf({ mediaType: 'image/png', dataUrl: dataUrlOf(SIGNATURE, 'image/png'), width: 6, height: 4 });
    const photo = pdfImageOf({ mediaType: 'image/jpeg', dataUrl: `data:image/jpeg;base64,${GREY_JPEG}`, width: 16, height: 8 });
    expect(signature).not.toBeNull();
    expect(photo).not.toBeNull();
    const bytes = writePdf([
      { ...onePage([...text(FRAME, 40, 60, 'Signed by Müller', { sizePt: 11 }), ...image(FRAME, 40, 80, 120, 80, 'Im1')]), images: [{ name: 'Im1', image: signature! }] },
      { ...onePage(image(FRAME, 40, 80, 160, 80, 'Im1')), images: [{ name: 'Im1', image: photo! }] },
      onePage(text(FRAME, 40, 60, 'No picture here', { sizePt: 11 })),
    ]);
    const source = LATIN1.decode(bytes);
    // Catalog, pages, three pages, three streams, two fonts, the PNG and its
    // mask, the JPEG.
    expect(parseXrefBack(bytes)).toHaveLength(13);
    expect(source).toContain('/XObject<</Im1 11 0 R>>');
    expect(source).toContain('/XObject<</Im1 13 0 R>>');
    expect(source).toContain('/Im1 Do');
    expect(source).toContain('/SMask 12 0 R');
    expect(source).toContain('/DCTDecode');
    // The third page carries no picture and so no XObject entry at all.
    expect(source).toContain('/Resources<</Font<</F1 9 0 R/F2 10 0 R>>>>/Contents 8 0 R');
    // Pictures come after the fonts, so the fonts still come after the text.
    expect(source.indexOf('/Subtype/Image')).toBeGreaterThan(source.indexOf('/BaseFont/Helvetica-Bold'));
  });

  it('writes a picture used on two pages once', () => {
    const signature = pdfImageOf({ mediaType: 'image/png', dataUrl: dataUrlOf(SIGNATURE, 'image/png'), width: 6, height: 4 })!;
    const page = { ...onePage(image(FRAME, 40, 80, 120, 80, 'Im1')), images: [{ name: 'Im1', image: signature }] };
    const bytes = writePdf([page, page]);
    // The PNG and its mask, once each.
    expect(LATIN1.decode(bytes).match(/\/Subtype\/Image/g)).toHaveLength(2);
    expect(parseXrefBack(bytes)).toHaveLength(2 + 2 + 2 + 2 + 2);
  });

  it('places the picture top-down, scaled to the box it is given', () => {
    const ops = LATIN1.decode(Uint8Array.from(image(FRAME, 40, 100, 120, 30, 'Im2')));
    expect(ops).toBe(`q\n120 0 0 30 40 ${String(FRAME.heightPt - 130)} cm\n/Im2 Do\nQ\n`);
  });

  it('writes a picture stream of more than two megabytes without running out of stack', () => {
    let state = 0x2545f491;
    const rows = Uint8Array.from({ length: 1500 * 1400 }, () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return state & 0xff;
    });
    const big = pdfImageOf({ mediaType: 'image/png', dataUrl: dataUrlOf(pngOf(1500, 1400, 0, rows), 'image/png'), width: 1500, height: 1400 })!;
    expect(big.data.length).toBeGreaterThan(2_000_000);
    const bytes = writePdf([{ ...onePage(image(FRAME, 0, 0, 595, 555, 'Im1')), images: [{ name: 'Im1', image: big }] }]);
    expect(bytes.length).toBeGreaterThan(2_000_000);
    expect(parseXrefBack(bytes)).toHaveLength(7);
  });
});
