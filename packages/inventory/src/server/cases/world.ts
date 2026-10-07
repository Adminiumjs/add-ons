/**
 * THE SMALL WORLD THE CASES STAND IN.
 *
 * A treatment room, a shop and a linen store, with just the items, batches
 * and kits the cases reason about. Rows are written as Adminium hands them to
 * the deciding code: keys as numbers, quantities and costs as text.
 */

import type { PostingInput, PostingLine, PostingOutput } from '@adminium/add-on-contracts';

type Row = Record<string, string | number | boolean | null>;

export const PLACE = { treatment: 1, shop: 2, back: 3, linen: 4, laundry: 5, damaged: 6 } as const;

const item = (id: number, name: string, cost: string, more: Row = {}): Row => ({ id, name, unit: 'each', decimals: 0, tracks_batches: false, when_out: 'default', allow_short: 1, active: true, cost_avg: cost, ...more });

export const ITEMS = {
  lidocaine: item(10, 'Lidocaine 1% ampoule', '1.1000', { tracks_batches: true }),
  tshirt: item(20, 'T-shirt blue M', '7.4000', { when_out: 'stop', allow_short: 0 }),
  tote: item(21, 'Canvas tote natural', '3.1000'),
  pen: item(22, 'Pen, black', '0.4500'),
  bathTowel: item(30, 'Bath towel', '6.0000'),
  handTowel: item(31, 'Hand towel', '3.0000'),
  sheetSet: item(32, 'Sheet set', '18.0000'),
  amenityKit: item(33, 'Amenity kit', '1.2000'),
  soap: item(34, 'Soap', '0.3000'),
  tea: item(35, 'Tea bag', '0.1000'),
  vaccine: item(40, 'Flu vaccine, single dose', '9.5000', { tracks_batches: true }),
  syringe: item(41, 'Syringe 2 ml', '0.2000'),
  needle: item(42, 'Needle 23G', '0.0500'),
  swab: item(43, 'Alcohol swab', '0.0200'),
  plaster: item(44, 'Plaster', '0.0300'),
  gloves: item(45, 'Gloves, pair', '0.1500'),
} as const;

/** A stock point as it is read: totals as text, flags as the database stores them. */
export const point = (id: number, of: Row, place: number, onHand: string, more: Row = {}): Row => ({
  id,
  item_id: of['id'] as number,
  place_id: place,
  on_hand: onHand,
  reserved: '0.000',
  available: onHand,
  on_order: '0.000',
  low: 0,
  for_sale: true,
  needs_count: false,
  cost_avg: of['cost_avg'] as string,
  ...more,
});

export const batch = (id: number, of: Row, code: string, expires: string | null, unassigned = false): Row => ({ id, item_id: of['id'] as number, code, unassigned, expires_on: expires, received_on: null });

/** A level as it is read, with the copies it carries of its batch. */
export const level = (id: number, at: Row, of: Row, qty: string): Row => ({
  id,
  stock_point_id: at['id'] as number,
  batch_id: of['id'] as number,
  item_id: at['item_id'] as number,
  place_id: at['place_id'] as number,
  unassigned: of['unassigned'] as boolean,
  batch_code: of['code'] as string,
  expires_on: of['expires_on'],
  qty,
});

export const link = (id: number, row: string, more: Row): Row => ({ id, source_table: 'shop:things', source_row: row, kind: 'item', item_id: null, kit_id: null, qty: '1.000', per: 'unit', action: 'use', place_id: null, to_place_id: null, ...more });
export const kitLine = (id: number, kit: number, of: Row, qty: string, more: Row = {}): Row => ({ id, kit_id: kit, item_id: of['id'] as number, qty, per: 'unit', action: 'use', place_id: null, to_place_id: null, ...more });

export const SETTINGS: Row = { id: 1, default_place_id: null, default_unit_id: 1, when_out_staff: 'allow', when_out_public: 'stop', show_left_below: 5, count_stale_days: 90 };

/** A line that names a host row, or a stock item. */
export const lineFor = (key: string, inputs: PostingLine['inputs'], multipliers: Record<string, number> = {}): PostingLine => ({ line: key, lineTable: 'shop:things', inputs, multipliers, round: 1 }) as PostingLine;
export const what = (row: string) => ({ table: 'shop:things', row });

/** One call, with everything a case does not say left as a plain staff save on the first of October. */
export function call(over: Partial<PostingInput> & Pick<PostingInput, 'action' | 'lines' | 'reads'>): PostingInput {
  return {
    contract: 'posting-rows@1',
    ledger: 'stock',
    posting: 'case',
    phase: 'post',
    mode: 'save',
    origin: 'staff',
    now: '2026-10-01T09:00:00.000Z',
    today: '2026-10-01',
    zone: 'UTC',
    currency: 'USD',
    source: { table: 'shop:things', row: '1' },
    settings: SETTINGS,
    written: {},
    version: '1.0.8',
    ...over,
  };
}

/** One worked example: what is asked, and what the answer must hold. */
export interface Case {
  name: string;
  input: PostingInput;
  /** Checked as a whole when given; a case that only cares about part of an answer says which part. */
  expect: {
    rows?: PostingOutput['rows'];
    refusals?: NonNullable<PostingOutput['refusals']>;
    notes?: NonNullable<PostingOutput['notes']>;
    words?: NonNullable<PostingOutput['words']>;
  };
}

const NO_MORE = { reason_id: null, note: null, reverses_id: null, pair_id: null };
/** A movement row as the answer writes it. */
export const movement = (line: string, levelRef: number | { '@row': string }, kind: string, qty: string, cost: string, more: Record<string, unknown> = {}, label?: string) =>
  ({ op: 'insert', table: 'movements', ...(label === undefined ? {} : { label }), line, values: { level_id: levelRef, kind, qty, unit_cost: cost, ...NO_MORE, ...more } }) as PostingOutput['rows'][number];
