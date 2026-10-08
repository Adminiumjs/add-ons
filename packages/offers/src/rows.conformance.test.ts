/**
 * THE CONTRACT'S OWN CHECKS, AND THE WORKED POSTINGS, OVER THE BUILT FILE.
 *
 * `posting-rows@1` ships a conformance suite: the answer has the contract's
 * shape, writes only the tables and columns the ledger lets it, says the same
 * twice and under another clock, answers a look ahead as it answers the save,
 * and never refuses a reverse. It is run here over every worked posting,
 * against the file an install would run, in the bare context a save runs it
 * in. What the suite does not compare — the amounts decided, what staff are
 * told, that a round and its reverse leave a card where it was — is held
 * below.
 */

import { postingRowsConformance, type PostingRowsCase } from '@adminium/add-on-contracts/testing';
import type { PostingInput, PostingOutput } from '@adminium/add-on-contracts';
import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };
import { call, card, classes, line, LINES, PAYMENTS, ROWS_CASES, SETTINGS } from './cases/rows.cases.ts';
import { buildForReal } from './testing/build.ts';
import { builtProvider, builtServer } from './testing/vm.ts';

// Built before the suite is registered: its first check reads the file's own text.
buildForReal();
const provider = builtProvider();
const ledger = manifest.addOn.ledgers[0] as unknown as { id: string; writes: Record<string, { insert?: string[]; update?: { by: string[]; set: string[] } }>; actions: Record<string, unknown> };

postingRowsConformance(provider, {
  /*
   * No column is given to the suite to add up over a round and its reverse.
   * The suite reverses a case with the reads the case came with — a card as
   * it stood BEFORE the round — and a reverse here reads the card as it
   * stands now, to take back no more than is on it. That a round and its
   * reverse leave a card where it was is held below, with the card read again
   * in between, as Adminium reads it.
   */
  ledgers: { [ledger.id]: { writes: ledger.writes } },
  cases: ROWS_CASES.map((one): PostingRowsCase => ({ name: one.name, input: one.input, expect: one.expect })),
  source: builtServer(),
});

type Values = Record<string, unknown>;
const inserted = (out: PostingOutput, table: string): Values[] => out.rows.flatMap((row) => (row.op === 'insert' && row.table === table ? [row.values as Values] : []));
const updates = (out: PostingOutput, table: string): Values[] => out.rows.flatMap((row) => (row.op === 'update' && row.table === table ? [{ ...row.key, ...row.set }] : []));
const cents = (value: unknown): number => Math.round(Number(value) * 100);

