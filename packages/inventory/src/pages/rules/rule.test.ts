import { describe, expect, it } from 'vitest';

import { format } from '../testing/host.tsx';
import { EMPTY, formOf, formProblems, nextId, ruleOf, sentence, type Listed, type Names, type Rule, type SourceTable } from './rule.ts';

const t = (_key: string, fallback: string, args?: Record<string, unknown>): string => format(fallback, args);
const list = new Intl.ListFormat('en-US', { style: 'long', type: 'conjunction' });
const names = (labels: Record<string, string> = {}, parent?: string): Names => ({ column: (name) => labels[name] ?? name, ...(parent === undefined ? {} : { parent }), place: (id) => ({ '2': 'Shop floor' })[id] ?? id, list: (values) => list.format(values) });

describe("a rule's sentence", () => {
  it('reads an order that holds when placed, takes when preparing, and puts back from two states only', () => {
    // A line's rule, reached through its order: the manifest's own states, no app's name anywhere.
    const rule: Rule = { id: 'stock', action: 'hold', via: 'order_id', reserve: { on: { to: ['placed'] } }, post: { on: { to: ['preparing'] } }, reverse: { on: { to: ['cancelled'], from: ['placed', 'confirmed'] } }, map: { what: 'menu_item_id', quantity: 'qty' }, heldUntil: { parent: 'hold_until' } };
    expect(sentence(t, rule, names({ menu_item_id: 'Menu item', qty: 'Quantity' }, 'the order'))).toEqual(['When the order moves to placed, hold the stock.', 'When the order moves to preparing, take Quantity of Menu item.', 'When the order moves to cancelled from placed and confirmed, put it back.']);
  });

  it('reads a stay counted by its nights and guests, and a row that is the item itself', () => {
    const stay: Rule = { id: 'turnover', action: 'use', post: { on: { column: 'status', in: ['departed'] } }, map: { what: { row: true }, quantity: { value: 1 } }, multipliers: { night: 'nights', guest: 'guests' } };
    expect(sentence(t, stay, names({ status: 'Status', nights: 'Nights', guests: 'Guests' }))).toEqual(["When Status becomes departed, take this row's item.", 'Counting Nights and Guests.']);
  });

  it('reads a refund line that puts stock back on the shelf, a rule that fires when a column is filled, and one place', () => {
    const refund: Rule = { id: 'back', action: 'return', post: { on: { create: true } }, map: { what: 'ticket_item_id', quantity: 'qty' } };
    expect(sentence(t, refund, names({ ticket_item_id: 'Ticket line', qty: 'Qty' }))).toEqual(['When the row is created, put Qty of Ticket line back on the shelf.']);
    const owner: Rule = { id: 'stock-1', action: 'use-item', post: { on: { column: 'done_at', set: true } }, map: { item: 'item_id', quantity: { value: 1 }, place: { value: 2 } } };
    expect(sentence(t, owner, names({ done_at: 'Done at', item_id: 'Item' }))).toEqual(['When Done at is set, take 1 of Item.', 'From Shop floor.']);
  });
});

const source: SourceTable = {
  table: 'main.jobs',
  label: 'Jobs',
  states: ['open', 'done', 'cancelled'],
  columns: [
    { name: 'id', label: 'Id', type: 'int', decided: false },
    { name: 'item_id', label: 'Item', type: 'fk', decided: false },
    { name: 'part_id', label: 'Part', type: 'fk', decided: false },
    { name: 'qty', label: 'Quantity', type: 'decimal', decided: false },
    { name: 'until', label: 'Until', type: 'timestamptz', decided: false },
  ],
  lineOf: [
    { table: 'main.inventory_items', via: 'item_id' },
    { table: 'main.parts', via: 'part_id' },
  ],
};

describe("the sheet's form", () => {
  it('writes use-item for a column that points at the add-on\'s own items, and use for any other', () => {
    const base = { ...EMPTY, table: 'main.jobs', quantity: 'qty', take: { kind: 'moves' as const, to: ['done'] } };
    expect(ruleOf({ ...base, used: 'item_id' }, 'main.inventory_items', source)).toEqual({ action: 'use-item', post: { on: { to: ['done'] } }, map: { item: 'item_id', quantity: 'qty' } });
    expect(ruleOf({ ...base, used: 'part_id' }, 'main.inventory_items', source)).toEqual({ action: 'use', post: { on: { to: ['done'] } }, map: { what: 'part_id', quantity: 'qty' } });
    expect(ruleOf({ ...base, used: 'row', quantity: '' }, 'main.inventory_items', source)).toEqual({ action: 'use', post: { on: { to: ['done'] } }, map: { what: { row: true }, quantity: { value: 1 } } });
  });

  it('writes a hold with the column it lasts until, and the default place as no place at all', () => {
    const form = { ...EMPTY, table: 'main.jobs', used: 'part_id', hold: { kind: 'create' as const }, take: { kind: 'moves' as const, to: ['done'] }, back: { kind: 'moves' as const, to: ['cancelled'] }, until: 'until', place: 'place:2' };
    expect(ruleOf(form, 'main.inventory_items', source)).toEqual({ action: 'hold', reserve: { on: { create: true } }, post: { on: { to: ['done'] } }, reverse: { on: { to: ['cancelled'] } }, map: { what: 'part_id', quantity: { value: 1 }, place: { value: 2 } }, heldUntil: 'until' });
    expect('place' in ruleOf({ ...form, place: '' }, 'main.inventory_items', source).map).toBe(false);
  });

  it('sends nothing while neither Hold nor Take is chosen, while a hold has no end, or while a "when" is half chosen', () => {
    expect(formProblems(EMPTY)).toEqual(['table', 'take']);
    expect(formProblems({ ...EMPTY, table: 'main.jobs', hold: { kind: 'create' } })).toEqual(['until']);
    expect(formProblems({ ...EMPTY, table: 'main.jobs', take: { kind: 'moves', to: [] } })).toEqual(['when']);
    expect(formProblems({ ...EMPTY, table: 'main.jobs', take: { kind: 'set', column: 'until' } })).toEqual([]);
  });

  it('reads a stored rule back into the form it was made with', () => {
    const form = { ...EMPTY, table: 'main.jobs', used: 'part_id', quantity: 'qty', hold: { kind: 'create' as const }, take: { kind: 'becomes' as const, column: 'kind', values: ['a', 'b'] }, back: { kind: 'set' as const, column: 'until' }, until: 'until', place: 'column:part_id', night: 'qty' };
    const stored = { id: 'stock-1', table: 'main.jobs', tableLabel: 'Jobs', owner: null, enabled: true, state: 'live', holding: 0, unplanned: 0, ...ruleOf(form, 'main.inventory_items', source) } as Listed;
    expect(formOf(stored)).toEqual(form);
  });

  it('names a new rule with the first number its table has not used', () => {
    expect(nextId([])).toBe('stock-1');
    expect(nextId(['stock-1', 'stock-3', 'other'])).toBe('stock-2');
  });
});
