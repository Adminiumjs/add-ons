/**
 * THE TAB ON ANOTHER TABLE'S RECORD, AND THE WORDS IT IS HEADED BY.
 *
 * A dish, a room type or a treatment is a row of somebody else's table. What
 * it uses from stock is listed on its own record, in a tab this add-on
 * declares and Adminium draws. The tab's rows are `links`, found by the pair
 * each keeps: the stored name of the other table, and the row's key.
 */

import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };

interface Column {
  ref: string;
  type: string;
  references?: string;
  rules?: Record<string, unknown>;
}
interface Table {
  ref: string;
  columns: Column[];
}
interface Tab {
  id: string;
  table: string;
  match: { table: string; row: string };
  on: unknown;
  columns: string[];
  edit: string[];
  add: { pick: { table: string; label: string }[] };
  remove: boolean;
  form?: unknown;
  summary: { words: string };
  actions: { id: string; child: { table: string; form: string[] } }[];
}
interface Words {
  id: string;
  ledger: string;
  action: string;
  input: string;
  showLeftBelow?: { setting: string };
}

const tables = manifest.requiredSchema.tables as unknown as Table[];
const addOn = manifest.addOn as unknown as { recordTabs: Tab[]; words: Words[]; ledgers: { id: string; actions: Record<string, { inputs: Record<string, string>; phases: string[] }> }[] };
const columnsOf = (ref: string) => tables.find((table) => table.ref === ref)?.columns ?? [];
const column = (table: string, ref: string) => columnsOf(table).find((one) => one.ref === ref);
const [tab] = addOn.recordTabs;

describe('the stock tab', () => {
  it('lists the links of the record it is on, found by a stored table name and a key', () => {
    expect(addOn.recordTabs).toHaveLength(1);
    expect(tab).toMatchObject({ id: 'stock', table: 'links', match: { table: 'source_table', row: 'source_row' }, on: 'linked' });
    // The table half of the pair is kept as a stored name, so renaming the other table keeps the rows.
    expect(column('links', 'source_table')?.rules).toEqual({ tableRef: true });
    expect(column('links', 'source_row')?.type).toBe('text');
  });

  it('shows and edits columns the table has, and never lets the pair itself be edited', () => {
    for (const ref of [...(tab?.columns ?? []), ...(tab?.edit ?? [])]) expect(columnsOf('links').map((one) => one.ref), ref).toContain(ref);
    for (const ref of tab?.edit ?? []) expect(tab?.columns, ref).toContain(ref);
    expect(tab?.edit).not.toContain('source_table');
    expect(tab?.edit).not.toContain('source_row');
    // What a line is of is chosen when it is added, not changed after.
    expect(tab?.edit).not.toContain('item_id');
    expect(tab?.edit).not.toContain('kit_id');
  });

  it('adds a line by picking an item or a kit, each shown by its name', () => {
    expect(tab?.add.pick).toEqual([
      { table: 'items', label: 'name' },
      { table: 'kits', label: 'name' },
    ]);
    for (const pick of tab?.add.pick ?? []) {
      expect(columnsOf('links').some((one) => one.type === 'fk' && one.references === pick.table), pick.table).toBe(true);
      expect(column(pick.table, pick.label), `${pick.table}.${pick.label}`).toBeDefined();
    }
    expect(tab?.remove).toBe(true);
    // A list, not a one-row form: the two cannot be had together.
    expect(tab?.form).toBeUndefined();
  });

  it('records a use of stock for the record: a row of `uses`, which keeps the same pair and posts by itself', () => {
    const [use] = tab?.actions ?? [];
    expect(use).toMatchObject({ id: 'use-stock', child: { table: 'uses' } });
    for (const ref of use?.child.form ?? []) expect(columnsOf('uses').map((one) => one.ref), ref).toContain(ref);
    expect(column('uses', 'source_table')?.rules).toEqual({ tableRef: true });
    expect(column('uses', 'source_row')).toBeDefined();
    // Neither half of the pair is typed: the tab fills both.
    expect(use?.child.form).not.toContain('source_table');
    expect(use?.child.form).not.toContain('source_row');
  });

  it('is headed by the stock words of the row', () => {
    expect(tab?.summary).toEqual({ words: 'stock' });
    expect(addOn.words.map((one) => one.id)).toContain(tab?.summary.words);
  });
});

describe('the stock words', () => {
  const [stock] = addOn.ledgers;

  it('are two questions: of a row that is linked to stock, and of a stock item itself', () => {
    expect(addOn.words).toEqual([
      { id: 'stock', ledger: 'stock', action: 'use', input: 'what', showLeftBelow: { setting: 'show_left_below' } },
      { id: 'item', ledger: 'stock', action: 'use-item', input: 'item', showLeftBelow: { setting: 'show_left_below' } },
    ]);
  });

  it('each ask an action the ledger has, through the input that takes the row asked about', () => {
    for (const words of addOn.words) {
      const action = stock?.actions[words.action];
      expect(action, words.id).toBeDefined();
      expect(Object.keys(action?.inputs ?? {}), words.id).toContain(words.input);
      // A question is asked as a post that writes nothing.
      expect(action?.phases, words.id).toContain('post');
    }
    expect(stock?.actions['use']?.inputs['what']).toBe('rowRef');
    expect(stock?.actions['use-item']?.inputs['item']).toBe('link');
  });

  it('show how many are left only below a number the owner sets, and never by default', () => {
    const setting = column('settings', 'show_left_below');
    expect(setting).toMatchObject({ type: 'int', nullable: true });
    expect((setting as { default?: unknown } | undefined)?.default).toBeUndefined();
    for (const words of addOn.words) expect(words.showLeftBelow).toEqual({ setting: 'show_left_below' });
  });
});
