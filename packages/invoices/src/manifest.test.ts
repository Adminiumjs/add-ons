/**
 * The manifest says what this add-on is; this asserts that what it says is
 * what the code does.
 *
 * The rules 24 §5.3 names are checked against `@adminiumjs/manifest` itself in
 * `packages/host/src/manifest-schema.test.ts`, so nothing here restates a
 * schema. What IS here is the set of agreements a schema cannot see: that the
 * declared slots are the slots `register()` fills, that the entry points are
 * files the build writes, and that the three empty facts in `add-on-facts.ts`
 * are empty because the manifest says they should be.
 */

import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };
import { COMPANY_MARKS, INERT_ORIGINS, NEVER_IN_A_BROWSER } from './add-on-facts.ts';
import { register } from './index.ts';
import { kinds } from './kinds.ts';
import { DEFAULT_SETTING_VALUES } from './settings.ts';
import { OUTPUT } from '../vite.config.ts';

describe('the manifest', () => {
  it('is an add-on, not an app', () => {
    expect(manifest.kind).toBe('add-on');
    expect(manifest.manifestVersion).toBe(1);
    // An add-on cannot install pages, roles or a frontend — those are app
    // powers, and the schema enforces it by leaving the fields off entirely.
    expect(manifest).not.toHaveProperty('pages');
    expect(manifest).not.toHaveProperty('frontend');
    expect(manifest).not.toHaveProperty('roles');
  });

  it('attaches to every deployment rather than to a named app', () => {
    /*
     * `{ app: '*' }`, and this is the first add-on in the repository to use it.
     * The others attach to a host app by key because they extend one — a print
     * shop's dispatch, a maker's catalogue. This one serves any deployment
     * that has rows, including a stock Adminium with no host app at all, which
     * is what `dashboard` was reserved as a host key for (34 O10/D23).
     */
    expect(manifest.addOn.attaches).toEqual([{ app: '*' }]);
  });

  it('provides document-render@1 from its server half, and consumes nothing', () => {
    expect(manifest.addOn.provides).toEqual([
      { contract: 'document-render', version: 1, server: 'dist/server.js' },
    ]);
    expect(manifest.addOn.consumes).toEqual([]);
  });

  it('buys no slot the registry does not already carry', () => {
    // 24 §5.4: the slot registry is closed, and this plan bought none (34 §4).
    expect(manifest.addOn.slots.map((slot) => slot.slot).sort()).toEqual([
      'record.actions',
      'settings.add-on.panel',
    ]);
  });

  it('declares exactly the slots register() fills, at the same orders', () => {
    const declared = manifest.addOn.slots.map((slot) => `${slot.slot}@${String(slot.order)}`).sort();
    const filled = register()
      .fills.map((fill) => `${fill.slot}@${String(fill.order)}`)
      .sort();
    expect(filled).toEqual(declared);
  });

  it('needs nothing to connect to, so it ships no demo transport (D11)', () => {
    // `demoTransport` exists so an add-on that WOULD make a third-party call
    // in a demo can make a stand-in one instead. Nothing here calls anything,
    // so a demo transport would be a module standing in for nothing.
    expect(manifest.addOn.connect).toEqual({ kind: 'none' });
    expect(manifest.addOn).not.toHaveProperty('demoTransport');
    expect(register().connect).toBe('none');
  });

  it('marks no setting secret, so there is nothing to keep out of a browser (D15)', () => {
    const secrets = manifest.settings.filter(
      (setting) => (setting as { secret?: boolean }).secret === true,
    );
    expect(secrets).toEqual([]);
    // Which is what makes this list's emptiness a claim rather than an
    // omission — the two cannot drift apart without one of them going red.
    expect(NEVER_IN_A_BROWSER).toEqual([]);
  });

  it('makes public only the five settings an app’s staff screens are given', () => {
    // The name, the tax name, how to pay, the footer and whether to list the
    // payments — what an app built on the shapes shows its own staff. None is
    // a secret (above), and the payment instructions still never reach a
    // public page: a client reads them through a signed-in read, never the
    // open customer config.
    expect([...manifest.addOn.publicSettings].sort()).toEqual(
      ['business_name', 'footer', 'payment_instructions', 'show_payment_ledger', 'tax_name'].sort(),
    );
    const declared = manifest.settings.map((setting) => setting.key);
    for (const key of manifest.addOn.publicSettings) expect(declared).toContain(key);
  });

  it('ships defaults for exactly the settings it declares', () => {
    expect(Object.keys(DEFAULT_SETTING_VALUES).sort()).toEqual(
      manifest.settings.map((setting) => setting.key).sort(),
    );
    expect(Object.keys(register().defaultSettings ?? {}).sort()).toEqual(
      manifest.settings.map((setting) => setting.key).sort(),
    );
  });

  it('has a DEFAULT tax rate, copied at create, and no rate a document is drawn with', () => {
    /*
     * A rate held as a workspace setting and READ AT RENDER would change every
     * already-issued document the day somebody edited it. So the setting is
     * `default_tax_rate`: the invoice shape copies it onto a document when the
     * document is created (after the client's own rate, when the app keeps
     * one), the document keeps its own `tax_rate` from then on, and the
     * renderer prints the document's. There is still no `tax_rate` setting.
     */
    const keys = manifest.settings.map((setting) => setting.key);
    expect(keys).not.toContain('tax_rate');
    expect(keys).toContain('default_tax_rate');
    expect(keys).toContain('tax_label');
  });

  it('bills a stage of a quote before tax, so the invoice taxes it once', () => {
    /*
     * A stage line's rate is copied from its quote. The quote's TOTAL already
     * carries the quote's tax, and the invoice taxes its own subtotal again:
     * copying the total would tax the stage twice. The line takes the quote's
     * subtotal, and the invoice adds the tax at its own rate.
     */
    const shape = (manifest.addOn as unknown as { shapes: { name: string; parts: Record<string, { columns: { ref: string; rules?: Record<string, unknown> }[] }> }[] }).shapes.find((s) => s.name === 'invoice')!;
    const rate = shape.parts['lines']!.columns.find((column) => column.ref === 'rate')!;
    expect(rate.rules?.['copy']).toEqual({ via: 'quote_id', from: 'subtotal', mode: 'always' });
  });

  it('keeps every key an install may have saved, and drops only the one nothing read', () => {
    const keys = manifest.settings.map((setting) => setting.key);
    for (const kept of ['business_name', 'business_lines', 'logo_data_url', 'terms', 'tax_label', 'paper', 'default_formats', 'entities']) {
      expect(keys).toContain(kept);
    }
    // Numbering is per series now; the one prefix nothing ever numbered by is gone.
    expect(keys).not.toContain('number_prefix');
    for (const series of ['invoice', 'receipt', 'quote']) {
      expect(keys).toContain(`prefix_${series}`);
      expect(keys).toContain(`number_start_${series}`);
    }
  });

  it('gives every setting a label AND the sentence under it', () => {
    // `help` is the field that rides 34-T07's release with the contract
    // (§4.2). Every variant of the settings schema is `.strict()`, so a
    // manifest carrying `help` before that release is REFUSED rather than
    // ignored — which is why this assertion is here rather than assumed.
    for (const setting of manifest.settings) {
      expect(setting.label, setting.key).toBeDefined();
      expect((setting as { help?: unknown }).help, setting.key).toBeDefined();
    }
  });

  it('names no address, and declares that it names none', () => {
    expect(manifest.addOn).not.toHaveProperty('network');
    expect(manifest).not.toHaveProperty('capabilities');
    expect(INERT_ORIGINS).toEqual([]);
  });

  it('brings no schema of its own — its shapes are built in the apps\' tables', () => {
    // It renders from the deployment's tables and stores nothing. The shapes
    // (`addOn.shapes`) describe tables an APP creates under its own names.
    expect(manifest).not.toHaveProperty('requiredSchema');
  });

  it('names no company, in the manifest and in the facts alike', () => {
    expect(COMPANY_MARKS).toEqual([]);
    expect(register().namesCompany).toBe(false);
    expect(JSON.stringify(manifest)).not.toMatch(/Helvetica|Adobe/);
  });
});

