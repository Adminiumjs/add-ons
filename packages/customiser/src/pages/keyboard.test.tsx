// @vitest-environment jsdom
/**
 * THE SHOP'S SET-UP WITHOUT A MOUSE.
 *
 * The stepper's seven steps are buttons in reading order, the one shown
 * marked as the current step, each a stop for Tab before the step's own
 * parts. A kit's areas sit on a piece or a marked face, chosen in "On:", a
 * labelled select a keyboard reaches and works. (The areas' canvas, the
 * design editor's parts, and Mark faces for a kit and for a printed item
 * are walked by keyboard in their own tests: `Setup.test.tsx`,
 * `Designs.test.tsx`, `Kit.test.tsx`, `Printed.test.tsx`. The dialogs the
 * shop's screens open are the dashboard's own, which close on Escape there.)
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Stage3d, type RendererLike } from '../three/stage3d.ts';
import { resetWorld, seed, world } from './testing/host.tsx';
import { IDS, seedShop } from './testing/rows.ts';

vi.mock('../three/load.ts', async (original) => {
  const real = await original<typeof import('../three/load.ts')>();
  return {
    ...real,
    hasWebGL: () => false,
    loadThree: async () => ({
      ...(await import('../three/stage3d.ts')),
      makeStage: () => {
        const renderer: RendererLike = { domElement: document.createElement('canvas'), setPixelRatio: () => {}, setSize: () => {}, render: () => {}, dispose: () => {} };
        return new Stage3d(renderer);
      },
    }),
  };
});

const { default: Customiser } = await import('./customiser/index.tsx');

const settle = async (): Promise<void> => {
  for (let i = 0; i < 4; i += 1)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
};
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]';
const tabOrder = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((one) => one.getAttribute('tabindex') !== '-1' && one.closest('[aria-hidden="true"], [hidden]') === null);
const page = (base: number, step?: string) => {
  world.splat = `customiser/${String(base)}`;
  world.search = step === undefined ? {} : { step };
  return <Customiser />;
};

beforeEach(() => {
  resetWorld();
  seedShop();
});
afterEach(cleanup);

describe('the stepper', () => {
  it('is seven buttons in order, the shown step marked current, each before the step’s own parts, each working', async () => {
    render(page(IDS.coasters, 'areas'));
    await settle();
    const steps = within(screen.getByRole('navigation', { name: 'Steps' })).getAllByRole('button');
    expect(steps.map((one) => one.textContent?.replace(/^[\d✓]+/, ''))).toEqual(['Base', 'Areas', 'Ready-made designs', 'Fonts & finishes', 'Prices', 'Preview', 'Publish']);
    expect(steps.filter((one) => one.getAttribute('aria-current') === 'step').map((one) => one.textContent?.replace(/^[\d✓]+/, ''))).toEqual(['Areas']);
    const stops = tabOrder();
    const positions = steps.map((one) => stops.indexOf(one));
    expect(positions.every((one) => one > -1)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    // The step's own parts come after the stepper.
    const own = screen.getByLabelText('Name');
    expect(stops.indexOf(own)).toBeGreaterThan(positions.at(-1)!);
    steps[4]!.focus();
    fireEvent.click(steps[4]!);
    expect(world.navigated.at(-1)).toMatchObject({ search: { step: 'prices' } });
  });
});

describe('a kit’s areas, “On:”', () => {
  it('is a labelled select a keyboard reaches, listing the pieces and the marked faces, and switches the canvas', async () => {
    const nook = world.tables['bases']!.find((one) => one['id'] === IDS.nook)!;
    nook['faces'] = JSON.stringify([{ code: 'sign-board', name: 'Sign board', piece: '209', mesh: '0', normal: [0, 0, 1], point: [0, 0, 0], u: [1, 0, 0], v: [0, -1, 0], bounds: { u0: 0, u1: 0.092, v0: 0, v1: 0.022 }, size: { w: 92, h: 22 } }]);
    seed('base_pieces', [
      { id: 201, app: 'maker', base_id: IDS.nook, code: '01', name: 'Base', width_mm: 110, height_mm: 150, layers: '["CUT"]', file: null, position: 1 },
      { id: 209, app: 'maker', base_id: IDS.nook, code: '09', name: 'Shop sign', width_mm: 92, height_mm: 22, layers: '["CUT","ENGRAVE"]', file: null, position: 9 },
    ]);
    render(page(IDS.nook, 'areas'));
    await settle();
    const on = screen.getByLabelText('On') as HTMLSelectElement;
    expect(on.tagName).toBe('SELECT');
    expect(tabOrder()).toContain(on);
    const choices = [...on.options].map((one) => one.textContent);
    expect(choices.some((one) => one?.includes('Sign board'))).toBe(true);
    expect(choices.some((one) => one?.includes('Shop sign'))).toBe(true);
    const before = on.value;
    const other = [...on.options].find((one) => one.value !== before)!;
    on.focus();
    fireEvent.change(on, { target: { value: other.value } });
    await settle();
    expect((screen.getByLabelText('On') as HTMLSelectElement).value).toBe(other.value);
  });
});
