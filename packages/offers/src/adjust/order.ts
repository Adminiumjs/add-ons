/**
 * AN OFFER, ON WHAT IS LEFT.
 *
 * Offers run in passes, each on what the passes before left: a fixed price,
 * a price by quantity, a bonus item, percents, then amounts. An offer over
 * the whole order touches every line of goods; one over some lines touches
 * the lines that sell what its targets name. Before it runs, its minimum is
 * judged on the goods AS THEY STAND NOW — after every earlier reduction — and
 * a budget that cannot cover the whole reduction covers none of it.
 */

import type { AdjustInput } from '@adminium/add-on-contracts';

import { fromUnits, least, percentOf, sum, toUnits } from '../units.ts';
import { goodsLeft, keyOf, runsOf, take, takeUnits, textOf, wholeOf, yes, type Line, type Miss, type Offer, type Question, type Row, type Run, type Source, type Standing } from './standing.ts';
import { split } from './split.ts';
import { sells } from './vouchers.ts';

/** The passes, in the order they run; within one, an offer over some lines before one over the whole order, then by key. */
export const PASSES: readonly string[] = ['fixed_price', 'quantity_price', 'bonus_item', 'percent', 'amount'];

export const sourceOf = (offer: Offer): Source =>
  offer.typed === null ? { kind: 'offer', offer: offer.id, code: null, voucher: null, name: offer.name, typed: false } : { kind: 'code', offer: offer.id, code: offer.typed.code, voucher: null, name: offer.name, typed: true };

/** The lines an offer touches: every line of goods, or the ones that sell what a target names. */
export function touched(question: Question, offer: Offer): Line[] {
  const goods = question.lines.filter((line) => line.goods);
  if (textOf(offer.row['applies_to']) !== 'lines') return goods;
  return goods.filter((line) => offer.targets.some((target) => sells(line, textOf(target['kind']), textOf(target['source_table']) ?? '', textOf(target['source_row']) ?? '')));
}

/** What the order's own held use of an offer took: its own, and not counted against the budget. */
function ownGiven(input: AdjustInput, id: string, scale: number): bigint {
  return sum(((input.held?.['redemptions'] ?? []) as Row[]).filter((row) => keyOf(row['offer_id']) === id).map((row) => toUnits(row['amount'], scale) ?? 0n));
}

/** How many of the first `n` units, dearest first, are on the house: the last `bonus` of every full group of `buy`, of `full` units in full groups. */
const givenBefore = (n: number, buy: number, bonus: number, full: number): number => {
  const within = Math.min(n, full);
  return Math.floor(within / buy) * bonus + Math.max(0, (within % buy) - (buy - bonus));
};

