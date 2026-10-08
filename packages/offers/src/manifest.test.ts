/**
 * THE MANIFEST, HELD TO WHAT IT PROMISES.
 *
 * The manifest is the whole add-on as an installer sees it: the tables it
 * makes, the rules Adminium keeps on them, the ledger a posting writes into,
 * the reads a price is worked out from and the file that decides. This suite
 * validates it with the validator an install uses, then checks the things a
 * validator cannot know — that the file it names is the one the build writes,
 * that the deciding code may write only what is its to write, and that every
 * state it writes is a move the table lists.
 */

import { validateManifest } from '@adminiumjs/manifest';
import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };
import { BUILT_FILES, OUTPUT } from '../vite.config.ts';

interface Column {
  ref: string;
  type: string;
  role?: string;
  nullable?: boolean;
  default?: unknown;
  maxLength?: number;
  scale?: number | string;
  unique?: boolean;
  references?: string;
  rules?: Record<string, unknown>;
}
interface Move {
  to: string;
  planned?: boolean;
  roles?: string[];
}
interface Posting {
  id: string;
  into: { addOn: string; ledger: string; action: string };
  via?: string;
  post?: { on: Record<string, unknown> };
  reverse?: unknown;
  map: Record<string, unknown>;
}
interface Table {
  ref: string;
  columns: Column[];
  unique?: string[][];
  indexes?: string[][];
  postings?: Posting[];
  states?: { column: string; initial: string; moves: Record<string, Move[]>; timed?: { from: string; to: string; at: unknown }[]; lock?: { when: string[]; except?: string[] } };
}
interface Scope {
  insert?: string[];
  update?: { by: string[]; set: string[] };
}
interface Action {
  inputs: Record<string, string>;
  phases: string[];
  reads: { as: string; table: string }[];
  locks: { read: string; column: string; table: string }[];
  writes?: string[];
  decides?: { input: string; min: string; max: Record<string, string> }[];
  holds?: boolean;
  unavailable?: unknown;
}
interface Ledger {
  id: string;
  receipts: string;
  refusal: string;
  writes: Record<string, Scope>;
  actions: Record<string, Action>;
}

const tables = manifest.requiredSchema.tables as unknown as Table[];
const tableOf = (ref: string): Table => {
  const found = tables.find((table) => table.ref === ref);
  if (found === undefined) throw new Error(`no table "${ref}"`);
  return found;
};
const columnOf = (table: string, ref: string): Column => {
  const found = tableOf(table).columns.find((column) => column.ref === ref);
  if (found === undefined) throw new Error(`no column "${table}.${ref}"`);
  return found;
};
const ledgers = manifest.addOn.ledgers as unknown as Ledger[];
const value = ledgers[0]!;

/** The rules through which Adminium fills a column itself: nothing else may write one. */
const DECIDING = ['rollup', 'formula', 'copy', 'stamp', 'sequence', 'format', 'code', 'lookup', 'customerKey', 'codeLast4'];
const decided = (column: Column): boolean => DECIDING.some((rule) => column.rules?.[rule] !== undefined);
interface Rollup {
  from: string;
  via: string;
  sum?: string;
  count?: boolean;
  unlessSet?: string;
  where?: unknown;
  balance?: { column: string; of: string; minus?: string[] };
  cap?: boolean;
  capUnless?: { column: string };
}
const rollupOf = (table: string, ref: string): Rollup => columnOf(table, ref).rules?.['rollup'] as Rollup;
/** Every column a total keeps as its balance. */
const balances = (table: Table): string[] => table.columns.flatMap((column) => ((column.rules?.['rollup'] as Rollup | undefined)?.balance === undefined ? [] : [(column.rules?.['rollup'] as Rollup).balance!.column]));

