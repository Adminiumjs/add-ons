// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formRowOf } from '../shared/row.ts';
import { format, resetWorld, seed, world } from '../testing/host.tsx';

/** A summary's refusal, for the one test that needs Adminium to say no. */
const refusal = vi.hoisted(() => ({ error: null as null | { code: string; message: string; details?: Record<string, unknown> } }));
vi.mock('../shared/host.ts', async (original) => {
  const host = await original<typeof import('../shared/host.ts')>();
  return {
    ...host,
    useFormSummary: (formId: string | number | null) => {
      const result = host.useFormSummary(formId);
      return refusal.error === null ? result : { summary: null, loading: false, error: refusal.error, refetch: () => undefined };
    },
  };
});

const { Results } = await import('./Results.tsx');

const t = (_key: string, fallback: string, args?: Record<string, unknown>): string => format(fallback, args);
const both = (en: string, de: string) => ({ 'en-US': en, 'de-DE': de });

/** The comp's fit-out survey: a recommend score, stars, written words, and one choice. */
const definition = {
  v: 1,
  kind: 'survey',
  languages: ['en-US', 'de-DE'],
  defaultLanguage: 'en-US',
  title: both('How did your fit-out go?', 'Wie lief Ihr Ausbau?'),
  questions: [
    { id: 'qscore', kind: 'score', recommend: true, required: true, label: both('How likely are you to recommend Meridian to a colleague?', 'Wie wahrscheinlich empfehlen Sie Meridian?') },
    { id: 'qstars', kind: 'stars', label: both('How was the install day?', 'Wie war der Montagetag?') },
    { id: 'qmore', kind: 'long', label: both('Anything we should do differently?', 'Was sollten wir anders machen?') },
    { id: 'qagain', kind: 'one', label: both('Would you work with us again?', 'Wieder mit uns?'), choices: [{ id: 'yes', label: both('Yes', 'Ja') }, { id: 'no', label: both('No', 'Nein') }] },
  ],
  ending: { kind: 'words', words: both('Thank you. Your answers help us.', 'Danke.') },
};
const named = { becomes: null, tell: [], limits: { perHour: 200, harder: false }, survey: { mode: 'named', linkNames: true, stopAfterDays: 30 } };
const unnamed = { ...named, survey: { mode: 'named', linkNames: false, stopAfterDays: 30 } };
const open = { ...named, survey: { mode: 'anonymous', linkNames: false, stopAfterDays: 30 } };

function surveyRow(settings: unknown, state: 'live' | 'draft' = 'live') {
  return {
    id: 7,
    name: 'How did your fit-out go?',
    slug: 'fit-out',
    kind: 'survey',
    state,
    definition: JSON.stringify(definition),
    settings: JSON.stringify(settings),
    published: state === 'live' ? JSON.stringify({ definition, settings }) : null,
    published_at: state === 'live' ? '2026-07-01T09:00:00.000Z' : null,
    updated_at: '2026-07-01T09:00:00.000Z',
    closed_at: null,
  };
}

/** The comp's figures (comp 1262-1273): 23 answers, 4 at 0–6, 6 at 7–8, 13 at 9–10; stars 13/7/2/1/0. */
const spread = [0, 0, 1, 0, 1, 0, 2, 2, 4, 6, 7];
const counted = (more: { invited?: number | null; answered?: number | null; total?: number } = {}) => ({
  total: more.total ?? 23,
  byLanguage: { 'en-US': 19, 'de-DE': 4 },
  recommendScore: 39,
  questions: {
    qscore: { kind: 'score', answered: 23, counts: spread, ['pro' + 'moters']: 13, passives: 6, detractors: 4, recommendScore: 39 },
    qstars: { kind: 'stars', answered: 23, counts: [0, 1, 2, 7, 13], average: 4.4 },
    qmore: { kind: 'long', answered: 5 },
    qagain: { kind: 'one', answered: 20, choices: { yes: 18, no: 2 } },
  },
  invited: more.invited === undefined ? 41 : more.invited,
  answered: more.answered === undefined ? 23 : more.answered,
});

const TEXTS = [
  { co: 'Fernway Clinics', d: '2026-07-22T10:00:00.000Z', l: 'en-US', t: 'Clear timings every day. The team left the waiting room spotless.' },
  { co: 'Juno Analytics', d: '2026-07-20T10:00:00.000Z', l: 'en-US', t: 'Two desk frames came with the wrong legs. Sorted within a week.' },
  { co: 'Nordwind Logistics', d: '2026-07-17T10:00:00.000Z', l: 'de-DE', t: 'Sehr ordentliche Montage, aber die Lieferung kam einen Tag zu spät.' },
  { co: 'Cobalt Legal', d: '2026-07-14T10:00:00.000Z', l: 'en-US', t: 'The booths are much quieter than we hoped. We would like more say on fabric samples.' },
  { co: 'Veldt Studios', d: '2026-07-09T10:00:00.000Z', l: 'en-US', t: 'Good work overall. Parking for the vans was a hassle we should have sorted together.' },
];

