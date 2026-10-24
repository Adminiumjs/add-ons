/**
 * A PDF 1.4 writer over BYTE BUFFERS.
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
 * No encryption, no embedded fonts, no object streams, no incremental
 * updates, and no compression of its own content streams. It writes the
 * smallest correct PDF that draws text, rules and filled boxes in the base-14
 * faces every consumer already has — and, when a page asks for one, a picture
 * (`image.ts` turns a PNG or JPEG into the image object written here; its
 * streams are the one compressed thing in the file). Every
 * one of those absences is what lets this package have ZERO runtime
 * dependencies, which is the constraint the whole design answers to — `pdf-lib`
 * and `jsPDF` are design errors here, not shortcuts.
 */

import { CENTRAL_EUROPEAN_DIFFERENCES, centralEuropeanByte, widthOf, winAnsiByte, type FontWeight } from './helvetica.ts';
import type { PdfImage } from './image.ts';

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
 * not the policy — a policy of silently dropping letters is exactly what the
 * typed `LATIN_ONLY` refusal exists to prevent.
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

/** Which of the two faces a run of text is drawn in. */
export type FontFace = 'winansi' | 'central';

/**
 * A string cut into runs, each drawable in one face: WinAnsi wherever a
 * character has a WinAnsi byte, the Central European face for the letters
 * only it has. Most strings are one WinAnsi run.
 */
export function runsOf(text: string): { face: FontFace; text: string }[] {
  const runs: { face: FontFace; text: string }[] = [];
  for (const character of text) {
    const face: FontFace = winAnsiByte(character) === null && centralEuropeanByte(character) !== null ? 'central' : 'winansi';
    const last = runs[runs.length - 1];
    if (last !== undefined && last.face === face) last.text += character;
    else runs.push({ face, text: character });
  }
  return runs;
}

