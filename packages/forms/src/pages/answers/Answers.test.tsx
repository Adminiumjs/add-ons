// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formRowOf } from '../shared/row.ts';
import { ANSWERS, ENQUIRIES, FILES, KEEPS, NOW, SHOWROOM, showroom } from '../testing/answers.ts';
import { Refused, resetWorld, seed, world } from '../testing/host.tsx';
import { summary } from '../testing/rows.ts';
import { Answers } from './Answers.tsx';

/** The tab as the frame draws it, with the translator the page registers. */
async function draw(more: { answer?: string | null; form?: Record<string, string | number | boolean | null> } = {}): Promise<ReturnType<typeof render>> {
  const { wordsFor } = await import('../shared/messages.ts');
  const { ANSWERS: WORDS, SHARED } = await import('../strings/index.ts');
  const translate = wordsFor(SHARED, WORDS);
  const form = formRowOf(more.form ?? showroom());
  const view = render(<Answers t={translate} form={form} refetch={() => undefined} summary={null} answer={more.answer ?? null} settings={null} />);
  // The kit's read of what the reader may do arrives after the first draw.
  await act(async () => undefined);
  return view;
}

const sheet = (): HTMLElement | null => document.querySelector('[data-part="sheet"]');
const dialog = (): HTMLElement | null => document.querySelector('[data-part="modal"]');
const headers = (): string[] => screen.getAllByRole('columnheader').map((cell) => cell.textContent ?? '');
const names = (): string[] => Array.from(document.querySelectorAll('[id^="forms-answer-"]')).map((node) => node.textContent ?? '');
const exported = () => world.calls.filter((call) => call.kind === 'export');

