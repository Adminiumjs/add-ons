// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Refused, resetWorld, seed, world } from '../testing/host.tsx';
import { wordsFor } from '../shared/messages.ts';
import { RECEIVE, REFUSAL, SHARED } from '../strings/index.ts';
import { Receive } from './Receive.tsx';

const t = wordsFor(SHARED, REFUSAL, RECEIVE);

/** The sample's PO-1002, as far as this screen reads it. */
function sample(): void {
  seed('places', [
    { id: 1, name: 'Treatment room', active: true },
    { id: 2, name: 'Shop floor', active: true },
  ]);
  seed('suppliers', [{ id: 1, name: 'Medisupply Direct', active: true }]);
  seed('settings', [{ id: 1, default_place_id: 2 }]);
  seed('purchase_orders', [{ id: 7, number: 'PO-1002', supplier_id: 1, supplier_name: 'Medisupply Direct', sent_at: '2026-09-29T09:00:00Z', expected_on: '2026-10-01', place_id: 1, place_name: 'Treatment room', status: 'sent', closed_at: null }]);
  seed('po_lines', [
    { id: 71, po_id: 7, item_id: 11, item_name: 'Lidocaine 1% ampoule', unit: 'each', supplier_code: 'LID-10', pack_name: 'box', packs: '5.000', pack_size: '10.000', qty: '50.000', received: '0.000', open_qty: '50.000' },
    { id: 72, po_id: 7, item_id: 12, item_name: 'Gloves, nitrile, L', unit: 'pairs', supplier_code: 'GLV', pack_name: 'box', packs: '2.000', pack_size: '100.000', qty: '200.000', received: '0.000', open_qty: '200.000' },
  ]);
  seed('items', [
    { id: 11, name: 'Lidocaine 1% ampoule', sku: 'LID-1', barcode: '5060000100011', unit: 'each', decimals: 0, tracks_batches: true, pack_name: 'box', pack_size: '10.000', active: true },
    { id: 12, name: 'Gloves, nitrile, L', sku: 'GLV-NL', barcode: '5060000100028', unit: 'pairs', decimals: 0, tracks_batches: false, pack_name: 'box', pack_size: '100.000', active: true },
    { id: 13, name: 'Alcohol swab', sku: 'SWB', barcode: '5060000100035', unit: 'each', decimals: 0, tracks_batches: false, pack_name: null, pack_size: null, active: true },
  ]);
  seed('batches', []);
  seed('receipts', []);
  seed('receipt_lines', []);
  seed('stock_points', [{ id: 31, item_id: 11, place_id: 1, on_hand: '64.000' }]);
  // Adminium's own figures, deliberately not what the screen could work out: units = packs × size + 1.
  world.decide = (table, row) => {
    if (table === 'receipt_lines') {
      const qty = row['packs'] === null || row['packs'] === undefined ? row['qty_typed'] : String(Number(row['packs']) * Number(row['pack_size']) + 1);
      return { status: 'draft', ...row, item_name: world.tables['items']?.find((item) => item['id'] === Number(row['item_id']))?.['name'] ?? '', unit: 'each', qty: `${String(qty)}.000`, cost_used: row['unit_cost'] ?? '1.1000', amount: '56.10' };
    }
    if (table === 'receipts') {
      const lines = (world.tables['receipt_lines'] ?? []).filter((line) => line['receipt_id'] === row['id']);
      return { status: 'draft', number: 'RC-0001', ...row, lines: lines.length, unposted: lines.filter((line) => line['status'] === 'draft').length, unreversed: lines.filter((line) => line['status'] === 'posted').length, units: '51.000', total: '56.10', cost_to_check: 0, by: 'Ava Reyes' };
    }
    return row;
  };
}

const type = (label: RegExp | string, value: string, within_?: HTMLElement): void => {
  fireEvent.change((within_ === undefined ? screen : within(within_)).getByLabelText(label), { target: { value } });
};
const line = (item: string): HTMLElement => screen.getByRole('group', { name: item });
const lastCall = (kind: string) => [...world.calls].reverse().find((call) => call.kind === kind);

beforeEach(() => {
  resetWorld();
  sample();
});
afterEach(() => cleanup());

