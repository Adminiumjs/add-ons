/**
 * AN OFFER, ON WHAT IS LEFT.
 *
 * Offers run in passes, each on what the passes before left: a fixed price,
 * a price by quantity, a bonus item, percents, then amounts. An offer over the whole order touches every line of goods; one
 * over some lines touches the lines that sell what its targets name. Before
 * it runs, its minimum is judged on the goods AS THEY STAND NOW — after every
 * earlier reduction — and a budget that cannot cover the whole reduction
 * covers none of it.
 */

import type { AdjustInput } from '@adminium/add-on-contracts';

import { fromUnits, least, percentOf, sum, toUnits } from '../units.ts';
import { goodsLeft, keyOf, take, textOf, wholeOf, yes, type Line, type Miss, type Offer, type Question, type Row, type Source, type Standing } from './standing.ts';
import { split } from './split.ts';
import { sells, unitsLeft } from './vouchers.ts';

/** The passes, in the order they run; within one, an offer over some lines before one over the whole order, then by key. */
export const PASSES: readonly (readonly string[])[] = [['fixed_price'], ['quantity_price'], ['bonus_item'], ['percent'], ['amount']];

export const sourceOf = (offer: Offer): Source =>
  offer.typed === null ? { kind: 'offer', offer: offer.id, code: null, voucher: null, name: offer.name, typed: false } : { kind: 'code', offer: offer.id, code: offer.typed.code, voucher: null, name: offer.name, typed: true };

/** The lines an offer touches: every line of goods, or the ones that sell what a target names. */
function touched(question: Question, offer: Offer): Line[] {
  const goods = question.lines.filter((line) => line.goods);
  if (textOf(offer.row['applies_to']) !== 'lines') return goods;
  return goods.filter((line) => offer.targets.some((target) => sells(line, textOf(target['kind']), textOf(target['source_table']) ?? '', textOf(target['source_row']) ?? '')));
}

/** What the order's own held use of an offer took: its own, and not counted against the budget. */
function ownGiven(input: AdjustInput, id: string, scale: number): bigint {
  return sum(((input.held?.['redemptions'] ?? []) as Row[]).filter((row) => keyOf(row['offer_id']) === id).map((row) => toUnits(row['amount'], scale) ?? 0n));
}

/** What each touched line would lose to the offer, as things stand. */
function reductions(question: Question, standing: Standing, offer: Offer, lines: readonly Line[]): Map<number, bigint> | Miss {
  const scale = question.scale;
  const left = lines.map((line) => standing.left[line.at]!);
  const out = new Map<number, bigint>();
  const gives = textOf(offer.row['gives']);
  if (gives === 'fixed_price') {
    const price = toUnits(offer.row['value'], scale) ?? 0n;
    // Every unit comes down to the price; one already at or under it is left alone.
    for (const line of lines) out.set(line.at, sum(unitsLeft(line, standing.left[line.at]!).map((unit) => (unit > price ? unit - price : 0n))));
  } else if (gives === 'quantity_price') {
    const bought = lines.reduce((total, line) => total + line.units, 0);
    const reached = offer.breaks
      .map((row) => ({ from: wholeOf(row['from_qty']) ?? 0, percent: row['value'] }))
      .filter((one) => one.from <= bought)
      .sort((a, b) => b.from - a.from)[0];
    if (reached === undefined) return { reason: 'needs-quantity' };
    for (const line of lines) out.set(line.at, percentOf(standing.left[line.at]!, reached.percent));
  } else if (gives === 'bonus_item') {
    const buy = Math.max(1, wholeOf(offer.row['buy_qty']) ?? 2);
    const bonus = Math.min(buy, Math.max(1, wholeOf(offer.row['bonus_qty']) ?? 1));
    // The dearest unit first; of every full group of `buy`, the last `bonus` are on the house, each from its own line.
    const units = lines.flatMap((line) => unitsLeft(line, standing.left[line.at]!).map((value) => ({ at: line.at, value }))).sort((a, b) => (a.value === b.value ? a.at - b.at : a.value > b.value ? -1 : 1));
    for (let start = 0; start + buy <= units.length; start += buy) {
      for (const unit of units.slice(start + buy - bonus, start + buy)) out.set(unit.at, (out.get(unit.at) ?? 0n) + unit.value);
    }
    if (units.length < buy) return { reason: 'needs-quantity' };
  } else if (gives === 'percent') {
    if (textOf(offer.row['applies_to']) === 'lines') {
      // Over some lines: each line's own percent, rounded by the line.
      for (const line of lines) out.set(line.at, percentOf(standing.left[line.at]!, offer.row['value']));
    } else {
      // Over the order: rounded once, on everything, then shared out.
      const shares = split(percentOf(sum(left), offer.row['value']), left);
      lines.forEach((line, at) => out.set(line.at, shares[at]!));
    }
  } else if (gives === 'amount') {
    const shares = split(least(toUnits(offer.row['value'], scale) ?? 0n, sum(left)), left);
    lines.forEach((line, at) => out.set(line.at, shares[at]!));
  }
  return out;
}

/**
 * One offer applied to the order as it stands, or why it is not. Nothing is
 * taken for an offer that gives nothing here (a basket with no second tote).
 */
export function applyOffer(question: Question, standing: Standing, offer: Offer): Miss | null {
  const scale = question.scale;
  const lines = touched(question, offer);
  if (lines.length === 0) return { reason: 'not-for-these-items' };
  const least_ = toUnits(offer.row['min_spend'], scale);
  if (least_ !== null && goodsLeft(question, standing) < least_) return { reason: 'needs-minimum', params: { amount: fromUnits(least_, scale) } };
  const pieces = wholeOf(offer.row['min_qty']);
  if (pieces !== null && lines.reduce((total, line) => total + line.units, 0) < pieces) return { reason: 'needs-quantity' };
  const shares = reductions(question, standing, offer, lines);
  if (!(shares instanceof Map)) return shares;
  // Never more than a line has left.
  const total = sum([...shares].map(([at, share]) => least(share, standing.left[at]!)));
  if (!question.earned && !yes(offer.row['budget_open']) && offer.row['budget_open'] !== null && offer.row['budget_open'] !== undefined) {
    const budget = (toUnits(offer.row['budget_left'], scale) ?? toUnits(offer.row['budget'], scale) ?? 0n) + ownGiven(question.input, offer.id, scale);
    // A budget that cannot cover the whole reduction covers none of it.
    if (total > budget) return { reason: 'used-up' };
  }
  take(standing, sourceOf(offer), shares);
  return null;
}
