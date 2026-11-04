// @vitest-environment jsdom
/**
 * THE SHOP'S SCREENS UNDER AXE, IN THE TEST HOST.
 *
 * Every state of the set-up page (each step, for a page, a piece with and
 * without its outline, a kit; the page with no base; the new-base dialog;
 * the outline's "we removed" note and a refusal) and both record panels,
 * swept in English and in Arabic (right to left), in the light and the dark
 * look and at 1024 and 390 wide, as the forms add-on's sweep is.
 *
 * WHAT THIS CAN AND CANNOT SEE. The host's parts here are the plainest
 * elements that do each part's job, and no stylesheet is loaded, so axe
 * reads the screens' own structure — names, roles, labels, the ties
 * between a field and its error, headings, lists — and never colour: the
 * contrast rule is off, and the look and the width change nothing it reads.
 * The same sweep over the built add-on in a real dashboard (contrast
 * included) is the engine's e2e, as `forms-a11y.spec.ts` does for forms.
 *
 * EVERY SWEEP ASSERTS ITS OWN `passes`: an axe run that analysed nothing
 * reports zero violations too. Every critical or serious finding fails.
 */
import axe from 'axe-core';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { resetWorld, seed, world } from './testing/host.tsx';
import { IDS, seedShop } from './testing/rows.ts';

const { default: Customiser } = await import('./customiser/index.tsx');
const { default: Product } = await import('../panels/product.tsx');
const { default: Line } = await import('../panels/line.tsx');

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const BLOCKING = new Set(['critical', 'serious']);
const STEPS = ['base', 'areas', 'designs', 'fonts', 'prices', 'preview', 'publish'] as const;

type Look = { theme: 'light' | 'dark'; locale: 'en-US' | 'ar-EG'; width: 1024 | 390 };
const LOOKS: Look[] = (['light', 'dark'] as const).flatMap((theme) => (['en-US', 'ar-EG'] as const).flatMap((locale) => ([1024, 390] as const).map((width) => ({ theme, locale, width }))));

interface State {
  label: string;
  draw: () => ReactNode;
  before?: () => void;
  after?: () => Promise<void>;
}

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};
const page = (base: number | null, step?: string): (() => ReactNode) => () => {
  world.splat = base === null ? 'customiser' : `customiser/${String(base)}`;
  world.search = step === undefined ? {} : { step };
  return <Customiser />;
};

const STATES: State[] = [
  ...[IDS.coasters, IDS.sign, IDS.cards, IDS.nook].flatMap((base) => STEPS.map((step) => ({ label: `base ${String(base)} · ${step}`, draw: page(base, step) }))),
  { label: 'no base yet', before: () => void (world.tables['bases'] = []), draw: page(null) },
  {
    label: 'the new-base dialog, its name refused',
    draw: page(IDS.coasters),
    after: async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /New base|قاعدة جديدة/ })[0]!);
      fireEvent.click(screen.getByRole('button', { name: /Make it|إنشاء/ }));
      await settle();
    },
  },
  {
    label: 'an outline cleaned by Adminium',
    before: () => void (world.upload = (_t, _k, _c, file) => ({ file: 'file-9', name: file.name, size: file.size, type: 'image/svg+xml', removed: ['a script'] })),
    draw: page(IDS.sign),
    after: async () => {
      fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [new File(['<svg width="10mm" height="10mm"/>'], 'sign.svg', { type: 'image/svg+xml' })] } });
      await settle();
    },
  },
  {
    label: 'an outline refused',
    draw: page(IDS.sign),
    after: async () => {
      fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [new File(['x'], 'sign.png', { type: 'image/png' })] } });
      await settle();
    },
  },
  {
    label: 'an area opened for editing, both words and a logo',
    before: () => {
      const area = world.tables['base_areas']!.find((one) => one['id'] === 22)!;
      area['takes'] = 'both';
    },
    draw: page(IDS.coasters, 'areas'),
    after: async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /^(Your words)/ })[0]!);
      await settle();
    },
  },
  { label: 'the product panel', draw: () => <Product connectionId="c1" table="t" row="r" linked={String(IDS.coasters)} /> },
  { label: 'the product panel, not set up', draw: () => <Product connectionId="c1" table="t" row="r" linked={null} /> },
  {
    label: 'the order line panel',
    before: () => {
      seed('designs', [{ id: 91, app: 'maker', ready_design_id: 51, base_id: IDS.coasters, values: JSON.stringify({ format: 1, parts: { words: { text: 'The Hartleys' } } }), state: 'ordered', updated_at: '2026-08-05T15:01:00Z' }]);
      seed('design_versions', [{ id: 95, app: 'maker', design_id: 91, version: 2, proof_file: 'f' }]);
    },
    draw: () => <Line connectionId="c1" table="t" row="r" linked="91" />,
  },
  { label: 'the order line panel, no design', draw: () => <Line connectionId="c1" table="t" row="r" linked={null} /> },
];

afterEach(cleanup);

describe('the shop’s screens under axe', () => {
  it('are clean in every state, light and dark, English and Arabic, 1024 and 390 wide', async () => {
    const failures: string[] = [];
    let swept = 0;
    for (const look of LOOKS) {
      for (const state of STATES) {
        resetWorld();
        seedShop();
        world.locale = look.locale;
        document.documentElement.lang = look.locale;
        document.documentElement.dir = look.locale === 'ar-EG' ? 'rtl' : 'ltr';
        document.documentElement.setAttribute('data-theme', look.theme);
        Object.defineProperty(window, 'innerWidth', { value: look.width, configurable: true });
        state.before?.();
        render(<main>{state.draw()}</main>);
        await state.after?.();
        const results = await axe.run(document.body, { runOnly: { type: 'tag', values: TAGS }, rules: { 'color-contrast': { enabled: false } } });
        const label = `${look.theme} · ${look.locale} · ${String(look.width)} · ${state.label}`;
        if (results.passes.length === 0) failures.push(`${label}: axe examined nothing`);
        for (const violation of results.violations.filter((one) => BLOCKING.has(one.impact ?? ''))) failures.push(`${label}: ${String(violation.impact)} ${violation.id} — ${violation.help}\n  ${violation.nodes.slice(0, 3).map((node) => node.html.slice(0, 160)).join('\n  ')}`);
        swept += 1;
        cleanup();
      }
    }
    expect(failures, failures.join('\n\n')).toEqual([]);
    expect(swept).toBe(LOOKS.length * STATES.length);
  }, 600_000);
});
