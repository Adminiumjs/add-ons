/**
 * The shapes this add-on defines — `invoices/invoice@1` and `invoices/quote@1`
 * — checked the way Adminium checks them, and checked against an app that
 * builds its tables on them.
 *
 * `@adminiumjs/manifest` is the validator the host suite runs every manifest
 * here through; the shape half of it (`shapeConformanceIssues`, the formula
 * evaluator) exists only from the release that knows `addOn.shapes`, so the
 * first test below also says WHICH validator these tests ran against.
 *
 * The sample app is built FROM the shapes, the way an app's own sync script
 * spells them out: every part's columns and rules under the app's table
 * names, then the app's own columns beside them. If a shape changes in a way
 * an app cannot follow, this is where it shows first.
 */

import { readFileSync } from 'node:fs';

import {
  shapeConformanceIssues,
  shapeKey,
  validateManifest,
} from '@adminiumjs/manifest';
import { describe as group, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };
import { describe as outlineOf } from './kinds.ts';
import { DEFAULT_LADDER_DAYS, TERM_DAYS } from './settings.ts';

type Json = Record<string, unknown>;
type Column = Json & { ref: string; references?: string; rules?: Json };
type Part = { columns: Column[]; states?: Json };
type Shape = {
  name: string;
  version: number;
  parts: Record<string, Part>;
  documentProfiles?: { kind: string; part: string; mapping: Record<string, Json> }[];
  outbox?: { producers: (Json & { kind: string })[]; templates?: (Json & { kind: string })[] };
};

const clone = <T>(value: T): T => structuredClone(value);
const SHAPES = (manifest.addOn as unknown as { shapes: Shape[] }).shapes;
const shape = (name: string): Shape => SHAPES.find((entry) => entry.name === name)!;

function issuesOf(result: ReturnType<typeof validateManifest>): string[] {
  return result.ok ? [] : result.issues.map((issue) => `${issue.path}: ${issue.message}`);
}

/** The app's table for each part, by the name a shape's rule uses (`lines`, `quote@1/document`). */
const TABLE_OF: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  invoice: { document: 'invoices', lines: 'invoice_lines', payments: 'payments', 'quote@1/document': 'quotes' },
  quote: { document: 'quotes', lines: 'quote_lines', 'invoice@1/document': 'invoices' },
};

/** A part's columns under the app's table names — the spelled-out copy an app vendors. */
function spelledOut(shapeName: string, part: Part): Column[] {
  const table = (ref: string) => TABLE_OF[shapeName]![ref] ?? ref;
  return clone(part.columns).map((column) => {
    const out: Column = { ...column };
    if (column.references !== undefined) out.references = table(column.references);
    const rollup = column.rules?.['rollup'] as Json | undefined;
    if (rollup !== undefined) out.rules = { ...column.rules, rollup: { ...rollup, from: table(rollup['from'] as string) } };
    return out;
  });
}

function spelledStates(shapeName: string, states: Json): Json {
  const table = (ref: string) => TABLE_OF[shapeName]![ref] ?? ref;
  const out = clone(states);
  const children = out['children'] as Record<string, Json> | undefined;
  if (children !== undefined) out['children'] = Object.fromEntries(Object.entries(children).map(([ref, rule]) => [table(ref), rule]));
  const moves = out['moves'] as Record<string, (string | Json)[]>;
  for (const list of Object.values(moves)) {
    for (const move of list) {
      if (typeof move === 'string') continue;
      const requires = move['requires'] as Json | undefined;
      const kids = requires?.['children'] as Record<string, number> | undefined;
      if (kids !== undefined) requires!['children'] = Object.fromEntries(Object.entries(kids).map(([ref, n]) => [table(ref), n]));
    }
  }
  return out;
}

const L = ['en-US', 'de-DE', 'fr-FR', 'cs-CZ', 'da-DK', 'zh-CN', 'zh-TW', 'ar-EG'];
const name = (text: string) => Object.fromEntries(L.map((l) => [l, text]));

