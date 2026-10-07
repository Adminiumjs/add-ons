/**
 * GOODS A CUSTOMER BROUGHT BACK.
 *
 * A refund line says where the goods go: back on the shelf, to the damaged
 * pile, or nowhere (a refund with nothing returned). What comes back goes
 * onto the batch nobody has named, because the batch it left from is not
 * known. Damaged goods are put back and written off in the same answer, so
 * what is on hand does not move and the loss is in the log. Never refused:
 * how much may be returned is the host's own rule.
 */

import { type Book, inputText, textOf } from './book.ts';
import { quantityOf, usagesOf } from './expand.ts';
import { pointOf } from './place.ts';

export function giveBack(book: Book): void {
  for (const line of book.input.lines) {
    if (quantityOf(line) === 0n) continue;
    const to = inputText(line, 'to') ?? 'shelf';
    const usages = usagesOf(book, line);
    if (usages.length === 0) {
      book.note(line.line, 'not-linked');
      continue;
    }
    if (to === 'none') continue;
    for (const usage of usages) {
      // Linen that was moved to the laundry was never sold: there is nothing to bring back.
      if (usage.action !== 'use' || usage.amount <= 0n) continue;
      const point = pointOf(book, line, usage.item, usage.place);
      if (point === null) {
        book.note(line.line, 'to-check', textOf(usage.item['name']) ?? undefined);
        continue;
      }
      const level = book.unassignedLevel(line.line, point);
      book.move(line.line, level, 'returned', usage.amount);
      if (to === 'damaged') book.move(line.line, level, 'written_off', -usage.amount);
    }
  }
}
