// @vitest-environment jsdom
/**
 * THE FULL EDITOR, AS A CUSTOMER USES IT (Marlow Press: "Start from blank",
 * "Switch to the full editor", MC-C.restyle, MC-C.image, MC-C.use, MC-B4).
 *
 * A printed page laid out by the customer: words, pictures and shapes added
 * from the tools, moved by the keyboard, set in the panel, put in order in
 * the layers, kept as data (`values.placed`), and put in the basket with
 * "Use this design". A design taken from the form keeps its words, both ways.
 */
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlacedPart } from '../rules/index.ts';
import { CustomiserEditor, type CustomiserEditorProps, type DesignData } from './index.ts';
import { drawn, drawsPictures, setWidth, settle, settleUntil } from './testing/render.tsx';
import { stubApi, type Stub } from './testing/stub.ts';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
let restore: (() => void) | null = null;
afterEach(() => {
  cleanup();
  restore?.();
  restore = null;
});
beforeEach(() => setWidth(1280));

function cards(stub: Stub, extra: Partial<CustomiserEditorProps> = {}, base = stub.ids.cards) {
  const onDesignChange = vi.fn();
  const onAddToBasket = vi.fn();
  const view = drawn(<CustomiserEditor api={stub.api} base={base} product={{ name: 'Business cards' }} shop="Marlow Press" sides={2} onAddToBasket={onAddToBasket} onDesignChange={onDesignChange} {...extra} />);
  return { view, onDesignChange, onAddToBasket };
}
const placed = (spy: ReturnType<typeof vi.fn>): PlacedPart[] => ((spy.mock.calls.at(-1)![0] as { design: DesignData }).design.values.placed ?? []);
const tool = (name: string): void => {
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Tools' })).getByRole('button', { name }));
};
const panel = () => within(screen.getByRole('complementary', { name: 'Properties' }));

