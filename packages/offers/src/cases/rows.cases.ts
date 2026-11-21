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
/** A web shop's lines that each sell a card to somebody: the card is made by the sale. */
export const GIFTS = 'shop:gift_lines';
/** A studio's order lines that each sell a pack, and the table a pack's uses are for. */
export const PACK_LINES = 'studio:purchase_lines';
const CATEGORIES = 'studio:categories';
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
/** A shopper's gift line: fifty dollars on a card for Mira, from Jon. */
export const gift = (key: string, more: PostingLine['inputs'] = {}): PostingLine => line(key, { card: null, amount: '50.00', to_name: 'Mira', to_email: 'mira@daybreak.example', message: 'Happy birthday!', sender: 'Jon', language: 'da-DK', ...more }, GIFTS);
/** The card the line `g1` made when its order was written, as the round wrote it. */
export const madeCard = (id: number, more: Row = {}): Row => card(id, 'M1RA', '0.00', { status: 'inactive', issued_at: null, recipient_email: 'mira@daybreak.example', notify: null, source_table: GIFTS, source_row: 'g1', ...more });
/** The row that loaded it when the order was paid. */
export const LOADED: Row = { id: 88, card_id: 31, kind: 'issue', taken: '-50.00', value: '50.00', balance_after: '50.00', source_table: GIFTS, source_row: 'g1' };
/** A row of the card `g1` made, after the sale loaded it. */
const after = (id: number, kind: string, taken: string, more: Row = {}): Row => ({ id, card_id: 31, kind, taken, value: taken.replace('-', ''), source_table: PAYMENTS, source_row: `p${String(id)}`, ...more });
/** The line names itself to the recall: its table and its key. */
const recalled = (key = 'g1') => line(key, { sale: { table: GIFTS, row: key } }, GIFTS);
/** A studio's line selling Movement Ten: ten uses of a category, for $360.00, to Ava. */
export const packLine = (key: string, more: PostingLine['inputs'] = {}): PostingLine => line(key, { amount: '360.00', name: 'Movement Ten', uses: 10, what: 'category', target: { table: CATEGORIES, row: '4' }, holder_email: 'ava@lumen.example', holder_name: 'Ava Reyes', language: 'en-US', proved: true, tax_later: false, ...more }, PACK_LINES);
/** The pack line `b1` made once its order was paid. */
export const soldPack = (more: Row = {}): Row => classes(10, { id: 70, public_name: 'Movement Ten', sale_price: '360.00', sale_table: PACK_LINES, sale_row: 'b1', holder_email: 'ava@lumen.example', ...more });
const recalledPack = (key = 'b1') => line(key, { sale: { table: PACK_LINES, row: key } }, PACK_LINES);
const standingUse = (state: string): Row => ({ id: 400, voucher_id: 70, uses: 1, state });
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
    name: 'P6 a refund taken back takes its money off the card again, against the payment it was for',
    input: call({
      action: 'refund',
      phase: 'reverse',
      source: { table: REFUNDS, row: '3' },
      lines: [line('', { against_table: PAYMENTS, against_row: 'p9', amount: '9.80' })],
      reads: { spend: [{ id: 60, card_id: 5, kind: 'spend', taken: '30.00', value: '30.00', source_table: PAYMENTS, source_row: 'p9' }], card: [card(5, 'R2MC', '29.80')], given: [{ id: 61, card_id: 5, kind: 'refund', taken: '-9.80', value: '9.80', against_id: 60, source_table: REFUNDS, source_row: '3' }] },
      written: { card_ledger: [{ id: 61, card_id: 5, kind: 'refund', taken: '-9.80', value: '9.80', balance_after: '29.80', against_id: 60, source_table: REFUNDS, source_row: '3' }] },
    }),
    expect: { rows: [insert('card_ledger', { card_id: 5, kind: 'adjust', taken: '9.80', value: '9.80', balance_after: '20.00', against_id: 60, source_table: REFUNDS, source_row: '3' })] },
  },
  {
    name: 'P6 …and takes nothing once the payment itself was undone: the card already has all of it back',
    input: call({
      action: 'refund',
      phase: 'reverse',
      source: { table: REFUNDS, row: '3' },
      lines: [line('', { against_table: PAYMENTS, against_row: 'p9', amount: '9.80' })],
      reads: {
        spend: [{ id: 60, card_id: 5, kind: 'spend', taken: '30.00', value: '30.00', source_table: PAYMENTS, source_row: 'p9' }],
        card: [card(5, 'R2MC', '50.00')],
        given: [
          { id: 61, card_id: 5, kind: 'refund', taken: '-9.80', value: '9.80', against_id: 60, source_table: REFUNDS, source_row: '3' },
          { id: 62, card_id: 5, kind: 'refund', taken: '-20.20', value: '20.20', against_id: 60, source_table: PAYMENTS, source_row: 'p9' },
        ],
      },
      written: { card_ledger: [{ id: 61, card_id: 5, kind: 'refund', taken: '-9.80', value: '9.80', balance_after: '29.80', against_id: 60, source_table: REFUNDS, source_row: '3' }] },
    }),
    expect: { rows: [] },
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
    name: 'P17a an old card nobody has made yet is made by its first row, under its old code, and the row points at it',
    input: call({ action: 'move', source: { table: 'pos:gift_card_ledger', row: 'b1' }, lines: [line('', { old_card: '9', old_code: 'gc-48219930', old_table: 'pos:gift_cards', kind: 'issue', amount: '50.00', at: '2026-03-02T09:00:00.000Z' })], reads: { card: [] }, settings: { ...SETTINGS, cards_paused: true } }),
    expect: {
      rows: [
        { op: 'insert', table: 'gift_cards', label: 'card:9', values: { kind: 'card', code: 'GC-48219930', status: 'active', issued_at: '2026-03-02T09:00:00.000Z', moved_from: '9', moved_table: 'pos:gift_cards', moving: true } },
        insert('card_ledger', { card_id: { '@row': 'card:9' }, kind: 'issue', taken: '-50.00', value: '50.00', balance_after: '50.00', at: '2026-03-02T09:00:00.000Z' }),
      ],
    },
  },
  {
    name: 'P17a …two old rows of one new card in one call make one card, and the second row counts on the first',
    input: call({ action: 'move', source: { table: 'pos:gift_card_ledger', row: 'b1' }, lines: [line('r1', { old_card: '9', old_code: 'GC-48219930', kind: 'issue', amount: '50.00', at: '2026-03-02T09:00:00.000Z' }), line('r2', { old_card: '9', old_code: 'GC-48219930', kind: 'redeem', amount: '-21.50', at: '2026-03-09T09:00:00.000Z' })], reads: { card: [] }, settings: { ...SETTINGS, cards_paused: true } }),
    expect: {
      rows: [
        { op: 'insert', table: 'gift_cards', label: 'card:9', values: { code: 'GC-48219930', moved_table: '' } },
        insert('card_ledger', { card_id: { '@row': 'card:9' }, kind: 'issue', balance_after: '50.00' }),
        insert('card_ledger', { card_id: { '@row': 'card:9' }, kind: 'spend', taken: '21.50', balance_after: '28.50' }),
      ],
    },
  },
  {
    name: 'P17a …a code the till kept with no word in front gets the word',
    input: call({ action: 'move', source: { table: 'pos:gift_card_ledger', row: 'b3' }, lines: [line('', { old_card: '11', old_code: ' 4821 9930 ', kind: 'issue', amount: '5.00', at: '2026-03-02T09:00:00.000Z' })], reads: { card: [] }, settings: { ...SETTINGS, cards_paused: true } }),
    expect: { rows: [{ op: 'insert', table: 'gift_cards', label: 'card:11', values: { code: 'GC-48219930' } }, insert('card_ledger', { kind: 'issue' })] },
  },
  {
    name: 'P17b …with the move not running, a row for a card nobody made makes none: it is refused',
    input: call({ action: 'move', source: { table: 'scratch:rows', row: 'x1' }, lines: [line('', { old_card: '9', old_code: 'GC-48219930', kind: 'issue', amount: '99999.00', at: '2026-03-02T09:00:00.000Z' })], reads: { card: [] } }),
    expect: { rows: [], refusals: [{ line: '', reason: 'not-allowed' }] },
  },
  {
    name: 'P17b …nor from a guest, latch or no latch',
    input: call({ action: 'move', more: { origin: 'public' }, lines: [line('', { old_card: '9', old_code: 'GC-48219930', kind: 'issue', amount: '5.00', at: '2026-03-02T09:00:00.000Z' })], reads: { card: [] }, settings: { ...SETTINGS, cards_paused: true } }),
    expect: { rows: [], refusals: [{ line: '', reason: 'not-allowed' }] },
  },
  {
    name: 'P17b …a till code that begins GC with no dash keeps its letters; dashes and spaces inside one are dropped',
    input: call({ action: 'move', lines: [line('a', { old_card: '12', old_code: 'gcxk4421', kind: 'issue', amount: '5.00', at: '2026-03-02T09:00:00.000Z' }), line('b', { old_card: '13', old_code: 'GC-4821-99 30', kind: 'issue', amount: '5.00', at: '2026-03-02T09:00:00.000Z' })], reads: { card: [] }, settings: { ...SETTINGS, cards_paused: true } }),
    expect: { rows: [{ op: 'insert', table: 'gift_cards', label: 'card:12', values: { code: 'GC-GCXK4421' } }, insert('card_ledger', { kind: 'issue' }), { op: 'insert', table: 'gift_cards', label: 'card:13', values: { code: 'GC-48219930' } }, insert('card_ledger', { kind: 'issue' })] },
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
    name: 'P22 a guest\'s order is written: the line makes a card for its recipient, inactive and holding nothing',
    input: call({ action: 'issue', phase: 'reserve', lines: [gift('g1')], more: { origin: 'public' } }),
    expect: {
      rows: [
        insert(
          'gift_cards',
          { kind: 'card', status: 'inactive', recipient_name: 'Mira', recipient_email: 'mira@daybreak.example', sender_name: 'Jon', message: 'Happy birthday!', language: 'da-DK', source_table: GIFTS, source_row: 'g1' },
          'g1',
        ),
      ],
    },
  },
  {
    name: 'P22 …and refused before anything is paid: too little, too much, nobody to send it to, an address that is none, a message full of digits',
    input: call({
      action: 'issue',
      phase: 'reserve',
      lines: [gift('a', { amount: '5.00' }), gift('b', { amount: '600.00' }), gift('c', { to_email: null }), gift('d', { to_email: 'mira at home' }), gift('e', { message: 'Call 0123456789 or 0123456789 0' })],
      more: { origin: 'public' },
    }),
    expect: { rows: [], refusals: ['a', 'b', 'c', 'd', 'e'].map((key) => ({ line: key, reason: 'not-allowed' as const })) },
  },
  {
    name: 'P22 …nor while the owner has paused cards',
    input: call({ action: 'issue', phase: 'reserve', lines: [gift('g1')], settings: { ...SETTINGS, cards_paused: true }, more: { origin: 'public' } }),
    expect: { rows: [], refusals: [{ line: 'g1', reason: 'not-allowed' }] },
  },
  {
    name: 'P22 …a till\'s line that names its card loads it when paid and makes none; an ordinary line loads nothing',
    input: call({ action: 'issue', phase: 'reserve', lines: [line('t1', { card: 2, amount: '50.00' }, LINES), line('t2', { card: null, amount: null }, LINES)] }),
    expect: { rows: [] },
    also: { notes: [{ line: 't2', note: 'not-linked' }] },
  },
  {
    name: 'P23 the order is paid: the card the sale made gets its fifty dollars, becomes active, and its one mail is named',
    input: call({ action: 'issue', lines: [gift('g1')], reads: { card: [], made: [madeCard(31)] }, written: { gift_cards: [madeCard(31)] }, more: { origin: 'system' } }),
    expect: {
      rows: [
        insert('card_ledger', { card_id: 31, kind: 'issue', taken: '-50.00', value: '50.00', balance_after: '50.00', source_table: GIFTS, source_row: 'g1', at: NOW }, 'g1'),
        update('gift_cards', 31, { status: 'active', issued_at: NOW, notify: 'card' }),
      ],
    },
  },
  {
    name: 'P23 …even when cards were paused since the order was written: the shopper has paid for this one',
    input: call({ action: 'issue', lines: [gift('g1')], reads: { card: [], made: [madeCard(31)] }, written: { gift_cards: [madeCard(31)] }, settings: { ...SETTINGS, cards_paused: true, card_max: '20.00' } }),
    expect: { rows: [insert('card_ledger', { card_id: 31, kind: 'issue', taken: '-50.00' }), update('gift_cards', 31, { status: 'active', notify: 'card' })] },
  },
  {
    name: 'P23 …never by a guest\'s own save: a guest pays nothing by saving, so the card a sale made is not made active, nor mailed',
    input: call({ action: 'issue', lines: [gift('g1')], reads: { card: [], made: [madeCard(31)] }, written: { gift_cards: [madeCard(31)] }, more: { origin: 'public' } }),
    expect: { rows: [], refusals: [{ line: 'g1', reason: 'not-allowed' }] },
  },
  {
    name: 'P23 …a sale paid in a round that made no card loads nothing, and staff are told to look',
    input: call({ action: 'issue', lines: [gift('g1'), line('o1', { card: null, amount: null }, GIFTS)], reads: { card: [], made: [] } }),
    expect: { rows: [] },
    also: { notes: [{ line: 'g1', note: 'to-check' }, { line: 'o1', note: 'not-linked' }] },
  },
  {
    name: 'P24 …a guest who cancels an unpaid order cancels the card it made',
    input: call({ action: 'issue', phase: 'reverse', lines: [gift('g1')], reads: { card: [], made: [madeCard(31)] }, written: { gift_cards: [madeCard(31)] }, more: { origin: 'public' } }),
    expect: { rows: [update('gift_cards', 31, { status: 'void' })] },
  },
  {
    name: 'P23 …and a card a manager cancelled while its order waited is loaded with nothing, and staff are told',
    input: call({ action: 'issue', lines: [gift('g1')], reads: { card: [], made: [madeCard(31, { status: 'void' })] }, written: { gift_cards: [madeCard(31)] } }),
    expect: { rows: [] },
    also: { notes: [{ line: 'g1', note: 'to-check' }] },
  },
  {
    name: 'P24 the order is given up unpaid: the card it made is cancelled, and nobody is told — nobody was sent it',
    input: call({ action: 'issue', phase: 'reverse', lines: [gift('g1')], reads: { card: [], made: [madeCard(31)] }, written: { gift_cards: [madeCard(31)] }, more: { origin: 'system' } }),
    expect: { rows: [update('gift_cards', 31, { status: 'void', void_reason: 'Its order was cancelled before it was paid.' })] },
  },
  {
    name: 'P24 …a paid order\'s card is not taken back by the reverse: the recall the same cancel posts runs next, and may refuse',
    input: call({
      action: 'issue',
      phase: 'reverse',
      lines: [gift('g1')],
      reads: { card: [], made: [madeCard(31, { status: 'active', balance: '50.00', notify: 'card' })] },
      written: { gift_cards: [madeCard(31)], card_ledger: [LOADED] },
    }),
    expect: { rows: [] },
  },
  {
    name: 'P25 a paid order cancelled with its card unspent: the card is written off and cancelled, and its recipient told',
    input: call({ action: 'recall', lines: [recalled()], reads: { sold: [LOADED], card: [madeCard(31, { status: 'active', balance: '50.00', notify: 'card' })], given: [], history: [LOADED] } }),
    expect: {
      rows: [
        insert('card_ledger', { card_id: 31, kind: 'void', taken: '50.00', value: '50.00', balance_after: '0.00', source_table: GIFTS, source_row: 'g1', at: NOW }, 'g1'),
        update('gift_cards', 31, { status: 'void', void_reason: 'Its order was cancelled after it was paid.', notify: 'cancelled' }),
      ],
    },
  },
  {
    name: 'P25 …with some of it spent, the cancel is refused, and says what is left',
    input: call({ action: 'recall', lines: [recalled()], reads: { sold: [LOADED], card: [madeCard(31, { status: 'active', balance: '31.40', notify: 'card' })], given: [], history: [LOADED, after(92, 'spend', '18.60')] } }),
    expect: { rows: [], refusals: [{ line: 'g1', reason: 'used-up', left: '31.40' }] },
  },
  {
    name: 'P25 …spent, then cancelled by a manager\'s hand: the card is dead, and the cancel is still refused — thirty dollars of goods went out on it',
    input: call({ action: 'recall', lines: [recalled()], reads: { sold: [LOADED], card: [madeCard(31, { status: 'void', balance: '0.00', notify: 'card' })], given: [], history: [LOADED, after(92, 'spend', '30.00'), after(93, 'void', '20.00', { source_table: 'offers:gift_cards', source_row: '31' })] } }),
    expect: { rows: [], refusals: [{ line: 'g1', reason: 'used-up', left: '0.00' }] },
  },
  {
    name: 'P25 …spent, then topped up at a till to the fifty it began with: the spending is read from the card\'s rows, not its balance',
    input: call({ action: 'recall', lines: [recalled()], reads: { sold: [LOADED], card: [madeCard(31, { status: 'active', balance: '50.00', notify: 'card' })], given: [], history: [LOADED, after(92, 'spend', '30.00'), after(94, 'top_up', '-30.00', { source_table: LINES, source_row: 'l9' })] } }),
    expect: { rows: [], refusals: [{ line: 'g1', reason: 'used-up', left: '50.00' }] },
  },
  {
    name: 'P25 …a payment by the card given all its money back is no spending: the card is cancelled',
    input: call({ action: 'recall', lines: [recalled()], reads: { sold: [LOADED], card: [madeCard(31, { status: 'active', balance: '50.00', notify: 'card' })], given: [], history: [LOADED, after(92, 'spend', '30.00'), after(95, 'refund', '-30.00', { against_id: 92 })] } }),
    expect: { rows: [insert('card_ledger', { card_id: 31, kind: 'void', taken: '50.00', balance_after: '0.00' }), update('gift_cards', 31, { status: 'void', notify: 'cancelled' })] },
  },
  {
    name: 'P25 …a card a manager took value off by hand, still in use and holding less than the sale put on it, is refused too',
    input: call({ action: 'recall', lines: [recalled()], reads: { sold: [LOADED], card: [madeCard(31, { status: 'active', balance: '40.00' })], given: [], history: [LOADED, after(96, 'adjust', '10.00', { source_table: 'offers:card_actions', source_row: '4' })] } }),
    expect: { rows: [], refusals: [{ line: 'g1', reason: 'used-up', left: '40.00' }] },
  },
  {
    name: 'P25 …a card that ran out by its last day without a cent spent is dead already: nothing to recall, and the order\'s money may go back',
    input: call({ action: 'recall', lines: [recalled()], reads: { sold: [LOADED], card: [madeCard(31, { status: 'expired', balance: '0.00' })], given: [], history: [LOADED, after(97, 'expire', '50.00', { source_table: 'offers:gift_cards', source_row: '31' })] } }),
    expect: { rows: [] },
  },
  {
    name: 'P25 …but one spent before it ran out is refused, like any spent card',
    input: call({ action: 'recall', lines: [recalled()], reads: { sold: [LOADED], card: [madeCard(31, { status: 'expired', balance: '0.00' })], given: [], history: [LOADED, after(92, 'spend', '5.00'), after(97, 'expire', '45.00', { source_table: 'offers:gift_cards', source_row: '31' })] } }),
    expect: { rows: [], refusals: [{ line: 'g1', reason: 'used-up', left: '0.00' }] },
  },
  {
    name: 'P25 …a line that loaded no card, a card already cancelled, and a sale already taken back have nothing to recall',
    input: call({
      action: 'recall',
      lines: [recalled('g7'), recalled('g1'), recalled('g2')],
      reads: {
        sold: [LOADED, { ...LOADED, id: 90, card_id: 32, source_row: 'g2' }],
        card: [madeCard(31, { status: 'void', balance: '0.00' }), madeCard(32, { status: 'active', balance: '0.00', source_row: 'g2' })],
        given: [{ id: 91, card_id: 32, kind: 'adjust', taken: '50.00', value: '50.00', against_id: 90, source_table: GIFTS, source_row: 'g2' }],
        history: [LOADED, after(93, 'void', '50.00', { source_table: 'offers:gift_cards', source_row: '31' }), { ...LOADED, id: 90, card_id: 32, source_row: 'g2' }, { id: 91, card_id: 32, kind: 'adjust', taken: '50.00', value: '50.00', against_id: 90, source_table: GIFTS, source_row: 'g2' }],
      },
    }),
    expect: { rows: [] },
    also: { notes: [{ line: 'g7', note: 'not-linked' }] },
  },
  {
    name: 'P25 …a card topped up since is cancelled whole, with a word to staff; a reason the host gives is kept',
    input: call({ action: 'recall', lines: [line('g1', { sale: { table: GIFTS, row: 'g1' }, reason: 'Refunded at the bank' }, GIFTS)], reads: { sold: [LOADED], card: [madeCard(31, { status: 'active', balance: '70.00' })], given: [], history: [LOADED, after(94, 'top_up', '-20.00', { source_table: LINES, source_row: 'l9' })] } }),
    expect: { rows: [insert('card_ledger', { card_id: 31, kind: 'void', taken: '70.00', balance_after: '0.00' }), update('gift_cards', 31, { status: 'void', void_reason: 'Refunded at the bank' })] },
    also: { notes: [{ line: 'g1', note: 'to-check' }] },
  },
  {
    name: 'P21 an expired voucher is cancelled all the same',
    input: call({ action: 'voucher-action', lines: [line('30', { voucher: 5, action: 'void' }, 'offers:voucher_actions')], reads: { voucher: [classes(3, { status: 'expired', expires_on: '2026-09-15' })], last: [], none: [] } }),
    expect: { rows: [update('vouchers', 5, { status: 'voided' })] },
  },
  {
    name: 'P26 a card can be dated: the day goes on the card the sale makes',
    input: call({ action: 'issue', phase: 'reserve', lines: [gift('g1', { send_on: '2026-10-20' })], reads: { card: [], made: [] } }),
    expect: { rows: [insert('gift_cards', { kind: 'card', status: 'inactive', recipient_email: 'mira@daybreak.example', send_on: '2026-10-20', source_table: GIFTS, source_row: 'g1' })] },
  },
  {
    name: 'P26 …today is a day it can go, and no day at all is "now"',
    input: call({ action: 'issue', phase: 'reserve', lines: [gift('g1', { send_on: '2026-10-01' }), gift('g2')], reads: { card: [], made: [] } }),
    expect: { rows: [insert('gift_cards', { send_on: '2026-10-01' }), insert('gift_cards', { source_row: 'g2' })] },
  },
  {
    name: 'P26 …a day past, a day that does not exist, and a day over a year ahead are refused before anything is paid',
    input: call({ action: 'issue', phase: 'reserve', lines: [gift('g1', { send_on: '2026-09-30' }), gift('g2', { send_on: '2026-02-30' }), gift('g3', { send_on: '2027-10-03' })], reads: { card: [], made: [] } }),
    expect: { rows: [], refusals: [{ line: 'g1', reason: 'not-allowed' }, { line: 'g2', reason: 'not-allowed' }, { line: 'g3', reason: 'not-allowed' }] },
  },
  {
    name: 'P26 …and so is a day after the last day a card sold today would have: its mail would be dropped unsent',
    input: call({ action: 'issue', phase: 'reserve', lines: [gift('g1', { send_on: '2026-11-02' }), gift('g2', { send_on: '2026-11-01' })], reads: { card: [], made: [] }, settings: { ...SETTINGS, card_expiry_months: 1 } }),
    expect: { rows: [insert('gift_cards', { send_on: '2026-11-01', source_row: 'g2' })], refusals: [{ line: 'g1', reason: 'not-allowed' }] },
  },
  {
    name: 'P26 …and until its day a dated card is not spent online',
    input: call({ action: 'spend', lines: [payment('p1', 2, '20.00')], reads: { card: [card(2, 'Q4XP', '50.00', { notify: 'card_dated', send_on: '2026-10-20' })] }, more: { origin: 'public' } }),
    expect: { rows: [], refusals: [{ line: 'p1', reason: 'inactive' }] },
  },
  {
    name: 'P26 …from its day it is, and at a desk it always was',
    input: call({ action: 'spend', lines: [payment('p1', 2, '20.00'), payment('p2', 3, '20.00')], reads: { card: [card(2, 'Q4XP', '50.00', { notify: 'card_dated', send_on: '2026-10-01' }), card(3, 'K4WD', '50.00', { notify: 'card_dated', send_on: '2026-10-20' })] } }),
    expect: { rows: [insert('card_ledger', { card_id: 2, kind: 'spend', taken: '20.00' }), insert('card_ledger', { card_id: 3, kind: 'spend', taken: '20.00' })] },
  },
  {
    name: 'P27 a pack is judged when its order is written, and nothing is made until it is paid',
    input: call({ action: 'sell-pack', phase: 'reserve', lines: [packLine('b1')], reads: { made: [] }, more: { origin: 'public' } }),
    expect: { rows: [] },
  },
  {
    name: 'P27 …a guest who has not proved who they are cannot buy one',
    input: call({ action: 'sell-pack', phase: 'reserve', lines: [packLine('b1', { proved: false }), packLine('b2', { proved: null })], reads: { made: [] }, more: { origin: 'public' } }),
    expect: { rows: [], refusals: [{ line: 'b1', reason: 'needs-customer' }, { line: 'b2', reason: 'needs-customer' }] },
  },
  {
    name: 'P27 …a pack with no price, no uses, too many uses, an unknown target or no real address is refused before anything is paid',
    input: call({ action: 'sell-pack', phase: 'reserve', lines: [packLine('b1', { amount: '0.00' }), packLine('b2', { uses: 0 }), packLine('b3', { uses: 51 }), packLine('b4', { what: 'everything' }), packLine('b5', { holder_email: 'ava' }), packLine('b6', { name: '   ' })], reads: { made: [] } }),
    expect: { rows: [], refusals: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'].map((key) => ({ line: key, reason: 'not-allowed' as const })) },
  },
  {
    name: 'P28 paid: the pack is made, sold, with its holder, what it covers, its uses and the line that sold it',
    input: call({ action: 'sell-pack', lines: [packLine('b1')], reads: { made: [] } }),
    expect: { rows: [insert('vouchers', { worth: 'pack', what: 'category', source_table: CATEGORIES, source_row: '4', units: 1, public_name: 'Movement Ten', uses_total: 10, holder_email: 'ava@lumen.example', holder_name: 'Ava Reyes', language: 'en-US', sold: true, sale_price: '360.00', tax_later: false, sale_table: PACK_LINES, sale_row: 'b1' })] },
  },
  {
    name: 'P28 …its last day is so many months from the day it is paid, where the place sets one',
    input: call({ action: 'sell-pack', lines: [packLine('b1')], reads: { made: [] }, settings: { ...SETTINGS, pack_expiry_months: 6 } }),
    expect: { rows: [insert('vouchers', { public_name: 'Movement Ten', expires_on: '2027-04-01' })] },
  },
  {
    name: 'P28 …a guest\'s own save never pays for one',
    input: call({ action: 'sell-pack', lines: [packLine('b1')], reads: { made: [] }, more: { origin: 'public' } }),
    expect: { rows: [], refusals: [{ line: 'b1', reason: 'not-allowed' }] },
  },
  {
    name: 'P28 …and a line posted again in the same round does not make a second pack',
    input: call({ action: 'sell-pack', lines: [packLine('b1')], reads: { made: [soldPack()] }, written: { vouchers: [soldPack()] } }),
    expect: { rows: [] },
  },
  {
    name: 'P29 a cancel undoes nothing by itself: an unpaid order made no pack, and a paid one is the recall\'s',
    input: call({ action: 'sell-pack', phase: 'reverse', lines: [packLine('b1')], reads: { made: [soldPack()] }, written: { vouchers: [soldPack()] } }),
    expect: { rows: [] },
  },
  {
    name: 'P30 a paid pack with no use taken is cancelled with its sale',
    input: call({ action: 'recall-pack', lines: [recalledPack()], reads: { pack: [soldPack()], spent: [] } }),
    expect: { rows: [update('vouchers', 70, { status: 'voided' })] },
  },
  {
    name: 'P30 …a use that was given back no longer stands in the way',
    input: call({ action: 'recall-pack', lines: [recalledPack()], reads: { pack: [soldPack()], spent: [standingUse('given_back')] } }),
    expect: { rows: [update('vouchers', 70, { status: 'voided' })] },
  },
  {
    name: 'P30 …the order paid again re-arms the recall, and writes nothing',
    input: call({ action: 'recall-pack', phase: 'reverse', lines: [recalledPack()], reads: { pack: [soldPack()], spent: [] } }),
    expect: { rows: [] },
  },
  {
    name: 'P30 …one use counted refuses the refund, and says what is left',
    input: call({ action: 'recall-pack', lines: [recalledPack()], reads: { pack: [soldPack({ uses_left: 9 })], spent: [standingUse('counted')] } }),
    expect: { rows: [], refusals: [{ line: 'b1', reason: 'used-up', left: '9' }] },
  },
  {
    name: 'P30 …so does a use only held by a booking still waiting to be paid',
    input: call({ action: 'recall-pack', lines: [recalledPack()], reads: { pack: [soldPack({ uses_left: 9 })], spent: [standingUse('held')] } }),
    expect: { rows: [], refusals: [{ line: 'b1', reason: 'used-up', left: '9' }] },
  },
  {
    name: 'P30 …a pack already cancelled, or past its last day unused, has nothing to recall; a line that sold none is told',
    input: call({ action: 'recall-pack', lines: [recalledPack('b9'), recalledPack('b1'), recalledPack('b2')], reads: { pack: [soldPack({ status: 'voided' }), soldPack({ id: 71, sale_row: 'b2', status: 'expired' })], spent: [] } }),
    expect: { rows: [] },
    also: { notes: [{ line: 'b9', note: 'not-linked' }] },
  },
];
