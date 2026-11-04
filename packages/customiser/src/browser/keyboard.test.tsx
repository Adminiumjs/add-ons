// @vitest-environment jsdom
/**
 * THE CUSTOMER'S EDITOR WITHOUT A MOUSE.
 *
 * Every part is reached by Tab and worked by the keys a person expects, in
 * the order it is read; every overlay takes the focus, keeps Tab inside it,
 * closes on Escape and gives the focus back to what opened it; the focus is
 * always drawn. What the editor's own tests already walk by keyboard (a part
 * on the drawing to its field, the checks to their parts, undo and redo, the
 * save dialog's Escape, the 3D stage's arrow keys) is not walked again here.
 */
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { forgetStills } from '../three/PieceView.tsx';
import { Stage3d, type RendererLike } from '../three/stage3d.ts';
import { CustomiserEditor, heldDesign, YourDesigns, type CustomiserApi, type HeldDesign } from './index.ts';
import type { CatalogueRows } from './catalogue.ts';
import { drawn, setWidth, settle, settleUntil } from './testing/render.tsx';
import { stubApi, type Stub } from './testing/stub.ts';
import { glbOf, SIGN, WALL } from '../testing/glb.ts';

vi.mock('../three/load.ts', async (original) => {
  const real = await original<typeof import('../three/load.ts')>();
  return {
    ...real,
    hasWebGL: () => true,
    loadThree: async () => ({
      ...(await import('../three/stage3d.ts')),
      still: async () => 'blob:still/1',
      makeStage: () => {
        const renderer: RendererLike = { domElement: document.createElement('canvas'), setPixelRatio: () => {}, setSize: () => {}, render: () => {}, dispose: () => {} };
        return new Stage3d(renderer);
      },
    }),
  };
});

const HERE = dirname(fileURLToPath(import.meta.url));
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]';

/** What Tab reaches, in the order it reaches it: no element taken out of the order, none behind a hidden ancestor. */
function tabOrder(root: ParentNode = document.body): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((one) => one.getAttribute('tabindex') !== '-1' && one.closest('[aria-hidden="true"], [hidden], [inert]') === null);
}
const press = async (target: Element | Document, key: string, extra: Record<string, unknown> = {}): Promise<void> => {
  await act(async () => {
    fireEvent.keyDown(target, { key, ...extra });
  });
  await settle();
};
const ring = async (stub: Stub = stubApi('maker'), locale = 'en-US'): Promise<Stub> => {
  await drawn(<CustomiserEditor api={stub.api} base={stub.ids.coasters} product={{ name: 'Engraved walnut coasters' }} locale={locale} onAddToBasket={() => {}} />);
  await act(async () => {
    fireEvent.click(document.querySelector('[data-screen="choose"] .cz-card')!);
  });
  await settle();
  await settle();
  return stub;
};

