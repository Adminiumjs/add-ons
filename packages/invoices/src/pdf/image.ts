/**
 * A PNG or JPEG picture, turned into what a PDF image object holds.
 *
 * ── WHY A DOCUMENT NEEDS THIS ──────────────────────────────────────────────
 *
 * A signed copy prints the customer's signature, and the engine hands that
 * signature over as a data URL: usually a PNG drawn on a phone, 8-bit RGBA on
 * a transparent ground. A PDF cannot hold a PNG file as it is. It holds an
 * image object — samples, a colour space, a filter — and transparency as a
 * SECOND image object (a soft mask) that the first one points at.
 *
 * ── WHAT HAPPENS TO EACH KIND ──────────────────────────────────────────────
 *
 * JPEG passes through untouched: a PDF reader decodes it itself
 * (`/DCTDecode`), so all this file reads is the frame header — size, number
 * of components, bit depth — and whether an Adobe marker says the CMYK is
 * stored inverted, as Adobe's encoders write it.
 *
 * PNG is decoded all the way to pixels: the IDAT chunks inflated, the five row
 * filters undone, an interlaced file put back together, low bit depths spread
 * to eight bits and sixteen taken to eight by the high byte, a palette looked
 * up into RGB. The colour becomes one 8-bit DeviceGray or DeviceRGB image;
 * the alpha channel, or a `tRNS` key, becomes an 8-bit DeviceGray soft mask.
 * Both are compressed again with this package's own deflate (`zlib.ts`
 * explains why it is hand-written). A picture whose every pixel turns out
 * opaque gets no mask at all.
 *
 * ── THE DECISIONS, STATED ──────────────────────────────────────────────────
 *
 * THE BYTES DECIDE. The declared media type and the width and height that come
 * with the picture are hints. What the file IS is read from its signature, and
 * its size from its own header — the size a reader will draw it at is the
 * header's, so a disagreement could only be resolved one way anyway.
 *
 * EVERY PNG IS DECODED, none copied through. A PDF can carry a plain PNG's
 * IDAT as it is (with a PNG predictor), but then a damaged file would be found
 * by the customer's PDF viewer instead of here. Decoding everything means a
 * bad picture is `null` before a byte is written, and there is one path to
 * test instead of two.
 *
 * NO THROWS. `pdfImageOf` answers `null` for anything it cannot draw — not a
 * PNG or JPEG, damaged, a variant a PDF cannot carry, or more than 16,777,216
 * pixels (checked from the header, before anything is inflated). The chunk
 * CRCs are not checked: damage to the image data is caught by the inflater's
 * own checks and Adler-32, and damage anywhere else that still parses changes
 * nothing that is drawn.
 *
 * Everything here is a pure function of the picture: no clock, no randomness,
 * no platform API, so the server and the browser write the same bytes.
 */

import { deflate, inflate } from './zlib.ts';

/** A picture as the engine hands it over. */
export interface PictureInput {
  readonly mediaType: string;
  readonly dataUrl: string;
  readonly width: number;
  readonly height: number;
}

/**
 * A picture ready to write as a PDF image object (plus its soft mask when it
 * has transparency). Opaque to callers except `width` and `height`: the rest
 * is what `writePdf` copies into the file.
 */
export interface PdfImage {
  readonly width: number;
  readonly height: number;
  /** The image dictionary's own entries — size, colour space, depth, filter — without `/Length` or `/SMask`. */
  readonly entries: string;
  /** The stream's bytes, already in the filter `entries` names. */
  readonly data: Uint8Array;
  /** The soft mask, an 8-bit DeviceGray image of the same size, or `null` for an opaque picture. */
  readonly mask: { readonly entries: string; readonly data: Uint8Array } | null;
}

/** The most pixels a picture may have: 4096 × 4096. */
const MOST_PIXELS = 16_777_216;

