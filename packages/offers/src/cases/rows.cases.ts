/**
 * THE WORKED POSTINGS.
 *
 * Every figure the add-on promises about a card or a use, as a call and its
 * answer: the card that pays $19.00 of $48.11, the seventh ten-dollar spend
 * of a $62.00 card, the pack's tenth use, the old card that comes in at
 * $38.50. The shared `posting-rows@1` suite runs each against the built file,
 * asks it again, asks it as a look ahead, and reverses what it wrote.
 *
 * The cards are the sample's; the day is the sample day.
 */

import type { PostingInput, PostingLine, PostingOutput, PostingRefusal, PostingUse } from '@adminium/add-on-contracts';

type Scalar = string | number | boolean | null;
type Row = Record<string, Scalar>;

export const TODAY = '2026-10-01';
export const NOW = '2026-10-01T10:00:00.000Z';
/** The stored names of a host's tables, as a posting carries them. */
export const ORDERS = 'shop:orders';
export const PAYMENTS = 'shop:payments';
export const LINES = 'shop:order_lines';
export const REFUNDS = 'shop:refunds';

/** The settings row of a fresh install. */
export const SETTINGS: Row = { combine_default: false, card_expiry_months: null, card_reminder_days: 30, card_min: '10.00', card_max: '500.00', pack_expiry_months: null, from_name: null, tax_later: false, cards_paused: false };

/** A card as its row reads. */
export function card(id: number, last4: string, balance: string, more: Row = {}): Row {
  return { id, kind: 'card', label: last4, status: 'active', balance, opening: '0.00', expires_on: null, remind_on: null, send_on: null, issued_at: '2026-08-03T11:20:00.000Z', moved_from: null, moving: false, ...more };
}
export const Q4XP = card(1, 'Q4XP', '19.00');
export const K4WD = card(9, 'K4WD', '100.00');
export const T7QF = card(6, 'T7QF', '62.00');

export function line(key: string, inputs: PostingLine['inputs'], lineTable = ''): PostingLine {
  return { line: key, lineTable, inputs, multipliers: {}, round: 1 };
}

export interface Called {
  action: string;
  phase?: PostingInput['phase'];
  lines: PostingLine[];
  reads?: PostingInput['reads'];
  written?: PostingInput['written'];
  uses?: PostingUse[];
  settings?: Row;
  source?: PostingInput['source'];
  more?: Partial<PostingInput>;
}

/** A call as Adminium makes it: a save at a staffed door unless a case says otherwise. */
export function call(called: Called): PostingInput {
  return {
    contract: 'posting-rows@1',
    ledger: 'value',
    action: called.action,
    posting: called.action,
    phase: called.phase ?? 'post',
    mode: 'save',
    origin: 'staff',
    now: NOW,
    today: TODAY,
    zone: 'UTC',
    currency: 'USD',
    source: called.source ?? { table: ORDERS, row: '125' },
    lines: called.lines,
    reads: called.reads ?? {},
    settings: called.settings ?? SETTINGS,
    written: called.written ?? {},
    ...(called.uses === undefined ? {} : { uses: called.uses }),
    version: '1.0.9',
    ...called.more,
  };
}

export interface RowsCase {
  name: string;
  input: PostingInput;
  expect: { rows?: Record<string, unknown>[]; refusals?: Partial<PostingRefusal>[] };
  /** What the shared suite does not compare, held by this package's own test. */
  also?: { decides?: PostingOutput['decides']; notes?: PostingOutput['notes'] };
}

const insert = (table: string, values: Record<string, unknown>, lineKey?: string) => ({ op: 'insert', table, ...(lineKey === undefined ? {} : { line: lineKey }), values });
const update = (table: string, id: unknown, set: Record<string, unknown>) => ({ op: 'update', table, key: { id }, set });
const payment = (key: string, cardId: number | null, due: string, more: PostingLine['inputs'] = {}) => line(key, { card: cardId, due, ...more }, PAYMENTS);

