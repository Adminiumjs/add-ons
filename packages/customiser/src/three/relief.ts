/**
 * WORDS AND A LOGO RAISED FROM, OR CUT INTO, A FLAT FACE OF A MODEL TO PRINT,
 * AS ONE CLOSED MESH: what the 3MF holds.
 *
 * The words are the outlines of the shop's own font files (`outline.ts`) and
 * a logo its cleaned drawing's filled paths, both in millimetres on the
 * face's sheet. They are joined into one set of shapes (where letters
 * overlap, as a variable font's do, they become one), laid on the marked
 * face's plane and pushed out of it (raised) or into it (cut in) by the
 * depth.
 *
 * Only a flat face is ever carved, so the cut is exact without a general
 * solid-geometry library: the face's own triangles are taken out and the
 * face is filled again round the letters (the letters' edges become holes
 * in it, the counters of an O islands of it); each letter gets its walls
 * and, raised, its top, or, cut in, its floor. Every corner the new
 * triangles share is the same corner, so the mesh stays closed: each edge
 * is met by exactly two triangles, running opposite ways. A general CSG
 * library (manifold, in WebAssembly) would need the dashboard to allow
 * WebAssembly to run, which its page rules do not.
 *
 * The model is in millimetres (`printModel.ts`), the face's plane in the
 * model's own numbers (`faces.ts`). Refused, with the reason, where the
 * shapes run off the face, where the model is too thin under (or crowded
 * over) them for the depth, or where the face is not one this can fill.
 */
import * as clippingModule from 'polygon-clipping';
import { ShapeUtils, Vector2 } from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';

import { matrixText, type Matrix } from '../draw/svgread.ts';
import { cross, dot, sub, type FacePlane, type Vec } from './faces.ts';

/** The clipping library's functions, however its module is handed over (its own file has one default export). */
const clipping = ((clippingModule as unknown as { default?: typeof clippingModule }).default ?? clippingModule) as typeof clippingModule;

export type Pair = [number, number];
export type Ring = Pair[];
/** A shape: its outer ring first, the rings of its holes after. */
export type Polygon = Ring[];

/** A path to raise or cut, as a production file draws it: its data and its place, in millimetres on the sheet. */
export interface ReliefPath {
  d: string;
  matrix: Matrix;
}

export interface ReliefMesh {
  positions: Float32Array;
  index: Uint32Array;
}

export type ReliefMode = 'raised' | 'cut';
export type ReliefProblem = 'empty' | 'no-face' | 'off-face' | 'no-room';

export class ReliefRefused extends Error {
  readonly problem: ReliefProblem;
  constructor(problem: ReliefProblem) {
    super(problem);
    this.problem = problem;
  }
}

/** Path data passed on as it was read: only drawing commands and numbers. */
const safeD = (d: string): string => d.replace(/[^MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]/g, '');

const areaOf = (ring: readonly Pair[]): number => {
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [a, b] = [ring[i]!, ring[(i + 1) % ring.length]!];
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum / 2;
};

