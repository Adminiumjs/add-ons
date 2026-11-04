// @vitest-environment jsdom
/**
 * A KIT OF PIECES ON THE CUSTOMER'S STAGE (BC-B7b, BC-A2.nook3, BC-F7).
 *
 * Birch Row's book nook with the shop's model and the sign board marked:
 * the model is drawn with the design laid on the marked face (the 3D stage's
 * file draws nothing here, and is asked what a tap lands on), Assembled and
 * Pieces beside "See it flat", the pieces laid flat from their own files
 * with the sign outlined and named, the gallery's cards drawn from the
 * model, and a device without WebGL shown the pieces that carry the design.
 * Every new state is swept by axe.
 */
import axe from 'axe-core';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { glbOf, SIGN, WALL } from '../testing/glb.ts';
import { forgetStills } from '../three/PieceView.tsx';
import { Stage3d, type RendererLike, type StageModel } from '../three/stage3d.ts';
import type { View } from '../three/view.ts';
import type { CatalogueRows, CustomiserApi } from './api.ts';
import { CustomiserEditor } from './index.ts';
import { drawn, setWidth, settle } from './testing/render.tsx';
import { stubApi } from './testing/stub.ts';

const device = vi.hoisted(() => ({ webgl: true, views: [] as View[], models: [] as unknown[], stills: [] as unknown[], tap: null as null | { code: string; point: { x: number; y: number } } }));

vi.mock('../three/load.ts', async (original) => {
  const real = await original<typeof import('../three/load.ts')>();
  return {
    ...real,
    hasWebGL: () => device.webgl,
    loadThree: async () => ({
      ...(await import('../three/stage3d.ts')),
      still: async (model: unknown) => {
        device.stills.push(model);
        return `blob:still/${String(device.stills.length)}`;
      },
      makeStage: () => {
        const renderer: RendererLike = { domElement: document.createElement('canvas'), setPixelRatio: () => {}, setSize: () => {}, render: () => {}, dispose: () => {} };
        const stage = new Stage3d(renderer);
        const setView = stage.setView.bind(stage);
        stage.setView = (view: View) => {
          device.views.push(view);
          setView(view);
        };
        const setModel = stage.setModel.bind(stage);
        stage.setModel = (model: StageModel) => {
          device.models.push(model);
          return setModel(model);
        };
        stage.pickDecal = () => device.tap;
        return stage;
      },
    }),
  };
});

const GLB = glbOf([SIGN, WALL]);

/** The sample shop with the nook's model uploaded and its sign board marked, the sign's area on it. */
function kitApi(): { api: CustomiserApi; nook: number } {
  const stub = stubApi('maker');
  const api: CustomiserApi = {
    ...stub.api,
    async catalogue(base, signal) {
      const rows: CatalogueRows = await stub.api.catalogue(base, signal);
      const sign = rows.pieces.find((one) => one['code'] === '09');
      const face = { code: 'sign-board', name: 'Sign board', piece: String(sign?.['id']), mesh: '0', normal: [0, 0, 1], point: [-0.046, 0.011, 0.075], u: [1, 0, 0], v: [0, -1, 0], bounds: { u0: 0, u1: 0.092, v0: 0, v1: 0.022 }, size: { w: 92, h: 22 } };
      rows.bases = rows.bases.map((one) => (one['kind'] === 'kit' ? { ...one, model_file: 'file_nook', faces: JSON.stringify([face]) } : one));
      rows.areas = rows.areas.map((one) => (one['code'] === 'sign' ? { ...one, face: 'sign-board' } : one));
      return rows;
    },
    modelUrl: async () => 'https://birch-row.test/assets/nook.glb',
    pieceUrl: async (piece) => `https://birch-row.test/assets/piece-${String(piece['code'])}.svg`,
  };
  return { api, nook: stub.ids.nook };
}

