/**
 * A MODEL TO PRINT, READ AS TRIANGLES: an STL (binary or text) or a 3MF.
 *
 * No three.js in it: the set-up reads a picked file with it before it is
 * uploaded (is it a model, has it a flat face), the stage draws what it
 * reads, and "Make the files" builds the 3MF from the same triangles, so a
 * face marked on the screen is the face the words are raised from.
 *
 * - An STL is read as its size says: a binary one is 84 bytes and 50 a
 *   triangle exactly; anything else that starts `solid` is read as text.
 *   It has no unit: it is taken as millimetres, as slicers take it.
 * - A 3MF is a zip read from its central directory with caps (`zip.ts`):
 *   its relationships name the model part (`3D/3dmodel.model` by default),
 *   and a zip without one is no 3MF, whatever its name. The model's
 *   objects are read with their components and the build's placements,
 *   and every corner is put in millimetres from the model's own unit.
 */
import type { Triangles } from './faces.ts';
import { ZipRefused, zipEntries, zipEntryBytes, type ZipEntry } from './zip.ts';

/** A model to print, read: its triangles in millimetres (three numbers a corner, three corners a triangle). */
export interface PrintModel {
  kind: 'stl' | '3mf';
  positions: Float32Array;
  index: Uint32Array | null;
}

/** Why a model to print is not read. */
export type PrintProblem = 'not-model' | 'too-many' | 'too-big' | 'damaged' | 'empty';

export class PrintRefused extends Error {
  readonly problem: PrintProblem;
  constructor(problem: PrintProblem) {
    super(problem);
    this.problem = problem;
  }
}

/** The most triangles a model to print is read with: a 30 MB binary STL holds about 630,000. */
export const MOST_TRIANGLES = 2_000_000;

const u32 = (bytes: Uint8Array, at: number): number => (bytes[at]! | (bytes[at + 1]! << 8) | (bytes[at + 2]! << 16) | (bytes[at + 3]! << 24)) >>> 0;

/** Whether the bytes are a zip whose end record is where a zip's is: what a 3MF is on the outside. */
export function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 22 && u32(bytes, 0) === 0x04034b50;
}

/** An STL's triangles, binary or text; refused where it holds none. */
export function readStl(bytes: Uint8Array): PrintModel {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length >= 84 && 84 + view.getUint32(80, true) * 50 === bytes.length) {
    const count = view.getUint32(80, true);
    if (count === 0) throw new PrintRefused('empty');
    if (count > MOST_TRIANGLES) throw new PrintRefused('too-big');
    const positions = new Float32Array(count * 9);
    for (let t = 0; t < count; t += 1) {
      const at = 84 + t * 50 + 12;
      for (let k = 0; k < 9; k += 1) positions[t * 9 + k] = view.getFloat32(at + k * 4, true);
    }
    return { kind: 'stl', positions, index: null };
  }
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  if (!/^\s*solid\b/i.test(text)) throw new PrintRefused('not-model');
  const found: number[] = [];
  const corner = /vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g;
  for (let m = corner.exec(text); m !== null; m = corner.exec(text)) {
    found.push(Number(m[1]), Number(m[2]), Number(m[3]));
    if (found.length > MOST_TRIANGLES * 9) throw new PrintRefused('too-big');
  }
  const whole = found.length - (found.length % 9);
  if (whole === 0 || found.slice(0, whole).some((one) => !Number.isFinite(one))) throw new PrintRefused(whole === 0 ? 'empty' : 'damaged');
  return { kind: 'stl', positions: Float32Array.from(found.slice(0, whole)), index: null };
}

/** How many millimetres one of a 3MF's units is. */
const UNITS: Readonly<Record<string, number>> = { micron: 0.001, millimeter: 1, centimeter: 10, inch: 25.4, foot: 304.8, meter: 1000 };

/** The model part a 3MF's relationships name, or the usual one. */
const MODEL_TYPE = 'http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel';

const attr = (tag: string, name: string): string | undefined => new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`).exec(tag)?.[1] ?? new RegExp(`\\s${name}\\s*=\\s*'([^']*)'`).exec(tag)?.[1];

/** A 3MF placement (`m00 m01 m02 m10 … m32`), as a 4 × 3 matrix; none is the identity. */
type Placement = readonly number[];
const IDENTITY: Placement = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
function placementOf(text: string | undefined): Placement {
  const numbers = (text ?? '').trim().split(/\s+/).map(Number);
  return numbers.length === 12 && numbers.every(Number.isFinite) ? numbers : IDENTITY;
}
/** `a` then `b`: a corner placed by `a`, then by `b`. */
function then(a: Placement, b: Placement): Placement {
  const out: number[] = [];
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      let sum = r === 3 ? b[9 + c]! : 0;
      for (let k = 0; k < 3; k += 1) sum += a[r * 3 + k]! * b[k * 3 + c]!;
      out.push(sum);
    }
  }
  return out;
}

interface ObjectPart {
  vertices: number[];
  triangles: number[];
  components: { id: string; placement: Placement }[];
}

