/**
 * ADMINIUM'S STATUS READ, ONCE FOR EVERY SCREEN OF THE PAGE.
 *
 * `GET /api/v1/forms/status` says whether mail a stranger causes goes out,
 * whether strangers can reach the pages, whether the privacy notice is set,
 * the public address, the listed websites and the roles a form may tell. The
 * builder's blocked cards, its Publish and its Tell read it, and so does the
 * Share tab: one read, held here, shared by all of them, and made again when
 * the window comes back into focus (an owner who went to set the privacy
 * notice comes back to a builder that knows it is set) or when a screen asks
 * ("Try again").
 *
 * What a screen makes of the reply is the screen's own (`builder/status.ts`,
 * `share/status.ts`): this holds the reply, which read gave it, and whether
 * the read failed.
 *
 * An Adminium before 0.3.41 has no status read (it answers 404): it is asked
 * the older mail read instead, `GET /api/v1/forms/mail`.
 */
import { useEffect, useSyncExternalStore } from 'react';

import { ApiError, api } from './host.ts';

export const STATUS_PATH = '/api/v1/forms/status';
export const MAIL_PATH = '/api/v1/forms/mail';

/** A reply, and which read gave it. */
export interface StatusRead {
  reply: unknown;
  from: 'status' | 'mail';
}

/** Ask once: the status read, else (an Adminium without it) the mail read. A refused or failed read throws. */
export async function readStatus(get: <T>(path: string) => Promise<T> = api.get): Promise<StatusRead> {
  try {
    return { reply: await get<unknown>(STATUS_PATH), from: 'status' };
  } catch (caught) {
    if (!(caught instanceof ApiError && caught.status === 404)) throw caught;
    return { reply: await get<unknown>(MAIL_PATH), from: 'mail' };
  }
}

interface Held {
  read: StatusRead | null;
  failed: boolean;
  loaded: boolean;
}

let held: Held = { read: null, failed: false, loaded: false };
let asking: Promise<void> | null = null;
const listeners = new Set<() => void>();

function ask(): Promise<void> {
  asking ??= readStatus()
    .then(
      (read) => {
        held = { read, failed: false, loaded: true };
      },
      () => {
        held = { read: null, failed: true, loaded: true };
      },
    )
    .finally(() => {
      asking = null;
      for (const listener of listeners) listener();
    });
  return asking;
}

/** For the screens' own tests: forget the last answer. */
export function resetStatus(): void {
  held = { read: null, failed: false, loaded: false };
  asking = null;
}

export interface UseStatusRead extends Held {
  refetch: () => Promise<void>;
}

/** The held read: asked by the first screen that needs it, again on focus and on `refetch`. */
export function useStatusRead(): UseStatusRead {
  const now = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => held,
  );
  useEffect(() => {
    if (!held.loaded) void ask();
    const again = (): void => void ask();
    window.addEventListener('focus', again);
    return () => window.removeEventListener('focus', again);
  }, []);
  return { ...now, refetch: ask };
}
