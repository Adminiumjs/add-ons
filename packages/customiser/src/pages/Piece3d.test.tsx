// @vitest-environment jsdom
/**
 * A FLAT PIECE IN 3D ON THE SHOP'S SCREENS (BC-D2.flat, BC-E1, BC-D9, the record panels).
 *
 * The set-up's Base preview turns the piece made from its outline and
 * thickness, or says it waits for the outline; the order line switches its
 * design between 3D and flat; the product's panel shows the piece made. On a
 * device with WebGL (the 3D stage's file is a stand-in that draws nothing)
 * and without; every new state swept by axe.
 */
import axe from 'axe-core';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { forgetStills } from '../three/PieceView.tsx';
import { Stage3d, type RendererLike } from '../three/stage3d.ts';
import type { View } from '../three/view.ts';
import { resetWorld, seed, world } from './testing/host.tsx';
import { IDS, seedShop } from './testing/rows.ts';

const device = vi.hoisted(() => ({ webgl: true, views: [] as View[], stills: 0 }));

vi.mock('../three/load.ts', async (original) => {
  const real = await original<typeof import('../three/load.ts')>();
  return {
    ...real,
    hasWebGL: () => device.webgl,
    loadThree: async () => ({
      ...(await import('../three/stage3d.ts')),
      still: async () => `blob:still/${String((device.stills += 1))}`,
      makeStage: () => {
        const renderer: RendererLike = { domElement: document.createElement('canvas'), setPixelRatio: () => {}, setSize: () => {}, render: () => {}, dispose: () => {} };
        const stage = new Stage3d(renderer);
        const setView = stage.setView.bind(stage);
        stage.setView = (view: View) => {
          device.views.push(view);
          setView(view);
        };
        return stage;
      },
    }),
  };
});

const { default: Customiser } = await import('./customiser/index.tsx');
const { default: Product } = await import('../panels/product.tsx');
const { default: Line } = await import('../panels/line.tsx');

const settle = async (): Promise<void> => {
  for (let i = 0; i < 3; i += 1)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
};
const base = (id: number): ReactNode => {
  world.splat = `customiser/${String(id)}`;
  world.search = { step: 'base' };
  return <Customiser />;
};
const seedLine = (): void => {
  seed('designs', [{ id: 91, app: 'maker', ready_design_id: 51, base_id: IDS.coasters, values: JSON.stringify({ format: 1, parts: { words: { text: 'The Hartleys' } } }), state: 'ordered', updated_at: '2026-08-05T15:01:00Z' }]);
};
const HOST = { connectionId: 'c1', table: 't', row: 'r' };

beforeEach(() => {
  resetWorld();
  seedShop();
  device.webgl = true;
  device.views = [];
  device.stills = 0;
  forgetStills();
});
afterEach(cleanup);

