/**
 * WHICH COPY THE LANDING ROUTES ARE ASKED ABOUT.
 *
 * The kit's read (which the dashboard names the copy on) says which database
 * the add-on's tables are on; from then on every landing route names it as
 * `?connectionId=`, the rule's second selector, and an address the canvas
 * draws a picture from carries it too. Until then, or when the kit cannot
 * say, nothing is named.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { readFunnelRule, readLiveForms, readStatus, readViews, type EngineApi } from './engine.ts';
import { connectionOf, kitPath, landingPath, readScope, scopeLanding, scopedConnection } from './install.ts';
import { draftPath, formsPath, pictureSrc, picturesPath, statusPath } from './pages/editor/engine.ts';

function fake(answer: (path: string) => unknown = () => ({ data: {} })): EngineApi & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    get: async (path: string) => {
      asked.push(path);
      return answer(path);
    },
  };
}

afterEach(() => scopeLanding(null));

describe('the copy a page is open for', () => {
  it('is the database the kit’s read names, asked on the add-on’s own kit route', async () => {
    const api = fake(() => ({ connectionId: 'conn-crm', tables: {}, hosts: [], has: {}, currency: null }));
    expect(await readScope(api.get, 'pages')).toBe('conn-crm');
    expect(api.asked).toEqual(['/api/v1/add-ons/pages/kit']);
    expect(kitPath('pages')).toBe('/api/v1/add-ons/pages/kit');
    expect(scopedConnection()).toBe('conn-crm');
  });

  it('is none when the kit says none, says something else, or fails', async () => {
    expect(connectionOf({ connectionId: '' })).toBeNull();
    expect(connectionOf({ connectionId: 7 })).toBeNull();
    expect(connectionOf(null)).toBeNull();
    scopeLanding('conn-old');
    expect(
      await readScope(async () => {
        throw new Error('not found');
      }, 'pages'),
    ).toBeNull();
    expect(scopedConnection()).toBeNull();
  });
});

describe('every landing route', () => {
  it('names the copy’s database once the kit has said it, after any question already asked', async () => {
    scopeLanding('conn crm');
    const api = fake();
    await readStatus(api, 'pages');
    await readStatus(api, 'pages', '12');
    await readLiveForms(api, 'pages');
    await readFunnelRule(api, 'pages', '3');
    expect(api.asked).toEqual([
      '/api/v1/landing/pages/status?connectionId=conn%20crm',
      '/api/v1/landing/pages/status?page=12&connectionId=conn%20crm',
      '/api/v1/landing/pages/forms?connectionId=conn%20crm',
      '/api/v1/landing/pages/funnels/3/rule?connectionId=conn%20crm',
    ]);
    expect([statusPath('5'), picturesPath('5'), draftPath(), formsPath(), pictureSrc('5', 'f-1')]).toEqual([
      '/api/v1/landing/pages/status?page=5&connectionId=conn%20crm',
      '/api/v1/landing/pages/pictures?page=5&connectionId=conn%20crm',
      '/api/v1/landing/pages/draft?connectionId=conn%20crm',
      '/api/v1/landing/pages/forms?connectionId=conn%20crm',
      '/api/v1/landing/pages/pictures/f-1?page=5&connectionId=conn%20crm',
    ]);
  });

  it('names nothing while no copy is known: a server with one install answers for it', () => {
    expect(landingPath('/api/v1/landing/pages/status')).toBe('/api/v1/landing/pages/status');
    expect(statusPath('5')).toBe('/api/v1/landing/pages/status?page=5');
    scopeLanding('');
    expect(landingPath('/api/v1/landing/pages/forms')).toBe('/api/v1/landing/pages/forms');
  });

  it('but not the views read, which names the install itself', async () => {
    scopeLanding('conn-crm');
    const api = fake();
    await readViews(api, { installId: 'i-pages', kind: 'page', things: ['1'], from: '2026-07-01', to: '2026-07-28' });
    expect(api.asked).toEqual(['/api/v1/views?installId=i-pages&kind=page&things=1&from=2026-07-01&to=2026-07-28']);
  });
});
