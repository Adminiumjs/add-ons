/**
 * WHO MAY READ AND WRITE WHAT.
 *
 * A code is money: whoever reads a card's code can spend the card. So the two
 * roles that work a counter read no code, no address and no hash, and write
 * nothing that puts value on a card — that is done by a sale's own line, or
 * by a manager by hand. This suite reads the three roles as an install does
 * and holds each to that.
 */

import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };

interface Limit {
  readable?: string[];
  writable?: string[];
  creatable?: string[];
  writableValues?: Record<string, string[]>;
  creatableValues?: Record<string, string[]>;
}
interface Role {
  key: string;
  name: string;
  permissions: string[];
  limits?: Record<string, Limit>;
}
type Action = 'read' | 'create' | 'update' | 'delete';

const roles = manifest.roles as unknown as Role[];
const roleOf = (key: string): Role => {
  const found = roles.find((role) => role.key === key);
  if (found === undefined) throw new Error(`no role "${key}"`);
  return found;
};
const tables = manifest.requiredSchema.tables as unknown as { ref: string; columns: { ref: string }[] }[];
const columnsOf = (table: string): string[] => tables.find((one) => one.ref === table)!.columns.map((column) => column.ref).filter((ref) => ref !== 'id');
const may = (role: Role, table: string, action: Action): boolean => role.permissions.includes(`table:@${table}:${action}`);
/** The actions a role holds on a table, as letters. */
const holds = (role: Role, table: string): string => (['read', 'create', 'update', 'delete'] as const).filter((action) => may(role, table, action)).map((action) => action[0]).join('');
/** The columns a role reads, creates with or changes: the listed ones under a limit, every column without one. */
const columns = (role: Role, table: string, action: 'read' | 'create' | 'update'): string[] => {
  if (!may(role, table, action)) return [];
  const limit = role.limits?.[table]?.[action === 'read' ? 'readable' : action === 'create' ? 'creatable' : 'writable'];
  return limit ?? columnsOf(table);
};

const manager = roleOf('manager');
const desk = roleOf('desk');
const viewer = roleOf('viewer');