/** The PNG or JPEG behind a data URL, ready for a PDF; `null` when it cannot be drawn. Never throws. */
export function pdfImageOf(picture: PictureInput): PdfImage | null {
  try {
    const bytes = bytesOfDataUrl(picture.dataUrl);
    if (bytes === null) return null;
    if (startsWith(bytes, PNG_SIGNATURE)) return fromPng(bytes);
    if (startsWith(bytes, [0xff, 0xd8, 0xff])) return fromJpeg(bytes);
    return null;
  } catch {
    // Every path above answers `null` for what it recognises as wrong; this is
    // for what it did not foresee, so a bad picture never takes the document
    // down with it.
    return null;
  }
}

function startsWith(bytes: Uint8Array, prefix: readonly number[]): boolean {
  if (bytes.length < prefix.length) return false;
  return prefix.every((byte, at) => bytes[at] === byte);
}

function u16(bytes: Uint8Array, at: number): number {
  return (bytes[at]! << 8) | bytes[at + 1]!;
}

function u32(bytes: Uint8Array, at: number): number {
  return ((bytes[at]! << 24) | (bytes[at + 1]! << 16) | (bytes[at + 2]! << 8) | bytes[at + 3]!) >>> 0;
}

// ── THE DATA URL ───────────────────────────────────────────────────────────

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_VALUE = (() => {
  const values = new Int8Array(128).fill(-1);
  for (let at = 0; at < BASE64_ALPHABET.length; at += 1) values[BASE64_ALPHABET.charCodeAt(at)] = at;
  return values;
})();

/**
 * The bytes of a `data:<type>;base64,<payload>` URL. Decoded here rather than
 * with `atob`, which a browser has and older Node lacks, and which returns a
 * string to be copied out again. Whitespace in the payload is skipped; any
 * other character outside the alphabet makes the whole URL `null`.
 */
function bytesOfDataUrl(url: string): Uint8Array | null {
  const comma = url.indexOf(',');
  if (comma < 0) return null;
  const head = url.slice(0, comma).toLowerCase();
  if (!head.startsWith('data:') || !head.endsWith(';base64')) return null;

  const out = new Uint8Array(Math.floor(((url.length - comma - 1) * 3) / 4));
  let length = 0;
  let group = 0;
  let held = 0;
  let padding = 0;
  for (let at = comma + 1; at < url.length; at += 1) {
    const code = url.charCodeAt(at);
    if (code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d) continue;
    if (code === 0x3d) {
      padding += 1;
      continue;
    }
    // Nothing may follow the padding, and only two `=` are ever needed.
    if (padding > 0) return null;
    const value = code < 128 ? BASE64_VALUE[code]! : -1;
    if (value < 0) return null;
    group = (group << 6) | value;
    held += 1;
    if (held === 4) {
      out[length] = group >> 16;
      out[length + 1] = (group >> 8) & 0xff;
      out[length + 2] = group & 0xff;
      length += 3;
      group = 0;
      held = 0;
    }
  }
  if (padding > 2 || held === 1) return null;
  if (held === 2) {
    out[length] = (group >> 4) & 0xff;
    length += 1;
  } else if (held === 3) {
    out[length] = (group >> 10) & 0xff;
    out[length + 1] = (group >> 2) & 0xff;
    length += 2;
  }
  return out.subarray(0, length);
}

// ── JPEG ───────────────────────────────────────────────────────────────────

/**
 * A JPEG, passed through. Only the markers before the first scan are read:
 * the frame header for the size, and an Adobe APP14 for inverted CMYK. Every
 * other marker segment is skipped by its own length.
 */
