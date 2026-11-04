/**
 * What the editor's tests share: a stub of the public API over the samples,
 * a page as wide as a desktop or a phone, and a wait for the catalogue.
 */
import { act, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';

/** The page's width, as the editor's media query reads it: a phone below 900 px. */
export function setWidth(width: number): void {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  window.matchMedia = ((query: string) => {
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = max === null ? false : width <= Number(max[1]);
    return { matches, media: query, onchange: null, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

export const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

/** Draw a screen and wait until its catalogue has loaded (the loading state is gone). */
export async function drawn(element: ReactElement): Promise<ReturnType<typeof render>> {
  const out = render(element);
  await settle();
  await settle();
  if (screen.queryByRole('status', { name: '' }) !== null) await settle();
  return out;
}

/** Wait, a moment at a time, until something holds: a file is read and sent over several moments. */
export async function settleUntil(holds: () => boolean, moments = 60): Promise<void> {
  for (let at = 0; at < moments && !holds(); at += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  if (!holds()) throw new Error('it never held');
}
