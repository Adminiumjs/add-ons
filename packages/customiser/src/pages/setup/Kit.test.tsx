// @vitest-environment jsdom
/**
 * A KIT'S SET-UP (BC-D2.kit, BC-D2.markfaces, BC-D10, BC-F8, BC-F9).
 *
 * The pieces are uploaded several at once and each is read by its bytes and
 * measured; the model is a GLB read by its bytes; the thickness is the
 * comp's chips. The model is drawn with three.js (its file read by the real
 * reader, the stage drawing into a stand-in): a click on a flat face opens
 * the form, a click on a curve says it is not flat, and a marked face comes
 * back the same plane once the page is opened again.
 */
import axe from 'axe-core';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Group, Mesh, MeshStandardMaterial, SphereGeometry, type Object3D } from 'three';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { glbOf, SIGN, WALL } from '../../testing/glb.ts';
import { facesOf } from '../../three/faceStore.ts';
import { Stage3d, type RendererLike } from '../../three/stage3d.ts';
import { resetWorld, seed, world, type Call } from '../testing/host.tsx';
import { IDS, seedShop } from '../testing/rows.ts';
import { faceCode, layersIn, megabytes, nextPieceCode, readSurface, surfaceColumns, surfaceOfArea, surfaceSize, surfacesOf, surfaceValue } from './kit.ts';

const device = vi.hoisted(() => ({ webgl: true, read: null as null | (() => Promise<Object3D>) }));

vi.mock('../../three/load.ts', async (original) => {
  const real = await original<typeof import('../../three/load.ts')>();
  return {
    ...real,
    hasWebGL: () => device.webgl,
    loadThree: async () => ({
      ...(await import('../../three/stage3d.ts')),
      makeStage: () => {
        const renderer: RendererLike = { domElement: document.createElement('canvas'), setPixelRatio: () => {}, setSize: () => {}, render: () => {}, dispose: () => {} };
        return new Stage3d(renderer, device.read ?? undefined);
      },
    }),
  };
});

const { default: Customiser } = await import('../customiser/index.tsx');

const MODEL = 'file_01JD00000000000000000000MD';
const GLB = glbOf([SIGN, WALL]);

const settle = async (rounds = 4): Promise<void> => {
  for (let i = 0; i < rounds; i += 1)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
};
const page = (step?: string): ReactNode => {
  world.splat = `customiser/${String(IDS.nook)}`;
  world.search = step === undefined ? {} : { step };
  return <Customiser />;
};
const writes = (kind: Call['kind'], table: string): Call[] => world.calls.filter((call) => call.kind === kind && call.table === table);
const nook = (): Record<string, unknown> => world.tables['bases']!.find((one) => one['id'] === IDS.nook)!;
const svg = (name: string, body: string): File => new File([body], name, { type: 'image/svg+xml' });

/** The dashboard's files route, answering the model's bytes and a name. */
function serveFiles(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (address: string, init?: RequestInit) => {
      if (!String(address).includes(MODEL)) return new Response(null, { status: 404 });
      const headers = { 'content-length': String(GLB.byteLength), 'content-disposition': 'inline; filename="little-bookshop.glb"' };
      return new Response(init?.method === 'HEAD' ? null : GLB, { status: 200, headers });
    }),
  );
}