describe('the three roles', () => {
  it('are a manager, a desk and a viewer, and name only tables and columns that are there', () => {
    expect(roles.map((role) => role.key)).toEqual(['manager', 'desk', 'viewer']);
    for (const role of roles) {
      for (const permission of role.permissions) {
        // A page it opens (below), or a table it reads or writes.
        if (/^page:@offers-[a-z-]+:view$/.test(permission)) continue;
        const [, table, action] = /^table:@([a-z_]+):(read|create|update|delete)$/.exec(permission) ?? [];
        expect(action, `${role.key}: ${permission}`).toBeDefined();
        expect(tables.map((one) => one.ref), `${role.key}: ${permission}`).toContain(table);
      }
      for (const [table, limit] of Object.entries(role.limits ?? {})) {
        for (const ref of [...(limit.readable ?? []), ...(limit.writable ?? []), ...(limit.creatable ?? []), ...Object.keys(limit.writableValues ?? {}), ...Object.keys(limit.creatableValues ?? {})]) {
          expect(columnsOf(table), `${role.key}: ${table}.${ref}`).toContain(ref);
        }
      }
    }
  });

  it('open the pages the design shows each: without a page nobody but a Super Admin sees the add-on at all', () => {
    const pages = [...(manifest.pages as unknown as { ref: string }[]), ...(manifest.addOn.pages as unknown as { ref: string }[])].map((page) => page.ref.replace(/^offers-/, '')).sort();
    const sees = (role: Role): string[] => role.permissions.flatMap((permission) => /^page:@offers-([a-z-]+):view$/.exec(permission)?.[1] ?? []).sort();
    // The manager opens every page there is — a new page with no grant fails here.
    expect(sees(manager)).toEqual(pages);
    expect(sees(desk)).toEqual(['activity', 'gift-cards', 'issue', 'look-up', 'overview', 'uses', 'vouchers']);
    expect(sees(viewer)).toEqual(['activity', 'codes', 'discounts', 'gift-cards', 'look-up', 'overview', 'uses', 'voucher-batches', 'vouchers']);
    // A page a role opens is one whose table it reads: a list it could open and not read would be an empty promise.
    for (const role of roles) for (const ref of sees(role)) expect(pages, `${role.key}: ${ref}`).toContain(ref);
  });

  it('hold what the design gives each, table by table', () => {
    const grid = (role: Role) => Object.fromEntries(tables.map((table) => [table.ref, holds(role, table.ref)]).filter(([, letters]) => letters !== ''));
    expect(grid(manager)).toEqual({
      settings: 'ru',
      groups: 'rcu',
      group_members: 'rcud',
      reasons: 'rcu',
      ceilings: 'rcu',
      offers: 'rcu',
      offer_breaks: 'rcud',
      offer_targets: 'rcud',
      codes: 'rcud',
      voucher_batches: 'rc',
      batch_chunks: 'rc',
      vouchers: 'rcu',
      voucher_actions: 'rc',
      gift_cards: 'rcu',
      card_ledger: 'r',
      card_actions: 'rc',
      redemptions: 'r',
      applied: 'r',
      postings: 'r',
      messages: 'ru',
    });
    expect(grid(desk)).toEqual({
      settings: 'r',
      reasons: 'r',
      offers: 'r',
      offer_breaks: 'r',
      offer_targets: 'r',
      codes: 'r',
      vouchers: 'rcu',
      voucher_actions: 'rc',
      // (Read only, for the Overview's card: the spec gave the desk none, and its home page then showed an error.)
      voucher_batches: 'r',
      gift_cards: 'rcu',
      card_ledger: 'r',
      redemptions: 'r',
      applied: 'r',
    });
    expect(grid(viewer)).toEqual({
      settings: 'r',
      groups: 'r',
      group_members: 'r',
      reasons: 'r',
      ceilings: 'r',
      offers: 'r',
      offer_breaks: 'r',
      offer_targets: 'r',
      codes: 'r',
      voucher_batches: 'r',
      vouchers: 'r',
      voucher_actions: 'r',
      gift_cards: 'r',
      card_ledger: 'r',
      redemptions: 'r',
      applied: 'r',
      messages: 'r',
    });
  });

  it('nobody edits or deletes what a ledger wrote, and nobody deletes a card, a voucher or an offer', () => {
    for (const role of roles) {
      for (const table of ['card_ledger', 'redemptions', 'applied', 'postings', 'card_actions', 'voucher_actions', 'batch_chunks']) {
        expect(may(role, table, 'update'), `${role.key} updates ${table}`).toBe(false);
        expect(may(role, table, 'delete'), `${role.key} deletes ${table}`).toBe(false);
      }
      for (const table of ['card_ledger', 'redemptions', 'applied', 'postings', 'messages']) expect(may(role, table, 'create'), `${role.key} creates ${table}`).toBe(false);
      expect(tables.map((table) => table.ref).filter((table) => may(role, table, 'delete')).sort(), role.key).toEqual(role === manager ? ['codes', 'group_members', 'offer_breaks', 'offer_targets'] : []);
    }
  });
});

