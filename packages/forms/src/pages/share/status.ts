/**
 * WHAT THE SHARE TAB ASKS ADMINIUM: this server's public address, the
 * websites a form may show on, and whether visitors can reach the pages.
 *
 * One read, `GET /api/v1/forms/status`, open to anyone who may read a forms
 * add-on's forms (a marketer holds neither the privacy action nor the roles
 * action), held for the whole page (`shared/status.ts`): the builder's read
 * is this one. Everything the tab says about the address and the websites
 * comes through `statusOf`, so a test pins the one place the reply is read.
 *
 * An Adminium before that read answered only `GET /api/v1/forms/mail`:
 * whether mail goes, and why not. The tab then knows only whether a public
 * address is missing; it shows no link and no websites, and says so.
 */
import { useCallback, useMemo } from 'react';

import { api } from '../shared/host.ts';
import { readStatus, useStatusRead, type StatusRead } from '../shared/status.ts';

export { MAIL_PATH, STATUS_PATH } from '../shared/status.ts';

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

/** What the tab makes of a read: the status read's reply, else the mail read's; null when it is neither. */
export function shareStatusOf(read: StatusRead): ShareStatus | null {
  return read.from === 'status' ? statusOf(read.reply) : mailStatusOf(read.reply);
}

/** Ask once (`shared/status.ts`), and read the reply as the tab does: a reply that is neither throws. */
export async function readShareStatus(get: <T>(path: string) => Promise<T> = api.get): Promise<ShareStatus> {
  const read = await readStatus(get);
  const status = shareStatusOf(read);
  if (status === null) throw new Error(`The ${read.from} read answered something else.`);
  return status;
}

export interface UseShareStatus {
  status: ShareStatus | null;
  failed: boolean;
  retry: () => void;
}

/** The status, read once for the page (the builder's read is this one too), and again on "Try again". */
export function useShareStatus(): UseShareStatus {
  const { read, failed, loaded, refetch } = useStatusRead();
  const status = useMemo(() => (read === null ? null : shareStatusOf(read)), [read]);
  const retry = useCallback(() => void refetch(), [refetch]);
  return { status, failed: failed || (loaded && read !== null && status === null), retry };
}
