// @vitest-environment happy-dom
/**
 * "NEW FUNNEL" AND "EDIT FUNNEL" (comp 2b).
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetWorld, seed, world } from '../testing/host.tsx';
import { adminium, FORMS, FUNNEL, PAGES } from '../testing/fixtures.ts';
import { LandingProvider, useLandingReads } from '../shared/landing.tsx';
import { funnelRowOf, pageRowOf, type FunnelRow } from '../shared/rows.ts';
import { added, moved } from './FunnelDialog.tsx';

const pages = PAGES.map((row) => pageRowOf(row as never));
let saved: string[] = [];

async function draw(funnel: FunnelRow | null = null, more: Parameters<typeof adminium>[0] = {}): Promise<void> {
  world.api = adminium(more);
  const { wordsFor } = await import('../shared/messages.ts');
  const strings = await import('../strings/index.ts');
  const { FunnelDialog } = await import('./FunnelDialog.tsx');
  const t = wordsFor(strings.SHARED, strings.FUNNELS);
  function Page() {
    const landing = useLandingReads();
    return <LandingProvider value={landing}>{landing.ready ? <FunnelDialog t={t} funnel={funnel} pages={pages} onClose={() => undefined} onSaved={(key) => saved.push(key)} /> : null}</LandingProvider>;
  }
  render(<Page />);
  for (let i = 0; i < 4; i += 1) await act(async () => undefined);
}

const menu = (): HTMLElement => screen.getByRole('menu', { name: 'Add a step' });
const rows = (): string[] => within(screen.getByRole('list')).getAllByRole('listitem').map((row) => row.textContent ?? '');
const lastWrite = () => world.calls.filter((call) => (call.kind === 'create' || call.kind === 'update') && call.table === 'funnels').at(-1);

beforeEach(() => {
  resetWorld();
  saved = [];
  seed('funnels', [FUNNEL] as never);
});
afterEach(() => cleanup());

describe('a new funnel', () => {
  it('starts empty, and offers the live pages and the live forms, a draft and a page that is off left out', async () => {
    await draw();
    expect(screen.getByRole('heading', { name: 'New funnel' })).toBeTruthy();
    expect(screen.getByText('No steps yet. Start with the page that comes first.')).toBeTruthy();
    const offered = within(menu()).getAllByRole('button').map((item) => item.textContent);
    expect(offered).toEqual(['Showroom open day', 'Acoustic booths', 'Thanks, see you there', 'Book a showroom visit']);
  });

  it('takes the steps in the order they are added, and moves one up or down, saying where it went', async () => {
    await draw();
    fireEvent.click(within(menu()).getByRole('button', { name: 'Showroom open day' }));
    fireEvent.click(within(menu()).getByRole('button', { name: 'Book a showroom visit' }));
    fireEvent.click(within(menu()).getByRole('button', { name: 'Thanks, see you there' }));
    expect(rows().map((row) => row.replace(/^\d+/, ''))).toEqual(['PageShowroom open day', 'FormBook a showroom visit', 'PageThanks, see you there']);
    expect((screen.getByRole('button', { name: 'Move Showroom open day up' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Move Thanks, see you there down' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Move Thanks, see you there up' }));
    expect(rows()[1]).toContain('Thanks, see you there');
    expect(screen.getByRole('status').textContent).toBe('Thanks, see you there moved to 2 of 3.');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Book a showroom visit' }));
    expect(rows()).toHaveLength(2);
  });

  it('is saved with its name, its steps in the shared shape and the rule picked by hand', async () => {
    await draw();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Open day ' } });
    fireEvent.click(within(menu()).getByRole('button', { name: 'Showroom open day' }));
    fireEvent.click(within(menu()).getByRole('button', { name: 'Book a showroom visit' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Brochure follow-up' }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Create funnel' })));
    expect(lastWrite()).toMatchObject({ kind: 'create', values: { name: 'Open day', steps: [{ kind: 'page', key: '1' }, { kind: 'form', key: '7', addOn: 'forms' }], rule_id: 'rule-brochure' } });
    expect(world.toasts.at(-1)?.title).toBe('Funnel made.');
    expect(saved).toHaveLength(1);
  });

  it('needs a name and a first step', async () => {
    await draw();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Create funnel' })));
    expect(screen.getAllByRole('alert').map((one) => one.textContent)).toEqual(['Give the funnel a name.', 'Add the page that comes first.']);
    expect(lastWrite()).toBeUndefined();
  });
});

describe('at most eight steps', () => {
  const eight = Array.from({ length: 8 }, (_, i) => ({ kind: 'page' as const, key: String(100 + i) }));

  it('switches "Add a step" off at eight, and says why', async () => {
    await draw({ key: '11', name: 'Long', steps: eight, ruleId: null });
    const add = screen.getByRole('button', { name: 'Add a step' }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    expect(screen.queryByRole('menu', { name: 'Add a step' })).toBeNull();
    const holder = add.closest('[aria-describedby]') as HTMLElement;
    expect(document.getElementById(holder.getAttribute('aria-describedby') ?? '')?.textContent).toBe('At most 8 steps.');
  });

  it('never adds a ninth, nor the same step twice', () => {
    expect(added(eight, { kind: 'page', key: '1' })).toEqual(eight);
    expect(added(eight.slice(0, 7), { kind: 'page', key: '1' })).toHaveLength(8);
    expect(added([{ kind: 'page', key: '1' }], { kind: 'page', key: '1' })).toHaveLength(1);
    expect(added([{ kind: 'form', key: '7', addOn: 'forms' }], { kind: 'form', key: '7', addOn: 'surveys' })).toHaveLength(2);
  });

  it('moves a step by one place, and never past an end', () => {
    expect(moved(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(moved(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moved(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(moved(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
  });
});

describe('editing a funnel', () => {
  it('opens with the funnel as it is: its name, its steps and its rule picked', async () => {
    await draw(funnelRowOf(FUNNEL as never));
    expect(screen.getByRole('heading', { name: 'Edit funnel' })).toBeTruthy();
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Open day');
    expect(rows()).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'Brochure follow-up' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'None' }).getAttribute('aria-checked')).toBe('false');
  });

  it('saves to the same row, and unlinking the rule writes none', async () => {
    await draw(funnelRowOf(FUNNEL as never));
    fireEvent.click(screen.getByRole('radio', { name: 'None' }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save funnel' })));
    expect(lastWrite()).toMatchObject({ kind: 'update', key: '11', values: { name: 'Open day', rule_id: null } });
    expect(world.toasts.at(-1)?.title).toBe('Funnel saved.');
  });

  it('shows someone who may not list the rules the one linked now and None, and says why there is no more', async () => {
    await draw(funnelRowOf(FUNNEL as never), { rules: null });
    expect(screen.getAllByRole('radio').map((one) => one.textContent)).toEqual(['Brochure follow-up', 'None']);
    expect(screen.getByText('Only someone who manages rules can link another rule.')).toBeTruthy();
  });

  it('shows a refused save in the server’s words', async () => {
    world.before = (kind) => {
      if (kind === 'update') throw Object.assign(new Error('nope'), { code: 'FORBIDDEN', message: '' });
    };
    await draw(funnelRowOf(FUNNEL as never));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save funnel' })));
    expect(screen.getByRole('alert').textContent).toBe('You do not have permission to do this.');
    expect(saved).toEqual([]);
  });
});

describe('the forms offered', () => {
  it('are the forms add-ons’ live forms, each once', async () => {
    await draw(null, { forms: [...FORMS, { ...FORMS[0], key: '8', name: 'Ask about a booth' }] });
    expect(within(menu()).getAllByRole('button').map((item) => item.textContent)).toContain('Ask about a booth');
    fireEvent.click(within(menu()).getByRole('button', { name: 'Ask about a booth' }));
    expect(within(menu()).queryByRole('button', { name: 'Ask about a booth' })).toBeNull();
  });
});
