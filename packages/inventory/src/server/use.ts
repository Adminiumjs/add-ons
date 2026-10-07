/**
 * STOCK USED, HELD AND GIVEN BACK.
 *
 * `use` and `hold` take for a row of another table, through what it is linked
 * to; `use-item` takes a stock item named outright. A hold promises first
 * (`reserve`) and takes when the order is paid (`post`); either is undone by
 * the opposite of what it wrote (`reverse`).
 *
 * WHO MAY BE REFUSED. A promise — a hold, or anything a customer does with no
 * hold behind it — is judged against what the stock point can still give, and
 * stopped when the item (or the settings) says stop. Staff are never refused
 * for stock: the work was done, so the shortfall is written against the batch
 * nobody has named and the place is marked to be counted.
 */

import type { PostingLine, PostingScalar } from '@adminium/add-on-contracts';

import { type Book, inputKey, inputText, type Point, type Row, textOf, yes } from './book.ts';
import { pick } from './batches.ts';
import { min, QTY, read, shown, text } from './decimal.ts';
import { quantityOf, type Usage, usagesOf } from './expand.ts';
import { pointOf } from './place.ts';
import { movePair } from './transfer.ts';

/** The kinds of movement a line may ask for that take stock, and the two that put it back. */
const OUT_KINDS = ['sold', 'used', 'consumed', 'written_off'];
const IN_KINDS: Record<string, string> = { put_back: 'returned', made: 'made' };

/** Whether a short promise is stopped: the item's own word, else the settings' for who is asking. */
function stops(book: Book, item: Row): boolean {
  const own = item['when_out'];
  if (own === 'stop' || own === 'allow') return own === 'stop';
  return (book.input.origin === 'public' ? book.setting('when_out_public') : book.setting('when_out_staff')) === 'stop';
}

const decimalsOf = (item: Row): number => Number(item['decimals'] ?? 0);
const nameOf = (item: Row): string | undefined => textOf(item['name']) ?? undefined;

/** A promise the point cannot keep, said to whoever asked: what it can still give. */
function refuseShort(book: Book, line: string, point: Point | null, item: Row, reason: 'out-of-stock' | 'expired', pickable: bigint): void {
  const spare = point === null ? 0n : min(book.available(point), pickable);
  const name = nameOf(item);
  book.refuse(line, reason, name === undefined ? { left: shown(spare, decimalsOf(item)) } : { left: shown(spare, decimalsOf(item)), item: name });
}

/** The shortfall of a take nobody is refused for: out of the batch nobody has named, and the place to be counted. */
function writeShort(book: Book, line: string, point: Point, kind: string, shortfall: bigint, more: { reason?: unknown; note?: unknown }): void {
  book.move(line, book.unassignedLevel(line, point), kind, -shortfall, { reason: (more.reason ?? null) as never, note: (more.note ?? null) as never });
  book.needsCount(line, point);
  book.note(line, 'short', nameOf(point.item));
  if (yes(point.item['tracks_batches'])) book.note(line, 'batch-unknown', nameOf(point.item));
}

interface Ask {
  kind: string;
  /** The batch a person named, by its key as it was handed over. */
  batch: PostingScalar | null;
  strict: boolean;
  reason: unknown;
  note: unknown;
}

/** One usage posted: movements out of the levels in order, or the pair of a move. */
function post(book: Book, line: PostingLine, usage: Usage, ask: Ask, promise: boolean): void {
  if (usage.amount <= 0n) return;
  const item = usage.item;
  const point = pointOf(book, line, item, usage.place);
  if (point === null) {
    // Nowhere to take from: a promise is refused, and a staff post is left for a person to look at.
    if (promise && stops(book, item)) refuseShort(book, line.line, null, item, 'out-of-stock', 0n);
    else book.note(line.line, 'to-check', nameOf(item));
    return;
  }
  if (usage.action === 'move') {
    if (usage.to === null) throw new Error('a line that moves stock names where to');
    const to = book.point(line.line, item, usage.to);
    if (to === null) throw new Error('the place a line moves stock to was not read');
    movePair(book, line.line, point, to, usage.amount);
    return;
  }
  // Stock put back or made: onto the batch named, else the one nobody has named.
  const into = IN_KINDS[ask.kind];
  if (into !== undefined) {
    const level = ask.batch === null ? book.unassignedLevel(line.line, point) : book.level(line.line, point, ask.batch, false);
    book.move(line.line, level, into, usage.amount, { reason: ask.reason as never, note: ask.note as never });
    return;
  }
  const today = book.input.today;
  const picked = pick(book, point, usage.amount, today, { batch: ask.batch, anyDate: ask.batch !== null });
  if (ask.batch !== null && picked.namedExpired && ask.kind !== 'written_off') {
    // A batch past its date, named by hand: the add-on's own screens are told so; a host's work is done and only noted.
    if (ask.strict) {
      book.refuse(line.line, 'expired', nameOf(item) === undefined ? {} : { item: nameOf(item) as string });
      return;
    }
    book.note(line.line, 'to-check', nameOf(item));
  }
  if (promise && stops(book, item)) {
    const pickable = picked.takes.reduce((sum, take) => sum + take.amount, 0n);
    if (usage.amount > book.available(point) || picked.shortfall > 0n) {
      refuseShort(book, line.line, point, item, picked.shortfall > 0n && picked.cause === 'expired' ? 'expired' : 'out-of-stock', pickable);
      return;
    }
  }
  if (promise) book.promise(point, usage.amount);
  for (const take of picked.takes) book.move(line.line, take.level, ask.kind, -take.amount, { reason: ask.reason as never, note: ask.note as never });
  if (picked.shortfall > 0n) writeShort(book, line.line, point, ask.kind, picked.shortfall, ask);
}

