// @vitest-environment jsdom
/**
 * THE 3D STAGE, HELD WITHOUT A GRAPHICS CARD.
 *
 * three.js builds geometry and scenes on its own; only drawing needs WebGL.
 * So the piece's solid is measured as built (its corners, its size, its
 * holes), the stage is run with a stand-in renderer (where a tap lands, what
 * it lets go of), and the view's rules are held on plain numbers.
 */
import { act, cleanup, render } from '@testing-library/react';
import { Box3, Mesh, Vector3, type BufferGeometry, type Material, type Texture } from 'three';
import { afterEach, describe, expect, it } from 'vitest';

import { readSvg } from '../draw/svgread.ts';
import { forgetWebGL, hasWebGL } from './load.ts';
import { ModelView } from './PieceView.tsx';
import { bodyGeometry, buildPiece, pieceSolids, shapesOf, topGeometry, type PieceModel } from './piece.ts';
import { inside, roundedRing, signedArea, solidsOf } from './rings.ts';
import { makeStage, Stage3d, type RendererLike } from './stage3d.ts';
import { apply, Gestures, keyCommand, startView, START, turned, wheelFactor, zoomed, zoomLabel, ZOOM_IN, ZOOM_OUT, type View } from './view.ts';

afterEach(cleanup);

const square = (x: number, y: number, size: number) => [
  { x, y },
  { x: x + size, y },
  { x: x + size, y: y + size },
  { x, y: y + size },
];

/** A 100 × 50 outline with a 10 mm square hole, a scored line and an engraved mark, drawn in its own units (twice the millimetres). */
const OUTLINE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
  <g id="CUT"><path d="M0 0H200V100H0Z"/><rect x="20" y="40" width="20" height="20"/></g>
  <g id="SCORE"><path d="M100 0V100"/></g>
  <g id="ENGRAVE"><rect x="150" y="40" width="20" height="20"/></g>
