/**
 * THE STEPS, ONE AT A TIME.
 *
 * The worked orders hold the whole answer to the cent. These hold each rule
 * by itself, on the smallest basket that shows it: a kind of offer, a
 * condition, a limit, the order of the steps, which of two offers wins.
 */

import type { AdjustInput, AdjustOutput } from '@adminium/add-on-contracts';
import { describe, expect, it } from 'vitest';

import { ask, CLASSES, code, CODES, LEAFLET, line, NEW_CUSTOMER, OFFERS, ONE_CANDLE, other, typedVoucher, voucher, type Asked } from '../cases/adjust.cases.ts';
import { adjust } from './index.ts';
import { take, type Standing } from './standing.ts';

type Row = Record<string, string | number | boolean | null>;
const base = OFFERS[5]!;
/** An offer that runs with no condition, unless a test gives it one. */
const offer = (id: number, more: Row): Row => ({ ...base, id, name: `Offer ${String(id)}`, public_name: `Offer ${String(id)}`, status: 'active', starts_on: null, ends_on: null, gives: 'percent', value: '10', ...more });
const codeFor = (id: number, typed: string, more: Row = {}): Row => ({ id, offer_id: id, code: typed, max_uses: null, valid_until: null, active: true, uses: 0, ...more });
const tagged = (id: number, offerId: number, tag: string): Row => ({ id, offer_id: offerId, kind: 'tag', source_table: '', source_row: tag, label: tag });
const answer = (asked: Asked, more: Partial<AdjustInput> = {}): AdjustOutput => adjust({ ...ask({ targets: [], ...asked }), ...more });
const off = (out: AdjustOutput): string => out.order.discount;
const byLine = (out: AdjustOutput): string[] => out.lines.map((one) => one.discount);
const why = (out: AdjustOutput): Record<string, string> => Object.fromEntries((out.explain ?? []).map((one) => [one.offer, one.applies ? `applies ${one.amount ?? ''}` : (one.reason ?? 'nothing to take')]));
const MUGS = () => [line('1', 'MUG-SPK', 2), line('2', 'MUG-WHT', 1)];

describe('a kind of offer', () => {
  it('a percent over the order is rounded once and shared; over some lines, by the line', () => {
    // Three pens at $2.00 and a card at $3.50: 15 % of $9.50 is $1.425 → $1.43 once; by the line 0.90 + 0.53 = 1.43 too, but placed otherwise.
    const lines = [line('1', 'PEN-BLK', 3), line('2', 'CARD-GRT')];
    expect(byLine(answer({ lines, offers: [offer(1, { value: '15' })] }))).toEqual(['0.90', '0.53']);
    // 33 % of 3 × $2.00 and of $3.50 by the line: 1.98 and 1.155 → 1.16; over the order 33 % of 9.50 = 3.135 → 3.14.
    expect(off(answer({ lines, offers: [offer(1, { value: '33' })] }))).toBe('3.14');
    // Two lines of $1.05 at half off: over the order $1.05 once, shared 0.53 and 0.52; by the line 0.53 each.
    const twins = [other('1', 'Sticker A', '1.05'), other('2', 'Sticker B', '1.05')].map((one) => ({ ...one, what: [{ as: 'tag' as const, table: '', row: 'x' }] }));
    expect(byLine(answer({ lines: twins, offers: [offer(1, { value: '50' })] }))).toEqual(['0.53', '0.52']);
    expect(byLine(answer({ lines: twins, offers: [offer(1, { value: '50', applies_to: 'lines' })], targets: [tagged(1, 1, 'x')] }))).toEqual(['0.53', '0.53']);
    const some = [{ ...lines[0]!, what: [{ as: 'tag' as const, table: '', row: 'x' }] }, { ...lines[1]!, what: [{ as: 'tag' as const, table: '', row: 'x' }] }];
    expect(byLine(answer({ lines: some, offers: [offer(1, { value: '33', applies_to: 'lines' })], targets: [tagged(1, 1, 'x')] }))).toEqual(['1.98', '1.16']);
  });

  it('an amount stops at what the lines it touches have left', () => {
    expect(off(answer({ lines: MUGS(), offers: [offer(1, { gives: 'amount', value: '100.00' })] }))).toBe('40.00');
    expect(byLine(answer({ lines: MUGS(), offers: [offer(1, { gives: 'amount', value: '4.00' })] }))).toEqual(['2.80', '1.20']);
    // Over the mugs only: the tote keeps its price.
    const mixed = [line('1', 'MUG-SPK', 2), line('2', 'TOTE-NAT')];
    expect(byLine(answer({ lines: mixed, offers: [offer(1, { gives: 'amount', value: '50.00', applies_to: 'lines' })], targets: [tagged(1, 1, 'mugs')] }))).toEqual(['28.00', '0.00']);
  });

  it('a fixed price brings every unit down to it, and leaves a cheaper one alone', () => {
    // Speckled mugs at $14.00 and a white one at $12.00, each for $12.50: 1.50 twice, and nothing.
    expect(byLine(answer({ lines: MUGS(), offers: [offer(1, { gives: 'fixed_price', value: '12.50' })] }))).toEqual(['3.00', '0.00']);
    // A stay of a $100.00 night and a $300.00 one, each night for $200.00: the dear night comes down, the cheap one is not put up.
    const stay = { ...other('1', 'Stay', '400.00'), nights: [{ date: '2026-11-02', price: '100.00' }, { date: '2026-11-03', price: '300.00' }] };
    expect(off(answer({ lines: [stay], offers: [offer(1, { gives: 'fixed_price', value: '200.00' })] }))).toBe('100.00');
  });

  it('a price by quantity gives the percent of the highest break reached, by the line', () => {
    const breaks: Row[] = [
      { id: 1, offer_id: 1, from_qty: 3, value: '10' },
      { id: 2, offer_id: 1, from_qty: 6, value: '20' },
    ];
    const tiered = offer(1, { gives: 'quantity_price', value: null });
    expect(byLine(answer({ lines: MUGS(), offers: [tiered], breaks }))).toEqual(['2.80', '1.20']);
    expect(byLine(answer({ lines: [line('1', 'MUG-SPK', 6)], offers: [tiered], breaks }))).toEqual(['16.80']);
    // Two mugs reach no break.
    const short = answer({ lines: [line('1', 'MUG-SPK', 2)], offers: [tiered], breaks }, { explain: true });
    expect(off(short)).toBe('0.00');
    expect(why(short)).toEqual({ '1': 'needs-quantity' });
  });

  it('a bonus item gives the cheapest of every full group, each from its own line', () => {
    const pair = offer(1, { gives: 'bonus_item', value: null, buy_qty: 2, bonus_qty: 1 });
    // A black tote ($16.00) and a natural one ($15.00): the natural one.
    expect(byLine(answer({ lines: [line('1', 'TOTE-BLK'), line('2', 'TOTE-NAT')], offers: [pair] }))).toEqual(['0.00', '15.00']);
    // Three: one pair, and one left over that earns nothing.
    expect(byLine(answer({ lines: [line('1', 'TOTE-BLK', 2), line('2', 'TOTE-NAT')], offers: [pair] }))).toEqual(['16.00', '0.00']);
    // Four of a kind and "buy three, one on us": one of the four.
    expect(off(answer({ lines: [line('1', 'TOTE-NAT', 4)], offers: [offer(1, { gives: 'bonus_item', value: null, buy_qty: 3, bonus_qty: 1 })] }))).toBe('15.00');
    // Five at "buy three, two on us": one full group gives its two cheapest; the two left over are no group.
    expect(off(answer({ lines: [line('1', 'TOTE-NAT', 5)], offers: [offer(1, { gives: 'bonus_item', value: null, buy_qty: 3, bonus_qty: 2 })] }))).toBe('30.00');
    // Three different things at "buy three, two on us": the two cheaper ones, each from its own line.
    const three = [other('1', 'Lamp', '20.00'), other('2', 'Vase', '10.00'), other('3', 'Card', '5.00')];
    expect(byLine(answer({ lines: three, offers: [offer(1, { gives: 'bonus_item', value: null, buy_qty: 3, bonus_qty: 2 })] }))).toEqual(['0.00', '10.00', '5.00']);
    // One alone is no pair.
    const one = answer({ lines: [line('1', 'TOTE-NAT')], offers: [pair] }, { explain: true });
    expect(why(one)).toEqual({ '1': 'needs-quantity' });
  });

  it('touches only the lines that sell what a target names, and none at all is said so', () => {
    const lines = [line('1', 'MUG-SPK'), line('2', 'TOTE-NAT'), line('3', 'CNDL-FIG')];
    const byItem: Row = { id: 1, offer_id: 1, kind: 'item', source_table: 'shop:items', source_row: 'CNDL-FIG', label: 'Candle, fig' };
    expect(byLine(answer({ lines, offers: [offer(1, { applies_to: 'lines', value: '50' })], targets: [byItem, tagged(2, 1, 'bags')] }))).toEqual(['0.00', '7.50', '9.00']);
    // The same key in another table is another thing.
    const elsewhere = answer({ lines, offers: [offer(1, { applies_to: 'lines' })], targets: [{ ...byItem, source_table: 'other:items' }] }, { explain: true });
    expect(why(elsewhere)).toEqual({ '1': 'not-for-these-items' });
    // A code for candles typed on a basket with none is refused by name.
    const typed = answer({ lines: [line('1', 'MUG-SPK')], codes: [code('CANDLES', codeFor(1, 'CANDLES'))], offers: [offer(1, { applies_to: 'lines', trigger: 'code' })], targets: [byItem] });
    expect(typed.refused).toEqual([{ typed: 'CANDLES', reason: 'not-for-these-items' }]);
  });
});

