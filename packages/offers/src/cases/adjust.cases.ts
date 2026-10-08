/**
 * THE WORKED ORDERS.
 *
 * Every figure the add-on promises about a discount, as a question and its
 * answer: the order that comes to $48.11, the five dollars split to the cent,
 * the minimum judged on what is left, the load line no offer touches, the
 * stay priced by the night. The shared `price-adjust@1` suite runs each of
 * them against the built file; the docs, the sample and the engine's own
 * tests quote the same numbers.
 *
 * The shop is the sample's: the September price list, six offers, three
 * codes. Prices are in dollars at two decimals; tax is the host's and is no
 * part of an answer.
 */

import type { AdjustCode, AdjustInput, AdjustLine, AdjustOutput } from '@adminium/add-on-contracts';

type Row = Record<string, string | number | boolean | null>;

/** The sample day: Thursday 1 October 2026, ten in the morning. */
export const SAMPLE_DAY = { today: '2026-10-01', weekday: 4 as const, time: '10:00', now: '2026-10-01T10:00:00.000Z' };
/** The Monday after it. */
export const MONDAY = { today: '2026-10-05', weekday: 1 as const, time: '10:00', now: '2026-10-05T10:00:00.000Z' };
/** A Wednesday while Launch week ran. */
export const MID_SEPTEMBER = { today: '2026-09-16', weekday: 3 as const, time: '10:00', now: '2026-09-16T10:00:00.000Z' };

export const PRICES: Readonly<Record<string, string>> = {
  'TS-BLU-S': '24.00',
  'TS-BLU-M': '24.00',
  'TS-BLU-L': '24.00',
  'TS-WHT-M': '22.00',
  'TS-WHT-L': '22.00',
  'TOTE-NAT': '15.00',
  'TOTE-BLK': '16.00',
  'MUG-SPK': '14.00',
  'MUG-WHT': '12.00',
  'CNDL-FIG': '18.00',
  'CNDL-CED': '18.00',
  'NB-A5': '6.50',
  'PEN-BLK': '2.00',
  'CARD-GRT': '3.50',
};
const TAG: Readonly<Record<string, string>> = { 'MUG-SPK': 'mugs', 'MUG-WHT': 'mugs', 'TOTE-NAT': 'bags', 'TOTE-BLK': 'bags' };
export const ITEMS = 'shop:items';

const cents = (text: string): number => Math.round(Number(text) * 100);
const money = (value: number): string => (value / 100).toFixed(2);

/** A line of the shop: so many of one thing at its listed price. */
export function line(key: string, sku: string, quantity = 1, more: Partial<AdjustLine> = {}): AdjustLine {
  const price = PRICES[sku]!;
  return {
    key,
    part: 0,
    index: 0,
    price,
    quantity: String(quantity),
    amount: money(cents(price) * quantity),
    what: [{ as: 'item', table: ITEMS, row: sku }, ...(TAG[sku] === undefined ? [] : [{ as: 'tag' as const, table: '', row: TAG[sku] }])],
    excluded: false,
    paidBy: null,
    kept: true,
    ...more,
  };
}
/** A line of something that is not in the shop's list. */
export function other(key: string, name: string, price: string, quantity = 1, more: Partial<AdjustLine> = {}): AdjustLine {
  return { key, part: 0, index: 0, price, quantity: String(quantity), amount: money(cents(price) * quantity), what: [{ as: 'item', table: ITEMS, row: name }], excluded: false, paidBy: null, kept: true, ...more };
}

const names = (text: string): string => JSON.stringify({ 'en-US': text });
const offer = (id: number, name: string, said: string, more: Row): Row => ({
  id,
  name,
  public_name: names(said),
  gives: 'percent',
  value: null,
  buy_qty: null,
  bonus_qty: null,
  trigger: 'automatic',
  applies_to: 'order',
  starts_on: null,
  ends_on: null,
  weekdays: null,
  from_time: null,
  to_time: null,
  min_spend: null,
  min_qty: null,
  first_order_only: false,
  group_id: null,
  max_uses: null,
  max_per_customer: null,
  budget_open: true,
  budget: null,
  combinable: true,
  status: 'active',
  uses: 0,
  given: '0.00',
  budget_left: null,
  used_up: false,
  ...more,
});

