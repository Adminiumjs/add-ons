// @vitest-environment jsdom
/**
 * THE CUSTOMER'S 3D STAGE (BC-0.3D, BC-B7a, BC-F7, BC-F19, BC-F20), AS A CUSTOMER USES IT.
 *
 * Birch Row's walnut coasters, a flat piece, on a device with WebGL (the 3D
 * stage's file is a stand-in that draws nothing and records the views it is
 * asked for), on one without, and for a person who asked for less motion.
 * Every new state is swept by axe.
 */
import axe from 'axe-core';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { forgetStills } from '../three/PieceView.tsx';
import { Stage3d, type RendererLike } from '../three/stage3d.ts';
import type { View } from '../three/view.ts';
import { CustomiserEditor } from './index.ts';
import { drawn, setWidth, settle } from './testing/render.tsx';
import { stubApi } from './testing/stub.ts';

const device = vi.hoisted(() => ({ webgl: true, views: [] as View[], disposed: 0, made: 0, stills: [] as { width: number; height: number; thickness: number }[] }));

vi.mock('../three/load.ts', async (original) => {
  const real = await original<typeof import('../three/load.ts')>();
  return {
    ...real,
    hasWebGL: () => device.webgl,
    loadThree: async () => ({
      ...(await import('../three/stage3d.ts')),
      still: async (model: { thickness: number }, _view: View, width: number, height: number) => {
        device.stills.push({ width, height, thickness: model.thickness });
        return `blob:still/${String(device.stills.length)}`;
      },
      makeStage: () => {
        const renderer: RendererLike = { domElement: document.createElement('canvas'), setPixelRatio: () => {}, setSize: () => {}, render: () => {}, dispose: () => (device.disposed += 1) };
        device.made += 1;
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

const reduce = (on: boolean): void => {
  const narrow = window.matchMedia;
  window.matchMedia = ((query: string) => (query.includes('reduced-motion') ? ({ ...narrow('(min-width: 0px)'), matches: on, media: query } as MediaQueryList) : narrow(query))) as typeof window.matchMedia;
};

beforeEach(() => {
  setWidth(1280);
  device.webgl = true;
  device.views = [];
  device.disposed = 0;
  device.made = 0;
  device.stills = [];
  forgetStills();
});
afterEach(cleanup);

async function openRing(locale = 'en-US'): Promise<HTMLElement> {
  const stub = stubApi('maker');
  await drawn(<CustomiserEditor api={stub.api} base={stub.ids.coasters} product={{ name: 'Engraved walnut coasters' }} locale={locale} onAddToBasket={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /^Customise the Ring design|Ring/ }));
  await settle();
  await settle();
  return document.querySelector<HTMLElement>('.cz-stage-3d')!;
}

const lastView = (): View => device.views[device.views.length - 1]!;
const key = async (stage: HTMLElement, name: string): Promise<void> => {
  await act(async () => {
    fireEvent.keyDown(stage, { key: name });
  });
};

describe('a flat piece on a device that draws 3D', () => {
  it('is a group named as a 3D preview, with the comp’s chrome: hint, labels, switch off, turn buttons, zoom and reset', async () => {
    const stage = await openRing();
    expect(stage.getAttribute('role')).toBe('group');
    expect(stage.getAttribute('aria-roledescription')).toBe('3D preview');
    expect(stage.getAttribute('aria-label')).toMatch(/^Engraved walnut coasters, Ring\. Use the arrow keys to turn it, plus and minus to zoom, 0 to reset\.$/);
    expect(stage.textContent).toContain('Drag to turn · scroll to zoom');
    expect(stage.querySelector('canvas')).not.toBeNull();
    const toggle = screen.getByRole('switch', { name: 'See it flat' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(toggle.getAttribute('aria-disabled')).toBe('false');
    expect(screen.getByRole('group', { name: 'Turn the piece' }).querySelectorAll('button')).toHaveLength(4);
    for (const name of ['Turn left', 'Turn right', 'Turn up', 'Turn down', 'Zoom out', 'Zoom in', 'Reset the view']) expect(screen.getByRole('button', { name })).toBeTruthy();
    expect(screen.getByText('100%')).toBeTruthy();
    expect(screen.queryByText(/can’t show the 3D view/)).toBeNull();
    expect(lastView()).toEqual({ rx: 36, ry: -20, zoom: 1 });
  });

  it('turns and zooms from the focused stage’s keys, and 0 puts it back', async () => {
    const stage = await openRing();
    await key(stage, 'ArrowLeft');
    expect(lastView()).toEqual({ rx: 36, ry: -35, zoom: 1 });
    await key(stage, 'ArrowUp');
    expect(lastView()).toEqual({ rx: 48, ry: -35, zoom: 1 });
    await key(stage, '+');
    expect(screen.getByText('112%')).toBeTruthy();
    await key(stage, '-');
    expect(lastView().zoom).toBe(1);
    await key(stage, '0');
    expect(lastView()).toEqual({ rx: 36, ry: -20, zoom: 1 });
  });

  it('turns from the buttons, zooms from − and +, and resets', async () => {
    await openRing();
    fireEvent.click(screen.getByRole('button', { name: 'Turn right' }));
    fireEvent.click(screen.getByRole('button', { name: 'Turn down' }));
    await settle();
    expect(lastView()).toEqual({ rx: 24, ry: -5, zoom: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    await settle();
    expect(screen.getByText('89%')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reset the view' }));
    await settle();
    expect(lastView()).toEqual({ rx: 36, ry: -20, zoom: 1 });
  });

  it('zooms by the wheel, and turns by a drag', async () => {
    const stage = await openRing();
    await act(async () => {
      stage.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));
    });
    expect(lastView().zoom).toBe(1.08);
    await act(async () => {
      fireEvent.pointerDown(stage, { pointerId: 1, clientX: 100, clientY: 100, pointerType: 'mouse' });
      fireEvent.pointerMove(stage, { pointerId: 1, clientX: 140, clientY: 100, pointerType: 'mouse' });
      fireEvent.pointerUp(stage, { pointerId: 1, clientX: 140, clientY: 100, pointerType: 'mouse' });
    });
    expect(lastView().ry).toBe(0);
  });

  it('shows it flat on the switch: the flat drawing with its parts as ways in, no turn buttons, the arrows left alone', async () => {
    const stage = await openRing();
    fireEvent.click(screen.getByRole('switch', { name: 'See it flat' }));
    await settle();
    expect(screen.getByRole('switch', { name: 'See it flat' }).getAttribute('aria-checked')).toBe('true');
    expect(stage.getAttribute('aria-label')).toBe('Engraved walnut coasters, Ring. Shown flat.');
    expect(stage.querySelector('canvas')).toBeNull();
    expect(stage.querySelector('svg.cz-drawing')).not.toBeNull();
    expect(screen.getAllByRole('button', { name: /^Edit / }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('group', { name: 'Turn the piece' })).toBeNull();
    expect(stage.textContent).not.toContain('Drag to turn');
    expect(device.disposed).toBe(1);
    const before = device.views.length;
    await key(stage, 'ArrowLeft');
    expect(device.views.length).toBe(before);
    // Zoom still works flat, as the comp's does.
    await key(stage, '+');
    expect(screen.getByText('112%')).toBeTruthy();
  });

  it('tells a phone to pinch', async () => {
    setWidth(390);
    const stage = await openRing();
    expect(stage.textContent).toContain('Drag to turn · pinch to zoom');
  });

  it('lets the stage go when the customer leaves it', async () => {
    await openRing();
    expect(device.made).toBe(1);
    cleanup();
    expect(device.disposed).toBe(1);
  });
});

describe('a device that cannot draw 3D, and a person who asked for less motion', () => {
  it('shows each piece flat, says so in the comp’s words, and keeps the switch locked on', async () => {
    device.webgl = false;
    const stage = await openRing();
    expect(screen.getByRole('status', { name: '' }).textContent).toBe('This device can’t show the 3D view, so you’re seeing each piece flat. It’s the same design we’ll cut.');
    const toggle = screen.getByRole('switch', { name: 'See it flat' });
    expect([toggle.getAttribute('aria-checked'), toggle.getAttribute('aria-disabled')]).toEqual(['true', 'true']);
    fireEvent.click(toggle);
    await settle();
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(stage.querySelector('canvas')).toBeNull();
    expect(device.made).toBe(0);
  });

  it('starts flat for less motion, with the switch free to turn it to 3D', async () => {
    reduce(true);
    const stage = await openRing();
    const toggle = screen.getByRole('switch', { name: 'See it flat' });
    expect([toggle.getAttribute('aria-checked'), toggle.getAttribute('aria-disabled')]).toEqual(['true', 'false']);
    expect(screen.queryByText(/can’t show the 3D view/)).toBeNull();
    fireEvent.click(toggle);
    await settle();
    await settle();
    expect(stage.querySelector('canvas')).not.toBeNull();
  });
});

describe('the gallery’s cards (BC-A2.gallery)', () => {
  const choose = async (): Promise<void> => {
    const stub = stubApi('maker');
    await drawn(<CustomiserEditor api={stub.api} base={stub.ids.coasters} product={{ name: 'Engraved walnut coasters' }} onAddToBasket={() => {}} />);
    await settle();
  };

  it('show each flat piece’s design as a 3D still, drawn in memory at the material’s thickness', async () => {
    await choose();
    const cards = screen.getAllByRole('button', { name: /^Customise the / });
    const stills = cards.map((card) => card.querySelector('img')?.getAttribute('src'));
    expect(stills.every((src) => src?.startsWith('blob:still/') === true)).toBe(true);
    expect(device.stills.length).toBe(cards.length);
    expect(device.stills.every((one) => one.width === 400 && one.height === 300 && one.thickness === 6)).toBe(true);
  });

  it('are drawn flat on a device without WebGL', async () => {
    device.webgl = false;
    await choose();
    const cards = screen.getAllByRole('button', { name: /^Customise the / });
    expect(cards.every((card) => card.querySelector('svg.cz-drawing') !== null || card.querySelector('img:not([src^="blob:still"])') !== null)).toBe(true);
    expect(device.stills).toEqual([]);
  });
});

describe('the phone’s page still scrolls over the stage (BC-F20)', () => {
  it('lets a finger’s up-and-down drag scroll the page, flat or not', () => {
    const css = readFileSync(join(process.cwd(), 'src/browser/editor.css'), 'utf8');
    expect(css).toMatch(/\.cz-stage-3d \{[^}]*touch-action: pan-y;/);
    expect(css).not.toMatch(/\.cz-stage-3d[^{]*\{[^}]*touch-action: none/);
  });
});

describe('the 3D stage under axe', () => {
  it('is clean in 3D, flat and without WebGL, English and Arabic, at a desktop’s width and a phone’s', async () => {
    const failures: string[] = [];
    let swept = 0;
    for (const locale of ['en-US', 'ar-EG'])
      for (const width of [1280, 390])
        for (const state of ['3d', 'flat', 'no3d'] as const) {
          setWidth(width);
          device.webgl = state !== 'no3d';
          document.documentElement.lang = locale;
          await openRing(locale);
          if (state === 'flat') {
            fireEvent.click(screen.getByRole('switch'));
            await settle();
          }
          const results = await axe.run(document.body, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, rules: { 'color-contrast': { enabled: false } } });
          const label = `${locale} · ${String(width)} · ${state}`;
          if (results.passes.length === 0) failures.push(`${label}: axe examined nothing`);
          for (const violation of results.violations.filter((one) => one.impact === 'critical' || one.impact === 'serious')) failures.push(`${label}: ${violation.id} — ${violation.nodes.map((node) => node.html.slice(0, 160)).join(' | ')}`);
          swept += 1;
          cleanup();
        }
    expect(failures, failures.join('\n')).toEqual([]);
    expect(swept).toBe(12);
  }, 120_000);
});
