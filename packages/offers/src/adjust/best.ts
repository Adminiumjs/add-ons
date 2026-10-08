/**
 * WHICH OFFERS GO TOGETHER.
 *
 * Offers that combine all apply. One that does not combine applies alone
 * beside the ones that do — so with two of them the order is worked out once
 * for each and once with neither, and the run in which the OFFERS give the
 * customer most wins (the run with neither on a tie, then the lower key). One
 * discount code applies to an order: of several typed, the best. A code whose
 * offer lost is not refused; the customer is told that a better offer
 * applied, and it takes no use.
 *
 * Vouchers worth an amount or a percent, and what staff took off by hand, go
 * with everything. They are put on the winning run afterwards, so neither
 * ever decides which offer a customer gets.
 */

import type { AdjustInput } from '@adminium/add-on-contracts';

import { applyOffer, PASSES, touched } from './order.ts';
import { staffReduction } from './staff.ts';
import { textOf, yes, type Line, type Miss, type Offer, type Question, type Refused, type Standing, type TypedVoucher } from './standing.ts';
import { values } from './vouchers.ts';

/** The most offers that do not combine one question tries, each in a run of its own; and the most typed codes it tries against each other. */
export const ALONE_MAX = 12;

export interface Run {
  standing: Standing;
  /** The offer that does not combine, taken alone in this run; null for the run with none. */
  alone: Offer | null;
  /** The one typed code among the offers that combine that this run let apply. */
  code: Offer | null;
  /** Each offer of the run that did not apply, with why. */
  missed: Map<string, Miss>;
  /** What the run's offers took, beside what stood before them. */
  total: bigint;
}

const combines = (offer: Offer, input: AdjustInput): boolean => (offer.row['combinable'] === null || offer.row['combinable'] === undefined ? yes(input.settings['combine_default']) : yes(offer.row['combinable']));

/**
 * Every run the eligible offers allow, and the best of them — with the
 * vouchers worth an amount or a percent and what staff gave put on it.
 * `eligible`: the offers that stand for this buyer, in key order. `left`: an
 * offer that does not combine and was past the twelfth, with no run of its
 * own.
 */
export function best(question: Question, start: Standing, eligible: readonly Offer[], vouchers: readonly TypedVoucher[]): { won: Run; runs: Run[]; left: Offer[]; staff: Refused | null } {
  const input = question.input;
  // Read once: which lines each offer touches, and the turn each takes — by pass, then an offer over some lines before
  // one over the whole order (fifteen percent off the mugs, then ten percent of what the order has left), then by key.
  const lines = new Map<Offer, Line[]>(eligible.map((offer) => [offer, touched(question, offer)]));
  const turn = new Map<Offer, number>(
    eligible.map((offer, at) => {
      const pass = PASSES.indexOf(textOf(offer.row['gives']) ?? '');
      return [offer, ((pass === -1 ? PASSES.length : pass) * 2 + (textOf(offer.row['applies_to']) === 'lines' ? 0 : 1)) * eligible.length + at];
    }),
  );
  const run = (alone: Offer | null, code: Offer | null, offers: readonly Offer[]): Run => {
    const standing: Standing = { left: [...start.left], runs: start.runs.map((line) => line.map((unit) => ({ ...unit }))), taken: [...start.taken] };
    const before = standing.taken.length;
    const missed = new Map<string, Miss>();
    for (const offer of [...offers].sort((a, b) => turn.get(a)! - turn.get(b)!)) {
      const miss = applyOffer(question, standing, offer, lines.get(offer)!);
      if (miss !== null) missed.set(offer.id, miss);
    }
    return { standing, alone, code, missed, total: standing.taken.slice(before).reduce((total, taken) => total + taken.total, 0n) };
  };

  const together = eligible.filter((offer) => combines(offer, input));
  // Of the ones that do not combine, a code somebody typed is tried before one that came by itself.
  const apart = eligible.filter((offer) => !combines(offer, input)).sort((a, b) => Number(b.typed !== null) - Number(a.typed !== null));
  const typed = together.filter((offer) => offer.typed !== null);
  const beside = (code: Offer | null): Offer[] => together.filter((offer) => offer.typed === null || offer === code);
  const better = (champion: Run, one: Run): Run => (one.total > champion.total ? one : champion);

  // One code to an order. With none taken alone: each typed code in turn, and the best of them.
  const runs: Run[] = (typed.length <= 1 ? [typed[0] ?? null] : typed.slice(0, ALONE_MAX)).map((code) => run(null, code, beside(code)));
  const withNone = runs.reduce(better);
  // Each offer that does not combine, alone beside the ones that do — with that same code, unless it is a code itself.
  for (const alone of apart.slice(0, ALONE_MAX)) {
    const code = alone.typed !== null ? null : withNone.code;
    runs.push(run(alone, code, [...beside(code), alone]));
  }
  const won = runs.reduce(better);
  values(question, won.standing, vouchers);
  return { won, runs, left: apart.slice(ALONE_MAX), staff: staffReduction(question, won.standing) };
}
