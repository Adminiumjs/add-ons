// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetWorld, seed, world, type Call } from '../testing/host.tsx';
import { IDS, seedCard, seedShop } from '../testing/rows.ts';
import { showCustomerEditor } from './preview.tsx';

const { default: Customiser } = await import('../customiser/index.tsx');

const at = (base: number, design?: number): void => {
  world.splat = `customiser/${String(base)}`;
  world.search = design === undefined ? { step: 'designs' } : { step: 'designs', design: String(design) };
};
const writes = (kind: Call['kind'], table: string): Call[] => world.calls.filter((call) => call.kind === kind && call.table === table);
const rowOf = (table: string, id: number): Record<string, unknown> => world.tables[table]!.find((one) => one['id'] === id)!;
const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};
const rulesOf = (values: unknown): Record<string, unknown> => JSON.parse((values as Record<string, string>)['rules']!) as Record<string, unknown>;

beforeEach(() => {
  resetWorld();
  seedShop();
  showCustomerEditor(null);
});
afterEach(cleanup);

describe('the designs of a piece (Birch Row)', () => {
  it('lists them in order with their filters and counts, the first one open beside the list', () => {
    at(IDS.coasters);
    render(<Customiser />);
    const list = screen.getByRole('list', { name: 'Designs' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('2 · 1 hidden')).toBeTruthy();
    expect(within(list).getByRole('button', { name: 'Ring' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(list).getByText('hidden')).toBeTruthy();
    expect(within(list).getByRole('button', { name: 'Move Ring up' })).toHaveProperty('disabled', true);
    expect(within(list).getByRole('button', { name: 'Move Monogram down' })).toHaveProperty('disabled', true);
    expect(within(list).getByRole('button', { name: 'Hide Ring' })).toBeTruthy();
    expect(within(list).getByRole('button', { name: 'Show Monogram' })).toBeTruthy();
    // The editor beside it, on Ring.
    expect((screen.getByLabelText('Design name') as HTMLInputElement).value).toBe('Ring');
    for (const tool of ['Add text', 'Add a logo box', 'Add a motif', 'Add a shape']) expect(screen.getByRole('button', { name: tool })).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Parts' })).getByRole('button', { name: 'Your words' })).toBeTruthy();
    expect(screen.getByText('Drag a part to place it, or its corner to resize. Arrow keys move the selected part; Alt + arrows resize it.')).toBeTruthy();
  });

  it('opens another design by its row, keeping it in the address', () => {
    at(IDS.coasters);
    render(<Customiser />);
    fireEvent.click(within(screen.getByRole('list', { name: 'Designs' })).getByRole('button', { name: 'Monogram hidden' }));
    expect(world.navigated.at(-1)).toEqual({ to: '/add-ons/customiser/customiser/11', search: { step: 'designs', design: '52' } });
  });

  it('moves a design down by renumbering the list, and shows or hides one at once', async () => {
    at(IDS.coasters);
    render(<Customiser />);
    fireEvent.click(screen.getByRole('button', { name: 'Move Ring down' }));
    await settle();
    expect(rowOf('ready_designs', 52)['position']).toBe(1);
    expect(rowOf('ready_designs', 51)['position']).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: 'Show Monogram' }));
    await settle();
    expect(rowOf('ready_designs', 52)['state']).toBe('published');
    expect(world.toasts.at(-1)?.title).toBe('“Monogram” shown to customers.');
  });

  it('duplicates a design as a hidden copy with its parts, placed after it', async () => {
    at(IDS.coasters);
    render(<Customiser />);
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate Ring' }));
    await settle();
    const made = writes('create', 'ready_designs')[0]!.values as Record<string, unknown>;
    expect(made).toMatchObject({ app: 'maker', base_id: IDS.coasters, name: 'Ring copy', state: 'draft' });
    const copy = world.tables['ready_designs']!.find((row) => row['name'] === 'Ring copy')!;
    expect(copy['position']).toBe(2);
    expect(rowOf('ready_designs', 52)['position']).toBe(3);
    expect(world.tables['ready_parts']!.filter((row) => row['ready_design_id'] === copy['id']).map((row) => row['code'])).toEqual(['words']);
    expect(world.toasts.at(-1)?.title).toBe('Ring copy is made. It stays hidden until you show it.');
  });

  it('asks before deleting, deletes the design with its parts, and keeps one a customer has made a design from', async () => {
    at(IDS.coasters);
    render(<Customiser />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Monogram' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Delete “Monogram”?')).toBeTruthy();
    expect(within(dialog).getByText('Customers will not see it any more. Orders already placed keep their copy.')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete it' }));
    await settle();
    expect(world.tables['ready_designs']!.map((row) => row['id'])).toEqual([51]);
    // Ring has a customer's design made from it: it stays, and nothing of it goes.
    seed('designs', [{ id: 900, app: 'maker', ready_design_id: 51, base_id: IDS.coasters, state: 'draft' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Ring' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete it' }));
    await settle();
    expect(world.tables['ready_designs']!.map((row) => row['id'])).toEqual([51]);
    expect(writes('remove', 'ready_parts')).toEqual([]);
    expect(world.toasts.at(-1)?.title).toBe('Customers have made designs from “Ring”, so it stays. Hide it instead.');
  });

  it('makes a new design from the base’s areas, hidden, and opens it', async () => {
    at(IDS.coasters);
    render(<Customiser />);
    fireEvent.click(screen.getByRole('button', { name: 'New design' }));
    await settle();
    const made = world.tables['ready_designs']!.at(-1)!;
    expect(made).toMatchObject({ name: 'New design', state: 'draft', position: 3, layouts: null });
    const parts = world.tables['ready_parts']!.filter((row) => row['ready_design_id'] === made['id']);
    expect(parts.map((row) => [row['code'], row['kind'], row['area_id'], row['feature_id']])).toEqual([['logo', 'picture', 21, IDS.logo], ['words', 'text', 22, null]]);
    expect(world.navigated.at(-1)?.search).toEqual({ step: 'designs', design: String(made['id']) });
  });

  it('says so when a piece has no ready-made designs, and starts one from there', () => {
    at(IDS.sign);
    render(<Customiser />);
    expect(screen.getByText('No ready-made designs yet. Shoppers start with the plain piece until you add one.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New design' })).toBeTruthy();
  });
});

