// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { wordsFor } from '../shared/messages.ts';
import type { Mapped } from '../shared/things.ts';
import { DISCOUNTS, REFUSAL, SHARED } from '../strings/index.ts';
import { Refused, resetWorld, world } from '../testing/host.tsx';
import type { Target } from './form.ts';
import { TargetPicker } from './TargetPicker.tsx';
import { TryPane, type Tried } from './TryPane.tsx';

const t = wordsFor(SHARED, REFUSAL, DISCOUNTS);

const MAPPED: Mapped = {
  connectionId: 'c1',
  canChange: true,
  tags: true,
  what: [{ table: 'tbl_products', ref: 'shop:products', label: 'Products', as: 'item' }, { table: 'tbl_categories', ref: 'shop:categories', label: 'Categories', as: 'category' }],
  adjusts: [{ table: 'tbl_orders', tableLabel: 'Orders', owner: 'shop', enabled: true, state: 'live', holding: 0, what: [], adjust: { order: { discount: 'discount' }, expect: 'total' } }],
};
const DRAFT = { name: 'Autumn 5', gives: 'amount', value: '5.00', trigger: 'code', status: 'active' };

/** The worked order: what Adminium answers for each code and buyer. */
const worked = (codes: string[], buyer: string): Tried => {
  const base = { lines: [{ table: 'order_lines', key: '1', discount: '15.00' }], told: [] };
  if (codes[0] === 'AUTUMN5') return { ...base, data: { id: 125, discount: '20.00', total: '48.06' }, applied: [{ line: '1', name: 'Tote pair', kind: 'offer', amount: '15.00', typed: false }, { line: null, name: 'Autumn 5', kind: 'code', amount: '5.00', typed: true }], refused: [], explain: [{ offer: '1', name: 'Welcome 10', applies: false, reason: 'no-code-typed' }, { offer: '2', name: 'Monday mugs', applies: false, reason: 'outside-days' }] };
  if (codes[0] === 'WELCOME10' && buyer === 'customer') return { ...base, data: { id: 125, discount: '19.95', total: '48.11' }, applied: [{ line: '1', name: 'Tote pair', kind: 'offer', amount: '15.00', typed: false }, { line: null, name: 'Welcome 10', kind: 'code', amount: '4.95', typed: true }], refused: [], explain: [] };
  if (codes[0] === 'WELCOME10') return { ...base, data: { id: 125, discount: '15.00', total: '53.46' }, applied: [{ line: '1', name: 'Tote pair', kind: 'offer', amount: '15.00', typed: false }], refused: [{ typed: 'WELCOME10', reason: 'needs-sign-in' }], explain: [{ offer: '1', name: 'Welcome 10', applies: false, reason: 'needs-sign-in' }] };
  return { ...base, data: { id: 125, discount: '15.00', total: '53.46' }, applied: [{ line: '1', name: 'Tote pair', kind: 'offer', amount: '15.00', typed: false }], refused: [], explain: [{ offer: '4', name: 'Autumn 5', applies: false, reason: 'no-code-typed' }] };
};

let tries: { path: string; body: Record<string, unknown> }[] = [];
beforeEach(() => {
  resetWorld();
  tries = [];
  window.localStorage.clear();
  world.api = (method, path, payload) => {
    if (method === 'get' && path.includes('/data/c1/tbl_orders')) return { data: [{ id: 125, number: 'Order 125' }, { id: 124, number: 'Order 124' }] };
    if (method === 'get' && path.includes('/data/c1/tbl_products')) return { data: [{ id: 7, name: 'Mug, speckled' }, { id: 8, name: 'Canvas tote' }].filter((row) => !path.includes('q=') || row.name.toLowerCase().includes(decodeURIComponent(/q=([^&]*)/.exec(path)?.[1] ?? '').toLowerCase())) };
    if (method === 'get' && path.includes('/data/c1/tbl_categories')) return { data: [{ id: 2, name: 'Mugs' }] };
    if (method === 'post' && path.endsWith('/try')) {
      const body = payload as Record<string, unknown>;
      tries.push({ path, body });
      return worked(body['codes'] as string[], body['buyer'] as string);
    }
    return {};
  };
});
afterEach(() => cleanup());

const pane = (mapped: Mapped | null = MAPPED, narrow = false): void => void render(<TryPane t={t} mapped={mapped} draft={DRAFT} offerId="4" name="Autumn 5" unsaved narrow={narrow} />);
const answer = async (): Promise<HTMLElement> => (await waitFor(() => document.querySelector('[data-part="try-answer"]') as HTMLElement | null ?? Promise.reject(new Error('no answer yet')), { timeout: 3000 })) as HTMLElement;
const figures = (node: HTMLElement): string[] => [...(node.textContent ?? '').matchAll(/\d+\.\d{2}/g)].map((match) => match[0]);