describe('the order of the steps', () => {
  it('a fixed price, a price by quantity, a bonus item, percents, then amounts — each on what is left', () => {
    const lines = [line('1', 'TS-BLU-M', 2)];
    const offers = [offer(1, { gives: 'amount', value: '5.00' }), offer(2, { gives: 'percent', value: '10' }), offer(3, { gives: 'fixed_price', value: '20.00' })];
    const out = answer({ lines, offers }, { point: 'post' });
    // $48.00 → two at $20.00 (−8.00) → ten percent of $40.00 (−4.00) → −5.00.
    expect(out.uses.map((use) => `${String(use.offer)} ${use.amount}`)).toEqual(['3 8.00', '2 4.00', '1 5.00']);
    expect(off(out)).toBe('17.00');
  });

  it('within a step, an offer over some lines before one over the order, then the lower key', () => {
    const lines = [line('1', 'MUG-SPK', 2), line('2', 'CARD-GRT')];
    const offers = [offer(1, { value: '10' }), offer(2, { value: '15', applies_to: 'lines' }), offer(3, { value: '10' })];
    const out = answer({ lines, offers, targets: [tagged(1, 2, 'mugs')] }, { point: 'post' });
    // Fifteen percent of the mugs ($4.20), then ten percent of $27.30 ($2.73), then ten percent of $24.57 ($2.46).
    expect(out.uses.map((use) => `${String(use.offer)} ${use.amount}`)).toEqual(['2 4.20', '1 2.73', '3 2.46']);
  });

  it('a voucher for a thing first, a voucher worth an amount after the offers, staff last', () => {
    const lines = [line('1', 'CNDL-FIG', 2)];
    const out = answer(
      { lines, codes: [typedVoucher('VC-FIVE', LEAFLET(7)), typedVoucher('VC-CANDLE', ONE_CANDLE)], offers: [offer(1, { value: '50' })], staff: { kind: 'amount', value: '1.00', reason: null, ceiling: null, judge: false } },
      { point: 'post' },
    );
    // $36.00 → one candle (−18.00) → half of $18.00 (−9.00) → five dollars of $9.00 → one by hand of $4.00.
    expect(out.uses.map((use) => `${use.voucher ?? use.offer ?? 'staff'} ${use.amount}`)).toEqual(['1 18.00', '1 9.00', '7 5.00', 'staff 1.00']);
    expect(off(out)).toBe('33.00');
  });

  it('a voucher worth a percent takes it of what the goods have left', () => {
    const tenth = voucher(9, 'Ten percent', { worth: 'percent', value: '10' });
    expect(off(answer({ lines: MUGS(), codes: [typedVoucher('VC-TEN', tenth)], offers: [offer(1, { gives: 'amount', value: '10.00' })] }))).toBe('13.00');
  });
});

describe('whether an offer stands', () => {
  const one = (more: Row, when: Partial<AdjustInput> = {}) => why(answer({ lines: MUGS(), offers: [offer(1, more)] }, { explain: true, ...when }));
  const applies = 'applies 4.00';

  it('by its state', () => {
    expect(one({})).toEqual({ '1': applies });
    for (const status of ['draft', 'paused', 'ended']) expect(one({ status })).toEqual({ '1': status });
  });

  it('by its days, both the first and the last counted in', () => {
    expect(one({ starts_on: '2026-10-01', ends_on: '2026-10-01' })).toEqual({ '1': applies });
    expect(one({ starts_on: '2026-10-02' })).toEqual({ '1': 'not-yet' });
    expect(one({ ends_on: '2026-09-30' })).toEqual({ '1': 'ended' });
  });

  it('by the day of the week and the hour, the last minute left out', () => {
    // The sample day is a Thursday (4), at ten.
    expect(one({ weekdays: '4' })).toEqual({ '1': applies });
    expect(one({ weekdays: '1, 4,6' })).toEqual({ '1': applies });
    expect(one({ weekdays: '0,1,2,3,5,6' })).toEqual({ '1': 'outside-days' });
    expect(one({ from_time: '10:00', to_time: '11:00' })).toEqual({ '1': applies });
    expect(one({ from_time: '09:00', to_time: '10:00' })).toEqual({ '1': 'outside-hours' });
    expect(one({ from_time: '10:01' })).toEqual({ '1': 'outside-hours' });
    expect(one({ to_time: '10:01' })).toEqual({ '1': applies });
    // Hours that end before they begin hold at no time of day.
    for (const time of ['23:00', '01:00', '12:00']) expect(one({ from_time: '22:00', to_time: '02:00' }, { time }), time).toEqual({ '1': 'outside-hours' });
  });

  it('by how it comes: by itself, by a code, or by itself at a staffed door only', () => {
    expect(one({ trigger: 'code' })).toEqual({ '1': 'no-code-typed' });
    expect(one({ trigger: 'staff' })).toEqual({ '1': applies });
    expect(one({ trigger: 'staff' }, { origin: 'public', guest: true })).toEqual({ '1': 'no-code-typed' });
  });

  it('by its uses, the order\'s own held one not counted', () => {
    expect(one({ max_uses: 3, uses: 2 })).toEqual({ '1': applies });
    expect(one({ max_uses: 3, uses: 3 })).toEqual({ '1': 'used-up' });
    expect(one({ max_uses: 3, uses: 3 }, { held: { redemptions: [{ id: 1, offer_id: 1, code_id: null, voucher_id: null, amount: '4.00', uses: 1 }] } })).toEqual({ '1': applies });
    expect(one({ max_uses: 3, uses: 3 }, { held: { redemptions: [{ id: 1, offer_id: 2, code_id: null, voucher_id: null, amount: '4.00', uses: 1 }] } })).toEqual({ '1': 'used-up' });
  });

  it('by its minimum, on the goods and on how many', () => {
    expect(one({ min_spend: '40.00' })).toEqual({ '1': applies });
    expect(one({ min_spend: '40.01' })).toEqual({ '1': 'needs-minimum' });
    expect(one({ min_qty: 3 })).toEqual({ '1': applies });
    expect(one({ min_qty: 4 })).toEqual({ '1': 'needs-quantity' });
    // A card being loaded is no piece of the goods: three mugs and a load are three.
    const loaded = (pieces: number) => why(answer({ lines: [...MUGS(), other('9', 'Gift card', '50.00', 1, { excluded: true })], offers: [offer(1, { min_qty: pieces })] }, { explain: true }));
    expect(loaded(3)).toEqual({ '1': applies });
    expect(loaded(4)).toEqual({ '1': 'needs-quantity' });
  });

  it('by its budget: one that cannot cover the whole reduction covers none of it', () => {
    expect(one({ budget_open: false, budget: '100.00', budget_left: '4.00' })).toEqual({ '1': applies });
    expect(one({ budget_open: false, budget: '100.00', budget_left: '3.99' })).toEqual({ '1': 'used-up' });
    // An offer with no budget has no limit, whatever its other columns hold.
    expect(one({ budget_open: true, budget: null, budget_left: null })).toEqual({ '1': applies });
    // What the order's own held use took is the order's.
    expect(one({ budget_open: false, budget: '100.00', budget_left: '0.00' }, { held: { redemptions: [{ id: 1, offer_id: 1, code_id: null, voucher_id: null, amount: '4.00', uses: 1 }] } })).toEqual({ '1': applies });
    // A new offer whose balance was never worked out has its whole budget.
    expect(one({ budget_open: false, budget: '4.00', budget_left: null })).toEqual({ '1': applies });
  });
});

