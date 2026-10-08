/**
 * THE PAGES ADMINIUM DRAWS, AND THE BUTTONS ON A RECORD.
 *
 * Eleven of this add-on's screens are not code: a list, a record and a form
 * that Adminium draws from the manifest. This suite holds each to the table
 * it reads — every column a form, a filter or a tab names is there — and to
 * the two things a generated screen must never do here: show a card's or a
 * voucher's code, and let somebody type a figure the ledger writes.
 */

import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };

const LOCALES = ['en-US', 'de-DE', 'fr-FR', 'da-DK', 'cs-CZ', 'ar-EG', 'zh-CN', 'zh-TW'];

interface Field {
  column: string;
  control?: string;
}
interface Page {
  ref: string;
  template: string;
  title: { key: string; fallback: string };
  titles: Record<string, string>;
  nav: { group: string; icon: string; order: number };
  bindings: { rows: string };
  config: {
    form?: { v: number; sections: { id: string; fields: Field[] }[] };
    filters?: Field[];
    defaultFilters?: { column: string; op: string; value: unknown }[];
    tabs?: Record<string, { noNew?: boolean; empty?: Record<string, string>; emptyBody?: Record<string, string> }>;
  };
}
interface Column {
  ref: string;
  type: string;
  enum?: string[];
  references?: string;
  rules?: Record<string, unknown>;
}
interface Action {
  id: string;
  label: Record<string, string>;
  in?: string[];
  move?: { to: string };
  child?: { table: string; via: string; form: string[] };
  set?: Record<string, unknown>;
  ask?: string[];
  tone?: string;
  confirm?: Record<string, string>;
}
interface Table {
  ref: string;
  columns: Column[];
  states?: { moves: Record<string, { to: string; planned?: boolean }[]>; actions?: Action[] };
}

const pages = manifest.pages as unknown as Page[];
const tables = manifest.requiredSchema.tables as unknown as Table[];
const tableOf = (ref: string): Table => tables.find((table) => table.ref === ref)!;
const columnOf = (table: string, ref: string): Column | undefined => tableOf(table).columns.find((column) => column.ref === ref);
const pageOf = (ref: string): Page => pages.find((page) => page.ref === ref)!;
const fieldsOf = (page: Page): Field[] => (page.config.form?.sections ?? []).flatMap((section) => section.fields);
const typed = (page: Page): string[] => fieldsOf(page).filter((field) => field.control !== 'readonly').map((field) => field.column);
const ledger = manifest.addOn.ledgers[0] as unknown as { writes: Record<string, { insert?: string[]; update?: { set: string[] } }> };
/** The rules through which Adminium fills a column itself. */
const DECIDING = ['rollup', 'formula', 'stamp', 'code', 'customerKey', 'codeLast4'];

describe('the rail', () => {
  it('has two groups of its own, each named in eight languages', () => {
    expect(manifest.navGroups.map((group) => `${group.key} ${String(group.order)} ${group.label['en-US']}`)).toEqual(['offers 40 Offers', 'offers-setup 41 Offers setup']);
    for (const group of manifest.navGroups) expect(Object.keys(group.label), group.key).toEqual(LOCALES);
  });

  it('lists eleven generated pages, each over one table of the add-on, in the order of the design', () => {
    expect(pages.map((page) => `${String(page.nav.order)} ${page.ref} ${page.bindings.rows} ${page.nav.group}`)).toEqual([
      '20 offers-codes codes manifest:offers',
      '30 offers-vouchers vouchers manifest:offers',
      '35 offers-voucher-batches voucher_batches manifest:offers',
      '40 offers-gift-cards gift_cards manifest:offers',
      '60 offers-activity card_ledger manifest:offers',
      '65 offers-uses redemptions manifest:offers',
      '70 offers-groups groups manifest:offers-setup',
      '80 offers-reasons reasons manifest:offers-setup',
      '90 offers-staff-limits ceilings manifest:offers-setup',
      '105 offers-messages messages manifest:offers-setup',
      '110 offers-settings settings manifest:offers-setup',
    ]);
    for (const page of pages) {
      expect(page.template, page.ref).toBe('page-crud');
      expect(tables.map((table) => table.ref), page.ref).toContain(page.bindings.rows);
      expect(page.ref.startsWith('offers-'), page.ref).toBe(true);
    }
  });

  it('titles every page in eight languages, the English one as the fallback', () => {
    for (const page of pages) {
      expect(Object.keys(page.titles), page.ref).toEqual(LOCALES);
      expect(page.title.fallback, page.ref).toBe(page.titles['en-US']);
      expect(page.title.key, page.ref).toMatch(/^addon\.offers\.page\.[A-Za-z]+$/);
      for (const locale of LOCALES) expect(page.titles[locale]!.trim().length, `${page.ref} ${locale}`).toBeGreaterThan(0);
    }
    expect(new Set(pages.map((page) => page.title.key)).size).toBe(pages.length);
  });
});

