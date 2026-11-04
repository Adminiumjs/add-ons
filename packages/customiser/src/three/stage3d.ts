/**
 * THE 3D STAGE: a piece drawn with three.js, turned and zoomed as the view says.
 *
 * This is the one file that brings three.js, and nothing imports it but by
 * `import()` (`load.ts`), so a shop whose bases are pages (a print shop)
 * never downloads it, and a maker's shop only when a piece is shown in 3D.
 *
 * Drawn only when something changes (a new view, a new design, a new size),
 * never in a loop. Every buffer and picture it hands the graphics card is let
 * go of when the piece changes and when the stage goes (`dispose`).
 */
import { DirectionalLight, HemisphereLight, MathUtils, PerspectiveCamera, Raycaster, Scene, Vector2, WebGLRenderer, type Intersection, type Mesh, type Object3D } from 'three';

import { faceAt, flatFacesOf, sizeOfModel, type FacePlane, type Picked, type Triangles } from './faces.ts';
import { buildModel, disposeModel, dress, meshesOf, readModel, trianglesOf, type BuiltModel, type ReadModel, type ShopModel } from './model.ts';
import { buildPiece, disposeBuilt, pointOfUv, retexture, sameBody, type Built, type PieceModel } from './piece.ts';
import type { Point } from './rings.ts';
import type { View } from './view.ts';

export type { PieceModel } from './piece.ts';
export type { Decal, Marks, ShopModel } from './model.ts';
export { readSvg } from '../draw/svgread.ts';

/** What a stage draws: a flat piece made from its outline, or a shop's own model. */
export type StageModel = PieceModel | ShopModel;
const isShop = (model: StageModel): model is ShopModel => (model as ShopModel).kind === 'model';

/** Where a tap landed on a design laid on a marked face: the face, and the point of its design in millimetres. */
export interface DecalSpot {
  code: string;
  point: Point;
}

/** The part of a renderer the stage uses: a real WebGL one, or a test's stand-in. */
export interface RendererLike {
  domElement: HTMLCanvasElement;
  setPixelRatio(ratio: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
  render(scene: Scene, camera: PerspectiveCamera): void;
  dispose(): void;
  forceContextLoss?(): void;
}

export type MakeRenderer = (canvas?: HTMLCanvasElement) => RendererLike;

/** A WebGL renderer with a see-through background, so the stage's own backdrop shows. */
export const webglRenderer: MakeRenderer = (canvas) => new WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: false });
/** The stills' renderer keeps what it drew, so it can be read back as a picture. */
const stillRenderer: MakeRenderer = (canvas) => new WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });

const FOV = 30;
/** How much of the stage's shorter side the piece's longer side takes at 100 %. */
const FILL = 0.66;

export class Stage3d {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(FOV, 1, 1, 10_000);
  private built: Built | null = null;
  private model: PieceModel | null = null;
  /** A shop's model: the one drawn, and the one whose file is being read. */
  private shop: BuiltModel | null = null;
  private shopModel: ShopModel | null = null;
  private reading: { key: string; done: Promise<void> } | null = null;
  /** Each mesh's triangles in the model's units, read once a model. */
  private triangles = new Map<Object3D, Triangles>();
  private modelSize = 0;
  private view: View = { rx: 0, ry: 0, zoom: 1 };
  private readonly raycaster = new Raycaster();
  private readonly lights = [new HemisphereLight(0xffffff, 0x5a4a3a, 2.6), new DirectionalLight(0xffffff, 1.9)];
  private gone = false;

  readonly renderer: RendererLike;

  private readonly read: ReadModel;

