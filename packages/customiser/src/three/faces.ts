/**
 * THE FLAT FACES OF A SHOP'S MODEL, AS NUMBERS: no screen and no library.
 *
 * A shop marks a face of its model (a kit put together, a 3D-printed item)
 * where a customer's words or logo go. A face is found from one triangle the
 * pointer landed on: the triangles that share an edge with it and lie in the
 * same plane, and theirs, and so on. It is flat enough to carry words when
 * that patch is a real face of the model, not a sliver of a curve: its
 * shorter side at least a twentieth of the model's size, and the triangles
 * filling at least half of the rectangle round them.
 *
 * A marked face is kept as numbers that outlive the file being read again:
 * the mesh it is on (by its place in the model, and its name), and its
 * plane in the model's own units — a point on it, the way it faces, the two
 * directions along it (across, and down, as the words read) and how far it
 * runs each way from the point — plus its size in millimetres.
 *
 * The same reading serves a GLB (a kit), an STL and a 3MF (a printed item):
 * each is a list of corners and the triangles between them.
 */

export type Vec = readonly [number, number, number];

/** A model's triangles: three numbers a corner, and three corners a triangle (by the index, else in order). */
export interface Triangles {
  positions: ArrayLike<number>;
  index: ArrayLike<number> | null;
}

/** A face's plane in the model's own units. `u` runs across it as words read, `v` down it. */
export interface FacePlane {
  /** The mesh it is on: its place in the model (`0/2/1`, child by child from the top). */
  mesh: string;
  /** The mesh's own name in the file, where it has one. */
  meshName?: string;
  normal: Vec;
  point: Vec;
  u: Vec;
  v: Vec;
  /** How far the face runs from `point`, along `u` and along `v`. */
  bounds: { u0: number; u1: number; v0: number; v1: number };
}

/** A face the shop marked: its plane, what it is called, the kit's piece it is, and its size in millimetres. */
export interface MarkedFace extends FacePlane {
  code: string;
  name: string;
  /** The kit's piece this face is (a `base_pieces` row's id), or none. */
  piece: string | null;
  size: { w: number; h: number };
}

export const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const length = (a: Vec): number => Math.hypot(a[0], a[1], a[2]);
export function unit(a: Vec): Vec {
  const n = length(a);
  // `+ 0` turns a negative zero into zero, so a plane saved and read back is the same plane.
  return n === 0 ? [0, 0, 0] : [a[0] / n + 0, a[1] / n + 0, a[2] / n + 0];
}

const count = (tris: Triangles): number => Math.floor((tris.index === null ? tris.positions.length / 3 : tris.index.length) / 3);
const cornerOf = (tris: Triangles, triangle: number, corner: number): number => (tris.index === null ? triangle * 3 + corner : tris.index[triangle * 3 + corner]!);
const at = (tris: Triangles, vertex: number): Vec => [tris.positions[vertex * 3]!, tris.positions[vertex * 3 + 1]!, tris.positions[vertex * 3 + 2]!];

/** A triangle's three corners. */
export function corners(tris: Triangles, triangle: number): [Vec, Vec, Vec] {
  return [at(tris, cornerOf(tris, triangle, 0)), at(tris, cornerOf(tris, triangle, 1)), at(tris, cornerOf(tris, triangle, 2))];
}

/** A triangle's facing (its corners counter-clockwise seen from outside) and its area. */
export function facing(tris: Triangles, triangle: number): { normal: Vec; area: number } {
  const [a, b, c] = corners(tris, triangle);
  const n = cross(sub(b, a), sub(c, a));
  return { normal: unit(n), area: length(n) / 2 };
}

/** The box round every corner: its least and most corner. */
export function extent(tris: Triangles): { min: Vec; max: Vec } {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i + 2 < tris.positions.length; i += 3) {
    for (let k = 0; k < 3; k += 1) {
      const value = tris.positions[i + k]!;
      if (value < min[k]!) min[k] = value;
      if (value > max[k]!) max[k] = value;
    }
  }
  return { min: min as unknown as Vec, max: max as unknown as Vec };
}

/** The model's size: the diagonal of the box round it. */
export const sizeOfModel = (tris: Triangles): number => {
  const box = extent(tris);
  return Number.isFinite(box.min[0]) ? length(sub(box.max, box.min)) : 0;
};

