/**
 * A FLAT PIECE AS A SOLID: its outline pushed up to the material's thickness.
 *
 * The shop's cleaned outline (the same file the laser's CUT layer is made
 * from, framed to the piece's size the same way) is read as rings in
 * millimetres, sorted into the piece and the holes cut through it, and
 * extruded at the thickness. The customer's design sits on the top face as
 * a picture painted from the same flat sheet the flat view, the proof and
 * the files are drawn from; the bottom and the sides take the material's
 * own colours. Without an outline, the piece is its rectangle with its
 * rounded corners.
 *
 * One unit is one millimetre. The piece lies with its top facing +z, its
 * middle at the origin; x runs right and y up (the drawing's y runs down).
 */
import { BufferAttribute, CanvasTexture, ExtrudeGeometry, Group, Mesh, MeshStandardMaterial, Path, Shape, ShapeGeometry, SRGBColorSpace, type BufferGeometry, type Material, type Texture } from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';

import { frameInto, matrixText, times, type ReadSvg } from '../draw/svgread.ts';
import { darker, sliceCount } from './look.ts';
import { roundedRing, solidsOf, type Point, type Solid } from './rings.ts';

/** What a piece is made from, as the stage draws it. */
export interface PieceModel {
  /** The piece's size and corners, in millimetres. */
  width: number;
  height: number;
  corner: number;
  thickness: number;
  /** The shop's outline, read; none for the rectangle. */
  outline: ReadSvg | null;
  /** The material's face and edge colours, `#rrggbb`. */
  face: string;
  edge: string;
  /** The top face as painted from the design's flat sheet, the full piece's box; none for the bare material. */
  top: HTMLCanvasElement | null;
  /**
   * A 3D-printed item's words, raised from its top or cut into it: the
   * design's words and logo painted white on nothing (`mask`, the piece's
   * box), stood up by `depth` millimetres or sunk as a darker inset.
   */
  relief?: { mode: 'raised' | 'cut'; depth: number; mask: HTMLCanvasElement | null };
}

/** Path data is passed on as it was read, and only drawing commands and numbers. */
const safeD = (d: string): string => d.replace(/[^MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]/g, '');

/**
 * The outline's rings in millimetres from the piece's top-left, y down: every
 * shape the laser would cut (on the CUT layer, or on none), framed to the
 * piece's size as the laser file frames it.
 */
export function outlineRings(outline: ReadSvg, width: number, height: number): Point[][] {
  const frame = frameInto(outline.view, { x: 0, y: 0, w: width, h: height }, 'stretch');
  const cut = outline.shapes.filter((one) => one.layer === null || one.layer === 'CUT');
  if (cut.length === 0 || typeof DOMParser === 'undefined') return [];
  const paths = cut.map((one) => `<path d="${safeD(one.d)}" transform="${matrixText(times(frame, one.matrix))}"/>`).join('');
  const read = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg">${paths}</svg>`);
  return read.paths.flatMap((path) => path.subPaths.map((sub) => sub.getPoints(12).map((one) => ({ x: one.x, y: one.y }))));
}

/** The piece's solids: from its outline where it has one that holds a ring, else its rounded rectangle. */
export function pieceSolids(model: Pick<PieceModel, 'width' | 'height' | 'corner' | 'outline'>): Solid[] {
  const width = Math.max(model.width, 1);
  const height = Math.max(model.height, 1);
  const read = model.outline === null ? [] : solidsOf(outlineRings(model.outline, width, height));
  return read.length > 0 ? read : [{ outer: roundedRing(width, height, model.corner), holes: [] }];
}

/** The solids as three.js shapes, centred on the piece's middle with y up. */
export function shapesOf(solids: readonly Solid[], width: number, height: number): Shape[] {
  const at = (one: Point): [number, number] => [one.x - width / 2, height / 2 - one.y];
  const pathOf = <T extends Path>(target: T, ring: readonly Point[]): T => {
    ring.forEach((one, index) => (index === 0 ? target.moveTo(...at(one)) : target.lineTo(...at(one))));
    target.closePath();
    return target;
  };
  return solids.map((solid) => {
    const shape = pathOf(new Shape(), solid.outer);
    shape.holes = solid.holes.map((hole) => pathOf(new Path(), hole));
    return shape;
  });
}

/** The piece's body: its outline extruded through the thickness, from −t/2 to +t/2. */
export function bodyGeometry(shapes: readonly Shape[], thickness: number): ExtrudeGeometry {
  const depth = Math.max(thickness, 0.2);
  const geometry = new ExtrudeGeometry(shapes as Shape[], { depth, bevelEnabled: false, curveSegments: 12 });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

/**
 * The top face, a hair above the body, with the picture laid on it: (0, 0)
 * of the picture at the piece's top-left, its full size the piece's box.
 */
export function topGeometry(shapes: readonly Shape[], width: number, height: number, thickness: number): ShapeGeometry {
  const geometry = new ShapeGeometry(shapes as Shape[], 12);
  const position = geometry.getAttribute('position');
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i += 1) {
    uv[i * 2] = (position.getX(i) + width / 2) / width;
    uv[i * 2 + 1] = (position.getY(i) + height / 2) / height;
  }
  geometry.setAttribute('uv', new BufferAttribute(uv, 2));
  geometry.translate(0, 0, Math.max(thickness, 0.2) / 2 + 0.02);
  return geometry;
}