/** An app — a small studio desk — built on both shapes. */
function sampleApp(): Json {
  const invoice = shape('invoice');
  const quote = shape('quote');
  const id = { ref: 'id', type: 'int', role: 'pk' };
  const producers = invoice.outbox!.producers.map((producer) => {
    const out = clone(producer);
    for (const trigger of ['onChange', 'onCreate'] as const) {
      const source = out[trigger] as Json | undefined;
      if (source !== undefined) source['table'] = TABLE_OF['invoice']![source['table'] as string];
    }
    return out;
  });
  const kinds = invoice.outbox!.producers.map((producer) => producer.kind);
  return {
    kind: 'app',
    manifestVersion: 1,
    key: 'desk',
    name: 'Desk',
    version: '0.1.0',
    publisher: { id: 'adminium', name: 'Adminium' },
    license: 'MIT',
    description: { key: 'desk.description', fallback: 'A small desk' },
    categories: ['crm'],
    compatibility: { minAdminiumVersion: '0.3.1' },
    pages: [{ ref: 'overview', template: 'page-dashboard', title: { key: 'desk.overview', fallback: 'Overview' }, nav: { group: 'desk', icon: 'home', order: 1 } }],
    frontends: [{ side: 'staff', kind: 'spa' }],
    requiredSchema: {
      prefixed: true,
      tables: [
        {
          ref: 'clients',
          columns: [
            id,
            { ref: 'company', type: 'text', maxLength: 160 },
            { ref: 'email', type: 'text', maxLength: 254, unique: true },
            { ref: 'tax_rate', type: 'decimal', scale: 3, nullable: true },
          ],
        },
        {
          ref: 'invoices',
          builtOn: 'invoices/invoice@1',
          part: 'document',
          columns: [
            // The client's own rate first; the add-on's default fills in when it is empty.
            ...spelledOut('invoice', invoice.parts['document']!).map((column) =>
              column.ref === 'tax_rate' ? { ...column, rules: { ...column.rules, copy: { via: 'client_id', from: 'tax_rate' } } } : column,
            ),
            { ref: 'client_id', type: 'fk', references: 'clients' },
            { ref: 'title', type: 'text', maxLength: 160, nullable: true },
            { ref: 'client_paid_at', type: 'timestamptz', nullable: true },
          ],
          states: (() => {
            const states = spelledStates('invoice', invoice.parts['document']!.states!);
            // An app may add to the lock's exceptions and to what a child clears.
            (states['lock'] as Json)['except'] = [...((states['lock'] as Json)['except'] as string[]), 'client_paid_at'];
            ((states['children'] as Json)['payments'] as Json)['clearOnCreate'] = ['client_paid_at'];
            return states;
          })(),
        },
        { ref: 'invoice_lines', builtOn: 'invoices/invoice@1', part: 'lines', columns: spelledOut('invoice', invoice.parts['lines']!) },
        {
          ref: 'payments',
          builtOn: 'invoices/invoice@1',
          part: 'payments',
          columns: [
            ...spelledOut('invoice', invoice.parts['payments']!),
            // A statement lists a client's payments by the client, one hop: the
            // app keeps the invoice's client on each payment, copied, never typed.
            { ref: 'client_id', type: 'fk', references: 'clients', nullable: true, rules: { copy: { via: 'document_id', from: 'client_id', mode: 'always' } } },
          ],
        },
        {
          ref: 'quotes',
          builtOn: 'invoices/quote@1',
          part: 'document',
          columns: [...spelledOut('quote', quote.parts['document']!), { ref: 'client_id', type: 'fk', references: 'clients' }],
          states: spelledStates('quote', quote.parts['document']!.states!),
        },
        { ref: 'quote_lines', builtOn: 'invoices/quote@1', part: 'lines', columns: spelledOut('quote', quote.parts['lines']!) },
        {
          ref: 'messages',
          columns: [
            id,
            { ref: 'kind', type: 'enum', enum: kinds },
            { ref: 'status', type: 'enum', enum: ['held', 'queued', 'sent', 'failed', 'skipped'], default: 'queued' },
            { ref: 'to', type: 'text', maxLength: 254, nullable: true },
            { ref: 'client_id', type: 'fk', references: 'clients', nullable: true },
            { ref: 'invoice_id', type: 'fk', references: 'invoices', nullable: true },
            { ref: 'payment_id', type: 'fk', references: 'payments', nullable: true },
            { ref: 'due', type: 'timestamptz', nullable: true },
            { ref: 'skip_reason', type: 'text', maxLength: 24, nullable: true },
          ],
        },
      ],
    },
    outbox: {
      table: 'messages',
      columns: { kind: 'kind', status: 'status', to: 'to', due: 'due', skipReason: 'skip_reason' },
      links: { invoice: 'invoice_id', payment: 'payment_id', client: 'client_id' },
      recipient: { via: 'client_id', table: 'clients', email: 'email' },
      kinds: Object.fromEntries(kinds.map((kind) => [kind, `desk-${kind}`])),
      producers,
    },
    emailTemplates: invoice.outbox!.templates!.map(({ kind, ...template }) => ({ key: `desk-${kind}`, ...template })),
    addOns: { requires: [{ key: 'invoices', range: '>=1.1.0', reason: name('Invoices are made by this add-on.') }] },
    documents: [
      {
        kind: 'statement',
        addOn: 'invoices',
        table: 'clients',
        name: name('Statement'),
        mapping: { customerName: { column: 'company' }, customerEmail: { column: 'email' } },
        statement: {
          documents: { table: 'invoices', via: 'client_id', date: 'issued_on', amount: 'total', number: 'number', where: { column: 'status', in: ['sent'] } },
          payments: { table: 'payments', via: 'client_id', date: 'paid_on', amount: 'amount', number: 'number', unless: 'voided' },
        },
      },
    ],
  };
}

