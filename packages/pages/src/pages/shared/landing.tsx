/**
 * WHAT ADMINIUM SAYS, READ ONCE FOR EVERY SCREEN OF THE PAGE.
 *
 * The status of the pages (the public address, the business's time zone, the
 * install), the install ids of the add-ons a funnel counts, and the live
 * forms. Each read may fail on its own (a route a host does not have yet, a
 * read the person is refused): it is then null, and a screen says less.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { readInstallIds, readLiveForms, readStatus, type EngineApi, type LandingStatus, type LiveForm } from '../../engine.ts';
import { api } from './host.ts';
import { dayIn } from './days.ts';
import { ADD_ON } from './paths.ts';

export interface Landing {
  /** All three reads are answered (or refused). */
  ready: boolean;
  status: LandingStatus | null;
  /** Each add-on's install id, by its key. */
  installs: ReadonlyMap<string, string> | null;
  forms: readonly LiveForm[] | null;
  /** This add-on's install: what its pages' counts are kept under. */
  pagesInstall: string | null;
  /** The business's zone, else the reader's. */
  zone: string | null;
  /** Today, in that zone. */
  today: string;
  reload: () => void;
}

const settle = async <T,>(read: Promise<T>): Promise<T | null> => {
  try {
    return await read;
  } catch {
    return null;
  }
};

/** The three reads, made when the page opens and again when asked. */
export function useLandingReads(engine: EngineApi = api, now: () => number = Date.now): Landing {
  const [round, setRound] = useState(0);
  const [held, setHeld] = useState<{ status: LandingStatus | null; installs: ReadonlyMap<string, string> | null; forms: readonly LiveForm[] | null } | null>(null);
  useEffect(() => {
    let live = true;
    void Promise.all([settle(readStatus(engine, ADD_ON)), settle(readInstallIds(engine)), settle(readLiveForms(engine, ADD_ON))]).then(([status, installs, forms]) => {
      if (live) setHeld({ status, installs, forms });
    });
    return () => {
      live = false;
    };
  }, [engine, round]);
  const reload = useCallback(() => setRound((one) => one + 1), []);
  const zone = held?.status?.timeZone ?? null;
  return {
    ready: held !== null,
    status: held?.status ?? null,
    installs: held?.installs ?? null,
    forms: held?.forms ?? null,
    pagesInstall: held?.status?.installId ?? held?.installs?.get(ADD_ON) ?? null,
    zone,
    today: dayIn(now(), zone),
    reload,
  };
}

const Context = createContext<Landing | null>(null);

export function LandingProvider({ value, children }: { value: Landing; children: ReactNode }): ReactNode {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** What Adminium said, as the page read it. */
export function useLanding(): Landing {
  const found = useContext(Context);
  if (found === null) throw new Error('useLanding() outside the landing page');
  return found;
}

/** The install a form's counts are kept under: the one the forms read names, else its add-on's. */
export const formInstallOf = (landing: Pick<Landing, 'installs'>, form: Pick<LiveForm, 'installId' | 'addOn'>): string | null => form.installId ?? landing.installs?.get(form.addOn) ?? null;
