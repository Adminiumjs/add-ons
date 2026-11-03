// @vitest-environment happy-dom
import { formSettingsSchema } from '@adminium/add-on-contracts/forms';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { format, resetWorld } from '../testing/host.tsx';
import { FromInvitation, SurveySettings } from './SurveySettings.tsx';

const t = (_key: string, fallback: string, args?: Record<string, unknown>): string => format(fallback, args);

const definition = (recommend: boolean) => ({
  v: 1,
  kind: 'survey',
  languages: ['en-US'],
  defaultLanguage: 'en-US',
  title: { 'en-US': 'How did your fit-out go?' },
  questions: [
    { id: 'qscore', kind: 'score', ...(recommend ? { recommend: true } : {}), label: { 'en-US': 'How likely are you to recommend us?' } },
    { id: 'qmore', kind: 'long', label: { 'en-US': 'Anything else?' } },
  ],
  ending: { kind: 'words', words: { 'en-US': 'Thank you. Your answers help us.' } },
});
const becomes = { table: 'crm_feedback', map: { qscore: 'score', qmore: 'text' } };
const named = { becomes, tell: [{ kind: 'person', id: '12' }], limits: { perHour: 200, harder: false }, survey: { mode: 'named', linkNames: true, stopAfterDays: 30 } };
const open = { becomes: null, tell: [], limits: { perHour: 200, harder: false }, survey: { mode: 'anonymous', linkNames: false, stopAfterDays: 30 } };

/** The builder, standing in: it holds the draft's settings and keeps every one the panel hands back. */
const saved: Record<string, unknown>[] = [];
function Builder({ start, recommend = true }: { start: Record<string, unknown>; recommend?: boolean }): ReactNode {
  const [settings, setSettings] = useState<Record<string, unknown>>(start);
  return (
    <SurveySettings
      t={t}
      definition={definition(recommend)}
      settings={settings}
      onChange={(next) => {
        saved.push(next);
        setSettings(next);
      }}
      becomes={<div data-slot="becomes">the column map</div>}
      after={<div data-slot="after">the thank-you words</div>}
      tell={<div data-slot="tell">Tessa Marlow · Person</div>}
    />
  );
}

const last = (): Record<string, unknown> => saved[saved.length - 1] as Record<string, unknown>;
const linkNames = (): HTMLInputElement => screen.getByRole('switch', { name: 'Link answers to names' }) as HTMLInputElement;
const lowScore = (): HTMLInputElement => screen.getByRole('switch', { name: 'Only when the score is low' }) as HTMLInputElement;
const days = (): HTMLInputElement | null => screen.queryByLabelText('Stop taking answers this many days after each invitation') as HTMLInputElement | null;
const slot = (name: string): Element | null => document.querySelector(`[data-slot="${name}"]`);

afterEach(() => {
  cleanup();
  resetWorld();
  saved.length = 0;
});

