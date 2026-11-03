/**
 * WHAT THE SHARE TAB ASKS ADMINIUM: this server's public address, the
 * websites a form may show on, and whether visitors can reach the pages.
 *
 * One read, `GET /api/v1/forms/status`, open to anyone who may read a forms
 * add-on's forms (a marketer holds neither the privacy action nor the roles
 * action). Everything the tab says about the address and the websites comes
 * through `statusOf`, so a test pins the one place the reply is read.
 *
 * An Adminium before that read answered only `GET /api/v1/forms/mail`:
 * whether mail goes, and why not. The tab then knows only whether a public
 * address is missing; it shows no link and no websites, and says so.
 */
import { useCallback, useEffect, useState } from 'react';

import { ApiError, api } from '../shared/host.ts';

export const STATUS_PATH = '/api/v1/forms/status';
export const MAIL_PATH = '/api/v1/forms/mail';

/** "Can visitors reach your public pages?", as the Privacy page's card answers it. */
export const REACH_STATES = ['network-off', 'desktop', 'not-set', 'this-computer', 'private-network', 'dot-local', 'not-https', 'proxy-hidden', 'reachable'] as const;
export type ReachState = (typeof REACH_STATES)[number];

export interface ShareStatus {
  /** `system.publicOrigin`: a form's link is `<publicOrigin>/x/forms/<slug>`. Null while none is set. */
  publicOrigin: string | null;
  /** The websites a form may show on in a frame, as origins. */
  websites: readonly string[];
  /** Whether visitors can reach the public pages; null when this Adminium did not say. */
  reach: ReachState | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const reachOf = (value: unknown): ReachState | null => (REACH_STATES.includes(value as ReachState) ? (value as ReachState) : null);

/** The status read's reply, read leniently: null when it is not one. */
export function statusOf(reply: unknown): ShareStatus | null {
  const data = isRecord(reply) ? reply['data'] : undefined;
  if (!isRecord(data)) return null;
  const origin = data['publicOrigin'];
  const websites = Array.isArray(data['websites']) ? data['websites'].filter((one): one is string => typeof one === 'string' && one !== '') : [];
  return {
    publicOrigin: typeof origin === 'string' && origin !== '' ? origin.replace(/\/+$/, '') : null,
    websites,
    reach: reachOf(isRecord(data['reach']) ? data['reach']['state'] : undefined),
  };
}

/** The older mail read's reply: only whether a public address is missing. */
export function mailStatusOf(reply: unknown): ShareStatus | null {
  const data = isRecord(reply) ? reply['data'] : undefined;
  if (!isRecord(data)) return null;
  return { publicOrigin: null, websites: [], reach: data['blocked'] === 'no-public-origin' ? 'not-set' : null };
}

/**
 * Ask once. A refused or failed read throws; an Adminium with no status read
 * (it answers 404) is asked the mail read instead.
 */
export async function readShareStatus(get: <T>(path: string) => Promise<T> = api.get): Promise<ShareStatus> {
  try {
    const status = statusOf(await get<unknown>(STATUS_PATH));
    if (status === null) throw new Error('The status read answered something else.');
    return status;
  } catch (caught) {
    // TODO(0.3.41): the floor serves the status read; drop the mail read then.
    if (!(caught instanceof ApiError && caught.status === 404)) throw caught;
    const status = mailStatusOf(await get<unknown>(MAIL_PATH));
    if (status === null) throw new Error('The mail read answered something else.');
    return status;
  }
}

export interface UseShareStatus {
  status: ShareStatus | null;
  failed: boolean;
  retry: () => void;
}

/** The status, read when the tab opens and again on "Try again". */
export function useShareStatus(): UseShareStatus {
  const [status, setStatus] = useState<ShareStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [round, setRound] = useState(0);
  useEffect(() => {
    let live = true;
    setFailed(false);
    readShareStatus().then(
      (read) => {
        if (live) setStatus(read);
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [round]);
  const retry = useCallback(() => setRound((n) => n + 1), []);
  return { status, failed, retry };
}
