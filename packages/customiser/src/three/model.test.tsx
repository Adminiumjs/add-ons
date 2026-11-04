// @vitest-environment jsdom
/**
 * A SHOP'S OWN MODEL ON THE STAGE, AND ITS FLAT FACES, HELD WITHOUT A GRAPHICS CARD.
 *
 * - The files are told apart by their bytes.
 * - A face is flat when its patch of one plane is a real face; a curve is not.
 * - A marked face is kept as numbers that come back the same after a save.
 * - A GLB is read by three.js's own reader (a small file written byte by
 *   byte), a Draco-packed one is refused; the stage is run with a stand-in
 *   reader too, and every buffer it made is let go of.
 * - A design is laid on a marked face where the face is, facing out of it.
 */
import { Group, Mesh, MeshStandardMaterial, SphereGeometry, Vector3, type BufferGeometry, type Material, type Object3D, type Texture } from 'three';
import { describe, expect, it } from 'vitest';

import { glbOf, SIGN, stlOf, WALL } from '../testing/glb.ts';
import { axesOf, faceAt, facesOf, facesValue, flatFacesOf, middleOf, mmPerUnit, onFace, sameFace, sizeOfModel, type MarkedFace, type Triangles } from './faces.ts';
import { boxModel, readModel, trianglesOf, type ShopModel } from './model.ts';
import { isGlb, isStl, isSvg, modelKindOf } from './sniff.ts';
import { Stage3d, type RendererLike } from './stage3d.ts';

function standIn(): RendererLike & { disposed: boolean } {
  return {
    domElement: document.createElement('canvas'),
    disposed: false,
    setPixelRatio: () => {},
    setSize: () => {},
    render: () => {},
    dispose() {
      this.disposed = true;
    },
  };
}

const geometryTriangles = (geometry: BufferGeometry): Triangles => ({ positions: geometry.getAttribute('position').array, index: geometry.getIndex()?.array ?? null });

