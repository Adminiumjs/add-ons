/**
 * THE OVERVIEW, AS IT IS DECLARED.
 *
 * A dashboard of eleven cards, each reading one table of the add-on. What
 * the figures come to is proved where there is a database (the engine's
 * acceptance suite, over the sample); here the declaration is held to its
 * shape: which table, which sum, which rows, which month — the things a
 * wrong figure would come from.
 */
import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };

interface Binding {
  source: { name: string; type: string };
  shape: string;
  aggregations?: { fn: string; column?: string; alias: string }[];
  filters?: { column: string; op: string; value?: unknown }[];
  window?: Record<string, unknown>;
  groupBy?: string[];
  groupLabel?: string;
  select?: string[];
  lookups?: string[];
  orderBy?: { column: string; dir: string }[];
  limit?: number;
}
interface Item {
  i: string;
  widget: string;
  x: number;
  y: number;
  w: number;
  h: number;
  config: { title: string; titles: Record<string, string>; subtitles?: Record<string, string>; metricLabels?: Record<string, string>; emptyState?: { titleKey: string; titles: Record<string, string> }; href?: string; viewAllHref?: string; columns?: { name: string }[]; secondary?: string[]; series?: { label: string; labels: Record<string, string> }[]; binding: Binding };
}
const page = (manifest.pages as unknown as { ref: string; template: string; nav: { group: string; order: number }; titles: Record<string, string>; config: { layout: { toolbar: { links: { label: string; labels: Record<string, string>; href: string; tone?: string }[] }; items: Item[] } } }[]).find((one) => one.ref === 'offers-overview')!;
const items = page.config.layout.items;
const item = (id: string): Item => items.find((one) => one.i === id)!;
const tables = manifest.requiredSchema.tables as unknown as { ref: string; columns: { ref: string }[] }[];
const columnsOf = (table: string): string[] => tables.find((one) => one.ref === table)!.columns.map((column) => column.ref);
const LOCALES = ['ar-EG', 'cs-CZ', 'da-DK', 'de-DE', 'en-US', 'fr-FR', 'zh-CN', 'zh-TW'];
const LAST_MONTH = { column: 'at', last: 1, unit: 'month', calendar: true, offset: 1 };
const said = (binding: Binding): string => `${binding.source.name} · ${(binding.aggregations ?? []).map((agg) => (agg.column === undefined ? agg.fn : `${agg.fn}(${agg.column})`)).join(', ')} · ${(binding.filters ?? []).map((filter) => `${filter.column} ${filter.op}${filter.value === undefined ? '' : ` ${JSON.stringify(filter.value)}`}`).join(' and ')}`;

