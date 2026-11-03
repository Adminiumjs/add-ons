// @vitest-environment happy-dom
import { parseForm } from '@adminium/add-on-contracts/forms';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetWorld, seed, world, type Call } from '../testing/host.tsx';
import { PEOPLE, resetStatus, STATUS } from './status.ts';
import { resetBuilders, SAVE_DELAY_MS } from './store.ts';

const { default: Forms } = await import('../forms/index.tsx');

type Row = Record<string, string | number | boolean | null>;

const SETTINGS = { becomes: null, tell: [], limits: { perHour: 200, harder: false } };

/** A form row as the list makes a draft: JSON columns as text, the way some databases hand them back. */
function formRow(id: number, more: { slug: string; kind?: 'form' | 'survey'; state?: 'draft' | 'live' | 'closed'; definition: Record<string, unknown>; settings?: Record<string, unknown>; published?: unknown; publishedAt?: string | null }): Row {
  return {
    id,
    name: 'Book a showroom visit',
    slug: more.slug,
    kind: more.kind ?? 'form',
    state: more.state ?? 'draft',
    definition: JSON.stringify(more.definition),
    settings: JSON.stringify(more.settings ?? (more.kind === 'survey' ? { ...SETTINGS, survey: { mode: 'named', linkNames: true, stopAfterDays: 30 } } : SETTINGS)),
    published: more.published === undefined || more.published === null ? null : JSON.stringify(more.published),
    published_at: more.publishedAt ?? null,
    updated_at: '2026-11-03T10:00:00.000Z',
    closed_at: null,
  };
}

const definition = (more: Partial<Record<string, unknown>> = {}): Record<string, unknown> => ({
  v: 1,
  kind: 'form',
  languages: ['en-US'],
  defaultLanguage: 'en-US',
  title: { 'en-US': 'Book a showroom visit' },
  questions: [
    { id: 'q1', kind: 'short', label: { 'en-US': 'Your name' }, required: true, role: 'name' },
    { id: 'q2', kind: 'short', label: { 'en-US': 'Work e-mail' }, check: 'email', role: 'email' },
    { id: 'q3', kind: 'several', label: { 'en-US': 'What would you like to see?' }, choices: [{ id: 'booths', label: { 'en-US': 'Acoustic booths' } }, { id: 'seating', label: { 'en-US': 'Seating' } }] },
    { id: 'q4', kind: 'number', label: { 'en-US': 'Roughly how many seats?' } },
  ],
  ending: { kind: 'words', words: { 'en-US': 'Thanks.' } },
  ...more,
});

interface StatusMore {
  notice?: boolean;
  reach?: string;
  blocked?: 'no-public-origin' | 'no-mail-server' | null;
}
function answer(status: StatusMore = {}): void {
  world.api = (_method, path) => {
    if (path === STATUS) return { data: { mail: { sends: (status.blocked ?? null) === null, blocked: status.blocked ?? null }, reach: { state: status.reach ?? 'reachable' }, notice: status.notice ?? true, publicOrigin: 'https://crm.example.test', websites: [], roles: [{ id: 'role-north', name: 'Sales reps — North' }] } };
    if (path === PEOPLE) return { people: [{ id: 'u-dana', name: 'Dana Whitlock' }, { id: 'u-tessa', name: 'Tessa Marlow' }] };
    return {};
  };
}

const ENQUIRIES = {
  id: 'tbl-enquiries',
  tableRef: 'crm:enquiries',
  label: 'Enquiries',
  app: 'Sales CRM',
  sourceColumn: 'from_form',
  columns: [
    { name: 'person', label: 'Name', kind: 'text', required: false, link: false },
    { name: 'company_name', label: 'Company', kind: 'text', required: true, link: false },
    { name: 'brochure', label: 'Brochure', kind: 'enum', required: false, link: false, values: ['yes', 'no'] },
    { name: 'contact_id', label: 'Contact', kind: 'text', required: false, link: true },
    { name: 'from_form', label: 'From form', kind: 'text', required: false, link: false },
  ],
};