/** The sample's six offers, as their rows read on the sample day. */
export const OFFERS: readonly Row[] = [
  offer(1, 'Welcome 10', '10 % off your first order', { value: '10', trigger: 'code', starts_on: '2026-08-01', first_order_only: true, max_per_customer: 1, uses: 41, given: '117.48' }),
  offer(2, 'Monday mugs', '15 % off mugs on Mondays', { value: '15', applies_to: 'lines', starts_on: '2026-09-14', weekdays: '1', uses: 9, given: '22.50' }),
  offer(3, 'Tote pair', 'Two totes, the cheaper one on us', { gives: 'bonus_item', buy_qty: 2, bonus_qty: 1, applies_to: 'lines', starts_on: '2026-09-24', uses: 6, given: '90.00' }),
  offer(4, 'Autumn 5', '$5.00 off', { gives: 'amount', value: '5.00', trigger: 'code', starts_on: '2026-09-14', ends_on: '2026-11-30', max_uses: 100, min_spend: '30.00', uses: 20, given: '100.00' }),
  offer(5, 'Launch week', '20 % off', { value: '20', trigger: 'code', starts_on: '2026-09-01', ends_on: '2026-09-30', max_uses: 50, uses: 50, given: '280.20', used_up: true }),
  offer(6, 'Summer close-out', '25 % off', { value: '25', starts_on: '2026-07-01', ends_on: '2026-08-31', status: 'ended' }),
];
const target = (id: number, offerId: number, tag: string, label: string): Row => ({ id, offer_id: offerId, kind: 'tag', source_table: '', source_row: tag, label });
export const TARGETS: readonly Row[] = [target(1, 2, 'mugs', 'Homeware: mugs'), target(2, 3, 'bags', 'Bags')];
export const REASONS: readonly Row[] = [
  { id: 1, label: 'Damaged', active: true, position: 0 },
  { id: 2, label: 'Goodwill', active: true, position: 1 },
  { id: 3, label: 'Staff purchase', active: true, position: 2 },
  { id: 4, label: 'Manager', active: true, position: 3 },
];
export const CODES: Readonly<Record<string, Row>> = {
  WELCOME10: { id: 1, offer_id: 1, code: 'WELCOME10', max_uses: null, valid_until: null, active: true, uses: 41 },
  AUTUMN5: { id: 2, offer_id: 4, code: 'AUTUMN5', max_uses: null, valid_until: null, active: true, uses: 20 },
  LAUNCH20: { id: 3, offer_id: 5, code: 'LAUNCH20', max_uses: 50, valid_until: null, active: true, uses: 50 },
};

/** A typed discount code, found. */
export const code = (typed: string, row: Row | undefined = CODES[typed]): AdjustCode => ({ typed, kind: row === undefined ? null : 'code', row: row ?? null });
/** A voucher or a pack, as its row reads. */
export function voucher(id: number, said: string, more: Row): Row {
  return {
    id,
    code: `VOUCHER${String(id).padStart(5, '0')}`,
    code_last4: String(id).padStart(4, '0'),
    worth: 'amount',
    value: null,
    what: null,
    source_table: '',
    source_row: '',
    units: 1,
    public_name: said,
    uses_total: 1,
    uses_taken: 0,
    uses_left: 1,
    holder_email: null,
    holder_key: null,
    holder_name: null,
    batch_id: null,
    sold: false,
    awaiting_sale: false,
    sale_price: null,
    tax_later: false,
    status: 'issued',
    expires_on: null,
    ...more,
  };
}
export const typedVoucher = (typed: string, row: Row): AdjustCode => ({ typed, kind: 'voucher', row });
export const ONE_CANDLE = voucher(1, 'One candle', { worth: 'thing', what: 'item', source_table: ITEMS, source_row: 'CNDL-FIG' });
export const MASSAGE = voucher(4, 'Massage 60 min', { worth: 'thing', what: 'item', source_table: ITEMS, source_row: 'Massage 60 min' });
export const CLASSES = voucher(5, '10 classes', { worth: 'pack', what: 'item', source_table: ITEMS, source_row: 'Class', uses_total: 10, uses_taken: 4, uses_left: 6, sold: true, sale_price: '120.00' });
export const LEAFLET = (id: number): Row => voucher(id, 'Leaflet drop, October', { value: '5.00', batch_id: 1, expires_on: '2026-11-30' });