describe('desk and viewer', () => {
  it('desk and viewer read no code, no address and no hash', () => {
    for (const role of [desk, viewer]) {
      expect(columns(role, 'gift_cards', 'read'), role.key).toEqual(['kind', 'label', 'status', 'balance', 'expires_on', 'issued_at', 'send_on', 'resent_at', 'recipient_name', 'sender_name', 'language', 'moved_table']);
      const vouchers = columns(role, 'vouchers', 'read');
      for (const kept of ['code', 'holder_email', 'holder_key', 'sale_price']) expect(vouchers, `${role.key}: vouchers.${kept}`).not.toContain(kept);
      // Everything else of a voucher is theirs to read, the last four of its code among it.
      expect(vouchers.slice().sort(), role.key).toEqual(columnsOf('vouchers').filter((ref) => !['code', 'holder_email', 'holder_key', 'sale_price'].includes(ref)).sort());
      expect(vouchers).toContain('code_last4');
      expect(columns(role, 'redemptions', 'read'), role.key).not.toContain('customer');
      expect(columns(role, 'card_ledger', 'read'), role.key).not.toContain('note');
      // The receipts say who posted what from where: a manager's to read.
      expect(may(role, 'postings', 'read'), role.key).toBe(false);
      expect(may(role, 'card_actions', 'read'), role.key).toBe(false);
    }
    // The members of a group are addresses: the desk reads none of them.
    expect(may(desk, 'group_members', 'read')).toBe(false);
    expect(may(desk, 'messages', 'read')).toBe(false);
  });

  it('no column either reads is an address or a key that stands for one, on any table', () => {
    // A column kept as personal data in the spelling of an address, or a key Adminium makes from one.
    const private_ = (table: string, ref: string): boolean => {
      const rules = (tables.find((one) => one.ref === table)!.columns.find((column) => column.ref === ref) as { rules?: Record<string, unknown> }).rules ?? {};
      return rules['normalize'] === 'email' || rules['customerKey'] !== undefined || ref === 'to_address' || ref === 'customer';
    };
    for (const role of [desk, viewer]) {
      for (const table of tables.map((one) => one.ref)) {
        expect(columns(role, table, 'read').filter((ref) => private_(table, ref)), `${role.key} reads ${table}`).toEqual([]);
      }
    }
    // The viewer sees that a mail went and to which card, never to whom; and how many are in a group, never who.
    expect(columns(viewer, 'messages', 'read')).toEqual(columnsOf('messages').filter((ref) => ref !== 'to_address'));
    expect(columns(viewer, 'group_members', 'read')).toEqual(['group_id']);
    // The manager reads them all: somebody has to answer "where did my card go".
    expect(columns(manager, 'messages', 'read')).toContain('to_address');
    expect(columns(manager, 'group_members', 'read')).toContain('email');
  });

  it('the desk cannot give a new card a code, an amount or a status', () => {
    expect(columns(desk, 'gift_cards', 'create')).toEqual(['kind', 'owner_email', 'recipient_name', 'recipient_email', 'sender_name', 'message', 'language', 'send_on']);
    // Value reaches a card by a sale's own line or by a manager's hand, never by the desk's.
    expect(may(desk, 'card_actions', 'create')).toBe(false);
    // What the desk changes on a card is the one column that sends its mail again, to the address already on it.
    expect(columns(desk, 'gift_cards', 'update')).toEqual(['resent_at']);
    expect(columns(desk, 'vouchers', 'update')).toEqual(['resent_at']);
  });

  it('the desk marks a voucher used, and neither gives a use back nor cancels one', () => {
    expect(desk.limits?.['voucher_actions']).toEqual({ creatable: ['voucher_id', 'action', 'note'], creatableValues: { action: ['use'] } });
    expect(may(viewer, 'voucher_actions', 'create')).toBe(false);
  });

  it('the desk makes a voucher with what it is worth and who holds it, and nothing the ledger writes', () => {
    const made = columns(desk, 'vouchers', 'create');
    expect(made).toEqual(['worth', 'value', 'what', 'source_table', 'source_row', 'units', 'public_name', 'uses_total', 'holder_email', 'holder_name', 'language', 'expires_on', 'note', 'awaiting_sale']);
    for (const kept of ['code', 'status', 'sold', 'sale_price', 'tax_later', 'batch_id', 'uses_taken', 'uses_left']) expect(made, kept).not.toContain(kept);
    // The manager makes one with the same, and hangs none on a batch by hand: a batch counts what it made itself.
    expect(columns(manager, 'vouchers', 'create')).toEqual(made);
    // The desk reads a batch's name and counts — the Overview shows them to everybody who opens it — and makes none.
    expect(holds(desk, 'voucher_batches')).toBe('r');
    expect(may(desk, 'batch_chunks', 'create')).toBe(false);
  });

  it('the viewer writes nothing at all', () => {
    expect(viewer.permissions.filter((permission) => !permission.endsWith(':read') && !permission.startsWith('page:'))).toEqual([]);
  });
});

