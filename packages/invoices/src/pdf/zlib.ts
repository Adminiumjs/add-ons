/**
 * zlib streams (RFC 1950) around DEFLATE (RFC 1951), read and written in
 * plain TypeScript.
 *
 * ── WHY THIS IS HAND-WRITTEN ───────────────────────────────────────────────
 *
 * A picture in a PDF is a compressed stream: a PNG's pixels arrive deflated,
 * have to be inflated to undo the PNG's row filters and split the colour from
 * the transparency, and are deflated again into the PDF. The renderer that
 * does this ships in two bundles — the server's and the browser's — and runs
 * SYNCHRONOUSLY (a click handler calls `renderSync`). That rules out every
 * ready-made answer at once: `node:zlib` does not exist in a browser,
 * `CompressionStream` is asynchronous, and a library is a runtime dependency
 * this package does not take. What is left is the format itself, which is
 * small enough to write down.
 *
 * ── WHAT EACH HALF DOES, AND DOES NOT ──────────────────────────────────────
 *
 * `inflate` reads all three block types: stored, fixed Huffman and dynamic
 * Huffman, which is everything a conforming encoder can produce. It checks
 * the zlib header and the Adler-32 at the end, and it gives `null` for any
 * stream that is cut short or malformed — never an exception, because the
 * input is a customer's picture and a bad one must leave the document drawable.
 *
 * `deflate` finds repeats with a hash chain (LZ77) and writes them with the
 * FIXED Huffman codes, which every reader knows without a table. It does not
 * build dynamic codes: on the pictures this exists for — a signature, mostly
 * transparent ground — the repeats do nearly all the work, and fixed codes
 * cost a few percent at most. When fixed codes would make a stream LARGER than
 * the input (random-looking data), it writes stored blocks instead, so the
 * output is never more than the stored framing over the input.
 *
 * Both are pure functions of their input: the same bytes in, the same bytes
 * out, in either bundle.
 */

const LENGTH_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258,
];
const LENGTH_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DISTANCE_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145,
  8193, 12289, 16385, 24577,
];
const DISTANCE_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
/** The order a dynamic block lists the code-length code's own lengths in. */
const CODE_LENGTH_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

/** The Adler-32 checksum a zlib stream ends with. */
export function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  let at = 0;
  while (at < data.length) {
    // 5552 is the most bytes that can be summed before `b` could pass 2^32.
    const end = Math.min(at + 5552, data.length);
    for (; at < end; at += 1) {
      a += data[at]!;
      b += a;
    }
    a %= 65521;
    b %= 65521;
  }
  return ((b << 16) | a) >>> 0;
}

/** `bits` reversed, `length` bits wide: DEFLATE sends Huffman codes high bit first into a low-bit-first stream. */
function reverse(code: number, length: number): number {
  let out = 0;
  for (let bit = 0; bit < length; bit += 1) out |= ((code >> bit) & 1) << (length - 1 - bit);
  return out;
}

// ── INFLATE ────────────────────────────────────────────────────────────────

/**
 * A decoding table: indexed by the next `bits` bits of input (low bit first),
 * each entry is `symbol << 4 | codeLength`, and 0 where no code lands.
 */
interface Decoder {
  readonly table: Int32Array;
  readonly bits: number;
}

/**
 * A decoder for a canonical Huffman code given its code lengths.
 *
 * An over-subscribed set of lengths (more codes than the lengths can hold) is
 * corrupt and gives `null`. An incomplete one is allowed — DEFLATE uses one for
 * a block with a single distance — and a code that lands on an unused entry
 * fails when it is read, not before.
 */
