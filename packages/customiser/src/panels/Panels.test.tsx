// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loaded, Refused, resetWorld, seed, world } from '../pages/testing/host.tsx';
import { IDS, seedCard, seedShop } from '../pages/testing/rows.ts';

const { default: Product } = await import('./product.tsx');
const { default: Line } = await import('./line.tsx');

const HOST = { connectionId: 'c1', table: 'public.maker_products', row: '3d9a' };
const items = (): Record<string, string> => Object.fromEntries([...document.querySelectorAll('dl > div')].map((pair) => [pair.querySelector('dt')!.textContent!, pair.querySelector('dd')!.textContent!]));

beforeEach(() => {
  resetWorld();
  seedShop();
});
afterEach(cleanup);

describe('the panel on a product', () => {
  it('says what the product offers for customising, as set up in the Customiser, and opens its set-up', () => {
    render(<Product {...HOST} linked={String(IDS.coasters)} />);
    expect(screen.getByText('Customising')).toBeTruthy();
    expect(screen.getByText('set up in the Customiser')).toBeTruthy();
    expect(screen.getAllByText('Published').length).toBeGreaterThan(0);
    expect(items()).toEqual({
      Base: 'A flat piece · 95 × 95 mm · Walnut 6 mm',
      Areas: 'Your logo (a logo) · Your words (words, required, 24)',
      Designs: 'Ring · Monogram',
      Priced: 'Your own logo',
      Status: 'Published',
    });
    expect(screen.getByRole('img', { name: 'Engraved walnut coasters, drawn flat with its areas' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open the set-up' }).getAttribute('href')).toBe('/add-ons/customiser/customiser/11');
  });

  it('says a product with no base is not set up, and still opens the set-up', () => {
    render(<Product {...HOST} linked={null} />);
    expect(screen.getByText('Not set up for customising')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open the set-up' }).getAttribute('href')).toBe('/add-ons/customiser/customiser');
  });
});

describe('the panel on a product, for a role short of a right', () => {
  it('shows what the role may not read as hidden, never as none yet, and names the role that shows it', () => {
    // As the walks' shop owner: the bases, and nothing else of the Customiser's.
    for (const table of ['base_areas', 'ready_designs', 'features']) world.closed.add(table);
    render(<Product {...HOST} linked={String(IDS.coasters)} />);
    expect(screen.getByRole('status').textContent).toContain('Part of this set-up is hidden from you');
    expect(screen.getByRole('status').textContent).toContain('Your role can’t read base_areas, ready_designs, features in the Customiser, so this is shown without them. The Customiser reader role shows it all.');
    expect(items()).toMatchObject({ Areas: 'hidden from you', Designs: 'hidden from you', Priced: 'hidden from you' });
    expect(screen.queryByText('none yet')).toBeNull();
  });

  it('says a role that may not read the bases cannot see the set-up, never that the product is not set up', () => {
    world.closed.add('bases');
    render(<Product {...HOST} linked={String(IDS.coasters)} />);
    expect(screen.getByText('You can’t see how this product is set up')).toBeTruthy();
    expect(screen.queryByText('Not set up for customising')).toBeNull();
  });
});

describe('the panel on an order line', () => {
  // Stored files as the dashboard names them; the font is the dashboard's own Manrope (OFL-1.1).
  const FONT = 'file_01HZY000000000000000000FNT';
  const PROOF2 = 'file_01HZY00000000000000000PRF2';
  const PROOF1 = 'file_01HZY00000000000000000PRF1';
  const MANROPE = readFileSync(createRequire(import.meta.url).resolve('@adminium/tokens/fonts/manrope/manrope-latin-wght-normal.woff2'));
  const settle = async (): Promise<void> => {
    for (let i = 0; i < 6; i += 1)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
  };
  const withFont = (): void => seed('fonts', world.tables['fonts']!.map((one) => (one['family'] === 'Manrope' ? { ...one, file: FONT } : one)));

  beforeEach(() => {
    seed('designs', [{ id: 91, app: 'maker', code: null, format: 1, ready_design_id: 51, base_id: IDS.coasters, values: JSON.stringify({ format: 1, parts: { words: { text: 'The Hartleys', font: 'Manrope', size: 6, finish: 'engraved' } } }), state: 'ordered', updated_at: '2026-08-05T15:01:00Z' }]);
    seed('design_versions', [
      { id: 95, app: 'maker', design_id: 91, version: 2, values: JSON.stringify({ format: 1, parts: { words: { text: 'The Hartleys', font: 'Manrope', size: 6 } } }), proof_file: PROOF2, note: 'Words set at 6 mm.', receipt_id: null, made_at: '2026-08-06T10:05:00Z' },
      { id: 94, app: 'maker', design_id: 91, version: 1, values: null, proof_file: PROOF1, note: null, receipt_id: 3, made_at: '2026-08-05T15:01:00Z' },
    ]);
    seed('version_files', []);
    // Ring's words, where the coaster takes them.
    seed('ready_parts', world.tables['ready_parts']!.map((one) => (one['id'] === 61 ? { ...one, x_mm: 11.5, y_mm: 57, w_mm: 72, h_mm: 13.5, rules: JSON.stringify({ fonts: ['Manrope'], font: 'Manrope', unit: 'mm', size: 6, chars: 24 }) } : one)));
    vi.stubGlobal('fetch', async (address: string) => (address === `/api/v1/files/${FONT}/content` ? new Response(MANROPE) : new Response('', { status: 404 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('draws the design as it will be made and lists each part’s values, its state and its latest proof', () => {
    render(<Line {...HOST} table="public.maker_order_lines" row="l_6120" linked="91" />);
    expect(screen.getByText('read-only')).toBeTruthy();
    expect(screen.getByText('Proof 2')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Ring, as it will be made' }).querySelector('tspan')?.textContent).toBe('The Hartleys');
    expect(items()).toEqual({
      Design: 'Ring',
      'Your words': '“The Hartleys” · Manrope · 6 mm · Engraved',
      State: 'Ordered',
      'Saved as': `designs / 91 · ${new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date('2026-08-05T15:01:00Z'))} · ${new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(new Date('2026-08-05T15:01:00Z'))}`,
    });
    expect(screen.getByText("read-only · made from the shopper's saved design")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Make the proof' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Make the files' })).toBeTruthy();
  });

  it('says no proof is made where the Customiser made none, never that the customer has no proof: a shop may send its own file', () => {
    // A sample order whose proofs the shop sent from its own app: the versions hold no proof file of the Customiser's.
    seed('design_versions', world.tables['design_versions']!.map((one) => ({ ...one, proof_file: null })));
    render(<Line {...HOST} linked="91" />);
    expect(screen.queryByText('No proof yet')).toBeNull();
    expect(screen.getAllByText('No proof made').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('Proof 2')).toBeNull();
  });

  it('lists the versions newest first, an older proof marked replaced, each proof to open (BC-E3.proofs)', () => {
    render(<Line {...HOST} linked="91" />);
    const proofs = within(screen.getByRole('region', { name: 'Proofs' }));
    const rows = proofs.getAllByRole('listitem').map((one) => one.textContent);
    expect(rows[0]).toContain('v2');
    expect(rows[0]).toContain('Proof made');
    expect(rows[0]).toContain('Words set at 6 mm.');
    expect(rows[1]).toContain('Replaced');
    expect(rows[1]).toContain('Snapshotted when the order was placed.');
    expect(proofs.getAllByRole('link', { name: 'Open the proof' }).map((one) => one.getAttribute('href'))).toEqual([`/api/v1/files/${PROOF2}/content`, `/api/v1/files/${PROOF1}/content`]);
  });

  it('makes the laser’s file of a piece from the newest version and lists it with its layers to download (BC-E2)', async () => {
    withFont();
    world.upload = () => ({ id: 'file_01HZY00000000000000000SVG1' });
    render(<Line {...HOST} linked="91" />);
    fireEvent.click(screen.getByRole('button', { name: 'Make the files' }));
    await settle();
    const created = world.calls.filter((call) => call.kind === 'create' && call.table === 'version_files');
    expect(created.map((call) => call.values)).toEqual([expect.objectContaining({ version_id: 95, kind: 'machine', name: 'design-91-v2-engraved-walnut-coasters.svg', about: 'Engraved walnut coasters · 95 × 95 mm', layers: JSON.stringify(['CUT', 'ENGRAVE']), position: 1 })]);
    const upload = world.calls.find((call) => call.kind === 'upload' && call.table === 'version_files');
    expect(upload?.values).toMatchObject({ column: 'file', name: 'design-91-v2-engraved-walnut-coasters.svg', type: 'image/svg+xml' });
    const list = within(screen.getByRole('region', { name: 'Files for the machine' }));
    expect(list.getByText('1 file')).toBeTruthy();
    expect(list.getByText('CUT')).toBeTruthy();
    expect(list.getByText('ENGRAVE')).toBeTruthy();
    expect(list.getByRole('link', { name: 'Download design-91-v2-engraved-walnut-coasters.svg' }).getAttribute('href')).toMatch(/^\/api\/v1\/files\//);
    expect(list.getByText('Words and logos are outlines, so the laser needs no fonts.')).toBeTruthy();
    // Made again, the version's files are replaced, never added to.
    fireEvent.click(screen.getByRole('button', { name: 'Make the files again' }));
    await settle();
    expect(world.tables['version_files']).toHaveLength(1);
  });

  /** Design 91 as a plain coaster with only the customer's logo on it, sent as this file. */
  const withLogo = (bytes: Uint8Array): void => {
    const values = JSON.stringify({ format: 1, parts: { logo: { file: 'logo_file' } } });
    seed('designs', [{ ...world.tables['designs']![0]!, ready_design_id: null, values, logo_file: LOGO }]);
    seed('design_versions', [{ ...world.tables['design_versions']![0]!, values }]);
    vi.stubGlobal('fetch', async (address: string) => (address === `/api/v1/files/${LOGO}/content` ? new Response(bytes as BlobPart) : new Response('', { status: 404 })));
    // This page draws no picture: one it is asked to read fails at once, as a browser's does on bytes it cannot decode.
    vi.stubGlobal(
      'Image',
      class {
        onerror: (() => void) | null = null;
        set src(_address: string) {
          queueMicrotask(() => this.onerror?.());
        }
      },
    );
  };
  const LOGO = 'file_01HZY00000000000000000GGG1';
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

  it('says, beside a laser’s file, that a logo sent as a picture is not in it, and where to engrave it from', async () => {
    withLogo(PNG);
    world.upload = () => ({ id: 'file_01HZY00000000000000000SVG1' });
    render(<Line {...HOST} linked="91" />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Make the files' }));
    await settle();
    const created = world.calls.filter((call) => call.kind === 'create' && call.table === 'version_files').map((call) => call.values as Record<string, unknown>);
    expect(created.map((one) => one['left_out'])).toEqual([JSON.stringify([{ column: 'logo_file', kind: 'png' }])]);
    const list = within(screen.getByRole('region', { name: 'Files for the machine' }));
    expect(list.getByText('The logo is a picture, so it is not in the cut file: engrave it from the shopper’s logo.')).toBeTruthy();
    expect(list.getByRole('link', { name: 'Download the logo' }).getAttribute('href')).toBe(`/api/v1/files/${LOGO}/content`);
  });

  it('says a PDF logo is left out in its own words, and says nothing of a logo drawn as an SVG', async () => {
    withLogo(new TextEncoder().encode('%PDF-1.7\n'));
    world.upload = () => ({ id: 'file_01HZY00000000000000000SVG1' });
    render(<Line {...HOST} linked="91" />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Make the files' }));
    await settle();
    expect(screen.getByText('The logo is a PDF, so it is not in the cut file: engrave it from the shopper’s logo.')).toBeTruthy();
    cleanup();
    world.calls.length = 0;
    withLogo(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>'));
    render(<Line {...HOST} linked="91" />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Make the files again' }));
    await settle();
    const created = world.calls.filter((call) => call.kind === 'create' && call.table === 'version_files').map((call) => call.values as Record<string, unknown>);
    expect(created.map((one) => one['left_out'])).toEqual([null]);
    expect(screen.queryByText(/so it is not in the cut file/)).toBeNull();
  });

  it('says which font file is missing, and makes nothing', async () => {
    render(<Line {...HOST} linked="91" />);
    fireEvent.click(screen.getByRole('button', { name: 'Make the files' }));
    await settle();
    expect(screen.getByRole('alert').textContent).toBe('The files need the font file of Manrope. Upload it in Fonts & finishes, then make them again.');
    expect(world.tables['version_files']).toEqual([]);
  });

  describe('for a role short of a right', () => {
    const SHOP = ['ready_designs', 'ready_parts', 'palettes', 'palette_colours', 'fonts', 'base_areas', 'base_pieces'];

    it('as the walks’ shop owner: says the customer’s words and the set-up are hidden, and makes nothing from the part it reads', async () => {
      withFont();
      for (const table of SHOP) world.closed.add(table);
      world.masked = { designs: ['values', 'logo_file', 'photo_file', 'email'], design_versions: ['values'] };
      world.cannot = new Set(['create:version_files', 'update:version_files']);
      render(<Line {...HOST} linked="91" />);
      const said = screen.getByRole('status').textContent ?? '';
      expect(said).toContain('Part of this design is hidden from you');
      expect(said).toContain('Your role can’t read the customer’s words, logo and photo, so the design is drawn without them.');
      expect(said).toContain('Your role can’t read base_pieces, base_areas, ready_designs, ready_parts, fonts, palettes, palette_colours in the Customiser');
      expect(said).toContain('The Customiser reader role shows it all; the Customiser designer role also makes the proof and the files.');
      expect(screen.getByText('The proof and the files are made only from the whole design, which your role can’t read.')).toBeTruthy();
      const proof = screen.getByRole('button', { name: 'Make the proof' }) as HTMLButtonElement;
      const files = screen.getByRole('button', { name: 'Make the files' }) as HTMLButtonElement;
      expect([proof.disabled, files.disabled]).toEqual([true, true]);
      fireEvent.click(proof);
      fireEvent.click(files);
      await settle();
      expect(world.calls.filter((call) => call.kind === 'create' || call.kind === 'upload')).toEqual([]);
    });

    it('as a reader: draws the whole design and says making needs the designer role', () => {
      world.cannot = new Set(['create:design_versions', 'update:design_versions', 'create:version_files', 'update:version_files']);
      render(<Line {...HOST} linked="91" />);
      expect(screen.queryByRole('status')).toBeNull();
      expect(screen.getByRole('img', { name: 'Ring, as it will be made' }).querySelector('tspan')?.textContent).toBe('The Hartleys');
      expect(screen.getByText('Making the proof and the files needs the Customiser designer role.')).toBeTruthy();
      expect((screen.getByRole('button', { name: 'Make the proof' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('says a role that may not read the designs cannot see the design, never that the line has none', () => {
      world.closed.add('designs');
      render(<Line {...HOST} linked="91" />);
      expect(screen.getByText('You can’t see this design')).toBeTruthy();
      expect(screen.queryByText('No design on this line')).toBeNull();
    });

    it('says a role that may not read the bases cannot draw it, rather than loading for ever', () => {
      world.closed.add('bases');
      render(<Line {...HOST} linked="91" />);
      expect(screen.getByText('Part of this design is hidden from you')).toBeTruthy();
      expect(screen.queryByText('Loading')).toBeNull();
    });

    it('says making the files again needs the right to remove the version’s files', async () => {
      withFont();
      world.upload = () => ({ id: 'file_01HZY00000000000000000SVG1' });
      seed('version_files', [{ id: 300, app: 'maker', version_id: 95, kind: 'machine', name: 'old.svg', about: '', layers: null, left_out: null, file: 'file_01HZY00000000000000000OLD1', position: 1 }]);
      world.before = (kind) => {
        if (kind === 'remove') throw new Refused('FORBIDDEN', 'You may not delete rows of this table.');
      };
      render(<Line {...HOST} linked="91" />);
      fireEvent.click(screen.getByRole('button', { name: 'Make the files again' }));
      await settle();
      expect(screen.getByRole('alert').textContent).toBe('Making the files again replaces the version’s files, and your role may not remove them. That needs the Customiser designer role.');
      expect(world.calls.filter((call) => call.kind === 'create' && call.table === 'version_files')).toEqual([]);
    });
  });

  describe('in a starter font nobody uploaded yet', () => {
    // The file this package ships for Manrope, as Adminium hands it out beside the set-up page.
    const SHIPPED = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../fonts/Manrope.woff2'));
    const BESIDE = '/api/v1/add-ons/customiser/pages/customiser/files/fonts/Manrope.woff2';
    const asked: string[] = [];
    beforeEach(() => {
      asked.length = 0;
      vi.stubGlobal('fetch', async (address: string) => {
        asked.push(address);
        return address === BESIDE ? new Response(SHIPPED) : new Response('', { status: 404 });
      });
      world.upload = () => ({ id: 'file_01HZY00000000000000000SVG1' });
    });

    it('makes the laser’s file of the sample coaster from the font file the package ships', async () => {
      expect(world.tables['fonts']!.find((one) => one['family'] === 'Manrope')).toMatchObject({ starter: true, file: null });
      render(<Line {...HOST} linked="91" />);
      fireEvent.click(screen.getByRole('button', { name: 'Make the files' }));
      await settle();
      expect(screen.queryByRole('alert')).toBeNull();
      expect(asked).toContain(BESIDE);
      const made = world.calls.filter((call) => call.kind === 'create' && call.table === 'version_files').map((call) => call.values as Record<string, unknown>);
      expect(made.map((one) => one['name'])).toEqual(['design-91-v2-engraved-walnut-coasters.svg']);
    });

    it('makes the sample business card’s proof and print files from it too', async () => {
      seedCard();
      seed('designs', [{ id: 92, app: 'printing', ready_design_id: 53, base_id: IDS.cards, values: JSON.stringify({ format: 1, layout: 'left', sides: 2, parts: { name: { text: 'Nell Fairweather' } } }), state: 'ordered', updated_at: '2026-08-04T09:00:00Z' }]);
      seed('design_versions', []);
      render(<Line {...HOST} linked="92" />);
      fireEvent.click(screen.getByRole('button', { name: 'Make the proof' }));
      await settle();
      fireEvent.click(screen.getByRole('button', { name: 'Make the print file' }));
      await settle();
      expect(screen.queryByRole('alert')).toBeNull();
      const made = world.calls.filter((call) => call.kind === 'create' && call.table === 'version_files').map((call) => call.values as Record<string, unknown>);
      expect(made.map((one) => one['name'])).toEqual(['design-92-v1-front-print.pdf', 'design-92-v1-back-print.pdf']);
    });

    it('still says which font file is missing where Adminium does not hand the file over, and never asks for a font it does not ship', async () => {
      vi.stubGlobal('fetch', async (address: string) => {
        asked.push(address);
        return new Response('', { status: 403 });
      });
      seed('fonts', [...world.tables['fonts']!.map((one) => (one['family'] === 'Manrope' ? { ...one, starter: false } : one))]);
      render(<Line {...HOST} linked="91" />);
      fireEvent.click(screen.getByRole('button', { name: 'Make the files' }));
      await settle();
      expect(screen.getByRole('alert').textContent).toBe('The files need the font file of Manrope. Upload it in Fonts & finishes, then make them again.');
      // A shop's own row of that name is not the starter font: its file is never fetched from beside the page.
      expect(asked).not.toContain(BESIDE);
    });
  });

  it('on a page, makes the proof as an A4 PDF and a print file a side, snapshotting version 1 where no order did (MC-F1)', async () => {
    seedCard();
    withFont();
    seed('designs', [{ id: 92, app: 'printing', ready_design_id: 53, base_id: IDS.cards, values: JSON.stringify({ format: 1, layout: 'left', sides: 2, parts: { name: { text: 'Nell Fairweather' } } }), state: 'ordered', updated_at: '2026-08-04T09:00:00Z' }]);
    seed('design_versions', []);
    render(<Line {...HOST} linked="92" />);
    expect(screen.getByRole('img', { name: 'Harbour, as it will be made · Front' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Harbour, as it will be made · Back' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Make the proof' }));
    await settle();
    expect(world.calls.find((call) => call.kind === 'create' && call.table === 'design_versions')?.values).toMatchObject({ design_id: 92, version: 1 });
    expect(world.calls.find((call) => call.kind === 'upload' && call.table === 'design_versions')?.values).toMatchObject({ column: 'proof_file', name: 'design-92-v1-proof.pdf', type: 'application/pdf' });
    fireEvent.click(screen.getByRole('button', { name: 'Make the print file' }));
    await settle();
    const made = world.calls.filter((call) => call.kind === 'create' && call.table === 'version_files').map((call) => call.values as Record<string, unknown>);
    expect(made.map((one) => [one['name'], one['about'], one['kind']])).toEqual([
      ['design-92-v1-front-print.pdf', '111 × 81 mm page · trim 85 × 55 · 3 mm bleed · crop marks', 'print'],
      ['design-92-v1-back-print.pdf', '111 × 81 mm page · trim 85 × 55 · 3 mm bleed · crop marks', 'print'],
    ]);
    expect(screen.getByText('It goes to press once the proof is approved.')).toBeTruthy();
  });

  /** The panel opened as Adminium answers: each read after a while, a base's areas and pieces once the base is known. */
  const openHeld = async (linked: string): Promise<void> => {
    const later = ['base_areas', 'base_pieces'];
    const first = ['ready_designs', 'bases', 'ready_parts', 'palettes', 'palette_colours', 'fonts', 'features', 'settings'];
    for (const table of [...first, ...later]) world.pending.add(table);
    render(<Line {...HOST} linked={linked} />);
    await settle();
    act(() => loaded(...first));
    await settle();
    act(() => loaded(...later));
    await settle();
  };

  it('draws the design once its set-up is held, on a host that hands a switched-off list back empty (a shop app’s screens)', async () => {
    world.offEmpty = true;
    seedCard();
    withFont();
    seed('designs', [{ id: 92, app: 'printing', ready_design_id: 53, base_id: IDS.cards, values: JSON.stringify({ format: 1, layout: 'left', sides: 2, parts: { name: { text: 'Nell Fairweather' } } }), state: 'ordered', updated_at: '2026-08-04T09:00:00Z' }]);
    seed('design_versions', []);
    await openHeld('92');
    expect(screen.queryByText('Loading')).toBeNull();
    expect(screen.getByRole('button', { name: 'Make the proof' })).toBeTruthy();
  });

  it('makes the files with the fonts and the shop’s line as they are now, a font’s file added in another tab since the panel opened', async () => {
    seedCard();
    seed('designs', [{ id: 92, app: 'printing', ready_design_id: 53, base_id: IDS.cards, values: JSON.stringify({ format: 1, layout: 'left', sides: 2, parts: { name: { text: 'Nell Fairweather' } } }), state: 'ordered', updated_at: '2026-08-04T09:00:00Z' }]);
    seed('design_versions', []);
    await openHeld('92');
    // Another tab adds Manrope's file: the panel's own lists are held, and do not see it.
    withFont();
    world.calls.length = 0;
    fireEvent.click(screen.getByRole('button', { name: 'Make the print file' }));
    await settle();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(world.calls.filter((call) => call.kind === 'create' && call.table === 'version_files')).toHaveLength(2);
    expect(world.calls.filter((call) => call.kind === 'list').map((call) => call.table).sort()).toEqual(['fonts', 'settings']);
  });

  it('reads again after a save only what the save changed: the versions and their files, never the shop’s set-up', async () => {
    seedCard();
    withFont();
    seed('designs', [{ id: 92, app: 'printing', ready_design_id: 53, base_id: IDS.cards, values: JSON.stringify({ format: 1, layout: 'left', sides: 2, parts: { name: { text: 'Nell Fairweather' } } }), state: 'ordered', updated_at: '2026-08-04T09:00:00Z' }]);
    seed('design_versions', []);
    await openHeld('92');
    // The first draw reads each table once.
    expect(world.reads.filter((table) => table === 'fonts')).toHaveLength(1);
    world.reads.length = 0;
    fireEvent.click(screen.getByRole('button', { name: 'Make the proof' }));
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Make the print file' }));
    await settle();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(world.calls.filter((call) => call.kind === 'upload')).toHaveLength(3);
    // Each save is read back in the design's versions and files alone: the set-up it is drawn from is held.
    expect([...new Set(world.reads)].sort()).toEqual(['design_versions', 'version_files']);
    expect(world.reads.length).toBeLessThanOrEqual(2 * world.calls.filter((call) => call.kind === 'create' || call.kind === 'upload' || call.kind === 'remove').length);
  });

  it('names each part of the layout the design is in once, never a part of its other layout', () => {
    seedCard();
    const names = (): string[] => [...document.querySelectorAll('dl > div > dt')].map((term) => term.textContent!);
    for (const [layout, shown] of [['top', ['Name']], ['left', ['Logo', 'Name']], [null, ['Logo', 'Name']]] as const) {
      seed('designs', [{ id: 92, app: 'printing', ready_design_id: 53, base_id: IDS.cards, values: JSON.stringify({ format: 1, ...(layout === null ? {} : { layout }), sides: 2, parts: { name: { text: 'Nell Fairweather' } } }), state: 'ordered', updated_at: '2026-08-04T09:00:00Z' }]);
      seed('design_versions', []);
      render(<Line {...HOST} linked="92" />);
      // A design that names no layout is in the design's first.
      expect(names().filter((name) => name === 'Logo' || name === 'Name'), String(layout)).toEqual(shown);
      cleanup();
    }
  });

  it('lists what a design taken into the full editor holds, its words and its photo, never its form’s parts as left plain', () => {
    seedCard();
    const placed = [
      { id: 'name', side: 'front', kind: 'text', name: 'Name', x: 6, y: 30, w: 75, h: 6, text: 'Wren Walker', font: 'Manrope', size: 13 },
      { id: 's1', side: 'back', kind: 'rect', name: 'Box', x: 0, y: 0, w: 10, h: 10, colour: 'accent' },
      { id: 'photo', side: 'back', kind: 'image', name: 'Photo', x: 0, y: 0, w: 85, h: 55, file: 'photo_file', fit: 'fill' },
      { id: 'i1', side: 'front', kind: 'image', x: 50, y: 5, w: 20, h: 20, file: 'logo_file', fit: 'inside' },
    ];
    seed('designs', [{ id: 92, app: 'printing', ready_design_id: 53, base_id: IDS.cards, values: JSON.stringify({ format: 1, sides: 2, parts: {}, placed }), logo_file: 'file_01HZY00000000000000000GGG1', photo_file: 'file_01HZY00000000000000000PHT1', state: 'ordered', updated_at: '2026-08-04T09:00:00Z' }]);
    seed('design_versions', []);
    render(<Line {...HOST} linked="92" />);
    const listed = items();
    // The full editor keeps any picture in the first picture column it has room in: what it is (logo, photo) is the shopper's, so it is named neither.
    expect(listed).toMatchObject({ Design: 'Harbour', Name: '“Wren Walker” · Manrope · 13 pt', Photo: 'their own picture', Picture: 'their own picture' });
    expect(Object.values(listed)).not.toContain('left plain');
    expect(Object.values(listed)).not.toContain('their own logo');
    expect(Object.keys(listed)).not.toContain('Box');
    expect(screen.getByText('The shopper’s pictures are private to them and the shop.')).toBeTruthy();
  });

  it('calls a photo added in the full editor a picture, never a logo, and keeps it private', () => {
    seedCard();
    // A photo the shopper uploaded with "Add an image": named by its file, kept in the first picture column it has room in.
    const placed = [{ id: 'i1', side: 'back', kind: 'image', name: 'rewalk-bindery-photo.jpg', x: 0, y: 0, w: 40, h: 27, file: 'logo_file', fit: 'inside' }];
    seed('designs', [{ id: 92, app: 'printing', ready_design_id: 53, base_id: IDS.cards, values: JSON.stringify({ format: 1, sides: 2, parts: {}, placed }), logo_file: 'file_01HZY00000000000000000GGG1', state: 'ordered', updated_at: '2026-08-04T09:00:00Z' }]);
    seed('design_versions', []);
    render(<Line {...HOST} linked="92" />);
    expect(items()['rewalk-bindery-photo.jpg']).toBe('their own picture');
    expect(screen.queryByText(/logo/i)).toBeNull();
    expect(screen.getByText('The shopper’s pictures are private to them and the shop.')).toBeTruthy();
  });

  it('keeps a form’s photo private too, and says nothing of privacy on a design with no picture', () => {
    seedCard();
    seed('designs', [{ id: 92, app: 'printing', ready_design_id: 53, base_id: IDS.cards, values: JSON.stringify({ format: 1, parts: { name: { text: 'Nell' } } }), photo_file: 'file_01HZY00000000000000000PHT1', state: 'ordered', updated_at: '2026-08-04T09:00:00Z' }]);
    seed('design_versions', []);
    render(<Line {...HOST} linked="92" />);
    expect(screen.getByText('The shopper’s pictures are private to them and the shop.')).toBeTruthy();
    cleanup();
    seed('designs', [{ id: 92, app: 'printing', ready_design_id: 53, base_id: IDS.cards, values: JSON.stringify({ format: 1, parts: { name: { text: 'Nell' } } }), state: 'ordered', updated_at: '2026-08-04T09:00:00Z' }]);
    render(<Line {...HOST} linked="92" />);
    expect(screen.queryByText('The shopper’s pictures are private to them and the shop.')).toBeNull();
  });

  it('names a plain piece’s areas, says a part left plain, and a line with no design', () => {
    seed('designs', [{ id: 92, app: 'maker', ready_design_id: null, base_id: IDS.coasters, values: JSON.stringify({ format: 1, parts: { words: { text: 'Sam' } } }), state: 'draft', updated_at: '2026-08-06T10:00:00Z' }]);
    seed('design_versions', []);
    render(<Line {...HOST} linked="92" />);
    expect(items()).toMatchObject({ Design: 'The plain piece', 'Your logo': 'left plain', 'Your words': '“Sam”', State: 'Saved' });
    // What the Customiser made, never a claim on what the shop sent from its own app.
    expect(screen.getByText('No proof made')).toBeTruthy();
    expect(screen.queryByText('No proof yet')).toBeNull();
    // What the Customiser made: the app may have sent a proof of its own (Maker's BR-2290).
    expect(screen.getByText('The Customiser has made no proof of this design yet.')).toBeTruthy();
    expect(screen.queryByText('No proof sent yet.')).toBeNull();
    cleanup();
    render(<Line {...HOST} linked={null} />);
    expect(screen.getByText('No design on this line')).toBeTruthy();
  });

  it('names a design on no ready-made one by its base’s kind: a blank card is a page, not a piece', () => {
    seed('design_versions', []);
    for (const [base, app, name] of [[IDS.cards, 'printing', 'The blank page'], [IDS.nook, 'maker', 'The plain kit'], [IDS.coasters, 'maker', 'The plain piece']] as const) {
      cleanup();
      seed('designs', [{ id: 93, app, ready_design_id: null, base_id: base, values: JSON.stringify({ format: 1, parts: {} }), state: 'draft', updated_at: '2026-08-06T10:00:00Z' }]);
      render(<Line {...HOST} linked="93" />);
      expect(items()['Design'], name).toBe(name);
    }
  });
});
