/**
 * A COUNT.
 *
 * Typing a count is a snapshot: what the clerk counted, and what the books
 * held at that moment, kept on the count line. Posting the line writes the
 * difference between the two, so a sale made after the count was typed still
 * stands, and one made before it is already in what the books held.
 */

import { type Book, type Row, same, yes } from './book.ts';
import { COST, QTY, read, readOr0, text } from './decimal.ts';
import { reverse } from './use.ts';

const one = (book: Book, name: string, id: unknown): Row | undefined => book.read(name).find((row) => same(row['id'], id));

/** A count typed (or un-typed) on a line that is still open. */
export function countMark(book: Book): void {
  for (const line of book.input.lines) {
    const counted = one(book, 'line', line.inputs['line']);
    if (counted === undefined) throw new Error('the count line was not read');
    if (counted['status'] !== 'open') {
      book.refuse(line.line, 'not-allowed');
      continue;
    }
    const typed = read(line.inputs['counted'] as unknown, QTY);
    if (typed === null) {
      book.update(line.line, 'count_lines', counted['id'] as never, { counted: null, qty_when_counted: null, counted_at: null, unit_cost: null });
      continue;
    }
    const level = one(book, 'level', counted['level_id']);
    if (level === undefined) throw new Error('the level a count line is of was not read');
    book.update(line.line, 'count_lines', counted['id'] as never, {
      counted: text(typed, QTY),
      qty_when_counted: text(readOr0(level['qty'], QTY), QTY),
      counted_at: book.input.now,
      unit_cost: text(readOr0(book.item(counted['item_id'])['cost_avg'], COST), COST),
    });
  }
}

/** A counted line posted: the difference between what was counted and what the books held then. */
export function count(book: Book): void {
  const at = book.first();
  const counted = one(book, 'line', book.input.source.row);
  if (counted === undefined) throw new Error('the count line was not read');
  const level = one(book, 'level', counted['level_id']);
  const point = one(book, 'points', counted['stock_point_id']);
  if (level === undefined || point === undefined) throw new Error('the level a count line is of was not read');
  const sheet = one(book, 'sheet', counted['count_id']);
  let difference = (read(counted['counted'], QTY) ?? 0n) - (read(counted['qty_when_counted'], QTY) ?? 0n);
  let check = false;
  // A named batch never goes below nothing: one sold from since the count takes only what it still holds.
  const holds = readOr0(level['qty'], QTY);
  if (difference < 0n && !yes(level['unassigned']) && holds < -difference) {
    difference = -holds;
    check = true;
  }
  if (difference !== 0n) {
    const cost = read(counted['unit_cost'], COST) ?? readOr0(book.item(counted['item_id'])['cost_avg'], COST);
    book.moveAt(at, counted['level_id'] ?? null, 'adjusted', difference, cost, { reason: sheet?.['reason_id'] ?? null });
  }
  book.update(at, 'stock_points', point['id'] as never, { needs_count: check, last_counted_at: book.input.now });
  if (check) book.note(at, 'to-check');
}

/** A counted line undone: its adjustment given back, and the place to be counted again. */
export function countReverse(book: Book): void {
  reverse(book);
  const counted = one(book, 'line', book.input.source.row);
  const point = counted === undefined ? undefined : one(book, 'points', counted['stock_point_id']);
  if (point !== undefined) book.update(book.first(), 'stock_points', point['id'] as never, { needs_count: true });
}