/** Somebody signed in who has never ordered. */
export const NEW_CUSTOMER = { key: 'k-ada', groups: [], orders: 0, uses: {} };

export interface Asked {
  lines: AdjustLine[];
  codes?: AdjustCode[];
  customer?: AdjustInput['customer'];
  staff?: AdjustInput['staff'];
  when?: typeof SAMPLE_DAY | typeof MONDAY | typeof MID_SEPTEMBER;
  offers?: readonly Row[];
  targets?: readonly Row[];
  breaks?: readonly Row[];
  more?: Partial<AdjustInput>;
}

/** A question as Adminium puts it: a save at a staffed door unless a case says otherwise. */
export function ask(asked: Asked): AdjustInput {
  const when = asked.when ?? SAMPLE_DAY;
  const customer = asked.customer ?? null;
  return {
    contract: 'price-adjust@1',
    mode: 'save',
    point: 'line',
    origin: 'staff',
    ...when,
    zone: 'UTC',
    currency: 'USD',
    scale: 2,
    locale: 'en-US',
    lines: asked.lines.map((one, index) => ({ ...one, index })),
    codes: asked.codes ?? [],
    customer,
    guest: false,
    staff: asked.staff ?? null,
    offers: { offers: [...(asked.offers ?? OFFERS)], breaks: [...(asked.breaks ?? [])], targets: [...(asked.targets ?? TARGETS)], reasons: [...REASONS] },
    settings: { combine_default: false },
    explain: false,
    version: '1.0.9',
    ...asked.more,
  };
}
/** The same question from a guest at a public door. */
const guest = (asked: Asked): AdjustInput => ({ ...ask(asked), origin: 'public', guest: true });

export interface AdjustCase {
  name: string;
  input: AdjustInput;
  expect: { order?: string; lines?: Record<string, string>; applied?: Partial<AdjustOutput['applied'][number]>[]; refused?: { typed: string; reason: string }[] };
  /** What the shared suite does not compare, held by this package's own test. */
  also?: { refused?: AdjustOutput['refused']; uses?: AdjustOutput['uses']; told?: AdjustOutput['told']; explain?: Record<string, { applies: boolean; reason?: string; amount?: string }> };
}

const WORKED = (): AdjustLine[] => [line('1', 'MUG-SPK', 2), line('2', 'TOTE-NAT', 2), line('3', 'NB-A5')];
const said = (text: string) => ({ 'en-US': text });
const TOTE_PAIR = { line: '2', offer: '3', code: null, voucher: null, kind: 'offer' as const, amount: '15.00', typed: false, name: said('Two totes, the cheaper one on us') };
const welcome = (lineKey: string, amount: string) => ({ line: lineKey, offer: '1', code: '1', voucher: null, kind: 'code' as const, amount, typed: true, name: said('10 % off your first order') });
/** A $50.00 gift card being loaded: a line no offer reduces. */
const LOAD = (): AdjustLine => other('9', 'Gift card', '50.00', 1, { excluded: true });
const noLimit = { kind: 'amount' as const, value: '40.00', reason: '2', ceiling: null, judge: false };

