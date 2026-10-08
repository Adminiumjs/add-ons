/**
 * THE SAMPLE FILE, ADDED UP AGAIN.
 *
 * The file a fresh install can add is written by `scripts/sample.mjs` from
 * the adjuster's own answers. This suite holds the file to that (it is never
 * edited by hand), and then works every figure the Overview and the docs
 * quote out of the file's rows — the same sums Adminium makes once the rows
 * are in.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };
// @ts-expect-error — a build script, plain JavaScript with no types of its own.
import { TARGET, written } from '../scripts/sample.mjs';
import { buildSample, sampleCode, type Row } from './sample/bundle.ts';

const file = JSON.parse(readFileSync(TARGET as string, 'utf8')) as { format: string; app: string; tables: { ref: string; onlyIfEmpty?: true; rows: Row[] }[] };
const rows = (ref: string): Row[] => file.tables.find((table) => table.ref === ref)?.rows ?? [];
const tables = manifest.requiredSchema.tables as unknown as { ref: string; columns: { ref: string; type: string; enum?: string[]; references?: string; nullable?: boolean; default?: unknown; rules?: Record<string, unknown> }[] }[];
const cents = (value: unknown): number => Math.round(Number(value) * 100);
const dollars = (value: number): string => (value / 100).toFixed(2);
const sum = (list: Row[], column: string): string => dollars(list.reduce((total, row) => total + cents(row[column]), 0));
const refOf = (value: unknown): string | null => (typeof value === 'object' && value !== null && '@ref' in value ? String((value as { '@ref': string })['@ref']) : null);
const lastMonth = (row: Row): boolean => (row['at'] as { '@month'?: number } | undefined)?.['@month'] === -1;
const stamp = (row: Row): string => {
  const at = row['at'] as { '@month': number; '@dom': number; '@time': string };
  return `${String(at['@month'] + 100)}-${String(at['@dom']).padStart(2, '0')} ${at['@time']}`;
};

describe('the sample file', () => {
  it('is what the script writes, and the manifest ships it', () => {
    expect(readFileSync(TARGET as string, 'utf8')).toBe(written(buildSample()));
    expect(file).toMatchObject({ format: 'adminium.sample/1', app: 'offers' });
    expect((manifest as unknown as { sampleData: { file: string } }).sampleData).toEqual({ file: 'seeds/offers.sample.json' });
  });

  it('holds these rows, and settings only where there are none yet', () => {
    expect(Object.fromEntries(file.tables.map((table) => [table.ref, table.rows.length]))).toEqual({ settings: 1, groups: 3, group_members: 6, reasons: 4, ceilings: 2, offers: 6, offer_targets: 2, codes: 3, voucher_batches: 1, vouchers: 206, voucher_actions: 9, gift_cards: 12, card_ledger: 21, redemptions: 171, applied: 260 });
    expect(file.tables.filter((table) => table.onlyIfEmpty === true).map((table) => table.ref)).toEqual(['settings']);
    // No receipt, no hand action on a card and no mail is made up: a sample's history sends nothing and undoes nothing.
    for (const never of ['postings', 'card_actions', 'messages', 'batch_chunks', 'offer_breaks']) expect(file.tables.map((table) => table.ref)).not.toContain(never);
  });

  it('writes only columns its tables have, values a choice allows, and links to rows that are in the file', () => {
    const labels = new Set(file.tables.flatMap((table) => table.rows.flatMap((row) => (typeof row['@label'] === 'string' ? [row['@label']] : []))));
    for (const table of file.tables) {
      const declared = tables.find((one) => one.ref === table.ref)!;
      for (const row of table.rows) {
        for (const [column, value] of Object.entries(row)) {
          if (column === '@label') continue;
          const found = declared.columns.find((one) => one.ref === column);
          expect(found, `${table.ref}.${column}`).toBeDefined();
          if (found?.enum !== undefined) expect(found.enum, `${table.ref}.${column} = ${String(value)}`).toContain(value);
          const to = refOf(value);
          if (to !== null) expect(labels.has(to), `${table.ref}.${column} → ${to}`).toBe(true);
          // What Adminium adds up from other rows is never written: it is settled once the rows are in.
          expect(found?.rules?.['rollup'], `${table.ref}.${column} is a total`).toBeUndefined();
        }
        // And nothing a row must have is left out.
        for (const column of declared.columns) {
          if (column.ref === 'id' || column.nullable === true || column.default !== undefined || column.rules?.['rollup'] !== undefined || column.rules?.['stamp'] !== undefined) continue;
          expect(Object.keys(row), `${table.ref} row has no ${column.ref}`).toContain(column.ref);
        }
      }
    }
  });

  it('names nobody real: every address ends in .example, and no customer key is anybody\'s', () => {
    const addresses = [...rows('group_members').map((row) => row['email']), ...rows('gift_cards').flatMap((row) => (row['owner_email'] === undefined ? [] : [row['owner_email']]))];
    expect(addresses).toHaveLength(8);
    for (const address of addresses) expect(String(address)).toMatch(/\.example$/);
    for (const row of rows('redemptions')) if (row['customer'] !== undefined) expect(String(row['customer'])).toMatch(/^sample:c\d{3}$/);
    // No card or voucher has anybody to write to, so nothing is ever sent for one.
    for (const row of [...rows('gift_cards'), ...rows('vouchers')]) for (const column of ['recipient_email', 'holder_email', 'notify']) expect(row[column], column).toBeUndefined();
  });

  it('every code is twelve characters of its own, and a card keeps its two letters', () => {
    const codes = rows('vouchers').map((row) => String(row['code']));
    expect(new Set(codes).size).toBe(206);
    for (const code of codes) expect(code).toMatch(/^[2-9A-HJKMNP-TV-Z]{12}$/);
    for (const row of rows('vouchers')) expect(row['code_last4']).toBe(String(row['code']).slice(-4));
    expect(sampleCode(1)).toBe(sampleCode(1));
    const cards = rows('gift_cards').filter((row) => row['kind'] === 'card');
    expect(cards).toHaveLength(10);
    for (const row of cards) {
      expect(String(row['code'])).toMatch(/^GC-[0-9A-Z]{12}$/);
      expect(row['label']).toBe(String(row['code']).slice(-4));
    }
    // A credit has no code at all.
    for (const row of rows('gift_cards').filter((one) => one['kind'] === 'credit')) expect(row['code']).toBeUndefined();
    // No discount code begins like a card's, a voucher's or a pack's.
    for (const row of rows('codes')) expect(String(row['code'])).not.toMatch(/^(GC|VC|PK)/);
  });
});

describe('the figures the sample shows', () => {
  const uses = rows('redemptions');
  const byRule = uses.filter((row) => row['offer_id'] !== undefined);
  const of = (label: string): Row[] => byRule.filter((row) => refOf(row['offer_id']) === label);

  it('126 uses of discounts for $610.18, discount by discount', () => {
    expect(`${String(byRule.length)} / ${sum(byRule, 'amount')}`).toBe('126 / 610.18');
    expect(rows('offers').map((offer) => `${String(offer['name'])} ${String(of(String(offer['@label'])).length)} / ${sum(of(String(offer['@label'])), 'amount')}`)).toEqual(['Welcome 10 41 / 117.48', 'Monday mugs 9 / 22.50', 'Tote pair 6 / 90.00', 'Autumn 5 20 / 100.00', 'Launch week 50 / 280.20', 'Summer close-out 0 / 0.00']);
    // Launch week is used up — the stored flag — and still active; its code holds fifty uses and has had fifty.
    expect(rows('offers').find((offer) => offer['name'] === 'Launch week')).toMatchObject({ status: 'active', used_up: true, max_uses: 50 });
    expect(uses.filter((row) => refOf(row['code_id']) === 'code:LAUNCH20')).toHaveLength(50);
    expect(rows('offers').filter((offer) => offer['used_up'] === true)).toHaveLength(1);
    // A use by a code names its code; a discount that starts by itself names none.
    expect(Object.fromEntries(['code', 'offer', 'staff', 'voucher', 'pack'].map((kind) => [kind, uses.filter((row) => row['kind'] === kind).length]))).toEqual({ code: 111, offer: 15, staff: 12, voucher: 24, pack: 9 });
  });

  it('twelve reductions by hand for $57.48, by the reason staff picked', () => {
    const staff = uses.filter((row) => row['kind'] === 'staff');
    expect(`${String(staff.length)} / ${sum(staff, 'amount')}`).toBe('12 / 57.48');
    const reason = (id: number): string => `${String(staff.filter((row) => refOf(row['reason_id']) === `reason:${String(id)}`).length)} / ${sum(staff.filter((row) => refOf(row['reason_id']) === `reason:${String(id)}`), 'amount')}`;
    expect(rows('reasons').map((row, at) => `${String(row['label'])} ${reason(at + 1)}`)).toEqual(['Damaged 4 / 24.10', 'Goodwill 3 / 11.40', 'Staff purchase 5 / 21.98', 'Manager 0 / 0.00']);
  });

  it('vouchers apart: 23 leaflet vouchers for $115.00, one candle for $18.00; everything taken off, $800.66 in 162 rows', () => {
    const vouchers = uses.filter((row) => row['kind'] === 'voucher');
    const leaflet = vouchers.filter((row) => refOf(row['voucher_id'])?.startsWith('voucher:leaflet:') === true);
    expect(`${String(leaflet.length)} / ${sum(leaflet, 'amount')}`).toBe('23 / 115.00');
    expect(vouchers.filter((row) => refOf(row['voucher_id']) === 'voucher:one-candle-1').map((row) => `${String(row['source_label'])} ${String(row['amount'])}`)).toEqual(['Order 125 18.00']);
    const orders = uses.filter((row) => row['kind'] !== 'pack');
    expect(`${String(orders.length)} / ${sum(orders, 'amount')}`).toBe('162 / 800.66');
    // Each voucher the month used is marked used, and no other of the batch is.
    const used = new Set(leaflet.map((row) => refOf(row['voucher_id'])));
    for (const row of rows('vouchers').filter((one) => refOf(one['batch_id']) === 'batch:leaflet')) expect(row['status'], String(row['@label'])).toBe(used.has(String(row['@label'])) ? 'used' : 'issued');
    expect(rows('vouchers').filter((row) => refOf(row['batch_id']) === 'batch:leaflet')).toHaveLength(200);
  });

  it('what each line had taken off adds up to what each use took, order by order', () => {
    const applied = rows('applied');
    expect(sum(applied, 'amount')).toBe('800.66');
    const byOrder = (list: Row[]): Map<string, number> => {
      const out = new Map<string, number>();
      for (const row of list) out.set(String(row['source_row']), (out.get(String(row['source_row'])) ?? 0) + cents(row['amount']));
      return out;
    };
    expect([...byOrder(applied)].sort()).toEqual([...byOrder(uses.filter((row) => row['kind'] !== 'pack'))].sort());
    // The tile "Given last month": what rules and staff took off, never a voucher's worth.
    expect(sum(applied.filter((row) => ['offer', 'code', 'staff'].includes(String(row['kind']))), 'amount')).toBe('667.66');
    // A discount is named in eight languages on every line it reduced.
    for (const row of applied.filter((one) => one['offer_id'] !== undefined)) expect(Object.keys(row['name'] as object)).toHaveLength(8);
  });

  it('the packs: four of ten and five of five used, each use a real row, and what was paid for a pack spread over its uses', () => {
    const packs = uses.filter((row) => row['kind'] === 'pack');
    expect(packs).toHaveLength(9);
    for (const row of packs) {
      expect(row['source_table']).toEqual({ '@table': 'voucher_actions' });
      expect(rows('voucher_actions').map((action) => action['@label'])).toContain(refOf(row['source_row']));
      expect(row['amount']).toBe('0.00');
    }
    const taken = (label: string): Row[] => packs.filter((row) => refOf(row['voucher_id']) === label);
    expect([taken('voucher:pack:1').length, taken('voucher:pack:2').length]).toEqual([4, 5]);
    expect(sum(taken('voucher:pack:1'), 'prepaid')).toBe('48.00');
    // Used to its last: its uses come to what it was sold for, to the cent.
    expect(sum(taken('voucher:pack:2'), 'prepaid')).toBe('45.00');
    expect(rows('vouchers').filter((row) => row['worth'] === 'pack').map((row) => `${String(row['public_name'])} ${String(row['uses_total'])} ${String(row['status'])}`)).toEqual(['10 classes 10 issued', '5 car washes 5 used']);
  });

  it('twelve cards and credits owing $455.25; $505.00 issued and topped up and $238.05 spent last month', () => {
    const ledger = rows('card_ledger');
    const balance = (label: string): number => -ledger.filter((row) => refOf(row['card_id']) === label).reduce((total, row) => total + cents(row['taken']), 0);
    const cards = rows('gift_cards');
    expect(dollars(cards.filter((card) => card['status'] === 'active').reduce((total, card) => total + balance(String(card['@label'])), 0))).toBe('455.25');
    expect(cards.map((card) => `${String(card['label'] ?? 'Credit')} ${dollars(balance(String(card['@label'])))}`)).toEqual(['Q4XP 19.00', '2HVT 35.75', 'WN6C 0.00', '8KJD 50.00', 'R2MC 50.00', 'T7QF 62.00', 'NP3H 100.00', '6VXQ 0.00', 'K4WD 100.00', '9MXR 0.00', 'Credit 22.00', 'Credit 16.50']);
    expect(sum(ledger.filter((row) => lastMonth(row) && ['issue', 'top_up'].includes(String(row['kind']))), 'value')).toBe('505.00');
    expect(sum(ledger.filter((row) => lastMonth(row) && row['kind'] === 'spend'), 'value')).toBe('238.05');
    // Summing what the holder saw would read below nothing: the tile sums what moved.
    expect(sum(ledger.filter((row) => lastMonth(row) && row['kind'] === 'spend'), 'amount')).toBe('-238.05');
    expect(cards.filter((card) => card['status'] !== 'active').map((card) => `${String(card['label'])} ${String(card['status'])}`)).toEqual(['6VXQ void', '9MXR inactive']);
  });

  it('every row of a card says what was on it afterwards, and a card never goes below nothing', () => {
    const ledger = rows('card_ledger');
    for (const card of rows('gift_cards')) {
      let held = 0;
      for (const row of ledger.filter((one) => refOf(one['card_id']) === card['@label'])) {
        held -= cents(row['taken']);
        expect(dollars(held), `${String(card['@label'])} ${stamp(row)}`).toBe(row['balance_after']);
        expect(held).toBeGreaterThanOrEqual(0);
        expect(cents(row['value'])).toBe(Math.abs(cents(row['taken'])));
        expect(cents(row['amount'])).toBe(-cents(row['taken']));
      }
    }
    // A credit's money came as refunds: nothing was "issued" to one.
    const credits = new Set(rows('gift_cards').filter((card) => card['kind'] === 'credit').map((card) => card['@label']));
    expect(ledger.filter((row) => credits.has(refOf(row['card_id']))).map((row) => row['kind'])).toEqual(['refund', 'spend', 'refund']);
    // The one refund to a card names the payment it gave back.
    expect(ledger.filter((row) => row['against_id'] !== undefined).map((row) => `${String(row['@label'])} → ${String(refOf(row['against_id']))}`)).toEqual(['ledger:R2MC:3 → ledger:R2MC:2']);
  });

  it('the last six card rows are the sample\'s last six, newest first', () => {
    const newest = [...rows('card_ledger')].sort((a, b) => (stamp(a) < stamp(b) ? 1 : -1)).slice(0, 6);
    expect(newest.map((row) => `${String(refOf(row['card_id'])).slice(5)} ${String(row['kind'])} ${String(row['amount'])}`)).toEqual(['6VXQ void -30.00', 'T7QF spend -88.00', 'R2MC refund 9.80', 'R2MC spend -9.80', 'K4WD issue 100.00', 'ada@daybreak.example spend -20.00']);
  });

  it('the six largest balances keep the sample\'s order', () => {
    const ledger = rows('card_ledger');
    const cards = rows('gift_cards')
      .filter((card) => card['kind'] === 'card' && card['status'] === 'active')
      .map((card) => ({ label: String(card['label']), balance: -ledger.filter((row) => refOf(row['card_id']) === card['@label']).reduce((total, row) => total + cents(row['taken']), 0), issued: stamp({ at: card['issued_at'] }) }))
      .filter((card) => card.balance > 0)
      .sort((a, b) => b.balance - a.balance || (a.issued < b.issued ? -1 : 1))
      .slice(0, 6);
    expect(cards.map((card) => `${card.label} ${dollars(card.balance)}`)).toEqual(['NP3H 100.00', 'K4WD 100.00', 'T7QF 62.00', '8KJD 50.00', 'R2MC 50.00', '2HVT 35.75']);
  });
});