function fromJpeg(bytes: Uint8Array): PdfImage | null {
  let at = 2;
  let frame: { width: number; height: number; components: number } | null = null;
  let adobe = false;
  for (;;) {
    if (at >= bytes.length || bytes[at] !== 0xff) return null;
    // Any number of 0xFF fill bytes may come before a marker.
    while (at < bytes.length && bytes[at] === 0xff) at += 1;
    if (at >= bytes.length) return null;
    const marker = bytes[at]!;
    at += 1;
    // The markers that stand alone, with no length after them.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xd9) return null; // the image ended before any scan
    if (at + 2 > bytes.length) return null;
    const length = u16(bytes, at);
    if (length < 2 || at + length > bytes.length) return null;
    const segment = bytes.subarray(at + 2, at + length);

    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      // Baseline, extended and progressive Huffman: what `/DCTDecode` reads.
      if (segment.length < 6) return null;
      const precision = segment[0]!;
      const components = segment[5]!;
      if (precision !== 8 || segment.length < 6 + 3 * components) return null;
      frame = { height: u16(segment, 1), width: u16(segment, 3), components };
    } else if (
      (marker >= 0xc3 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc)
    ) {
      // Lossless, hierarchical and arithmetic-coded frames: not every PDF
      // reader decodes them, so they are refused rather than drawn blank.
      return null;
    } else if (marker === 0xee) {
      if (segment.length >= 5 && String.fromCharCode(...segment.subarray(0, 5)) === 'Adobe') adobe = true;
    } else if (marker === 0xda) {
      break;
    }
    at += length;
  }

  if (frame === null || frame.width === 0 || frame.height === 0) return null;
  if (frame.width * frame.height > MOST_PIXELS) return null;
  const space = frame.components === 1 ? 'DeviceGray' : frame.components === 3 ? 'DeviceRGB' : frame.components === 4 ? 'DeviceCMYK' : null;
  if (space === null) return null;
  const decode = frame.components === 4 && adobe ? '/Decode[1 0 1 0 1 0 1 0]' : '';
  return {
    width: frame.width,
    height: frame.height,
    entries: `/Width ${String(frame.width)}/Height ${String(frame.height)}/ColorSpace/${space}/BitsPerComponent 8${decode}/Filter/DCTDecode`,
    data: bytes,
    mask: null,
  };
}

// ── PNG ────────────────────────────────────────────────────────────────────

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

/** Samples per pixel for each PNG colour type. */
const CHANNELS: Readonly<Record<number, number>> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
/** The bit depths the PNG specification allows for each colour type. */
const DEPTHS: Readonly<Record<number, readonly number[]>> = {
  0: [1, 2, 4, 8, 16],
  2: [8, 16],
  3: [1, 2, 4, 8],
  4: [8, 16],
  6: [8, 16],
};

/** Adam7's seven passes: first column, first row, column step, row step. */
const ADAM7: readonly (readonly [number, number, number, number])[] = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2],
];
const WHOLE: readonly (readonly [number, number, number, number])[] = [[0, 0, 1, 1]];

interface Header {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly colourType: number;
  readonly interlaced: boolean;
}

function fromPng(bytes: Uint8Array): PdfImage | null {
  let header: Header | null = null;
  let palette: Uint8Array | null = null;
  let transparency: Uint8Array | null = null;
  const parts: Uint8Array[] = [];
  let packedLength = 0;

  let at = 8;
  while (at + 8 <= bytes.length) {
    const length = u32(bytes, at);
    const type = String.fromCharCode(bytes[at + 4]!, bytes[at + 5]!, bytes[at + 6]!, bytes[at + 7]!);
    const start = at + 8;
    // A chunk that runs past the file is a file cut short.
    if (length > bytes.length || start + length + 4 > bytes.length) return null;
    const data = bytes.subarray(start, start + length);
    if (header === null && type !== 'IHDR') return null;
    if (type === 'IHDR') {
      if (length !== 13 || header !== null) return null;
      header = headerOf(data);
      if (header === null) return null;
    } else if (type === 'PLTE') {
      palette = data;
    } else if (type === 'tRNS') {
      transparency = data;
    } else if (type === 'IDAT') {
      parts.push(data);
      packedLength += data.length;
    } else if (type === 'IEND') {
      break;
    }
    at = start + length + 4;
  }
  if (header === null || parts.length === 0) return null;
  if (header.colourType === 3 && (palette === null || palette.length === 0 || palette.length % 3 !== 0 || palette.length > 768)) {
    return null;
  }

  const packed = new Uint8Array(packedLength);
  let offset = 0;
  for (const part of parts) {
    packed.set(part, offset);
    offset += part.length;
  }

  const passes = header.interlaced ? ADAM7 : WHOLE;
  const bitsPerPixel = CHANNELS[header.colourType]! * header.depth;
  let expected = 0;
  for (const [x0, y0, dx, dy] of passes) {
    const columns = Math.ceil((header.width - x0) / dx);
    const rows = Math.ceil((header.height - y0) / dy);
    if (columns > 0 && rows > 0) expected += rows * (1 + Math.ceil((columns * bitsPerPixel) / 8));
  }
  const raw = inflate(packed, expected);
  if (raw === null || raw.length !== expected) return null;
  return pixelsOf(raw, header, passes, palette, transparency);
}