describe('a file, by its bytes', () => {
  it('knows a GLB by its header and its own length, never by its name', () => {
    const glb = new Uint8Array(glbOf([SIGN]));
    expect(isGlb(glb)).toBe(true);
    expect(modelKindOf(glb)).toBe('glb');
    // One byte short: the header's length is no longer the file's.
    expect(isGlb(glb.subarray(0, glb.length - 4))).toBe(false);
    expect(isGlb(new TextEncoder().encode('glTF but not a model at all, just words'))).toBe(false);
  });

  it('knows a binary STL by its size, and a text one by its words', () => {
    expect(isStl(new Uint8Array(stlOf([SIGN])))).toBe(true);
    expect(isStl(new TextEncoder().encode('solid sign\n facet normal 0 0 1\n outer loop\n'))).toBe(true);
    expect(isStl(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe(false);
  });

  it('knows an SVG by its first tag, after an XML line and comments', () => {
    expect(isSvg(new TextEncoder().encode('﻿<?xml version="1.0"?>\n<!-- Inkscape -->\n<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBe(true);
    expect(isSvg(new TextEncoder().encode('<html><svg></svg></html>'))).toBe(false);
    expect(isSvg(new Uint8Array(glbOf([SIGN])))).toBe(false);
  });
});

describe('a flat face', () => {
  const box = boxModel(110, 180, 150);
  const mesh = box.children[0] as Mesh;
  const tris = geometryTriangles(mesh.geometry);
  const size = sizeOfModel(tris);

  it('is the whole side of a box, from any one of its triangles', () => {
    // A box's triangles go two a side: +x, −x, +y, −y, +z, −z.
    const front = faceAt(tris, 8, '0', size, 'Box');
    expect(front.flat).toBe(true);
    if (!front.flat) return;
    expect([...front.plane.normal]).toEqual([0, 0, 1]);
    expect(front.plane.bounds.u1 - front.plane.bounds.u0).toBeCloseTo(110, 6);
    expect(front.plane.bounds.v1 - front.plane.bounds.v0).toBeCloseTo(180, 6);
    expect(front.area).toBeCloseTo(110 * 180, 3);
    expect([...middleOf(front.plane)].map((one) => Math.round(one * 1000) / 1000)).toEqual([0, 0, 75]);
    const other = faceAt(tris, 9, '0', size);
    expect(other.flat && sameFace(other.plane, front.plane, size)).toBe(true);
  });

  it('reads across as words read, seen from outside, and down the face', () => {
    expect(axesOf([0, 0, 1])).toEqual({ u: [1, 0, 0], v: [0, -1, 0] });
    // A face looking up is read from the front: its top runs away.
    const up = axesOf([0, 1, 0]);
    expect(up.u.map((one) => Math.round(one))).toEqual([1, 0, 0]);
    expect(up.v.map((one) => Math.round(one))).toEqual([0, 0, 1]);
  });

  it('is never a curve: a sphere has no face that can carry words', () => {
    const sphere = new SphereGeometry(40, 48, 24);
    const round = geometryTriangles(sphere);
    const found = faceAt(round, 400, '0', sizeOfModel(round));
    expect(found.flat).toBe(false);
    expect(flatFacesOf(round, '0', sizeOfModel(round))).toEqual([]);
    sphere.dispose();
  });

  it('is never a sliver: a strip thinner than a twentieth of the model is not a face', () => {
    const thin = boxModel(110, 1, 150);
    const t = geometryTriangles((thin.children[0] as Mesh).geometry);
    // The front of the strip: 110 × 1 mm on a model 186 mm across.
    expect(faceAt(t, 8, '0', sizeOfModel(t)).flat).toBe(false);
    // Its top is a real face.
    expect(faceAt(t, 4, '0', sizeOfModel(t)).flat).toBe(true);
  });

  it('lists every face a keyboard can pick, largest first', () => {
    const faces = flatFacesOf(tris, '0', size);
    expect(faces).toHaveLength(6);
    expect(faces.map((one) => Math.round(one.area))).toEqual([27000, 27000, 19800, 19800, 16500, 16500]);
  });

  it('finds the same faces in a model written as loose triangles (an STL), by joining their corners', () => {
    const loose = mesh.geometry.toNonIndexed();
    const t = geometryTriangles(loose);
    expect(faceAt(t, 8, '0', sizeOfModel(t)).flat).toBe(true);
    expect(flatFacesOf(t, '0', sizeOfModel(t))).toHaveLength(6);
    loose.dispose();
  });

  it('says whether a point lies on it', () => {
    const front = faceAt(tris, 8, '0', size);
    if (!front.flat) throw new Error('flat');
    expect(onFace(front.plane, [10, 10, 75], size)).toBe(true);
    expect(onFace(front.plane, [10, 10, 70], size)).toBe(false);
    expect(onFace(front.plane, [80, 10, 75], size)).toBe(false);
  });

  it('measures a model drawn in metres in millimetres', () => {
    expect(mmPerUnit(0.11, 110)).toBeCloseTo(1000, 6);
    expect(mmPerUnit(0.11, null)).toBe(1000);
    expect(mmPerUnit(110, null)).toBe(1);
  });
});

describe('a marked face, kept', () => {
  it('comes back as the same plane after it is saved and read again', () => {
    const tris = geometryTriangles((boxModel(110, 180, 150).children[0] as Mesh).geometry);
    const front = faceAt(tris, 8, '0', sizeOfModel(tris), 'Box');
    if (!front.flat) throw new Error('flat');
    const marked: MarkedFace = { ...front.plane, code: 'sign', name: 'Sign board', piece: '9', size: { w: 92, h: 22 } };
    const read = facesOf(facesValue([marked]));
    expect(read).toEqual([marked]);
    // The column may come back parsed: the same faces.
    expect(facesOf(JSON.parse(facesValue([marked])) as unknown)).toEqual([marked]);
    expect(facesOf('not json')).toEqual([]);
    expect(facesOf(JSON.stringify([{ code: 'x' }, marked]))).toEqual([marked]);
  });
});

/** Everything a stage's scene holds for the graphics card, each marked when it is let go of. */
function watch(stage: Stage3d): { all: number; gone: () => number } {
  const found = new Set<BufferGeometry | Material | Texture>();
  stage.scene.traverse((node) => {
    const one = node as Mesh;
    if (one.geometry === undefined) return;
    found.add(one.geometry);
    for (const material of [one.material].flat() as Material[]) {
      found.add(material);
      const map = (material as Material & { map?: Texture | null }).map;
      if (map) found.add(map);
    }
  });
  let gone = 0;
  for (const one of found) one.addEventListener('dispose', () => (gone += 1));
  return { all: found.size, gone: () => gone };
}

const shop = (over: Partial<ShopModel> = {}): ShopModel => ({ kind: 'model', file: 'glb', key: 'file_1', bytes: new ArrayBuffer(8), decals: [], ...over });

describe('the stage, with a shop’s model', () => {
  it('reads a real GLB with three.js’s own reader, its meshes named as the file names them', async () => {
    const root = await readModel(glbOf([SIGN, WALL]), 'glb');
    const names: string[] = [];
    root.traverse((one) => {
      if ((one as Mesh).isMesh === true) names.push(one.name);
    });
    // three.js writes a name's spaces as underscores; a face keeps the name as read.
    expect(names).toEqual(['Sign', 'Back_wall']);
  });

  it('refuses a GLB packed with Draco, so the page shows its built-in preview', async () => {
    await expect(readModel(glbOf([SIGN], { required: ['KHR_draco_mesh_compression'] }), 'glb')).rejects.toThrow();
  });

  it('reads an STL into one mesh', async () => {
    const root = await readModel(stlOf([SIGN]), 'stl');
    expect((root as Mesh).isMesh).toBe(true);
    expect((root as Mesh).geometry.getAttribute('position').count).toBe(6);
  });

  it('picks the flat face under a spot, in the model’s own units, and finds none on a curve', async () => {
    const stage = new Stage3d(standIn(), async () => boxModel(110, 180, 150));
    stage.resize(400, 400);
    await stage.setModel(shop());
    stage.setView({ rx: 0, ry: 0, zoom: 1 });
    const picked = stage.pickFace(0.5, 0.5);
    expect(picked?.flat).toBe(true);
    if (picked?.flat !== true) return;
    expect([...picked.plane.normal]).toEqual([0, 0, 1]);
    expect(picked.plane.mesh).toBe('0');
    expect(picked.plane.meshName).toBe('Box');
    expect(stage.pickFace(0.01, 0.01)).toBeNull();
    expect(stage.flatFaces()).toHaveLength(6);
    expect(stage.modelBox()).toEqual([110, 180, 150]);

    const round = new Stage3d(standIn(), async () => {
      const group = new Group();
      group.add(new Mesh(new SphereGeometry(40, 48, 24), new MeshStandardMaterial()));
      return group;
    });
    round.resize(400, 400);
    await round.setModel(shop({ key: 'round' }));
    round.setView({ rx: 0, ry: 0, zoom: 1 });
    expect(round.pickFace(0.5, 0.5)).toEqual({ flat: false });
  });

  it('keeps the picked plane whatever the file’s own turn, since a face is stored in the file’s units', async () => {
    const stage = new Stage3d(standIn(), async () => {
      const root = boxModel(110, 180, 150);
      root.children[0]!.position.set(500, 0, 0);
      return root;
    });
    stage.resize(400, 400);
    await stage.setModel(shop());
    stage.setView({ rx: 0, ry: 0, zoom: 1 });
    const picked = stage.pickFace(0.5, 0.5);
    expect(picked?.flat === true ? middleOf(picked.plane).map((one) => Math.round(one)) : null).toEqual([500, 0, 75]);
  });

  it('lays a design on a marked face, a hair in front of it, facing out, and finds the point of the design a tap lands on', async () => {
    const stage = new Stage3d(standIn(), async () => boxModel(110, 180, 150));
    stage.resize(400, 400);
    const tris = geometryTriangles((boxModel(110, 180, 150).children[0] as Mesh).geometry);
    const front = faceAt(tris, 8, '0', sizeOfModel(tris));
    if (!front.flat) throw new Error('flat');
    const canvas = document.createElement('canvas');
    await stage.setModel(shop({ decals: [{ code: 'sign', plane: front.plane, canvas, width: 92, height: 22 }] }));
    stage.setView({ rx: 0, ry: 0, zoom: 1 });
    const decal = stage.scene.getObjectByName('decal:sign') as Mesh;
    expect(decal).toBeDefined();
    stage.scene.updateMatrixWorld(true);
    const at = decal.getWorldPosition(new Vector3());
    expect([at.x, at.y].map((one) => Math.round(one * 1000) / 1000)).toEqual([0, 0]);
    expect(at.z).toBeGreaterThan(75);
    expect(at.z).toBeLessThan(76);
    const facingOut = new Vector3(0, 0, 1).transformDirection(decal.matrixWorld);
    expect(facingOut.z).toBeCloseTo(1, 6);
    expect(((decal.material as MeshStandardMaterial).map?.image as unknown) === canvas).toBe(true);
    const spot = stage.pickDecal(0.5, 0.5);
    expect(spot?.code).toBe('sign');
    expect(spot?.point.x).toBeCloseTo(46, 1);
    expect(spot?.point.y).toBeCloseTo(11, 1);
  });

  it('reads a file once, dresses it again when only the design changes, and lets everything go', async () => {
    let reads = 0;
    const stage = new Stage3d(standIn(), async () => {
      reads += 1;
      return boxModel(110, 180, 150);
    });
    stage.resize(300, 300);
    const tris = geometryTriangles((boxModel(110, 180, 150).children[0] as Mesh).geometry);
    const front = faceAt(tris, 8, '0', sizeOfModel(tris));
    if (!front.flat) throw new Error('flat');
    const decal = (canvas: HTMLCanvasElement) => ({ code: 'sign', plane: front.plane, canvas, width: 92, height: 22 });
    await stage.setModel(shop({ decals: [decal(document.createElement('canvas'))] }));
    const first = watch(stage);
    // The box's geometry and material, the decal's geometry, material and picture.
    expect(first.all).toBe(5);
    await stage.setModel(shop({ decals: [decal(document.createElement('canvas'))], marks: { faces: [front.plane], selected: front.plane, hover: null, colour: '#1c59e0' } }));
    expect(reads).toBe(1);
    // Only the old decal went.
    expect(first.gone()).toBe(3);
    const second = watch(stage);
    await stage.setModel(shop({ key: 'file_2' }));
    expect(reads).toBe(2);
    expect(second.gone()).toBe(second.all);
    const third = watch(stage);
    const renderer = stage.renderer as ReturnType<typeof standIn>;
    stage.dispose();
    expect(third.gone()).toBe(third.all);
    expect(renderer.disposed).toBe(true);
  });

  it('lets go of a model read after the stage went', async () => {
    let finish: (root: Object3D) => void = () => {};
    const stage = new Stage3d(standIn(), () => new Promise((resolve) => (finish = resolve)));
    const asked = stage.setModel(shop());
    stage.dispose();
    const late = boxModel(10, 10, 10);
    let gone = 0;
    ((late.children[0] as Mesh).geometry as BufferGeometry).addEventListener('dispose', () => (gone += 1));
    finish(late);
    await asked;
    expect(gone).toBe(1);
  });

  it('finds the faces of a mesh placed anywhere in the file, in the file’s units', () => {
    const root = boxModel(10, 10, 10);
    root.children[0]!.position.set(0, 0, 100);
    root.updateMatrixWorld(true);
    const t = trianglesOf(root, root.children[0] as Mesh);
    const found = faceAt(t, 8, '0', sizeOfModel(t));
    expect(found.flat === true ? middleOf(found.plane)[2] : null).toBeCloseTo(105, 6);
  });
});
