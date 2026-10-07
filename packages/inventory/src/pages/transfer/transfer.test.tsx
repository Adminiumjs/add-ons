// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { wordsFor } from '../shared/messages.ts';
import { resetWorld, seed, world } from '../testing/host.tsx';
import { Transfer } from './Transfer.tsx';

const t = wordsFor('shared', 'refusal', 'transfer');

beforeEach(() => {
  resetWorld();
  seed('places', [
    { id: 1, name: 'At the laundry', active: true },
    { id: 2, name: 'Linen store', active: true },
  ]);
  seed('items', [{ id: 21, name: 'Bath towel', sku: 'TWL-B', barcode: '5060000100219', unit: 'each', decimals: 0, tracks_batches: false, pack_name: null, pack_size: null, active: true }]);
  seed('transfers', []);
  seed('transfer_lines', []);
  seed('levels', []);
  world.decide = (table, row) => (table === 'transfer_lines' ? { status: 'draft', item_name: 'Bath towel', unit: 'each', ...row } : table === 'transfers' ? { status: 'draft', number: 'TR-0001', lines: 1, ...row } : row);
});
afterEach(() => cleanup());

const scan = async (code: string): Promise<void> => {
  const field = screen.getByLabelText('Find or scan');
  fireEvent.change(field, { target: { value: code } });
  fireEvent.keyDown(field, { key: 'Enter' });
  await waitFor(() => expect((field as HTMLInputElement).value).toBe(''));
};

describe('Transfer', () => {
  it('will not save one place twice, and says so on To', async () => {
    render(<Transfer t={t} transferId={null} />);
    fireEvent.change(screen.getByLabelText(/^From/), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/^To/), { target: { value: '1' } });
    await scan('TWL-B');
    fireEvent.click(screen.getByRole('button', { name: 'Save as draft' }));
    expect(await screen.findByText('Choose a different place')).toBeTruthy();
    expect(world.calls.some((call) => call.kind === 'tree')).toBe(false);
  });

  it('saves the transfer with its lines in one go, then moves them one by one and says what the ledger told', async () => {
    render(<Transfer t={t} transferId={null} />);
    fireEvent.change(screen.getByLabelText(/^From/), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/^To/), { target: { value: '2' } });
    await scan('TWL-B');
    fireEvent.change(within(screen.getByRole('group', { name: 'Bath towel' })).getByLabelText('Quantity'), { target: { value: '24' } });
    world.updateEach = (table, keys) =>
      keys.map((key) => {
        const row = world.tables[table]?.find((candidate) => String(candidate['id']) === key);
        if (row !== undefined) row['status'] = 'posted';
        return { key, ok: true, row: row ?? {}, postings: [{ ledger: 'stock', state: 'ok', notes: [{ line: 0, note: 'short' }] }] };
      });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(world.navigated).toHaveLength(1));
    const tree = world.calls.find((call) => call.kind === 'tree')?.values as { values: unknown; children: { transfer_lines: { values: unknown }[] } };
    expect(tree.values).toEqual({ from_place_id: '1', to_place_id: '2' });
    expect(tree.children.transfer_lines.map((line) => line.values)).toEqual([{ item_id: '21', qty: '24', batch_id: null }]);
    expect(world.calls.filter((call) => call.kind === 'move').map((call) => (call.values as { to: string }).to)).toEqual(['posting', 'done']);
    expect(world.calls.find((call) => call.kind === 'updateEach')?.options).toEqual({ from: 'draft' });
    expect(world.toasts.map((toast) => toast.title)).toEqual(['More was moved than the books held: Bath towel', 'Transfer done']);
  });

  it('opens a done transfer read-only, with Undo for someone who may', async () => {
    seed('transfers', [{ id: 8, number: 'TR-0001', from_place_id: 1, to_place_id: 2, status: 'done', lines: 1 }]);
    seed('transfer_lines', [{ id: 81, transfer_id: 8, item_id: 21, item_name: 'Bath towel', unit: 'each', batch_id: null, qty: '24.000', status: 'posted' }]);
    const first = render(<Transfer t={t} transferId="8" />);
    const line = await screen.findByRole('group', { name: 'Bath towel' });
    expect((within(line).getByLabelText('Quantity') as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByLabelText('Find or scan')).toBeNull();
    expect(screen.getByRole('button', { name: 'Undo this transfer' })).toBeTruthy();
    first.unmount();
    world.cannot.add('move:transfers:reversing');
    render(<Transfer t={t} transferId="8" />);
    await screen.findByRole('group', { name: 'Bath towel' });
    expect(screen.queryByRole('button', { name: 'Undo this transfer' })).toBeNull();
  });
});