describe('the set-up’s Base preview (BC-D2.flat)', () => {
  it('turns the piece made from its outline: a drag or the four buttons, its size beside them', async () => {
    render(base(IDS.coasters));
    await settle();
    const preview = screen.getByRole('img', { name: 'Engraved walnut coasters preview' });
    expect(preview.querySelector('canvas')).not.toBeNull();
    expect(screen.getByText('95 × 95 × 6 mm')).toBeTruthy();
    expect(device.views[device.views.length - 1]).toEqual({ rx: 36, ry: -20, zoom: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Turn left' }));
    await settle();
    expect(device.views[device.views.length - 1]).toEqual({ rx: 36, ry: -35, zoom: 1 });
    for (const name of ['Turn right', 'Turn up', 'Turn down']) expect(screen.getByRole('button', { name })).toBeTruthy();
    await act(async () => {
      fireEvent.pointerDown(preview, { pointerId: 1, clientX: 0, clientY: 0, pointerType: 'mouse' });
      fireEvent.pointerMove(preview, { pointerId: 1, clientX: 30, clientY: 0, pointerType: 'mouse' });
      fireEvent.pointerUp(preview, { pointerId: 1 });
    });
    expect(device.views[device.views.length - 1]!.ry).toBe(-20);
  });

  it('is the comp’s striped square until the outline is in', async () => {
    render(base(IDS.sign));
    await settle();
    const words = screen.getByText('the 3D preview appears once the outline is in');
    expect(words.parentElement!.querySelector('pattern')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Turn left' })).toBeNull();
  });

  it('draws the piece flat on a device without WebGL', async () => {
    device.webgl = false;
    render(base(IDS.coasters));
    await settle();
    expect(screen.getByRole('img', { name: 'Engraved walnut coasters, drawn flat' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Turn left' })).toBeNull();
    expect(screen.getByText('95 × 95 × 6 mm')).toBeTruthy();
  });
});

describe('the order line’s design, 3D or flat (BC-E1, BC-D9)', () => {
  it('shows the design on the piece made, and flat on the switch', async () => {
    seedLine();
    render(<Line {...HOST} linked="91" />);
    await settle();
    const made = screen.getByRole('img', { name: 'Ring, as it will be made' });
    expect(made.querySelector('img')?.getAttribute('src')).toMatch(/^blob:still\//);
    const views = screen.getByRole('radiogroup', { name: 'How to show the design' });
    expect([...views.querySelectorAll('[role="radio"]')].map((one) => [one.textContent, one.getAttribute('aria-checked')])).toEqual([
      ['3D', 'true'],
      ['Flat', 'false'],
    ]);
    fireEvent.click(screen.getByRole('radio', { name: 'Flat' }));
    await settle();
    expect(document.querySelector('[data-design-sides] img[src^="blob:still"]')).toBeNull();
    expect(document.querySelector('[data-design-sides] svg.w-full')).not.toBeNull();
  });

  it('is only flat, with no switch, on a device without WebGL', async () => {
    device.webgl = false;
    seedLine();
    render(<Line {...HOST} linked="91" />);
    await settle();
    expect(screen.queryByRole('radiogroup', { name: 'How to show the design' })).toBeNull();
    expect(document.querySelector('[data-design-sides] svg')).not.toBeNull();
    expect(device.stills).toBe(0);
  });
});

describe('the product’s panel', () => {
  it('shows a flat piece made, its areas named on its top', async () => {
    render(<Product {...HOST} linked={String(IDS.coasters)} />);
    await settle();
    const made = screen.getByRole('img', { name: 'Engraved walnut coasters, made, with its areas' });
    expect(made.querySelector('img')?.getAttribute('src')).toMatch(/^blob:still\//);
  });

  it('keeps a page drawn flat', async () => {
    render(<Product {...HOST} linked={String(IDS.cards)} />);
    await settle();
    expect(screen.queryByRole('img', { name: /made, with its areas/ })).toBeNull();
  });
});

describe('the 3D previews under axe', () => {
  it('are clean, English and Arabic, light and dark', async () => {
    const failures: string[] = [];
    let swept = 0;
    const states: [string, () => ReactNode, (() => void)?][] = [
      ['base', () => base(IDS.coasters)],
      ['base waiting', () => base(IDS.sign)],
      ['line 3D', () => <Line {...HOST} linked="91" />, seedLine],
      ['product', () => <Product {...HOST} linked={String(IDS.coasters)} />],
    ];
    for (const locale of ['en-US', 'ar-EG'] as const)
      for (const theme of ['light', 'dark'] as const)
        for (const [label, draw, before] of states) {
          resetWorld();
          seedShop();
          forgetStills();
          world.locale = locale;
          document.documentElement.lang = locale;
          document.documentElement.dir = locale === 'ar-EG' ? 'rtl' : 'ltr';
          document.documentElement.setAttribute('data-theme', theme);
          before?.();
          render(<main>{draw()}</main>);
          await settle();
          const results = await axe.run(document.body, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, rules: { 'color-contrast': { enabled: false } } });
          if (results.passes.length === 0) failures.push(`${locale} · ${theme} · ${label}: axe examined nothing`);
          for (const violation of results.violations.filter((one) => one.impact === 'critical' || one.impact === 'serious')) failures.push(`${locale} · ${theme} · ${label}: ${violation.id} — ${violation.nodes.map((node) => node.html.slice(0, 160)).join(' | ')}`);
          swept += 1;
          cleanup();
        }
    expect(failures, failures.join('\n')).toEqual([]);
    expect(swept).toBe(16);
  }, 120_000);
});
