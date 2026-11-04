// @vitest-environment jsdom
/**
 * A 3D-PRINTED ITEM'S SET-UP (BC-0.BASE.print, BC-D2.print, BC-D2.refusals,
 * BC-F9).
 *
 * The model to print is an STL or a 3MF read by its bytes and whole: one
 * with no flat face is refused in BC-F9's words, one that is taken gives the
 * item its size. The preview is a GLB, laid over the model to print. Mark
 * faces finds faces on the model to print (read by the package's own reader,
 * drawn on a stand-in stage): the form says Raised or Cut in, by how much,
 * and the smallest letter, kept on the face and on its area's rules; the
 * curved part says it is not flat.
 */
import axe from 'axe-core';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ballStl, keyringGlb, keyringStl } from '../../testing/keyring.ts';
import { align, placePlane, placePoint } from '../../three/align.ts';
import { facesOf, facesValue, readRelief } from '../../three/faceStore.ts';
import type { MarkedFace } from '../../three/faces.ts';
import { Stage3d, type RendererLike } from '../../three/stage3d.ts';
import { resetWorld, seed, world, type Call } from '../testing/host.tsx';
import { seedShop } from '../testing/rows.ts';
import { checkPrintFile, printRefusal } from './PrintedBase.tsx';

const device = vi.hoisted(() => ({ webgl: true }));

vi.mock('../../three/load.ts', async (original) => {
  const real = await original<typeof import('../../three/load.ts')>();
  return {
    ...real,
    hasWebGL: () => device.webgl,
    loadThree: async () => ({
      ...(await import('../../three/stage3d.ts')),
      makeStage: () => {
        const renderer: RendererLike = { domElement: document.createElement('canvas'), setPixelRatio: () => {}, setSize: () => {}, render: () => {}, dispose: () => {} };
        return new Stage3d(renderer);
      },
    }),
  };
});

const { default: Customiser } = await import('../customiser/index.tsx');

const KEYRING = 15;
const PRINT = 'file_01JD00000000000000000000PR';
const PREVIEW = 'file_01JD00000000000000000000PV';
const STL = keyringStl();
const GLB = keyringGlb();

const settle = async (rounds = 4): Promise<void> => {
  for (let i = 0; i < rounds; i += 1)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
};
const page = (): ReactNode => {
  world.splat = `customiser/${String(KEYRING)}`;
  world.search = {};
  return <Customiser />;
};
const writes = (kind: Call['kind'], table: string): Call[] => world.calls.filter((call) => call.kind === kind && call.table === table);
const keyring = (): Record<string, unknown> => world.tables['bases']!.find((one) => one['id'] === KEYRING)!;
const pick = async (label: string, file: File): Promise<void> => {
  await act(async () => {
    fireEvent.change(screen.getByLabelText(label), { target: { files: [file] } });
  });
  await settle(6);
};

