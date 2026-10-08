/**
 * VOUCHERS AND PACKS.
 *
 * A voucher for a thing — one candle, one night — and a pack of uses come
 * first, in the order typed: each takes the dearest matching unit that still
 * has something left. A voucher worth an amount or a percent comes after the
 * offers, on the whole order.
 */

import type { AdjustInput } from '@adminium/add-on-contracts';

import { percentOf, sum, toUnits } from '../units.ts';
import { goodsLeft, keyOf, take, textOf, wholeOf, yes, type Line, type Question, type Refused, type Row, type Source, type Standing, type TypedVoucher } from './standing.ts';
import { voucherName } from './names.ts';
import { proportion, split } from './split.ts';

const sourceOf = (voucher: TypedVoucher): Source => {
  const worth = textOf(voucher.row['worth']) ?? 'amount';
  return { kind: worth === 'pack' ? 'pack' : 'voucher', offer: null, code: null, voucher: voucher.id, typed: true, name: voucherName({ worth, sold: yes(voucher.row['sold']), name: textOf(voucher.row['public_name']) ?? '' }) };
};

/** What each unit of a line still comes to: its nights, or its amount left shared over its units. */
export function unitsLeft(line: Line, left: bigint): bigint[] {
  if (line.nights !== null && line.nights.length > 0) return sum(line.nights) === left ? [...line.nights] : proportion(left, line.nights);
  return proportion(left, Array.from({ length: line.units }, () => 1n));
}

/** Whether a line sells what a voucher or a target names. */
export function sells(line: Line, what: string | null, table: string, row: string): boolean {
  return line.what.some((entry) => entry.as === what && entry.table === table && keyOf(entry.row) === row);
}

/** The units of the order's own held use of a voucher: its own, and not counted against it. */
function ownUnits(input: AdjustInput, id: string): number {
  return ((input.held?.['redemptions'] ?? []) as Row[]).filter((row) => keyOf(row['voucher_id']) === id).reduce((total, row) => total + (wholeOf(row['uses']) ?? 1), 0);
}

/**
 * A voucher for a thing covers `units` units, a pack as many units as the
 * lines ask for and it has left — the dearest first, each taken from its own
 * line. Nothing it names in the basket: it is not for these items.
 */
export function things(question: Question, standing: Standing, vouchers: readonly TypedVoucher[]): Refused[] {
  const refused: Refused[] = [];
  for (const voucher of vouchers) {
    const worth = textOf(voucher.row['worth']);
    if (worth !== 'thing' && worth !== 'pack') continue;
    const [what, table, row] = [textOf(voucher.row['what']), textOf(voucher.row['source_table']) ?? '', textOf(voucher.row['source_row']) ?? ''];
    const matching = question.lines.filter((line) => line.goods && sells(line, what, table, row));
    const units = matching.flatMap((line) => unitsLeft(line, standing.left[line.at]!).map((value) => ({ at: line.at, value }))).filter((unit) => unit.value > 0n);
    if (matching.length === 0) {
      refused.push({ typed: voucher.typed, reason: 'not-for-these-items' });
      continue;
    }
    const covers = worth === 'pack' ? (wholeOf(voucher.row['uses_left']) ?? 0) + ownUnits(question.input, voucher.id) : (wholeOf(voucher.row['units']) ?? 1);
    // The dearest unit first; of two as dear, the one on the earlier line.
    const covered = units.sort((a, b) => (a.value === b.value ? a.at - b.at : a.value > b.value ? -1 : 1)).slice(0, Math.max(0, covers));
    const shares = new Map<number, bigint>();
    for (const unit of covered) shares.set(unit.at, (shares.get(unit.at) ?? 0n) + unit.value);
    take(standing, sourceOf(voucher), shares, worth === 'pack' ? covered.length : undefined);
  }
  return refused;
}

/** A voucher worth an amount or a percent, in the order typed, on everything the goods have left. */
export function values(question: Question, standing: Standing, vouchers: readonly TypedVoucher[]): void {
  for (const voucher of vouchers) {
    const worth = textOf(voucher.row['worth']);
    if (worth !== 'amount' && worth !== 'percent') continue;
    const goods = question.lines.filter((line) => line.goods);
    const left = goods.map((line) => standing.left[line.at]!);
    const total = worth === 'percent' ? percentOf(goodsLeft(question, standing), voucher.row['value']) : (toUnits(voucher.row['value'], question.scale) ?? 0n);
    const shares = split(total, left);
    take(standing, sourceOf(voucher), new Map(goods.map((line, at) => [line.at, shares[at]!])));
  }
}
