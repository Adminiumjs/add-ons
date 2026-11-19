// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Refused, resetWorld, world } from '../testing/host.tsx';
import { DOOR, FOUND, KIT, KIT_REPLY, LOOKUP, PEOPLE_REPLY, SOURCES, answer, pending, sourceList } from '../testing/fixtures.ts';
import type { LookupReply } from '../shared/door.ts';
import { FillSheet, type RecordActionPayload } from './FillSheet.tsx';
import { firstTicks, rowsOf } from './fields.ts';

const ROW = { id: 17, name: 'Kestrel Yard', website: 'https://kestrelyard.example', town: 'Leeds', company_number: null };

async function draw(more: { update?: boolean; people?: boolean | 'unknown'; list?: ReturnType<typeof sourceList>; handlers?: Record<string, (payload: unknown) => unknown> } = {}): Promise<{ closed: () => number }> {
  let closed = 0;
  answer({
    [SOURCES]: () => ({ key: 'lead-finder', canManage: false, sources: more.list ?? sourceList() }),
    [KIT]: () => KIT_REPLY,
    '/api/v1/data/conn-1/lf_settings?pageSize=1': () => ({ data: more.people === 'unknown' ? [] : [{ id: 1, people_on: more.people ?? true }] }),
    ...more.handlers,
  });
  const payload: RecordActionPayload = { table: 'crm:companies', rowKey: '17', row: ROW, grants: { update: more.update ?? true }, close: () => void (closed += 1) };
  const { wordsFor } = await import('../shared/messages.ts');
  const strings = await import('../strings/index.ts');
  render(<FillSheet t={wordsFor(strings.SHARED, strings.SOURCE, strings.DOOR, strings.FILL)} payload={payload} />);
  for (let turn = 0; turn < 4; turn += 1) await act(async () => undefined);
  return { closed: () => closed };
}

const settle = async () => {
  for (let turn = 0; turn < 3; turn += 1) await act(async () => undefined);
};
const lookups = () => world.calls.filter((call) => call.table === `post ${DOOR}/lookup`);
const fieldRow = (label: string): HTMLElement => screen.getByText(label, { selector: 'span' }).closest('li') as HTMLElement;

beforeEach(() => resetWorld());
afterEach(() => cleanup());

