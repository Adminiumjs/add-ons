/**
 * THE MANIFEST, HELD TO WHAT IT PROMISES.
 *
 * The manifest is the whole add-on as an installer sees it: the tables it
 * makes, the rules Adminium keeps on them, the ledger a posting writes into
 * and the file that decides. This suite validates it with the validator an
 * install uses, then checks the things a validator cannot know — that the
 * file it names is the one the build writes, and that the ledger lets the
 * deciding code write only what is its to write.
 */

import { validateManifest } from '@adminiumjs/manifest';
import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };
import { OUTPUT } from '../vite.config.ts';

interface Column {
  ref: string;
  type: string;
  role?: string;
  nullable?: boolean;
  default?: unknown;
  maxLength?: number;
  references?: string;
  rules?: Record<string, unknown>;
}
interface Table {
  ref: string;
  columns: Column[];
  unique?: string[][];
}
interface Scope {
  insert?: string[];
  update?: { by: string[]; set: string[] };
}
interface Ledger {
  id: string;
  receipts: string;
  writes: Record<string, Scope>;
  actions: Record<string, { writes?: string[]; reads: { as: string; table: string }[] }>;
}

const tables = manifest.requiredSchema.tables as unknown as Table[];
const tableOf = (ref: string): Table => {
  const found = tables.find((table) => table.ref === ref);
  if (found === undefined) throw new Error(`no table "${ref}"`);
  return found;
};
const ledgers = ((manifest.addOn as { ledgers?: unknown }).ledgers ?? []) as Ledger[];

/** The rules through which Adminium fills a column itself: nothing else may write one. */
const DECIDING = ['rollup', 'formula', 'copy', 'stamp', 'sequence', 'format', 'code', 'lookup'];
const decided = (column: Column): boolean => DECIDING.some((rule) => column.rules?.[rule] !== undefined);
/** Every column a total keeps as its balance. */
const balances = (table: Table): string[] =>
  table.columns.flatMap((column) => {
    const balance = (column.rules?.['rollup'] as { balance?: { column: string } } | undefined)?.balance;
    return balance === undefined ? [] : [balance.column];
  });

describe('the manifest', () => {
  it('is one an install accepts', () => {
    const result = validateManifest(manifest);
    const issues = result.ok ? [] : result.issues.map((issue) => `${String(issue.path)}: ${issue.message}`);
    expect(issues).toEqual([]);
  });

  it('is an add-on that attaches to every deployment, and to none in particular', () => {
    expect(manifest.kind).toBe('add-on');
    expect(manifest.key).toBe('inventory');
    // It must work with no app at all: stock is received, counted and moved from its own screens.
    expect(manifest.addOn.attaches).toEqual([{ app: '*' }]);
    expect(manifest.addOn.connect).toEqual({ kind: 'none' });
  });

  it('decides what a posting writes, from the file the build writes', () => {
    expect(manifest.addOn.provides).toEqual([{ contract: 'posting-rows', version: 1, server: OUTPUT.server }]);
    for (const entry of manifest.addOn.provides) expect(Object.values(OUTPUT)).toContain(entry.server);
  });

  it('keeps its tables under its own name', () => {
    expect(manifest.requiredSchema.prefixed).toBe(true);
  });
});

