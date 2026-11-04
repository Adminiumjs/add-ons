/**
 * THE EDITOR'S CALLS, AS THE PUBLIC CLIENT MAKES THEM.
 *
 * A fake client records each call: the entries asked for and their filters,
 * the create's link and its session, the change made through the design's
 * own link (a client of the link key, holding that session), the code sent in
 * the header, the upload's route, the font's asset address, and the refusal
 * an order gets for a design.
 */
import { describe, expect, it } from 'vitest';

import { assetAddress, customiserApi, REFS, type ClientLike, type HeldSession, type Row } from './api.ts';
import { designRefusal } from './refusal.ts';
import { heldDesign } from './store.ts';

interface Logged {
  client: string;
  call: string;
  args: unknown[];
}

function fakeClient(name: string, log: Logged[], rows: Record<string, Row[]> = {}): ClientLike {
  let held: HeldSession | null = null;
  return {
    async config() {
      return { assets: '/api/v1/public/assets', pictures: '/api/v1/public/pictures', refs: { [REFS.fonts]: { assets: ['file'], limit: 100 }, [REFS.bases]: { limit: 100, filterable: ['id'], assets: ['outline_file'] }, [REFS.areas]: { limit: 100, filterable: ['base_id'] }, [REFS.ready]: { limit: 100, pictures: ['preview_file'] }, [REFS.parts]: { limit: 2, filterable: ['ready_design_id'] } } };
    },
    async list<T>(ref: string, options?: unknown) {
      log.push({ client: name, call: 'list', args: [ref, options] });
      return { data: (rows[ref] ?? []) as T[] };
    },
    async createWithRank<T>(ref: string, values: Row) {
      log.push({ client: name, call: 'create', args: [ref, values] });
      return { data: { id: 7, code: 'CZ00000000000007', format: 1, state: 'draft' } as T, link: { key: 'customiser-link', token: 'LINK000000000007', session: 'sess-7', expiresAt: 4_000_000_000_000 } };
    },
    async update<T>(ref: string, id: string, values: Row) {
      log.push({ client: name, call: 'update', args: [ref, id, values, held?.token] });
      return { id: 7, ...values, state: 'draft' } as T;
    },
    async openShared(token: string) {
      log.push({ client: name, call: 'openShared', args: [token] });
      if (token !== 'LINK000000000007') return 'unknown';
      held = { token: 'sess-opened', level: 'verified', expiresAt: 4_000_000_000_000 };
      return 'opened';
    },
    adoptSession(session) {
      held = { token: session.token, level: session.level ?? 'verified', expiresAt: session.expiresAt };
    },
    session: () => held,
    async upload(ref: string, column: string, _file: Blob, fileName?: string) {
      log.push({ client: name, call: 'upload', args: [ref, column, fileName, held?.token] });
      return { id: 'up_1', name: fileName ?? '', size: 3, kind: 'svg' };
    },
  };
}

function setUp(rows: Record<string, Row[]> = {}) {
  const log: Logged[] = [];
  let links = 0;
  const api = customiserApi({ shop: fakeClient('shop', log, rows), link: () => fakeClient(`link${String(++links)}`, log, rows), baseUrl: 'https://shop.example/' });
  return { api, log };
}

