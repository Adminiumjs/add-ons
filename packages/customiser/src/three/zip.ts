/**
 * A ZIP, READ AND WRITTEN IN THE BROWSER: enough for a 3MF, nothing more.
 *
 * Reading: a zip is read from its central directory (the list at its end),
 * never by walking its entries from the front, and held to caps before a
 * byte of any entry is unpacked: at most `maxEntries` entries, each and all
 * of them together unpacking to at most `maxUnpacked` bytes, no encrypted
 * entry, only stored and deflated ones. An entry is unpacked by the
 * browser's own `DecompressionStream`, stopped at its declared size, and its
 * checksum checked. Adminium reads a stored 3MF again by the same rules.
 *
 * Writing: every entry stored as it is (no packing, so no library), each
 * with its checksum, its local header saying what the directory says.
 */

export interface ZipEntry {
  name: string;
  method: 0 | 8;
  /** The entry's checksum, its size packed and its size unpacked, as the directory says. */
  crc: number;
  packed: number;
  size: number;
  /** Where its local header starts. */
  offset: number;
}

/** Why a zip is not read: not a zip, more entries or bytes than taken, or damaged. */
export type ZipProblem = 'not-zip' | 'too-many' | 'too-big' | 'damaged';

export class ZipRefused extends Error {
  readonly problem: ZipProblem;
  constructor(problem: ZipProblem) {
    super(problem);
    this.problem = problem;
  }
}

/** A 3MF's caps, as Adminium holds a stored one to: 64 entries, 200 MB unpacked. */
export const ZIP_MAX_ENTRIES = 64;
export const ZIP_MAX_UNPACKED = 200 * 1024 * 1024;

let table: Uint32Array | null = null;

/** The zip's checksum (CRC-32) of some bytes. */
export function crc32(bytes: Uint8Array): number {
  if (table === null) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = table[(c ^ bytes[i]!) & 255]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const END = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

/** The entries a zip's central directory lists, held to the caps; refused where it is not a zip or is past them. */
export function zipEntries(bytes: Uint8Array, maxEntries = ZIP_MAX_ENTRIES, maxUnpacked = ZIP_MAX_UNPACKED): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The directory's end record is in the last 22 bytes, or before a comment of at most 65,535 bytes.
  let end = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 22 - 65_535); at -= 1) {
    if (view.getUint32(at, true) === END) {
      end = at;
      break;
    }
  }
  if (end < 0) throw new ZipRefused('not-zip');
  const count = view.getUint16(end + 10, true);
  const size = view.getUint32(end + 12, true);
  const start = view.getUint32(end + 16, true);
  // A zip of more than 65,535 entries (or a zip64) says so with all ones: more than any 3MF is taken with.
  if (count > maxEntries) throw new ZipRefused('too-many');
  if (count === 0 || start + size > end) throw new ZipRefused('damaged');
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const out: ZipEntry[] = [];
  let at = start;
  let total = 0;
  for (let i = 0; i < count; i += 1) {
    if (at + 46 > end || view.getUint32(at, true) !== CENTRAL) throw new ZipRefused('damaged');
    const flags = view.getUint16(at + 8, true);
    const method = view.getUint16(at + 10, true);
    const crc = view.getUint32(at + 16, true);
    const packed = view.getUint32(at + 20, true);
    const unpacked = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const extra = view.getUint16(at + 30, true);
    const comment = view.getUint16(at + 32, true);
    const offset = view.getUint32(at + 42, true);
    // An encrypted entry, or one packed some other way, is not read.
    if ((flags & 0x41) !== 0 || (method !== 0 && method !== 8)) throw new ZipRefused('damaged');
    if (unpacked > maxUnpacked || packed === 0xffffffff || offset + 30 > start) throw new ZipRefused(unpacked > maxUnpacked ? 'too-big' : 'damaged');
    total += unpacked;
    if (total > maxUnpacked) throw new ZipRefused('too-big');
    out.push({ name: decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength)), method, crc, packed, size: unpacked, offset });
    at += 46 + nameLength + extra + comment;
  }
  return out;
}

/** An entry's bytes, unpacked, its size and checksum the directory's; refused where they are not. */
export async function zipEntryBytes(bytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(entry.offset, true) !== LOCAL) throw new ZipRefused('damaged');
  const from = entry.offset + 30 + view.getUint16(entry.offset + 26, true) + view.getUint16(entry.offset + 28, true);
  if (from + entry.packed > bytes.length) throw new ZipRefused('damaged');
  const packed = bytes.subarray(from, from + entry.packed);
  const data = entry.method === 0 ? packed : await inflate(packed, entry.size);
  if (data.length !== entry.size || crc32(data) !== entry.crc) throw new ZipRefused('damaged');
  return data;
}

/** Deflated bytes unpacked by the browser, read no further than `size` and one byte (a lie about the size is caught). */
async function inflate(packed: Uint8Array, size: number): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new ZipRefused('damaged');
  const reader = new Blob([packed as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const out = new Uint8Array(size);
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (length + value.length > size) {
        await reader.cancel();
        throw new ZipRefused('damaged');
      }
      out.set(value, length);
      length += value.length;
    }
  } catch (caught) {
    throw caught instanceof ZipRefused ? caught : new ZipRefused('damaged');
  }
  return out.subarray(0, length);
}

/** A zip of the given files, each stored as it is. */
export function zipStored(files: readonly { name: string; data: Uint8Array }[]): Uint8Array {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, LOCAL, true);
    local.setUint16(4, 20, true);
    // Flags, method, time and date: none, stored, and nothing said of when (0 is a date no reader minds).
    local.setUint32(14, crc, true);
    local.setUint32(18, file.data.length, true);
    local.setUint32(22, file.data.length, true);
    local.setUint16(26, name.length, true);
    locals.push(new Uint8Array(local.buffer), name, file.data);
    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, CENTRAL, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, file.data.length, true);
    central.setUint32(24, file.data.length, true);
    central.setUint16(28, name.length, true);
    central.setUint32(42, offset, true);
    centrals.push(new Uint8Array(central.buffer), name);
    offset += 30 + name.length + file.data.length;
  }
  const directory = centrals.reduce((sum, one) => sum + one.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, END, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, directory, true);
  end.setUint32(16, offset, true);
  const parts = [...locals, ...centrals, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((sum, one) => sum + one.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