describe('the manager', () => {
  it('changes who a card or a voucher is for, and never what it holds', () => {
    expect(columns(manager, 'gift_cards', 'update')).toEqual(['recipient_name', 'recipient_email', 'sender_name', 'message', 'language', 'send_on', 'note', 'owner_email', 'status', 'void_reason', 'resent_at']);
    expect(columns(manager, 'vouchers', 'update')).toEqual(['holder_email', 'holder_name', 'language', 'note', 'expires_on', 'resent_at']);
    for (const kept of ['code', 'label', 'link_token', 'opening', 'taken', 'balance', 'expires_on', 'remind_on', 'notify', 'issued_at']) {
      expect(columns(manager, 'gift_cards', 'update'), kept).not.toContain(kept);
      expect(columns(manager, 'gift_cards', 'create'), kept).not.toContain(kept);
    }
    expect(columns(manager, 'gift_cards', 'create')).not.toContain('status');
  });

  it('writes no figure of an offer that Adminium or the ledger keeps, and starts none in a state of its choosing', () => {
    const kept = ['uses', 'given', 'budget_left', 'used_up'];
    expect(columns(manager, 'offers', 'update').slice().sort()).toEqual(columnsOf('offers').filter((ref) => !kept.includes(ref)).sort());
    expect(columns(manager, 'offers', 'create').slice().sort()).toEqual(columnsOf('offers').filter((ref) => ![...kept, 'status'].includes(ref)).sort());
    // No role writes a column the ledger sets on a row that is there.
    const ledger = manifest.addOn.ledgers[0] as unknown as { writes: Record<string, { update?: { set: string[] } }> };
    for (const role of roles) {
      for (const [table, scope] of Object.entries(ledger.writes)) {
        for (const ref of scope.update?.set ?? []) {
          // A state is moved by a person where a move lists them, and a voucher's last day is the manager's to change.
          if (ref === 'status' || (table === 'vouchers' && ref === 'expires_on')) continue;
          expect(columns(role, table, 'update'), `${role.key} changes ${table}.${ref}`).not.toContain(ref);
          // …nor starts a row with one, but for what a voucher made for a sale line says of itself.
          if (!(table === 'vouchers' && ref === 'awaiting_sale')) expect(columns(role, table, 'create'), `${role.key} creates ${table}.${ref}`).not.toContain(ref);
        }
      }
    }
  });

  it('queues a failed mail again, and writes nothing else of the log', () => {
    expect(manager.limits?.['messages']).toEqual({ writable: ['status'], writableValues: { status: ['queued'] } });
  });

  it('reads every code: a card is issued and looked up by somebody', () => {
    expect(manager.limits?.['gift_cards']?.readable).toBeUndefined();
    expect(manager.limits?.['vouchers']?.readable).toBeUndefined();
  });
});

describe('the mover\'s columns', () => {
  it('the mover\'s columns are in no role\'s lists', () => {
    // While cards come over from a till, a latch stops new ones; only a Super Admin sets it, and only the move gives a card a code.
    for (const role of roles) {
      expect(columns(role, 'settings', 'update'), `${role.key}: settings.cards_paused`).not.toContain('cards_paused');
      for (const kept of ['code', 'moved_from', 'moved_table', 'moving']) {
        expect(columns(role, 'gift_cards', 'create'), `${role.key} creates gift_cards.${kept}`).not.toContain(kept);
        expect(columns(role, 'gift_cards', 'update'), `${role.key} changes gift_cards.${kept}`).not.toContain(kept);
      }
    }
    // The manager changes every other setting.
    expect(columns(manager, 'settings', 'update').slice().sort()).toEqual(columnsOf('settings').filter((ref) => ref !== 'cards_paused').sort());
  });
});