describe('the editor’s calls', () => {
  it('reads one base’s catalogue through the add-on’s entries on the app’s key, the parts of its designs only', async () => {
    const { api, log } = setUp({ [REFS.ready]: [{ id: 11, base_id: 3 }, { id: 12, base_id: 3 }, { id: 13, base_id: 4 }] });
    const read = await api.catalogue(3);
    // Rows of another base, which the entry could not filter, are left out here.
    expect(read.ready.map((one) => one['id'])).toEqual([11, 12]);
    const asked = log.filter((one) => one.client === 'shop' && one.call === 'list').map((one) => [one.args[0], (one.args[1] as { where?: unknown }).where, (one.args[1] as { limit?: number }).limit]);
    // A filter only where the entry lets its column be filtered, at most the rows it answers at once.
    expect(asked).toContainEqual([REFS.bases, { column: 'id', op: 'eq', value: 3 }, 100]);
    expect(asked).toContainEqual([REFS.areas, { column: 'base_id', op: 'eq', value: 3 }, 100]);
    expect(asked).toContainEqual([REFS.ready, undefined, 100]);
    expect(asked).toContainEqual([REFS.parts, { column: 'ready_design_id', op: 'in', value: [11, 12] }, 2]);
    // An entry that says nothing is asked fifty at a time.
    expect(asked).toContainEqual([REFS.palettes, undefined, 50]);
  });

  it('saves a new design with its format, its address and its files, and keeps the session its link answered', async () => {
    const { api, log } = setUp();
    const saved = await api.create({ base_id: 3, ready_design_id: 11, values: { parts: { words: { text: 'Ada' } } } }, 'ada@example.com', { logo_file: 'up_1' });
    expect(log[0]).toEqual({ client: 'shop', call: 'create', args: [REFS.designs, { format: 1, base_id: 3, ready_design_id: 11, values: { parts: { words: { text: 'Ada' } } }, logo_file: 'up_1', email: 'ada@example.com' }] });
    expect(saved).toMatchObject({ id: 7, code: 'CZ00000000000007', state: 'draft', session: { token: 'sess-7', level: 'verified' }, files: { logo_file: 'up_1' } });
    // The link's own code is held to show the customer, and never in what a browser keeps.
    expect(saved.link).toBe('LINK000000000007');
    expect(JSON.stringify(heldDesign(saved, 'ada@example.com'))).not.toContain('LINK000000000007');
    const none = await api.create({ base_id: 3, ready_design_id: null, values: { parts: {} } }, null);
    expect(log[1]!.args[1]).not.toHaveProperty('email');
    expect(none.ready_design_id).toBeNull();
  });

  it('changes a draft through its own link, on a fresh client of the link key holding its session, never the address', async () => {
    const { api, log } = setUp();
    const saved = await api.create({ base_id: 3, ready_design_id: 11, values: { parts: {} } }, 'ada@example.com');
    await api.change(saved, { parts: { words: { text: 'Ada Lovelace' } } });
    const change = log.find((one) => one.call === 'update')!;
    expect(change.client).toBe('link1');
    expect(change.args).toEqual([REFS.own, '7', { format: 1, base_id: 3, ready_design_id: 11, values: { parts: { words: { text: 'Ada Lovelace' } } } }, 'sess-7']);
    await expect(api.change({ ...saved, session: null }, { parts: {} })).rejects.toThrow();
  });

  it('opens a design by its e-mailed link, and reads it through that link', async () => {
    const { api, log } = setUp({ [REFS.own]: [{ id: 7, code: 'CZ00000000000007', base_id: 3, ready_design_id: 11, values: JSON.stringify({ parts: { words: { text: 'Ada' } } }), state: 'draft', updated_at: '2026-08-06T16:12:00Z', logo_file: 'file_x' }] });
    const opened = await api.openLink('LINK000000000007');
    expect(opened).toMatchObject({ id: 7, values: { parts: { words: { text: 'Ada' } } }, session: { token: 'sess-opened' }, files: { logo_file: 'file_x' }, updatedAt: '2026-08-06T16:12:00Z' });
    expect(log.find((one) => one.call === 'list')!.args[0]).toBe(REFS.own);
    expect(await api.openLink('SOMETHINGELSE000')).toBe('unknown');
    expect(await api.reopen({ token: 'old', level: 'verified', expiresAt: 1 })).toBeNull();
  });

  it('reads an ordered design by its code, in the header, with the app’s own session', async () => {
    const { api, log } = setUp({ [REFS.byCode]: [{ id: 9, base_id: 3, ready_design_id: 11, values: { parts: {} }, state: 'ordered' }] });
    const [found] = await api.byCodes(['CZ00000000000009']);
    expect(log[0]).toEqual({ client: 'shop', call: 'list', args: [REFS.byCode, { code: 'CZ00000000000009', limit: 1 }] });
    expect(found).toMatchObject({ id: 9, code: 'CZ00000000000009', state: 'ordered', session: null });
  });

  it('sends a file through the app’s key before the first save, and through the design’s link after', async () => {
    const { api, log } = setUp();
    await api.upload!('logo_file', new Blob(['<svg/>']), 'logo.svg', null);
    await api.upload!('logo_file', new Blob(['<svg/>']), 'logo.svg', { token: 'sess-7', level: 'verified', expiresAt: 4_000_000_000_000 });
    expect(log.map((one) => [one.client, ...one.args])).toEqual([
      ['shop', REFS.designs, 'logo_file', 'logo.svg', undefined],
      ['link1', REFS.own, 'logo_file', 'logo.svg', 'sess-7'],
    ]);
  });

  it('hands each ready-made design its preview picture’s address as the public client builds it, and none without one', async () => {
    const id = 'file_01HZY0000000000000000000CD';
    const { api } = setUp({ [REFS.ready]: [{ id: 11, base_id: 3, preview_file: id }, { id: 12, base_id: 3, preview_file: null }] });
    const read = await api.catalogue(3);
    expect(read.ready.map((one) => one['preview_url'])).toEqual([`https://shop.example/api/v1/public/pictures/${REFS.ready}/11/preview_file/${id}`, null]);
  });

  it('builds a font’s asset address as the public client does, and none for a font with no file', async () => {
    const { api } = setUp();
    const id = 'file_01HZY0000000000000000000AB';
    expect(await api.fontUrl({ id: 4, file: id })).toBe(`https://shop.example/api/v1/public/assets/${REFS.fonts}/4/file/${id}`);
    expect(await api.fontUrl({ id: 4, file: null })).toBeNull();
    expect(assetAddress('https://x', '/a', [], REFS.fonts, 4, 'file', id)).toBeNull();
  });

  it('builds a piece’s outline address, which its 3D preview is made from, and none for a piece with no outline', async () => {
    const { api } = setUp();
    const id = 'file_01HZY0000000000000000000EF';
    expect(await api.outlineUrl?.({ id: 3, outline_file: id })).toBe(`https://shop.example/api/v1/public/assets/${REFS.bases}/3/outline_file/${id}`);
    expect(await api.outlineUrl?.({ id: 3, outline_file: null })).toBeNull();
  });
});

describe('a refusal an order gets for a design', () => {
  it('is read from the public client’s error by its reason and part', () => {
    expect(designRefusal({ code: 'PUBLIC_WRITE_REFUSED', params: { child: 'order_lines', index: 0, column: 'design_code', reason: 'too-long', part: 'words' } })).toEqual({ reason: 'too-long', part: 'words' });
    expect(designRefusal({ code: 'PUBLIC_WRITE_REFUSED', params: { reason: 'design-unknown' } })).toEqual({ reason: 'design-unknown' });
    // A reason outside Adminium's closed list, another code, or nothing at all is no design refusal.
    expect(designRefusal({ code: 'PUBLIC_WRITE_REFUSED', params: { reason: 'feature-not-paid', feature: 'logo' } })).toBeNull();
    expect(designRefusal({ code: 'PUBLIC_RATE_LIMITED', params: {} })).toBeNull();
    expect(designRefusal(new Error('x'))).toBeNull();
  });
});
