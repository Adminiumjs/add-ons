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
import { Color, Group, Mesh, MeshStandardMaterial, Texture, SphereGeometry, Vector3, type BufferGeometry, type Material, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';

import { glbOf, SIGN, stlOf, WALL } from '../testing/glb.ts';
import { axesOf, faceAt, flatFacesOf, middleOf, mmPerUnit, onFace, sameFace, sizeOfModel, type MarkedFace, type Triangles } from './faces.ts';
import { facesOf, facesValue } from './faceStore.ts';
import { boxModel, readModel, trianglesOf, type ShopModel } from './shopModel.ts';
import { isGlb, isStl, isSvg, modelKindOf } from './sniff.ts';
import { Stage3d, type RendererLike } from './stage3d.ts';
import { apply, Gestures, isUpright, startView, turned, type View } from './view.ts';

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

describe('a shop’s model, as the stage first shows it', () => {
  /** The stage's turned group, and where a direction of the model's own points once it is turned (the camera looks down −z). */
  const turnedOf = (stage: Stage3d) => {
    const group = stage.scene.children.find((one) => one.type === 'Group')!;
    group.updateMatrixWorld(true);
    return (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z).transformDirection(group.matrixWorld);
  };
  const deg = (radians: number): number => (radians * 180) / Math.PI;

  it('sees a GLB, which stands up the y axis, from above at each kind’s start: never from below', async () => {
    for (const kind of ['printed', 'kit'] as const) {
      const stage = new Stage3d(standIn(), async () => boxModel(80, 120, 60));
      stage.resize(400, 400);
      await stage.setModel(shop());
      stage.setView(startView(kind));
      const top = turnedOf(stage)(0, 1, 0);
      // The model's top leans toward the camera, by the start's tilt: the view looks down on it.
      expect(top.z).toBeGreaterThan(0);
      expect(deg(Math.asin(top.z))).toBeCloseTo(startView(kind).rx, 6);
      expect(top.y).toBeGreaterThan(0);
    }
  });

  it('still looks down on a model to print, which lies up the z axis, as on a flat piece', async () => {
    const stage = new Stage3d(standIn(), async () => boxModel(80, 60, 120));
    stage.resize(400, 400);
    await stage.setModel(shop({ file: 'stl' }));
    stage.setView(startView('printed'));
    const top = turnedOf(stage)(0, 0, 1);
    // Faces the camera, its far edge raised: seen from 90° less the tilt above (turned by the start's turn first).
    const rad = Math.PI / 180;
    expect(top.z).toBeCloseTo(Math.cos(30 * rad) * Math.cos(18 * rad), 6);
    expect(top.y).toBeGreaterThan(0);
  });

  it('turns the near side the same way for every model: a drag down, the down button and the down arrow tip it down', async () => {
    expect(isUpright(shop())).toBe(true);
    expect(isUpright(shop({ file: 'stl' }))).toBe(false);
    expect(isUpright({ width: 10 })).toBe(false);
    for (const file of ['glb', 'stl'] as const) {
      const upright = file === 'glb';
      const stage = new Stage3d(standIn(), async () => boxModel(80, 120, 60));
      stage.resize(400, 400);
      await stage.setModel(shop({ file }));
      const start: View = startView('printed');
      stage.setView(start);
      // The side of the model that faces the camera untilted (+z), before and after.
      const near = (): Vector3 => turnedOf(stage)(0, 0, 1);
      const before = near().y;
      const gestures = new Gestures();
      gestures.down(1, 100, 100, false, start);
      const dragged = gestures.move(1, 100, 130, start, false, upright).view!;
      stage.setView(dragged);
      expect(near().y).toBeLessThan(before);
      stage.setView(apply(start, { kind: 'turn', dx: 0, dy: -12 }, 'printed', upright));
      expect(near().y).toBeLessThan(before);
      stage.setView(turned(start, 0, 12, upright));
      expect(near().y).toBeGreaterThan(before);
    }
  });

  it('shows the whole model in the plastic chosen, its colour picture set aside, and the file’s own colour again without one', async () => {
    const root = boxModel(80, 120, 60);
    const material = (root.children[0] as Mesh).material as MeshStandardMaterial;
    const picture = new Texture();
    material.map = picture;
    const own = material.color.clone();
    const stage = new Stage3d(standIn(), async () => root);
    stage.resize(300, 300);
    await stage.setModel(shop({ colour: '#e0a030' }));
    expect(material.color.equals(new Color('#e0a030'))).toBe(true);
    expect(material.map).toBeNull();
    await stage.setModel(shop({ colour: '#2050c0' }));
    expect(material.color.equals(new Color('#2050c0'))).toBe(true);
    await stage.setModel(shop());
    expect(material.color.equals(own)).toBe(true);
    expect(material.map).toBe(picture);
  });
});