beforeEach(() => {
  resetWorld();
  seedShop();
  seed('base_pieces', [
    { id: 201, app: 'maker', base_id: IDS.nook, code: '01', name: 'Base', width_mm: 110, height_mm: 150, layers: '["CUT"]', file: null, position: 1 },
    { id: 209, app: 'maker', base_id: IDS.nook, code: '09', name: 'Shop sign', width_mm: 92, height_mm: 22, layers: '["CUT","ENGRAVE"]', file: null, position: 9 },
  ]);
  seed('base_areas', [...world.tables['base_areas']!, { id: 23, app: 'maker', base_id: IDS.nook, code: 'sign', name: 'The shop sign', piece_id: 209, face: null, shape: 'rect', x_mm: 2, y_mm: 2, w_mm: 88, h_mm: 18, takes: 'words', required: true, rules: JSON.stringify({ chars: 14, grows: true, unit: 'mm', size: 9, min: 6, max: 11, fonts: ['Manrope'], font: 'Manrope' }), position: 1 }]);
  device.webgl = true;
  device.read = null;
  serveFiles();
  // A stage's box on the page: what a click is measured against.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 400, width: 400, height: 400, toJSON: () => ({}) } as DOMRect);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('a kit’s facts', () => {
  it('numbers the next pieces after the highest, names them after their files, reads their layers', () => {
    expect(nextPieceCode([{ code: '01' }, { code: '09' }])).toBe('10');
    expect(nextPieceCode([], 2)).toBe('03');
    expect(layersIn('<svg><g id="CUT"/><g inkscape:label="ENGRAVE"/></svg>')).toEqual(['CUT', 'ENGRAVE']);
    expect(layersIn('<svg><path/></svg>')).toEqual(['CUT']);
    expect(megabytes(8.4 * 1048576)).toBe('8.4 MB');
    expect(megabytes(640 * 1024)).toBe('640 KB');
    expect(faceCode('Sign board', [])).toBe('sign-board');
    expect(faceCode('Sign board', ['sign-board'])).toBe('sign-board-2');
  });

  it('puts an area on a marked face or a piece, sized as that surface', () => {
    const faces = [{ code: 'sign', name: 'Sign board', piece: '209', mesh: '0', normal: [0, 0, 1], point: [0, 0, 0], u: [1, 0, 0], v: [0, -1, 0], bounds: { u0: 0, u1: 1, v0: 0, v1: 1 }, size: { w: 90, h: 20 } } as const];
    const pieces = [
      { id: 209, code: '09', name: 'Shop sign', width_mm: 92, height_mm: 22 },
      { id: 201, code: '01', name: 'Base', width_mm: 110, height_mm: 150 },
    ];
    expect(surfacesOf(faces, pieces).map(surfaceValue)).toEqual(['face:sign', 'piece:201', 'piece:209']);
    expect(readSurface('face:sign')).toEqual({ kind: 'face', code: 'sign' });
    expect(readSurface('piece:')).toBeNull();
    // A face that is a piece is that piece's size; the area keeps the piece too.
    expect(surfaceSize({ kind: 'face', code: 'sign' }, faces, pieces)).toEqual({ width: 92, height: 22 });
    expect(surfaceColumns({ kind: 'face', code: 'sign' }, faces)).toEqual({ face: 'sign', piece_id: 209 });
    expect(surfaceColumns({ kind: 'piece', id: '201' }, faces)).toEqual({ face: null, piece_id: 201 });
    expect(surfaceOfArea({ face: 'sign', piece_id: 209 }, faces)).toEqual({ kind: 'face', code: 'sign' });
    // A face no longer marked: the area is on its piece.
    expect(surfaceOfArea({ face: 'gone', piece_id: 209 }, faces)).toEqual({ kind: 'piece', id: '209' });
  });
});