describe('the manifest', () => {
  it('validates, and names every built file', () => {
    const result = validateManifest(manifest);
    const issues = result.ok ? [] : result.issues.map((issue) => `${String(issue.path)}: ${issue.message}`);
    expect(issues).toEqual([]);
    // One file answers both questions: which rows a posting makes, and what an order's reductions come to.
    expect(manifest.addOn.provides).toEqual([
      { contract: 'posting-rows', version: 1, server: OUTPUT.server },
      { contract: 'price-adjust', version: 1, server: OUTPUT.server },
    ]);
    for (const entry of manifest.addOn.provides) expect(BUILT_FILES).toContain(entry.server);
  });

  it('is an add-on that attaches to every deployment, and to none in particular', () => {
    expect(manifest.kind).toBe('add-on');
    expect(manifest.key).toBe('offers');
    // It must work with no app at all: a card is issued, a voucher used and a code made from its own screens.
    expect(manifest.addOn.attaches).toEqual([{ app: '*' }]);
    expect(manifest.addOn.connect).toEqual({ kind: 'none' });
    expect(manifest.requiredSchema.prefixed).toBe(true);
    expect(manifest.categories).toEqual(['data']);
  });

  it('asks for the server that runs a price rule, and for no app', () => {
    expect(manifest.compatibility).toEqual({ minAdminiumVersion: '0.3.19', requires: [] });
    expect(manifest.addOns.suggests.map((one) => one.key)).toEqual(['invoices']);
  });
});

describe('the tables', () => {
  it('are the twenty of the design, each with a key of its own, first', () => {
    expect(tables.map((table) => table.ref).sort()).toEqual(
      [
        'applied',
        'batch_chunks',
        'card_actions',
        'card_ledger',
        'ceilings',
        'codes',
        'gift_cards',
        'group_members',
        'groups',
        'messages',
        'offer_breaks',
        'offer_targets',
        'offers',
        'postings',
        'reasons',
        'redemptions',
        'settings',
        'voucher_actions',
        'voucher_batches',
        'vouchers',
      ].sort(),
    );
    for (const table of tables) {
      expect(table.columns[0], table.ref).toMatchObject({ ref: 'id', role: 'pk' });
      expect(new Set(table.columns.map((column) => column.ref)).size, table.ref).toBe(table.columns.length);
    }
  });

  it('bound every text column, so each can be indexed on every database', () => {
    for (const table of tables) {
      for (const column of table.columns.filter((one) => one.type === 'text')) expect(column.maxLength, `${table.ref}.${column.ref}`).toBeGreaterThan(0);
    }
  });

  it('no unique set names a column that may be empty', () => {
    const sets = tables.flatMap((table) => (table.unique ?? []).map((set) => ({ table: table.ref, set })));
    expect(sets.map((one) => `${one.table}: ${one.set.join(', ')}`).sort()).toEqual(['group_members: group_id, email', 'offer_breaks: offer_id, from_qty', 'offer_targets: offer_id, kind, source_table, source_row']);
    for (const { table, set } of sets) for (const ref of set) expect(columnOf(table, ref).nullable, `${table}.${ref}`).not.toBe(true);
    // A column that is unique by itself may be empty only where a row may have none: a credit has no code, a card that was
    // never moved no old key, a card nobody opened by link no token. A discount code and a name are never empty.
    const alone = tables.flatMap((table) => table.columns.filter((column) => column.unique === true).map((column) => `${table.ref}.${column.ref}${column.nullable === true ? ' (may be empty)' : ''}`));
    expect(alone.sort()).toEqual([
      'ceilings.role',
      'codes.code',
      'gift_cards.code (may be empty)',
      'gift_cards.link_token (may be empty)',
      'gift_cards.moved_from (may be empty)',
      'groups.name',
      'reasons.label',
      'vouchers.code',
    ]);
  });

  it('a balance and its parts keep one scale', () => {
    const shape = (column: Column) => `${column.type}:${String(column.scale ?? '')}`;
    let seen = 0;
    for (const table of tables) {
      for (const column of table.columns) {
        const rollup = column.rules?.['rollup'] as Rollup | undefined;
        if (rollup?.balance === undefined) continue;
        seen += 1;
        const parts = [column, columnOf(table.ref, rollup.balance.column), columnOf(table.ref, rollup.balance.of), ...(rollup.sum === undefined ? [] : [columnOf(rollup.from, rollup.sum)])];
        expect(new Set(parts.map(shape)).size, `${table.ref}.${column.ref}: ${parts.map((part) => `${part.ref} ${shape(part)}`).join(', ')}`).toBe(1);
      }
    }
    // An offer's budget, a pack's uses, a card's money, a batch's count.
    expect(seen).toBe(4);
  });

  it('have one settings row an install can make: every column of it may be empty or has a default', () => {
    expect(manifest.addOn.settingsTable).toBe('settings');
    for (const column of tableOf('settings').columns.filter((one) => one.role !== 'pk')) expect(column.nullable === true || column.default !== undefined, `settings.${column.ref}`).toBe(true);
    expect(manifest).not.toHaveProperty('seeds');
    expect(manifest).not.toHaveProperty('settings');
  });

  it('say which row of another table a row belongs to by a stored table name and a key', () => {
    for (const ref of ['offer_targets', 'vouchers', 'voucher_batches', 'card_ledger', 'redemptions', 'applied']) {
      expect(columnOf(ref, 'source_table'), ref).toMatchObject({ type: 'text', maxLength: 96, rules: { tableRef: true } });
      expect(columnOf(ref, 'source_row').maxLength, ref).toBe(64);
    }
    // No host row is the empty name, never an empty column.
    for (const ref of ['offer_targets', 'vouchers', 'voucher_batches', 'card_ledger', 'redemptions', 'applied']) expect(columnOf(ref, 'source_table'), ref).toMatchObject({ default: '' });
    expect(columnOf('gift_cards', 'moved_table')).toMatchObject({ default: '', rules: { tableRef: true } });
  });

  it('keep an address as personal data, in one spelling, beside a key that stands for it', () => {
    for (const [table, address, key] of [
      ['group_members', 'email', 'member_key'],
      ['vouchers', 'holder_email', 'holder_key'],
      ['gift_cards', 'owner_email', 'owner_key'],
    ] as const) {
      expect(columnOf(table, address).rules, `${table}.${address}`).toMatchObject({ personal: true, normalize: 'email' });
      expect(columnOf(table, key), `${table}.${key}`).toMatchObject({ type: 'text', maxLength: 64, nullable: true, rules: { customerKey: { of: address } } });
    }
    expect(columnOf('gift_cards', 'recipient_email').rules).toMatchObject({ personal: true, normalize: 'email' });
    expect(columnOf('messages', 'to_address').rules).toMatchObject({ personal: true });
    // A use is told apart by the key Adminium proved, never by an address.
    expect(columnOf('redemptions', 'customer')).toMatchObject({ type: 'text', maxLength: 64, nullable: true });
    expect(tableOf('redemptions').columns.map((column) => column.ref).filter((ref) => ref.includes('email'))).toEqual([]);
  });

  it('take no link and no address in the text a person types onto a card or an action', () => {
    for (const [table, ref] of [
      ['gift_cards', 'recipient_name'],
      ['gift_cards', 'sender_name'],
      ['gift_cards', 'message'],
      ['vouchers', 'holder_name'],
      ['card_actions', 'reason'],
    ] as const) {
      expect(columnOf(table, ref).rules?.['plainText'], `${table}.${ref}`).toBeDefined();
    }
  });
});

