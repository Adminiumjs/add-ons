// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { wordsFor } from '../shared/messages.ts';
import { COUNTS, REFUSAL, SHARED } from '../strings/index.ts';
import { Refused, resetWorld, seed, world } from '../testing/host.tsx';
import { CountSheet } from './CountSheet.tsx';
import { CountsList } from './CountsList.tsx';
import { COUNT_MAX, levelsInScope } from './scope.ts';

const t = wordsFor(SHARED, REFUSAL, COUNTS);

const line = (id: number, item: string, more: Record<string, string | number | null> = {}) => ({ id, count_id: 5, level_id: 100 + id, item_id: id, item_name: item, sku: `SKU-${String(id)}`, barcode: `50600001000${String(id)}`, unit: 'each', batch_code: null, counted: null, qty_when_counted: null, counted_at: null, difference: null, value: null, is_counted: 0, differs: 0, status: 'open', ...more });

function sheet(lines = [line(1, 'Alcohol swab', { batch_code: '-' }), line(2, 'Gloves, nitrile, L'), line(3, 'Lidocaine 1% ampoule', { batch_code: 'LD118' })]): void {
  seed('places', [{ id: 1, name: 'Treatment room', active: true }]);
  seed('categories', []);
  seed('reasons', [{ id: 9, label: 'Count difference', for: 'adjust', active: true }]);
  seed('settings', [{ id: 1, default_place_id: 1, count_stale_days: 90 }]);
  seed('counts', [{ id: 5, number: 'CNT-0002', place_id: 1, scope: 'all', category_id: null, status: 'open', lines: lines.length, counted_lines: 0, uncounted: lines.length, differences: 0, value: '0.00', at: '2026-10-01T10:00:00Z' }]);
  seed('count_lines', lines);
  seed('levels', lines.map((row) => ({ id: row.level_id, qty: '14.000' })));
  seed('count_marks', []);
  // Adminium's part of a mark: the snapshot, the difference and its value — figures the screen could not get by subtracting.
  world.decide = (table, row) => {
    if (table !== 'count_marks') return row;
    const at = world.tables['count_lines']?.find((candidate) => candidate['id'] === Number(row['count_line_id']));
    if (at !== undefined) Object.assign(at, row['counted'] === null ? { counted: null, qty_when_counted: null, difference: null, value: null, is_counted: 0, differs: 0 } : { counted: `${String(row['counted'])}.000`, qty_when_counted: '13.000', difference: '-1.000', value: '-1.10', is_counted: 1, differs: 1 });
    const all = world.tables['count_lines'] ?? [];
    Object.assign(world.tables['counts']?.[0] ?? {}, { counted_lines: all.filter((one) => one['is_counted'] === 1).length, uncounted: all.filter((one) => one['is_counted'] !== 1).length, differences: all.filter((one) => one['differs'] === 1).length, value: '-1.10' });
    return row;
  };
}

const row = (item: string): HTMLElement => screen.getByRole('group', { name: item });

beforeEach(() => resetWorld());
afterEach(() => cleanup());

