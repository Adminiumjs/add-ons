/**
 * THE PREVIEW MODEL LAID OVER THE MODEL TO PRINT: no three.js in it.
 *
 * A 3D-printed item has two files: the model the printer gets (an STL or a
 * 3MF, in millimetres, its top up the z axis as slicers keep it) and a
 * lighter GLB the shoppers' preview turns (glTF's own way: metres, often,
 * and its top up the y axis). Faces are marked on the model to print; the
 * preview shows them on the GLB. So the two are laid one over the other:
 *
 * - the GLB is taken as the same object, turned from z-up to y-up as
 *   exporters turn it (x, y, z → x, z, −y), or not turned at all, whichever
 *   makes the two boxes the same shape;
 * - it is scaled so the boxes are the same size (its diagonal against the
 *   print model's), and moved so their middles meet.
 *
 * How well the boxes agree after that is said (`misfit`, the largest
 * difference along a side as a share of it): the set-up warns when the two
 * files are not the same object.
 */
import type { FacePlane, Vec } from './faces.ts';

export interface Extent {
  min: Vec;
  max: Vec;
}

export type Turn = 'none' | 'z-up';

/** How a point of the model to print is put on the preview model. */
export interface Alignment {
  turn: Turn;
  /** Preview units per millimetre of the model to print. */
  scale: number;
  printMiddle: Vec;
  previewMiddle: Vec;
  /** The largest difference between the boxes along a side, after the fit, as a share of that side. */
  misfit: number;
}

/** A direction turned from the model to print's axes to the preview's (`+ 0`: never a negative zero, so a saved plane reads back the same). */
export const turned = (turn: Turn, a: Vec): Vec => (turn === 'z-up' ? [a[0] + 0, a[2] + 0, -a[1] + 0] : [a[0] + 0, a[1] + 0, a[2] + 0]);

const middleOf = (box: Extent): Vec => [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, (box.min[2] + box.max[2]) / 2];
const sizeOf = (box: Extent): Vec => [box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]];

/** The fit of the preview's box over the print model's, the better of the two turns. */
export function align(print: Extent, preview: Extent): Alignment {
  const ps = sizeOf(print);
  const gs = sizeOf(preview);
  const diagonal = (s: Vec): number => Math.hypot(s[0], s[1], s[2]);
  const scale = diagonal(ps) > 0 ? diagonal(gs) / diagonal(ps) : 1;
  const fit = (turn: Turn): number => {
    const want = turned(turn, ps).map((one) => Math.abs(one) * scale);
    return Math.max(...want.map((one, k) => Math.abs(one - gs[k]!) / Math.max(one, gs[k]!, 1e-9)));
  };
  const [none, zUp] = [fit('none'), fit('z-up')];
  const turn: Turn = zUp < none ? 'z-up' : 'none';
  return { turn, scale, printMiddle: middleOf(print), previewMiddle: middleOf(preview), misfit: Math.min(none, zUp) };
}

/** A point of the model to print, on the preview. */
export function placePoint(a: Alignment, p: Vec): Vec {
  const d = turned(a.turn, [p[0] - a.printMiddle[0], p[1] - a.printMiddle[1], p[2] - a.printMiddle[2]]);
  return [a.previewMiddle[0] + d[0] * a.scale, a.previewMiddle[1] + d[1] * a.scale, a.previewMiddle[2] + d[2] * a.scale];
}

/** A face of the model to print as the same face on the preview, in the preview's numbers. */
export function placePlane(a: Alignment, plane: FacePlane): FacePlane {
  return {
    mesh: 'preview',
    normal: turned(a.turn, plane.normal),
    point: placePoint(a, plane.point),
    u: turned(a.turn, plane.u),
    v: turned(a.turn, plane.v),
    bounds: { u0: plane.bounds.u0 * a.scale, u1: plane.bounds.u1 * a.scale, v0: plane.bounds.v0 * a.scale, v1: plane.bounds.v1 * a.scale },
  };
}

/** The most the two boxes may differ along a side and still be called the same object. */
export const MISFIT = 0.05;