beforeEach(() => {
  // The answers are dated from a fixed day: "Last 30 days" is counted from it, whatever day the suite runs on.
  const start = performance.now();
  vi.spyOn(Date, 'now').mockImplementation(() => NOW + (performance.now() - start));
  resetWorld();
  seed('forms', [showroom()]);
  seed('answers', ANSWERS);
  seed('answer_files', FILES);
  world.formTables = [ENQUIRIES];
  world.summaries = { '7': summary(214) };
  world.api = (_method, path) => (path === '/api/v1/add-ons/forms/kit' ? { tables: { answers: { can: { read: true, delete: true } } } } : {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the answers table', () => {
  it('has the comp’s columns, the address and company ones named by the form’s own questions', async () => {
    await draw();
    expect(headers()).toEqual(['Pick', 'When', 'Name', 'Work e-mail', 'Company', 'Became', 'Files', 'Language']);
  });

  it('leaves the address and company columns out of a form that asks neither', async () => {
    const plain = { ...SHOWROOM, questions: SHOWROOM.questions.filter((one) => !['qmail', 'qco'].includes(one.id)) };
    await draw({ form: showroom({ definition: plain }) });
    expect(headers()).toEqual(['Pick', 'When', 'Name', 'Became', 'Files', 'Language']);
  });

  it('lists the last 30 days, newest first, with name and address from the answer row itself', async () => {
    await draw();
    expect(names()).toEqual(['Marta Kovac', 'Ruth Adeyemi', 'Tomas Reidy', 'Old Enough']);
    const row = screen.getByText('marta.kovac@cobaltlegal.example').closest('tr') as HTMLElement;
    expect(within(row).getByText('Cobalt Legal')).toBeTruthy();
    expect(within(row).getByText('EN')).toBeTruthy();
    expect(screen.getByText('Showing 1–4 of 214')).toBeTruthy();
    expect(screen.getByText('Files are seen by staff only.')).toBeTruthy();
  });

  it('links the row an answer became where the reader may open its page, and names the table alone where not', async () => {
    await draw();
    const link = screen.getAllByRole('link', { name: '1042 in Enquiries' })[0] as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/p/team-inbox/r/1042');
    const ruth = screen.getByText('Ruth Adeyemi').closest('tr') as HTMLElement;
    expect(within(ruth).getByText('—')).toBeTruthy();
    cleanup();
    world.formTables = [{ ...ENQUIRIES, page: undefined } as never];
    await draw();
    expect(screen.queryByRole('link', { name: /in Enquiries/ })).toBeNull();
    expect(screen.getAllByText('Enquiries').length).toBe(2);
  });

  it('shows each file as a chip that opens through Adminium’s staff file route', async () => {
    await draw();
    const chip = screen.getByRole('link', { name: /drawings\.pdf · 2\.1 MB/ });
    expect(chip.getAttribute('href')).toBe('/api/v1/forms/files/UPLOADaaaaaaaaaaaa1');
    expect(chip.hasAttribute('download')).toBe(true);
  });

  it('asks the kit for "When" and the language exactly, and the CSV for the same', async () => {
    await draw();
    fireEvent.change(screen.getByRole('combobox', { name: 'When' }), { target: { value: '7' } });
    expect(names()).toEqual(['Marta Kovac', 'Ruth Adeyemi', 'Tomas Reidy']);
    fireEvent.change(screen.getByRole('combobox', { name: 'When' }), { target: { value: 'all' } });
    expect(names()).toEqual(['Marta Kovac', 'Ruth Adeyemi', 'Tomas Reidy', 'Old Enough', 'Long Ago']);
    fireEvent.click(screen.getByRole('radio', { name: 'Deutsch' }));
    expect(names()).toEqual(['Tomas Reidy']);
    fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
    await waitFor(() => expect(exported()).toHaveLength(1));
    expect(exported()[0]).toMatchObject({
      table: 'answers',
      options: { filter: [{ column: 'form_id', op: 'eq', value: 7 }, { column: 'language', op: 'eq', value: 'de-DE' }], columns: ['submitted_at', 'name', 'email', 'became_table', 'became_key', 'language', 'values'], format: 'csv' },
    });
    await waitFor(() => expect(world.calls.some((call) => call.kind === 'download' && call.key === 'export-1')).toBe(true));
    expect(world.toasts.at(-1)?.title).toBe('Downloading the answers as CSV.');
  });

  it('starts "When" at the last 30 days, a moment that holds while the tab stays open', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-03T12:00:41Z'));
    await draw();
    fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
    await waitFor(() => expect(exported()).toHaveLength(1));
    expect((exported()[0]?.options as { filter: unknown[] }).filter).toEqual([
      { column: 'form_id', op: 'eq', value: 7 },
      { column: 'submitted_at', op: 'gte', value: '2026-10-04T12:00:00.000Z' },
    ]);
  });

  it('searches names, and addresses when an @ is typed, and says so', async () => {
    await draw();
    expect(screen.getByText('Finds a name, or an e-mail address when what you type has an @ in it.')).toBeTruthy();
    const box = screen.getByRole('combobox', { name: 'Search answers' });
    fireEvent.change(box, { target: { value: 'ruth' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(names()).toEqual(['Ruth Adeyemi']);
    fireEvent.change(box, { target: { value: 'nordwind.example' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    // No @: a name is searched, and no name holds the domain.
    expect(screen.getByText('No answers match. Try another search or language.')).toBeTruthy();
    fireEvent.change(box, { target: { value: '@nordwind' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(names()).toEqual(['Tomas Reidy']);
  });

  it('says there are no answers yet on a form nobody has answered', async () => {
    seed('answers', []);
    await draw();
    fireEvent.change(screen.getByRole('combobox', { name: 'When' }), { target: { value: 'all' } });
    expect(screen.getByText('No answers yet')).toBeTruthy();
  });

  it('pages through answers fifty at a time', async () => {
    seed(
      'answers',
      Array.from({ length: 55 }, (_, i) => ({ ...ANSWERS[1]!, id: 100 + i, name: `Person ${String(i).padStart(2, '0')}`, submitted_at: new Date(Date.parse('2026-11-03T10:00:00Z') - i * 60_000).toISOString() })),
    );
    await draw();
    expect(names()).toHaveLength(50);
    expect(screen.getByText('Showing 1–50 of 214')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Older answers' }));
    expect(names()).toEqual(['Person 50', 'Person 51', 'Person 52', 'Person 53', 'Person 54']);
    expect(screen.getByText('Showing 51–55 of 214')).toBeTruthy();
  });

  it('shows a refusal of the list where the list would be', async () => {
    world.closed.add('answers');
    await draw();
    expect(screen.getByText('You do not have permission to open this')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('the side sheet', () => {
  const open = (name: string): void => fireEvent.click(screen.getByRole('button', { name }));
  const line = (label: string): string => {
    const at = within(sheet() as HTMLElement).getByText(label, { exact: true });
    return (at.closest('.flex-col')?.lastElementChild?.textContent ?? '').trim();
  };

  it('opens from a staff link’s ?answer=, and brings the answer’s row into view', async () => {
    const seen = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: seen });
    await draw({ answer: '3' });
    expect(within(sheet() as HTMLElement).getByRole('heading').textContent).toBe('Tomas Reidy');
    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen.mock.contexts[0]).toBe(document.getElementById('forms-answer-3'));
  });

  it('shows every question of the published copy, each kind in its own words', async () => {
    await draw();
    open('Marta Kovac');
    const at = sheet() as HTMLElement;
    expect(within(at).getByText('Answer · Book a showroom visit')).toBeTruthy();
    expect(line('Work e-mail')).toBe('marta.kovac@cobaltlegal.example');
    expect(line('What would you like to see?')).toBe('Acoustic booths, Seating');
    expect(line('Roughly how many seats?')).toBe('40');
    expect(line('Which room?')).toBe('North hall');
    expect(line('How was the booking?')).toBe('4 of 5');
    expect(line('How likely are you to come back?')).toBe('9 of 10');
    expect(line('Anything else?')).toBe('No answer');
    expect(line('Source')).toBe('flyer');
    expect(line('Sent from')).toBe('https://www.meridian.example');
    // A question taken out since: under its id, never dropped.
    expect(line('qgone')).toBe('kept from an older version');
  });

  it('says why a question was not asked', async () => {
    await draw();
    open('Ruth Adeyemi');
    expect(line('Roughly how many seats?')).toBe('Not asked. “Seating” wasn’t picked.');
  });

  it('shows the files, staff only, and "No files" where none came', async () => {
    await draw();
    open('Marta Kovac');
    expect(within(sheet() as HTMLElement).getByText('Staff only')).toBeTruthy();
    expect(within(sheet() as HTMLElement).getByRole('link', { name: /drawings\.pdf/ }).getAttribute('href')).toBe('/api/v1/forms/files/UPLOADaaaaaaaaaaaa1');
    cleanup();
    await draw();
    open('Ruth Adeyemi');
    expect(within(sheet() as HTMLElement).getByText('No files')).toBeTruthy();
  });

  it('words every state of the tick', async () => {
    const tickOf = async (name: string): Promise<string> => {
      cleanup();
      await draw();
      fireEvent.change(screen.getByRole('combobox', { name: 'When' }), { target: { value: 'all' } });
      open(name);
      return line('Send me the newsletter, about once a month.');
    };
    expect(await tickOf('Marta Kovac')).toMatch(/^Ticked, words v3\. Confirmation mail sent .+\. Not confirmed yet\.$/);
    expect(await tickOf('Tomas Reidy')).toBe('Ticked, words v2. Confirmed by e-mail.');
    expect(await tickOf('Old Enough')).toBe('Ticked, words v3. Not confirmed in time.');
    expect(await tickOf('Ruth Adeyemi')).toBe('Not ticked.');
  });

  it('names the row it became, and opens it from the footer', async () => {
    await draw();
    open('Marta Kovac');
    expect(within(sheet() as HTMLElement).getAllByRole('link', { name: '1042 in Enquiries' })).toHaveLength(1);
    fireEvent.click(within(sheet() as HTMLElement).getByRole('button', { name: 'Open in Enquiries' }));
    expect(world.navigated.at(-1)).toEqual({ to: '/p/team-inbox/r/1042' });
  });

  it('has no "Open" for an answer that became nothing', async () => {
    await draw();
    open('Ruth Adeyemi');
    expect(within(sheet() as HTMLElement).queryByRole('button', { name: /^Open in/ })).toBeNull();
  });
});

describe('picking and deleting', () => {
  it('picks answers, says how many, and asks before deleting, worded from the table they became rows of', async () => {
    await draw();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Pick the answer from Marta Kovac' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Pick the answer from Ruth Adeyemi' }));
    expect(screen.getByText('2 picked')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const asked = dialog() as HTMLElement;
    expect(within(asked).getByRole('heading').textContent).toBe('Delete 2 answers?');
    expect(asked.textContent).toContain('This can’t be undone. The rows they became stay in Enquiries.');
    fireEvent.click(within(asked).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(world.toasts.at(-1)?.title).toBe('2 answers deleted.'));
    expect(world.calls.filter((call) => call.kind === 'remove').map((call) => [call.table, call.key])).toEqual([
      ['answers', '1'],
      ['answers', '2'],
    ]);
    expect(names()).toEqual(['Tomas Reidy', 'Old Enough']);
    expect(screen.queryByText(/picked/)).toBeNull();
  });

  it('leaves the second sentence out for a form that keeps answers only', async () => {
    await draw({ form: showroom({ settings: KEEPS }) });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Pick the answer from Ruth Adeyemi' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const asked = dialog() as HTMLElement;
    expect(within(asked).getByRole('heading').textContent).toBe('Delete 1 answer?');
    expect(asked.textContent).toContain('This can’t be undone.');
    expect(asked.textContent).not.toContain('stay in');
  });

  it('picks every shown answer at once, and clears them', async () => {
    await draw();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Pick all shown answers' }));
    expect(screen.getByText('4 picked')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.queryByText(/picked/)).toBeNull();
  });

  it('deletes one answer from its sheet, closes it, and drops the staff link’s ?answer= from the address', async () => {
    await draw({ answer: '3' });
    fireEvent.click(within(sheet() as HTMLElement).getByRole('button', { name: 'Delete answer' }));
    expect(within(dialog() as HTMLElement).getByRole('heading').textContent).toBe('Delete 1 answer?');
    expect((dialog() as HTMLElement).textContent).toContain('The row it became stays in Enquiries.');
    fireEvent.click(within(dialog() as HTMLElement).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(world.toasts.at(-1)?.title).toBe('1 answer deleted.'));
    expect(sheet()).toBeNull();
    expect(world.navigated.at(-1)).toEqual({ to: '/add-ons/forms/forms/showroom-visit/answers', replace: true });
    expect(names()).not.toContain('Tomas Reidy');
  });

  it('says a refusal, and counts only what was deleted', async () => {
    world.before = (kind, _table, key) => {
      if (kind === 'remove' && key === 2) throw new Refused('TABLE_FORBIDDEN');
    };
    await draw();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Pick all shown answers' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(within(dialog() as HTMLElement).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(world.toasts.map((toast) => toast.title)).toEqual(['3 answers deleted.', 'You do not have permission to do this.']));
    expect(names()).toEqual(['Ruth Adeyemi']);
  });

  it('offers a reader who may not delete no pick boxes and no Delete', async () => {
    world.api = (_method, path) => (path === '/api/v1/add-ons/forms/kit' ? { tables: { answers: { can: { read: true, delete: false } } } } : {});
    await draw();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(headers()[0]).toBe('When');
    fireEvent.click(screen.getByRole('button', { name: 'Marta Kovac' }));
    expect(within(sheet() as HTMLElement).queryByRole('button', { name: 'Delete answer' })).toBeNull();
    expect(within(sheet() as HTMLElement).getByRole('button', { name: 'Open in Enquiries' })).toBeTruthy();
  });

  it('offers no delete until the kit has said the reader may', async () => {
    world.api = () => new Promise(() => undefined);
    await draw();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });
});

describe('on a phone', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 358, height: 800, top: 0, left: 0, right: 358, bottom: 800, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
  });

  it('draws a card per answer: pick target, name, time, company and language, the row it became and the file', async () => {
    await draw();
    expect(screen.queryByRole('table')).toBeNull();
    const cards = screen.getAllByRole('listitem');
    expect(cards).toHaveLength(4);
    const marta = cards[0] as HTMLElement;
    expect(within(marta).getByRole('button', { name: 'Marta Kovac' })).toBeTruthy();
    expect(within(marta).getByText('Cobalt Legal · EN')).toBeTruthy();
    expect(within(marta).getByRole('link', { name: '1042 in Enquiries' })).toBeTruthy();
    expect(within(marta).getByRole('link', { name: /drawings\.pdf/ })).toBeTruthy();
    expect(within(marta).getByRole('checkbox', { name: 'Pick the answer from Marta Kovac' }).closest('label')?.className).toContain('size-11');
  });

  it('shortens the language choice and makes the CSV an icon button', async () => {
    await draw();
    expect(screen.getAllByRole('radio').map((one) => one.textContent)).toEqual(['All', 'EN', 'DE']);
    expect(screen.getByRole('button', { name: 'Download CSV' }).textContent).toBe('');
  });
});