beforeEach(() => {
  setWidth(1280);
  device.webgl = true;
  device.views = [];
  device.models = [];
  device.stills = [];
  device.tap = null;
  forgetStills();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => (String(url).endsWith('nook.glb') ? new Response(GLB, { status: 200 }) : new Response(null, { status: 404 }))),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function openCorner(locale = 'en-US'): Promise<void> {
  const { api, nook } = kitApi();
  await drawn(<CustomiserEditor api={api} base={nook} product={{ name: 'The Little Bookshop' }} locale={locale} onAddToBasket={() => {}} />);
  // The card is named in the page's language around the design's own name, which the shop typed.
  fireEvent.click(screen.getAllByRole('button', { name: /Corner shop/ })[0]!);
  for (let i = 0; i < 4; i += 1) await settle();
}

const lastShop = (): { kind: string; decals: { code: string; width: number; height: number }[] } => device.models.filter((one) => (one as { kind?: string }).kind === 'model').at(-1) as never;
const sweep = async (label: string): Promise<void> => {
  const found = await axe.run(document.body, { rules: { region: { enabled: false } } });
  expect(found.violations.map((one) => `${label}: ${one.id} ${one.nodes.map((node) => node.target.join(' ')).join(', ')}`)).toEqual([]);
};

describe('a kit on a device that draws 3D (BC-B7b)', () => {
  it('draws the shop’s model with the design laid on the marked face, at the sign piece’s size', async () => {
    await openCorner();
    const stage = document.querySelector<HTMLElement>('.cz-stage-3d')!;
    expect(stage.getAttribute('aria-roledescription')).toBe('3D preview');
    expect(stage.querySelector('canvas')).not.toBeNull();
    expect(stage.textContent).toContain('110 × 180 × 150 mm · 14 pieces');
    expect(stage.textContent).toContain('Birch ply 3 mm');
    const model = lastShop();
    expect(model.kind).toBe('model');
    expect(model.decals.map((one) => [one.code, one.width, one.height])).toEqual([['sign-board', 92, 22]]);
    // The kit's own angle, as the comp frames it.
    expect(device.views.at(-1)).toEqual({ rx: 12, ry: -30, zoom: 1 });
  });

  it('takes a tap on the sign board’s design to the sign’s field', async () => {
    await openCorner();
    const stage = document.querySelector<HTMLElement>('.cz-stage-3d')!;
    stage.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 400, width: 400, height: 400, toJSON: () => ({}) }) as DOMRect;
    device.tap = { code: 'sign-board', point: { x: 46, y: 11 } };
    await act(async () => {
      fireEvent.pointerDown(stage, { pointerId: 1, clientX: 200, clientY: 200, pointerType: 'mouse' });
      fireEvent.pointerUp(stage, { pointerId: 1, clientX: 200, clientY: 200, pointerType: 'mouse' });
    });
    await settle();
    expect(document.activeElement?.id).toBe('cz-f-sign');
  });

  it('switches to Pieces: every piece laid flat from its own file, numbered, the sign outlined and named, its words drawn on it', async () => {
    await openCorner();
    const modes = screen.getByRole('radiogroup', { name: 'How to show the kit' });
    expect(within(modes).getAllByRole('radio').map((one) => [one.textContent, one.getAttribute('aria-checked')])).toEqual([
      ['Assembled', 'true'],
      ['Pieces', 'false'],
    ]);
    fireEvent.click(within(modes).getByRole('radio', { name: 'Pieces' }));
    await settle();
    const laid = document.querySelector('[data-kit-pieces]')!;
    const tags = [...laid.querySelectorAll('text.cz-piece-tag')].map((one) => one.textContent);
    expect(tags).toHaveLength(14);
    expect(tags).toContain('09 · Shop sign');
    expect(tags).toContain('01');
    expect(laid.querySelectorAll('image[href$=".svg"]')).toHaveLength(14);
    // The sign's words are a way into its field, drawn on the sign piece.
    const sign = within(laid as HTMLElement).getByRole('group', { name: '09 · Shop sign' });
    expect(sign.textContent).toContain('The Corner Shop');
    expect(within(sign).getByRole('button', { name: 'Edit The shop sign' })).toBeTruthy();
    // Shown flat: no turn buttons; the switch keeps its own state.
    expect(screen.queryByRole('group', { name: 'Turn the piece' })).toBeNull();
    expect(screen.getByRole('switch', { name: 'See it flat' }).getAttribute('aria-checked')).toBe('false');
    await sweep('pieces');
  });

  it('seen flat, shows only the pieces that carry the design', async () => {
    await openCorner();
    await sweep('assembled');
    fireEvent.click(screen.getByRole('switch', { name: 'See it flat' }));
    await settle();
    const tags = [...document.querySelectorAll('[data-kit-pieces] text.cz-piece-tag')].map((one) => one.textContent);
    expect(tags).toEqual(['09 · Shop sign', '10', '11', '12']);
    await sweep('flat');
  });

  it('draws each ready-made design’s card from the model, the design on its face', async () => {
    const { api, nook } = kitApi();
    await drawn(<CustomiserEditor api={api} base={nook} product={{ name: 'The Little Bookshop' }} onAddToBasket={() => {}} />);
    for (let i = 0; i < 4; i += 1) await settle();
    const card = screen.getByRole('button', { name: /^Customise the Corner shop design/ });
    expect(card.querySelector('img')?.getAttribute('src')).toMatch(/^blob:still\//);
    expect(device.stills.length).toBe(3);
    expect((device.stills[0] as { decals: unknown[] }).decals).toHaveLength(1);
  });
});

describe('a kit on a device that cannot draw 3D', () => {
  it('says so, locks the switch on, and shows the pieces that carry the design', async () => {
    device.webgl = false;
    await openCorner();
    expect(screen.getByText(/This device can’t show the 3D view/)).toBeTruthy();
    const toggle = screen.getByRole('switch', { name: 'See it flat' });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(toggle.getAttribute('aria-disabled')).toBe('true');
    expect(document.querySelectorAll('[data-kit-pieces] text.cz-piece-tag')).toHaveLength(4);
    expect(device.models).toEqual([]);
    await sweep('no 3d');
  });
});

describe('a kit’s stage in Arabic, under axe', () => {
  it('is clean assembled, in pieces and seen flat, laid out right to left', async () => {
    document.documentElement.lang = 'ar-EG';
    await openCorner('ar-EG');
    expect(document.querySelector('.cz')!.getAttribute('dir')).toBe('rtl');
    await sweep('ar · assembled');
    const modes = document.querySelectorAll<HTMLElement>('.cz-seg [role="radio"]');
    fireEvent.click([...modes].at(-1)!);
    await settle();
    expect(document.querySelector('[data-kit-pieces]')).not.toBeNull();
    await sweep('ar · pieces');
    fireEvent.click(screen.getByRole('switch'));
    await settle();
    await sweep('ar · flat');
    document.documentElement.lang = 'en-US';
  });
});
