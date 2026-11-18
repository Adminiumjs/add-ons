import { beforeEach, describe, expect, it } from 'vitest';

import { resetWorld, world } from '../testing/host.tsx';
import { draftedOf, filesOf, formSpeaks, formsOf, keepPicture, makeHome, pictureFits, statusOf, statusPath, picturesPath, DOMAINS_PATH } from './engine.ts';

beforeEach(() => resetWorld());

describe('the status read', () => {
  it('reads the reach, the notice, the hosts and the page’s addresses', () => {
    const read = statusOf({
      data: {
        reach: { state: 'reachable', proxyUnchecked: true },
        notice: true,
        publicOrigin: 'https://crm.example.test',
        hosts: [{ host: 'events.example.test', home: '/x/pages/open-day' }, { host: 3 }],
        page: { key: '7', slug: 'open-day', state: 'live', addresses: [{ host: 'events.example.test', url: 'https://events.example.test/x/pages/open-day', home: true }, { nope: 1 }], canonical: 'https://events.example.test/x/pages/open-day', homeOf: ['events.example.test'] },
      },
    });
    expect(read?.reach).toEqual({ state: 'reachable', proxyUnchecked: true });
    expect(read?.hosts).toEqual([{ host: 'events.example.test', home: '/x/pages/open-day' }]);
    expect(read?.page?.addresses).toEqual([{ host: 'events.example.test', url: 'https://events.example.test/x/pages/open-day', home: true }]);
    expect(read?.page?.homeOf).toEqual(['events.example.test']);
  });

  it('reads a reply that is not one as nothing: no card is shown and nothing is blocked on it', () => {
    expect(statusOf({})).toBeNull();
    expect(statusOf({ data: { reach: {}, notice: true } })).toBeNull();
    expect(statusOf({ data: { reach: { state: 'reachable' }, notice: 'yes' } })).toBeNull();
  });

  it('asks for the page by its key', () => {
    expect(statusPath('7')).toBe('/api/v1/landing/pages/status?page=7');
  });
});

describe('pictures', () => {
  it('asks the engine to keep a file of Files as the page’s own copy, and names the copy', async () => {
    world.api = (method, path, payload) => (method === 'post' && path === picturesPath('7') && (payload as { file: string }).file === 'LIB1' ? { data: { id: 'OWN1', mime: 'image/png', sizeBytes: 3 } } : {});
    expect(await keepPicture('7', 'LIB1')).toBe('OWN1');
  });

  it('refuses a reply with no id, rather than naming nothing', async () => {
    world.api = () => ({ data: {} });
    await expect(keepPicture('7', 'LIB1')).rejects.toThrow();
  });

  it('lists only pictures from Files, with their thumbnails', () => {
    const files = filesOf({ data: [{ id: 'a', filename: 'a.png', mime: 'image/png', contentPath: '/api/v1/files/a/content', deletedAt: null }, { id: 'b', filename: 'b.svg', mime: 'image/svg+xml', contentPath: '/x' }, { id: 'c', filename: 'c.jpg', mime: 'image/jpeg', contentPath: '/c', deletedAt: 5 }] });
    expect(files).toEqual([{ id: 'a', filename: 'a.png', mime: 'image/png', src: '/api/v1/files/a/content?inline=true' }]);
  });

  it('takes a PNG, JPEG, WebP or GIF of up to 5 MB, and nothing else', () => {
    expect(pictureFits({ type: 'image/webp', size: 5 * 1024 * 1024 })).toBe(true);
    expect(pictureFits({ type: 'image/png', size: 5 * 1024 * 1024 + 1 })).toBe(false);
    expect(pictureFits({ type: 'image/svg+xml', size: 10 })).toBe(false);
    expect(pictureFits({ type: 'image/gif', size: 0 })).toBe(false);
  });
});

describe('Milo’s draft and the live forms', () => {
  it('reads the draft and what Milo left out', () => {
    expect(draftedOf({ data: { page: { v: 1, blocks: [] }, left: [{ what: 'link', block: 'b1', label: 'Book' }, { what: 'weird' }], tokens: 3 } })).toEqual({ page: { v: 1, blocks: [] }, left: [{ what: 'link', block: 'b1', label: 'Book' }] });
    expect(draftedOf({ data: {} })).toBeNull();
  });

  it('reads the live forms with their languages and where each goes after sending', () => {
    const forms = formsOf({ data: { forms: [{ addOn: 'forms', key: '12', name: 'Book', slug: 'book', languages: ['en-US', 4], ending: { kind: 'landing', addOn: 'pages', page: '8', broken: true } }, { key: 'no-add-on' }] } });
    expect(forms).toEqual([{ addOn: 'forms', key: '12', name: 'Book', slug: 'book', languages: ['en-US'], ending: { kind: 'landing', page: '8', broken: true } }]);
  });

  it('says whether a form is written in the page’s language', () => {
    const form = { addOn: 'forms', key: '1', name: 'x', slug: 'x', languages: ['de-DE', 'en'], ending: { kind: 'words' as const } };
    expect(formSpeaks(form, 'de-DE')).toBe(true);
    expect(formSpeaks(form, 'en-US')).toBe(true);
    expect(formSpeaks(form, 'ar-EG')).toBe(false);
  });
});

describe('a pages host’s home', () => {
  it('changes only that host’s home, and saves the whole map back', async () => {
    world.api = (method, path) => (method === 'get' && path === '/api/v1/surfaces' ? { domains: { 'Events.Example.Test': { kind: 'pages', home: '/x/forms/book' }, 'shop.example.test': { kind: 'app', appKey: 'shop', side: 'customer' } } } : {});
    await makeHome('events.example.test', 'open-day');
    expect(world.calls.find((call) => call.table === `put ${DOMAINS_PATH}`)?.values).toEqual({ domains: { 'Events.Example.Test': { kind: 'pages', home: '/x/pages/open-day' }, 'shop.example.test': { kind: 'app', appKey: 'shop', side: 'customer' } } });
  });

  it('changes nothing for a host that is not a pages host', async () => {
    world.api = (method, path) => (method === 'get' && path === '/api/v1/surfaces' ? { domains: { 'shop.example.test': { kind: 'app', appKey: 'shop', side: 'customer' } } } : {});
    await expect(makeHome('shop.example.test', 'open-day')).rejects.toThrow();
    expect(world.calls.some((call) => call.table.startsWith('put '))).toBe(false);
  });
});
