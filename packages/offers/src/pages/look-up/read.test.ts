import { describe, expect, it } from 'vitest';

import type { LookUpAnswer } from '../shared/host.ts';
import { read, todayOf, type ShownCard, type ShownCode, type ShownVoucher } from './read.ts';

const TODAY = '2026-10-01';
const card = (row: Record<string, string | number | boolean | null>, more: Partial<LookUpAnswer> = {}): ShownCard => read({ kind: 'gift-card', table: 'gift_cards', key: '1', last4: 'Q4XP', by: 'code', row: { kind: 'card', status: 'active', balance: '19.00', expires_on: null, moved_table: '', ...row }, ...more }, TODAY) as ShownCard;
const voucher = (kind: 'voucher' | 'pack', row: Record<string, string | number | boolean | null>): ShownVoucher =>
  read({ kind, table: 'vouchers', key: '5', last4: '7K2M', row: { worth: kind === 'pack' ? 'pack' : 'amount', status: 'issued', uses_total: kind === 'pack' ? 10 : 1, uses_left: kind === 'pack' ? 6 : 1, expires_on: null, awaiting_sale: false, ...row } }, TODAY) as ShownVoucher;
const code = (row: Record<string, string | number | boolean | null>): ShownCode => read({ kind: 'code', table: 'codes', key: '3', row: { offer_id: 2, active: true, valid_until: null, max_uses: null, uses: 4, ...row } }, TODAY) as ShownCode;

describe('what a look-up answer says', () => {
  it('every card state, voucher state and moved card reads as its words', () => {
    expect(card({})).toMatchObject({ kind: 'card', pill: 'active', usable: true, why: null, balance: '19.00', last4: 'Q4XP', moved: false });
    expect(card({ status: 'inactive', balance: '0.00' })).toMatchObject({ pill: 'inactive', usable: false, why: 'inactive' });
    expect(card({ status: 'void' })).toMatchObject({ pill: 'void', usable: false, why: 'void' });
    expect(card({ status: 'expired' })).toMatchObject({ pill: 'expired', usable: false, why: 'expired' });
    expect(card({ balance: '0.00' })).toMatchObject({ pill: 'active', usable: false, why: 'empty' });
    expect(card({ balance: '0.0000' })).toMatchObject({ why: 'empty' });
    expect(card({ balance: '0.01' })).toMatchObject({ usable: true });
    expect(card({ moved_table: 'pos:gift_cards' })).toMatchObject({ moved: true, usable: true });

    expect(voucher('voucher', {})).toMatchObject({ kind: 'voucher', pill: 'issued', usable: true, why: null });
    expect(voucher('voucher', { status: 'used', uses_left: 0 })).toMatchObject({ pill: 'used', usable: false, why: 'used' });
    expect(voucher('voucher', { status: 'voided' })).toMatchObject({ pill: 'voided', usable: false, why: 'void' });
    expect(voucher('voucher', { status: 'expired' })).toMatchObject({ pill: 'expired', why: 'expired' });
    expect(voucher('voucher', { awaiting_sale: true })).toMatchObject({ pill: 'not-sold', usable: false, why: 'not-sold' });
    expect(voucher('pack', {})).toMatchObject({ kind: 'pack', pill: 'issued', usable: true, usesLeft: 6, usesTotal: 10 });
    expect(voucher('pack', { uses_left: 0 })).toMatchObject({ pill: 'used-up', usable: false, why: 'used-up' });
    expect(voucher('pack', { status: 'used', uses_left: 0 })).toMatchObject({ pill: 'used-up' });
  });

  it('an expired card with money left does not read usable: the day counts, not only the balance', () => {
    expect(card({ expires_on: '2026-09-30' })).toMatchObject({ pill: 'expired', usable: false, why: 'expired', balance: '19.00' });
    // Good through its last day, whatever the database wrote after the day.
    expect(card({ expires_on: '2026-10-01' })).toMatchObject({ pill: 'active', usable: true });
    expect(card({ expires_on: '2026-10-01T00:00:00.000Z' })).toMatchObject({ usable: true, expires: '2026-10-01' });
    expect(voucher('voucher', { expires_on: '2026-09-30' })).toMatchObject({ pill: 'expired', usable: false });
    expect(voucher('pack', { expires_on: '2026-10-01' })).toMatchObject({ usable: true });
  });

  it('a voucher nobody has used yet has every use it was made with', () => {
    expect(voucher('pack', { uses_left: null })).toMatchObject({ usesLeft: 10, usable: true, pill: 'issued' });
    expect(voucher('voucher', { uses_left: null })).toMatchObject({ usesLeft: 1, usable: true });
  });

  it("the desk's answer, with no address column, still offers Send again", () => {
    // Told there is none; told there is one; not told at all.
    expect(card({ recipient_email: null }).hasAddress).toBe(false);
    expect(card({ recipient_email: '' }).hasAddress).toBe(false);
    expect(card({ recipient_email: 'ana@example.com' }).hasAddress).toBe(true);
    expect(card({}).hasAddress).toBeNull();
  });

  it('a reader who is not told the balance is shown none, and is not told the card is empty', () => {
    const shown = card({ balance: null });
    expect(shown.balance).toBeNull();
    expect(shown).toMatchObject({ usable: true, why: null });
  });

  it('credit is found by an address, has no code and never runs out', () => {
    const credit = read({ kind: 'address', table: 'gift_cards', key: '8', by: 'address', last4: null, row: { kind: 'credit', status: 'active', balance: '12.50', issued_at: '2026-09-12T09:00:00.000Z' } }, TODAY) as ShownCard;
    expect(credit).toMatchObject({ kind: 'credit', last4: null, expires: null, usable: true, balance: '12.50' });
    // A credit's row found by its kind alone reads the same.
    expect(card({ kind: 'credit', expires_on: '2020-01-01' })).toMatchObject({ kind: 'credit', expires: null, usable: true, last4: null });
  });

  it('a discount code works while it is on, in its days and has uses left', () => {
    expect(code({})).toMatchObject({ usable: true, why: null, offer: '2', uses: 4, maxUses: null });
    expect(code({ active: false })).toMatchObject({ usable: false, why: 'switched-off' });
    expect(code({ active: 0 })).toMatchObject({ why: 'switched-off' });
    expect(code({ active: 1 })).toMatchObject({ usable: true });
    expect(code({ valid_until: '2026-09-30' })).toMatchObject({ why: 'expired' });
    expect(code({ valid_until: '2026-10-01' })).toMatchObject({ usable: true });
    expect(code({ max_uses: 4 })).toMatchObject({ why: 'used-up' });
    expect(code({ max_uses: 5 })).toMatchObject({ usable: true });
  });

  it("today is the reader's own day", () => {
    expect(todayOf(new Date(2026, 9, 1, 23, 59))).toBe('2026-10-01');
    expect(todayOf(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });
});
