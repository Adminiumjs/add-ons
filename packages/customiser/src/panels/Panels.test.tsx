// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetWorld, seed } from '../pages/testing/host.tsx';
import { IDS, seedShop } from '../pages/testing/rows.ts';

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
  beforeEach(() => {
    seed('designs', [{ id: 91, app: 'maker', code: null, format: 1, ready_design_id: 51, base_id: IDS.coasters, values: JSON.stringify({ format: 1, parts: { words: { text: 'The Hartleys', font: 'Manrope', size: 6, finish: 'engraved' } } }), state: 'ordered', updated_at: '2026-08-05T15:01:00Z' }]);
    seed('design_versions', [{ id: 95, app: 'maker', design_id: 91, version: 2, proof_file: 'file-proof-2' }, { id: 94, app: 'maker', design_id: 91, version: 1, proof_file: 'file-proof-1' }]);
  });

  it('shows the design read-only: which design, each part’s values, its state, its latest proof, and where the files will be', () => {
    render(<Line {...HOST} table="public.maker_order_lines" row="l_6120" linked="91" />);
    expect(screen.getByText('read-only')).toBeTruthy();
    expect(screen.getByText('Proof 2')).toBeTruthy();
    expect(items()).toEqual({
      Design: 'Ring',
      'Your words': '“The Hartleys” · Manrope · 6 mm · Engraved',
      State: 'Ordered',
      'Saved as': `designs / 91 · ${new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date('2026-08-05T15:01:00Z'))} · ${new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(new Date('2026-08-05T15:01:00Z'))}`,
    });
    expect(screen.getByText("read-only · made from the shopper's saved design")).toBeTruthy();
    // Nothing on this panel writes.
    expect(screen.queryAllByRole('button')).toEqual([]);
  });

  it('names a plain piece’s areas, says a part left plain, and a line with no design', () => {
    seed('designs', [{ id: 92, app: 'maker', ready_design_id: null, base_id: IDS.coasters, values: JSON.stringify({ format: 1, parts: { words: { text: 'Sam' } } }), state: 'draft', updated_at: '2026-08-06T10:00:00Z' }]);
    seed('design_versions', []);
    render(<Line {...HOST} linked="92" />);
    expect(items()).toMatchObject({ Design: 'The plain piece', 'Your logo': 'left plain', 'Your words': '“Sam”', State: 'Saved' });
    expect(screen.getByText('No proof yet')).toBeTruthy();
    cleanup();
    render(<Line {...HOST} linked={null} />);
    expect(screen.getByText('No design on this line')).toBeTruthy();
  });
});
