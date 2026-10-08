/**
 * WHAT THE QUESTION IS READ INTO.
 *
 * An order's lines as whole numbers of its smallest unit, the offers handed
 * in with their breaks and targets, and what has been taken off so far. Every
 * step of the answer reads and changes these and nothing else.
 */

import type { AdjustInput, AdjustKind, AdjustLine, AdjustReason, ExplainReason } from '@adminium/add-on-contracts';

import type { Name } from './names.ts';

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
  return Number.parseInt(text, 10);
}
/** A key as text: what a row is told apart by. */
export const keyOf = (value: unknown): string => String(value);

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
  /** A stay's nights, each with its own price. */
  nights: bigint[] | null;
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

/** What the order stands at while it is worked out: what each line has left, and what was taken. */
export interface Standing {
  left: bigint[];
  taken: Taken[];
}

export interface Offer {
  id: string;
  row: Row;
  breaks: Row[];
  targets: Row[];
  name: Name;
  /** The code typed for it, when one was. */
  typed: { typed: string; code: string; row: Row } | null;
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

/** Everything the goods lines have left. */
export const goodsLeft = (question: Question, standing: Standing): bigint => question.lines.reduce((total, line) => (line.goods ? total + standing.left[line.at]! : total), 0n);

/** A reduction put on the lines: taken off what each has left, and recorded. Nothing is recorded for a reduction of nothing. */
export function take(standing: Standing, source: Source, shares: Map<number, bigint>, units?: number): Taken | null {
  const kept = new Map<number, bigint>();
  let total = 0n;
  for (const [at, share] of shares) {
    const cut = share > standing.left[at]! ? standing.left[at]! : share;
    if (cut <= 0n) continue;
    standing.left[at] = standing.left[at]! - cut;
    kept.set(at, cut);
    total += cut;
  }
  if (total <= 0n) return null;
  const taken: Taken = { source, shares: kept, total, ...(units === undefined ? {} : { units }) };
  standing.taken.push(taken);
  return taken;
}
