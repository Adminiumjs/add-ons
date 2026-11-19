// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Refused, resetWorld, world } from '../testing/host.tsx';
import { DOOR, FOUND, KIT, KIT_REPLY, SOURCES, answer, pending, sourceList } from '../testing/fixtures.ts';
import { Find } from './Find.tsx';

async function draw(handlers: Record<string, (payload: unknown) => unknown> = {}, kit = KIT_REPLY, list = sourceList()): Promise<void> {
  answer({ [SOURCES]: () => ({ key: 'lead-finder', canManage: true, sources: list }), [KIT]: () => kit, ...handlers });
  const { wordsFor } = await import('../shared/messages.ts');
  const strings = await import('../strings/index.ts');
  const t = wordsFor(strings.SHARED, strings.SOURCE, strings.DOOR, strings.FIND);
  render(<Find t={t} onSaid={() => undefined} />);
  await act(async () => undefined);
}

const settle = async () => {
  await act(async () => undefined);
  await act(async () => undefined);
};

async function search(): Promise<void> {
  fireEvent.change(screen.getByRole('combobox', { name: 'What they do' }), { target: { value: '71111' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Where' }), { target: { value: 'Leeds' } });
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
  await settle();
}

const searched = (body: Record<string, unknown> = {}) => ({ source: 'companies-house', table: 'crm:companies', peopleOn: false, companies: FOUND, next: null, total: null, ...body });
const wide = (): HTMLElement => screen.getByRole('table');
const rowOf = (name: string): HTMLElement => within(wide()).getByText(name).closest('tr') as HTMLElement;

beforeEach(() => resetWorld());
afterEach(() => cleanup());

describe('Find companies, before a search', () => {
  it('offers in "Search in" only the sources that find companies and are on', async () => {
    await draw({}, KIT_REPLY, sourceList({ norway: { on: false } }));
    const group = screen.getByRole('radiogroup', { name: 'Search in' });
    expect(within(group).getAllByRole('radio').map((one) => one.textContent)).toEqual(['Companies House (UK)', 'Register of France']);
    // OpenCorporates fills in only; Hunter finds people; the website reader is not a register.
    expect(within(group).queryByText('OpenCorporates')).toBeNull();
  });

  it('says no source can search when none that finds is on, and points at Sources', async () => {
    await draw({}, KIT_REPLY, sourceList({ 'companies-house': { on: false }, france: { on: false }, norway: { on: false } }));
    expect(screen.getByText('No source can search. Turn one on in Sources.')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Sources/ }).getAttribute('href')).toBe('/add-ons/lead-finder/lead-finder/settings/sources');
  });

  it('asks nothing until Search, and searches by the code chosen, the place typed and the source’s country', async () => {
    let asked: unknown = null;
    await draw({ [`post ${DOOR}/search`]: (body) => ((asked = body), searched()) });
    expect(world.calls.filter((call) => call.table.startsWith('post ')).length).toBe(0);
    await search();
    expect(asked).toEqual({ source: 'companies-house', table: 'crm:companies', activity: '71111', place: { text: 'Leeds', country: 'GB' }, cursor: null, size: 20 });
  });
});

describe('the results (1c, 1d)', () => {
  it('marks each found company: here as a link, kept by a colleague with no link, no sales contact and a sole trader with no tick box', async () => {
    await draw({ [`post ${DOOR}/search`]: () => searched() });
    await search();
    expect(screen.getByRole('heading', { name: '5 companies · 1 sole trader' })).toBeTruthy();

    const here = rowOf('Ouseburn Studio');
    expect(within(here).getByRole('link', { name: /^Already here\s*: open Ouseburn Studio in Companies$/ }).getAttribute('href')).toBe('/p/companies/r/17');
    expect((within(here).getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);

    const colleague = rowOf('Tannery Row Design');
    expect(within(colleague).getByText('Already here · kept by a colleague')).toBeTruthy();
    // No link, and nothing of the row it is: no key anywhere in the row.
    expect(within(colleague).queryByRole('link', { name: /Already here/ })).toBeNull();
    expect(colleague.innerHTML).not.toContain('/p/companies/r/');

    const flagged = rowOf('Calder Mill Works');
    expect(within(flagged).queryByRole('checkbox')).toBeNull();
    const chip = within(flagged).getByText('Asked not to be contacted for sales');
    fireEvent.focus(chip.closest('[tabindex]') as HTMLElement);
    expect(within(flagged).getByRole('tooltip').textContent).toBe('This business told the register it does not want sales contact. You can still fill in its details on a record you already have.');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(within(flagged).queryByRole('tooltip')).toBeNull();

    const sole = rowOf('Robin Ashby');
    expect(within(sole).queryByRole('checkbox')).toBeNull();
    expect(within(sole).getByText('Sole trader: a person')).toBeTruthy();
    expect(within(sole).getByText('Sole traders are people. Lead finder adds them only while it keeps people, and then tells them.')).toBeTruthy();
  });

  it('adds the ticked ones by what was found, with a retry key each, and says where they went and whose they are', async () => {
    const held: { asked: { companies: { ref: string; retryKey: string }[] } | null } = { asked: null };
    await draw({
      [`post ${DOOR}/search`]: () => searched(),
      [`post ${DOOR}/add`]: (body) => {
        const asked = body as { companies: { ref: string; retryKey: string }[] };
        held.asked = asked;
        return { table: 'crm:companies', added: 2, refused: 0, message: '2 added', results: asked.companies.map((one) => ({ ref: one.ref, outcome: 'added', key: `k-${one.ref}`, reason: null, message: null })) };
      },
    });
    await search();
    expect((screen.getAllByRole('button', { name: 'Add to Companies' })[0] as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Tick the ones to add')).toBeTruthy();
    fireEvent.click(within(rowOf('Kestrel Yard Architects')).getByRole('checkbox'));
    fireEvent.click(within(rowOf('Millbeck Drawing Office')).getByRole('checkbox'));
    expect(screen.getByText('2 ticked')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 to Companies' }));
    await settle();
    expect(held.asked!.companies.map((one) => one.ref)).toEqual(['gb-98000412', 'gb-98001537']);
    for (const one of held.asked!.companies) expect(one.retryKey).toMatch(/^[A-Za-z0-9_-]{22,64}$/);
    // Values found are never sent back: only what was found, by its ref.
    expect(JSON.stringify(held.asked)).not.toContain('Kestrel Yard Architects');
    expect(world.toasts.at(-1)?.title).toBe('2 companies added to Companies, owned by you.');
    expect(within(rowOf('Kestrel Yard Architects')).getByText('Added')).toBeTruthy();
  });

  it('says so when some were refused', async () => {
    await draw({
      [`post ${DOOR}/search`]: () => searched(),
      [`post ${DOOR}/add`]: () => ({ table: 'crm:companies', added: 0, refused: 1, message: '', results: [{ ref: 'gb-98000412', outcome: 'refused', key: null, reason: 'already-here', message: 'Already here.' }] }),
    });
    await search();
    fireEvent.click(within(rowOf('Kestrel Yard Architects')).getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 to Companies' }));
    await settle();
    expect(world.toasts.at(-1)).toMatchObject({ variant: 'error', title: '1 not added: Already here.' });
  });

  it('pages: "Show 20 more" asks for the next page and adds it below', async () => {
    const asked: unknown[] = [];
    await draw({
      [`post ${DOOR}/search`]: (body) => {
        asked.push(body);
        return asked.length === 1 ? searched({ companies: FOUND.slice(0, 2), next: 'page-2', total: 64 }) : searched({ companies: FOUND.slice(2, 3), next: null, total: 64 });
      },
    });
    await search();
    expect(screen.getByRole('heading', { name: 'Showing 2 of 64' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show 20 more' }));
    await settle();
    expect((asked[1] as { cursor: string }).cursor).toBe('page-2');
    expect(screen.getByRole('heading', { name: 'Showing 3 of 64' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show 20 more' })).toBeNull();
  });
});

describe('a search’s other states (1e)', () => {
  it('shows skeletons while searching', async () => {
    await draw({ [`post ${DOOR}/search`]: () => pending() });
    await search();
    expect(screen.getAllByText('Searching Companies House…').length).toBeGreaterThan(0);
  });

  it('says when nothing was found', async () => {
    await draw({ [`post ${DOOR}/search`]: () => searched({ companies: [] }) });
    await search();
    expect(screen.getByText('No companies found. Try a wider place.')).toBeTruthy();
  });

  it('says a refused key, today’s limit with its number, and a source that did not answer with Try again', async () => {
    let refusal = new Refused('KEY_REFUSED', 'refused', { source: 'companies-house' });
    let tries = 0;
    await draw({
      [`post ${DOOR}/search`]: () => {
        tries += 1;
        throw refusal;
      },
    }, KIT_REPLY, sourceList({ 'companies-house': { dailyCap: 100, paid: true } }));
    await search();
    expect(screen.getByText('Companies House refused its key. Check it in Sources.')).toBeTruthy();

    refusal = new Refused('DAILY_CAP', 'Companies House: 100 of 100 today', { source: 'companies-house' }, 429);
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await settle();
    expect(screen.getByText('Companies House: today’s limit of 100 look-ups is reached. Search again tomorrow, or raise the limit in Sources.')).toBeTruthy();

    refusal = new Refused('UNAVAILABLE', 'down', { source: 'companies-house' }, 502);
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await settle();
    expect(screen.getByText('Companies House didn’t answer. Try again in a minute.')).toBeTruthy();
    const before = tries;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await settle();
    expect(tries).toBe(before + 1);
  });
});
