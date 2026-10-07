/**
 * THE OVERVIEW.
 *
 * One page of cards, declared and not coded: each card names a table, what to
 * add up or list, and where a click leads. Adminium reads the figures with
 * the reader's own grants. This suite walks every column a card names against
 * the tables, and every link against the pages, because a card that names a
 * column that is not there shows an error where the figure should be.
 */

import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };

interface Column {
  ref: string;
  type: string;
  references?: string;
}
interface Filter {
  column?: string;
  op?: string;
  or?: Filter[];
  and?: Filter[];
}
interface Card {
  i: string;
  widget: string;
  x: number;
  y: number;
  w: number;
  h: number;
  config: {
    title: string;
    href?: string;
    viewAllHref?: string;
    columns?: { name: string }[];
    secondary?: string[];
    emptyState?: { titleKey: string };
    binding: {
      source: { name: string };
      shape: string;
      select?: string[];
      lookups?: string[];
      aggregations?: { fn: string; column?: string; alias: string }[];
      groupBy?: string[];
      groupLabel?: string;
      filters?: Filter[];
      orderBy?: { column: string }[];
      window?: { column: string };
      limit?: number;
    };
  };
}
interface Page {
  ref: string;
  template: string;
  config?: { layout?: { toolbar?: { links?: { label: string; href: string; tone?: string }[] }; items: Card[] } };
}

const tables = manifest.requiredSchema.tables as unknown as { ref: string; columns: Column[] }[];
const pages = (manifest as unknown as { pages: Page[] }).pages;
const roles = (manifest as unknown as { roles: { key: string; permissions: string[] }[] }).roles;
const overview = pages.find((page) => page.ref === 'inventory-overview');
const cards = overview?.config?.layout?.items ?? [];
const columnsOf = (ref: string) => tables.find((table) => table.ref === ref)?.columns ?? [];
const has = (table: string, column: string) => columnsOf(table).some((one) => one.ref === column);

/** Follows `fk.column` (or `fk.fk.column`) from a table through real foreign keys; the table it ends in, or nothing. */
function reach(table: string, path: string): { table: string; column: string } | null {
  const parts = path.split('.');
  let at = table;
  for (const step of parts.slice(0, -1)) {
    const link = columnsOf(at).find((one) => one.ref === step);
    if (link === undefined || link.type !== 'fk' || link.references === undefined) return null;
    at = link.references;
  }
  const last = parts.at(-1) ?? '';
  return has(at, last) ? { table: at, column: last } : null;
}

const conditions = (filters: Filter[] = []): Filter[] => filters.flatMap((filter) => (filter.or !== undefined ? conditions(filter.or) : filter.and !== undefined ? conditions(filter.and) : [filter]));

