/**
 * WHAT A TYPED OR SCANNED CODE FINDS.
 *
 * Somebody at a counter types a code, or scans one, and Adminium answers what
 * it is: a card with what it holds, a voucher, a pack, a discount code. The
 * declaration says where each kind is looked for and what of the row is
 * shown. It never shows the code itself, an address or a hash — and what a
 * caller sees is cut down again to what their role reads.
 */

import { validateManifest } from '@adminiumjs/manifest';
import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };

interface Kind {
  id: string;
  table: string;
  code: string;
  prefix?: string;
  where?: { column: string; eq?: unknown; in?: unknown[] }[];
  show: string[];
  rows?: { table: string; via: string; columns: string[] };
}
const lookUp = manifest.addOn.lookUp as unknown as { kinds: Kind[]; address: { table: string; column: string; show: string[] } };
const tables = manifest.requiredSchema.tables as unknown as { ref: string; columns: { ref: string; rules?: Record<string, unknown> }[] }[];
const columnsOf = (table: string) => tables.find((one) => one.ref === table)!.columns;

/** A column that is a code, an address, or a key that stands for an address. */
const secret = (table: string, ref: string): boolean => {
  const rules = columnsOf(table).find((column) => column.ref === ref)?.rules ?? {};
  return rules['code'] !== undefined || rules['customerKey'] !== undefined || rules['normalize'] === 'email' || ref === 'customer';
};

describe('the look-up', () => {
  it('the look-up names no code, no address and no hash, and one word per kind', () => {
    expect(lookUp.kinds.map((kind) => `${kind.id}: ${kind.table}.${kind.code} ${kind.prefix ?? '(no word)'}`)).toEqual([
      'gift-card: gift_cards.code GC-',
      'pack: vouchers.code PK-',
      'voucher: vouchers.code VC-',
      'code: codes.code (no word)',
    ]);
    const words = lookUp.kinds.flatMap((kind) => (kind.prefix === undefined ? [] : [kind.prefix]));
    expect(new Set(words).size).toBe(words.length);
    for (const kind of lookUp.kinds) {
      for (const ref of kind.show) {
        expect(columnsOf(kind.table).map((column) => column.ref), `${kind.id}: ${ref}`).toContain(ref);
        // A card's recipient is shown to a manager; the address it is OWNED by, and every code and key, to nobody here.
        if (ref !== 'recipient_email') expect(secret(kind.table, ref), `${kind.id} shows ${kind.table}.${ref}`).toBe(false);
      }
      for (const ref of kind.rows?.columns ?? []) {
        expect(columnsOf(kind.rows!.table).map((column) => column.ref), `${kind.id}: ${kind.rows!.table}.${ref}`).toContain(ref);
        expect(secret(kind.rows!.table, ref), `${kind.id} lists ${kind.rows!.table}.${ref}`).toBe(false);
      }
    }
    for (const ref of lookUp.address.show) expect(secret(lookUp.address.table, ref), ref).toBe(false);
    expect(lookUp.address).toMatchObject({ table: 'gift_cards', column: 'owner_email' });
  });

  it('shows of each kind exactly what the desk is to be told, and no more', () => {
    const shown = Object.fromEntries(lookUp.kinds.map((kind) => [kind.id, { show: kind.show, rows: kind.rows === undefined ? null : `${kind.rows.table} by ${kind.rows.via}: ${kind.rows.columns.join(', ')}` }]));
    expect(shown).toEqual({
      'gift-card': {
        show: ['kind', 'label', 'status', 'balance', 'expires_on', 'issued_at', 'send_on', 'resent_at', 'recipient_name', 'sender_name', 'recipient_email', 'moved_table'],
        rows: 'card_ledger by card_id: at, kind, amount, balance_after, note, source_label',
      },
      pack: {
        show: ['code_last4', 'worth', 'what', 'public_name', 'uses_left', 'uses_total', 'status', 'expires_on', 'holder_name', 'sold', 'awaiting_sale', 'batch_id'],
        rows: 'redemptions by voucher_id: at, state, amount, uses, source_label',
      },
      voucher: {
        show: ['code_last4', 'worth', 'value', 'what', 'units', 'public_name', 'status', 'expires_on', 'holder_name', 'sold', 'awaiting_sale', 'batch_id'],
        rows: 'redemptions by voucher_id: at, state, amount, uses, source_label',
      },
      code: { show: ['offer_id', 'active', 'valid_until', 'max_uses', 'uses'], rows: null },
    });
    // By an address: that there is credit and what it holds, never the address back.
    expect(lookUp.address).toEqual({ table: 'gift_cards', column: 'owner_email', show: ['kind', 'status', 'balance', 'issued_at'] });
  });

  it('tells a pack from a voucher by what the row is worth, since both keep their code bare', () => {
    const worth = Object.fromEntries(lookUp.kinds.filter((kind) => kind.table === 'vouchers').map((kind) => [kind.id, kind.where]));
    expect(worth).toEqual({ pack: [{ column: 'worth', eq: 'pack' }], voucher: [{ column: 'worth', in: ['amount', 'percent', 'thing'] }] });
    // The words a code may not start with are the three that route.
    expect(manifest.addOn.adjuster.codes.reserved.map((word) => `${word}-`).sort()).toEqual(words().sort());
  });

  it('says a card came from a till by the table it came from, not by the old key', () => {
    const card = lookUp.kinds.find((kind) => kind.id === 'gift-card')!;
    expect(card.show).toContain('moved_table');
    expect(card.show).not.toContain('moved_from');
    expect(card.show).not.toContain('note');
  });

  it('is refused when it would show a code', () => {
    const shown = structuredClone(manifest) as unknown as { addOn: { lookUp: { kinds: Kind[] } } };
    shown.addOn.lookUp.kinds[0]!.show.push('code');
    const result = validateManifest(shown);
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.issues.map((issue) => String(issue.path)).filter((path) => path.includes('lookUp'))).not.toEqual([]);
  });
});

function words(): string[] {
  return lookUp.kinds.flatMap((kind) => (kind.prefix === undefined ? [] : [kind.prefix]));
}