describe('Receive', () => {
  it('shows an order\'s open lines with what was ordered, the place fixed to the order\'s', async () => {
    render(<Receive t={t} receiptId={null} poId="7" />);
    await screen.findByRole('group', { name: 'Lidocaine 1% ampoule' });
    expect(within(line('Lidocaine 1% ampoule')).getByText('5 box of 10')).toBeTruthy();
    expect(within(line('Gloves, nitrile, L')).getByText(/200\s+pairs/)).toBeTruthy();
    // "Into" is the order's place, as text: there is nothing to choose.
    expect(screen.queryByLabelText('Into')).toBeNull();
    expect(screen.getByText('Treatment room')).toBeTruthy();
  });

  it('a clerk sees no cost, sends no cost, and the bar reads units only', async () => {
    world.unreadable = { receipt_lines: ['unit_cost', 'cost_used', 'amount'], receipts: ['total'] };
    render(<Receive t={t} receiptId={null} poId="7" />);
    await screen.findByRole('group', { name: 'Lidocaine 1% ampoule' });
    expect(screen.queryByText('Unit cost')).toBeNull();
    expect(screen.queryByText('Total')).toBeNull();
    type('Receiving now', '5', line('Lidocaine 1% ampoule'));
    type('Batch', 'LD201', line('Lidocaine 1% ampoule'));
    type('Expires', '2027-04-30', line('Lidocaine 1% ampoule'));
    fireEvent.click(screen.getByRole('button', { name: 'Save as draft' }));
    await waitFor(() => expect(lastCall('tree')).toBeDefined());
    const sent = lastCall('tree')?.values as { values: Record<string, unknown>; children: { receipt_lines: { values: Record<string, unknown> }[] } };
    expect(sent.values).toEqual({ place_id: '1', kind: 'delivery', po_id: '7' });
    // One line was typed on: the other is not delivered and is not sent.
    expect(sent.children.receipt_lines).toHaveLength(1);
    expect(sent.children.receipt_lines[0]?.values).toEqual({ item_id: '11', po_line_id: '71', packs: '5', pack_size: '10', qty_typed: null, batch_code: 'LD201', expires_on: '2027-04-30' });
    expect('unit_cost' in (sent.children.receipt_lines[0]?.values ?? {})).toBe(false);
    // No read asked for a cost either.
    for (const call of world.calls.filter((made) => made.kind === 'list' && made.table === 'receipt_lines')) {
      expect((call.options as { columns: string[] }).columns).not.toContain('amount');
    }
  });

  it('shows the server\'s figures after a save, never its own', async () => {
    seed('receipts', [{ id: 90, number: 'RC-0001', po_id: 7, supplier_id: 1, place_id: 1, kind: 'delivery', status: 'draft', lines: 1, unposted: 1, unreversed: 0, units: '51.000', total: '56.10', cost_to_check: 0 }]);
    seed('receipt_lines', [{ id: 91, receipt_id: 90, po_line_id: 71, item_id: 11, item_name: 'Lidocaine 1% ampoule', unit: 'each', packs: '5.000', pack_size: '10.000', qty_typed: null, qty: '51.000', unit_cost: null, cost_used: '1.1000', amount: '56.10', batch_code: 'LD201', expires_on: '2027-04-30', status: 'draft' }]);
    render(<Receive t={t} receiptId="90" poId={null} />);
    const row = await screen.findByRole('group', { name: 'Lidocaine 1% ampoule' });
    // 5 × 10 is 50; Adminium said 51, and 51 is what is shown.
    expect(within(row).getByText(/=\s*51\s+each/)).toBeTruthy();
    expect(within(row).queryByText(/=\s*50\s+each/)).toBeNull();
    expect(within(row).getByText('56.10')).toBeTruthy();
    expect(within(row).getByText('Adminium used 1.1')).toBeTruthy();
    expect(screen.getByText('Receiving 51 units · 56.10')).toBeTruthy();
    // Typing takes the server's figure away until the next save: the screen does not guess the new one.
    type('Receiving now', '6', row);
    expect(within(row).queryByText(/=\s*\d+\s+each/)).toBeNull();
    expect(screen.getByText('1 line to receive')).toBeTruthy();
  });

  it('a saved receipt reads units only to someone who may not see its total', async () => {
    world.unreadable = { receipt_lines: ['unit_cost', 'cost_used', 'amount'], receipts: ['total'] };
    seed('receipts', [{ id: 90, number: 'RC-0001', po_id: null, supplier_id: null, place_id: 1, kind: 'delivery', status: 'draft', lines: 1, unposted: 1, unreversed: 0, units: '51.000', total: '56.10', cost_to_check: 0 }]);
    seed('receipt_lines', [{ id: 91, receipt_id: 90, po_line_id: null, item_id: 13, item_name: 'Alcohol swab', unit: 'each', packs: null, pack_size: null, qty_typed: '51.000', qty: '51.000', amount: '56.10', batch_code: null, expires_on: null, status: 'draft' }]);
    render(<Receive t={t} receiptId="90" poId={null} />);
    expect(await screen.findByText('Receiving 51 units')).toBeTruthy();
    expect(screen.queryByText(/56\.10/)).toBeNull();
  });

  it('a scan raises the item\'s line by one pack, and by one unit where no pack is known', async () => {
    render(<Receive t={t} receiptId={null} poId={null} />);
    const field = await screen.findByLabelText('Find or scan');
    const scan = async (code: string): Promise<void> => {
      fireEvent.change(field, { target: { value: code } });
      fireEvent.keyDown(field, { key: 'Enter' });
      await waitFor(() => expect((field as HTMLInputElement).value).toBe(''));
    };
    await scan('5060000100028');
    await scan('5060000100028');
    expect((within(line('Gloves, nitrile, L')).getByLabelText('Receiving now') as HTMLInputElement).value).toBe('2');
    expect(within(line('Gloves, nitrile, L')).getByText('box')).toBeTruthy();
    await scan('SWB');
    expect((within(line('Alcohol swab')).getByLabelText('Receiving now') as HTMLInputElement).value).toBe('1');
    // With no order, the place starts as the settings' default and can be chosen.
    expect((screen.getByLabelText(/Into/) as HTMLSelectElement).value).toBe('2');
  });

  it('a code nothing matches offers a new item only to someone who may add items', async () => {
    world.cannot.add('create:items');
    render(<Receive t={t} receiptId={null} poId={null} />);
    const field = await screen.findByLabelText('Find or scan');
    fireEvent.change(field, { target: { value: '5060000199990' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(await screen.findByText('No item has this code · 5060000199990')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add it as a new item' })).toBeNull();
  });

  it('says what is missing before a post, and sends nothing', async () => {
    render(<Receive t={t} receiptId={null} poId="7" />);
    await screen.findByRole('group', { name: 'Lidocaine 1% ampoule' });
    type('Receiving now', '5', line('Lidocaine 1% ampoule'));
    fireEvent.click(screen.getByRole('button', { name: 'Post receipt' }));
    expect(await screen.findByText('2 fields need fixing before you post')).toBeTruthy();
    expect(within(line('Lidocaine 1% ampoule')).getByText('Enter the batch number')).toBeTruthy();
    expect(within(line('Lidocaine 1% ampoule')).getByText('Enter the expiry date')).toBeTruthy();
    expect(world.calls.some((call) => call.kind === 'tree' || call.kind === 'move')).toBe(false);
  });

  it('posts: the receipt moves, its lines go in one by one from draft, then the receipt is posted', async () => {
    render(<Receive t={t} receiptId={null} poId="7" />);
    await screen.findByRole('group', { name: 'Gloves, nitrile, L' });
    type('Receiving now', '2', line('Gloves, nitrile, L'));
    fireEvent.click(screen.getByRole('button', { name: 'Post receipt' }));
    await waitFor(() => expect(world.navigated).toHaveLength(1));
    const steps = world.calls.filter((call) => ['tree', 'move', 'updateEach'].includes(call.kind)).map((call) => `${call.kind}:${call.table}${call.kind === 'move' ? `:${(call.values as { to: string }).to}` : ''}`);
    expect(steps).toEqual(['tree:receipts', 'move:receipts:posting', 'updateEach:receipt_lines', 'move:receipts:posted']);
    const run = lastCall('updateEach');
    expect(run?.values).toMatchObject({ values: { status: 'posted' } });
    expect(run?.options).toEqual({ from: 'draft' });
    expect(world.toasts.at(-1)?.title).toBe('Receipt posted for PO-1002');
    expect(world.navigated[0]).toMatchObject({ search: { receipt: String(world.tables['receipts']?.[0]?.['id']) } });
  });

  it('a refused line stops the run, keeps what was typed and offers Continue posting', async () => {
    seed('receipts', [{ id: 90, number: 'RC-0001', po_id: 7, supplier_id: 1, place_id: 1, kind: 'delivery', status: 'draft', lines: 2, unposted: 2, unreversed: 0, units: '250.000', total: '0.00', cost_to_check: 0 }]);
    seed('receipt_lines', [
      { id: 91, receipt_id: 90, po_line_id: 72, item_id: 12, item_name: 'Gloves, nitrile, L', unit: 'pairs', packs: '2.000', pack_size: '100.000', qty_typed: null, qty: '200.000', batch_code: null, expires_on: null, status: 'draft' },
      { id: 92, receipt_id: 90, po_line_id: 71, item_id: 11, item_name: 'Lidocaine 1% ampoule', unit: 'each', packs: '5.000', pack_size: '10.000', qty_typed: null, qty: '50.000', batch_code: 'LD118', expires_on: '2026-09-01', status: 'draft' },
    ]);
    world.updateEach = (table, keys) =>
      keys.map((key) => {
        const row = world.tables[table]?.find((candidate) => String(candidate['id']) === key);
        if (key === '92') return { key, ok: false, error: { code: 'POSTING_REFUSED', message: '', details: { reason: 'expired' } } };
        if (row !== undefined) row['status'] = 'posted';
        // The receipt's own counts are Adminium's, settled with each line.
        Object.assign(world.tables['receipts']?.[0] ?? {}, { unposted: 1, unreversed: 1 });
        return { key, ok: true, row: row ?? {} };
      });
    render(<Receive t={t} receiptId="90" poId={null} />);
    await screen.findByRole('group', { name: 'Lidocaine 1% ampoule' });
    fireEvent.click(screen.getByRole('button', { name: 'Post receipt' }));
    // The receipt stays where its lines are still going in: nothing moved it on.
    expect(await screen.findByRole('button', { name: 'Continue posting' })).toBeTruthy();
    expect(world.calls.filter((call) => call.kind === 'move').map((call) => (call.values as { to: string }).to)).toEqual(['posting']);
    expect(screen.getByText('1 of 2 lines are in. Lidocaine 1% ampoule: This batch has already expired')).toBeTruthy();
    const refused = line('Lidocaine 1% ampoule');
    expect(within(refused).getByText('This batch has already expired')).toBeTruthy();
    // What was typed is still there, and can be corrected.
    expect((within(refused).getByLabelText('Batch') as HTMLInputElement).value).toBe('LD118');
    expect((within(refused).getByLabelText('Receiving now') as HTMLInputElement).disabled).toBe(false);
    // Going on sends only the line that is still out.
    world.updateEach = null;
    fireEvent.click(screen.getByRole('button', { name: 'Continue posting' }));
    await waitFor(() => expect(world.tables['receipts']?.[0]?.['status']).toBe('posted'));
    expect((lastCall('updateEach')?.values as { ids: string[] }).ids).toEqual(['92']);
  });

  it('shows a save Adminium refused on the line it names, and keeps the line', async () => {
    seed('receipts', [{ id: 90, number: 'RC-0001', po_id: null, supplier_id: null, place_id: 1, kind: 'delivery', status: 'draft', lines: 1, unposted: 1, unreversed: 0, units: '1.000', total: '0.00', cost_to_check: 0 }]);
    seed('receipt_lines', [{ id: 91, receipt_id: 90, po_line_id: null, item_id: 13, item_name: 'Alcohol swab', unit: 'each', packs: null, pack_size: null, qty_typed: '1.000', qty: '1.000', batch_code: null, expires_on: null, status: 'draft' }]);
    world.before = (kind) => {
      if (kind === 'update') throw new Refused('VALIDATION_FAILED', 'Enter a quantity above zero.', { column: 'qty' });
    };
    render(<Receive t={t} receiptId="90" poId={null} />);
    const row = await screen.findByRole('group', { name: 'Alcohol swab' });
    type('Receiving now', '0.5', row);
    fireEvent.click(screen.getByRole('button', { name: 'Save as draft' }));
    expect(await within(row).findByText('Enter a quantity above zero.')).toBeTruthy();
    expect((within(row).getByLabelText('Receiving now') as HTMLInputElement).value).toBe('0.5');
  });

  it('opens nothing for someone who may not read receipts', () => {
    world.closed.add('receipts');
    render(<Receive t={t} receiptId={null} poId={null} />);
    expect(screen.getByText('You do not have permission to open this')).toBeTruthy();
  });
});
