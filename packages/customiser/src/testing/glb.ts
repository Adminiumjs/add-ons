/**
 * SMALL MODEL FILES FOR TESTS, WRITTEN BYTE BY BYTE AS THE STANDARDS SAY.
 *
 * - `glbOf`: a binary glTF 2 (a GLB) of meshes made of quads, each a named
 *   node: the JSON chunk and the binary chunk, both padded to four bytes.
 *   `required` names extensions the file says a reader must know (Draco's,
 *   for a file three.js is not given the decoder for).
 * - `stlOf`: a binary STL of the same quads.
 */

type V = readonly [number, number, number];

/** A flat four-cornered face, its corners counter-clockwise seen from the way it faces. */
export interface Quad {
  name: string;
  corners: readonly [V, V, V, V];
}

const pad = (bytes: Uint8Array, fill: number): Uint8Array => {
  const out = new Uint8Array(Math.ceil(bytes.length / 4) * 4).fill(fill);
  out.set(bytes);
  return out;
};

export function glbOf(quads: readonly Quad[], options: { required?: string[] } = {}): ArrayBuffer {
  const bin: number[] = [];
  const views: Record<string, unknown>[] = [];
  const accessors: Record<string, unknown>[] = [];
  const meshes: Record<string, unknown>[] = [];
  const nodes: Record<string, unknown>[] = [];
  const chunks: Uint8Array[] = [];
  let offset = 0;
  quads.forEach((quad, i) => {
    const positions = new Float32Array(quad.corners.flat());
    const indices = new Uint16Array([0, 1, 2, 0, 2, 3, 0, 0]);
    const p = new Uint8Array(positions.buffer);
    const x = new Uint8Array(indices.buffer);
    views.push({ buffer: 0, byteOffset: offset, byteLength: p.length, target: 34962 });
    views.push({ buffer: 0, byteOffset: offset + p.length, byteLength: 12, target: 34963 });
    chunks.push(p, x);
    offset += p.length + x.length;
    const min = [0, 1, 2].map((k) => Math.min(...quad.corners.map((c) => c[k]!)));
    const max = [0, 1, 2].map((k) => Math.max(...quad.corners.map((c) => c[k]!)));
    accessors.push({ bufferView: i * 2, componentType: 5126, count: 4, type: 'VEC3', min, max });
    accessors.push({ bufferView: i * 2 + 1, componentType: 5123, count: 6, type: 'SCALAR' });
    meshes.push({ name: quad.name, primitives: [{ attributes: { POSITION: i * 2 }, indices: i * 2 + 1 }] });
    nodes.push({ name: quad.name, mesh: i });
  });
  for (const chunk of chunks) bin.push(...chunk);
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, i) => i) }],
    nodes,
    meshes,
    accessors,
    bufferViews: views,
    buffers: [{ byteLength: bin.length }],
    ...(options.required === undefined ? {} : { extensionsUsed: options.required, extensionsRequired: options.required }),
  };
  const jsonBytes = pad(new TextEncoder().encode(JSON.stringify(json)), 0x20);
  const binBytes = pad(new Uint8Array(bin), 0);
  const total = 12 + 8 + jsonBytes.length + 8 + binBytes.length;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  out.set(new TextEncoder().encode('glTF'), 0);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonBytes.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.set(jsonBytes, 20);
  const at = 20 + jsonBytes.length;
  view.setUint32(at, binBytes.length, true);
  view.setUint32(at + 4, 0x004e4942, true);
  out.set(binBytes, at + 8);
  return out.buffer;
}

export function stlOf(quads: readonly Quad[]): ArrayBuffer {
  const triangles = quads.flatMap((quad) => [
    [quad.corners[0], quad.corners[1], quad.corners[2]],
    [quad.corners[0], quad.corners[2], quad.corners[3]],
  ]);
  const out = new ArrayBuffer(84 + triangles.length * 50);
  const view = new DataView(out);
  view.setUint32(80, triangles.length, true);
  triangles.forEach((triangle, i) => {
    const at = 84 + i * 50;
    triangle.forEach((corner, c) => corner.forEach((value, k) => view.setFloat32(at + 12 + c * 12 + k * 4, value, true)));
  });
  return out;
}

/** The shop sign of a book nook, in metres as glTF draws: 92 × 22 mm, facing the front. */
export const SIGN: Quad = {
  name: 'Sign',
  corners: [
    [-0.046, -0.011, 0.075],
    [0.046, -0.011, 0.075],
    [0.046, 0.011, 0.075],
    [-0.046, 0.011, 0.075],
  ],
};

/** A wall behind it, facing the front: 110 × 180 mm. */
export const WALL: Quad = {
  name: 'Back wall',
  corners: [
    [-0.055, -0.09, -0.075],
    [0.055, -0.09, -0.075],
    [0.055, 0.09, -0.075],
    [-0.055, 0.09, -0.075],
  ],
};
