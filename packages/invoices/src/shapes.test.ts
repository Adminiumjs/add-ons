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

import { createHash } from 'node:crypto';

import {
  evaluateFormula,
  rollupValue,
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
const shape = (name: string, version = 1): Shape => SHAPES.find((entry) => entry.name === name && entry.version === version)!;

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

/** An app — a small studio desk — built on both shapes (its invoices on `invoice@<version>`). */
function sampleApp(version = 1): Json {
  const invoice = shape('invoice', version);
  const builtOn = `invoices/invoice@${String(version)}`;
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
          builtOn,
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
        { ref: 'invoice_lines', builtOn, part: 'lines', columns: spelledOut('invoice', invoice.parts['lines']!) },
        {
          ref: 'payments',
          builtOn,
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

  it('declares invoice@1 with three parts and quote@1 with two, and invoice@2 beside them', () => {
    expect(SHAPES.map((entry) => `${entry.name}@${String(entry.version)}`)).toEqual(['invoice@1', 'quote@1', 'invoice@2']);
    expect(Object.keys(shape('invoice', 2).parts)).toEqual(['document', 'lines', 'payments']);
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

/*
 * `invoice@2`: what an online payment needs of a payments row, beside `@1`.
 * An app stays on `@1` until its own update moves it, so `@1` must never move
 * under it; `@2` is `@1` with exactly the additions below and nothing else.
 */
group('invoice@2, for payments taken online', () => {
  const v1 = shape('invoice', 1);
  const v2 = shape('invoice', 2);
  const columnsOf = (entry: Shape, part: string) => entry.parts[part]!.columns;
  const column = (entry: Shape, part: string, ref: string) => columnsOf(entry, part).find((one) => one.ref === ref)!;

  it('leaves invoice@1 exactly as release 1.0.12 shipped it', () => {
    // The digest of `invoice@1` in 1.0.12's manifest. An app built on it is checked against these bytes.
    expect(createHash('sha256').update(JSON.stringify(v1)).digest('hex')).toBe('b4be323aa33789b85d081636945544debd2c3585aadfd8b4f8f7655a3613fc19');
  });

  it('is invoice@1 with the payments part grown, paid counting what was refunded, and a pay button: nothing else', () => {
    expect(v2.documentProfiles).toEqual(v1.documentProfiles);
    expect(v2.parts['lines']).toEqual(v1.parts['lines']);
    expect(v2.outbox!.producers).toEqual(v1.outbox!.producers);
    const strip = (columns: Column[]) => columns.map((one) => (one.ref === 'paid' ? { ...one, rules: undefined } : one));
    expect(strip(columnsOf(v2, 'document'))).toEqual(strip(columnsOf(v1, 'document')));
    expect(v2.parts['document']!.states).toEqual(v1.parts['document']!.states);
    const added = ['refunded_amount', 'net_amount', 'payment_ref', 'provider', 'approval_code', 'card_last4'];
    expect(columnsOf(v2, 'payments').map((one) => one.ref).filter((ref) => !added.includes(ref))).toEqual(columnsOf(v1, 'payments').map((one) => one.ref));
    for (const one of columnsOf(v1, 'payments')) {
      if (one.ref === 'method') continue;
      expect(column(v2, 'payments', one.ref), one.ref).toEqual(one);
    }
  });

  it('keeps the payment reference unique and empty until Adminium records one, so rows from before never collide', () => {
    expect(column(v2, 'payments', 'payment_ref')).toEqual({ ref: 'payment_ref', type: 'text', maxLength: 64, nullable: true, unique: true });
    expect(column(v2, 'payments', 'provider')).toMatchObject({ type: 'text', nullable: true });
    expect(column(v2, 'payments', 'approval_code')).toMatchObject({ type: 'text', maxLength: 12, nullable: true });
    expect(column(v2, 'payments', 'card_last4')).toMatchObject({ type: 'text', maxLength: 4, nullable: true, rules: { validation: { minLength: 4, maxLength: 4 } } });
  });

  it('takes every way to pay Adminium records an online payment as', () => {
    const methods = column(v2, 'payments', 'method')['enum'] as string[];
    expect(methods).toEqual([...(column(v1, 'payments', 'method')['enum'] as string[]), 'online']);
    for (const written of ['card', 'bank-transfer', 'online']) expect(methods).toContain(written);
  });

  it('starts a row with nothing refunded, and counts a row as what is left after its refunds', () => {
    expect(column(v2, 'payments', 'refunded_amount')).toMatchObject({ type: 'decimal', scale: 'currency', default: 0, rules: { validation: { min: 0 } } });
    const net = column(v2, 'payments', 'net_amount').rules!['formula'] as Parameters<typeof evaluateFormula>[0];
    expect(evaluateFormula(net, { amount: '120.00', refunded_amount: '40.00' }, 2)).toBe('80.00');
    expect(evaluateFormula(net, { amount: '120.00', refunded_amount: '0' }, 2)).toBe('120.00');
    // A row whose refunded amount is empty is a row with nothing refunded.
    expect(evaluateFormula(net, { amount: '45.250', refunded_amount: null }, 3)).toBe('45.250');
  });

  it('sums paid over unvoided rows as what each kept, so a refund reopens the balance', () => {
    const rollup = column(v2, 'document', 'paid').rules!['rollup'] as { sum: string; where: Json; balance: Json; cap: boolean };
    expect(rollup).toEqual({ ...(column(v1, 'document', 'paid').rules!['rollup'] as Json), sum: 'net_amount' });
    const rows = [
      { amount: '120.00', refunded_amount: '40.00', net_amount: '80.00', voided: false },
      { amount: '10.00', refunded_amount: '0', net_amount: '10.00', voided: true },
    ].filter((row) => row.voided === false);
    expect(rollupValue(rows, { sum: rollup.sum }, 2)).toBe('80.00');
  });

  it('offers a pay button on the sent email and every reminder, in eight languages, and none on the receipt', () => {
    for (const template of v2.outbox!.templates as unknown as { kind: string; vars: string[]; locales: Record<string, { blocks: { block: string; id?: string; data: Json }[] }> }[]) {
      const pays = template.kind !== 'payment-receipt';
      expect(template.vars.includes('pay_url'), template.kind).toBe(pays);
      for (const [locale, content] of Object.entries(template.locales)) {
        const button = content.blocks.find((block) => block.id === 'pay');
        if (!pays) {
          expect(button, `${template.kind} ${locale}`).toBeUndefined();
          continue;
        }
        expect(button, `${template.kind} ${locale}`).toMatchObject({ block: 'email.button', data: { url: '{{pay_url}}' } });
        expect(String(button!.data['label']), `${template.kind} ${locale}`).toContain('{{number}}');
      }
    }
  });

  it('validates as an app whose invoices are built on it, and passes the conformance check', () => {
    expect(shapeConformanceIssues(sampleApp(2) as never, shapesByKey())).toEqual([]);
    expect(issuesOf(validateManifest(sampleApp(2)))).toEqual([]);
  });

  it('refuses an app on invoice@2 that leaves the payment reference out', () => {
    const app = sampleApp(2);
    const tables = (app['requiredSchema'] as { tables: { ref: string; columns: Column[] }[] }).tables;
    const payments = tables.find((table) => table.ref === 'payments')!;
    payments.columns = payments.columns.filter((one) => one.ref !== 'payment_ref');
    expect(shapeConformanceIssues(app as never, shapesByKey()).map((issue) => issue.message).join('\n')).toContain('payment_ref');
  });
});