/** A use as a price question hands it over. */
const WELCOME_USE: PostingUse = { offer: '1', code: '1', voucher: null, amount: '4.95', customer: 'k-ada' };
const OFFER_1: Row = { id: 1, name: 'Welcome 10', max_uses: null, uses: 41, budget_open: true, budget: null, budget_left: null, used_up: false };
const CODE_1: Row = { id: 1, offer_id: 1, code: 'WELCOME10', max_uses: null, uses: 41 };
const LAUNCH: Row = { id: 5, name: 'Launch week', max_uses: 50, uses: 50, budget_open: true, budget: null, budget_left: null, used_up: true };
const LAUNCH_CODE: Row = { id: 3, offer_id: 5, code: 'LAUNCH20', max_uses: 50, uses: 50 };
/** The pack of ten classes, sold for $120.00, with so many uses left. */
export const classes = (left: number, more: Row = {}): Row => ({ id: 5, worth: 'pack', public_name: '10 classes', uses_total: 10, uses_left: left, status: left === 0 ? 'used' : 'issued', expires_on: null, awaiting_sale: false, sold: true, sale_price: '120.00', ...more });
const HELD_ROW: Row = { id: 900, kind: 'code', offer_id: 1, code_id: 1, voucher_id: null, amount: '4.95', uses: 1, state: 'held', source_table: ORDERS, source_row: '125' };
const BATCH: Row = { id: 1, name: 'Leaflet drop, October', count: 200, worth: 'amount', value: '5.000', what: null, source_table: '', source_row: '', units: 1, public_name: 'Leaflet drop, October', uses_total: 1, expires_on: '2026-11-30', note: null };
/** An old card of the till's, made here before its rows are brought in. */
const moved = (status: string, balance: string): Row => card(40, '9930', balance, { status, moved_from: '7', moving: true, issued_at: null });

