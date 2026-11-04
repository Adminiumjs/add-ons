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
import { DirectionalLight, HemisphereLight, MathUtils, PerspectiveCamera, Raycaster, Scene, Vector2, WebGLRenderer } from 'three';

import { buildPiece, disposeBuilt, pointOfUv, retexture, sameBody, type Built, type PieceModel } from './piece.ts';
import type { Point } from './rings.ts';
import type { View } from './view.ts';

export type { PieceModel } from './piece.ts';
export { readSvg } from '../draw/svgread.ts';

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
  private view: View = { rx: 0, ry: 0, zoom: 1 };
  private readonly raycaster = new Raycaster();
  private readonly lights = [new HemisphereLight(0xffffff, 0x5a4a3a, 2.2), new DirectionalLight(0xffffff, 2.4)];
  private gone = false;

  readonly renderer: RendererLike;

  constructor(renderer: RendererLike) {
    this.renderer = renderer;
    this.lights[1]!.position.set(30, 60, 80);
    this.scene.add(...this.lights);
    renderer.setPixelRatio(Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1));
  }

  /** A new piece (or the same piece with a new design on it): the old one is let go of first. */
  setModel(model: PieceModel): void {
    if (this.gone) return;
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
    this.renderer.setSize(width, height, false);
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

  /** Let go of the piece, the lights and the renderer. */
  dispose(): void {
    if (this.gone) return;
    this.gone = true;
    if (this.built !== null) disposeBuilt(this.built);
    this.built = null;
    for (const light of this.lights) light.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
  }

  /** The camera far enough back that the piece's longer side takes its share of the stage's shorter side. */
  private frame(): void {
    const model = this.model;
    if (model === null) return;
    const longest = Math.max(model.width, model.height, 1);
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
    if (this.built === null) return;
    this.built.group.rotation.set(MathUtils.degToRad(-this.view.rx), MathUtils.degToRad(this.view.ry), 0, 'XYZ');
    this.built.group.scale.setScalar(this.view.zoom);
  }
}

/** A stage drawing into its own canvas. */
export function makeStage(make: MakeRenderer = webglRenderer, canvas?: HTMLCanvasElement): Stage3d {
  return new Stage3d(make(canvas));
}

let stillStage: Stage3d | null = null;

/**
 * A still of a piece as a picture (a `blob:` address this page holds), drawn
 * by one stage kept for every still so a gallery of cards uses one graphics
 * context; none where it cannot be drawn.
 */
export async function still(model: PieceModel, view: View, width: number, height: number, make: MakeRenderer = stillRenderer): Promise<string | null> {
  try {
    stillStage ??= new Stage3d(make());
    stillStage.resize(width, height);
    stillStage.setModel(model);
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