describe('for whom', () => {
  const kept = (more: Row, customer: AdjustInput['customer'], input: Partial<AdjustInput> = {}) =>
    answer({ lines: MUGS(), codes: [code('CLUB', codeFor(1, 'CLUB'))], offers: [offer(1, { trigger: 'code', ...more })], customer }, input);

  it('a group\'s offer is its members\'', () => {
    expect(off(kept({ group_id: 7 }, { ...NEW_CUSTOMER, groups: ['7'] }))).toBe('4.00');
    // Not in the group: told as a code that is not theirs, never that the group exists.
    expect(kept({ group_id: 7 }, { ...NEW_CUSTOMER, groups: ['8'] }).refused).toEqual([{ typed: 'CLUB', reason: 'unknown' }]);
    expect(why(kept({ group_id: 7 }, { ...NEW_CUSTOMER, groups: ['8'] }, { explain: true }))).toEqual({ '1': 'not-in-group' });
  });

  it('a first-order offer is for somebody who never ordered', () => {
    expect(off(kept({ first_order_only: true }, NEW_CUSTOMER))).toBe('4.00');
    expect(kept({ first_order_only: true }, { ...NEW_CUSTOMER, orders: 1 }).refused).toEqual([{ typed: 'CLUB', reason: 'over-limit' }]);
  });

  it('so many times a customer, and no more', () => {
    expect(off(kept({ max_per_customer: 2 }, { ...NEW_CUSTOMER, uses: { '1': 1 } }))).toBe('4.00');
    expect(kept({ max_per_customer: 2 }, { ...NEW_CUSTOMER, uses: { '1': 2 } }).refused).toEqual([{ typed: 'CLUB', reason: 'over-limit' }]);
  });

  it('with nobody proved: a guest is told to sign in, staff to name a customer, and an offer that came by itself says nothing', () => {
    expect(kept({ max_per_customer: 1 }, null, { origin: 'public', guest: true }).refused).toEqual([{ typed: 'CLUB', reason: 'needs-sign-in' }]);
    expect(kept({ max_per_customer: 1 }, null).refused).toEqual([{ typed: 'CLUB', reason: 'needs-customer' }]);
    // A public door that names nobody and says no guest either is told no more than a guest would be.
    expect(kept({ max_per_customer: 1 }, null, { origin: 'public', guest: false }).refused).toEqual([{ typed: 'CLUB', reason: 'unknown' }]);
    const silent = answer({ lines: MUGS(), offers: [offer(1, { first_order_only: true })] }, { origin: 'public', guest: true });
    expect(silent).toMatchObject({ order: { discount: '0.00' }, refused: [] });
  });

  it('a code past its own last day is expired, whatever its offer says', () => {
    const out = answer({ lines: MUGS(), codes: [code('OLD', codeFor(1, 'OLD', { valid_until: '2026-09-30' }))], offers: [offer(1, { trigger: 'code' })] });
    expect(out).toMatchObject({ order: { discount: '0.00' }, refused: [{ typed: 'OLD', reason: 'expired' }] });
    expect(off(answer({ lines: MUGS(), codes: [code('NEW', codeFor(1, 'NEW', { valid_until: '2026-10-01' }))], offers: [offer(1, { trigger: 'code' })] }))).toBe('4.00');
  });

  it('a code with uses of its own runs out by itself', () => {
    const typed = (uses: number) => answer({ lines: MUGS(), codes: [code('FEW', codeFor(1, 'FEW', { max_uses: 5, uses }))], offers: [offer(1, { trigger: 'code' })] });
    expect(off(typed(4))).toBe('4.00');
    expect(typed(5).refused).toEqual([{ typed: 'FEW', reason: 'used-up' }]);
  });

  it('a typed code whose offer is switched off, over, or not on yet says so in words a counter is given', () => {
    const typed = (more: Row) => answer({ lines: MUGS(), codes: [code('X', codeFor(1, 'X'))], offers: [offer(1, { trigger: 'code', ...more })] }).refused.map((one) => one.reason);
    expect(typed({ status: 'paused' })).toEqual(['inactive']);
    expect(typed({ status: 'draft' })).toEqual(['inactive']);
    expect(typed({ status: 'ended' })).toEqual(['expired']);
    expect(typed({ ends_on: '2026-09-01' })).toEqual(['expired']);
    expect(typed({ starts_on: '2026-12-01' })).toEqual(['not-yet']);
    expect(typed({ weekdays: '1' })).toEqual(['not-yet']);
    expect(typed({ min_spend: '99.00' })).toEqual(['needs-minimum']);
  });

  it('two codes of one offer typed: the first is the one that was used', () => {
    const out = answer({ lines: MUGS(), codes: [code('FIRST', codeFor(1, 'FIRST')), code('SECOND', { ...codeFor(1, 'SECOND'), id: 2 })], offers: [offer(1, { trigger: 'code' })] }, { point: 'post' });
    expect(out.uses).toEqual([{ offer: '1', code: '1', voucher: null, amount: '4.00' }]);
    expect(out.refused).toEqual([]);
  });

  it('a code whose offer is not among the ones handed in is not known', () => {
    expect(answer({ lines: MUGS(), codes: [code('LOST', codeFor(99, 'LOST'))], offers: [offer(1, {})] }).refused).toEqual([{ typed: 'LOST', reason: 'unknown' }]);
  });
});