/** Whether a point is inside a ring (the even-odd rule). */
function inside(point: Pair, ring: readonly Pair[]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [a, b] = [ring[i]!, ring[j]!];
    if (a[1] > point[1] !== b[1] > point[1] && point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}

/** A ring without its closing point and without a point repeated next to itself. */
function tidy(ring: readonly Pair[]): Ring {
  const out: Ring = [];
  for (const one of ring) {
    const last = out[out.length - 1];
    if (last === undefined || Math.abs(last[0] - one[0]) > 1e-9 || Math.abs(last[1] - one[1]) > 1e-9) out.push([one[0], one[1]]);
  }
  while (out.length > 1 && Math.abs(out[0]![0] - out[out.length - 1]![0]) <= 1e-9 && Math.abs(out[0]![1] - out[out.length - 1]![1]) <= 1e-9) out.pop();
  return out;
}

/**
 * The rings each path draws, in millimetres on the sheet, curves made into
 * short straight runs (a twentieth of a millimetre's worth at the words'
 * sizes). Read by three.js's own path reader, so a logo's every command and
 * its place are read as the laser's file draws them.
 */
export function ringsOfPaths(paths: readonly ReliefPath[], divisions = 8): Ring[][] {
  if (paths.length === 0 || typeof DOMParser === 'undefined') return [];
  const read = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg">${paths.map((one) => `<path d="${safeD(one.d)}" transform="${matrixText(one.matrix)}"/>`).join('')}</svg>`);
  return read.paths.map((path) => path.subPaths.map((sub) => tidy(sub.getPoints(divisions).map((p) => [p.x, p.y] as Pair))).filter((ring) => ring.length >= 3 && Math.abs(areaOf(ring)) > 1e-9));
}

/**
 * One path's rings as shapes, by the non-zero rule a font's glyphs and an
 * SVG's paths are filled by: rings turning the way the largest one turns are
 * outer, the others holes, each hole in the smallest outer ring round it.
 */
export function shapesOfRings(rings: readonly Ring[]): Polygon[] {
  if (rings.length === 0) return [];
  const largest = rings.reduce((best, one) => (Math.abs(areaOf(one)) > Math.abs(areaOf(best)) ? one : best));
  const way = Math.sign(areaOf(largest));
  const outers = rings.filter((one) => Math.sign(areaOf(one)) === way).map((one) => [one] as Polygon);
  for (const hole of rings.filter((one) => Math.sign(areaOf(one)) !== way)) {
    const round = outers.filter((one) => inside(hole[0]!, one[0]!)).sort((a, b) => Math.abs(areaOf(a[0]!)) - Math.abs(areaOf(b[0]!)))[0];
    round?.push(hole);
  }
  return outers;
}

/** Every path's shapes joined into one set that never overlaps itself (letters that touch become one). */
export function joinShapes(groups: readonly Ring[][]): Polygon[] {
  const shapes = groups.flatMap((rings) => shapesOfRings(rings));
  if (shapes.length === 0) return [];
  const joined = clipping.union(shapes[0]!, ...shapes.slice(1));
  return joined.map((polygon) => polygon.map((ring) => tidy(ring))).filter((polygon) => polygon[0] !== undefined && polygon[0].length >= 3);
}

/* ── the mesh ───────────────────────────────────────────────────────────── */

export interface ReliefInput {
  /** The model to print, in millimetres. */
  model: { positions: ArrayLike<number>; index: ArrayLike<number> | null };
  /** The marked face, in the model's numbers. */
  face: FacePlane;
  /** The size of the sheet the shapes are drawn on, laid across the face's rectangle. */
  sheet: { width: number; height: number };
  /** The joined shapes, in millimetres on the sheet (x across, y down). */
  shapes: readonly Polygon[];
  mode: ReliefMode;
  /** How far the shapes stand out of, or are cut into, the face, in millimetres. */
  depth: number;
}

/** How close a letter may come to the face's edge, in millimetres: closer, and the printer cannot keep the wall. */
export const EDGE_ROOM = 0.05;

/**
 * The model with the shapes raised from, or cut into, the face: one closed
 * mesh, every corner shared by index.
 */
export function relief(input: ReliefInput): ReliefMesh {
  const { face, depth } = input;
  if (input.shapes.length === 0) throw new ReliefRefused('empty');
  const n = face.normal;
  const u = face.u;
  // Across the face as words read, and up it (the face's `v` runs down): seen from outside, a right-handed pair.
  const w: Vec = [-face.v[0], -face.v[1], -face.v[2]];
  const source = input.model.positions;
  const cornerCount = source.length / 3;
  const triangleCorners = input.model.index === null ? Array.from({ length: cornerCount }, (_, i) => i) : Array.from(input.model.index);

  // The model's corners, welded: an STL repeats a corner for each triangle at it.
  let [lo, hi] = [Infinity, -Infinity];
  for (let i = 0; i < source.length; i += 1) {
    lo = Math.min(lo, source[i]!);
    hi = Math.max(hi, source[i]!);
  }
  const size = Math.max(hi - lo, 1e-6);
  const weld = Math.max(size * 1e-7, 1e-7);
  const positions: number[] = [];
  const keyed = new Map<string, number>();
  const idOf = (corner: number): number => {
    const p = [source[corner * 3]!, source[corner * 3 + 1]!, source[corner * 3 + 2]!];
    const key = `${String(Math.round(p[0]! / weld))},${String(Math.round(p[1]! / weld))},${String(Math.round(p[2]! / weld))}`;
    let id = keyed.get(key);
    if (id === undefined) {
      id = positions.length / 3;
      positions.push(p[0]!, p[1]!, p[2]!);
      keyed.set(key, id);
    }
    return id;
  };
  const triangles: number[] = [];
  for (let i = 0; i + 2 < triangleCorners.length; i += 3) {
    const [a, b, c] = [idOf(triangleCorners[i]!), idOf(triangleCorners[i + 1]!), idOf(triangleCorners[i + 2]!)];
    // A triangle with two corners welded together has no area: it is left out.
    if (a !== b && b !== c && a !== c) triangles.push(a, b, c);
  }
  const at = (id: number): Vec => [positions[id * 3]!, positions[id * 3 + 1]!, positions[id * 3 + 2]!];
  const flat = (id: number): Pair => {
    const d = sub(at(id), face.point);
    return [dot(d, u), dot(d, w)];
  };
  const heightOf = (id: number): number => dot(sub(at(id), face.point), n);

  // The face's own triangles: facing its way, every corner on its plane.
  const onPlane = size * 1e-4;
  const sameWay = Math.cos(Math.PI / 180);
  const isFace = (t: number): boolean => {
    const [a, b, c] = [at(triangles[t * 3]!), at(triangles[t * 3 + 1]!), at(triangles[t * 3 + 2]!)];
    const normal = cross(sub(b, a), sub(c, a));
    const length = Math.hypot(...normal);
    if (length === 0 || dot(normal, n) / length < sameWay) return false;
    return [a, b, c].every((p) => Math.abs(dot(sub(p, face.point), n)) <= onPlane);
  };
  const kept: number[] = [];
  const faceEdges = new Map<number, number[]>();
  const directed = new Set<string>();
  for (let t = 0; t < triangles.length / 3; t += 1) {
    const corners = [triangles[t * 3]!, triangles[t * 3 + 1]!, triangles[t * 3 + 2]!];
    if (!isFace(t)) {
      kept.push(...corners);
      continue;
    }
    for (let e = 0; e < 3; e += 1) directed.add(`${String(corners[e]!)}>${String(corners[(e + 1) % 3]!)}`);
  }
  if (directed.size === 0) throw new ReliefRefused('no-face');
  // The face's edge: its triangles' edges no other of its triangles runs back along.
  for (const edge of directed) {
    const [a, b] = edge.split('>').map(Number) as [number, number];
    if (directed.has(`${String(b)}>${String(a)}`)) continue;
    const list = faceEdges.get(a) ?? [];
    list.push(b);
    faceEdges.set(a, list);
  }
  const loops: number[][] = [];
  const used = new Set<number>();
  for (const start of faceEdges.keys()) {
    if (used.has(start)) continue;
    const loop: number[] = [];
    let atId = start;
    for (;;) {
      const next = faceEdges.get(atId);
      // Two edges leaving one corner: the face touches itself at a point, which this does not fill.
      if (next === undefined || next.length !== 1) throw new ReliefRefused('no-face');
      used.add(atId);
      loop.push(atId);
      atId = next[0]!;
      if (atId === start) break;
      if (used.has(atId)) throw new ReliefRefused('no-face');
    }
    loops.push(loop);
  }
  const faceOuters = loops.filter((loop) => areaOf(loop.map(flat)) > 0);
  const faceHoles = loops.filter((loop) => areaOf(loop.map(flat)) <= 0);
  if (faceOuters.length === 0) throw new ReliefRefused('no-face');

  // The shapes on the face's plane: the sheet laid across the face's rectangle, its y running down the face.
  const kx = (face.bounds.u1 - face.bounds.u0) / Math.max(input.sheet.width, 1e-9);
  const ky = (face.bounds.v1 - face.bounds.v0) / Math.max(input.sheet.height, 1e-9);
  const onFace = (p: Pair): Pair => [face.bounds.u0 + p[0] * kx, -(face.bounds.v0 + p[1] * ky)];
  const shapes: Polygon[] = input.shapes.map((polygon) =>
    polygon.map((ring, index) => {
      const laid = ring.map(onFace);
      // Outer rings turn as the face's do (counter-clockwise seen from outside), holes the other way.
      const want = index === 0 ? 1 : -1;
      return Math.sign(areaOf(laid)) === want ? laid : laid.reverse();
    }),
  );

  // Every shape on the face, clear of its edges and its holes.
  const facePolygons: Polygon[] = faceOuters.map((outer) => [outer.map(flat), ...faceHoles.filter((hole) => inside(flat(hole[0]!), outer.map(flat))).map((hole) => hole.map(flat))]);
  const total = shapes.reduce((sum, polygon) => sum + polygon.reduce((s, ring) => s + areaOf(ring), 0), 0);
  const within = clipping.intersection(shapes as Polygon[], facePolygons as Polygon[]).reduce((sum, polygon) => sum + polygon.reduce((s, ring) => s + areaOf(ring), 0), 0);
  if (!(total > 0) || Math.abs(total - within) > Math.max(1e-6, total * 1e-6)) throw new ReliefRefused('off-face');
  const edges = loops.flatMap((loop) => loop.map((id, i) => [flat(id), flat(loop[(i + 1) % loop.length]!)] as const));
  const near = (p: Pair): boolean =>
    edges.some(([a, b]) => {
      const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
      const k = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(p[0] - a[0] - k * dx, p[1] - a[1] - k * dy) < EDGE_ROOM;
    });
  if (shapes.some((polygon) => polygon.some((ring) => ring.some(near)))) throw new ReliefRefused('off-face');

  /*
   * Room for the depth: no other part of the model within the letters'
   * reach, over the face (raised) or under it (cut in). A corner of the model
   * inside that slab over the letters is in the way; so is a triangle the
   * slab meets under any corner of a letter (the model's other side, too
   * near for the cut).
   */
  const box = shapes.flatMap((polygon) => polygon[0]!).reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [Infinity, Infinity, -Infinity, -Infinity]);
  const sign = input.mode === 'raised' ? 1 : -1;
  const reach = (h: number): boolean => h > onPlane && h < depth + onPlane;
  for (const id of new Set(kept)) {
    const [a, b] = flat(id);
    if (reach(heightOf(id) * sign) && a > box[0] && a < box[2] && b > box[1] && b < box[3]) throw new ReliefRefused('no-room');
  }
  const letterCorners = shapes.flatMap((polygon) => polygon.flat());
  for (let i = 0; i + 2 < kept.length; i += 3) {
    const ids = [kept[i]!, kept[i + 1]!, kept[i + 2]!];
    const hs = ids.map((id) => heightOf(id) * sign);
    if (Math.max(...hs) <= onPlane || Math.min(...hs) >= depth + onPlane) continue;
    const [p0, p1, p2] = ids.map(flat) as [Pair, Pair, Pair];
    const det = (p1[1] - p2[1]) * (p0[0] - p2[0]) + (p2[0] - p1[0]) * (p0[1] - p2[1]);
    if (Math.abs(det) < 1e-12) continue;
    for (const q of letterCorners) {
      const l0 = ((p1[1] - p2[1]) * (q[0] - p2[0]) + (p2[0] - p1[0]) * (q[1] - p2[1])) / det;
      const l1 = ((p2[1] - p0[1]) * (q[0] - p2[0]) + (p0[0] - p2[0]) * (q[1] - p2[1])) / det;
      const l2 = 1 - l0 - l1;
      if (l0 < 0 || l1 < 0 || l2 < 0) continue;
      if (reach(l0 * hs[0]! + l1 * hs[1]! + l2 * hs[2]!)) throw new ReliefRefused('no-room');
    }
  }

  // The letters' corners, on the face and at the depth.
  const add = (p: Pair, h: number): number => {
    const id = positions.length / 3;
    positions.push(face.point[0] + u[0] * p[0] + w[0] * p[1] + n[0] * h, face.point[1] + u[1] * p[0] + w[1] * p[1] + n[1] * h, face.point[2] + u[2] * p[0] + w[2] * p[1] + n[2] * h);
    return id;
  };
  const level = shapes.map((polygon) => polygon.map((ring) => ring.map((p) => add(p, 0))));
  const far = shapes.map((polygon) => polygon.map((ring) => ring.map((p) => add(p, sign * depth))));

  const out: number[] = [...kept];
  /**
   * A flat patch filled with triangles facing out of the face: its outer ring
   * and its holes, as corners. The triangulator may run an edge past a
   * corner lying on it (a corner on a straight run of a ring, or two letters'
   * feet on one baseline); a wall still meets that corner, so each such
   * triangle is split at the corners its edge passes.
   */
  const patch = (outer: readonly number[], holes: readonly (readonly number[])[]): number[] => {
    const rings = [outer, ...holes];
    const all = rings.flat();
    const points = (ring: readonly number[]): Vector2[] => ring.map((id) => new Vector2(...flat(id)));
    const made: number[] = [];
    for (const [a, b, c] of ShapeUtils.triangulateShape(points(outer), holes.map(points))) {
      const [x, y, z] = [all[a!]!, all[b!]!, all[c!]!];
      if (areaOf([flat(x), flat(y), flat(z)]) >= 0) made.push(x, y, z);
      else made.push(x, z, y);
    }
    return restore(unsliver(made), rings);
  };
  /**
   * The triangulator may lay a triangle of no area along a straight line
   * where corners of two rings line up (the feet of two letters on one
   * baseline). Such a sliver meets its long edge's neighbour: the two are
   * made into two real triangles through the sliver's middle corner.
   */
  const unsliver = (made: readonly number[]): number[] => {
    const tris: [number, number, number][] = [];
    for (let i = 0; i < made.length; i += 3) tris.push([made[i]!, made[i + 1]!, made[i + 2]!]);
    const thin = (t: readonly number[]): boolean => {
      const [a, b, c] = [flat(t[0]!), flat(t[1]!), flat(t[2]!)];
      const longest = Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]), Math.hypot(c[0] - b[0], c[1] - b[1]), Math.hypot(a[0] - c[0], a[1] - c[1]));
      return Math.abs(areaOf([a, b, c])) <= 1e-9 * Math.max(longest * longest, 1e-12);
    };
    for (let guard = 0; guard < tris.length * 4; guard += 1) {
      const at = tris.findIndex(thin);
      if (at < 0) break;
      const t = tris[at]!;
      // The middle corner lies between the other two: the long edge is the one without it.
      const lengths = [0, 1, 2].map((e) => {
        const [a, b] = [flat(t[e]!), flat(t[(e + 1) % 3]!)];
        return Math.hypot(b[0] - a[0], b[1] - a[1]);
      });
      const e = lengths.indexOf(Math.max(...lengths));
      const [p, q, middle] = [t[e]!, t[(e + 1) % 3]!, t[(e + 2) % 3]!];
      const other = tris.findIndex((one, i) => i !== at && [0, 1, 2].some((k) => one[k] === q && one[(k + 1) % 3] === p));
      if (other < 0) break;
      const n = tris[other]!;
      const k = [0, 1, 2].find((one) => n[one] === q && n[(one + 1) % 3] === p)!;
      const far = n[(k + 2) % 3]!;
      const replaced: [number, number, number][] = [
        [q, middle, far],
        [middle, p, far],
      ];
      tris.splice(Math.max(at, other), 1);
      tris.splice(Math.min(at, other), 1);
      tris.push(...replaced);
    }
    return tris.flat();
  };
  const restore = (made: readonly number[], rings: readonly (readonly number[])[]): number[] => {
    const corners = [...new Set(rings.flat())].map((id) => ({ id, p: flat(id) }));
    /** The patch's corners lying on the edge from `x` to `y`, strictly between them, in order from `x`. */
    const between = (x: number, y: number): number[] => {
      const [a, b] = [flat(x), flat(y)];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length === 0) return [];
      const [lx, hx, ly, hy] = [Math.min(a[0], b[0]), Math.max(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[1], b[1])];
      const slack = 1e-7 * Math.max(1, length);
      const found: { id: number; k: number }[] = [];
      for (const one of corners) {
        const p = one.p;
        if (one.id === x || one.id === y || p[0] < lx - slack || p[0] > hx + slack || p[1] < ly - slack || p[1] > hy + slack) continue;
        const k = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / (length * length);
        if (k <= 1e-9 || k >= 1 - 1e-9) continue;
        if (Math.abs((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) / length < slack) found.push({ id: one.id, k });
      }
      return found.sort((m, n) => m.k - n.k).map((one) => one.id);
    };
    const fixed: number[] = [];
    for (let i = 0; i < made.length; i += 3) {
      const tri = [made[i]!, made[i + 1]!, made[i + 2]!];
      let split = false;
      for (let e = 0; e < 3 && !split; e += 1) {
        const [x, y, z] = [tri[e]!, tri[(e + 1) % 3]!, tri[(e + 2) % 3]!];
        const run = between(x, y);
        if (run.length === 0) continue;
        // A fan from the far corner over the corners on the edge, in the triangle's own turn.
        const chain = [x, ...run, y];
        for (let k = 0; k + 1 < chain.length; k += 1) fixed.push(chain[k]!, chain[k + 1]!, z);
        split = true;
      }
      if (!split) fixed.push(...tri);
    }
    // A triangle split on one edge may still pass corners on another: until none does.
    return fixed.length === made.length ? fixed : restore(fixed, rings);
  };

  // Which ring each shape sits inside: a face's outer ring, or the counter of another shape.
  const counters = shapes.flatMap((polygon, p) => polygon.slice(1).map((ring, r) => ({ p, r: r + 1, ring })));
  const islandsOf = new Map<string, number[]>();
  const onFaceOf = new Map<number, number[]>();
  shapes.forEach((polygon, p) => {
    const first = polygon[0]![0]!;
    const round = counters.filter((one) => one.p !== p && inside(first, one.ring)).sort((a, b) => Math.abs(areaOf(a.ring)) - Math.abs(areaOf(b.ring)))[0];
    if (round !== undefined) {
      const key = `${String(round.p)}/${String(round.r)}`;
      islandsOf.set(key, [...(islandsOf.get(key) ?? []), p]);
      return;
    }
    const outer = faceOuters.findIndex((loop) => inside(first, loop.map(flat)));
    onFaceOf.set(outer, [...(onFaceOf.get(outer) ?? []), p]);
  });

  // The face, filled again round the shapes; and each counter, filled round any shape inside it.
  faceOuters.forEach((outer, index) => {
    const holes = faceHoles.filter((hole) => inside(flat(hole[0]!), outer.map(flat)));
    out.push(...patch(outer, [...holes, ...(onFaceOf.get(index) ?? []).map((p) => level[p]![0]!)]));
  });
  for (const { p, r } of counters) {
    // A counter's ring runs clockwise as a hole; filled as a patch of face it runs the other way.
    const ring = [...level[p]![r]!].reverse();
    out.push(...patch(ring, (islandsOf.get(`${String(p)}/${String(r)}`) ?? []).map((one) => level[one]![0]!)));
  }

  // Each shape's walls, from the face to the depth, and its top (raised) or its floor (cut in).
  shapes.forEach((polygon, p) => {
    polygon.forEach((_, r) => {
      const near = level[p]![r]!;
      const away = far[p]![r]!;
      for (let i = 0; i < near.length; i += 1) {
        const j = (i + 1) % near.length;
        // One order serves both: raised, the far ring is above and the wall faces out of the letter; cut in, it is below and the wall faces into the hollow.
        out.push(near[i]!, near[j]!, away[j]!, near[i]!, away[j]!, away[i]!);
      }
    });
    // Its top (raised) or its floor (cut in): the shape filled on the face, moved to the depth. Both face out of the face.
    const toFar = new Map<number, number>();
    level[p]!.forEach((ring, r) => ring.forEach((id, i) => toFar.set(id, far[p]![r]![i]!)));
    for (const id of patch(level[p]![0]!, level[p]!.slice(1))) out.push(toFar.get(id)!);
  });

  return { positions: Float32Array.from(positions), index: Uint32Array.from(out) };
}