/** The directions along a face facing `normal`: across (as words read, seen from outside) and down. */
export function axesOf(normal: Vec): { u: Vec; v: Vec } {
  const n = unit(normal);
  // A face that looks up or down is read from the front: its top runs away from the viewer.
  const upish = Math.abs(n[1]) > 0.9;
  const hint: Vec = upish ? (n[1] > 0 ? [0, 0, -1] : [0, 0, 1]) : [0, 1, 0];
  const u = unit(cross(hint, n));
  const v = unit(cross(u, n));
  return { u, v };
}

/** How far two directions may differ and still be one plane (a degree), and how close a corner must lie to it, as a share of the model. */
const SAME_WAY = Math.cos((1 * Math.PI) / 180);
const ON_PLANE = 1e-4;
/** A face must be at least this share of the model across its shorter side, and filled at least this much. */
export const LEAST_SIDE = 1 / 20;
export const LEAST_FILL = 0.5;

/** The triangles sharing an edge, by welded corner, so a model written as loose triangles (an STL) still joins up. */
function neighbours(tris: Triangles, weld: number): (triangle: number) => number[] {
  const ids = new Map<string, number>();
  const idOf = (vertex: number): number => {
    const p = at(tris, vertex);
    const key = `${String(Math.round(p[0] / weld))},${String(Math.round(p[1] / weld))},${String(Math.round(p[2] / weld))}`;
    let id = ids.get(key);
    if (id === undefined) {
      id = ids.size;
      ids.set(key, id);
    }
    return id;
  };
  const edges = new Map<string, number[]>();
  const total = count(tris);
  const welded: number[][] = [];
  for (let t = 0; t < total; t += 1) {
    const v = [idOf(cornerOf(tris, t, 0)), idOf(cornerOf(tris, t, 1)), idOf(cornerOf(tris, t, 2))];
    welded.push(v);
    for (let e = 0; e < 3; e += 1) {
      const [a, b] = [v[e]!, v[(e + 1) % 3]!];
      const key = a < b ? `${String(a)}|${String(b)}` : `${String(b)}|${String(a)}`;
      const list = edges.get(key);
      if (list === undefined) edges.set(key, [t]);
      else list.push(t);
    }
  }
  return (t) => {
    const v = welded[t]!;
    const out: number[] = [];
    for (let e = 0; e < 3; e += 1) {
      const [a, b] = [v[e]!, v[(e + 1) % 3]!];
      for (const other of edges.get(a < b ? `${String(a)}|${String(b)}` : `${String(b)}|${String(a)}`) ?? []) if (other !== t) out.push(other);
    }
    return out;
  };
}

/** The patch of one plane a triangle is part of: its triangles, the way it faces, and its area. */
export interface Region {
  triangles: number[];
  normal: Vec;
  point: Vec;
  area: number;
}

/** The flat patch round a triangle: every triangle reached edge by edge that lies in its plane. */
export function regionAround(tris: Triangles, hit: number, size = sizeOfModel(tris), joined?: (triangle: number) => number[]): Region {
  const next = joined ?? neighbours(tris, Math.max(size * 1e-6, 1e-9));
  const start = facing(tris, hit);
  const first = corners(tris, hit)[0];
  const point: Vec = [first[0] + 0, first[1] + 0, first[2] + 0];
  const seen = new Set<number>([hit]);
  const queue = [hit];
  let area = 0;
  while (queue.length > 0) {
    const t = queue.pop()!;
    area += facing(tris, t).area;
    for (const other of next(t)) {
      if (seen.has(other)) continue;
      const one = facing(tris, other);
      if (dot(one.normal, start.normal) < SAME_WAY) continue;
      if (corners(tris, other).some((c) => Math.abs(dot(sub(c, point), start.normal)) > size * ON_PLANE)) continue;
      seen.add(other);
      queue.push(other);
    }
  }
  return { triangles: [...seen].sort((a, b) => a - b), normal: start.normal, point, area };
}

/** A patch's plane: its directions along it and how far it runs each way from its first corner. */
export function planeOf(tris: Triangles, region: Region, mesh: string, meshName?: string): FacePlane {
  const { u, v } = axesOf(region.normal);
  let [u0, u1, v0, v1] = [Infinity, -Infinity, Infinity, -Infinity];
  for (const t of region.triangles) {
    for (const c of corners(tris, t)) {
      const d = sub(c, region.point);
      const [a, b] = [dot(d, u), dot(d, v)];
      u0 = Math.min(u0, a + 0);
      u1 = Math.max(u1, a);
      v0 = Math.min(v0, b);
      v1 = Math.max(v1, b);
    }
  }
  return { mesh, ...(meshName === undefined || meshName === '' ? {} : { meshName }), normal: region.normal, point: region.point, u, v, bounds: { u0, u1, v0, v1 } };
}

