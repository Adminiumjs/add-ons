// @vitest-environment jsdom
/**
 * WORDS RAISED FROM, AND CUT INTO, A MODEL TO PRINT, AND THE 3MF THAT HOLDS IT.
 *
 * The keyring of the comp: a 56 × 24 × 4 mm plate with a hole for its ring,
 * "SAM" in Manrope (a variable font, whose letters overlap themselves) laid
 * on its top face. Raised 1 mm, the mesh is closed (every edge met twice,
 * opposite ways, and `manifold-3d` itself takes it as a solid), its top is
 * 5 mm, and its volume grows by the letters' area times the depth. Cut in,
 * the face is lowered by the depth inside the letters and the volume falls
 * by as much. The 3MF written from it unzips, parses, and holds the same
 * corners and triangles, in millimetres.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import Module from 'manifold-3d';
import { ExtrudeGeometry, Path, Shape } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';

import { fontAt, linePath } from '../draw/outline.ts';
import { IDENTITY } from '../draw/svgread.ts';
import { axesOf, type FacePlane } from './faces.ts';
import { read3mf } from './printModel.ts';
import { EDGE_ROOM, isClosed, joinShapes, relief, ReliefRefused, ringsOfPaths, volumeOf, type Polygon, type ReliefMesh } from './relief.ts';
import { MODEL_PART, write3mf } from './threemf.ts';
import { zipEntries, zipEntryBytes } from './zip.ts';

const MANROPE = new Uint8Array(readFileSync(createRequire(import.meta.url).resolve('@adminium/tokens/fonts/manrope/manrope-latin-wght-normal.woff2')));

/** The keyring's plate: 56 × 24 mm with rounded ends' stand-in corners, a 5 mm hole near its left end, 4 mm thick, from z 0 to z 4. */
function plate(hole = true): { positions: Float32Array; index: null } {
  const shape = new Shape().moveTo(0, 0).lineTo(56, 0).lineTo(56, 24).lineTo(0, 24).closePath();
  if (hole) shape.holes.push(new Path().moveTo(3, 9.5).lineTo(3, 14.5).lineTo(8, 14.5).lineTo(8, 9.5).closePath());
  const geometry = new ExtrudeGeometry(shape, { depth: 4, bevelEnabled: false });
  // An extruded shape is a list of loose triangles, as an STL is.
  const positions = new Float32Array(geometry.getAttribute('position').array);
  geometry.dispose();
  return { positions, index: null };
}

/** The plate's top face as Mark faces keeps it: facing +z, read across +x and down −y, its rectangle from its first corner. */
function topFace(): FacePlane {
  const { u, v } = axesOf([0, 0, 1]);
  return { mesh: '0', normal: [0, 0, 1], point: [0, 24, 4], u, v, bounds: { u0: 0, u1: 56, v0: 0, v1: 24 } };
}

/** "SAM" across the keyring's sheet (56 × 24 mm), 11 mm letters, centred, as the files draw it. */
function sam(text = 'SAM', size = 11, x = 30): Polygon[] {
  const font = fontAt(MANROPE, 800)!;
  const { d } = linePath(font, text, x, 16, size, 'middle');
  return joinShapes(ringsOfPaths([{ d, matrix: IDENTITY }]));
}

const ringArea = (ring: readonly (readonly [number, number])[]): number => {
  let a = 0;
  for (let i = 0; i < ring.length; i += 1) a += ring[i]![0] * ring[(i + 1) % ring.length]![1] - ring[(i + 1) % ring.length]![0] * ring[i]![1];
  return Math.abs(a) / 2;
};
/** The shapes' area: each outer ring's, less its holes'. */
const areaOf = (polygons: readonly Polygon[]): number => polygons.reduce((sum, [outer, ...holes]) => sum + ringArea(outer!) - holes.reduce((s, hole) => s + ringArea(hole), 0), 0);

function zRange(mesh: ReliefMesh): [number, number] {
  let [lo, hi] = [Infinity, -Infinity];
  for (let i = 2; i < mesh.positions.length; i += 3) {
    lo = Math.min(lo, mesh.positions[i]!);
    hi = Math.max(hi, mesh.positions[i]!);
  }
  return [lo, hi];
}

let manifold: Awaited<ReturnType<typeof Module>>;
beforeAll(async () => {
  manifold = await Module();
  manifold.setup();
});