function decoderOf(lengths: ArrayLike<number>, count: number): Decoder | null {
  const perLength = new Int32Array(16);
  let longest = 0;
  for (let symbol = 0; symbol < count; symbol += 1) {
    const length = lengths[symbol]!;
    perLength[length] = perLength[length]! + 1;
    if (length > longest) longest = length;
  }
  perLength[0] = 0;
  let left = 1;
  for (let length = 1; length <= 15; length += 1) {
    left = (left << 1) - perLength[length]!;
    if (left < 0) return null;
  }
  const next = new Int32Array(16);
  let code = 0;
  for (let length = 1; length <= 15; length += 1) {
    code = (code + perLength[length - 1]!) << 1;
    next[length] = code;
  }
  const bits = Math.max(longest, 1);
  const table = new Int32Array(1 << bits);
  for (let symbol = 0; symbol < count; symbol += 1) {
    const length = lengths[symbol]!;
    if (length === 0) continue;
    const reversed = reverse(next[length]!, length);
    next[length] = next[length]! + 1;
    for (let at = reversed; at < table.length; at += 1 << length) table[at] = (symbol << 4) | length;
  }
  return { table, bits };
}

function fixedLengths(): { literal: number[]; distance: number[] } {
  const literal: number[] = [];
  for (let symbol = 0; symbol < 288; symbol += 1) {
    literal.push(symbol < 144 ? 8 : symbol < 256 ? 9 : symbol < 280 ? 7 : 8);
  }
  return { literal, distance: new Array<number>(30).fill(5) };
}

const FIXED = fixedLengths();
const FIXED_LITERAL_DECODER = decoderOf(FIXED.literal, 288)!;
const FIXED_DISTANCE_DECODER = decoderOf(FIXED.distance, 30)!;

/** Raised inside `inflate` only and caught at its edge, where it becomes `null`. */
class Corrupt extends Error {}

/** Bits off the input, low bit first, with the output it is writing into. */
class Inflater {
  private readonly input: Uint8Array;
  private readonly limit: number;
  private at: number;
  private buffer = 0;
  private count = 0;
  out: Uint8Array;
  length = 0;

  constructor(input: Uint8Array, start: number, limit: number) {
    this.input = input;
    this.limit = limit;
    this.at = start;
    this.out = new Uint8Array(Math.min(limit, Math.max(1024, input.length * 4)));
  }

  /**
   * Make at least `n` bits (n ≤ 16) available. Past the end of the input it
   * feeds zeros, because a decoder may look further ahead than the last code
   * is long; a stream that actually USES those bits is caught by `end()`. More
   * than four bytes of them can only mean a stream with no end in it.
   */
  private need(n: number): void {
    while (this.count < n) {
      const byte = this.at < this.input.length ? this.input[this.at]! : 0;
      this.at += 1;
      if (this.at > this.input.length + 4) throw new Corrupt('the stream runs past its end');
      this.buffer |= byte << this.count;
      this.count += 8;
    }
  }

  bits(n: number): number {
    if (n === 0) return 0;
    this.need(n);
    const value = this.buffer & ((1 << n) - 1);
    this.buffer >>>= n;
    this.count -= n;
    return value;
  }

  decode(decoder: Decoder): number {
    this.need(decoder.bits);
    const entry = decoder.table[this.buffer & ((1 << decoder.bits) - 1)]!;
    if (entry === 0) throw new Corrupt('a code that names no symbol');
    const length = entry & 15;
    this.buffer >>>= length;
    this.count -= length;
    return entry >> 4;
  }

  /** Drop to the next byte boundary and hand back the position of the first unread byte. */
  private align(): number {
    this.buffer = 0;
    this.at -= this.count >> 3;
    this.count = 0;
    if (this.at > this.input.length) throw new Corrupt('the stream runs past its end');
    return this.at;
  }

  private room(n: number): void {
    const needed = this.length + n;
    if (needed <= this.out.length) return;
    if (needed > this.limit) throw new Corrupt('more output than the caller allowed');
    const grown = new Uint8Array(Math.min(this.limit, Math.max(this.out.length * 2, needed)));
    grown.set(this.out.subarray(0, this.length));
    this.out = grown;
  }

  stored(): void {
    const at = this.align();
    if (at + 4 > this.input.length) throw new Corrupt('a stored block cut short');
    const size = this.input[at]! | (this.input[at + 1]! << 8);
    const check = this.input[at + 2]! | (this.input[at + 3]! << 8);
    if ((size ^ 0xffff) !== check) throw new Corrupt('a stored block whose length does not check');
    if (at + 4 + size > this.input.length) throw new Corrupt('a stored block cut short');
    this.room(size);
    this.out.set(this.input.subarray(at + 4, at + 4 + size), this.length);
    this.length += size;
    this.at = at + 4 + size;
  }