describe('the tables', () => {
  it('each have a key of their own, first, and no two share a name', () => {
    expect(tables.length).toBeGreaterThan(0);
    expect(new Set(tables.map((table) => table.ref)).size).toBe(tables.length);
    for (const table of tables) {
      expect(table.columns[0], table.ref).toMatchObject({ ref: 'id', role: 'pk' });
      expect(new Set(table.columns.map((column) => column.ref)).size, table.ref).toBe(table.columns.length);
    }
  });

  it('bound every text column, so each can be indexed on every database', () => {
    for (const table of tables) {
      for (const column of table.columns.filter((one) => one.type === 'text')) {
        expect(column.maxLength, `${table.ref}.${column.ref}`).toBeGreaterThan(0);
      }
    }
  });

  it('keep the catalogue: what is stocked, where, from whom, and what a row of another table uses', () => {
    for (const ref of ['settings', 'categories', 'units', 'places', 'items', 'suppliers', 'item_suppliers', 'reasons', 'kits', 'kit_lines', 'links']) {
      expect(tables.map((table) => table.ref), ref).toContain(ref);
    }
  });

  it('have one settings row an install can make: every column of it may be empty or has a default', () => {
    expect((manifest.addOn as { settingsTable?: string }).settingsTable).toBe('settings');
    for (const column of tableOf('settings').columns.filter((one) => one.role !== 'pk')) {
      expect(column.nullable === true || column.default !== undefined, `settings.${column.ref}`).toBe(true);
    }
  });

  it('name one preferred supplier an item, held by a limit and not by a hope', () => {
    expect((tableOf('item_suppliers') as unknown as { capacity: unknown }).capacity).toEqual({ kind: 'parent', via: 'item_id', size: 1, countWhere: { column: 'rank', values: ['preferred'] } });
  });

  it('say which row of another table a link belongs to by a stored table name and a key', () => {
    const links = tableOf('links');
    expect(links.columns.find((column) => column.ref === 'source_table')?.rules).toEqual({ tableRef: true });
    expect(links.unique).toEqual([
      ['source_table', 'source_row', 'item_id'],
      ['source_table', 'source_row', 'kit_id'],
    ]);
  });
});

describe.skipIf(ledgers.length === 0)('the ledger', () => {
  it('lets the deciding code write no column Adminium decides, no balance and no key', () => {
    for (const ledger of ledgers) {
      for (const [ref, scope] of Object.entries(ledger.writes)) {
        const table = tableOf(ref);
        const kept = new Set([...table.columns.filter(decided).map((column) => column.ref), ...balances(table), 'id', 'receipt_id']);
        for (const name of [...(scope.insert ?? []), ...(scope.update?.set ?? [])]) {
          expect(table.columns.map((column) => column.ref), `${ref}.${name}`).toContain(name);
          expect(kept.has(name), `${ref}.${name} is Adminium's to fill`).toBe(false);
        }
      }
    }
  });

  it('marks every row the deciding code adds with the receipt that added it', () => {
    for (const ledger of ledgers) {
      expect(tableOf(ledger.receipts).ref).toBe('postings');
      for (const [ref, scope] of Object.entries(ledger.writes)) {
        if (scope.insert === undefined) continue;
        expect(tableOf(ref).columns.find((column) => column.ref === 'receipt_id'), ref).toMatchObject({ type: 'fk', references: ledger.receipts, nullable: true });
      }
    }
  });

  it('stays inside the limits a ledger is held to, and no action writes outside it', () => {
    for (const ledger of ledgers) {
      expect(Object.keys(ledger.writes).length).toBeLessThanOrEqual(12);
      expect(Object.keys(ledger.actions).length).toBeLessThanOrEqual(16);
      for (const [name, action] of Object.entries(ledger.actions)) {
        expect(action.reads.length, name).toBeLessThanOrEqual(6);
        expect(action.writes, `${name} says what it writes`).toBeDefined();
        for (const ref of action.writes ?? []) expect(Object.keys(ledger.writes), `${name} → ${ref}`).toContain(ref);
      }
    }
  });

  it('never lets a level go below nothing, except the batch nobody has named yet', () => {
    const taken = tableOf('levels').columns.find((column) => column.ref === 'taken');
    expect(taken?.rules?.['rollup']).toMatchObject({ from: 'movements', sum: 'out_qty', cap: true, capUnless: { column: 'unassigned' }, balance: { column: 'qty', of: 'opening' } });
    // Nothing writes `opening`: it is there because a cap needs a balance.
    for (const ledger of ledgers) expect(ledger.writes['levels']?.insert).not.toContain('opening');
  });
});

interface Move {
  to: string;
  planned?: boolean;
  roles?: string[];
  requires?: { where?: { column: string; eq?: unknown }[]; linked?: { via: string; where: { column: string; eq?: unknown }[] }[]; children?: Record<string, number> };
}
interface Posting {
  id: string;
  into: { addOn: string; ledger: string; action: string };
  via?: string;
  post?: { on: Record<string, unknown> };
  reverse?: { on: Record<string, unknown> };
}
const statesOf = (ref: string) => (tableOf(ref) as unknown as { states: { moves: Record<string, (string | Move)[]> } }).states;
const moveOf = (ref: string, from: string, to: string): Move => {
  const found = (statesOf(ref).moves[from] ?? []).map((move) => (typeof move === 'string' ? { to: move } : move)).find((move) => move.to === to);
  if (found === undefined) throw new Error(`${ref}: no move ${from} → ${to}`);
  return found;
};
const postingsOf = (ref: string): Posting[] => ((tableOf(ref) as unknown as { postings?: Posting[] }).postings ?? []);

