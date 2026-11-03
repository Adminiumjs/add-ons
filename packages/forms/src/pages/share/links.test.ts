import { checkWebsiteLine } from '@adminium/add-on-contracts/forms/websites';
import { describe, expect, it } from 'vitest';

import { campaignAt, checkSite, formLine, formLink, hostOf, loaderLine } from './links.ts';

const ctx = { self: 'https://crm.meridian.example', listed: ['https://www.meridian.example', 'https://shop.meridian.example:8443'] };

describe('the addresses a form is shared by', () => {
  it('are the engine’s: the link under /x/forms/, the loader on the public address, the place by slug', () => {
    expect(formLink('https://crm.meridian.example', 'showroom-visit')).toBe('https://crm.meridian.example/x/forms/showroom-visit');
    expect(formLink(null, 'showroom-visit')).toBeNull();
    expect(loaderLine('https://crm.meridian.example')).toBe(`<${'scr'}ipt src="https://crm.meridian.example/x/embed.js" async></${'scr'}ipt>`);
    expect(formLine('showroom-visit')).toBe('<div data-adminium-form="showroom-visit"></div>');
  });

  it('start a campaign only with an https link, as the campaign screen takes one', () => {
    expect(campaignAt('https://crm.meridian.example/x/forms/a')).toEqual({ to: '/email-templates', search: { kind: 'campaign', link: 'https://crm.meridian.example/x/forms/a' } });
    expect(campaignAt('http://crm.meridian.example/x/forms/a')).toBeNull();
    expect(campaignAt(null)).toBeNull();
  });

  it('name a website by its host, with its port when it names one', () => {
    expect(hostOf('https://shop.meridian.example:8443')).toBe('shop.meridian.example:8443');
    expect(hostOf('https://www.meridian.example')).toBe('www.meridian.example');
  });
});

describe('checking a website', () => {
  it('says of a full https origin exactly what the Privacy page’s check says of the same line', () => {
    const verdictOf: Record<string, string> = { listed: 'listed', ok: 'unlisted', self: 'self' };
    for (const line of ['https://www.meridian.example', 'https://WWW.meridian.example/', 'https://shop.meridian.example:8443', 'https://shop.meridian.example', 'https://crm.meridian.example', 'https://events.meridian.example']) {
      const shared = checkWebsiteLine(line, ctx);
      expect(checkSite(line, ctx)?.verdict, line).toBe(verdictOf[shared.code]);
    }
  });

  it('reads a bare host as https, and lets go of a path, a query and a fragment', () => {
    expect(checkSite('www.meridian.example', ctx)).toEqual({ verdict: 'listed', host: 'www.meridian.example' });
    expect(checkSite('  https://www.meridian.example/visit?x=1#top ', ctx)).toEqual({ verdict: 'listed', host: 'www.meridian.example' });
    expect(checkSite('shop.meridian.example', ctx)).toEqual({ verdict: 'unlisted', host: 'shop.meridian.example' });
    expect(checkSite('crm.meridian.example/x/forms/a', ctx)).toEqual({ verdict: 'self', host: 'crm.meridian.example' });
  });

  it('refuses what no website can be, and says nothing for nothing typed', () => {
    expect(checkSite('http://www.meridian.example', ctx)).toEqual({ verdict: 'not-https', host: 'http://www.meridian.example' });
    expect(checkSite('two words', ctx)?.verdict).toBe('not-address');
    expect(checkSite('*.meridian.example', ctx)?.verdict).toBe('not-address');
    expect(checkSite('https://user@www.meridian.example', ctx)?.verdict).toBe('not-address');
    expect(checkSite('   ', ctx)).toBeNull();
  });
});