describe('step 1 for a kit (BC-D2.kit)', () => {
  it('lists the pieces with their sizes, and uploads several SVGs at once, each measured and numbered', async () => {
    render(page());
    await settle();
    const card = screen.getByText('The pieces').closest('section, div')!.parentElement!;
    expect(screen.getByText('SVG · several at once · 2 MB each')).toBeTruthy();
    expect(screen.getByText('92 × 22 mm')).toBeTruthy();
    expect(within(card).getByText('Shop sign')).toBeTruthy();
    const input = screen.getByLabelText('Add pieces') as HTMLInputElement;
    expect(input.multiple).toBe(true);
    await act(async () => {
      fireEvent.change(input, { target: { files: [svg('Door.svg', '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="36mm" height="68mm"><g id="CUT"/><g id="SCORE"/></svg>'), svg('Counter.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 24"/>')] } });
    });
    await settle();
    const made = writes('create', 'base_pieces').map((call) => call.values);
    expect(made).toMatchObject([
      { code: '10', name: 'Door', width_mm: 36, height_mm: 68, layers: '["CUT","SCORE"]', position: 3 },
      { code: '11', name: 'Counter', width_mm: 60, height_mm: 24, layers: '["CUT"]', position: 4 },
    ]);
    expect(writes('upload', 'base_pieces').map((call) => (call.values as { name: string }).name)).toEqual(['Door.svg', 'Counter.svg']);
    expect(world.toasts.at(-1)?.title).toBe('2 files added.');
  });

  it('refuses a file that is not an SVG by its bytes, whatever its name, in BC-F9’s words, and keeps none of the batch', async () => {
    render(page());
    await settle();
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Add pieces'), { target: { files: [svg('Door.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>'), new File([GLB], 'roof.svg')] } });
    });
    await settle();
    expect(screen.getByText('roof.svg: That isn’t an SVG.')).toBeTruthy();
    expect(writes('create', 'base_pieces')).toEqual([]);
  });

  it('takes the assembled model only as a GLB by its bytes, at most 30 MB, and names it with its size', async () => {
    render(page());
    await settle();
    expect(screen.getByText('GLB · up to 30 MB')).toBeTruthy();
    expect(screen.getByText('A GLB of the kit put together.')).toBeTruthy();
    const input = screen.getByLabelText('Upload the model');
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File(['solid not a glb'], 'shop.glb')] } });
    });
    await settle();
    expect(screen.getByText('shop.glb: That isn’t a GLB model.')).toBeTruthy();
    const big = new File([GLB], 'big.glb');
    Object.defineProperty(big, 'size', { value: 31 * 1024 * 1024 });
    await act(async () => {
      fireEvent.change(input, { target: { files: [big] } });
    });
    await settle();
    expect(screen.getByText('big.glb: That file is over 30 MB.')).toBeTruthy();
    world.upload = () => ({ id: MODEL });
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File([GLB], 'little-bookshop.glb')] } });
    });
    await settle();
    expect(writes('upload', 'bases')).toMatchObject([{ key: String(IDS.nook), values: { column: 'model_file', name: 'little-bookshop.glb' } }]);
    expect(nook()['model_file']).toBe(MODEL);
    expect(screen.getAllByText('little-bookshop.glb').length).toBeGreaterThan(0);
    expect(screen.getByText('Assembled', { selector: 'span' })).toBeTruthy();
  });

  it('offers the comp’s three thicknesses of the kit’s material', async () => {
    render(page());
    await settle();
    const group = screen.getByRole('group', { name: 'Thickness' });
    expect(within(group).getAllByRole('button').map((one) => one.textContent)).toEqual(['Birch ply · 3 mm', 'Birch ply · 4 mm', 'Birch ply · 6 mm']);
    fireEvent.click(within(group).getByRole('button', { name: 'Birch ply · 6 mm' }));
    expect(writes('update', 'bases').at(-1)).toMatchObject({ values: { thickness_mm: 6 } });
  });

  it('draws the uploaded model with three.js, and says so where the device cannot', async () => {
    nook()['model_file'] = MODEL;
    render(page());
    await settle(6);
    const preview = screen.getByRole('img', { name: 'The Little Bookshop preview' });
    expect(preview.querySelector('canvas')).not.toBeNull();
    expect(screen.getByText('Your uploaded model · drag to turn')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Turn left' })).toBeTruthy();
    cleanup();
    device.read = () => Promise.reject(new Error('packed with Draco'));
    render(page());
    await settle(6);
    expect(screen.getByText('This device couldn’t draw little-bookshop.glb — showing the built-in preview.')).toBeTruthy();
  });

  it('shows the built-in preview and “no model yet” before the model is in', async () => {
    render(page());
    await settle();
    expect(screen.getByText('no model yet')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'The Little Bookshop, drawn flat' })).toBeTruthy();
    expect(screen.getAllByText('Upload the assembled model to mark its faces.').length).toBeGreaterThan(0);
  });
});

