/**
 * WHAT ADMINIUM SAYS ABOUT PUTTING THE CHAT ON A WEBSITE, for the settings
 * page's snippet and its blocked cards.
 *
 * Adminium has no status read of its own for a chat yet, so this asks the
 * reads the dashboard already answers, each for whom it answers:
 *
 * 1. `GET /api/v1/forms/status`: reach, the privacy notice, the public
 *    address and the websites, for someone who may read a forms add-on's forms;
 * 2. else `GET /api/v1/privacy/reach` and `/privacy/notice`, for someone who
 *    manages privacy and public pages;
 * 3. and always `GET /api/v1/forms/mail`, which every signed-in person may read.
 *
 * What none of them answered is not claimed: no card is drawn for it.
 *
 * And `GET /x/chat/api/live-chat/config?preview=1`, the window's own read as
 * staff preview it: the business's name, the chat's languages, its default
 * language and the time zone its hours are in.
 */
import { ADD_ON } from '../shared/paths.ts';
import { api } from '../shared/host.ts';

export type MailBlocked = 'no-public-origin' | 'no-mail-server';

export interface ChatStatus {
  /** `reachable`, or why strangers cannot open the pages; null when no read answered. */
  reach: string | null;
  /** This request cannot tell whether strangers come through a proxy. */
  proxyUnchecked: boolean;
  /** Whether the privacy notice is set; null when no read answered. */
  notice: boolean | null;
  publicOrigin: string | null;
  websites: readonly string[];
  /** Why no mail goes out, or null when it does (or nobody said). */
  mail: MailBlocked | null;
}

export interface WindowFacts {
  business: string | null;
  defaultLanguage: string | null;
  languages: readonly string[];
  timeZone: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const dataOf = (reply: unknown): Record<string, unknown> => (isRecord(reply) && isRecord(reply['data']) ? reply['data'] : {});
const textOf = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

type Get = (path: string) => Promise<unknown>;
const quietly = async (get: Get, path: string): Promise<unknown> => {
  try {
    return await get(path);
  } catch {
    return null;
  }
};

/** Every read the page needs, each tried once; what failed is left out. */
export async function readStatus(get: Get = (path) => api.get(path)): Promise<ChatStatus> {
  const [forms, mail] = await Promise.all([quietly(get, '/api/v1/forms/status'), quietly(get, '/api/v1/forms/mail')]);
  const mailData = dataOf(mail);
  const blocked = mailData['blocked'] === 'no-public-origin' || mailData['blocked'] === 'no-mail-server' ? mailData['blocked'] : null;
  const status = dataOf(forms);
  if (isRecord(status['reach']) && typeof status['notice'] === 'boolean') {
    const reach = status['reach'];
    return {
      reach: textOf(reach['state']),
      proxyUnchecked: reach['proxyUnchecked'] === true,
      notice: status['notice'],
      publicOrigin: textOf(status['publicOrigin']),
      websites: Array.isArray(status['websites']) ? status['websites'].filter((one): one is string => typeof one === 'string') : [],
      mail: blocked,
    };
  }
  const [reach, notice, websites] = await Promise.all([quietly(get, '/api/v1/privacy/reach'), quietly(get, '/api/v1/privacy/notice'), quietly(get, '/api/v1/privacy/websites')]);
  const reachData = dataOf(reach);
  const noticeData = dataOf(notice);
  const websitesData = dataOf(websites);
  const listed = Array.isArray(websitesData['websites']) ? websitesData['websites'] : [];
  return {
    reach: textOf(reachData['state']),
    proxyUnchecked: reachData['proxyUnchecked'] === true,
    notice: notice === null ? null : noticeData['ready'] === true,
    publicOrigin: textOf(reachData['origin']),
    websites: listed.map((one) => (isRecord(one) ? textOf(one['origin']) : null)).filter((one): one is string => one !== null),
    mail: blocked,
  };
}

/** The window's own facts, as staff preview it; nothing when the window cannot be served. */
export async function readWindow(get: Get = (path) => api.get(path)): Promise<WindowFacts> {
  const reply = await quietly(get, `/x/chat/api/${ADD_ON}/config?preview=1`);
  const config = isRecord(reply) ? reply : {};
  const business = isRecord(config['business']) ? textOf(config['business']['name']) : null;
  return {
    business,
    defaultLanguage: textOf(config['defaultLanguage']),
    languages: Array.isArray(config['languages']) ? config['languages'].filter((one): one is string => typeof one === 'string') : [],
    timeZone: textOf(config['timeZone']),
  };
}

/** The one line a website pastes: Adminium's loader, told which chat to draw. */
export const snippetOf = (origin: string): string => `<script src="${origin.replace(/\/$/, '')}/x/embed.js" data-adminium-chat="${ADD_ON}" async></script>`;

/** "www.meridian.example": a website's origin as the comp writes it. */
export const hostOf = (origin: string): string => origin.replace(/^https?:\/\//, '').replace(/\/$/, '');
