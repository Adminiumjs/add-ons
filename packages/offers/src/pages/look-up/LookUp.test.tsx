// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { wordsFor } from '../shared/messages.ts';
import { LOOKUP, REFUSAL, SHARED } from '../strings/index.ts';
import { Refused, resetWorld, seed, world } from '../testing/host.tsx';
import { LookUp } from './LookUp.tsx';

const t = wordsFor(SHARED, REFUSAL, LOOKUP);
const CODE = 'GC-7K2M-W3HN-Q4XP';
const BARE = '7K2MW3HNQ4XP';

type Row = Record<string, string | number | boolean | null>;
const ROWS: Row[] = [
  { at: '2026-09-18T12:00:00.000Z', kind: 'spend', amount: '-31.00', balance_after: '19.00', note: null, source_label: 'Order 118' },
  { at: '2026-08-03T11:20:00.000Z', kind: 'issue', amount: '50.00', balance_after: '50.00', note: null, source_label: 'Order 77' },
];
const cardAnswer = (row: Row = {}) => ({ kind: 'gift-card', table: 'gift_cards', key: '1', by: 'code', last4: 'Q4XP', row: { kind: 'card', status: 'active', balance: '19.00', expires_on: '2027-08-03', recipient_name: 'Ana', moved_table: '', ...row }, rows: ROWS });

beforeEach(() => {
  resetWorld();
  seed('settings', [{ id: 1, card_min: '10.00', card_max: '500.00', card_expiry_months: 12 }]);
  seed('gift_cards', [{ id: 1, kind: 'card', status: 'active', balance: '19.00' }]);
  seed('card_actions', []);
  seed('voucher_actions', []);
  seed('voucher_batches', [{ id: 3, name: 'Leaflet drop' }]);
});
afterEach(() => cleanup());

const lookUp = async (typed: string): Promise<void> => {
  const field = screen.getByLabelText("Type or scan a code, or a customer's email");
  fireEvent.change(field, { target: { value: typed } });
  fireEvent.keyDown(field, { key: 'Enter' });
  await waitFor(() => expect(world.calls.filter((call) => call.kind === 'look-up').length).toBeGreaterThan(0));
};
const desk = (): void => {
  for (const no of ['create:card_actions', 'move:gift_cards:cancel-card', 'create:voucher_batches']) world.cannot.add(no);
  world.unreadable = { gift_cards: ['code', 'recipient_email'], vouchers: ['code'] };
};