const shapesByKey = () => new Map(SHAPES.map((entry) => [shapeKey('invoices', entry), entry as never]));

group('the validator these tests run is the one that knows shapes', () => {
  it('is the release with shape conformance, resolved from this repository', () => {
    // An older `@adminiumjs/manifest` has no conformance check and refuses
    // `addOn.shapes` outright ("Unrecognized key"); both would fail here first.
    expect(typeof shapeConformanceIssues).toBe('function');
    expect(shapeKey('invoices', { name: 'invoice', version: 1 })).toBe('invoices/invoice@1');
  });
});

group('the add-on manifest', () => {
  it('validates, shapes and all', () => {
    const result = validateManifest(manifest);
    expect(issuesOf(result)).toEqual([]);
  });

  it('is refused when a shape reads a column it does not have — the shapes really are checked', () => {
    const broken = clone(manifest) as unknown as { addOn: { shapes: Shape[] } };
    const tax = broken.addOn.shapes[0]!.parts['document']!.columns.find((column) => column.ref === 'tax')!;
    tax.rules = { formula: { round: { div: [{ mul: ['subtotal', 'no_such_column'] }, 100] } } };
    expect(issuesOf(validateManifest(broken)).join('\n')).toContain('no_such_column');
  });

  it('is refused when a shape reads a setting the add-on does not declare', () => {
    const broken = clone(manifest) as unknown as { settings: { key: string }[] };
    broken.settings = broken.settings.filter((entry) => entry.key !== 'prefix_invoice');
    expect(issuesOf(validateManifest(broken)).join('\n')).toContain('prefix_invoice');
  });

  it('declares invoice@1 with three parts and quote@1 with two', () => {
    expect(SHAPES.map((entry) => `${entry.name}@${String(entry.version)}`)).toEqual(['invoice@1', 'quote@1']);
    expect(Object.keys(shape('invoice').parts)).toEqual(['document', 'lines', 'payments']);
    expect(Object.keys(shape('quote').parts)).toEqual(['document', 'lines']);
  });

  it('numbers each series by its own prefix and first number', () => {
    for (const [shapeName, part, series] of [
      ['invoice', 'document', 'invoice'],
      ['invoice', 'payments', 'receipt'],
      ['quote', 'document', 'quote'],
    ] as const) {
      const columns = shape(shapeName).parts[part]!.columns;
      const seq = columns.find((column) => column.ref === 'number_seq')!;
      const number = columns.find((column) => column.ref === 'number')!;
      expect(seq.rules).toEqual({ sequence: { gapless: true, startSetting: { addOn: 'invoices', setting: `number_start_${series}` } } });
      expect((number.rules!['format'] as Json)['prefixSetting']).toEqual({ addOn: 'invoices', setting: `prefix_${series}` });
    }
  });

  it('gives the due date the same days per term as the settings do', () => {
    const due = shape('invoice').parts['document']!.columns.find((column) => column.ref === 'due_on')!;
    const addDays = ((due.rules!['stamp'] as Json)['set'] as Json)['addDays'] as Json;
    expect(addDays['map']).toEqual(TERM_DAYS);
  });

  it('ships the three ladders the reminders read', () => {
    const ladders = manifest.settings.find((entry) => entry.key === 'ladders')!;
    expect(ladders.default).toEqual(DEFAULT_LADDER_DAYS);
  });

  it('keeps a void reason on the document and never prints it', () => {
    // The reason is the business's own note. No profile maps it, so it never
    // reaches a subject, let alone a page.
    const mapped = SHAPES.flatMap((entry) => entry.documentProfiles ?? []).flatMap((profile) => JSON.stringify(profile.mapping));
    expect(mapped.join('\n')).not.toContain('void_reason');
  });
});

