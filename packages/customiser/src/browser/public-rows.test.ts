/**
 * THE CUSTOMER'S CHECK ON THE ROWS A SHOP'S VISITOR IS SERVED.
 *
 * The editor checks a design with the rows the add-on's public entries hand a
 * visitor (manifest.json: each app's own rows, only the columns each entry
 * selects); the server checks the same design with the full rows. Whatever
 * the rules compare (a base's app, a ready-made design's app) must be among
 * those columns, or the editor refuses a design the server would take. Here
 * both are asked about a ready-made design and a blank one, in each app, and
 * about a words layer in a font the shop switched off since (served to no
 * visitor, still the app's own on the server).
 */
import { describe, expect, it } from 'vitest';

import { check } from '../question/answer.ts';
import { checkDesign, readValues } from '../rules/index.ts';
import { SAMPLE_APPS } from '../sample/bundle.ts';
import { browserFacts, checkInput, checkLine } from '../testing/samples.ts';
import type { CatalogueRows, DesignData, Row } from './api.ts';
import { answerFor, offeredFonts, readCatalogue } from './catalogue.ts';
import { fontsFor } from './ui/FullEditor.tsx';
import { stubApi, type StubOptions } from './testing/stub.ts';

/** The editor's answer, from the rows the public entries serve, and the server's, from the full rows. */
async function bothAnswers(app: 'maker' | 'printing', design: Row, options: StubOptions = {}, change: (rows: CatalogueRows) => CatalogueRows = (rows) => rows) {
  const stub = stubApi(app, options);
  const read = readValues(design['values']);
  if (!read.ok) throw new Error('the sample design does not read');
  const data: DesignData = { base_id: design['base_id'] as number, ready_design_id: (design['ready_design_id'] ?? null) as number | null, values: read.values };
  const rows = change(await stub.api.catalogue(data.base_id));
  const catalogue = readCatalogue(rows, data.base_id);
  if (catalogue === null) throw new Error('the base is not served');
  const browser = answerFor(catalogue, data, []);
  const server = checkDesign(browserFacts({ format: 1, app, ...data }, stub.tables));
  return { browser, server, rows };
}

const readyMade = (app: string): Row => stubApi('maker').tables['designs']!.find((one) => one['app'] === app && one['ready_design_id'] !== null)!;

const reasons = (answer: { refusals: readonly { reason: string }[] }) => answer.refusals.map((one) => one.reason);

describe.each(SAMPLE_APPS)('the %s shop’s editor, on the rows its visitors are served', (app) => {
  it('takes a ready-made design as the server does', async () => {
    const tables = stubApi(app).tables;
    const design = tables['designs']!.find((one) => one['app'] === app && one['ready_design_id'] !== null)!;
    const { browser, server } = await bothAnswers(app, design);
    expect(reasons(browser)).not.toContain('design-unknown');
    expect(reasons(browser)).toEqual(reasons(server));
    expect(browser.used).toEqual(server.used);
  });

  it('takes a blank design on each published base as the server does', async () => {
    const tables = stubApi(app).tables;
    const bases = tables['bases']!.filter((one) => one['app'] === app && one['state'] === 'published');
    expect(bases.length).toBeGreaterThan(0);
    for (const base of bases) {
      const { browser, server } = await bothAnswers(app, { base_id: base['id'], ready_design_id: null, values: { parts: {} } });
      expect(reasons(browser), String(base['name'])).not.toContain('design-unknown');
      expect(reasons(browser), String(base['name'])).toEqual(reasons(server));
    }
  });
});

/*
 * Adminium never widens a public entry a shop already uses when the add-on is
 * updated, so what a shop's visitor is served depends on the version that
 * first opened each entry: a ready-made design's `app` is served only where
 * 1.0.26 or later opened it, a base's only where 1.0.24 or later did.
 */
const HISTORIES: [string, StubOptions['notServed']][] = [
  ['both the bases and the ready-made designs serve their app', {}],
  ['only the bases serve their app', { ready_designs: ['app'] }],
  ['neither serves its app', { bases: ['app'], ready_designs: ['app'] }],
];