function headerOf(data: Uint8Array): Header | null {
  const width = u32(data, 0);
  const height = u32(data, 4);
  const depth = data[8]!;
  const colourType = data[9]!;
  if (width === 0 || height === 0 || width * height > MOST_PIXELS) return null;
  if (!(DEPTHS[colourType] ?? []).includes(depth)) return null;
  // Compression and filter method 0 are the only ones defined; interlace is 0 or 1.
  if (data[10] !== 0 || data[11] !== 0 || data[12]! > 1) return null;
  return { width, height, depth, colourType, interlaced: data[12] === 1 };
}

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const toLeft = Math.abs(estimate - left);
  const toUp = Math.abs(estimate - up);
  const toUpLeft = Math.abs(estimate - upLeft);
  if (toLeft <= toUp && toLeft <= toUpLeft) return left;
  return toUp <= toUpLeft ? up : upLeft;
}

/**
 * Undo the row filters of one pass, in place. Each row is a filter byte and
 * `rowBytes` of data; every filter predicts a byte from the one `step` bytes
 * to its left, the one above it, or both, and both of those are already
 * restored by the time it is reached.
 */
function unfilter(raw: Uint8Array, start: number, rows: number, rowBytes: number, step: number): boolean {
  for (let row = 0; row < rows; row += 1) {
    const line = start + row * (rowBytes + 1);
    const filter = raw[line]!;
    const first = line + 1;
    const above = first - (rowBytes + 1); // only read when row > 0
    const hasAbove = row > 0;
    switch (filter) {
      case 0:
        break;
      case 1:
        for (let at = step; at < rowBytes; at += 1) raw[first + at] = (raw[first + at]! + raw[first + at - step]!) & 0xff;
        break;
      case 2:
        if (!hasAbove) break;
        for (let at = 0; at < rowBytes; at += 1) raw[first + at] = (raw[first + at]! + raw[above + at]!) & 0xff;
        break;
      case 3:
        for (let at = 0; at < rowBytes; at += 1) {
          const left = at >= step ? raw[first + at - step]! : 0;
          const up = hasAbove ? raw[above + at]! : 0;
          raw[first + at] = (raw[first + at]! + ((left + up) >> 1)) & 0xff;
        }
        break;
      case 4:
        for (let at = 0; at < rowBytes; at += 1) {
          const left = at >= step ? raw[first + at - step]! : 0;
          const up = hasAbove ? raw[above + at]! : 0;
          const upLeft = hasAbove && at >= step ? raw[above + at - step]! : 0;
          raw[first + at] = (raw[first + at]! + paeth(left, up, upLeft)) & 0xff;
        }
        break;
      default:
        return false;
    }
  }
  return true;
}

/**
 * The unfiltered samples, spread to 8-bit colour and alpha planes the size of
 * the whole picture, then compressed for the PDF.
 */