describe('codes', () => {
  it('a card and a voucher are given a code by Adminium; a discount code is a word somebody types', () => {
    expect(columnOf('gift_cards', 'code')).toMatchObject({ unique: true, nullable: true, rules: { code: { prefix: 'GC-', length: 12 } } });
    // One column cannot make two prefixes: a voucher's word is read from what it is worth, and its code is stored bare.
    expect(columnOf('vouchers', 'code').rules).toEqual({ code: { length: 12 } });
    // A code Adminium makes is a secret: what staff type into its column is dropped, and no log shows it. A discount code is
    // published on a leaflet, so its column is plain text kept as codes are compared; one is made on request, before the save.
    expect(columnOf('codes', 'code')).toEqual({ ref: 'code', type: 'text', maxLength: 24, unique: true, rules: { normalize: 'code' } });
    expect(manifest.addOn.adjuster.codes).toMatchObject({ table: 'codes', column: 'code', reserved: ['GC', 'VC', 'PK'] });
    expect(manifest.addOn.adjuster.vouchers).toEqual({ table: 'vouchers', column: 'code', prefixes: ['VC-', 'PK-'] });
  });

  it('a list shows the last four of a code it never shows', () => {
    expect(columnOf('gift_cards', 'label')).toMatchObject({ type: 'text', maxLength: 4, nullable: true, rules: { codeLast4: { of: 'code' } } });
    expect(columnOf('vouchers', 'code_last4')).toMatchObject({ type: 'text', maxLength: 4, nullable: true, rules: { codeLast4: { of: 'code' } } });
  });

  it('the token of a card\'s own link is one staff never see', () => {
    expect(columnOf('gift_cards', 'link_token')).toMatchObject({ unique: true, nullable: true, rules: { code: { length: 16, hiddenFromStaff: true } } });
  });
});