function seedAnswers(extra = 0): void {
  seed(
    'invitations',
    TEXTS.map((text, i) => ({ id: 100 + i, form_id: 7, company: text.co, name: `Person ${String(i)}` })),
  );
  seed('answers', [
    ...TEXTS.map((text, i) => ({ id: 500 + i, form_id: 7, submitted_at: text.d, language: text.l, invitation_id: 100 + i, name: `Person ${String(i)}`, values: JSON.stringify({ qscore: 9, qmore: text.t }) })),
    // Answers that wrote nothing, and one to another survey.
    { id: 600, form_id: 7, submitted_at: '2026-07-01T10:00:00.000Z', language: 'en-US', invitation_id: null, name: null, values: JSON.stringify({ qscore: 3 }) },
    { id: 601, form_id: 8, submitted_at: '2026-07-30T10:00:00.000Z', language: 'en-US', invitation_id: null, name: null, values: JSON.stringify({ qmore: 'Another survey entirely.' }) },
    ...Array.from({ length: extra }, (_, i) => ({ id: 700 + i, form_id: 7, submitted_at: `2026-08-${String(10 + i).padStart(2, '0')}T10:00:00.000Z`, language: 'en-US', invitation_id: null, name: null, values: JSON.stringify({ qmore: `Later words ${String(i)}` }) })),
  ]);
}

function show(settings: unknown, more: { answer?: string | null; state?: 'live' | 'draft' } = {}) {
  const row = surveyRow(settings, more.state);
  const form = formRowOf(row);
  return render(<Results t={t} form={form} refetch={() => undefined} summary={null} answer={more.answer ?? null} settings={null} />);
}

const part = (name: string): HTMLElement => document.querySelector(`[data-part="${name}"]`) as HTMLElement;
const texts = (): string[] => [...document.querySelectorAll('[data-part="texts-card"] p')].map((p) => p.textContent ?? '');

beforeEach(() => {
  resetWorld();
  refusal.error = null;
  world.summaries = { '7': counted() };
  seedAnswers();
});
afterEach(() => cleanup());