describe('Look up', () => {
  it('asks for a code before it looks anything up', async () => {
    render(<LookUp t={t} />);
    fireEvent.click(screen.getByRole('button', { name: 'Look up' }));
    expect(await screen.findByText('Type or scan a code first.')).toBeTruthy();
    expect(world.calls).toEqual([]);
  });

  it('the heading echoes the typed text and nothing else shows a whole code', async () => {
    world.lookUp = () => cardAnswer();
    const { container } = render(<LookUp t={t} />);
    await lookUp(CODE);
    expect(await screen.findByText('Gift card')).toBeTruthy();
    // Sent in the body of the one call, as typed.
    expect(world.calls.filter((call) => call.kind === 'look-up').map((call) => call.values)).toEqual([CODE]);
    // The typed text, once, in the heading; the end of the code where the card is named.
    const whole = [...container.querySelectorAll('*')].filter((node) => node.children.length === 0 && (node.textContent ?? '').replace(/[\s-]/g, '').includes(BARE));
    expect(whole).toHaveLength(1);
    expect(whole[0]?.closest('[data-slot="title"]')).not.toBeNull();
    expect(screen.getByText('···· Q4XP')).toBeTruthy();
    // And in every dialog: "the card ending Q4XP".
    for (const [button, title] of [['Top up', 'Top up the card ending Q4XP'], ['Adjust', 'Adjust the card ending Q4XP'], ['Cancel the card', 'Cancel the card ending Q4XP?']] as const) {
      fireEvent.click(screen.getByRole('button', { name: button }));
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByRole('heading').textContent).toBe(title);
      expect(dialog.textContent?.replace(/[\s-]/g, '')).not.toContain(BARE);
      // A dialog that cancels a card is left by "Keep the card": two buttons that both say Cancel say nothing.
      fireEvent.click(within(dialog).getByRole('button', { name: button === 'Cancel the card' ? 'Keep the card' : 'Cancel' }));
    }
    // Nothing navigated anywhere with it.
    expect(world.navigated).toEqual([]);
    expect(container.innerHTML).not.toContain(`href="${CODE}`);
    for (const link of container.querySelectorAll('a')) expect(link.getAttribute('href') ?? '').not.toMatch(/7K2M|Q4XP/);
  });

  it('shows what is left, when to use it by and what happened, as Adminium answered', async () => {
    world.lookUp = () => cardAnswer();
    render(<LookUp t={t} />);
    await lookUp(CODE);
    const stat = (await screen.findByText('Left')).closest('[data-part="stat"]') as HTMLElement;
    expect(within(stat).getByText('19.00')).toBeTruthy();
    expect(screen.getByText('Aug 3, 2027')).toBeTruthy();
    const rows = screen.getAllByRole('row').slice(1).map((row) => [...row.querySelectorAll('td')].map((cell) => cell.textContent));
    expect(rows).toEqual([
      ['Sep 18, 2026', 'Spent', '-31.00', '19.00', 'Order 118'],
      ['Aug 3, 2026', 'Issued', '50.00', '50.00', 'Order 77'],
    ]);
    expect(document.querySelector('[data-part="offers-status"]')?.textContent?.replace('​', '')).toBe('Gift card ending Q4XP, Active, 19.00 left');
  });

  it('the desk sees no top up, adjust or cancel', async () => {
    desk();
    world.lookUp = () => cardAnswer();
    render(<LookUp t={t} />);
    await lookUp(CODE);
    await screen.findByText('Gift card');
    for (const name of ['Top up', 'Adjust', 'Cancel the card', 'Print']) expect(screen.queryByRole('button', { name })).toBeNull();
    expect(screen.getByText('A manager can top up, adjust or cancel it.')).toBeTruthy();
    // Not told whether the card has an address, the desk may still send it again.
    expect(screen.getByRole('button', { name: 'Send again' })).toBeTruthy();
  });

  it('after a dialog saves the page looks up again', async () => {
    let balance = '19.00';
    world.lookUp = () => cardAnswer({ balance });
    render(<LookUp t={t} />);
    await lookUp(CODE);
    fireEvent.click(await screen.findByRole('button', { name: 'Top up' }));
    const dialog = await screen.findByRole('dialog');
    // The use-by date the top-up will give: a year from the reader's today, read out, decided by the server.
    expect(within(dialog).getByText(/^Use it by moves to /)).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText(/^Amount/), { target: { value: '25.00' } });
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Card' }));
    fireEvent.change(within(dialog).getByLabelText(/^Why/), { target: { value: 'Birthday top-up' } });
    world.before = () => {
      balance = '44.00';
    };
    fireEvent.click(within(dialog).getByRole('button', { name: 'Top up' }));
    await waitFor(() => expect(world.calls.filter((call) => call.kind === 'look-up')).toHaveLength(2));
    expect(world.calls.find((call) => call.kind === 'create')).toMatchObject({ table: 'card_actions', values: { card_id: 1, action: 'top_up', amount: '25.00', paid_by: 'card', reason: 'Birthday top-up' } });
    expect(world.toasts.map((toast) => toast.title)).toEqual(['Topped up 25.00']);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(within((await screen.findByText('Left')).closest('[data-part="stat"]') as HTMLElement).getByText('44.00')).toBeTruthy();
  });

  it('a refused save keeps what was typed, says why on the field and leaves the dialog open', async () => {
    world.lookUp = () => cardAnswer();
    render(<LookUp t={t} />);
    await lookUp(CODE);
    fireEvent.click(await screen.findByRole('button', { name: 'Adjust' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Adjust' }));
    expect(await within(dialog).findAllByText('Enter an amount above zero.')).toHaveLength(2);
    fireEvent.change(within(dialog).getByLabelText(/^Amount/), { target: { value: '30.00' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Adjust' }));
    expect(await within(dialog).findAllByText('Say why.')).toHaveLength(2);
    expect(world.calls.some((call) => call.kind === 'create')).toBe(false);
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Remove' }));
    fireEvent.change(within(dialog).getByLabelText(/^Why/), { target: { value: 'Loaded twice' } });
    world.before = () => {
      throw new Refused('POSTING_REFUSED', '', { reason: 'empty', left: '19.00' });
    };
    fireEvent.click(within(dialog).getByRole('button', { name: 'Adjust' }));
    expect(await within(dialog).findAllByText('The card has 19.00 left. Remove 19.00 or less.')).toHaveLength(2);
    // Removing is a negative amount; the dialog is still there with what was typed.
    expect(world.calls.find((call) => call.kind === 'create')).toMatchObject({ values: { action: 'adjust', amount: '-30.00', reason: 'Loaded twice' } });
    expect((within(dialog).getByLabelText(/^Amount/) as HTMLInputElement).value).toBe('30.00');
    expect((within(dialog).getByLabelText(/^Why/) as HTMLTextAreaElement).value).toBe('Loaded twice');
    expect(world.calls.filter((call) => call.kind === 'look-up')).toHaveLength(1);
  });

  it('cancelling is the card\'s own move, and asks why', async () => {
    world.lookUp = () => cardAnswer();
    render(<LookUp t={t} />);
    await lookUp(CODE);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel the card' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel the card' }));
    expect(await within(dialog).findAllByText('Say why.')).toHaveLength(2);
    expect(world.calls.some((call) => call.kind === 'move')).toBe(false);
    fireEvent.change(within(dialog).getByLabelText(/^Why/), { target: { value: 'Reported lost' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel the card' }));
    await waitFor(() => expect(world.toasts.map((toast) => toast.title)).toEqual(['The card ending Q4XP is cancelled']));
    expect(world.calls.find((call) => call.kind === 'move')).toMatchObject({ table: 'gift_cards', key: '1', values: { to: 'cancel-card', values: { void_reason: 'Reported lost' } } });
    expect(world.calls.some((call) => call.kind === 'create')).toBe(false);
  });

  it('an address finds credit', async () => {
    world.lookUp = (typed) => (typed === 'ana@example.com' ? { kind: 'address', table: 'gift_cards', key: '8', by: 'address', last4: null, row: { kind: 'credit', status: 'active', balance: '12.50', issued_at: '2026-09-12T09:00:00.000Z' }, rows: [] } : null);
    render(<LookUp t={t} />);
    await lookUp('ana@example.com');
    expect(await screen.findByText('Credit')).toBeTruthy();
    expect(screen.getByText('Never expires')).toBeTruthy();
    expect(screen.getByText('12.50')).toBeTruthy();
    // Credit has no code to print, cancel or send.
    for (const name of ['Print', 'Cancel the card', 'Send again', 'Top up', 'Adjust']) expect(screen.queryByRole('button', { name })).toBeNull();
    // Adding to it is one more row for the credit found.
    fireEvent.click(screen.getByRole('button', { name: 'Add credit' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Amount/), { target: { value: '5.00' } });
    fireEvent.change(within(dialog).getByLabelText(/^Why/), { target: { value: 'Late delivery' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add credit' }));
    await waitFor(() => expect(world.calls.find((call) => call.kind === 'create')).toMatchObject({ table: 'card_actions', values: { card_id: 8, action: 'top_up', amount: '5.00', reason: 'Late delivery' } }));
    expect(world.calls.some((call) => call.kind === 'tree')).toBe(false);
  });

  it('a manager gives credit to an address that has none', async () => {
    render(<LookUp t={t} />);
    await lookUp('new@example.com');
    expect(await screen.findByText('No credit for new@example.com')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Give credit' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Amount/), { target: { value: '15.00' } });
    fireEvent.change(within(dialog).getByLabelText(/^Why/), { target: { value: 'Goodwill' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Give credit' }));
    await waitFor(() => expect(world.calls.some((call) => call.kind === 'tree')).toBe(true));
    // The credit and its first row in one save.
    expect(world.calls.find((call) => call.kind === 'tree')).toMatchObject({ table: 'gift_cards', values: { values: { kind: 'credit', owner_email: 'new@example.com' }, children: { card_actions: [{ values: { action: 'issue', amount: '15.00', reason: 'Goodwill' } }] } } });
    expect(world.toasts.map((toast) => toast.title)).toEqual(['15.00 credit given to new@example.com']);
  });

  it('the desk is not offered credit for an address, and a code nothing has says so with what was typed', async () => {
    desk();
    render(<LookUp t={t} />);
    await lookUp('new@example.com');
    expect(await screen.findByText('No credit for new@example.com')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Give credit' })).toBeNull();
    cleanup();
    render(<LookUp t={t} />);
    await lookUp('GC-0000-0000-0000');
    expect(await screen.findByText('Nothing has this code · GC-0000-0000-0000')).toBeTruthy();
  });

  it('a pack shows its uses, and using one records a use and looks up again', async () => {
    let left = 6;
    world.lookUp = () => ({ kind: 'pack', table: 'vouchers', key: '5', last4: '7K2M', row: { worth: 'pack', public_name: '10 classes', status: 'issued', uses_total: 10, uses_left: left, expires_on: null, awaiting_sale: false, holder_name: 'Ana', batch_id: 3 }, rows: [] });
    render(<LookUp t={t} />);
    await lookUp('PK-AAAA-BBBB-7K2M');
    expect(await screen.findByText('Pack')).toBeTruthy();
    expect(screen.getByText('6 of 10')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('6');
    // Its batch opens as a row of the generated list.
    expect(screen.getByRole('link', { name: 'Leaflet drop' }).getAttribute('href')).toBe('/p/offers-voucher-batches/r/3');
    world.before = () => {
      left = 5;
    };
    fireEvent.click(screen.getByRole('button', { name: 'Use one now' }));
    await waitFor(() => expect(world.toasts.map((toast) => toast.title)).toEqual(['1 use recorded']));
    expect(world.calls.find((call) => call.kind === 'create')).toMatchObject({ table: 'voucher_actions', values: { voucher_id: 5, action: 'use' } });
    expect(await screen.findByText('5 of 10')).toBeTruthy();
  });

  it('a used voucher, an expired card and a card not sold yet say so and offer nothing that would be refused', async () => {
    world.lookUp = () => ({ kind: 'voucher', table: 'vouchers', key: '6', last4: 'ZZ99', row: { worth: 'amount', value: '5.000', status: 'used', uses_total: 1, uses_left: 0, expires_on: null, awaiting_sale: false }, rows: [{ at: '2026-09-20T10:00:00.000Z', state: 'counted', amount: '5.00', uses: 1, source_label: 'Order 120' }] });
    render(<LookUp t={t} />);
    await lookUp('VC-AAAA-BBBB-ZZ99');
    expect(await screen.findByText('Already used')).toBeTruthy();
    expect(screen.getByText('Used', { selector: '[data-part="status"]' })).toBeTruthy();
    for (const name of ['Mark as used', 'Send again', 'Print']) expect(screen.queryByRole('button', { name })).toBeNull();
    cleanup();

    world.lookUp = () => cardAnswer({ expires_on: '2020-01-31' });
    render(<LookUp t={t} />);
    await lookUp(CODE);
    expect(await screen.findByText('Expired Jan 31, 2020')).toBeTruthy();
    for (const name of ['Top up', 'Adjust', 'Send again', 'Print']) expect(screen.queryByRole('button', { name })).toBeNull();
    cleanup();

    world.lookUp = () => cardAnswer({ status: 'inactive', balance: '0.00', expires_on: null });
    render(<LookUp t={t} />);
    await lookUp(CODE);
    expect(await screen.findByText('Not sold yet · it cannot be spent')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Top up' })).toBeNull();
    // A card not sold yet can still be cancelled.
    expect(screen.getByRole('button', { name: 'Cancel the card' })).toBeTruthy();
  });

  it('a discount code shows its discount and whether it works, with the word whole', async () => {
    seed('offers', [{ id: 2, name: 'Autumn 5' }]);
    world.lookUp = () => ({ kind: 'code', table: 'codes', key: '3', row: { offer_id: 2, active: true, valid_until: '2026-01-31', max_uses: 50, uses: 12 } });
    render(<LookUp t={t} />);
    await lookUp('autumn5');
    expect(await screen.findByText('Discount code')).toBeTruthy();
    expect(screen.getByText('AUTUMN5')).toBeTruthy();
    expect(screen.getByText('Autumn 5')).toBeTruthy();
    expect(screen.getByText('12 of 50')).toBeTruthy();
    expect(screen.getByText('Expired Jan 31, 2026')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open the discount' }).getAttribute('href')).toBe('/add-ons/offers/offers-discounts/2');
  });

  it('a refusal about something the dialog does not draw is still said', async () => {
    world.before = (kind) => {
      if (kind === 'tree') throw new Refused('VALIDATION_FAILED', 'This is not an address anybody can be written to.', { column: 'owner_email' });
    };
    render(<LookUp t={t} />);
    await lookUp('new@example');
    fireEvent.click(await screen.findByRole('button', { name: 'Give credit' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Amount/), { target: { value: '15.00' } });
    fireEvent.change(within(dialog).getByLabelText(/^Why/), { target: { value: 'Goodwill' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Give credit' }));
    expect(await within(dialog).findByText('This is not an address anybody can be written to.')).toBeTruthy();
  });

  it('a second press while a use is being recorded records one use', async () => {
    world.lookUp = () => ({ kind: 'pack', table: 'vouchers', key: '5', last4: '7K2M', row: { worth: 'pack', public_name: '10 classes', status: 'issued', uses_total: 10, uses_left: 6, expires_on: null, awaiting_sale: false, batch_id: 3 }, rows: [] });
    world.closed.add('voucher_batches');
    render(<LookUp t={t} />);
    await lookUp('PK-AAAA-BBBB-7K2M');
    const use = await screen.findByRole('button', { name: 'Use one now' });
    fireEvent.click(use);
    fireEvent.click(use);
    await waitFor(() => expect(world.toasts).toHaveLength(1));
    expect(world.calls.filter((call) => call.kind === 'create')).toHaveLength(1);
    // A reader who may not read batches is asked for none and shown no link to one.
    expect(world.calls.some((call) => call.table === 'voucher_batches')).toBe(false);
    expect(screen.queryAllByRole('link').filter((link) => (link.getAttribute('href') ?? '').includes('voucher-batches'))).toEqual([]);
  });

  it('a print that is refused says to ask a manager, and a look-up while Offers is off says that', async () => {
    world.lookUp = () => cardAnswer();
    world.before = (kind) => {
      if (kind === 'document') throw new Refused('NOT_FOUND');
    };
    render(<LookUp t={t} />);
    await lookUp(CODE);
    fireEvent.click(await screen.findByRole('button', { name: 'Print' }));
    expect(await screen.findByText('Ask a manager to print it.')).toBeTruthy();
    world.lookUp = () => {
      throw new Refused('FEATURE_OFF');
    };
    await lookUp(CODE);
    expect(await screen.findByText('Offers is switched off right now.')).toBeTruthy();
  });

  it('a look-up that fails says so and changes nothing shown', async () => {
    world.lookUp = () => cardAnswer();
    render(<LookUp t={t} />);
    await lookUp(CODE);
    await screen.findByText('Gift card');
    world.lookUp = () => {
      throw new Refused('RATE_LIMITED');
    };
    await lookUp(CODE);
    expect(await screen.findByText('Too many tries. Wait a minute.')).toBeTruthy();
    expect(screen.getByText('Gift card')).toBeTruthy();
  });
});
