// @vitest-environment jsdom
/**
 * THE SANDBOXED BOX. What it takes from the page around it, what it draws of
 * Google's answer, and what it never does: load anything before it is asked,
 * ask twice, or let a word or a link of a review be anything but text.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { drawFailed, drawPlace, placeUrl, prepare, REVIEWS_SHOWN, writeReviewUrl, type PlaceAnswer } from './box.ts';
import { CHANNEL, googleLink, HEIGHT_MOST, readHeight, readShow } from './protocol.ts';
import { BOX_WORDS, wordsFor } from './words.ts';

const PLACE = 'ChIJ7wLmn0p_j4AR3lumenSF2';
const KEY = 'test-browser-key-for-lumen-0001';
const show = { channel: CHANNEL, event: 'show', placeId: PLACE, browserKey: KEY, language: 'en-US' };
const review = (n: number, more = {}) => ({ rating: 5, text: `Review ${String(n)}`, relativePublishTimeDescription: 'a week ago', authorAttribution: { displayName: `Person ${String(n)}`, uri: 'https://www.google.com/maps/contrib/1', photoURI: 'https://lh3.googleusercontent.com/a/photo' }, ...more });
const place = (more: Partial<PlaceAnswer> = {}): PlaceAnswer => ({ rating: 4.8, userRatingCount: 127, googleMapsURI: 'https://maps.google.com/?cid=1', reviews: [review(1), review(2)], ...more });
const draw = (answer: PlaceAnswer, language = 'en-US', reviewLink?: string) => drawPlace(document, answer, wordsFor(language), { placeId: PLACE, language, reviewLink });
const links = () => [...document.querySelectorAll('a')].map((a) => a.href);

beforeEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
});

describe('what it takes from the page around it', () => {
  it('is one message of exactly this shape', () => {
    expect(readShow(show)).toEqual(show);
    for (const bad of [null, 'show', {}, { ...show, channel: 'other' }, { ...show, event: 'height' }, { ...show, placeId: 'x' }, { ...show, placeId: '"><script>' }, { ...show, browserKey: 'short' }, { ...show, browserKey: 'a key&callback=evil-function-name' }, { ...show, language: 'en"' }]) {
      expect(readShow(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it('keeps a "Review us" link only when it is Google\'s', () => {
    expect(readShow({ ...show, reviewLink: 'https://g.page/r/abc/review' })?.reviewLink).toBe('https://g.page/r/abc/review');
    expect(readShow({ ...show, reviewLink: 'https://evil.example/review' })?.reviewLink).toBeUndefined();
  });

  it.each(['javascript:alert(1)', 'http://www.google.com/', 'https://google.com.evil.example/', 'https://www.google.com@evil.example/', 'https://evilgoogle.com/', 'https://google.abc.de/', 'https://www.google.evil.co/', 'data:text/html,x', 42])('refuses %s as a link', (value) => {
    expect(googleLink(value)).toBeNull();
  });

  it.each(['https://www.google.com/maps/place/x', 'https://maps.google.com/?cid=1', 'https://search.google.com/local/writereview', 'https://g.page/r/abc', 'https://maps.app.goo.gl/abc'])('takes %s as a link', (value) => {
    expect(googleLink(value)).not.toBeNull();
  });

  it('tells the page around it a height it can trust', () => {
    expect(readHeight({ channel: CHANNEL, event: 'height', px: 321.2 })).toBe(322);
    expect(readHeight({ channel: CHANNEL, event: 'height', px: 1e9 })).toBe(HEIGHT_MOST);
    expect(readHeight({ channel: CHANNEL, event: 'height', px: -5 })).toBe(0);
    expect(readHeight({ channel: CHANNEL, event: 'height', px: Number.NaN })).toBeNull();
    expect(readHeight({ channel: 'other', event: 'height', px: 10 })).toBeNull();
  });
});

describe('what it draws', () => {
  it('shows the rating and how many, in the visitor\'s own numbers', () => {
    draw(place());
    expect(document.body.textContent).toContain('4.8');
    expect(document.body.textContent).toContain('127 reviews');
    expect(document.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('4.8 out of 5 stars');
    draw(place({ userRatingCount: 1234 }), 'de-DE');
    expect(document.body.textContent).toContain('4,8');
    expect(document.body.textContent).toContain('1.234 Bewertungen');
  });

  it(`shows at most ${String(REVIEWS_SHOWN)} reviews, in the order Google gave them`, () => {
    draw(place({ reviews: [1, 2, 3, 4, 5, 6, 7].map((n) => review(n)) }));
    expect([...document.querySelectorAll('.text')].map((p) => p.textContent)).toEqual(['Review 1', 'Review 2', 'Review 3', 'Review 4', 'Review 5']);
  });

  it('credits each author with a link to their Google profile, and says whose order this is', () => {
    draw(place());
    const author = document.querySelector('li a') as HTMLAnchorElement;
    expect(author.textContent).toBe('Person 1');
    expect(author.href).toBe('https://www.google.com/maps/contrib/1');
    expect(document.body.textContent).toContain('Most relevant first, as Google orders them');
  });

  it('carries Google\'s credit, never translated', () => {
    draw(place(), 'ar-EG');
    const credit = document.querySelector('.credit')!;
    expect(credit.textContent).toBe('Google Maps');
    expect(credit.getAttribute('translate')).toBe('no');
  });

  it('offers "Read all" and "Review us" on Google, opening away from the page', () => {
    draw(place());
    expect(links()).toEqual(expect.arrayContaining(['https://maps.google.com/?cid=1', writeReviewUrl(PLACE)]));
    for (const a of document.querySelectorAll('a')) {
      expect(a.target).toBe('_blank');
      expect(a.rel).toContain('noopener');
    }
    draw(place(), 'en-US', 'https://g.page/r/abc/review');
    expect(links()).toContain('https://g.page/r/abc/review');
  });

  it('draws what a review says as text, whatever it says', () => {
    draw(place({ reviews: [review(1, { text: '<img src=x onerror=alert(1)><script>alert(2)</script>', authorAttribution: { displayName: '<b>Bold</b>', uri: 'javascript:alert(3)', photoURI: 'https://evil.example/x.png' } })] }));
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('li img')).toBeNull();
    expect(document.querySelector('li b')).toBeNull();
    expect(document.querySelector('.text')!.textContent).toContain('<img src=x');
    expect(document.querySelector('li strong')!.textContent).toBe('<b>Bold</b>');
    expect(links().some((href) => href.startsWith('javascript:'))).toBe(false);
  });

  it('says so when Google has none, and still offers both links', () => {
    draw(place({ reviews: [], rating: null, userRatingCount: null, googleMapsURI: null }));
    expect(document.body.textContent).toContain('No reviews on Google yet.');
    expect(links()).toEqual(expect.arrayContaining([placeUrl(PLACE), writeReviewUrl(PLACE)]));
  });

  it('says plainly when Google could not be asked, with the way to read them anyway', () => {
    drawFailed(document, wordsFor('en-US'), PLACE);
    expect(document.querySelector('[role="alert"]')!.textContent).toBe('Google’s reviews could not be loaded.');
    expect(links()).toEqual([placeUrl(PLACE)]);
  });

  it('sets the page\'s language and direction', () => {
    prepare(document, 'ar-EG', true);
    expect(document.documentElement.lang).toBe('ar-EG');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    prepare(document, 'en-US', false);
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('has its words in all eight languages', () => {
    expect(Object.keys(BOX_WORDS).sort()).toEqual(['ar-EG', 'cs-CZ', 'da-DK', 'de-DE', 'en-US', 'fr-FR', 'zh-CN', 'zh-TW']);
    for (const [tag, words] of Object.entries(BOX_WORDS)) expect(Object.keys(words).sort(), tag).toEqual(Object.keys(BOX_WORDS['en-US']!).sort());
    expect(wordsFor('fr-CA').readAll).toBe('Tout lire sur Google');
    expect(wordsFor('ja-JP').readAll).toBe('Read all on Google');
  });
});

describe('the page\'s one script', () => {
  const fetchFields = vi.fn(async () => undefined);
  let posted: unknown[] = [];
  const listeners: EventListener[] = [];
  const scripts = () => [...document.head.querySelectorAll('script')];
  const from = (source: unknown, data: unknown) => window.dispatchEvent(new MessageEvent('message', { data, source: source as MessageEventSource }));

  beforeEach(async () => {
    vi.resetModules();
    posted = [];
    fetchFields.mockClear();
    vi.spyOn(window, 'postMessage').mockImplementation(((message: unknown) => void posted.push(message)) as never);
    vi.stubGlobal('ResizeObserver', class { observe(): void {} });
    // Each test loads the script afresh: the one before it must not still be listening.
    const add = window.addEventListener.bind(window);
    vi.spyOn(window, 'addEventListener').mockImplementation(((type: string, listener: EventListener) => {
      if (type === 'message') listeners.push(listener);
      add(type, listener);
    }) as never);
    await import('./index.ts');
  });
  afterEach(() => {
    for (const listener of listeners.splice(0)) window.removeEventListener('message', listener);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete (window as unknown as Record<string, unknown>)['google'];
  });

  const answer = () => {
    class Place { rating = 4.5; userRatingCount = 9; reviews = [review(1)]; googleMapsURI = 'https://maps.google.com/?cid=1'; fetchFields = fetchFields; }
    (window as unknown as Record<string, unknown>)['google'] = { maps: { importLibrary: async () => ({ Place }) } };
    (window as unknown as { __adminiumMapsLoaded: () => void }).__adminiumMapsLoaded();
  };

  it('says it is ready, and loads nothing from Google until it is asked', () => {
    expect(posted).toContainEqual({ channel: CHANNEL, event: 'ready' });
    expect(scripts()).toEqual([]);
  });

  it('takes the question only from the window that framed it', () => {
    from(null, show);
    from({}, show);
    expect(scripts()).toEqual([]);
  });

  it('loads Google once with the key, asks once for the fields it shows, and draws the answer', async () => {
    from(window.parent, show);
    const [script] = scripts();
    const url = new URL(script!.getAttribute('src')!);
    expect(url.origin + url.pathname).toBe('https://maps.googleapis.com/maps/api/js');
    expect(url.searchParams.get('key')).toBe(KEY);
    expect(url.searchParams.get('language')).toBe('en-US');
    answer();
    await vi.waitFor(() => expect(document.querySelector('.text')?.textContent).toBe('Review 1'));
    expect(fetchFields).toHaveBeenCalledTimes(1);
    expect(fetchFields).toHaveBeenCalledWith({ fields: ['displayName', 'rating', 'userRatingCount', 'googleMapsURI', 'reviews'] });
    // A second message asks nothing more.
    from(window.parent, { ...show, placeId: 'ChIJanotherPlaceEntirely' });
    expect(scripts()).toHaveLength(1);
  });

  it('writes nothing to any store of the browser', async () => {
    const stores = [vi.spyOn(Storage.prototype, 'setItem')];
    from(window.parent, show);
    answer();
    await vi.waitFor(() => expect(document.querySelector('.text')).not.toBeNull());
    for (const store of stores) expect(store).not.toHaveBeenCalled();
    expect(document.cookie).toBe('');
  });

  it('says it failed when Google refuses the key', () => {
    from(window.parent, show);
    (window as unknown as { gm_authFailure: () => void }).gm_authFailure();
    expect(posted).toContainEqual({ channel: CHANNEL, event: 'failed' });
    expect(document.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('says it failed when Google\'s script cannot be loaded', async () => {
    from(window.parent, show);
    scripts()[0]!.dispatchEvent(new Event('error'));
    await vi.waitFor(() => expect(posted).toContainEqual({ channel: CHANNEL, event: 'failed' }));
  });
});