  dynamicDecoders(): [Decoder, Decoder] {
    const literals = this.bits(5) + 257;
    const distances = this.bits(5) + 1;
    const codeLengthCodes = this.bits(4) + 4;
    if (literals > 286 || distances > 30) throw new Corrupt('too many codes');
    const codeLengthLengths = new Uint8Array(19);
    for (let at = 0; at < codeLengthCodes; at += 1) codeLengthLengths[CODE_LENGTH_ORDER[at]!] = this.bits(3);
    const codeLengths = decoderOf(codeLengthLengths, 19);
    if (codeLengths === null) throw new Corrupt('an over-subscribed code');

    const lengths = new Uint8Array(literals + distances);
    let at = 0;
    while (at < lengths.length) {
      const symbol = this.decode(codeLengths);
      if (symbol < 16) {
        lengths[at] = symbol;
        at += 1;
        continue;
      }
      let repeat: number;
      let value = 0;
      if (symbol === 16) {
        if (at === 0) throw new Corrupt('a repeat with nothing before it');
        value = lengths[at - 1]!;
        repeat = 3 + this.bits(2);
      } else if (symbol === 17) {
        repeat = 3 + this.bits(3);
      } else {
        repeat = 11 + this.bits(7);
      }
      if (at + repeat > lengths.length) throw new Corrupt('a repeat past the last code');
      lengths.fill(value, at, at + repeat);
      at += repeat;
    }
    if (lengths[256] === 0) throw new Corrupt('a block that cannot end');
    const literal = decoderOf(lengths.subarray(0, literals), literals);
    const distance = decoderOf(lengths.subarray(literals), distances);
    if (literal === null || distance === null) throw new Corrupt('an over-subscribed code');
    return [literal, distance];
  }

  huffman(literal: Decoder, distance: Decoder): void {
    for (;;) {
      let symbol = this.decode(literal);
      if (symbol < 256) {
        this.room(1);
        this.out[this.length] = symbol;
        this.length += 1;
        continue;
      }
      if (symbol === 256) return;
      symbol -= 257;
      if (symbol >= 29) throw new Corrupt('a length code that does not exist');
      const size = LENGTH_BASE[symbol]! + this.bits(LENGTH_EXTRA[symbol]!);
      const code = this.decode(distance);
      if (code >= 30) throw new Corrupt('a distance code that does not exist');
      const back = DISTANCE_BASE[code]! + this.bits(DISTANCE_EXTRA[code]!);
      if (back > this.length) throw new Corrupt('a distance before the start of the output');
      this.room(size);
      const out = this.out;
      let to = this.length;
      // Byte by byte, because a copy may overlap what it is writing: a
      // distance of 1 and a length of 200 is a run of one repeated byte.
      for (let from = to - back, end = to + size; to < end; to += 1, from += 1) out[to] = out[from]!;
      this.length = to;
    }
  }

  /** The four bytes after the last block: the Adler-32 of everything inflated. */
  end(): Uint8Array {
    const at = this.align();
    if (at + 4 > this.input.length) throw new Corrupt('no checksum at the end');
    const declared =
      ((this.input[at]! << 24) | (this.input[at + 1]! << 16) | (this.input[at + 2]! << 8) | this.input[at + 3]!) >>> 0;
    const out = this.out.subarray(0, this.length);
    if (declared !== adler32(out)) throw new Corrupt('the checksum does not match');
    return out;
  }
}

/**
 * The bytes a zlib stream holds, or `null` when it is not one, is damaged, or
 * would inflate to more than `limit` bytes (a picture's caller knows exactly
 * how many bytes its pixels take, and a stream that claims more is refused
 * before it fills memory).
 */