describe('Mark faces (BC-D2.markfaces, BC-F8)', () => {
  const stageOf = (): HTMLElement => screen.getByRole('img', { name: 'The Little Bookshop, with its marked faces' });
  // The sign stands in front of the wall: seen from 8° above (the comp's marking angle) it shows a little below the middle.
  const click = async (x = 200, y = 218): Promise<void> => {
    const stage = stageOf();
    await act(async () => {
      fireEvent.pointerDown(stage, { pointerId: 1, clientX: x, clientY: y, pointerType: 'mouse' });
      fireEvent.pointerUp(stage, { pointerId: 1, clientX: x, clientY: y, pointerType: 'mouse' });
    });
    await settle();
  };

  it('marks a flat face clicked on the model: named, on its piece, carrying a new area, and back as the same plane', async () => {
    nook()['model_file'] = MODEL;
    render(page());
    await settle(6);
    expect(screen.getByText('Click a flat face, then say which piece and area it carries.')).toBeTruthy();
    expect(screen.getByText('0 marked')).toBeTruthy();
    // The keyboard's list: the model's flat faces, largest first.
    expect(screen.getAllByRole('button', { name: /Flat face/ }).map((one) => one.textContent)).toEqual(['Flat face 1flat · 110 × 180 mmNot marked', 'Flat face 2flat · 92 × 22 mmNot marked']);
    await click();
    const name = screen.getByLabelText('Name it');
    expect(document.activeElement).toBe(name);
    // The piece whose size is nearest the face's is offered first.
    expect((screen.getByLabelText('The piece it’s on') as HTMLSelectElement).value).toBe('209');
    expect((screen.getByLabelText('The area it carries') as HTMLSelectElement).value).toBe('new');
    fireEvent.click(screen.getByRole('button', { name: 'Mark this face' }));
    await settle();
    expect(screen.getByText('Give the face a name the shopper will understand, like “Shop sign”.')).toBeTruthy();
    fireEvent.change(name, { target: { value: 'Sign board' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mark this face' }));
    await settle();
    const stored = facesOf(nook()['faces']);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ code: 'sign-board', name: 'Sign board', piece: '209', mesh: '0', meshName: 'Sign', normal: [0, 0, 1], size: { w: 92, h: 22 } });
    expect(stored[0]!.bounds.u1 - stored[0]!.bounds.u0).toBeCloseTo(0.092, 6);
    expect(writes('create', 'base_areas').at(-1)?.values).toMatchObject({ base_id: IDS.nook, name: 'Sign board', face: 'sign-board', piece_id: 209, shape: 'rect', takes: 'words' });
    expect(world.toasts.at(-1)?.title).toBe('“Sign board” marked.');

    // Opened again: the marked face is listed by its name, and a click on it opens it to change.
    cleanup();
    render(page());
    await settle(6);
    expect(screen.getByText('1 marked')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Sign boardflat · 92 × 22 mmMarked · Sign board/ })).toBeTruthy();
    await click();
    expect((screen.getByLabelText('Name it') as HTMLInputElement).value).toBe('Sign board');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await settle();
    // Saved again, it is the same plane: nothing about it moved.
    expect(facesOf(nook()['faces'])).toEqual(stored);
  });

  it('picks a face from the list by keyboard, and unmarks it, its area staying on its piece', async () => {
    nook()['model_file'] = MODEL;
    render(page());
    await settle(6);
    const row = screen.getAllByRole('button', { name: /Flat face 2/ })[0]!;
    row.focus();
    fireEvent.click(row);
    await settle();
    expect(row.getAttribute('aria-pressed')).toBe('true');
    fireEvent.change(screen.getByLabelText('Name it'), { target: { value: 'Sign board' } });
    fireEvent.change(screen.getByLabelText('The area it carries'), { target: { value: '23' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mark this face' }));
    await settle();
    expect(writes('update', 'base_areas').at(-1)).toMatchObject({ key: '23', values: { face: 'sign-board', piece_id: 209 } });
    fireEvent.click(screen.getByRole('button', { name: 'Unmark it' }));
    await settle();
    expect(facesOf(nook()['faces'])).toEqual([]);
    expect(writes('update', 'base_areas').at(-1)).toMatchObject({ key: '23', values: { face: null } });
    expect(world.tables['base_areas']!.find((one) => one['id'] === 23)!['piece_id']).toBe(209);
    expect(world.toasts.at(-1)?.title).toBe('Face unmarked.');
  });

  it('says a face that is not flat cannot carry words', async () => {
    nook()['model_file'] = MODEL;
    device.read = async () => {
      const group = new Group();
      group.add(new Mesh(new SphereGeometry(0.08, 48, 24), new MeshStandardMaterial()));
      return group;
    };
    render(page());
    await settle(6);
    await click();
    expect(screen.getByRole('alert').textContent).toBe('This face isn’t flat, so it can’t carry words or a logo. Pick a flat face.');
    expect(screen.queryByLabelText('Name it')).toBeNull();
  });
});

const SIGN_FACE = { code: 'sign-board', name: 'Sign board', piece: '209', mesh: '0', meshName: 'Sign', normal: [0, 0, 1], point: [-0.046, -0.011, 0.075], u: [1, 0, 0], v: [0, -1, 0], bounds: { u0: 0, u1: 0.092, v0: -0.022, v1: 0 }, size: { w: 92, h: 22 } };

describe('areas on a kit: “On:” a piece or a marked face (BC-D3, BC-F8)', () => {
  const canvas = (): SVGSVGElement => screen.getByRole('application', { name: 'The piece, with its areas' }) as unknown as SVGSVGElement;
  /** The size the canvas draws, without the margin round it. */
  const drawnSize = (): number[] => {
    const [x, y, w, h] = canvas().getAttribute('viewBox')!.split(' ').map(Number) as [number, number, number, number];
    return [Math.round((w + 2 * x) * 10) / 10, Math.round((h + 2 * y) * 10) / 10];
  };

  it('lists the marked faces and the pieces, starts on the first area’s piece, and draws only the areas on it, at its size', async () => {
    nook()['faces'] = JSON.stringify([SIGN_FACE]);
    render(page('areas'));
    await settle();
    const on = screen.getByLabelText('On') as HTMLSelectElement;
    expect([...on.options].map((one) => one.textContent)).toEqual(['Sign board · marked face', '01 · Base', '09 · Shop sign']);
    expect(on.value).toBe('piece:209');
    expect(drawnSize()).toEqual([92, 22]);
    expect(within(canvas() as unknown as HTMLElement).getByRole('button', { name: 'Select The shop sign' })).toBeTruthy();
    fireEvent.change(on, { target: { value: 'piece:201' } });
    await settle();
    expect(drawnSize()).toEqual([110, 150]);
    expect(within(canvas() as unknown as HTMLElement).queryByRole('button', { name: 'Select The shop sign' })).toBeNull();
    // The list still holds every area, each saying what it sits on.
    expect(screen.getByRole('button', { name: /The shop sign.*09 · Shop sign/ })).toBeTruthy();
  });

  it('draws a new area on the marked face picked, kept on the face and its piece, sized for it', async () => {
    nook()['faces'] = JSON.stringify([SIGN_FACE]);
    render(page('areas'));
    await settle();
    fireEvent.change(screen.getByLabelText('On'), { target: { value: 'face:sign-board' } });
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Draw a rectangle' }));
    fireEvent.keyDown(canvas(), { key: 'Enter' });
    await settle();
    expect(writes('create', 'base_areas').at(-1)?.values).toMatchObject({ base_id: IDS.nook, face: 'sign-board', piece_id: 209, x_mm: 23, y_mm: 8.5, w_mm: 46, h_mm: 4 });
  });
});

describe('the kit’s set-up under axe', () => {
  it('has no violations: before the model, with it, marking a face, and the areas on a face; English and Arabic, light and dark', async () => {
    let swept = 0;
    for (const locale of ['en-US', 'ar-EG'] as const)
      for (const theme of ['light', 'dark'] as const) {
        const look = (): void => {
          world.locale = locale;
          document.documentElement.lang = locale;
          document.documentElement.dir = locale === 'ar-EG' ? 'rtl' : 'ltr';
          document.documentElement.setAttribute('data-theme', theme);
        };
        const sweep = async (label: string): Promise<void> => {
          const found = await axe.run(document.body, { rules: { region: { enabled: false }, 'color-contrast': { enabled: false } } });
          expect(found.passes.length, `${locale} · ${theme} · ${label}: axe examined nothing`).toBeGreaterThan(0);
          expect(found.violations.map((one) => `${locale} · ${theme} · ${label}: ${one.id}`)).toEqual([]);
          swept += 1;
        };
        resetWorld();
        seedShop();
        seed('base_pieces', [
          { id: 201, app: 'maker', base_id: IDS.nook, code: '01', name: 'Base', width_mm: 110, height_mm: 150, layers: '["CUT"]', file: null, position: 1 },
          { id: 209, app: 'maker', base_id: IDS.nook, code: '09', name: 'Shop sign', width_mm: 92, height_mm: 22, layers: '["CUT","ENGRAVE"]', file: null, position: 9 },
        ]);
        look();
        render(page());
        await settle();
        await sweep('no model');
        cleanup();
        nook()['model_file'] = MODEL;
        render(page());
        await settle(6);
        await sweep('model');
        // The keyboard's list of the model's flat faces, whatever the language: the second is the sign board.
        fireEvent.click(document.querySelectorAll('ul button[aria-pressed]')[1]!);
        await settle();
        await sweep('marking');
        cleanup();
        nook()['faces'] = JSON.stringify([SIGN_FACE]);
        render(page('areas'));
        await settle();
        await sweep('areas on a face');
        cleanup();
      }
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = 'en-US';
    document.documentElement.removeAttribute('data-theme');
    expect(swept).toBe(16);
  });
});