beforeEach(() => {
  setWidth(1280);
  forgetStills();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('reached by Tab, in the order it is read', () => {
  it('takes no part out of the reading order, and names every stop', async () => {
    await ring();
    const stops = tabOrder();
    expect(stops.length).toBeGreaterThan(10);
    // No stop jumps the queue: a positive tabindex reorders the page for keyboard users only.
    expect(document.querySelectorAll('[tabindex]:not([tabindex="0"]):not([tabindex="-1"])')).toHaveLength(0);
    // Every made-up control is a stop and has a name; every stop has a name a screen reader says.
    for (const one of document.querySelectorAll('[role="button"], [role="radio"], [role="switch"], [role="slider"]')) expect(tabOrder().includes(one as HTMLElement), one.outerHTML.slice(0, 120)).toBe(true);
    for (const one of stops) expect((one.getAttribute('aria-label') ?? one.getAttribute('aria-labelledby') ?? one.textContent ?? one.getAttribute('title') ?? '').trim() !== '' || one.id !== '' || one.closest('label') !== null, one.outerHTML.slice(0, 120)).toBe(true);
  });

  it('reads the fields before the button that adds the design to the basket, and the drawing’s parts before both', async () => {
    await ring();
    // The parts are reached on the flat drawing: "See it flat" is itself a stop, worked by the keyboard.
    const flat = screen.getByRole('switch', { name: 'See it flat' });
    expect(tabOrder()).toContain(flat);
    fireEvent.click(flat);
    await settle();
    const stops = tabOrder();
    const at = (element: Element): number => stops.indexOf(element as HTMLElement);
    const part = screen.getByRole('button', { name: 'Edit Your words' });
    const words = screen.getByLabelText('Your words');
    const add = document.querySelector('.cz-add')!;
    expect(at(part)).toBeGreaterThan(-1);
    expect(at(words)).toBeGreaterThan(at(part));
    expect(at(add)).toBeGreaterThan(at(words));
  });

  it('opens the upload from its button: the file picker itself is never a stop of its own', async () => {
    await ring();
    const opened = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    const button = screen.getByRole('button', { name: 'Upload your logo' });
    expect(tabOrder()).toContain(button);
    for (const input of document.querySelectorAll('input[type="file"]')) {
      expect(input.getAttribute('tabindex')).toBe('-1');
      expect(input.getAttribute('aria-hidden')).toBe('true');
    }
    button.focus();
    fireEvent.click(button);
    expect(opened).toHaveBeenCalledTimes(1);
  });
});

describe('a row of choices', () => {
  it('moves along and chooses with the arrow keys, Home and End', async () => {
    await ring();
    const finishes = screen.getByRole('radiogroup', { name: /^Finish for/ });
    const radios = within(finishes).getAllByRole('radio');
    expect(radios.length).toBeGreaterThan(1);
    radios[0]!.focus();
    await press(radios[0]!, 'ArrowRight');
    expect(document.activeElement).toBe(within(finishes).getAllByRole('radio')[1]);
    expect(within(finishes).getAllByRole('radio')[1]!.getAttribute('aria-checked')).toBe('true');
    await press(document.activeElement!, 'End');
    expect(within(finishes).getAllByRole('radio').at(-1)!.getAttribute('aria-checked')).toBe('true');
    await press(document.activeElement!, 'ArrowDown');
    expect(within(finishes).getAllByRole('radio')[0]!.getAttribute('aria-checked')).toBe('true');
    await press(document.activeElement!, 'ArrowUp');
    expect(within(finishes).getAllByRole('radio').at(-1)!.getAttribute('aria-checked')).toBe('true');
    await press(document.activeElement!, 'Home');
    expect(within(finishes).getAllByRole('radio')[0]!.getAttribute('aria-checked')).toBe('true');
  });

  it('goes the reading way on a right-to-left page: the next choice is to the left', async () => {
    await ring(stubApi('maker'), 'ar-EG');
    const group = document.querySelectorAll('[role="radiogroup"]')[1] ?? document.querySelector('[role="radiogroup"]')!;
    const radios = [...group.querySelectorAll<HTMLElement>('[role="radio"]')];
    expect(radios.length).toBeGreaterThan(1);
    radios[0]!.focus();
    await press(radios[0]!, 'ArrowLeft');
    expect(document.activeElement).toBe(group.querySelectorAll('[role="radio"]')[1]);
    await press(document.activeElement!, 'ArrowRight');
    expect(document.activeElement).toBe(group.querySelectorAll('[role="radio"]')[0]);
  });

  it('switches a kit between Assembled and Pieces by the arrow keys', async () => {
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
    const glb = glbOf([SIGN, WALL]);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (String(url).endsWith('nook.glb') ? new Response(glb, { status: 200 }) : new Response(null, { status: 404 }))));
    await drawn(<CustomiserEditor api={api} base={stub.ids.nook} product={{ name: 'The Little Bookshop' }} onAddToBasket={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /^Customise the Corner shop design/ }));
    for (let i = 0; i < 4; i += 1) await settle();
    const modes = screen.getByRole('radiogroup', { name: 'How to show the kit' });
    const assembled = within(modes).getByRole('radio', { name: 'Assembled' });
    expect(tabOrder()).toContain(assembled);
    assembled.focus();
    await press(assembled, 'ArrowRight');
    expect(within(screen.getByRole('radiogroup', { name: 'How to show the kit' })).getByRole('radio', { name: 'Pieces' }).getAttribute('aria-checked')).toBe('true');
    expect(document.querySelector('[data-kit-pieces]')).not.toBeNull();
    await press(document.activeElement!, 'ArrowLeft');
    expect(within(screen.getByRole('radiogroup', { name: 'How to show the kit' })).getByRole('radio', { name: 'Assembled' }).getAttribute('aria-checked')).toBe('true');
  });
});