export function inflate(input: Uint8Array, limit = Number.MAX_SAFE_INTEGER): Uint8Array | null {
  try {
    if (input.length < 6) return null;
    const method = input[0]!;
    const flags = input[1]!;
    // Method 8 (deflate), a window no bigger than 32 KiB, a header that checks,
    // and no preset dictionary (which nothing here could supply).
    if ((method & 0x0f) !== 8 || method >> 4 > 7 || ((method << 8) | flags) % 31 !== 0 || (flags & 0x20) !== 0) {
      return null;
    }
    const reader = new Inflater(input, 2, limit);
    let last = 0;
    while (last === 0) {
      last = reader.bits(1);
      const type = reader.bits(2);
      if (type === 0) reader.stored();
      else if (type === 1) reader.huffman(FIXED_LITERAL_DECODER, FIXED_DISTANCE_DECODER);
      else if (type === 2) reader.huffman(...reader.dynamicDecoders());
      else return null;
    }
    return reader.end();
  } catch {
    // Every corrupt shape is a `Corrupt`; anything else (an allocation the
    // engine refused) is equally a picture that cannot be drawn.
    return null;
  }
}

// ── DEFLATE ────────────────────────────────────────────────────────────────

/** The fixed literal/length codes, already reversed for the bit stream. */
const FIXED_LITERAL_CODES = (() => {
  const codes = new Int32Array(288);
  for (let symbol = 0; symbol < 288; symbol += 1) {
    if (symbol < 144) codes[symbol] = reverse(0x30 + symbol, 8);
    else if (symbol < 256) codes[symbol] = reverse(0x190 + symbol - 144, 9);
    else if (symbol < 280) codes[symbol] = reverse(symbol - 256, 7);
    else codes[symbol] = reverse(0xc0 + symbol - 280, 8);
  }
  return codes;
})();
const FIXED_DISTANCE_CODES = Int32Array.from({ length: 30 }, (_, symbol) => reverse(symbol, 5));

/** Match length (3..258) → its length symbol's index (0..28). */
const LENGTH_SYMBOL = (() => {
  const table = new Uint8Array(259);
  for (let index = 0; index < 29; index += 1) {
    const span = index === 28 ? 1 : 1 << LENGTH_EXTRA[index]!;
    for (let size = LENGTH_BASE[index]!; size < LENGTH_BASE[index]! + span && size <= 258; size += 1) table[size] = index;
  }
  table[258] = 28;
  return table;
})();

/** Distance (1..32768) → its distance symbol (0..29). */
const DISTANCE_SYMBOL = (() => {
  const table = new Uint8Array(32769);
  for (let index = 0; index < 30; index += 1) {
    const end = Math.min(32768, DISTANCE_BASE[index]! + (1 << DISTANCE_EXTRA[index]!) - 1);
    for (let back = DISTANCE_BASE[index]!; back <= end; back += 1) table[back] = index;
  }
  return table;
})();

/** Bits out, low bit first, into a buffer that grows by doubling. */
class BitWriter {
  out: Uint8Array;
  length = 0;
  private buffer = 0;
  private count = 0;

  constructor(sizeHint: number) {
    this.out = new Uint8Array(Math.max(64, sizeHint));
  }

  byte(value: number): void {
    if (this.length === this.out.length) {
      const grown = new Uint8Array(this.out.length * 2);
      grown.set(this.out);
      this.out = grown;
    }
    this.out[this.length] = value;
    this.length += 1;
  }

  /** `n` ≤ 16 bits of `value`. */
  bits(value: number, n: number): void {
    this.buffer |= value << this.count;
    this.count += n;
    while (this.count >= 8) {
      this.byte(this.buffer & 0xff);
      this.buffer >>>= 8;
      this.count -= 8;
    }
  }

  flush(): void {
    if (this.count > 0) this.byte(this.buffer & 0xff);
    this.buffer = 0;
    this.count = 0;
  }

  bytes(): Uint8Array {
    return this.out.slice(0, this.length);
  }
}

const WINDOW = 32768;
const HASH_SIZE = 1 << 15;
/** How many earlier places with the same three bytes are tried for each match. */
const CHAIN_LIMIT = 64;

