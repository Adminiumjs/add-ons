// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetWorld, seed, world } from '../pages/testing/host.tsx';
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

  it('says which font file is missing, and makes nothing', async () => {
    render(<Line {...HOST} linked="91" />);
    fireEvent.click(screen.getByRole('button', { name: 'Make the files' }));
    await settle();
    expect(screen.getByRole('alert').textContent).toBe('The files need the font file of Manrope. Upload it in Fonts & finishes, then make them again.');
    expect(world.tables['version_files']).toEqual([]);
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

  it('names a plain piece’s areas, says a part left plain, and a line with no design', () => {
    seed('designs', [{ id: 92, app: 'maker', ready_design_id: null, base_id: IDS.coasters, values: JSON.stringify({ format: 1, parts: { words: { text: 'Sam' } } }), state: 'draft', updated_at: '2026-08-06T10:00:00Z' }]);
    seed('design_versions', []);
    render(<Line {...HOST} linked="92" />);
    expect(items()).toMatchObject({ Design: 'The plain piece', 'Your logo': 'left plain', 'Your words': '“Sam”', State: 'Saved' });
    expect(screen.getByText('No proof yet')).toBeTruthy();
    expect(screen.getByText('No proof sent yet.')).toBeTruthy();
    cleanup();
    render(<Line {...HOST} linked={null} />);
    expect(screen.getByText('No design on this line')).toBeTruthy();
  });
});
