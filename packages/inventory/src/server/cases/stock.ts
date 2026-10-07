/**
 * RECEIVING, ORDERING, COUNTING, MOVING, REORDERING — the worked examples.
 */

import { batch, call, type Case, ITEMS, level, lineFor, link, movement, PLACE, point, what } from './world.ts';

const I = ITEMS;
const NOW = '2026-10-01T09:00:00.000Z';

// ── a delivery against an order: lidocaine, kept by batch ───────────────────
const lidPoint = point(100, I.lidocaine, PLACE.treatment, '14.000', { on_order: '50.000' });
const LD118 = batch(500, I.lidocaine, 'LD118', '2026-10-20');
const ORDER = { id: 9002, status: 'sent', place_id: PLACE.treatment, supplier_id: 5 };
const orderLines = (received: [string, string, string]) => [
  { id: 90021, po_id: 9002, item_id: 10, qty: '50.000', received: received[0] },
  { id: 90022, po_id: 9002, item_id: 41, qty: '200.000', received: received[1] },
  { id: 90023, po_id: 9002, item_id: 42, qty: '40.000', received: received[2] },
];
const delivery = { items: [I.lidocaine], points: [lidPoint], levels: [level(1000, lidPoint, LD118, '14.000')], batches: [LD118], order: [ORDER], order_lines: orderLines(['50.000', '0.000', '0.000']) };
const fivePacks = (more: Record<string, string | number | null> = {}) => [
  lineFor('L1', { item: 10, quantity: 50, cost: '1.1000', guessed: 0, place: PLACE.treatment, batch_code: 'LD201', expires: '2027-04-30', po: 9002, po_line: 90021, kind: 'delivery', ...more }),
];
const NEW_BATCH = 'b:10:LD201';
const NEW_LEVEL = `l:p100:${NEW_BATCH}`;
const newBatchRows = (expires = '2027-04-30') => [
  { op: 'insert', table: 'batches', label: NEW_BATCH, line: 'L1', values: { item_id: 10, code: 'LD201', unassigned: false, expires_on: expires, received_on: '2026-10-01' } },
  { op: 'insert', table: 'levels', label: NEW_LEVEL, line: 'L1', values: { stock_point_id: 100, batch_id: { '@row': NEW_BATCH } } },
] as Case['expect']['rows'] & object;
const offOrder = [
  { op: 'insert', table: 'on_order_moves', line: 'L1', values: { stock_point_id: 100, qty: '-50.000', kind: 'received' } },
  { op: 'update', table: 'purchase_orders', line: 'L1', key: { id: 9002 }, set: { status: 'part_received' } },
] as Case['expect']['rows'] & object;

// ── a shop: a shirt with none, and where its stock is reordered from ────────
const shirtPoint = point(200, I.tshirt, PLACE.shop, '0.000', { reorder_level: '8.000', reorder_qty: '12.000', place_name: 'Shop floor', low: 1 });
const totePoint = point(201, I.tote, PLACE.shop, '4.000', { reorder_level: '10.000', reorder_qty: '20.000', place_name: 'Shop floor', low: 1 });
const toteBack = point(202, I.tote, PLACE.back, '200.000', { reorder_level: '150.000', place_name: 'Back room' });
const pref = (id: number, itemId: number, packSize: string, price: string, code: string) => ({ id, item_id: itemId, supplier_id: 5, supplier_code: code, pack_name: 'box', pack_size: packSize, price, rank: 'preferred', supplier_name: 'Northgate' });
const shirtPref = pref(1, 20, '6.000', '44.4000', 'NG-TS-BM');
const totePref = pref(2, 21, '10.000', '31.0000', 'NG-TOTE');
const request = (id: number, at: number, itemId: number) => ({ id, stock_point_id: at, item_id: itemId, status: 'open', qty: null, po_line_id: null, elsewhere: null });
const DRAFT = { id: 9003, supplier_id: 5, place_id: PLACE.shop, status: 'draft', lines: 1 };
const reorderCall = (id: number, reads: Record<string, Record<string, string | number | boolean | null>[]>) => call({ action: 'reorder', source: { table: 'inventory:reorder_requests', row: String(id) }, lines: [lineFor(String(id), {})], reads });
const drafted = (id: number, at: number, qty: string, lineId?: number) =>
  [
    { op: 'update', table: 'reorder_requests', line: String(id), key: { id }, set: lineId === undefined ? { status: 'drafted', qty } : { status: 'drafted', qty, po_line_id: lineId } },
    { op: 'update', table: 'stock_points', line: String(id), key: { id: at }, set: { request_note: 'drafted', request_supplier: 'Northgate', request_elsewhere: null } },
  ] as Case['expect']['rows'] & object;

