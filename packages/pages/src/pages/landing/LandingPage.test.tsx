// @vitest-environment happy-dom
/**
 * THE PAGE'S ROOT: which copy of the add-on it is open for is asked of the
 * kit before any landing route is, and every landing route the screens then
 * ask names that copy's database.
 */
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { scopeLanding } from '../../install.ts';
import { resetWorld, seed, world } from '../testing/host.tsx';
import { adminium, FUNNEL, KIT, PAGES } from '../testing/fixtures.ts';

const asked = (): string[] => world.calls.filter((call) => call.kind === 'api').map((call) => call.table);

async function draw(kit: unknown): Promise<void> {
  const answer = adminium();
  world.api = (method, path) => {
    if (path !== '/api/v1/add-ons/pages/kit') return answer(method, path);
    if (kit instanceof Error) throw kit;
    return kit;
  };
  const { LandingPage } = await import('./LandingPage.tsx');
  const { wordsFor } = await import('../shared/messages.ts');
  const strings = await import('../strings/index.ts');
  render(<LandingPage t={wordsFor(strings.SHARED, strings.LIST, strings.FUNNELS, strings.EDITOR)} />);
  for (let i = 0; i < 6; i += 1) await act(async () => undefined);
}

beforeEach(() => {
  resetWorld();
  seed('pages', PAGES.slice(0, 2) as never);
  seed('funnels', [FUNNEL] as never);
});
afterEach(() => {
  cleanup();
  scopeLanding(null);
});

describe('the copy the page is open for', () => {
  it('is asked of the kit first; every landing route after names its database', async () => {
    await draw(KIT);
    const calls = asked();
    expect(calls[0]).toBe('get /api/v1/add-ons/pages/kit');
    const landing = calls.filter((call) => call.includes('/api/v1/landing/'));
    expect(landing.length).toBeGreaterThan(0);
    for (const call of landing) expect(call, call).toContain('connectionId=conn-crm');
  });

  it('is named nowhere when the kit cannot say, and the page is drawn all the same', async () => {
    await draw(new Error('not found'));
    const landing = asked().filter((call) => call.includes('/api/v1/landing/'));
    expect(landing.length).toBeGreaterThan(0);
    for (const call of landing) expect(call, call).not.toContain('connectionId=');
  });
});