describe('the Overview', () => {
  it('is the first page of the rail, a dashboard the manager and the viewer open', () => {
    expect(pages[0]?.ref).toBe('inventory-overview');
    expect(overview?.template).toBe('page-dashboard');
    const sees = (role: string) => roles.find((one) => one.key === role)?.permissions.includes('page:@inventory-overview:view');
    expect([sees('manager'), sees('clerk'), sees('viewer')]).toEqual([true, false, true]);
  });

  it('has twelve cards that fit the grid and do not sit on one another', () => {
    expect(cards.map((card) => card.i)).toEqual(['value', 'low', 'out', 'expiring', 'open-orders', 'to-reorder', 'running-low', 'by-place', 'expiring-soon', 'orders', 'movements', 'used']);
    for (const card of cards) expect(card.x + card.w, card.i).toBeLessThanOrEqual(12);
    for (const [n, a] of cards.entries()) {
      for (const b of cards.slice(n + 1)) {
        const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
        expect(apart, `${a.i} and ${b.i}`).toBe(true);
      }
    }
  });

  it('reads only tables the add-on has, and only columns those tables have', () => {
    for (const card of cards) {
      const { binding } = card.config;
      const table = binding.source.name;
      expect(tables.map((one) => one.ref), card.i).toContain(table);
      for (const column of binding.select ?? []) expect(has(table, column), `${card.i} · ${column}`).toBe(true);
      for (const one of binding.aggregations ?? []) if (one.column !== undefined) expect(has(table, one.column), `${card.i} · ${one.column}`).toBe(true);
      for (const column of binding.groupBy ?? []) expect(has(table, column), `${card.i} · ${column}`).toBe(true);
      for (const one of conditions(binding.filters)) expect(reach(table, one.column ?? ''), `${card.i} · ${one.column ?? ''}`).not.toBeNull();
      for (const one of binding.orderBy ?? []) expect(reach(table, one.column), `${card.i} · ${one.column}`).not.toBeNull();
      if (binding.window !== undefined) expect(has(table, binding.window.column), `${card.i} · ${binding.window.column}`).toBe(true);
      if (binding.groupLabel !== undefined) expect(reach(table, binding.groupLabel), `${card.i} · ${binding.groupLabel}`).not.toBeNull();
    }
  });

  it('looks a name up only through a real foreign key', () => {
    for (const card of cards) {
      for (const lookup of card.config.binding.lookups ?? []) {
        const [alias, path] = lookup.split(':') as [string, string];
        expect(alias.length, lookup).toBeGreaterThan(0);
        expect(reach(card.config.binding.source.name, path), `${card.i} · ${lookup}`).not.toBeNull();
      }
    }
    // A transfer shows once, as the half that arrived, which names where it came from.
    const movements = cards.find((card) => card.i === 'movements')?.config.binding;
    expect(movements?.lookups).toEqual(['item:item_id.name', 'place:place_id.name', 'from:pair_id.place_id.name']);
    expect(movements?.filters).toEqual([{ column: 'kind', op: 'neq', value: 'moved_out' }]);
  });

  it('draws in a list only what the list read', () => {
    for (const card of cards.filter((one) => one.widget === 'mini-table')) {
      const read = new Set([...(card.config.binding.select ?? []), ...(card.config.binding.lookups ?? []).map((lookup) => lookup.split(':')[0] ?? '')]);
      for (const column of card.config.columns ?? []) expect(read.has(column.name), `${card.i} · ${column.name}`).toBe(true);
      for (const column of card.config.secondary ?? []) expect(read.has(column), `${card.i} · ${column}`).toBe(true);
      expect(card.config.secondary?.length ?? 0, card.i).toBeLessThanOrEqual(3);
      expect(card.config.emptyState?.titleKey, card.i).toBeTruthy();
      expect(card.config.binding.limit, card.i).toBe(6);
    }
  });

  it('leads each card to a page of the add-on, narrowed by columns that page\'s table has', () => {
    for (const card of cards) {
      const href = card.config.href ?? card.config.viewAllHref;
      if (href === undefined) continue;
      const [path, query = ''] = href.split('?');
      const page = pages.find((one) => `/p/${one.ref}` === path) as (Page & { bindings?: { rows: string } }) | undefined;
      expect(page, `${card.i} · ${href}`).toBeDefined();
      for (const part of query.split('&').filter((one) => one !== '')) {
        const match = /^f\.([a-z_]+)=/.exec(part);
        expect(match, `${card.i} · ${part}`).not.toBeNull();
        expect(has(page?.bindings?.rows ?? '', match?.[1] ?? ''), `${card.i} · ${part}`).toBe(true);
      }
    }
  });

  it('counts what is low, what is out and what to reorder by the stock point\'s own flags', () => {
    const filtersOf = (i: string) => cards.find((card) => card.i === i)?.config.binding.filters;
    expect(filtersOf('low')).toEqual([{ column: 'low', op: 'eq', value: 1 }]);
    // "Out" is said only of a point that has a level set: a place that simply holds none is not out.
    expect(filtersOf('out')).toEqual([{ column: 'low', op: 'eq', value: 1 }, { column: 'on_hand', op: 'lte', value: 0 }]);
    expect(filtersOf('to-reorder')).toEqual([{ column: 'to_reorder', op: 'eq', value: 1 }]);
    expect(cards.find((card) => card.i === 'value')?.config.binding.aggregations).toEqual([{ fn: 'sum', column: 'value', alias: 'value' }]);
  });

  it('offers two ways in from its toolbar, the first the main one', () => {
    const links = overview?.config?.layout?.toolbar?.links ?? [];
    expect(links.map((link) => [link.label, link.href, link.tone])).toEqual([
      ['Receive stock', '/add-ons/inventory/inventory-receive', 'primary'],
      ['Start a count', '/add-ons/inventory/inventory-counts?start=1', undefined],
    ]);
  });
});