describe.skipIf(!tables.some((table) => table.ref === 'receipts'))('the documents', () => {
  it('make thirty tables in all, and a ledger of thirteen actions over twelve of them', () => {
    expect(tables).toHaveLength(30);
    const [stock] = ledgers;
    expect(Object.keys(stock?.actions ?? {}).sort()).toEqual(
      ['adopt', 'count', 'count-mark', 'hold', 'on-order', 'on-order-close', 'receive', 'reorder', 'return', 'send-back', 'transfer', 'use', 'use-item'].sort(),
    );
    expect(Object.keys(stock?.writes ?? {})).toHaveLength(12);
  });

  it('post into their own ledger, each posting to an action it has', () => {
    const own = tables.flatMap((table) => postingsOf(table.ref).map((posting) => ({ table: table.ref, ...posting })));
    expect(own.map((posting) => `${posting.table}/${posting.id} → ${posting.into.action}`).sort()).toEqual(
      [
        'count_lines/count → count',
        'count_marks/mark → count-mark',
        'po_lines/close → on-order-close',
        'po_lines/on-order → on-order',
        'receipt_lines/receive → receive',
        'receipt_lines/send-back → send-back',
        'reorder_requests/draft → reorder',
        'transfer_lines/move → transfer',
        'uses/use → use-item',
      ].sort(),
    );
    for (const posting of own) {
      expect(posting.into).toMatchObject({ addOn: 'inventory', ledger: 'stock' });
      expect(Object.keys(ledgers[0]?.actions ?? {}), posting.id).toContain(posting.into.action);
    }
  });

  it('post line by line: a line moves only while its sheet is being posted, and back only while it is being undone', () => {
    for (const [lines, via, done] of [
      ['receipt_lines', 'receipt_id', 'draft'],
      ['transfer_lines', 'transfer_id', 'draft'],
      ['count_lines', 'count_id', 'open'],
    ] as const) {
      expect(moveOf(lines, done, 'posted').requires?.linked, lines).toEqual([{ via, where: [{ column: 'status', eq: 'posting' }] }]);
      expect(moveOf(lines, 'posted', 'reversed').requires?.linked, lines).toEqual([{ via, where: [{ column: 'status', eq: 'reversing' }] }]);
    }
  });

  it('never call a sheet posted, or undone, while a line of it is left', () => {
    expect(moveOf('receipts', 'posting', 'posted').requires?.where).toEqual([{ column: 'unposted', eq: 0 }]);
    expect(moveOf('transfers', 'posting', 'done').requires?.where).toEqual([{ column: 'unposted', eq: 0 }]);
    expect(moveOf('counts', 'posting', 'posted').requires?.where).toEqual([{ column: 'unposted', eq: 0 }]);
    for (const [sheet, from] of [['receipts', 'reversing'], ['transfers', 'reversing'], ['counts', 'reversing']] as const) {
      expect(moveOf(sheet, from, 'reversed').requires?.where, sheet).toEqual([{ column: 'unreversed', eq: 0 }]);
    }
    // A count is posted only once every line of it has been counted.
    expect(moveOf('counts', 'open', 'posting').requires).toEqual({ children: { count_lines: 1 }, where: [{ column: 'uncounted', eq: 0 }] });
  });

  it('keep the way back for a manager', () => {
    for (const [ref, from, to] of [
      ['receipts', 'posted', 'reversing'],
      ['receipts', 'reversing', 'reversed'],
      ['transfers', 'done', 'reversing'],
      ['counts', 'posted', 'reversing'],
      ['receipt_lines', 'posted', 'reversed'],
      ['receipt_lines', 'posted', 'sent_back'],
      ['transfer_lines', 'posted', 'reversed'],
    ] as const) {
      expect(moveOf(ref, from, to).roles, `${ref} ${from} → ${to}`).toEqual(['manager']);
    }
  });

  it('let only the deciding code say an order has arrived', () => {
    expect(moveOf('purchase_orders', 'sent', 'part_received').planned).toBe(true);
    expect(moveOf('purchase_orders', 'sent', 'received').planned).toBe(true);
    // A person closes a part-received order and reopens a received one; nobody reopens a cancelled one.
    expect(moveOf('purchase_orders', 'part_received', 'received').planned).toBeUndefined();
    expect(moveOf('purchase_orders', 'received', 'part_received').planned).toBeUndefined();
    expect(statesOf('purchase_orders').moves['cancelled']).toBeUndefined();
    // An order is sent with at least one line, and takes no line after.
    expect(moveOf('purchase_orders', 'draft', 'sent').requires).toEqual({ children: { po_lines: 1 } });
  });

  it('put what is on order on the stock point when the order is sent, and take the rest off when a person closes it', () => {
    const [onOrder, close] = postingsOf('po_lines');
    expect(onOrder).toMatchObject({ id: 'on-order', via: 'po_id', post: { on: { to: ['sent'] } } });
    expect(onOrder?.reverse).toBeUndefined();
    expect(close).toMatchObject({ id: 'close', via: 'po_id', post: { on: { to: ['received', 'cancelled'], from: ['sent', 'part_received'] } }, reverse: { on: { to: ['part_received'], from: ['received'] } } });
  });

  it('ask an order sent by email for an address: its supplier\'s, or one typed on the order', () => {
    const email = tableOf('purchase_orders').columns.find((column) => column.ref === 'supplier_email');
    // The copy only fills what is left out, so with no address on the supplier a person is still asked.
    expect(email?.rules).toMatchObject({ copy: { via: 'supplier_id', from: 'email', mode: 'default' }, requiredWhen: { column: 'sent_how', in: ['email'] } });
    expect(email?.nullable).toBe(true);
  });

  it('hold a draft order to fifty lines, the most its email lists', () => {
    expect((tableOf('po_lines') as unknown as { capacity: unknown }).capacity).toEqual({ kind: 'parent', via: 'po_id', size: 50 });
  });
});