describe('the Overview', () => {
  it('is the first page of the rail, a dashboard of three and two tiles, two rankings and four lists', () => {
    expect(page.template).toBe('page-dashboard');
    expect(page.nav).toMatchObject({ group: 'manifest:offers', order: 5 });
    expect((manifest.pages as unknown as { ref: string }[])[0]?.ref).toBe('offers-overview');
    expect(items.map((one) => `${one.i} ${one.widget} ${String(one.x)},${String(one.y)} w${String(one.w)}`)).toEqual([
      'owed kpi-stat-card 0,0 w4',
      'given kpi-stat-card 4,0 w4',
      'uses kpi-stat-card 8,0 w4',
      'issued kpi-stat-card 0,3 w6',
      'spent kpi-stat-card 6,3 w6',
      'discounts chart-ranking-bars 0,6 w6',
      'staff chart-ranking-bars 6,6 w6',
      'cards mini-table 0,14 w4',
      'batches mini-table 4,14 w4',
      'packs mini-table 8,14 w4',
      'activity mini-table 0,21 w12',
    ]);
    // Twelve columns, and no two cards on the same ground.
    for (const one of items) expect(one.x + one.w, one.i).toBeLessThanOrEqual(12);
    for (const a of items) for (const b of items) if (a !== b) expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h, `${a.i} over ${b.i}`).toBe(false);
  });

  it('the five tiles read these sums of these rows', () => {
    expect(said(item('owed').config.binding)).toBe('gift_cards · sum(balance) · status eq "active"');
    // What was given is what was taken off orders by rules and by hand: never a voucher's or a pack's worth.
    expect(said(item('given').config.binding)).toBe('applied · sum(amount) · kind in ["offer","code","staff"]');
    expect(said(item('uses').config.binding)).toBe('redemptions · count · state eq "counted" and offer_id not_null');
    // Money given back to a credit is a refund row: it is not "issued".
    expect(said(item('issued').config.binding)).toBe('card_ledger · sum(value) · kind in ["issue","top_up"]');
    // `value` is what moved, always above nothing; `amount` is signed as the holder sees it and would read below it.
    expect(said(item('spent').config.binding)).toBe('card_ledger · sum(value) · kind eq "spend"');
    // What is owed is owed now; the other four are last month's.
    expect(item('owed').config.binding.window).toBeUndefined();
    for (const id of ['given', 'uses', 'issued', 'spent', 'discounts', 'staff']) expect(item(id).config.binding.window, id).toEqual(LAST_MONTH);
  });

  it('the two rankings group last month by discount and by reason, most given first, with the uses beside', () => {
    const discounts = item('discounts').config.binding;
    expect(said(discounts)).toBe('redemptions · sum(amount), count · state eq "counted" and offer_id not_null');
    expect(discounts).toMatchObject({ groupBy: ['offer_id'], groupLabel: 'offer_id.name', orderBy: [{ column: 'given', dir: 'desc' }], limit: 5 });
    const staff = item('staff').config.binding;
    expect(said(staff)).toBe('applied · sum(amount), count · kind eq "staff"');
    expect(staff).toMatchObject({ groupBy: ['reason_id'], groupLabel: 'reason_id.label', orderBy: [{ column: 'given', dir: 'desc' }] });
    for (const id of ['discounts', 'staff']) expect(item(id).config.series?.map((series) => series.label), id).toEqual(['Given', 'Uses']);
  });

  it('the four lists read these rows in this order', () => {
    expect(item('cards').config.binding).toMatchObject({ select: ['id', 'label', 'balance'], filters: [{ column: 'kind', op: 'eq', value: 'card' }, { column: 'status', op: 'eq', value: 'active' }, { column: 'balance', op: 'gt', value: 0 }], orderBy: [{ column: 'balance', dir: 'desc' }, { column: 'issued_at', dir: 'asc' }, { column: 'id', dir: 'asc' }], limit: 6 });
    expect(item('batches').config.binding).toMatchObject({ select: ['id', 'name', 'used', 'count', 'expires_on'], orderBy: [{ column: 'id', dir: 'desc' }] });
    expect(item('packs').config.binding).toMatchObject({ filters: [{ column: 'worth', op: 'eq', value: 'pack' }, { column: 'uses_left', op: 'gt', value: 0 }] });
    // Newest first by the moment it happened, not by the order rows were written in.
    expect(item('activity').config.binding).toMatchObject({ lookups: ['card:card_id.label', 'what:card_id.kind'], orderBy: [{ column: 'at', dir: 'desc' }, { column: 'id', dir: 'desc' }], limit: 6 });
    for (const one of items.filter((candidate) => candidate.widget === 'mini-table')) expect(one.config.binding.limit, one.i).toBeLessThanOrEqual(6);
    // A list draws five rows unless it says six itself, and its first three columns: the amount is one of them, as money, and
    // what happened reads as a word, not as the stored value.
    for (const one of items.filter((candidate) => candidate.widget === 'mini-table')) expect((one.config as { limit?: number }).limit, one.i).toBe(6);
    const shown = (item('activity').config as unknown as { columns: { name: string; semantic?: string; enumLabels?: Record<string, string> }[] }).columns;
    expect(shown.map((column) => column.name)).toEqual(['card', 'kind', 'amount']);
    expect(shown[1]!.enumLabels).toMatchObject({ issue: 'Issued', spend: 'Spent', void: 'Cancelled' });
    expect(shown[2]!.semantic).toBe('money');
    expect((item('cards').config as unknown as { columns: { name: string; semantic?: string }[] }).columns.find((column) => column.name === 'balance')!.semantic).toBe('money');
  });

  it('every widget reads one table, and only columns that table has', () => {
    for (const one of items) {
      const binding = one.config.binding;
      const has = columnsOf(binding.source.name);
      const named = [...(binding.aggregations ?? []).flatMap((agg) => (agg.column === undefined ? [] : [agg.column])), ...(binding.filters ?? []).map((filter) => filter.column), ...(binding.groupBy ?? []), ...(binding.select ?? []), ...(binding.window === undefined ? [] : [String(binding.window['column'])])];
      for (const column of named) expect(has, `${one.i}: ${binding.source.name}.${column}`).toContain(column);
      const shown = new Set([...(binding.select ?? []), ...(binding.lookups ?? []).map((lookup) => lookup.split(':')[0] as string)]);
      for (const column of [...(one.config.columns ?? []).map((col) => col.name), ...(one.config.secondary ?? [])]) expect([...shown], `${one.i} shows ${column}`).toContain(column);
    }
  });

  it('no card reads a whole code, a link token or anybody\'s address', () => {
    const NEVER = ['code', 'link_token', 'recipient_email', 'owner_email', 'holder_email', 'to_address'];
    for (const one of items) {
      const binding = one.config.binding;
      const read = [...(binding.select ?? []), ...(binding.groupBy ?? []), ...(binding.filters ?? []).map((filter) => filter.column), ...(binding.aggregations ?? []).map((agg) => agg.column ?? ''), ...(binding.lookups ?? []).flatMap((lookup) => (lookup.split(':')[1] ?? '').split('.')), ...(binding.groupLabel ?? '').split('.')];
      for (const column of read) expect(NEVER, `${one.i} reads ${column}`).not.toContain(column);
    }
  });

  it('every title and empty state has eight languages', () => {
    expect(Object.keys(page.titles).sort()).toEqual(LOCALES);
    for (const one of items) {
      for (const [what, words] of Object.entries({ titles: one.config.titles, subtitles: one.config.subtitles, metricLabels: one.config.metricLabels, empty: one.config.emptyState?.titles })) {
        if (words === undefined) continue;
        expect(Object.keys(words).sort(), `${one.i} ${what}`).toEqual(LOCALES);
        for (const sentence of Object.values(words)) expect(sentence.trim(), `${one.i} ${what}`).not.toBe('');
      }
      expect(one.config.titles['en-US'], one.i).toBe(one.config.title);
      for (const series of one.config.series ?? []) expect(Object.keys(series.labels).sort(), one.i).toEqual(LOCALES);
    }
    // Every list and ranking says something when it is empty; a tile reads nothing as zero.
    for (const one of items.filter((candidate) => candidate.widget !== 'kpi-stat-card')) expect(one.config.emptyState, one.i).toBeDefined();
  });

  it('opens the lists it sums, and offers New discount and Issue as links', () => {
    expect(Object.fromEntries(items.flatMap((one) => (one.config.href ?? one.config.viewAllHref) === undefined ? [] : [[one.i, one.config.href ?? one.config.viewAllHref]]))).toEqual({
      owed: '/p/offers-gift-cards',
      given: '/add-ons/offers/offers-discounts',
      // Uses, not Codes: half the discounts have no code.
      uses: '/p/offers-uses',
      issued: '/p/offers-activity',
      spent: '/p/offers-activity',
      cards: '/p/offers-gift-cards',
      batches: '/p/offers-voucher-batches',
      packs: '/p/offers-vouchers?f.worth=eq:pack',
      activity: '/p/offers-activity',
    });
    const refs = new Set((manifest.pages as unknown as { ref: string }[]).map((one) => one.ref));
    for (const one of items) {
      const to = one.config.href ?? one.config.viewAllHref;
      if (to?.startsWith('/p/') === true) expect([...refs], one.i).toContain(to.slice(3).split('?')[0]);
    }
    expect(page.config.layout.toolbar.links.map((link) => `${link.label} ${link.href} ${link.tone ?? ''}`.trim())).toEqual(['New discount /add-ons/offers/offers-discounts/new primary', 'Issue /add-ons/offers/offers-issue']);
    for (const link of page.config.layout.toolbar.links) expect(Object.keys(link.labels).sort()).toEqual(LOCALES);
    // A toolbar link draws one of the few icons a dashboard's toolbar has; any other and the page is refused at install.
    for (const link of page.config.layout.toolbar.links as unknown as { icon?: string }[]) expect(['arrow-right', 'clipboard-list', 'external-link', 'package-plus', 'clipboard-check', 'plus', 'gift']).toContain(link.icon);
  });
});
