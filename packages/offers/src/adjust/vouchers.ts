/**
 * VOUCHERS AND PACKS.
 *
 * A voucher for a thing — one candle, one night — and a pack of uses come
 * first, in the order typed: each takes the dearest matching unit that still
 * has something left. A voucher worth an amount or a percent comes after the
 * offers, on the whole order.
 */

import type { AdjustInput } from '@adminium/add-on-contracts';

import { percentOf, toUnits } from '../units.ts';
import { goodsLeft, keyOf, runsOf, take, takeUnits, textOf, wholeOf, yes, type Line, type Question, type Refused, type Row, type Run, type Source, type Standing, type TypedVoucher } from './standing.ts';
import { voucherName } from './names.ts';
import { split } from './split.ts';

const sourceOf = (voucher: TypedVoucher): Source => {
  const worth = textOf(voucher.row['worth']) ?? 'amount';
  return { kind: worth === 'pack' ? 'pack' : 'voucher', offer: null, code: null, voucher: voucher.id, typed: true, name: voucherName({ worth, sold: yes(voucher.row['sold']), name: textOf(voucher.row['public_name']) ?? '' }) };
};

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
 * line, and never a unit that has nothing left to take. Nothing it names in
 * the basket: it is not for these items.
 */
export function things(question: Question, standing: Standing, vouchers: readonly TypedVoucher[]): Refused[] {
  const refused: Refused[] = [];
  for (const voucher of vouchers) {
    const worth = textOf(voucher.row['worth']);
    if (worth !== 'thing' && worth !== 'pack') continue;
    const [what, table, row] = [textOf(voucher.row['what']), textOf(voucher.row['source_table']) ?? '', textOf(voucher.row['source_row']) ?? ''];
    const matching = question.lines.filter((line) => line.goods && sells(line, what, table, row));
    if (matching.length === 0) {
      refused.push({ typed: voucher.typed, reason: 'not-for-these-items' });
      continue;
    }
    // An order priced again for a return had its uses already: a pack covers what is kept, whatever it has left by now.
    const most = worth === 'pack' ? (question.earned ? Number.MAX_SAFE_INTEGER : (wholeOf(voucher.row['uses_left']) ?? wholeOf(voucher.row['uses_total']) ?? 1) + ownUnits(question.input, voucher.id)) : Math.max(1, wholeOf(voucher.row['units']) ?? 1);
    // The dearest unit first; of two as dear, the one on the earlier line.
    const runs = matching.flatMap((line) => runsOf(standing, line.at).map((run, index) => ({ at: line.at, index, run }))).filter((one) => one.run.value > 0n);
    runs.sort((a, b) => (a.run.value === b.run.value ? a.at - b.at || a.index - b.index : a.run.value > b.run.value ? -1 : 1));
    const change = new Map<number, Run[]>();
    let covered = 0;
    for (const one of runs) {
      if (covered >= most) break;
      const count = Math.min(one.run.count, most - covered);
      covered += count;
      const after = change.get(one.at) ?? runsOf(standing, one.at).map((run) => ({ ...run }));
      // So many units of the run to nothing; the rest as they stood.
      const at = after.findIndex((run) => run.value === one.run.value && run.count >= count);
      after.splice(at, 1, { value: one.run.value, count: after[at]!.count - count }, { value: 0n, count });
      change.set(one.at, after);
    }
    takeUnits(standing, sourceOf(voucher), change, worth === 'pack' ? covered : undefined);
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