describe('what a generated page names is there', () => {
  it('every form field, filter and default filter is a column of the page\'s table, named once', () => {
    for (const page of pages) {
      const named = [...fieldsOf(page), ...(page.config.filters ?? []), ...(page.config.defaultFilters ?? [])];
      for (const one of named) expect(columnOf(page.bindings.rows, one.column), `${page.ref}: ${one.column}`).toBeDefined();
      const inForm = fieldsOf(page).map((field) => field.column);
      expect(new Set(inForm).size, page.ref).toBe(inForm.length);
      expect((page.config.filters ?? []).length, page.ref).toBeLessThanOrEqual(6);
    }
  });

  it('a default filter names values the column holds', () => {
    for (const page of pages) {
      for (const filter of page.config.defaultFilters ?? []) {
        const allowed = columnOf(page.bindings.rows, filter.column)!.enum ?? [];
        for (const value of Array.isArray(filter.value) ? filter.value : [filter.value]) expect(allowed, `${page.ref}: ${filter.column} = ${String(value)}`).toContain(value);
      }
    }
    // A cancelled or an expired card is one filter away, not in the way.
    expect(pageOf('offers-gift-cards').config.defaultFilters).toEqual([{ column: 'status', op: 'in', value: ['active', 'inactive'] }]);
    expect(pageOf('offers-uses').config.defaultFilters).toEqual([{ column: 'state', op: 'eq', value: 'counted' }]);
  });

  it('every tab is a table whose rows link to the record', () => {
    const tabs = Object.fromEntries(pages.filter((page) => page.config.tabs !== undefined).map((page) => [page.bindings.rows, Object.keys(page.config.tabs!)]));
    expect(tabs).toEqual({
      vouchers: ['redemptions', 'voucher_actions', 'messages'],
      voucher_batches: ['vouchers', 'batch_chunks'],
      gift_cards: ['card_ledger', 'card_actions', 'messages'],
    });
    for (const [parent, children] of Object.entries(tabs)) {
      for (const child of children) expect(tableOf(child).columns.some((column) => column.type === 'fk' && column.references === parent), `${child} → ${parent}`).toBe(true);
    }
  });

  it('a tab of rows only a ledger or a button writes offers no New, and an empty one says what will be there, in eight languages', () => {
    for (const page of pages) {
      for (const [child, words] of Object.entries(page.config.tabs ?? {})) {
        // The one tab a person adds to by hand: a part of a batch, which is how a batch that stopped is finished.
        expect(words.noNew, `${page.ref}: ${child}`).toBe(child === 'batch_chunks' ? undefined : true);
        for (const text of [words.empty, words.emptyBody]) if (text !== undefined) expect(Object.keys(text), `${page.ref}: ${child}`).toEqual(LOCALES);
      }
    }
    expect(pageOf('offers-gift-cards').config.tabs!['card_ledger']!.empty!['en-US']).toBe('Nothing on this card yet');
    expect(pageOf('offers-vouchers').config.tabs!['redemptions']!.empty!['en-US']).toBe('Not used yet');
    expect(pageOf('offers-voucher-batches').config.tabs!['batch_chunks']!.empty!['en-US']).toBe('Nothing made yet');
  });
});

