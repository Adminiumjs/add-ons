// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { formRowOf } from '../shared/row.ts';
import { format, resetWorld, seed, world } from '../testing/host.tsx';
import { summary } from '../testing/rows.ts';
import { Invitations } from './Invitations.tsx';

const t = (_key: string, fallback: string, args?: Record<string, unknown>): string => format(fallback, args);

const named = { becomes: null, tell: [], limits: { perHour: 200, harder: false }, survey: { mode: 'named', linkNames: true, stopAfterDays: 30 } };
const open = { ...named, survey: { mode: 'anonymous', linkNames: false, stopAfterDays: 30 } };

function surveyRow(settings: unknown, state: 'live' | 'draft' = 'live') {
  const definition = { v: 1, kind: 'survey', languages: ['en-US'], defaultLanguage: 'en-US', title: { 'en-US': 'How did your fit-out go?' }, questions: [], ending: { kind: 'words', words: { 'en-US': 'Thanks' } } };
  return { id: 7, name: 'How did your fit-out go?', slug: 'fit-out', kind: 'survey', state, definition: JSON.stringify(definition), settings: JSON.stringify(settings), published: state === 'live' ? JSON.stringify({ definition, settings }) : null, published_at: null, updated_at: '2026-07-01T09:00:00.000Z', closed_at: null };
}

/** The comp's seven invitations (comp 1277-1280), newest first once sorted. */
const PEOPLE: [string, string, string, string][] = [
  ['Marta Kovac', 'Cobalt Legal', '2026-07-14', '2026-07-14'],
  ['Ruth Adeyemi', 'Fernway Clinics', '2026-07-21', '2026-07-22'],
  ['Ines Vaughan', 'Juno Analytics', '2026-07-20', '2026-07-20'],
  ['Tomas Reidy', 'Nordwind Logistics', '2026-07-16', '2026-07-17'],
  ['Owen Marsh', 'Harbor & Finch', '2026-07-23', ''],
  ['Ailsa Grant', 'Veldt Studios', '2026-07-08', '2026-07-09'],
  ['Jonas Keller', 'Tandem Robotics', '2026-07-27', ''],
];

function seedInvitations(more: { rule?: (i: number) => string; kind?: (i: number) => string } = {}): void {
  seed('invitations', [
    ...PEOPLE.map(([name, company, invited, answered], i) => ({
      id: 100 + i,
      form_id: 7,
      name,
      email: `${name.split(' ')[0]!.toLowerCase()}@example.test`,
      company,
      invited_at: `${invited}T09:00:00.000Z`,
      answered_at: answered === '' ? null : `${answered}T09:00:00.000Z`,
      class: more.kind?.(i) ?? 'marketing',
      rule_name: more.rule?.(i) ?? 'Ask about the fit-out',
    })),
    { id: 900, form_id: 8, name: 'Someone Else', company: 'Elsewhere', invited_at: '2026-07-30T09:00:00.000Z', answered_at: null, class: 'service', rule_name: 'Another rule' },
  ]);
}

function show(settings: unknown, state: 'live' | 'draft' = 'live') {
  const form = formRowOf(surveyRow(settings, state));
  return render(<Invitations t={t} form={form} refetch={() => undefined} summary={null} answer={null} settings={null} />);
}

const counts = (): string[] => [...document.querySelectorAll('[data-part="invitations-count"]')].map((card) => card.textContent ?? '');
const sentBy = async (): Promise<string> => {
  await waitFor(() => expect(document.querySelector('[data-part="sent-by"]')).not.toBeNull());
  return (document.querySelector('[data-part="sent-by"]') as HTMLElement).textContent ?? '';
};

beforeEach(() => {
  resetWorld();
  world.summaries = { '7': summary(23, { invited: 41, answered: 23 }) };
  seedInvitations();
});
afterEach(() => cleanup());