interface Role {
  key: string;
  permissions: string[];
  limits?: Record<string, { readable?: string[]; writable?: string[]; creatable?: string[]; writableValues?: Record<string, string[]> }>;
}
const roles = ((manifest as { roles?: unknown }).roles ?? []) as Role[];
const roleOf = (key: string): Role => {
  const found = roles.find((role) => role.key === key);
  if (found === undefined) throw new Error(`no role "${key}"`);
  return found;
};
const may = (role: Role, table: string, action: string) => role.permissions.includes(`table:@${table}:${action}`);

describe.skipIf(roles.length < 3)('the roles', () => {
  it('are a manager, a clerk and a viewer — the manager first, because the installer is given the first', () => {
    expect(roles.map((role) => role.key)).toEqual(['manager', 'clerk', 'viewer']);
  });

  it('let nobody read the receipts: the only place a row of another table is named', () => {
    for (const role of roles) {
      expect(role.permissions.filter((grant) => grant.startsWith('table:@postings:')), role.key).toEqual([]);
    }
  });

  it('let no person write what only a posting writes', () => {
    for (const role of roles) {
      for (const table of ['levels', 'movements', 'reservations', 'on_order_moves']) {
        for (const action of ['create', 'update', 'delete']) expect(may(role, table, action), `${role.key} ${table} ${action}`).toBe(false);
      }
      // A batch is made by a posting; a manager may only correct its date.
      expect(may(role, 'batches', 'create'), role.key).toBe(false);
      expect(may(role, 'batches', 'delete'), role.key).toBe(false);
    }
    expect(roleOf('manager').limits?.['batches']).toEqual({ writable: ['expires_on'] });
    expect(roleOf('manager').limits?.['stock_points']?.writable).toEqual(['reorder_level', 'reorder_qty', 'reorder_paused']);
  });

  it('keep what things cost from the clerk, column by column', () => {
    const hidden: Record<string, string[]> = {
      items: ['cost_avg', 'supplier_cost', 'value'],
      stock_points: ['cost_avg', 'value'],
      movements: ['unit_cost', 'amount', 'cost_out'],
      item_suppliers: ['price', 'unit_cost'],
      purchase_orders: ['total', 'show_prices'],
      po_lines: ['price', 'unit_cost', 'amount'],
      receipts: ['total'],
      receipt_lines: ['unit_cost', 'po_cost', 'supplier_cost', 'avg_cost', 'cost_used', 'amount'],
      counts: ['value'],
      count_lines: ['unit_cost', 'value'],
    };
    const clerk = roleOf('clerk');
    for (const [table, columns] of Object.entries(hidden)) {
      const readable = clerk.limits?.[table]?.readable;
      expect(readable, `the clerk's read of ${table} is limited`).toBeDefined();
      for (const column of columns) {
        expect(tableOf(table).columns.map((one) => one.ref), `${table}.${column}`).toContain(column);
        expect(readable, `${table}.${column}`).not.toContain(column);
      }
      // Every other column is still read: the list hides by name, it does not shrink by neglect.
      const rest = tableOf(table).columns.filter((one) => one.role !== 'pk' && !columns.includes(one.ref)).map((one) => one.ref);
      expect(readable).toEqual(rest);
    }
    expect(clerk.limits?.['suppliers']?.readable).toEqual(['name', 'active']);
    // The clerk types what arrived, never what it cost, and reads no message to a supplier.
    expect(clerk.limits?.['receipt_lines']?.creatable).not.toContain('unit_cost');
    expect(clerk.limits?.['receipt_lines']?.writable).not.toContain('unit_cost');
    expect(may(clerk, 'messages', 'read')).toBe(false);
  });

  it('let the clerk post a sheet and never take one back', () => {
    const clerk = roleOf('clerk');
    expect(clerk.limits?.['receipts']?.writableValues).toEqual({ status: ['posting', 'posted'] });
    expect(clerk.limits?.['receipt_lines']?.writableValues).toEqual({ status: ['posted'] });
    expect(clerk.limits?.['transfers']?.writableValues).toEqual({ status: ['posting', 'done'] });
    expect(clerk.limits?.['transfer_lines']?.writableValues).toEqual({ status: ['posted'] });
    // A count is started by a clerk and posted by a manager.
    expect(may(clerk, 'counts', 'update')).toBe(false);
    expect(may(clerk, 'count_marks', 'create')).toBe(true);
  });

  it('let the viewer read, and only read', () => {
    const viewer = roleOf('viewer');
    const onTables = viewer.permissions.filter((grant) => grant.startsWith('table:'));
    expect(onTables.every((grant) => /^table:@[a-z_]+:read$/.test(grant))).toBe(true);
    expect(onTables).toHaveLength(tables.length - 1);
    // Beside the tables it holds only the pages it may open.
    expect(viewer.permissions.filter((grant) => !grant.startsWith('table:')).every((grant) => /^page:@[a-z-]+:view$/.test(grant))).toBe(true);
  });
});