describe.each(SAMPLE_APPS)('the %s shop’s editor, whatever columns its public entries were opened with', (app) => {
  it.each(HISTORIES)('takes a ready-made design where %s', async (_, notServed) => {
    const { browser, server, rows } = await bothAnswers(app, readyMade(app), { notServed });
    // The projection holds: a column the entry was not opened with is not there.
    expect(rows.ready.length).toBeGreaterThan(0);
    expect(rows.ready.every((one) => 'app' in one)).toBe(!notServed?.['ready_designs']);
    expect(rows.bases.every((one) => 'app' in one)).toBe(!notServed?.['bases']);
    expect(reasons(browser)).not.toContain('design-unknown');
    expect(reasons(browser)).toEqual(reasons(server));
    expect(browser.used).toEqual(server.used);
  });

  it('still refuses a ready-made design both rows say is another app’s', async () => {
    const other = app === 'maker' ? 'printing' : 'maker';
    const { browser } = await bothAnswers(app, readyMade(app), {}, (rows) => ({ ...rows, ready: rows.ready.map((one) => ({ ...one, app: other })) }));
    expect(reasons(browser)).toEqual(['design-unknown']);
  });

  it('is checked in full when the order is placed: the server refuses a ready-made design of another app, or of none', () => {
    const other = app === 'maker' ? 'printing' : 'maker';
    const design = readyMade(app);
    for (const stored of [other, null]) {
      const tables = stubApi(app).tables;
      tables['ready_designs'] = tables['ready_designs']!.map((one) => (one['id'] === design['ready_design_id'] ? { ...one, app: stored } : one));
      const [line] = check(checkInput([checkLine('one', design, tables)])).lines;
      expect(line!.refusals.map((one) => one.reason), String(stored)).toEqual(['design-unknown']);
    }
  });
});

describe('a words layer in a font the shop switched off since', () => {
  const words = (font: string) => ({ id: 'name', side: 'front', kind: 'text', x: 6, y: 8, w: 40, h: 4, name: 'Name', text: 'Nell Fairweather', font, size: 9, weight: 700, align: 'start', colour: 'ink' });
  // The print shop's own upload, switched off; the maker's, still on; a starter font.
  const fonts: Row[] = [
    { id: 2, app: null, family: 'Manrope', name: 'Manrope', starter: true, active: true, file: null },
    { id: 30, app: 'printing', family: 'Marlow Hand', name: 'Marlow Hand', starter: false, active: false, file: null },
    { id: 31, app: 'maker', family: 'Maker Hand', name: 'Maker Hand', starter: false, active: true, file: null },
  ];

  async function asked(font: string) {
    const stub = stubApi('printing', { fonts });
    const base = stub.ids.cards;
    const data: DesignData = { base_id: base, ready_design_id: null, values: { parts: {}, placed: [words(font)] } as DesignData['values'] };
    const catalogue = readCatalogue(await stub.api.catalogue(base), base)!;
    const browser = answerFor(catalogue, data, []);
    // The server reads the app's fonts whatever their state.
    const server = checkDesign(browserFacts({ format: 1, app: 'printing', ...data }, stub.tables, [], { fonts: fonts.filter((one) => one['app'] === 'printing') }));
    return { browser: reasons(browser), server: reasons(server), catalogue, data };
  }

  it('is kept: neither the editor nor the server refuses it, and the full editor lists it for that layer', async () => {
    const { browser, server, catalogue, data } = await asked('Marlow Hand');
    expect(server).toEqual([]);
    expect(browser).toEqual(server);
    const offered = offeredFonts(catalogue).map((one) => ({ family: one.family, name: one.name }));
    expect(fontsFor(data.values.placed![0]!, offered, catalogue).map((one) => one.family)).toContain('Marlow Hand');
  });

  it('is never offered to a new layer', async () => {
    const { catalogue } = await asked('Manrope');
    expect(offeredFonts(catalogue).map((one) => one.family)).toEqual(['Manrope']);
  });

  it('another app’s font is refused by both', async () => {
    const { browser, server } = await asked('Maker Hand');
    expect(server).toEqual(['font-not-allowed']);
    expect(browser).toEqual(server);
  });
});