describe('vouchers and packs', () => {
  const typed = (row: Row, input: Partial<AdjustInput> = {}, customer: AdjustInput['customer'] = null) => answer({ lines: [line('1', 'CNDL-FIG', 2)], codes: [typedVoucher('VC-X', row)], offers: [], customer }, input);

  it('a voucher that is cancelled, past its day, not yet sold, or somebody else\'s', () => {
    const reasons = (row: Row, input: Partial<AdjustInput> = {}, customer: AdjustInput['customer'] = null) => typed(row, input, customer).refused.map((one) => one.reason);
    expect(reasons({ ...ONE_CANDLE, status: 'voided' })).toEqual(['void']);
    expect(reasons({ ...ONE_CANDLE, status: 'expired' })).toEqual(['expired']);
    expect(reasons({ ...ONE_CANDLE, expires_on: '2026-09-30' })).toEqual(['expired']);
    expect(reasons({ ...ONE_CANDLE, expires_on: '2026-10-01' })).toEqual([]);
    expect(reasons({ ...ONE_CANDLE, awaiting_sale: true })).toEqual(['inactive']);
    expect(reasons({ ...ONE_CANDLE, uses_left: 0 })).toEqual(['used-up']);
    // A named voucher: staff are told it is somebody's; a guest is told nothing but that it is not valid.
    expect(reasons({ ...ONE_CANDLE, holder_key: 'k-ada' })).toEqual(['needs-customer']);
    expect(reasons({ ...ONE_CANDLE, holder_key: 'k-ada' }, { origin: 'public', guest: true })).toEqual(['unknown']);
    expect(reasons({ ...ONE_CANDLE, holder_key: 'k-ada' }, {}, { ...NEW_CUSTOMER, key: 'k-ben' })).toEqual(['needs-customer']);
    expect(reasons({ ...ONE_CANDLE, holder_key: 'k-ada' }, {}, NEW_CUSTOMER)).toEqual([]);
  });

  it('a voucher for a thing covers as many units as it says, the dearest first', () => {
    expect(off(typed({ ...ONE_CANDLE, units: 2 }))).toBe('36.00');
    expect(off(typed({ ...ONE_CANDLE, units: 5 }))).toBe('36.00');
    // Nothing it names in the basket.
    expect(answer({ lines: [line('1', 'MUG-SPK')], codes: [typedVoucher('VC-X', ONE_CANDLE)], offers: [] }).refused).toEqual([{ typed: 'VC-X', reason: 'not-for-these-items' }]);
  });

  it('a pack covers every unit the line asks for, as far as it has uses left', () => {
    const classes = (quantity: number, row: Row, input: Partial<AdjustInput> = {}) => answer({ lines: [other('1', 'Class', '15.00', quantity)], codes: [typedVoucher('PK-X', row)], offers: [] }, { point: 'post', ...input });
    expect(classes(3, CLASSES).uses).toEqual([{ offer: null, code: null, voucher: '5', amount: '45.00', units: 3 }]);
    // Two left, three asked: two covered, the third is paid for.
    expect(classes(3, { ...CLASSES, uses_left: 2 }).uses).toEqual([{ offer: null, code: null, voucher: '5', amount: '30.00', units: 2 }]);
    // The order's own held units are its own.
    const held = { held: { redemptions: [{ id: 1, offer_id: null, code_id: null, voucher_id: 5, amount: '0.00', uses: 2 }] } };
    expect(classes(2, { ...CLASSES, uses_left: 0 }, held).uses).toEqual([{ offer: null, code: null, voucher: '5', amount: '30.00', units: 2 }]);
    expect(classes(2, { ...CLASSES, uses_left: 0 }).refused).toEqual([{ typed: 'PK-X', reason: 'used-up' }]);
  });

  it('a pack counts only the units it paid for: one a voucher already covered is no use of it', () => {
    const one = voucher(8, 'One class', { worth: 'thing', what: 'item', source_table: 'shop:items', source_row: 'Class' });
    const out = answer({ lines: [other('1', 'Class', '15.00', 2)], codes: [typedVoucher('VC-ONE', one), typedVoucher('PK-X', CLASSES)], offers: [] }, { point: 'post' });
    expect(out.uses).toEqual([
      { offer: null, code: null, voucher: '8', amount: '15.00' },
      { offer: null, code: null, voucher: '5', amount: '15.00', units: 1 },
    ]);
  });

  it('a sold voucher is named as what paid, and the same voucher typed twice is one', () => {
    const sold = answer({ lines: [line('1', 'CNDL-FIG')], codes: [typedVoucher('VC-A', { ...ONE_CANDLE, sold: true }), typedVoucher('vc a', { ...ONE_CANDLE, sold: true })], offers: [] });
    expect(sold.applied).toHaveLength(1);
    // Typed twice on a line of two candles, it is still one voucher for one candle.
    const twice = answer({ lines: [line('1', 'CNDL-FIG', 2)], codes: [typedVoucher('VC-A', ONE_CANDLE), typedVoucher('vc a', ONE_CANDLE)], offers: [] });
    expect(off(twice)).toBe('18.00');
    expect(sold.applied[0]!.name).toMatchObject({ 'en-US': 'Paid by voucher · One candle' });
  });

  it('what a voucher or a pack is, its row says: never the word typed in front', () => {
    expect(answer({ lines: [other('1', 'Class', '15.00')], codes: [typedVoucher('VC-LOOKS-LIKE-A-VOUCHER', CLASSES)], offers: [] }).applied[0]!.kind).toBe('pack');
  });
});

describe('by hand', () => {
  const given = (staff: NonNullable<AdjustInput['staff']>) => answer({ lines: MUGS(), offers: [], staff });
  const limit = (percent: string, amount: string | null) => ({ percent, amount });

  it('a percent within the giver\'s limit, and one over it', () => {
    expect(off(given({ kind: 'percent', value: '10', reason: null, ceiling: limit('10', null), judge: true }))).toBe('4.00');
    expect(given({ kind: 'percent', value: '10.5', reason: null, ceiling: limit('10', null), judge: true }).refused).toEqual([{ typed: '', reason: 'over-ceiling', params: { max: '10' } }]);
  });

  it('a percent that comes to more than the giver\'s limit in money', () => {
    expect(off(given({ kind: 'percent', value: '10', reason: null, ceiling: limit('50', '4.00'), judge: true }))).toBe('4.00');
    expect(given({ kind: 'percent', value: '10', reason: null, ceiling: limit('50', '3.99'), judge: true }).refused).toEqual([{ typed: '', reason: 'over-ceiling', params: { max: '3.99' } }]);
  });

  it('an amount is held to the limit in money, or — with none — to what the giver\'s percent comes to', () => {
    expect(off(given({ kind: 'amount', value: '5.00', reason: null, ceiling: limit('10', '5.00'), judge: true }))).toBe('5.00');
    expect(given({ kind: 'amount', value: '5.01', reason: null, ceiling: limit('10', '5.00'), judge: true }).refused).toEqual([{ typed: '', reason: 'over-ceiling', params: { max: '5.00' } }]);
    // Ten percent of $40.00 is $4.00.
    expect(off(given({ kind: 'amount', value: '4.00', reason: null, ceiling: limit('10', null), judge: true }))).toBe('4.00');
    expect(given({ kind: 'amount', value: '4.01', reason: null, ceiling: limit('10', null), judge: true }).refused).toEqual([{ typed: '', reason: 'over-ceiling', params: { max: '4.00' } }]);
    // An amount larger than the goods is still judged as typed: sixty dollars is not within a limit of five.
    expect(given({ kind: 'amount', value: '60.00', reason: null, ceiling: limit('100', '5.00'), judge: true }).refused).toHaveLength(1);
    // …even where the goods are worth less than the limit: what is stored is sixty, and the order may grow.
    const small = answer({ lines: [line('1', 'PEN-BLK', 2)], offers: [], staff: { kind: 'amount', value: '60.00', reason: null, ceiling: limit('100', '5.00'), judge: true } });
    expect(small).toMatchObject({ order: { discount: '0.00' }, refused: [{ typed: '', reason: 'over-ceiling', params: { max: '5.00' } }] });
  });

  it('is judged on the goods as the offers left them, and named by its reason', () => {
    const out = answer({ lines: MUGS(), offers: [offer(1, { value: '50' })], staff: { kind: 'percent', value: '10', reason: '1', ceiling: limit('10', '2.00'), judge: true } });
    // Half off first: ten percent of $20.00 is $2.00, within two dollars.
    expect(off(out)).toBe('22.00');
    expect(out.applied.filter((one) => one.kind === 'staff')[0]!.name).toMatchObject({ 'en-US': 'Staff · Damaged' });
    const bare = given({ kind: 'percent', value: '10', reason: null, ceiling: null, judge: false });
    expect(bare.applied[0]!.name).toMatchObject({ 'en-US': 'Staff' });
    expect(bare.applied[0]).not.toHaveProperty('reason');
  });
});