// ── a count of pens ─────────────────────────────────────────────────────────
const penPoint = point(220, I.pen, PLACE.shop, '74.000');
const penBatch = batch(522, I.pen, '-', null, true);
const countLine = (more: Record<string, string | number | null> = {}) => ({ id: 700, count_id: 70, level_id: 2200, stock_point_id: 220, item_id: 22, status: 'open', counted: null, qty_when_counted: null, counted_at: null, unit_cost: null, ...more });
const MARKED = { counted: '71.000', qty_when_counted: '74.000', counted_at: NOW, unit_cost: '0.4500', status: 'posted' };
const SHEET = { id: 70, reason_id: 7, status: 'posting' };
const countCall = (line: Record<string, string | number | null>, held: string, lvl = penBatch) =>
  call({ action: 'count', source: { table: 'inventory:count_lines', row: '700' }, lines: [lineFor('700', {})], reads: { line: [countLine(line)], sheet: [SHEET], level: [level(2200, penPoint, lvl, held)], items: [I.pen], points: [penPoint] } });
const counted = (needsCount: boolean) => ({ op: 'update', table: 'stock_points', line: '700', key: { id: 220 }, set: { needs_count: needsCount, last_counted_at: NOW } }) as const;

// ── linen ───────────────────────────────────────────────────────────────────
const towelStore = point(300, I.bathTowel, PLACE.linen, '236.000');
const towelAway = point(310, I.bathTowel, PLACE.laundry, '24.000');
const towelBatch = batch(530, I.bathTowel, '-', null, true);
const towels = { items: [I.bathTowel], points: [towelStore, towelAway], levels: [level(3000, towelStore, towelBatch, '236.000'), level(3100, towelAway, towelBatch, '24.000')], batches: [towelBatch] };