/** A string literal in the Central European face — its bytes come from that face's own table. */
export function centralLiteral(text: string): number[] {
  const out: number[] = [0x28];
  for (const character of text) {
    const byte = centralEuropeanByte(character);
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
  /**
   * Pictures this page draws, by the resource name its stream uses (`/Im1 Do`).
   * Absent or empty: the page is written exactly as before.
   */
  readonly images?: readonly { readonly name: string; readonly image: PdfImage }[];
}

/** A resource name the stream can say as `/Name` with nothing to escape. */
const IMAGE_NAME = /^[A-Za-z][A-Za-z0-9]*$/;

/**
 * The bytes of the file, kept as the chunks they were written in.
 *
 * A picture's stream can run to megabytes, and `array.push(...chunk)` passes
 * every byte as an ARGUMENT — a few hundred thousand of them exhaust the call
 * stack. So nothing is spread: chunks are kept whole, the running length is
 * the byte count every offset is taken from, and they are copied into one
 * buffer once, at the end.
 */
class Bytes {
  private readonly chunks: (readonly number[] | Uint8Array)[] = [];
  length = 0;

  add(chunk: readonly number[] | Uint8Array): void {
    this.chunks.push(chunk);
    this.length += chunk.length;
  }

  done(): Uint8Array {
    const out = new Uint8Array(this.length);
    let at = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, at);
      at += chunk.length;
    }
    return out;
  }
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
  // The Central European face is declared only when a page draws in it, so a
  // WinAnsi document keeps exactly the objects it always had.
  const central = pages.some((page) => usesCentralFace(page.stream));
  const centralRegular = boldFont + 1;
  const centralBold = boldFont + 2;
  const fonts =
    `/F1 ${String(regularFont)} 0 R/F2 ${String(boldFont)} 0 R` +
    (central ? `/F3 ${String(centralRegular)} 0 R/F4 ${String(centralBold)} 0 R` : '');
  const differences = CENTRAL_EUROPEAN_DIFFERENCES.map(([byte, glyph]) => `${String(byte)}/${glyph}`).join(' ');
  const centralEncoding = `/Encoding<</Type/Encoding/BaseEncoding/WinAnsiEncoding/Differences[${differences}]>>`;

  const kids = pages.map((_, at) => `${String(firstPage + at)} 0 R`).join(' ');

  /*
   * PICTURES COME AFTER THE FONTS, for the same reason the fonts come after
   * the streams: the order of everything before them is exactly what it was
   * before a page could draw a picture, so a document without one keeps every
   * object number and every byte. Each distinct picture is written once, in
   * the order pages first use it, followed directly by its soft mask.
   */
  const lastFont = central ? centralBold : boldFont;
  const pictures = new Map<PdfImage, number>();
  let nextObject = lastFont + 1;
  for (const page of pages) {
    for (const { name, image } of page.images ?? []) {
      if (!IMAGE_NAME.test(name)) throw new Error(`a picture's resource name must be letters and digits: ${name}`);
      if (pictures.has(image)) continue;
      pictures.set(image, nextObject);
      nextObject += image.mask === null ? 1 : 2;
    }
  }
  const xObjects = (page: Page): string =>
    page.images === undefined || page.images.length === 0
      ? ''
      : `/XObject<<${page.images.map(({ name, image }) => `/${name} ${String(pictures.get(image)!)} 0 R`).join('')}>>`;
  const pictureObjects: (number[] | Uint8Array)[][] = [];
  for (const [image, number] of pictures) {
    const mask = image.mask === null ? '' : `/SMask ${String(number + 1)} 0 R`;
    pictureObjects.push(imageObject(image.entries + mask, image.data));
    if (image.mask !== null) pictureObjects.push(imageObject(image.mask.entries, image.mask.data));
  }

  const objects: (number[] | Uint8Array)[][] = [
    [ascii('<</Type/Catalog/Pages 2 0 R>>')],
    [ascii(`<</Type/Pages/Kids[${kids}]/Count ${String(pages.length)}>>`)],
    ...pages.map((page, at) => [
      ascii(
        `<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${pt(page.widthPt)} ${pt(page.heightPt)}]` +
          `/Resources<</Font<<${fonts}>>${xObjects(page)}>>` +
          `/Contents ${String(firstStream + at)} 0 R>>`,
      ),
    ]),
    ...pages.map((page) => [
      ascii(`<</Length ${String(page.stream.length)}>>\nstream\n`),
      page.stream,
      ascii('\nendstream'),
    ]),
    [ascii('<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>')],
    [ascii('<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold/Encoding/WinAnsiEncoding>>')],
    ...(central
      ? [
          [ascii(`<</Type/Font/Subtype/Type1/BaseFont/Helvetica${centralEncoding}>>`)],
          [ascii(`<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold${centralEncoding}>>`)],
        ]
      : []),
    ...pictureObjects,
  ];

  const bytes = new Bytes();
  bytes.add(ascii('%PDF-1.4\n'));
  const offsets: number[] = [];
  objects.forEach((body, at) => {
    // THE ONE LINE THE WHOLE FILE IS ABOUT: the offset is how many BYTES have
    // been written, never how many characters some string holds.
    offsets.push(bytes.length);
    bytes.add(ascii(`${String(at + 1)} 0 obj\n`));
    for (const chunk of body) bytes.add(chunk);
    bytes.add(ascii('\nendobj\n'));
  });

  const xref = bytes.length;
  const size = objects.length + 1;
  bytes.add(ascii(`xref\n0 ${String(size)}\n0000000000 65535 f \n`));
  for (const offset of offsets) {
    bytes.add(ascii(`${String(offset).padStart(10, '0')} 00000 n \n`));
  }
  bytes.add(ascii(`trailer\n<</Size ${String(size)}/Root 1 0 R>>\nstartxref\n${String(xref)}\n%%EOF\n`));
  return bytes.done();
}

/** An image XObject: its dictionary, then its already-filtered stream. */
function imageObject(entries: string, data: Uint8Array): (number[] | Uint8Array)[] {
  return [
    ascii(`<</Type/XObject/Subtype/Image${entries}/Length ${String(data.length)}>>\nstream\n`),
    data,
    ascii('\nendstream'),
  ];
}

/** Which `/F` name a weight maps to in the resource dictionary above. */
export function fontName(weight: FontWeight, face: FontFace = 'winansi'): string {
  if (face === 'central') return weight === 'bold' ? '/F4' : '/F3';
  return weight === 'bold' ? '/F2' : '/F1';
}

/** Whether a content stream selects the Central European face (`/F3` or `/F4 … Tf`). */
function usesCentralFace(stream: readonly number[]): boolean {
  const needle = [0x2f, 0x46]; // "/F"
  for (let at = 0; at + 3 < stream.length; at += 1) {
    if (stream[at] !== needle[0] || stream[at + 1] !== needle[1]) continue;
    const digit = stream[at + 2];
    if ((digit === 0x33 || digit === 0x34) && stream[at + 3] === 0x20) return true;
  }
  return false;
}

export { widthOf };
