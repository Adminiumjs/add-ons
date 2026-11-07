/**
 * A SHOP'S OWN MODEL ON THE STAGE: a kit put together (a GLB), or a model
 * to print (an STL), with the customer's design on the faces the shop marked.
 *
 * The file is read by three.js's own readers: `GLTFLoader` for a GLB (a
 * self-contained glTF 2: no Draco or meshopt packing is read, so a packed
 * file fails and the page says so) and `STLLoader` for an STL. The model is
 * moved so its middle is the stage's, and kept in its own units: a face's
 * plane is stored in those units, so it lands in the same place every time
 * the file is read.
 *
 * On each marked face a design is laid as a decal: a picture painted from
 * the same flat sheet the flat view, the proof and the laser's file are
 * drawn from, on a rectangle a hair in front of the face. While the shop
 * marks faces, each marked face is outlined, and the one picked (or under
 * the pointer) is tinted.
 *
 * Every buffer, material and picture it makes or reads is listed in `Built`
 * and let go of with it.
 */
import { BoxGeometry, Box3, BufferAttribute, BufferGeometry, CanvasTexture, Color, DoubleSide, Group, LineBasicMaterial, LineLoop, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, PlaneGeometry, SRGBColorSpace, Texture, Vector3, type Material } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { middleOf, spanOf, type FacePlane, type Triangles, type Vec } from './faces.ts';
import { darker, sliceCount } from './look.ts';
import { readPrintModel, type PrintModel } from './printModel.ts';
import type { ModelKind } from './sniff.ts';

/** A design laid on one marked face: the face's plane and the picture painted for it (none: nothing on it). */
export interface Decal {
  code: string;
  plane: FacePlane;
  canvas: HTMLCanvasElement | null;
  /** The size in millimetres the picture stands for, so a tap on it is a point of the design. */
  width: number;
  height: number;
  /**
   * On a 3D-printed item: the picture is the mask of its words (white on
   * nothing), stood up from the face by `depth` (in the model's units; it is
   * `depthMm` millimetres) in the plastic's colour, or sunk into it as a
   * darker inset.
   */
  relief?: { mode: 'raised' | 'cut'; depth: number; depthMm: number; colour: string };
}

/** The faces outlined while the shop marks them, and the one picked or under the pointer. */
export interface Marks {
  faces: readonly FacePlane[];
  selected: FacePlane | null;
  hover: FacePlane | null;
  /** The outline's and the tint's colour, `#rrggbb` (the page's accent). */
  colour: string;
}

/** A shop's model as the stage draws it. */
export interface ShopModel {
  kind: 'model';
  file: ModelKind;
  /** What the file is (its stored id): the same key is read once a stage. */
  key: string;
  bytes: ArrayBuffer;
  decals: readonly Decal[];
  marks?: Marks;
  /**
   * The colour the whole model is shown in, `#rrggbb`: a printed item's
   * plastic, over whatever colour (and colour picture) its file has. None:
   * the file's own.
   */
  colour?: string;
}

/** Reads a model's file into a tree of meshes; a test hands in its own. */
export type ReadModel = (bytes: ArrayBuffer, kind: ModelKind) => Promise<Object3D>;

/** A model to print as one mesh, its corners in millimetres as read, each triangle flat-shaded. */
export function printMesh(model: PrintModel, colour = '#c98a2e'): Mesh {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(model.positions, 3));
  if (model.index !== null) geometry.setIndex(new BufferAttribute(model.index, 1));
  // A printed model's faces are flat: each triangle is shaded as its own.
  const flat = geometry.index === null ? geometry : geometry.toNonIndexed();
  if (flat !== geometry) geometry.dispose();
  flat.computeVertexNormals();
  const mesh = new Mesh(flat, new MeshStandardMaterial({ color: colour, roughness: 0.6, metalness: 0 }));
  mesh.name = 'print';
  return mesh;
}

/**
 * The model's file read: a GLB by three.js's own reader (everything inside
 * it), a model to print (an STL or a 3MF) by the package's own, which the
 * set-up and the files read it with too.
 */
export const readModel: ReadModel = async (bytes, kind) => {
  if (kind === 'stl' || kind === '3mf') return printMesh(await readPrintModel(new Uint8Array(bytes)));
  return await new Promise<Object3D>((resolve, reject) => {
    new GLTFLoader().parse(bytes, '', (read) => resolve(read.scene), (error) => reject(error instanceof Error ? error : new Error(String(error))));
  });
};