beforeEach(() => {
  resetWorld();
  seedShop();
  seed('bases', [...world.tables['bases']!, { id: KEYRING, app: 'maker', name: 'Name keyring', kind: 'printed', width_mm: 56, height_mm: 24, corner_mm: 12, material: 'PLA', thickness_mm: 4, outline_file: null, model_file: null, print_file: null, faces: null, offered: JSON.stringify({ fonts: ['Manrope'], finishes: [] }), state: 'draft', position: 5 }]);
  device.webgl = true;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (address: string, init?: RequestInit) => {
      const [bytes, name] = String(address).includes(PRINT) ? [STL, 'name-keyring.stl'] : String(address).includes(PREVIEW) ? [GLB, 'name-keyring.glb'] : [null, ''];
      if (bytes === null) return new Response(null, { status: 404 });
      const headers = { 'content-length': String(bytes.byteLength), 'content-disposition': `inline; filename="${name}"` };
      return new Response(init?.method === 'HEAD' ? null : bytes, { status: 200, headers });
    }),
  );
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 400, width: 400, height: 400, toJSON: () => ({}) } as DOMRect);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('a printed item’s facts', () => {
  it('checks a model to print by its bytes, whole: a model, at most 30 MB, with a flat face; its size from its box', async () => {
    expect(await checkPrintFile(new Uint8Array(STL), STL.byteLength)).toEqual({ width: expect.closeTo(56, 3) as number, height: expect.closeTo(24, 3) as number, depth: 4 });
    expect(await checkPrintFile(new TextEncoder().encode('not a model'), 11)).toEqual({ problem: 'not-kind' });
    expect(await checkPrintFile(new Uint8Array(0), 31 * 1024 * 1024)).toEqual({ problem: 'too-large' });
    expect(await checkPrintFile(new Uint8Array(ballStl()), ballStl().byteLength)).toEqual({ problem: 'no-flat' });
  });

  it('says why in BC-F9’s words, a capital after the file’s name', () => {
    const t = (_key: string, english: string, values?: Record<string, unknown>): string => english.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? ''));
    expect(printRefusal(t as never, 'tag.obj', 'not-kind')).toBe('tag.obj: That isn’t an STL or 3MF file.');
    expect(printRefusal(t as never, 'big.stl', 'too-large')).toBe('big.stl: That file is over 30 MB.');
    expect(printRefusal(t as never, 'ball.stl', 'no-flat')).toBe('ball.stl: This model has no flat face we can use here.');
  });

  it('lays the preview over the model to print: turned from z-up to y-up, scaled from millimetres to metres, middles met', () => {
    const fit = align({ min: [0, 0, 0], max: [56, 24, 4] }, { min: [-0.028, 0, -0.012], max: [0.028, 0.004, 0.012] });
    expect(fit.turn).toBe('z-up');
    expect(fit.scale).toBeCloseTo(0.001, 9);
    expect(fit.misfit).toBeLessThan(1e-9);
    // The top's middle (z 4) is the preview's top's middle (y 0.004).
    expect(placePoint(fit, [28, 12, 4]).map((one) => Math.round(one * 1e6) / 1e6)).toEqual([0, 0.004, 0]);
    const top = placePlane(fit, { mesh: '0', normal: [0, 0, 1], point: [0, 24, 4], u: [1, 0, 0], v: [0, -1, 0], bounds: { u0: 0, u1: 56, v0: 0, v1: 24 } });
    expect(top.normal).toEqual([0, 1, 0]);
    expect(top.v).toEqual([0, 0, 1]);
    expect(top.bounds.u1).toBeCloseTo(0.056, 9);
    // Two files that are not the same object say so.
    expect(align({ min: [0, 0, 0], max: [56, 24, 4] }, { min: [0, 0, 0], max: [1, 1, 1] }).misfit).toBeGreaterThan(0.5);
  });

  it('keeps how the words sit on a face, read back the same, held to the steppers’ ranges', () => {
    const face: MarkedFace = { code: 'front', name: 'The front', piece: null, mesh: '0', normal: [0, 0, 1], point: [0, 24, 4], u: [1, 0, 0], v: [0, -1, 0], bounds: { u0: 0, u1: 56, v0: 0, v1: 24 }, size: { w: 56, h: 24 }, relief: { mode: 'cut', depth: 1.5, smallest: 5 }, preview: { mesh: 'preview', normal: [0, 1, 0], point: [-0.028, 0.004, -0.012], u: [1, 0, 0], v: [0, 0, 1], bounds: { u0: 0, u1: 0.056, v0: 0, v1: 0.024 } } };
    expect(facesOf(facesValue([face]))).toEqual([face]);
    expect(readRelief({ mode: 'raised', depth: 9, smallest: 1 })).toEqual({ mode: 'raised', depth: 3, smallest: 2 });
    expect(readRelief({ mode: 'sideways' })).toBeNull();
  });
});

