// @vitest-environment jsdom
/**
 * YOUR DESIGNS (BC-C2, MC-D2), THE WAYS IN (MC-0.WAYS, MC-A1) AND THE
 * HELPERS AN APP CALLS (CR4: a saved link, or the order lookup's codes).
 */
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { hasSavedDesigns, heldDesign, liveDesigns, openSavedLink, readDesigns, WaysIn, YourDesigns, type HeldDesign } from './index.ts';
import { drawn, setWidth, settle } from './testing/render.tsx';
import { stubApi } from './testing/stub.ts';

afterEach(cleanup);
beforeEach(() => setWidth(1280));

async function savedOne(stub: ReturnType<typeof stubApi>, words: string, email = 'iris@example.com'): Promise<HeldDesign> {
  const saved = await stub.api.create({ base_id: stub.ids.coasters, ready_design_id: stub.ids.twoLines, values: { parts: { top: { text: words }, date: { text: '5.9.2026' } } } }, email);
  return heldDesign(saved, email)!;
}

describe('the designs a browser holds', () => {
  it('keeps only the session of a saved design, never its link', async () => {
    const stub = stubApi('maker');
    const held = await savedOne(stub, 'Anna & Ben');
    expect(Object.keys(held).sort()).toEqual(['base', 'email', 'id', 'savedAt', 'session']);
    expect(JSON.stringify(held)).not.toContain(stub.designs.get(String(held.id))!.link);
    expect(hasSavedDesigns([held])).toBe(true);
    // A session that has ended is no design of this browser's.
    const ended = { ...held, session: { ...held.session, expiresAt: Date.now() - 1 } };
    expect(hasSavedDesigns([ended])).toBe(false);
    expect(liveDesigns([ended, held])).toEqual([held]);
    expect(heldDesign({ ...(await stub.api.byCodes(['BR2289R4W8N2T6JC']))[0]! }, null)).toBeNull();
  });

  it('opens a design by its e-mailed link, and says when the link opens nothing', async () => {
    const stub = stubApi('maker');
    const held = await savedOne(stub, 'Anna & Ben');
    const link = stub.designs.get(String(held.id))!.link;
    const opened = await openSavedLink(stub.api, link);
    expect(typeof opened === 'string' ? opened : opened.values.parts['top']).toEqual({ text: 'Anna & Ben' });
    expect(await openSavedLink(stub.api, 'NOSUCHLINK000000')).toBe('unknown');
  });

  it('reads the designs an order names by their codes', async () => {
    const stub = stubApi('printing');
    const found = await readDesigns(stub.api, ['MP4112C8G2S6E4WB', 'NOPE']);
    expect(found).toHaveLength(1);
    expect(found[0]!.values.parts['name']).toEqual({ text: 'Nell Fairweather' });
  });
});

describe('Your designs', () => {
  it('lists the designs this browser holds: drawn, their words, the product and design, when they last changed, open, order, delete', async () => {
    const stub = stubApi('maker');
    const held = [await savedOne(stub, 'Anna & Ben')];
    const onOpen = vi.fn();
    const onOrder = vi.fn();
    await drawn(<YourDesigns api={stub.api} held={held} onOpen={onOpen} onOrder={onOrder} onForget={() => {}} />);
    await settle();
    expect(screen.getByRole('heading', { name: 'Your designs' })).toBeTruthy();
    expect(screen.getByText('Only you can see these. You opened them with the link we e-mailed to iris@example.com.')).toBeTruthy();
    const row = screen.getByRole('listitem');
    expect(row.textContent).toContain('Anna & Ben · 5.9.2026');
    expect(row.textContent).toContain('Engraved walnut coasters · Two lines');
    expect(row.textContent).toMatch(/Last changed \w{3},? /);
    fireEvent.click(within(row).getByRole('button', { name: 'Open Anna & Ben · 5.9.2026' }));
    fireEvent.click(within(row).getByRole('button', { name: 'Order Anna & Ben · 5.9.2026' }));
    expect((onOpen.mock.calls[0]![0] as { id: unknown }).id).toBe(held[0]!.id);
    expect(onOrder).toHaveBeenCalledTimes(1);
  });

  it('asks before taking one off, then offers Undo', async () => {
    const stub = stubApi('maker');
    const held = [await savedOne(stub, 'Anna & Ben')];
    const onForget = vi.fn();
    const onRestore = vi.fn();
    await drawn(<YourDesigns api={stub.api} held={held} onOpen={() => {}} onOrder={() => {}} onForget={onForget} onRestore={onRestore} />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Anna & Ben · 5.9.2026' }));
    const ask = screen.getByRole('alertdialog', { name: 'Delete “Anna & Ben · 5.9.2026”?' });
    expect(ask.textContent).toContain('Orders you’ve already placed keep their copy.');
    fireEvent.click(within(ask).getByRole('button', { name: 'Delete it' }));
    expect(onForget).toHaveBeenCalledWith(held[0]);
    expect(screen.queryByRole('listitem')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onRestore).toHaveBeenCalledWith(held[0]);
    expect(screen.getByRole('listitem')).toBeTruthy();
  });

  it('shows the designs an order names after the lookup, and says how they were opened', async () => {
    const stub = stubApi('printing');
    await drawn(<YourDesigns api={stub.api} look="print" shop="Marlow Press" codes={['MP4112C8G2S6E4WB']} onOpen={() => {}} onOrder={() => {}} />);
    await settle();
    expect(stub.calls.find((one) => one.call === 'byCodes')!.args).toEqual([['MP4112C8G2S6E4WB']]);
    expect(screen.getByText('Opened after you found your order. Only you can see these.')).toBeTruthy();
    const row = screen.getByRole('listitem');
    expect(row.textContent).toContain('Harbour — Nell Fairweather');
    expect(row.textContent).toContain('Business cards · 85 × 55 mm');
    // A design the order holds is not this browser's to take off a list.
    expect(within(row).queryByRole('button', { name: /^Delete/ })).toBeNull();
  });

  it('says so when there are none, and leads back', async () => {
    const stub = stubApi('maker');
    const onChoose = vi.fn();
    await drawn(<YourDesigns api={stub.api} held={[]} onOpen={() => {}} onOrder={() => {}} onChoose={onChoose} />);
    await settle();
    expect(screen.getByText('No saved designs')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back to the shop' }));
    expect(onChoose).toHaveBeenCalled();
  });
});

describe('the ways in (MC-0.WAYS)', () => {
  it('offers Choose a design only when the product has designs, then the other two, in that order', async () => {
    const stub = stubApi('printing');
    const onChoose = vi.fn();
    await drawn(<WaysIn api={stub.api} base={stub.ids.cards} product="business cards" onChoose={onChoose} onStartBlank={() => {}} onSendOwnFile={() => {}} />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const group = screen.getByRole('group', { name: 'How would you like to make it?' });
    expect(within(group).getAllByRole('button').map((one) => one.querySelector('.cz-door-title')!.textContent)).toEqual(['Choose a design', 'Start from blank', 'Send your own file']);
    expect(group.textContent).toContain('8 designs');
    expect(group.textContent).toContain('85 × 55 mm + 3 mm bleed');
    fireEvent.click(within(group).getAllByRole('button')[0]!);
    expect(onChoose).toHaveBeenCalled();
    cleanup();
    await drawn(<WaysIn api={stub.api} base={stub.ids.flyers} product="A5 flyers" onChoose={() => {}} onStartBlank={() => {}} onSendOwnFile={() => {}} />);
    await settle();
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByText('There are no ready-made designs for A5 flyers yet.')).toBeTruthy();
  });
});
