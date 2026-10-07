/**
 * IN, LOW OR OUT — A QUESTION, WITH NOTHING WRITTEN.
 *
 * A page asks about the rows it shows: could one more of this be had. For a
 * host row it is "how many of this dish can still be made", which is the
 * tightest of what it uses; for a stock item, how many are left. Adminium
 * decides what of the answer leaves: a customer hears the word, and the
 * number only where the owner shows it.
 */

import type { PostingLine, PostingWords } from '@adminium/add-on-contracts';

import { type Book, type Point, type Row, textOf } from './book.ts';
import { order } from './batches.ts';
import { divFloor, QTY, shown, whole } from './decimal.ts';
import { type Usage, usagesOf } from './expand.ts';
import { placeOf } from './place.ts';

/** How near an expiry counts as soon. */
const SOON_DAYS = 30;

/** The days from the start of the calendar to an ISO date: for telling two dates apart with no clock. */
function dayNumber(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number) as [number, number, number];
  const a = Math.floor((14 - m) / 12);
  const year = y + 4800 - a;
  const month = m + 12 * a - 3;
  return d + Math.floor((153 * month + 2) / 5) + 365 * year + Math.floor(year / 4) - Math.floor(year / 100) + Math.floor(year / 400) - 32045;
}

/** Whether a short promise would be stopped for a customer. */
function publicStops(book: Book, item: Row): boolean {
  const own = item['when_out'];
  if (own === 'stop' || own === 'allow') return own === 'stop';
  return book.setting('when_out_public') === 'stop';
}

interface Counted {
  usage: Usage;
  point: Point | null;
  /** How many whole times the usage can still be had. */
  times: bigint;
  available: bigint;
}

function count(book: Book, line: PostingLine, usage: Usage): Counted {
  const place = placeOf(book, line, usage.item, usage.place);
  const point = place === null ? null : book.pointRead(usage.item, place);
  const available = point === null ? 0n : book.available(point);
  return { usage, point, times: usage.amount <= 0n ? 0n : divFloor(available, usage.amount), available };
}

/** What is said of one line. */
function say(book: Book, line: PostingLine, usages: Usage[]): PostingWords {
  const used = usages.filter((usage) => usage.action === 'use' && usage.amount > 0n);
  if (used.length === 0) return { line: line.line, state: 'in' };
  const counted = used.map((usage) => count(book, line, usage));
  const tightest = counted.reduce((least, one) => (one.times < least.times ? one : least));
  const low = counted.some((one) => one.point !== null && Number(one.point.row?.['low'] ?? 0) === 1);
  const state: PostingWords['state'] = tightest.times < 1n ? (publicStops(book, tightest.usage.item) ? 'out' : 'low') : low ? 'low' : 'in';
  const item = tightest.usage.item;
  const decimals = Number(item['decimals'] ?? 0);
  const after = tightest.available - tightest.usage.amount;
  const out: PostingWords = {
    line: line.line,
    state,
    left: tightest.times.toString(),
    exact: shown(tightest.available, decimals),
    after: shown(after > 0n ? after : 0n, decimals),
    cause: 'stock',
  };
  const first = tightest.point === null ? undefined : order(book, tightest.point, book.input.today)[0];
  if (first !== undefined && !first.unassigned) {
    const code = textOf(first.row?.['batch_code']);
    const expires = textOf(first.row?.['expires_on'])?.slice(0, 10);
    if (code !== null) out.batch = code;
    if (expires !== undefined) {
      out.expires = expires;
      if (dayNumber(expires) - dayNumber(book.input.today) <= SOON_DAYS) out.soon = true;
    }
  }
  if (used.length > 1) out.first = { item: textOf(item['name']) ?? '', unit: textOf(item['unit']) ?? '' };
  return out;
}

/** The answer for every line asked about. Nothing is written, and nothing is promised between lines. */
export function words(book: Book, byItem: boolean): void {
  for (const line of book.input.lines) {
    const usages: Usage[] = byItem ? [{ item: book.item(line.inputs['item']), amount: whole(1, QTY), action: 'use', place: null, to: null }] : usagesOf(book, line);
    book.words.push(say(book, line, usages));
  }
}