describe('the try pane', () => {
  it('every figure shown is in the reply', async () => {
    pane();
    fireEvent.change(await screen.findByLabelText(/^Code at checkout/), { target: { value: 'AUTUMN5' } });
    await waitFor(() => expect(tries.at(-1)?.body['codes']).toEqual(['AUTUMN5']), { timeout: 3000 });
    const shown = await answer();
    await waitFor(() => expect(within(shown).getByText('48.06')).toBeTruthy());
    const reply = worked(['AUTUMN5'], 'guest');
    const given = new Set([...reply.applied.map((one) => one.amount), String(reply.data['discount']), String(reply.data['total'])]);
    // Each figure on the screen is one the server sent; none is a sum or a difference made here.
    expect(figures(shown).sort()).toEqual([...given].sort());
    expect(within(shown).getByText('Tote pair')).toBeTruthy();
    expect(within(shown).getByText('Autumn 5 (draft)')).toBeTruthy();
    expect(within(shown).getByText('Welcome 10 — needs its code')).toBeTruthy();
    expect(within(shown).getByText('Monday mugs — not on this day')).toBeTruthy();
    // What is sent: the saved row, the unsaved form with its key, and a request to say why not.
    expect(tries.at(-1)).toEqual({ path: '/api/v1/data/c1/tbl_orders/try', body: { row: '125', draft: { ...DRAFT, id: 4 }, codes: ['AUTUMN5'], buyer: 'guest', explain: true } });
  });

  it('the reduction and the total are the columns Adminium answered, never a sum made here', async () => {
    // What applied adds up to 20.00; the order's own column says 19.99 (a line could not take all of its share).
    const working = world.api;
    world.api = (method, path, payload) => (path.endsWith('/try') ? { ...worked(['AUTUMN5'], 'guest'), data: { id: 125, discount: '19.99', total: '48.07' } } : working?.(method, path, payload));
    pane();
    const shown = await answer();
    expect(await within(shown).findByText('19.99', {}, { timeout: 3000 })).toBeTruthy();
    expect(within(shown).getByText('48.07')).toBeTruthy();
    expect(figures(shown)).not.toContain('20.00');
    expect(figures(shown).sort()).toEqual(['15.00', '19.99', '48.07', '5.00'].sort());
  });

  it('with nothing mapped it links to Offer rules', async () => {
    pane({ ...MAPPED, adjusts: [] });
    expect(await screen.findByText('Nothing takes discounts yet')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Offer rules' }).getAttribute('href')).toBe('/add-ons/offers/offers-rules');
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(tries).toEqual([]);
  });

  it('a guest typing WELCOME10 reads needs a signed-in customer', async () => {
    pane();
    fireEvent.change(await screen.findByLabelText(/^Code at checkout/), { target: { value: 'WELCOME10' } });
    const shown = await answer();
    expect(await within(shown).findByText('WELCOME10: needs a signed-in customer', {}, { timeout: 3000 })).toBeTruthy();
    expect(within(shown).getByText('53.46')).toBeTruthy();
    // Signed in, the same code applies, and the total is the one Adminium gives for it.
    fireEvent.click(screen.getByRole('radio', { name: 'A signed-in customer' }));
    expect(await within(shown).findByText('48.11', {}, { timeout: 3000 })).toBeTruthy();
    expect(within(shown).getByText('Welcome 10')).toBeTruthy();
    expect(within(shown).queryByText(/needs a signed-in customer/)).toBeNull();
    expect(tries.at(-1)?.body).toMatchObject({ codes: ['WELCOME10'], buyer: 'customer' });
  });

  it('tries the newest saved row, remembers the one picked, and a table with no total says tax comes later', async () => {
    pane();
    const picker = (await screen.findByLabelText(/^Tried on/)) as HTMLSelectElement;
    await waitFor(() => expect(picker.value).toBe('125'));
    fireEvent.change(picker, { target: { value: '124' } });
    await waitFor(() => expect(tries.at(-1)?.body['row']).toBe('124'), { timeout: 3000 });
    cleanup();
    pane({ ...MAPPED, adjusts: [{ ...MAPPED.adjusts[0]!, adjust: { order: { discount: 'discount' } } }] });
    await waitFor(() => expect(((screen.getByLabelText(/^Tried on/) as HTMLSelectElement).value)).toBe('124'));
    const shown = await answer();
    expect(within(shown).getByText('Tax is added when the order is saved')).toBeTruthy();
    expect(within(shown).queryByText('Total')).toBeNull();
  });

  it('a try that fails says so in the pane and changes no figure', async () => {
    pane();
    const shown = await answer();
    expect(await within(shown).findByText('53.46', {}, { timeout: 3000 })).toBeTruthy();
    const working = world.api;
    world.api = (method, path, payload) => {
      if (path.endsWith('/try')) throw new Refused('RATE_LIMITED');
      return working?.(method, path, payload);
    };
    fireEvent.change(screen.getByLabelText(/^Code at checkout/), { target: { value: 'AUTUMN5' } });
    expect(await screen.findByText('Too many tries. Wait a minute.', {}, { timeout: 3000 })).toBeTruthy();
    expect(within(shown).getByText('53.46')).toBeTruthy();
  });

  it('below the wide width it is a bar that opens a sheet', async () => {
    pane(MAPPED, true);
    const bar = await screen.findByRole('button', { name: 'Try it · 1 discount · 53.46' }, { timeout: 3000 });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(bar);
    expect(within(await screen.findByRole('dialog')).getByLabelText(/^Code at checkout/)).toBeTruthy();
  });
});

describe('the target picker', () => {
  const open = (chosen: readonly Target[] = []): { done: Target[][]; closed: number[] } => {
    const out = { done: [] as Target[][], closed: [] as number[] };
    render(<TargetPicker t={t} mapped={MAPPED} chosen={chosen} onClose={() => out.closed.push(1)} onDone={(targets) => out.done.push([...targets])} />);
    return out;
  };

  it('has a tab for each table an order sells from, by the table\'s own name, and one for tags', async () => {
    open();
    expect((await screen.findAllByRole('tab')).map((tab) => tab.textContent)).toEqual(['Products', 'Categories', 'Tags']);
    cleanup();
    render(<TargetPicker t={t} mapped={{ ...MAPPED, tags: false }} chosen={[]} onClose={() => undefined} onDone={() => undefined} />);
    expect((await screen.findAllByRole('tab')).map((tab) => tab.textContent)).toEqual(['Products', 'Categories']);
  });

  it('searches on the server, and keeps a picked row with its table\'s stored name and its own', async () => {
    const out = open();
    fireEvent.click(await screen.findByLabelText('Mug, speckled'));
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'tote' } });
    await waitFor(() => expect(screen.queryByLabelText('Mug, speckled')).toBeNull(), { timeout: 3000 });
    expect(world.calls.some((call) => call.kind === 'api' && call.table.includes('/data/c1/tbl_products') && call.table.includes('q=tote'))).toBe(true);
    fireEvent.click(await screen.findByLabelText('Canvas tote'));
    fireEvent.click(screen.getByRole('tab', { name: 'Categories' }));
    fireEvent.click(await screen.findByLabelText('Mugs'));
    expect(screen.getByText('3 chosen')).toBeTruthy();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Products · 2', 'Categories · 1', 'Tags']);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(out.done).toEqual([[
      { kind: 'item', sourceTable: 'shop:products', sourceRow: '7', label: 'Mug, speckled' },
      { kind: 'item', sourceTable: 'shop:products', sourceRow: '8', label: 'Canvas tote' },
      { kind: 'category', sourceTable: 'shop:categories', sourceRow: '2', label: 'Mugs' },
    ]]);
  });

  it('unticks what was chosen, takes a tag as a word, and Cancel changes nothing', async () => {
    const held: Target = { kind: 'item', sourceTable: 'shop:products', sourceRow: '7', label: 'Mug, speckled' };
    const out = open([held]);
    const box = (await screen.findByLabelText('Mug, speckled')) as HTMLInputElement;
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    fireEvent.click(screen.getByRole('tab', { name: 'Tags' }));
    fireEvent.change(screen.getByLabelText(/^A tag/), { target: { value: ' clearance ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('1 chosen')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(out).toEqual({ done: [], closed: [1] });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(out.done).toEqual([[{ kind: 'tag', sourceTable: '', sourceRow: 'clearance', label: 'clearance' }]]);
  });

  it('says so when nothing matches', async () => {
    open();
    fireEvent.change(await screen.findByLabelText('Search'), { target: { value: 'zzz' } });
    expect(await screen.findByText('Nothing matches that search.', {}, { timeout: 3000 })).toBeTruthy();
  });
});
