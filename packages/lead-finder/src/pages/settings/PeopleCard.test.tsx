// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Refused, resetWorld, seed, world } from '../testing/host.tsx';
import { SOURCES, answer, sourceList } from '../testing/fixtures.ts';
import { PeopleCard } from './PeopleCard.tsx';
import { isSwitchRefusal, problemsOf } from './problems.ts';

/** The engine's refusal of the switch (`leads/guard.ts`, `leads/people.ts`): its English message, and what is missing by code. */
const REFUSED = 'Lead finder can’t keep people yet: Write the French version of why you keep them. E-mail isn’t set up: Settings → Email. Set the address in e-mail links: Settings → Senders.';
const PROBLEMS = [
  { code: 'purpose-missing', languages: ['fr-FR'], message: 'Write the French version of why you keep them.' },
  { code: 'smtp', message: 'E-mail isn’t set up: Settings → Email.' },
  { code: 'public-origin', message: 'Set the address in e-mail links: Settings → Senders.' },
];

async function draw(row: Record<string, unknown> | null, list = sourceList()): Promise<void> {
  seed('settings', row === null ? [] : [{ id: 1, people_on: false, purpose: null, keep_years: 3, ...row }] as never);
  answer({ [SOURCES]: () => ({ key: 'lead-finder', canManage: true, sources: list }) });
  const { wordsFor } = await import('../shared/messages.ts');
  const strings = await import('../strings/index.ts');
  render(<PeopleCard t={wordsFor(strings.SHARED, strings.SOURCE, strings.DOOR, strings.SETTINGS)} />);
  await act(async () => undefined);
  await act(async () => undefined);
}

const peopleSwitch = (): HTMLInputElement => screen.getByRole('switch') as HTMLInputElement;

beforeEach(() => resetWorld());
afterEach(() => cleanup());