describe('which offers go together', () => {
  const lines = () => [line('1', 'TS-BLU-M', 2)];

  it('offers that combine all apply; one that does not applies alone beside them', () => {
    const offers = [offer(1, { value: '10' }), offer(2, { value: '10' }), offer(3, { value: '50', combinable: false })];
    const out = answer({ lines: lines(), offers }, { point: 'post', explain: true });
    // Ten, ten and then half of what is left beat ten and ten alone.
    expect(out.uses.map((use) => `${String(use.offer)} ${use.amount}`)).toEqual(['1 4.80', '2 4.32', '3 19.44']);
    expect(why(out)).toEqual({ '1': 'applies 4.80', '2': 'applies 4.32', '3': 'applies 19.44' });
  });

  it('of two that do not combine the better wins, the lower key on a tie, and the other is said to have lost', () => {
    const out = answer({ lines: lines(), offers: [offer(1, { value: '10', combinable: false }), offer(2, { value: '20', combinable: false })] }, { explain: true });
    expect(why(out)).toEqual({ '1': 'not-combinable', '2': 'applies 9.60' });
    const tie = answer({ lines: lines(), offers: [offer(1, { value: '10', combinable: false }), offer(2, { value: '10', combinable: false })] }, { explain: true });
    expect(why(tie)).toEqual({ '1': 'applies 4.80', '2': 'not-combinable' });
  });

  it('an offer that says nothing of combining follows the settings', () => {
    const offers = [offer(1, { value: '10', combinable: null }), offer(2, { value: '10', combinable: null })];
    expect(off(answer({ lines: lines(), offers }))).toBe('4.80');
    expect(off(answer({ lines: lines(), offers }, { settings: { combine_default: true } }))).toBe('9.12');
  });

  it('one code to an order: of several typed, the best, and the others are told so', () => {
    const offers = [offer(1, { value: '10', trigger: 'code' }), offer(2, { value: '25', trigger: 'code' }), offer(3, { value: '5' })];
    const out = answer({ lines: lines(), codes: [code('TEN', codeFor(1, 'TEN')), code('QUARTER', codeFor(2, 'QUARTER'))], offers }, { point: 'post' });
    expect(out.uses.map((use) => `${String(use.offer)} ${use.amount}`)).toEqual(['2 12.00', '3 1.80']);
    expect(out.told).toEqual([{ typed: 'TEN', note: 'better-offer-applied', name: 'Offer 2' }]);
    expect(out.refused).toEqual([]);
  });

  it('a code that lost for a reason of its own is refused for that reason, not told a better one applied', () => {
    const offers = [offer(1, { value: '10', combinable: false }), offer(2, { value: '90', trigger: 'code', combinable: false, min_spend: '500.00' })];
    const out = answer({ lines: lines(), codes: [code('BIG', codeFor(2, 'BIG'))], offers });
    expect(out.refused).toEqual([{ typed: 'BIG', reason: 'needs-minimum', params: { amount: '500.00' } }]);
    expect(out.told).toBeUndefined();
    expect(off(out)).toBe('4.80');
  });

  it('tries twelve that do not combine, and says of a thirteenth that it was left out', () => {
    const offers = Array.from({ length: 13 }, (_, at) => offer(at + 1, { value: String(at + 1), combinable: false }));
    const out = answer({ lines: lines(), offers }, { explain: true });
    // Twelve percent wins: thirteen was never tried.
    expect(off(out)).toBe('5.76');
    expect(why(out)['13']).toBe('not-combinable');
    expect(why(out)['12']).toBe('applies 5.76');
  });

  it('vouchers and what staff give go with everything', () => {
    const offers = [offer(1, { value: '50', combinable: false })];
    const out = answer({ lines: lines(), codes: [typedVoucher('VC-FIVE', LEAFLET(7))], offers, staff: { kind: 'amount', value: '1.00', reason: null, ceiling: null, judge: false } });
    expect(off(out)).toBe('30.00');
  });
});

describe('an offer tried before it is saved', () => {
  it('stands in for its stored self, and is judged as if it were running', () => {
    const stored = offer(1, { value: '10', status: 'paused' });
    const tried = answer({ lines: MUGS(), offers: [stored] }, { mode: 'try', draft: { ...stored, value: '25', status: 'draft' }, explain: true });
    expect(why(tried)).toEqual({ '1': 'applies 10.00' });
    // One entry: the stored offer is not there beside the one tried in its place.
    expect(tried.explain).toHaveLength(1);
    // Outside a try, a draft is nobody's to apply.
    expect(off(answer({ lines: MUGS(), offers: [stored] }, { mode: 'save', draft: { ...stored, value: '25', status: 'draft' } }))).toBe('0.00');
  });

  it('is still held to its days, its minimum and its code', () => {
    const tried = (more: Row) => why(answer({ lines: MUGS(), offers: [] }, { mode: 'try', explain: true, draft: { ...offer(0, more), id: null } }));
    expect(tried({})).toEqual({ draft: 'applies 4.00' });
    expect(tried({ starts_on: '2027-01-01' })).toEqual({ draft: 'not-yet' });
    expect(tried({ min_spend: '99.00' })).toEqual({ draft: 'needs-minimum' });
    expect(tried({ trigger: 'code' })).toEqual({ draft: 'no-code-typed' });
  });
});

describe('an order priced again for a return', () => {
  it('asks nothing again about who was buying or whether the offer still runs', () => {
    const ended = offer(1, { value: '10', trigger: 'code', status: 'ended', first_order_only: true, max_uses: 1, uses: 1 });
    const out = answer({ lines: [line('1', 'MUG-SPK', 1), line('2', 'MUG-WHT', 1, { kept: false })], codes: [code('GONE', codeFor(1, 'GONE', { valid_until: '2026-01-01', max_uses: 1, uses: 1 }))], offers: [ended] }, { mode: 'refund' });
    // Ten percent of the mug that was kept; the one given back counts for nothing.
    expect(byLine(out)).toEqual(['1.40', '0.00']);
    expect(out.refused).toEqual([]);
  });

  it('still asks what depends on the basket: a minimum no longer met', () => {
    const out = answer({ lines: [line('1', 'MUG-SPK', 1)], codes: [code('AUTUMN5')], offers: [OFFERS[3]!] }, { mode: 'refund' });
    expect(off(out)).toBe('0.00');
  });
});

