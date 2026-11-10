// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Refused, resetWorld, seed, world, type Call } from '../testing/host.tsx';
import { IDS, seedShop } from '../testing/rows.ts';
import { PAGE_FILES } from './starter.ts';

const { default: Customiser } = await import('../customiser/index.tsx');

const at = (base: number, step?: string): void => {
  world.splat = `customiser/${String(base)}`;
  world.search = step === undefined ? {} : { step };
};
const writes = (kind: Call['kind'], table: string): Call[] => world.calls.filter((call) => call.kind === kind && call.table === table);
const row = (table: string, id: number): Record<string, unknown> => world.tables[table]!.find((one) => one['id'] === id)!;
const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};
const svgFile = (name: string, body = '<svg xmlns="http://www.w3.org/2000/svg" width="120mm" height="80mm"><path d="M0 0h10v10z"/></svg>', size?: number): File => {
  const file = new File([body], name, { type: 'image/svg+xml' });
  if (size !== undefined) Object.defineProperty(file, 'size', { value: size });
  return file;
};

beforeEach(() => {
  resetWorld();
  seedShop();
});
afterEach(cleanup);

describe('the set-up page', () => {
  it('draws the seven steps of the comp, the current one marked, the base named as its product with where it stands', () => {
    at(IDS.coasters);
    render(<Customiser />);
    const steps = within(screen.getByRole('navigation', { name: 'Steps' })).getAllByRole('button');
    expect(steps.map((step) => step.textContent)).toEqual(['✓Base', '✓Areas', '✓Ready-made designs', '✓Fonts & finishes', '5Prices', '6Preview', '7Publish'].map((one, index) => (index === 0 ? '1Base' : one)));
    expect(steps[0].getAttribute('aria-current')).toBe('step');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Engraved walnut coasters');
    expect(screen.getByText('Offered for customising')).toBeTruthy();
    expect(screen.getByText('Bases / 11')).toBeTruthy();
    // The picker names each base as its product, and says which are not offered yet.
    expect([...(screen.getByLabelText('Product') as HTMLSelectElement).options].map((option) => option.textContent)).toEqual(['Engraved walnut coasters', 'Slate house sign — not offered yet', 'Business cards — not offered yet', 'The Little Bookshop — not offered yet']);
  });

  it('moves between steps by the stepper, Next and the step before, keeping the base in the address', () => {
    at(IDS.coasters);
    render(<Customiser />);
    fireEvent.click(screen.getByRole('button', { name: 'Next: Areas' }));
    expect(world.navigated.at(-1)).toEqual({ to: '/add-ons/customiser/customiser/11', search: { step: 'areas' } });
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Steps' })).getByRole('button', { name: /Publish/ }));
    expect(world.navigated.at(-1)).toEqual({ to: '/add-ons/customiser/customiser/11', search: { step: 'publish' } });
    fireEvent.change(screen.getByLabelText('Product'), { target: { value: String(IDS.cards) } });
    expect(world.navigated.at(-1)).toEqual({ to: '/add-ons/customiser/customiser/13', search: {} });
  });

  it('opens the first base with no base in the address, and says so when the base is not there', () => {
    world.splat = 'customiser';
    render(<Customiser />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Engraved walnut coasters');
    cleanup();
    at(999);
    render(<Customiser />);
    expect(screen.getByText('This could not be loaded')).toBeTruthy();
  });

  it('starts with a base when there is none, made for an app, offering the starter fonts and the app’s finishes', async () => {
    world.tables['bases'] = [];
    world.splat = 'customiser';
    render(<Customiser />);
    expect(screen.getByText('Nothing is set up for customising yet')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'New base' })[0]!);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Make it' }));
    await settle();
    expect(within(dialog).getByRole('alert').textContent).toContain('product’s name');
    expect(within(dialog).getByRole('radio', { name: /A kit of pieces/ })).toHaveProperty('disabled', false);
    expect(within(dialog).getByRole('radio', { name: /A 3D-printed item/ })).toHaveProperty('disabled', false);
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Oak serving board' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Make it' }));
    await settle();
    const made = writes('create', 'bases')[0]!.values as Record<string, unknown>;
    expect(made).toMatchObject({ name: 'Oak serving board', kind: 'piece', app: 'maker', width_mm: 95, height_mm: 95, state: 'draft' });
    expect(JSON.parse(made['offered'] as string)).toEqual({ fonts: ['Manrope', 'Caveat', 'Oswald'], finishes: ['engraved', 'paint-white', 'paint-black'] });
    expect(world.navigated.at(-1)?.to).toBe(`/add-ons/customiser/customiser/${String(world.nextId)}`);
  });
});