group('the document profiles speak the renderer’s outline', () => {
  it.each(SHAPES.flatMap((entry) => (entry.documentProfiles ?? []).map((profile) => ({ shape: entry.name, profile }))))(
    '$shape → $profile.kind maps only slots the kind describes',
    ({ profile }) => {
      const outline = outlineOf(profile.kind);
      for (const [slot, source] of Object.entries(profile.mapping)) {
        const described = outline.slots.find((entry) => entry.id === slot);
        expect(described, `${profile.kind} has no slot ${slot}`).toBeDefined();
        const collection = source['collection'] as { columns: Record<string, string> } | undefined;
        if (collection !== undefined) {
          expect(described!.type).toBe('collection');
          for (const column of Object.keys(collection.columns)) {
            expect(described!.columns?.map((entry) => entry.id), `${profile.kind}.${slot} has no column ${column}`).toContain(column);
          }
        }
      }
    },
  );
});

group('an app built on the shapes', () => {
  it('passes the conformance check against the shapes', () => {
    expect(shapeConformanceIssues(sampleApp() as never, shapesByKey())).toEqual([]);
  });

  it('validates as an app, its statement profile included', () => {
    expect(issuesOf(validateManifest(sampleApp()))).toEqual([]);
  });

  it('is refused when it retypes a column the shape declares', () => {
    const app = sampleApp();
    const tables = (app['requiredSchema'] as { tables: { ref: string; columns: Column[] }[] }).tables;
    const total = tables.find((table) => table.ref === 'invoices')!.columns.find((column) => column.ref === 'total')!;
    total['scale'] = 2;
    const issues = shapeConformanceIssues(app as never, shapesByKey());
    expect(issues.map((issue) => issue.code)).toContain('SHAPE_MISMATCH');
    expect(issues.map((issue) => issue.message).join('\n')).toContain('total');
  });

  it('is refused when it drops one of the shape’s reminders', () => {
    const app = sampleApp();
    const outbox = app['outbox'] as { producers: { kind: string }[] };
    outbox.producers = outbox.producers.filter((producer) => producer.kind !== 'invoice-rung-3');
    expect(shapeConformanceIssues(app as never, shapesByKey()).map((issue) => issue.message).join('\n')).toContain('invoice-rung-3');
  });
});