describe('units, one by one', () => {
  const candle = (id: number): Row => voucher(id, 'One candle', { worth: 'thing', what: 'item', source_table: 'shop:items', source_row: 'CNDL-FIG' });

  it('a second voucher takes the second candle whole, not half of what the first left', () => {
    const out = answer({ lines: [line('1', 'CNDL-FIG', 2)], codes: [typedVoucher('VC-A', candle(1)), typedVoucher('VC-B', candle(2))], offers: [] }, { point: 'post' });
    expect(off(out)).toBe('36.00');
    expect(out.uses.map((use) => `${String(use.voucher)} ${use.amount}`)).toEqual(['1 18.00', '2 18.00']);
    // A third finds nothing left to take, and is left out.
    const three = answer({ lines: [line('1', 'CNDL-FIG', 2)], codes: [typedVoucher('VC-A', candle(1)), typedVoucher('VC-B', candle(2)), typedVoucher('VC-C', candle(3))], offers: [] });
    expect(three.applied).toHaveLength(2);
  });

  it('two vouchers for a night take the dearer night, then the other', () => {
    const night = (id: number): Row => voucher(id, 'One night', { worth: 'thing', what: 'type', source_table: 'hotel:room_types', source_row: '3' });
    const stay = { ...other('70', 'Stay', '390.00'), what: [{ as: 'type' as const, table: 'hotel:room_types', row: '3' }], nights: [{ date: '2026-11-02', price: '185.00' }, { date: '2026-11-07', price: '205.00' }] };
    const out = answer({ lines: [stay], codes: [typedVoucher('VC-A', night(1)), typedVoucher('VC-B', night(2))], offers: [] }, { point: 'post' });
    expect(out.uses.map((use) => use.amount)).toEqual(['205.00', '185.00']);
    // Two rooms for those two nights are four room-nights: one voucher is one of them.
    const rooms = { ...stay, quantity: '2', amount: '780.00' };
    expect(off(answer({ lines: [rooms], codes: [typedVoucher('VC-A', night(1))], offers: [] }))).toBe('205.00');
  });

  it('a unit a voucher paid for is the one a pair gives away, and a fixed price takes the other down', () => {
    const tote = voucher(8, 'One tote', { worth: 'thing', what: 'item', source_table: 'shop:items', source_row: 'TOTE-NAT' });
    const pair = offer(1, { gives: 'bonus_item', value: null, buy_qty: 2, bonus_qty: 1 });
    // Two totes, one by voucher: of the pair, the cheaper is the one already at nothing.
    expect(off(answer({ lines: [line('1', 'TOTE-NAT', 2)], codes: [typedVoucher('VC-T', tote)], offers: [pair] }))).toBe('15.00');
    // Two candles, one by voucher, each for $15.00: the other comes down by three.
    expect(off(answer({ lines: [line('1', 'CNDL-FIG', 2)], codes: [typedVoucher('VC-A', candle(1))], offers: [offer(1, { gives: 'fixed_price', value: '15.00' })] }))).toBe('21.00');
  });

  it('a share of the whole line is spread over its units before a unit is taken', () => {
    // Three mugs at $14.00: a quarter off by quantity (−10.50, three at 10.50), then "buy three, one on us" gives one of them.
    const breaks: Row[] = [{ id: 1, offer_id: 1, from_qty: 3, value: '25' }];
    const offers = [offer(1, { gives: 'quantity_price', value: null }), offer(2, { gives: 'bonus_item', value: null, buy_qty: 3, bonus_qty: 1 })];
    expect(off(answer({ lines: [line('1', 'MUG-SPK', 3)], offers, breaks }))).toBe('21.00');
  });

  it('counts a hundred million units without listing them', () => {
    const screws = other('1', 'Screw', '0.10', 100_000_000);
    expect(screws.amount).toBe('10000000.00');
    expect(off(answer({ lines: [screws], offers: [offer(1, { gives: 'bonus_item', value: null, buy_qty: 2, bonus_qty: 1 })] }))).toBe('5000000.00');
    expect(off(answer({ lines: [screws], offers: [offer(1, { gives: 'fixed_price', value: '0.08' })] }))).toBe('2000000.00');
    const one = voucher(8, 'One screw', { worth: 'thing', what: 'item', source_table: 'shop:items', source_row: 'Screw', units: 3 });
    expect(off(answer({ lines: [screws], codes: [typedVoucher('VC-S', one)], offers: [] }))).toBe('0.30');
    // An amount that does not divide evenly is still the line's amount, to the cent.
    const odd = { ...other('1', 'Thing', '0.00', 3), amount: '10.00' };
    expect(off(answer({ lines: [odd], offers: [offer(1, { gives: 'fixed_price', value: '0.00' })] }))).toBe('10.00');
    expect(off(answer({ lines: [odd], offers: [offer(1, { gives: 'bonus_item', value: null, buy_qty: 3, bonus_qty: 1 })] }))).toBe('3.33');
  });

  it('a quantity that is no whole number, nothing or less is one unit', () => {
    for (const quantity of ['1.5', '0', '-2', '', 'abc', '99999999999999999999']) {
      const cheese = { ...other('1', 'Cheese', '12.00'), quantity };
      expect(off(answer({ lines: [cheese], offers: [offer(1, { gives: 'fixed_price', value: '10.00' })] })), quantity).toBe('2.00');
    }
  });
});

