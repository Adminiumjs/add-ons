/**
 * WHAT AN ITEM COSTS, ON AVERAGE.
 *
 * A receipt moves the average toward what was just paid, weighted by how much
 * is on hand; undoing the receipt works it back. With nothing on hand (or
 * less than nothing, after sales the books did not hold) the average is
 * simply the new cost. It is kept to four places on the item and on every
 * stock point of it, written together.
 */

import { type Book, type Row, same } from './book.ts';
import { COST, divRound, QTY, readOr0, text } from './decimal.ts';

/** What is on hand of an item over all its stock points, as read. */
export function onHand(book: Book, item: Row): bigint {
  return book
    .read('points')
    .filter((point) => same(point['item_id'], item['id']))
    .reduce((sum, point) => sum + readOr0(point['on_hand'], QTY), 0n);
}

/** The average once `qty` more has come in at `cost`. Quantities in thousandths, costs in ten-thousandths. */
export function averageAfter(held: bigint, average: bigint, qty: bigint, cost: bigint): bigint {
  if (held <= 0n) return cost;
  return divRound(held * average + qty * cost, held + qty);
}

/** The average once `qty` that came in at `cost` is taken out again; nothing when that would leave nothing to average. */
export function averageBefore(held: bigint, average: bigint, qty: bigint, cost: bigint): bigint | null {
  const rest = held - qty;
  if (rest <= 0n) return null;
  const value = held * average - qty * cost;
  return value <= 0n ? null : divRound(value, rest);
}

/** Writes a new average on the item and on each of its stock points, when it moved. */
export function setAverage(book: Book, line: string, item: Row, average: bigint): void {
  if (average === readOr0(item['cost_avg'], COST)) return;
  const value = text(average, COST);
  book.update(line, 'items', item['id'] as never, { cost_avg: value });
  for (const point of book.read('points').filter((one) => same(one['item_id'], item['id']))) book.update(line, 'stock_points', point['id'] as never, { cost_avg: value });
}
