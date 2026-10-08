// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { wordsFor } from '../shared/messages.ts';
import { DISCOUNTS, REFUSAL, SHARED } from '../strings/index.ts';
import { Refused, resetWorld, seed, world } from '../testing/host.tsx';
import { Editor } from './Editor.tsx';
import { List } from './List.tsx';

const t = wordsFor(SHARED, REFUSAL, DISCOUNTS);
type Row = Record<string, string | number | boolean | null>;

const AUTUMN: Row = { id: 4, name: 'Autumn 5', public_name: '{"en-US":"Autumn 5"}', gives: 'amount', value: '5.000', buy_qty: null, bonus_qty: null, trigger: 'code', applies_to: 'order', starts_on: '2026-09-15', ends_on: '2099-10-31', weekdays: null, from_time: null, to_time: null, min_spend: '30.00', min_qty: null, first_order_only: false, group_id: null, max_uses: 100, max_per_customer: null, budget_open: true, budget: null, combinable: true, status: 'active', uses: 37, given: '185.00', used_up: false };
const LAUNCH: Row = { ...AUTUMN, id: 5, name: 'Launch week', public_name: '{"en-US":"Launch week"}', gives: 'percent', value: '20.000', min_spend: null, max_uses: 50, uses: 50, given: '412.75', used_up: true, combinable: false };
const MUGS: Row = { ...AUTUMN, id: 2, name: 'Monday mugs', gives: 'percent', value: '15.000', trigger: 'automatic', applies_to: 'lines', weekdays: '1', min_spend: null, max_uses: null, uses: 9, given: '12.96' };
const SUMMER: Row = { ...AUTUMN, id: 6, name: 'Summer close-out', gives: 'percent', value: '25.000', trigger: 'automatic', ends_on: '2026-08-31', status: 'ended', min_spend: null, max_uses: null, uses: 0, given: '0.00' };

let said: Record<string, unknown> = {};
beforeEach(() => {
  resetWorld();
  seed('offers', [AUTUMN, LAUNCH, MUGS, SUMMER]);
  seed('codes', [{ id: 1, offer_id: 4, code: 'AUTUMN5' }, { id: 2, offer_id: 5, code: 'LAUNCH20' }]);
  seed('offer_targets', [{ id: 7, offer_id: 2, kind: 'category', source_table: 'shop:categories', source_row: '2', label: 'Mugs' }]);
  seed('offer_breaks', []);
  seed('groups', [{ id: 3, name: 'Regulars' }]);
  said = {};
  world.api = (method, path, payload) => {
    if (path.endsWith('/kit')) return { connectionId: 'c1' };
    if (path.includes('/adjusts')) return { adjusts: [], canChange: true };
    if (method === 'post' && path.endsWith('/codes/make')) return { code: (payload as { word?: string }).word ?? 'MADE1234', ...said };
    return {};
  };
});
afterEach(() => cleanup());

const field = (label: RegExp | string): HTMLInputElement => screen.getByLabelText(label) as HTMLInputElement;
const type = (label: RegExp | string, value: string): void => void fireEvent.change(field(label), { target: { value } });
const open = async (id: string | null): Promise<void> => {
  render(<Editor t={t} offerId={id} />);
  await screen.findByLabelText(/^Name \(internal\)/);
};

describe('the discounts list', () => {
  it('the list shows Used up from the stored flag', async () => {
    render(<List t={t} />);
    const rows = (await screen.findAllByRole('row')).slice(1).map((row) => [...row.querySelectorAll('td')].map((cell) => cell.textContent));
    expect(rows).toEqual([
      ['Autumn 5', '5.00 off', 'AUTUMN5', '100 uses, from 30.00', 'Active', '37', '185.00'],
      ['Launch week', '20 % off', 'LAUNCH20', '50 uses, until Oct 31', 'Used up', '50', '412.75'],
      ['Monday mugs', '15 % off Mugs', 'By itself', 'Monday, until Oct 31', 'Active', '9', '12.96'],
      ['Summer close-out', '25 % off', 'By itself', 'until Aug 31', 'Ended', '0', '0.00'],
    ]);
    // Fifty of fifty with the flag off is not "used up": the flag is the server's, not a sum made here.
    cleanup();
    seed('offers', [{ ...LAUNCH, used_up: false }]);
    render(<List t={t} />);
    expect(await screen.findByText('Active', { selector: '[data-part="status"]' })).toBeTruthy();
  });

  it('opens a discount from its row, a blank one from New discount, and says so when there is none', async () => {
    render(<List t={t} />);
    fireEvent.click((await screen.findAllByRole('row'))[1] as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'New discount' }));
    expect(world.navigated).toEqual([{ to: '/add-ons/offers/offers-discounts/4' }, { to: '/add-ons/offers/offers-discounts/new' }]);
    cleanup();
    seed('offers', []);
    world.cannot.add('create:offers');
    render(<List t={t} />);
    expect(await screen.findByText('No discounts yet')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New discount' })).toBeNull();
  });
});

