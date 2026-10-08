// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { wordsFor } from '../shared/messages.ts';
import { ISSUE, REFUSAL, SHARED } from '../strings/index.ts';
import { Refused, resetWorld, seed, world } from '../testing/host.tsx';
import { BATCH_MAX, partsOf } from './BatchTab.tsx';
import { Issue } from './Issue.tsx';

const t = wordsFor(SHARED, REFUSAL, ISSUE);

const ADJUSTS = { canChange: true, adjusts: [{ table: 'tbl_orders', tableLabel: 'Orders', owner: 'shop', enabled: true, state: 'live', adjust: {}, holding: 0, what: [{ table: 'tbl_products', ref: 'shop:products', label: 'Products', as: 'item' }, { table: 'tbl_tags', label: 'Tags', as: 'tag' }] }] };

beforeEach(() => {
  resetWorld();
  seed('settings', [{ id: 1, card_min: '10.00', card_max: '500.00', cards_paused: false }]);
  for (const table of ['gift_cards', 'card_actions', 'vouchers', 'voucher_batches', 'batch_chunks']) seed(table, []);
  world.api = (method, path) => {
    if (path.endsWith('/kit')) return { connectionId: 'c1' };
    if (path.includes('/adjusts')) return ADJUSTS;
    if (method === 'get' && path.includes('/data/c1/tbl_products')) return { data: [{ id: 7, name: 'Massage 60 min', price: '80.00' }, { id: 8, name: 'Massage 30 min' }].filter((row) => !path.includes('q=') || row.name.toLowerCase().includes(decodeURIComponent(/q=([^&]*)/.exec(path)?.[1] ?? '').toLowerCase())) };
    return {};
  };
});
afterEach(() => cleanup());

const desk = (): void => {
  for (const no of ['create:card_actions', 'move:gift_cards:cancel-card', 'create:voucher_batches']) world.cannot.add(no);
};
const viewer = (): void => {
  desk();
  world.cannot.add('create:vouchers');
};
const type = (label: RegExp | string, value: string): void => void fireEvent.change(screen.getByLabelText(label), { target: { value } });
const tab = (name: string): void => void fireEvent.click(screen.getByRole('tab', { name }));