/** The stay: two nights in the Garden double at $185.00, the stay itself the one line. */
const NIGHTS = [
  { date: '2026-11-02', price: '185.00' },
  { date: '2026-11-03', price: '185.00' },
];
const STAY = (nights = NIGHTS): AdjustLine => ({
  key: '70',
  part: 0,
  index: 0,
  price: money(nights.reduce((total, night) => total + cents(night.price), 0)),
  quantity: '1',
  amount: money(nights.reduce((total, night) => total + cents(night.price), 0)),
  what: [{ as: 'type', table: 'hotel:room_types', row: '3' }],
  excluded: false,
  paidBy: null,
  kept: true,
  nights,
});
const MIDWEEK = offer(20, 'Midweek', '10 % off midweek stays', { value: '10', trigger: 'code' });
const MIDWEEK_CODE: Row = { id: 20, offer_id: 20, code: 'MIDWEEK', max_uses: null, valid_until: null, active: true, uses: 0 };
const ONE_NIGHT = voucher(30, 'One night · Garden double', { worth: 'thing', what: 'type', source_table: 'hotel:room_types', source_row: '3' });

/** Two offers that do not combine, and a code for the smaller one. */
const QUARTER = offer(11, 'Quarter off', '25 % off', { value: '25', combinable: false });
const TENTH = offer(12, 'Tenth off', '10 % off with a code', { value: '10', trigger: 'code', combinable: false });
const TENTH_CODE: Row = { id: 12, offer_id: 12, code: 'SAVE10', max_uses: null, valid_until: null, active: true, uses: 0 };

/** The till's ticket: three bowls, two flat whites, two croissants — $53.60. */
const TICKET = (): AdjustLine[] => [other('1', 'Breakfast Bowl', '12.00', 3), other('2', 'Flat White', '5.00', 2), other('3', 'Croissant', '3.80', 2)];
const ONE_CROISSANT = voucher(40, 'One croissant', { worth: 'thing', what: 'item', source_table: ITEMS, source_row: 'Croissant' });

/** Juniper's order: two pizzas of a pair and the rest, $64.50. */
const PIZZA_PAIR = offer(3, 'Pizza pair', 'Two Pepperoni & honey, the cheaper one on us', { gives: 'bonus_item', buy_qty: 2, bonus_qty: 1, applies_to: 'lines' });
const JUNIPER = (): AdjustLine[] => [other('1', 'Pepperoni & honey', '16.00', 2, { what: [{ as: 'item', table: ITEMS, row: 'Pepperoni & honey' }, { as: 'tag', table: '', row: 'pizza' }] }), other('2', 'Burrata salad', '13.50'), other('3', 'Tiramisu', '9.50', 2)];