describe('a new base, for the app the reader may make one for', () => {
  it('as Print’s owner, who reads none of Maker’s tables: makes it for the print shop, with no choice to make', async () => {
    world.closed.add('maker:options');
    at(IDS.cards);
    render(<Customiser />);
    fireEvent.click(screen.getByRole('button', { name: 'New base' }));
    const dialog = screen.getByRole('dialog');
    await settle();
    expect(within(dialog).queryByLabelText('For')).toBeNull();
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Letterpress cards' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Make it' }));
    await settle();
    expect(writes('create', 'bases')[0]?.values).toMatchObject({ name: 'Letterpress cards', app: 'printing' });
  });

  it('offers both shops to a reader of both, the maker shop first', async () => {
    at(IDS.cards);
    render(<Customiser />);
    fireEvent.click(screen.getByRole('button', { name: 'New base' }));
    await settle();
    const choice = within(screen.getByRole('dialog')).getByLabelText('For') as HTMLSelectElement;
    expect([...choice.options].map((option) => option.value)).toEqual(['maker', 'printing']);
    expect(choice.value).toBe('maker');
  });
});

describe('step 1, a flat piece', () => {
  it('shows its outline, material and thickness, and the piece drawn flat at its size', () => {
    at(IDS.coasters);
    render(<Customiser />);
    expect(screen.getByText('A flat piece')).toBeTruthy();
    expect(screen.getByText('SVG · up to 2 MB')).toBeTruthy();
    expect(screen.getByText('95 × 95 mm')).toBeTruthy();
    expect(screen.getByText('95 × 95 × 6 mm')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Engraved walnut coasters, drawn flat' })).toBeTruthy();
    // The materials the shop's other pieces are cut from, as chips.
    expect(screen.getByRole('button', { name: 'Slate · 5 mm' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Walnut · 6 mm' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Slate · 5 mm' }));
    expect(writes('update', 'bases').at(-1)).toMatchObject({ key: String(IDS.coasters), values: { material: 'Slate', thickness_mm: 5 } });
  });

  it('waits for the outline before drawing a preview', () => {
    at(IDS.sign);
    render(<Customiser />);
    expect(screen.getByText('the 3D preview appears once the outline is in')).toBeTruthy();
    expect(screen.getByText("Upload the piece's outline as an SVG. We clean it as it comes in.")).toBeTruthy();
  });

  it('refuses what is not an SVG or is over 2 MB before sending it, in the comp’s words', async () => {
    at(IDS.sign);
    render(<Customiser />);
    const input = screen.getByLabelText('Upload the outline');
    fireEvent.change(input, { target: { files: [new File(['x'], 'sign.png', { type: 'image/png' })] } });
    await settle();
    expect(screen.getByRole('alert').textContent).toBe('sign.png: That isn’t an SVG.');
    fireEvent.change(input, { target: { files: [svgFile('sign.svg', undefined, 2 * 1024 * 1024 + 1)] } });
    await settle();
    expect(screen.getByRole('alert').textContent).toBe('sign.svg: That file is over 2 MB.');
    expect(writes('upload', 'bases')).toEqual([]);
  });

  it('stores the outline through Adminium, takes its size from the file, and says what was removed only when Adminium removed something', async () => {
    at(IDS.sign);
    render(<Customiser />);
    world.upload = () => ({ id: 'file-77', mime: 'image/svg+xml', removed: ['<script>', 'onclick', 'inkscape:*'] });
    fireEvent.change(screen.getByLabelText('Upload the outline'), { target: { files: [svgFile('house-sign.svg')] } });
    await settle();
    expect(writes('upload', 'bases')[0]).toMatchObject({ key: String(IDS.sign), values: { column: 'outline_file', name: 'house-sign.svg' } });
    // The upload saved the row with the file; the size read from the drawing is the one save that follows.
    expect(row('bases', IDS.sign)['outline_file']).toBe('file-77');
    expect(writes('update', 'bases').at(-1)).toMatchObject({ values: { width_mm: 120, height_mm: 80 } });
    expect(writes('update', 'bases').at(-1)?.values).not.toHaveProperty('outline_file');
    expect(screen.getByText('We removed 3 things that can’t be used in an outline')).toBeTruthy();
    expect(screen.getByText('Taken out: a script · a script that runs on onclick · the drawing program’s notes. The shape itself is unchanged.')).toBeTruthy();
    expect(world.toasts.at(-1)?.title).toBe('Outline cleaned and saved.');
  });

  it('shows Adminium’s own refusal when it reads the file and will not keep it', async () => {
    at(IDS.sign);
    render(<Customiser />);
    world.upload = () => {
      throw new Refused('FILE_KIND_REFUSED', 'That file is not an SVG drawing.');
    };
    fireEvent.change(screen.getByLabelText('Upload the outline'), { target: { files: [svgFile('house-sign.svg')] } });
    await settle();
    expect(screen.getByRole('alert').textContent).toBe('house-sign.svg: That file is not an SVG drawing.');
    expect(screen.queryByText(/We removed/)).toBeNull();
  });
});

describe('step 1, a flat page and the kinds that come with 3D', () => {
  it('draws a page with its trim, bleed and safe line, and the comp’s legend and figure', () => {
    at(IDS.cards);
    render(<Customiser />);
    expect(screen.getByText('85 × 55 mm + 3 mm bleed')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'The page at 85 × 55 mm, with the trim, the bleed and the safe line' })).toBeTruthy();
    expect(screen.getAllByRole('list').map((list) => list.textContent)).toContain('━ Trim▬ Bleed 3 mm┅ Safe line 4 mm');
    expect(screen.getByRole('radio', { name: 'Both sides' }).getAttribute('aria-checked')).toBe('true');
  });

  it('saves a page’s size when its field is left with a new figure, and its sides', () => {
    at(IDS.cards);
    render(<Customiser />);
    const width = screen.getByLabelText('Trim width');
    fireEvent.change(width, { target: { value: '90' } });
    fireEvent.blur(width);
    expect(writes('update', 'bases').at(-1)).toMatchObject({ values: { width_mm: 90 } });
    fireEvent.click(screen.getByRole('radio', { name: 'One side' }));
    expect(writes('update', 'bases').at(-1)).toMatchObject({ values: { sides: 1 } });
  });

  it('keeps the shop’s one-colour line, and the other settings, in its settings, saved when a field is left', () => {
    at(IDS.coasters);
    render(<Customiser />);
    fireEvent.click(screen.getByRole('button', { name: 'Shop settings' }));
    const line = screen.getByLabelText('One-colour line') as HTMLInputElement;
    expect(line.value).toBe('50');
    fireEvent.change(line, { target: { value: '62' } });
    fireEvent.blur(line);
    expect(writes('update', 'settings').at(-1)).toMatchObject({ key: '1', values: { one_colour_threshold: 62 } });
    expect(row('settings', 1)['one_colour_threshold']).toBe(62);
    // One row for every shop app on the install, and said so; no unit to choose, which nothing reads yet.
    expect(screen.getByText('These settings cover every shop app on this Adminium.')).toBeTruthy();
    expect(screen.queryByLabelText('Sizes shown in')).toBeNull();
    const dpi = screen.getByLabelText('Sharpness a picture needs at its printed size');
    fireEvent.change(dpi, { target: { value: '200' } });
    fireEvent.blur(dpi);
    expect(row('settings', 1)['min_dpi']).toBe(200);
  });

  it('shows the settings to a role that may read and not change them, and says so', () => {
    world.cannot.add('update:settings');
    at(IDS.coasters);
    render(<Customiser />);
    fireEvent.click(screen.getByRole('button', { name: 'Shop settings' }));
    expect(screen.getByText('Your role may read these settings, not change them.')).toBeTruthy();
    expect((screen.getByLabelText('One-colour line') as HTMLInputElement).disabled).toBe(true);
  });

  it('clears a base’s rounded corners back to none when the field is emptied, and keeps a figure field that may not be empty', () => {
    for (const base of [IDS.cards, IDS.coasters]) {
      seed('bases', world.tables['bases']!.map((one) => (one['id'] === base ? { ...one, corner_mm: 2 } : one)));
      at(base);
      render(<Customiser />);
      const corner = screen.getByLabelText('Rounded corners') as HTMLInputElement;
      expect(corner.value).toBe('2');
      fireEvent.change(corner, { target: { value: '' } });
      fireEvent.blur(corner);
      expect(writes('update', 'bases').at(-1), String(base)).toMatchObject({ key: String(base), values: { corner_mm: null } });
      expect(row('bases', base)['corner_mm']).toBeNull();
      expect(corner.value).toBe('');
      cleanup();
    }
    world.calls.length = 0;
    at(IDS.cards);
    render(<Customiser />);
    const width = screen.getByLabelText('Trim width');
    fireEvent.change(width, { target: { value: '' } });
    fireEvent.blur(width);
    expect(writes('update', 'bases')).toEqual([]);
  });

  it('sets a kit up from its pieces and its model, not an outline (the kit’s own tests: Kit.test.tsx)', () => {
    at(IDS.nook);
    render(<Customiser />);
    expect(screen.getByText('The pieces')).toBeTruthy();
    expect(screen.getByText('The assembled model')).toBeTruthy();
    expect(screen.queryByText('This kind is set up with the 3D preview')).toBeNull();
    expect(screen.queryByLabelText('Upload the outline')).toBeNull();
  });
});

