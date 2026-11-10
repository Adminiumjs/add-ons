/**
 * THE SHOP'S FONTS IN THE DASHBOARD: each file loaded once, under the
 * Customiser's own name, again when the file is replaced, and again after a
 * load that failed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { forgetLoadedFamilies, loadFamilies, shopFamily } from './stored.ts';

const id = (n: number): string => `file_01JX${'0'.repeat(20)}${String(n).padStart(2, '0')}`;
let made: string[];
let added: string[];
let removed: string[];
let failing: Set<string>;

class Face {
  readonly family: string;
  readonly source: string;
  constructor(family: string, source: string) {
    this.family = family;
    this.source = source;
    made.push(`${family} ${source}`);
  }
  load(): Promise<Face> {
    return [...failing].some((file) => this.source.includes(file)) ? Promise.reject(new Error('network')) : Promise.resolve(this);
  }
}

beforeEach(() => {
  made = [];
  added = [];
  removed = [];
  failing = new Set();
  forgetLoadedFamilies();
  vi.stubGlobal('FontFace', Face);
  vi.stubGlobal('document', { fonts: { add: (face: Face) => added.push(face.source), delete: (face: Face) => removed.push(face.source) } });
});
afterEach(() => vi.unstubAllGlobals());

describe('loadFamilies', () => {
  const all = new Set(['Manrope']);

  it('loads a family under the Customiser’s own name, once for its file', async () => {
    expect(shopFamily('Manrope')).toBe('cz-Manrope');
    await loadFamilies([{ family: 'Manrope', file: id(1) }], all);
    await loadFamilies([{ family: 'Manrope', file: id(1) }], all);
    expect(made).toEqual([`cz-Manrope url("/api/v1/files/${id(1)}/content") format("woff2")`]);
  });

  it('loads a replaced file again and takes the old face out', async () => {
    await loadFamilies([{ family: 'Manrope', file: id(1) }], all);
    await loadFamilies([{ family: 'Manrope', file: id(2) }], all);
    expect(added).toEqual([`url("/api/v1/files/${id(1)}/content") format("woff2")`, `url("/api/v1/files/${id(2)}/content") format("woff2")`]);
    expect(removed).toEqual([`url("/api/v1/files/${id(1)}/content") format("woff2")`]);
  });

  it('asks again for a family whose file failed to load', async () => {
    failing.add(id(3));
    await loadFamilies([{ family: 'Manrope', file: id(3) }], all);
    expect(added).toEqual([]);
    failing.clear();
    await loadFamilies([{ family: 'Manrope', file: id(3) }], all);
    expect(made).toHaveLength(2);
    expect(added).toEqual([`url("/api/v1/files/${id(3)}/content") format("woff2")`]);
  });
});