describe('Issue', () => {
  it('the desk sees the voucher tab only, and a viewer is told their role cannot issue', async () => {
    desk();
    render(<Issue t={t} />);
    expect((await screen.findAllByRole('tab')).map((one) => one.textContent)).toEqual(['Voucher']);
    cleanup();
    viewer();
    render(<Issue t={t} />);
    expect(await screen.findByText('Your role cannot issue.')).toBeTruthy();
    expect(screen.queryAllByRole('tab')).toEqual([]);
    expect(screen.queryByRole('button', { name: /Issue|Make/ })).toBeNull();
  });

  it('opens on the tab asked for when the role has it, and closes to a path of the dashboard only', async () => {
    world.search = { tab: 'batch', back: '/pages/offers-vouchers' };
    render(<Issue t={t} />);
    expect((await screen.findByRole('tab', { name: 'Batch of codes' })).getAttribute('aria-selected')).toBe('true');
    cleanup();
    // The desk asking for the batch tab gets the one it has.
    desk();
    world.search = { tab: 'batch', back: 'https://elsewhere.example/steal' };
    render(<Issue t={t} />);
    expect((await screen.findByRole('tab', { name: 'Voucher' })).getAttribute('aria-selected')).toBe('true');
    type(/^Amount/, '5');
    type(/^Called/, 'Five off');
    fireEvent.click(screen.getByRole('radio', { name: 'Whoever holds it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Issue the voucher' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Done' }));
    expect(world.navigated).toEqual([{ to: '/add-ons/offers/offers-look-up' }]);
    for (const back of ['//elsewhere.example', '/a?b=c', 'javascript:alert(1)']) {
      cleanup();
      world.navigated = [];
      world.search = { back };
      render(<Issue t={t} />);
      type(/^Amount/, '5');
      type(/^Called/, 'Five off');
      fireEvent.click(screen.getByRole('radio', { name: 'Whoever holds it' }));
      fireEvent.click(screen.getByRole('button', { name: 'Issue the voucher' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Done' }));
      expect(world.navigated, back).toEqual([{ to: '/add-ons/offers/offers-look-up' }]);
    }
  });

  it('a card by hand asks why, and is made with its first value in one save', async () => {
    world.once = (table, row) => (table === 'gift_cards' ? [{ table: 'gift_cards', key: String(row['id']), column: 'code', value: 'GC-7K2MW3HNQ4XP', print: 'tok-1' }] : []);
    render(<Issue t={t} />);
    fireEvent.click(await screen.findByRole('button', { name: '50.00' }));
    type(/^For/, 'Ana');
    type(/^Email/, 'ana@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Issue the card' }));
    expect(await screen.findByText('Say why.')).toBeTruthy();
    expect(screen.getByText('1 thing needs fixing')).toBeTruthy();
    expect(world.calls.some((call) => call.kind === 'tree')).toBe(false);
    type(/^Why/, 'Sold at the counter');
    fireEvent.click(screen.getByRole('radio', { name: 'Card' }));
    fireEvent.click(screen.getByRole('button', { name: 'Issue the card' }));
    expect(await screen.findByText('Gift card issued')).toBeTruthy();
    expect(world.calls.filter((call) => call.kind === 'tree')).toEqual([
      {
        kind: 'tree',
        table: 'gift_cards',
        values: {
          values: { kind: 'card', recipient_name: 'Ana', recipient_email: 'ana@example.com', sender_name: null, message: null, send_on: null, language: 'en-US' },
          children: { card_actions: [{ values: { action: 'issue', amount: '50', paid_by: 'card', reason: 'Sold at the counter' } }] },
        },
      },
    ]);
  });

  it('the code shows in three groups of four, once, and printing hands over the one-use token', async () => {
    world.once = (table, row) => (table === 'gift_cards' ? [{ table: 'gift_cards', key: String(row['id']), column: 'code', value: 'GC-7K2MW3HNQ4XP', print: 'tok-1' }] : []);
    render(<Issue t={t} />);
    type(/^Amount/, '25');
    type(/^Why/, 'Sold at the counter');
    fireEvent.click(await screen.findByRole('radio', { name: "Don't send, I'll print it" }));
    fireEvent.click(screen.getByRole('button', { name: 'Issue the card' }));
    const chips = await screen.findByRole('group', { name: 'The code' });
    expect([...chips.children].map((chip) => chip.textContent)).toEqual(['GC', '-7K2M', '-W3HN', '-Q4XP']);
    expect(chips.getAttribute('dir')).toBe('ltr');
    expect(screen.getByText('The full code is shown only this once.')).toBeTruthy();
    expect(screen.getByText('Not sent')).toBeTruthy();
    // "Don't send" keeps no address.
    expect((world.calls.find((call) => call.kind === 'tree')?.values as { values: Record<string, unknown> }).values['recipient_email']).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Print' }));
    await waitFor(() => expect(world.calls.some((call) => call.kind === 'document')).toBe(true));
    expect(world.calls.find((call) => call.kind === 'document')).toMatchObject({ table: 'gift_cards', values: 'gift-card', options: { print: true, once: 'tok-1', values: { first: '1' } } });
    // The code went nowhere but the screen.
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(JSON.stringify(world.navigated)).not.toMatch(/7K2M|Q4XP/);
  });

  it('a card to send needs an address, a dated one a day from tomorrow, and an amount inside the limits', async () => {
    render(<Issue t={t} />);
    type(/^Amount/, '5');
    type(/^Why/, 'x');
    fireEvent.click(await screen.findByRole('radio', { name: 'On a date' }));
    fireEvent.click(screen.getByRole('button', { name: 'Issue the card' }));
    expect(await screen.findByText('3 things need fixing')).toBeTruthy();
    expect(screen.getAllByText('From 10.00 to 500.00').length).toBeGreaterThan(1);
    expect(screen.getByText('Enter an email, or choose not to send it.')).toBeTruthy();
    expect(screen.getByText('Choose a day from tomorrow on.')).toBeTruthy();
    type(/^Amount/, '500.01');
    type(/^Email/, 'not-an-address');
    fireEvent.click(screen.getByRole('button', { name: 'Issue the card' }));
    expect(await screen.findByText('This is not an email address.')).toBeTruthy();
    expect(screen.getByText('3 things need fixing')).toBeTruthy();
    expect(world.calls.some((call) => call.kind === 'tree')).toBe(false);
  });

  it('a refused card keeps what was typed and says why; while cards are brought in from the till it says so', async () => {
    seed('settings', [{ id: 1, card_min: '10.00', card_max: '500.00', cards_paused: true }]);
    world.before = (kind) => {
      if (kind === 'tree') throw new Refused('POSTING_REFUSED', '', { reason: 'not-allowed' });
    };
    render(<Issue t={t} />);
    type(/^Amount/, '25');
    type(/^Why/, 'Sold at the counter');
    fireEvent.click(await screen.findByRole('radio', { name: "Don't send, I'll print it" }));
    fireEvent.click(screen.getByRole('button', { name: 'Issue the card' }));
    expect(await screen.findByText('Gift cards are being brought in from the till. Try again when that has finished.')).toBeTruthy();
    expect((screen.getByLabelText(/^Why/) as HTMLTextAreaElement).value).toBe('Sold at the counter');
    expect((screen.getByLabelText(/^Amount/) as HTMLInputElement).value).toBe('25');
  });

  it('a named voucher needs an address', async () => {
    render(<Issue t={t} />);
    tab('Voucher');
    type(/^Amount/, '5');
    type(/^Called/, 'Five off');
    fireEvent.click(screen.getByRole('button', { name: 'Issue the voucher' }));
    expect(await screen.findByText('A voucher for a named person needs their email.')).toBeTruthy();
    expect(world.calls.some((call) => call.kind === 'create')).toBe(false);
    type(/^Email/, 'ana@example.com');
    type(/^Name/, 'Ana');
    fireEvent.click(screen.getByRole('button', { name: 'Issue the voucher' }));
    await waitFor(() => expect(world.calls.some((call) => call.kind === 'create')).toBe(true));
    expect(world.calls.find((call) => call.kind === 'create')).toMatchObject({ table: 'vouchers', values: { worth: 'amount', value: '5', uses_total: 1, public_name: 'Five off', holder_name: 'Ana', holder_email: 'ana@example.com', expires_on: null, note: null } });
  });

  it("a voucher's code shows VC or PK from its worth, and a pack is so many uses of a thing picked by search", async () => {
    world.once = (table, row) => (table === 'vouchers' ? [{ table: 'vouchers', key: String(row['id']), column: 'code', value: 'AAAABBBB7K2M', print: 'tok-9' }] : []);
    render(<Issue t={t} />);
    tab('Voucher');
    fireEvent.click(screen.getByRole('radio', { name: /^A pack/ }));
    type(/^Called/, '10 massages');
    fireEvent.click(screen.getByRole('radio', { name: 'Whoever holds it' }));
    // Nothing picked yet, and eleven is fine but one is not a pack.
    type(/^Uses/, '1');
    fireEvent.click(screen.getByRole('button', { name: 'Issue the voucher' }));
    expect(await screen.findByText('Choose what it is for.')).toBeTruthy();
    expect(screen.getByText('A pack has from 2 to 50 uses.')).toBeTruthy();
    // Only tables whose rows are things are offered: a tag is no row.
    const from = await screen.findByLabelText(/^From/);
    expect([...from.querySelectorAll('option')].map((option) => option.textContent)).toEqual(['Choose…', 'Products']);
    fireEvent.change(from, { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText(/^What it is for/), { target: { value: '60' } });
    fireEvent.click(await screen.findByRole('option', { name: 'Massage 60 min' }));
    expect(screen.queryByRole('option', { name: 'Massage 30 min' })).toBeNull();
    type(/^Uses/, '10');
    fireEvent.click(screen.getByRole('button', { name: 'Issue the voucher' }));
    expect(await screen.findByText('Pack issued')).toBeTruthy();
    expect(world.calls.find((call) => call.kind === 'create')).toMatchObject({ table: 'vouchers', values: { worth: 'pack', what: 'item', source_table: 'shop:products', source_row: '7', uses_total: 10, holder_email: null } });
    expect([...screen.getByRole('group', { name: 'The code' }).children].map((chip) => chip.textContent)).toEqual(['PK', '-AAAA', '-BBBB', '-7K2M']);
    fireEvent.click(screen.getByRole('button', { name: 'Print' }));
    await waitFor(() => expect(world.calls.find((call) => call.kind === 'document')).toMatchObject({ table: 'vouchers', values: 'voucher', options: { once: 'tok-9' } }));
    cleanup();

    world.calls = [];
    render(<Issue t={t} />);
    tab('Voucher');
    type(/^Amount/, '5');
    type(/^Called/, 'Five off');
    fireEvent.click(screen.getByRole('radio', { name: 'Whoever holds it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Issue the voucher' }));
    expect([...(await screen.findByRole('group', { name: 'The code' })).children].map((chip) => chip.textContent)).toEqual(['VC', '-AAAA', '-BBBB', '-7K2M']);
  });

  it('a batch is cut into parts of five hundred', () => {
    expect(partsOf(1200)).toEqual([500, 500, 200]);
    expect(partsOf(500)).toEqual([500]);
    expect(partsOf(501)).toEqual([500, 1]);
    expect(partsOf(1)).toEqual([1]);
    expect(partsOf(BATCH_MAX)).toHaveLength(10);
  });

  const batch = (count: string): void => {
    tab('Batch of codes');
    type(/^Name of the batch/, 'Leaflet drop, October');
    type(/^How many/, count);
    type(/^Amount/, '5');
    type(/^Called/, 'Five off');
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: '2099-11-30' } });
  };

  it('a batch is sent as chunks and a chunk not run is sent again', async () => {
    let calls = 0;
    world.createEach = (_table, rows) => {
      calls += 1;
      // The first time the middle part runs out of time; sent again, it is made.
      return rows.map((row, index) => (calls === 1 && index === 1 ? { key: String(index), ok: false, notRun: true } : { key: String(index), ok: true, row: { id: 100 + index, ...row } }));
    };
    render(<Issue t={t} />);
    batch('1200');
    expect(screen.getByText('1200 codes, each good once, until Nov 30, 2099')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Make the codes' }));
    expect(await screen.findByText('1200 codes made')).toBeTruthy();
    expect(world.calls.find((call) => call.kind === 'create')).toMatchObject({ table: 'voucher_batches', values: { name: 'Leaflet drop, October', count: 1200, worth: 'amount', value: '5', public_name: 'Five off', expires_on: '2099-11-30' } });
    const id = world.tables['voucher_batches']?.[0]?.['id'];
    expect(world.calls.filter((call) => call.kind === 'createEach').map((call) => call.values)).toEqual([
      [{ batch_id: id, size: 500 }, { batch_id: id, size: 500 }, { batch_id: id, size: 200 }],
      [{ batch_id: id, size: 500 }],
    ]);
  });

  it('a part refused twice is not sent a third time: the sheet says how many were made and where to finish', async () => {
    world.createEach = (_table, rows) => rows.map((row, index) => (row['size'] === 200 ? { key: String(index), ok: false, error: { code: 'WRITE_CONFLICT', message: '' } } : { key: String(index), ok: true, row: { id: 100 + index, ...row } }));
    render(<Issue t={t} />);
    batch('1200');
    fireEvent.click(screen.getByRole('button', { name: 'Make the codes' }));
    expect(await screen.findByText('1000 of 1200 made. Finish it under Voucher batches.')).toBeTruthy();
    expect(world.calls.filter((call) => call.kind === 'createEach')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Open the batch' }).getAttribute('href')).toBe(`/pages/offers-voucher-batches/${String(world.tables['voucher_batches']?.[0]?.['id'])}`);
  });

  it('download asks Adminium for the file', async () => {
    render(<Issue t={t} />);
    batch('200');
    fireEvent.click(screen.getByRole('button', { name: 'Make the codes' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Download the codes (CSV)' }));
    await waitFor(() => expect(world.calls.some((call) => call.kind === 'download')).toBe(true));
    const id = world.tables['voucher_batches']?.[0]?.['id'];
    expect(world.calls.find((call) => call.kind === 'export')).toEqual({ kind: 'export', table: 'vouchers', options: { filter: [{ column: 'batch_id', op: 'eq', value: id }], columns: ['code', 'public_name', 'worth', 'value', 'expires_on'], format: 'csv' } });
    expect(world.calls.find((call) => call.kind === 'download')).toMatchObject({ key: 'export-1' });
    // Nothing was read to build a file here: no list of the vouchers was asked for.
    expect(world.calls.some((call) => call.kind === 'list' && call.table === 'vouchers')).toBe(false);
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('a batch needs a name, a count within five thousand and a last day', async () => {
    render(<Issue t={t} />);
    tab('Batch of codes');
    type(/^How many/, '5001');
    fireEvent.click(screen.getByRole('button', { name: 'Make the codes' }));
    expect(await screen.findByText('Name the batch.')).toBeTruthy();
    expect(screen.getAllByText('From 1 to 5000').length).toBeGreaterThan(1);
    expect(screen.getByText('Say when the codes stop working.')).toBeTruthy();
    expect(world.calls.some((call) => call.kind === 'create' || call.kind === 'createEach')).toBe(false);
  });
});
