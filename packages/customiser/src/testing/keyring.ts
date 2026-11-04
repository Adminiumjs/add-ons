/**
 * THE COMP'S NAME KEYRING AS MODEL FILES, FOR TESTS.
 *
 * - `keyringStl`: the model to print, 56 × 24 × 4 mm, its ends rounded
 *   (11 mm, the base's corner), a 5 mm hole near its left end for the ring,
 *   lying flat with its top up the z axis as slicers keep it; a binary STL.
 * - `keyringGlb`: its lighter preview, a box of the same size in metres as
 *   glTF draws, its top up the y axis, as an exporter turns it.
 * - `ballStl`: a ball, all curve: no face of it can carry words.
 */
import { ExtrudeGeometry, Path, Shape, SphereGeometry } from 'three';

import { glbOf, type Quad } from './glb.ts';

const binaryStl = (positions: ArrayLike<number>): ArrayBuffer => {
  const count = positions.length / 9;
  const out = new ArrayBuffer(84 + count * 50);
  const view = new DataView(out);
  view.setUint32(80, count, true);
  for (let t = 0; t < count; t += 1) for (let k = 0; k < 9; k += 1) view.setFloat32(84 + t * 50 + 12 + k * 4, positions[t * 9 + k]!, true);
  return out;
};

/** The keyring's outline: 56 × 24 mm, its ends round, with the ring's hole. */
export function keyringShape(hole = true): Shape {
  const r = 12;
  const shape = new Shape().moveTo(r, 0).lineTo(56 - r, 0).absarc(56 - r, 12, r, -Math.PI / 2, Math.PI / 2, false).lineTo(r, 24).absarc(r, 12, r, Math.PI / 2, (3 * Math.PI) / 2, false);
  if (hole) shape.holes.push(new Path().moveTo(4, 9.5).lineTo(9, 9.5).lineTo(9, 14.5).lineTo(4, 14.5).closePath());
  return shape;
}

export function keyringStl(hole = true): ArrayBuffer {
  const geometry = new ExtrudeGeometry(keyringShape(hole), { depth: 4, bevelEnabled: false, curveSegments: 24 });
  const bytes = binaryStl(geometry.getAttribute('position').array);
  geometry.dispose();
  return bytes;
}

export function ballStl(): ArrayBuffer {
  const geometry = new SphereGeometry(20, 48, 32).toNonIndexed();
  const bytes = binaryStl(geometry.getAttribute('position').array);
  geometry.dispose();
  return bytes;
}

/** A box in metres, y up: 56 mm across, 4 mm high, 24 mm deep, its middle where `at` says. */
export function keyringGlb(at: readonly [number, number, number] = [0, 0.002, 0]): ArrayBuffer {
  const [w, h, d] = [0.028, 0.002, 0.012];
  const [x, y, z] = at;
  const c = (sx: number, sy: number, sz: number): readonly [number, number, number] => [x + sx * w, y + sy * h, z + sz * d];
  const quads: Quad[] = [
    { name: 'Top', corners: [c(-1, 1, 1), c(1, 1, 1), c(1, 1, -1), c(-1, 1, -1)] },
    { name: 'Bottom', corners: [c(-1, -1, -1), c(1, -1, -1), c(1, -1, 1), c(-1, -1, 1)] },
    { name: 'Front', corners: [c(-1, -1, 1), c(1, -1, 1), c(1, 1, 1), c(-1, 1, 1)] },
    { name: 'Back', corners: [c(1, -1, -1), c(-1, -1, -1), c(-1, 1, -1), c(1, 1, -1)] },
    { name: 'Left', corners: [c(-1, -1, -1), c(-1, -1, 1), c(-1, 1, 1), c(-1, 1, -1)] },
    { name: 'Right', corners: [c(1, -1, 1), c(1, -1, -1), c(1, 1, -1), c(1, 1, 1)] },
  ];
  return glbOf(quads);
}