describe('a count sheet', () => {
  it('typing a count saves that line and shows the reply\'s difference and value', async () => {
    sheet();
    render(<CountSheet t={t} countId="5" />);
    const field = await screen.findByLabelText('Counted, Alcohol swab');
    // The level nobody put a batch on reads "No batch", never its dash; a real batch reads its code.
    expect(within(row('Alcohol swab')).getByText('No batch')).toBeTruthy();
    expect(within(row('Lidocaine 1% ampoule')).getByText('Batch LD118')).toBeTruthy();
    // Before a line is counted, Expected is what the books hold now.
    expect(within(row('Alcohol swab')).getByText(/14\s+each/)).toBeTruthy();
    fireEvent.change(field, { target: { value: '12' } });
    fireEvent.blur(field);
    await waitFor(() => expect(world.calls.filter((call) => call.kind === 'create')).toHaveLength(1));
    // The count is a mark of its own: the line's own columns are never written by the screen.
    expect(world.calls.find((call) => call.kind === 'create')).toMatchObject({ table: 'count_marks', values: { count_line_id: '1', counted: '12' } });
    expect(world.calls.some((call) => call.table === 'count_lines' && call.kind !== 'list' && call.kind !== 'get')).toBe(false);
    // 12 − 14 is −2; Adminium said −1 against 13, and that is what is shown.
    await waitFor(() => expect(within(row('Alcohol swab')).getByText('\u22121')).toBeTruthy());
    expect(within(row('Alcohol swab')).getByText('\u2212$1.10')).toBeTruthy();
    expect(within(row('Alcohol swab')).getByText(/13\s+each/)).toBeTruthy();
    // The books moved since: said under what was expected, read from the level, not from the line.
    expect(within(row('Alcohol swab')).getByText('On hand now 14')).toBeTruthy();
    expect(screen.getAllByText('1 of 3 lines counted').length).toBeGreaterThan(0);
    expect(screen.getByText('1 difference · \u2212$1.10')).toBeTruthy();
  });

  it('a cleared count un-counts the line, and a refused mark says so on its line and keeps what was typed', async () => {
    sheet([line(1, 'Alcohol swab', { counted: '12.000', qty_when_counted: '13.000', difference: '-1.000', value: '-1.10', is_counted: 1, differs: 1 })]);
    render(<CountSheet t={t} countId="5" />);
    const field = await screen.findByLabelText('Counted, Alcohol swab');
    fireEvent.change(field, { target: { value: '' } });
    fireEvent.blur(field);
    await waitFor(() => expect(world.calls.find((call) => call.kind === 'create')).toMatchObject({ values: { count_line_id: '1', counted: null } }));
    world.before = () => {
      throw new Refused('POSTING_REFUSED', '', { reason: 'not-allowed' });
    };
    fireEvent.change(screen.getByLabelText('Counted, Alcohol swab'), { target: { value: '7' } });
    fireEvent.blur(screen.getByLabelText('Counted, Alcohol swab'));
    expect(await screen.findByText('This count is no longer open')).toBeTruthy();
    expect(screen.getByText('Not saved')).toBeTruthy();
    expect((screen.getByLabelText('Counted, Alcohol swab') as HTMLInputElement).value).toBe('7');
  });

  it('Find or scan asks the server and shows the item\'s lines, wherever they are in the sheet', async () => {
    // 250 lines: the scanned one is on the third page.
    sheet(Array.from({ length: 250 }, (_unused, index) => line(index + 1, `Item ${String(index + 1).padStart(3, '0')}`)));
    render(<CountSheet t={t} countId="5" />);
    await screen.findByLabelText('Counted, Item 001');
    expect(screen.queryByLabelText('Counted, Item 240')).toBeNull();
    const field = screen.getByLabelText('Find or scan');
    fireEvent.change(field, { target: { value: 'SKU-240' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(await screen.findByLabelText('Counted, Item 240')).toBeTruthy();
    expect(screen.getByText('Showing Item 240')).toBeTruthy();
    // The question went to the server, among this count's lines only.
    const asked = world.calls.filter((call) => call.kind === 'list' && call.table === 'count_lines' && JSON.stringify(call.options).includes('SKU-240')).map((call) => (call.options as { filter: unknown[] }).filter);
    // By barcode first, then by SKU.
    expect(asked).toEqual([
      [{ column: 'count_id', op: 'eq', value: '5' }, { column: 'barcode', op: 'eq', value: 'SKU-240' }],
      [{ column: 'count_id', op: 'eq', value: '5' }, { column: 'sku', op: 'eq', value: 'SKU-240' }],
    ]);
    fireEvent.change(field, { target: { value: '999' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(await screen.findByText('Not in this count · 999')).toBeTruthy();
  });

  it('cannot be posted with a line uncounted: Adminium refuses, and the sheet turns to what is left', async () => {
    sheet();
    world.before = (kind, table, values) => {
      if (kind === 'move' && table === 'counts' && (values as { to: string }).to === 'posting') throw new Refused('STATE_MOVE_REFUSED', '', { requires: { where: [{ column: 'uncounted', eq: 0 }] } });
    };
    render(<CountSheet t={t} countId="5" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Post count' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Post count' }));
    expect(await screen.findByText('3 lines not counted yet')).toBeTruthy();
    expect((screen.getByRole('switch', { name: 'Not counted' }) as HTMLInputElement).checked).toBe(true);
    expect(world.calls.some((call) => call.kind === 'updateEach')).toBe(false);
  });

  it('posts with its reason, the lines that differ first, each from open', async () => {
    sheet([line(1, 'Alcohol swab', { counted: '14.000', qty_when_counted: '14.000', difference: '0.000', is_counted: 1 }), line(2, 'Gloves, nitrile, L', { counted: '12.000', qty_when_counted: '13.000', difference: '-1.000', is_counted: 1, differs: 1 })]);
    Object.assign(world.tables['counts']?.[0] ?? {}, { counted_lines: 2, uncounted: 0, differences: 1 });
    render(<CountSheet t={t} countId="5" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Post count' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('1 line will be adjusted. A stock manager can reverse a posted count.')).toBeTruthy();
    expect(within(dialog).getByText('Gloves, nitrile, L')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Post count' }));
    await waitFor(() => expect(world.tables['counts']?.[0]?.['status']).toBe('posted'));
    const moves = world.calls.filter((call) => call.kind === 'move');
    expect(moves[0]?.values).toEqual({ to: 'posting', values: { reason_id: '9' } });
    expect(moves[1]?.values).toEqual({ to: 'posted' });
    const run = world.calls.find((call) => call.kind === 'updateEach');
    expect((run?.values as { ids: string[] }).ids).toEqual(['2', '1']);
    expect(run?.options).toEqual({ from: 'open' });
    expect(world.toasts.at(-1)?.title).toBe('Count posted · 1 line adjusted');
    // Done: the sheet gives way to the list.
    await waitFor(() => expect(world.navigated.at(-1)?.to).toBe('/add-ons/inventory/inventory-counts'));
  });

  it('asks for a reason only where something differs, and the keyboard starts on Post', async () => {
    sheet([line(1, 'Alcohol swab', { counted: '14.000', qty_when_counted: '14.000', difference: '0.000', is_counted: 1 })]);
    Object.assign(world.tables['counts']?.[0] ?? {}, { counted_lines: 1, uncounted: 0, differences: 0 });
    render(<CountSheet t={t} countId="5" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Post count' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByLabelText('Reason')).toBeNull();
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Post count' }));
  });

  it('gives a clerk the fields and no Post, and a viewer neither', async () => {
    sheet();
    world.cannot = new Set(['move:counts:posting', 'move:counts:cancelled', 'move:counts:reversing']);
    const first = render(<CountSheet t={t} countId="5" />);
    expect(await screen.findByLabelText('Counted, Alcohol swab')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Post count' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel count' })).toBeNull();
    expect(screen.getByText('Ask a stock manager to post this count')).toBeTruthy();
    first.unmount();
    world.cannot.add('create:count_marks');
    render(<CountSheet t={t} countId="5" />);
    await screen.findByRole('group', { name: 'Alcohol swab' });
    expect(screen.queryByLabelText('Counted, Alcohol swab')).toBeNull();
    expect(screen.queryByText('Ask a stock manager to post this count')).toBeNull();
  });

  it('shows no value to someone who may not read it, and asks for none', async () => {
    sheet();
    world.unreadable = { count_lines: ['value'], counts: ['value'] };
    render(<CountSheet t={t} countId="5" />);
    await screen.findByRole('group', { name: 'Alcohol swab' });
    expect(screen.queryByText('Value')).toBeNull();
    for (const call of world.calls) expect(JSON.stringify(call.options ?? {})).not.toContain('"value"');
    expect(screen.getByText('0 differences')).toBeTruthy();
  });
});

describe('starting a count', () => {
  const levels = (count: number) => Array.from({ length: count }, (_unused, index) => ({ id: index + 1, stock_point_id: index + 1, place_id: 1, item_name: `Item ${String(count - index).padStart(4, '0')}`, unassigned: false, qty: '1.000' }));

  it('reads the levels its scope names, by item name, and leaves out an unassigned level at zero', async () => {
    resetWorld();
    seed('levels', [...levels(3), { id: 9, stock_point_id: 9, place_id: 1, item_name: 'Empty', unassigned: true, qty: '0.000' }, { id: 10, stock_point_id: 10, place_id: 2, item_name: 'Elsewhere', unassigned: false, qty: '5.000' }]);
    seed('stock_points', [
      { id: 1, place_id: 1, category_id: 4, needs_count: false, last_counted_at: '2026-01-01T00:00:00Z' },
      { id: 2, place_id: 1, category_id: 5, needs_count: true, last_counted_at: '2026-09-30T00:00:00Z' },
      { id: 3, place_id: 1, category_id: 5, needs_count: false, last_counted_at: null },
    ]);
    expect(await levelsInScope(world_reads(), { placeId: '1', scope: 'all' })).toEqual(['3', '2', '1']);
    expect(await levelsInScope(world_reads(), { placeId: '1', scope: 'category', categoryId: '5' })).toEqual(['3', '2']);
    expect(await levelsInScope(world_reads(), { placeId: '1', scope: 'to_check' })).toEqual(['2']);
    // Not counted since the day the setting names — and never counted at all.
    expect(await levelsInScope(world_reads(), { placeId: '1', scope: 'stale', before: '2026-07-03T00:00:00Z' })).toEqual(['3', '1']);
  });

  it('makes the count with its lines in one save, and a place of 1,200 levels as two counts', async () => {
    seed('places', [{ id: 1, name: 'Shop floor', active: true }]);
    seed('categories', []);
    seed('settings', [{ id: 1, default_place_id: 1, count_stale_days: 90 }]);
    seed('counts', []);
    seed('levels', levels(1200));
    render(<CountsList t={t} startOpen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
    await waitFor(() => expect(world.navigated).toHaveLength(1));
    const made = world.calls.filter((call) => call.kind === 'tree');
    expect(made.map((call) => (call.values as { children: { count_lines: unknown[] } }).children.count_lines.length)).toEqual([COUNT_MAX, 200]);
    // A line is a level's key and nothing else: every other column is Adminium's.
    expect((made[0]?.values as { values: unknown; children: { count_lines: { values: unknown }[] } }).values).toEqual({ place_id: '1', scope: 'all' });
    expect((made[0]?.values as { children: { count_lines: { values: unknown }[] } }).children.count_lines[0]?.values).toEqual({ level_id: '1200' });
    expect(world.calls.some((call) => call.table === 'count_lines' && call.kind === 'create')).toBe(false);
    expect(world.toasts.at(-1)?.title).toBe('Count started for Shop floor as 2 counts');
    expect(world.navigated[0]?.to).toBe(`/add-ons/inventory/inventory-counts/${String(world.tables['counts']?.[0]?.['id'])}`);
  });

  it('shows no Start to someone who may not make a count', () => {
    seed('counts', []);
    seed('places', []);
    seed('categories', []);
    world.cannot.add('create:counts');
    render(<CountsList t={t} startOpen={false} />);
    expect(screen.queryByRole('button', { name: 'Start a count' })).toBeNull();
    expect(screen.getByText('No counts yet')).toBeTruthy();
  });
});

/** The stand-in world's reads, as the scope reader takes them. */
function world_reads() {
  return {
    list: async (table: string, options?: { filter?: readonly { column: string; op: string; value?: unknown }[]; page?: number; pageSize?: number }) => {
      const meets = (held: unknown, filter: { op: string; value?: unknown }): boolean =>
        filter.op === 'eq' ? String(held === true ? 1 : held === false ? 0 : held) === String(filter.value === true ? 1 : filter.value === false ? 0 : filter.value) : filter.op === 'in' ? (filter.value as unknown[]).map(String).includes(String(held)) : filter.op === 'lt' ? held !== null && String(held) < String(filter.value) : filter.op === 'empty' ? held === null : false;
      const rows = (world.tables[table] ?? []).filter((candidate) => (options?.filter ?? []).every((filter) => meets(candidate[filter.column], filter)));
      const size = options?.pageSize ?? 50;
      const start = ((options?.page ?? 1) - 1) * size;
      return { rows: rows.slice(start, start + size), hasMore: rows.length > start + size };
    },
    get: async () => null,
  };
}
