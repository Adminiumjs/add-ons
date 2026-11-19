// @vitest-environment happy-dom
/**
 * THE LIST (comp 1a–1c; 2a for the Funnels tab).
 *
 * Proved as an editor and as a reader: the reader is shown every page and
 * funnel, and no control that makes one.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetWorld, seed, world } from '../testing/host.tsx';
import { adminium, FUNNEL, PAGES, viewsAsked } from '../testing/fixtures.ts';
import { LandingProvider, useLandingReads } from '../shared/landing.tsx';
import { matching } from './List.tsx';

const NOW = Date.parse('2026-07-28T12:00:00Z');

async function draw(tab: 'pages' | 'funnels' = 'pages', more: Parameters<typeof adminium>[0] = {}): Promise<void> {
  world.api = adminium(more);
  const { wordsFor } = await import('../shared/messages.ts');
  const strings = await import('../strings/index.ts');
  const { List } = await import('./List.tsx');
  const t = wordsFor(strings.SHARED, strings.LIST, strings.FUNNELS);
  function Page() {
    const landing = useLandingReads(undefined, () => NOW);
    return (
      <LandingProvider value={landing}>
        <List t={t} tab={tab} />
      </LandingProvider>
    );
  }
  render(<Page />);
  for (let i = 0; i < 4; i += 1) await act(async () => undefined);
}

const reader = (): void => {
  for (const table of ['pages', 'funnels']) for (const action of ['create', 'update']) world.cannot.add(`${action}:${table}`);
};
const card = (name: string): HTMLElement => screen.getByRole('heading', { name }).closest('li') as HTMLElement;

beforeEach(() => {
  resetWorld();
  seed('pages', PAGES.slice(0, 4) as never);
  seed('funnels', [FUNNEL] as never);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the pages as cards (1a)', () => {
  it('shows each page’s status, address and this month’s views; a draft has none yet', async () => {
    await draw();
    expect(within(card('Showroom open day')).getByText('Live')).toBeTruthy();
    expect(within(card('Showroom open day')).getByText('/x/pages/open-day')).toBeTruthy();
    expect(within(card('Showroom open day')).getByText('1,240')).toBeTruthy();
    expect(within(card('Showroom open day')).getByText('views this month')).toBeTruthy();
    expect(within(card('Acoustic booths')).getByText('412')).toBeTruthy();
    expect(within(card('Spring open day')).getByText('Draft')).toBeTruthy();
    expect(within(card('Spring open day')).getByText('—')).toBeTruthy();
    expect(within(card('Spring open day')).getByText('not live yet')).toBeTruthy();
    expect(within(card('Spring offer')).getByText('Off')).toBeTruthy();
  });

  it('says one view as one, and many as many, in the card and the list, and in the language read in', async () => {
    await draw('pages', { counts: { 'page|': { '1': 1, '2': 2, '4': 0 } } });
    expect(within(card('Showroom open day')).getByText('view this month')).toBeTruthy();
    expect(within(card('Acoustic booths')).getByText('views this month')).toBeTruthy();
    expect(within(card('Spring offer')).getByText('views this month')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'List' }));
    const table = screen.getByRole('table');
    expect(within(table).getByText('Showroom open day').closest('tr')?.textContent).toContain('1 view');
    expect(within(table).getByText('Showroom open day').closest('tr')?.textContent).not.toContain('1 views');
    expect(within(table).getByText('Acoustic booths').closest('tr')?.textContent).toContain('2 views');
    cleanup();
    // Arabic says two with a form of its own.
    world.locale = 'ar-EG';
    await draw('pages', { counts: { 'page|': { '1': 1, '2': 2, '4': 3 } } });
    expect(within(card('Acoustic booths')).getByText('مشاهدتان هذا الشهر')).toBeTruthy();
    expect(within(card('Spring offer')).getByText('مشاهدات هذا الشهر')).toBeTruthy();
  });

  it('asks the views of this month in the business’s zone, for the pages that were ever live, under the add-on’s install', async () => {
    await draw();
    expect(viewsAsked(world.calls)).toEqual(['page||1,2,4']);
    const asked = world.calls.find((call) => call.kind === 'api' && call.table.startsWith('get /api/v1/views'))!;
    const url = new URL(asked.table.slice(4), 'https://x.example');
    expect([url.searchParams.get('installId'), url.searchParams.get('from'), url.searchParams.get('to')]).toEqual(['install-pages', '2026-07-01', '2026-07-28']);
  });

  it('copies a page’s full address, and says so', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await draw();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy the address of Acoustic booths' })));
    expect(writeText).toHaveBeenCalledWith('https://crm.meridian.example/x/pages/acoustic-booths');
    expect(world.toasts.at(-1)?.title).toBe('Address copied.');
  });

  it('opens a page in the editor', async () => {
    await draw();
    fireEvent.click(within(card('Acoustic booths')).getByRole('button', { name: 'Edit' }));
    expect(world.navigated.at(-1)).toEqual({ to: '/add-ons/pages/pages/page/2' });
  });
});

describe('search, and the list (1a’s list view)', () => {
  it('finds pages by name or address', () => {
    const pages = [
      { key: '1', name: 'Showroom open day', slug: 'open-day', state: 'live' as const, language: 'en-US', heading: '' },
      { key: '2', name: 'Acoustic booths', slug: 'acoustic-booths', state: 'live' as const, language: 'en-US', heading: '' },
    ];
    expect(matching(pages, 'BOOTHS').map((page) => page.key)).toEqual(['2']);
    expect(matching(pages, 'open-day').map((page) => page.key)).toEqual(['1']);
    expect(matching(pages, '  ').map((page) => page.key)).toEqual(['1', '2']);
  });

  it('says when nothing matches', async () => {
    await draw();
    fireEvent.change(screen.getByRole('combobox', { name: 'Search pages' }), { target: { value: 'gift' } });
    expect(screen.getByText('No pages match “gift”.')).toBeTruthy();
  });

  it('shows the pages as a table with their views', async () => {
    await draw();
    fireEvent.click(screen.getByRole('radio', { name: 'List' }));
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Page', 'Status', 'Address', 'Views this month', 'Edit']);
    expect(within(table).getByText('Acoustic booths').closest('tr')?.textContent).toContain('412 views');
    expect(within(table).getByText('Spring open day').closest('tr')?.textContent).toContain('— not live yet');
  });
});

describe('making a page', () => {
  it('is offered to someone who may make a page: New page and Draft with Milo', async () => {
    await draw();
    fireEvent.click(screen.getByRole('button', { name: 'New page' }));
    expect(world.navigated.at(-1)).toEqual({ to: '/add-ons/pages/pages/new' });
    fireEvent.click(screen.getByRole('button', { name: 'Draft with Milo' }));
    expect(world.navigated.at(-1)).toEqual({ to: '/add-ons/pages/pages/new?milo=1' });
  });

  it('is not offered to a reader, who opens a page to read it', async () => {
    reader();
    await draw();
    expect(screen.queryByRole('button', { name: 'New page' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Draft with Milo' })).toBeNull();
    expect(within(card('Acoustic booths')).getByRole('button', { name: 'Open' })).toBeTruthy();
  });
});

describe('no pages yet (1b)', () => {
  it('says so, and offers both ways to start to someone who may', async () => {
    seed('pages', []);
    await draw();
    const empty = screen.getByText('No pages yet').closest('[data-part="empty"]') as HTMLElement;
    expect(within(empty).getByText('Build a page for an offer or an event, with a form on it.')).toBeTruthy();
    expect(within(empty).getByRole('button', { name: 'New page' })).toBeTruthy();
    expect(within(empty).getByRole('button', { name: 'Draft with Milo' })).toBeTruthy();
  });

  it('offers nothing to a reader', async () => {
    seed('pages', []);
    reader();
    await draw();
    const empty = screen.getByText('No pages yet').closest('[data-part="empty"]') as HTMLElement;
    expect(within(empty).queryAllByRole('button')).toEqual([]);
  });
});

describe('the Funnels tab', () => {
  it('counts both tabs', async () => {
    await draw();
    expect(screen.getByRole('tab', { name: /Pages/ }).textContent).toContain('4');
    expect(screen.getByRole('tab', { name: /Funnels/ }).textContent).toContain('1');
  });

  it('lists each funnel with its steps in order and the views of its first and last step this month', async () => {
    seed('pages', PAGES as never);
    world.locale = 'en-GB';
    await draw('funnels');
    const row = screen.getByText('Open day').closest('tr') as HTMLElement;
    expect(row.textContent).toContain('Showroom open day → Book a showroom visit → Thanks, see you there');
    expect(row.textContent).toContain('1,240 views');
    expect(row.textContent).toContain('94 views');
    expect(screen.getByText((text) => text.replace(/\s/g, ' ') === 'This month, 1 – 28 Jul 2026. Views, not people.')).toBeTruthy();
  });

  it('when there is none, says so and offers New funnel (2a), to someone who may make one only', async () => {
    seed('funnels', []);
    await draw('funnels');
    expect(screen.getByText('No funnels yet')).toBeTruthy();
    expect(screen.getByText('Put a page, its form and its thanks page in order to see how many views each step gets.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'New funnel' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    cleanup();
    reader();
    await draw('funnels');
    expect(screen.queryByRole('button', { name: 'New funnel' })).toBeNull();
  });
});
