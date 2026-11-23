// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Refused, resetWorld, seed, world } from '../testing/host.tsx';
import { KIT, KIT_REPLY, answer } from '../testing/fixtures.ts';
import { PeopleFound } from './PeopleFound.tsx';

/** The app's rows, as this reader may read them: a key missing here is a row they may not read (403). */
const CONTACTS: Record<string, Record<string, unknown>> = {
  '41': { id: 41, name: 'Robin Hale', job_title: 'Director', email: 'robin@kestrelyard.example' },
  '42': { id: 42, name: 'Sam Ellery', job_title: 'Architect', email: 'sam@kestrelyard.example' },
  '43': { id: 43, name: 'Jo Ashby', job_title: 'Director', email: 'jo@millbeck.example' },
  '44': { id: 44, name: 'Kari Vik', job_title: 'Daglig leder', email: 'kari@fjordlys.example' },
};
const COMPANIES: Record<string, Record<string, unknown>> = { '7': { id: 7, name: 'Kestrel Yard Architects' }, '9': { id: 9, name: 'Fjordlys Arkitekter AS' } };
const CONSENT: Record<string, { state: string; event: { how: string; at: number } | null }[]> = {
  '44': [
    { state: 'yes', event: { how: 'phone', at: Date.parse('2026-10-27T10:00:00Z') } },
    { state: 'not-asked', event: null },
  ],
};

const found = (id: number, person: string, company: string | null, more: Record<string, unknown>) => ({
  id,
  person_table: 'crm:contacts',
  person_key: person,
  company_table: company === null ? null : 'crm:companies',
  company_key: company,
  source: 'hunter',
  found_at: '2026-11-01T09:00:00Z',
  purpose: 'To offer your company office fit-outs and furniture.',
  tell_by: '2026-11-30',
  told_at: null,
  state: 'waiting',
  email: `${person}@kestrelyard.example`,
  ...more,
});

async function draw(rows: Record<string, unknown>[], mails: Record<string, unknown>[] = [], hidden: string[] = []): Promise<void> {
  seed('found_people', rows as never);
  seed('tell_mails', mails as never);
  answer({
    [KIT]: () => KIT_REPLY,
    '/api/v1/bootstrap': () => ({ data: { nav: { groups: [{ key: 'workspace', items: [{ slug: 'contacts', sourceTable: 'contacts', appKey: 'crm', connectionId: 'conn-1' }] }] } } }),
    '/api/v1/consent/panel': (body) => {
      const key = (body as { recordId: string }).recordId;
      return { data: { declared: true, columns: { name: 'name', address: 'email' }, purposes: CONSENT[key] ?? [{ state: 'not-asked', event: null }] } };
    },
  });
  const plain = world.api!;
  world.api = (method, path, payload) => {
    const contact = /^\/api\/v1\/data\/conn-1\/contacts\/(\d+)$/.exec(path);
    if (contact !== null) {
      if (hidden.includes(contact[1]!) || CONTACTS[contact[1]!] === undefined) throw new Refused('FORBIDDEN', 'no', {}, 403);
      return { data: CONTACTS[contact[1]!] };
    }
    const company = /^\/api\/v1\/data\/conn-1\/companies\/(\d+)$/.exec(path);
    if (company !== null) {
      if (company[1] === '8') throw new Refused('NOT_FOUND', 'no', {}, 404);
      return { data: COMPANIES[company[1]!] };
    }
    return plain(method, path, payload);
  };
  const { wordsFor } = await import('../shared/messages.ts');
  const strings = await import('../strings/index.ts');
  render(<PeopleFound t={wordsFor(strings.SHARED, strings.SOURCE, strings.DOOR, strings.PEOPLE)} />);
  for (let turn = 0; turn < 6; turn += 1) await act(async () => undefined);
}

const table = (): HTMLElement => screen.getByRole('table');
const rowOf = (name: string): HTMLElement => within(table()).getByText(name).closest('tr') as HTMLElement;