export const ROWS_CASES: readonly RowsCase[] = [
  {
    name: 'P1 a card that holds $19.00 pays $19.00 of $48.11',
    input: call({ action: 'spend', lines: [payment('p1', 1, '48.11')], reads: { card: [Q4XP] } }),
    expect: { rows: [insert('card_ledger', { card_id: 1, kind: 'spend', taken: '19.00', value: '19.00', balance_after: '0.00', source_table: PAYMENTS, source_row: 'p1', at: NOW }, 'p1')] },
    also: { decides: [{ line: 'p1', input: 'amount', value: '19.00' }, { line: 'p1', input: 'balance_after', value: '0.00' }] },
  },
  {
    name: 'P2 the payment taken back gives the card its $19.00 again, against the row that took it',
    input: call({
      action: 'spend',
      phase: 'reverse',
      lines: [payment('p1', 1, '48.11')],
      reads: { card: [{ ...Q4XP, balance: '0.00' }] },
      written: { card_ledger: [{ id: 77, card_id: 1, kind: 'spend', taken: '19.00', value: '19.00', balance_after: '0.00', source_table: PAYMENTS, source_row: 'p1' }] },
    }),
    expect: { rows: [insert('card_ledger', { card_id: 1, kind: 'refund', taken: '-19.00', value: '19.00', balance_after: '19.00', against_id: 77, source_table: PAYMENTS, source_row: 'p1' })] },
  },
  {
    name: 'P3 a card that holds more than is due pays what is due and keeps the rest',
    input: call({ action: 'spend', lines: [payment('p2', 9, '62.97')], reads: { card: [K4WD] } }),
    expect: { rows: [insert('card_ledger', { card_id: 9, kind: 'spend', taken: '62.97', value: '62.97', balance_after: '37.03' })] },
    also: { decides: [{ line: 'p2', input: 'amount', value: '62.97' }, { line: 'p2', input: 'balance_after', value: '37.03' }] },
  },
  {
    name: 'P4 six spends of ten dollars from sixty-two pass, each from what the one before left',
    input: call({ action: 'spend', lines: [1, 2, 3, 4, 5, 6].map((n) => payment(`p${String(n)}`, 6, '100.00', { ask: '10.00' })), reads: { card: [T7QF] } }),
    expect: { rows: ['52.00', '42.00', '32.00', '22.00', '12.00', '2.00'].map((after) => insert('card_ledger', { card_id: 6, kind: 'spend', taken: '10.00', balance_after: after })) },
  },
  {
    name: 'P4 …and the seventh is refused with two dollars left',
    input: call({ action: 'spend', lines: [1, 2, 3, 4, 5, 6, 7].map((n) => payment(`p${String(n)}`, 6, '100.00', { ask: '10.00' })), reads: { card: [T7QF] } }),
    expect: { refusals: [{ line: 'p7', reason: 'empty', left: '2.00' }] },
  },
  {
    name: 'P5 a card not yet sold, a cancelled one, an expired one, and one nobody knows',
    input: call({
      action: 'spend',
      lines: [payment('a', 21, '10.00'), payment('b', 22, '10.00'), payment('c', 23, '10.00'), payment('d', 24, '10.00'), payment('e', 99, '10.00')],
      reads: { card: [card(21, '9MXR', '0.00', { status: 'inactive' }), card(22, '6VXQ', '0.00', { status: 'void' }), card(23, 'AAAA', '5.00', { status: 'expired' }), card(24, 'BBBB', '5.00', { expires_on: '2026-09-30' })] },
    }),
    expect: { rows: [], refusals: [{ line: 'a', reason: 'inactive' }, { line: 'b', reason: 'void' }, { line: 'c', reason: 'expired' }, { line: 'd', reason: 'expired' }, { line: 'e', reason: 'not-valid' }] },
  },
  {
    name: 'P6 a refund of what a payment took goes back to its card',
    input: call({
      action: 'refund',
      source: { table: REFUNDS, row: '3' },
      lines: [line('', { against_table: PAYMENTS, against_row: 'p9', amount: '9.80' })],
      reads: { spend: [{ id: 60, card_id: 5, kind: 'spend', taken: '9.80', value: '9.80', source_table: PAYMENTS, source_row: 'p9' }], card: [card(5, 'R2MC', '40.20')], given: [] },
    }),
    expect: { rows: [insert('card_ledger', { card_id: 5, kind: 'refund', taken: '-9.80', value: '9.80', balance_after: '50.00', against_id: 60, source_table: REFUNDS, source_row: '3' })] },
  },
  {
    name: 'P6 …and a cent more than it took is refused, with nothing left to give',
    input: call({
      action: 'refund',
      source: { table: REFUNDS, row: '4' },
      lines: [line('', { against_table: PAYMENTS, against_row: 'p9', amount: '0.01' })],
      reads: { spend: [{ id: 60, card_id: 5, kind: 'spend', taken: '9.80', value: '9.80', source_table: PAYMENTS, source_row: 'p9' }], card: [card(5, 'R2MC', '50.00')], given: [{ id: 61, card_id: 5, kind: 'refund', taken: '-9.80', value: '9.80', against_id: 60 }] },
    }),
    expect: { rows: [], refusals: [{ line: '', reason: 'refund-over', left: '0.00' }] },
  },
  {
    name: 'P7 credit given by hand is money given back, and makes the credit active',
    input: call({
      action: 'card-action',
      source: { table: 'offers:card_actions', row: '11' },
      lines: [line('11', { card: 31, action: 'issue', amount: '42.00', reason: 'Returned a jacket' }, 'offers:card_actions')],
      reads: { card: [card(31, '', '0.00', { kind: 'credit', status: 'inactive', label: null, issued_at: null })] },
    }),
    expect: {
      rows: [insert('card_ledger', { card_id: 31, kind: 'refund', taken: '-42.00', value: '42.00', balance_after: '42.00', note: 'Returned a jacket', source_table: 'offers:card_actions', source_row: '11' }), update('gift_cards', 31, { status: 'active', issued_at: NOW, notify: 'credit' })],
    },
  },
  {
    name: 'P7 …more credit later is the same kind of row, and sends no second mail',
    input: call({
      action: 'card-action',
      lines: [line('12', { card: 31, action: 'top_up', amount: '16.50', reason: 'Goodwill' }, 'offers:card_actions')],
      reads: { card: [card(31, '', '42.00', { kind: 'credit', label: null })] },
      settings: { ...SETTINGS, card_expiry_months: 12 },
    }),
    expect: { rows: [insert('card_ledger', { card_id: 31, kind: 'refund', taken: '-16.50', value: '16.50', balance_after: '58.50' })] },
  },
  {
    name: 'P7 …and credit is never sold on a sale line',
    input: call({ action: 'issue', lines: [line('l1', { card: 31, amount: '20.00' }, LINES)], reads: { card: [card(31, '', '0.00', { kind: 'credit', status: 'inactive', label: null })] } }),
    expect: { rows: [], refusals: [{ line: 'l1', reason: 'not-allowed' }] },
  },
  {
    name: 'P8 a sale line loads fifty dollars on a new card: active, and its mail goes now',
    input: call({ action: 'issue', lines: [line('l1', { card: 2, amount: '50.00', label: 'Order 14' }, LINES)], reads: { card: [card(2, 'Q4XP', '0.00', { status: 'inactive', issued_at: null })] } }),
    expect: {
      rows: [insert('card_ledger', { card_id: 2, kind: 'issue', taken: '-50.00', value: '50.00', balance_after: '50.00', source_table: LINES, source_row: 'l1', source_label: 'Order 14' }), update('gift_cards', 2, { status: 'active', issued_at: NOW, notify: 'card' })],
    },
  },
  {
    name: 'P8 …a card to be sent next week says so',
    input: call({ action: 'issue', lines: [line('l1', { card: 2, amount: '50.00' }, LINES)], reads: { card: [card(2, 'Q4XP', '0.00', { status: 'inactive', issued_at: null, send_on: '2026-10-08' })] } }),
    expect: { rows: [insert('card_ledger', { kind: 'issue' }), update('gift_cards', 2, { status: 'active', notify: 'card_dated' })] },
  },
  {
    name: 'P8 …and $18.60 spent from it leaves $31.40',
    input: call({ action: 'spend', lines: [payment('p3', 2, '18.60')], reads: { card: [card(2, 'Q4XP', '50.00')] } }),
    expect: { rows: [insert('card_ledger', { kind: 'spend', taken: '18.60', balance_after: '31.40' })] },
  },
  {
    name: 'P9 a top-up starts the card\'s months again, and no second card mail',
    input: call({
      action: 'card-action',
      lines: [line('13', { card: 7, action: 'top_up', amount: '25.00', reason: 'Asked at the desk' }, 'offers:card_actions')],
      reads: { card: [card(7, 'NP3H', '75.00', { expires_on: '2027-03-20', remind_on: '2027-02-18' })] },
      settings: { ...SETTINGS, card_expiry_months: 12, card_reminder_days: 30 },
    }),
    expect: { rows: [insert('card_ledger', { card_id: 7, kind: 'top_up', taken: '-25.00', value: '25.00', balance_after: '100.00', note: 'Asked at the desk' }), update('gift_cards', 7, { expires_on: '2027-10-01', remind_on: '2027-09-01' })] },
  },
  {
    name: 'P10 a load over the most a card may hold',
    input: call({ action: 'issue', lines: [line('l1', { card: 2, amount: '600.00' }, LINES)], reads: { card: [card(2, 'Q4XP', '0.00', { status: 'inactive' })] } }),
    expect: { rows: [], refusals: [{ line: 'l1', reason: 'not-allowed' }] },
  },
  {
    name: 'P10 …a top-up that would take the card past it',
    input: call({ action: 'card-action', lines: [line('14', { card: 7, action: 'top_up', amount: '70.00', reason: 'x' }, 'offers:card_actions')], reads: { card: [card(7, 'NP3H', '450.00')] } }),
    expect: { rows: [], refusals: [{ line: '14', reason: 'not-allowed' }] },
  },
  {
    name: 'P10 …a load under the least, and any load while cards are being brought in',
    input: call({ action: 'issue', lines: [line('l1', { card: 2, amount: '5.00' }, LINES)], reads: { card: [card(2, 'Q4XP', '0.00', { status: 'inactive' })] } }),
    expect: { rows: [], refusals: [{ line: 'l1', reason: 'not-allowed' }] },
  },
  {
    name: 'P10 …while cards are being brought in from a till',
    input: call({ action: 'issue', lines: [line('l1', { card: 2, amount: '50.00' }, LINES)], reads: { card: [card(2, 'Q4XP', '0.00', { status: 'inactive' })] }, settings: { ...SETTINGS, cards_paused: true } }),
    expect: { rows: [], refusals: [{ line: 'l1', reason: 'not-allowed' }] },
  },
  {
    name: 'P11 a card cancelled with $30.00 on it is closed out with one row',
    input: call({ action: 'void', source: { table: 'offers:gift_cards', row: '8' }, lines: [line('', { card: { table: 'offers:gift_cards', row: '8' } })], reads: { card: [card(8, '6VXQ', '30.00', { status: 'void' })] } }),
    expect: { rows: [insert('card_ledger', { card_id: 8, kind: 'void', taken: '30.00', value: '30.00', balance_after: '0.00', source_table: 'offers:gift_cards', source_row: '8' })] },
  },
  {
    name: 'P11 …an expired one the same way, and one holding nothing needs no row',
    input: call({ action: 'expire', source: { table: 'offers:gift_cards', row: '8' }, lines: [line('', { card: { table: 'offers:gift_cards', row: '8' } })], reads: { card: [card(8, '6VXQ', '12.50', { status: 'expired' })] } }),
    expect: { rows: [insert('card_ledger', { kind: 'expire', taken: '12.50', balance_after: '0.00' })] },
  },
  {
    name: 'P11 …a card holding nothing is closed with no row',
    input: call({ action: 'void', source: { table: 'offers:gift_cards', row: '8' }, lines: [line('', { card: { table: 'offers:gift_cards', row: '8' } })], reads: { card: [card(8, '6VXQ', '0.00', { status: 'void' })] } }),
    expect: { rows: [] },
  },
  {
    name: 'P12 a use of a pack by hand: counted, with its share of what the pack was sold for',
    input: call({ action: 'voucher-action', source: { table: 'offers:voucher_actions', row: '3' }, lines: [line('3', { voucher: 5, action: 'use' }, 'offers:voucher_actions')], reads: { voucher: [classes(6)], last: [], none: [] } }),
    expect: { rows: [insert('redemptions', { kind: 'pack', voucher_id: 5, amount: '0.00', uses: 1, prepaid: '12.00', state: 'counted', source_table: 'offers:voucher_actions', source_row: '3' })] },
  },
  {
    name: 'P12 …the tenth use marks the pack used',
    input: call({ action: 'voucher-action', lines: [line('9', { voucher: 5, action: 'use' }, 'offers:voucher_actions')], reads: { voucher: [classes(1)], last: [], none: [] } }),
    expect: { rows: [insert('redemptions', { kind: 'pack', uses: 1, prepaid: '12.00', state: 'counted' }), update('vouchers', 5, { status: 'used' })] },
  },
  {
    name: 'P12 …and the eleventh is refused',
    input: call({ action: 'voucher-action', lines: [line('10', { voucher: 5, action: 'use' }, 'offers:voucher_actions')], reads: { voucher: [classes(0)], last: [], none: [] } }),
    expect: { rows: [], refusals: [{ line: '10', reason: 'used-up' }] },
  },
  {
    name: 'P13 a cancelled booking gives its use back, and the pack is in use again',
    input: call({
      action: 'redeem',
      phase: 'reverse',
      lines: [line('', {})],
      reads: { mine: [], offers: [], codes: [], vouchers: [classes(0)] },
      written: { redemptions: [{ id: 410, kind: 'pack', offer_id: null, code_id: null, voucher_id: 5, amount: '15.00', uses: 1, state: 'counted' }] },
    }),
    expect: { rows: [update('redemptions', 410, { state: 'given_back', given_back_at: NOW }), update('vouchers', 5, { status: 'issued' })] },
  },
  {
    name: 'P13 …a use given back to a pack past its day gives it thirty days more',
    input: call({
      action: 'voucher-action',
      lines: [line('20', { voucher: 5, action: 'give_back' }, 'offers:voucher_actions')],
      reads: { voucher: [classes(0, { status: 'expired', expires_on: '2026-09-15' })], last: [{ id: 401, voucher_id: 5, state: 'counted', at: '2026-09-01T10:00:00.000Z' }, { id: 409, voucher_id: 5, state: 'counted', at: '2026-09-10T18:00:00.000Z' }], none: [] },
    }),
    expect: { rows: [update('redemptions', 409, { state: 'given_back', given_back_at: NOW }), update('vouchers', 5, { status: 'issued', expires_on: '2026-10-31' })] },
  },
  {
    name: 'P14 a code\'s use: held while the order is reserved',
    input: call({ action: 'redeem', phase: 'reserve', lines: [line('', { label: 'Order 125' })], uses: [WELCOME_USE], reads: { mine: [], offers: [OFFER_1], codes: [CODE_1], vouchers: [] } }),
    expect: { rows: [insert('redemptions', { kind: 'code', offer_id: 1, code_id: 1, voucher_id: null, reason_id: null, customer: 'k-ada', amount: '4.95', uses: 1, state: 'held', source_table: ORDERS, source_row: '125', source_label: 'Order 125', at: NOW })] },
  },
  {
    name: 'P14 …counted when the order is posted, with no second row',
    input: call({ action: 'redeem', lines: [line('', {})], uses: [WELCOME_USE], reads: { mine: [HELD_ROW], offers: [OFFER_1], codes: [CODE_1], vouchers: [] }, written: { redemptions: [HELD_ROW] } }),
    expect: { rows: [update('redemptions', 900, { state: 'counted', at: NOW })] },
  },
  {
    name: 'P14 …and given back when the order is cancelled',
    input: call({ action: 'redeem', phase: 'reverse', lines: [line('', {})], reads: { mine: [{ ...HELD_ROW, state: 'counted' }], offers: [OFFER_1], codes: [CODE_1], vouchers: [] }, written: { redemptions: [{ ...HELD_ROW, state: 'counted' }] } }),
    expect: { rows: [update('redemptions', 900, { state: 'given_back', given_back_at: NOW })] },
  },
  {
    name: 'P14 …a use the order no longer has when it is posted is given back, and the new one counted',
    input: call({
      action: 'redeem',
      lines: [line('', {})],
      uses: [{ offer: '3', code: null, voucher: null, amount: '15.00' }],
      reads: { mine: [HELD_ROW], offers: [OFFER_1, { ...OFFER_1, id: 3, name: 'Tote pair', uses: 6 }], codes: [CODE_1], vouchers: [] },
      written: { redemptions: [HELD_ROW] },
    }),
    expect: { rows: [insert('redemptions', { kind: 'offer', offer_id: 3, code_id: null, customer: null, amount: '15.00', state: 'counted' }), update('redemptions', 900, { state: 'given_back', given_back_at: NOW })] },
  },
  {
    name: 'P15 a use of a code at its last use is refused',
    input: call({ action: 'redeem', lines: [line('', {})], uses: [{ offer: '5', code: '3', voucher: null, amount: '4.80' }], reads: { mine: [], offers: [LAUNCH], codes: [LAUNCH_CODE], vouchers: [] } }),
    expect: { rows: [], refusals: [{ line: '', reason: 'used-up' }] },
  },
  {
    name: 'P15 …and the use that is the last one marks the offer used up',
    input: call({ action: 'redeem', lines: [line('', {})], uses: [{ offer: '5', code: '3', voucher: null, amount: '4.80' }], reads: { mine: [], offers: [{ ...LAUNCH, uses: 49, used_up: false }], codes: [{ ...LAUNCH_CODE, uses: 49 }], vouchers: [] } }),
    expect: { rows: [update('offers', 5, { used_up: true }), insert('redemptions', { kind: 'code', offer_id: 5, code_id: 3, amount: '4.80', state: 'counted' })] },
  },
  {
    name: 'P16 a part of a batch makes its vouchers, each a copy of the batch, none with a code',
    input: call({ action: 'make', source: { table: 'offers:batch_chunks', row: '1' }, lines: [line('', { batch: 1, size: 200 })], reads: { batch: [BATCH] } }),
    expect: { rows: Array.from({ length: 200 }, () => insert('vouchers', { batch_id: 1, worth: 'amount', value: '5.000', public_name: 'Leaflet drop, October', uses_total: 1, expires_on: '2026-11-30' })) },
  },
  {
    name: 'P17 an old card\'s first row comes in: twenty-five dollars, and the card is active',
    input: call({ action: 'move', source: { table: 'pos:gift_card_ledger', row: 'a1' }, lines: [line('', { old_card: '7', kind: 'issue', amount: '25.00', at: '2026-03-02T09:00:00.000Z' })], reads: { card: [moved('inactive', '0.00')] } }),
    expect: {
      rows: [insert('card_ledger', { card_id: 40, kind: 'issue', taken: '-25.00', value: '25.00', balance_after: '25.00', source_table: 'pos:gift_card_ledger', source_row: 'a1', at: '2026-03-02T09:00:00.000Z' }), update('gift_cards', 40, { status: 'active', issued_at: '2026-03-02T09:00:00.000Z' })],
    },
  },
  {
    name: 'P17 …its reload is a top-up',
    input: call({ action: 'move', source: { table: 'pos:gift_card_ledger', row: 'a2' }, lines: [line('', { old_card: '7', kind: 'reload', amount: '25.00', at: '2026-04-11T15:30:00.000Z' })], reads: { card: [moved('active', '25.00')] } }),
    expect: { rows: [insert('card_ledger', { kind: 'top_up', taken: '-25.00', value: '25.00', balance_after: '50.00', at: '2026-04-11T15:30:00.000Z' })] },
  },
  {
    name: 'P17 …and what was redeemed is a spend: the card comes in at $38.50',
    input: call({ action: 'move', source: { table: 'pos:gift_card_ledger', row: 'a3' }, lines: [line('', { old_card: '7', kind: 'redeem', amount: '-11.50', at: '2026-05-20T12:05:00.000Z' })], reads: { card: [moved('active', '50.00')] }, settings: { ...SETTINGS, cards_paused: true } }),
    expect: { rows: [insert('card_ledger', { kind: 'spend', taken: '11.50', value: '11.50', balance_after: '38.50' })] },
  },
  {
    name: 'P19 a cash payment in a table that also takes cards writes nothing',
    input: call({ action: 'spend', lines: [payment('p7', null, '20.00')], reads: { card: [] } }),
    expect: { rows: [] },
    also: { notes: [{ line: 'p7', note: 'not-linked' }], decides: undefined },
  },
  {
    name: 'P19 …an ordinary line beside one that loads a card',
    input: call({ action: 'issue', lines: [line('l1', { card: null, amount: '14.00' }, LINES), line('l2', { card: 2, amount: '50.00' }, LINES)], reads: { card: [card(2, 'Q4XP', '0.00', { status: 'inactive' })] } }),
    expect: { rows: [insert('card_ledger', { kind: 'issue', source_row: 'l2' }), update('gift_cards', 2, { status: 'active' })] },
    also: { notes: [{ line: 'l1', note: 'not-linked' }] },
  },
  {
    name: 'P19 …and a refund against a payment no card made',
    input: call({ action: 'refund', source: { table: REFUNDS, row: '5' }, lines: [line('', { against_table: PAYMENTS, against_row: 'cash-1', amount: '9.00' })], reads: { spend: [], card: [], given: [] } }),
    expect: { rows: [] },
    also: { notes: [{ line: '', note: 'not-linked' }] },
  },
  {
    name: 'P20 two cards pay one order: each row names the payment that paid',
    input: call({ action: 'spend', lines: [payment('p10', 1, '48.11'), payment('p11', 9, '29.11')], reads: { card: [Q4XP, K4WD] } }),
    expect: {
      rows: [
        insert('card_ledger', { card_id: 1, kind: 'spend', taken: '19.00', balance_after: '0.00', source_table: PAYMENTS, source_row: 'p10' }, 'p10'),
        insert('card_ledger', { card_id: 9, kind: 'spend', taken: '29.11', balance_after: '70.89', source_table: PAYMENTS, source_row: 'p11' }, 'p11'),
      ],
    },
  },
  {
    name: 'P20 …and a refund of the second goes to its card, against its spend',
    input: call({
      action: 'refund',
      source: { table: REFUNDS, row: '6' },
      lines: [line('', { against_table: PAYMENTS, against_row: 'p11', amount: '10.00' })],
      reads: { spend: [{ id: 71, card_id: 9, kind: 'spend', taken: '29.11', value: '29.11', source_table: PAYMENTS, source_row: 'p11' }], card: [{ ...K4WD, balance: '70.89' }], given: [] },
    }),
    expect: { rows: [insert('card_ledger', { card_id: 9, kind: 'refund', taken: '-10.00', value: '10.00', balance_after: '80.89', against_id: 71 })] },
  },
  {
    name: 'P21 an expired voucher is cancelled all the same',
    input: call({ action: 'voucher-action', lines: [line('30', { voucher: 5, action: 'void' }, 'offers:voucher_actions')], reads: { voucher: [classes(3, { status: 'expired', expires_on: '2026-09-15' })], last: [], none: [] } }),
    expect: { rows: [update('vouchers', 5, { status: 'voided' })] },
  },
];
