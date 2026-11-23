import { describe, expect, it } from 'vitest';

import { appsOf, canUse, draftOf, edited, isBrowserKey, isPlaceId, keyChips, NEW_DRAFT } from './model.ts';
import { PAGE_WORDS, pageWords } from './words.ts';

const PLACE = 'ChIJ7wLmn0p_j4AR3lumenSF2';
const KEY = 'test-browser-key-for-lumen-0001';
const ready = { ...NEW_DRAFT, place_id: PLACE, browser_key: KEY, restricted: true };

describe('the form', () => {
  it('starts with the tick off, on the two pages of the app', () => {
    expect(NEW_DRAFT).toEqual({ place_id: '', browser_key: '', restricted: false, on_booking: true, on_reviews: true, on_site: false });
  });

  it('reads a stored row the way each database says yes', () => {
    expect(draftOf({ place_id: PLACE, browser_key: KEY, restricted: 1, on_booking: 0, on_reviews: true, on_site: '1' })).toEqual({ place_id: PLACE, browser_key: KEY, restricted: true, on_booking: false, on_reviews: true, on_site: true });
    expect(draftOf(null)).toEqual(NEW_DRAFT);
  });

  it('can be saved and tested only with both values and the key restricted', () => {
    expect(canUse(ready)).toBe(true);
    expect(canUse({ ...ready, restricted: false })).toBe(false);
    expect(canUse({ ...ready, place_id: 'short' })).toBe(false);
    expect(canUse({ ...ready, browser_key: 'no spaces allowed in a key' })).toBe(false);
  });

  it('asks again for the restriction when the key changes, and not for anything else', () => {
    expect(edited(ready, { browser_key: `${KEY}1` }).restricted).toBe(false);
    expect(edited(ready, { browser_key: KEY }).restricted).toBe(true);
    expect(edited(ready, { place_id: `${PLACE}x` }).restricted).toBe(true);
    expect(edited(ready, { on_site: true }).restricted).toBe(true);
  });

  it('knows a Place ID and a key by their shape', () => {
    expect(isPlaceId(PLACE)).toBe(true);
    expect(isPlaceId('<script>')).toBe(false);
    expect(isBrowserKey(KEY)).toBe(true);
    expect(isBrowserKey('short')).toBe(false);
  });

  it('asks the key to allow exactly the address the box is served from', () => {
    expect(keyChips('https://admin.lumenstudio.example')).toEqual(['https://admin.lumenstudio.example/*']);
  });

  it('lists the apps it is on and switched on for', () => {
    expect(appsOf({ addOns: [{ key: 'offers', attachments: [{ attachedTo: 'shop', enabled: true }] }, { key: 'google-reviews', attachments: [{ attachedTo: 'bookings', enabled: true }, { attachedTo: 'old', enabled: false }, { attachedTo: '@dashboard', enabled: true }] }] })).toEqual(['bookings']);
    expect(appsOf(null)).toEqual([]);
  });
});

describe('the screen\'s words', () => {
  const english = PAGE_WORDS['en-US']!;

  it('are all there in all eight languages', () => {
    expect(Object.keys(PAGE_WORDS).sort()).toEqual(['ar-EG', 'cs-CZ', 'da-DK', 'de-DE', 'en-US', 'fr-FR', 'zh-CN', 'zh-TW']);
    for (const [tag, words] of Object.entries(PAGE_WORDS)) {
      expect(Object.keys(words).sort(), tag).toEqual(Object.keys(english).sort());
      for (const [key, text] of Object.entries(words)) expect(text.trim(), `${tag}.${key}`).not.toBe('');
    }
  });

  it('say the two things that keep the bill down, in every language', () => {
    for (const [tag, words] of Object.entries(PAGE_WORDS)) {
      expect(words.guardApis, tag).toContain('Maps JavaScript API');
      expect(words.guardApis, tag).toContain('Places API (New)');
      expect(words.guardQuota.length, tag).toBeGreaterThan(10);
    }
  });

  it('fall back to the language, then to English', () => {
    expect(pageWords('de-AT').save).toBe('Speichern');
    expect(pageWords('ja-JP').save).toBe('Save');
  });
});
