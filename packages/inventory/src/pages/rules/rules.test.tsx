// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { wordsFor } from '../shared/messages.ts';
import { Refused, api, resetWorld, seed, world } from '../testing/host.tsx';
import { Rules } from './Rules.tsx';

const t = wordsFor('shared', 'refusal', 'rules');

const app = { table: 'main.ordering_order_items', tableLabel: 'Order items', id: 'stock', action: 'hold', via: 'order_id', reserve: { on: { to: ['placed'] } }, post: { on: { to: ['preparing'] } }, map: { what: 'menu_item_id', quantity: 'qty' }, owner: 'online-ordering', enabled: true, state: 'live', holding: 2, unplanned: 0 };
const mine = { table: 'main.jobs', tableLabel: 'Jobs', id: 'stock-1', action: 'use-item', post: { on: { to: ['done'] } }, map: { item: 'item_id', quantity: { value: 1 } }, owner: null, enabled: true, state: 'live', holding: 0, unplanned: 3 };
const idle = { ...app, table: 'main.hotel_stays', tableLabel: 'Stays', owner: 'hotel-reservations', state: 'idle' };
const sources = {
  tables: [
    { table: 'main.jobs', label: 'Jobs', states: ['open', 'done'], columns: [{ name: 'item_id', label: 'Item', type: 'fk', decided: false }, { name: 'title', label: 'Title', type: 'text', decided: false }, { name: 'qty', label: 'Quantity', type: 'decimal', decided: false }], lineOf: [{ table: 'main.inventory_items', via: 'item_id' }] },
    { table: 'main.ordering_order_items', label: 'Order items', columns: [{ name: 'menu_item_id', label: 'Menu item', type: 'fk', decided: false }, { name: 'qty', label: 'Quantity', type: 'int', decided: false }] },
  ],
  actions: {},
  settings: [],
};

const sent: { verb: string; path: string; body?: unknown }[] = [];
function serve(canChange: boolean, postings: unknown[] = [app, mine, idle]): void {
  seed('settings', [{ id: 1 }]);
  seed('places', [{ id: 2, name: 'Shop floor', active: true }]);
  sent.length = 0;
  api['get'] = async (path) => {
    sent.push({ verb: 'get', path });
    if (path.endsWith('/kit')) return { connectionId: 'c1', tables: { items: { id: 'main.inventory_items' } } };
    if (path.includes('/postings?')) return { postings, canChange };
    if (path.includes('/sources?')) return sources;
    throw new Error(path);
  };
  for (const verb of ['put', 'patch', 'post', 'delete'] as const) {
    api[verb] = async (path, body) => {
      sent.push({ verb, path, body });
      return verb === 'patch' ? { enabled: false } : verb === 'post' && path.endsWith('/catch-up') ? { planned: 3, refused: [], left: 0 } : {};
    };
  }
}
const card = (title: string): HTMLElement => screen.getByText(title).closest('[data-part="card"]') as HTMLElement;

beforeEach(() => resetWorld());
afterEach(() => cleanup());