  constructor(renderer: RendererLike, read: ReadModel = readModel) {
    this.renderer = renderer;
    this.read = read;
    this.lights[1]!.position.set(20, 50, 100);
    this.scene.add(...this.lights);
    renderer.setPixelRatio(Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1));
  }

  /**
   * A new piece or model (or the same one with a new design on it): the old
   * one is let go of first. A shop's model is read from its file first: the
   * answer says when it is drawn, and fails where the file cannot be read.
   */
  setModel(model: StageModel): Promise<void> {
    if (this.gone) return Promise.resolve();
    if (isShop(model)) return this.setShop(model);
    this.dropShop();
    this.setPiece(model);
    return Promise.resolve();
  }

  private setPiece(model: PieceModel): void {
    if (this.built !== null && this.model !== null && sameBody(this.model, model)) {
      // The same piece with new words on it: only its top's picture is new.
      retexture(this.built, model);
      this.model = model;
      this.render();
      return;
    }
    if (this.built !== null) disposeBuilt(this.built);
    this.model = model;
    this.built = buildPiece(model);
    this.scene.add(this.built.group);
    this.frame();
    this.place();
    this.render();
  }

  setView(view: View): void {
    this.view = view;
    this.place();
    this.render();
  }

  resize(width: number, height: number): void {
    if (this.gone || width <= 0 || height <= 0) return;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.frame();
    this.render();
  }

  render(): void {
    if (!this.gone) this.renderer.render(this.scene, this.camera);
  }

  /**
   * The point of the design a spot on the stage shows, in millimetres from the
   * piece's top-left; none where the spot misses the top face. `x` and `y` are
   * the spot's place in the stage, 0 to 1 from the top-left.
   */
  pick(x: number, y: number): Point | null {
    if (this.built === null || this.model === null) return null;
    this.raycaster.setFromCamera(new Vector2(x * 2 - 1, 1 - y * 2), this.camera);
    const hit = this.raycaster.intersectObject(this.built.top, false)[0];
    if (hit?.uv === undefined) return null;
    return pointOfUv(hit.uv.x, hit.uv.y, Math.max(this.model.width, 1), Math.max(this.model.height, 1));
  }

  /** A shop's model: read once its file (the same key is not read again), then dressed with its decals and outlines. */
  private setShop(model: ShopModel): Promise<void> {
    this.dropPiece();
    this.shopModel = model;
    if (this.shop !== null && this.shop.key === model.key) {
      dress(this.shop, model);
      this.render();
      return Promise.resolve();
    }
    if (this.reading !== null && this.reading.key === model.key) return this.reading.done;
    const done = this.read(model.bytes, model.file).then((root) => {
      // Gone, or another model asked for since: what was read is let go of.
      const wanted = this.shopModel;
      const built = buildModel(model.key, root);
      if (this.gone || wanted === null || wanted.key !== model.key) {
        disposeModel(built);
        return;
      }
      this.dropShop();
      this.shop = built;
      this.shopModel = wanted;
      this.scene.add(built.group);
      built.root.updateMatrixWorld(true);
      this.modelSize = Math.hypot(...built.size);
      dress(built, wanted);
      this.frame();
      this.place();
      this.render();
    });
    const reading = { key: model.key, done };
    this.reading = reading;
    const clear = (): void => {
      if (this.reading === reading) this.reading = null;
    };
    done.then(clear, clear);
    return done;
  }

  private dropPiece(): void {
    if (this.built !== null) disposeBuilt(this.built);
    this.built = null;
    this.model = null;
  }

  private dropShop(): void {
    if (this.shop !== null) disposeModel(this.shop);
    this.shop = null;
    this.triangles.clear();
    this.modelSize = 0;
  }

  /** The shop's model's size along each axis, in its own units; none before it is read. */
  modelBox(): readonly [number, number, number] | null {
    return this.shop === null ? null : this.shop.size;
  }

  private trianglesFor(mesh: Mesh): Triangles {
    let found = this.triangles.get(mesh);
    if (found === undefined) {
      found = trianglesOf(this.shop!.root, mesh);
      this.triangles.set(mesh, found);
    }
    return found;
  }

  private cast(x: number, y: number, targets: Object3D): Intersection | null {
    this.scene.updateMatrixWorld(true);
    this.raycaster.setFromCamera(new Vector2(x * 2 - 1, 1 - y * 2), this.camera);
    return this.raycaster.intersectObject(targets, true)[0] ?? null;
  }

  /**
   * The face of the shop's model a spot on the stage shows (0 to 1 from the
   * top-left): flat, with its plane in the model's units, or not flat; none
   * where the spot misses the model.
   */
  pickFace(x: number, y: number): Picked | null {
    if (this.shop === null) return null;
    const hit = this.cast(x, y, this.shop.root);
    const mesh = hit?.object as Mesh | undefined;
    if (hit === null || mesh === undefined || (mesh as Mesh).isMesh !== true || hit.faceIndex === undefined || hit.faceIndex === null) return null;
    const path = meshesOf(this.shop.root).find((one) => one.mesh === mesh)?.path ?? '';
    return faceAt(this.trianglesFor(mesh), hit.faceIndex, path, this.modelSize || sizeOfModel(this.trianglesFor(mesh)), mesh.name);
  }

  /** The flat faces of the shop's model, largest first: the list the keyboard picks from. */
  flatFaces(limit = 12): FacePlane[] {
    if (this.shop === null) return [];
    const size = this.modelSize;
    return meshesOf(this.shop.root)
      .flatMap((one) => flatFacesOf(this.trianglesFor(one.mesh), one.path, size, limit, 200_000, one.mesh.name))
      .sort((a, b) => b.area - a.area)
      .slice(0, limit)
      .map((one) => one.plane);
  }

  /** The design under a spot on the stage: the marked face's decal it lands on, and where on its design. */
  pickDecal(x: number, y: number): DecalSpot | null {
    if (this.shop === null) return null;
    const hit = this.cast(x, y, this.shop.decals);
    const data = hit?.object.userData as { code?: string; width?: number; height?: number } | undefined;
    if (hit === null || hit.uv === undefined || data?.code === undefined) return null;
    return { code: data.code, point: pointOfUv(hit.uv.x, hit.uv.y, data.width ?? 1, data.height ?? 1) };
  }

  /** Let go of the piece, the lights and the renderer. */
  dispose(): void {
    if (this.gone) return;
    this.gone = true;
    this.dropPiece();
    this.dropShop();
    this.shopModel = null;
    for (const light of this.lights) light.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
  }

  /** The camera far enough back that the piece's longer side takes its share of the stage's shorter side. */
  private frame(): void {
    const model = this.model;
    const shop = this.shop;
    if (model === null && shop === null) return;
    const longest = model !== null ? Math.max(model.width, model.height, 1) : Math.max(...shop!.size) || 1;
    const half = Math.tan(MathUtils.degToRad(FOV / 2));
    const narrow = Math.min(1, this.camera.aspect);
    const distance = longest / FILL / 2 / half / narrow;
    this.camera.position.set(0, 0, distance);
    this.camera.near = distance / 20;
    this.camera.far = distance * 20;
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }

  /**
   * The piece turned as the comp's stage turns it: tilt (`rotateX`) after
   * turn (`rotateY`), the top leaning away as the tilt grows. A screen's y
   * runs down and three.js's up, so the tilt's sign flips.
   */
  private place(): void {
    const group = this.built?.group ?? this.shop?.group;
    if (group === undefined) return;
    group.rotation.set(MathUtils.degToRad(-this.view.rx), MathUtils.degToRad(this.view.ry), 0, 'XYZ');
    group.scale.setScalar(this.view.zoom);
  }
}

/** A stage drawing into its own canvas. */
export function makeStage(make: MakeRenderer = webglRenderer, canvas?: HTMLCanvasElement, read?: ReadModel): Stage3d {
  return new Stage3d(make(canvas), read);
}

let stillStage: Stage3d | null = null;

/**
 * A still of a piece as a picture (a `blob:` address this page holds), drawn
 * by one stage kept for every still so a gallery of cards uses one graphics
 * context; none where it cannot be drawn.
 */
export async function still(model: StageModel, view: View, width: number, height: number, make: MakeRenderer = stillRenderer): Promise<string | null> {
  try {
    stillStage ??= new Stage3d(make());
    stillStage.resize(width, height);
    await stillStage.setModel(model);
    stillStage.setView(view);
    const canvas = stillStage.renderer.domElement;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    return blob === null ? null : URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

/** Let go of the stage the stills are drawn with (the last screen that showed one is gone). */
export function releaseStills(): void {
  stillStage?.dispose();
  stillStage = null;
}
