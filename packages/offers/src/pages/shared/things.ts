/**
 * THE TABLES AN OFFER CAN NAME THINGS OF, AND THEIR ROWS.
 *
 * A discount "for these items", a voucher "for a massage": the things are
 * rows of somebody else's tables — the ones a table that takes discounts says
 * its lines sell (`what`). Those tables are not this add-on's, so they are
 * read through the dashboard's own data route with the reader's own grants,
 * a page at a time, searched by the server.
 */
import { api, type DataRow } from './host.ts';

export interface WhatTable {
  /** The table's id, as the data routes take it. */
  table: string;
  /** Its stored name, as a target or a voucher keeps it. */
  ref: string;
  label: string;
  as: 'item' | 'category' | 'type';
}

export interface Adjusted {
  table: string;
  tableLabel: string;
  owner: string | null;
  ownerName?: string;
  enabled: boolean;
  state: 'live' | 'off' | 'idle' | 'unavailable';
  adjust: Readonly<Record<string, unknown>>;
  what: readonly { table: string; ref?: string; label: string; as: string }[];
  holding: number;
}

export interface Mapped {
  connectionId: string;
  adjusts: readonly Adjusted[];
  canChange: boolean;
  /** Every table a thing can be picked from, once each. */
  what: readonly WhatTable[];
}

const KIT = '/api/v1/add-ons/offers/kit';

export async function connectionOf(): Promise<string> {
  return (await api.get<{ connectionId: string }>(KIT)).connectionId;
}

/** The tables that take discounts here, and what their lines sell. */
export async function mapped(): Promise<Mapped> {
  const connectionId = await connectionOf();
  const reply = await api.get<{ adjusts: Adjusted[]; canChange: boolean }>(`/api/v1/add-ons/offers/adjusts?connectionId=${encodeURIComponent(connectionId)}`);
  const what = new Map<string, WhatTable>();
  for (const adjusted of reply.adjusts) {
    for (const entry of adjusted.what) {
      if (entry.as !== 'item' && entry.as !== 'category' && entry.as !== 'type') continue;
      what.set(`${entry.table} ${entry.as}`, { table: entry.table, ref: entry.ref ?? entry.table, label: entry.label, as: entry.as });
    }
  }
  return { connectionId, adjusts: reply.adjusts, canChange: reply.canChange, what: [...what.values()] };
}

export interface Thing {
  key: string;
  label: string;
}

/** A row's name: its first text that is not its key, else the key. */
export function nameOf(row: DataRow): string {
  for (const [column, value] of Object.entries(row)) if (column !== 'id' && typeof value === 'string' && value.trim() !== '') return value;
  return String(row['id'] ?? '');
}

/** Rows of a table things are picked from, searched by the server; twenty-five at a time. */
export async function things(connectionId: string, table: string, search: string): Promise<Thing[]> {
  const query = new URLSearchParams({ limit: '25' });
  if (search.trim() !== '') query.set('q', search.trim());
  const reply = await api.get<{ data: DataRow[] }>(`/api/v1/data/${encodeURIComponent(connectionId)}/${encodeURIComponent(table)}?${query.toString()}`);
  return reply.data.map((row) => ({ key: String(row['id'] ?? ''), label: nameOf(row) })).filter((thing) => thing.key !== '');
}
