/**
 * THE PAGES ADMINIUM DRAWS FOR IT.
 *
 * Most of this add-on's screens are not code: the manifest names a table and
 * Adminium draws the list, the record and the form. What the manifest adds is
 * which columns a form asks for, what a list filters by, what an empty tab
 * says, the buttons on a purchase order and who may open each page. This
 * suite walks every name those use against the tables, and holds the buttons
 * to the states they belong in.
 */

import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };

interface Column {
  ref: string;
  type: string;
  references?: string;
  rules?: Record<string, unknown>;
}
interface Move {
  to: string;
  planned?: boolean;
}
interface Action {
  id: string;
  label: Record<string, string>;
  tone?: string;
  move?: { to: string };
  set?: Record<string, unknown>;
  in?: string[];
  confirm?: Record<string, string>;
  link?: unknown;
}
interface Table {
  ref: string;
  columns: Column[];
  states?: { moves: Record<string, (string | Move)[]>; actions?: Action[] };
}
interface Field {
  column?: string;
  relation?: string;
  control?: string;
  columns?: { column: string }[];
}
interface Page {
  ref: string;
  template: string;
  title: { key: string; fallback: string };
  nav: { group: string; icon: string; order: number };
  bindings: { rows: string };
  config?: {
    form?: { v: number; sections: { id: string; fields: Field[] }[] };
    filters?: { column: string; control?: string }[];
    defaultFilters?: { column: string; op: string; value: unknown }[];
    tabs?: Record<string, { noNew?: boolean; empty?: unknown; emptyBody?: unknown }>;
    bulk?: { id: string; child: { table: string; via: string; form: string[] }; where?: { column: string; eq: unknown }; confirm: { columns: string[] } }[];
  };
}
interface Role {
  key: string;
  permissions: string[];
}

const tables = manifest.requiredSchema.tables as unknown as Table[];
/** The lists Adminium draws; the Overview, a dashboard, has a suite of its own. */
const pages = (manifest as unknown as { pages: Page[] }).pages.filter((page) => page.template === 'page-crud');
const roles = (manifest as unknown as { roles: Role[] }).roles;
const tableOf = (ref: string): Table => {
  const found = tables.find((table) => table.ref === ref);
  if (found === undefined) throw new Error(`no table "${ref}"`);
  return found;
};
const pageOf = (ref: string): Page => {
  const found = pages.find((page) => page.ref === ref);
  if (found === undefined) throw new Error(`no page "${ref}"`);
  return found;
};
const columnsOf = (ref: string) => tableOf(ref).columns.map((column) => column.ref);
/** Whether a table has a foreign key to another: what makes it a tab of that other's record. */
const linksTo = (child: string, parent: string) => tableOf(child).columns.some((column) => column.type === 'fk' && column.references === parent);
const sees = (role: string, page: string) => roles.find((one) => one.key === role)?.permissions.includes(`page:@${page}:view`) === true;

