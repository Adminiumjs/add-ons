/**
 * WHAT IS ON ORDER.
 *
 * When an order is sent, each of its lines is on order at the place it will
 * arrive. A receipt takes off what arrives. When a person closes or cancels
 * the order, what is still open is taken off; reopening puts it back. The
 * order's own state is the person's move: nothing here changes an order.
 */

import { type Book, inputKey, inputText, type Row, same } from './book.ts';
import { max, QTY, readOr0 } from './decimal.ts';

/** The order line a call's line stands for: lines are handed by their own key. */
function orderLine(book: Book, key: string): Row {
  const found = book.read('order_lines').find((row) => same(row['id'], key));
  if (found === undefined) throw new Error(`order line ${key} was not read`);
  return found;
}

export function onOrder(book: Book): void {
  for (const line of book.input.lines) {
    const row = orderLine(book, line.line);
    const place = inputKey(line, 'place');
    if (place === null) throw new Error('an order with no place');
    const qty = readOr0(row['qty'], QTY);
    const point = book.point(line.line, book.item(row['item_id']), place);
    if (point === null) throw new Error('the place of an order was not read');
    if (qty > 0n) book.onOrder(line.line, point, qty, 'sent');
  }
}

export function onOrderClose(book: Book): void {
  for (const line of book.input.lines) {
    const row = orderLine(book, line.line);
    const place = inputKey(line, 'place');
    if (place === null) throw new Error('an order with no place');
    const open = max(0n, readOr0(row['qty'], QTY) - readOr0(row['received'], QTY));
    const point = book.point(line.line, book.item(row['item_id']), place);
    if (point === null) throw new Error('the place of an order was not read');
    if (open > 0n) book.onOrder(line.line, point, -open, inputText(line, 'how') === 'cancelled' ? 'cancelled' : 'closed');
  }
}

/**
 * AN ORDER MOVES ON AS ITS LINES ARRIVE: part received while a line is still
 * to come, received — with the moment — once none is. Asked for each receipt
 * line as it goes in, after the order line's own total has taken the line in:
 * a call of its own, because the order is a row this one reads and locks,
 * and a delivery's call has no read left for it.
 */
export function orderProgress(book: Book): void {
  for (const line of book.input.lines) {
    const po = inputKey(line, 'po');
    if (po === null) continue;
    const order = book.read('order').find((row) => same(row['id'], po));
    // An order somebody closed or cancelled meanwhile stays as they left it: the stock is in all the same.
    if (order === undefined || (order['status'] !== 'sent' && order['status'] !== 'part_received')) continue;
    const open = book
      .read('order_lines')
      .filter((row) => same(row['po_id'], po))
      .reduce((sum, row) => sum + max(0n, readOr0(row['qty'], QTY) - readOr0(row['received'], QTY)), 0n);
    if (open === 0n) book.update(line.line, 'purchase_orders', order['id'] as never, { status: 'received', received_at: book.input.now });
    else if (order['status'] !== 'part_received') book.update(line.line, 'purchase_orders', order['id'] as never, { status: 'part_received' });
  }
}