describe('the limits', () => {
  it('an offer with a budget is capped by it, and one with none is not capped at nothing', () => {
    expect(rollupOf('offers', 'given')).toEqual({ from: 'redemptions', via: 'offer_id', sum: 'amount', unlessSet: 'given_back_at', balance: { column: 'budget_left', of: 'budget' }, cap: true, capUnless: { column: 'budget_open' } });
    expect(columnOf('offers', 'budget_open')).toMatchObject({ type: 'bool', default: true });
    expect(columnOf('offers', 'budget').rules).toMatchObject({ requiredWhen: { column: 'budget_open', in: [false] } });
  });

  it('a use given back is counted by no total', () => {
    expect(rollupOf('offers', 'uses')).toEqual({ from: 'redemptions', via: 'offer_id', count: true, unlessSet: 'given_back_at' });
    expect(rollupOf('codes', 'uses')).toEqual({ from: 'redemptions', via: 'code_id', count: true, unlessSet: 'given_back_at' });
    expect(rollupOf('vouchers', 'uses_taken')).toEqual({ from: 'redemptions', via: 'voucher_id', sum: 'uses', unlessSet: 'given_back_at', balance: { column: 'uses_left', of: 'uses_total' }, cap: true });
  });

  it('a card never goes below nothing, except while its history is being brought in', () => {
    expect(rollupOf('gift_cards', 'taken')).toEqual({ from: 'card_ledger', via: 'card_id', sum: 'taken', balance: { column: 'balance', of: 'opening' }, cap: true, capUnless: { column: 'moving' } });
    // Nothing writes `opening`: it is there because a cap needs a balance.
    expect(columnOf('gift_cards', 'opening')).toMatchObject({ default: 0 });
    expect(value.writes['gift_cards']?.update?.set).not.toContain('opening');
    // What the holder reads has the holder's sign.
    expect(columnOf('card_ledger', 'amount').rules).toEqual({ formula: { sub: [0, 'taken'] } });
  });

  it('a code and an offer each take only as many uses as they say, held ones counted', () => {
    const counted = { column: 'state', values: ['held', 'counted'] };
    expect((tableOf('redemptions') as unknown as { capacity: unknown }).capacity).toEqual([
      { kind: 'parent', via: 'code_id', size: { column: 'max_uses' }, countWhere: counted, lockBy: 'code_id' },
      { kind: 'parent', via: 'offer_id', size: { column: 'max_uses' }, countWhere: counted, lockBy: 'offer_id' },
    ]);
    // The end of a hold is the receipt's, so no column of a use says it.
    expect(tableOf('redemptions').columns.map((column) => column.ref)).not.toContain('held_until');
    expect(columnOf('postings', 'held_until')).toMatchObject({ type: 'timestamptz', nullable: true });
  });

  it('a batch makes no more vouchers than it was asked for, in parts of five hundred at most', () => {
    expect(rollupOf('voucher_batches', 'asked')).toEqual({ from: 'batch_chunks', via: 'batch_id', sum: 'size', balance: { column: 'to_make', of: 'count' }, cap: true });
    expect(columnOf('batch_chunks', 'size').rules).toMatchObject({ validation: { min: 1, max: 500 } });
    expect(columnOf('voucher_batches', 'count').rules).toMatchObject({ validation: { min: 1, max: 5000 } });
  });

  it('the reads a save makes by something other than a key each have an index', () => {
    expect(tableOf('redemptions').indexes).toEqual([
      ['source_table', 'source_row'],
      ['customer', 'offer_id'],
    ]);
    expect(tableOf('applied').indexes).toEqual([['source_table', 'source_row']]);
    expect(tableOf('messages').indexes).toEqual([['card_id'], ['voucher_id']]);
  });
});

