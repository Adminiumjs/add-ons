/**
 * ADMINIUM'S ROUTES, AS `engine.ts` CALLS AND READS THEM.
 *
 * Against a fake: the routes are the shared design's shapes. Each reader asks
 * the path it should and reads an answer leniently: what it does not know is
 * "not known", never a throw.
 */
import { describe, expect, it } from 'vitest';

import { funnelRuleOf, installIdsOf, liveFormsOf, readFunnelRule, readLiveForms, readRules, readStatus, readViews, rulesOf, statusOf, totalOf, viewCountsOf, VIEWS_THINGS_MAX, type EngineApi } from './engine.ts';

function fake(answer: (path: string) => unknown): EngineApi & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    get: async (path: string) => {
      asked.push(path);
      return answer(path);
    },
  };
}

describe('the status read', () => {
  it('asks the add-on’s own status, for one page when asked', async () => {
    const api = fake(() => ({ data: {} }));
    await readStatus(api, 'pages');
    await readStatus(api, 'pages', '12');
    expect(api.asked).toEqual(['/api/v1/landing/pages/status', '/api/v1/landing/pages/status?page=12']);
  });

  it('reads the install, the notice, the reach, the address, the zone, the keeping and the hosts', () => {
    expect(
      statusOf({ data: { installId: 'i-1', notice: false, reach: { state: 'unreachable', code: 'proxy' }, publicOrigin: 'https://crm.example', timeZone: 'Europe/Prague', viewCountsMonths: 13, hosts: [{ host: 'events.example', address: 'https://events.example/x/pages/open-day', home: true }, 'offers.example', { nothing: 1 }] } }),
    ).toEqual({
      installId: 'i-1',
      notice: false,
      reach: { state: 'unreachable', code: 'proxy' },
      publicOrigin: 'https://crm.example',
      timeZone: 'Europe/Prague',
      viewCountsMonths: 13,
      hosts: [
        { host: 'events.example', address: 'https://events.example/x/pages/open-day', home: true },
        { host: 'offers.example', address: null, home: false },
      ],
    });
  });

  it('reads an answer it does not know as nothing known', () => {
    expect(statusOf('nonsense')).toEqual({ installId: null, notice: null, reach: null, publicOrigin: null, timeZone: null, viewCountsMonths: null, hosts: [] });
    expect(statusOf({ data: { viewCountsMonths: -2, installId: 3 } })).toMatchObject({ viewCountsMonths: null, installId: '3' });
  });
});

describe('the views read', () => {
  it('asks for the kind, the things, the days and the place, and adds a thing’s days up', async () => {
    const api = fake(() => ({ data: { level: 'counts', countingSince: 1_752_000_000_000, things: [{ thing: '7', days: [{ day: '2026-07-01', place: '1', views: 4 }, { day: '2026-07-02', place: '1', views: 6 }] }] } }));
    const counts = await readViews(api, { installId: 'i-forms', kind: 'form-opened', things: ['7'], from: '2026-07-01', to: '2026-07-28', place: '1' });
    expect(api.asked).toEqual(['/api/v1/views?installId=i-forms&kind=form-opened&things=7&from=2026-07-01&to=2026-07-28&place=1']);
    expect(totalOf(counts, '7')).toBe(10);
    expect(totalOf(counts, '8')).toBe(0);
    expect(counts.level).toBe('counts');
    expect(counts.countingSince).toBe(1_752_000_000_000);
  });

  it('asks at most fifty things a read, and puts the reads back together', async () => {
    const api = fake((path) => {
      const things = new URL(path, 'https://x.example').searchParams.get('things')!.split(',');
      return { data: { level: 'visitor', countingSince: null, things: things.map((thing) => ({ thing, days: [{ day: '2026-07-01', place: '', views: 1 }] })) } };
    });
    const things = Array.from({ length: 120 }, (_, i) => String(i + 1));
    const counts = await readViews(api, { installId: 'i', kind: 'page', things, from: '2026-07-01', to: '2026-07-28' });
    expect(api.asked).toHaveLength(3);
    for (const path of api.asked) expect(new URL(path, 'https://x.example').searchParams.get('things')!.split(',').length).toBeLessThanOrEqual(VIEWS_THINGS_MAX);
    expect(things.every((thing) => totalOf(counts, thing) === 1)).toBe(true);
    expect(counts.level).toBe('visitor');
  });

  it('asks nothing for nothing', async () => {
    const api = fake(() => ({}));
    const counts = await readViews(api, { installId: 'i', kind: 'page', things: [], from: '2026-07-01', to: '2026-07-28' });
    expect(api.asked).toEqual([]);
    expect(counts).toEqual({ level: null, countingSince: null, days: new Map() });
  });

  it('reads a level it does not know, and days that are not days, as nothing', () => {
    const counts = viewCountsOf({ data: { level: 'everything', countingSince: '2026-07-14T00:00:00Z', things: [{ thing: 1, days: [{ day: '2026-07-01', views: 'many' }, { day: '2026-07-02', views: 3 }] }, 'x'] } });
    expect(counts.level).toBeNull();
    expect(counts.countingSince).toBe(Date.parse('2026-07-14T00:00:00Z'));
    expect(totalOf(counts, '1')).toBe(3);
  });
});