/** Whether a patch is a face that can carry words: wide enough both ways for the model's size, and filled. */
export function isFlatFace(plane: FacePlane, area: number, size: number): boolean {
  const w = plane.bounds.u1 - plane.bounds.u0;
  const h = plane.bounds.v1 - plane.bounds.v0;
  if (!(size > 0) || w <= 0 || h <= 0) return false;
  return Math.min(w, h) >= size * LEAST_SIDE && area >= w * h * LEAST_FILL;
}

/** What a pick on a model found: a flat face, or a face that is not flat. */
export type Picked = { flat: true; plane: FacePlane; area: number } | { flat: false };

/** The face a triangle is on, and whether it can carry words. `size` is the whole model's (its diagonal). */
export function faceAt(tris: Triangles, hit: number, mesh: string, size: number, meshName?: string): Picked {
  const region = regionAround(tris, hit, size);
  const plane = planeOf(tris, region, mesh, meshName);
  return isFlatFace(plane, region.area, size) ? { flat: true, plane, area: region.area } : { flat: false };
}

/**
 * Every flat face of a mesh that can carry words, largest first, at most
 * `limit` of them: the list a keyboard picks from. A mesh with more
 * triangles than `most` is not walked (the pointer still picks on it).
 */
export function flatFacesOf(tris: Triangles, mesh: string, size: number, limit = 12, most = 200_000, meshName?: string): { plane: FacePlane; area: number }[] {
  const total = count(tris);
  if (total > most) return [];
  const joined = neighbours(tris, Math.max(size * 1e-6, 1e-9));
  const done = new Uint8Array(total);
  const found: { plane: FacePlane; area: number }[] = [];
  for (let t = 0; t < total; t += 1) {
    if (done[t] === 1) continue;
    const region = regionAround(tris, t, size, joined);
    for (const one of region.triangles) done[one] = 1;
    const plane = planeOf(tris, region, mesh, meshName);
    if (isFlatFace(plane, region.area, size)) found.push({ plane, area: region.area });
  }
  return found.sort((a, b) => b.area - a.area).slice(0, limit);
}

/** The middle of a face, on its plane. */
export const middleOf = (plane: FacePlane): Vec => add(plane.point, add(scale(plane.u, (plane.bounds.u0 + plane.bounds.u1) / 2), scale(plane.v, (plane.bounds.v0 + plane.bounds.v1) / 2)));

/** A face's width and height, in the model's units. */
export const spanOf = (plane: FacePlane): { w: number; h: number } => ({ w: plane.bounds.u1 - plane.bounds.u0, h: plane.bounds.v1 - plane.bounds.v0 });

/** Whether a point (in the model's units) lies on a face: on its plane and inside its rectangle. */
export function onFace(plane: FacePlane, p: Vec, size: number): boolean {
  const d = sub(p, plane.point);
  if (Math.abs(dot(d, plane.normal)) > size * 1e-3) return false;
  const [a, b] = [dot(d, plane.u), dot(d, plane.v)];
  const slack = size * 1e-4;
  return a >= plane.bounds.u0 - slack && a <= plane.bounds.u1 + slack && b >= plane.bounds.v0 - slack && b <= plane.bounds.v1 + slack;
}

/** Whether two planes are one face (the same mesh, facing the same way, through the same middle). */
export function sameFace(a: FacePlane, b: FacePlane, size: number): boolean {
  return a.mesh === b.mesh && dot(a.normal, b.normal) >= SAME_WAY && length(sub(middleOf(a), middleOf(b))) <= size * 1e-3;
}

/**
 * How many millimetres one of the model's units is: from the base's width
 * against the model's own width where both are known; a model drawn in
 * metres (the glTF unit) otherwise, unless it is too big to be one.
 */
export function mmPerUnit(modelWidth: number, baseWidthMm: number | null): number {
  if (baseWidthMm !== null && baseWidthMm > 0 && modelWidth > 0) return baseWidthMm / modelWidth;
  return modelWidth > 0 && modelWidth < 5 ? 1000 : 1;
}