describe('starting from blank', () => {
  it('opens on a blank page at the page’s size, from the gallery’s own door when the app opens none', async () => {
    const stub = stubApi('printing');
    const { view } = cards(stub, {}, stub.ids.flyers);
    await view;
    fireEvent.click(screen.getByRole('button', { name: /Start from blank/ }));
    await settle();
    expect(screen.getByRole('heading', { name: 'Start from blank' })).toBeTruthy();
    expect(screen.getByText('148 × 210 mm · bleed 3 mm · safe line 4 mm')).toBeTruthy();
    expect(panel().getByText('Nothing selected. Tap something on the card, or add words, an image or a shape from the tools.')).toBeTruthy();
    expect(panel().getByText('Nothing on this side yet.')).toBeTruthy();
    expect(within(screen.getByRole('navigation', { name: 'Tools' })).getAllByRole('button').map((one) => one.getAttribute('aria-label'))).toEqual(['Add words', 'Add an image', 'Rectangle', 'Ellipse', 'Line', 'Guides']);
  });

  it('leaves the door to the app when it opens its own', async () => {
    const stub = stubApi('printing');
    const onStartBlank = vi.fn();
    const { view } = cards(stub, { onStartBlank }, stub.ids.flyers);
    await view;
    fireEvent.click(screen.getByRole('button', { name: /Start from blank/ }));
    expect(onStartBlank).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('heading', { name: 'Start from blank' })).toBeNull();
  });

  it('adds words in the middle of the card, and sets them in the panel: words, font, size, weight, alignment, colour', async () => {
    const stub = stubApi('printing');
    const { view, onDesignChange } = cards(stub, { start: 'blank' });
    await view;
    tool('Add words');
    // New words start in the base's first offered font.
    expect(placed(onDesignChange)).toEqual([{ id: 't1', side: 'front', kind: 'text', name: 'Text', x: 20, y: 25.5, w: 45, h: 3.97, text: 'Your words here', font: 'Manrope', size: 9, weight: 700, align: 'start', colour: 'ink' }]);
    fireEvent.change(panel().getByRole('textbox', { name: 'Words' }), { target: { value: 'Nell Fairweather\nHead baker' } });
    fireEvent.change(panel().getByRole('combobox', { name: 'Font' }), { target: { value: 'Archivo' } });
    expect(placed(onDesignChange)[0]).toMatchObject({ font: 'Archivo' });
    fireEvent.change(panel().getByRole('combobox', { name: 'Font' }), { target: { value: 'Manrope' } });
    fireEvent.change(panel().getByRole('spinbutton', { name: 'Size in points' }), { target: { value: '12' } });
    fireEvent.change(panel().getByRole('combobox', { name: 'Weight' }), { target: { value: '400' } });
    fireEvent.click(panel().getByRole('radio', { name: 'Centre' }));
    fireEvent.click(panel().getByRole('radio', { name: '#1c59e0' }));
    expect(placed(onDesignChange)[0]).toMatchObject({ text: 'Nell Fairweather\nHead baker', font: 'Manrope', size: 12, weight: 400, align: 'center', colour: '#1c59e0', h: 10.58 });
    expect(panel().getByRole('button', { name: 'Text — Nell Fairweather' })).toBeTruthy();
  });

  it('offers the base’s fonts alone: new words start in its first, and a layer keeps the font it has when the base no longer offers it', async () => {
    const stub = stubApi('printing');
    const offered = ['Manrope', 'Archivo', 'Libre Baskerville', 'DM Serif Display'];
    const kept: PlacedPart = { id: 'name', side: 'front', kind: 'text', name: 'Name', x: 6, y: 30, w: 75, h: 6, text: 'Wren Walker', font: 'Cormorant Garamond', size: 13 };
    const { view, onDesignChange } = cards(stub, { start: 'blank' });
    await view;
    tool('Add words');
    expect(placed(onDesignChange)[0]).toMatchObject({ font: 'Manrope' });
    const options = (): string[] => within(panel().getByRole('combobox', { name: 'Font' })).getAllByRole('option').map((one) => one.textContent!);
    expect(options()).toEqual(offered);
    cleanup();
    // A design made before the shop narrowed its fonts: its words keep their font, offered beside the base's.
    const saved = await stub.api.create({ base_id: stub.ids.cards, ready_design_id: null, values: { parts: {}, placed: [kept] } }, null);
    await drawn(<CustomiserEditor api={stub.api} base={stub.ids.cards} product={{ name: 'Business cards' }} design={saved} onAddToBasket={() => {}} />);
    fireEvent.click(panel().getByRole('button', { name: 'Name — Wren Walker' }));
    expect(options()).toEqual([...offered, 'Cormorant Garamond']);
    expect((panel().getByRole('combobox', { name: 'Font' }) as HTMLSelectElement).value).toBe('Cormorant Garamond');
  });

  it('never offers another app’s font: a base naming none, or none still active, offers the starter fonts and its own app’s', async () => {
    const fonts = [
      { id: 1, app: null, starter: true, family: 'Cormorant Garamond', name: 'Cormorant Garamond', file: null },
      { id: 20, app: 'maker', starter: false, family: 'Maker Hand', name: 'Maker Hand', file: null },
      { id: 21, app: 'printing', starter: false, family: 'Marlow Serif', name: 'Marlow Serif', file: null },
    ];
    // Business cards names Manrope, Archivo, Libre Baskerville and DM Serif Display: none of them active here.
    const { view } = cards(stubApi('printing', { fonts }), { start: 'blank' });
    await view;
    tool('Add words');
    const options = (): string[] => within(panel().getByRole('combobox', { name: 'Font' })).getAllByRole('option').map((one) => one.textContent!);
    expect(options()).toEqual(['Cormorant Garamond', 'Marlow Serif']);
  });

  it('moves the part selected by the arrow keys, half a millimetre (Shift: five), aligns it to the page, and Delete removes it', async () => {
    const stub = stubApi('printing');
    const { view, onDesignChange } = cards(stub, { start: 'blank' });
    await view;
    tool('Rectangle');
    const card = screen.getByRole('application', { name: 'Your design, Front' });
    fireEvent.keyDown(card, { key: 'ArrowRight' });
    fireEvent.keyDown(card, { key: 'ArrowDown', shiftKey: true });
    expect(placed(onDesignChange)[0]).toMatchObject({ kind: 'rect', x: 28, y: 20, w: 30, h: 20 });
    fireEvent.keyDown(card, { key: 'ArrowRight', altKey: true });
    expect(placed(onDesignChange)[0]).toMatchObject({ w: 30.5 });
    fireEvent.click(panel().getByRole('button', { name: 'Align to the left edge' }));
    fireEvent.click(panel().getByRole('button', { name: 'Centre down' }));
    expect(placed(onDesignChange)[0]).toMatchObject({ x: 0, y: 17.5 });
    fireEvent.change(panel().getByRole('spinbutton', { name: 'Width in millimetres' }), { target: { value: '40' } });
    expect(placed(onDesignChange)[0]).toMatchObject({ w: 40 });
    fireEvent.keyDown(card, { key: 'Delete' });
    expect(placed(onDesignChange)).toEqual([]);
    // Undo brings it back; Ctrl + Shift + Z takes it away again.
    fireEvent.keyDown(card, { key: 'z', ctrlKey: true });
    expect(placed(onDesignChange)).toHaveLength(1);
    fireEvent.keyDown(card, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(placed(onDesignChange)).toHaveLength(0);
  });

  it('puts parts in order in the layers, and on the back once the card has two sides', async () => {
    const stub = stubApi('printing');
    const { view, onDesignChange } = cards(stub, { start: 'blank' });
    await view;
    tool('Ellipse');
    tool('Line');
    expect(panel().getAllByRole('button', { pressed: false }).filter((one) => one.className.includes('cz-ed-layer-name')).map((one) => one.textContent)).toEqual(['Ellipse']);
    fireEvent.click(panel().getByRole('button', { name: 'Send Line back' }));
    expect(placed(onDesignChange).map((one) => one.kind)).toEqual(['line', 'ellipse']);
    fireEvent.click(screen.getByRole('radio', { name: 'Back' }));
    tool('Add words');
    expect(placed(onDesignChange).map((one) => one.side)).toEqual(['front', 'front', 'back']);
    expect(placed(onDesignChange)[2]!.id).toBe('t1');
  });

  it('takes the design’s two pictures, the logo then the photo, and says when a third will not go', async () => {
    restore = drawsPictures([1800, 1200]);
    const stub = stubApi('printing');
    const { view, onDesignChange } = cards(stub, { start: 'blank' });
    await view;
    const input = document.querySelector<HTMLInputElement>('.cz-ed input[type="file"]')!;
    const send = async (name: string): Promise<void> => {
      tool('Add an image');
      await act(async () => {
        fireEvent.change(input, { target: { files: [new File([PNG], name, { type: 'image/png' })] } });
      });
      await settleUntil(() => document.querySelector('[role="progressbar"]') === null && stub.calls.filter((one) => one.call === 'upload').length > 0);
      await settle();
    };
    await send('shop-front.png');
    expect(input.accept).toBe('.svg,image/svg+xml,.pdf,application/pdf,.png,image/png,.jpg,.jpeg,image/jpeg');
    await send('team.png');
    expect(input.accept).toBe('.png,image/png,.jpg,.jpeg,image/jpeg');
    expect(placed(onDesignChange).map((one) => [one.kind, one.file, one.w, one.h])).toEqual([
      ['image', 'logo_file', 40, 26.7],
      ['image', 'photo_file', 40, 26.7],
    ]);
    expect(stub.calls.filter((one) => one.call === 'upload').map((one) => one.args)).toEqual([
      ['logo_file', 'shop-front.png'],
      ['photo_file', 'team.png'],
    ]);
    tool('Add an image');
    expect(screen.getByText('A design takes two pictures at most: replace one, or remove it first.')).toBeTruthy();
    expect(panel().getByRole('button', { name: 'Replace the image' })).toBeTruthy();
    expect(panel().getByText('PNG · 1800 × 1200 px · 1 KB')).toBeTruthy();
  });

  it('asks for something on the card first, then saves the design as data and hands it to the basket', async () => {
    const stub = stubApi('printing');
    const { view, onAddToBasket } = cards(stub, { start: 'blank' });
    await view;
    fireEvent.click(screen.getByRole('button', { name: 'Use this design' }));
    await settle();
    expect(screen.getByText('Add something to the card first.')).toBeTruthy();
    expect(onAddToBasket).not.toHaveBeenCalled();
    tool('Add words');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Use this design' }));
    });
    await settle();
    const saved = stub.calls.find((one) => one.call === 'create')!.args[0] as DesignData;
    expect(saved.ready_design_id).toBeNull();
    expect(saved.values.parts).toEqual({});
    expect(saved.values.placed?.[0]).toMatchObject({ kind: 'text', text: 'Your words here' });
    expect(onAddToBasket).toHaveBeenCalledTimes(1);
  });
});