describe('a code is money', () => {
  it('no generated page names the code of a card or of a voucher, a link token, or a key that stands for an address', () => {
    for (const page of pages) {
      const named = [...fieldsOf(page), ...(page.config.filters ?? []), ...(page.config.defaultFilters ?? [])].map((one) => one.column);
      for (const ref of named) {
        const rules = columnOf(page.bindings.rows, ref)!.rules ?? {};
        expect(rules['code'], `${page.ref}: ${ref} is a code Adminium makes`).toBeUndefined();
        expect(rules['customerKey'], `${page.ref}: ${ref} is a key`).toBeUndefined();
      }
    }
    // What a list shows of a code it never shows.
    expect(fieldsOf(pageOf('offers-vouchers')).map((field) => field.column)).toContain('code_last4');
    expect(fieldsOf(pageOf('offers-gift-cards')).map((field) => field.column)).toContain('label');
    // A discount code is a published word: its own page shows it whole, and it is typed there.
    expect(typed(pageOf('offers-codes'))).toContain('code');
  });

  it('no log shows who used an offer, and the message log shows no code column at all', () => {
    expect((pageOf('offers-uses').config.filters ?? []).map((filter) => filter.column)).not.toContain('customer');
    expect(tableOf('messages').columns.map((column) => column.ref).filter((ref) => ref.includes('code') || ref.includes('token'))).toEqual([]);
  });
});

describe('what a person types on a generated form', () => {
  it('is never a column Adminium decides or the ledger writes', () => {
    for (const page of pages) {
      // What the ledger changes on a row that is there (what it writes on a row it makes is that row's start, as a person's would be).
      const written = new Set(ledger.writes[page.bindings.rows]?.update?.set ?? []);
      for (const ref of typed(page)) {
        const column = columnOf(page.bindings.rows, ref)!;
        expect(DECIDING.filter((rule) => column.rules?.[rule] !== undefined), `${page.ref}: ${ref}`).toEqual([]);
        // What a voucher is for a manager to change, and the one thing the ledger also sets: its last day.
        if (!(page.ref === 'offers-vouchers' && ref === 'expires_on')) expect(written.has(ref), `${page.ref}: ${ref} is the ledger's`).toBe(false);
      }
    }
  });

  it('on a card is who it is for and what it says; on a voucher who holds it; on a message only whether to queue it again', () => {
    expect(typed(pageOf('offers-gift-cards'))).toEqual(['recipient_name', 'recipient_email', 'sender_name', 'language', 'send_on', 'message', 'note']);
    expect(typed(pageOf('offers-vouchers'))).toEqual(['holder_name', 'holder_email', 'language', 'expires_on', 'note']);
    expect(typed(pageOf('offers-voucher-batches'))).toEqual(['name']);
    expect(typed(pageOf('offers-messages'))).toEqual(['status']);
    expect(pageOf('offers-activity').config.form).toBeUndefined();
    expect(pageOf('offers-uses').config.form).toBeUndefined();
  });

  it('the settings form never offers the latch that stops cards while they are brought in', () => {
    const settings = fieldsOf(pageOf('offers-settings')).map((field) => field.column);
    expect(settings).toEqual(['card_expiry_months', 'card_reminder_days', 'card_min', 'card_max', 'pack_expiry_months', 'combine_default', 'tax_later', 'from_name']);
    expect(settings).not.toContain('cards_paused');
  });
});

