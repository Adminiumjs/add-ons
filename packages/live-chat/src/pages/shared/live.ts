/**
 * LIVE, WHERE THE HOST CAN: the screen width the comps' layouts follow, a
 * table followed live, a clock that moves, and Milo's panel.
 */
import { useEffect, useState } from 'react';

import { useLiveTable } from './host.ts';

/** Nothing to follow on a host before 0.3.64: the lists read as they always did. */
const noLive = (): { connected: boolean } => ({ connected: false });
const follow = useLiveTable ?? noLive;

/** Follow one of the add-on's tables live (a host from 0.3.64), while `enabled`. */
export function useLive(table: string, enabled: boolean): void {
  follow(table, { enabled });
}

/**
 * The layouts the comps draw, by the window's width:
 * - wide (1180 and up): the inbox, the thread and the side rail;
 * - mid (700 to 1179): the side rail behind the info button, over a scrim;
 * - phone (under 700): one pane at a time, the thread first.
 */
export type Layout = 'wide' | 'mid' | 'phone';
export const layoutOf = (width: number): Layout => (width >= 1180 ? 'wide' : width >= 700 ? 'mid' : 'phone');

export function useLayout(): Layout {
  const read = (): Layout => layoutOf(typeof window === 'undefined' ? 1440 : window.innerWidth);
  const [layout, setLayout] = useState<Layout>(read);
  useEffect(() => {
    const again = (): void => setLayout(read());
    window.addEventListener('resize', again);
    return () => window.removeEventListener('resize', again);
  }, []);
  return layout;
}

/** The time now, moved on every minute: how long a chat has waited keeps counting. */
export function useNow(every = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(timer);
  }, [every]);
  return now;
}

/**
 * "Ask Milo": opens Adminium's own Milo panel, as its keyboard shortcut does
 * (⌘. on a Mac, Ctrl+. elsewhere). The kit has no call for it, so the page
 * presses the shortcut on the window, where the dashboard listens.
 */
export function openMilo(): void {
  const mac = /Mac|iPhone|iPad/.test(typeof navigator === 'undefined' ? '' : navigator.platform);
  window.dispatchEvent(new KeyboardEvent('keydown', { key: '.', code: 'Period', metaKey: mac, ctrlKey: !mac, bubbles: true }));
}
