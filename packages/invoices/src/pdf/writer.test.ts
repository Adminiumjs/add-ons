import { describe, expect, it } from 'vitest';

import {
  HELVETICA_BOLD_WIDTHS,
  HELVETICA_WIDTHS,
  undrawnCharacters,
  widthOf,
  winAnsiByte,
} from './helvetica.ts';
import { box, paragraph, rule, text, textRight, wrap } from './primitives.ts';
import { ascii, literal, writePdf, type Page } from './writer.ts';

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
     * 34 §0.3 trap 8. `Müller` is six characters and, WinAnsi-encoded, six
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
