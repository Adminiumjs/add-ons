/**
 * THE ORDER A SUPPLIER IS SENT.
 *
 * A purchase order goes to its supplier by email when a person (or a rule the
 * owner switched on) sends it, and again when they press "Send again". What
 * the message says is the order's own columns as they were when it was made:
 * a later change at the supplier or in the settings rewrites no sent order.
 * A supplier is shown prices only when the order says so, and never by a
 * template that could read one.
 */

import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };

interface Producer {
  kind: string;
  link: string;
  recipient: Record<string, string>;
  repeat?: boolean;
  holdSeconds?: number;
  dropWhen?: { column: string; eq: string; reason: string }[];
  onChange: { table: string; column?: string; to?: string; columns?: string[]; changed?: boolean; where: { column: string; eq: boolean } };
}
interface Block {
  block: string;
  data: Record<string, unknown> & { from?: { link: string; table: string; via: string; limit: number }; row?: Record<string, string> };
}
interface Template {
  key: string;
  vars: string[];
  attach: { kind: string; link: string; optional: boolean };
  locales: Record<string, { subject: string; blocks: Block[]; footer: string }>;
}
interface Doc {
  kind: string;
  addOn: string;
  table: string;
  where: { column: string; in: boolean[] };
  mapping: Record<string, { column?: string; collection?: { table: string; via: string; columns: Record<string, string> } }>;
}

const m = manifest as unknown as {
  outbox: { table: string; columns: Record<string, string>; links: Record<string, string>; recipient: Record<string, string>; settings: Record<string, string>; kinds: Record<string, string>; producers: Producer[] };
  emailTemplates: Template[];
  documents: Doc[];
  addOns: { suggests: { key: string; range: string; checked: boolean }[] };
};
const tables = manifest.requiredSchema.tables as unknown as { ref: string; columns: { ref: string; type: string; enum?: string[]; references?: string }[] }[];
const columnsOf = (ref: string) => tables.find((table) => table.ref === ref)?.columns ?? [];
const has = (table: string, column: string) => columnsOf(table).some((one) => one.ref === column);
const producer = (kind: string): Producer => {
  const found = m.outbox.producers.find((one) => one.kind === kind);
  if (found === undefined) throw new Error(`no producer "${kind}"`);
  return found;
};
const template = (key: string): Template => {
  const found = m.emailTemplates.find((one) => one.key === key);
  if (found === undefined) throw new Error(`no template "${key}"`);
  return found;
};
/** Every `{{name}}` a template reads in one language. */
const reads = (one: Template, locale = 'en-US'): string[] => [...JSON.stringify(one.locales[locale]).matchAll(/\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g)].map((match) => match[1] ?? '');

describe('the outbox', () => {
  it('logs every message in `messages`, whose kinds are exactly the ones it sends', () => {
    expect(m.outbox.table).toBe('messages');
    for (const column of Object.values(m.outbox.columns)) expect(has('messages', column), column).toBe(true);
    expect(columnsOf('messages').find((one) => one.ref === 'kind')?.enum).toEqual(Object.keys(m.outbox.kinds));
    expect(m.outbox.producers.map((one) => one.kind)).toEqual(Object.keys(m.outbox.kinds));
    for (const key of Object.values(m.outbox.kinds)) expect(m.emailTemplates.map((one) => one.key), key).toContain(key);
  });

  it('writes to the address ON THE ORDER, in the order\'s language, never to the supplier as it reads today', () => {
    for (const one of m.outbox.producers) {
      expect(one.recipient, one.kind).toEqual({ column: 'supplier_email', name: 'supplier_name', language: 'language' });
      for (const column of Object.values(one.recipient)) expect(has('purchase_orders', column), column).toBe(true);
      expect(one.link).toBe('po_id');
    }
  });

  it('sends when an order becomes sent, and skips one that was only marked sent', () => {
    for (const [kind, priced] of [['po-sent', false], ['po-sent-priced', true]] as const) {
      const one = producer(kind);
      expect(one.onChange).toEqual({ table: 'purchase_orders', column: 'status', to: 'sent', where: { column: 'show_prices', eq: priced } });
      // It waits a moment so that "Mark as sent, no email" is dropped before it goes.
      expect(one.dropWhen).toEqual([{ column: 'sent_how', eq: 'none', reason: 'no-longer-needed' }]);
      expect(one.holdSeconds).toBeGreaterThan(0);
      expect(one.repeat).toBeUndefined();
    }
  });

  it('sends once more each time "Send again" is pressed', () => {
    for (const [kind, priced] of [['po-again', false], ['po-again-priced', true]] as const) {
      const one = producer(kind);
      expect(one.onChange).toEqual({ table: 'purchase_orders', columns: ['resent_at'], changed: true, where: { column: 'show_prices', eq: priced } });
      expect(one.repeat).toBe(true);
    }
  });

  it('shows prices only through the kinds an order that shows prices makes', () => {
    for (const one of m.outbox.producers) expect(m.outbox.kinds[one.kind], one.kind).toBe(one.onChange.where.eq ? 'inventory-po-priced' : 'inventory-po');
  });
});

