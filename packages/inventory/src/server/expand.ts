/**
 * WHAT A ROW OF ANOTHER TABLE USES.
 *
 * A host row (a dish, a room type, a treatment) is tied to stock through
 * `links`: to one item, or to a kit, which is a list of items. Each item it
 * comes to is one usage: how much, of what, from where, and whether it is
 * used up or moved somewhere (linen goes to the laundry, it is not used).
 */

import type { PostingLine } from '@adminium/add-on-contracts';

import { type Book, inputRow, type Row, same, textOf } from './book.ts';
import { mul, QTY, read, readOr0, whole } from './decimal.ts';

export interface Usage {
  item: Row;
  /** How much, in thousandths. */
  amount: bigint;
  action: 'use' | 'move';
  /** The place the link or the kit line names, when it names one. */
  place: string | null;
  to: string | null;
}

/** How many a line asks for; nothing or zero plans nothing. Below zero is not a quantity. */
export function quantityOf(line: PostingLine): bigint {
  const quantity = read(line.inputs['quantity'] as unknown, QTY) ?? 0n;
  if (quantity < 0n) throw new Error('a quantity below nothing');
  return quantity;
}

/** What a usage is multiplied by: once a unit, or by the nights, the guests, or both. */
function multiplier(line: PostingLine, per: unknown): bigint {
  const m = line.multipliers;
  const of = (name: string): number | undefined => (typeof m[name] === 'number' ? m[name] : undefined);
  if (per === 'night') return whole(of('night') ?? 1, QTY);
  if (per === 'guest') return whole(of('guest') ?? 1, QTY);
  if (per === 'guest_night') {
    const both = of('guest_night');
    return both !== undefined ? whole(both, QTY) : mul(whole(of('night') ?? 1, QTY), QTY, whole(of('guest') ?? 1, QTY), QTY, QTY);
  }
  return whole(1, QTY);
}

/** The usages of a line that names a host row (`what`). None when the row is tied to nothing. */
export function usagesOf(book: Book, line: PostingLine): Usage[] {
  const what = inputRow(line, 'what');
  if (what === null) return [];
  const quantity = quantityOf(line);
  const links = book.read('links').filter((link) => same(link['source_table'], what.table) && same(link['source_row'], what.row));
  const out: Usage[] = [];
  const add = (itemId: unknown, each: bigint, per: unknown, action: unknown, place: unknown, to: unknown): void => {
    const amount = mul(mul(each, QTY, quantity, QTY, QTY), QTY, multiplier(line, per), QTY, QTY);
    out.push({ item: book.item(itemId), amount, action: action === 'move' ? 'move' : 'use', place: textOf(place), to: textOf(to) });
  };
  for (const link of links) {
    const linkQty = readOr0(link['qty'], QTY);
    if (link['kind'] === 'kit') {
      for (const kitLine of book.read('kit_lines').filter((one) => same(one['kit_id'], link['kit_id']))) {
        add(kitLine['item_id'], mul(readOr0(kitLine['qty'], QTY), QTY, linkQty, QTY, QTY), kitLine['per'], kitLine['action'], kitLine['place_id'] ?? link['place_id'], kitLine['to_place_id']);
      }
    } else if (link['item_id'] !== null && link['item_id'] !== undefined) {
      add(link['item_id'], linkQty, link['per'], link['action'], link['place_id'], link['to_place_id']);
    }
  }
  return out;
}