/** Whether manifold-3d itself takes the mesh as a solid, and its volume as it measures it. */
function asSolid(mesh: ReliefMesh): { ok: boolean; volume: number } {
  const solid = new manifold.Manifold(new manifold.Mesh({ numProp: 3, vertProperties: mesh.positions, triVerts: mesh.index }));
  try {
    return { ok: solid.status() === 'NoError' && solid.genus() >= 0, volume: solid.volume() };
  } finally {
    solid.delete();
  }
}

describe('the words, as shapes', () => {
  it('are the font’s outlines joined: a letter that overlaps itself becomes one shape, its counters holes', () => {
    const shapes = sam();
    // S, A (with its counter) and M: three shapes, the A one hole.
    expect(shapes.length).toBe(3);
    expect(shapes.map((polygon) => polygon.length).sort()).toEqual([1, 1, 2]);
    expect(areaOf(shapes)).toBeGreaterThan(40);
  });
});

describe('raised 1 mm', () => {
  const plateVolume = 56 * 24 * 4 - 5 * 5 * 4;

  it('is one closed mesh, a solid manifold-3d takes, 5 mm at its top, grown by the letters’ area times the depth', () => {
    const shapes = sam();
    expect(isClosed({ ...weldedPlate() })).toBe(true);
    const mesh = relief({ model: plate(), face: topFace(), sheet: { width: 56, height: 24 }, shapes, mode: 'raised', depth: 1 });
    expect(isClosed(mesh)).toBe(true);
    expect(zRange(mesh)).toEqual([0, 5]);
    const grown = areaOf(shapes) * 1;
    expect(volumeOf(mesh)).toBeCloseTo(plateVolume + grown, 3);
    const solid = asSolid(mesh);
    expect(solid.ok).toBe(true);
    expect(solid.volume).toBeCloseTo(plateVolume + grown, 2);
  });

  it('keeps the face round the letters at the face, and the letters within the face’s rectangle', () => {
    const mesh = relief({ model: plate(), face: topFace(), sheet: { width: 56, height: 24 }, shapes: sam(), mode: 'raised', depth: 1.5 });
    expect(zRange(mesh)).toEqual([0, 5.5]);
    for (let i = 0; i < mesh.positions.length; i += 3) {
      if (mesh.positions[i + 2]! > 4.0001) {
        expect(mesh.positions[i]!).toBeGreaterThan(0);
        expect(mesh.positions[i]!).toBeLessThan(56);
      }
    }
  });
});

describe('cut in 1 mm', () => {
  it('lowers the face by the depth inside the letters: closed, a solid, smaller by the letters’ area times the depth', () => {
    const shapes = sam();
    const mesh = relief({ model: plate(), face: topFace(), sheet: { width: 56, height: 24 }, shapes, mode: 'cut', depth: 1 });
    expect(isClosed(mesh)).toBe(true);
    expect(zRange(mesh)).toEqual([0, 4]);
    // Corners at the floor of the cut, 3 mm up.
    let floor = 0;
    for (let i = 2; i < mesh.positions.length; i += 3) if (Math.abs(mesh.positions[i]! - 3) < 1e-4) floor += 1;
    expect(floor).toBeGreaterThan(20);
    const plateVolume = 56 * 24 * 4 - 5 * 5 * 4;
    expect(volumeOf(mesh)).toBeCloseTo(plateVolume - areaOf(shapes), 3);
    expect(asSolid(mesh).ok).toBe(true);
  });

  it('is refused where the model is too thin under the letters for the depth', () => {
    expect(() => relief({ model: plate(), face: topFace(), sheet: { width: 56, height: 24 }, shapes: sam(), mode: 'cut', depth: 4.5 })).toThrow(ReliefRefused);
    try {
      relief({ model: plate(), face: topFace(), sheet: { width: 56, height: 24 }, shapes: sam(), mode: 'cut', depth: 4.5 });
    } catch (caught) {
      expect((caught as ReliefRefused).problem).toBe('no-room');
    }
  });
});

