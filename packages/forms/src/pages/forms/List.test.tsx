// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formRow, summary } from '../testing/rows.ts';
import { Refused, resetWorld, seed, world } from '../testing/host.tsx';
import Forms from './index.tsx';

const card = (name: string): HTMLElement => screen.getByText(name).closest('[data-part="card"]') as HTMLElement;
const summaryCalls = (): string[] => world.calls.filter((call) => call.kind === 'summary').map((call) => call.key ?? '');

beforeEach(() => {
  resetWorld();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-03T12:00:00Z'));
  world.splat = '';
  seed('forms', [
    formRow(1, { slug: 'showroom-visit', title: 'Book a showroom visit', languages: ['en-US', 'de-DE'], updated: '2026-11-03T10:00:00.000Z' }),
    formRow(2, { slug: 'newsletter', title: 'Newsletter sign-up', asObjects: true, updated: '2026-10-31T12:00:00.000Z' }),
    formRow(3, { slug: 'trade-show', title: 'Trade show enquiry', state: 'draft', updated: '2026-11-02T12:00:00.000Z' }),
    formRow(4, { slug: 'fit-out', kind: 'survey', title: 'How did your fit-out go?', languages: ['en-US', 'de-DE'], settings: { survey: { mode: 'named', linkNames: true } } }),
    formRow(5, { slug: 'visit-feedback', kind: 'survey', state: 'closed', title: 'Showroom visit feedback', closed: '2026-06-30T09:00:00.000Z' }),
    formRow(6, { slug: 'quick', kind: 'survey', title: 'Quick feedback', settings: { survey: { mode: 'anonymous', linkNames: false } } }),
  ]);
  world.summaries = { '1': summary(214), '2': summary(96), '4': summary(23, { invited: 41, answered: 23, recommendScore: 39 }), '5': summary(31, { invited: 40, recommendScore: 12 }), '6': summary(8, { invited: 0, recommendScore: -5 }) };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('the list of forms', () => {
  it('draws a card a form: its status, its answers counted by Adminium, its languages and when it changed', () => {
    render(<Forms />);
    expect(screen.getByRole('tab', { name: /Forms\s*3/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: /Surveys\s*3/ })).toBeTruthy();
    const showroom = card('Book a showroom visit');
    expect(within(showroom).getByText('Live')).toBeTruthy();
    expect(within(showroom).getByText('214 answers')).toBeTruthy();
    expect(within(showroom).getByText('EN')).toBeTruthy();
    expect(within(showroom).getByText('DE')).toBeTruthy();
    expect(within(showroom).getByText('Updated 2 hours ago')).toBeTruthy();
    expect(within(showroom).getByRole('link', { name: 'Book a showroom visit' }).getAttribute('href')).toBe('/add-ons/forms/forms/showroom-visit');
    // A JSON column handed back as an object reads the same as one handed back as text.
    expect(within(card('Newsletter sign-up')).getByText('96 answers')).toBeTruthy();
    expect(within(card('Trade show enquiry')).getByText('Draft')).toBeTruthy();
    expect(within(card('Trade show enquiry')).getByText('0 answers')).toBeTruthy();
    // No survey is on the forms tab.
    expect(screen.queryByText('How did your fit-out go?')).toBeNull();
  });

  it('asks Adminium for one count a card, and none for a draft, which has never taken an answer', async () => {
    render(<Forms />);
    await waitFor(() => expect(summaryCalls().sort()).toEqual(['1', '2']));
  });

  it('draws a survey’s figures: invited and its recommend score, or the day it closed', () => {
    world.splat = 'forms/surveys';
    render(<Forms />);
    expect(screen.getByRole('tab', { name: /Surveys\s*3/ }).getAttribute('aria-selected')).toBe('true');
    expect(within(card('How did your fit-out go?')).getByText('41 invited · recommend score +39')).toBeTruthy();
    expect(within(card('How did your fit-out go?')).getByText('23 answers')).toBeTruthy();
    const closed = card('Showroom visit feedback');
    expect(within(closed).getByText('Closed')).toBeTruthy();
    expect(within(closed).getByText('Closed Jun 30')).toBeTruthy();
    // An anonymous survey invites nobody by name: only its score.
    expect(within(card('Quick feedback')).getByText('recommend score -5')).toBeTruthy();
    expect(within(card('Quick feedback')).queryByText(/invited/)).toBeNull();
    expect(within(card('How did your fit-out go?')).getByRole('link').getAttribute('href')).toBe('/add-ons/forms/forms/surveys/fit-out');
  });

  it('says a count still on its way as such, never as nothing', () => {
    world.summaries = {};
    render(<Forms />);
    expect(within(card('Book a showroom visit')).getByText('…')).toBeTruthy();
  });

  it('draws the same forms as a list, with the comp’s columns', () => {
    render(<Forms />);
    fireEvent.click(screen.getByRole('radio', { name: 'List' }));
    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Name', 'Status', 'Answers', 'Languages', 'Updated', 'Actions']);
    const row = screen.getByText('Book a showroom visit').closest('tr') as HTMLElement;
    expect(within(row).getByText('Live')).toBeTruthy();
    expect(within(row).getByText('214')).toBeTruthy();
    expect(within(row).getByText('Updated 2 hours ago')).toBeTruthy();
    expect(within(screen.getByText('Trade show enquiry').closest('tr') as HTMLElement).getByRole('button', { name: 'Delete draft' })).toBeTruthy();
  });

  it('moves between the forms and the surveys by address', () => {
    render(<Forms />);
    fireEvent.click(screen.getByRole('tab', { name: /Surveys/ }));
    expect(world.navigated.at(-1)).toEqual({ to: '/add-ons/forms/forms/surveys' });
  });

  it('says there are no forms yet, and offers to make one', () => {
    seed('forms', []);
    render(<Forms />);
    expect(screen.getByText('No forms yet')).toBeTruthy();
    expect(screen.getByText('Make a form your website visitors can fill in. Each answer can become a row in one of your tables.')).toBeTruthy();
    expect(within(screen.getByText('No forms yet').closest('[data-part="empty"]') as HTMLElement).getByRole('button', { name: 'New form' })).toBeTruthy();
    // With nothing to show, there is no view to switch.
    expect(screen.queryByRole('radio', { name: 'Cards' })).toBeNull();
  });

  it('says there are no surveys yet, in a survey’s words', () => {
    seed('forms', [formRow(1, { slug: 'a', title: 'A form' })]);
    world.splat = 'forms/surveys';
    render(<Forms />);
    expect(screen.getByText('No surveys yet')).toBeTruthy();
    expect(within(screen.getByText('No surveys yet').closest('[data-part="empty"]') as HTMLElement).getByRole('button', { name: 'New survey' })).toBeTruthy();
  });
});

describe('a new form', () => {
  it('is a draft in the reader’s language, with a link name of its own, opened at once', async () => {
    world.locale = 'de-DE';
    render(<Forms />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Neues Formular' })[0]!);
    await waitFor(() => expect(world.navigated.length).toBe(1));
    const made = world.calls.find((call) => call.kind === 'create')!;
    expect(made.table).toBe('forms');
    const values = made.values as Record<string, unknown>;
    expect(values).toMatchObject({ kind: 'form', state: 'draft', name: 'Formular ohne Titel' });
    // Its own key: nothing on the server fills a text key on a staff create.
    expect(values['id']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(values['slug']).toMatch(/^form-[a-z2-9]{6}$/);
    expect(values['definition']).toEqual({ v: 1, kind: 'form', languages: ['de-DE'], defaultLanguage: 'de-DE', title: { 'de-DE': 'Formular ohne Titel' }, questions: [], ending: { kind: 'words', words: { 'de-DE': 'Vielen Dank. Wir haben Ihre Antworten erhalten.' } } });
    expect(values['settings']).toEqual({ becomes: null, tell: [], limits: { perHour: 200, harder: false } });
    expect(world.navigated[0]).toEqual({ to: `/add-ons/forms/forms/${String(values['slug'])}` });
  });

  it('is a named survey on the surveys tab, written in English for a reader in a language forms do not speak', async () => {
    world.locale = 'ja-JP';
    world.splat = 'forms/surveys';
    render(<Forms />);
    fireEvent.click(screen.getAllByRole('button', { name: 'New survey' })[0]!);
    await waitFor(() => expect(world.navigated.length).toBe(1));
    const values = world.calls.find((call) => call.kind === 'create')!.values as Record<string, unknown>;
    expect(values['slug']).toMatch(/^survey-/);
    expect((values['definition'] as { languages: string[] }).languages).toEqual(['en-US']);
    expect(values['settings']).toMatchObject({ survey: { mode: 'named', linkNames: true, stopAfterDays: 30 } });
    expect(world.navigated[0]?.to).toMatch(/^\/add-ons\/forms\/forms\/surveys\/survey-/);
  });

  it('tries one more link name when the first is taken, and says so when that fails too', async () => {
    let tries = 0;
    world.before = (kind) => {
      if (kind !== 'create') return;
      tries += 1;
      throw new Refused('UNIQUE_VIOLATION', '', { column: 'slug' });
    };
    render(<Forms />);
    fireEvent.click(screen.getAllByRole('button', { name: 'New form' })[0]!);
    await waitFor(() => expect(world.toasts.length).toBe(1));
    expect(tries).toBe(2);
    expect(world.toasts[0]).toMatchObject({ variant: 'error', title: 'Another form already uses that link name.' });
    expect(world.navigated).toEqual([]);
  });
});

describe('deleting a draft', () => {
  it('is offered on a draft only, asks first, and deletes it', async () => {
    render(<Forms />);
    expect(within(card('Book a showroom visit')).queryByRole('button', { name: 'Delete draft' })).toBeNull();
    fireEvent.click(within(card('Trade show enquiry')).getByRole('button', { name: 'Delete draft' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Delete this draft?')).toBeTruthy();
    expect(within(dialog).getByText('“Trade show enquiry” and its questions are deleted. This can’t be undone.')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(world.calls.some((call) => call.kind === 'remove' && call.key === '3')).toBe(true));
    expect(world.toasts.at(-1)).toMatchObject({ title: 'Draft deleted.' });
    expect(screen.queryByText('Trade show enquiry')).toBeNull();
  });

  it('keeps the draft when the person cancels', () => {
    render(<Forms />);
    fireEvent.click(within(card('Trade show enquiry')).getByRole('button', { name: 'Delete draft' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(world.calls.some((call) => call.kind === 'remove')).toBe(false);
  });
});

describe('as the reader', () => {
  it('shows the forms, and no way to make or delete one', () => {
    world.cannot.add('create:forms');
    render(<Forms />);
    expect(screen.getByText('Book a showroom visit')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New form' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete draft' })).toBeNull();
  });

  it('is refused the screen without the forms to read', () => {
    world.closed.add('forms');
    render(<Forms />);
    expect(screen.getByText('You do not have permission to open this')).toBeTruthy();
    expect(screen.queryByText('Book a showroom visit')).toBeNull();
  });
});

describe('right to left', () => {
  it('reads in Arabic inside a right-to-left page, and sets no direction of its own', () => {
    world.locale = 'ar-EG';
    const { container } = render(
      <div dir="rtl">
        <Forms />
      </div>,
    );
    expect(screen.getByRole('tab', { name: /النماذج/ })).toBeTruthy();
    expect(within(card('Book a showroom visit')).getByText('منشور')).toBeTruthy();
    expect(container.querySelectorAll('[dir]').length).toBe(1);
    // A form's name is isolated, so a name in another script keeps its own order.
    expect(within(card('Book a showroom visit')).getByText('Book a showroom visit').tagName).toBe('BDI');
  });
});
