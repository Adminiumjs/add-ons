/**
 * "REORDER", PRESSED ON A STOCK POINT THAT IS LOW.
 *
 * The request is a row a person makes; this decides what becomes of it, in
 * the same save. Enough of the item somewhere else for sale: say where, and
 * order nothing. No preferred supplier: say so. Otherwise put whole packs on
 * a draft order for that supplier and place — the draft that already has the
 * item, else one with room, else a new one. Pressed again, the line is
 * raised if it is short and never added twice.
 */

import { type Book, inputKey, type Ref, type Row, same, textOf, type Value, yes } from './book.ts';
import { COST, max, QTY, readOr0, text, whole } from './decimal.ts';

/** The most lines a draft order takes. */
const DRAFT_LINES = 50;

/** `a ÷ b` rounded up to a whole number: packs are whole. */
const ceilDiv = (a: bigint, b: bigint): bigint => (a + b - 1n) / b;

export function reorder(book: Book): void {
  const at = book.first();
  /*
   * The request itself is read once it is written. Before that — the look
   * Adminium takes ahead of the save, to learn which locks the answer stands
   * on — there is no row yet, and the stock point comes from what the request
   * hands in. What is planned for the order is the same either way; only what
   * is written back onto the request waits for the request to be there.
   */
  const request = book.read('request').find((row) => same(row['id'], book.input.source.row));
  const pointId = request === undefined ? inputKey(book.input.lines[0]!, 'point') : (request['stock_point_id'] ?? null);
  const settle = (set: Record<string, Value>): void => {
    if (request !== undefined) book.update(at, 'reorder_requests', request['id'] as never, set);
  };
  const point = book.read('points').find((row) => same(row['id'], pointId));
  if (point === undefined) throw new Error('the stock point of a reorder request was not read');
  const item = book.item(point['item_id']);
  const level = readOr0(point['reorder_level'], QTY);
  const need = max(0n, level - readOr0(point['available'], QTY));

  // Enough elsewhere: what the other places for sale hold above their own levels.
  const others = book.read('points').filter((row) => same(row['item_id'], item['id']) && !same(row['id'], point['id']) && yes(row['for_sale']));
  const spareOf = (row: Row): bigint => max(0n, readOr0(row['available'], QTY) - readOr0(row['reorder_level'], QTY));
  const spare = others.reduce((sum, row) => sum + spareOf(row), 0n);
  if (spare > 0n && spare >= need) {
    const most = others.reduce((best, row) => (spareOf(row) > spareOf(best) ? row : best));
    const where = textOf(most['place_name']);
    settle({ status: 'elsewhere', elsewhere: where });
    book.update(at, 'stock_points', point['id'] as never, { request_note: 'elsewhere', request_elsewhere: where, request_supplier: null });
    return;
  }

  const pref = book.read('prefs').find((row) => same(row['item_id'], item['id']));
  if (pref === undefined) {
    settle({ status: 'needs_supplier' });
    book.update(at, 'stock_points', point['id'] as never, { request_note: 'needs_supplier', request_elsewhere: null, request_supplier: null });
    book.note(at, 'no-supplier', textOf(item['name']) ?? undefined);
    return;
  }

  const packSize = readOr0(pref['pack_size'], QTY);
  if (packSize <= 0n) throw new Error('a preferred supplier with no pack size');
  const wanted = max(max(readOr0(point['reorder_qty'], QTY), need), whole(1, QTY));
  const packs = ceilDiv(wanted, packSize);

  // The draft for this supplier and place: the one that has the item already, else one with room, else a new one.
  const drafts = book
    .read('drafts')
    .filter((row) => same(row['supplier_id'], pref['supplier_id']) && same(row['place_id'], point['place_id']))
    .sort((a, b) => Number(a['id']) - Number(b['id']));
  const lines = book.read('draft_lines').filter((row) => same(row['item_id'], item['id']));
  const holding = drafts.find((draft) => lines.some((row) => same(row['po_id'], draft['id'])));
  const draft = holding ?? drafts.find((row) => Number(row['lines'] ?? 0) < DRAFT_LINES);
  let order: Ref;
  if (draft !== undefined) order = draft['id'] as never;
  else {
    const label = `po:${String(pref['supplier_id'])}:${String(point['place_id'])}`;
    book.insert(at, 'purchase_orders', { supplier_id: pref['supplier_id'] ?? null, place_id: point['place_id'] ?? null, status: 'draft', note: null }, label);
    order = { '@row': label };
  }

  const line = draft === undefined ? undefined : lines.find((row) => same(row['po_id'], draft['id']));
  const qty = text(packs * packSize, QTY);
  if (line !== undefined) {
    if (readOr0(line['packs'], QTY) < whole(Number(packs), QTY)) book.update(at, 'po_lines', line['id'] as never, { packs: text(whole(Number(packs), QTY), QTY) });
    settle({ status: 'drafted', qty, po_line_id: line['id'] ?? null });
  } else {
    book.insert(at, 'po_lines', {
      po_id: order as never,
      item_id: item['id'] ?? null,
      supplier_code: pref['supplier_code'] ?? null,
      pack_name: pref['pack_name'] ?? null,
      packs: text(whole(Number(packs), QTY), QTY),
      pack_size: text(packSize, QTY),
      price: text(readOr0(pref['price'], COST), COST),
    });
    // A line this answer adds has no key yet for the request to name: the stock point says where it went.
    settle({ status: 'drafted', qty });
  }
  book.update(at, 'stock_points', point['id'] as never, { request_note: 'drafted', request_supplier: textOf(pref['supplier_name']), request_elsewhere: null });
}