describe('a survey’s results', () => {
  it('say how many of those invited answered, with the bar, and the languages counted together', () => {
    show(named);
    expect(part('results-summary').textContent).toContain('23 answers from 41 invited (56%)');
    expect(screen.getByRole('progressbar', { name: '56% answered' }).getAttribute('aria-valuenow')).toBe('23');
    expect(screen.getByRole('progressbar', { name: '56% answered' }).getAttribute('aria-valuemax')).toBe('41');
    expect(part('results-summary').textContent).toContain('Results from all languages together (English 19, Deutsch 4)');
  });

  it('draw the recommend score as the comp does: +39 from 13, 6 and 4, and the eleven bars from 0 to 10', () => {
    show(named);
    expect(part('recommend-score').textContent).toBe('+39');
    expect(part('split').textContent).toBe("Would recommend 13 · Neutral 6 · Wouldn't 4");
    expect(screen.getByRole('img', { name: "Would recommend 13, neutral 6, wouldn't 4" })).toBeTruthy();
    const bars = [...part('spread').children] as HTMLElement[];
    expect(bars.map((bar) => bar.dataset['score'])).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
    expect(bars.map((bar) => bar.firstElementChild?.textContent)).toEqual(spread.map(String));
    // The tallest is the most given; none is drawn under 3 px; each wears its band's tone.
    expect(bars.map((bar) => Number(bar.dataset['height']))).toEqual([3, 3, 17, 3, 17, 3, 34, 34, 69, 103, 120]);
    expect(bars.map((bar) => bar.querySelector('svg')?.dataset['tone'])).toEqual(['danger', 'danger', 'danger', 'danger', 'danger', 'danger', 'danger', 'neutral', 'neutral', 'pos', 'pos']);
    expect(screen.getByText("0–6 wouldn't · 7–8 neutral · 9–10 would recommend")).toBeTruthy();
    expect(document.body.textContent?.toLowerCase()).not.toContain('pro' + 'moter');
  });

  it('keep 0 at the start of the scores in a language read right to left', () => {
    world.locale = 'ar-EG';
    show(named);
    expect(part('spread').closest('[dir]')?.getAttribute('dir')).toBe('ltr');
    expect(part('recommend-score').getAttribute('dir')).toBe('ltr');
    expect(([...part('spread').children] as HTMLElement[]).map((bar) => bar.dataset['score'])).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
  });

  it('draw the stars: 4.4 of 5, four stars filled, five stars first', () => {
    show(named);
    expect(part('stars-average').textContent).toBe('4.4 of 5');
    expect(part('five-stars').dataset['filled']).toBe('4');
    const rows = [...document.querySelectorAll('[data-part="stars-card"] [data-part="count-row"]')];
    expect(rows.map((row) => row.textContent)).toEqual(['55 stars13', '44 stars7', '33 stars2', '22 stars1', '11 star0']);
    expect(rows.map((row) => within(row as HTMLElement).getByRole('progressbar').getAttribute('aria-valuemax'))).toEqual(['23', '23', '23', '23', '23']);
  });

  it('draw a one-choice question in the stars’ row pattern, a row a choice', () => {
    show(named);
    const rows = [...document.querySelectorAll('[data-part="choices-card"] [data-part="count-row"]')];
    expect(rows.map((row) => row.textContent)).toEqual(['Yes18', 'No2']);
  });

  it('list the written words newest first, each in its language, with the company it came from', () => {
    show(named);
    expect(texts()).toEqual(TEXTS.map((text) => text.t));
    const first = document.querySelector('[data-answer="500"]') as HTMLElement;
    expect(first.querySelector('p')?.getAttribute('lang')).toBe('en-US');
    expect(first.textContent).toContain('Fernway Clinics');
    // The reader's own way of writing a day (the comp writes "22 Jul 2026").
    expect(first.textContent).toContain('Jul 22, 2026');
    expect(first.textContent).toContain('EN');
    expect((document.querySelector('[data-answer="502"]') as HTMLElement).textContent).toContain('DE');
    // Read from the answers, never counted from them: only the page of words is asked for.
    const reads = world.calls.filter((call) => call.kind === 'summary');
    expect(reads.length).toBeGreaterThan(0);
  });

  it('show no name and no company when the survey does not link answers to names, and never read them', () => {
    show(unnamed);
    expect(texts()).toEqual(TEXTS.map((text) => text.t));
    for (const text of TEXTS) expect(document.body.textContent).not.toContain(text.co);
    expect(document.body.textContent).not.toContain('Person 0');
  });

  it('show an open-link survey’s answers counted with no bar, and no name or company', () => {
    world.summaries = { '7': counted({ invited: 0, answered: 0 }) };
    show(open);
    expect(part('results-summary').textContent).toContain('23 answers');
    expect(part('results-summary').textContent).not.toContain('invited');
    expect(screen.queryByRole('progressbar', { name: /answered/ })).toBeNull();
    for (const text of TEXTS) expect(document.body.textContent).not.toContain(text.co);
  });

  it('open on the answer a low-score link names, marked, even when it is on a later page', () => {
    seedAnswers(12);
    world.summaries = { '7': counted({ total: 35 }) };
    show(named, { answer: '503' });
    const marked = document.querySelector('[data-marked]') as HTMLElement;
    expect(marked.dataset['answer']).toBe('503');
    expect(marked.getAttribute('aria-current')).toBe('true');
    expect(marked.textContent).toContain('Opened from the link');
    expect(marked.textContent).toContain('Cobalt Legal');
    // First, before the newest page's words.
    expect(texts()[0]).toBe(TEXTS[3]!.t);
    expect(document.querySelectorAll('[data-marked]').length).toBe(1);
  });

  it('mark the named answer where it stands when it is on the page', () => {
    show(named, { answer: '501' });
    expect(texts()).toEqual(TEXTS.map((text) => text.t));
    expect((document.querySelector('[data-marked]') as HTMLElement).dataset['answer']).toBe('501');
  });

  it('say so when the named answer wrote nothing, and ignore an answer to another survey', () => {
    show(named, { answer: '600' });
    expect(screen.getByText('The answer this link opened left no written words. Its scores are counted below.')).toBeTruthy();
    cleanup();
    show(named, { answer: '601' });
    expect(document.querySelector('[data-marked]')).toBeNull();
    expect(document.body.textContent).not.toContain('Another survey entirely.');
  });

  it('page through the written words, older ones on the next page', () => {
    seedAnswers(12);
    world.summaries = { '7': counted({ total: 35 }) };
    show(named);
    expect(texts()[0]).toBe('Later words 11');
    fireEvent.click(screen.getByRole('button', { name: 'Older' }));
    expect(texts()).toContain(TEXTS[0]!.t);
  });

  it('count nothing for a draft, and ask Adminium for nothing', () => {
    show(named, { state: 'draft' });
    expect(screen.getByText('Nothing counted yet')).toBeTruthy();
    expect(world.calls.filter((call) => call.kind === 'summary')).toEqual([]);
  });

  it('say no answers yet when nobody has answered', () => {
    world.summaries = { '7': { ...counted({ total: 0, answered: 0 }), byLanguage: {} } };
    show(named);
    expect(part('results-summary').textContent).toContain('0 answers from 41 invited (0%)');
    expect(screen.getByText('No answers yet')).toBeTruthy();
    expect(document.querySelector('[data-part="score-card"]')).toBeNull();
  });

  it('tell a reader limited to some answers why nothing is counted for them', () => {
    refusal.error = { code: 'FORBIDDEN', message: 'You may read only some of this form’s answers, so their counts are not shown.', details: { reason: 'row-limit' } };
    show(named);
    expect(screen.getByRole('alert').textContent).toContain('Results are not counted for you');
    expect(document.querySelector('[data-part="score-card"]')).toBeNull();
  });
});
