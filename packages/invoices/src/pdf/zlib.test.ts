/**
 * The hand-written inflate and deflate, read against Node's own zlib.
 *
 * The shipped code cannot use `node:zlib` (it also runs in a browser, and it
 * runs synchronously), so the only honest test of it is the real thing on the
 * other side: Node writes, ours reads; ours writes, Node reads. Node's levels
 * 0, 1, 6 and 9 between them produce stored blocks, fixed-Huffman blocks and
 * dynamic-Huffman blocks, which are the three block types there are.
 */

import { deflateSync, inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { deflate, inflate } from './zlib.ts';

/** A fixed-seed xorshift: the same "random" bytes on every run, no die. */
function noise(length: number, seed = 0x9e3779b9): Uint8Array {
  const out = new Uint8Array(length);
  let state = seed >>> 0;
  for (let at = 0; at < length; at += 1) {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    out[at] = state & 0xff;
  }
  return out;
}

function repetitive(length: number): Uint8Array {
  const phrase = new TextEncoder().encode('Hearth & Loaf, 3 Mill Lane, York. Paid with thanks. ');
  const out = new Uint8Array(length);
  for (let at = 0; at < length; at += 1) out[at] = phrase[at % phrase.length]!;
  return out;
}

const INPUTS: [string, Uint8Array][] = [
  ['empty', new Uint8Array(0)],
  ['short text', new TextEncoder().encode('Signed copy')],
  ['300 KB of repetitive bytes', repetitive(300_000)],
  ['200 KB of pseudo-random bytes', noise(200_000)],
];

describe('inflate', () => {
  for (const level of [0, 1, 6, 9]) {
    for (const [name, input] of INPUTS) {
      it(`reads node:zlib level ${String(level)} over ${name}`, () => {
        const packed = new Uint8Array(deflateSync(input, { level }));
        const out = inflate(packed);
        expect(out).not.toBeNull();
        expect(out!.length).toBe(input.length);
        expect(Buffer.from(out!).equals(Buffer.from(input))).toBe(true);
      });
    }
  }

  it('gives null, never a throw, for a stream that is cut short or is not zlib', () => {
    const packed = new Uint8Array(deflateSync(noise(5000), { level: 6 }));
    expect(inflate(packed.subarray(0, packed.length - 100))).toBeNull();
    expect(inflate(packed.subarray(0, packed.length - 2))).toBeNull();
    expect(inflate(new Uint8Array([1, 2, 3, 4, 5]))).toBeNull();
    expect(inflate(new Uint8Array(0))).toBeNull();
    const flipped = packed.slice();
    flipped[200] ^= 0x55;
    expect(() => inflate(flipped)).not.toThrow();
  });

  it('stops at the limit it is given instead of filling memory', () => {
    const packed = new Uint8Array(deflateSync(repetitive(300_000)));
    expect(inflate(packed, 1000)).toBeNull();
    expect(inflate(packed, 300_000)).not.toBeNull();
  });
});

describe('deflate', () => {
  for (const [name, input] of INPUTS) {
    it(`writes ${name} so node:zlib reads back the same bytes`, () => {
      const packed = deflate(input);
      const back = inflateSync(packed);
      expect(back.length).toBe(input.length);
      expect(back.equals(Buffer.from(input))).toBe(true);
      // And our own inflate agrees.
      expect(Buffer.from(inflate(packed)!).equals(Buffer.from(input))).toBe(true);
    });
  }

  it('compresses repetitive input to less than half', () => {
    const input = repetitive(300_000);
    expect(deflate(input).length).toBeLessThan(input.length / 2);
  });

  it('never grows random input by more than a stored block costs', () => {
    const input = noise(200_000);
    // Stored blocks cost five bytes per 65,535, plus the six-byte wrapper.
    expect(deflate(input).length).toBeLessThanOrEqual(input.length + 5 * 4 + 6);
  });

  it('writes the same bytes for the same input, every time', () => {
    const input = repetitive(50_000);
    expect(Buffer.from(deflate(input)).equals(Buffer.from(deflate(input)))).toBe(true);
  });
});