/** What the offer would do to the lines it touches: each line's share, or each line's units as they would then stand. */
function reductions(question: Question, standing: Standing, offer: Offer, lines: readonly Line[]): { shares: Map<number, bigint> } | { units: Map<number, Run[]> } | Miss {
  const scale = question.scale;
  const left = lines.map((line) => standing.left[line.at]!);
  const shares = new Map<number, bigint>();
  const gives = textOf(offer.row['gives']);
  if (gives === 'fixed_price') {
    const price = toUnits(offer.row['value'], scale);
    // An offer with no price to bring anything down to gives nothing — never everything.
    if (price === null || price < 0n) return { reason: 'not-for-these-items' };
    // Every unit comes down to the price; one already at or under it is left alone.
    return { units: new Map(lines.map((line) => [line.at, runsOf(standing, line.at).map((run) => ({ value: least(run.value, price), count: run.count }))])) };
  }
  if (gives === 'quantity_price') {
    const bought = lines.reduce((total, line) => total + line.units, 0);
    const reached = offer.breaks
      .map((row) => ({ from: wholeOf(row['from_qty']) ?? 0, percent: row['value'] }))
      .filter((one) => one.from <= bought)
      .sort((a, b) => b.from - a.from)[0];
    if (reached === undefined) return { reason: 'needs-quantity' };
    for (const line of lines) shares.set(line.at, percentOf(standing.left[line.at]!, reached.percent));
    return { shares };
  }
  if (gives === 'bonus_item') {
    const buy = wholeOf(offer.row['buy_qty']) ?? 2;
    // Of every `buy` units at least one is paid for: "buy one, the same one on us" is no offer.
    if (buy < 2) return { reason: 'not-for-these-items' };
    const bonus = Math.min(buy - 1, Math.max(1, wholeOf(offer.row['bonus_qty']) ?? 1));
    // The dearest unit first; of every full group of `buy`, the last `bonus` are on the house, each from its own line.
    const runs = lines.flatMap((line) => runsOf(standing, line.at).map((run, index) => ({ at: line.at, index, run })));
    runs.sort((a, b) => (a.run.value === b.run.value ? a.at - b.at || a.index - b.index : a.run.value > b.run.value ? -1 : 1));
    const all = runs.reduce((total, one) => total + one.run.count, 0);
    if (all < buy) return { reason: 'needs-quantity' };
    const full = Math.floor(all / buy) * buy;
    const units = new Map<number, Run[]>();
    let before = 0;
    for (const one of runs) {
      const given = givenBefore(before + one.run.count, buy, bonus, full) - givenBefore(before, buy, bonus, full);
      before += one.run.count;
      const after = units.get(one.at) ?? [];
      after.push({ value: one.run.value, count: one.run.count - given }, { value: 0n, count: given });
      units.set(one.at, after);
    }
    return { units };
  }
  if (gives === 'percent') {
    if (textOf(offer.row['applies_to']) === 'lines') {
      // Over some lines: each line's own percent, rounded by the line.
      for (const line of lines) shares.set(line.at, percentOf(standing.left[line.at]!, offer.row['value']));
    } else {
      // Over the order: rounded once, on everything, then shared out.
      const parts = split(percentOf(sum(left), offer.row['value']), left);
      lines.forEach((line, at) => shares.set(line.at, parts[at]!));
    }
    return { shares };
  }
  if (gives === 'amount') {
    const parts = split(least(toUnits(offer.row['value'], scale) ?? 0n, sum(left)), left);
    lines.forEach((line, at) => shares.set(line.at, parts[at]!));
    return { shares };
  }
  return { reason: 'not-for-these-items' };
}

/**
 * One offer applied to the order as it stands, or why it is not. An offer
 * that would take nothing here (a basket with no second tote, goods already
 * at nothing) is not for these items.
 */
export function applyOffer(question: Question, standing: Standing, offer: Offer, lines: readonly Line[]): Miss | null {
  const scale = question.scale;
  if (lines.length === 0) return { reason: 'not-for-these-items' };
  const least_ = toUnits(offer.row['min_spend'], scale);
  if (least_ !== null && goodsLeft(question, standing) < least_) return { reason: 'needs-minimum', params: { amount: fromUnits(least_, scale) } };
  const pieces = wholeOf(offer.row['min_qty']);
  if (pieces !== null && lines.reduce((total, line) => total + line.units, 0) < pieces) return { reason: 'needs-quantity' };
  const would = reductions(question, standing, offer, lines);
  if ('reason' in would) return would;
  // Never more than a line has left.
  const shares = 'shares' in would ? would.shares : new Map([...would.units].map(([at, after]) => [at, standing.left[at]! - after.reduce((total, run) => total + run.value * BigInt(run.count), 0n)]));
  const total = sum([...shares].map(([at, share]) => least(share > 0n ? share : 0n, standing.left[at]!)));
  if (total <= 0n) return { reason: 'not-for-these-items' };
  if (!question.earned && !yes(offer.row['budget_open']) && offer.row['budget_open'] !== null && offer.row['budget_open'] !== undefined) {
    const budget = (toUnits(offer.row['budget_left'], scale) ?? toUnits(offer.row['budget'], scale) ?? 0n) + ownGiven(question.input, offer.id, scale);
    // A budget that cannot cover the whole reduction covers none of it.
    if (total > budget) return { reason: 'used-up' };
  }
  const taken = 'shares' in would ? take(standing, sourceOf(offer), would.shares) : takeUnits(standing, sourceOf(offer), would.units);
  // No room left in the answer to list it: it is left out, and said so.
  return taken === null ? { reason: 'not-combinable' } : null;
}