describe('the states', () => {
  const movesOf = (ref: string) => tableOf(ref).states!.moves;
  const move = (ref: string, from: string, to: string): Move => {
    const found = (movesOf(ref)[from] ?? []).find((one) => one.to === to);
    if (found === undefined) throw new Error(`${ref}: no move ${from} → ${to}`);
    return found;
  };

  it('every status the planner writes is a move the table lists', () => {
    // What the deciding code sets, from which state: a planned update is judged as a declared move.
    const written: Record<string, [string, string][]> = {
      gift_cards: [['inactive', 'active']],
      vouchers: [
        ['issued', 'used'],
        ['used', 'issued'],
        ['issued', 'voided'],
        ['used', 'voided'],
        ['expired', 'issued'],
        ['expired', 'voided'],
      ],
    };
    expect(value.writes['gift_cards']?.update?.set).toContain('status');
    expect(value.writes['vouchers']?.update?.set).toContain('status');
    for (const [ref, moves] of Object.entries(written)) {
      for (const [from, to] of moves) {
        // Made only by the deciding code: never a button, and refused to every person and role.
        expect(move(ref, from, to), `${ref}: ${from} → ${to}`).toEqual({ to, planned: true });
      }
    }
    // The moves a manager or the clock makes are not the planner's.
    const planned = (ref: string) => Object.entries(movesOf(ref)).flatMap(([from, list]) => list.filter((one) => one.planned === true).map((one) => `${from} → ${one.to}`));
    expect(planned('gift_cards')).toEqual(['inactive → active']);
    expect(planned('vouchers').sort()).toEqual(written['vouchers']!.map(([from, to]) => `${from} → ${to}`).sort());
    expect(planned('offers')).toEqual([]);
    // No other table whose status the ledger may write.
    expect(Object.entries(value.writes).filter(([, scope]) => scope.update?.set.includes('status')).map(([ref]) => ref).sort()).toEqual(['gift_cards', 'vouchers']);
  });

  it('a manager makes every move a person makes', () => {
    for (const ref of ['offers', 'vouchers', 'gift_cards']) {
      for (const [from, list] of Object.entries(movesOf(ref))) {
        for (const one of list.filter((candidate) => candidate.planned !== true)) expect(one.roles, `${ref}: ${from} → ${one.to}`).toEqual(['manager']);
      }
    }
  });

  it('a last day is the whole of that day: the clock moves the row the day after', () => {
    const dayAfter = (column: string) => ({ column, time: '00:00', plus: { days: 1 } });
    expect(tableOf('offers').states!.timed).toEqual([
      { from: 'active', to: 'ended', at: dayAfter('ends_on') },
      { from: 'paused', to: 'ended', at: dayAfter('ends_on') },
    ]);
    expect(tableOf('vouchers').states!.timed).toEqual([{ from: 'issued', to: 'expired', at: dayAfter('expires_on') }]);
    expect(tableOf('gift_cards').states!.timed).toEqual([{ from: 'active', to: 'expired', at: dayAfter('expires_on') }]);
    for (const ref of ['offers', 'vouchers', 'gift_cards']) {
      for (const timed of tableOf(ref).states!.timed ?? []) expect(move(ref, timed.from, timed.to).planned, `${ref}: ${timed.from} → ${timed.to}`).toBeUndefined();
    }
  });

  it('every card starts holding nothing and inactive, and a cancelled or expired one stays so', () => {
    const cards = tableOf('gift_cards').states!;
    expect(cards.initial).toBe('inactive');
    expect(movesOf('gift_cards')['void']).toEqual([]);
    expect(movesOf('gift_cards')['expired']).toEqual([]);
    expect(columnOf('gift_cards', 'void_reason').rules).toMatchObject({ requiredWhen: { column: 'status', in: ['void'] } });
    expect(movesOf('vouchers')['voided']).toEqual([]);
  });

  it('an ended offer is locked but for its last day, which running it again asks for', () => {
    expect(tableOf('offers').states!.lock).toEqual({ when: ['ended'], except: ['ends_on'] });
    expect(move('offers', 'ended', 'active').roles).toEqual(['manager']);
  });
});