describe('a survey’s invitations', () => {
  it('count the invited, the answered and those still waiting, as Adminium counts them', () => {
    show(named);
    expect(counts()).toEqual(['Invited41', 'Answered23', 'Waiting18']);
  });

  it('say which rule sent the survey, as which kind of mail, with the way to the rules', async () => {
    show(named);
    expect(await sentBy()).toBe('Invited 41 · Answered 23 · Waiting 18. Sent by the rule Ask about the fit-out as marketing mail.');
    expect(screen.getByRole('link', { name: 'Ask about the fit-out' }).getAttribute('href')).toBe('/automations');
  });

  it('count the rules when more than one sent it, and name both kinds of mail', async () => {
    seedInvitations({ rule: (i) => (i % 2 === 0 ? 'Ask about the fit-out' : 'Ask after a repair'), kind: (i) => (i === 3 ? 'service' : 'marketing') });
    show(named);
    expect(await sentBy()).toBe('Invited 41 · Answered 23 · Waiting 18. Sent by 2 rules as marketing and service mail. See the rules');
    expect(screen.getByRole('link', { name: 'See the rules' }).getAttribute('href')).toBe('/automations');
  });

  it('list each person: name, company, when invited, when answered or "Not yet", and the kind of mail, newest first', () => {
    show(named);
    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Name', 'Company', 'Invited', 'Answered', 'Kind of mail']);
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('cell')[0]?.textContent)).toEqual(['Jonas Keller', 'Owen Marsh', 'Ruth Adeyemi', 'Ines Vaughan', 'Tomas Reidy', 'Marta Kovac', 'Ailsa Grant']);
    expect(within(rows[0]!).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Jonas Keller', 'Tandem Robotics', 'Jul 27, 2026', 'Not yet', 'Marketing mail']);
    expect(within(rows[2]!).getAllByRole('cell')[3]?.textContent).toBe('Jul 22, 2026');
    expect(document.querySelector('[data-part="invitations-showing"]')?.textContent).toContain('Showing 7 of 41');
    // 41 invited, 25 a page: a second page is offered.
    expect(screen.getByRole('navigation', { name: 'Pages of invitations' })).toBeTruthy();
    // Another survey's invitation is not this one's.
    expect(document.body.textContent).not.toContain('Someone Else');
  });

  it('write nothing: invitations are a rule’s to make', async () => {
    show(named);
    await sentBy();
    expect(world.calls.filter((call) => ['create', 'update', 'remove', 'updateEach', 'createEach', 'tree', 'move'].includes(call.kind))).toEqual([]);
  });

  it('leave out names and companies a reader may not read, and never ask for them', () => {
    world.unreadable = { invitations: ['name', 'company', 'email'] };
    show(named);
    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Invited', 'Answered', 'Kind of mail']);
    expect(document.body.textContent).not.toContain('Jonas Keller');
    expect(screen.getAllByRole('row')).toHaveLength(8);
  });

  it('show an open-link survey’s invitations with no Answered, and only the invited counted', async () => {
    world.summaries = { '7': summary(23, { invited: 7, answered: 0 }) };
    show(open);
    expect(counts()).toEqual(['Invited7']);
    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Name', 'Company', 'Invited', 'Kind of mail']);
    expect(document.body.textContent).not.toContain('Not yet');
    expect(await sentBy()).toBe('Invited 7. Sent by the rule Ask about the fit-out as marketing mail.');
  });

  it('say how invitations come when there are none, and ask for nothing on a draft', () => {
    seed('invitations', []);
    world.summaries = { '7': summary(0, { invited: 0, answered: 0 }) };
    show(named);
    expect(screen.getByText('Nobody invited yet')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'See the rules' }).getAttribute('href')).toBe('/automations');
    cleanup();
    world.calls = [];
    show(named, 'draft');
    expect(screen.getByText('No invitations yet')).toBeTruthy();
    expect(world.calls.filter((call) => call.kind === 'summary')).toEqual([]);
  });
});
