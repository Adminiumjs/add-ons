// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Refused, resetWorld, world } from '../testing/host.tsx';
import { SOURCES, answer, pending, sourceList } from '../testing/fixtures.ts';
import type { SourceView } from '../shared/door.ts';
import { Sources } from './Sources.tsx';

async function draw(canManage = true, list = sourceList(), handlers: Record<string, (payload: unknown) => unknown> = {}): Promise<void> {
  answer({ [`get ${SOURCES}`]: () => ({ key: 'lead-finder', canManage, sources: list }), ...handlers });
  const { wordsFor } = await import('../shared/messages.ts');
  const strings = await import('../strings/index.ts');
  render(<Sources t={wordsFor(strings.SHARED, strings.SOURCE, strings.DOOR, strings.SETTINGS)} />);
  await act(async () => undefined);
  await act(async () => undefined);
}

const card = (name: string): HTMLElement => screen.getByRole('heading', { name }).closest('section') as HTMLElement;
const one = (id: string, more: Partial<SourceView>): SourceView => ({ ...sourceList().find((source) => source.id === id)!, ...more });

beforeEach(() => resetWorld());
afterEach(() => cleanup());

describe('Sources (4b)', () => {
  it('draws a card per source in order, each with what it gives, the hosts it may contact and its licence', async () => {
    await draw();
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(['Website reader', 'Companies House (UK)', 'Register of France', 'Register of Norway', 'OpenCorporates', 'Hunter']);
    expect(within(card('Website reader')).getByText(/only the website you enter/)).toBeTruthy();
    expect(within(card('Register of France')).getByText('recherche-entreprises.api.gouv.fr, geo.api.gouv.fr', { exact: false })).toBeTruthy();
    expect(within(card('Register of France')).getByText('Licence Ouverte (Etalab)')).toBeTruthy();
    expect(within(card('OpenCorporates')).getByText('Powered by OpenCorporates')).toBeTruthy();
    expect(within(card('OpenCorporates')).getByText('A business needs a paid OpenCorporates key. Details found with it may need finding again if your subscription ends.')).toBeTruthy();
    expect(within(card('Hunter')).getByText('Used only while Lead finder keeps people. Each look-up counts against your Hunter account.')).toBeTruthy();
    expect(within(card('Register of Norway')).getByText('Needs no key')).toBeTruthy();
    expect(within(card('Companies House (UK)')).getByText('…7Kd2')).toBeTruthy();
    expect(within(card('OpenCorporates')).getByText('Today: 43 of 100 look-ups')).toBeTruthy();
  });

  it('saves a pasted key, checks it at once, and says what the source said', async () => {
    let saved: unknown = null;
    await draw(true, sourceList({ hunter: { lastFour: null, verdict: null, on: false } }), {
      [`put ${SOURCES}/hunter/key`]: (body) => {
        saved = body;
        return { source: one('hunter', { lastFour: 'Zz91', verdict: 'accepted', on: true }), check: { verdict: 'accepted', code: null, message: null, account: null } };
      },
    });
    const hunter = card('Hunter');
    expect(within(hunter).getByText('Key not set')).toBeTruthy();
    expect(within(hunter).getByText('Add a key to use it')).toBeTruthy();
    fireEvent.change(within(hunter).getByPlaceholderText('Paste the key'), { target: { value: 'short' } });
    fireEvent.click(within(hunter).getByRole('button', { name: 'Check' }));
    expect(within(hunter).getByText('Paste the whole key first.')).toBeTruthy();
    expect(saved).toBeNull();
    fireEvent.change(within(hunter).getByPlaceholderText('Paste the key'), { target: { value: '  test-key-hunter-1  ' } });
    fireEvent.click(within(hunter).getByRole('button', { name: 'Check' }));
    await act(async () => undefined);
    expect(saved).toEqual({ value: 'test-key-hunter-1' });
    expect(within(card('Hunter')).getByText('…Zz91')).toBeTruthy();
    expect(within(card('Hunter')).getByText(/^Hunter accepted the key · /)).toBeTruthy();
    expect(within(card('Hunter')).getByText('Key saved')).toBeTruthy();
  });

  it('shows a refused key with Replace only, and its switch waiting', async () => {
    await draw(true, sourceList({ hunter: { verdict: 'refused', checkedAt: Date.parse('2026-07-28T09:35:00Z') } }));
    const hunter = card('Hunter');
    expect(within(hunter).getByText('Key refused')).toBeTruthy();
    expect(within(hunter).queryByRole('button', { name: 'Check' })).toBeNull();
    expect(within(hunter).getByText(/^Hunter refused this key · /)).toBeTruthy();
    expect(within(hunter).getByText('Replace the key to use it')).toBeTruthy();
    expect((within(hunter).getByRole('switch') as HTMLInputElement).disabled).toBe(true);
  });

  it('says it is checking while it checks, and when the source could not be reached (4b-2)', async () => {
    let reply: () => unknown = pending;
    await draw(true, sourceList(), { [`post ${SOURCES}/companies-house/check`]: () => reply() });
    fireEvent.click(within(card('Companies House (UK)')).getByRole('button', { name: 'Check' }));
    await act(async () => undefined);
    expect(within(card('Companies House (UK)')).getByText('Checking with Companies House…')).toBeTruthy();
    cleanup();
    reply = () => ({ source: one('companies-house', { verdict: 'unreachable' }), check: { verdict: 'unreachable', code: 'UNAVAILABLE', message: null, account: null } });
    await draw(true, sourceList(), { [`post ${SOURCES}/companies-house/check`]: () => reply() });
    fireEvent.click(within(card('Companies House (UK)')).getByRole('button', { name: 'Check' }));
    await act(async () => undefined);
    expect(within(card('Companies House (UK)')).getByText('Couldn’t reach Companies House. Try again.')).toBeTruthy();
  });

  it('edits a paid source’s daily limit in place', async () => {
    let asked: unknown = null;
    await draw(true, sourceList(), {
      [`put ${SOURCES}/opencorporates`]: (body) => {
        asked = body;
        return { source: one('opencorporates', { dailyCap: 250 }), check: null };
      },
    });
    const oc = card('OpenCorporates');
    fireEvent.click(within(oc).getByRole('button', { name: 'Edit' }));
    fireEvent.change(within(oc).getByLabelText('Daily limit'), { target: { value: '250' } });
    fireEvent.click(within(oc).getByRole('button', { name: 'Save' }));
    await act(async () => undefined);
    expect(asked).toEqual({ dailyCap: 250 });
    expect(world.toasts.at(-1)?.title).toBe('OpenCorporates: daily limit saved, 250 look-ups.');
    expect(within(card('OpenCorporates')).getByText('Today: 43 of 250 look-ups')).toBeTruthy();
  });

  it('switches a source off and on through Adminium', async () => {
    let asked: unknown = null;
    await draw(true, sourceList(), {
      [`put ${SOURCES}/norway`]: (body) => {
        asked = body;
        return { source: one('norway', { on: false }), check: null };
      },
    });
    fireEvent.click(within(card('Register of Norway')).getByRole('switch'));
    await act(async () => undefined);
    expect(asked).toEqual({ on: false });
    expect(within(card('Register of Norway')).getByText('Not in use')).toBeTruthy();
  });

  it('is read only for a reader without the settings grant: no key field, no Replace, Check or Edit, every switch held', async () => {
    await draw(false, sourceList({ hunter: { lastFour: null, verdict: null } }));
    expect(screen.getByText('Only people who keep the settings of Lead finder can change these.')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Paste the key')).toBeNull();
    for (const name of ['Replace', 'Check', 'Edit']) expect(screen.queryByRole('button', { name })).toBeNull();
    for (const sw of screen.getAllByRole('switch')) expect((sw as HTMLInputElement).disabled).toBe(true);
  });

  it('says a refused change in the reader’s words', async () => {
    await draw(true, sourceList(), {
      [`put ${SOURCES}/norway`]: () => {
        throw new Refused('FORBIDDEN', 'no', {}, 403);
      },
    });
    fireEvent.click(within(card('Register of Norway')).getByRole('switch'));
    await act(async () => undefined);
    expect(world.toasts.at(-1)).toMatchObject({ variant: 'error', title: 'You do not have permission to do this.' });
  });
});
