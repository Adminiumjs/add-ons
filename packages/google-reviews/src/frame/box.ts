/**
 * THE BOX: what Google answered, drawn as text.
 *
 * Every word from Google goes in through `textContent`, and every link is
 * checked to be Google's, so a review can carry no markup and no address of
 * its own. Up to five reviews, in the order Google gave them, with each
 * author's credit as Google requires it. The answer is held in this page's
 * memory only. Nothing is written anywhere.
 */
import { googleLink } from './protocol.ts';
import type { BoxWords } from './words.ts';

export const REVIEWS_SHOWN = 5;

/** What the box reads of Google's Place. */
export interface PlaceReview {
  rating?: number | null;
  text?: string | null;
  relativePublishTimeDescription?: string | null;
  authorAttribution?: { displayName?: string | null; uri?: string | null; photoURI?: string | null } | null;
}
export interface PlaceAnswer {
  displayName?: string | null;
  rating?: number | null;
  userRatingCount?: number | null;
  googleMapsURI?: string | null;
  reviews?: readonly PlaceReview[] | null;
}

const STYLE = `
:root{color-scheme:light;--fg:#1f2024;--muted:#5d5f68;--line:#dcdde2;--card:#fff;--link:#1a56c4;--star:#b86e00}
:root.dark{color-scheme:dark;--fg:#ececf0;--muted:#a9abb4;--line:#3a3b42;--card:#1d1e22;--link:#8ab4f8;--star:#f2b13c}
*{box-sizing:border-box}html,body{margin:0;background:transparent}
body{font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--fg)}
.head{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;margin-bottom:10px}
.score{font-size:20px;font-weight:700}.stars{color:var(--star);letter-spacing:1px}.muted{color:var(--muted);font-size:13px}
ul{list-style:none;margin:0;padding:0;display:grid;gap:10px}
li{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px}
.who{display:flex;align-items:center;gap:8px;margin-bottom:4px}.who img{width:28px;height:28px;border-radius:50%}
.text{margin:4px 0 0;overflow-wrap:anywhere;white-space:pre-line}
a{color:var(--link)}.foot{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:12px;align-items:center}
.credit{margin-inline-start:auto;font-size:12px;color:var(--muted)}
`;

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (className !== undefined) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function link(doc: Document, href: string, text: string): HTMLAnchorElement {
  const a = el(doc, 'a', undefined, text);
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}

/** A rating as stars for the eye; the number is what a screen reader is told. */
function stars(doc: Document, rating: number, words: BoxWords): HTMLElement {
  const whole = Math.max(0, Math.min(5, Math.round(rating)));
  const span = el(doc, 'span', 'stars', `${'★'.repeat(whole)}${'☆'.repeat(5 - whole)}`);
  span.setAttribute('role', 'img');
  span.setAttribute('aria-label', words.stars(String(Math.round(rating * 10) / 10)));
  return span;
}

/** Google's page for this place, for the two links every state offers. */
export const placeUrl = (placeId: string): string => `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`;
export const writeReviewUrl = (placeId: string): string => `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;

/** The credit Google asks for, in its own spelling and never translated. */
function credit(doc: Document): HTMLElement {
  const span = el(doc, 'span', 'credit', 'Google Maps');
  span.setAttribute('translate', 'no');
  return span;
}

/** Sets the page up: its language, its direction, its colours. */
export function prepare(doc: Document, language: string, dark: boolean): void {
  doc.documentElement.lang = language;
  doc.documentElement.dir = language.startsWith('ar') ? 'rtl' : 'ltr';
  doc.documentElement.classList.toggle('dark', dark);
  const style = doc.createElement('style');
  style.textContent = STYLE;
  doc.head.append(style);
}

export function drawLoading(doc: Document, words: BoxWords): void {
  const p = el(doc, 'p', 'muted', words.loading);
  p.setAttribute('role', 'status');
  doc.body.replaceChildren(p);
}

/** Google could not be asked, or refused: said plainly, with the way to read them anyway. */
export function drawFailed(doc: Document, words: BoxWords, placeId: string): void {
  const p = el(doc, 'p', undefined, words.failed);
  p.setAttribute('role', 'alert');
  const foot = el(doc, 'div', 'foot');
  foot.append(link(doc, placeUrl(placeId), words.open));
  doc.body.replaceChildren(p, foot);
}

export function drawPlace(doc: Document, place: PlaceAnswer, words: BoxWords, opts: { placeId: string; language: string; reviewLink?: string | undefined }): void {
  const parts: HTMLElement[] = [];
  if (typeof place.rating === 'number') {
    const head = el(doc, 'div', 'head');
    head.append(el(doc, 'span', 'score', new Intl.NumberFormat(opts.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(place.rating)), stars(doc, place.rating, words));
    if (typeof place.userRatingCount === 'number') head.append(el(doc, 'span', 'muted', words.count(new Intl.NumberFormat(opts.language).format(place.userRatingCount))));
    parts.push(head);
  }
  const reviews = (place.reviews ?? []).slice(0, REVIEWS_SHOWN);
  if (reviews.length === 0) parts.push(el(doc, 'p', 'muted', words.none));
  else {
    parts.push(el(doc, 'p', 'muted', words.order));
    const list = el(doc, 'ul');
    for (const review of reviews) {
      const item = el(doc, 'li');
      const who = el(doc, 'div', 'who');
      const author = review.authorAttribution;
      const photo = googleImage(author?.photoURI);
      if (photo !== null) {
        const img = el(doc, 'img');
        img.src = photo;
        img.alt = '';
        img.loading = 'lazy';
        img.referrerPolicy = 'no-referrer';
        who.append(img);
      }
      const name = author?.displayName?.trim() || '—';
      const profile = googleLink(author?.uri);
      who.append(profile === null ? el(doc, 'strong', undefined, name) : link(doc, profile, name));
      item.append(who);
      const meta = el(doc, 'div', 'muted');
      if (typeof review.rating === 'number') meta.append(stars(doc, review.rating, words));
      if (typeof review.relativePublishTimeDescription === 'string') meta.append(doc.createTextNode(` ${review.relativePublishTimeDescription}`));
      item.append(meta);
      if (typeof review.text === 'string' && review.text !== '') item.append(el(doc, 'p', 'text', review.text));
      list.append(item);
    }
    parts.push(list);
  }
  const foot = el(doc, 'div', 'foot');
  foot.append(link(doc, googleLink(place.googleMapsURI) ?? placeUrl(opts.placeId), words.readAll), link(doc, opts.reviewLink ?? writeReviewUrl(opts.placeId), words.reviewUs), credit(doc));
  parts.push(foot);
  doc.body.replaceChildren(...parts);
}

/** An author's picture, only from Google's own image hosts. */
function googleImage(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /(^|\.)(googleusercontent\.com|ggpht\.com)$/.test(url.hostname) ? url.href : null;
  } catch {
    return null;
  }
}
