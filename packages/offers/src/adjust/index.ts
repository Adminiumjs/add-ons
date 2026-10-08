/**
 * WHAT AN ORDER'S REDUCTIONS COME TO.
 *
 * One question, one answer, no memory. Adminium hands in the order's lines,
 * the codes typed on it (each already looked up), who is buying when that
 * was proved, what staff took off by hand, and every offer with its breaks
 * and targets. The answer is a reduction for every line, what was applied
 * line by line, what was refused and why — and, where the order is posted,
 * the uses to record.
 *
 * In order, each step on what the one before left: vouchers for a thing and
 * packs; a fixed price and a price by quantity; a bonus item; percents;
 * amounts; vouchers worth an amount or a percent; what staff took off.
 * Nothing goes below nothing: every reduction is held to what its line has
 * left.
 */

import type { AdjustApplied, AdjustInput, AdjustOutput, AdjustReason, AdjustUse, ExplainReason } from '@adminium/add-on-contracts';

import { fromUnits, toUnits } from '../units.ts';
import { best } from './best.ts';
import { offersOf, typedOf } from './candidates.ts';
import { person, standing } from './conditions.ts';
import { explained } from './explain.ts';
import { wholeOf, type Line, type Miss, type Offer, type Question, type Refused, type Standing } from './standing.ts';
import { nameIn } from './names.ts';
import { earned } from './refund.ts';
import { things } from './vouchers.ts';

/** What a typed code is refused for, where why its offer does not apply is something only staff's "why not" view says. */
const SAID: Readonly<Partial<Record<ExplainReason, AdjustReason>>> = {
  draft: 'inactive',
  paused: 'inactive',
  ended: 'expired',
  'outside-days': 'not-yet',
  'outside-hours': 'not-yet',
  'not-first-order': 'over-limit',
  'not-in-group': 'unknown',
  'needs-quantity': 'not-for-these-items',
  'not-combinable': 'unknown',
  'no-code-typed': 'unknown',
};
const REFUSALS: readonly string[] = ['unknown', 'used-up', 'needs-minimum', 'not-for-these-items', 'needs-sign-in', 'needs-customer', 'over-ceiling', 'expired', 'inactive', 'void', 'not-yet', 'over-limit'];

/** A miss as a refusal of the code that was typed for the offer. A reason only staff are given is told to nobody else. */
function refusal(typed: string, miss: Miss, input: AdjustInput): Refused {
  let reason = SAID[miss.reason] ?? (REFUSALS.includes(miss.reason) ? (miss.reason as AdjustReason) : 'unknown');
  if (reason === 'needs-customer' && input.origin !== 'staff') reason = 'unknown';
  if (reason === 'needs-sign-in' && !input.guest) reason = input.origin === 'staff' ? 'needs-customer' : 'unknown';
  return { typed, reason, ...(miss.params === undefined ? {} : { params: miss.params }) };
}

function linesOf(input: AdjustInput): Line[] {
  return input.lines.map((line, at) => {
    const quantity = wholeOf(line.quantity);
    return {
      key: line.key,
      at,
      goods: line.kept && !line.excluded && line.paidBy === null,
      amount: toUnits(line.amount, input.scale) ?? 0n,
      units: quantity !== null && quantity >= 1 ? quantity : 1,
      what: line.what,
      nights: line.nights === undefined ? null : line.nights.map((night) => toUnits(night.price, input.scale) ?? 0n),
    };
  });
}

export function adjust(input: AdjustInput): AdjustOutput {
  const scale = input.scale;
  const question: Question = { input, scale, lines: linesOf(input), earned: earned(input) };
  const offers = offersOf(input);
  const typed = typedOf(input, offers);
  const refused: Refused[] = [...typed.refused];

  // Which offers stand, and for this buyer. An offer that came by itself and is kept for somebody nobody proved says nothing.
  const misses = new Map<string, Miss>();
  const eligible: Offer[] = [];
  for (const offer of offers) {
    const miss = question.earned ? null : (standing(offer, input) ?? person(offer, input));
    if (miss === null) eligible.push(offer);
    else misses.set(offer.id, { reason: miss });
  }

  // Vouchers for a thing and packs first, on the lines as they came.
  const start: Standing = { left: question.lines.map((line) => (line.goods ? line.amount : 0n)), taken: [] };
  refused.push(...things(question, start, typed.vouchers));

  const { won, runs, left } = best(question, start, eligible, typed.vouchers);
  for (const offer of left) misses.set(offer.id, { reason: 'not-combinable' });
  if (won.staff !== null) refused.push(won.staff);

  // An offer of the winning run that did not apply says why; one that was left out of it lost to a better one.
  const applied = new Set(won.standing.taken.map((taken) => taken.source.offer).filter((id): id is string => id !== null));
  const winner = won.code ?? won.alone;
  const told: NonNullable<AdjustOutput['told']> = [];
  for (const offer of eligible) {
    if (applied.has(offer.id) || misses.has(offer.id)) continue;
    const here = won.missed.get(offer.id);
    // Not in the winning run: why it failed in a run of its own, if it did; else it simply lost.
    const own = runs.find((run) => run.alone === offer || run.code === offer);
    const miss = here ?? own?.missed.get(offer.id) ?? null;
    if (miss !== null) misses.set(offer.id, miss);
    else if (own !== undefined && own !== won) {
      misses.set(offer.id, { reason: 'not-combinable' });
      if (offer.typed !== null && winner !== null) told.push({ typed: offer.typed.typed, note: 'better-offer-applied', name: nameIn(winner.name, input.locale) });
    }
  }
  for (const offer of offers) {
    const miss = misses.get(offer.id);
    if (offer.typed === null || miss === undefined) continue;
    if (miss.reason === 'not-combinable' && told.some((one) => one.typed === offer.typed!.typed)) continue;
    refused.push(refusal(offer.typed.typed, miss, input));
  }

  const taken = won.standing.taken;
  const off = question.lines.map((line) => (line.goods ? line.amount - won.standing.left[line.at]! : 0n));
  const out: AdjustOutput = {
    lines: question.lines.map((line) => ({ key: line.key, discount: fromUnits(off[line.at]!, scale) })),
    order: { discount: fromUnits(off.reduce((total, one) => total + one, 0n), scale) },
    applied: taken.flatMap((one) =>
      [...one.shares].map(
        ([at, share]): AdjustApplied => ({
          line: question.lines[at]!.key,
          offer: one.source.offer,
          code: one.source.code,
          voucher: one.source.voucher,
          name: one.source.name,
          kind: one.source.kind,
          amount: fromUnits(share, scale),
          typed: one.source.typed,
          ...(one.source.reason === undefined ? {} : { reason: one.source.reason }),
        }),
      ),
    ),
    // What was used is said once, where the order is posted.
    uses:
      input.point !== 'post'
        ? []
        : taken.map(
            (one): AdjustUse => ({
              offer: one.source.offer,
              code: one.source.code,
              voucher: one.source.voucher,
              amount: fromUnits(one.total, scale),
              ...(one.units === undefined ? {} : { units: one.units }),
              ...(input.customer === null ? {} : { customer: input.customer.key }),
            }),
          ),
    refused,
  };
  if (told.length > 0) out.told = told;
  if (input.explain) out.explain = explained(offers, misses, taken, scale);
  return out;
}