/** The model part's objects, by id: their corners and triangles, and the objects they are made of. */
function objectsOf(xml: string): Map<string, ObjectPart> {
  const out = new Map<string, ObjectPart>();
  const object = /<object\b([^>]*)>([\s\S]*?)<\/object>/g;
  for (let m = object.exec(xml); m !== null; m = object.exec(xml)) {
    const id = attr(m[1]!, 'id');
    if (id === undefined) continue;
    const body = m[2]!;
    const vertices: number[] = [];
    const triangles: number[] = [];
    const vertex = /<vertex\b([^>]*)\/?>/g;
    for (let v = vertex.exec(body); v !== null; v = vertex.exec(body)) vertices.push(Number(attr(v[1]!, 'x')), Number(attr(v[1]!, 'y')), Number(attr(v[1]!, 'z')));
    const triangle = /<triangle\b([^>]*)\/?>/g;
    for (let t = triangle.exec(body); t !== null; t = triangle.exec(body)) {
      triangles.push(Number(attr(t[1]!, 'v1')), Number(attr(t[1]!, 'v2')), Number(attr(t[1]!, 'v3')));
      if (triangles.length > MOST_TRIANGLES * 3) throw new PrintRefused('too-big');
    }
    const components: ObjectPart['components'] = [];
    const component = /<component\b([^>]*)\/?>/g;
    for (let c = component.exec(body); c !== null; c = component.exec(body)) {
      const of = attr(c[1]!, 'objectid');
      if (of !== undefined) components.push({ id: of, placement: placementOf(attr(c[1]!, 'transform')) });
    }
    out.set(id, { vertices, triangles, components });
  }
  return out;
}

/** The model part's words as triangles in millimetres: every build item, its objects and theirs, placed. */
export function trianglesOf3mfModel(xml: string): PrintModel {
  const root = /<model\b([^>]*)>/.exec(xml);
  if (root === null) throw new PrintRefused('not-model');
  const unit = UNITS[attr(root[1]!, 'unit') ?? 'millimeter'] ?? 1;
  const objects = objectsOf(xml);
  const positions: number[] = [];
  const index: number[] = [];
  const add = (id: string, placement: Placement, depth: number): void => {
    const one = objects.get(id);
    // An object made of itself, or ten deep, is not followed further.
    if (one === undefined || depth > 8) return;
    const first = positions.length / 3;
    for (let i = 0; i + 2 < one.vertices.length; i += 3) {
      const [x, y, z] = [one.vertices[i]!, one.vertices[i + 1]!, one.vertices[i + 2]!];
      positions.push((x * placement[0]! + y * placement[3]! + z * placement[6]! + placement[9]!) * unit, (x * placement[1]! + y * placement[4]! + z * placement[7]! + placement[10]!) * unit, (x * placement[2]! + y * placement[5]! + z * placement[8]! + placement[11]!) * unit);
    }
    const count = one.vertices.length / 3;
    for (const corner of one.triangles) {
      if (!Number.isInteger(corner) || corner < 0 || corner >= count) throw new PrintRefused('damaged');
      index.push(first + corner);
    }
    if (index.length > MOST_TRIANGLES * 3) throw new PrintRefused('too-big');
    for (const part of one.components) add(part.id, then(part.placement, placement), depth + 1);
  };
  const build = /<build\b[^>]*>([\s\S]*?)<\/build>/.exec(xml)?.[1] ?? '';
  const items = [...build.matchAll(/<item\b([^>]*)\/?>/g)];
  if (items.length > 0) for (const item of items) add(attr(item[1]!, 'objectid') ?? '', placementOf(attr(item[1]!, 'transform')), 0);
  else for (const id of objects.keys()) add(id, IDENTITY, 0);
  if (index.length === 0) throw new PrintRefused('empty');
  if (positions.some((one) => !Number.isFinite(one))) throw new PrintRefused('damaged');
  return { kind: '3mf', positions: Float32Array.from(positions), index: Uint32Array.from(index) };
}

/** The 3MF's model part: the one its relationships name, else `3D/3dmodel.model`; none where the zip has no model part. */
export async function modelPartOf(bytes: Uint8Array, entries: readonly ZipEntry[]): Promise<ZipEntry | null> {
  const named = (name: string): ZipEntry | undefined => entries.find((one) => one.name === name);
  const rels = named('_rels/.rels');
  let target: string | undefined;
  if (rels !== undefined && rels.size <= 64 * 1024) {
    const text = new TextDecoder().decode(await zipEntryBytes(bytes, rels));
    const tag = (text.match(/<Relationship\b[^>]*>/g) ?? []).find((one) => attr(one, 'Type') === MODEL_TYPE);
    target = tag === undefined ? undefined : attr(tag, 'Target')?.replace(/^\//, '');
  }
  return named(target ?? '3D/3dmodel.model') ?? null;
}

/** A 3MF's triangles; refused where it is no 3MF (a renamed zip without a model part), past the caps, or damaged. */
export async function read3mf(bytes: Uint8Array): Promise<PrintModel> {
  try {
    const entries = zipEntries(bytes);
    const part = await modelPartOf(bytes, entries);
    if (part === null) throw new PrintRefused('not-model');
    return trianglesOf3mfModel(new TextDecoder().decode(await zipEntryBytes(bytes, part)));
  } catch (caught) {
    if (caught instanceof ZipRefused) throw new PrintRefused(caught.problem === 'not-zip' ? 'not-model' : caught.problem);
    throw caught;
  }
}

/** A model to print from its bytes: a 3MF (a zip) or an STL; refused where it is neither. */
export async function readPrintModel(bytes: Uint8Array): Promise<PrintModel> {
  return isZip(bytes) ? await read3mf(bytes) : readStl(bytes);
}

/** The model's triangles as the faces' reading takes them. */
export const trianglesOfPrint = (model: PrintModel): Triangles => ({ positions: model.positions, index: model.index });