const updates = (): Call[] => world.calls.filter((call) => call.kind === 'update' && call.table === 'forms');
const moves = (): Call[] => world.calls.filter((call) => call.kind === 'move' && call.table === 'forms');
const stored = (key = '1'): { definition: Record<string, unknown>; settings: Record<string, unknown> } => {
  const row = world.tables['forms']!.find((one) => String(one['id']) === key)!;
  const json = (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : value) as Record<string, unknown>;
  return { definition: json(row['definition']), settings: json(row['settings']) };
};
const settle = async (): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS + 50);
  });
};
const open = async (splat: string): Promise<void> => {
  world.splat = splat;
  render(<Forms />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
};
const card = (id: string): HTMLElement => document.querySelector(`[data-question="${id}"]`) as HTMLElement;
const section = (id: string): HTMLElement => document.querySelector(`[data-section="${id}"]`) as HTMLElement;
const rail = (): HTMLElement => screen.getByRole('navigation', { name: 'Add a question' });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(new Date('2026-11-03T12:00:00Z'));
  resetWorld();
  resetBuilders();
  resetStatus();
  answer();
  seed('forms', [formRow(1, { slug: 'form-k3x9qz', definition: definition() })]);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('the questions', () => {
  it('offer the eleven kinds of a form, and a survey’s nine', async () => {
    await open('forms/form-k3x9qz');
    expect(within(rail()).getAllByRole('button').map((button) => button.textContent)).toEqual(['Short text', 'Long text', 'One choice', 'Several choices', 'Date', 'Number', 'Score 0–10', 'Stars', 'File', 'Agreement tick', 'Hidden field']);
    cleanup();
    resetBuilders();
    seed('forms', [formRow(2, { slug: 'fit-out', kind: 'survey', definition: definition({ kind: 'survey' }) })]);
    await open('forms/surveys/fit-out');
    expect(within(rail()).getAllByRole('button').map((button) => button.textContent)).toEqual(['Short text', 'Long text', 'One choice', 'Several choices', 'Date', 'Number', 'Score 0–10', 'Stars', 'Hidden field']);
  });

  it('add each kind, save them in one write within a second, and the row they save parses', async () => {
    await open('forms/form-k3x9qz');
    for (const name of ['Long text', 'One choice', 'Date', 'Score 0–10', 'Stars', 'File', 'Agreement tick', 'Hidden field']) fireEvent.click(within(rail()).getByRole('button', { name }));
    expect(updates()).toHaveLength(0);
    expect(document.querySelector('[data-part="autosave"]')?.textContent).toBe('');
    await settle();
    expect(updates()).toHaveLength(1);
    expect(screen.getByText('All changes saved')).toBeTruthy();
    const saved = stored();
    expect((saved.definition['questions'] as unknown[]).length).toBe(12);
    const parsed = parseForm(saved.definition, saved.settings);
    expect(parsed.ok ? [] : parsed.issues).toEqual([]);
  });

  it('save a burst of typing once, and keep the name in step with the title', async () => {
    await open('forms/form-k3x9qz');
    const title = screen.getByLabelText('Title');
    for (const typed of ['B', 'Bo', 'Boo', 'Book a visit']) fireEvent.change(title, { target: { value: typed } });
    await settle();
    expect(updates()).toHaveLength(1);
    expect(updates()[0]?.values).toMatchObject({ name: 'Book a visit' });
  });

  it('open a card for writing by its question, a real button', async () => {
    await open('forms/form-k3x9qz');
    const button = within(card('q4')).getByRole('button', { name: 'Roughly how many seats?' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(button);
    fireEvent.change(within(card('q4')).getByLabelText('Question'), { target: { value: 'How many seats?' } });
    fireEvent.change(within(card('q4')).getByLabelText('Largest'), { target: { value: '400' } });
    fireEvent.click(within(card('q4')).getByRole('switch', { name: 'Required' }));
    await settle();
    expect((stored().definition['questions'] as Record<string, unknown>[])[3]).toMatchObject({ label: { 'en-US': 'How many seats?' }, max: 400, required: true });
  });

  it('move, copy and delete a question, and say the delete', async () => {
    await open('forms/form-k3x9qz');
    expect((within(card('q1')).getByRole('button', { name: 'Move up' }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(card('q4')).getByRole('button', { name: 'Move down' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(card('q2')).getByRole('button', { name: 'Move up' }));
    fireEvent.click(within(card('q4')).getByRole('button', { name: 'Duplicate' }));
    fireEvent.click(within(card('q3')).getByRole('button', { name: 'Delete' }));
    await settle();
    expect((stored().definition['questions'] as { id: string }[]).map((one) => one.id)).toEqual(['q2', 'q1', 'q4', 'q5']);
    expect(world.toasts.map((toast) => toast.title)).toContain('Question deleted.');
  });

  it('say what the vocabulary would refuse at its question, before Publish', async () => {
    seed('forms', [formRow(1, { slug: 'form-k3x9qz', definition: definition({ languages: ['en-US', 'de-DE'], title: { 'en-US': 'Visit', 'de-DE': 'Besuch' }, ending: { kind: 'words', words: { 'en-US': 'Thanks.', 'de-DE': 'Danke.' } } }) })]);
    await open('forms/form-k3x9qz');
    expect(within(card('q1')).getByText('The question has no Deutsch words yet.')).toBeTruthy();
    expect(within(card('q3')).getByText('Choice 1 has no Deutsch words yet.', { exact: false })).toBeTruthy();
  });
});

describe('show if', () => {
  it('offers only earlier questions of the kinds it can test', async () => {
    seed('forms', [formRow(1, { slug: 'form-k3x9qz', definition: definition({ questions: [...(definition()['questions'] as unknown[]), { id: 'q5', kind: 'hidden', param: 'from', label: { 'en-US': 'Source' } }, { id: 'q6', kind: 'long', label: { 'en-US': 'Anything else?' } }] }) })]);
    await open('forms/form-k3x9qz');
    expect(within(card('q5')).queryByRole('button', { name: 'Show only if…' })).toBeNull();
    expect(within(card('q2')).queryByRole('button', { name: 'Show only if…' })).toBeNull();
    fireEvent.click(within(card('q6')).getByRole('button', { name: 'Show only if…' }));
    const asked = within(card('q6')).getByLabelText('Show only if the answer to') as HTMLSelectElement;
    expect([...asked.options].map((option) => option.textContent)).toEqual(['Q3 · What would you like to see?', 'Q4 · Roughly how many seats?']);
    expect([...(within(card('q6')).getByLabelText('Test') as HTMLSelectElement).options].map((option) => option.textContent)).toEqual(['includes']);
    fireEvent.change(within(card('q6')).getByLabelText('Answer'), { target: { value: 'seating' } });
    fireEvent.click(within(card('q6')).getByRole('button', { name: 'Done' }));
    expect(card('q6').textContent).toContain('Show only if ‘What would you like to see?’ includes ‘Seating’');
    await settle();
    expect((stored().definition['questions'] as Record<string, unknown>[])[5]?.['showIf']).toEqual({ question: 'q3', includes: 'seating' });
  });

  it('asks before deleting a question another depends on, and clears that one’s condition', async () => {
    seed('forms', [formRow(1, { slug: 'form-k3x9qz', definition: definition({ questions: (definition()['questions'] as Record<string, unknown>[]).map((one) => (one['id'] === 'q4' ? { ...one, showIf: { question: 'q3', includes: 'seating' } } : one)) }) })]);
    await open('forms/form-k3x9qz');
    fireEvent.click(within(card('q3')).getByRole('button', { name: 'Delete' }));
    const asked = screen.getAllByRole('dialog').find((one) => one.textContent?.includes('Delete this question?')) as HTMLElement;
    expect(within(asked).getByText('Q4 only show after an answer to this question. Once it is deleted, they always show.')).toBeTruthy();
    expect(card('q3')).toBeTruthy();
    fireEvent.click(within(asked).getByRole('button', { name: 'Delete' }));
    await settle();
    const questions = stored().definition['questions'] as Record<string, unknown>[];
    expect(questions.map((one) => one['id'])).toEqual(['q1', 'q2', 'q4']);
    expect(questions[2]?.['showIf']).toBeUndefined();
  });
});

describe('each answer becomes', () => {
  beforeEach(() => {
    world.formTables = [ENQUIRIES, { ...ENQUIRIES, id: 'tbl-contacts', label: 'Contacts', sourceColumn: undefined, columns: ENQUIRIES.columns.slice(0, 2) }];
  });

  it('lists only the tables apps open to forms, and maps a table’s own columns, never a link', async () => {
    await open('forms/form-k3x9qz');
    fireEvent.click(within(section('becomes')).getByRole('radio', { name: 'A new row in' }));
    const table = within(section('becomes')).getByLabelText('Table') as HTMLSelectElement;
    expect([...table.options].map((option) => option.textContent)).toEqual(['Enquiries — Sales CRM', 'Contacts — Sales CRM']);
    expect(within(section('becomes')).queryByLabelText('The question that fills Contact')).toBeNull();
    expect(within(section('becomes')).queryByLabelText('The question that fills From form')).toBeNull();
    const name = within(section('becomes')).getByLabelText('The question that fills Name') as HTMLSelectElement;
    expect([...name.options].map((option) => option.textContent)).toEqual(['—', 'Q1 · Your name', 'Q2 · Work e-mail', 'Q3 · What would you like to see?']);
    fireEvent.change(name, { target: { value: 'q1' } });
    expect(within(section('becomes')).getByText('Every row needs this. Pick the question that fills it.')).toBeTruthy();
    fireEvent.change(within(section('becomes')).getByLabelText('The question that fills Company'), { target: { value: 'q3' } });
    expect(within(section('becomes')).getByText('The row gets the picked choices’ stored names, joined by commas.')).toBeTruthy();
    await settle();
    expect(stored().settings['becomes']).toEqual({ table: 'tbl-enquiries', map: { q1: 'person', q3: 'company_name' }, source: { column: 'from_form', value: 'Book a showroom visit' } });
  });

  it('puts the fixed source row on the table’s source column, starting as the title', async () => {
    await open('forms/form-k3x9qz');
    fireEvent.click(within(section('becomes')).getByRole('radio', { name: 'A new row in' }));
    const value = within(section('becomes')).getAllByLabelText('Every new row gets this value.')[0] as HTMLInputElement;
    expect(value.value).toBe('Book a showroom visit');
    fireEvent.change(value, { target: { value: 'Showroom form' } });
    await settle();
    expect((stored().settings['becomes'] as Record<string, unknown>)['source']).toEqual({ column: 'from_form', value: 'Showroom form' });
  });

  it('warns, by name, when a choice’s stored names are not the enum’s values', async () => {
    seed('forms', [formRow(1, { slug: 'form-k3x9qz', definition: definition({ questions: [...(definition()['questions'] as unknown[]), { id: 'q5', kind: 'one', label: { 'en-US': 'Brochure?' }, choices: [{ id: 'yes', label: { 'en-US': 'Yes' } }, { id: 'maybe', label: { 'en-US': 'Maybe' } }] }] }), settings: { ...SETTINGS, becomes: { table: 'tbl-enquiries', map: { q5: 'brochure' } } } })]);
    await open('forms/form-k3x9qz');
    expect(within(section('becomes')).getByText('Brochure takes only yes, no. Store these choices as one of them: maybe.')).toBeTruthy();
  });

  it('“Just keep the answers” writes no table', async () => {
    seed('forms', [formRow(1, { slug: 'form-k3x9qz', definition: definition(), settings: { ...SETTINGS, becomes: { table: 'tbl-enquiries', map: { q1: 'person' } } } })]);
    await open('forms/form-k3x9qz');
    fireEvent.click(within(section('becomes')).getByRole('radio', { name: /Just keep the answers/ }));
    await settle();
    expect(stored().settings['becomes']).toBeNull();
  });

  it('offers only “Just keep the answers” when no app opens a table, and says so', async () => {
    world.formTables = [];
    await open('forms/form-k3x9qz');
    expect((within(section('becomes')).getByRole('radio', { name: 'A new row in' }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(section('becomes')).getByText('No app opens a table to forms yet, so answers can only be kept here.')).toBeTruthy();
  });
});

describe('the agreement tick', () => {
  const ticked = (): Record<string, unknown> => definition({ questions: [...(definition()['questions'] as unknown[]), { id: 'q5', kind: 'tick', purpose: 'newsletter', wordingVersion: 3, wordingChangedAt: '2026-07-02', confirm: true, label: { 'en-US': 'Send me the newsletter.' } }] });

  it('offers exactly the two purposes, the one another tick has turned off', async () => {
    seed('forms', [formRow(1, { slug: 'form-k3x9qz', definition: ticked() })]);
    await open('forms/form-k3x9qz');
    fireEvent.click(within(section('tick')).getByRole('button', { expanded: false }));
    const why = within(section('tick')).getByLabelText('Why you’re asking') as HTMLSelectElement;
    expect([...why.options].map((option) => option.textContent)).toEqual(['Newsletter', 'Surveys']);
    expect(within(section('tick')).getByText(/^v3, changed /)).toBeTruthy();
    expect((within(section('tick')).getByRole('switch') as HTMLInputElement).checked).toBe(true);
    expect(card('q5').textContent).toContain('Always starts unticked. Visitors tick it themselves.');
    expect(card('q5').querySelector('input[type="checkbox"]:checked')).toBeNull();
  });

  it('turns the rail’s tick off once both purposes are asked for', async () => {
    await open('forms/form-k3x9qz');
    const tick = within(rail()).getByRole('button', { name: 'Agreement tick' }) as HTMLButtonElement;
    fireEvent.click(tick);
    fireEvent.click(tick);
    expect(tick.disabled).toBe(true);
    await settle();
    expect((stored().definition['questions'] as Record<string, unknown>[]).filter((one) => one['kind'] === 'tick').map((one) => one['purpose'])).toEqual(['newsletter', 'surveys']);
  });

  it('makes a new version when new words are saved, and says so first', async () => {
    seed('forms', [formRow(1, { slug: 'form-k3x9qz', definition: ticked() })]);
    await open('forms/form-k3x9qz');
    fireEvent.click(within(section('tick')).getByRole('button', { expanded: false }));
    fireEvent.click(within(section('tick')).getByRole('button', { name: 'Edit words' }));
    expect(world.toasts.at(-1)?.title).toBe('Saving new words will make version 4.');
    fireEvent.change(within(section('tick')).getByLabelText('Its words'), { target: { value: 'Yes, send me the newsletter.' } });
    fireEvent.click(within(section('tick')).getByRole('button', { name: 'Save new words' }));
    await settle();
    expect((stored().definition['questions'] as Record<string, unknown>[])[4]).toMatchObject({ wordingVersion: 4, wordingChangedAt: '2026-11-03', label: { 'en-US': 'Yes, send me the newsletter.' } });
  });
});

describe('the other settings', () => {
  it('open the section a staff link names', async () => {
    world.search = { settings: 'limits' };
    await open('forms/form-k3x9qz');
    expect(within(section('limits')).getByRole('button', { name: /Limits/ }).getAttribute('aria-expanded')).toBe('true');
    expect(within(section('becomes')).getByRole('button', { name: /Each answer becomes/ }).getAttribute('aria-expanded')).toBe('false');
    fireEvent.change(within(section('limits')).getByLabelText('At most this many sends an hour'), { target: { value: '50' } });
    fireEvent.click(within(section('limits')).getByRole('switch'));
    await settle();
    expect(stored().settings['limits']).toEqual({ perHour: 50, harder: true });
  });

  it('keep one section open at a time, each closed one saying what it holds', async () => {
    await open('forms/form-k3x9qz');
    const heads = ['becomes', 'tick', 'after', 'tell', 'limits', 'files'].map((id) => within(section(id)).getAllByRole('button')[0]!);
    expect(heads.map((head) => head.getAttribute('aria-expanded'))).toEqual(['true', 'false', 'false', 'false', 'false', 'false']);
    expect(heads.map((head) => head.textContent)).toEqual(['Each answer becomes', 'Agreement tickNo agreement tick', 'After sendingThank-you words', 'TellNobody yet', 'LimitsAt most 200 an hour', 'FilesNo file question']);
    fireEvent.click(heads[2]!);
    expect(heads.map((head) => head.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'true', 'false', 'false', 'false']);
  });

  it('Tell lists the people and the roles it may tell, by name, ten at most', async () => {
    seed('forms', [formRow(1, { slug: 'form-k3x9qz', definition: definition(), settings: { ...SETTINGS, tell: [{ kind: 'role', id: 'role-north' }, { kind: 'person', id: 'u-dana' }] } })]);
    world.search = { settings: 'tell' };
    await open('forms/form-k3x9qz');
    expect(within(section('tell')).getByText('Sales reps — North')).toBeTruthy();
    expect(within(section('tell')).getByText('Dana Whitlock')).toBeTruthy();
    fireEvent.click(within(section('tell')).getByRole('button', { name: 'Add a person or role' }));
    const pick = within(section('tell')).getByLabelText('Add a person or role') as HTMLSelectElement;
    expect([...pick.options].map((option) => option.textContent).filter((one) => one !== '' && one !== 'Add a person or role')).toEqual(['Tessa Marlow']);
    fireEvent.change(pick, { target: { value: 'person:u-tessa' } });
    fireEvent.click(within(section('tell')).getByRole('button', { name: 'Remove Sales reps — North' }));
    await settle();
    expect(stored().settings['tell']).toEqual([{ kind: 'person', id: 'u-dana' }, { kind: 'person', id: 'u-tessa' }]);
  });

  it('After sending takes words in the language being edited, or an address, one or the other', async () => {
    world.search = { settings: 'after' };
    await open('forms/form-k3x9qz');
    const words = within(section('after')).getByLabelText('Show thank-you words') as HTMLTextAreaElement;
    const page = within(section('after')).getByLabelText('Go to a page') as HTMLInputElement;
    expect(page.disabled).toBe(true);
    fireEvent.click(within(section('after')).getByRole('radio', { name: 'Go to a page' }));
    expect(words.disabled).toBe(true);
    fireEvent.change(within(section('after')).getByLabelText('Go to a page'), { target: { value: 'https://www.example.test/thanks' } });
    await settle();
    expect(stored().definition['ending']).toEqual({ kind: 'page', url: 'https://www.example.test/thanks' });
  });

  it('Files sets the size and the kinds of the file question', async () => {
    seed('forms', [formRow(1, { slug: 'form-k3x9qz', definition: definition({ questions: [...(definition()['questions'] as unknown[]), { id: 'q5', kind: 'file', label: { 'en-US': 'Drawings' }, maxMb: 10, kinds: ['pdf', 'jpg', 'png'] }] }) })]);
    world.search = { settings: 'files' };
    await open('forms/form-k3x9qz');
    fireEvent.change(within(section('files')).getByLabelText('Largest file'), { target: { value: '4' } });
    fireEvent.click(within(section('files')).getByLabelText('JPG'));
    fireEvent.click(within(section('files')).getByLabelText('Text'));
    await settle();
    expect((stored().definition['questions'] as Record<string, unknown>[])[4]).toMatchObject({ maxMb: 4, kinds: ['pdf', 'png', 'text'] });
  });
});

describe('the blocked cards', () => {
  it('say nothing while all is well', async () => {
    await open('forms/form-k3x9qz');
    expect(screen.queryAllByRole('alert')).toEqual([]);
  });

  it('say the privacy notice is unset, and Publish stays off', async () => {
    answer({ notice: false });
    await open('forms/form-k3x9qz');
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('Set your privacy notice first (Privacy & public pages).Publish stays off until it is set.');
    expect(within(alert).getByRole('link').getAttribute('href')).toBe('/studio/privacy');
    expect((screen.getByRole('button', { name: 'Publish' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('word the reach card from Adminium’s reason', async () => {
    answer({ reach: 'network-off' });
    await open('forms/form-k3x9qz');
    expect(screen.getByRole('alert').textContent).toBe('Public pages are switched off on this server. Visitors can’t open this form.Set ADMINIUM_NETWORK_FEATURES=on on the server, restart it, then check again.');
    expect(screen.getByRole('alert').dataset['tone']).toBe('danger');
  });

  it('say when no mail goes out', async () => {
    answer({ blocked: 'no-mail-server' });
    await open('forms/form-k3x9qz');
    expect(screen.getByRole('alert').textContent).toBe('No mail goes out yet: no mail server is set.Confirmation mails and the e-mails to staff wait until it is set.');
  });

  it('show all three at once', async () => {
    answer({ notice: false, reach: 'not-set', blocked: 'no-public-origin' });
    await open('forms/form-k3x9qz');
    expect(screen.getAllByRole('alert').map((alert) => alert.dataset['tone'])).toEqual(['warn', 'danger', 'warn']);
  });
});

describe('publishing', () => {
  it('lists what fails, by question, in words, and publishes nothing', async () => {
    seed('forms', [formRow(1, { slug: 'form-k3x9qz', definition: definition({ languages: ['en-US', 'de-DE'], title: { 'en-US': 'Visit', 'de-DE': 'Besuch' }, ending: { kind: 'words', words: { 'en-US': 'Thanks.', 'de-DE': 'Danke.' } } }) })]);
    await open('forms/form-k3x9qz');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
      await vi.advanceTimersByTimeAsync(1);
    });
    const dialog = screen.getByRole('dialog', { name: '' });
    expect(within(dialog).getByText('Not ready to publish')).toBeTruthy();
    expect(within(dialog).getAllByText('Q1 · Your name')).toHaveLength(1);
    expect(within(dialog).getAllByText('The question has no Deutsch words yet.').length).toBe(4);
    expect(moves()).toEqual([]);
  });

  it('puts the draft live in one write: the state, the published copy, the time and a readable link name', async () => {
    await open('forms/form-k3x9qz');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(moves()).toHaveLength(1);
    const values = (moves()[0]!.values as { to: string; values: Record<string, unknown> }).values;
    expect((moves()[0]!.values as { to: string }).to).toBe('live');
    expect(values['published']).toEqual({ definition: values['definition'], settings: values['settings'] });
    expect(values['published_at']).toMatch(/^2026-11-03T12:00:00/);
    expect(values['slug']).toBe('book-a-showroom-visit');
    expect(world.toasts.at(-1)?.title).toBe('Form published. Visitors can open it now.');
    expect(world.navigated.at(-1)).toEqual({ to: '/add-ons/forms/forms/book-a-showroom-visit', replace: true });
  });

  it('keeps the random link name when another form has the readable one', async () => {
    seed('forms', [formRow(1, { slug: 'form-k3x9qz', definition: definition() }), formRow(2, { slug: 'book-a-showroom-visit', state: 'live', definition: definition() })]);
    await open('forms/form-k3x9qz');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
      await vi.advanceTimersByTimeAsync(1);
    });
    expect((moves()[0]!.values as { values: Record<string, unknown> }).values['slug']).toBeUndefined();
  });

  it('never says visitors can open a form they cannot reach', async () => {
    answer({ reach: 'not-set' });
    await open('forms/form-k3x9qz');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(world.toasts.at(-1)?.title).toBe('Form published, but visitors can’t reach it yet.');
  });

  it('offers “Publish changes” only while the live form’s draft differs from what visitors see', async () => {
    const live = definition();
    seed('forms', [formRow(1, { slug: 'showroom', state: 'live', definition: live, published: { definition: live, settings: SETTINGS }, publishedAt: '2026-11-01T09:00:00.000Z' })]);
    await open('forms/showroom');
    expect(screen.queryByRole('button', { name: 'Publish changes' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Close form' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Book a visit' } });
    expect(screen.getByRole('button', { name: 'Publish changes' })).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Publish changes' }));
      await vi.advanceTimersByTimeAsync(1);
    });
    const published = updates().at(-1)!.values as Record<string, unknown>;
    expect((published['published'] as { definition: { title: unknown } }).definition.title).toEqual({ 'en-US': 'Book a visit' });
    expect(published['slug']).toBeUndefined();
    expect(moves()).toEqual([]);
    expect(world.toasts.at(-1)?.title).toBe('Changes published. They show from now on.');
    expect(screen.queryByRole('button', { name: 'Publish changes' })).toBeNull();
  });

  it('closes a live form, and says what visitors see', async () => {
    const live = definition();
    seed('forms', [formRow(1, { slug: 'showroom', state: 'live', definition: live, published: { definition: live, settings: SETTINGS } })]);
    await open('forms/showroom');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Close form' }));
      await vi.advanceTimersByTimeAsync(1);
    });
    expect((moves()[0]!.values as { to: string }).to).toBe('closed');
    expect(world.toasts.at(-1)?.title).toBe('Form closed. Visitors now see “This form is closed.”');
  });
});

describe('languages', () => {
  it('list every language, the form’s first, and add one with the form’s own words', async () => {
    await open('forms/form-k3x9qz');
    const pop = screen.getByRole('dialog', { name: 'Language variations' });
    const rows = within(pop).getAllByRole('button');
    expect(rows.slice(0, 6).map((row) => row.textContent)).toEqual(['ENEnglishEditing nowCurrent', 'DEDeutschNot created yetAdd', 'FRFrançaisNot created yetAdd', 'CSČeštinaNot created yetAdd', 'DADanskNot created yetAdd', 'ARالعربيةNot created yetAdd']);
    expect(rows.slice(6).map((row) => row.textContent?.slice(0, 5))).toEqual(['ZH-CN', 'ZH-TW']);
    expect(within(rows[5]!).getByText('العربية').getAttribute('dir')).toBe('rtl');
    fireEvent.click(rows[1]!);
    expect(world.toasts.at(-1)?.title).toBe('Deutsch added. It needs translating.');
    expect(within(pop).getAllByRole('button')[1]!.textContent).toBe('DEDeutschNeeds translationEdit');
    await settle();
    expect(stored().definition['languages']).toEqual(['en-US', 'de-DE']);
    expect((stored().definition['title'] as Record<string, string>)['de-DE']).toBe('Book a showroom visit');
  });

  it('edit another language’s words right to left, and make it the form’s own', async () => {
    seed('forms', [formRow(1, { slug: 'form-k3x9qz', definition: definition({ languages: ['en-US', 'ar-EG'], title: { 'en-US': 'Visit', 'ar-EG': 'زيارة' } }) })]);
    await open('forms/form-k3x9qz');
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Language variations' })).getAllByRole('button')[1]!);
    const title = screen.getByLabelText('Title') as HTMLInputElement;
    expect(title.value).toBe('زيارة');
    expect(title.getAttribute('dir')).toBe('rtl');
    fireEvent.click(screen.getByRole('button', { name: 'Make العربية the form’s own language' }));
    await settle();
    expect(stored().definition).toMatchObject({ defaultLanguage: 'ar-EG', languages: ['ar-EG', 'en-US'] });
  });
});

describe('the preview', () => {
  it('opens the saved draft in the language being edited, from this host', async () => {
    await open('forms/form-k3x9qz');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
      await vi.advanceTimersByTimeAsync(1);
    });
    const frame = screen.getByTitle('The form as visitors see it');
    expect(frame.getAttribute('src')).toBe(`${window.location.origin}/x/forms/form-k3x9qz?preview=1&lang=en-US`);
  });
});

describe('a reader who may not change forms', () => {
  it('sees the questions and settings, with nothing to add, publish or close', async () => {
    world.cannot = new Set(['update:forms', 'move:forms:live', 'move:forms:closed']);
    await open('forms/form-k3x9qz');
    expect(screen.queryByRole('navigation', { name: 'Add a question' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
    expect(within(card('q1')).queryByRole('button', { name: 'Delete' })).toBeNull();
    expect((screen.getByLabelText('Title') as HTMLInputElement).disabled).toBe(true);
  });
});
