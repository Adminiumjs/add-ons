// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { wordsFor } from '../shared/messages.ts';
import { REFUSAL, RULES, SHARED } from '../strings/index.ts';
import { Refused, resetWorld, world } from '../testing/host.tsx';
import { EMPTY, cardsOf, formOf, formProblems, sentOf, type Form, type Posted, type Priced } from './rule.ts';
import { Rules } from './Rules.tsx';

const t = wordsFor(SHARED, REFUSAL, RULES);

const column = (name: string, type: string, more: Record<string, unknown> = {}): Record<string, unknown> => ({ name, label: name.replaceAll('_', ' '), type, decided: false, ...more });
const SOURCES = {
  tables: [
    { table: 'orders', label: 'Orders', states: ['open', 'paid', 'cancelled'], columns: [column('id', 'int'), column('status', 'enum', { enum: ['open', 'paid', 'cancelled'] }), column('due', 'money', { decided: true })] },
    { table: 'order_lines', label: 'Order lines', columns: [column('id', 'int'), column('order_id', 'fk'), column('item_id', 'fk'), column('unit_price', 'money'), column('qty', 'int'), column('gift_card_id', 'fk'), column('sold_voucher_id', 'fk'), column('tax_later', 'bool')], lineOf: [{ table: 'orders', via: 'order_id' }, { table: 'items', via: 'item_id' }, { table: 'tbl_cards', via: 'gift_card_id' }, { table: 'tbl_vouchers', via: 'sold_voucher_id' }] },
    { table: 'items', label: 'Items', columns: [column('id', 'int'), column('name', 'text')] },
    { table: 'payments', label: 'Payments', columns: [column('id', 'int'), column('order_id', 'fk'), column('card_id', 'fk'), column('amount', 'money'), column('card_left', 'money'), column('voided_at', 'timestamptz')], lineOf: [{ table: 'orders', via: 'order_id' }, { table: 'tbl_cards', via: 'card_id' }] },
    { table: 'refunds', label: 'Refunds', columns: [column('id', 'int'), column('payment_id', 'fk'), column('amount', 'money')], lineOf: [{ table: 'payments', via: 'payment_id' }] },
  ],
};
const APP_ADJUST: Priced = { table: 'shop_orders', tableLabel: 'Shop orders', owner: 'online-ordering', ownerName: 'Online ordering', enabled: true, state: 'live', holding: 3, adjust: { by: { addOn: 'offers' }, lines: [{ table: 'shop_lines', via: 'order_id', price: 'unit_price', discount: 'discount', what: [] }], order: { discount: 'discount' }, uses: 'uses' } };
const APP_USES: Posted = { id: 'uses', action: 'redeem', table: 'shop_orders', tableLabel: 'Shop orders', owner: 'online-ordering', enabled: true, state: 'live', holding: 2, post: { on: { to: ['paid'] } }, reverse: { on: { to: ['cancelled'] } }, map: {} };
const OWN_PAYS: Posted = { id: 'offers-card', action: 'spend', table: 'payments', tableLabel: 'Payments', owner: null, enabled: true, state: 'live', holding: 4, via: 'order_id', post: { on: { create: true } }, reverse: { on: { column: 'voided_at', set: true, own: true } }, map: { card: 'card_id', amount: 'amount', balance_after: 'card_left', due: { parent: 'due' } } };
const MOVED: Posted = { id: 'moved', action: 'move', table: 'pos_card_rows', tableLabel: 'Till card rows', owner: 'point-of-sale', enabled: true, state: 'live', holding: 0, map: {} };
// One of the add-on's own tables posting into its own ledger, under an action a card would be drawn for.
const OWN_HAND: Posted = { id: 'card-action', action: 'issue', table: 'tbl_actions', tableLabel: 'Card actions', owner: 'offers', enabled: true, state: 'live', holding: 0, map: {} };

let adjusts: Priced[] = [];
let postings: Posted[] = [];
let canChange = true;
beforeEach(() => {
  resetWorld();
  adjusts = [APP_ADJUST];
  postings = [APP_USES, OWN_PAYS, MOVED, OWN_HAND];
  canChange = true;
  world.api = (method, path) => {
    if (method !== 'get') return {};
    if (path.endsWith('/kit')) return { connectionId: 'c1', tables: { gift_cards: { id: 'tbl_cards' }, vouchers: { id: 'tbl_vouchers' }, card_actions: { id: 'tbl_actions' } }, hosts: [{ tableRef: 'shop:payments', id: 'payments' }] };
    if (path.includes('/adjusts')) return { adjusts, canChange };
    if (path.includes('/postings')) return { postings, canChange };
    if (path.includes('/sources')) return SOURCES;
    return {};
  };
});
afterEach(() => cleanup());