describe('step 1 for a 3D-printed item (BC-0.BASE.print)', () => {
  it('asks for the model to print and the preview model in the comp’s words, and shows “no preview yet”', async () => {
    render(page());
    await settle();
    expect(screen.getByText('Printed in PLA. Words and logos are raised from, or cut into, a flat face.')).toBeTruthy();
    expect(screen.getByText('The model to print')).toBeTruthy();
    expect(screen.getByText('STL or 3MF · up to 30 MB')).toBeTruthy();
    expect(screen.getByText('The preview model')).toBeTruthy();
    expect(screen.getByText('GLB · up to 30 MB')).toBeTruthy();
    expect(screen.getByText('A lighter GLB the shopper’s preview uses.')).toBeTruthy();
    expect(screen.getAllByText('no preview yet').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Upload the model to print to mark its faces.').length).toBeGreaterThan(0);
  });

  it('refuses a file that is not a model, and one with no flat face, by their bytes; takes the keyring and gives the item its size', async () => {
    world.upload = () => ({ id: PRINT });
    render(page());
    await settle();
    await pick('Upload the model', new File(['solid nothing here'], 'tag.stl'));
    expect(screen.getByText('tag.stl: That isn’t an STL or 3MF file.')).toBeTruthy();
    await pick('Upload the model', new File([ballStl()], 'ball.stl'));
    expect(screen.getByText('ball.stl: This model has no flat face we can use here.')).toBeTruthy();
    expect(writes('upload', 'bases')).toEqual([]);
    await pick('Upload the model', new File([STL], 'name-keyring.stl'));
    expect(writes('upload', 'bases')).toMatchObject([{ key: String(KEYRING), values: { column: 'print_file', name: 'name-keyring.stl' } }]);
    expect(writes('update', 'bases').at(-1)?.values).toMatchObject({ width_mm: 56, height_mm: 24, thickness_mm: 4 });
  });

  it('takes the preview only as a GLB by its bytes', async () => {
    world.upload = () => ({ id: PREVIEW });
    render(page());
    await settle();
    await pick('Upload the preview', new File([STL], 'keyring.glb'));
    expect(screen.getByText('keyring.glb: That isn’t a GLB model.')).toBeTruthy();
    await pick('Upload the preview', new File([GLB], 'name-keyring.glb'));
    expect(writes('upload', 'bases')).toMatchObject([{ values: { column: 'model_file', name: 'name-keyring.glb' } }]);
  });
});

describe('Mark faces on a 3D-printed item (BC-D2.print)', () => {
  const stageOf = (): HTMLElement => screen.getByRole('img', { name: 'Name keyring, with its marked faces' });
  const click = async (x = 230, y = 200): Promise<void> => {
    const stage = stageOf();
    await act(async () => {
      fireEvent.pointerDown(stage, { pointerId: 1, clientX: x, clientY: y, pointerType: 'mouse' });
      fireEvent.pointerUp(stage, { pointerId: 1, clientX: x, clientY: y, pointerType: 'mouse' });
    });
    await settle(6);
  };

  it('marks the top, raised 1 mm with 4 mm letters to start; kept on the face, on the preview, and on its new area', async () => {
    keyring()['print_file'] = PRINT;
    keyring()['model_file'] = PREVIEW;
    render(page());
    await settle(10);
    expect(screen.getByText('Say how words sit on each flat face.')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Flat face 1/ })[0]!.textContent).toContain('flat · 56 × 24 mm');
    await click();
    expect(screen.getByRole('radio', { name: 'Raised' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('group', { name: 'Raised by' }).textContent).toContain('1 mm');
    expect(screen.getByRole('group', { name: 'Smallest letter' }).textContent).toContain('4 mm');
    fireEvent.change(screen.getByLabelText('Name it'), { target: { value: 'The front' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mark this face' }));
    await settle();
    const [front] = facesOf(keyring()['faces']);
    expect(front).toMatchObject({ code: 'the-front', name: 'The front', piece: null, normal: [0, 0, 1], size: { w: 56, h: 24 }, relief: { mode: 'raised', depth: 1, smallest: 4 } });
    // The same face on the preview: its top, y up, in metres.
    expect(front!.preview?.normal).toEqual([0, 1, 0]);
    expect(front!.preview!.bounds.u1 - front!.preview!.bounds.u0).toBeCloseTo(0.056, 5);
    const area = writes('create', 'base_areas').at(-1)?.values as Record<string, unknown>;
    expect(area).toMatchObject({ base_id: KEYRING, name: 'The front', face: 'the-front', piece_id: null, takes: 'words' });
    expect(JSON.parse(area['rules'] as string)).toMatchObject({ mode: 'raised', depthMm: 1, smallestLetterMm: 4 });
  });

  it('cuts in instead, deeper, with bigger letters: the steppers keep to their ranges, and the area’s rules follow', async () => {
    keyring()['print_file'] = PRINT;
    render(page());
    await settle(10);
    await click();
    fireEvent.change(screen.getByLabelText('Name it'), { target: { value: 'The front' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Cut in' }));
    const depth = screen.getByRole('group', { name: 'Depth cut in' });
    for (let i = 0; i < 8; i += 1) fireEvent.click(depth.querySelectorAll('button')[1]!);
    expect(depth.textContent).toContain('3 mm');
    const letter = screen.getByRole('group', { name: 'Smallest letter' });
    for (let i = 0; i < 5; i += 1) fireEvent.click(letter.querySelectorAll('button')[0]!);
    expect(letter.textContent).toContain('2 mm');
    fireEvent.click(screen.getByRole('button', { name: 'Mark this face' }));
    await settle();
    expect(facesOf(keyring()['faces'])[0]?.relief).toEqual({ mode: 'cut', depth: 3, smallest: 2 });
    // No preview yet: the face is kept without one.
    expect(facesOf(keyring()['faces'])[0]?.preview).toBeUndefined();
    const areaId = (writes('create', 'base_areas').at(-1)?.values as Record<string, unknown>)['code'];
    expect(areaId).toBe('the-front');
    // Changed again: the area it carries takes the new relief into its rules.
    cleanup();
    render(page());
    await settle(10);
    await click();
    fireEvent.click(screen.getByRole('radio', { name: 'Raised' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await settle();
    expect(JSON.parse((writes('update', 'base_areas').at(-1)?.values as Record<string, unknown>)['rules'] as string)).toMatchObject({ mode: 'raised', depthMm: 3, smallestLetterMm: 2 });
  });

  it('lists the curved part, which says it cannot carry words', async () => {
    keyring()['print_file'] = PRINT;
    render(page());
    await settle(10);
    const curved = screen.getByRole('button', { name: /The curved partcurved all roundCurved/ });
    fireEvent.click(curved);
    await settle();
    expect(screen.getByRole('alert').textContent).toBe('This face isn’t flat, so it can’t carry words or a logo. Pick a flat face.');
  });
});

describe('the printed item’s set-up under axe', () => {
  it('has no violations: before the models, with them, marking a face, and the curved part', async () => {
    const sweep = async (label: string): Promise<void> => {
      const found = await axe.run(document.body, { rules: { region: { enabled: false }, 'color-contrast': { enabled: false } } });
      expect(found.violations.map((one) => `${label}: ${one.id}`)).toEqual([]);
    };
    render(page());
    await settle();
    await sweep('no models');
    cleanup();
    keyring()['print_file'] = PRINT;
    keyring()['model_file'] = PREVIEW;
    render(page());
    await settle(10);
    await sweep('models');
    fireEvent.click(screen.getAllByRole('button', { name: /Flat face 1/ })[0]!);
    await settle();
    await sweep('marking');
    fireEvent.click(screen.getByRole('button', { name: /The curved part/ }));
    await settle();
    await sweep('curved');
  });
});