describe('what the shared suite does not compare', () => {
  it('names every case of the design that is a posting, each at least once', () => {
    const numbers = new Set(ROWS_CASES.map((one) => /^P(\d+) /.exec(one.name)?.[1]));
    // P18 — a round and its reverse — is the test below this one.
    for (let n = 1; n <= 21; n += 1) if (n !== 18) expect(numbers, `P${String(n)}`).toContain(String(n));
    expect(new Set(ROWS_CASES.map((one) => one.input.action))).toEqual(new Set(['spend', 'refund', 'issue', 'card-action', 'void', 'expire', 'voucher-action', 'redeem', 'make', 'move']));
  });

  for (const one of ROWS_CASES.filter((candidate) => candidate.also !== undefined)) {
    it(one.name, () => {
      const answer = provider.rows(one.input);
      if ('decides' in one.also!) expect(answer.decides).toEqual(one.also!.decides);
      if (one.also!.notes !== undefined) expect(answer.notes).toEqual(one.also!.notes);
    });
  }

  it('P18 a round and its reverse leave every card where it was', () => {
    let seen = 0;
    for (const one of ROWS_CASES) {
      if (one.input.phase === 'reverse') continue;
      const first = provider.rows(one.input);
      const rows = inserted(first, 'card_ledger');
      if ((first.refusals ?? []).length > 0 || rows.length === 0) continue;
      seen += 1;
      // The round's rows as Adminium hands them back, and each card as it stands after them.
      const written = rows.map((values, at) => ({ id: 500 + at, ...values }) as Record<string, string | number | null>);
      const cards = ((one.input.reads['card'] ?? []) as Record<string, string | number | boolean | null>[]).map((row) => {
        const last = [...rows].reverse().find((values) => String(values['card_id']) === String(row['id']));
        return last === undefined ? row : { ...row, balance: String(last['balance_after']), status: row['status'] === 'inactive' ? 'active' : row['status'] };
      });
      const back = provider.rows({ ...one.input, phase: 'reverse', written: { card_ledger: written }, reads: { ...one.input.reads, card: cards } });
      const undone = inserted(back, 'card_ledger');
      expect(back.refusals, one.name).toBeUndefined();
      expect(undone, one.name).toHaveLength(rows.length);
      // What was taken, taken back to the cent; each row against the one it undoes.
      expect(rows.reduce((total, values) => total + cents(values['taken']), 0) + undone.reduce((total, values) => total + cents(values['taken']), 0), one.name).toBe(0);
      expect(undone.map((values) => values['against_id']), one.name).toEqual(written.map((row) => row['id']));
      for (const row of cards) {
        const before = ((one.input.reads['card'] ?? []) as Record<string, unknown>[]).find((candidate) => candidate['id'] === row['id'])!;
        const last = [...undone].reverse().find((values) => String(values['card_id']) === String(row['id']));
        if (last !== undefined) expect(cents(last['balance_after']), `${one.name}: card ${String(row['id'])}`).toBe(cents(before['balance']));
      }
      expect(back.notes ?? [], one.name).toEqual([]);
    }
    expect(seen).toBeGreaterThan(12);
  });

  it('a reverse that finds less on the card than it would take back takes what is there, and says so', () => {
    // Fifty loaded by a sale line, thirty-one forty left after a payment: the sale undone takes the thirty-one forty.
    const issued = { id: 9, card_id: 2, kind: 'issue', taken: '-50.00', value: '50.00', balance_after: '50.00', source_table: LINES, source_row: 'l1' };
    const back = provider.rows(call({ action: 'issue', phase: 'reverse', lines: [line('l1', { card: 2, amount: '50.00' }, LINES)], reads: { card: [card(2, 'Q4XP', '31.40')] }, written: { card_ledger: [issued] } }));
    expect(inserted(back, 'card_ledger')).toEqual([expect.objectContaining({ card_id: 2, kind: 'adjust', taken: '31.40', value: '31.40', balance_after: '0.00', against_id: 9 })]);
    expect(back.notes).toEqual([{ line: 'l1', note: 'to-check' }]);
    expect(back.refusals).toBeUndefined();
    // With the fifty still there, all of it and no word.
    const whole = provider.rows(call({ action: 'issue', phase: 'reverse', lines: [line('l1', { card: 2, amount: '50.00' }, LINES)], reads: { card: [card(2, 'Q4XP', '50.00')] }, written: { card_ledger: [issued] } }));
    expect(inserted(whole, 'card_ledger')).toEqual([expect.objectContaining({ taken: '50.00', balance_after: '0.00' })]);
    expect(whole.notes).toBeUndefined();
  });

  it('a card payment by a guest is refused for store credit, and taken for a card', () => {
    const paid = (kind: string, origin: PostingInput['origin']) => provider.rows(call({ action: 'spend', lines: [line('p', { card: 3, due: '10.00' }, PAYMENTS)], reads: { card: [card(3, 'X', '25.00', { kind })] }, more: { origin } }));
    expect(paid('credit', 'public').refusals).toEqual([{ line: 'p', reason: 'not-valid' }]);
    expect(paid('credit', 'staff').refusals).toBeUndefined();
    expect(paid('card', 'public').refusals).toBeUndefined();
  });

  it('a card is good through its last day, and a top-up names no mail', () => {
    const paid = (expires: string) => provider.rows(call({ action: 'spend', lines: [line('p', { card: 3, due: '10.00' }, PAYMENTS)], reads: { card: [card(3, 'X', '25.00', { expires_on: expires })] } })).refusals;
    expect(paid('2026-10-01')).toBeUndefined();
    expect(paid('2026-09-30')).toEqual([{ line: 'p', reason: 'expired' }]);
    // More value on a card in use moves its last day and says nothing of a mail: the card's own mail went when it was first loaded.
    const topUp = provider.rows(ROWS_CASES.find((one) => one.name.startsWith('P9'))!.input);
    expect(updates(topUp, 'gift_cards')).toEqual([{ id: 7, expires_on: '2027-10-01', remind_on: '2027-09-01' }]);
  });

  it('a refund finds the payment it goes back to among several, and gives back something', () => {
    const spends = [
      { id: 70, card_id: 1, kind: 'spend', taken: '19.00', value: '19.00', source_table: PAYMENTS, source_row: 'p10' },
      { id: 71, card_id: 9, kind: 'spend', taken: '29.11', value: '29.11', source_table: PAYMENTS, source_row: 'p11' },
    ];
    const back = (row: string, amount: string | null) => provider.rows(call({ action: 'refund', lines: [line('', { against_table: PAYMENTS, against_row: row, amount })], reads: { spend: spends, card: [card(1, 'Q4XP', '0.00'), card(9, 'K4WD', '70.89')], given: [] } }));
    expect(inserted(back('p11', '5.00'), 'card_ledger')).toEqual([expect.objectContaining({ card_id: 9, against_id: 71, taken: '-5.00', balance_after: '75.89' })]);
    expect(inserted(back('p10', '5.00'), 'card_ledger')).toEqual([expect.objectContaining({ card_id: 1, against_id: 70, balance_after: '5.00' })]);
    for (const amount of ['0.00', '-1.00', null]) expect(back('p11', amount).refusals, String(amount)).toEqual([{ line: '', reason: 'not-allowed' }]);
    // Two refunds of one payment in one call: the second is judged on what the first left.
    const twice = provider.rows(call({ action: 'refund', lines: [line('r1', { against_table: PAYMENTS, against_row: 'p10', amount: '10.00' }), line('r2', { against_table: PAYMENTS, against_row: 'p10', amount: '9.01' })], reads: { spend: spends, card: [card(1, 'Q4XP', '0.00')], given: [] } }));
    expect(twice.refusals).toEqual([{ line: 'r2', reason: 'refund-over', left: '9.00' }]);
  });

  it('a payment of exactly what is asked: never more than is due, never more than the card holds', () => {
    const asked = (ask: string, due: string, balance: string) => provider.rows(call({ action: 'spend', lines: [line('p', { card: 3, due, ask }, PAYMENTS)], reads: { card: [card(3, 'X', balance)] } }));
    expect(asked('10.00', '10.00', '10.00').decides).toEqual([{ line: 'p', input: 'amount', value: '10.00' }, { line: 'p', input: 'balance_after', value: '0.00' }]);
    expect(asked('10.01', '10.00', '50.00').refusals).toEqual([{ line: 'p', reason: 'not-allowed' }]);
    expect(asked('10.00', '20.00', '9.99').refusals).toEqual([{ line: 'p', reason: 'empty', left: '9.99' }]);
    expect(asked('0.00', '20.00', '50.00').refusals).toEqual([{ line: 'p', reason: 'not-allowed' }]);
  });

  it('nothing due, or a card holding nothing, pays nothing', () => {
    const paid = (due: string | null, balance: string) => provider.rows(call({ action: 'spend', lines: [line('p', { card: 3, due }, PAYMENTS)], reads: { card: [card(3, 'X', balance)] } }));
    expect(paid('0.00', '50.00').refusals).toEqual([{ line: 'p', reason: 'not-allowed' }]);
    expect(paid(null, '50.00').refusals).toEqual([{ line: 'p', reason: 'not-allowed' }]);
    expect(paid('10.00', '0.00').refusals).toEqual([{ line: 'p', reason: 'empty', left: '0.00' }]);
  });

  it('works at the finest scale a figure came in, and never coarser than cents', () => {
    const fine = provider.rows(call({ action: 'spend', lines: [line('p', { card: 3, due: '1.2345' }, PAYMENTS)], reads: { card: [card(3, 'X', '10.0000')] } }));
    expect(inserted(fine, 'card_ledger')[0]).toMatchObject({ taken: '1.2345', balance_after: '8.7655' });
    // A balance one database hands over with four decimals is told as another tells it with two.
    const padded = provider.rows(call({ action: 'spend', lines: [line('p', { card: 3, due: '10.1200', ask: '20.0000' }, PAYMENTS)], reads: { card: [card(3, 'X', '62.0000')] } }));
    expect(padded.refusals).toEqual([{ line: 'p', reason: 'not-allowed' }]);
    const short = provider.rows(call({ action: 'spend', lines: [line('p', { card: 3, due: '99.0000', ask: '70.0000' }, PAYMENTS)], reads: { card: [card(3, 'X', '62.5000')] } }));
    expect(short.refusals).toEqual([{ line: 'p', reason: 'empty', left: '62.50' }]);
    const exact = provider.rows(call({ action: 'spend', lines: [line('p', { card: 3, due: '10.1200' }, PAYMENTS)], reads: { card: [card(3, 'X', '62.0000')] } }));
    expect(inserted(exact, 'card_ledger')[0]).toMatchObject({ taken: '10.12', balance_after: '51.88' });
    expect(exact.decides).toEqual([{ line: 'p', input: 'amount', value: '10.12' }, { line: 'p', input: 'balance_after', value: '51.88' }]);
    const whole = provider.rows(call({ action: 'spend', lines: [line('p', { card: 3, due: 1900 }, PAYMENTS)], reads: { card: [card(3, 'X', 5000 as never)] } }));
    expect(inserted(whole, 'card_ledger')[0]).toMatchObject({ taken: '1900.00', balance_after: '3100.00' });
  });

  it('a correction by hand goes either way, and never below nothing', () => {
    const adjusted = (amount: string, balance: string, more = {}) =>
      provider.rows(call({ action: 'card-action', lines: [line('1', { card: 3, action: 'adjust', amount, reason: 'Counted again' }, 'offers:card_actions')], reads: { card: [card(3, 'X', balance, more)] }, settings: { ...SETTINGS, cards_paused: true } }));
    // More on the card, and less: signed as the holder sees it. A correction is no load: it goes on while cards are brought in.
    expect(inserted(adjusted('5.00', '20.00'), 'card_ledger')[0]).toMatchObject({ kind: 'adjust', taken: '-5.00', value: '5.00', balance_after: '25.00', note: 'Counted again' });
    expect(inserted(adjusted('-5.00', '20.00'), 'card_ledger')[0]).toMatchObject({ kind: 'adjust', taken: '5.00', value: '5.00', balance_after: '15.00' });
    expect(adjusted('-20.00', '20.00').refusals).toBeUndefined();
    expect(adjusted('-20.01', '20.00').refusals).toEqual([{ line: '1', reason: 'empty', left: '20.00' }]);
    expect(adjusted('0.00', '20.00').refusals).toEqual([{ line: '1', reason: 'not-allowed' }]);
    expect(adjusted('5.00', '0.00', { status: 'inactive' }).refusals).toEqual([{ line: '1', reason: 'inactive' }]);
    expect(adjusted('5.00', '0.00', { status: 'void' }).refusals).toEqual([{ line: '1', reason: 'void' }]);
  });

  it('value is never put on a cancelled or an expired card', () => {
    const loaded = (more: Record<string, string>) => provider.rows(call({ action: 'issue', lines: [line('l', { card: 3, amount: '20.00' }, LINES)], reads: { card: [card(3, 'X', '0.00', more)] } })).refusals;
    expect(loaded({ status: 'void' })).toEqual([{ line: 'l', reason: 'void' }]);
    expect(loaded({ status: 'expired' })).toEqual([{ line: 'l', reason: 'expired' }]);
    expect(loaded({ expires_on: '2026-09-30' })).toEqual([{ line: 'l', reason: 'expired' }]);
    expect(loaded({ expires_on: '2026-10-01' })).toBeUndefined();
    // A sale line with a card and no amount is no load at all.
    expect(provider.rows(call({ action: 'issue', lines: [line('l', { card: 3, amount: null }, LINES)], reads: { card: [card(3, 'X', '0.00')] } })).refusals).toEqual([{ line: 'l', reason: 'not-allowed' }]);
  });

  it('a card\'s months are counted from today by the calendar, and credit has none', () => {
    const days = (today: string, months: number, more = {}) =>
      updates(provider.rows(call({ action: 'issue', lines: [line('l', { card: 3, amount: '20.00' }, LINES)], reads: { card: [card(3, 'X', '0.00', { status: 'inactive', ...more })] }, settings: { ...SETTINGS, card_expiry_months: months, card_reminder_days: 30 }, more: { today } })), 'gift_cards')[0];
    expect(days('2026-10-01', 12)).toMatchObject({ expires_on: '2027-10-01', remind_on: '2027-09-01' });
    // The last of January and one month is the last of February; a leap year has its twenty-ninth.
    expect(days('2027-01-31', 1)).toMatchObject({ expires_on: '2027-02-28', remind_on: '2027-01-29' });
    expect(days('2028-01-31', 1)).toMatchObject({ expires_on: '2028-02-29' });
    expect(days('2026-11-30', 3)).toMatchObject({ expires_on: '2027-02-28' });
    expect(days('2026-10-01', 120)).toMatchObject({ expires_on: '2036-10-01' });
    // No limit set: no last day, and no reminder.
    const none = updates(provider.rows(call({ action: 'issue', lines: [line('l', { card: 3, amount: '20.00' }, LINES)], reads: { card: [card(3, 'X', '0.00', { status: 'inactive' })] } })), 'gift_cards')[0]!;
    expect(Object.keys(none).sort()).toEqual(['id', 'issued_at', 'notify', 'status']);
  });

  it('a voucher sold on a sale line stops waiting and carries what it was sold for; the sale undone, it waits again', () => {
    const waiting = classes(10, { awaiting_sale: true, sold: false, sale_price: null });
    const sold = provider.rows(call({ action: 'sell', lines: [line('l', { voucher: 5, amount: '120.00', tax_later: true }, LINES), line('m', { voucher: null, amount: '14.00' }, LINES)], reads: { voucher: [waiting] } }));
    expect(updates(sold, 'vouchers')).toEqual([{ id: 5, sold: true, awaiting_sale: false, sale_price: '120.00', tax_later: true }]);
    expect(sold.notes).toEqual([{ line: 'm', note: 'not-linked' }]);
    // One that is not waiting for a sale, or a sale with no amount.
    expect(provider.rows(call({ action: 'sell', lines: [line('l', { voucher: 5, amount: '120.00' }, LINES)], reads: { voucher: [classes(10)] } })).refusals).toEqual([{ line: 'l', reason: 'not-allowed' }]);
    expect(provider.rows(call({ action: 'sell', lines: [line('l', { voucher: 5, amount: null }, LINES)], reads: { voucher: [waiting] } })).refusals).toEqual([{ line: 'l', reason: 'not-allowed' }]);
    const undo = (voucher: Record<string, string | number | boolean | null>) => provider.rows(call({ action: 'sell', phase: 'reverse', lines: [line('l', { voucher: 5, amount: '120.00' }, LINES)], reads: { voucher: [voucher] } }));
    expect(updates(undo(classes(10)), 'vouchers')).toEqual([{ id: 5, sold: false, awaiting_sale: true, sale_price: null }]);
    // Used since: it is left as it is, and staff are told to look.
    expect(undo(classes(9))).toEqual({ rows: [], notes: [{ line: 'l', note: 'to-check' }] });
  });

  it('a voucher used by hand that is cancelled, past its day or not yet sold is refused; one already cancelled is not cancelled twice', () => {
    const by = (action: string, voucher: Record<string, string | number | boolean | null>, last: Record<string, string | number | null>[] = []) =>
      provider.rows(call({ action: 'voucher-action', lines: [line('1', { voucher: 5, action }, 'offers:voucher_actions')], reads: { voucher: [voucher], last, none: [] } }));
    expect(by('use', classes(3, { status: 'voided' })).refusals).toEqual([{ line: '1', reason: 'void' }]);
    expect(by('use', classes(3, { expires_on: '2026-09-30' })).refusals).toEqual([{ line: '1', reason: 'expired' }]);
    expect(by('use', classes(3, { awaiting_sale: true })).refusals).toEqual([{ line: '1', reason: 'inactive' }]);
    expect(by('void', classes(3, { status: 'voided' })).refusals).toEqual([{ line: '1', reason: 'void' }]);
    // Nothing counted to give back; and a use given back to a pack still in use changes nothing of the pack.
    expect(by('give_back', classes(10)).refusals).toEqual([{ line: '1', reason: 'not-allowed' }]);
    expect(by('give_back', classes(6), [{ id: 7, voucher_id: 5, state: 'counted', at: '2026-09-24T18:00:00.000Z' }]).rows).toEqual([{ op: 'update', table: 'redemptions', line: '1', key: { id: 7 }, set: { state: 'given_back', given_back_at: '2026-10-01T10:00:00.000Z' } }]);
    // A voucher that was given away, not sold, has nothing paid for it.
    expect(inserted(by('use', classes(6, { sold: false, sale_price: null })), 'redemptions')[0]).toMatchObject({ prepaid: null });
    expect(inserted(by('use', classes(6, { sold: false, sale_price: '50.00' })), 'redemptions')[0]).toMatchObject({ prepaid: null });
  });

  it('the uses of a sold pack add up to exactly what it was sold for', () => {
    // Three uses of a pack sold for $100.00: 33.33, 33.33 and the rest.
    const shares = [3, 2, 1].map((left) => inserted(provider.rows(call({ action: 'voucher-action', lines: [line('1', { voucher: 5, action: 'use' }, 'offers:voucher_actions')], reads: { voucher: [classes(left, { uses_total: 3, sale_price: '100.00' })], last: [], none: [] } })), 'redemptions')[0]!['prepaid']);
    expect(shares).toEqual(['33.33', '33.33', '33.34']);
  });

  it('a use of a voucher on an order: its units, what was paid for them, and the pack marked used at its last', () => {
    const used = (units: number, left: number) =>
      provider.rows(call({ action: 'redeem', lines: [line('', {})], uses: [{ offer: null, code: null, voucher: '5', amount: '30.00', units }], reads: { mine: [], offers: [], codes: [], vouchers: [classes(left)] } }));
    expect(inserted(used(2, 6), 'redemptions')[0]).toMatchObject({ kind: 'pack', voucher_id: 5, offer_id: null, uses: 2, amount: '30.00', prepaid: '24.00', state: 'counted' });
    expect(updates(used(2, 6), 'vouchers')).toEqual([]);
    expect(updates(used(2, 2), 'vouchers')).toEqual([{ id: 5, status: 'used' }]);
    expect(used(3, 2).refusals).toEqual([{ line: '', reason: 'used-up' }]);
  });

  it('what staff took off by hand is a use with its reason, and names no offer', () => {
    const out = provider.rows(call({ action: 'redeem', lines: [line('', { reason: 2 })], uses: [{ offer: null, code: null, voucher: null, amount: '4.98' }, { offer: '1', code: '1', voucher: null, amount: '4.95' }], reads: { mine: [], offers: [{ id: 1, max_uses: null, uses: 0, budget_open: true }], codes: [{ id: 1, max_uses: null, uses: 0 }], vouchers: [] } }));
    expect(inserted(out, 'redemptions').map((row) => `${String(row['kind'])} ${String(row['reason_id'])} ${String(row['amount'])}`)).toEqual(['staff 2 4.98', 'code null 4.95']);
  });

  it('an offer\'s budget covers a use whole or not at all, and the use that spends it marks the offer', () => {
    const used = (amount: string, left: string) =>
      provider.rows(call({ action: 'redeem', lines: [line('', {})], uses: [{ offer: '4', code: null, voucher: null, amount }], reads: { mine: [], offers: [{ id: 4, max_uses: null, uses: 3, budget_open: false, budget: '100.00', budget_left: left, used_up: false }], codes: [], vouchers: [] } }));
    expect(used('5.00', '4.99').refusals).toEqual([{ line: '', reason: 'used-up' }]);
    expect(updates(used('5.00', '5.00'), 'offers')).toEqual([{ id: 4, used_up: true }]);
    expect(updates(used('5.00', '5.01'), 'offers')).toEqual([]);
  });

  it('a code with uses of its own runs out by itself, whatever its offer has left', () => {
    const used = (uses: number) => provider.rows(call({ action: 'redeem', lines: [line('', {})], uses: [{ offer: '1', code: '8', voucher: null, amount: '2.00' }], reads: { mine: [], offers: [{ id: 1, max_uses: null, uses: 0, budget_open: true }], codes: [{ id: 8, offer_id: 1, max_uses: 5, uses }], vouchers: [] } }));
    expect(used(4).refusals).toBeUndefined();
    expect(used(5).refusals).toEqual([{ line: '', reason: 'used-up' }]);
  });

  it('a reverse writes no use, whatever it is handed, and leaves a cancelled voucher cancelled', () => {
    const back = provider.rows(
      call({
        action: 'redeem',
        phase: 'reverse',
        lines: [line('', {})],
        uses: [{ offer: null, code: null, voucher: '5', amount: '15.00', units: 1 }],
        reads: { mine: [], offers: [], codes: [], vouchers: [classes(3, { status: 'voided' })] },
        written: { redemptions: [{ id: 7, offer_id: null, code_id: null, voucher_id: 5, state: 'counted' }] },
      }),
    );
    expect(back.rows).toEqual([{ op: 'update', table: 'redemptions', line: '', key: { id: 7 }, set: { state: 'given_back', given_back_at: '2026-10-01T10:00:00.000Z' } }]);
  });

  it('a use given back clears the mark of an offer that was used up', () => {
    const back = provider.rows(call({ action: 'redeem', phase: 'reverse', lines: [line('', {})], reads: { mine: [], offers: [{ id: 5, max_uses: 50, uses: 50, used_up: true }], codes: [], vouchers: [] }, written: { redemptions: [{ id: 7, offer_id: 5, code_id: 3, voucher_id: null, state: 'counted' }, { id: 8, offer_id: 5, code_id: 3, voucher_id: null, state: 'given_back' }] } }));
    // The row already given back is given back no second time.
    expect(back.rows).toEqual([
      { op: 'update', table: 'redemptions', line: '', key: { id: 7 }, set: { state: 'given_back', given_back_at: '2026-10-01T10:00:00.000Z' } },
      { op: 'update', table: 'offers', line: '', key: { id: 5 }, set: { used_up: false } },
    ]);
  });

  it('fails loudly on what it was never meant to be asked', () => {
    expect(() => provider.rows(call({ action: 'no-such', lines: [line('', {})] }))).toThrow();
    expect(() => provider.rows(call({ action: 'card-action', lines: [line('1', { card: 3, action: 'burn', amount: '1.00', reason: 'x' })], reads: { card: [card(3, 'X', '5.00')] } }))).toThrow();
    expect(() => provider.rows(call({ action: 'card-action', lines: [line('1', { card: 99, action: 'issue', amount: '10.00', reason: 'x' })], reads: { card: [] } }))).toThrow();
    expect(() => provider.rows(call({ action: 'redeem', lines: [line('', {})], uses: [{ offer: '9', code: null, voucher: null, amount: '1.00' }], reads: { mine: [], offers: [], codes: [], vouchers: [] } }))).toThrow();
    expect(() => provider.rows(call({ action: 'make', lines: [line('', { batch: 1, size: 501 })], reads: { batch: [{ id: 1 }] } }))).toThrow();
    expect(() => provider.rows(call({ action: 'move', lines: [line('', { old_card: 'nobody', kind: 'issue', amount: '5.00', at: 'x' })], reads: { card: [] } }))).toThrow();
    expect(() => provider.rows(call({ action: 'voucher-action', lines: [line('1', { voucher: 5, action: 'burn' })], reads: { voucher: [classes(3)], last: [], none: [] } }))).toThrow();
  });
});
