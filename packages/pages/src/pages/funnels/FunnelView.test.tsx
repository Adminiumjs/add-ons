// @vitest-environment happy-dom
/**
 * ONE FUNNEL (comp 5; states 2c–2i), as an editor and as a reader.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetWorld, seed, world } from '../testing/host.tsx';
import { adminium, FUNNEL, PAGES, viewsAsked } from '../testing/fixtures.ts';
import { LandingProvider, useLandingReads } from '../shared/landing.tsx';

const NOW = Date.parse('2026-07-28T12:00:00Z');

async function draw(more: Parameters<typeof adminium>[0] = {}): Promise<void> {
  world.api = adminium(more);
  const { wordsFor } = await import('../shared/messages.ts');
  const strings = await import('../strings/index.ts');
  const { FunnelView } = await import('./FunnelView.tsx');
  const t = wordsFor(strings.SHARED, strings.FUNNELS);
  function Page() {
    const landing = useLandingReads(undefined, () => NOW);
    return (
      <LandingProvider value={landing}>
        <FunnelView t={t} funnelKey="11" />
      </LandingProvider>
    );
  }
  render(<Page />);
  for (let i = 0; i < 6; i += 1) await act(async () => undefined);
}

const steps = (): HTMLElement[] => within(screen.getByRole('heading', { name: 'Steps' }).closest('section') as HTMLElement).getAllByRole('listitem');
const reader = (): void => {
  world.cannot.add('update:funnels');
  world.cannot.add('create:funnels');
};

beforeEach(() => {
  resetWorld();
  world.locale = 'en-GB';
  seed('pages', PAGES as never);
  seed('funnels', [FUNNEL] as never);
});
afterEach(() => cleanup());

describe('the steps (5)', () => {
  it('count each step: the page, the form opened and sent on it, the thanks page', async () => {
    await draw();
    expect(steps().map((step) => step.getAttribute('aria-label'))).toEqual([
      'Step 1: Showroom open day, 1,240 views',
      'Step 2: Book a showroom visit, 310 views',
      'Step 3: Book a showroom visit, 96 sends',
      'Step 4: Thanks, see you there, 94 views',
    ]);
    expect(steps().map((step) => within(step).queryByText(/%$/)?.textContent ?? null)).toEqual([null, '25%', '31%', '98%']);
    expect(within(steps()[1]!).getByText('Form · opened')).toBeTruthy();
    expect(within(steps()[1]!).getByText('On Showroom open day')).toBeTruthy();
    expect(within(steps()[0]!).getByText('/x/pages/open-day')).toBeTruthy();
  });

  it('asks the pages once and the form on its page, both under their own installs', async () => {
    await draw();
    expect(viewsAsked(world.calls).sort()).toEqual(['form-opened|1|7', 'form-sent|1|7', 'page||1,5']);
  });

  it('says what is counted and at which level', async () => {
    await draw({ level: 'visitor' });
    expect(screen.getByText('Views, not people. Known bots are left out. Counting: Per visitor.')).toBeTruthy();
  });

  it('says when counting started inside the range (2d)', async () => {
    await draw({ countingSince: Date.parse('2026-07-14T08:00:00Z') });
    expect(screen.getByText('Counting started on 14 Jul 2026. Days before that show nothing.')).toBeTruthy();
  });

  it('says nothing of a start before the range', async () => {
    await draw({ countingSince: Date.parse('2026-06-14T08:00:00Z') });
    expect(screen.queryByText(/Counting started on/)).toBeNull();
  });

  it('shows a deleted page as removed and a page that is off with its count (2e)', async () => {
    seed('funnels', [{ ...FUNNEL, steps: [{ kind: 'page', key: '1' }, { kind: 'page', key: '99' }, { kind: 'page', key: '4' }] }] as never);
    await draw({ counts: { 'page|': { '1': 1240, '4': 12 } } });
    expect(steps()[1]?.getAttribute('aria-label')).toBe('Step 2: Page, removed');
    expect(within(steps()[1]!).getByText('This page was deleted.')).toBeTruthy();
    expect(within(steps()[2]!).getByText('Off')).toBeTruthy();
    expect(steps()[2]?.getAttribute('aria-label')).toBe('Step 3: Spring offer, 12 views');
    // Nothing went on from a removed step: never a made-up share.
    expect(within(steps()[1]!).getByText('—')).toBeTruthy();
    expect(within(steps()[2]!).getByText('—')).toBeTruthy();
  });

  it('shows 0 and “—” when nothing was counted in the range, and says so (2f)', async () => {
    await draw({ counts: {} });
    expect(steps().map((step) => step.getAttribute('aria-label'))).toEqual([
      'Step 1: Showroom open day, 0 views',
      'Step 2: Book a showroom visit, 0 views',
      'Step 3: Book a showroom visit, 0 sends',
      'Step 4: Thanks, see you there, 0 views',
    ]);
    expect(screen.queryByText('0%')).toBeNull();
    expect(screen.getByText('No views in this range yet.')).toBeTruthy();
  });

  it('at Off, keeps the steps’ names with no count and says there is nothing to show (2c)', async () => {
    await draw({ level: 'off' });
    expect(steps().map((step) => step.getAttribute('aria-label'))).toEqual(['Step 1: Showroom open day', 'Step 2: Book a showroom visit', 'Step 3: Book a showroom visit', 'Step 4: Thanks, see you there']);
    expect(screen.getByText('Counting is off, so there is nothing to show.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Visitor counting →' }).getAttribute('href')).toBe('/studio/privacy');
    expect(screen.queryByText(/^Views, not people/)).toBeNull();
  });
});

describe('the date range (2h)', () => {
  it('is a choice of five, this month first, each with its days, and the counts kept', async () => {
    await draw();
    const choices = within(screen.getByRole('radiogroup', { name: 'Date range' })).getAllByRole('radio');
    expect(choices.map((one) => (one.textContent ?? '').replace(/\s/g, ' '))).toEqual(['This month1 – 28 Jul 2026', 'Last month1 – 30 Jun 2026', 'Last 7 days22 – 28 Jul 2026', 'Last 30 days29 Jun – 28 Jul 2026', 'Last 12 months1 Aug 2025 – 28 Jul 2026']);
    expect(choices[0]?.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Counts are kept for 13 months.')).toBeTruthy();
  });

  it('reads the counts again for the range picked', async () => {
    await draw();
    world.calls = [];
    fireEvent.click(screen.getByRole('radio', { name: /^Last month/ }));
    for (let i = 0; i < 4; i += 1) await act(async () => undefined);
    const asked = world.calls.filter((call) => call.kind === 'api' && call.table.startsWith('get /api/v1/views')).map((call) => new URL(call.table.slice(4), 'https://x.example').searchParams);
    expect(asked.length).toBe(3);
    for (const one of asked) expect([one.get('from'), one.get('to')]).toEqual(['2026-06-01', '2026-06-30']);
  });
});

describe('what happens after (2c, 2g)', () => {
  it('shows the rule’s name and its steps, and Open rule to someone who manages rules', async () => {
    await draw();
    const after = screen.getByRole('heading', { name: 'What happens after' }).closest('section') as HTMLElement;
    expect(within(after).getByText('Brochure follow-up')).toBeTruthy();
    expect(within(after).getByText('Rule linked to this funnel')).toBeTruthy();
    expect(within(within(after).getByRole('list', { name: 'Brochure follow-up steps' })).getAllByRole('listitem').map((chip) => chip.textContent)).toEqual(['Form sent', 'E-mail the brochure', 'Wait 2 days', 'If no deal yet, a follow-up for the rep']);
    fireEvent.click(within(after).getByRole('button', { name: 'Open rule' }));
    expect(world.navigated.at(-1)).toEqual({ to: '/automations?rule=rule-brochure' });
  });

  it('shows the name and steps, never Open rule, to someone Adminium does not let open it', async () => {
    await draw({ rule: { data: { name: 'Brochure follow-up', id: 'rule-brochure', canOpen: false, chips: ['Form sent'] } } });
    expect(screen.getByText('Brochure follow-up')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Open rule' })).toBeNull();
  });

  it('with no rule, says so and offers Link a rule to an editor only', async () => {
    seed('funnels', [{ ...FUNNEL, rule_id: null }] as never);
    await draw();
    expect(screen.getByText('No rule linked.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Link a rule' }));
    expect(screen.getByRole('heading', { name: 'Edit funnel' })).toBeTruthy();
    expect(world.calls.some((call) => call.table.startsWith('get /api/v1/landing/pages/funnels/'))).toBe(false);
  });

  it('says when the linked rule was deleted', async () => {
    await draw({ rule: { data: { state: 'removed' } } });
    expect(screen.getByText('The linked rule was deleted.')).toBeTruthy();
  });
});

describe('the funnel’s menu (2i)', () => {
  it('edits the funnel with its values, and deletes it after asking', async () => {
    await draw();
    const menu = screen.getByRole('menu', { name: 'Funnel menu' });
    fireEvent.click(within(menu).getByRole('button', { name: 'Edit funnel' }));
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Open day');
    cleanup();
    await draw();
    fireEvent.click(within(screen.getByRole('menu', { name: 'Funnel menu' })).getByRole('button', { name: 'Delete funnel' }));
    const dialog = screen.getByRole('heading', { name: 'Delete the funnel “Open day”?' }).closest('[role="dialog"]') as HTMLElement;
    expect(within(dialog).getByText('Its pages, forms and counts stay.')).toBeTruthy();
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Delete funnel' })));
    expect(world.calls.some((call) => call.kind === 'remove' && call.table === 'funnels' && call.key === '11')).toBe(true);
    expect(world.navigated.at(-1)).toEqual({ to: '/add-ons/pages/pages/funnels' });
    expect(world.toasts.at(-1)?.title).toBe('Funnel deleted.');
  });
});

describe('a reader', () => {
  it('sees the funnel, its counts and its rule, and no control that changes it', async () => {
    reader();
    seed('funnels', [{ ...FUNNEL, rule_id: null }] as never);
    await draw();
    expect(steps()).toHaveLength(4);
    expect(screen.queryByRole('menu', { name: 'Funnel menu' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit funnel' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete funnel' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Link a rule' })).toBeNull();
    expect(screen.getByText('No rule linked.')).toBeTruthy();
  });
});

describe('a funnel that is not there', () => {
  it('says so and leads back to the funnels', async () => {
    seed('funnels', []);
    await draw();
    expect(screen.getByText('This funnel is not here any more')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to the funnels' }).getAttribute('href')).toBe('/add-ons/pages/pages/funnels');
  });
});