describe('the buttons on a record', () => {
  const actionsOf = (ref: string): Action[] => tableOf(ref).states!.actions!;
  const said = (action: Action): string =>
    `${action.id}: ${action.label['en-US']}${action.move === undefined ? '' : ` → ${action.move.to}`}${action.child === undefined ? '' : ` + ${action.child.table}`}${action.in === undefined ? '' : ` in ${action.in.join(', ')}`}`;

  it('a card is topped up, adjusted, cancelled and sent again', () => {
    expect(actionsOf('gift_cards').map(said)).toEqual([
      'top-up: Top up + card_actions in active',
      'adjust: Adjust + card_actions in active',
      'cancel-card: Cancel the card → void',
      'send-again: Send again in active',
    ]);
    const [topUp, adjust, cancel, again] = actionsOf('gift_cards');
    // A hand action is a row of its own, with a reason: the button fixes which action, the person types the rest.
    expect(topUp).toMatchObject({ child: { via: 'card_id', form: ['amount', 'paid_by', 'reason'] }, set: { action: 'top_up' } });
    expect(adjust).toMatchObject({ child: { via: 'card_id', form: ['amount', 'reason'] }, set: { action: 'adjust' } });
    // A cancel asks why, and says it cannot be taken back.
    expect(cancel).toMatchObject({ tone: 'danger', ask: ['void_reason'] });
    expect(cancel!.confirm!['en-US']).toBe('What is left on it can no longer be spent. This cannot be undone.');
    // Sending again writes one moment and nothing else: the mail goes to the address already on the card.
    expect(again!.set).toEqual({ resent_at: { now: true } });
  });

  it('a voucher is marked used, given a use back, cancelled and sent again — each use a row of its own', () => {
    expect(actionsOf('vouchers').map(said)).toEqual([
      'use-one: Mark as used + voucher_actions in issued',
      'give-back: Give a use back + voucher_actions in issued, used, expired',
      'cancel-voucher: Cancel the voucher + voucher_actions in issued, used, expired',
      'send-again: Send again in issued',
    ]);
    expect(actionsOf('vouchers').slice(0, 3).map((action) => action.set)).toEqual([{ action: 'use' }, { action: 'give_back' }, { action: 'void' }]);
    // A cancel asks for the note its row needs.
    expect(actionsOf('vouchers')[2]).toMatchObject({ tone: 'danger', child: { form: ['note'] } });
    expect(columnOf('voucher_actions', 'note')!.rules).toMatchObject({ requiredWhen: { column: 'action', in: ['void'] } });
  });

  it('a discount is switched on, paused, resumed, ended and run again', () => {
    expect(actionsOf('offers').map(said)).toEqual(['switch-on: Switch on → active', 'pause: Pause → paused', 'resume: Resume → active', 'end-now: End now → ended', 'run-again: Run again → active']);
    // Running an ended discount again asks for a new last day: the old one is why it ended.
    expect(actionsOf('offers')[4]!.ask).toEqual(['ends_on']);
    expect(actionsOf('offers')[3]!.confirm).toBeDefined();
  });

  it('no button makes a move that is the ledger\'s alone, and every move a button makes is listed', () => {
    for (const ref of ['gift_cards', 'vouchers', 'offers']) {
      const moves = Object.values(tableOf(ref).states!.moves).flat();
      for (const action of actionsOf(ref).filter((one) => one.move !== undefined)) {
        const made = moves.filter((move) => move.to === action.move!.to);
        expect(made.length, `${ref}.${action.id}`).toBeGreaterThan(0);
        expect(made.some((move) => move.planned !== true), `${ref}.${action.id} makes a move only the ledger makes`).toBe(true);
      }
    }
    // No button of a voucher moves it: its status follows its uses.
    expect(actionsOf('vouchers').filter((action) => action.move !== undefined)).toEqual([]);
  });

  it('a button that adds a row fixes a value its column holds, on a table that posts what it adds', () => {
    for (const ref of ['gift_cards', 'vouchers']) {
      for (const action of actionsOf(ref).filter((one) => one.child !== undefined)) {
        const child = tableOf(action.child!.table) as Table & { postings?: unknown[] };
        expect(child.postings?.length, `${ref}.${action.id}`).toBe(1);
        expect(columnOf(child.ref, 'action')!.enum, `${ref}.${action.id}`).toContain(action.set!['action']);
        for (const column of [action.child!.via, ...action.child!.form]) expect(columnOf(child.ref, column), `${ref}.${action.id}: ${column}`).toBeDefined();
      }
    }
  });

  it('says every label and every question in eight languages', () => {
    for (const ref of ['gift_cards', 'vouchers', 'offers']) {
      for (const action of actionsOf(ref)) {
        expect(Object.keys(action.label), `${ref}.${action.id}`).toEqual(LOCALES);
        if (action.confirm !== undefined) expect(Object.keys(action.confirm), `${ref}.${action.id}`).toEqual(LOCALES);
      }
    }
  });
});