beforeEach(() => {
  resetWorld();
  world.now = Date.parse('2026-11-19T10:00:00Z');
  // The screen reads the real clock, so hold it to the day the fixtures' deadlines are written for.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(world.now);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('People found (3f)', () => {
  it('lists only the people this reader may read, with role · company, and links each to their record', async () => {
    await draw([found(1, '41', '7', { state: 'told', told_at: '2026-11-02T09:00:00Z' }), found(2, '42', '7', {}), found(3, '99', '7', {})], [], ['99']);
    expect(screen.getByRole('heading', { name: 'People found 2' })).toBeTruthy();
    expect(within(table()).queryByText('99@kestrelyard.example')).toBeNull();
    const robin = rowOf('Robin Hale');
    expect(within(robin).getByRole('link', { name: 'Robin Hale' }).getAttribute('href')).toBe('/p/contacts/r/41');
    expect(within(robin).getByText('Director', { exact: false })).toBeTruthy();
    expect(within(robin).getByRole('link', { name: 'Kestrel Yard Architects' }).getAttribute('href')).toBe('/p/companies/r/7');
    expect(within(robin).getByText('41@kestrelyard.example')).toBeTruthy();
  });

  it('shows a company the reader may not open as kept by a colleague, with no link and no name', async () => {
    await draw([found(1, '41', '8', {})]);
    const robin = rowOf('Robin Hale');
    expect(within(robin).getByText('a company kept by a colleague', { exact: false })).toBeTruthy();
    expect(within(robin).queryByRole('link', { name: /Kestrel|Millbeck/ })).toBeNull();
  });

  it('reads "May be e-mailed" from the record’s consent: yes with how and when, else No', async () => {
    await draw([found(1, '44', '9', { state: 'told', told_at: '2026-10-26T09:00:00Z' }), found(2, '42', '7', {})]);
    expect(within(rowOf('Kari Vik')).getByText('Yes · by phone, Oct 27')).toBeTruthy();
    expect(within(rowOf('Sam Ellery')).getByText('No')).toBeTruthy();
  });

  it('says where telling them stands: told, sending, tell by (near and far), and couldn’t tell with Send again and the deadline', async () => {
    await draw(
      [
        found(1, '41', '7', { state: 'told', told_at: '2026-11-02T09:00:00Z' }),
        found(2, '42', '7', { state: 'waiting' }),
        found(3, '43', '7', { state: 'failed', tell_by: '2026-11-21' }),
        found(4, '44', '9', { state: 'waiting', tell_by: '2026-11-22' }),
      ],
      [
        { id: 11, found_person_id: 2, status: 'queued', error: null },
        { id: 12, found_person_id: 3, status: 'failed', error: 'the address bounced' },
      ],
    );
    expect(within(rowOf('Robin Hale')).getByText('Told on Nov 2')).toBeTruthy();
    expect(within(rowOf('Sam Ellery')).getByText('Sending…')).toBeTruthy();
    expect(within(rowOf('Kari Vik')).getByText('Tell by Nov 22')).toBeTruthy();
    const jo = rowOf('Jo Ashby');
    expect(within(jo).getByText('Couldn’t tell: the address bounced')).toBeTruthy();
    expect(within(jo).getByText('If it can’t go by Nov 21, 2026, Lead finder deletes Jo.')).toBeTruthy();
    fireEvent.click(within(jo).getByRole('button', { name: 'Send again' }));
    await act(async () => undefined);
    expect(world.calls.find((call) => call.kind === 'update' && call.table === 'tell_mails')).toMatchObject({ key: '12', values: { status: 'queued' } });
  });

  it('offers no Send again to a reader who may not queue a mail', async () => {
    world.cannot.add('update:tell_mails');
    await draw([found(3, '43', '7', { state: 'failed' })], [{ id: 12, found_person_id: 3, status: 'failed', error: null }]);
    expect(within(rowOf('Jo Ashby')).queryByRole('button', { name: 'Send again' })).toBeNull();
  });

  it('filters by the chips, and says when nobody is in a view', async () => {
    await draw([found(1, '41', '7', { state: 'told', told_at: '2026-11-02T09:00:00Z' }), found(2, '42', '7', {})]);
    fireEvent.click(screen.getByRole('button', { name: 'Told' }));
    expect(within(table()).queryByText('Sam Ellery')).toBeNull();
    expect(within(table()).getByText('Robin Hale')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Couldn’t tell' }));
    expect(screen.getByText('Nobody in this view.')).toBeTruthy();
  });

  it('counts those who objected, and lists none of them', async () => {
    await draw([found(1, '41', '7', { state: 'objected' }), found(2, '42', '7', {})]);
    expect(screen.getByText('1 person objected and their details were deleted.')).toBeTruthy();
    expect(within(table()).queryByText('Robin Hale')).toBeNull();
  });

  it('has an empty state (3f-2)', async () => {
    await draw([]);
    expect(screen.getByText('No people yet. Find people from a company’s Fill in details.')).toBeTruthy();
  });
});
