/**
 * STOCK THAT ARRIVED, AND STOCK SENT BACK.
 *
 * A receipt line is one item, a quantity, a cost and, for an item kept by
 * batch, the batch it came in. It puts the quantity on the level of that
 * batch in the place it arrived, moves the item's average cost, takes what
 * arrived off what was on order, and says how far the order has come.
 * Opening stock is the same action with another kind.
 */

import type { PostingLine } from '@adminium/add-on-contracts';

import { type Book, inputText, type Level, type Point, type Row, same, textOf, yes } from './book.ts';
import { averageAfter, averageBefore, onHand, setAverage } from './cost.ts';
import { COST, max, min, QTY, read, readOr0 } from './decimal.ts';
import { reverse } from './use.ts';

const OPEN_ORDER = ['sent', 'part_received'];

interface Arrived {
  item: Row;
  qty: bigint;
  cost: bigint;
  guessed: boolean;
}

function arrived(book: Book, line: PostingLine): Arrived {
  const item = book.item(line.inputs['item']);
  const qty = read(line.inputs['quantity'] as unknown, QTY) ?? 0n;
  if (qty <= 0n) throw new Error('a receipt line with nothing on it');
  const guessed = Number(line.inputs['guessed'] ?? 0) === 1;
  return { item, qty, cost: guessed ? readOr0(item['cost_avg'], COST) : readOr0(line.inputs['cost'] as unknown, COST), guessed };
}

/** The order a receipt line is against, while it still has something on order. */
function openOrder(book: Book, line: PostingLine): Row | null {
  const po = line.inputs['po'];
  if (po === null || po === undefined || po === '') return null;
  const order = book.read('order').find((row) => same(row['id'], po)) ?? null;
  return order !== null && OPEN_ORDER.includes(String(order['status'])) ? order : null;
}

/** The level a line's batch sits on in a place, as read. A line sent back names a batch that is there. */
function levelOf(book: Book, line: PostingLine, item: Row, point: Point): Level | null {
  if (!yes(item['tracks_batches'])) return point.row === null ? null : (book.levelsOf(point).find((level) => level.unassigned) ?? null);
  const code = inputText(line, 'batch_code');
  const batch = code === null ? undefined : book.read('batches').find((row) => same(row['item_id'], item['id']) && String(row['code']) === code);
  return batch === undefined ? null : book.levelRead(point, batch['id'] as never);
}

export function receive(book: Book): void {
  for (const line of book.input.lines) {
    const { item, qty, cost, guessed } = arrived(book, line);
    const opening = inputText(line, 'kind') === 'opening';
    const place = inputText(line, 'place');
    if (place === null) throw new Error('a receipt line with no place');
    // The batch: the one nobody names for an item not kept by batch; else the code typed, found or made.
    let level: Level;
    if (!yes(item['tracks_batches'])) level = book.unassignedLevel(line.line, book.point(line.line, item, place));
    else {
      const code = inputText(line, 'batch_code');
      if (code === null) {
        book.refuse(line.line, 'needs-batch', textOf(item['name']) === null ? {} : { item: textOf(item['name']) as string });
        continue;
      }
      const expires = inputText(line, 'expires');
      const known = book.read('batches').some((row) => same(row['item_id'], item['id']) && !yes(row['unassigned']) && String(row['code']) === code);
      // A new batch already past its date is a date typed wrong on a delivery; old stock loaded at opening is what it is.
      if (!known && !opening && expires !== null && expires.slice(0, 10) < book.input.today) {
        book.refuse(line.line, 'expired', textOf(item['name']) === null ? {} : { item: textOf(item['name']) as string });
        continue;
      }
      const point = book.point(line.line, item, place);
      const batch = book.codedBatch(line.line, item, code, { expires: expires === null ? null : expires.slice(0, 10), received: book.input.today });
      level = book.level(line.line, point, batch.ref, false);
    }
    const point = level.point;
    if (guessed) book.note(line.line, 'cost-to-check', textOf(item['name']) ?? undefined);
    book.move(line.line, level, opening ? 'opening' : 'received', qty, { cost });
    setAverage(book, line.line, item, averageAfter(onHand(book, item), readOr0(item['cost_avg'], COST), qty, cost));

    // What arrived comes off what was on order, and the order moves on.
    const order = openOrder(book, line);
    const lines = book.read('order_lines');
    const orderLine = order === null ? undefined : lines.find((row) => same(row['id'], line.inputs['po_line']));
    if (order !== null && orderLine !== undefined) {
      // The line's own total already counts this receipt: it settled before this was asked.
      const before = readOr0(orderLine['received'], QTY) - qty;
      const take = min(qty, max(0n, readOr0(orderLine['qty'], QTY) - before));
      if (take > 0n) book.onOrder(line.line, book.point(line.line, item, order['place_id']), -take, 'received');
    }
    if (order !== null) {
      const open = lines.filter((row) => same(row['po_id'], order['id'])).reduce((sum, row) => sum + max(0n, readOr0(row['qty'], QTY) - readOr0(row['received'], QTY)), 0n);
      if (open === 0n) book.update(line.line, 'purchase_orders', order['id'] as never, { status: 'received', received_at: book.input.now });
      else if (order['status'] !== 'part_received') book.update(line.line, 'purchase_orders', order['id'] as never, { status: 'part_received' });
    }
    // A reorder that was paused starts again once stock is back above its level.
    if (point.row !== null && yes(point.row['reorder_paused']) && point.row['reorder_level'] !== null && readOr0(point.row['available'], QTY) + qty > readOr0(point.row['reorder_level'], QTY)) {
      book.update(line.line, 'stock_points', point.row['id'] as never, { reorder_paused: false });
    }
  }
}

/** A receipt line undone: what the round wrote is given back, and the average worked back. The order stays as it reads. */
export function receiveReverse(book: Book): void {
  reverse(book);
  for (const line of book.input.lines) {
    const { item, qty, cost } = arrived(book, line);
    const before = averageBefore(onHand(book, item), readOr0(item['cost_avg'], COST), qty, cost);
    if (before !== null) setAverage(book, line.line, item, before);
  }
}

/** A whole receipt line sent back to its supplier: out of its batch, the average worked back, and expected again. */
export function sendBack(book: Book): void {
  for (const line of book.input.lines) {
    const { item, qty, cost } = arrived(book, line);
    const place = inputText(line, 'place');
    if (place === null) throw new Error('a line sent back with no place');
    const point = book.point(line.line, item, place);
    const level = levelOf(book, line, item, point);
    if (level === null) throw new Error('the batch a line is sent back from was not read');
    book.move(line.line, level, 'sent_back', -qty, { cost });
    const before = averageBefore(onHand(book, item), readOr0(item['cost_avg'], COST), qty, cost);
    if (before !== null) setAverage(book, line.line, item, before);
    const order = openOrder(book, line);
    if (order !== null) book.onOrder(line.line, book.point(line.line, item, order['place_id']), qty, 'sent_back');
  }
}