const writes = (): { call: string; body: unknown }[] => world.calls.filter((call) => call.kind === 'api' && !call.table.startsWith('get ')).map((call) => ({ call: call.table, body: call.values }));
const card = async (table: string): Promise<HTMLElement> => (await screen.findAllByText(table)).map((node) => node.closest('[data-part="card"]')).find((node) => node !== null) as HTMLElement;
const choose = (label: RegExp, value: string): void => void fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('offer rules as they are stored and said', () => {
  it("draws a table's price rule with the posting that records its uses as one card, and leaves out what nobody set", () => {
    const cards = cardsOf([APP_ADJUST], [APP_USES, OWN_PAYS, MOVED, { ...OWN_PAYS, id: 'idle', table: 'other', tableLabel: 'Other', state: 'idle' }]);
    expect(cards.map((one) => `${one.tableLabel}: ${one.kind}`)).toEqual(['Payments: pays', 'Shop orders: discounts', 'Till card rows: moved']);
    // What the two hold together.
    expect(cards.find((one) => one.kind === 'discounts')?.holding).toBe(5);
  });

  it('says what a form cannot send yet, part by part', () => {
    const form = (patch: Partial<Form>): Form => ({ ...EMPTY, ...patch });
    expect(formProblems(form({}))).toEqual(['table', 'lines', 'price', 'item', 'lineDiscount', 'orderDiscount']);
    // With Adminium adding the amounts, only what it cannot guess is asked for.
    expect(formProblems(form({ table: 'orders', making: { amounts: true, codes: false } }))).toEqual(['lines', 'price', 'item']);
    expect(formProblems(form({ kind: 'pays', table: 'payments', cols: { card: 'card_id', amount: 'amount', balanceAfter: 'card_left' } }))).toEqual(['when']);
    expect(formProblems(form({ kind: 'pays', table: 'payments', cols: { card: 'card_id', amount: 'amount', balanceAfter: 'card_left', refunds: 'refunds' }, when: { kind: 'create' } }))).toEqual(['refunds']);
    expect(formProblems(form({ kind: 'sells-cards', table: 'order_lines', cols: { card: 'gift_card_id', amount: 'unit_price' }, when: { kind: 'moves', to: [] } }))).toEqual(['when']);
    expect(formProblems(form({ kind: 'sells-vouchers', table: 'order_lines', cols: { voucher: 'sold_voucher_id', amount: 'unit_price' }, when: { kind: 'moves', to: ['paid'] } }))).toEqual([]);
  });

  it('a rule read back into the form sends the same rule again', () => {
    const [pays] = cardsOf([], [OWN_PAYS]);
    const form = formOf(pays!);
    expect(form).toMatchObject({ kind: 'pays', table: 'payments', cols: { card: 'card_id', amount: 'amount', balanceAfter: 'card_left', order: 'order_id', due: 'due' }, when: { kind: 'create' }, back: { kind: 'set', column: 'voided_at', own: true } });
    expect(sentOf(form!, (table) => table).postings).toEqual([{ table: 'payments', id: 'offers-card', body: { into: { addOn: 'offers', ledger: 'value', action: 'spend' }, via: 'order_id', post: { on: { create: true } }, reverse: { on: { column: 'voided_at', set: true, own: true } }, map: OWN_PAYS.map } }]);
    // An app's price rule can be read, never an old till's rows.
    expect(formOf(cardsOf([APP_ADJUST], [APP_USES])[0]!)).toMatchObject({ kind: 'discounts', cols: { lines: 'shop_lines order_id', price: 'unit_price', lineDiscount: 'discount', orderDiscount: 'discount' }, when: { kind: 'moves', to: ['paid'] } });
    expect(formOf(cardsOf([], [MOVED])[0]!)).toBeNull();
  });
});