export const STOCK_CASES: Case[] = [
  {
    name: 'C1 · five packs received as a new batch, against a sent order',
    input: call({ action: 'receive', lines: fivePacks(), reads: delivery }),
    expect: { rows: [...newBatchRows(), movement('L1', { '@row': NEW_LEVEL }, 'received', '50.000', '1.1000'), ...offOrder] },
  },
  {
    name: 'C2 · a dearer delivery moves the average: (14 × 1.10 + 50 × 1.25) ÷ 64',
    input: call({ action: 'receive', lines: fivePacks({ cost: '1.2500' }), reads: delivery }),
    expect: {
      rows: [
        ...newBatchRows(),
        movement('L1', { '@row': NEW_LEVEL }, 'received', '50.000', '1.2500'),
        { op: 'update', table: 'items', line: 'L1', key: { id: 10 }, set: { cost_avg: '1.2172' } },
        { op: 'update', table: 'stock_points', line: 'L1', key: { id: 100 }, set: { cost_avg: '1.2172' } },
        ...offOrder,
      ],
    },
  },
  {
    name: 'C3 · with nothing on hand the average is simply what was paid',
    input: call({ action: 'receive', lines: [lineFor('L1', { item: 20, quantity: 12, cost: '7.9000', guessed: 0, place: PLACE.shop })], reads: { items: [I.tshirt], points: [shirtPoint], levels: [], batches: [], order: [], order_lines: [] } }),
    expect: {
      rows: [
        { op: 'insert', table: 'batches', label: 'b:20:-', line: 'L1', values: { item_id: 20, code: '-', unassigned: true, expires_on: null, received_on: null } },
        { op: 'insert', table: 'levels', label: 'l:p200:b:20:-', line: 'L1', values: { stock_point_id: 200, batch_id: { '@row': 'b:20:-' } } },
        movement('L1', { '@row': 'l:p200:b:20:-' }, 'received', '12.000', '7.9000'),
        { op: 'update', table: 'items', line: 'L1', key: { id: 20 }, set: { cost_avg: '7.9000' } },
        { op: 'update', table: 'stock_points', line: 'L1', key: { id: 200 }, set: { cost_avg: '7.9000' } },
      ],
    },
  },
  {
    name: 'C4 · no cost known: taken at the average, which does not move, and said so',
    input: call({ action: 'receive', lines: [lineFor('L1', { item: 20, quantity: 12, cost: 0, guessed: 1, place: PLACE.shop })], reads: { items: [I.tshirt], points: [shirtPoint], levels: [], batches: [], order: [], order_lines: [] } }),
    expect: {
      rows: [
        { op: 'insert', table: 'batches', label: 'b:20:-', line: 'L1', values: { item_id: 20, code: '-', unassigned: true, expires_on: null, received_on: null } },
        { op: 'insert', table: 'levels', label: 'l:p200:b:20:-', line: 'L1', values: { stock_point_id: 200, batch_id: { '@row': 'b:20:-' } } },
        movement('L1', { '@row': 'l:p200:b:20:-' }, 'received', '12.000', '7.4000'),
      ],
      notes: [{ line: 'L1', note: 'cost-to-check', item: 'T-shirt blue M' }],
    },
  },
  {
    name: 'C5 · an item kept by batch, received with no batch',
    input: call({ action: 'receive', lines: fivePacks({ batch_code: null }), reads: delivery }),
    expect: { rows: [], refusals: [{ line: 'L1', reason: 'needs-batch', item: 'Lidocaine 1% ampoule' }] },
  },
  {
    name: 'C28 · a new batch that expired yesterday is a date typed wrong on a delivery',
    input: call({ action: 'receive', lines: fivePacks({ expires: '2026-09-30' }), reads: delivery }),
    expect: { rows: [], refusals: [{ line: 'L1', reason: 'expired', item: 'Lidocaine 1% ampoule' }] },
  },
  {
    name: 'C28 · and old stock when it is loaded at opening',
    input: call({ action: 'receive', lines: fivePacks({ expires: '2026-09-30', kind: 'opening', po: null, po_line: null }), reads: { ...delivery, order: [], order_lines: [] } }),
    expect: { rows: [...newBatchRows('2026-09-30'), movement('L1', { '@row': NEW_LEVEL }, 'opening', '50.000', '1.1000')] },
  },
  {
    name: 'C28 · a transfer to the place it is in',
    input: call({ action: 'transfer', lines: [lineFor('L1', { item: 30, quantity: 24, from: PLACE.linen, to: PLACE.linen })], reads: towels }),
    expect: { rows: [], refusals: [{ line: 'L1', reason: 'not-allowed' }] },
  },
  {
    name: 'C12 · twenty-four bath towels back from the laundry',
    input: call({ action: 'transfer', lines: [lineFor('L1', { item: 30, quantity: 24, from: PLACE.laundry, to: PLACE.linen })], reads: towels }),
    expect: { rows: [movement('L1', 3100, 'moved_out', '-24.000', '6.0000', {}, 'o1:L1'), movement('L1', 3000, 'moved_in', '24.000', '6.0000', { pair_id: { '@row': 'o1:L1' } })] },
  },
  {
    name: 'C20 · an order sent: each line is on order where it will arrive',
    input: call({
      action: 'on-order',
      lines: ['90021', '90022', '90023'].map((key) => lineFor(key, { po: 9002, place: PLACE.treatment })),
      reads: { order_lines: orderLines(['0.000', '0.000', '0.000']), items: [I.lidocaine, I.syringe, I.needle], points: [lidPoint, point(401, I.syringe, PLACE.treatment, '0.000'), point(402, I.needle, PLACE.treatment, '0.000')] },
    }),
    expect: {
      rows: [
        { op: 'insert', table: 'on_order_moves', line: '90021', values: { stock_point_id: 100, qty: '50.000', kind: 'sent' } },
        { op: 'insert', table: 'on_order_moves', line: '90022', values: { stock_point_id: 401, qty: '200.000', kind: 'sent' } },
        { op: 'insert', table: 'on_order_moves', line: '90023', values: { stock_point_id: 402, qty: '40.000', kind: 'sent' } },
      ],
    },
  },
  {
    name: 'C20 · closed by a person: what is still open comes off, and nothing for the line that arrived',
    input: call({
      action: 'on-order-close',
      lines: ['90021', '90022', '90023'].map((key) => lineFor(key, { po: 9002, place: PLACE.treatment, how: 'received' })),
      reads: { order_lines: orderLines(['50.000', '0.000', '0.000']), items: [I.lidocaine, I.syringe, I.needle], points: [lidPoint, point(401, I.syringe, PLACE.treatment, '0.000'), point(402, I.needle, PLACE.treatment, '0.000')] },
    }),
    expect: {
      rows: [
        { op: 'insert', table: 'on_order_moves', line: '90022', values: { stock_point_id: 401, qty: '-200.000', kind: 'closed' } },
        { op: 'insert', table: 'on_order_moves', line: '90023', values: { stock_point_id: 402, qty: '-40.000', kind: 'closed' } },
      ],
    },
  },
  {
    name: 'C20 · reopened: what the close took off counts as on order again',
    input: call({
      action: 'on-order-close',
      phase: 'reverse',
      lines: ['90021', '90022', '90023'].map((key) => lineFor(key, { po: 9002, place: PLACE.treatment, how: 'received' })),
      reads: { order_lines: orderLines(['50.000', '0.000', '0.000']), items: [I.lidocaine, I.syringe, I.needle], points: [lidPoint] },
      written: { on_order_moves: [{ id: 61, stock_point_id: 401, qty: '-200.000', kind: 'closed' }, { id: 62, stock_point_id: 402, qty: '-40.000', kind: 'closed' }] },
    }),
    expect: {
      rows: [
        { op: 'insert', table: 'on_order_moves', line: '90021', values: { stock_point_id: 401, qty: '200.000', kind: 'reopened' } },
        { op: 'insert', table: 'on_order_moves', line: '90021', values: { stock_point_id: 402, qty: '40.000', kind: 'reopened' } },
      ],
    },
  },
  {
    name: 'C10 · a count typed: what was counted, and what the books held at that moment',
    input: call({ action: 'count-mark', lines: [lineFor('M1', { line: 700, counted: 71 })], reads: { line: [countLine()], level: [level(2200, penPoint, penBatch, '74.000')], items: [I.pen] } }),
    expect: { rows: [{ op: 'update', table: 'count_lines', line: 'M1', key: { id: 700 }, set: { counted: '71.000', qty_when_counted: '74.000', counted_at: NOW, unit_cost: '0.4500' } }] },
  },
  {
    name: 'C10 · posted after a sale of two: the difference is still three, and the sale stands',
    input: countCall(MARKED, '72.000'),
    expect: { rows: [movement('700', 2200, 'adjusted', '-3.000', '0.4500', { reason_id: 7 }), counted(false)] },
  },
  {
    name: 'C10 · a count that agrees writes no movement',
    input: countCall({ ...MARKED, counted: '74.000' }, '74.000'),
    expect: { rows: [counted(false)] },
  },
  {
    name: 'C11 · one more than the books held',
    input: countCall({ ...MARKED, counted: '75.000' }, '74.000'),
    expect: { rows: [movement('700', 2200, 'adjusted', '1.000', '0.4500', { reason_id: 7 }), counted(false)] },
  },
  {
    name: 'C26 · a count un-typed',
    input: call({ action: 'count-mark', lines: [lineFor('M1', { line: 700, counted: null })], reads: { line: [countLine({ counted: '71.000', qty_when_counted: '74.000', counted_at: NOW, unit_cost: '0.4500' })], level: [level(2200, penPoint, penBatch, '74.000')], items: [I.pen] } }),
    expect: { rows: [{ op: 'update', table: 'count_lines', line: 'M1', key: { id: 700 }, set: { counted: null, qty_when_counted: null, counted_at: null, unit_cost: null } }] },
  },
  {
    name: 'C26 · and a count typed on a line already posted',
    input: call({ action: 'count-mark', lines: [lineFor('M1', { line: 700, counted: 70 })], reads: { line: [countLine(MARKED)], level: [level(2200, penPoint, penBatch, '74.000')], items: [I.pen] } }),
    expect: { rows: [], refusals: [{ line: 'M1', reason: 'not-allowed' }] },
  },
  {
    name: 'C27 · a named batch sold from since the count: taken to nothing, never below, and to be looked at',
    input: countCall(MARKED, '2.000', batch(523, I.pen, 'PEN-A', null)),
    expect: { rows: [movement('700', 2200, 'adjusted', '-2.000', '0.4500', { reason_id: 7 }), counted(true)], notes: [{ line: '700', note: 'to-check' }] },
  },
  {
    name: 'C15 · "Reorder" on the shirt: a draft order for its supplier, in whole packs',
    input: reorderCall(800, { request: [request(800, 200, 20)], items: [I.tshirt], points: [shirtPoint], prefs: [shirtPref], drafts: [], draft_lines: [] }),
    expect: {
      rows: [
        { op: 'insert', table: 'purchase_orders', label: 'po:5:2', line: '800', values: { supplier_id: 5, place_id: PLACE.shop, status: 'draft', note: null } },
        { op: 'insert', table: 'po_lines', line: '800', values: { po_id: { '@row': 'po:5:2' }, item_id: 20, supplier_code: 'NG-TS-BM', pack_name: 'box', packs: '2.000', pack_size: '6.000', price: '44.4000' } },
        ...drafted(800, 200, '12.000'),
      ],
    },
  },
  {
    name: 'C15 · then on the tote: a line on the same draft',
    input: reorderCall(801, { request: [request(801, 201, 21)], items: [I.tote], points: [totePoint], prefs: [totePref], drafts: [DRAFT], draft_lines: [] }),
    expect: {
      rows: [{ op: 'insert', table: 'po_lines', line: '801', values: { po_id: 9003, item_id: 21, supplier_code: 'NG-TOTE', pack_name: 'box', packs: '2.000', pack_size: '10.000', price: '31.0000' } }, ...drafted(801, 201, '20.000')],
    },
  },
  {
    name: 'C16 · pressed twice: the line is there already and nothing is added',
    input: reorderCall(802, { request: [request(802, 201, 21)], items: [I.tote], points: [totePoint], prefs: [totePref], drafts: [{ ...DRAFT, lines: 2 }], draft_lines: [{ id: 90031, po_id: 9003, item_id: 21, packs: '2.000', order_status: 'draft' }] }),
    expect: { rows: [...drafted(802, 201, '20.000', 90031)] },
  },
  {
    name: 'C16 · no preferred supplier: said on the request and on the stock point',
    input: reorderCall(803, { request: [request(803, 201, 21)], items: [I.tote], points: [totePoint], prefs: [], drafts: [], draft_lines: [] }),
    expect: {
      rows: [
        { op: 'update', table: 'reorder_requests', line: '803', key: { id: 803 }, set: { status: 'needs_supplier' } },
        { op: 'update', table: 'stock_points', line: '803', key: { id: 201 }, set: { request_note: 'needs_supplier', request_elsewhere: null, request_supplier: null } },
      ],
      notes: [{ line: '803', note: 'no-supplier', item: 'Canvas tote natural' }],
    },
  },
  {
    name: 'C16 · enough in the back room: say where, and order nothing',
    input: reorderCall(804, { request: [request(804, 201, 21)], items: [I.tote], points: [totePoint, toteBack], prefs: [totePref], drafts: [DRAFT], draft_lines: [] }),
    expect: {
      rows: [
        { op: 'update', table: 'reorder_requests', line: '804', key: { id: 804 }, set: { status: 'elsewhere', elsewhere: 'Back room' } },
        { op: 'update', table: 'stock_points', line: '804', key: { id: 201 }, set: { request_note: 'elsewhere', request_elsewhere: 'Back room', request_supplier: null } },
      ],
    },
  },
  {
    name: 'C16 · a draft that is full: a second draft for the same supplier and place',
    input: reorderCall(805, { request: [request(805, 201, 21)], items: [I.tote], points: [totePoint], prefs: [totePref], drafts: [{ ...DRAFT, lines: 50 }], draft_lines: [] }),
    expect: {
      rows: [
        { op: 'insert', table: 'purchase_orders', label: 'po:5:2', line: '805', values: { supplier_id: 5, place_id: PLACE.shop, status: 'draft', note: null } },
        { op: 'insert', table: 'po_lines', line: '805', values: { po_id: { '@row': 'po:5:2' }, item_id: 21, supplier_code: 'NG-TOTE', pack_name: 'box', packs: '2.000', pack_size: '10.000', price: '31.0000' } },
        ...drafted(805, 201, '20.000'),
      ],
    },
  },
  {
    name: 'C23 · a row of another table made into a stock item, with its link',
    input: call({ action: 'adopt', lines: [lineFor('L1', { what: what('espresso'), name: 'Espresso' })], reads: { links: [], unit: [{ id: 1, code: 'each' }] } }),
    expect: {
      rows: [
        { op: 'insert', table: 'items', label: 'i:L1', line: 'L1', values: { name: 'Espresso', unit_id: 1 } },
        { op: 'insert', table: 'links', line: 'L1', values: { source_table: 'shop:things', source_row: 'espresso', kind: 'item', item_id: { '@row': 'i:L1' }, qty: '1.000', per: 'unit', action: 'use' } },
      ],
    },
  },
  {
    name: 'C23 · one already linked is left alone',
    input: call({ action: 'adopt', lines: [lineFor('L1', { what: what('tote'), name: 'Tote' })], reads: { links: [link(2, 'tote', { item_id: 21 })], unit: [{ id: 1, code: 'each' }] } }),
    expect: { rows: [] },
  },
  {
    name: 'C23 · and with no default unit chosen, none can be made',
    input: call({ action: 'adopt', lines: [lineFor('L1', { what: what('espresso'), name: 'Espresso' })], reads: { links: [], unit: [] } }),
    expect: { rows: [], refusals: [{ line: 'L1', reason: 'not-allowed' }] },
  },
];