describe('the People card, off (3d)', () => {
  it('says what the switch does, and asks for the sentence in English and the language of each register that is on', async () => {
    await draw({});
    expect(screen.getByText('Off')).toBeTruthy();
    expect(screen.getByText(/^Off: Lead finder keeps limited companies only\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'English, not written yet' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Français, not written yet' })).toBeTruthy();
    expect(screen.getByText('Français: Not written yet. You search the Register of France.')).toBeTruthy();
    expect(screen.getByText('One plain sentence. It goes in the mail. No links.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'See the mail it sends' }).getAttribute('href')).toBe('/add-ons/lead-finder/lead-finder/settings/people/mail');
  });

  it('asks no French while the Register of France is off', async () => {
    await draw({}, sourceList({ france: { on: false } }));
    expect(screen.queryByRole('button', { name: /Français/ })).toBeNull();
  });
});

describe('switching on, and Adminium refusing (3d-2)', () => {
  it('lists what is missing in the reader’s words, each pointing where to put it right, and the switch stays off', async () => {
    world.before = (_kind, table, values) => {
      if (table === 'settings' && (values as Record<string, unknown>)['people_on'] === true) throw new Refused('VALIDATION_FAILED', REFUSED, { problems: PROBLEMS, hook: 'leads.people-switch', rejected: true }, 422);
    };
    await draw({ purpose: { 'en-US': 'To offer your company office fit-outs and furniture.' } });
    fireEvent.click(peopleSwitch());
    await act(async () => undefined);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Lead finder can’t keep people yet:');
    expect(screen.getByRole('link', { name: 'Write the French version of why you keep them.' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'E-mail isn’t set up: Settings → Email.' }).getAttribute('href')).toBe('/studio/settings');
    expect(screen.getByRole('link', { name: 'Set the “Address in email links”: Settings → Senders.' })).toBeTruthy();
    expect(peopleSwitch().checked).toBe(false);
    expect(world.toasts).toEqual([]);
    // The French line takes the reader to the French sentence.
    fireEvent.click(screen.getByRole('link', { name: 'Write the French version of why you keep them.' }));
    expect(screen.getByRole('button', { name: 'Français, not written yet' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('turns on when Adminium takes it, and then says found people are written to one to one (3e)', async () => {
    await draw({ purpose: { 'en-US': 'To offer office fit-outs.', 'fr-FR': 'Pour offrir des bureaux.' } });
    fireEvent.click(peopleSwitch());
    await act(async () => undefined);
    expect(world.calls.find((call) => call.kind === 'update' && call.table === 'settings')).toMatchObject({ values: { people_on: true } });
    expect(world.toasts.at(-1)?.title).toBe('Lead finder keeps people from now on.');
    expect(screen.getByText('On')).toBeTruthy();
    expect(screen.getByText('People Lead finder finds start at ‘may not be e-mailed’. Write to them one to one, never in a campaign, and only after they agree.')).toBeTruthy();
  });
});

describe('why and how long', () => {
  it('saves the sentence of the language chosen when the field is left, and the keeping time when chosen', async () => {
    await draw({ purpose: { 'en-US': 'To offer office fit-outs.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Français, not written yet' }));
    const field = document.getElementById('lf-why') as HTMLInputElement;
    expect(field.getAttribute('lang')).toBe('fr-FR');
    fireEvent.change(field, { target: { value: ' Pour offrir des bureaux. ' } });
    fireEvent.blur(field);
    await act(async () => undefined);
    expect(world.calls.filter((call) => call.kind === 'update').at(-1)).toMatchObject({ values: { purpose: { 'en-US': 'To offer office fit-outs.', 'fr-FR': 'Pour offrir des bureaux.' } } });
    fireEvent.change(screen.getByLabelText('Keep found people for'), { target: { value: '2' } });
    await act(async () => undefined);
    expect(world.calls.filter((call) => call.kind === 'update').at(-1)).toMatchObject({ values: { keep_years: 2 } });
  });

  it('is read only for a reader who may not change the settings', async () => {
    world.cannot.add('update:settings');
    await draw({});
    expect(peopleSwitch().disabled).toBe(true);
    expect((document.getElementById('lf-why') as HTMLInputElement).disabled).toBe(true);
  });
});

describe('the engine’s refusal, read', () => {
  it('reads what is missing by code, a line per language, and keeps a code it does not know in the engine’s words', () => {
    const details = {
      hook: 'leads.people-switch',
      problems: [
        { code: 'purpose-missing', languages: ['de-DE', 'fr-FR'], message: 'Write the German version of why you keep them. Write the French version of why you keep them.' },
        { code: 'keep-time', message: 'Choose how long found people are kept: 1 to 10 years.' },
        { code: 'smtp', message: 'E-mail isn’t set up: Settings → Email.' },
        { code: 'public-origin', message: '…' },
        { code: 'mail-door', message: '…' },
        { code: 'privacy-notice', message: '…' },
        { code: 'tell-outbox', message: '…' },
        { code: 'tables', message: '…' },
        { code: 'something-new', message: 'Something new happened.' },
      ],
    };
    expect(problemsOf(details, REFUSED)).toEqual([
      { code: 'purpose', language: 'de-DE' },
      { code: 'purpose', language: 'fr-FR' },
      { code: 'keep-years' },
      { code: 'mail-server' },
      { code: 'public-origin' },
      { code: 'mail-door' },
      { code: 'privacy-notice' },
      { code: 'tell-mail' },
      { code: 'tables' },
      { code: 'other', words: 'Something new happened.' },
    ]);
  });

  it('says a refusal with no codes as the engine wrote it, and knows the switch’s refusal by its hook', () => {
    expect(problemsOf({ hook: 'leads.people-switch' }, REFUSED)).toEqual([{ code: 'other', words: REFUSED }]);
    expect(isSwitchRefusal({ hook: 'leads.people-switch' })).toBe(true);
    expect(isSwitchRefusal({ hook: 'leads.purpose' })).toBe(false);
  });
});