describe('what the review found', () => {
  const lines = () => [line('1', 'TS-BLU-M', 2)];

  it('one code to an order, also where one of two typed does not combine', () => {
    const offers = [offer(1, { value: '10', trigger: 'code' }), offer(2, { value: '20', trigger: 'code', combinable: false })];
    const out = answer({ lines: lines(), codes: [code('TEN', codeFor(1, 'TEN')), code('TWENTY', codeFor(2, 'TWENTY'))], offers }, { point: 'post' });
    expect(out.uses.map((use) => `${String(use.offer)} ${use.amount}`)).toEqual(['2 9.60']);
    expect(out.told).toEqual([{ typed: 'TEN', note: 'better-offer-applied', name: 'Offer 2' }]);
    expect(out.refused).toEqual([]);
  });

  it('what staff give and what a voucher is worth never decide which offer applies', () => {
    // A hundred dollars of goods; five percent that does not combine; $9.60 by hand from somebody who may give ten percent.
    const goods = [other('1', 'Lamp', '100.00')];
    const out = answer({ lines: goods, offers: [offer(1, { value: '5', combinable: false })], staff: { kind: 'amount', value: '9.60', reason: null, ceiling: { percent: '10', amount: null }, judge: true } }, { point: 'post' });
    expect(out.uses.map((use) => `${use.offer ?? 'staff'} ${use.amount}`)).toEqual(['1 5.00', 'staff 9.60']);
    expect(out.refused).toEqual([]);
    // Ten dollars of goods, half off, and a ten-dollar voucher: the offer takes its five, and the voucher only the rest.
    const ten = answer({ lines: [other('1', 'Lamp', '10.00')], codes: [typedVoucher('VC-TEN', voucher(9, 'Ten dollars', { value: '10.00' }))], offers: [offer(1, { value: '50', combinable: false })] }, { point: 'post' });
    expect(ten.uses.map((use) => `${use.offer ?? use.voucher ?? ''} ${use.amount}`)).toEqual(['1 5.00', '9 5.00']);
  });

  it('a code that lost to offers that combine is told so, by the name of the one that gave most', () => {
    // $32.00: ten percent by a code that does not combine ($3.20) loses to five dollars off that came by itself.
    const offers = [offer(1, { value: '10', trigger: 'code', combinable: false }), offer(2, { gives: 'amount', value: '5.00', min_spend: '30.00' })];
    const out = answer({ lines: [line('1', 'MUG-SPK', 2), line('2', 'PEN-BLK', 2)], codes: [code('T', codeFor(1, 'T'))], offers });
    expect(off(out)).toBe('5.00');
    expect(out.told).toEqual([{ typed: 'T', note: 'better-offer-applied', name: 'Offer 2' }]);
    expect(out.refused).toEqual([]);
  });

  it('a code typed on an order with nothing left to reduce is not for these items', () => {
    const candle = voucher(1, 'One candle', { worth: 'thing', what: 'item', source_table: 'shop:items', source_row: 'CNDL-FIG' });
    for (const combinable of [true, false]) {
      const out = answer({ lines: [line('1', 'CNDL-FIG')], codes: [typedVoucher('VC-A', candle), code('T', codeFor(1, 'T'))], offers: [offer(1, { trigger: 'code', combinable })] }, { explain: true });
      expect(out.refused, String(combinable)).toEqual([{ typed: 'T', reason: 'not-for-these-items' }]);
      expect(why(out), String(combinable)).toEqual({ '1': 'not-for-these-items' });
      expect(out.told).toBeUndefined();
    }
  });

  it('a code that lost is told the name of the offer that beat it, not of another that also applied', () => {
    // Codes X and Y combine, code T does not; nor does A, which came by itself and gives most.
    const offers = [offer(1, { value: '5', trigger: 'code' }), offer(2, { value: '3', trigger: 'code' }), offer(3, { value: '20', trigger: 'code', combinable: false }), offer(4, { value: '40', combinable: false })];
    const out = answer({ lines: lines(), codes: [code('X', codeFor(1, 'X')), code('Y', codeFor(2, 'Y')), code('T', codeFor(3, 'T'))], offers }, { point: 'post' });
    expect(out.uses.map((use) => String(use.offer))).toEqual(['1', '4']);
    expect(out.told).toEqual([
      { typed: 'Y', note: 'better-offer-applied', name: 'Offer 1' },
      { typed: 'T', note: 'better-offer-applied', name: 'Offer 4' },
    ]);
  });

  it('a second code of an offer applies where the first has run out', () => {
    const out = answer({ lines: lines(), codes: [code('FIRST', codeFor(1, 'FIRST', { max_uses: 5, uses: 5 })), code('SECOND', { ...codeFor(1, 'SECOND'), id: 2 })], offers: [offer(1, { trigger: 'code' })] }, { point: 'post' });
    expect(out.refused).toEqual([{ typed: 'FIRST', reason: 'used-up' }]);
    expect(out.uses).toEqual([{ offer: '1', code: '2', voucher: null, amount: '4.80' }]);
    // Both run out: each is refused once, and nothing is taken.
    const none = answer({ lines: lines(), codes: [code('FIRST', codeFor(1, 'FIRST', { max_uses: 5, uses: 5 })), code('SECOND', { ...codeFor(1, 'SECOND', { max_uses: 1, uses: 1 }), id: 2 })], offers: [offer(1, { trigger: 'code' })] }, { explain: true });
    expect(none.refused).toEqual([{ typed: 'FIRST', reason: 'used-up' }, { typed: 'SECOND', reason: 'used-up' }]);
    expect(why(none)).toEqual({ '1': 'used-up' });
  });

  it('a code that does not combine is tried before the offers that came by themselves, however many there are', () => {
    const offers = [...Array.from({ length: 13 }, (_, at) => offer(at + 1, { value: String(at + 1), combinable: false })), offer(50, { value: '30', trigger: 'code', combinable: false })];
    const out = answer({ lines: lines(), codes: [code('BEST', codeFor(50, 'BEST'))], offers }, { point: 'post' });
    expect(out.uses.map((use) => `${String(use.offer)} ${use.amount}`)).toEqual(['50 14.40']);
  });

  it('a fixed price with no price, and "buy one, that one on us", give nothing', () => {
    for (const more of [{ gives: 'fixed_price', value: null }, { gives: 'fixed_price', value: '12,50' }, { gives: 'bonus_item', value: null, buy_qty: 1, bonus_qty: 1 }, { gives: 'something_new', value: '5' }] as Row[]) {
      const out = answer({ lines: [line('1', 'TOTE-NAT', 2)], offers: [offer(1, more)] }, { explain: true });
      expect(off(out), JSON.stringify(more)).toBe('0.00');
      expect(why(out), JSON.stringify(more)).toEqual({ '1': 'not-for-these-items' });
    }
    // A bonus that asks for as many as it gives still leaves one of every group paid for.
    expect(off(answer({ lines: [line('1', 'TOTE-NAT', 4)], offers: [offer(1, { gives: 'bonus_item', value: null, buy_qty: 2, bonus_qty: 2 })] }))).toBe('30.00');
  });

  it('an order priced again for a return keeps the washes its pack already paid for', () => {
    const washes = voucher(6, '5 car washes', { worth: 'pack', what: 'item', source_table: 'shop:items', source_row: 'Wash', uses_total: 5, uses_taken: 5, uses_left: 0, status: 'used' });
    const kept = [other('1', 'Wash', '9.00', 2), { ...other('2', 'Air freshener', '4.00'), kept: false }];
    const out = answer({ lines: kept, codes: [typedVoucher('PK-W', washes)], offers: [] }, { mode: 'refund' });
    expect(byLine(out)).toEqual(['18.00', '0.00']);
    expect(out.refused).toEqual([]);
  });

  it('reads a date kept as a moment, days of the week kept as a list, and an hour written short', () => {
    const one = (more: Row, when: Partial<AdjustInput> = {}) => why(answer({ lines: lines(), offers: [offer(1, more)] }, { explain: true, ...when }));
    expect(one({ starts_on: '2026-10-01T00:00:00.000Z', ends_on: '2026-10-01T00:00:00.000Z' })).toEqual({ '1': 'applies 4.80' });
    expect(one({ weekdays: '[1,4]' })).toEqual({ '1': 'applies 4.80' });
    expect(one({ weekdays: '[1,5]' })).toEqual({ '1': 'outside-days' });
    expect(one({ from_time: '9:00', to_time: '9:30' })).toEqual({ '1': 'outside-hours' });
    expect(one({ from_time: '9:00:00', to_time: '10:30:00' })).toEqual({ '1': 'applies 4.80' });
    const expired = answer({ lines: lines(), codes: [code('OLD', codeFor(1, 'OLD', { valid_until: '2026-09-30T23:59:59Z' }))], offers: [offer(1, { trigger: 'code' })] });
    expect(expired.refused).toEqual([{ typed: 'OLD', reason: 'expired' }]);
  });

  it('a comp is a hundred percent whatever its value column holds, and is judged as that', () => {
    const comp = (judge: boolean) => answer({ lines: lines(), offers: [], staff: { kind: 'comp', value: '', reason: null, ceiling: judge ? { percent: '10', amount: null } : null, judge } });
    expect(off(comp(false))).toBe('48.00');
    expect(comp(true).refused).toEqual([{ typed: '', reason: 'over-ceiling', params: { max: '10' } }]);
  });

  it('an amount by hand with no limit in money is held to the giver\'s percent of the goods as they came', () => {
    // Ten percent of $48.00 is $4.80, whatever an offer took first.
    const given = (value: string) => answer({ lines: lines(), offers: [offer(1, { value: '50' })], staff: { kind: 'amount', value, reason: null, ceiling: { percent: '10', amount: null }, judge: true } });
    expect(off(given('4.80'))).toBe('28.80');
    expect(given('4.81').refused).toEqual([{ typed: '', reason: 'over-ceiling', params: { max: '4.80' } }]);
  });

  it('a voucher whose row says nothing of what it is worth is not known', () => {
    for (const worth of [null, 'gold']) expect(answer({ lines: lines(), codes: [typedVoucher('VC-X', voucher(3, 'x', { worth }))], offers: [] }).refused, String(worth)).toEqual([{ typed: 'VC-X', reason: 'unknown' }]);
  });

  it('an offer row with no key is nobody\'s to apply or to explain', () => {
    const out = answer({ lines: lines(), offers: [{ ...offer(1, {}), id: null }, offer(2, {})] }, { explain: true });
    expect(why(out)).toEqual({ '2': 'applies 4.80' });
  });

  it('an amount finer than the order keeps is cut where Adminium cuts it', () => {
    // $10.005 at two decimals is $10.00 to Adminium: all of it off is ten dollars, never ten and a cent.
    const fine = { ...other('1', 'Thing', '10.00'), amount: '10.005' };
    expect(off(answer({ lines: [fine], offers: [offer(1, { value: '100' })] }))).toBe('10.00');
  });

  it('never lists more than an answer may carry, and what it leaves out it says', () => {
    const many = Array.from({ length: 200 }, (_, at) => other(String(at + 1), `Thing ${String(at + 1)}`, '10.00'));
    const offers = Array.from({ length: 6 }, (_, at) => offer(at + 1, { value: '10' }));
    const out = answer({ lines: many, offers }, { explain: true });
    expect(out.applied.length).toBe(800);
    const reasons = why(out);
    expect([reasons['5'], reasons['6']]).toEqual(['not-combinable', 'not-combinable']);
    // What is listed still adds up, line by line.
    const perLine = new Map<string, number>();
    for (const one of out.applied) perLine.set(one.line, (perLine.get(one.line) ?? 0) + Math.round(Number(one.amount) * 100));
    for (const one of out.lines) expect(perLine.get(one.key) ?? 0, one.key).toBe(Math.round(Number(one.discount) * 100));
  });

  it('answers the largest question it may be asked in good time', () => {
    const many = Array.from({ length: 200 }, (_, at) => line(String(at + 1), at % 2 === 0 ? 'MUG-SPK' : 'TOTE-NAT', 3));
    const offers = [
      ...Array.from({ length: 12 }, (_, at) => offer(at + 1, { value: '1', combinable: false })),
      ...Array.from({ length: 12 }, (_, at) => offer(100 + at, { value: '1', trigger: 'code' })),
      ...Array.from({ length: 476 }, (_, at) => offer(1000 + at, { value: '1', status: at % 2 === 0 ? 'paused' : 'active', starts_on: '2027-01-01' })),
    ];
    const codes = Array.from({ length: 12 }, (_, at) => code(`C${String(at)}`, codeFor(100 + at, `C${String(at)}`)));
    const started = performance.now();
    const out = answer({ lines: many, codes, offers }, { explain: true });
    const took = performance.now() - started;
    expect(out.explain).toHaveLength(500);
    expect(out.told).toHaveLength(11);
    // A save allows a quarter of a second in a bare context; here, with room for a busy machine.
    expect(took).toBeLessThan(1500);
  });
});

