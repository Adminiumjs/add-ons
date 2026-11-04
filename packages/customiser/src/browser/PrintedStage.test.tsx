// @vitest-environment jsdom
/**
 * A 3D-PRINTED ITEM ON THE CUSTOMER'S STAGE (BC-B7c): Birch Row's name
 * keyring, "SAM" in Amber, raised 1 mm, as its sample sets it up (no model
 * files yet: the item is made from its size, its words stood up from its
 * top). The stage's file is a stand-in that records the models it is handed.
 */
import axe from 'axe-core';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { forgetStills } from '../three/PieceView.tsx';
import type { PieceModel } from '../three/piece.ts';
import { Stage3d, type RendererLike, type StageModel } from '../three/stage3d.ts';
import { CustomiserEditor } from './index.ts';
import { drawn, setWidth, settle } from './testing/render.tsx';
import { stubApi } from './testing/stub.ts';

const device = vi.hoisted(() => ({ models: [] as unknown[], stills: [] as unknown[] }));

vi.mock('../three/load.ts', async (original) => {
  const real = await original<typeof import('../three/load.ts')>();
  return {
    ...real,
    hasWebGL: () => true,
    loadThree: async () => ({
      ...(await import('../three/stage3d.ts')),
      still: async (model: unknown) => {
        device.stills.push(model);
        return `blob:still/${String(device.stills.length)}`;
      },
      makeStage: () => {
        const renderer: RendererLike = { domElement: document.createElement('canvas'), setPixelRatio: () => {}, setSize: () => {}, render: () => {}, dispose: () => {} };
        const stage = new Stage3d(renderer);
        const setModel = stage.setModel.bind(stage);
        stage.setModel = (model: StageModel) => {
          device.models.push(model);
          return setModel(model);
        };
        return stage;
      },
    }),
  };
});

beforeEach(() => {
  setWidth(1280);
  device.models = [];
  device.stills = [];
  forgetStills();
});
afterEach(cleanup);

async function openSam(locale = 'en-US'): Promise<HTMLElement> {
  const stub = stubApi('maker');
  const [ordered] = await stub.api.byCodes(['BR2289R4W8N2T6JC']);
  await drawn(<CustomiserEditor api={stub.api} base={stub.ids.keyring} product={{ name: 'Name keyring' }} design={ordered!} locale={locale} onAddToBasket={() => {}} />);
  await settle();
  await settle();
  return document.querySelector<HTMLElement>('.cz-stage-3d')!;
}

describe('the name keyring on the stage', () => {
  it('is the 3D preview, labelled “PLA · Amber” and “56 × 24 × 4 mm”, from a printed item’s angle', async () => {
    const stage = await openSam();
    expect(stage.getAttribute('aria-roledescription')).toBe('3D preview');
    expect(stage.textContent).toContain('PLA · Amber');
    expect(stage.textContent).toContain('56 × 24 × 4 mm');
    expect(screen.getByRole('switch', { name: 'See it flat' }).getAttribute('aria-checked')).toBe('false');
  });

  it('is made from its size, its words stood up 1 mm from its top', async () => {
    await openSam();
    const model = device.models.at(-1) as PieceModel;
    expect(model).toMatchObject({ width: 56, height: 24, thickness: 4, relief: { mode: 'raised', depth: 1 } });
  });

  it('is drawn flat on “See it flat”, with no 3D model asked for', async () => {
    await openSam();
    const before = device.models.length;
    fireEvent.click(screen.getByRole('switch', { name: 'See it flat' }));
    await settle();
    expect(screen.getByRole('switch', { name: 'See it flat' }).getAttribute('aria-checked')).toBe('true');
    expect(device.models.length).toBe(before);
  });

  it('has a gallery still with its words raised, one for each design', async () => {
    const stub = stubApi('maker');
    await drawn(<CustomiserEditor api={stub.api} base={stub.ids.keyring} product={{ name: 'Name keyring' }} onAddToBasket={() => {}} />);
    await settle();
    await settle();
    const stills = device.stills as PieceModel[];
    expect(stills.length).toBeGreaterThan(0);
    for (const still of stills) expect(still.relief).toMatchObject({ mode: 'raised', depth: 1 });
  });

  it('passes axe in 3D and seen flat, English and Arabic', async () => {
    for (const locale of ['en-US', 'ar-EG']) {
      document.documentElement.lang = locale;
      await openSam(locale);
      for (const state of ['3d', 'flat']) {
        if (state === 'flat') {
          fireEvent.click(screen.getByRole('switch'));
          await settle();
        }
        const found = await axe.run(document.body, { rules: { region: { enabled: false }, 'color-contrast': { enabled: false } } });
        expect(found.passes.length).toBeGreaterThan(0);
        expect(found.violations.map((one) => `${locale} · ${state}: ${one.id}`)).toEqual([]);
      }
      cleanup();
    }
    document.documentElement.lang = 'en-US';
  });
});