describe('the two emails', () => {
  it('each list the order\'s lines, at most fifty, and read only columns that are there', () => {
    for (const one of m.emailTemplates) {
      const rows = one.locales['en-US']?.blocks.find((block) => block.block === 'email.rows');
      expect(rows?.data.from, one.key).toEqual({ link: 'purchase_order', table: 'po_lines', via: 'po_id', orderBy: 'id', limit: 50 });
      for (const name of reads(one)) {
        const [scope, column] = name.split('.') as [string, string];
        if (scope === 'purchase_order') expect(has('purchase_orders', column), `${one.key} · ${name}`).toBe(true);
        else if (scope === 'row') expect(has('po_lines', column), `${one.key} · ${name}`).toBe(true);
        else if (scope === 'practice') expect(has('settings', column), `${one.key} · ${name}`).toBe(true);
        else throw new Error(`${one.key} reads ${name}`);
      }
    }
  });

  it('carry no price where the order shows none: not a total, not a line\'s amount, not a price', () => {
    const plain = reads(template('inventory-po'));
    for (const name of plain) expect(/total|amount|price|cost/.test(name), name).toBe(false);
    expect(template('inventory-po').locales['en-US']?.blocks.some((block) => block.block === 'email.box')).toBe(false);
    const priced = reads(template('inventory-po-priced'));
    expect(priced).toContain('purchase_order.total.money');
    expect(priced).toContain('row.amount.money');
  });

  it('carry the order as a PDF when the add-on that draws it is there, and go without it when it is not', () => {
    expect(template('inventory-po').attach).toEqual({ kind: 'purchase-order-unpriced', link: 'purchase_order', optional: true });
    expect(template('inventory-po-priced').attach).toEqual({ kind: 'purchase-order', link: 'purchase_order', optional: true });
    for (const one of m.emailTemplates) {
      // The sentence about the attachment is dropped with it.
      const said = one.locales['en-US']?.blocks.filter((block) => block.data['withAttachment'] === true) ?? [];
      expect(said, one.key).toHaveLength(1);
      expect(m.documents.map((doc) => doc.kind), one.key).toContain(one.attach.kind);
    }
  });

  it('leave out a line whose value the order does not have', () => {
    for (const one of m.emailTemplates) {
      const conditional = (one.locales['en-US']?.blocks ?? []).filter((block) => block.data['onlyWith'] !== undefined).map((block) => block.data['onlyWith']);
      expect(conditional, one.key).toEqual(['purchase_order.deliver_to', 'purchase_order.expected_on']);
    }
  });
});

describe('the two documents', () => {
  it('are a purchase order with prices and one without, each for the orders that ask for it', () => {
    expect(m.documents.map((doc) => [doc.kind, doc.addOn, doc.table, doc.where.in])).toEqual([
      ['purchase-order', 'invoices', 'purchase_orders', [true]],
      ['purchase-order-unpriced', 'invoices', 'purchase_orders', [false]],
    ]);
    for (const doc of m.documents) expect(doc.where.column).toBe('show_prices');
  });

  it('map only columns the order and its lines have', () => {
    for (const doc of m.documents) {
      for (const [slot, from] of Object.entries(doc.mapping)) {
        if (from.column !== undefined) expect(has('purchase_orders', from.column), `${doc.kind} · ${slot}`).toBe(true);
        if (from.collection !== undefined) {
          expect(from.collection).toMatchObject({ table: 'po_lines', via: 'po_id' });
          for (const column of Object.values(from.collection.columns)) expect(has('po_lines', column), `${doc.kind} · ${slot} · ${column}`).toBe(true);
        }
      }
    }
  });

  it('hand the one without prices no price at all', () => {
    const plain = m.documents.find((doc) => doc.kind === 'purchase-order-unpriced');
    expect(Object.keys(plain?.mapping ?? {})).not.toContain('total');
    expect(Object.keys(plain?.mapping['items']?.collection?.columns ?? {})).toEqual(['desc', 'code', 'packs', 'pack', 'units', 'unit']);
    const priced = m.documents.find((doc) => doc.kind === 'purchase-order');
    expect(Object.keys(priced?.mapping['items']?.collection?.columns ?? {})).toEqual(['desc', 'code', 'packs', 'pack', 'units', 'unit', 'rate', 'amount']);
    expect(priced?.mapping['total']).toEqual({ column: 'total' });
  });

  it('are drawn by an add-on this one suggests and does not need', () => {
    expect(m.addOns.suggests.map((one) => [one.key, one.range, one.checked])).toEqual([
      ['invoices', '>=1.0.8', true],
      ['barcode-labels', '>=1.0.7', false],
    ]);
    expect((manifest as { addOns: Record<string, unknown> }).addOns['requires']).toBeUndefined();
  });
});