describe('before Look up', () => {
  it('fetches nothing until Look up, and offers the registers that are on', async () => {
    await draw({ handlers: { [`post ${DOOR}/lookup`]: () => LOOKUP } });
    expect(lookups()).toEqual([]);
    expect((screen.getByRole('textbox', { name: 'Website' }) as HTMLInputElement).value).toBe('https://kestrelyard.example');
    const select = screen.getByRole('combobox', { name: 'Register' });
    expect([...select.querySelectorAll('option')].map((option) => option.textContent)).toEqual(['Companies House (UK)', 'Register of France', 'Register of Norway', 'OpenCorporates']);
    expect((screen.getByRole('button', { name: 'Fill in all' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows a reader without update rights nothing to fill', async () => {
    await draw({ update: false });
    expect(screen.getByText('You may read this company, not change it.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Look up' })).toBeNull();
  });
});

describe('Look up and Stop (2a, D-M8-10)', () => {
  it('reads the website and asks the register, saying so line by line', async () => {
    await draw({ handlers: { [`post ${DOOR}/lookup`]: () => pending() } });
    fireEvent.click(screen.getByRole('button', { name: 'Look up' }));
    await settle();
    expect(lookups()[0]?.values).toEqual({ table: 'crm:companies', record: '17', sources: ['companies-house'], website: true });
    expect(screen.getByText('Reading kestrelyard.example…')).toBeTruthy();
    expect(screen.getByText('Asking Companies House…')).toBeTruthy();
  });

  it('Stop ends the call: its signal is aborted, the answer is dropped and nothing is shown', async () => {
    let release: (value: LookupReply) => void = () => undefined;
    await draw({ handlers: { [`post ${DOOR}/lookup`]: () => new Promise<LookupReply>((resolve) => (release = resolve)) } });
    fireEvent.click(screen.getByRole('button', { name: 'Look up' }));
    await settle();
    const signal = (lookups()[0]?.options as { signal?: AbortSignal } | undefined)?.signal;
    expect(signal?.aborted).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    await settle();
    expect(signal?.aborted).toBe(true);
    expect(screen.getAllByText('Stopped. Nothing was read.').length).toBeGreaterThan(0);
    release(LOOKUP);
    await settle();
    expect(screen.queryByText(/details? found$/)).toBeNull();
    expect((screen.getByRole('button', { name: 'Fill in all' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('what was found (2d)', () => {
  it('shows a row per detail that would change, Now against Found, every one ticked but what they do', async () => {
    await draw({ handlers: { [`post ${DOOR}/lookup`]: () => LOOKUP } });
    fireEvent.click(screen.getByRole('button', { name: 'Look up' }));
    await settle();
    // Town is found the same as it is: no row.
    expect(screen.getByRole('heading', { name: '5 details found' })).toBeTruthy();
    expect(within(fieldRow('Registered name')).getByText('Kestrel Yard')).toBeTruthy();
    expect(within(fieldRow('Registered name')).getByText('Kestrel Yard Architects Ltd')).toBeTruthy();
    expect((within(fieldRow('What they do')).getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
    expect((within(fieldRow('About')).getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
    expect(within(fieldRow('About')).getByText(/The website’s home page/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fill in ticked (4)' })).toBeTruthy();
  });

  it('fills in the ticked ones by field and source, with what the sheet showed as now; then closes and says so', async () => {
    let asked: unknown = null;
    const sheet = await draw({ handlers: { [`post ${DOOR}/lookup`]: () => LOOKUP, [`post ${DOOR}/fill`]: (body) => ((asked = body), { table: 'crm:companies', record: '17', filled: [] }) } });
    fireEvent.click(screen.getByRole('button', { name: 'Look up' }));
    await settle();
    fireEvent.click(within(fieldRow('About')).getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Fill in ticked (3)' }));
    await settle();
    expect(asked).toEqual({
      table: 'crm:companies',
      record: '17',
      fields: [
        { field: 'name', source: 'companies-house', now: 'Kestrel Yard' },
        { field: 'number', source: 'companies-house', now: null },
        { field: 'lines', source: 'companies-house', now: null },
      ],
    });
    expect(world.toasts.at(-1)?.title).toBe('3 details filled in.');
    expect(sheet.closed()).toBe(1);
  });

  it('says a refused fill: a detail changed after the look-up, by whom when Adminium says', async () => {
    const sheet = await draw({
      handlers: {
        [`post ${DOOR}/lookup`]: () => LOOKUP,
        [`post ${DOOR}/fill`]: () => {
          throw new Refused('FIELD_CHANGED', 'address_lines was changed after you looked. Look up again.', { field: 'lines', column: 'address_lines', by: 'Dana Whitlock' });
        },
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Look up' }));
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Fill in all' }));
    await settle();
    expect(world.toasts.at(-1)).toMatchObject({ variant: 'error', title: 'Address was changed by Dana Whitlock after you looked. Look up again.' });
    expect(sheet.closed()).toBe(0);
  });
});

describe('the website’s answers (2b, 2c)', () => {
  const withSite = (website: LookupReply['website']): LookupReply => ({ ...LOOKUP, website });

  it('says a website that asks not to be read, and one that could not be reached, with Try again reading it alone', async () => {
    let reply = withSite({ outcome: 'refused-by-site', host: null, message: null });
    await draw({ handlers: { [`post ${DOOR}/lookup`]: () => reply } });
    fireEvent.click(screen.getByRole('button', { name: 'Look up' }));
    await settle();
    expect(screen.getByText('This website asks tools not to read it, so we didn’t.')).toBeTruthy();
    reply = withSite({ outcome: 'unreachable', host: null, message: null });
    fireEvent.click(screen.getByRole('button', { name: 'Look up' }));
    await settle();
    expect(screen.getByText('Couldn’t reach the website.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await settle();
    expect(lookups().at(-1)?.values).toMatchObject({ sources: [], website: true });
  });

  it('asks before following a website to another host, and reads it there only when told to', async () => {
    await draw({ handlers: { [`post ${DOOR}/lookup`]: () => withSite({ outcome: 'asks', host: 'www.kestrel-group.example', message: null }) } });
    fireEvent.click(screen.getByRole('button', { name: 'Look up' }));
    await settle();
    expect(screen.getByText('This website sends visitors to www.kestrel-group.example.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Read www.kestrel-group.example' }));
    await settle();
    expect(lookups().at(-1)?.values).toMatchObject({ sources: [], website: true, confirmedHost: 'www.kestrel-group.example' });
  });
});

describe('the register picker (2f)', () => {
  const several: LookupReply = {
    ...LOOKUP,
    sources: [{ source: 'companies-house', outcome: 'several', code: null, message: null, matches: [FOUND[0]!, { ...FOUND[1]!, name: 'Kestrel Yard Ltd', address: { town: 'Bradford' } }] }],
    fields: LOOKUP.fields.filter((one) => one.field === 'about'),
  };

  it('asks which one; "Use this one" waits for a choice, then asks the register by its number and adds what it found', async () => {
    await draw({ handlers: { [`post ${DOOR}/lookup`]: (body) => ((body as { number?: string }).number === undefined ? several : { ...LOOKUP, website: null }) } });
    fireEvent.click(screen.getByRole('button', { name: 'Look up' }));
    await settle();
    const group = screen.getByRole('radiogroup', { name: 'Companies House has 2 companies called Kestrel Yard. Which one is it?' });
    expect(within(group).getByText('Same town as this record')).toBeTruthy();
    const use = within(group).getByRole('button', { name: 'Use this one' }) as HTMLButtonElement;
    expect(use.disabled).toBe(true);
    fireEvent.click(use);
    expect(lookups()).toHaveLength(1);
    fireEvent.click(within(group).getAllByRole('radio')[0]!);
    expect(use.disabled).toBe(false);
    fireEvent.click(use);
    await settle();
    expect(lookups().at(-1)?.values).toMatchObject({ sources: ['companies-house'], website: false, number: '98000412' });
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.getByRole('heading', { name: '5 details found' })).toBeTruthy();
  });

  it('"None of these" fills in nothing from the register', async () => {
    await draw({ handlers: { [`post ${DOOR}/lookup`]: () => several } });
    fireEvent.click(screen.getByRole('button', { name: 'Look up' }));
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'None of these' }));
    expect(screen.getByText('None of these. Nothing from Companies House is filled in.')).toBeTruthy();
  });

  it('says a register that has no company by this name', async () => {
    await draw({ handlers: { [`post ${DOOR}/lookup`]: () => ({ ...LOOKUP, sources: [{ source: 'companies-house', outcome: 'none', code: 'NOT_FOUND', message: null, matches: [] }] }) } });
    fireEvent.click(screen.getByRole('button', { name: 'Look up' }));
    await settle();
    expect(screen.getByText('Companies House has no company by this name.')).toBeTruthy();
  });
});

describe('People at a company (2g, 2h)', () => {
  it('finds people with Hunter, ticks the ones it may keep, names the rest, and keeps the ticked ones', async () => {
    let kept: unknown = null;
    await draw({
      handlers: {
        [`post ${DOOR}/people`]: () => PEOPLE_REPLY,
        [`post ${DOOR}/people/keep`]: (body) => ((kept = body), { kept: [{ email: 'sam@kestrelyard.example', personTable: 'crm:contacts', personKey: '42' }], refused: [{ email: 'robin@kestrelyard.example', reason: 'not-told-yet' }] }),
      },
    });
    expect(screen.getByRole('heading', { name: 'People at kestrelyard.example' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Find people' }));
    await settle();
    expect(screen.getByText('info@kestrelyard.example is a shared address, not a person.')).toBeTruthy();
    expect(screen.getByText('Jo Ashby is already a contact.')).toBeTruthy();
    expect(screen.getByText('1 address is on the do-not-email list and is not kept.')).toBeTruthy();
    expect(screen.getByText('Each person you keep gets a short mail at once: where we found their details, and how to object.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep ticked people (2)' }));
    await settle();
    expect(kept).toEqual({ table: 'crm:companies', record: '17', source: 'hunter', emails: ['sam@kestrelyard.example', 'robin@kestrelyard.example'] });
    expect(screen.getByText('Kept')).toBeTruthy();
    expect(screen.getByText('Not kept: They could not be told at once, so they were not kept.')).toBeTruthy();
    expect(world.toasts.map((toast) => toast.title)).toContain('1 person kept. Their mail is on the way.');
  });

  it('says keeping people is off, with the People settings', async () => {
    await draw({ people: false });
    expect(screen.getByText('Keeping people is off, so Lead finder fills in company details only.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'People settings' }).getAttribute('href')).toBe('/add-ons/lead-finder/lead-finder/settings/people');
    expect(screen.queryByRole('button', { name: 'Find people' })).toBeNull();
  });

  it('asks for a Hunter key when none is saved, and says Hunter’s limit when today’s is spent', async () => {
    await draw({ list: sourceList({ hunter: { lastFour: null, verdict: null } }) });
    expect(screen.getByText('Add a Hunter key in Sources to find people here.')).toBeTruthy();
    cleanup();
    await draw({ list: sourceList({ hunter: { dailyCap: 25, usedToday: 25 } }) });
    expect(screen.getByText('Hunter: today’s limit of 25 look-ups is reached.')).toBeTruthy();
  });
});

describe('the rows, decided', () => {
  it('prefers a register for registered details and the website for what it tells best, and ticks all but a changed activity', () => {
    const rows = rowsOf(
      [
        { field: 'name', column: 'name', now: null, found: [{ source: 'website', value: 'Kestrel' }, { source: 'companies-house', value: 'Kestrel Yard Architects Ltd' }] },
        { field: 'phone', column: 'phone', now: null, found: [{ source: 'companies-house', value: '0113 496 0001' }, { source: 'website', value: '0113 496 0412' }] },
        { field: 'activity', column: 'sector', now: null, found: [{ source: 'companies-house', value: 'Architectural activities · 71111' }] },
      ],
      'website',
    );
    expect(rows.map((row) => [row.field, row.source])).toEqual([
      ['name', 'companies-house'],
      ['phone', 'website'],
      ['activity', 'companies-house'],
    ]);
    // An empty activity is ticked; one the record already has is not.
    expect([...firstTicks(rows)]).toEqual(['name', 'phone', 'activity']);
  });
});