/** The deflate data as one final fixed-Huffman block. */
function fixedBlock(input: Uint8Array, out: BitWriter): void {
  const n = input.length;
  const head = new Int32Array(HASH_SIZE).fill(-1);
  const previous = new Int32Array(WINDOW);
  const hashAt = (at: number) => ((input[at]! << 10) ^ (input[at + 1]! << 5) ^ input[at + 2]!) & (HASH_SIZE - 1);
  const remember = (at: number) => {
    const hash = hashAt(at);
    previous[at & (WINDOW - 1)] = head[hash]!;
    head[hash] = at;
  };

  out.bits(1, 1); // the last block
  out.bits(1, 2); // fixed Huffman codes
  let at = 0;
  while (at < n) {
    let bestLength = 0;
    let bestBack = 0;
    if (at + 2 < n) {
      const longest = Math.min(258, n - at);
      let candidate = head[hashAt(at)]!;
      let tries = CHAIN_LIMIT;
      while (candidate >= 0 && at - candidate <= WINDOW && tries > 0) {
        tries -= 1;
        // Cheap test first: a candidate that cannot beat the best so far
        // differs at the byte that would make it longer.
        if (input[candidate + bestLength] === input[at + bestLength]) {
          let size = 0;
          while (size < longest && input[candidate + size] === input[at + size]) size += 1;
          if (size > bestLength) {
            bestLength = size;
            bestBack = at - candidate;
            if (size === longest) break;
          }
        }
        const earlier = previous[candidate & (WINDOW - 1)]!;
        if (earlier >= candidate) break;
        candidate = earlier;
      }
      remember(at);
    }
    if (bestLength >= 3) {
      const index = LENGTH_SYMBOL[bestLength]!;
      const symbol = 257 + index;
      out.bits(FIXED_LITERAL_CODES[symbol]!, symbol < 280 ? 7 : 8);
      out.bits(bestLength - LENGTH_BASE[index]!, LENGTH_EXTRA[index]!);
      const code = DISTANCE_SYMBOL[bestBack]!;
      out.bits(FIXED_DISTANCE_CODES[code]!, 5);
      out.bits(bestBack - DISTANCE_BASE[code]!, DISTANCE_EXTRA[code]!);
      for (let inside = at + 1; inside < at + bestLength; inside += 1) if (inside + 2 < n) remember(inside);
      at += bestLength;
    } else {
      const byte = input[at]!;
      out.bits(FIXED_LITERAL_CODES[byte]!, byte < 144 ? 8 : 9);
      at += 1;
    }
  }
  out.bits(FIXED_LITERAL_CODES[256]!, 7); // end of block
  out.flush();
}

/** The deflate data as stored blocks of at most 65,535 bytes each. */
function storedBlocks(input: Uint8Array, out: BitWriter): void {
  let at = 0;
  do {
    const size = Math.min(65535, input.length - at);
    const last = at + size >= input.length;
    out.byte(last ? 1 : 0);
    out.byte(size & 0xff);
    out.byte(size >> 8);
    out.byte(~size & 0xff);
    out.byte((~size >> 8) & 0xff);
    for (let from = at; from < at + size; from += 1) out.byte(input[from]!);
    at += size;
  } while (at < input.length);
}

function wrapped(input: Uint8Array, body: (input: Uint8Array, out: BitWriter) => void, sizeHint: number): Uint8Array {
  const out = new BitWriter(sizeHint);
  // 0x78 0x9c: deflate, 32 KiB window, default level, no dictionary.
  out.byte(0x78);
  out.byte(0x9c);
  body(input, out);
  const sum = adler32(input);
  out.byte(sum >>> 24);
  out.byte((sum >>> 16) & 0xff);
  out.byte((sum >>> 8) & 0xff);
  out.byte(sum & 0xff);
  return out.bytes();
}

/** `input` as a zlib stream: fixed-Huffman LZ77, or stored blocks when those are smaller. */
export function deflate(input: Uint8Array): Uint8Array {
  const storedSize = 6 + input.length + 5 * Math.max(1, Math.ceil(input.length / 65535));
  const packed = wrapped(input, fixedBlock, Math.min(storedSize, 1 << 16));
  return packed.length <= storedSize ? packed : wrapped(input, storedBlocks, storedSize);
}
