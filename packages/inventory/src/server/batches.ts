/**
 * WHICH BATCH GOES FIRST.
 *
 * The earliest expiry first: real batches that have not expired, soonest
 * first (one with no date last), then the batch nobody has named. A batch
 * past its date is never picked by itself; a person may still name it.
 */

import { type Book, type Level, type Point, same } from './book.ts';
import { min } from './decimal.ts';

export interface Take {
  level: Level;
  amount: bigint;
}

export interface Picked {
  takes: Take[];
  /** What the levels could not give. */
  shortfall: bigint;
  /** Why: stock that is past its date was passed over, or there was simply not enough. */
  cause: 'stock' | 'expired';
  /** Whether the batch a person named is past its date. */
  namedExpired: boolean;
}

const expiryOf = (level: Level): string | null => {
  const value = level.row?.['expires_on'];
  return value === null || value === undefined || value === '' ? null : String(value).slice(0, 10);
};

/** Whether a level's batch is past its date on the day of the call. */
export const expired = (level: Level, today: string): boolean => {
  const expires = expiryOf(level);
  return expires !== null && expires < today;
};

/** The levels a take would use, in order. */
export function order(book: Book, point: Point, today: string, options: { batch?: unknown; anyDate?: boolean } = {}): Level[] {
  const stocked = book.levelsOf(point).filter((level) => book.left(level) > 0n);
  if (options.batch !== undefined && options.batch !== null) return stocked.filter((level) => same(level.batch, options.batch));
  const real = stocked
    .filter((level) => !level.unassigned && (options.anyDate === true || !expired(level, today)))
    .sort((a, b) => {
      const [x, y] = [expiryOf(a), expiryOf(b)];
      if (x !== y) return x === null ? 1 : y === null ? -1 : x < y ? -1 : 1;
      return Number(a.batch) - Number(b.batch);
    });
  return [...real, ...stocked.filter((level) => level.unassigned)];
}

/**
 * What taking an amount from a stock point's levels would use, in order, and
 * what could not be had. Nothing is recorded here: the movement that takes
 * it is what counts it.
 */
export function pick(book: Book, point: Point, amount: bigint, today: string, options: { batch?: unknown; anyDate?: boolean } = {}): Picked {
  const takes: Take[] = [];
  let remaining = amount;
  for (const level of order(book, point, today, options)) {
    if (remaining <= 0n) break;
    const part = min(book.left(level), remaining);
    takes.push({ level, amount: part });
    remaining -= part;
  }
  const named = options.batch === undefined || options.batch === null ? null : (book.levelsOf(point).find((level) => same(level.batch, options.batch)) ?? null);
  const passedOver = options.anyDate !== true && named === null && book.levelsOf(point).some((level) => !level.unassigned && book.left(level) > 0n && expired(level, today));
  return { takes, shortfall: remaining > 0n ? remaining : 0n, cause: remaining > 0n && passedOver ? 'expired' : 'stock', namedExpired: named !== null && expired(named, today) };
}
