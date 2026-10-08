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

import { cutUnits, fromUnits } from '../units.ts';
import { best } from './best.ts';
import { offersOf, typedOf } from './candidates.ts';
import { chooseCode, person, standing } from './conditions.ts';
import { explained } from './explain.ts';
import { firstRuns, wholeOf, type Line, type Miss, type Offer, type Question, type Refused, type Standing } from './standing.ts';
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

/** The most whole units one line is counted as: more than any basket holds, and far inside what a number keeps exactly. */
const UNITS_MAX = 1_000_000_000;

function linesOf(input: AdjustInput): Line[] {
  return input.lines.map((line, at) => {
    const quantity = wholeOf(line.quantity);
    return {
      key: line.key,
      at,
      goods: line.kept && !line.excluded && line.paidBy === null,
      amount: cutUnits(line.amount, input.scale),
      units: quantity !== null && quantity >= 1 && quantity <= UNITS_MAX ? quantity : 1,
      what: line.what,
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
    refused.push(...chooseCode(offer, input, question.earned));
    const miss = question.earned ? null : (standing(offer, input) ?? person(offer, input));
    if (miss === null) eligible.push(offer);
    else misses.set(offer.id, { reason: miss });
  }

  // Vouchers for a thing and packs first, on the lines as they came, unit by unit.
  const start: Standing = {
    left: question.lines.map((line) => (line.goods ? line.amount : 0n)),
    runs: question.lines.map((line) => {
      const nights = input.lines[line.at]!.nights;
      return line.goods ? firstRuns(line.amount, line.units, nights === undefined ? null : nights.map((night) => cutUnits(night.price, scale))) : [];
    }),
    taken: [],
  };
  refused.push(...things(question, start, typed.vouchers));

  const { won, runs, left, staff } = best(question, start, eligible, typed.vouchers);
  for (const offer of left) misses.set(offer.id, { reason: 'not-combinable' });
  if (staff !== null) refused.push(staff);

  // An offer of the winning run that did not apply says why. One that was left out of it either failed for a reason of
  // its own in the run that tried it, or simply lost — and a code that lost is told which offer beat it.
  const given = (offer: Offer | null): bigint => (offer === null ? 0n : won.standing.taken.reduce((total, taken) => (taken.source.offer === offer.id ? total + taken.total : total), 0n));
  const top = eligible.reduce<Offer | null>((champion, offer) => (given(offer) > given(champion) ? offer : champion), null);
  const told: NonNullable<AdjustOutput['told']> = [];
  for (const offer of eligible) {
    if (given(offer) > 0n || misses.has(offer.id)) continue;
    const own = runs.find((run) => run.alone === offer || run.code === offer);
    const miss = won.missed.get(offer.id) ?? own?.missed.get(offer.id) ?? null;
    if (miss !== null) {
      misses.set(offer.id, miss);
      continue;
    }
    misses.set(offer.id, { reason: 'not-combinable' });
    // What beat it. An offer that does not combine lost to the one that was taken alone; a code among the ones that
    // combine lost to the code that was let apply in its place (which may be the one taken alone). Where that took
    // nothing, whichever offer gave most.
    const alone = own?.alone === offer;
    const rival = [alone ? won.alone : won.code, alone || won.alone?.typed == null ? null : won.alone, top].find((one) => one != null && one !== offer && given(one) > 0n) ?? null;
    if (offer.typed !== null && rival !== null) told.push({ typed: offer.typed.typed, note: 'better-offer-applied', name: nameIn(rival.name, input.locale) });
  }
  for (const offer of offers) {
    const miss = misses.get(offer.id);
    if (offer.typed === null || miss === undefined || told.some((one) => one.typed === offer.typed!.typed)) continue;
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
    // A question carries twelve codes and one reduction by hand: an answer refuses no more than that.
    refused: refused.slice(0, 13),
  };
  if (told.length > 0) out.told = told.slice(0, 12);
  if (input.explain) out.explain = explained(offers, misses, taken, scale);
  return out;
}
