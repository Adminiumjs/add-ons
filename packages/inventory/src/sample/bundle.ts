/**
 * The sample bundle, built from the facts in `data.ts`.
 *
 * Adding sample data posts nothing: each row is written as it stands, and
 * the totals are added up afterwards. So the bundle holds the month as
 * history: the documents (receipts, transfers, a count, what was used), the
 * ledger rows they would have made, and one receipt of posting for each, so
 * a sample document can be undone like a real one. What the add-on's code
 * would have decided (a cost, a batch, a count's figures) is in the rows as
 * plain values.
 *
 * `scripts/sample.mjs` writes this to `seeds/inventory.sample.json`;
 * `sample.test.ts` fails when the file is behind.
 */
import {
  CATEGORIES,
  COUNT,
  ITEM,
  ITEMS,
  KITS,
  KIT_MOVES_TO,
  LINEN_DAY,
  LINEN_SET,
  OPENING_BATCH,
  PLACES,
  PO_1001,
  PO_1002,
  PUT_BACK,
  SETTINGS,
  SUPPLIERS,
  WRITE_OFFS,
  barcode,
  replay,
  toReorder,
  type Expiry,
  type Item,
  type Move,
} from './data.ts';

export type Row = Record<string, unknown>;
export interface Bundle {
  format: 'adminium.sample/1';
  app: 'inventory';
  tables: { ref: string; onlyIfEmpty?: true; rows: Row[] }[];
}

/** The add-on version the sample's history says it was posted by. */
const POSTED_BY_VERSION = '1.0.0';

/** A name as a label: lower case, a dash for each run of anything else. */
export const slug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const ref = (label: string) => ({ '@ref': label });
const table = (name: string) => ({ '@table': name });
/** A day of last month, and a wall time on it. */
const on = (day: number) => ({ '@month': -1, '@dom': day });
const at = (day: number, time: string) => ({ '@month': -1, '@dom': day, '@time': time });
const expiry = (expires: Expiry) => ('date' in expires ? expires.date : { '@day': expires.inDays });
/** Cents as an amount. */
const money = (cents: number): string => (cents / 100).toFixed(2);

const place = (name: string) => ref(`place:${slug(name)}`);
const itemRef = (sku: string) => ref(`item:${sku}`);
const supplier = (name: string) => ref(`supplier:${slug(name)}`);
const batchLabel = (sku: string, code: string | null) => (code === null ? `batch-none:${sku}` : `batch:${code}`);
const pointLabel = (sku: string, where: string) => `point:${sku}:${slug(where)}`;
const levelLabel = (sku: string, where: string, code: string | null) => `level:${sku}:${slug(where)}${code === null ? '' : `:${code}`}`;