describe('the generated pages', () => {
  it('every list sits under a group the manifest declares, by the group\'s own key: the sidebar matches the two as written', () => {
    // A group written any other way ("manifest:stock") is no group the section knows, and the page lands under no heading.
    const declared = (manifest.navGroups as { key: string }[]).map((group) => group.key);
    expect(declared).toEqual(['stock', 'stock-setup']);
    for (const page of pages) expect(declared, page.ref).toContain(page.nav.group);
    // The Overview alone stands above the groups.
    const overview = (manifest.pages as unknown as { ref: string; nav: { group: string } }[]).find((page) => page.ref === 'inventory-overview');
    expect(declared).not.toContain(overview?.nav.group);
  });

  it('are thirteen lists over the add-on\'s own tables, in two groups of the rail, each in its place', () => {
    expect(pages.map((page) => [page.ref, page.bindings.rows, page.nav.group])).toEqual([
      ['inventory-items', 'items', 'stock'],
      ['inventory-stock-by-place', 'stock_points', 'stock'],
      ['inventory-movements', 'movements', 'stock'],
      ['inventory-receipts', 'receipts', 'stock'],
      ['inventory-transfers', 'transfers', 'stock'],
      ['inventory-purchase-orders', 'purchase_orders', 'stock'],
      ['inventory-batches', 'levels', 'stock'],
      ['inventory-suppliers', 'suppliers', 'stock-setup'],
      ['inventory-places', 'places', 'stock-setup'],
      ['inventory-categories', 'categories', 'stock-setup'],
      ['inventory-reasons', 'reasons', 'stock-setup'],
      ['inventory-kits', 'kits', 'stock-setup'],
      ['inventory-settings', 'settings', 'stock-setup'],
    ]);
    const orders = pages.map((page) => page.nav.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    expect(new Set(orders).size).toBe(orders.length);
    expect((manifest as unknown as { navGroups: { key: string }[] }).navGroups.map((group) => group.key)).toEqual(['stock', 'stock-setup']);
    for (const page of pages) {
      // A page's name opens it, so it starts with the add-on's key; its title is a key of the add-on's own.
      expect(page.ref.startsWith('inventory-'), page.ref).toBe(true);
      expect(page.title.key.startsWith('addon.inventory.page.'), page.ref).toBe(true);
      expect(page.template).toBe('page-crud');
    }
  });

  it('ask in a form only for columns the table has, and list a child table\'s own', () => {
    for (const page of pages) {
      for (const section of page.config?.form?.sections ?? []) {
        for (const field of section.fields) {
          if (field.column !== undefined) expect(columnsOf(page.bindings.rows), `${page.ref} · ${field.column}`).toContain(field.column);
          if (field.relation !== undefined) {
            expect(linksTo(field.relation, page.bindings.rows), `${page.ref} · ${field.relation}`).toBe(true);
            for (const column of field.columns ?? []) expect(columnsOf(field.relation), `${page.ref} · ${field.relation}.${column.column}`).toContain(column.column);
          }
        }
      }
    }
  });

  it('never ask a person for a column Adminium works out, except to show it', () => {
    const worked = (table: string) => tableOf(table).columns.filter((column) => ['rollup', 'formula', 'stamp', 'sequence', 'format'].some((rule) => column.rules?.[rule] !== undefined)).map((column) => column.ref);
    for (const page of pages) {
      for (const field of (page.config?.form?.sections ?? []).flatMap((section) => section.fields)) {
        // An order's expected day is worked out when it is sent, and a person may correct it after.
        if (page.ref === 'inventory-purchase-orders' && field.column === 'expected_on') continue;
        if (field.column !== undefined && worked(page.bindings.rows).includes(field.column)) expect(field.control, `${page.ref} · ${field.column}`).toBe('readonly');
      }
    }
  });

  it('filter by at most six columns of the table, and word only tabs the record has', () => {
    for (const page of pages) {
      const filters = page.config?.filters ?? [];
      expect(filters.length, page.ref).toBeLessThanOrEqual(6);
      for (const filter of filters) expect(columnsOf(page.bindings.rows), `${page.ref} · ${filter.column}`).toContain(filter.column);
      for (const child of Object.keys(page.config?.tabs ?? {})) expect(linksTo(child, page.bindings.rows), `${page.ref} · ${child}`).toBe(true);
    }
  });

  it('make no row by hand where only a posting makes one', () => {
    expect(pageOf('inventory-items').config?.tabs).toMatchObject({ stock_points: { noNew: true }, movements: { noNew: true }, batches: { noNew: true } });
    expect(pageOf('inventory-stock-by-place').config?.tabs).toMatchObject({ levels: { noNew: true }, reorder_requests: { noNew: true } });
    expect(pageOf('inventory-receipts').config?.tabs?.['receipt_lines']?.noNew).toBe(true);
    expect(pageOf('inventory-transfers').config?.tabs?.['transfer_lines']?.noNew).toBe(true);
    // Movements and batches are read: no form at all.
    expect(pageOf('inventory-movements').config?.form).toBeUndefined();
    expect(pageOf('inventory-batches').config?.form).toBeUndefined();
    expect(pageOf('inventory-receipts').config?.form).toBeUndefined();
  });

  it('open the receipts on the ones still alive', () => {
    expect(pageOf('inventory-receipts').config?.defaultFilters).toEqual([{ column: 'status', op: 'in', value: ['draft', 'posting', 'posted'] }]);
  });

  it('reorder what is low from the list: one request a ticked row that needs it, nothing typed', () => {
    const [reorder] = pageOf('inventory-stock-by-place').config?.bulk ?? [];
    expect(reorder).toMatchObject({ id: 'reorder', child: { table: 'reorder_requests', via: 'stock_point_id', form: [] }, where: { column: 'to_reorder', eq: 1 } });
    for (const column of reorder?.confirm.columns ?? []) expect(columnsOf('stock_points'), column).toContain(column);
  });

  it('say a stock point\'s state and its two flags in words, so a list filters them by choice', () => {
    const optionsOf = (column: string) => (tableOf('stock_points').columns.find((one) => one.ref === column)?.rules?.['options'] as { values: { value: string }[] } | undefined)?.values.map((one) => one.value);
    expect(optionsOf('state')).toEqual(['0', '1', '2', '3']);
    expect(optionsOf('low')).toEqual(['0', '1']);
    expect(optionsOf('to_reorder')).toEqual(['0', '1']);
    const filters = Object.fromEntries((pageOf('inventory-stock-by-place').config?.filters ?? []).map((filter) => [filter.column, filter.control]));
    expect(filters).toMatchObject({ state: 'any-of', low: 'one-of', to_reorder: 'one-of' });
  });
});

describe('the buttons of a purchase order', () => {
  const states = tableOf('purchase_orders').states!;
  const actions = states.actions ?? [];
  const movesFrom = (state: string) => (states.moves[state] ?? []).map((move) => (typeof move === 'string' ? { to: move } : move));
  /** The buttons a record in a state offers: a move wherever its move is listed for a person, a write where it says. */
  const shownIn = (state: string) =>
    actions.filter((action) => (action.move !== undefined ? movesFrom(state).some((move) => move.to === action.move?.to && move.planned !== true) : (action.in ?? []).includes(state))).map((action) => action.id);

  it('are the ones each state calls for, and none on a cancelled order', () => {
    expect(shownIn('draft')).toEqual(['send', 'mark-sent', 'cancel']);
    expect(shownIn('sent')).toEqual(['receive', 'send-again', 'cancel']);
    expect(shownIn('part_received')).toEqual(['receive', 'send-again', 'close']);
    expect(shownIn('received')).toEqual(['reopen']);
    expect(shownIn('cancelled')).toEqual([]);
  });

  it('never share a target between two kinds of button, and never offer a move only a posting makes', () => {
    // Send and Mark as sent are one move told apart by what they set; every other move has one button.
    const targets = actions.filter((action) => action.move !== undefined).map((action) => action.move?.to);
    expect(targets).toEqual(['sent', 'sent', 'received', 'cancelled', 'part_received']);
    expect(actions.find((action) => action.id === 'send')?.set).toEqual({ sent_how: 'email' });
    expect(actions.find((action) => action.id === 'mark-sent')?.set).toEqual({ sent_how: 'none' });
    // From `sent`, "received" and "part received" are the posting's: no button reaches them there.
    expect(shownIn('sent')).not.toContain('close');
    expect(shownIn('sent')).not.toContain('reopen');
  });

  it('ask before every one of them, and mark the one that cannot be taken back', () => {
    // A button that only opens a screen changes nothing, so it asks nothing.
    for (const action of actions.filter((one) => one.link === undefined)) expect(action.confirm?.['en-US'], action.id).toBeTruthy();
    for (const action of actions.filter((one) => one.link !== undefined)) expect(action.confirm, action.id).toBeUndefined();
    expect(actions.filter((action) => action.tone === 'danger').map((action) => action.id)).toEqual(['cancel']);
    expect(actions.filter((action) => action.tone === 'primary').map((action) => action.id)).toEqual(['send']);
  });

  it('send again without moving anything', () => {
    expect(actions.find((action) => action.id === 'send-again')).toMatchObject({ set: { resent_at: { now: true } }, in: ['sent', 'part_received'] });
    expect(actions.find((action) => action.id === 'send-again')?.move).toBeUndefined();
  });
});

describe('who opens which page', () => {
  /** Every page the manifest declares, the Overview among them, and the screens that are code. */
  const everyPage = [...(manifest as unknown as { pages: Page[] }).pages.map((page) => page.ref), ...manifest.addOn.pages.map((page) => page.ref)];

  it('is what the three roles say, and every page has someone', () => {
    for (const page of pages) expect(sees('manager', page.ref), page.ref).toBe(true);
    for (const role of roles) {
      for (const grant of role.permissions.filter((one) => one.startsWith('page:@'))) {
        expect(everyPage, `${role.key} · ${grant}`).toContain(grant.replace(/^page:@|:view$/g, ''));
      }
    }
  });

  it('keeps the set-up pages from the clerk, and the settings from everyone but the manager', () => {
    for (const ref of ['inventory-suppliers', 'inventory-places', 'inventory-categories', 'inventory-reasons', 'inventory-settings']) expect(sees('clerk', ref), ref).toBe(false);
    expect(sees('clerk', 'inventory-kits')).toBe(true);
    expect(sees('viewer', 'inventory-settings')).toBe(false);
    for (const ref of ['inventory-items', 'inventory-stock-by-place', 'inventory-movements', 'inventory-receipts', 'inventory-transfers', 'inventory-purchase-orders', 'inventory-batches']) {
      for (const role of ['manager', 'clerk', 'viewer']) expect(sees(role, ref), `${role} · ${ref}`).toBe(true);
    }
  });

  it('never opens a page on a table its role cannot read', () => {
    for (const role of roles) {
      for (const page of pages.filter((one) => sees(role.key, one.ref))) {
        expect(role.permissions, `${role.key} · ${page.ref}`).toContain(`table:@${page.bindings.rows}:read`);
      }
    }
  });
});