describe('the live forms read', () => {
  it('asks across the forms add-ons and reads each form by its add-on and key', async () => {
    const api = fake(() => ({ data: [{ addOn: 'forms', key: 7, name: 'Book a visit', slug: 'book', languages: ['en-US', 'de-DE', 3], ending: { kind: 'words' } }, { name: 'no key' }] }));
    expect(await readLiveForms(api, 'pages')).toEqual([{ addOn: 'forms', key: '7', name: 'Book a visit', slug: 'book', languages: ['en-US', 'de-DE'], ending: { kind: 'words' }, installId: null }]);
    expect(api.asked).toEqual(['/api/v1/landing/pages/forms']);
    expect(liveFormsOf({ data: { forms: [{ addOn: 'forms', key: '1', installId: 'i-f' }] } })[0]?.installId).toBe('i-f');
  });
});

describe('a funnel’s rule', () => {
  it('asks the funnel’s own rule read', async () => {
    const api = fake(() => ({ data: { name: 'Brochure follow-up', chips: [] } }));
    await readFunnelRule(api, 'pages', '11');
    expect(api.asked).toEqual(['/api/v1/landing/pages/funnels/11/rule']);
  });

  it('reads the name, the steps as chips and whether the person may open it', () => {
    expect(funnelRuleOf({ data: { id: 'r1', name: 'Brochure follow-up', canOpen: true, chips: [{ words: 'Form sent', icon: 'file-check' }, 'Wait 2 days', { label: 'E-mail' }, 4] } })).toEqual({
      state: 'linked',
      id: 'r1',
      name: 'Brochure follow-up',
      canOpen: true,
      chips: [
        { words: 'Form sent', icon: 'file-check' },
        { words: 'Wait 2 days', icon: null },
        { words: 'E-mail', icon: null },
      ],
    });
  });

  it('never lets someone open a rule unless Adminium says they may', () => {
    expect(funnelRuleOf({ data: { name: 'R', chips: [] } })).toMatchObject({ canOpen: false });
    expect(funnelRuleOf({ data: { name: 'R', canOpen: 'yes' } })).toMatchObject({ canOpen: false });
  });

  it('reads a rule that was deleted, and no rule', () => {
    expect(funnelRuleOf({ data: { state: 'removed' } })).toEqual({ state: 'removed' });
    expect(funnelRuleOf({ data: { removed: true, name: 'R' } })).toEqual({ state: 'removed' });
    expect(funnelRuleOf({ data: { state: 'none' } })).toEqual({ state: 'none' });
    expect(funnelRuleOf(null)).toEqual({ state: 'none' });
  });
});

describe('the rules to pick from', () => {
  it('are the rules, for someone who manages them', async () => {
    expect(await readRules(fake(() => ({ rules: [{ id: 'r1', name: 'A' }, { id: 2, name: 'B' }, { name: 'no id' }] })))).toEqual([
      { id: 'r1', name: 'A' },
      { id: '2', name: 'B' },
    ]);
    expect(rulesOf(undefined)).toEqual([]);
  });

  it('are nothing to pick for anyone Adminium refuses the list', async () => {
    const api: EngineApi = {
      get: async () => {
        throw Object.assign(new Error('forbidden'), { code: 'FORBIDDEN' });
      },
    };
    expect(await readRules(api)).toBeNull();
  });
});

describe('install ids', () => {
  it('are read by add-on key, the first copy of each', () => {
    expect([...installIdsOf({ addOns: [{ key: 'pages', installId: 'a' }, { key: 'pages', installId: 'b' }, { key: 'forms', installId: 'c' }, { key: 'x' }] })]).toEqual([
      ['pages', 'a'],
      ['forms', 'c'],
    ]);
  });
});
