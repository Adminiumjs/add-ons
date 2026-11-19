/**
 * A PAGE'S ADDRESS: its shape judged here, the words the addresses keep
 * judged by Adminium.
 */
import { LANDING_SLUGS_RESERVED } from '@adminium/add-on-contracts/landing';
import { describe, expect, it } from 'vitest';

import { addressRefused, freeSlug, isPageSlug, slugOf } from './slug.ts';

describe('the shape of an address', () => {
  it('is lower-case letters, digits and dashes, with no dash at either end', () => {
    for (const ok of ['open-day', 'a', 'spring-2027']) expect(isPageSlug(ok), ok).toBe(true);
    for (const wrong of ['Open-day', '-open', 'open-', 'open day', '', 'x'.repeat(81), 7, null]) expect(isPageSlug(wrong), String(wrong)).toBe(false);
  });

  it('lets every word the addresses keep through: those are Adminium’s to refuse, by its own list', () => {
    expect(LANDING_SLUGS_RESERVED.length).toBeGreaterThan(8);
    for (const word of LANDING_SLUGS_RESERVED) expect(isPageSlug(word), word).toBe(true);
  });

  it('is made from a name, and the first free one is asked for', async () => {
    expect(slugOf('Spring open day')).toBe('spring-open-day');
    expect(slugOf('كبائن')).toBe('page');
    const held = new Set(['open-day', 'open-day-2']);
    expect(await freeSlug('open-day', async (slug) => held.has(slug))).toBe('open-day-3');
  });
});

describe('an address Adminium does not take', () => {
  it('is one the status read of the page names no slug for, while the row holds one', () => {
    expect(addressRefused({ page: { slug: null } }, 'login')).toBe(true);
    expect(addressRefused({ page: { slug: 'login' } }, 'login')).toBe(false);
    expect(addressRefused({ page: { slug: null } }, '')).toBe(false);
    expect(addressRefused({ page: null }, 'login')).toBe(false);
    expect(addressRefused(null, 'login')).toBe(false);
  });
});
