// @vitest-environment happy-dom
/**
 * "GO TO A LANDING PAGE": A FORM'S ENDING ON ONE OF THE BUSINESS'S OWN PAGES.
 *
 * Offered only where Adminium lists a live landing page (0.3.65 and a landing
 * pages add-on beside this one); stored as the page's key in its add-on, so
 * the page's address can change; held at Publish to a page that is live. A
 * form stored without it reads exactly as before.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetWorld, seed, world, type Call } from '../testing/host.tsx';
import { LIVE_PAGES_PATH, livePagesOf } from '../shared/landing.ts';
import { asParsed, landingProblems } from './checks.ts';
import { definitionOf } from './draft.ts';
import { PEOPLE, resetStatus, STATUS } from './status.ts';
import { resetBuilders, SAVE_DELAY_MS } from './store.ts';

const { default: Forms } = await import('../forms/index.tsx');

const SETTINGS = { becomes: null, tell: [], limits: { perHour: 200, harder: false } };
const PAGES = [
  { addOn: 'pages', key: 5, name: 'Thanks, see you there', slug: 'thanks-open-day', language: 'en-US' },
  { addOn: 'pages', key: '1', name: 'Showroom open day', slug: 'open-day', language: 'en-US' },
];

const definition = (more: Record<string, unknown> = {}): Record<string, unknown> => ({
  v: 1,
  kind: 'form',
  languages: ['en-US'],
  defaultLanguage: 'en-US',
  title: { 'en-US': 'Book a showroom visit' },
  questions: [{ id: 'q1', kind: 'short', label: { 'en-US': 'Your name' }, required: true, role: 'name' }],
  ending: { kind: 'words', words: { 'en-US': 'Thanks.' } },
  ...more,
});

function form(more: Record<string, unknown> = {}): Record<string, string | number | boolean | null> {
  return { id: 1, name: 'Book a showroom visit', slug: 'form-k3x9qz', kind: 'form', state: 'draft', definition: JSON.stringify(definition(more)), settings: JSON.stringify(SETTINGS), published: null, published_at: null, updated_at: '2026-11-03T10:00:00.000Z', closed_at: null };
}

function answer(pages: unknown[] | 'none'): void {
  world.api = (_method, path) => {
    if (path === STATUS) return { data: { mail: { sends: true, blocked: null }, reach: { state: 'reachable' }, notice: true, publicOrigin: 'https://crm.example.test', websites: [], roles: [] } };
    if (path === PEOPLE) return { people: [] };
    if (path === LIVE_PAGES_PATH) {
      if (pages === 'none') throw Object.assign(new Error('Not found'), { status: 404 });
      return { data: pages };
    }
    return {};
  };
}

const section = (): HTMLElement => document.querySelector('[data-section="after"]') as HTMLElement;
const stored = (): Record<string, unknown> => {
  const held = world.tables['forms']![0]!['definition'] as unknown;
  return (typeof held === 'string' ? JSON.parse(held) : held) as Record<string, unknown>;
};
const moves = (): Call[] => world.calls.filter((call) => call.kind === 'move' && call.table === 'forms');
const settle = async (): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS + 50);
  });
};
const open = async (): Promise<void> => {
  world.splat = 'forms/form-k3x9qz';
  world.search = { settings: 'after' };
  render(<Forms />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
};
const publish = async (): Promise<void> => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await vi.advanceTimersByTimeAsync(1);
  });
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(new Date('2026-11-03T12:00:00Z'));
  resetWorld();
  resetBuilders();
  resetStatus();
  answer(PAGES);
  seed('forms', [form()]);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('after sending, in the builder', () => {
  it('offers a landing page where Adminium lists a live one, and stores the page by its key', async () => {
    await open();
    fireEvent.click(within(section()).getByRole('radio', { name: 'Go to a landing page' }));
    await settle();
    expect(stored()['ending']).toEqual({ kind: 'landing', page: '5', addOn: 'pages' });
    const pick = within(section()).getByLabelText('Landing page') as HTMLSelectElement;
    expect([...pick.options].map((option) => option.textContent)).toEqual(['Thanks, see you there · /x/pages/thanks-open-day', 'Showroom open day · /x/pages/open-day']);
    fireEvent.change(pick, { target: { value: 'pages:1' } });
    await settle();
    expect(stored()['ending']).toEqual({ kind: 'landing', page: '1', addOn: 'pages' });
  });

  it('does not offer one on an Adminium with no landing pages, nor where none is live', async () => {
    answer('none');
    await open();
    expect(within(section()).queryByRole('radio', { name: 'Go to a landing page' })).toBeNull();
    cleanup();
    answer([]);
    await open();
    expect(within(section()).queryByRole('radio', { name: 'Go to a landing page' })).toBeNull();
    expect(within(section()).getAllByRole('radio').map((radio) => radio.textContent)).toEqual(['Show thank-you words', 'Go to a page']);
  });

  it('opens a form that ends on a page with it picked, and says when the page is no longer live', async () => {
    seed('forms', [form({ ending: { kind: 'landing', page: '9', addOn: 'pages' } })]);
    await open();
    expect(within(section()).getByRole('radio', { name: 'Go to a landing page' }).getAttribute('aria-checked')).toBe('true');
    const pick = within(section()).getByLabelText('Landing page') as HTMLSelectElement;
    expect(pick.selectedOptions[0]?.textContent).toBe('A page that is not live');
  });

  it('keeps the words while another ending is picked, so switching back loses nothing', async () => {
    await open();
    fireEvent.click(within(section()).getByRole('radio', { name: 'Go to a landing page' }));
    fireEvent.click(within(section()).getByRole('radio', { name: 'Show thank-you words' }));
    await settle();
    expect(stored()['ending']).toEqual({ kind: 'words', words: { 'en-US': 'Thanks.' } });
  });
});

describe('publishing a form that ends on a landing page', () => {
  it('puts it live with the ending in its published copy', async () => {
    seed('forms', [form({ ending: { kind: 'landing', page: '5', addOn: 'pages' } })]);
    await open();
    await publish();
    expect(moves()).toHaveLength(1);
    const values = (moves()[0]!.values as { values: Record<string, unknown> }).values;
    expect((values['published'] as { definition: Record<string, unknown> }).definition['ending']).toEqual({ kind: 'landing', page: '5', addOn: 'pages' });
  });

  it('is refused while the page is not live, in words, and publishes nothing', async () => {
    seed('forms', [form({ ending: { kind: 'landing', page: '9', addOn: 'pages' } })]);
    await open();
    await publish();
    expect(within(screen.getByRole('dialog', { name: '' })).getByText('The landing page to go to is not live. Pick another, or publish it first.')).toBeTruthy();
    expect(moves()).toEqual([]);
  });
});

describe('the ending, read and checked', () => {
  it('reads a stored form without it exactly as before', () => {
    for (const ending of [
      { kind: 'words', words: { 'en-US': 'Thanks.' } },
      { kind: 'page', url: 'https://www.example.test/thanks' },
    ])
      expect(definitionOf(definition({ ending }), 'form', 'en-US').ending).toEqual(ending);
  });

  it('reads every form of the sample as it was stored', () => {
    const sample = JSON.parse(readFileSync(join(process.cwd(), 'seeds', 'forms.sample.json'), 'utf8')) as { tables: { ref: string; rows: { definition?: { ending?: unknown } }[] }[] };
    const rows = sample.tables.find((table) => table.ref === 'forms')?.rows ?? [];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) if (row.definition?.ending !== undefined) expect(definitionOf(row.definition, 'form', 'en-US').ending).toEqual(row.definition.ending);
  });

  it('reads a landing ending, and one out of shape as thank-you words', () => {
    expect(definitionOf(definition({ ending: { kind: 'landing', page: '5', addOn: 'pages' } }), 'form', 'en-US').ending).toEqual({ kind: 'landing', page: '5', addOn: 'pages' });
    expect(definitionOf(definition({ ending: { kind: 'landing', page: '../5', addOn: 'pages' } }), 'form', 'en-US').ending.kind).toBe('words');
    expect(definitionOf(definition({ ending: { kind: 'landing', page: '5', addOn: 'Pages!' } }), 'form', 'en-US').ending.kind).toBe('words');
  });

  it('holds the page to being live only when Adminium has said which pages are', () => {
    const d = definitionOf(definition({ ending: { kind: 'landing', page: '5', addOn: 'pages' } }), 'form', 'en-US');
    const live = livePagesOf({ data: PAGES });
    expect(landingProblems(d, live)).toEqual([]);
    expect(landingProblems(d, null)).toEqual([]);
    expect(landingProblems(d, live.filter((page) => page.key !== '5')).map((problem) => problem.code)).toEqual(['ending-landing-off']);
    expect(landingProblems({ ...d, ending: { kind: 'landing', page: '5', addOn: 'other' } }, live).map((problem) => problem.code)).toEqual(['ending-landing-off']);
  });

  it('judges the rest of the form as the vocabulary does', () => {
    const d = definitionOf(definition({ languages: ['en-US', 'de-DE'], ending: { kind: 'landing', page: '5', addOn: 'pages' } }), 'form', 'en-US');
    expect(asParsed(d).ending).toEqual({ kind: 'words', words: { 'en-US': '—', 'de-DE': '—' } });
    const plain = definitionOf(definition(), 'form', 'en-US');
    expect(asParsed(plain)).toBe(plain);
  });
});