describe('the ledger', () => {
  it('is one ledger of eleven actions, and money fails closed', () => {
    expect(ledgers).toHaveLength(1);
    expect(value).toMatchObject({ id: 'value', receipts: 'postings', refusal: 'value' });
    expect(Object.keys(value.actions).sort()).toEqual(['card-action', 'expire', 'issue', 'make', 'move', 'redeem', 'refund', 'sell', 'spend', 'void', 'voucher-action']);
    // No action lets a save through while the add-on cannot answer.
    for (const [name, action] of Object.entries(value.actions)) expect(action.unavailable, name).toBeUndefined();
  });

  it('each action takes, reads and writes what the design says, and nothing else', () => {
    interface Read {
      as: string;
      table: string;
      by: { column: string; from: unknown }[];
      where?: { column: string; eq?: unknown; in?: unknown[] }[];
    }
    const read = (one: Read) =>
      `${one.as}: ${one.table} by ${one.by.map((by) => `${by.column} ← ${String(by.from)}`).join(', ')}${one.where === undefined ? '' : ` where ${one.where.map((where) => `${where.column} ${where.eq !== undefined ? `= ${String(where.eq)}` : `in ${String(where.in)}`}`).join(', ')}`}`;
    const told = Object.fromEntries(
      Object.entries(value.actions).map(([name, action]) => [
        name,
        {
          inputs: Object.entries(action.inputs).map(([input, type]) => `${input} ${type}`).join(', '),
          phases: action.phases.join(', '),
          reads: (action.reads as unknown as Read[]).map(read),
          locks: action.locks.map((lock) => `${lock.read}.${lock.column} of ${lock.table}`).join(', '),
          writes: (action.writes ?? []).join(', '),
        },
      ]),
    );
    const card = 'card: gift_cards by id ← input.card';
    const cardLock = 'card.id of gift_cards';
    expect(told).toEqual({
      redeem: {
        inputs: 'reason link?, label text?',
        phases: 'reserve, post, reverse',
        // What this round wrote, then the rows a use — or a row this round wrote — counts on: a reverse hands no uses, and still reads them.
        reads: [
          'mine: redemptions by receipt_id ← receipt.id',
          'offers: offers by id ← uses.offer,mine.offer_id',
          'codes: codes by id ← uses.code,mine.code_id',
          'vouchers: vouchers by id ← uses.voucher,mine.voucher_id',
        ],
        locks: 'offers.id of offers, codes.id of codes, vouchers.id of vouchers',
        writes: 'redemptions, vouchers, offers',
      },
      spend: { inputs: 'card link?, due decimal?, ask decimal?, amount decimal, balance_after decimal, label text?', phases: 'post, reverse', reads: [card], locks: cardLock, writes: 'card_ledger' },
      refund: {
        inputs: 'against_table text, against_row text, amount decimal?, label text?',
        phases: 'post, reverse',
        reads: ['spend: card_ledger by source_table ← input.against_table, source_row ← input.against_row where kind = spend', 'card: gift_cards by id ← spend.card_id', 'given: card_ledger by against_id ← spend.id'],
        locks: cardLock,
        writes: 'card_ledger',
      },
      issue: { inputs: 'card link?, amount decimal?, label text?', phases: 'post, reverse', reads: [card], locks: cardLock, writes: 'card_ledger, gift_cards' },
      'card-action': { inputs: 'card link, action text, amount decimal, reason text', phases: 'post', reads: [card], locks: cardLock, writes: 'card_ledger, gift_cards' },
      'voucher-action': {
        inputs: 'voucher link, action text',
        phases: 'post',
        reads: ['voucher: vouchers by id ← input.voucher', 'last: redemptions by voucher_id ← input.voucher where state = counted', 'none: offers by id ← last.offer_id'],
        locks: 'voucher.id of vouchers, none.id of offers',
        writes: 'redemptions, vouchers',
      },
      sell: { inputs: 'voucher link?, amount decimal?, tax_later bool?', phases: 'post, reverse', reads: ['voucher: vouchers by id ← input.voucher'], locks: 'voucher.id of vouchers', writes: 'vouchers' },
      expire: { inputs: 'card rowRef', phases: 'post', reads: ['card: gift_cards by id ← input.card.row'], locks: cardLock, writes: 'card_ledger' },
      void: { inputs: 'card rowRef', phases: 'post', reads: ['card: gift_cards by id ← input.card.row'], locks: cardLock, writes: 'card_ledger' },
      make: { inputs: 'batch link, size number', phases: 'post', reads: ['batch: voucher_batches by id ← input.batch'], locks: 'batch.id of voucher_batches', writes: 'vouchers' },
      move: { inputs: 'old_card text, kind text, amount decimal, at text, note text?', phases: 'post', reads: ['card: gift_cards by moved_from ← input.old_card'], locks: cardLock, writes: 'card_ledger, gift_cards' },
    });
  });

  it('writes, of each table, exactly the columns the design gives it', () => {
    expect(value.writes).toEqual({
      card_ledger: { insert: ['card_id', 'kind', 'taken', 'value', 'balance_after', 'against_id', 'source_table', 'source_row', 'source_label', 'note', 'at'] },
      redemptions: {
        insert: ['kind', 'offer_id', 'code_id', 'voucher_id', 'reason_id', 'source_table', 'source_row', 'source_label', 'customer', 'amount', 'uses', 'prepaid', 'state', 'at'],
        update: { by: ['id'], set: ['state', 'at', 'given_back_at'] },
      },
      gift_cards: { update: { by: ['id'], set: ['status', 'issued_at', 'expires_on', 'remind_on', 'notify'] } },
      vouchers: {
        insert: ['batch_id', 'worth', 'value', 'what', 'source_table', 'source_row', 'units', 'public_name', 'uses_total', 'expires_on', 'note'],
        update: { by: ['id'], set: ['status', 'sold', 'awaiting_sale', 'sale_price', 'tax_later', 'expires_on'] },
      },
      offers: { update: { by: ['id'], set: ['used_up'] } },
    });
  });

  it('lets the deciding code write no column Adminium decides, no balance and no key', () => {
    for (const [ref, scope] of Object.entries(value.writes)) {
      const table = tableOf(ref);
      const kept = new Set([...table.columns.filter(decided).map((column) => column.ref), ...balances(table), 'id', 'receipt_id']);
      for (const name of [...(scope.insert ?? []), ...(scope.update?.set ?? [])]) {
        expect(table.columns.map((column) => column.ref), `${ref}.${name}`).toContain(name);
        expect(kept.has(name), `${ref}.${name} is Adminium's to fill`).toBe(false);
      }
    }
    // A code is never the deciding code's to write: Adminium makes each one.
    expect(value.writes['vouchers']?.insert).not.toContain('code');
    expect(Object.keys(value.writes).sort()).toEqual(['card_ledger', 'gift_cards', 'offers', 'redemptions', 'vouchers']);
  });

  it('marks every row the deciding code adds with the receipt that added it', () => {
    for (const [ref, scope] of Object.entries(value.writes)) {
      if (scope.insert === undefined) continue;
      expect(columnOf(ref, 'receipt_id'), ref).toMatchObject({ type: 'fk', references: 'postings', nullable: true });
    }
  });

  it('stays inside the limits a ledger is held to, and no action writes outside it', () => {
    expect(Object.keys(value.actions).length).toBeLessThanOrEqual(16);
    for (const [name, action] of Object.entries(value.actions)) {
      expect(action.reads.length, name).toBeLessThanOrEqual(6);
      expect(action.writes, `${name} says what it writes`).toBeDefined();
      for (const ref of action.writes ?? []) expect(Object.keys(value.writes), `${name} → ${ref}`).toContain(ref);
      for (const lock of action.locks) expect(action.reads.map((read) => read.as), `${name} locks ${lock.read}`).toContain(lock.read);
    }
  });

  it('a card pays no more than is due and no more than it holds, and says what it then holds', () => {
    const spend = value.actions['spend']!;
    expect(spend.decides).toEqual([
      { input: 'amount', min: '0', max: { input: 'due' } },
      { input: 'amount', min: '0', max: { read: 'card', column: 'balance' } },
      { input: 'balance_after', min: '0', max: { read: 'card', column: 'balance' } },
    ]);
    expect(spend.locks).toEqual([{ read: 'card', column: 'id', table: 'gift_cards' }]);
    // A cash payment in a table that also takes cards has no card: the link may be empty.
    expect(spend.inputs['card']).toBe('link?');
    expect(value.actions['issue']!.inputs['card']).toBe('link?');
    expect(value.actions['sell']!.inputs['voucher']).toBe('link?');
  });

  it('a use holds until its order is posted, under the lock of everything it counts against', () => {
    const redeem = value.actions['redeem']!;
    expect(redeem.holds).toBe(true);
    expect(redeem.phases).toEqual(['reserve', 'post', 'reverse']);
    expect(redeem.locks.map((lock) => lock.table).sort()).toEqual(['codes', 'offers', 'vouchers']);
    // Every input is optional, so a host's rule that maps nothing is a whole rule.
    expect(Object.values(redeem.inputs).every((type) => type.endsWith('?'))).toBe(true);
  });

  it('a refund names the payment it gives back to, never the order', () => {
    const refund = value.actions['refund']!;
    expect(refund.inputs).toMatchObject({ against_table: 'text', against_row: 'text' });
    expect(refund.reads.map((read) => `${read.as}: ${read.table}`)).toEqual(['spend: card_ledger', 'card: gift_cards', 'given: card_ledger']);
  });

  it('the add-on\'s own tables post what a person does by hand', () => {
    const own = tables.flatMap((table) => (table.postings ?? []).map((posting) => `${table.ref} ${posting.id} → ${posting.into.action}${posting.via === undefined ? '' : ` via ${posting.via}`}`));
    expect(own.sort()).toEqual([
      'batch_chunks make → make',
      'card_actions card-action → card-action via card_id',
      'gift_cards expire → expire',
      'gift_cards void → void',
      'voucher_actions voucher-action → voucher-action via voucher_id',
    ]);
    for (const table of tables) for (const posting of table.postings ?? []) expect(posting.into, `${table.ref}.${posting.id}`).toMatchObject({ addOn: 'offers', ledger: 'value' });
    // A card closed by a person or by the clock writes its closing row from the move itself, and nothing takes that back.
    const cards = tableOf('gift_cards').postings!;
    expect(cards.map((posting) => posting.post?.on)).toEqual([{ to: ['void'] }, { to: ['expired'] }]);
    for (const posting of cards) {
      expect(posting.map).toEqual({ card: { row: true } });
      expect(posting.reverse).toBeUndefined();
    }
    // The planner never sets a status that would need a closing row: only the card's own move does.
    expect(['void', 'expired'].some((state) => (tableOf('gift_cards').states!.moves['active'] ?? []).some((one) => one.to === state && one.planned === true))).toBe(false);
  });
});