describe('a ready-made design taken past its form', () => {
  it('keeps the words both ways: into the full editor, and back to the form with the moves lost', async () => {
    const stub = stubApi('printing');
    const { view, onDesignChange } = cards(stub);
    await view;
    fireEvent.click(screen.getByRole('button', { name: /^Customise the Harbour design/ }));
    await settle();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Nell Fairweather' } });
    fireEvent.click(screen.getByRole('button', { name: /Switch to the full editor/ }));
    const card = screen.getByRole('application', { name: 'Your design, Front' });
    fireEvent.click(panel().getByRole('button', { name: /^Name — Nell Fairweather/ }));
    fireEvent.keyDown(card, { key: 'ArrowDown', shiftKey: true });
    expect(placed(onDesignChange).find((one) => one.id === 'name')).toMatchObject({ text: 'Nell Fairweather', y: 33 });
    // Back: the form no longer fits it, and says so.
    fireEvent.click(screen.getByRole('button', { name: 'Back to the form' }));
    expect(screen.getByRole('heading', { name: 'This design is in the full editor' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add to basket' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Go back to the form' }));
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Nell Fairweather');
    const values = (onDesignChange.mock.calls.at(-1)![0] as { design: DesignData }).design.values;
    expect(values.placed).toBeUndefined();
    expect(values.parts['name']).toEqual({ text: 'Nell Fairweather' });
  });

  it('opens a saved design made from a blank page in the full editor, and one made from a design on its form', async () => {
    const stub = stubApi('printing');
    const blank = await stub.api.create({ base_id: stub.ids.cards, ready_design_id: null, values: { parts: {}, placed: [{ id: 't1', side: 'front', kind: 'text', x: 6, y: 6, w: 40, h: 4, text: 'Mine' }] } }, null);
    await drawn(<CustomiserEditor api={stub.api} base={stub.ids.cards} product={{ name: 'Business cards' }} design={blank} onAddToBasket={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Start from blank' })).toBeTruthy();
    cleanup();
    const moved = await stub.api.create({ base_id: stub.ids.cards, ready_design_id: stub.ids.harbour, values: { parts: {}, placed: [{ id: 'name', side: 'front', kind: 'text', x: 6, y: 6, w: 40, h: 4, text: 'Nell' }] } }, null);
    await drawn(<CustomiserEditor api={stub.api} base={stub.ids.cards} product={{ name: 'Business cards' }} design={moved} onAddToBasket={() => {}} />);
    expect(screen.getByRole('heading', { name: 'This design is in the full editor' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open the full editor' }));
    expect(screen.getByRole('heading', { name: 'Harbour, made your own' })).toBeTruthy();
  });
});

describe('on a phone', () => {
  it('puts the tools at the foot and opens the panel as a sheet, “Properties”', async () => {
    setWidth(390);
    const stub = stubApi('printing');
    const { view } = cards(stub, { start: 'blank' });
    await view;
    expect(screen.queryByRole('complementary', { name: 'Properties' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Zoom' })).toBeNull();
    tool('Add words');
    fireEvent.click(screen.getByRole('button', { name: 'Properties' }));
    const sheet = screen.getByRole('dialog', { name: 'Properties' });
    expect(within(sheet).getByRole('textbox', { name: 'Words' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