export const ADJUST_CASES: readonly AdjustCase[] = [
  {
    name: 'A1 the worked order: Tote pair, then ten percent of what is left, split to the cent',
    input: ask({ lines: WORKED(), codes: [code('WELCOME10')], customer: NEW_CUSTOMER }),
    expect: { order: '19.95', lines: { '1': '2.80', '2': '16.50', '3': '0.65' }, refused: [] },
  },
  {
    name: 'A2 five dollars over three lines: 2.83, 1.51 and 0.66, never 5.01',
    input: ask({ lines: WORKED(), codes: [code('AUTUMN5')] }),
    expect: { order: '20.00', lines: { '1': '2.83', '2': '16.51', '3': '0.66' }, refused: [] },
  },
  {
    name: 'A3 a first-order code typed by a guest: sign in, and only the pair applies',
    input: guest({ lines: WORKED(), codes: [code('WELCOME10')] }),
    expect: { order: '15.00', lines: { '1': '0.00', '2': '15.00', '3': '0.00' }, applied: [TOTE_PAIR], refused: [{ typed: 'WELCOME10', reason: 'needs-sign-in' }] },
  },
  {
    name: 'A4 the shares the order tax rests on: each reduction on its own line',
    input: ask({ lines: WORKED(), codes: [code('WELCOME10')], customer: NEW_CUSTOMER }),
    expect: { order: '19.95', applied: [TOTE_PAIR, welcome('1', '2.80'), welcome('2', '1.50'), welcome('3', '0.65')] },
  },
  {
    name: 'A5 a code at its last use: used up, and nothing off',
    input: ask({ lines: [line('1', 'MUG-WHT', 2)], codes: [code('LAUNCH20')], when: MID_SEPTEMBER }),
    expect: { order: '0.00', applied: [], refused: [{ typed: 'LAUNCH20', reason: 'used-up' }] },
  },
  {
    name: 'A6 a basket under the minimum: twenty-five dollars where thirty are asked',
    input: ask({ lines: [line('1', 'MUG-WHT'), line('2', 'NB-A5', 2)], codes: [code('AUTUMN5')] }),
    expect: { order: '0.00', refused: [{ typed: 'AUTUMN5', reason: 'needs-minimum' }] },
    also: { refused: [{ typed: 'AUTUMN5', reason: 'needs-minimum', params: { amount: '30.00' } }] },
  },
  {
    name: 'A7 a second use by the same customer: over the limit',
    input: ask({ lines: [line('1', 'NB-A5'), line('2', 'PEN-BLK', 2)], codes: [code('WELCOME10')], customer: { key: 'k-ada', groups: [], orders: 0, uses: { '1': 1 } } }),
    expect: { order: '0.00', refused: [{ typed: 'WELCOME10', reason: 'over-limit' }] },
  },
  {
    name: 'A8 the minimum is judged on what earlier reductions left: 27.30, not 31.50',
    input: ask({ lines: [line('1', 'MUG-SPK', 2), line('2', 'CARD-GRT')], codes: [code('AUTUMN5')], when: MONDAY }),
    expect: { order: '4.20', lines: { '1': '4.20', '2': '0.00' }, refused: [{ typed: 'AUTUMN5', reason: 'needs-minimum' }] },
  },
  {
    name: 'A9 a card being loaded is never reduced: ten percent of the mugs only',
    input: ask({ lines: [line('1', 'MUG-SPK', 2), LOAD()], codes: [code('WELCOME10')], customer: NEW_CUSTOMER }),
    expect: { order: '2.80', lines: { '1': '2.80', '9': '0.00' }, refused: [] },
  },
  {
    name: 'A9 …and forty dollars off by hand stop at what the mugs have left',
    input: ask({ lines: [line('1', 'MUG-SPK', 2), LOAD()], codes: [code('WELCOME10')], customer: NEW_CUSTOMER, staff: noLimit }),
    expect: { order: '28.00', lines: { '1': '28.00', '9': '0.00' }, refused: [] },
  },
  {
    name: 'A10 a card being loaded counts for no minimum',
    input: ask({ lines: [line('1', 'MUG-SPK', 2), LOAD()], codes: [code('AUTUMN5')] }),
    expect: { order: '0.00', refused: [{ typed: 'AUTUMN5', reason: 'needs-minimum' }] },
  },
  {
    name: 'A11 a voucher for one candle takes one of two',
    input: ask({ lines: [line('1', 'CNDL-FIG', 2)], codes: [typedVoucher('VC-ONECANDLE01', ONE_CANDLE)] }),
    expect: { order: '18.00', applied: [{ line: '1', offer: null, code: null, voucher: '1', kind: 'voucher', amount: '18.00', typed: true }], refused: [] },
  },
  {
    name: 'A12 a voucher pays its line in full, and the code takes ten percent of the rest',
    input: ask({ lines: [other('1', 'Massage 60 min', '80.00'), line('2', 'CNDL-FIG')], codes: [typedVoucher('VC-MASSAGE0001', MASSAGE), code('WELCOME10')], customer: NEW_CUSTOMER }),
    expect: { order: '81.80', lines: { '1': '80.00', '2': '1.80' }, refused: [] },
  },
  {
    name: 'A13 a pack covers the class and counts one use',
    input: ask({ lines: [other('1', 'Class', '15.00')], codes: [typedVoucher('PK-TENCLASSES1', CLASSES)], more: { point: 'post' } }),
    expect: { order: '15.00', applied: [{ line: '1', voucher: '5', kind: 'pack', amount: '15.00', typed: true }], refused: [] },
    also: { uses: [{ offer: null, code: null, voucher: '5', amount: '15.00', units: 1 }] },
  },
  {
    name: 'A13 …and a pack with nothing left is used up',
    input: ask({ lines: [other('1', 'Class', '15.00')], codes: [typedVoucher('PK-TENCLASSES1', { ...CLASSES, uses_taken: 10, uses_left: 0 })] }),
    expect: { order: '0.00', applied: [], refused: [{ typed: 'PK-TENCLASSES1', reason: 'used-up' }] },
  },
  {
    name: 'A14 two five-dollar vouchers on four dollars: the first takes it all, the second nothing',
    input: ask({ lines: [line('1', 'PEN-BLK', 2)], codes: [typedVoucher('VC-LEAFLET0001', LEAFLET(101)), typedVoucher('VC-LEAFLET0002', LEAFLET(102))], more: { point: 'post' } }),
    expect: { order: '4.00', applied: [{ line: '1', voucher: '101', kind: 'voucher', amount: '4.00' }], refused: [] },
    also: { uses: [{ offer: null, code: null, voucher: '101', amount: '4.00' }] },
  },
  {
    name: 'A15 the kitchen order: a pizza on the house, then ten percent',
    input: ask({ lines: JUNIPER(), codes: [code('WELCOME10')], customer: NEW_CUSTOMER, offers: [OFFERS[0]!, PIZZA_PAIR], targets: [target(1, 3, 'pizza', 'Pizzas')] }),
    expect: { order: '20.85', lines: { '1': '17.60', '2': '1.35', '3': '1.90' } },
  },
  {
    name: 'A16 the till ticket: a croissant by voucher, then ten percent by hand',
    input: ask({ lines: TICKET(), codes: [typedVoucher('VC-CROISSANT01', ONE_CROISSANT)], staff: { kind: 'percent', value: '10', reason: '2', ceiling: { percent: '50', amount: null }, judge: true } }),
    expect: { order: '8.78', lines: { '1': '3.60', '2': '1.00', '3': '4.18' }, refused: [] },
  },
  {
    name: 'A17 a stay of two nights, ten percent by a code',
    input: ask({ lines: [STAY()], codes: [code('MIDWEEK', MIDWEEK_CODE)], offers: [MIDWEEK], targets: [] }),
    expect: { order: '37.00', lines: { '70': '37.00' }, refused: [] },
  },
  {
    name: 'A18 a voucher for one night takes one night',
    input: ask({ lines: [STAY()], codes: [typedVoucher('VC-ONENIGHT001', ONE_NIGHT)], offers: [], targets: [] }),
    expect: { order: '185.00', refused: [] },
  },
  {
    name: 'A18 …the dearest one when they differ',
    input: ask({ lines: [STAY([NIGHTS[0]!, { date: '2026-11-07', price: '205.00' }])], codes: [typedVoucher('VC-ONENIGHT001', ONE_NIGHT)], offers: [], targets: [] }),
    expect: { order: '205.00', refused: [] },
  },
  {
    name: 'A19 twenty percent by somebody who may give ten: over the limit, and nothing off',
    input: ask({ lines: [line('1', 'MUG-SPK', 2)], staff: { kind: 'percent', value: '20', reason: '2', ceiling: { percent: '10', amount: null }, judge: true } }),
    expect: { order: '0.00', applied: [], refused: [{ typed: '', reason: 'over-ceiling' }] },
    also: { refused: [{ typed: '', reason: 'over-ceiling', params: { max: '10' } }] },
  },
  {
    name: 'A20 the same reduction, stored by somebody who could give it, is applied as it is',
    input: ask({ lines: [line('1', 'MUG-SPK', 2)], staff: { kind: 'percent', value: '20', reason: '2', ceiling: { percent: '10', amount: null }, judge: false } }),
    expect: { order: '5.60', applied: [{ line: '1', kind: 'staff', amount: '5.60', reason: '2', name: said('Staff · Goodwill') as never }], refused: [] },
  },
  {
    name: 'A21 two offers that do not combine: the better one, and the code that lost is told so',
    input: ask({ lines: [line('1', 'TS-BLU-M', 2)], codes: [code('SAVE10', TENTH_CODE)], offers: [QUARTER, TENTH], targets: [], more: { point: 'post' } }),
    expect: { order: '12.00', applied: [{ line: '1', offer: '11', kind: 'offer', amount: '12.00' }], refused: [] },
    also: { told: [{ typed: 'SAVE10', note: 'better-offer-applied', name: '25 % off' }], uses: [{ offer: '11', code: null, voucher: null, amount: '12.00' }] },
  },
  {
    name: 'A22 one mug given back: the pair still stands, and ten percent of less',
    input: ask({ lines: [line('1', 'MUG-SPK', 1), line('2', 'TOTE-NAT', 2), line('3', 'NB-A5')], codes: [code('WELCOME10')], customer: null, offers: [OFFERS[0]!, OFFERS[2]!], more: { mode: 'refund' } }),
    expect: { order: '18.55', lines: { '1': '1.40', '2': '16.50', '3': '0.65' }, refused: [] },
  },
  {
    name: 'A23 one tote of the pair given back: no pair, so the order costs what it cost',
    input: ask({ lines: [line('1', 'MUG-SPK', 2), line('2', 'TOTE-NAT', 1), line('3', 'NB-A5')], codes: [code('WELCOME10')], customer: null, offers: [OFFERS[0]!, OFFERS[2]!], more: { mode: 'refund' } }),
    expect: { order: '4.95', lines: { '1': '2.80', '2': '1.50', '3': '0.65' }, refused: [] },
  },
  {
    name: 'A23 …and a line given back whole counts for nothing',
    input: ask({ lines: [line('1', 'MUG-SPK', 2), line('2', 'TOTE-NAT', 2, { kept: false }), line('3', 'NB-A5')], codes: [code('WELCOME10')], customer: null, offers: [OFFERS[0]!, OFFERS[2]!], more: { mode: 'refund' } }),
    expect: { order: '3.45', lines: { '1': '2.80', '2': '0.00', '3': '0.65' }, refused: [] },
  },
  {
    name: 'A24 an offer tried before it is saved, with why for every other',
    input: ask({
      lines: WORKED(),
      more: { mode: 'try', explain: true, draft: offer(0, 'Notebook day', '$1.00 off', { id: null, gives: 'amount', value: '1.00', status: 'draft' }) },
    }),
    expect: { order: '16.00', refused: [] },
    also: {
      explain: {
        '1': { applies: false, reason: 'no-code-typed' },
        '2': { applies: false, reason: 'outside-days' },
        '3': { applies: true, amount: '15.00' },
        '4': { applies: false, reason: 'no-code-typed' },
        '5': { applies: false, reason: 'ended' },
        '6': { applies: false, reason: 'ended' },
        draft: { applies: true, amount: '1.00' },
      },
    },
  },
  {
    name: 'A25 while a line is written, the same reductions and no use',
    input: ask({ lines: WORKED(), codes: [code('WELCOME10')], customer: NEW_CUSTOMER }),
    expect: { order: '19.95' },
    also: { uses: [] },
  },
  {
    name: 'A26 a paused offer, a Tuesday for a Monday offer, nine for a lunch offer: nothing applies',
    input: ask({
      lines: [line('1', 'MUG-SPK', 2)],
      when: { today: '2026-10-06', weekday: 2 as never, time: '09:00', now: '2026-10-06T09:00:00.000Z' } as never,
      offers: [offer(31, 'Paused', 'x', { value: '10', status: 'paused' }), OFFERS[1]!, offer(33, 'Lunch', 'y', { value: '10', from_time: '12:00', to_time: '14:00' })],
      more: { explain: true },
    }),
    expect: { order: '0.00', applied: [], refused: [] },
    also: { explain: { '2': { applies: false, reason: 'outside-days' }, '31': { applies: false, reason: 'paused' }, '33': { applies: false, reason: 'outside-hours' } } },
  },
  {
    name: 'A27 a comp: the goods to nothing, the load untouched, one use',
    input: ask({ lines: [line('1', 'MUG-SPK', 2), LOAD()], staff: { kind: 'percent', value: '100', reason: null, ceiling: null, judge: false }, more: { point: 'post' } }),
    expect: { order: '28.00', lines: { '1': '28.00', '9': '0.00' }, refused: [] },
    also: { uses: [{ offer: null, code: null, voucher: null, amount: '28.00' }] },
  },
  {
    name: 'A28 the last use is this order\'s own: held for it, so it still applies',
    input: ask({ lines: [line('1', 'MUG-WHT', 2)], codes: [code('LAUNCH20')], when: MID_SEPTEMBER, more: { held: { redemptions: [{ id: 900, kind: 'code', offer_id: 5, code_id: 3, voucher_id: null, amount: '4.80', uses: 1, state: 'held' }] } } }),
    expect: { order: '4.80', refused: [] },
  },
  {
    name: 'A28 …and with nothing held it is used up',
    input: ask({ lines: [line('1', 'MUG-WHT', 2)], codes: [code('LAUNCH20')], when: MID_SEPTEMBER, more: { held: { redemptions: [] } } }),
    expect: { order: '0.00', refused: [{ typed: 'LAUNCH20', reason: 'used-up' }] },
  },
  {
    name: 'A29 a gift card typed where a code goes is no code',
    input: ask({ lines: [line('1', 'MUG-WHT', 2)], codes: [{ typed: 'GC-7K2M-W3HN-Q4XP', kind: null, row: null }] }),
    expect: { order: '0.00', refused: [{ typed: 'GC-7K2M-W3HN-Q4XP', reason: 'unknown' }] },
  },
  {
    name: 'A30 somebody with no limit row may give nothing',
    input: ask({ lines: [line('1', 'MUG-SPK', 2)], staff: { kind: 'percent', value: '5', reason: null, ceiling: { percent: '0', amount: '0' }, judge: true } }),
    expect: { order: '0.00', refused: [{ typed: '', reason: 'over-ceiling' }] },
    also: { refused: [{ typed: '', reason: 'over-ceiling', params: { max: '0' } }] },
  },
  {
    name: 'A30 …and a Super Admin has no limit',
    input: ask({ lines: [line('1', 'MUG-SPK', 2)], staff: { kind: 'percent', value: '5', reason: null, ceiling: null, judge: false } }),
    expect: { order: '1.40', applied: [{ line: '1', kind: 'staff', amount: '1.40' }], refused: [] },
  },
  {
    name: 'A31 where the order is posted: one use for the pair, one for the code, each the customer\'s',
    input: ask({ lines: WORKED(), codes: [code('WELCOME10')], customer: NEW_CUSTOMER, more: { point: 'post' } }),
    expect: { order: '19.95' },
    also: {
      uses: [
        { offer: '3', code: null, voucher: null, amount: '15.00', customer: 'k-ada' },
        { offer: '1', code: '1', voucher: null, amount: '4.95', customer: 'k-ada' },
      ],
    },
  },
  {
    name: 'A31 …and a guest\'s uses name nobody',
    input: { ...guest({ lines: WORKED(), codes: [code('AUTUMN5')] }), point: 'post' },
    expect: { order: '20.00' },
    also: {
      uses: [
        { offer: '3', code: null, voucher: null, amount: '15.00' },
        { offer: '4', code: '2', voucher: null, amount: '5.00' },
      ],
    },
  },
];
