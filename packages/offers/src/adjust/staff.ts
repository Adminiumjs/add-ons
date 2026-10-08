/**
 * WHAT STAFF TOOK OFF BY HAND.
 *
 * After every offer and voucher: a percent of the goods that are left, or an
 * amount, shared over the lines. Adminium read the giver's limit and hands it
 * in. Where it also asks for the limit to be judged, a reduction over it is
 * not applied in part: nothing is taken, and the answer says the most the
 * giver may give. A reduction stored earlier, by somebody who could give it,
 * is applied as it is.
 */

import { fromUnits, least, percentOf, sum, toUnits } from '../units.ts';
import { goodsLeft, keyOf, take, textOf, type Question, type Refused, type Row, type Standing } from './standing.ts';
import { staffName } from './names.ts';
import { split } from './split.ts';

/** Three decimals: what a percent is compared at. */
const PERCENT = 3;

export function staffReduction(question: Question, standing: Standing): Refused | null {
  const staff = question.input.staff;
  if (staff === null) return null;
  const scale = question.scale;
  const goods = goodsLeft(question, standing);
  // A comp arrives as one hundred percent, already allowed by Adminium.
  const percent = staff.kind !== 'amount';
  const value = staff.kind === 'comp' ? '100' : staff.value;
  const asked = percent ? percentOf(goods, value) : least(toUnits(value, scale) ?? 0n, goods);
  if (staff.judge && staff.ceiling !== null) {
    const limit = staff.ceiling;
    const amountMost = toUnits(limit.amount, scale);
    if (percent && (toUnits(value, PERCENT) ?? 0n) > (toUnits(limit.percent, PERCENT) ?? 0n)) return { typed: '', reason: 'over-ceiling', params: { max: String(limit.percent) } };
    // An amount is held to the giver's limit in money, or — with none — to what their percent comes to of the goods as
    // they came (the base Adminium itself judges by: every line kept and not left out, before any reduction).
    const came = question.lines.reduce((total, line, at) => (question.input.lines[at]!.kept && !question.input.lines[at]!.excluded ? total + line.amount : total), 0n);
    const most = amountMost ?? percentOf(came, limit.percent);
    const typedAmount = percent ? asked : (toUnits(value, scale) ?? 0n);
    if ((percent && amountMost !== null && asked > amountMost) || (!percent && typedAmount > most)) return { typed: '', reason: 'over-ceiling', params: { max: fromUnits(most, scale) } };
  }
  const lines = question.lines.filter((line) => line.goods);
  const left = lines.map((line) => standing.left[line.at]!);
  const shares = split(least(asked, sum(left)), left);
  const label = ((question.input.offers['reasons'] ?? []) as Row[]).find((row) => staff.reason !== null && keyOf(row['id']) === staff.reason)?.['label'];
  take(standing, { kind: 'staff', offer: null, code: null, voucher: null, typed: false, name: staffName(textOf(label) ?? ''), ...(staff.reason === null ? {} : { reason: staff.reason }) }, new Map(lines.map((line, at) => [line.at, shares[at]!])));
  return null;
}
