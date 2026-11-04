// @vitest-environment jsdom
/**
 * RIGHT TO LEFT, EVERYWHERE A PERSON READS.
 *
 * An Arabic page lays out from the right because every rule says where a
 * thing goes by the reading start and end (`inline-start`, `inset-inline-end`,
 * `ms-2`), never by left and right. Two kinds of check hold that:
 *
 * - THE SOURCES: the editor's stylesheet names no left or right except on a
 *   line that must (a transform has no logical form; a canvas has its own
 *   coordinates), and each such line says why in a comment just above it; no
 *   screen writes a physical class or an inline style.
 * - THE SCREENS, DRAWN IN ARABIC: the customer's editor in both looks (the
 *   gallery, the fields, the 3D stage's chrome for a piece, a kit and a
 *   printed item, the saved dialog, the full editor), the shop's set-up step
 *   by step and both record panels, each drawn with the page right to left:
 *   the editor's root says `dir="rtl"`, a back arrow turns to point the way
 *   back, the design itself stays left to right (it is the thing made), and
 *   nothing drawn carries a physical class or a style naming left or right.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { forgetStills } from './three/PieceView.tsx';
import { Stage3d, type RendererLike } from './three/stage3d.ts';
import { resetWorld, world } from './pages/testing/host.tsx';
import { IDS, seedCard, seedShop } from './pages/testing/rows.ts';
import { CustomiserEditor } from './browser/index.ts';
import { drawn, setWidth, settle } from './browser/testing/render.tsx';
import { stubApi } from './browser/testing/stub.ts';

vi.mock('./three/load.ts', async (original) => {
  const real = await original<typeof import('./three/load.ts')>();
  return {
    ...real,
    hasWebGL: () => true,
    loadThree: async () => ({
      ...(await import('./three/stage3d.ts')),
      still: async () => 'blob:still/1',
      makeStage: () => {
        const renderer: RendererLike = { domElement: document.createElement('canvas'), setPixelRatio: () => {}, setSize: () => {}, render: () => {}, dispose: () => {} };
        return new Stage3d(renderer);
      },
    }),
  };
});

const { default: Customiser } = await import('./pages/customiser/index.tsx');
const { default: Product } = await import('./panels/product.tsx');
const { default: Line } = await import('./panels/line.tsx');

const HERE = dirname(fileURLToPath(import.meta.url));
const walk = (dir: string): string[] => readdirSync(dir).flatMap((entry) => (statSync(join(dir, entry)).isDirectory() ? walk(join(dir, entry)) : [join(dir, entry)]));
const SCREENS = walk(HERE).filter((file) => /\.tsx$/.test(file) && !file.includes('.test.') && !file.includes('/testing/'));

/** A class that places by left and right (Tailwind's physical spellings), where a logical one exists. */
const PHYSICAL_CLASS = /(?:^|\s)(?:-?m[lr]-\S+|p[lr]-\S+|-?left-\S+|-?right-\S+|text-left|text-right|rounded-[lr](?:-\S+)?|rounded-[tb][lr](?:-\S+)?|border-[lr](?:-\S+)?|float-(?:left|right)|origin-(?:\S+-)?(?:left|right))(?=\s|$)/;
/** A CSS declaration that names a physical side. */
const PHYSICAL_RULE = /(?:^|[;{\s])(?:left|right|margin-left|margin-right|padding-left|padding-right|border-left[\w-]*|border-right[\w-]*|float)\s*:|text-align\s*:\s*(?:left|right)|translateX|scaleX|\b(?:left|right)\s+(?:top|bottom|center)\b/;

describe('the sources', () => {
  it('the editor’s stylesheet names a side only where it must, and says why just above', () => {
    const lines = readFileSync(join(HERE, 'browser/editor.css'), 'utf8').split('\n');
    const physical = lines.map((line, at) => ({ line, at })).filter(({ line }) => PHYSICAL_RULE.test(line));
    expect(physical.length).toBeGreaterThan(0);
    for (const { line, at } of physical) {
      const above = lines.slice(Math.max(0, at - 3), at).join('\n');
      expect(above, `editor.css:${String(at + 1)} ${line.trim()} has no comment saying why`).toMatch(/\/\*[^]*\*\//);
      // A transform or a mirror only, and only under a page's direction or in an animation paired with its twin.
      expect(line, `editor.css:${String(at + 1)}`).toMatch(/transform:\s*(?:translateX|scaleX)/);
    }
  });

  it('no screen writes a physical class or an inline style', () => {
    expect(SCREENS.length).toBeGreaterThan(30);
    for (const file of SCREENS) {
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toMatch(/\sstyle=\{/);
      for (const match of text.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) expect(match[1] ?? match[2] ?? '', file).not.toMatch(PHYSICAL_CLASS);
    }
  });

  it('the class check catches a physical class and passes a logical one', () => {
    expect('flex ml-2 gap-1').toMatch(PHYSICAL_CLASS);
    expect('absolute right-0').toMatch(PHYSICAL_CLASS);
    expect('text-left').toMatch(PHYSICAL_CLASS);
    expect('flex ms-2 me-auto text-start end-0 rounded-s-lg border-e').not.toMatch(PHYSICAL_CLASS);
    expect('  margin-left: 4px;').toMatch(PHYSICAL_RULE);
    expect('  margin-inline-start: 4px;').not.toMatch(PHYSICAL_RULE);
  });
});

/** Everything drawn on the page that would place by left or right. */
function physicalOnPage(): string[] {
  const found: string[] = [];
  for (const element of document.body.querySelectorAll('*')) {
    const style = element.getAttribute('style') ?? '';
    if (/(?:^|;)\s*(?:left|right|margin-left|margin-right|padding-left|padding-right|float)\s*:/.test(style)) found.push(`style ${style} on ${element.outerHTML.slice(0, 120)}`);
    const classes = element.getAttribute('class') ?? '';
    if (PHYSICAL_CLASS.test(classes)) found.push(`class ${classes}`);
  }
  return found;
}

describe('the customer’s editor in Arabic', () => {
  beforeEach(() => {
    setWidth(1280);
    forgetStills();
  });
  afterEach(cleanup);

  const open = async (app: 'maker' | 'printing', base: (ids: ReturnType<typeof stubApi>['ids']) => number, then?: () => Promise<void>, extra: Record<string, unknown> = {}): Promise<void> => {
    const stub = stubApi(app);
    await drawn(<CustomiserEditor api={stub.api} base={base(stub.ids)} product={{ name: 'P' }} shop="S" locale="ar-EG" onAddToBasket={() => {}} onBack={() => {}} {...extra} />);
    await then?.();
    await settle();
  };
  const first = async (): Promise<void> => {
    await act(async () => {
      fireEvent.click(document.querySelector('[data-screen="choose"] .cz-card')!);
    });
    await settle();
    await settle();
    // The state is the fields, or the sweep would read the gallery again.
    if (document.querySelector('[data-screen="fill"]') === null) throw new Error(`not on the fields: ${document.querySelector('[data-screen]')?.getAttribute('data-screen') ?? 'nothing'}`);
  };

  const STATES: [string, () => Promise<void>][] = [
    ['the gallery, with its way back', () => open('maker', (ids) => ids.coasters)],
    ['a piece’s fields and its 3D stage', () => open('maker', (ids) => ids.coasters, first)],
    ['a kit’s stage', () => open('maker', (ids) => ids.nook, first)],
    ['a printed item’s stage', () => open('maker', (ids) => ids.keyring, first)],
    ['the print look’s fields and sheet', () => open('printing', (ids) => ids.cards, first)],
    [
      'the saved dialog',
      () =>
        open('maker', (ids) => ids.coasters, async () => {
          await first();
          fireEvent.click(document.querySelector('.cz-save')!);
          await settle();
        }),
    ],
    ['the full editor', () => open('printing', (ids) => ids.cards, undefined, { start: 'blank', sides: 2 })],
  ];

  for (const [label, draw] of STATES)
    it(`lays out from the right: ${label}`, async () => {
      await draw();
      const root = document.querySelector('.cz')!;
      expect(root.getAttribute('dir')).toBe('rtl');
      expect(physicalOnPage()).toEqual([]);
      // A way back points back, which on a right-to-left page is to the right.
      for (const back of document.querySelectorAll('.cz-back svg, .cz-ed-head .cz-icon-button svg.lucide-arrow-left')) expect(back.getAttribute('class'), label).toContain('cz-flip');
      // The design is the thing made: drawn left to right whatever the page.
      for (const drawing of document.querySelectorAll('svg.cz-drawing')) expect(drawing.getAttribute('direction'), label).toBe('ltr');
    });

  it('has a way back in the gallery, turned for the page', async () => {
    await open('maker', (ids) => ids.coasters);
    expect(document.querySelectorAll('.cz-back svg.cz-flip')).toHaveLength(1);
    expect(screen.queryByText('Choose a design')).toBeNull();
  });
});

describe('the shop’s screens in Arabic', () => {
  beforeEach(() => {
    resetWorld();
    seedShop();
    seedCard();
    forgetStills();
    world.locale = 'ar-EG';
    document.documentElement.lang = 'ar-EG';
    document.documentElement.dir = 'rtl';
  });
  afterEach(() => {
    cleanup();
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = 'en-US';
  });

  const page = (base: number, step: string): ReactNode => {
    world.splat = `customiser/${String(base)}`;
    world.search = { step };
    return <Customiser />;
  };
  const STEPS = ['base', 'areas', 'designs', 'fonts', 'prices', 'preview', 'publish'];
  const STATES: [string, () => ReactNode][] = [
    ...[IDS.coasters, IDS.cards, IDS.nook].flatMap((base) => STEPS.map((step): [string, () => ReactNode] => [`base ${String(base)} · ${step}`, () => page(base, step)])),
    ['the product panel', () => <Product connectionId="c1" table="t" row="r" linked={String(IDS.coasters)} />],
    ['the order line panel, no design', () => <Line connectionId="c1" table="t" row="r" linked={null} />],
  ];

  it('draw nothing placed by left or right, step by step and on both panels', async () => {
    const found: string[] = [];
    for (const [label, draw] of STATES) {
      render(<main>{draw()}</main>);
      for (let i = 0; i < 3; i += 1) await settle();
      expect(document.body.textContent?.trim().length, label).toBeGreaterThan(0);
      for (const one of physicalOnPage()) found.push(`${label}: ${one}`);
      cleanup();
    }
    expect(found).toEqual([]);
  }, 120_000);
});