describe.skipIf((manifest as { seeds?: unknown }).seeds === undefined)('the rows an install starts with', () => {
  const seeds = ((manifest as { seeds?: unknown }).seeds ?? []) as { table: string; rows: Record<string, unknown>[] }[];
  const seedOf = (table: string) => seeds.find((seed) => seed.table === table)?.rows ?? [];

  it('are twelve units, seven reasons and the one settings row, in that order', () => {
    expect(seeds.map((seed) => [seed.table, seed.rows.length])).toEqual([
      ['units', 12],
      ['reasons', 7],
      ['settings', 1],
    ]);
  });

  it('start a new item from "each", by the row and not by a number', () => {
    expect(seedOf('units').filter((row) => row['@label'] !== undefined)).toMatchObject([{ '@label': 'unit:each', code: 'each', decimals: 0 }]);
    expect(seedOf('settings')).toEqual([{ default_unit_id: { '@ref': 'unit:each' } }]);
    // Weights, volumes and lengths are kept to three places; things that are counted to none.
    expect(seedOf('units').filter((row) => row['decimals'] === 3).map((row) => row['code'])).toEqual(['g', 'kg', 'ml', 'l', 'm']);
  });

  it('never seed a table a posting writes', () => {
    for (const seed of seeds) expect(Object.keys(ledgers[0]?.writes ?? {}), seed.table).not.toContain(seed.table);
  });
});