describe('the manifest’s entry points are the files the build writes', () => {
  it('points the slots at the client bundle and the contract at the server one', () => {
    /*
     * Two halves, and each is reached from exactly one direction. The client
     * is what a browser loads for the two fills; the server is what Adminium
     * imports in the `document.render` job, which never runs in a page.
     */
    expect(Object.keys(OUTPUT).sort()).toEqual(['client', 'server']);

    const slotEntries = manifest.addOn.slots.map((slot) => slot.client);
    expect(new Set(slotEntries)).toEqual(new Set([OUTPUT.client]));

    expect(manifest.addOn.provides.map((entry) => entry.server)).toEqual([OUTPUT.server]);
    expect(manifest.addOn.provides.map((entry) => entry.server)).not.toContain(OUTPUT.client);
  });
});

describe('the manifest and the provider agree about what it draws', () => {
  it('declares one contract and the provider lists five kinds under it', () => {
    // The count that catches a provider quietly losing a kind: five is what
    // `kinds.ts` documents as the number of distinct MAPPING shapes — money
    // owed, money received, money returned, money offered, and one client's
    // account over a period — not the twelve starters, which are template
    // presets.
    expect(kinds().map((kind) => kind.id)).toEqual(['invoice', 'receipt', 'credit-note', 'quote', 'statement']);
  });

  it('draws every kind in both formats, unlike the other implementer', () => {
    // The disagreement 25 D4 was asking for. `barcode-labels` declares
    // `['pdf']` and `coverage: 'ascii'`; this one declares both formats and
    // `winansi`. Two implementations that agreed about everything would have
    // proved nothing about the contract.
    for (const kind of kinds()) {
      expect([...kind.formats].sort(), kind.id).toEqual(['html', 'pdf']);
      expect(kind.coverage, kind.id).toBe('winansi');
    }
  });

  it('gives the receipt a till roll and the others a sheet', () => {
    const paper = Object.fromEntries(kinds().map((kind) => [kind.id, kind.paper[0]]));
    expect(paper.receipt).toBe('receipt-80mm');
    expect(paper.invoice).toBe('a4');
    expect(paper['credit-note']).toBe('a4');
    expect(paper.quote).toBe('a4');
    expect(paper.statement).toBe('a4');
  });
});
