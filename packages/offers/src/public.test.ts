/**
 * WHAT A STRANGER CAN ASK.
 *
 * Two doors, both read-only, both onto one gift card: its own code, typed on
 * an app's balance page; and its own link, in the mail the card came with.
 * Either answers three columns and no other. Whether a card exists, who holds
 * it, and what happened to it are never said to anybody who does not already
 * hold the card.
 *
 * And two reads for a customer signed in on the app's key: the packs and the
 * cards held in the address they proved. Neither carries a code.
 */
import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };

interface Entry {
  table: string;
  key?: string;
  methods: string[];
  select: string[];
  unlockBy?: { header: boolean; column: string; self: boolean; length: number; where: Record<string, unknown>[] };
  claim?: { by: string; column: string; expires: string };
  level?: string;
  heldBy?: { address: string };
  filters?: { column: string; op: string; value: unknown }[];
}
const m = manifest as unknown as { publicKeys: Record<string, unknown>; publicAccess: Entry[] };
const cards = (manifest.requiredSchema.tables as unknown as { ref: string; columns: { ref: string; rules?: { code?: { prefix?: string; length?: number; hiddenFromStaff?: boolean } } }[] }[]).find((table) => table.ref === 'gift_cards')!;
const rule = (column: string) => cards.columns.find((one) => one.ref === column)!.rules!.code!;
const [byCode, byLink, myPacks, myCards] = m.publicAccess as [Entry, Entry, Entry, Entry];
const doors = [byCode, byLink];

describe('what Offers answers to the public', () => {
  it('is two doors on gift cards and two reads of what a person holds, and nothing else: no code, ledger row or use is public', () => {
    expect(m.publicAccess.map((entry) => `${entry.table} ${entry.key ?? "the app's key"} ${entry.methods.join(',')}`)).toEqual(["gift_cards the app's key GET", 'gift_cards offers-link GET', "vouchers the app's key GET", "gift_cards the app's key GET"]);
    expect(m.publicKeys).toEqual({ 'offers-link': {} });
  });

  it('an active card answers status, balance and expiry and no other key', () => {
    for (const entry of doors) expect(entry.select, entry.key ?? 'code').toEqual(['status', 'balance', 'expires_on']);
    // Never who holds it, what was written to it, or either of its secrets.
    for (const entry of doors) for (const never of ['code', 'label', 'link_token', 'recipient_name', 'recipient_email', 'sender_name', 'owner_email', 'message', 'note', 'void_reason', 'kind']) expect(entry.select, never).not.toContain(never);
  });

  it("the code door opens one row to whoever sends that row's own twelve characters, and only an active card in its days", () => {
    expect(byCode.key).toBeUndefined();
    expect(byCode.unlockBy).toEqual({
      header: true,
      column: 'code',
      self: true,
      length: 12,
      where: [
        // A credit has no code and is nobody's to look up.
        { column: 'kind', eq: 'card' },
        // Inactive, cancelled and expired cards answer as an unknown code does.
        { column: 'status', eq: 'active' },
        // Good through its last day; a card with no last day is always in its days.
        { column: 'expires_on', notBefore: 'today', orEmpty: true },
      ],
    });
    // Twelve is the code's own made length, counted without the word it is said with: an older, shorter card is not found here.
    expect(rule('code')).toMatchObject({ prefix: 'GC-', length: 12 });
    expect(byCode.unlockBy!.length).toBe(rule('code').length);
    expect(byCode.claim).toBeUndefined();
  });

  it('the link door is a claim by the card\'s own long token, which staff never see, and closes with the card', () => {
    expect(byLink.claim).toEqual({ by: 'token', column: 'link_token', expires: 'expires_on' });
    expect(rule('link_token')).toMatchObject({ length: 16, hiddenFromStaff: true });
    expect(byLink.unlockBy).toBeUndefined();
  });

  it('a signed-in customer reads only what is held in the address they proved, and never a code', () => {
    expect(myPacks).toMatchObject({ table: 'vouchers', level: 'verified', heldBy: { address: 'holder_email' } });
    // A card dated for a birthday is not shown to its recipient before the day.
    expect(myCards).toMatchObject({ table: 'gift_cards', level: 'verified', heldBy: { address: 'recipient_email', from: 'send_on' } });
    expect(myPacks.select).toEqual(['id', 'worth', 'public_name', 'uses_total', 'uses_left', 'expires_on', 'code_last4']);
    expect(myCards.select).toEqual(['id', 'label', 'balance', 'expires_on']);
    for (const entry of [myPacks, myCards]) {
      expect(entry.methods).toEqual(['GET']);
      expect(entry.key).toBeUndefined();
      for (const never of ['code', 'link_token', 'holder_email', 'holder_key', 'recipient_email', 'owner_email', 'sale_price', 'message', 'note']) expect(entry.select, never).not.toContain(never);
    }
    // Only what can still be used: a pack waiting for its sale, a cancelled card or store credit is not listed.
    expect(myPacks.filters).toEqual([{ column: 'status', op: 'eq', value: 'issued' }, { column: 'awaiting_sale', op: 'eq', value: false }]);
    expect(myCards.filters).toEqual([{ column: 'kind', op: 'eq', value: 'card' }, { column: 'status', op: 'eq', value: 'active' }]);
  });

  it('neither door writes, lists or filters', () => {
    for (const entry of doors) {
      expect(entry.methods).toEqual(['GET']);
      for (const never of ['insert', 'update', 'filter', 'sort', 'list', 'defaults']) expect(Object.keys(entry), never).not.toContain(never);
    }
  });
});
