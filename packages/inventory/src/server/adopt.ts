/**
 * A STOCK ITEM MADE FROM A ROW OF ANOTHER TABLE.
 *
 * "Make stock items from this table": each row that is linked to nothing yet
 * gets an item of its own name, in the default unit, and the link to it. A
 * row already linked is left alone. No code is made up and none is matched:
 * all that is handed over is the row and what it is called.
 */

import { type Book, inputRow, inputText, same } from './book.ts';
import { QTY, text, whole } from './decimal.ts';

export function adopt(book: Book): void {
  for (const line of book.input.lines) {
    const what = inputRow(line, 'what');
    if (what === null) throw new Error('a row to adopt was not named');
    if (book.read('links').some((link) => same(link['source_table'], what.table) && same(link['source_row'], what.row))) continue;
    const unit = book.read('unit')[0];
    if (unit === undefined) {
      // No default unit has been chosen in the settings: an item cannot be made without one.
      book.refuse(line.line, 'not-allowed');
      continue;
    }
    const label = `i:${line.line}`.slice(0, 64);
    book.insert(line.line, 'items', { name: inputText(line, 'name') ?? what.row, unit_id: unit['id'] ?? null }, label);
    book.insert(line.line, 'links', { source_table: what.table, source_row: what.row, kind: 'item', item_id: { '@row': label }, qty: text(whole(1, QTY), QTY), per: 'unit', action: 'use' });
  }
}