function pixelsOf(
  raw: Uint8Array,
  header: Header,
  passes: readonly (readonly [number, number, number, number])[],
  palette: Uint8Array | null,
  transparency: Uint8Array | null,
): PdfImage | null {
  const { width, height, depth, colourType } = header;
  const channels = CHANNELS[colourType]!;
  const grey = colourType === 0 || colourType === 4;
  const outChannels = grey ? 1 : 3;
  const colour = new Uint8Array(width * height * outChannels);
  const alpha = new Uint8Array(width * height).fill(255);
  let translucent = false;

  // A low-depth grey sample spread across 0..255: 1 bit → ×255, 2 → ×85, 4 → ×17.
  const spread = depth < 8 ? 255 / ((1 << depth) - 1) : 1;
  const sampleMask = (1 << depth) - 1;
  // The tRNS key colour for grey and RGB pictures, compared at the file's own depth.
  const key =
    transparency === null
      ? null
      : colourType === 0 && transparency.length >= 2
        ? [u16(transparency, 0)]
        : colourType === 2 && transparency.length >= 6
          ? [u16(transparency, 0), u16(transparency, 2), u16(transparency, 4)]
          : null;
  const paletteAlpha = colourType === 3 ? transparency : null;
  const paletteCount = palette === null ? 0 : palette.length / 3;

  const step = Math.max(1, (channels * depth) >> 3);
  const samples = new Array<number>(channels).fill(0);
  let start = 0;
  for (const [x0, y0, dx, dy] of passes) {
    const columns = Math.ceil((width - x0) / dx);
    const rows = Math.ceil((height - y0) / dy);
    if (columns <= 0 || rows <= 0) continue;
    const rowBytes = Math.ceil((columns * channels * depth) / 8);
    if (!unfilter(raw, start, rows, rowBytes, step)) return null;

    for (let row = 0; row < rows; row += 1) {
      const first = start + row * (rowBytes + 1) + 1;
      const y = y0 + row * dy;
      for (let column = 0; column < columns; column += 1) {
        for (let channel = 0; channel < channels; channel += 1) {
          const index = column * channels + channel;
          if (depth === 8) samples[channel] = raw[first + index]!;
          else if (depth === 16) samples[channel] = (raw[first + index * 2]! << 8) | raw[first + index * 2 + 1]!;
          else {
            const bit = index * depth;
            samples[channel] = (raw[first + (bit >> 3)]! >> (8 - depth - (bit & 7))) & sampleMask;
          }
        }
        const pixel = y * width + x0 + column * dx;
        let opacity = 255;
        if (colourType === 3) {
          const entry = samples[0]!;
          // An index past the palette draws black, as browsers draw it.
          if (entry < paletteCount) {
            colour[pixel * 3] = palette![entry * 3]!;
            colour[pixel * 3 + 1] = palette![entry * 3 + 1]!;
            colour[pixel * 3 + 2] = palette![entry * 3 + 2]!;
          }
          if (paletteAlpha !== null && entry < paletteAlpha.length) opacity = paletteAlpha[entry]!;
        } else {
          for (let channel = 0; channel < outChannels; channel += 1) {
            const value = samples[channel]!;
            colour[pixel * outChannels + channel] = depth === 16 ? value >> 8 : depth === 8 ? value : Math.round(value * spread);
          }
          if (channels === 2 || channels === 4) {
            const value = samples[channels - 1]!;
            opacity = depth === 16 ? value >> 8 : value;
          } else if (key !== null && key.every((wanted, channel) => samples[channel] === wanted)) {
            opacity = 0;
          }
        }
        if (opacity !== 255) {
          alpha[pixel] = opacity;
          translucent = true;
        }
      }
    }
    start += rows * (rowBytes + 1);
  }

  const size = `/Width ${String(width)}/Height ${String(height)}`;
  return {
    width,
    height,
    entries: `${size}/ColorSpace/${grey ? 'DeviceGray' : 'DeviceRGB'}/BitsPerComponent 8/Filter/FlateDecode`,
    data: deflate(colour),
    mask: translucent
      ? { entries: `${size}/ColorSpace/DeviceGray/BitsPerComponent 8/Filter/FlateDecode`, data: deflate(alpha) }
      : null,
  };
}
