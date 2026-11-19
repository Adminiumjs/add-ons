/**
 * EVERY SOURCE PASSES THE CONTRACT'S OWN SUITE (`leadSourceConformance`, from
 * the contracts package's `testing/lead-source`): each question it gives is
 * answered in shapes the engine's schemas accept, a refused key is
 * `KEY_REFUSED`, a stopped call ends, no key comes back in an answer, and
 * nothing is reached but through the client handed over, at the source's own
 * hosts. The services are handwritten; nothing real is called.
 */
import { leadSourceConformance, type LeadSourceFixtures } from '@adminium/add-on-contracts/testing/lead-source';
import { describe, expect, it } from 'vitest';

import manifest from '../../manifest.json' with { type: 'json' };
import { companiesHouse, france, hunter, norway, openCorporates } from '../testing/answers.ts';
import { KEYS, type service } from '../testing/service.ts';
import { createLeadSource, SOURCES } from './index.ts';

type Declared = { id: string; hosts?: string[]; gives: ('find' | 'fill' | 'people')[]; reads?: string };
const declared = (id: string): Declared => (manifest.addOn.sources as Declared[]).find((source) => source.id === id)!;

/** The suite's fixtures for one source, its hosts and gives read from the manifest itself. */
function fixtures(id: string, key: string | null, answers: ReturnType<typeof service> | null, more: Partial<LeadSourceFixtures> = {}): LeadSourceFixtures {
  const source = declared(id);
  return {
    source: id,
    hosts: source.hosts ?? [],
    // The website reader's "fill" is the engine's reading, answered through `fromWebsite`, which the suite asks of it.
    gives: source.reads === 'website' ? [] : source.gives,
    key,
    ...(answers === null ? {} : { respond: (url: URL, init: { headers?: Record<string, string> } | undefined) => answers.respond(url, init) }),
    ...more,
  };
}

const CASES: { id: string; run: () => LeadSourceFixtures }[] = [
  { id: 'companies-house', run: () => fixtures('companies-house', KEYS.companiesHouse, companiesHouse()) },
  {
    id: 'france',
    run: () =>
      fixtures('france', null, france(), {
        find: { activity: '71.11Z', place: { text: 'Lyon', country: 'FR' }, page: { cursor: null, size: 2 } },
        fill: { number: '412345678', country: 'FR' },
        locale: 'fr-FR',
      }),
  },
  {
    id: 'norway',
    run: () =>
      fixtures('norway', null, norway(), {
        find: { activity: '71.110', place: { text: 'Bergen', country: 'NO' }, page: { cursor: null, size: 2 } },
        fill: { number: '923456781', country: 'NO' },
      }),
  },
  { id: 'opencorporates', run: () => fixtures('opencorporates', KEYS.openCorporates, openCorporates(), { fill: { number: '98002264', country: 'GB' } }) },
  { id: 'hunter', run: () => fixtures('hunter', KEYS.hunter, hunter()) },
  { id: 'website', run: () => fixtures('website', null, null) },
];

describe('the contract suite', () => {
  it('covers every source the manifest declares, and the factory has each', () => {
    expect(CASES.map((one) => one.id).sort()).toEqual((manifest.addOn.sources as Declared[]).map((source) => source.id).sort());
    expect(Object.keys(SOURCES).sort()).toEqual(CASES.map((one) => one.id).sort());
  });

  it.each(CASES)('$id conforms, and reaches only its own hosts', async ({ id, run }) => {
    const given = run();
    const report = await leadSourceConformance(createLeadSource, given);
    expect(report.failures).toEqual([]);
    for (const host of report.reached) expect(given.hosts, `${id} reached ${host}`).toContain(host);
    // A source with hosts called out at all: a suite that reached nothing would prove nothing about them.
    if (given.hosts.length > 0) expect(report.reached.length, id).toBeGreaterThan(0);
  });

  it('holds each source to the hosts its code names, and the manifest to the same hosts', () => {
    for (const [id, source] of Object.entries(SOURCES)) expect([...source.hosts].sort(), id).toEqual([...(declared(id).hosts ?? [])].sort());
    expect([...manifest.addOn.network.allow].sort()).toEqual([...new Set(Object.values(SOURCES).flatMap((source) => source.hosts))].sort());
  });

  it('fails a source that reaches past its hosts: the suite is not blind to it', async () => {
    // Companies House's code, handed France's hosts: every call it makes is outside them.
    const report = await leadSourceConformance(createLeadSource, { ...fixtures('companies-house', KEYS.companiesHouse, companiesHouse()), hosts: ['recherche-entreprises.api.gouv.fr'] });
    expect(report.failures.some((failure) => failure.includes('outside its hosts'))).toBe(true);
  });

  it('answers a source id it does not have with a refusal, never a throw', async () => {
    const report = await leadSourceConformance(createLeadSource, { source: 'nowhere', hosts: [], gives: [], key: null });
    expect(report.failures).toEqual([]);
  });
});
