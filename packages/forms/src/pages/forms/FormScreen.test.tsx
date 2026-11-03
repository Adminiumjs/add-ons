// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TabProps } from '../shared/slot.ts';
import { formRow, summary } from '../testing/rows.ts';
import { resetWorld, seed, world } from '../testing/host.tsx';

/** Each tab's body, standing in for the screen of its own folder: it shows what the frame handed it. */
const stand =
  (name: string) =>
  ({ form, answer, settings, summary: counted }: TabProps): ReactNode => (
    <div data-tab={name} data-form={form.slug} data-answer={answer ?? ''} data-settings={settings ?? ''} data-total={String(counted?.total ?? '')} />
  );
vi.mock('../builder/Questions.tsx', () => ({ Questions: stand('questions') }));
vi.mock('../share/Share.tsx', () => ({ Share: stand('share') }));
vi.mock('../answers/Answers.tsx', () => ({ Answers: stand('answers') }));
vi.mock('../surveys/Results.tsx', () => ({ Results: stand('results') }));
vi.mock('../surveys/Invitations.tsx', () => ({ Invitations: stand('invitations') }));

const { default: Forms } = await import('./index.tsx');
const shown = (): HTMLElement => document.querySelector('[data-tab]') as HTMLElement;

beforeEach(() => {
  resetWorld();
  seed('forms', [
    formRow(1, { slug: 'showroom-visit', title: 'Book a showroom visit', languages: ['en-US', 'de-DE'], questions: 9 }),
    formRow(2, { slug: 'fit-out', kind: 'survey', title: 'How did your fit-out go?', questions: 4 }),
    formRow(3, { slug: 'trade-show', state: 'draft', title: 'Trade show enquiry' }),
  ]);
  world.summaries = { '1': summary(214), '2': summary(23, { invited: 41, answered: 23 }) };
});
afterEach(() => cleanup());

describe('a form’s screens', () => {
  it('draw the header: the name, its status, the way back and the builder’s buttons', () => {
    world.splat = 'forms/showroom-visit';
    render(<Forms />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Book a showroom visit');
    expect(screen.getByText('Live')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close form' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Preview' })).toBeTruthy();
    expect(screen.getByText('All changes saved')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Language variations' }).textContent).toContain('English');
    expect(screen.getByRole('button', { name: 'Language variations' }).textContent).toContain('2');
  });

  it('draw a form’s three tabs, with its questions and its answers counted', () => {
    world.splat = 'forms/showroom-visit';
    render(<Forms />);
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Questions9', 'Share', 'Answers214']);
    expect(shown().dataset['tab']).toBe('questions');
    expect(shown().dataset['total']).toBe('214');
  });

  it('open the tab the address names, with the answer a staff link names', () => {
    world.splat = 'forms/showroom-visit/answers';
    world.search = { answer: '42' };
    render(<Forms />);
    expect(screen.getByRole('tab', { name: /Answers/ }).getAttribute('aria-selected')).toBe('true');
    expect(shown().dataset).toMatchObject({ tab: 'answers', form: 'showroom-visit', answer: '42' });
  });

  it('open a form’s settings section a staff link names', () => {
    world.splat = 'forms/showroom-visit';
    world.search = { settings: 'limits' };
    render(<Forms />);
    expect(shown().dataset).toMatchObject({ tab: 'questions', settings: 'limits' });
  });

  it('move between the tabs by address', () => {
    world.splat = 'forms/showroom-visit';
    render(<Forms />);
    fireEvent.click(screen.getByRole('tab', { name: /Share/ }));
    expect(world.navigated.at(-1)).toEqual({ to: '/add-ons/forms/forms/showroom-visit/share' });
  });

  it('count nothing for a draft, and offer to publish it', () => {
    world.splat = 'forms/trade-show';
    render(<Forms />);
    expect(screen.getByText('Draft')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeTruthy();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Questions2', 'Share', 'Answers0']);
    expect(world.calls.some((call) => call.kind === 'summary')).toBe(false);
  });
});

describe('a survey’s screens', () => {
  it('draw a survey’s four tabs, with its results and its invitations counted, and its preview', () => {
    world.splat = 'forms/surveys/fit-out';
    render(<Forms />);
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Questions4', 'Share', 'Results23', 'Invitations41']);
    expect(screen.getByRole('button', { name: 'Close survey' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Preview' })).toBeTruthy();
  });

  it('open from the address Adminium’s survey links name, on the result they name', () => {
    world.splat = 'forms/surveys/fit-out/results';
    world.search = { answer: '7' };
    render(<Forms />);
    expect(shown().dataset).toMatchObject({ tab: 'results', form: 'fit-out', answer: '7' });
  });

  it('open on the invitations', () => {
    world.splat = 'forms/surveys/fit-out/invitations';
    render(<Forms />);
    expect(shown().dataset['tab']).toBe('invitations');
    fireEvent.click(screen.getByRole('tab', { name: /Results/ }));
    expect(world.navigated.at(-1)).toEqual({ to: '/add-ons/forms/forms/surveys/fit-out/results' });
  });

  it('open a row as what it is when a link names it as the other', () => {
    world.splat = 'forms/fit-out';
    render(<Forms />);
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Questions4', 'Share', 'Results23', 'Invitations41']);
  });
});

describe('an address that names nothing', () => {
  it('says the form is not here, with the way back', () => {
    world.splat = 'forms/no-such-form/answers';
    render(<Forms />);
    expect(screen.getByText('This form is not here')).toBeTruthy();
    expect(within(screen.getByText('This form is not here').closest('[data-part="empty"]') as HTMLElement).getByRole('link', { name: 'Back to forms' }).getAttribute('href')).toBe('/add-ons/forms/forms');
  });

  it('says the survey is not here', () => {
    world.splat = 'forms/surveys/gone/results';
    render(<Forms />);
    expect(screen.getByText('This survey is not here')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to surveys' }).getAttribute('href')).toBe('/add-ons/forms/forms/surveys');
  });

  it('says so for a path no screen has', () => {
    world.splat = 'forms/showroom-visit/results';
    render(<Forms />);
    expect(screen.getByText('This form is not here')).toBeTruthy();
  });
});