/** One usage held: a reservation, judged against what the point can still give. */
function reserve(book: Book, line: PostingLine, usage: Usage): void {
  if (usage.amount <= 0n || usage.action === 'move') return;
  const item = usage.item;
  const point = pointOf(book, line, item, usage.place);
  if (stops(book, item)) {
    if (point === null) return refuseShort(book, line.line, null, item, 'out-of-stock', 0n);
    const picked = pick(book, point, usage.amount, book.input.today);
    if (usage.amount > book.available(point) || picked.shortfall > 0n) {
      const pickable = picked.takes.reduce((sum, take) => sum + take.amount, 0n);
      return refuseShort(book, line.line, point, item, picked.shortfall > 0n && picked.cause === 'expired' ? 'expired' : 'out-of-stock', pickable);
    }
  }
  if (point === null) {
    book.note(line.line, 'to-check', nameOf(item));
    return;
  }
  book.insert(line.line, 'reservations', { stock_point_id: point.ref as never, qty: text(usage.amount, QTY), state: 'held' });
  book.promise(point, usage.amount);
}

/** The opposite of everything the round wrote: each movement given back, each hold let go, what was on order as it was. */
export function reverse(book: Book): void {
  const at = book.first();
  for (const row of book.written('movements')) {
    const qty = read(row['qty'], QTY) ?? 0n;
    book.insert(at, 'movements', {
      level_id: row['level_id'] ?? null,
      kind: row['kind'] ?? null,
      qty: text(-qty, QTY),
      unit_cost: row['unit_cost'] ?? null,
      reason_id: null,
      note: null,
      reverses_id: row['id'] ?? null,
      pair_id: null,
    });
  }
  for (const row of book.written('reservations')) {
    if (row['state'] === 'held') book.update(at, 'reservations', row['id'] as never, { state: 'released' });
  }
  // What a round took off (or put on) what is on order is put back: the units are expected again.
  for (const row of book.written('on_order_moves')) {
    const qty = read(row['qty'], QTY) ?? 0n;
    if (qty !== 0n) book.insert(at, 'on_order_moves', { stock_point_id: row['stock_point_id'] ?? null, qty: text(-qty, QTY), kind: 'reopened' });
  }
}

/** The usages of a line: what its host row is linked to, or the one item it names. */
function usagesFor(book: Book, line: PostingLine, byItem: boolean): Usage[] | null {
  if (!byItem) {
    const usages = usagesOf(book, line);
    return usages.length === 0 ? null : usages;
  }
  return [{ item: book.item(line.inputs['item']), amount: quantityOf(line), action: 'use', place: null, to: null }];
}

/** `use`, `hold` and `use-item`, in the phase asked for. */
export function use(book: Book, byItem: boolean): void {
  const { phase, origin } = book.input;
  // A hold of this round is taken by the post that follows it, and that post is never refused.
  const held = book.written('reservations').filter((row) => row['state'] === 'held');
  if (phase === 'post') for (const row of held) book.update(book.first(), 'reservations', row['id'] as never, { state: 'fulfilled' });
  for (const line of book.input.lines) {
    if (quantityOf(line) === 0n) continue;
    const usages = usagesFor(book, line, byItem);
    if (usages === null) {
      book.note(line.line, 'not-linked');
      continue;
    }
    const asked = inputText(line, 'kind');
    const ask: Ask = {
      kind: asked !== null && (OUT_KINDS.includes(asked) || IN_KINDS[asked] !== undefined) ? asked : 'used',
      batch: inputKey(line, 'batch'),
      strict: yes(line.inputs['strict']),
      reason: line.inputs['reason'] ?? null,
      note: line.inputs['note'] ?? null,
    };
    for (const usage of usages) {
      if (phase === 'reserve') reserve(book, line, usage);
      else post(book, line, usage, ask, origin === 'public' && held.length === 0);
    }
  }
}