describe('step 2, areas', () => {
  it('lists the areas with what each takes, and draws each on the face as a button', () => {
    at(IDS.coasters, 'areas');
    render(<Customiser />);
    const face = screen.getByRole('application', { name: 'The piece, with its areas' });
    expect(within(face).getAllByRole('button').map((one) => one.getAttribute('aria-label'))).toEqual(['Select Your logo', 'Select Your words']);
    expect(screen.getByRole('button', { name: /Your logo.*A logo/ }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: /Your words.*Words · required/ })).toBeTruthy();
  });

  it('draws a standard rectangle with Enter, and Esc leaves draw mode, all from the keyboard', async () => {
    at(IDS.coasters, 'areas');
    render(<Customiser />);
    const face = screen.getByRole('application');
    fireEvent.click(screen.getByRole('button', { name: 'Draw a rectangle' }));
    expect(screen.getByRole('button', { name: 'Draw a rectangle' }).getAttribute('aria-pressed')).toBe('true');
    expect(document.activeElement).toBe(face);
    expect(screen.getByText(/Or press Enter for a standard size\. Esc cancels\./)).toBeTruthy();
    fireEvent.keyDown(face, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Draw a rectangle' }).getAttribute('aria-pressed')).toBe('false');
    expect(writes('create', 'base_areas')).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Draw an oval' }));
    fireEvent.keyDown(face, { key: 'Enter' });
    await settle();
    const made = writes('create', 'base_areas')[0]!.values as Record<string, unknown>;
    expect(made).toMatchObject({ app: 'maker', base_id: IDS.coasters, code: 'new-oval-area', name: 'New oval area', shape: 'oval', x_mm: 24, y_mm: 36, w_mm: 47.5, h_mm: 17, takes: 'words', required: false, position: 3 });
    expect(JSON.parse(made['rules'] as string)).toMatchObject({ chars: 20, grows: true, unit: 'mm', fonts: ['Manrope', 'Caveat'] });
    expect(world.toasts.at(-1)?.title).toBe('Oval drawn. Give it a name.');
    // The new area opens, its name field focused, ready to be named.
    expect(document.activeElement).toBe(screen.getByLabelText('Name'));
  });

  it('moves the selected area with the arrows, five steps with Shift, and resizes it with Alt', () => {
    at(IDS.coasters, 'areas');
    render(<Customiser />);
    const face = screen.getByRole('application');
    fireEvent.keyDown(face, { key: 'ArrowRight' });
    expect(writes('update', 'base_areas').at(-1)).toMatchObject({ key: '21', values: { x_mm: 29.5, y_mm: 13.5, w_mm: 38, h_mm: 36 } });
    fireEvent.focus(within(face).getByRole('button', { name: 'Select Your words' }));
    fireEvent.keyDown(face, { key: 'ArrowUp', shiftKey: true });
    expect(writes('update', 'base_areas').at(-1)).toMatchObject({ key: '22', values: { y_mm: 52.5 } });
    fireEvent.keyDown(face, { key: 'ArrowRight', altKey: true });
    expect(writes('update', 'base_areas').at(-1)).toMatchObject({ key: '22', values: { w_mm: 73 } });
  });

  it('draws an area by dragging across the face, and draws nothing from a click', async () => {
    at(IDS.coasters, 'areas');
    render(<Customiser />);
    const face = screen.getByRole('application') as unknown as SVGSVGElement;
    face.getBoundingClientRect = () => ({ left: 0, top: 0, width: 106.4, height: 106.4, right: 106.4, bottom: 106.4, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    fireEvent.click(screen.getByRole('button', { name: 'Draw a rectangle' }));
    fireEvent.pointerDown(face, { clientX: 10, clientY: 10 });
    fireEvent.pointerUp(face, { clientX: 10, clientY: 10 });
    expect(writes('create', 'base_areas')).toEqual([]);
    expect(world.toasts.at(-1)?.title).toBe('Drag across the piece to draw it.');
    fireEvent.click(screen.getByRole('button', { name: 'Draw a rectangle' }));
    fireEvent.pointerDown(face, { clientX: 15.7, clientY: 15.7 });
    fireEvent.pointerMove(face, { clientX: 55.7, clientY: 35.7 });
    fireEvent.pointerUp(face, { clientX: 55.7, clientY: 35.7 });
    await settle();
    expect(writes('create', 'base_areas')[0]?.values).toMatchObject({ shape: 'rect', x_mm: 10, y_mm: 10, w_mm: 40, h_mm: 20 });
  });

  it('keeps what an area takes, its rules and its priced feature together as its form changes', () => {
    at(IDS.coasters, 'areas');
    render(<Customiser />);
    fireEvent.click(screen.getByRole('button', { name: /^Your words/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'Both' }));
    const both = writes('update', 'base_areas').at(-1)!.values as Record<string, unknown>;
    expect(both).toMatchObject({ takes: 'both', feature_id: IDS.logo });
    expect(JSON.parse(both['rules'] as string)).toMatchObject({ chars: 24, alsoLogo: { picture: 'logo', file: 'logo_file' } });
    fireEvent.click(within(screen.getByRole('group', { name: 'Characters' })).getByRole('button', { name: 'More' }));
    expect(JSON.parse((writes('update', 'base_areas').at(-1)!.values as Record<string, string>)['rules']!)).toMatchObject({ chars: 25 });
    fireEvent.click(screen.getByRole('button', { name: 'Caveat' }));
    expect(JSON.parse((writes('update', 'base_areas').at(-1)!.values as Record<string, string>)['rules']!)).toMatchObject({ fonts: ['Manrope'] });
    fireEvent.click(screen.getByRole('button', { name: 'Painted white' }));
    expect(JSON.parse((writes('update', 'base_areas').at(-1)!.values as Record<string, string>)['rules']!)).toMatchObject({ finishes: ['engraved', 'paint-white'] });
    fireEvent.click(screen.getByRole('switch'));
    expect(writes('update', 'base_areas').at(-1)).toMatchObject({ values: { required: false } });
    fireEvent.click(screen.getByRole('radio', { name: 'Words' }));
    expect(writes('update', 'base_areas').at(-1)).toMatchObject({ values: { takes: 'words', feature_id: null } });
  });

  it('removes an area and says orders keep theirs', async () => {
    at(IDS.coasters, 'areas');
    render(<Customiser />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove this area' }));
    await settle();
    expect(writes('remove', 'base_areas')).toMatchObject([{ key: '21' }]);
    expect(world.toasts.at(-1)?.title).toBe('Area removed. Designs already ordered keep it.');
  });

  it('says what to draw when there are no areas, and offers a page its two sides', () => {
    at(IDS.cards, 'areas');
    render(<Customiser />);
    expect(screen.getByText('No areas yet')).toBeTruthy();
    expect(screen.getByRole('application', { name: 'The page, with its areas' })).toBeTruthy();
    expect(screen.getByText('Areas sit on a side of the page, inside the safe line.')).toBeTruthy();
  });
});

describe('step 6, opened by the customer’s editor (BC-D7)', () => {
  it('opens the customising screen as shoppers get it, the shop’s designs in it, where nothing reaches a basket', async () => {
    at(IDS.coasters, 'preview');
    render(<Customiser />);
    fireEvent.click(screen.getByRole('button', { name: "Open the shopper's screen" }));
    await settle();
    await settle();
    expect(screen.getByText('Previewing as a shopper')).toBeTruthy();
    // The customer's own editor, on the base as the set-up holds it: its shown designs, then one filled in.
    fireEvent.click(screen.getByRole('button', { name: /^Customise the Ring design/ }));
    await settle();
    expect(screen.getByRole('heading', { name: 'Make it yours' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Your words'), { target: { value: 'The Pinfold' } });
    fireEvent.click(document.querySelector('.cz-add')!);
    await settle();
    expect(screen.getByText('Previewing — nothing goes in a real basket.')).toBeTruthy();
    fireEvent.click(document.querySelector('.cz-save')!);
    // The save does its own work before it says so: waited for, not one tick (a loaded machine misses that).
    expect(await screen.findByText('Previewing — saving is switched off here.')).toBeTruthy();
    expect(writes('create', 'designs')).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Back to set-up' }));
    expect(screen.getByRole('button', { name: "Open the shopper's screen" })).toBeTruthy();
  });
});

describe('step 4, fonts and finishes', () => {
  it('lists the starter fonts with their open licence, what this base offers, and switches one on or off', () => {
    at(IDS.coasters, 'fonts');
    render(<Customiser />);
    expect(screen.getByText('2 offered')).toBeTruthy();
    expect(screen.getAllByText('Open licence')).toHaveLength(3);
    expect(screen.getByText('SIL Open Font License 1.1 · smallest 4 mm · Used in 1 design')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Offer Oswald' })).toHaveProperty('checked', false);
    fireEvent.click(screen.getByRole('switch', { name: 'Offer Oswald' }));
    expect(JSON.parse((writes('update', 'bases').at(-1)!.values as Record<string, string>)['offered']!)).toEqual({ fonts: ['Manrope', 'Caveat', 'Oswald'], finishes: ['engraved', 'paint-white'] });
    fireEvent.click(screen.getByRole('switch', { name: 'Offer Painted white' }));
    expect(JSON.parse((writes('update', 'bases').at(-1)!.values as Record<string, string>)['offered']!)).toMatchObject({ finishes: ['engraved'] });
  });

  it('draws each sample in its own font: every font with a file is loaded into the page, once, from the dashboard’s files', async () => {
    for (const font of world.tables['fonts']!) font['file'] = font['id'] === 73 ? null : `file_01JX${'0'.repeat(20)}${String(font['id'])}`;
    const made: { family: string; source: string }[] = [];
    const added: string[] = [];
    class Face {
      readonly family: string;
      constructor(family: string, source: string) {
        this.family = family;
        made.push({ family, source });
      }
      load(): Promise<Face> {
        return Promise.resolve(this);
      }
    }
    vi.stubGlobal('FontFace', Face);
    const had = Object.getOwnPropertyDescriptor(document, 'fonts');
    Object.defineProperty(document, 'fonts', { configurable: true, value: { add: (face: Face) => added.push(face.family) } });
    try {
      at(IDS.coasters, 'fonts');
      render(<Customiser />);
      await settle();
      // Oswald has no file yet: nothing to load, and its sample stays in the fallback until it has one.
      const byFamily = <T extends { family: string }>(list: T[]): T[] => [...list].sort((a, b) => a.family.localeCompare(b.family));
      expect(byFamily(made)).toEqual([
        { family: 'Caveat', source: 'url("/api/v1/files/file_01JX0000000000000000000072/content") format("woff2")' },
        { family: 'Manrope', source: 'url("/api/v1/files/file_01JX0000000000000000000071/content") format("woff2")' },
      ]);
      expect([...added].sort()).toEqual(['Caveat', 'Manrope']);
      expect(screen.getByRole('img', { name: 'Engraved walnut coasters, in Caveat' }).querySelector('text')!.getAttribute('font-family')).toBe('Caveat');
    } finally {
      vi.unstubAllGlobals();
      if (had === undefined) delete (document as { fonts?: unknown }).fonts;
      else Object.defineProperty(document, 'fonts', had);
    }
  });

  it('carries the licence line by the upload, and refuses a renamed file before sending it', async () => {
    at(IDS.coasters, 'fonts');
    render(<Customiser />);
    expect(screen.getByText('Only upload fonts your licence lets you use on products you sell.')).toBeTruthy();
    expect(screen.getByText('.woff2 · up to 2 MB')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Upload a font (WOFF2)'), { target: { files: [new File(['wOFFxxxx'], 'harbour.woff2')] } });
    await settle();
    expect(screen.getByRole('alert').textContent).toBe('harbour.woff2: That file doesn’t look like a WOFF2 font. It may have been renamed.');
    expect(writes('create', 'fonts')).toEqual([]);
  });

  it('keeps an uploaded font as the shop’s own, named from its file, and takes the row back if Adminium refuses the file', async () => {
    at(IDS.coasters, 'fonts');
    render(<Customiser />);
    const woff2 = (): File => new File([new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0, 1])], 'harbour-script_Regular.woff2', { type: 'font/woff2' });
    fireEvent.change(screen.getByLabelText('Upload a font (WOFF2)'), { target: { files: [woff2()] } });
    await settle();
    expect(writes('create', 'fonts')[0]?.values).toMatchObject({ app: 'maker', family: 'Harbour Script', name: 'Harbour Script', starter: false, active: true });
    expect(writes('upload', 'fonts')[0]).toMatchObject({ values: { column: 'file' } });
    // The upload saved the font's row with its file; the page makes no second save.
    expect(writes('update', 'fonts')).toEqual([]);
    expect(world.tables['fonts']!.at(-1)?.['file']).toMatch(/^file-/);
    expect(world.toasts.at(-1)?.title).toBe('Font added. Shoppers see it once you switch it on.');
    world.upload = () => {
      throw new Refused('FILE_KIND_REFUSED', 'That is not a WOFF2 font.');
    };
    fireEvent.change(screen.getByLabelText('Upload a font (WOFF2)'), { target: { files: [woff2()] } });
    await settle();
    expect(writes('remove', 'fonts')).toHaveLength(1);
    expect(screen.getByRole('alert').textContent).toBe('harbour-script_Regular.woff2: That is not a WOFF2 font.');
  });

  it('tells a page and a printed item where their colours come from', () => {
    at(IDS.cards, 'fonts');
    render(<Customiser />);
    expect(screen.getByText(/A printed page takes its colours from the design/)).toBeTruthy();
  });
});

describe('step 5, prices', () => {
  it('edits the priced features, keeps no price, and says where the price is set', async () => {
    at(IDS.coasters, 'prices');
    render(<Customiser />);
    expect(screen.getByText('Its price is the product’s own option, named “logo”, set in the shop app.')).toBeTruthy();
    expect(screen.getByText('Shoppers see: Your own logo')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('A new priced feature'), { target: { value: 'Engrave both sides' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add a priced feature' }));
    await settle();
    expect(writes('create', 'features')[0]?.values).toEqual({ app: 'maker', code: 'engrave-both-sides', name: 'Engrave both sides', active: true });
    // No figure is written anywhere: the price is the app's.
    expect(world.calls.filter((call) => call.table === 'features').flatMap((call) => Object.keys((call.values ?? {}) as object))).not.toContain('price');
  });
});

describe('step 5, the app’s prices', () => {
  it('shows each feature at the price the app’s own option row holds, in the install’s currency', () => {
    at(IDS.coasters, 'prices');
    world.currency = 'GBP';
    seed('maker:options', [
      { id: 1, feature_id: IDS.logo, price: '1.50', cost: '0.40' },
      { id: 2, feature_id: null, price: '3.95', cost: '3.00' },
    ]);
    // The app's role reads the link and the price only: a read asking for the cost would be refused.
    world.unreadable['maker:options'] = ['cost'];
    render(<Customiser />);
    expect(screen.getByText('+£1.50 a piece: the product’s own option “logo”, set in the shop app.')).toBeTruthy();
    expect(screen.getByText('Shoppers see: Your own logo · +£1.50 a piece')).toBeTruthy();
  });

  it('shows the feature without a price when the reader may not read the app’s options, and asks for nothing', () => {
    at(IDS.coasters, 'prices');
    seed('maker:options', [{ id: 1, feature_id: IDS.logo, price: '1.50' }]);
    world.closed.add('maker:options');
    render(<Customiser />);
    expect(screen.getByText('Its price is the product’s own option, named “logo”, set in the shop app.')).toBeTruthy();
    expect(screen.getByText('Shoppers see: Your own logo')).toBeTruthy();
    expect(screen.queryByText(/£|1\.50/)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the feature without a price when the app keeps no option for it', () => {
    at(IDS.coasters, 'prices');
    seed('maker:options', [{ id: 1, feature_id: 999, price: '9.00' }]);
    render(<Customiser />);
    expect(screen.getByText('Its price is the product’s own option, named “logo”, set in the shop app.')).toBeTruthy();
  });
});

describe('the starter fonts’ files', () => {
  /** Adminium's page-files route as a fetch: each path answered with the status `answer` gives it. */
  const serve = (answer: (path: string) => number) => {
    const fake = vi.fn(async (url: string) => {
      const path = url.slice(PAGE_FILES.length);
      const status = url.startsWith(PAGE_FILES) ? answer(path) : 404;
      return new Response(status !== 200 ? 'Not found' : path.endsWith('.woff2') ? new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0, 1]) : 'Copyright', { status });
    });
    vi.stubGlobal('fetch', fake);
    return fake;
  };
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adds each by itself, fetched from beside the page into its own row, once the set-up opens on an Adminium that serves them', async () => {
    const fetched = serve(() => 200);
    at(IDS.coasters);
    render(<Customiser />);
    await settle();
    expect(fetched).toHaveBeenCalledWith(`${PAGE_FILES}fonts/Manrope.woff2`, { credentials: 'same-origin' });
    expect(writes('upload', 'fonts').map((call) => [call.key, (call.values as { name: string }).name])).toEqual([
      ['72', 'Caveat.woff2'],
      ['71', 'Manrope.woff2'],
      ['73', 'Oswald.woff2'],
    ]);
    // Each starter row took its file; no font row was made.
    for (const id of [71, 72, 73]) expect(row('fonts', id)['file']).toMatch(/^file-/);
    expect(writes('create', 'fonts')).toEqual([]);
    // Added on the way in, on the base's first step: nothing to say.
    expect(world.toasts.map((toast) => toast.title)).not.toContain('Starter fonts added. Shoppers see each one once you switch it on.');
  });

  it('reads the set-up again once when they are in, not once for every font', async () => {
    serve(() => 200);
    at(IDS.coasters);
    render(<Customiser />);
    // The page's first reads, before the fonts go in.
    const first = world.reads.length;
    expect(first).toBeGreaterThan(0);
    await settle();
    await settle();
    expect(writes('upload', 'fonts')).toHaveLength(3);
    const after = world.reads.slice(first);
    // Each list at most once more, whatever the number of fonts.
    expect(after.length).toBeGreaterThan(0);
    expect(after.length, after.join(' ')).toBe(new Set(after).size);
  });

  it('leaves them to the button for a role that may not change the fonts', async () => {
    serve(() => 200);
    world.cannot.add('update:fonts');
    at(IDS.coasters, 'fonts');
    render(<Customiser />);
    await settle();
    expect(writes('upload', 'fonts')).toEqual([]);
    expect(screen.getByText('The open-licence starter fonts have no files yet. Add them once, and every base can offer them.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add the starter fonts' }));
    await settle();
    expect(writes('upload', 'fonts').map((call) => call.key)).toEqual(['72', '71', '73']);
    expect(world.toasts.at(-1)?.title).toBe('Starter fonts added. Shoppers see each one once you switch it on.');
  });

  it('names a font Adminium did not hand over, and adds the others', async () => {
    serve((path) => (path === 'fonts/Oswald.woff2' ? 404 : 200));
    at(IDS.coasters, 'fonts');
    render(<Customiser />);
    await settle();
    expect(writes('upload', 'fonts').map((call) => call.key)).toEqual(['72', '71']);
    expect(screen.getByText('Oswald: not added. Adminium did not hand over the file.')).toBeTruthy();
    expect(row('fonts', 73)['file']).toBeNull();
  });

  it('switches the button off on an Adminium without the page-files route, and says it needs a newer one', async () => {
    const fetched = serve(() => 404);
    at(IDS.coasters, 'fonts');
    render(<Customiser />);
    await settle();
    expect(fetched).toHaveBeenCalledWith(`${PAGE_FILES}fonts/Caveat-OFL.txt`, { credentials: 'same-origin' });
    expect(screen.getByText('Adding the starter fonts needs a newer Adminium.')).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Add the starter fonts' });
    expect(button).toHaveProperty('disabled', true);
    fireEvent.click(button);
    await settle();
    expect(writes('upload', 'fonts')).toEqual([]);
  });

  it('offers nothing once every starter font has its file', async () => {
    const fetched = serve(() => 200);
    for (const font of world.tables['fonts']!) font['file'] = 'file_01JX00000000000000000000AA';
    at(IDS.coasters, 'fonts');
    render(<Customiser />);
    await settle();
    expect(screen.queryByRole('button', { name: 'Add the starter fonts' })).toBeNull();
    expect(fetched).not.toHaveBeenCalled();
  });
});

describe('an Adminium with no upload', () => {
  it('says so by the outline and the font, and keeps both uploads switched off', () => {
    world.uploads = false;
    at(IDS.sign);
    render(<Customiser />);
    expect(screen.getByText('Uploading here needs a newer Adminium.')).toBeTruthy();
    expect(screen.getByLabelText('Upload the outline')).toHaveProperty('disabled', true);
  });

  it('keeps “Add the starter fonts” switched off too', () => {
    world.uploads = false;
    at(IDS.coasters, 'fonts');
    render(<Customiser />);
    expect(screen.getByRole('button', { name: 'Add the starter fonts' })).toHaveProperty('disabled', true);
  });
});

describe('step 7, publish', () => {
  it('lists what is done and what is not, and holds Publish until the base is finished, with the reason', () => {
    at(IDS.sign, 'publish');
    render(<Customiser />);
    expect(screen.getByRole('button', { name: /To do\s*Base\s*still needed/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Publish' })).toHaveProperty('disabled', true);
    expect(screen.getByText('Finish the base and add at least one area or ready-made design first.')).toBeTruthy();
    expect(screen.getByText('Until you publish, the product page has no “Make it yours” and shoppers can’t customise it.')).toBeTruthy();
  });

  it('publishes a finished base, and stops offering a published one', async () => {
    at(IDS.cards, 'publish');
    world.tables['base_areas']!.push({ id: 23, app: 'printing', base_id: IDS.cards, code: 'name', name: 'Your name', side: 'front', shape: 'rect', x_mm: 6, y_mm: 6, w_mm: 50, h_mm: 8, takes: 'words', required: true, rules: '{}', feature_id: null, position: 1 });
    render(<Customiser />);
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await settle();
    expect(row('bases', IDS.cards)['state']).toBe('published');
    expect(world.toasts.at(-1)?.title).toBe('Published. Shoppers can make it theirs.');
    fireEvent.click(screen.getByRole('button', { name: 'Stop offering it' }));
    await settle();
    expect(row('bases', IDS.cards)['state']).toBe('draft');
  });
});