describe('Stock rules', () => {
  it('without the permission every card is fixed and nothing can be added', async () => {
    serve(false);
    render(<Rules t={t} />);
    expect(await screen.findByText('Only someone who may change how tables work can change these rules.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add a rule' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    for (const control of screen.getAllByRole('switch')) expect((control as HTMLInputElement).disabled).toBe(true);
    // The waiting saves are told, with no button to record them.
    expect(within(card('Jobs')).getByText('3 saves are waiting')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Record them now' })).toBeNull();
    // What may be changed is Adminium's to say (`canChange`); the pickers are not even read.
    expect(sent.some((call) => call.path.includes('/sources'))).toBe(false);
  });

  it('draws an app\'s rule first, then the owner\'s, each as sentences made from the rule, and no rule that does nothing', async () => {
    serve(true);
    render(<Rules t={t} />);
    await screen.findByText('Order items');
    expect(screen.getAllByText(/^(Order items|Jobs|Stays)$/).map((node) => node.textContent)).toEqual(['Order items', 'Jobs']);
    const theirs = card('Order items');
    expect(within(theirs).getByText('From Online ordering')).toBeTruthy();
    expect(within(theirs).getByText('When its order_id moves to placed, hold the stock.')).toBeTruthy();
    expect(within(theirs).getByText('When its order_id moves to preparing, take Quantity of Menu item.')).toBeTruthy();
    expect(within(theirs).getByText('Set by Online ordering. You can switch it off; its steps change only with an update of Online ordering.')).toBeTruthy();
    // An app's rule is switched, never edited.
    expect(within(theirs).queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(within(card('Jobs')).getByText('Your table')).toBeTruthy();
    expect(within(card('Jobs')).getByText('When the row moves to done, take 1 of Item.')).toBeTruthy();
    expect(within(card('Jobs')).getByRole('button', { name: 'Edit' })).toBeTruthy();
  });

  it('switches a rule off through its own route and says what Adminium answered', async () => {
    serve(true);
    render(<Rules t={t} />);
    fireEvent.click(await screen.findByRole('switch', { name: 'Order items rule' }));
    await waitFor(() => expect(world.toasts.at(-1)?.title).toBe('Order items rule switched off'));
    expect(sent.find((call) => call.verb === 'patch')).toEqual({ verb: 'patch', path: '/api/v1/connections/c1/tables/main.ordering_order_items/postings/stock/switch', body: { enabled: false } });
  });

  it('records the waiting saves when asked', async () => {
    serve(true);
    render(<Rules t={t} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Record them now' }));
    await waitFor(() => expect(sent.find((call) => call.verb === 'post')).toEqual({ verb: 'post', path: '/api/v1/ledgers/inventory/stock/catch-up', body: { connectionId: 'c1' } }));
  });

  it('adds a rule: nothing is sent while neither Hold nor Take is chosen, then the rule goes whole to its own address', async () => {
    serve(true, [app]);
    render(<Rules t={t} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add a rule' }));
    const sheet = screen.getByRole('dialog');
    fireEvent.change(within(sheet).getByLabelText(/^Table/), { target: { value: 'main.jobs' } });
    fireEvent.click(within(sheet).getByRole('radio', { name: /A linked column/ }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save rule' }));
    expect(await within(sheet).findByText('Choose when stock is held or taken')).toBeTruthy();
    expect(sent.some((call) => call.verb === 'put')).toBe(false);
    fireEvent.change(within(sheet).getByLabelText('Take'), { target: { value: 'moves' } });
    fireEvent.click(within(sheet).getByRole('switch', { name: 'done' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save rule' }));
    await waitFor(() => expect(sent.some((call) => call.verb === 'put')).toBe(true));
    // A column into Inventory's own items names the stock item itself.
    expect(sent.find((call) => call.verb === 'put')).toEqual({ verb: 'put', path: '/api/v1/connections/c1/tables/main.jobs/postings/stock-1', body: { into: { addOn: 'inventory', ledger: 'stock', action: 'use-item' }, post: { on: { to: ['done'] } }, map: { item: 'item_id', quantity: { value: 1 } } } });
  });

  it('says how many rows hold stock when a rule cannot be removed', async () => {
    serve(true, [mine]);
    api['delete'] = async () => {
      throw new Refused('POSTING_REFUSED', '', { reason: 'receipt-open', rows: 4 });
    };
    render(<Rules t={t} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    const sheet = screen.getByRole('dialog');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Remove rule' }));
    fireEvent.click(within(within(sheet).getByText('Remove this rule? Rows of this table stop taking from stock.').closest('[data-part="alert"]') as HTMLElement).getByRole('button', { name: 'Remove rule' }));
    expect(await within(sheet).findByText('4 rows are holding stock: put them back first')).toBeTruthy();
  });
});