describe('what a price is worked out from', () => {
  const adjuster = manifest.addOn.adjuster;

  it('reads every offer with its breaks and targets, and the reasons staff give', () => {
    expect(adjuster.offers.map((read) => `${read.as}: ${read.table}`)).toEqual(['offers: offers', 'breaks: offer_breaks', 'targets: offer_targets', 'reasons: reasons']);
  });

  it('writes what was applied as it read at that moment, by the row and the line it reduced', () => {
    expect(adjuster.applied).toEqual({
      table: 'applied',
      source: { table: 'source_table', row: 'source_row', line: 'source_line' },
      columns: { offer: 'offer_id', code: 'code_id', voucher: 'voucher_id', name: 'name', kind: 'kind', amount: 'amount', reason: 'reason_id', typed: 'typed', at: 'at' },
    });
    for (const column of Object.values(adjuster.applied.columns)) expect(tableOf('applied').columns.map((one) => one.ref)).toContain(column);
    expect(columnOf('applied', 'kind').type).toBe('enum');
    expect((columnOf('applied', 'kind') as unknown as { enum: string[] }).enum).toEqual(['offer', 'code', 'voucher', 'pack', 'staff']);
  });

  it('knows a person by a key, in their groups and in what they used before', () => {
    expect(adjuster.customerKey).toBe('hash');
    expect(adjuster.person).toEqual({
      groups: { table: 'group_members', member: 'member_key', group: 'group_id' },
      uses: { table: 'redemptions', customer: 'customer', offer: 'offer_id', state: 'state', counted: ['held', 'counted'] },
      orders: true,
    });
  });

  it('holds a reduction given by hand to the giver\'s limit, and a comp to a leave', () => {
    expect(adjuster.ceilings).toEqual({ table: 'ceilings', role: 'role', maxPercent: 'max_percent', maxAmount: 'max_amount', comp: 'may_comp' });
    // No row is a limit of nothing, and no leave.
    expect(columnOf('ceilings', 'max_percent')).toMatchObject({ default: 0 });
    expect(columnOf('ceilings', 'may_comp')).toMatchObject({ type: 'bool', default: false });
  });
});