describe('Offer rules', () => {
  it('shows each rule as a sentence made from the rule, with whose it is', async () => {
    render(<Rules t={t} />);
    const shop = await card('Shop orders');
    expect(within(shop).getByText('Takes discounts')).toBeTruthy();
    expect(within(shop).getByText('From Online ordering')).toBeTruthy();
    expect(within(shop).getByText('Discounts and codes are worked out for each row, line by line from shop_lines.')).toBeTruthy();
    expect(within(shop).getByText('What was used is recorded when it moves to paid, and given back when it moves to cancelled.')).toBeTruthy();
    expect(within(shop).getByText('5 rows are holding a use or a card payment.')).toBeTruthy();
    const pays = await card('Payments');
    expect(within(pays).getByText('Your table')).toBeTruthy();
    expect(within(pays).getByText('A row that names a gift card in card id is paid from the card when the row is created; what the card paid is written to amount.')).toBeTruthy();
    expect(within(pays).getByText('It is undone when voided at is set.')).toBeTruthy();
    // An app's rule is locked; the place's own can be changed. The old till's rows have no switch at all.
    expect(within(shop).queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(within(pays).getByRole('button', { name: 'Edit' })).toBeTruthy();
    const moved = await card('Till card rows');
    expect(within(moved).queryByRole('switch')).toBeNull();
    expect(within(moved).queryByRole('button', { name: 'Edit' })).toBeNull();
    // How a hand action posts is how Offers works: no card for it.
    expect(screen.queryByText('Card actions')).toBeNull();
  });

  it('without the permission every card is read-only', async () => {
    canChange = false;
    render(<Rules t={t} />);
    await card('Payments');
    expect(screen.getByText("Only someone who may change how Adminium works out a table's columns can change these.")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add a rule' })).toBeNull();
    expect(screen.queryAllByRole('button', { name: 'Edit' })).toEqual([]);
    for (const toggle of screen.getAllByRole('switch')) expect((toggle as HTMLInputElement).disabled).toBe(true);
    // The pickers are not read for someone who cannot use them.
    expect(world.calls.some((call) => call.kind === 'api' && call.table.includes('/sources'))).toBe(false);
  });

  it('switches a price rule and a posting off through their own routes', async () => {
    render(<Rules t={t} />);
    fireEvent.click(within(await card('Shop orders')).getByRole('switch'));
    await waitFor(() => expect(writes()).toHaveLength(1));
    fireEvent.click(within(await card('Payments')).getByRole('switch'));
    await waitFor(() => expect(writes()).toHaveLength(2));
    expect(writes()).toEqual([
      { call: 'patch /api/v1/connections/c1/tables/shop_orders/adjust/switch', body: { enabled: false } },
      { call: 'patch /api/v1/connections/c1/tables/payments/postings/offers-card/switch', body: { enabled: false } },
    ]);
  });

  it('remove is refused while rows hold and says how many', async () => {
    render(<Rules t={t} />);
    fireEvent.click(within(await card('Payments')).getByRole('button', { name: 'Edit' }));
    const sheet = await screen.findByRole('dialog');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Remove rule' }));
    // Asked first.
    expect(writes()).toEqual([]);
    const working = world.api;
    world.api = (method, path, payload) => {
      if (method === 'delete') throw new Refused('POSTING_REFUSED', '', { reason: 'receipt-open', rows: 4 });
      return working?.(method, path, payload);
    };
    fireEvent.click(within(within(sheet).getByText(/^Remove this rule\?/).closest('[data-part="alert"]') as HTMLElement).getByRole('button', { name: 'Remove rule' }));
    expect(await within(sheet).findByText('4 rows are holding a use or a card payment: put them back first.')).toBeTruthy();
    expect(writes()).toEqual([{ call: 'delete /api/v1/connections/c1/tables/payments/postings/offers-card', body: undefined }]);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('adds a card payment rule, with its refunds, as postings of the tables picked', async () => {
    postings = [];
    adjusts = [];
    render(<Rules t={t} />);
    expect(await screen.findByText('No table has anything to do with offers yet')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add a rule' }));
    fireEvent.click(await screen.findByRole('radio', { name: /^Takes a gift card as payment/ }));
    choose(/^Table/, 'payments');
    // Nothing chosen: every part that is missing is marked, and nothing is sent.
    fireEvent.click(screen.getByRole('button', { name: 'Save rule' }));
    expect((await screen.findAllByText('Choose a column.')).length).toBe(3);
    expect(writes()).toEqual([]);
    // Only a link to Gift cards can be the card; only a money column Adminium may write can be what it paid.
    expect([...screen.getByLabelText(/^The gift card that pays/).querySelectorAll('option')].map((option) => option.textContent)).toEqual(['Choose a column', 'card id']);
    choose(/^The gift card that pays/, 'card_id');
    choose(/^What the card paid/, 'amount');
    choose(/^What the card holds afterwards/, 'card_left');
    choose(/^The row it belongs to/, 'order_id');
    choose(/^What is still to pay/, 'due');
    choose(/^The card pays/, 'create');
    choose(/^It is undone/, 'set');
    choose(/^It is undone: which column/, 'voided_at');
    choose(/^Money given back is a row of/, 'refunds');
    choose(/^Its link to the payment/, 'payment_id');
    choose(/^The amount given back/, 'amount');
    expect(screen.getByText('A row that names a gift card in card id is paid from the card when the row is created; what the card paid is written to amount.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save rule' }));
    await waitFor(() => expect(world.toasts.map((toast) => toast.title)).toEqual(['Rule added for Payments']));
    expect(writes()).toEqual([
      { call: 'put /api/v1/connections/c1/tables/payments/postings/offers-card', body: { into: { addOn: 'offers', ledger: 'value', action: 'spend' }, via: 'order_id', post: { on: { create: true } }, reverse: { on: { column: 'voided_at', set: true, own: true } }, map: { card: 'card_id', amount: 'amount', balance_after: 'card_left', due: { parent: 'due' } } } },
      // The refund names the payments table by its stored name.
      { call: 'put /api/v1/connections/c1/tables/refunds/postings/offers-card-back', body: { into: { addOn: 'offers', ledger: 'value', action: 'refund' }, post: { on: { create: true } }, map: { against_table: { value: 'shop:payments' }, against_row: 'payment_id', amount: 'amount' } } },
    ]);
  });

  it('a table with no column for a part: Adminium says what it will add, and adds it with the rule in one save', async () => {
    postings = [];
    adjusts = [];
    const working = world.api;
    world.api = (method, path, payload) => {
      if (method === 'put' && path.endsWith('/adjust') && (payload as { dryRun?: true }).dryRun === true) return { checksum: 'sum-1', made: { columns: [{ table: 'order_lines', column: 'discount', type: 'money', made: true }, { table: 'orders', column: 'total', type: 'money', made: true }, { table: 'orders', column: 'status', type: 'enum', made: false }], tables: ['order_codes'], rules: [] }, refusals: [] };
      return working?.(method, path, payload);
    };
    render(<Rules t={t} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add a rule' }));
    choose(/^Table/, 'orders');
    choose(/^Its lines are rows of/, 'order_lines order_id');
    choose(/^The line's price/, 'unit_price');
    choose(/^The line's quantity/, 'qty');
    choose(/^What the line sells/, 'item_id');
    fireEvent.click(screen.getByRole('button', { name: 'Save rule' }));
    expect((await screen.findAllByText('Choose a column, or let Adminium add it.')).length).toBe(2);
    fireEvent.click(screen.getByRole('switch', { name: /^Make it: let Adminium add the amount/ }));
    fireEvent.click(screen.getByRole('switch', { name: /^Make it: add a table for the codes/ }));
    choose(/^The row is final/, 'moves');
    fireEvent.click(screen.getByRole('switch', { name: 'paid' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save rule' }));
    // First asked, nothing added: the sheet lists what will be made — and only what will be made.
    const plan = await screen.findByText('Adminium will add this, with the rule');
    expect((plan.closest('[data-part="alert"]') as HTMLElement).textContent).toContain('discount on Order lines, total on Orders, and the table order_codes');
    expect((plan.closest('[data-part="alert"]') as HTMLElement).textContent).not.toContain('status');
    expect(world.toasts).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Add these and save' }));
    await waitFor(() => expect(world.toasts.map((toast) => toast.title)).toEqual(['Rule added for Orders']));
    const adjust = { by: { addOn: 'offers' }, lines: [{ table: 'order_lines', via: 'order_id', price: 'unit_price', quantity: 'qty', discount: 'discount', what: [{ column: 'item_id', as: 'item' }] }], order: { discount: 'discount' }, codes: { table: 'order_codes', via: 'order_id', typed: 'typed', code: 'code_id', voucher: 'voucher_id', removed: 'removed_at' }, uses: 'offers-uses', frozen: { to: ['paid'] }, expect: 'total' };
    const make = { lineAmount: true, subtotal: true, discount: true, total: true, codes: { table: 'order_codes' } };
    const uses = { call: 'put /api/v1/connections/c1/tables/orders/postings/offers-uses', body: { into: { addOn: 'offers', ledger: 'value', action: 'redeem' }, post: { on: { to: ['paid'] } }, map: {} } };
    expect(writes()).toEqual([
      // The posting the rule names is stored before the rule, each time.
      uses,
      { call: 'put /api/v1/connections/c1/tables/orders/adjust', body: { adjust, make, dryRun: true } },
      uses,
      { call: 'put /api/v1/connections/c1/tables/orders/adjust', body: { adjust, make, checksum: 'sum-1' } },
    ]);
    // No schema route was ever called by the page.
    expect(world.calls.some((call) => call.kind === 'api' && /schema|columns|ddl/.test(call.table))).toBe(false);
  });

  it('a refusal lands in the sheet, which stays open with what was picked', async () => {
    render(<Rules t={t} />);
    fireEvent.click(within(await card('Payments')).getByRole('button', { name: 'Edit' }));
    const sheet = await screen.findByRole('dialog');
    const working = world.api;
    world.api = (method, path, payload) => {
      if (method === 'put') throw new Refused('POSTING_REFUSED', '', { reason: 'card-pays-card' });
      return working?.(method, path, payload);
    };
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save rule' }));
    expect(await within(sheet).findByText('A table that sells gift cards cannot also take a gift card as payment.')).toBeTruthy();
    expect((within(sheet).getByLabelText(/^The gift card that pays/) as HTMLSelectElement).value).toBe('card_id');
  });
});