describe('any words', () => {
  it.each(['WAVE', 'B&B 1987', 'Ågot @ 8%', 'mollie'])('“%s”, raised and cut in, is one closed solid', (words) => {
    const shapes = sam(words, 7, 32);
    for (const mode of ['raised', 'cut'] as const) {
      const mesh = relief({ model: plate(), face: topFace(), sheet: { width: 56, height: 24 }, shapes, mode, depth: 1 });
      expect(isClosed(mesh), `${words} ${mode}`).toBe(true);
      expect(asSolid(mesh).ok, `${words} ${mode}`).toBe(true);
      expect(volumeOf(mesh)).toBeCloseTo(56 * 24 * 4 - 100 + (mode === 'raised' ? 1 : -1) * areaOf(shapes), 2);
    }
  });
});

describe('what is refused', () => {
  const problem = (run: () => unknown): string => {
    try {
      run();
    } catch (caught) {
      if (caught instanceof ReliefRefused) return caught.problem;
      throw caught;
    }
    return 'made';
  };

  it('letters running off the face, over its hole, or closer to its edge than the printer keeps', () => {
    // Placed so the S sits over the ring's hole.
    expect(problem(() => relief({ model: plate(), face: topFace(), sheet: { width: 56, height: 24 }, shapes: sam('SAM', 11, 14), mode: 'raised', depth: 1 }))).toBe('off-face');
    expect(problem(() => relief({ model: plate(false), face: topFace(), sheet: { width: 56, height: 24 }, shapes: sam('SAMANTHA JONES', 11, 28), mode: 'raised', depth: 1 }))).toBe('off-face');
    expect(EDGE_ROOM).toBeGreaterThan(0);
    expect(problem(() => relief({ model: plate(), face: topFace(), sheet: { width: 56, height: 24 }, shapes: [], mode: 'raised', depth: 1 }))).toBe('empty');
  });

  it('a face the model does not have', () => {
    const face: FacePlane = { ...topFace(), point: [0, 24, 10] };
    expect(problem(() => relief({ model: plate(), face, sheet: { width: 56, height: 24 }, shapes: sam(), mode: 'raised', depth: 1 }))).toBe('no-face');
  });
});

describe('the 3MF', () => {
  it('unzips, parses as a core 3MF model in millimetres, and holds the mesh’s corners and triangles', async () => {
    const mesh = relief({ model: plate(), face: topFace(), sheet: { width: 56, height: 24 }, shapes: sam(), mode: 'raised', depth: 1 });
    const bytes = write3mf({ positions: mesh.positions, index: mesh.index, name: 'Name keyring', title: 'Name keyring — “SAM” raised 1 mm' });
    const entries = zipEntries(bytes);
    expect(entries.map((one) => one.name)).toEqual(['[Content_Types].xml', '_rels/.rels', MODEL_PART]);
    const xml = new TextDecoder().decode(await zipEntryBytes(bytes, entries[2]!));
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    expect(doc.getElementsByTagName('parsererror').length).toBe(0);
    const model = doc.documentElement;
    expect(model.getAttribute('unit')).toBe('millimeter');
    expect(model.namespaceURI).toBe('http://schemas.microsoft.com/3dmanufacturing/core/2015/02');
    expect(doc.getElementsByTagName('vertex').length).toBe(mesh.positions.length / 3);
    expect(doc.getElementsByTagName('triangle').length).toBe(mesh.index.length / 3);
    expect(doc.getElementsByTagName('item')[0]?.getAttribute('objectid')).toBe('1');
    // Read back as a model to print, it is the same solid.
    const back = await read3mf(bytes);
    expect(back.index?.length).toBe(mesh.index.length);
    expect(isClosed({ positions: back.positions, index: back.index! })).toBe(true);
    expect(volumeOf({ positions: back.positions, index: back.index! })).toBeCloseTo(volumeOf(mesh), 2);
  });
});

/** The plate welded into a mesh by the same reading `relief` gives it (a raise of nothing changes nothing). */
function weldedPlate(): ReliefMesh {
  const source = plate();
  const keyed = new Map<string, number>();
  const positions: number[] = [];
  const index: number[] = [];
  for (let i = 0; i < source.positions.length; i += 3) {
    const key = [0, 1, 2].map((k) => Math.round(source.positions[i + k]! * 1e5)).join(',');
    let id = keyed.get(key);
    if (id === undefined) {
      id = positions.length / 3;
      positions.push(source.positions[i]!, source.positions[i + 1]!, source.positions[i + 2]!);
      keyed.set(key, id);
    }
    index.push(id);
  }
  return { positions: Float32Array.from(positions), index: Uint32Array.from(index) };
}
