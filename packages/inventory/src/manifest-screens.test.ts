/**
 * THE SCREENS THAT ARE CODE.
 *
 * Five of this add-on's screens are its own code: each a file of its own that
 * the dashboard loads behind the page's permission. The manifest says where
 * each file is, where it sits in the rail, who may open it, and which buttons
 * on a record lead into it. This suite holds those to the build and to the
 * roles.
 */
import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };
import { OUTPUT } from '../vite.config.ts';

interface LinkAction {
  id: string;
  link?: { addOnPage: string; param: string };
  in?: string[];
  move?: unknown;
}
const tables = manifest.requiredSchema.tables as unknown as { ref: string; states?: { moves: Record<string, unknown[]>; actions?: LinkAction[] } }[];
const tableOf = (ref: string) => tables.find((table) => table.ref === ref)!;
const screens = manifest.addOn.pages as { ref: string; client: string; nav?: { group: string; order: number }; detail?: boolean }[];
const opens = (role: string, ref: string): boolean => manifest.roles.find((one) => one.key === role)!.permissions.includes(`page:@${ref}:view`);

describe('the screens that are code', () => {
  it('are five, each built into the file the manifest names, and they need the data kit', () => {
    expect(Object.fromEntries(screens.map((page) => [page.ref, page.client]))).toEqual(OUTPUT.pages);
    expect(manifest.addOn.hostApi).toBe(2);
    for (const page of screens) expect(page.ref.startsWith('inventory-'), page.ref).toBe(true);
  });

  it('sit in the rail between the lists, in the two groups the add-on declares, and Transfer has no row', () => {
    const groups = manifest.addOn.navGroups.map((group) => group.key);
    expect(groups).toEqual(['stock', 'stock-setup']);
    // The same two groups the generated pages sit in, so a list and a screen share one heading.
    expect((manifest as unknown as { navGroups: { key: string }[] }).navGroups.map((group) => group.key)).toEqual(groups);
    expect(Object.fromEntries(screens.map((page) => [page.ref, page.nav === undefined ? null : `${page.nav.group}:${String(page.nav.order)}`]))).toEqual({
      'inventory-receive': 'stock:50',
      'inventory-transfer': null,
      'inventory-counts': 'stock:70',
      'inventory-opening-stock': 'stock-setup:160',
      'inventory-stock-rules': 'stock-setup:170',
    });
    // No two rows of the rail share a place.
    const orders = [...(manifest as unknown as { pages: { nav: { order: number } }[] }).pages.map((page) => page.nav.order), ...screens.flatMap((page) => (page.nav === undefined ? [] : [page.nav.order]))];
    expect(new Set(orders).size).toBe(orders.length);
    // Only the counts keep addresses under their own: a count's sheet.
    expect(screens.filter((page) => page.detail === true).map((page) => page.ref)).toEqual(['inventory-counts']);
  });

  it('open for the people who work them: a clerk receives, moves and counts; a viewer reads counts; set-up is the manager\'s', () => {
    const who = (ref: string) => ['manager', 'clerk', 'viewer'].filter((role) => opens(role, ref));
    expect(who('inventory-receive')).toEqual(['manager', 'clerk']);
    expect(who('inventory-transfer')).toEqual(['manager', 'clerk']);
    expect(who('inventory-counts')).toEqual(['manager', 'clerk', 'viewer']);
    expect(who('inventory-opening-stock')).toEqual(['manager']);
    expect(who('inventory-stock-rules')).toEqual(['manager']);
  });

  it('are reached from a record by a button that names a screen the add-on ships, in states the table has', () => {
    const refs = screens.map((page) => page.ref);
    const links = ['purchase_orders', 'receipts', 'transfers'].flatMap((ref) => (tableOf(ref).states?.actions ?? []).filter((action) => action.link !== undefined).map((action) => ({ table: ref, ...action })));
    expect(links.map((action) => `${action.table}:${action.id}→${action.link?.addOnPage ?? ''}?${action.link?.param ?? ''} in ${(action.in ?? []).join('|')}`)).toEqual([
      'purchase_orders:receive→inventory-receive?po in sent|part_received',
      'receipts:continue→inventory-receive?receipt in draft|posting',
      'receipts:undo→inventory-receive?receipt in posted|reversing',
      'transfers:continue→inventory-transfer?transfer in draft|posting',
      'transfers:undo→inventory-transfer?transfer in done|reversing',
    ]);
    for (const action of links) {
      expect(refs, action.id).toContain(action.link?.addOnPage);
      const states = new Set([...Object.keys(tableOf(action.table).states!.moves), ...Object.values(tableOf(action.table).states!.moves).flatMap((moves) => moves.map((move) => (typeof move === 'string' ? move : (move as { to: string }).to)))]);
      for (const state of action.in ?? []) expect(states, `${action.table}:${action.id}`).toContain(state);
    }
  });

  it('put no move on a receipt or a transfer: their lines go in one by one, from the screen', () => {
    for (const ref of ['receipts', 'transfers']) expect((tableOf(ref).states?.actions ?? []).filter((action) => action.move !== undefined)).toEqual([]);
  });
});
