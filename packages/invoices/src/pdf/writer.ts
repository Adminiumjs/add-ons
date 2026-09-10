/**
 * A PDF 1.4 writer over BYTE BUFFERS (34-invoices-add-on.md §0.3 trap 8).
 *
 * ── THE TRAP THIS FILE EXISTS TO AVOID, STATED ONCE ────────────────────────
 *
 * `barcode-labels`' scaffold builds its file as a JavaScript STRING and takes
 * each object's cross-reference offset from `out.length` (`sheet.ts:441-449`).
 * That is correct there, and the comment beside it says exactly why: every
 * byte of a label sheet is ASCII, so one character is one byte. It is not
 * correct here. An invoice prints a customer's name, and the moment that name
 * contains `ü` the string index and the byte offset part company — producing a
 * file that opens in a viewer (which repairs a broken xref) and mis-seeks in
 * anything that trusts the table.
 *
 * So there is no string. Objects are byte arrays, offsets are `bytes.length`
 * at the moment an object starts, and the only definition of "how long is
 * this" anywhere in the file is a count of bytes.
 *
 * That is a claim rather than a comfort, so it is tested twice: the
 * conformance suite walks the finished table back to each object over a
 * subject containing accented text (`describeDocumentRenderer`), and
 * `writer.test.ts` here does the same on the writer alone. A deliberate
 * `String.length` mutation reddens both.
 *
 * ── WHAT THIS WRITER DOES NOT DO ───────────────────────────────────────────
 *
 * No compression, no encryption, no embedded fonts, no object streams, no
 * incremental updates. It writes the smallest correct PDF that draws text,
 * rules and filled boxes in the base-14 faces every consumer already has.
 * Every one of those absences is what lets this package have ZERO runtime
 * dependencies (25 D11), which is the constraint the whole design answers to —
 * `pdf-lib` and `jsPDF` are design errors here, not shortcuts.
 */

import { widthOf, winAnsiByte, type FontWeight } from './helvetica.ts';

/** ASCII text → bytes. For PDF syntax only: operators, dictionaries, numbers. */
export function ascii(text: string): number[] {
  const out: number[] = [];
  for (let at = 0; at < text.length; at += 1) out.push(text.charCodeAt(at) & 0x7f);
  return out;
}

/**
 * A PDF string literal — `(…)` with `(`, `)` and `\` escaped, WinAnsi-encoded.
 *
 * A character the encoding cannot draw is SKIPPED here, and that is safe only
 * because it is unreachable: `render` refuses the whole document with
 * `LATIN_ONLY` before any of this runs. The skip is the last line of defence,
 * not the policy — a policy of silently dropping letters is the thing 34 D6
 * forbids.
 */
export function literal(text: string): number[] {
  const out: number[] = [0x28];
  for (const character of text) {
    const byte = winAnsiByte(character);
    if (byte === null) continue;
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) out.push(0x5c);
    out.push(byte);
  }
  out.push(0x29);
  return out;
}

/** A number as PDF syntax: no exponent, no more precision than a printer uses. */
export function pt(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '');
}

export interface Page {
  readonly widthPt: number;
  readonly heightPt: number;
  /** The content stream's operators, already encoded. */
  readonly stream: number[];
}

/** `#rrggbb` → the three 0..1 components a PDF colour operator takes. */
export function rgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const value = Number.parseInt(full.slice(0, 6), 16);
  if (!Number.isFinite(value)) return [0, 0, 0];
  return [((value >> 16) & 0xff) / 255, ((value >> 8) & 0xff) / 255, (value & 0xff) / 255];
}

/**
 * Assemble the file.
 *
 * OBJECT ORDER, AND WHY THE FONTS COME LAST. Objects may be written in any
 * order — that is what the cross-reference table is for. The fonts are emitted
 * AFTER the content streams so that at least one xref entry always sits beyond
 * the drawn text: with every object before the first non-ASCII byte, a writer
 * with byte-offset bugs produces a table that is accidentally correct, and the
 * assertion that walks it back proves nothing. Measured on 2026-09-10 in the
 * contract package's own reference writer, which passed a deliberate mutation
 * until an object was moved past the stream.
 */
export function writePdf(pages: readonly Page[]): Uint8Array {
  if (pages.length === 0) throw new Error('a PDF needs at least one page');

  const firstPage = 3;
  const firstStream = firstPage + pages.length;
  const regularFont = firstStream + pages.length;
  const boldFont = regularFont + 1;

  const kids = pages.map((_, at) => `${String(firstPage + at)} 0 R`).join(' ');

  const objects: number[][] = [
    ascii('<</Type/Catalog/Pages 2 0 R>>'),
    ascii(`<</Type/Pages/Kids[${kids}]/Count ${String(pages.length)}>>`),
    ...pages.map((page, at) =>
      ascii(
        `<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${pt(page.widthPt)} ${pt(page.heightPt)}]` +
          `/Resources<</Font<</F1 ${String(regularFont)} 0 R/F2 ${String(boldFont)} 0 R>>>>` +
          `/Contents ${String(firstStream + at)} 0 R>>`,
      ),
    ),
    ...pages.map((page) => [
      ...ascii(`<</Length ${String(page.stream.length)}>>\nstream\n`),
      ...page.stream,
      ...ascii('\nendstream'),
    ]),
    ascii('<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>'),
    ascii('<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold/Encoding/WinAnsiEncoding>>'),
  ];

  const bytes: number[] = [...ascii('%PDF-1.4\n')];
  const offsets: number[] = [];
  objects.forEach((body, at) => {
    // THE ONE LINE THE WHOLE FILE IS ABOUT: the offset is how many BYTES have
    // been written, never how many characters some string holds.
    offsets.push(bytes.length);
    bytes.push(...ascii(`${String(at + 1)} 0 obj\n`), ...body, ...ascii('\nendobj\n'));
  });

  const xref = bytes.length;
  const size = objects.length + 1;
  bytes.push(...ascii(`xref\n0 ${String(size)}\n0000000000 65535 f \n`));
  for (const offset of offsets) {
    bytes.push(...ascii(`${String(offset).padStart(10, '0')} 00000 n \n`));
  }
  bytes.push(
    ...ascii(
      `trailer\n<</Size ${String(size)}/Root 1 0 R>>\nstartxref\n${String(xref)}\n%%EOF\n`,
    ),
  );
  return Uint8Array.from(bytes);
}

/** Which `/F` name a weight maps to in the resource dictionary above. */
export function fontName(weight: FontWeight): string {
  return weight === 'bold' ? '/F2' : '/F1';
}

export { widthOf };