describe('the discount editor', () => {
  it('a new discount is one save: the offer, its targets and its first code together', async () => {
    await open(null);
    type(/^Name \(internal\)/, 'Harvest weekend');
    type(/^What customers see/, 'Harvest weekend');
    type(/^Percent off/, '10');
    fireEvent.click(screen.getByRole('radio', { name: /^With a code/ }));
    type(/^Code/, 'harvest');
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(world.calls.some((call) => call.kind === 'tree')).toBe(true));
    expect(world.calls.find((call) => call.kind === 'tree')).toMatchObject({
      table: 'offers',
      values: { values: { name: 'Harvest weekend', public_name: { 'en-US': 'Harvest weekend' }, gives: 'percent', value: '10', trigger: 'code', applies_to: 'order', budget_open: true }, children: { offer_breaks: [], offer_targets: [], codes: [{ values: { code: 'HARVEST' } }] } },
    });
    // The word was shown to Adminium first.
    expect(world.calls.find((call) => call.kind === 'api' && call.table.endsWith('/codes/make'))).toMatchObject({ values: { word: 'HARVEST' } });
    await waitFor(() => expect(world.navigated).toHaveLength(1));
    expect(world.navigated[0]).toMatchObject({ replace: true });
    expect(world.toasts.map((toast) => toast.title)).toEqual(['Harvest weekend saved']);
  });

  it('a refused save keeps every typed value and marks the field', async () => {
    await open('4');
    type(/^Name \(internal\)/, 'Autumn five');
    type(/^Amount off/, '7.50');
    type(/^Code/, 'LAUNCH20');
    world.before = (kind) => {
      if (kind === 'update') throw new Refused('UNIQUE_VIOLATION', '', { column: 'code' });
    };
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('That code is already used by another discount.')).toBeTruthy();
    expect(field(/^Name \(internal\)/).value).toBe('Autumn five');
    expect(field(/^Amount off/).value).toBe('7.50');
    expect(field(/^Code/).value).toBe('LAUNCH20');
    // The same when Adminium says so before anything is sent to be saved.
    world.before = null;
    world.calls = [];
    said = { taken: true };
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(world.calls.some((call) => call.kind === 'api' && call.table.endsWith('/codes/make'))).toBe(true));
    expect(await screen.findByText('That code is already used by another discount.')).toBeTruthy();
    expect(world.calls.some((call) => call.kind === 'update' || call.kind === 'create')).toBe(false);
    expect(field(/^Amount off/).value).toBe('7.50');
  });

  it('a refusal that names a column lands on that field, with the server\'s own words', async () => {
    await open('4');
    type(/^Total uses/, '40');
    world.before = (kind) => {
      if (kind === 'update') throw new Refused('VALIDATION_FAILED', 'Thirty-seven are already used.', { column: 'max_uses' });
    };
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const uses = (await screen.findByText('Thirty-seven are already used.')).closest('[data-part="field"]') as HTMLElement;
    expect(within(uses).getByLabelText(/^Total uses/)).toBeTruthy();
    expect(field(/^Total uses/).value).toBe('40');
  });

  it('a look-alike warns and saves', async () => {
    await open('4');
    type(/^Code/, 'AUTUMNS');
    said = { taken: false, lookAlikes: [{ code: 'AUTUMN5', name: 'Autumn 5' }] };
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('AUTUMNS reads like AUTUMN5 (Autumn 5). Customers may mix them up.')).toBeTruthy();
    expect(world.calls.find((call) => call.kind === 'update' && call.table === 'codes')).toMatchObject({ key: '1', values: { code: 'AUTUMNS' } });
    expect(world.toasts.map((toast) => toast.title)).toEqual(['Autumn 5 saved']);
  });

  it('a code that was not changed is not asked about, and the page works no state out itself', async () => {
    await open('4');
    type(/^Amount off/, '6.00');
    // The server answers with its own state and counts.
    world.decide = (table, row) => (table === 'offers' ? { ...row, uses: 38, given: '191.00' } : row);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(world.calls.some((call) => call.kind === 'update' && call.table === 'offers')).toBe(true));
    expect(world.calls.some((call) => call.kind === 'api' && call.table.endsWith('/codes/make'))).toBe(false);
    expect(world.calls.some((call) => call.table === 'codes' && call.kind !== 'list')).toBe(false);
    expect(await screen.findByText('38 uses · 191.00 given')).toBeTruthy();
  });

  it('what needs fixing is said at the top and on each field, and nothing is sent', async () => {
    await open(null);
    fireEvent.click(screen.getByRole('button', { name: 'Switch on' }));
    expect(await screen.findByText('3 things need fixing before you can save.')).toBeTruthy();
    expect(screen.getByText('Give it a name your team will know.')).toBeTruthy();
    expect(screen.getByText('Add the line customers see on the receipt.')).toBeTruthy();
    expect(screen.getByText('Enter a percent from 1 to 100.')).toBeTruthy();
    expect(world.calls.filter((call) => call.kind !== 'api' && call.kind !== 'list')).toEqual([]);
    expect(world.toasts.map((toast) => toast.title)).toEqual(['Fix 3 things before saving']);
  });

  it('Until before From shows it can never apply, on the header and on the field', async () => {
    await open('4');
    fireEvent.change(document.querySelectorAll('input[type="date"]')[1] as HTMLInputElement, { target: { value: '2026-09-01' } });
    expect(await screen.findByText('Can never apply')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Until is before From, so this can never apply. Pick a date on or after From.')).toBeTruthy();
    expect(world.calls.some((call) => call.kind === 'update')).toBe(false);
  });

  it('Switch on saves the draft, then moves it; a refused move leaves the saved draft and says why', async () => {
    seed('offers', [{ ...AUTUMN, status: 'draft', uses: 0, given: '0.00' }]);
    await open('4');
    expect(screen.getByText('Not live yet')).toBeTruthy();
    world.move = (table, key) => {
      const row = world.tables[table]?.find((one) => String(one['id']) === key);
      if (row !== undefined) row['status'] = 'active';
    };
    fireEvent.click(screen.getByRole('button', { name: 'Switch on' }));
    await waitFor(() => expect(world.toasts.map((toast) => toast.title)).toEqual(['Autumn 5 is switched on']));
    expect(world.calls.filter((call) => call.kind === 'update' || call.kind === 'move').map((call) => [call.kind, call.table, (call.values as { to?: string }).to])).toEqual([['update', 'offers', undefined], ['move', 'offers', 'switch-on']]);
    cleanup();

    world.toasts = [];
    seed('offers', [{ ...AUTUMN, status: 'draft' }]);
    world.before = (kind) => {
      if (kind === 'move') throw new Refused('STATE_MOVE_REFUSED');
    };
    await open('4');
    fireEvent.click(screen.getByRole('button', { name: 'Switch on' }));
    expect(await screen.findByText('Ask a manager.')).toBeTruthy();
    expect(world.toasts.map((toast) => toast.title)).toEqual(['Autumn 5 saved']);
  });

  it('Pause is a move and nothing else: unsaved changes stay unsaved, and the button says so', async () => {
    await open('4');
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    type(/^Amount off/, '9.00');
    fireEvent.click(screen.getByRole('button', { name: 'Pause (your changes are not saved)' }));
    await waitFor(() => expect(world.toasts.map((toast) => toast.title)).toEqual(['Autumn 5 is paused']));
    expect(world.calls.filter((call) => call.kind === 'update' || call.kind === 'tree')).toEqual([]);
    expect(world.calls.find((call) => call.kind === 'move')).toMatchObject({ table: 'offers', key: '4', values: { to: 'pause' } });
    expect(field(/^Amount off/).value).toBe('9.00');
  });

  it('End now asks first', async () => {
    await open('4');
    fireEvent.click(screen.getByRole('button', { name: 'End now' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading').textContent).toBe('End Autumn 5 now?');
    expect(world.calls.some((call) => call.kind === 'move')).toBe(false);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(world.calls.some((call) => call.kind === 'move')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'End now' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'End now' }));
    await waitFor(() => expect(world.calls.find((call) => call.kind === 'move')).toMatchObject({ values: { to: 'end-now' } }));
  });

  it('a used-up discount is read only until the limit is raised, and cannot be raised below what is used', async () => {
    await open('5');
    expect(screen.getByText('All 50 uses are taken')).toBeTruthy();
    expect(field(/^Name \(internal\)/).disabled).toBe(true);
    expect(field(/^Total uses/).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Raise the limit' }));
    expect(field(/^Total uses/).disabled).toBe(false);
    type(/^Total uses/, '49');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('50 are already used. Enter 50 or more.')).toBeTruthy();
    type(/^Total uses/, '80');
    world.decide = (table, row) => (table === 'offers' ? { ...row, used_up: false } : row);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(world.calls.find((call) => call.kind === 'update' && call.table === 'offers')).toMatchObject({ values: { max_uses: 80 } }));
    await waitFor(() => expect(screen.queryByText('All 50 uses are taken')).toBeNull());
  });

  it('an ended discount is read only, and runs again only with an Until that is ahead', async () => {
    await open('6');
    expect(screen.getByText('This discount has ended')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Run again' }));
    const dialog = await screen.findByRole('dialog');
    const run = within(dialog).getByRole('button', { name: 'Run again' }) as HTMLButtonElement;
    expect(run.disabled).toBe(true);
    const until = dialog.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(until, { target: { value: '2020-01-01' } });
    expect(within(dialog).getByText('Choose a day after today.')).toBeTruthy();
    expect(run.disabled).toBe(true);
    fireEvent.change(until, { target: { value: '2099-12-31' } });
    fireEvent.click(run);
    await waitFor(() => expect(world.calls.find((call) => call.kind === 'move')).toMatchObject({ table: 'offers', key: '6', values: { to: 'run-again', values: { ends_on: '2099-12-31' } } }));
  });

  it('a price by quantity keeps its steps as rows: the gone removed, the kept changed, the new made', async () => {
    seed('offers', [{ ...MUGS, gives: 'quantity_price', value: null }]);
    seed('offer_breaks', [{ id: 1, offer_id: 2, from_qty: 4, value: '8.000' }, { id: 2, offer_id: 2, from_qty: 8, value: '14.000' }]);
    await open('2');
    const from = (): HTMLInputElement[] => (screen.getAllByLabelText(/^From$/) as HTMLInputElement[]).filter((input) => input.type !== 'date');
    expect(from().map((input) => input.value)).toEqual(['4', '8']);
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove this step' })[0] as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Add a step' }));
    fireEvent.change(from()[1] as HTMLElement, { target: { value: '12' } });
    fireEvent.change(screen.getAllByLabelText(/^Percent off/)[1] as HTMLElement, { target: { value: '18' } });
    fireEvent.change(screen.getAllByLabelText(/^Percent off/)[0] as HTMLElement, { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(world.calls.some((call) => call.kind === 'create' && call.table === 'offer_breaks')).toBe(true));
    expect(world.calls.filter((call) => call.table === 'offer_breaks' && call.kind !== 'list').map((call) => [call.kind, call.key, call.values])).toEqual([
      ['remove', '1', undefined],
      ['update', '2', { from_qty: 8, value: '15' }],
      ['create', undefined, { offer_id: 2, from_qty: 12, value: '18' }],
    ]);
  });

  it('a reader who may not change discounts sees the form and no way to save or move it', async () => {
    world.cannot.add('create:offers');
    await open('4');
    expect(screen.getByText('You can read this discount. A manager can change it.')).toBeTruthy();
    for (const name of ['Save', 'Pause', 'End now', 'Make one for me']) expect(screen.queryByRole('button', { name })?.hasAttribute('disabled') ?? true, name).toBe(true);
    expect(field(/^Name \(internal\)/).disabled).toBe(true);
  });

  it('Make one for me asks Adminium for the code', async () => {
    await open('4');
    fireEvent.click(screen.getByRole('button', { name: 'Make one for me' }));
    await waitFor(() => expect(field(/^Code/).value).toBe('MADE1234'));
    expect(world.calls.find((call) => call.kind === 'api' && call.table.endsWith('/codes/make'))?.values).toEqual({});
  });
});
