/**
 * THE CONTRACT'S OWN CHECKS, AND THE WORKED ORDERS, OVER THE BUILT FILE.
 *
 * `price-adjust@1` ships a conformance suite: an answer of the declared
 * shape, one reduction for every line and never more than the line, a line
 * left out untouched, an order total that is the lines' sum, the same answer
 * twice, and a dry run priced as the save is. It is run here over every
 * worked order, against the file an install would run, in the bare context a
 * save runs it in. What the suite does not compare — the uses, what a
 * customer is told, why an offer did not apply — is held below.
 */

import { priceAdjustConformance } from '@adminium/add-on-contracts/testing';
import { describe, expect, it } from 'vitest';

import { ADJUST_CASES } from './cases/adjust.cases.ts';
import { buildForReal } from './testing/build.ts';
import { builtProvider } from './testing/vm.ts';

// Built before the suite is registered.
buildForReal();
const provider = builtProvider();

priceAdjustConformance(provider, { cases: ADJUST_CASES.map(({ name, input, expect: wanted }) => ({ name, input, expect: wanted })) });

describe('what the shared suite does not compare', () => {
  it('names the thirty-one cases of the design, each at least once', () => {
    const numbers = new Set(ADJUST_CASES.map((one) => /^A(\d+) /.exec(one.name)?.[1]));
    for (let n = 1; n <= 31; n += 1) expect(numbers, `A${String(n)}`).toContain(String(n));
  });

  for (const one of ADJUST_CASES.filter((candidate) => candidate.also !== undefined)) {
    it(one.name, () => {
      const answer = provider.adjust(one.input);
      const also = one.also!;
      if (also.refused !== undefined) expect(answer.refused).toEqual(also.refused);
      if (also.uses !== undefined) expect(answer.uses).toEqual(also.uses);
      if (also.told !== undefined) expect(answer.told).toEqual(also.told);
      if (also.explain !== undefined) expect(Object.fromEntries((answer.explain ?? []).map(({ offer, ...rest }) => [offer, rest]))).toEqual(also.explain);
    });
  }

  it('says nothing to a customer when no code lost to a better offer', () => {
    for (const one of ADJUST_CASES.filter((candidate) => candidate.also?.told === undefined)) expect(provider.adjust(one.input).told, one.name).toBeUndefined();
  });

  it('never reports a use while a line is written, and never one for nothing', () => {
    for (const one of ADJUST_CASES) {
      const answer = provider.adjust(one.input);
      if (one.input.point !== 'post') expect(answer.uses, one.name).toEqual([]);
      for (const use of answer.uses) expect(Number(use.amount), one.name).toBeGreaterThan(0);
      for (const applied of answer.applied) expect(Number(applied.amount), one.name).toBeGreaterThan(0);
    }
  });

  it('names every reduction in eight languages or in the owner\'s own words', () => {
    const answer = provider.adjust(ADJUST_CASES.find((one) => one.name.startsWith('A16'))!.input);
    const [voucher, staff] = [answer.applied.find((one) => one.kind === 'voucher')!, answer.applied.find((one) => one.kind === 'staff')!];
    expect(voucher.name).toMatchObject({ 'en-US': 'Voucher · One croissant', 'de-DE': 'Gutschein · One croissant', 'zh-TW': '兌換券 · One croissant' });
    expect(Object.keys(voucher.name as object)).toHaveLength(8);
    expect(staff.name).toMatchObject({ 'en-US': 'Staff · Goodwill', 'fr-FR': 'Personnel · Goodwill' });
    expect(staff.reason).toBe('2');
  });
});
