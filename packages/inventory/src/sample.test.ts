/**
 * THE SAMPLE DATA, HELD TO THE FIGURES THE SCREENS SHOW.
 *
 * Adding the sample posts nothing: Adminium writes each row as it stands and
 * adds up the totals afterwards. So this suite does the same adding up, over
 * the file itself, and compares every figure a fresh install's Overview,
 * lists and documents show. A row dropped, a cost mistyped or a label renamed
 * fails here, before an engine is started.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { sampleBundleIssues, sampleBundleSchema, validateManifest } from '@adminiumjs/manifest';
import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };
import { buildSample, slug, type Row } from './sample/bundle.ts';
import { ITEMS, KITS, OPENING_BATCH, PLACES, PO_1001 } from './sample/data.ts';

const FILE = fileURLToPath(new URL('../seeds/inventory.sample.json', import.meta.url));
const bundle = JSON.parse(readFileSync(FILE, 'utf8')) as { format: string; app: string; tables: { ref: string; onlyIfEmpty?: boolean; rows: Row[] }[] };
const rowsOf = (ref: string): Row[] => bundle.tables.find((table) => table.ref === ref)?.rows ?? [];

/** The row a `{"@ref"}` names. */
const byLabel = new Map<string, Row>(bundle.tables.flatMap((table) => table.rows.flatMap((row) => (typeof row['@label'] === 'string' ? [[row['@label'], row] as const] : []))));
const labelOf = (value: unknown): string | null => (typeof value === 'object' && value !== null && typeof (value as Row)['@ref'] === 'string' ? ((value as Row)['@ref'] as string) : null);
const named = (value: unknown): Row => {
  const row = byLabel.get(labelOf(value) ?? '');
  if (row === undefined) throw new Error(`no row is labelled ${JSON.stringify(value)}`);
  return row;
};
const cents = (amount: unknown): number => Math.round(Number(amount) * 100);
const sum = (numbers: number[]): number => numbers.reduce((total, n) => total + n, 0);
const usd = (c: number): string => `${c < 0 ? '-' : ''}$${(Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

// ── the adding up Adminium does after the rows are in ────────────────────────
const movements = rowsOf('movements');
const levelQty = new Map<string, number>();
for (const move of movements) levelQty.set(labelOf(move['level_id'])!, (levelQty.get(labelOf(move['level_id'])!) ?? 0) + Number(move['qty']));
const levels = rowsOf('levels').map((level) => ({ label: level['@label'] as string, point: labelOf(level['stock_point_id'])!, batch: named(level['batch_id']), qty: levelQty.get(level['@label'] as string) ?? 0 }));
const onOrderOf = new Map<string, number>();
for (const move of rowsOf('on_order_moves')) onOrderOf.set(labelOf(move['stock_point_id'])!, (onOrderOf.get(labelOf(move['stock_point_id'])!) ?? 0) + Number(move['qty']));
const points = rowsOf('stock_points').map((point) => {
  const label = point['@label'] as string;
  const onHand = sum(levels.filter((level) => level.point === label).map((level) => level.qty));
  const onOrder = onOrderOf.get(label) ?? 0;
  const level = point['reorder_level'] === undefined ? null : Number(point['reorder_level']);
  // The three flags, as the manifest's formulas work them out (nothing is reserved, paused or switched off in the sample).
  const low = level !== null && onHand <= level;
  return {
    label,
    item: named(point['item_id']),
    place: named(point['place_id'])['name'] as string,
    onHand,
    onOrder,
    value: Math.round(onHand * cents(point['cost_avg'])),
    low,
    toReorder: low && onHand + onOrder <= level,
    state: !low ? 0 : onHand <= 0 ? 3 : onOrder > 0 ? 2 : 1,
    row: point,
  };
});
const pointOf = (sku: string, place: string) => points.find((point) => point.item['sku'] === sku && point.place === place)!;

describe('the sample file', () => {
  it('is what the facts in src/sample say (run `node scripts/sample.mjs` when it is behind)', () => {
    expect(bundle).toEqual(JSON.parse(JSON.stringify(buildSample())));
  });

  it('fits the manifest: every table, column, label and the order a ledger\'s history is listed in', () => {
    const checked = validateManifest(manifest);
    if (!checked.ok) throw new Error(JSON.stringify(checked.issues.slice(0, 5)));
    expect(manifest.sampleData).toEqual({ file: 'seeds/inventory.sample.json' });
    expect(sampleBundleIssues(sampleBundleSchema.parse(bundle), checked.manifest)).toEqual([]);
  });

  it('holds these rows, table by table, in the order they are written', () => {
    expect(bundle.tables.map((table) => [table.ref, table.rows.length])).toEqual([
      ['categories', 8],
      ['places', 6],
      ['settings', 1],
      ['suppliers', 3],
      ['items', 40],
      ['item_suppliers', 40],
      ['batches', 50],
      ['stock_points', 44],
      ['levels', 46],
      ['kits', 3],
      ['kit_lines', 16],
      ['purchase_orders', 3],
      ['po_lines', 8],
      ['receipts', 5],
      ['receipt_lines', 43],
      ['transfers', 2],
      ['transfer_lines', 6],
      ['counts', 1],
      ['count_lines', 14],
      ['count_marks', 14],
      ['uses', 649],
      ['reorder_requests', 2],
      ['postings', 734],
      ['movements', 707],
      ['on_order_moves', 9],
    ]);
    // The one settings row is only for a table that has none: an install has already made its own.
    expect(bundle.tables.find((table) => table.ref === 'settings')?.onlyIfEmpty).toBe(true);
  });

  it('every promised label is in the bundle, once', () => {
    const promised = [
      ...KITS.map((kit) => `kit:${slug(kit.name)}`),
      ...PLACES.map(([name]) => `place:${slug(name)}`),
      ...ITEMS.map((item) => `item:${item.sku}`),
      ...Object.values(OPENING_BATCH).map((batch) => `batch:${batch.code}`),
      ...PO_1001.lines.flatMap((line) => (line.batch === null ? [] : [`batch:${line.batch.code}`])),
    ];
    // Written out, so a rename in the facts is seen here: an app's own sample names these.
    expect(promised.filter((label) => !label.startsWith('item:'))).toEqual([
      'kit:flu-vaccination',
      'kit:dressing-change',
      'kit:room-turnover',
      'place:shop-floor',
      'place:back-room',
      'place:treatment-room',
      'place:linen-store',
      'place:at-the-laundry',
      'place:damaged',
      'batch:L2406',
      'batch:L2411',
      'batch:N7731',
      'batch:S5520',
      'batch:LD118',
      'batch:FV26A',
      'batch:A9001',
      'batch:G4410',
      'batch:A9117',
      'batch:L2502',
    ]);
    expect(promised).toHaveLength(59);
    const every = bundle.tables.flatMap((table) => table.rows.flatMap((row) => (typeof row['@label'] === 'string' ? [row['@label']] : [])));
    for (const label of promised) expect(every.filter((found) => found === label), label).toHaveLength(1);
    expect(byLabel.get('item:VAC-FLU')?.['name']).toBe('Flu vaccine, single dose');
    expect(byLabel.get('item:TWL-BATH')?.['name']).toBe('Bath towel');
    // The units and reasons an install wrote are named by the labels the manifest's starting rows carry.
    const seeded = new Set((manifest.seeds as { rows: Row[] }[]).flatMap((seed) => seed.rows.flatMap((row) => (typeof row['@label'] === 'string' ? [row['@label']] : []))));
    for (const item of rowsOf('items')) expect(seeded.has(labelOf(item['unit_id'])!), String(item['sku'])).toBe(true);
    expect([...new Set(rowsOf('items').map((item) => labelOf(item['unit_id'])))].sort()).toEqual(['unit:each', 'unit:pair', 'unit:roll', 'unit:set', 'unit:sheet']);
  });

  it('names no real address: every supplier writes from .example', () => {
    expect(rowsOf('suppliers').map((supplier) => supplier['email'])).toEqual(['orders@northgate.example', 'desk@medisupply.example', 'hello@harbourlinen.example']);
    for (const supplier of rowsOf('suppliers')) expect(String(supplier['email'])).toMatch(/@[a-z]+\.example$/);
  });
});

describe('the bundle reproduces every stock figure', () => {
  it('707 movements: the 40 opening ones and 667 since', () => {
    const kinds: Record<string, number> = {};
    for (const move of movements) kinds[move['kind'] as string] = (kinds[move['kind'] as string] ?? 0) + 1;
    expect(kinds).toEqual({ opening: 40, used: 520, sold: 126, moved_in: 6, moved_out: 6, received: 3, adjusted: 3, written_off: 2, returned: 1 });
    expect(movements.length - kinds['opening']!).toBe(667);
    expect(movements.every((move) => Number(move['qty']) !== 0)).toBe(true);
    // No level ever goes below zero, read in the order of the clock.
    expect(levels.every((level) => level.qty >= 0)).toBe(true);
  });

  it('stock is worth $7,490.43, place by place', () => {
    expect(usd(sum(points.map((point) => point.value)))).toBe('$7,490.43');
    const byPlace = PLACES.map(([name]) => usd(sum(points.filter((point) => point.place === name).map((point) => point.value))));
    expect(byPlace).toEqual(['$964.55', '$108.26', '$254.00', '$5,688.42', '$475.20', '$0.00']);
    // An item's own figure is its points' together, at the one cost the month never moved.
    for (const item of rowsOf('items')) {
      for (const point of points.filter((candidate) => candidate.item === item)) expect(point.row['cost_avg'], String(item['sku'])).toBe(item['cost_avg']);
    }
  });

  it('$1,490.62 was sold and used last month', () => {
    const out = movements.filter((move) => move['kind'] === 'sold' || move['kind'] === 'used');
    expect(usd(sum(out.map((move) => -Number(move['qty']) * cents(move['unit_cost']))))).toBe('$1,490.62');
    // Every one of them is dated last month, whatever day the sample is added on.
    expect(out.every((move) => (move['at'] as Row)['@month'] === -1)).toBe(true);
  });

  it('5 points are low, 2 of them to reorder, 1 out of stock', () => {
    expect(points.filter((point) => point.low).map((point) => point.item['sku'])).toEqual(['TS-BLU-M', 'TOTE-NAT', 'AMP-LID', 'VAC-FLU', 'GLV-L']);
    const toReorder = points.filter((point) => point.toReorder);
    expect(toReorder.map((point) => [point.item['name'], point.onHand, Number(point.row['reorder_level'])])).toEqual([
      ['T-shirt, blue, M', 0, 8],
      ['Canvas tote, natural', 4, 10],
    ]);
    // The other three are on their way: 200, 50 and 40 on order.
    expect(points.filter((point) => point.low && !point.toReorder).map((point) => [point.item['sku'], point.onOrder, point.state])).toEqual([
      ['AMP-LID', 50, 2],
      ['VAC-FLU', 40, 2],
      ['GLV-L', 200, 2],
    ]);
    expect(points.filter((point) => point.state === 3).map((point) => point.item['sku'])).toEqual(['TS-BLU-M']);
    // The two the reorder rule drafted say so, with the supplier the order went to.
    expect(toReorder.map((point) => [point.row['request_note'], point.row['request_supplier']])).toEqual([
      ['drafted', 'Northgate Wholesale'],
      ['drafted', 'Northgate Wholesale'],
    ]);
    expect(rowsOf('reorder_requests').map((request) => [labelOf(request['stock_point_id']), request['qty'], request['status'], labelOf(request['po_line_id'])])).toEqual([
      ['point:TS-BLU-M:shop-floor', 12, 'drafted', 'po-line:1003:TS-BLU-M'],
      ['point:TOTE-NAT:shop-floor', 20, 'drafted', 'po-line:1003:TOTE-NAT'],
    ]);
  });

  it('2 batches run out within 30 days, with 14 and 8 left, whatever day the sample is added', () => {
    const soon = levels.filter((level) => {
      const expires = level.batch['expires_on'];
      return typeof expires === 'object' && expires !== null && Number((expires as Row)['@day']) <= 30 && level.qty > 0;
    });
    expect(soon.map((level) => [level.batch['code'], level.batch['expires_on'], level.qty])).toEqual([
      ['LD118', { '@day': 19 }, 14],
      ['FV26A', { '@day': 26 }, 8],
    ]);
    // Every other batch's date is years off.
    const fixed = rowsOf('batches').filter((batch) => typeof batch['expires_on'] === 'string');
    expect(fixed).toHaveLength(8);
    expect(fixed.every((batch) => String(batch['expires_on']) >= '2027-03-31')).toBe(true);
    expect(rowsOf('batches').filter((batch) => batch['unassigned'] === true)).toHaveLength(40);
  });

  it('three purchase orders: $44.00 received, $465.00 open, $150.80 drafted', () => {
    const total = (po: string) => sum(rowsOf('po_lines').filter((line) => labelOf(line['po_id']) === po).map((line) => Number(line['packs']) * cents(line['price'])));
    const orders = rowsOf('purchase_orders').map((po) => [po['number'], po['status'], usd(total(po['@label'] as string))]);
    expect(orders).toEqual([
      ['PO-1001', 'received', '$44.00'],
      ['PO-1002', 'sent', '$465.00'],
      ['PO-1003', 'draft', '$150.80'],
    ]);
    expect(rowsOf('purchase_orders')[1]).toMatchObject({ sent_on: { '@day': -2 }, expected_on: { '@day': 0 } });
    // A supplier's code is its initials and the SKU; a pack costs its size times the item's cost.
    expect(rowsOf('po_lines').filter((line) => labelOf(line['po_id']) !== 'po:1001').map((line) => [line['supplier_code'], line['price']])).toEqual([
      ['MS-GLV-L', '9.00'],
      ['MS-AMP-LID', '11.00'],
      ['MS-VAC-FLU', '98.00'],
      ['NW-TS-BLU-M', '44.40'],
      ['NW-TOTE-NAT', '31.00'],
    ]);
    // On order: 1001 went on and came off; 1002 is still on.
    expect(rowsOf('on_order_moves').map((move) => Number(move['qty']))).toEqual([400, 200, 100, -400, -200, -100, 200, 50, 40]);
    for (const line of PO_1001.lines) expect(pointOf(line.sku, PO_1001.place).onOrder, line.sku).toBe(0);
  });

  it('the opening stock is one receipt a place, 40 lines of 6,496 units worth $8,954.70; the delivery is 3 lines of 700 units worth $44.00', () => {
    const lines = rowsOf('receipt_lines').map((line) => {
      const ordered = line['po_line_id'] === undefined ? null : named(line['po_line_id']);
      const qty = ordered === null ? Number(line['qty_typed']) : Number(line['packs']) * Number(ordered['pack_size']);
      const cost = ordered === null ? cents(line['unit_cost']) : cents(ordered['price']) / Number(ordered['pack_size']);
      return { receipt: named(line['receipt_id']), qty, amount: Math.round(qty * cost) };
    });
    const opening = lines.filter((line) => line.receipt['kind'] === 'opening');
    expect([opening.length, sum(opening.map((line) => line.qty)), usd(sum(opening.map((line) => line.amount)))]).toEqual([40, 6496, '$8,954.70']);
    const delivery = lines.filter((line) => line.receipt['kind'] === 'delivery');
    expect([delivery.length, sum(delivery.map((line) => line.qty)), usd(sum(delivery.map((line) => line.amount)))]).toEqual([3, 700, '$44.00']);
    expect(rowsOf('receipts').map((receipt) => [receipt['number'], receipt['kind'], named(receipt['place_id'])['name'], lines.filter((line) => line.receipt === receipt).length])).toEqual([
      ['RC-0001', 'opening', 'Shop floor', 14],
      ['RC-0002', 'opening', 'Back room', 6],
      ['RC-0003', 'opening', 'Treatment room', 12],
      ['RC-0004', 'opening', 'Linen store', 8],
      ['RC-0005', 'delivery', 'Treatment room', 3],
    ]);
    // A line is received into its receipt's place: the place the item is kept in.
    for (const line of rowsOf('receipt_lines')) expect(named(line['receipt_id'])['place_id'], String(line['@label'])).toEqual({ '@ref': `place:${slug(ITEMS.find((item) => `item:${item.sku}` === labelOf(line['item_id']))!.place)}` });
  });

  it('the count found 3 differences worth -$0.95', () => {
    const lines = rowsOf('count_lines').map((line) => ({ difference: Number(line['counted']) - Number(line['qty_when_counted']), cost: cents(line['unit_cost']), line }));
    expect(lines.filter((line) => line.difference !== 0).map((line) => [labelOf(line.line['level_id']), line.difference])).toEqual([
      ['level:NB-A5:shop-floor', 1],
      ['level:PEN-BLK:shop-floor', -3],
      ['level:CARD-GRT:shop-floor', -2],
    ]);
    expect(usd(sum(lines.map((line) => Math.round(line.difference * line.cost))))).toBe('-$0.95');
    // What the count expected is what the level held when it was counted, and each line was marked once with what was found.
    for (const { line } of lines) expect(line['expected']).toBe(line['qty_when_counted']);
    expect(rowsOf('count_marks').map((mark) => mark['counted'])).toEqual(lines.map(({ line }) => line['counted']));
    expect(rowsOf('counts')[0]).toMatchObject({ number: 'CNT-0001', status: 'posted', scope: 'all', place_id: { '@ref': 'place:shop-floor' } });
  });

  it('linen: 236 bath towels in store and 24 at the laundry, the same of hand towels, 128 and 12 sheet sets', () => {
    const linen = ['TWL-BATH', 'TWL-HAND', 'SHEET-D'].map((sku) => [pointOf(sku, 'Linen store').onHand, pointOf(sku, 'At the laundry').onHand]);
    expect(linen).toEqual([
      [236, 24],
      [236, 24],
      [128, 12],
    ]);
    expect(rowsOf('transfer_lines').map((line) => [labelOf(line['transfer_id']), labelOf(line['item_id']), line['qty']])).toEqual([
      ['transfer:1', 'item:TWL-BATH', 192],
      ['transfer:1', 'item:TWL-HAND', 192],
      ['transfer:1', 'item:SHEET-D', 96],
      ['transfer:2', 'item:TWL-BATH', 168],
      ['transfer:2', 'item:TWL-HAND', 168],
      ['transfer:2', 'item:SHEET-D', 84],
    ]);
    // The broken mugs' place holds none of them: written off, not moved.
    expect(pointOf('MUG-SPK', 'Damaged').onHand).toBe(0);
  });

  it('what was used: 126 sold, 520 used, 2 written off with a reason, 1 put back', () => {
    const kinds: Record<string, number> = {};
    for (const use of rowsOf('uses')) kinds[use['kind'] as string] = (kinds[use['kind'] as string] ?? 0) + 1;
    expect(kinds).toEqual({ sold: 126, used: 520, written_off: 2, put_back: 1 });
    expect(rowsOf('uses').filter((use) => use['kind'] === 'written_off').map((use) => [labelOf(use['item_id']), use['qty'], labelOf(use['reason_id'])])).toEqual([
      ['item:MUG-SPK', 2, 'reason:broken'],
      ['item:ROBE', 1, 'reason:stained'],
    ]);
  });

  it('the kits: Flu vaccination 6 lines, Dressing change 4, Room turnover 6, three of them linen sent to the laundry', () => {
    const lines = (kit: string) => rowsOf('kit_lines').filter((line) => labelOf(line['kit_id']) === kit);
    expect(['kit:flu-vaccination', 'kit:dressing-change', 'kit:room-turnover'].map((kit) => lines(kit).length)).toEqual([6, 4, 6]);
    expect(lines('kit:room-turnover').filter((line) => line['action'] === 'move').map((line) => [labelOf(line['item_id']), line['qty'], labelOf(line['to_place_id'])])).toEqual([
      ['item:TWL-BATH', 2, 'place:at-the-laundry'],
      ['item:TWL-HAND', 2, 'place:at-the-laundry'],
      ['item:SHEET-D', 1, 'place:at-the-laundry'],
    ]);
    expect(lines('kit:room-turnover').filter((line) => line['per'] === 'night').map((line) => labelOf(line['item_id']))).toEqual(['item:TEA-SEL']);
  });
});

describe('the history can be undone like a real one', () => {
  const postings = rowsOf('postings');

  it('734 receipts of posting: one for every row that posted', () => {
    const by: Record<string, number> = {};
    for (const posting of postings) by[`${String((posting['source_table'] as Row)['@table'])}/${String(posting['posting'])}`] = (by[`${String((posting['source_table'] as Row)['@table'])}/${String(posting['posting'])}`] ?? 0) + 1;
    expect(by).toEqual({ 'uses/use': 649, 'receipt_lines/receive': 43, 'count_marks/mark': 14, 'count_lines/count': 14, 'transfer_lines/move': 6, 'purchase_orders/on-order': 6, 'reorder_requests/draft': 2 });
    // Each names a posting the manifest declares on that table, with the action it posts into.
    const tables = manifest.requiredSchema.tables as unknown as { ref: string; postings?: { id: string; into: { action: string } }[] }[];
    for (const posting of postings) {
      const lineTable = posting['line_table'] === '' ? null : String((posting['line_table'] as Row)['@table']);
      const declared = tables.find((table) => table.ref === (lineTable ?? String((posting['source_table'] as Row)['@table'])))?.postings?.find((candidate) => candidate.id === posting['posting']);
      expect(declared?.into.action, String(posting['@label'])).toBe(posting['action']);
    }
    // No two are for the same row, posting and round: the key Adminium keeps on the table.
    expect(new Set(postings.map((posting) => JSON.stringify([posting['source_table'], posting['source_row'], posting['source_line'], posting['posting']]))).size).toBe(734);
  });

  it('every ledger row names the receipt of the row that made it', () => {
    const tableOf = (label: string) => String((byLabel.get(label)!['source_table'] as Row)['@table']);
    for (const move of movements) {
      const receipt = labelOf(move['receipt_id']);
      expect(receipt, JSON.stringify(move)).not.toBeNull();
      const expected = move['kind'] === 'opening' || move['kind'] === 'received' ? 'receipt_lines' : move['kind'] === 'adjusted' ? 'count_lines' : move['kind'] === 'moved_in' || move['kind'] === 'moved_out' ? 'transfer_lines' : 'uses';
      expect(tableOf(receipt!), receipt!).toBe(expected);
    }
    // What arrived on a transfer names the row that left, under the same receipt.
    const arrived = movements.filter((move) => move['kind'] === 'moved_in');
    expect(arrived).toHaveLength(6);
    for (const move of arrived) {
      const left = named(move['pair_id']);
      expect([left['kind'], left['qty'], left['receipt_id']]).toEqual(['moved_out', -Number(move['qty']), move['receipt_id']]);
    }
    expect(rowsOf('on_order_moves').map((move) => tableOf(labelOf(move['receipt_id'])!))).toEqual(['purchase_orders', 'purchase_orders', 'purchase_orders', 'receipt_lines', 'receipt_lines', 'receipt_lines', 'purchase_orders', 'purchase_orders', 'purchase_orders']);
  });

  it('a use and its movement say the same thing', () => {
    const uses = rowsOf('uses');
    const out = movements.filter((move) => ['sold', 'used', 'written_off', 'returned'].includes(move['kind'] as string));
    expect(out).toHaveLength(uses.length);
    out.forEach((move, n) => {
      const use = named(byLabel.get(labelOf(move['receipt_id'])!)!['source_row']);
      expect(use, String(n)).toBe(uses[n]);
      expect([Math.abs(Number(move['qty'])), move['at']]).toEqual([use['qty'], use['at']]);
      expect(named(named(move['level_id'])['stock_point_id'])['item_id']).toEqual(use['item_id']);
    });
  });
});
