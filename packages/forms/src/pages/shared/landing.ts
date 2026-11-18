/**
 * THE LIVE LANDING PAGES A FORM MAY END ON.
 *
 * A form's "after sending" may go to one of the business's own landing pages
 * (a landing pages add-on installed beside this one), named by the page's key
 * in that add-on: Adminium turns it into the page's address each time it
 * serves the form, on the host the form is served on, so a page that moves to
 * a new address or a new host never breaks it.
 *
 * This add-on may not read another add-on's tables, so the pages come from
 * Adminium's own read across the landing pages add-ons,
 * `GET /api/v1/landing/live-pages`: each live page with its add-on, its key,
 * its name and its address. An Adminium without landing pages (before
 * 0.3.65) has no such read: the list is then null, and the builder offers no
 * landing page.
 *
 * `livePagesOf` is pure; `useLivePages` reads once while "After sending" is open,
 * and `readLivePages` once when the form is published.
 */
import { useEffect, useState } from 'react';

import { api } from './host.ts';

export const LIVE_PAGES_PATH = '/api/v1/landing/live-pages';

/** The ending that goes to a landing page, as the forms vocabulary of Adminium 0.3.65 writes it. */
export interface LandingEnding {
  kind: 'landing';
  /** The page's row key in its add-on's pages table. */
  page: string;
  /** The landing pages add-on's key. */
  addOn: string;
}

/** A page's key and an add-on's key, as the vocabulary takes them. */
export const ENDING_PAGE_KEY = /^[A-Za-z0-9_-]{1,64}$/;
export const ENDING_ADD_ON_KEY = /^[a-z][a-z0-9-]{1,79}$/;

/** Whether a value is a landing ending the vocabulary takes. */
export const isLandingEnding = (value: unknown): value is LandingEnding =>
  typeof value === 'object' &&
  value !== null &&
  (value as { kind?: unknown }).kind === 'landing' &&
  typeof (value as { page?: unknown }).page === 'string' &&
  ENDING_PAGE_KEY.test((value as { page: string }).page) &&
  typeof (value as { addOn?: unknown }).addOn === 'string' &&
  ENDING_ADD_ON_KEY.test((value as { addOn: string }).addOn);

export interface LivePage {
  addOn: string;
  key: string;
  name: string;
  slug: string;
  language: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const keyOf = (value: unknown): string | null => (typeof value === 'number' && Number.isInteger(value) ? String(value) : typeof value === 'string' && ENDING_PAGE_KEY.test(value) ? value : null);

/** The read's answer, leniently: what is not a page is left out. */
export function livePagesOf(answer: unknown): LivePage[] {
  const data = isRecord(answer) && 'data' in answer ? answer['data'] : answer;
  const list = Array.isArray(data) ? data : isRecord(data) && Array.isArray(data['pages']) ? data['pages'] : [];
  return list.flatMap((one): LivePage[] => {
    if (!isRecord(one)) return [];
    const key = keyOf(one['key']);
    const addOn = typeof one['addOn'] === 'string' && ENDING_ADD_ON_KEY.test(one['addOn']) ? one['addOn'] : null;
    if (key === null || addOn === null) return [];
    return [{ addOn, key, name: typeof one['name'] === 'string' ? one['name'] : '', slug: typeof one['slug'] === 'string' ? one['slug'] : '', language: typeof one['language'] === 'string' ? one['language'] : null }];
  });
}

/** The page an ending names, among the live ones. */
export const pageOf = (pages: readonly LivePage[], ending: LandingEnding): LivePage | undefined => pages.find((page) => page.addOn === ending.addOn && page.key === ending.page);

/** The live landing pages, asked once (at Publish); null on an Adminium that has none to give, or when the read fails. */
export async function readLivePages(get: <T>(path: string) => Promise<T> = api.get): Promise<LivePage[] | null> {
  try {
    return livePagesOf(await get<unknown>(LIVE_PAGES_PATH));
  } catch {
    return null;
  }
}

/** The live landing pages; null while unread, or on an Adminium that has none to give. */
export function useLivePages(get: <T>(path: string) => Promise<T> = api.get): readonly LivePage[] | null {
  const [pages, setPages] = useState<readonly LivePage[] | null>(null);
  useEffect(() => {
    let live = true;
    get<unknown>(LIVE_PAGES_PATH).then(
      (answer) => {
        if (live) setPages(livePagesOf(answer));
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [get]);
  return pages;
}