/** The point on the top face a picture's (u, v) is, in millimetres from the piece's top-left. */
export const pointOfUv = (u: number, v: number, width: number, height: number): Point => ({ x: u * width, y: (1 - v) * height });

/** Everything a built piece holds that the graphics card keeps, to let go of. */
export interface Built {
  group: Group;
  top: Mesh;
  geometries: BufferGeometry[];
  materials: Material[];
  textures: Texture[];
}

/** The piece, ready to add to a scene. */
export function buildPiece(model: PieceModel): Built {
  const width = Math.max(model.width, 1);
  const height = Math.max(model.height, 1);
  const shapes = shapesOf(pieceSolids(model), width, height);
  const body = bodyGeometry(shapes, model.thickness);
  const topShape = topGeometry(shapes, width, height, model.thickness);
  const textures: Texture[] = [];
  let map: Texture | null = null;
  if (model.top !== null) {
    map = new CanvasTexture(model.top);
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = 4;
    textures.push(map);
  }
  const cap = new MeshStandardMaterial({ color: model.face, roughness: 0.82, metalness: 0 });
  const side = new MeshStandardMaterial({ color: model.edge, roughness: 0.9, metalness: 0 });
  const top = new MeshStandardMaterial({ color: map === null ? model.face : '#ffffff', map, roughness: 0.78, metalness: 0 });
  // An extruded shape's first group is its two caps, its second its sides.
  const bodyMesh = new Mesh(body, [cap, side]);
  const topMesh = new Mesh(topShape, top);
  topMesh.name = 'top';
  const group = new Group();
  group.add(bodyMesh, topMesh);
  const built: Built = { group, top: topMesh, geometries: [body, topShape], materials: [cap, side, top], textures };
  if (model.relief?.mask !== null && model.relief !== undefined) reliefLayers(built, model, shapes, width, height);
  return built;
}

/**
 * A printed item's words, stood up from its top (raised) or sunk into it
 * (cut in), drawn from the mask of its words: raised, a stack of slices of
 * the words up to the depth, the sides in the plastic's shade and the top in
 * its colour; cut in, the words as a darker floor just on the top.
 */
function reliefLayers(built: Built, model: PieceModel, shapes: readonly Shape[], width: number, height: number): void {
  const relief = model.relief!;
  const mask = new CanvasTexture(relief.mask!);
  mask.colorSpace = SRGBColorSpace;
  built.textures.push(mask);
  const slice = (lift: number, colour: string, name: string): void => {
    const geometry = topGeometry(shapes, width, height, model.thickness);
    geometry.translate(0, 0, lift);
    const material = new MeshStandardMaterial({ color: colour, map: mask, alphaTest: 0.5, roughness: 0.7, metalness: 0 });
    const mesh = new Mesh(geometry, material);
    mesh.name = name;
    built.group.add(mesh);
    built.geometries.push(geometry);
    built.materials.push(material);
  };
  if (relief.mode === 'cut') {
    slice(0.01, darker(model.face, 0.4), 'cut');
    return;
  }
  const count = sliceCount(relief.depth);
  for (let k = 1; k <= count; k += 1) slice((relief.depth * k) / count, k === count ? model.face : darker(model.face, 0.25), k === count ? 'raised-top' : 'raised-side');
}

/** Whether two models make the same body, so only the picture on top need change (a printed item's words stand on it: it is built again). */
export const sameBody = (a: PieceModel, b: PieceModel): boolean =>
  a.relief === undefined &&
  b.relief === undefined &&
  a.width === b.width && a.height === b.height && a.corner === b.corner && a.thickness === b.thickness && a.outline === b.outline && a.face === b.face && a.edge === b.edge;

/** A new picture on the top face of a built piece; the old one is let go of. */
export function retexture(built: Built, model: PieceModel): void {
  for (const one of built.textures) one.dispose();
  built.textures.length = 0;
  const material = built.top.material as MeshStandardMaterial;
  if (model.top === null) {
    material.map = null;
    material.color.set(model.face);
  } else {
    const map = new CanvasTexture(model.top);
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = 4;
    built.textures.push(map);
    material.map = map;
    material.color.set('#ffffff');
  }
  material.needsUpdate = true;
}

/** Let go of everything a built piece holds. */
export function disposeBuilt(built: Built): void {
  for (const one of built.geometries) one.dispose();
  for (const one of built.materials) one.dispose();
  for (const one of built.textures) one.dispose();
  built.group.removeFromParent();
}