export function buildSample(): Bundle {
  const { moves, levels } = replay();
  const real = moves.filter((move) => move.qty !== 0);
  const initials = new Map(SUPPLIERS.map((s) => [s.name, s.initials]));
  const supplierCode = (it: Item) => `${initials.get(it.supplier)!}-${it.sku}`;
  const packPrice = (it: Item) => money(it.pack * it.cost);

  // ── the catalogue ──────────────────────────────────────────────────────────
  const categories = CATEGORIES.map((name, position) => ({ '@label': `category:${slug(name)}`, name, position }));
  const places = PLACES.map(([name, forSale], position) => ({ '@label': `place:${slug(name)}`, name, for_sale: forSale, position }));
  const settings = [{ business_name: SETTINGS.businessName, deliver_to: SETTINGS.deliverTo, default_place_id: place(SETTINGS.defaultPlace), default_unit_id: ref('unit:each') }];
  const suppliers = SUPPLIERS.map((s) => ({ '@label': `supplier:${slug(s.name)}`, name: s.name, email: s.email, lead_days: s.leadDays }));
  const items = ITEMS.map((it, n) => ({
    '@label': `item:${it.sku}`,
    name: it.name,
    sku: it.sku,
    barcode: barcode(n + 1),
    category_id: ref(`category:${slug(it.category)}`),
    unit_id: ref(`unit:${it.unit}`),
    tracks_batches: it.tracksBatches,
    pack_size: it.pack,
    cost_avg: money(it.cost),
  }));
  const itemSuppliers = ITEMS.map((it) => ({ item_id: itemRef(it.sku), supplier_id: supplier(it.supplier), supplier_code: supplierCode(it), pack_size: it.pack, price: packPrice(it), rank: 'preferred' }));

  // ── where the stock is ─────────────────────────────────────────────────────
  const namedBatches: { sku: string; code: string; expires: Expiry; receivedOn: number }[] = [
    ...Object.entries(OPENING_BATCH).map(([sku, batch]) => ({ sku, code: batch.code, expires: batch.expires, receivedOn: 1 })),
    ...PO_1001.lines.flatMap((ordered) => (ordered.batch === null ? [] : [{ sku: ordered.sku, code: ordered.batch.code, expires: ordered.batch.expires, receivedOn: PO_1001.receivedOn }])),
  ];
  const batches = [
    ...ITEMS.map((it) => ({ '@label': batchLabel(it.sku, null), item_id: itemRef(it.sku), code: '-', unassigned: true })),
    ...namedBatches.map((batch) => ({ '@label': batchLabel(batch.sku, batch.code), item_id: itemRef(batch.sku), code: batch.code, unassigned: false, expires_on: expiry(batch.expires), received_on: on(batch.receivedOn) })),
  ];

  /** Every level the month touched, plus the damaged mug's place, which holds none. */
  const levelKeys: [sku: string, where: string, code: string | null][] = [...levels.keys()].map((key) => {
    const [sku, where, code] = key.split('|') as [string, string, string];
    return [sku, where, code === '' ? null : code];
  });
  levelKeys.push([WRITE_OFFS[0]!.sku, 'Damaged', null]);
  const order = (where: string) => PLACES.findIndex(([name]) => name === where);
  const skuOrder = (sku: string) => ITEMS.findIndex((it) => it.sku === sku);
  const pointKeys = [...new Map(levelKeys.map(([sku, where]) => [`${sku}|${where}`, [sku, where] as const])).values()].sort(
    (a, b) => Number(a[1] !== ITEM.get(a[0])!.place) - Number(b[1] !== ITEM.get(b[0])!.place) || order(a[1]) - order(b[1]) || skuOrder(a[0]) - skuOrder(b[0]),
  );
  const reordered = toReorder(levels);
  const counted = new Set(ITEMS.filter((it) => it.place === COUNT.place).map((it) => it.sku));
  const points = pointKeys.map(([sku, where]) => {
    const it = ITEM.get(sku)!;
    const home = where === it.place;
    return {
      '@label': pointLabel(sku, where),
      item_id: itemRef(sku),
      place_id: place(where),
      ...(home ? { reorder_level: it.reorderLevel, reorder_qty: it.reorderQty } : {}),
      cost_avg: money(it.cost),
      ...(home && counted.has(sku) ? { last_counted_at: at(COUNT.day, '18:30') } : {}),
      ...(home && reordered.includes(it) ? { request_note: 'drafted', request_supplier: it.supplier } : {}),
    };
  });
  const levelRows = levelKeys
    .sort((a, b) => pointKeys.findIndex(([sku, where]) => sku === a[0] && where === a[1]) - pointKeys.findIndex(([sku, where]) => sku === b[0] && where === b[1]) || Number(a[2] !== (OPENING_BATCH[a[0]]?.code ?? null)) - Number(b[2] !== (OPENING_BATCH[b[0]]?.code ?? null)))
    .map(([sku, where, code]) => ({ '@label': levelLabel(sku, where, code), stock_point_id: ref(pointLabel(sku, where)), batch_id: ref(batchLabel(sku, code)) }));

  // ── kits ───────────────────────────────────────────────────────────────────
  const kits = KITS.map((kit) => ({ '@label': `kit:${slug(kit.name)}`, name: kit.name }));
  const kitLines = KITS.flatMap((kit) =>
    kit.lines.map((part) => ({ kit_id: ref(`kit:${slug(kit.name)}`), item_id: itemRef(part.sku), qty: part.qty, per: part.per, action: part.action, ...(part.action === 'move' ? { to_place_id: place(KIT_MOVES_TO) } : {}) })),
  );

  // ── purchase orders ────────────────────────────────────────────────────────
  const PO_1003 = { number: 1003, supplier: reordered[0]!.supplier, place: reordered[0]!.place, lines: reordered.map((it) => ({ sku: it.sku, packs: Math.ceil(it.reorderQty / it.pack) })) };
  const sent1002 = { '@day': -2, '@time': '09:15' };
  const purchaseOrders = [
    {
      '@label': 'po:1001',
      number_seq: PO_1001.number,
      number: `PO-${String(PO_1001.number)}`,
      supplier_id: supplier(PO_1001.supplier),
      place_id: place(PO_1001.place),
      status: 'received',
      sent_how: 'none',
      sent_on: on(PO_1001.sentOn),
      expected_on: on(PO_1001.receivedOn),
      sent_at: at(PO_1001.sentOn, '09:15'),
      received_at: at(PO_1001.receivedOn, '11:30'),
      closed_at: at(PO_1001.receivedOn, '11:30'),
    },
    { '@label': 'po:1002', number_seq: PO_1002.number, number: `PO-${String(PO_1002.number)}`, supplier_id: supplier(PO_1002.supplier), place_id: place(PO_1002.place), status: 'sent', sent_how: 'none', sent_on: { '@day': -2 }, expected_on: { '@day': 0 }, sent_at: sent1002 },
    { '@label': 'po:1003', number_seq: PO_1003.number, number: `PO-${String(PO_1003.number)}`, supplier_id: supplier(PO_1003.supplier), place_id: place(PO_1003.place), status: 'draft' },
  ];
  const poLines = [PO_1001, PO_1002, PO_1003].flatMap((po) =>
    po.lines.map((ordered) => {
      const it = ITEM.get(ordered.sku)!;
      return { '@label': `po-line:${String(po.number)}:${it.sku}`, po_id: ref(`po:${String(po.number)}`), item_id: itemRef(it.sku), supplier_code: supplierCode(it), packs: ordered.packs, pack_size: it.pack, price: packPrice(it) };
    }),
  );

  // ── receipts: the opening stock, one a place, then the delivery ────────────
  const stocked = PLACES.map(([name]) => name).filter((name) => ITEMS.some((it) => it.place === name));
  const receipts = [
    ...stocked.map((name, n) => ({ '@label': `receipt:opening:${slug(name)}`, number_seq: n + 1, number: `RC-${String(n + 1).padStart(4, '0')}`, place_id: place(name), kind: 'opening', status: 'posted', received_at: at(1, '08:00') })),
    {
      '@label': 'receipt:po-1001',
      number_seq: stocked.length + 1,
      number: `RC-${String(stocked.length + 1).padStart(4, '0')}`,
      po_id: ref('po:1001'),
      supplier_id: supplier(PO_1001.supplier),
      place_id: place(PO_1001.place),
      kind: 'delivery',
      status: 'posted',
      received_at: at(PO_1001.receivedOn, '11:30'),
    },
  ];
  /** A movement's document row: its label, and the receipt of posting written for it. */
  const sourceOf = new Map<Move, string>();
  const receiptLines: Row[] = [];
  for (const name of stocked) {
    for (const move of real.filter((m) => m.of.doc === 'opening' && m.place === name)) {
      const it = ITEM.get(move.sku)!;
      const label = `receipt-line:opening:${it.sku}`;
      sourceOf.set(move, label);
      const batch = OPENING_BATCH[it.sku];
      receiptLines.push({ '@label': label, receipt_id: ref(`receipt:opening:${slug(name)}`), item_id: itemRef(it.sku), qty_typed: it.opening, unit_cost: money(it.cost), ...(batch === undefined ? {} : { batch_code: batch.code, expires_on: expiry(batch.expires) }), status: 'posted' });
    }
  }
  for (const move of real.filter((m) => m.of.doc === 'po-1001')) {
    const ordered = PO_1001.lines[(move.of as { line: number }).line]!;
    const label = `receipt-line:po-1001:${move.sku}`;
    sourceOf.set(move, label);
    receiptLines.push({ '@label': label, receipt_id: ref('receipt:po-1001'), po_line_id: ref(`po-line:1001:${move.sku}`), item_id: itemRef(move.sku), packs: ordered.packs, ...(ordered.batch === null ? {} : { batch_code: ordered.batch.code, expires_on: expiry(ordered.batch.expires) }), status: 'posted' });
  }

  // ── transfers: linen out to the laundry, and most of it back ───────────────
  const transfers = [
    { '@label': 'transfer:1', number_seq: 1, number: 'TR-0001', from_place_id: place('Linen store'), to_place_id: place(KIT_MOVES_TO), status: 'done', note: '96 room turnovers', at: at(LINEN_DAY, '14:00') },
    { '@label': 'transfer:2', number_seq: 2, number: 'TR-0002', from_place_id: place(KIT_MOVES_TO), to_place_id: place('Linen store'), status: 'done', note: '84 sets back from the laundry', at: at(LINEN_DAY, '14:03') },
  ];
  const transferLines: Row[] = [];
  for (const n of [1, 2] as const) {
    LINEN_SET.forEach(([sku], k) => {
      const pair = real.filter((m) => m.of.doc === 'transfer' && m.of.n === n && m.of.line === k);
      const label = `transfer-line:${String(n)}:${sku}`;
      for (const move of pair) sourceOf.set(move, label);
      transferLines.push({ '@label': label, transfer_id: ref(`transfer:${String(n)}`), item_id: itemRef(sku), qty: Math.abs(pair[0]!.qty), status: 'posted' });
    });
  }

  // ── the count ──────────────────────────────────────────────────────────────
  const differences = new Map(COUNT.differences);
  const counts = [{ '@label': 'count:1', number_seq: 1, number: 'CNT-0001', place_id: place(COUNT.place), scope: 'all', reason_id: ref('reason:count-difference'), status: 'posted', at: at(COUNT.day, '18:00'), posted_at: at(COUNT.day, '18:30') }];
  const countedItems = ITEMS.filter((it) => it.place === COUNT.place);
  const countLines = countedItems.map((it) => {
    const expected = real.filter((m) => m.sku === it.sku && m.place === COUNT.place && m.day <= COUNT.day && m.kind !== 'adjusted').reduce((sum, m) => sum + m.qty, 0);
    return {
      '@label': `count-line:${it.sku}`,
      count_id: ref('count:1'),
      level_id: ref(levelLabel(it.sku, COUNT.place, null)),
      expected,
      counted: expected + (differences.get(it.sku) ?? 0),
      qty_when_counted: expected,
      counted_at: at(COUNT.day, '18:10'),
      unit_cost: money(it.cost),
      status: 'posted',
    };
  });
  const countMarks = countLines.map((counted, k) => ({ '@label': `count-mark:${countedItems[k]!.sku}`, count_line_id: ref(counted['@label']), counted: counted.counted, at: at(COUNT.day, '18:10') }));
  for (const move of real.filter((m) => m.of.doc === 'count')) sourceOf.set(move, `count-line:${move.sku}`);

  // ── what was sold, used, thrown away and put back ──────────────────────────
  const USE_KIND: Partial<Record<Move['kind'], string>> = { sold: 'sold', used: 'used', written_off: 'written_off', returned: 'put_back' };
  const uses: Row[] = [];
  for (const move of real) {
    const kind = USE_KIND[move.kind];
    if (kind === undefined) continue;
    const label = `use:${String(uses.length + 1)}`;
    sourceOf.set(move, label);
    uses.push({
      '@label': label,
      item_id: itemRef(move.sku),
      qty: Math.abs(move.qty),
      place_id: place(move.place),
      ...(move.batch === null ? {} : { batch_id: ref(batchLabel(move.sku, move.batch)) }),
      kind,
      ...(move.of.doc === 'write-off' ? { reason_id: ref(`reason:${WRITE_OFFS[move.of.n]!.reason}`) } : {}),
      ...(move.of.doc === 'put-back' ? { note: PUT_BACK.note } : {}),
      at: at(move.day, move.time),
    });
  }

  // ── the reorder rule's two requests, drafted onto order 1003 ───────────────
  const requested = { '@day': -1, '@time': '17:30' };
  const reorderRequests = reordered.map((it) => ({ '@label': `reorder:${it.sku}`, stock_point_id: ref(pointLabel(it.sku, it.place)), qty: Math.ceil(it.reorderQty / it.pack) * it.pack, status: 'drafted', po_line_id: ref(`po-line:1003:${it.sku}`), at: requested }));

  // ── receipts of posting, then the ledger ───────────────────────────────────
  const postings: Row[] = [];
  const postingOf = new Map<string, string>();
  const posted = (source: string, row: string, how: { action: string; posting: string; rows: number; when: unknown; line?: { table: string; row: string } }): string => {
    const label = `posting:${how.posting}:${row}${how.line === undefined ? '' : `:${how.line.row}`}`;
    postings.push({
      '@label': label,
      source_table: table(source),
      source_row: ref(row),
      source_line: how.line === undefined ? '' : ref(how.line.row),
      line_table: how.line === undefined ? '' : table(how.line.table),
      ledger: 'stock',
      action: how.action,
      posting: how.posting,
      phase: 'post',
      round: 1,
      state: 'planned',
      rows: how.rows,
      add_on_version: POSTED_BY_VERSION,
      origin: 'staff',
      by: '',
      at: how.when,
    });
    postingOf.set(`${how.posting}|${row}${how.line === undefined ? '' : `|${how.line.row}`}`, label);
    return label;
  };
  const movesOf = (label: string) => real.filter((m) => sourceOf.get(m) === label);
  const whenOf = (label: string) => {
    const first = movesOf(label)[0]!;
    return at(first.day, first.time);
  };
  for (const use of uses) posted('uses', use['@label'] as string, { action: 'use-item', posting: 'use', rows: 1, when: use['at'] });
  for (const received of receiptLines) {
    const label = received['@label'] as string;
    posted('receipt_lines', label, { action: 'receive', posting: 'receive', rows: received['po_line_id'] === undefined ? 1 : 2, when: whenOf(label) });
  }
  for (const mark of countMarks) posted('count_marks', mark['@label'], { action: 'count-mark', posting: 'mark', rows: 1, when: mark.at });
  for (const counted of countLines) posted('count_lines', counted['@label'], { action: 'count', posting: 'count', rows: Math.max(1, movesOf(counted['@label']).length), when: at(COUNT.day, '18:30') });
  for (const moved of transferLines) posted('transfer_lines', moved['@label'] as string, { action: 'transfer', posting: 'move', rows: 2, when: whenOf(moved['@label'] as string) });
  for (const po of [PO_1001, PO_1002]) {
    for (const ordered of po.lines) {
      posted('purchase_orders', `po:${String(po.number)}`, { action: 'on-order', posting: 'on-order', rows: 1, when: po === PO_1001 ? at(PO_1001.sentOn, '09:15') : sent1002, line: { table: 'po_lines', row: `po-line:${String(po.number)}:${ordered.sku}` } });
    }
  }
  for (const request of reorderRequests) posted('reorder_requests', request['@label'], { action: 'reorder', posting: 'draft', rows: 1, when: requested });

  const POSTING_OF_SOURCE: Readonly<Record<string, string>> = { use: 'use', 'receipt-line': 'receive', 'transfer-line': 'move', 'count-line': 'count' };
  const receiptOf = (source: string) => postingOf.get(`${POSTING_OF_SOURCE[source.split(':')[0]!]!}|${source}`)!;
  const outLabel = new Map<string, string>();
  const movements = real.map((move, n) => {
    const it = ITEM.get(move.sku)!;
    const source = sourceOf.get(move)!;
    const label = `movement:${String(n + 1)}`;
    // The two halves of a transfer line: the row that arrives names the row that left.
    const pairOf = move.kind === 'moved_in' ? outLabel.get(source) : undefined;
    if (move.kind === 'moved_out') outLabel.set(source, label);
    return {
      ...(move.kind === 'moved_out' ? { '@label': label } : {}),
      level_id: ref(levelLabel(move.sku, move.place, move.batch)),
      kind: move.kind,
      qty: move.qty,
      unit_cost: money(it.cost),
      ...(move.of.doc === 'write-off' ? { reason_id: ref(`reason:${WRITE_OFFS[move.of.n]!.reason}`) } : {}),
      ...(move.of.doc === 'count' ? { reason_id: ref('reason:count-difference') } : {}),
      ...(move.of.doc === 'put-back' ? { note: PUT_BACK.note } : {}),
      receipt_id: ref(receiptOf(source)),
      ...(pairOf === undefined ? {} : { pair_id: ref(pairOf) }),
      at: at(move.day, move.time),
    };
  });

  const onOrder = (sku: string, qty: number, kind: 'sent' | 'received', receipt: string, when: unknown) => ({ stock_point_id: ref(pointLabel(sku, ITEM.get(sku)!.place)), qty, kind, receipt_id: ref(receipt), at: when });
  const sentRow = (po: { number: number }, sku: string) => postingOf.get(`on-order|po:${String(po.number)}|po-line:${String(po.number)}:${sku}`)!;
  const onOrderMoves = [
    ...PO_1001.lines.map((ordered) => onOrder(ordered.sku, ordered.packs * ITEM.get(ordered.sku)!.pack, 'sent', sentRow(PO_1001, ordered.sku), at(PO_1001.sentOn, '09:15'))),
    ...PO_1001.lines.map((ordered) => onOrder(ordered.sku, -ordered.packs * ITEM.get(ordered.sku)!.pack, 'received', receiptOf(`receipt-line:po-1001:${ordered.sku}`), whenOf(`receipt-line:po-1001:${ordered.sku}`))),
    ...PO_1002.lines.map((ordered) => onOrder(ordered.sku, ordered.packs * ITEM.get(ordered.sku)!.pack, 'sent', sentRow(PO_1002, ordered.sku), sent1002)),
  ];

  return {
    format: 'adminium.sample/1',
    app: 'inventory',
    tables: [
      { ref: 'categories', rows: categories },
      { ref: 'places', rows: places },
      { ref: 'settings', onlyIfEmpty: true, rows: settings },
      { ref: 'suppliers', rows: suppliers },
      { ref: 'items', rows: items },
      { ref: 'item_suppliers', rows: itemSuppliers },
      { ref: 'batches', rows: batches },
      { ref: 'stock_points', rows: points },
      { ref: 'levels', rows: levelRows },
      { ref: 'kits', rows: kits },
      { ref: 'kit_lines', rows: kitLines },
      { ref: 'purchase_orders', rows: purchaseOrders },
      { ref: 'po_lines', rows: poLines },
      { ref: 'receipts', rows: receipts },
      { ref: 'receipt_lines', rows: receiptLines },
      { ref: 'transfers', rows: transfers },
      { ref: 'transfer_lines', rows: transferLines },
      { ref: 'counts', rows: counts },
      { ref: 'count_lines', rows: countLines },
      { ref: 'count_marks', rows: countMarks },
      { ref: 'uses', rows: uses },
      { ref: 'reorder_requests', rows: reorderRequests },
      { ref: 'postings', rows: postings },
      { ref: 'movements', rows: movements },
      { ref: 'on_order_moves', rows: onOrderMoves },
    ],
  };
}