describe('the design editor on a piece', () => {
  it('adds a text with the comp’s rules, shows them, and saves exactly that shape', async () => {
    at(IDS.coasters, 51);
    render(<Customiser />);
    fireEvent.click(screen.getByRole('button', { name: 'Add text' }));
    const panel = screen.getByRole('region', { name: 'The part: New text' });
    expect(within(panel).getByText('TEXT')).toBeTruthy();
    expect(within(panel).getByRole('switch', { name: 'Shopper can change this' })).toHaveProperty('checked', true);
    expect(within(panel).getByText('Shoppers can change it within these rules')).toBeTruthy();
    expect(within(panel).getByText('THE RULES')).toBeTruthy();
    expect(within(within(panel).getByRole('group', { name: 'Characters at 7 mm' })).getByText('16')).toBeTruthy();
    expect(within(within(panel).getByRole('group', { name: 'Smallest' })).getByText('4 mm')).toBeTruthy();
    expect(within(within(panel).getByRole('group', { name: 'Largest' })).getByText('11 mm')).toBeTruthy();
    fireEvent.click(within(within(panel).getByRole('group', { name: 'Characters at 7 mm' })).getByRole('button', { name: 'More' }));
    fireEvent.click(within(within(panel).getByRole('group', { name: 'Fonts allowed' })).getByRole('button', { name: 'Caveat' }));
    fireEvent.click(within(within(panel).getByRole('group', { name: 'Finishes allowed' })).getByRole('button', { name: 'Painted white' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save the design' }));
    await settle();
    const made = writes('create', 'ready_parts').at(-1)!.values as Record<string, unknown>;
    expect(made).toMatchObject({ app: 'maker', ready_design_id: 51, code: 'new-text', name: 'New text', kind: 'text', locked: false, side: null, x_mm: 28.5, y_mm: 38, w_mm: 38, h_mm: 19, position: 2 });
    expect(rulesOf(made)).toEqual({ chars: 17, grows: true, unit: 'mm', size: 7, min: 4, max: 11, fonts: ['Manrope', 'Caveat'], font: 'Manrope', finishes: ['engraved', 'paint-white'], finish: 'engraved', placeholder: 'Your words' });
    expect(world.toasts.at(-1)?.title).toBe('Saved. Customers see it next time they choose a design.');
    // Saved: nothing more to write.
    expect(screen.getByRole('button', { name: 'Save the design' })).toHaveProperty('disabled', true);
  });

  it('locks a text so it keeps words of its own, and keeps a shape the studio’s', () => {
    at(IDS.coasters, 51);
    render(<Customiser />);
    fireEvent.click(within(screen.getByRole('group', { name: 'Parts' })).getByRole('button', { name: 'Your words' }));
    const panel = screen.getByRole('region', { name: 'The part: Your words' });
    fireEvent.click(within(panel).getByRole('switch', { name: 'Shopper can change this' }));
    expect(within(panel).getByText('Locked — shoppers see it but can’t change it')).toBeTruthy();
    expect((within(panel).getByLabelText('What it says') as HTMLInputElement).value).toBe('Your words');
    expect(within(panel).queryByText('THE RULES')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add a shape' }));
    const shape = screen.getByRole('region', { name: 'The part: Frame' });
    expect(within(shape).getByRole('switch', { name: 'Shopper can change this' })).toHaveProperty('disabled', true);
    expect(within(shape).getByText('Shapes are always the studio’s')).toBeTruthy();
  });

  it('sets a logo box’s size, how it sits and its colour, and a motif’s choices', () => {
    at(IDS.coasters, 51);
    render(<Customiser />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a logo box' }));
    const logo = screen.getByRole('region', { name: 'The part: Logo box' });
    expect(within(within(logo).getByRole('group', { name: 'Box width' })).getByText('38 mm')).toBeTruthy();
    fireEvent.click(within(within(logo).getByRole('group', { name: 'Box width' })).getByRole('button', { name: 'More' }));
    expect(within(within(logo).getByRole('group', { name: 'Box width' })).getByText('40 mm')).toBeTruthy();
    expect(within(within(logo).getByRole('group', { name: 'How it sits' })).getByRole('button', { name: 'Fit inside' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(within(logo).getByRole('group', { name: 'Colour' })).getByRole('button', { name: 'Full colour (painted finishes)' }));
    expect(within(within(logo).getByRole('group', { name: 'Colour' })).getByRole('button', { name: 'Full colour (painted finishes)' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Add a motif' }));
    const motif = screen.getByRole('region', { name: 'The part: Motif' });
    const motifs = within(motif).getByRole('group', { name: 'Motifs to choose from' });
    expect(within(motifs).getAllByRole('button').map((one) => one.textContent)).toEqual(['Sprig', 'Oak leaf', 'Wheat', 'Moon', 'Star', 'Lamp', 'Heart', 'Books', 'Open book']);
    fireEvent.click(within(motifs).getByRole('button', { name: 'Moon' }));
    expect(within(motifs).getByRole('button', { name: 'Moon' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('moves the selected part by the arrow keys, resizes it with Alt, deletes it, and undoes and redoes each', () => {
    at(IDS.coasters, 51);
    render(<Customiser />);
    world.tables['ready_parts']![0]!['x_mm'] = 10;
    cleanup();
    seed('ready_parts', [{ id: 61, app: 'maker', ready_design_id: 51, code: 'words', name: 'Your words', kind: 'text', locked: false, rules: JSON.stringify({ fonts: ['Manrope'], font: 'Manrope' }), x_mm: 10, y_mm: 50, w_mm: 40, h_mm: 10, position: 1 }]);
    render(<Customiser />);
    fireEvent.click(within(screen.getByRole('group', { name: 'Parts' })).getByRole('button', { name: 'Your words' }));
    const face = screen.getByRole('application', { name: 'The design: Ring' });
    const box = (): string => screen.getAllByRole('button', { name: 'Select Your words' })[0]!.querySelector('rect')!.getAttribute('x')!;
    // A hundredth of the 95 mm piece a press, kept to the tenth of a millimetre.
    fireEvent.keyDown(face, { key: 'ArrowRight' });
    fireEvent.keyDown(face, { key: 'ArrowRight' });
    expect(box()).toBe('12');
    fireEvent.keyDown(face, { key: 'ArrowDown', altKey: true });
    fireEvent.keyDown(face, { key: 'z', ctrlKey: true });
    // One step back takes the resize; the two moves were one gesture.
    expect(box()).toBe('12');
    fireEvent.keyDown(face, { key: 'z', ctrlKey: true });
    expect(box()).toBe('10');
    fireEvent.keyDown(face, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(box()).toBe('12');
    fireEvent.keyDown(face, { key: 'Delete' });
    expect(screen.queryAllByRole('button', { name: 'Select Your words' })).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getAllByRole('button', { name: 'Select Your words' })).toHaveLength(1);
    fireEvent.keyDown(face, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: /The part/ })).toBeNull();
  });

  it('drags a part to place it and by its corner to resize it, as one step each', () => {
    seed('ready_parts', [{ id: 61, app: 'maker', ready_design_id: 51, code: 'words', name: 'Your words', kind: 'text', locked: false, rules: JSON.stringify({ fonts: ['Manrope'], font: 'Manrope' }), x_mm: 10, y_mm: 50, w_mm: 40, h_mm: 10, position: 1 }]);
    at(IDS.coasters, 51);
    render(<Customiser />);
    const face = screen.getByRole('application', { name: 'The design: Ring' }) as unknown as SVGSVGElement;
    // The face drawn 1 px to the millimetre, its view starting 5.7 mm before the piece (a 6 % margin).
    face.getBoundingClientRect = () => ({ left: 0, top: 0, width: 106.4, height: 106.4, right: 106.4, bottom: 106.4, x: 0, y: 0, toJSON: () => ({}) });
    const part = screen.getAllByRole('button', { name: 'Select Your words' })[0]!.querySelector('rect')!;
    fireEvent.pointerDown(part, { clientX: 20, clientY: 60, pointerId: 1 });
    fireEvent.pointerMove(face, { clientX: 25, clientY: 62, pointerId: 1 });
    fireEvent.pointerMove(face, { clientX: 30, clientY: 64, pointerId: 1 });
    fireEvent.pointerUp(face, { pointerId: 1 });
    expect(part.getAttribute('x')).toBe('20');
    expect(part.getAttribute('y')).toBe('54');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getAllByRole('button', { name: 'Select Your words' })[0]!.querySelector('rect')!.getAttribute('x')).toBe('10');
  });
});

describe('the designs of a page (Marlow Press)', () => {
  it('lists each with its front and back, its layouts and palettes, the switch and Edit, and says the order', () => {
    seedCard();
    at(IDS.cards);
    render(<Customiser />);
    const row = within(screen.getByRole('list', { name: 'Designs' })).getAllByRole('listitem')[0]!;
    expect(within(row).getByText('Harbour')).toBeTruthy();
    expect(within(row).getByText('Both sides · 2 layouts · 1 palette')).toBeTruthy();
    expect(within(row).getByRole('switch', { name: 'Shown to customers' })).toHaveProperty('checked', true);
    expect(screen.getByText('1 design · 1 shown')).toBeTruthy();
    expect(screen.getByText('Customers see the designs in this order. Hidden designs stay here for you to finish.')).toBeTruthy();
    fireEvent.click(within(row).getByRole('button', { name: 'Edit Harbour' }));
    expect(world.navigated.at(-1)?.search).toEqual({ step: 'designs', design: '53' });
  });

  it('says what customers see when a page has no designs, and makes one with its paper, a name and a palette', async () => {
    at(IDS.cards);
    render(<Customiser />);
    expect(screen.getByText('No designs for business cards yet')).toBeTruthy();
    expect(screen.getByText('Customers see “Start from blank” and “Send your own file” until you add one.')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'New design' })[0]!);
    await settle();
    const made = world.tables['ready_designs']!.at(-1)!;
    expect(made).toMatchObject({ app: 'printing', name: 'New design', state: 'draft', layouts: JSON.stringify([{ key: 'std', name: 'Standard' }]) });
    const parts = world.tables['ready_parts']!.filter((row) => row['ready_design_id'] === made['id']);
    expect(parts.map((row) => [row['code'], row['side'], row['layout']])).toEqual([['paper', 'front', 'std'], ['name', 'front', 'std'], ['paper', 'back', 'std']]);
    const palette = world.tables['palettes']!.find((row) => row['ready_design_id'] === made['id'])!;
    expect(world.tables['palette_colours']!.filter((row) => row['palette_id'] === palette['id']).map((row) => [row['role'], row['hex']])).toEqual([['paper', '#ffffff'], ['ink', '#191920'], ['accent', '#c0562f']]);
  });
});

describe('the design editor on a page', () => {
  it('draws the header, the tools, the card with its guides and the design’s panel', () => {
    seedCard();
    at(IDS.cards, 53);
    render(<Customiser />);
    expect(screen.getByText('85 × 55 mm · bleed 3 mm · safe line 4 mm')).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Side' })).toBeTruthy();
    for (const tool of ['Add a text part', 'Add a logo box', 'Rectangle', 'Ellipse', 'Line']) expect(within(screen.getByRole('navigation', { name: 'Tools' })).getByRole('button', { name: tool })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Guides' }).getAttribute('aria-pressed')).toBe('true');
    const panel = screen.getByRole('complementary', { name: 'The design' });
    expect((within(panel).getByLabelText('Design name') as HTMLInputElement).value).toBe('Harbour');
    expect(within(panel).getByRole('switch', { name: 'Shown to customers' })).toHaveProperty('checked', true);
    expect((within(panel).getByLabelText('Paper colour of Harbour') as HTMLInputElement).value).toBe('#f4efe6');
    expect(within(within(panel).getByRole('radiogroup', { name: 'Layout choices' })).getAllByRole('radio').map((one) => one.getAttribute('aria-label'))).toEqual(['Edit Logo left', 'Edit Logo top']);
    // The layers of the front in the first layout, top first.
    expect(within(panel).getAllByRole('button', { name: /^(Paper|Logo|Name)$/ }).map((one) => one.textContent)).toEqual(['Name', 'Logo', 'Paper']);
    expect(screen.getByRole('button', { name: 'Preview as a customer' })).toHaveProperty('disabled', true);
    expect(screen.getByText('Preview as a customer opens here once the customer’s editor comes with this add-on.')).toBeTruthy();
  });

  it('sets a text part’s rules for the customer and saves them in points, its limit fixed', async () => {
    seedCard();
    at(IDS.cards, 53);
    render(<Customiser />);
    fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: 'Name' }));
    const panel = screen.getByRole('complementary', { name: 'This part' });
    expect((within(panel).getByLabelText('Across in millimetres') as HTMLInputElement).value).toBe('6');
    expect(within(panel).queryByLabelText('Height in millimetres')).toBeNull();
    expect((within(panel).getByLabelText('Sample words') as HTMLTextAreaElement).value).toBe('Your name');
    expect(within(panel).getByRole('switch', { name: 'Customer can change this' })).toHaveProperty('checked', true);
    fireEvent.change(within(panel).getByLabelText('Up to'), { target: { value: '20' } });
    fireEvent.click(within(within(panel).getByRole('group', { name: 'Sizes allowed (pt)' })).getByRole('button', { name: '15' }));
    fireEvent.click(within(within(panel).getByRole('group', { name: 'Colours from the palette' })).getByRole('button', { name: 'Accent' }));
    fireEvent.click(within(within(panel).getByRole('radiogroup', { name: 'Lines' })).getByRole('radio', { name: 'Several lines' }));
    fireEvent.change(within(panel).getByLabelText('Across in millimetres'), { target: { value: '7.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save the design' }));
    await settle();
    const [id, values] = [writes('update', 'ready_parts').at(-1)!.key, writes('update', 'ready_parts').at(-1)!.values as Record<string, unknown>];
    expect(id).toBe('103');
    expect(values).toMatchObject({ x_mm: 7.5, h_mm: 11.47 });
    expect(rulesOf(values)).toMatchObject({ chars: 20, grows: false, unit: 'pt', sizes: [11, 13], colours: ['ink'], lines: 2 });
    expect(world.toasts.at(-1)?.title).toBe('Saved. Customers see it next time they choose a design.');
  });

  it('warns when a text runs past the safe line', () => {
    seedCard();
    world.tables['ready_parts']!.find((row) => row['id'] === 103)!['x_mm'] = 2;
    at(IDS.cards, 53);
    render(<Customiser />);
    fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: 'Name' }));
    expect(screen.getByText('This runs past the safe line. Make it smaller or move it in.')).toBeTruthy();
  });

  it('locks a picture with the comp’s note, and sets a picture’s kind and fit when it is open', () => {
    seedCard();
    at(IDS.cards, 53);
    render(<Customiser />);
    fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: 'Logo' }));
    const panel = screen.getByRole('complementary', { name: 'This part' });
    expect(within(panel).getByText('Customers upload their own here. It is checked at this box’s size.')).toBeTruthy();
    fireEvent.click(within(within(panel).getByRole('radiogroup', { name: 'Kind of picture' })).getByRole('radio', { name: 'Photo' }));
    fireEvent.click(within(within(panel).getByRole('radiogroup', { name: 'How it fits its box' })).getByRole('radio', { name: 'Fill' }));
    fireEvent.click(within(panel).getByRole('switch', { name: 'Customer can change this' }));
    expect(within(panel).getByText('Customers see this as it is. A padlock shows when they tap it.')).toBeTruthy();
    expect(within(panel).getAllByRole('img', { name: 'Locked' }).length).toBeGreaterThan(0);
  });

  it('adds a palette from the one shown and a layout copied from the one shown, and saves both', async () => {
    seedCard();
    at(IDS.cards, 53);
    render(<Customiser />);
    const panel = screen.getByRole('complementary', { name: 'The design' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Add a palette' }));
    fireEvent.change(within(panel).getByLabelText('Ink colour of Palette 2'), { target: { value: '#000000' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Add a layout from this one' }));
    expect(within(within(panel).getByRole('radiogroup', { name: 'Layout choices' })).getByRole('radio', { name: 'Edit Layout 3' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Save the design' }));
    await settle();
    const palette = world.tables['palettes']!.find((row) => row['name'] === 'Palette 2')!;
    expect(palette).toMatchObject({ app: 'printing', ready_design_id: 53, kind: 'colours', position: 2 });
    expect(world.tables['palette_colours']!.filter((row) => row['palette_id'] === palette['id']).map((row) => [row['role'], row['hex']])).toEqual([['paper', '#f4efe6'], ['ink', '#000000'], ['accent', '#c0562f']]);
    expect(JSON.parse(String(rowOf('ready_designs', 53)['layouts']))).toEqual([{ key: 'left', name: 'Logo left' }, { key: 'top', name: 'Logo top' }, { key: 'layout-3', name: 'Layout 3' }]);
    // The copy has every part of "Logo left" on both sides, with the same codes.
    expect(world.tables['ready_parts']!.filter((row) => row['layout'] === 'layout-3').map((row) => [row['code'], row['side']])).toEqual([['paper', 'front'], ['logo', 'front'], ['name', 'front'], ['paper', 'back']]);
  });

  it('turns to the back and brings a layer forward', () => {
    seedCard();
    at(IDS.cards, 53);
    render(<Customiser />);
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Side' })).getByRole('radio', { name: 'Back' }));
    expect(within(screen.getByRole('complementary')).getAllByRole('button', { name: 'Colour' })).toHaveLength(1);
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Side' })).getByRole('radio', { name: 'Front' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bring Logo forward' }));
    expect(within(screen.getByRole('complementary')).getAllByRole('button', { name: /^(Paper|Logo|Name)$/ }).map((one) => one.textContent)).toEqual(['Logo', 'Name', 'Paper']);
  });

  it('opens the customer’s editor under the preview bar once it is mounted, where nothing reaches a basket', () => {
    seedCard();
    showCustomerEditor(({ onAddToBasket, onSave }) => (
      <div>
        <button type="button" onClick={onAddToBasket}>
          Add to basket
        </button>
        <button type="button" onClick={onSave}>
          Save and come back
        </button>
      </div>
    ));
    at(IDS.cards, 53);
    render(<Customiser />);
    fireEvent.click(screen.getByRole('button', { name: 'Preview as a customer' }));
    expect(screen.getByText('Previewing as a customer')).toBeTruthy();
    expect(screen.getByText('Harbour · nothing here reaches a basket')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add to basket' }));
    expect(world.toasts.at(-1)?.title).toBe('You’re previewing as a customer — nothing goes in a basket.');
    fireEvent.click(screen.getByRole('button', { name: 'Save and come back' }));
    expect(world.toasts.at(-1)?.title).toBe('You’re previewing as a customer — nothing is saved.');
    fireEvent.click(screen.getByRole('button', { name: 'Back to the design editor' }));
    expect(screen.getByRole('complementary', { name: 'The design' })).toBeTruthy();
  });
});

describe('previewing a design as a customer, in the customer’s own editor (MC-E2.preview)', () => {
  it('opens the design as it is drawn now, unsaved changes and all, where nothing reaches a basket and nothing is saved', async () => {
    seedCard();
    const { CustomerEditorPreview } = await import('./customerPreview.tsx');
    showCustomerEditor(CustomerEditorPreview);
    at(IDS.cards, 53);
    render(<Customiser />);
    // An unsaved change: the design's name, which the customer's editor shows.
    fireEvent.change(screen.getByRole('textbox', { name: 'Design name' }), { target: { value: 'Harbour, new' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview as a customer' }));
    await settle();
    await settle();
    expect(screen.getByText('Previewing as a customer')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Harbour, new' })).toBeTruthy();
    fireEvent.change(document.querySelector('#cz-f-name')!, { target: { value: 'Nell Fairweather' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and come back' }));
    // The save does its own work before it says so: waited for, not one tick (a loaded machine misses that).
    expect(await screen.findByText('You’re previewing as a customer — nothing is saved.')).toBeTruthy();
    expect(writes('create', 'designs')).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Back to the design editor' }));
    expect(screen.getByRole('complementary', { name: 'The design' })).toBeTruthy();
  });
});

describe('a reader of the designs', () => {
  it('sees the designs and opens one, with nothing that writes', () => {
    world.cannot.add('update:ready_designs');
    seedCard();
    at(IDS.cards);
    render(<Customiser />);
    expect(screen.queryByRole('button', { name: 'New design' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Duplicate Harbour' })).toBeNull();
    cleanup();
    at(IDS.cards, 53);
    render(<Customiser />);
    expect(screen.queryByRole('button', { name: 'Save the design' })).toBeNull();
    expect(within(screen.getByRole('navigation', { name: 'Tools' })).getByRole('button', { name: 'Add a text part' })).toHaveProperty('disabled', true);
  });
});