describe('a survey’s settings', () => {
  it('on a survey of invited people: names linked, the answer may become a row, and each link stops after its days', () => {
    render(<Builder start={named} />);
    expect(screen.getByRole('complementary', { name: 'Survey settings' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /People you invite/ }).getAttribute('aria-checked')).toBe('true');
    expect(linkNames().checked).toBe(true);
    expect(linkNames().disabled).toBe(false);
    expect(screen.getByText('Each answer shows who sent it. Turn off to make answers anonymous.')).toBeTruthy();
    expect(slot('becomes')).not.toBeNull();
    expect(slot('after')).not.toBeNull();
    expect(slot('tell')).not.toBeNull();
    expect(days()?.value).toBe('30');
    expect(screen.getByText('days after each invitation')).toBeTruthy();
  });

  it('on an open-link survey: no names, nothing becomes a row, and no invitation link to stop, each saying why', () => {
    render(<Builder start={open} />);
    expect(screen.getByRole('radio', { name: /Anyone with the link/ }).getAttribute('aria-checked')).toBe('true');
    expect(linkNames().checked).toBe(false);
    expect(linkNames().disabled).toBe(true);
    expect(screen.getByText('Answers to an open link come with no name, so they cannot be linked to anyone.')).toBeTruthy();
    expect(slot('becomes')).toBeNull();
    expect(screen.getByText('Nothing: an answer with no name becomes no row, because a row would say who answered.')).toBeTruthy();
    expect(days()).toBeNull();
    // Thank-you words and Tell stay: an open survey still thanks and tells.
    expect(slot('after')).not.toBeNull();
    expect(slot('tell')).not.toBeNull();
  });

  it('switching to an open link drops the names and the row, in settings the vocabulary takes', () => {
    render(<Builder start={named} />);
    fireEvent.click(screen.getByRole('radio', { name: /Anyone with the link/ }));
    expect(last()['survey']).toEqual({ mode: 'anonymous', linkNames: false, stopAfterDays: 30 });
    expect(last()['becomes']).toBeNull();
    expect(last()['tell']).toEqual(named.tell);
    expect(formSettingsSchema.safeParse(last()).success).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: /People you invite/ }));
    expect(last()['survey']).toEqual({ mode: 'named', linkNames: true, stopAfterDays: 30 });
  });

  it('turning names off makes answers anonymous: no row, the line says so', () => {
    render(<Builder start={named} />);
    fireEvent.click(linkNames());
    expect(last()['survey']).toEqual({ mode: 'named', linkNames: false, stopAfterDays: 30 });
    expect(last()['becomes']).toBeNull();
    expect(screen.getByText('Anonymous: names never show with answers, and answers can only be downloaded without names.')).toBeTruthy();
    expect(slot('becomes')).toBeNull();
    // Still invitations: each link still stops.
    expect(days()).not.toBeNull();
    expect(formSettingsSchema.safeParse(last()).success).toBe(true);
  });

  it('keeps the days a link takes answers between 1 and 365, and saves nothing else', () => {
    render(<Builder start={named} />);
    fireEvent.change(days()!, { target: { value: '45' } });
    expect((last()['survey'] as { stopAfterDays: number }).stopAfterDays).toBe(45);
    const before = saved.length;
    for (const wrong of ['0', '366', '', '4.5', 'x']) {
      fireEvent.change(days()!, { target: { value: wrong } });
      expect(screen.getByRole('alert').textContent).toBe('A whole number of days from 1 to 365.');
    }
    expect(saved.length).toBe(before);
    fireEvent.change(days()!, { target: { value: '365' } });
    expect((last()['survey'] as { stopAfterDays: number }).stopAfterDays).toBe(365);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(formSettingsSchema.safeParse(last()).success).toBe(true);
  });

  it('tells only on a low recommend score when asked: 0–6 by default, and on every answer again when not', () => {
    render(<Builder start={named} />);
    expect(screen.getByText('Gets a bell and an e-mail for each answer.')).toBeTruthy();
    fireEvent.click(lowScore());
    expect(last()['tellWhen']).toEqual({ question: 'qscore', atMost: 6 });
    expect(screen.getByText('Gets a bell and an e-mail when an answer scores 0–6.')).toBeTruthy();
    expect(formSettingsSchema.safeParse(last()).success).toBe(true);
    fireEvent.click(lowScore());
    expect(last()).not.toHaveProperty('tellWhen');
  });

  it('keeps a low score already set, and says what it is', () => {
    render(<Builder start={{ ...named, tellWhen: { question: 'qscore', atMost: 4 } }} />);
    expect(lowScore().checked).toBe(true);
    expect(screen.getByText('Gets a bell and an e-mail when an answer scores 0–4.')).toBeTruthy();
  });

  it('offers the low score only once a score is marked as the recommend question', () => {
    render(<Builder start={named} recommend={false} />);
    expect(lowScore().disabled).toBe(true);
    expect(screen.getByText(/mark a Score 0–10 question as the recommend question/)).toBeTruthy();
  });

  it('names a link column of the row as filled from the invitation, never from a question', () => {
    render(<FromInvitation t={t} column="job_id" />);
    expect(document.querySelector('[data-part="from-invitation"]')?.textContent).toBe("job_idFrom the invitation: the record the rule's step names");
  });
});
