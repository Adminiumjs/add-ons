/**
 * WHICH OFFERS GO TOGETHER.
 *
 * Offers that combine all apply. One that does not combine applies alone
 * beside the ones that do — so with two of them the order is worked out once
 * for each and once with neither, and the run that gives the customer most
 * wins (the lower key on a tie). One discount code applies to an order: of
 * several typed, the best. A code whose offer lost is not refused; the
 * customer is told that a better offer applied, and it takes no use.
 */

import type { AdjustInput } from '@adminium/add-on-contracts';

import { sum } from '../units.ts';
import { textOf, yes, type Miss, type Offer, type Question, type Refused, type Standing, type TypedVoucher } from './standing.ts';
import { applyOffer, PASSES } from './order.ts';
import { staffReduction } from './staff.ts';
import { values } from './vouchers.ts';

/** The most offers that do not combine one question tries, each in a run of its own. */
export const ALONE_MAX = 12;

export interface Run {
  standing: Standing;
  /** The offer that does not combine, taken alone in this run; null for the run with none. */
  alone: Offer | null;
  /** The one typed code this run let apply, when more than one could. */
  code: Offer | null;
  /** Each offer of the run that did not apply, with why. */
  missed: Map<string, Miss>;
  staff: Refused | null;
  total: bigint;
}

const combines = (offer: Offer, input: AdjustInput): boolean => (offer.row['combinable'] === null || offer.row['combinable'] === undefined ? yes(input.settings['combine_default']) : yes(offer.row['combinable']));

/** One run: the given offers in their passes, then the vouchers worth an amount or a percent, then staff. */
function run(question: Question, start: Standing, offers: readonly Offer[], vouchers: readonly TypedVoucher[], alone: Offer | null, code: Offer | null): Run {
  const standing: Standing = { left: [...start.left], taken: [...start.taken] };
  const missed = new Map<string, Miss>();
  // Within a pass, an offer over some lines runs before one over the whole order — fifteen percent off the mugs, then ten
  // percent of what the order has left — and, of two alike, the lower key first.
  const overLines = (offer: Offer): number => (textOf(offer.row['applies_to']) === 'lines' ? 0 : 1);
  const inTurn = [...offers].sort((a, b) => overLines(a) - overLines(b) || offers.indexOf(a) - offers.indexOf(b));
  for (const pass of PASSES) {
    for (const offer of inTurn) {
      if (!pass.includes(textOf(offer.row['gives']) ?? '')) continue;
      const miss = applyOffer(question, standing, offer);
      if (miss !== null) missed.set(offer.id, miss);
    }
  }
  values(question, standing, vouchers);
  const staff = staffReduction(question, standing);
  return { standing, alone, code, missed, staff, total: sum(standing.taken.map((taken) => taken.total)) };
}

/**
 * Every run the eligible offers allow, and the best of them. `eligible`: the
 * offers that stand for this buyer, in key order. `left`: an offer that does
 * not combine and was past the twelfth, with no run of its own.
 */
export function best(question: Question, start: Standing, eligible: readonly Offer[], vouchers: readonly TypedVoucher[]): { won: Run; runs: Run[]; left: Offer[] } {
  const input = question.input;
  const together = eligible.filter((offer) => combines(offer, input));
  const apart = eligible.filter((offer) => !combines(offer, input));
  const tried = apart.slice(0, ALONE_MAX);
  const runs: Run[] = [];
  for (const alone of [null, ...tried]) {
    // One code to an order: where the run holds several typed ones, it is worked out once for each.
    const typed = [...together, ...(alone === null ? [] : [alone])].filter((offer) => offer.typed !== null);
    const choices: (Offer | null)[] = alone?.typed != null || typed.length <= 1 ? [null] : typed.slice(0, ALONE_MAX);
    for (const code of choices) {
      const offers = [...together.filter((offer) => code === null || offer.typed === null || offer === code), ...(alone === null ? [] : [alone])].sort((a, b) => eligible.indexOf(a) - eligible.indexOf(b));
      runs.push(run(question, start, offers, vouchers, alone, code));
    }
  }
  // The most off wins; of two that give the same, the earlier run — the one with none, then the lower key.
  const won = runs.reduce((champion, one) => (one.total > champion.total ? one : champion), runs[0]!);
  return { won, runs, left: apart.slice(ALONE_MAX) };
}