/** Everything a built model holds that the graphics card keeps, to let go of. */
export interface BuiltModel {
  key: string;
  /** Turned and zoomed by the view. */
  group: Group;
  /** The file's own tree, its middle moved to the stage's. */
  root: Object3D;
  decals: Group;
  marks: Group;
  /** The model's size along each axis, in its own units. */
  size: Vec;
  geometries: BufferGeometry[];
  materials: Material[];
  textures: Texture[];
  /** What the decals and the outlines hold, made again each time they change. */
  dressing: { geometries: BufferGeometry[]; materials: Material[]; textures: Texture[] };
  /** Each coloured material's own colour and colour picture, to put back when the model is no longer painted. */
  own: Map<Material, { color: Color; map: Texture | null }>;
}

const isMesh = (one: Object3D): one is Mesh => (one as Mesh).isMesh === true;

/** Every texture a material holds (its colour map, its normal map, …). */
function texturesOf(material: Material): Texture[] {
  return Object.values(material as unknown as Record<string, unknown>).filter((value): value is Texture => value instanceof Texture);
}

/** The model's file, read and set in the middle of a group the view turns. */
export function buildModel(key: string, root: Object3D): BuiltModel {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  root.traverse((one) => {
    if (!isMesh(one)) return;
    geometries.add(one.geometry);
    for (const material of Array.isArray(one.material) ? one.material : [one.material]) {
      materials.add(material);
      for (const texture of texturesOf(material)) textures.add(texture);
    }
  });
  root.updateMatrixWorld(true);
  const box = new Box3().setFromObject(root);
  const middle = box.isEmpty() ? new Vector3() : box.getCenter(new Vector3());
  const size = box.isEmpty() ? new Vector3(1, 1, 1) : box.getSize(new Vector3());
  // The file's tree inside a holder moved back by its middle: the faces' planes stay in the file's own units.
  const holder = new Group();
  holder.position.set(-middle.x, -middle.y, -middle.z);
  const decals = new Group();
  const marks = new Group();
  holder.add(root, decals, marks);
  const group = new Group();
  group.add(holder);
  const own = new Map<Material, { color: Color; map: Texture | null }>();
  for (const material of materials) {
    const coloured = material as Material & { color?: unknown; map?: Texture | null };
    if (coloured.color instanceof Color) own.set(material, { color: coloured.color.clone(), map: coloured.map ?? null });
  }
  return { key, group, root, decals, marks, size: [size.x, size.y, size.z], geometries: [...geometries], materials: [...materials], textures: [...textures], dressing: { geometries: [], materials: [], textures: [] }, own };
}

/** The model's own materials in one colour (its colour pictures set aside), or back to the file's own. */
export function paint(built: BuiltModel, colour: string | undefined): void {
  for (const [material, was] of built.own) {
    const coloured = material as Material & { color: Color; map?: Texture | null };
    const map = colour === undefined ? was.map : null;
    if (colour === undefined) coloured.color.copy(was.color);
    else coloured.color.set(colour);
    if ('map' in coloured && coloured.map !== map) {
      coloured.map = map;
      material.needsUpdate = true;
    }
  }
}

/** The decals' and the outlines' buffers let go of, and the groups emptied. */
function undress(built: BuiltModel): void {
  for (const one of built.dressing.geometries) one.dispose();
  for (const one of built.dressing.materials) one.dispose();
  for (const one of built.dressing.textures) one.dispose();
  built.dressing = { geometries: [], materials: [], textures: [] };
  built.decals.clear();
  built.marks.clear();
}

/** The basis that lays a rectangle drawn in x (across) and y (up) onto a face, facing out of it. */
function basisOf(plane: FacePlane, lift: number): Matrix4 {
  const { u, v } = { u: new Vector3(...plane.u), v: new Vector3(...plane.v) };
  const n = new Vector3(...plane.normal);
  const up = v.clone().negate();
  const middle = new Vector3(...middleOf(plane)).addScaledVector(n, lift);
  return new Matrix4().makeBasis(u, up, n).setPosition(middle);
}

/** How far in front of its face a decal sits: a hair of the model's size, so it never fights the face for the same depth. */
const liftOf = (built: BuiltModel): number => Math.max(...built.size) * 0.002;