describe('every overlay', () => {
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const open = (): Element | null => document.querySelector('[role="dialog"], [role="alertdialog"]');

  it('keeps Tab inside the save dialog, round both ways', async () => {
    await ring();
    const opener = document.querySelector<HTMLElement>('.cz-save')!;
    opener.focus();
    fireEvent.click(opener);
    await settle();
    const dialog = screen.getByRole('dialog');
    const stops = tabOrder(dialog);
    expect(stops.length).toBeGreaterThan(1);
    expect(dialog.contains(document.activeElement)).toBe(true);
    stops.at(-1)!.focus();
    await press(document, 'Tab');
    expect(document.activeElement).toBe(stops[0]);
    await press(document, 'Tab', { shiftKey: true });
    expect(document.activeElement).toBe(stops.at(-1));
  });

  it('closes on Escape, the one-colour sheet among them, and gives the focus back', async () => {
    await ring();
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const opener = screen.getByRole('button', { name: 'Upload your logo' });
    opener.focus();
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File([PNG], 'pinfold-sign.png', { type: 'image/png' })] } });
    });
    await settleUntil(() => open() !== null);
    expect(open()!.contains(document.activeElement)).toBe(true);
    await press(document, 'Escape');
    expect(open()).toBeNull();
    // The upload button is gone now the logo is in: the focus is on the logo's field, never lost to the page.
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement?.closest('.cz-field, .cz-fields, [id^="cz-f-"]')).not.toBeNull();
  });

  it('closes the full-screen preview on Escape, and the delete question in Your designs', async () => {
    const stub = stubApi('printing');
    await drawn(<CustomiserEditor api={stub.api} base={stub.ids.cards} product={{ name: 'Business cards' }} shop="Marlow Press" sides={2} onAddToBasket={() => {}} />);
    fireEvent.click(screen.getAllByRole('button', { name: /Harbour/ })[0]!);
    await settle();
    const full = document.querySelector<HTMLElement>('.cz-sheet-tools .cz-icon-button')!;
    full.focus();
    fireEvent.click(full);
    await settle();
    expect(open()).not.toBeNull();
    await press(document, 'Escape');
    expect(open()).toBeNull();
    expect(document.activeElement).toBe(full);
    cleanup();

    const maker = stubApi('maker');
    const held: HeldDesign[] = [heldDesign(await maker.api.create({ base_id: maker.ids.coasters, ready_design_id: maker.ids.twoLines, values: { parts: { top: { text: 'Iris & Tom' } } } }, 'iris@example.com'), 'iris@example.com')!];
    await drawn(<YourDesigns api={maker.api} held={held} onOpen={() => {}} onOrder={() => {}} onForget={() => {}} />);
    const bin = document.querySelector<HTMLElement>('.cz-design-row .cz-icon-button')!;
    expect(tabOrder()).toContain(bin);
    bin.focus();
    fireEvent.click(bin);
    await settle();
    const asking = screen.getByRole('alertdialog');
    expect(asking.contains(document.activeElement)).toBe(true);
    await press(document, 'Escape');
    expect(open()).toBeNull();
    expect(document.activeElement).toBe(bin);
    expect(document.querySelectorAll('.cz-design-row')).toHaveLength(1);
  });
});

describe('the focus, drawn', () => {
  it('is outlined on everything in the editor, and a rule that takes the outline away draws a ring instead', () => {
    const css = readFileSync(join(HERE, 'editor.css'), 'utf8');
    expect(css).toMatch(/\.cz :focus-visible \{\s*outline: 3px solid var\(--cz-accent\);/);
    const removed = [...css.matchAll(/([^{}]+)\{[^}]*outline:\s*(?:none|0)\b[^}]*\}/g)].map((match) => match[1]!.trim());
    expect(removed.length).toBeGreaterThan(0);
    for (const selector of removed) {
      const name = /\.cz-[\w-]+/.exec(selector)?.[0];
      expect(name, selector).toBeDefined();
      // The part draws its own ring when focused: a live part by `:focus-visible`, a locked one by its lock ring, put on when it takes the focus.
      const ring = new RegExp(`${name!.replace(/[-]/g, '\\-')}:focus-visible`);
      const lockRing = name === '.cz-part-locked' && /onFocus: \(\) => onLock\?\.\(item\.code\)/.test(readFileSync(join(HERE, 'ui/Drawing.tsx'), 'utf8')) && /\.cz-part-lock-on \{\s*stroke:/.test(css);
      expect(ring.test(css) || lockRing, `${selector} hides the focus and draws nothing in its place`).toBe(true);
    }
  });
});
