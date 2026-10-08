/**
 * WHAT THE QUESTION IS READ INTO.
 *
 * An order's lines as whole numbers of its smallest unit, the offers handed
 * in with their breaks and targets, and what has been taken off so far. Every
 * step of the answer reads and changes these and nothing else.
 *
 * A LINE IS ITS UNITS. Two candles at $18.00 are two units of $18.00; a stay
 * is its nights. A voucher for one candle takes one of them to nothing, and
 * the offer after it sees a candle at nothing and a candle at $18.00 — never
 * two at $9.00. Units alike are kept together as a run (so a line of a
 * million screws is two runs, not a million entries); a reduction of the
 * whole line is shared over its units in proportion.
 */

import type { AdjustInput, AdjustKind, AdjustLine, AdjustReason, ExplainReason } from '@adminium/add-on-contracts';

import type { Name } from './names.ts';
import { proportion } from './split.ts';

export type Scalar = string | number | boolean | null;
export type Row = Readonly<Record<string, Scalar>>;

/** Yes, as each database says it. */
export const yes = (value: unknown): boolean => value === true || value === 1 || value === '1' || value === 'true' || value === 't';
/** A value as text, or null for nothing. */
export const textOf = (value: unknown): string | null => (value === null || value === undefined || value === '' ? null : String(value));
/** A whole number, or null. */
export function wholeOf(value: unknown): number | null {
  const text = textOf(value);
  if (text === null || !/^-?\d+(\.0+)?$/.test(text)) return null;
  const whole = Number.parseInt(text, 10);
  return Number.isSafeInteger(whole) ? whole : null;
}
/** A key as text: what a row is told apart by. */
export const keyOf = (value: unknown): string => String(value);
/** The day of a date or a moment kept as text: its first ten characters. */
export const dayOf = (value: unknown): string | null => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null);

export interface Line {
  key: string;
  /** Its place in the question. */
  at: number;
  /** Whether an offer may reduce it and a minimum counts it: kept, not left out, and not paid for by a code. */
  goods: boolean;
  /** What it comes to before any reduction. */
  amount: bigint;
  /** How many whole units it holds; one for a quantity that is not a whole number. */
  units: number;
  what: AdjustLine['what'];
}

/** So many units of a line that stand at the same amount each. */
export interface Run {
  value: bigint;
  count: number;
}

/** Where a reduction came from, as an answer says it. */
export interface Source {
  kind: AdjustKind;
  offer: string | null;
  code: string | null;
  voucher: string | null;
  name: Name;
  typed: boolean;
  /** A staff reduction's reason, by its key. */
  reason?: string;
}

/** One reduction: its source, and how much of it each line carries. */
export interface Taken {
  source: Source;
  /** By the line's place in the question. */
  shares: Map<number, bigint>;
  total: bigint;
  /** A pack: the units it covered. */
  units?: number;
}

/** What the order stands at while it is worked out: what each line has left, unit by unit, and what was taken. */
export interface Standing {
  left: bigint[];
  /** Each line's units, as runs. Kept in step with `left` by {@link runsOf}: a share of the whole line is spread over them when they are next read. */
  runs: Run[][];
  taken: Taken[];
}

export interface TypedCode {
  typed: string;
  code: string;
  row: Row;
}

export interface Offer {
  id: string;
  row: Row;
  breaks: Row[];
  targets: Row[];
  name: Name;
  /** Every code typed for it, in the order typed. */
  codes: TypedCode[];
  /** The code it is applied by: the first of them that still has uses. */
  typed: TypedCode | null;
  /** An offer not saved yet, tried as if it were running. */
  draft: boolean;
}

/** A voucher or a pack somebody typed, found and in order. */
export interface TypedVoucher {
  typed: string;
  id: string;
  row: Row;
}

export interface Refused {
  typed: string;
  reason: AdjustReason;
  params?: { amount?: string; max?: string; name?: string };
}

/** Why an offer does not apply, with what a refusal says beside it. */
export interface Miss {
  reason: ExplainReason;
  params?: { amount?: string };
}

export interface Question {
  input: AdjustInput;
  scale: number;
  lines: Line[];
  /** Mode `refund`: the order earned what it had, so who is buying and whether an offer still runs are not asked again. */
  earned: boolean;
}

/** The most entries of what was applied one answer may carry: four to a line of the most lines a question holds. */
export const APPLIED_MAX = 800;

/** Everything the goods lines have left. */
export const goodsLeft = (question: Question, standing: Standing): bigint => question.lines.reduce((total, line) => (line.goods ? total + standing.left[line.at]! : total), 0n);

/** A line's units as it comes: its nights, or its amount shared evenly over its quantity. */
export function firstRuns(amount: bigint, units: number, nights: readonly bigint[] | null): Run[] {
  if (nights !== null && nights.length > 0) return nights.map((value) => ({ value, count: units }));
  const count = BigInt(units);
  const [base, over] = [amount / count, Number(amount % count)];
  return over === 0 ? [{ value: base, count: units }] : [{ value: base + 1n, count: over }, { value: base, count: units - over }];
}

/**
 * A line's units as they stand now. Where the line lost a share as a whole
 * since they were last read (a percent, an amount), that share is spread over
 * the units in proportion to what each stood at.
 */
export function runsOf(standing: Standing, at: number): Run[] {
  const runs = standing.runs[at]!;
  const left = standing.left[at]!;
  if (runs.reduce((total, run) => total + run.value * BigInt(run.count), 0n) === left) return runs;
  const shares = proportion(left, runs.map((run) => run.value * BigInt(run.count)));
  const spread = runs.flatMap((run, i) => {
    const count = BigInt(run.count);
    const [base, over] = [shares[i]! / count, Number(shares[i]! % count)];
    return over === 0 ? [{ value: base, count: run.count }] : [{ value: base + 1n, count: over }, { value: base, count: run.count - over }];
  });
  standing.runs[at] = spread;
  return spread;
}

/** The answer so far has room for so many more entries of what was applied. */
const room = (standing: Standing): number => APPLIED_MAX - standing.taken.reduce((total, one) => total + one.shares.size, 0);

/**
 * A reduction put on the lines as wholes: taken off what each has left, and
 * recorded. Nothing is recorded for a reduction of nothing — or for one the
 * answer has no room left to list.
 */
export function take(standing: Standing, source: Source, shares: Map<number, bigint>, units?: number): Taken | null {
  const kept = new Map<number, bigint>();
  let total = 0n;
  for (const [at, share] of shares) {
    const cut = share > standing.left[at]! ? standing.left[at]! : share;
    if (cut <= 0n) continue;
    kept.set(at, cut);
    total += cut;
  }
  if (total <= 0n || kept.size > room(standing)) return null;
  for (const [at, cut] of kept) standing.left[at] = standing.left[at]! - cut;
  const taken: Taken = { source, shares: kept, total, ...(units === undefined ? {} : { units }) };
  standing.taken.push(taken);
  return taken;
}

/**
 * A reduction put on units: each run of the line brought down to what `to`
 * says its units stand at afterwards (a run may come back as several). The
 * line loses exactly what its units lost.
 */
export function takeUnits(standing: Standing, source: Source, change: Map<number, Run[]>, units?: number): Taken | null {
  const shares = new Map<number, bigint>();
  for (const [at, after] of change) shares.set(at, standing.left[at]! - after.reduce((total, run) => total + run.value * BigInt(run.count), 0n));
  const taken = take(standing, source, shares, units);
  if (taken !== null) for (const [at, after] of change) if (taken.shares.has(at)) standing.runs[at] = after.filter((run) => run.count > 0);
  return taken;
}