</svg>`;

const model = (over: Partial<PieceModel> = {}): PieceModel => ({ width: 100, height: 50, corner: 0, thickness: 6, outline: readSvg(OUTLINE), face: '#6b4428', edge: '#3b2413', top: null, ...over });

const sizeOf = (geometry: BufferGeometry): Vector3 => {
  geometry.computeBoundingBox();
  return geometry.boundingBox!.getSize(new Vector3());
};

describe('a flat piece, extruded from its outline', () => {
  it('reads the cut lines as the piece and its hole, in millimetres, and leaves the scored and engraved lines out', () => {
    const solids = pieceSolids(model());
    expect(solids).toHaveLength(1);
    expect(solids[0]!.holes).toHaveLength(1);
    const xs = solids[0]!.outer.map((one) => one.x);
    expect([Math.min(...xs), Math.max(...xs)]).toEqual([0, 100]);
    const hole = solids[0]!.holes[0]!;
    expect(Math.abs(signedArea(hole))).toBeCloseTo(100, 5);
    expect(inside({ x: 15, y: 25 }, hole)).toBe(true);
  });

  it('is as big as the piece and as thick as the material', () => {
    const body = bodyGeometry(shapesOf(pieceSolids(model()), 100, 50), 6);
    const size = sizeOf(body);
    expect([size.x, size.y, size.z].map((one) => Math.round(one * 1000) / 1000)).toEqual([100, 50, 6]);
    body.computeBoundingBox();
    expect(body.boundingBox!.min.z).toBeCloseTo(-3, 6);
    expect(body.boundingBox!.max.z).toBeCloseTo(3, 6);
  });

  it('keeps the hole: the caps are cut round it and its walls are built', () => {
    const body = bodyGeometry(shapesOf(pieceSolids(model()), 100, 50), 6);
    // Eight corners (four outside, four round the hole): each cap is 8 triangles, each of the 8 walls 2.
    expect(body.getAttribute('position').count).toBe(2 * 8 * 3 + 8 * 2 * 3);
    const plain = bodyGeometry(shapesOf(pieceSolids(model({ outline: null })), 100, 50), 6);
    expect(plain.getAttribute('position').count).toBe(2 * 2 * 3 + 4 * 2 * 3);
  });

  it('is its rounded rectangle where the shop has sent no outline', () => {
    const solids = pieceSolids(model({ outline: null, corner: 6 }));
    expect(solids).toEqual([{ outer: roundedRing(100, 50, 6), holes: [] }]);
    const size = sizeOf(bodyGeometry(shapesOf(solids, 100, 50), 4));
    expect([size.x, size.y, size.z].map((one) => Math.round(one * 1000) / 1000)).toEqual([100, 50, 4]);
  });

  it('lays the design on the top face, its picture corner to corner on the piece’s box', () => {
    const top = topGeometry(shapesOf(pieceSolids(model({ outline: null })), 100, 50), 100, 50, 6);
    const uv = top.getAttribute('uv');
    const position = top.getAttribute('position');
    for (let i = 0; i < position.count; i += 1) {
      expect(uv.getX(i)).toBeCloseTo((position.getX(i) + 50) / 100, 6);
      expect(uv.getY(i)).toBeCloseTo((position.getY(i) + 25) / 50, 6);
      expect(position.getZ(i)).toBeGreaterThan(3);
    }
  });

  it('sorts rings by where they lie: a hole in the piece, an island in the hole a piece of its own', () => {
    const solids = solidsOf([square(0, 0, 100), square(10, 10, 50), square(20, 20, 10), square(80, 80, 5)]);
    expect(solids.map((one) => [Math.abs(signedArea(one.outer)), one.holes.map((hole) => Math.abs(signedArea(hole)))])).toEqual([
      [10000, [2500, 25]],
      [100, []],
    ]);
  });
});

/** A renderer that draws nothing and counts what it is asked. */
function standIn(): RendererLike & { renders: number; disposed: boolean } {
  return {
    domElement: document.createElement('canvas'),
    renders: 0,
    disposed: false,
    setPixelRatio: () => {},
    setSize: () => {},
    render() {
      this.renders += 1;
    },
    dispose() {
      this.disposed = true;
    },
  };
}

/** Everything a stage's scene holds for the graphics card, each marked when it is let go of. */
function watchResources(stage: Stage3d): { all: number; gone: () => number } {
  const found = new Set<BufferGeometry | Material | Texture>();
  stage.scene.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    found.add(node.geometry as BufferGeometry);
    for (const material of [node.material].flat() as Material[]) {
      found.add(material);
      const map = (material as Material & { map?: Texture | null }).map;
      if (map) found.add(map);
    }
  });
  let gone = 0;
  for (const one of found) one.addEventListener('dispose', () => (gone += 1));
  return { all: found.size, gone: () => gone };
}

describe('the stage', () => {
  it('turns the piece as the comp turns it, and finds the spot of the design a tap lands on', () => {
    const renderer = standIn();
    const stage = new Stage3d(renderer);
    stage.resize(400, 400);
    stage.setModel(model({ outline: null }));
    stage.setView({ rx: 0, ry: 0, zoom: 1 });
    expect(stage.pick(0.5, 0.5)).toEqual({ x: expect.closeTo(50, 3), y: expect.closeTo(25, 3) });
    // Left of the middle and above it is the top-left of the design.
    const spot = stage.pick(0.3, 0.45)!;
    expect(spot.x).toBeLessThan(50);
    expect(spot.y).toBeLessThan(25);
    expect(stage.pick(0.02, 0.02)).toBeNull();
    stage.setView(startView('piece'));
    const piece = stage.scene.children.find((one) => one.type === 'Group')!;
    expect(piece.rotation.x).toBeCloseTo((-36 * Math.PI) / 180, 6);
    expect(piece.rotation.y).toBeCloseTo((-20 * Math.PI) / 180, 6);
    expect(renderer.renders).toBeGreaterThan(2);
  });

  it('gives up every buffer, material and picture when the piece changes and when it goes', () => {
    const renderer = standIn();
    const stage = new Stage3d(renderer);
    stage.resize(300, 300);
    stage.setModel(model({ top: document.createElement('canvas') }));
    const first = watchResources(stage);
    expect(first.all).toBe(6);
    stage.setModel(model({ thickness: 3, top: document.createElement('canvas') }));
    expect(first.gone()).toBe(first.all);
    const second = watchResources(stage);
    stage.dispose();
    expect(second.gone()).toBe(second.all);
    expect(renderer.disposed).toBe(true);
    expect(stage.scene.children.filter((one) => one.type === 'Group')).toEqual([]);
  });

  it('keeps the body when only the words change, and lets the old picture go', () => {
    const stage = new Stage3d(standIn());
    const first = model({ top: document.createElement('canvas') });
    stage.setModel(first);
    const body = (stage.scene.children.find((one) => one.type === 'Group')!.children[0] as Mesh).geometry;
    const before = watchResources(stage);
    stage.setModel({ ...first, top: document.createElement('canvas') });
    expect((stage.scene.children.find((one) => one.type === 'Group')!.children[0] as Mesh).geometry).toBe(body);
    expect(before.gone()).toBe(1);
  });

  it('lets everything go when its page closes', async () => {
    const renderer = standIn();
    let made: Stage3d | null = null;
    const load = async () => ({
      makeStage: (_make?: unknown, canvas?: HTMLCanvasElement) => {
        made = makeStage(() => ({ ...renderer, domElement: canvas ?? renderer.domElement }));
        return made;
      },
    });
    const shown = render(<ModelView model={model({ top: document.createElement('canvas') })} view={startView('piece')} load={load} />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(made).not.toBeNull();
    const watched = watchResources(made!);
    expect(watched.all).toBe(6);
    shown.unmount();
    expect(watched.gone()).toBe(watched.all);
  });

  it('says where it cannot be drawn', async () => {
    let failed = false;
    render(<ModelView model={model()} view={startView('piece')} load={() => Promise.reject(new Error('no file'))} onFail={() => (failed = true)} />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(failed).toBe(true);
  });
});

describe('a device without WebGL', () => {
  it('is told apart from one with it, and from a canvas that only paints in two dimensions', () => {
    const saved = HTMLCanvasElement.prototype.getContext;
    try {
      HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof saved;
      forgetWebGL();
      expect(hasWebGL()).toBe(false);
      HTMLCanvasElement.prototype.getContext = (() => ({ fillText: () => {} })) as unknown as typeof saved;
      forgetWebGL();
      expect(hasWebGL()).toBe(false);
      HTMLCanvasElement.prototype.getContext = ((kind: string) => (kind === 'webgl2' ? { getParameter: () => 0 } : null)) as unknown as typeof saved;
      forgetWebGL();
      expect(hasWebGL()).toBe(true);
    } finally {
      HTMLCanvasElement.prototype.getContext = saved;
      forgetWebGL();
    }
  });
});

describe('the view', () => {
  const at: View = { rx: 36, ry: -20, zoom: 1 };

  it('starts each kind of base at the comp’s angle, at 100 %', () => {
    expect(START).toEqual({ piece: { rx: 36, ry: -20 }, kit: { rx: 12, ry: -30 }, printed: { rx: 30, ry: -18 } });
    expect(startView('piece')).toEqual({ rx: 36, ry: -20, zoom: 1 });
    expect(zoomLabel(startView('kit'))).toBe('100%');
  });

  it('tilts no further than 80° either way, and turns as far as it likes', () => {
    expect(turned(at, 0, 100).rx).toBe(80);
    expect(turned(at, 0, -200).rx).toBe(-80);
    expect(turned(at, 720, 0).ry).toBe(700);
  });

  it('zooms between 60 % and 220 %, to two decimals', () => {
    expect(zoomed(at, ZOOM_IN).zoom).toBe(1.12);
    expect(zoomed(at, ZOOM_OUT).zoom).toBe(0.89);
    expect(zoomed({ ...at, zoom: 2.1 }, ZOOM_IN).zoom).toBe(2.2);
    expect(zoomed({ ...at, zoom: 0.62 }, ZOOM_OUT).zoom).toBe(0.6);
    expect(wheelFactor(-10)).toBe(1.08);
    expect(wheelFactor(10)).toBe(0.93);
  });

  it('maps the keys: arrows turn (only in 3D), plus and minus zoom, 0 resets', () => {
    expect(keyCommand('ArrowLeft', false)).toEqual({ kind: 'turn', dx: -15, dy: 0 });
    expect(keyCommand('ArrowRight', false)).toEqual({ kind: 'turn', dx: 15, dy: 0 });
    expect(keyCommand('ArrowUp', false)).toEqual({ kind: 'turn', dx: 0, dy: 12 });
    expect(keyCommand('ArrowDown', false)).toEqual({ kind: 'turn', dx: 0, dy: -12 });
    expect(keyCommand('ArrowLeft', true)).toBeNull();
    expect(keyCommand('+', true)).toEqual({ kind: 'zoom', factor: ZOOM_IN });
    expect(keyCommand('=', false)).toEqual({ kind: 'zoom', factor: ZOOM_IN });
    expect(keyCommand('-', false)).toEqual({ kind: 'zoom', factor: ZOOM_OUT });
    expect(keyCommand('0', true)).toEqual({ kind: 'reset' });
    expect(keyCommand('a', false)).toBeNull();
    expect(apply({ rx: 5, ry: 99, zoom: 2 }, { kind: 'reset' }, 'piece')).toEqual(startView('piece'));
  });

  it('turns a piece by a mouse drag only once it moves more than 4 px, and a press that does not is a tap', () => {
    const gestures = new Gestures();
    gestures.down(1, 100, 100, false, at);
    expect(gestures.move(1, 103, 102, at, false)).toEqual({});
    expect(gestures.up(1)).toEqual({ tap: true });
    gestures.down(1, 100, 100, false, at);
    expect(gestures.move(1, 120, 110, at, false)).toEqual({ view: { rx: 32, ry: -10, zoom: 1 }, capture: true });
    expect(gestures.move(1, 140, 100, at, false).capture).toBe(false);
    expect(gestures.up(1)).toEqual({ tap: false });
  });

  it('turns by a finger only side to side, so the page still scrolls under it', () => {
    const gestures = new Gestures();
    gestures.down(1, 100, 100, true, at);
    expect(gestures.move(1, 120, 160, at, false).view).toEqual({ rx: 36, ry: -10, zoom: 1 });
  });

  it('does not turn a flat piece, but pinches it', () => {
    const gestures = new Gestures();
    gestures.down(1, 100, 100, false, at);
    expect(gestures.move(1, 160, 100, at, true)).toEqual({});
    gestures.up(1);
    gestures.down(1, 100, 100, true, at);
    gestures.down(2, 200, 100, true, at);
    expect(gestures.move(2, 200, 100, at, true)).toEqual({});
    expect(gestures.move(2, 250, 100, at, true).view).toEqual({ rx: 36, ry: -20, zoom: 1.5 });
  });

  it('pinches to zoom and tilts with two fingers moving up together; lifting them is no tap', () => {
    const gestures = new Gestures();
    gestures.down(1, 100, 100, true, at);
    gestures.down(2, 200, 100, true, at);
    gestures.move(1, 100, 100, at, false);
    expect(gestures.move(1, 100, 80, at, false).view).toEqual({ rx: 36 + 4, ry: -20, zoom: expect.closeTo(Math.hypot(100, 20) / 100, 6) });
    expect(gestures.move(2, 500, 80, at, false).view!.zoom).toBe(2.2);
    expect(gestures.up(1)).toEqual({ tap: false });
    expect(gestures.up(2)).toEqual({ tap: false });
  });
});

describe('the built piece', () => {
  it('is one body (caps in the material’s face colour, walls in its edge colour) and a top carrying the design', () => {
    const built = buildPiece(model({ top: document.createElement('canvas') }));
    expect(built.group.children).toHaveLength(2);
    const [body, top] = built.group.children as [Mesh, Mesh];
    expect((body.material as Material[]).map((one) => `#${(one as Material & { color: { getHexString(): string } }).color.getHexString()}`)).toEqual(['#6b4428', '#3b2413']);
    expect(top.name).toBe('top');
    expect(new Box3().setFromObject(built.group).getSize(new Vector3()).z).toBeCloseTo(6.02, 2);
  });
});
