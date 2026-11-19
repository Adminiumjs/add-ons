/**
 * THE WEBSITE READER'S FACTS, and what every source shares: the https
 * website, the cut to the contract's sizes, and Stop.
 */
import type { WebsitePage } from '@adminium/add-on-contracts';
import { describe, expect, it } from 'vitest';

import { contextFor, reply } from '../testing/service.ts';
import { createLeadSource } from './index.ts';
import { httpsSite, words } from './shared.ts';
import { factsFrom } from './website.ts';

const PAGE: WebsitePage = {
  url: 'https://millbeck.example',
  finalUrl: 'https://www.millbeck.example/',
  name: 'Millbeck Drawing Office | Home',
  about: 'Drawings for small builders and the homes they make.',
  jsonLd: [{ name: 'Millbeck Drawing Office', phone: '0113 496 0999', address: { lines: '22 Fennel Row', town: 'Leeds', postalCode: 'LS2 0ZZ', country: 'GB' } }],
  emails: ['info@millbeck.example'],
  phones: ['0113 496 0153'],
};

describe('the website reader', () => {
  it('takes the marked-up name, the site’s own description, the site, the switchboard and the address', async () => {
    const source = createLeadSource(contextFor('website', null, () => Promise.reject(new Error('the reader calls nothing'))));
    expect(await source.fromWebsite!(PAGE)).toEqual({
      name: 'Millbeck Drawing Office',
      about: 'Drawings for small builders and the homes they make.',
      website: 'https://www.millbeck.example',
      sourceUrl: 'https://www.millbeck.example/',
      phone: '0113 496 0153',
      address: { lines: '22 Fennel Row', town: 'Leeds', postalCode: 'LS2 0ZZ', country: 'GB' },
    });
  });

  it('takes no address of a person or a company: generic addresses are not a company fact', () => {
    expect(JSON.stringify(factsFrom(PAGE))).not.toContain('info@');
  });

  it('falls back to the title, and takes no website from a page read over http', () => {
    expect(factsFrom({ ...PAGE, jsonLd: [], finalUrl: 'http://millbeck.example/', url: 'http://millbeck.example' })).toEqual({ name: 'Millbeck Drawing Office | Home', about: PAGE.about, phone: '0113 496 0153' });
  });

  it('gives no fill of its own: the engine reads, and this source only picks facts', () => {
    const source = createLeadSource(contextFor('website', null, () => Promise.reject(new Error('never'))));
    expect(source.fillCompany).toBeUndefined();
    expect(source.findCompanies).toBeUndefined();
  });
});

describe('what every source shares', () => {
  it('makes a website https: a bare domain gets https, http is asked for over https, nothing else is a website', () => {
    expect(httpsSite('www.fjordlys.example')).toBe('https://www.fjordlys.example');
    expect(httpsSite('http://fjordlys.example/om-oss')).toBe('https://fjordlys.example/om-oss');
    expect(httpsSite('HTTPS://Fjordlys.example')).toBe('https://fjordlys.example');
    for (const never of ['javascript:alert(1)', 'ftp://fjordlys.example', 'localhost', 'two words.example', '', null, `https://${'a'.repeat(2050)}.example`, 'https://user:pw@fjordlys.example']) expect(httpsSite(never), String(never)).toBeUndefined();
  });

  it('cuts text to the contract’s size by characters, never through one', () => {
    expect(words('  Kestrel   Yard  ', 300)).toBe('Kestrel Yard');
    expect(words('é'.repeat(400), 300)).toHaveLength(300);
    expect(words('   ', 10)).toBeUndefined();
  });

  it('a call stopped before it goes asks nothing, and one stopped while it waits ends at once', async () => {
    const stopped = new AbortController();
    stopped.abort();
    let asked = 0;
    const counting = () => {
      asked += 1;
      return Promise.resolve(reply(200, {}));
    };
    await expect(createLeadSource(contextFor('norway', null, counting, stopped.signal)).checkKey()).rejects.toThrow();
    expect(asked).toBe(0);

    const during = new AbortController();
    const never = () => new Promise<ReturnType<typeof reply>>(() => {});
    const running = createLeadSource(contextFor('france', null, never, during.signal)).findCompanies!({ activity: '71.11Z', place: { text: '69002', country: 'FR' }, page: { cursor: null, size: 5 } });
    during.abort();
    await expect(running).rejects.toThrow();
  });

  it('never reaches a global fetch: every call goes through the client it is handed', async () => {
    const own = globalThis.fetch;
    let fetched = 0;
    globalThis.fetch = (() => {
      fetched += 1;
      return Promise.reject(new Error('no'));
    }) as typeof fetch;
    try {
      for (const id of ['companies-house', 'france', 'norway', 'opencorporates', 'hunter', 'website']) {
        await createLeadSource(contextFor(id, 'test-key-any-1', () => Promise.resolve(reply(200, {})))).checkKey();
      }
    } finally {
      globalThis.fetch = own;
    }
    expect(fetched).toBe(0);
  });
});
