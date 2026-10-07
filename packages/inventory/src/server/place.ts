/**
 * WHERE A USAGE TAKES FROM.
 *
 * The place a link or a kit line names; else the place the line itself names;
 * else the default place of the settings; else the item's place for sale with
 * the lowest key. With none of the four there is nowhere to take from.
 */

import type { PostingLine } from '@adminium/add-on-contracts';

import { type Book, inputText, type Point, type Row, same, textOf, yes } from './book.ts';

export function placeOf(book: Book, line: PostingLine, item: Row, named: string | null): string | null {
  const chosen = named ?? inputText(line, 'place') ?? textOf(book.setting('default_place_id'));
  if (chosen !== null) return chosen;
  const forSale = book
    .read('points')
    .filter((point) => same(point['item_id'], item['id']) && yes(point['for_sale']))
    .sort((a, b) => Number(a['id']) - Number(b['id']))[0];
  return forSale === undefined ? null : textOf(forSale['place_id']);
}

/** The stock point a usage takes from, or nothing when no place can be found. */
export function pointOf(book: Book, line: PostingLine, item: Row, named: string | null): Point | null {
  const place = placeOf(book, line, item, named);
  return place === null ? null : book.point(line.line, item, place);
}