/** The design on the marked faces, and the outlines while marking: made again from scratch, the old ones let go of. */
export function dress(built: BuiltModel, model: ShopModel): void {
  undress(built);
  paint(built, model.colour);
  const lift = liftOf(built);
  for (const decal of model.decals) {
    if (decal.canvas === null) continue;
    const span = spanOf(decal.plane);
    if (!(span.w > 0) || !(span.h > 0)) continue;
    const geometry = new PlaneGeometry(span.w, span.h);
    const map = new CanvasTexture(decal.canvas);
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = 4;
    built.dressing.geometries.push(geometry);
    built.dressing.textures.push(map);
    /** One sheet of the decal, `lift` in front of the face. */
    const sheet = (at: number, material: Material, name: string): void => {
      const mesh = new Mesh(geometry, material);
      mesh.applyMatrix4(basisOf(decal.plane, at));
      mesh.name = name;
      mesh.userData = { code: decal.code, width: decal.width, height: decal.height };
      built.decals.add(mesh);
      built.dressing.materials.push(material);
    };
    const relief = decal.relief;
    if (relief === undefined) {
      sheet(lift, new MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: 0.8, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, side: DoubleSide }), `decal:${decal.code}`);
      continue;
    }
    // A printed item's words: slices of the mask up to the depth, or a darker floor on the face.
    const solid = (colour: string): MeshStandardMaterial => new MeshStandardMaterial({ color: colour, map, alphaTest: 0.5, roughness: 0.7, metalness: 0, side: DoubleSide });
    if (relief.mode === 'cut') {
      sheet(lift, solid(darker(relief.colour, 0.4)), `decal:${decal.code}`);
      continue;
    }
    const count = sliceCount(relief.depthMm);
    for (let k = 1; k <= count; k += 1) sheet(lift + (relief.depth * k) / count, solid(k === count ? relief.colour : darker(relief.colour, 0.25)), `decal:${decal.code}`);
  }
  const marks = model.marks;
  if (marks === undefined) return;
  const line = new LineBasicMaterial({ color: marks.colour });
  built.dressing.materials.push(line);
  const tint = (opacity: number): MeshBasicMaterial => {
    const material = new MeshBasicMaterial({ color: marks.colour, transparent: true, opacity, depthWrite: false, side: DoubleSide });
    built.dressing.materials.push(material);
    return material;
  };
  const outline = (plane: FacePlane): void => {
    const span = spanOf(plane);
    const [w, h] = [span.w / 2, span.h / 2];
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array([-w, -h, 0, w, -h, 0, w, h, 0, -w, h, 0]), 3));
    const loop = new LineLoop(geometry, line);
    loop.applyMatrix4(basisOf(plane, lift * 1.5));
    built.marks.add(loop);
    built.dressing.geometries.push(geometry);
  };
  const fill = (plane: FacePlane, opacity: number): void => {
    const span = spanOf(plane);
    const geometry = new PlaneGeometry(span.w, span.h);
    const mesh = new Mesh(geometry, tint(opacity));
    mesh.applyMatrix4(basisOf(plane, lift * 1.2));
    built.marks.add(mesh);
    built.dressing.geometries.push(geometry);
  };
  for (const face of marks.faces) outline(face);
  if (marks.hover !== null) fill(marks.hover, 0.16);
  if (marks.selected !== null) {
    outline(marks.selected);
    fill(marks.selected, 0.3);
  }
}

/** Let go of everything a built model holds. */
export function disposeModel(built: BuiltModel): void {
  undress(built);
  for (const one of built.geometries) one.dispose();
  for (const one of built.materials) one.dispose();
  for (const one of built.textures) one.dispose();
  built.group.removeFromParent();
}

/** A mesh's place in the model: the child it is at each level down from the top (`0/2/1`). */
export function pathOf(root: Object3D, mesh: Object3D): string {
  const steps: number[] = [];
  let at: Object3D | null = mesh;
  while (at !== null && at !== root) {
    const parent: Object3D | null = at.parent;
    if (parent === null) break;
    steps.unshift(parent.children.indexOf(at));
    at = parent;
  }
  return steps.join('/');
}

/** A mesh's triangles in the model's own units (the file's top), whatever its own place and turn. */
export function trianglesOf(root: Object3D, mesh: Mesh): Triangles {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position');
  const local = new Matrix4().copy(root.matrixWorld).invert().multiply(mesh.matrixWorld);
  const out = new Float32Array(position.count * 3);
  const one = new Vector3();
  for (let i = 0; i < position.count; i += 1) {
    one.fromBufferAttribute(position, i).applyMatrix4(local);
    out[i * 3] = one.x;
    out[i * 3 + 1] = one.y;
    out[i * 3 + 2] = one.z;
  }
  const index = geometry.getIndex();
  return { positions: out, index: index === null ? null : index.array };
}

/** Every mesh of the model, with its place. */
export function meshesOf(root: Object3D): { mesh: Mesh; path: string }[] {
  const out: { mesh: Mesh; path: string }[] = [];
  root.traverse((one) => {
    if (isMesh(one)) out.push({ mesh: one, path: pathOf(root, one) });
  });
  return out;
}

/** A stand-in model for a test: a box of the given size, made as a GLB's tree would be. */
export function boxModel(width: number, height: number, depth: number, name = 'Box'): Object3D {
  const mesh = new Mesh(new BoxGeometry(width, height, depth), new MeshStandardMaterial({ color: '#c2a175' }));
  mesh.name = name;
  const root = new Group();
  root.add(mesh);
  return root;
}

