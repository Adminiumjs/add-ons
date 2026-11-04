/**
 * WHAT EVERY PART OF THE EDITOR READS: the words, the shop's look, and the
 * customer's language.
 *
 * Two looks, one editor. A shop whose bases are pages (a print shop) sees the
 * print look: fields grouped by side, a quote panel beside the card. A shop
 * whose bases are pieces, kits or printed items (a maker's shop) sees the
 * maker look: one "Make it yours" card of fields beside the piece, and a
 * total bar. The colours and type are the app's own, through the CSS
 * variables it sets; the look decides only which comp's layout is drawn.
 */
import { createContext, useContext, useEffect, useState } from 'react';

import { localeOf, translator, type Locale, type Translate } from '../i18n.ts';

export type Look = 'maker' | 'print';

export interface Shared {
  t: Translate;
  locale: Locale;
  look: Look;
  /** The shop's name, as the app gives it ("Marlow Press"). */
  shop: string;
}

const Context = createContext<Shared>({ t: translator('en-US'), locale: 'en-US', look: 'maker', shop: '' });

export const SharedContext = Context;
export const useShared = (): Shared => useContext(Context);

export function sharedFor(locale: string | undefined, look: Look, shop: string): Shared {
  const tag = localeOf(locale);
  return { t: translator(tag), locale: tag, look, shop };
}

/** Whether the page is as narrow as a phone: the comps' narrow layout below 900 px. */
export function useNarrow(): boolean {
  const query = '(max-width: 899px)';
  const read = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
  const [narrow, setNarrow] = useState(read);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const list = window.matchMedia(query);
    const on = (): void => setNarrow(list.matches);
    list.addEventListener('change', on);
    return () => list.removeEventListener('change', on);
  }, []);
  return narrow;
}