/** Whether a mesh is closed: every edge met by exactly two triangles, running opposite ways. */
export function isClosed(mesh: ReliefMesh): boolean {
  const seen = new Map<string, number>();
  for (let i = 0; i < mesh.index.length; i += 3) {
    for (let e = 0; e < 3; e += 1) {
      const [a, b] = [mesh.index[i + e]!, mesh.index[i + ((e + 1) % 3)]!];
      const key = `${String(a)}>${String(b)}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
  }
  for (const [key, times] of seen) {
    const [a, b] = key.split('>');
    if (times !== 1 || seen.get(`${b!}>${a!}`) !== 1) return false;
  }
  return seen.size > 0;
}

/** The mesh's volume, in cubic millimetres: positive for a closed mesh whose triangles face out. */
export function volumeOf(mesh: ReliefMesh): number {
  let sum = 0;
  const p = mesh.positions;
  for (let i = 0; i < mesh.index.length; i += 3) {
    const [a, b, c] = [mesh.index[i]! * 3, mesh.index[i + 1]! * 3, mesh.index[i + 2]! * 3];
    sum += dot([p[a]!, p[a + 1]!, p[a + 2]!], cross([p[b]!, p[b + 1]!, p[b + 2]!], [p[c]!, p[c + 1]!, p[c + 2]!]));
  }
  return sum / 6;
}