describe('what an answer never does', () => {
  it('takes a line below nothing, or touches one that is left out, paid for or given back', () => {
    const lines = [line('1', 'PEN-BLK'), other('2', 'Gift card', '50.00', 1, { excluded: true }), line('3', 'MUG-SPK', 1, { paidBy: 'VC-1' }), line('4', 'MUG-WHT', 1, { kept: false })];
    const out = answer({ lines, offers: [offer(1, { gives: 'amount', value: '500.00' }), offer(2, { value: '100' })], staff: { kind: 'amount', value: '500.00', reason: null, ceiling: null, judge: false } });
    expect(byLine(out)).toEqual(['2.00', '0.00', '0.00', '0.00']);
  });

  it('reads a name kept as a map, as one text, or not at all', () => {
    const named = (name: string | null) => answer({ lines: MUGS(), offers: [offer(1, { name: 'Inside name', public_name: name })] }).applied[0]!.name;
    expect(named('{"en-US":"Ten off","de-DE":"Zehn weniger"}')).toEqual({ 'en-US': 'Ten off', 'de-DE': 'Zehn weniger' });
    expect(named('Ten off')).toBe('Ten off');
    expect(named('{not json')).toBe('{not json');
    expect(named('{"en-US":5}')).toBe('{"en-US":5}');
    // A name kept as a quoted text is that text, without its quotes; a key that is no language is no name.
    expect(named('"Ten off"')).toBe('Ten off');
    expect(named('{"en-US":"Ten off","__proto__":"x","constructor":"y"}')).toEqual({ 'en-US': 'Ten off' });
    expect(answer({ lines: MUGS(), offers: [{ ...offer(1, {}), public_name: { 'en-US': 'Ten off' } as never }] }).applied[0]!.name).toEqual({ 'en-US': 'Ten off' });
    expect(named(null)).toBe('Inside name');
    expect(named('x'.repeat(300))).toHaveLength(200);
  });

  it('reads a yes, a number and a key as each database writes them', () => {
    // MySQL and SQLite say 1 for yes; a key may come as a number or as text; a decimal as text.
    const sqlite = offer(1, { value: 10, combinable: 0, budget_open: 1 });
    const other_ = offer(2, { value: '20.000', combinable: 0, budget_open: 1 });
    expect(why(answer({ lines: MUGS(), offers: [sqlite, other_] }, { explain: true }))).toEqual({ '1': 'not-combinable', '2': 'applies 8.00' });
    const typed = answer({ lines: MUGS(), codes: [code('N', { ...CODES['WELCOME10']!, offer_id: '1' })], offers: [offer(1, { trigger: 'code' })] });
    expect(off(typed)).toBe('4.00');
  });

  it('holds every reduction to what its line has left, whatever a step asks for', () => {
    const standing: Standing = { left: [500n, 0n, 300n], runs: [[{ value: 500n, count: 1 }], [], [{ value: 300n, count: 1 }]], taken: [] };
    const source = { kind: 'offer' as const, offer: '1', code: null, voucher: null, name: 'x', typed: false };
    const taken = take(standing, source, new Map([[0, 900n], [1, 50n], [2, -20n]]));
    expect(taken).toMatchObject({ total: 500n });
    expect([...taken!.shares]).toEqual([[0, 500n]]);
    expect(standing.left).toEqual([0n, 0n, 300n]);
    // Nothing to take is nothing recorded.
    expect(take(standing, source, new Map([[0, 10n]]))).toBeNull();
    expect(standing.taken).toHaveLength(1);
  });

  it('answers a question with no line, no offer and no code', () => {
    expect(adjust(ask({ lines: [], offers: [], targets: [] }))).toEqual({ lines: [], order: { discount: '0.00' }, applied: [], uses: [], refused: [] });
  });
});
