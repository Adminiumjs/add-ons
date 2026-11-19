// @vitest-environment happy-dom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetWorld, seed, world } from '../testing/host.tsx';
import { KIT, KIT_REPLY, SOURCES, answer, sourceList } from '../testing/fixtures.ts';
import { FinderPage } from './FinderPage.tsx';

async function draw(splat: string): Promise<void> {
  world.splat = splat;
  seed('settings', [{ id: 1, people_on: false, purpose: null, keep_years: 3 }] as never);
  answer({ [SOURCES]: () => ({ key: 'lead-finder', canManage: true, sources: sourceList() }), [KIT]: () => KIT_REPLY, '/api/v1/bootstrap': () => ({ data: { nav: { groups: [] } } }) });
  const { wordsFor } = await import('../shared/messages.ts');
  const strings = await import('../strings/index.ts');
  render(<FinderPage t={wordsFor(strings.SHARED, strings.SOURCE, strings.DOOR, strings.FIND, strings.PEOPLE, strings.SETTINGS, strings.MAIL)} />);
  for (let turn = 0; turn < 3; turn += 1) await act(async () => undefined);
}

beforeEach(() => resetWorld());
afterEach(() => cleanup());

describe('the page’s tabs', () => {
  for (const [splat, chosen] of [
    ['lead-finder', 'Find companies'],
    ['lead-finder/people', 'People found'],
    ['lead-finder/settings/sources', 'Sources'],
    ['lead-finder/settings/people', 'People'],
    ['lead-finder/settings/people/mail', 'People'],
  ] as const) {
    it(`gives every tab a panel that is there, the chosen one shown (${splat})`, async () => {
      await draw(splat);
      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBe(2);
      for (const tab of tabs) {
        const controls = tab.getAttribute('aria-controls');
        expect(controls, tab.textContent ?? '').toBeTruthy();
        const panel = document.getElementById(controls!);
        expect(panel, `${tab.textContent ?? ''} controls #${controls ?? ''}`).not.toBeNull();
        expect(panel!.getAttribute('role')).toBe('tabpanel');
        expect(panel!.hasAttribute('hidden')).toBe(tab.getAttribute('aria-selected') !== 'true');
      }
      expect(screen.getByRole('tab', { selected: true }).textContent).toContain(chosen);
    });
  }
});
