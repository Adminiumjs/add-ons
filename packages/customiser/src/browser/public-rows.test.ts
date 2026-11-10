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

import { checkDesign, readValues } from '../rules/index.ts';
import { SAMPLE_APPS } from '../sample/bundle.ts';
import { browserFacts } from '../testing/samples.ts';
import type { DesignData, Row } from './api.ts';
import { answerFor, offeredFonts, readCatalogue } from './catalogue.ts';
import { fontsFor } from './ui/FullEditor.tsx';
import { stubApi } from './testing/stub.ts';

/** The editor's answer, from the rows the public entries serve, and the server's, from the full rows. */
async function bothAnswers(app: 'maker' | 'printing', design: Row) {
  const stub = stubApi(app);
  const read = readValues(design['values']);
  if (!read.ok) throw new Error('the sample design does not read');
  const data: DesignData = { base_id: design['base_id'] as number, ready_design_id: (design['ready_design_id'] ?? null) as number | null, values: read.values };
  const catalogue = readCatalogue(await stub.api.catalogue(data.base_id), data.base_id);
  if (catalogue === null) throw new Error('the base is not served');
  const browser = answerFor(catalogue, data, []);
  const server = checkDesign(browserFacts({ format: 1, app, ...data }, stub.tables));
  return { browser, server };
}

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
