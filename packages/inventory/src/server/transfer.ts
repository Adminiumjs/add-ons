/**
 * STOCK MOVED FROM ONE PLACE TO ANOTHER.
 *
 * A move is two movements of the same batch, out of one place and into the
 * other, the second naming the first. The item's total does not change and
 * neither does what it costs. Stock past its date may be moved. Staff are
 * never refused: what the books do not hold goes out of, and into, the batch
 * nobody has named, and the place it left is marked to be counted.
 */

import type { PostingLine } from '@adminium/add-on-contracts';

import { type Book, inputKey, type Point, type Row, same, textOf } from './book.ts';
import { pick } from './batches.ts';
import { QTY, read } from './decimal.ts';

/** Moves an amount of an item between two of its stock points, batch by batch. */
export function movePair(book: Book, line: string, from: Point, to: Point, amount: bigint, options: { batch?: unknown } = {}): void {
  const today = book.input.today;
  const picked = pick(book, from, amount, today, { batch: options.batch ?? null, anyDate: true });
  let n = book.rows.length;
  const pair = (out: Parameters<Book['move']>[1], into: Parameters<Book['move']>[1], part: bigint): void => {
    n += 1;
    const label = `o${String(n)}:${line}`.slice(0, 64);
    book.move(line, out, 'moved_out', -part, { label });
    book.move(line, into, 'moved_in', part, { pair: { '@row': label } });
  };
  for (const take of picked.takes) {
    const into = take.level.unassigned ? book.unassignedLevel(line, to) : book.level(line, to, take.level.row?.['batch_id'] ?? take.level.batch, false);
    pair(take.level, into, take.amount);
  }
  if (picked.shortfall > 0n) {
    pair(book.unassignedLevel(line, from), book.unassignedLevel(line, to), picked.shortfall);
    book.needsCount(line, from);
    book.note(line, 'short', textOf(from.item['name']) ?? undefined);
  }
}

/** The `transfer` action: one line, one item, from a place to another. */
export function transfer(book: Book, line: PostingLine): void {
  const quantity = read(line.inputs['quantity'] as unknown, QTY) ?? 0n;
  if (quantity <= 0n) return;
  const from = inputKey(line, 'from');
  const to = inputKey(line, 'to');
  if (from === null || to === null) throw new Error('a transfer names two places');
  if (same(from, to)) {
    book.refuse(line.line, 'not-allowed');
    return;
  }
  const item: Row = book.item(line.inputs['item']);
  const out = book.point(line.line, item, from);
  const into = book.point(line.line, item, to);
  if (out === null || into === null) throw new Error('a place of a transfer was not read');
  movePair(book, line.line, out, into, quantity, { batch: inputKey(line, 'batch') });
}