group('the reminders and their templates', () => {
  const invoice = shape('invoice');
  const templates = invoice.outbox!.templates as unknown as {
    kind: string;
    vars: string[];
    attach?: { kind: string; link: string };
    locales: Record<string, { subject: string; preheader?: string; blocks: { data: Json }[]; footer?: string }>;
  }[];

  it('sends on a send, holds three rungs, and thanks for a payment', () => {
    expect(invoice.outbox!.producers.map((producer) => producer.kind)).toEqual([
      'invoice-sent',
      'invoice-rung-1',
      'invoice-rung-2',
      'invoice-rung-3',
      'payment-receipt',
    ]);
    const rungs = invoice.outbox!.producers.filter((producer) => producer.kind.startsWith('invoice-rung-'));
    rungs.forEach((rung, index) => {
      expect(rung['hold']).toBe(true);
      expect(rung['supersede']).toBe('rungs');
      expect(rung['due']).toEqual({ date: 'due_on', days: { setting: { addOn: 'invoices', setting: 'ladders' }, byColumn: 'ladder', index }, at: '09:00' });
      expect(rung['dropWhen']).toEqual([
        { column: 'balance', lte: 0, reason: 'paid' },
        { column: 'status', eq: 'void', reason: 'void' },
      ]);
    });
  });

  it('has one template per kind, in all eight languages', () => {
    expect(templates.map((template) => template.kind)).toEqual(invoice.outbox!.producers.map((producer) => producer.kind));
    for (const template of templates) expect(Object.keys(template.locales).sort(), template.kind).toEqual([...L].sort());
  });

  it('reads only the variables the shape gives, and lists every one it reads', () => {
    const allowed = new Set(['signInLink', 'number', 'balance', 'total', 'due_on', 'days_late', 'contact_first_name', 'letterhead_name', 'amount', 'invoice_number']);
    for (const template of templates) {
      const used = new Set<string>();
      for (const content of Object.values(template.locales)) {
        for (const match of JSON.stringify(content).matchAll(/\{\{([a-zA-Z_]+)\}\}/g)) used.add(match[1]!);
      }
      for (const variable of used) expect(allowed.has(variable), `${template.kind} reads {{${variable}}}`).toBe(true);
      // `signInLink` is filled by the sender and cannot be listed (a list entry is snake_case).
      expect([...used].filter((variable) => variable !== 'signInLink').sort(), template.kind).toEqual([...template.vars].sort());
    }
  });

  it('names no project: the last reminder is the add-on’s generic one', () => {
    const rung3 = templates.find((template) => template.kind === 'invoice-rung-3')!;
    expect(JSON.stringify(rung3)).not.toMatch(/project/i);
  });

  it('carries the invoice with the invoice email and the receipt with the thanks', () => {
    expect(templates.find((template) => template.kind === 'invoice-sent')!.attach).toEqual({ kind: 'invoice', link: 'invoice' });
    expect(templates.find((template) => template.kind === 'payment-receipt')!.attach).toEqual({ kind: 'receipt', link: 'payment' });
  });

  it('keeps every translation’s variables the same as the English', () => {
    for (const template of templates) {
      const vars = (content: unknown) => [...JSON.stringify(content).matchAll(/\{\{([a-zA-Z_]+)\}\}/g)].map((match) => match[1]).sort();
      const english = [...new Set(vars(template.locales['en-US']))];
      for (const locale of L) expect([...new Set(vars(template.locales[locale]))], `${template.kind} ${locale}`).toEqual(english);
    }
  });
});

group('the shapes file an app vendors', () => {
  it('is the manifest itself — one copy, nothing to drift', () => {
    const raw = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8')) as { addOn: { shapes: unknown } };
    expect(raw.addOn.shapes).toEqual(SHAPES);
  });
});
