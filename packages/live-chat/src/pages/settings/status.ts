/**
 * WHAT ADMINIUM SAYS ABOUT PUTTING THE CHAT ON A WEBSITE, for the settings
 * page's snippet, its blocked cards, who may be told, and the facts the
 * window is drawn with.
 *
 * One read, `GET /api/v1/chat/<addOn>/status`, for whoever may read the
 * chat's settings, and nothing more: a settings manager with no Forms or
 * privacy rights still gets every answer. It says:
 * - whether strangers can reach the chat, and a doubt about a proxy;
 * - whether the privacy notice is set;
 * - the public address and the websites the chat may show on;
 * - whether mail goes out, and why not;
 * - the roles, by their names in the reader's language;
 * - the chat's languages and its default one, the business's name, and the
 *   time zone its hours are in.
 *
 * A refused or failed read claims nothing: no snippet and no card is drawn,
 * and the rest of the page stands.
 */
import { ADD_ON } from '../shared/paths.ts';
import { api } from '../shared/host.ts';

export const STATUS_PATH = `/api/v1/chat/${ADD_ON}/status`;

export type MailBlocked = 'no-public-origin' | 'no-mail-server';

export interface ChatStatus {
  /** `reachable`, or why strangers cannot open the pages; null when the read said nothing of it. */
  reach: string | null;
  /** This request cannot tell whether strangers come through a proxy. */
  proxyUnchecked: boolean;
  /** Whether the privacy notice is set. */
  notice: boolean;
  publicOrigin: string | null;
  websites: readonly string[];
  /** Why no mail goes out, or null when it does. */
  mail: MailBlocked | null;
  /** Every role, by its name in the reader's language: whom a chat may tell. */
  roles: readonly { id: string; name: string }[];
  /** The business's name, as the window shows it; null while none is set. */
  business: string | null;
  defaultLanguage: string | null;
  languages: readonly string[];
  /** The zone the chat's hours are in. */
  timeZone: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const textOf = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);
const textsOf = (value: unknown): string[] => (Array.isArray(value) ? value.filter((one): one is string => typeof one === 'string' && one !== '') : []);

/** The status read's reply, read leniently: null when it is not one. */
export function statusOf(reply: unknown): ChatStatus | null {
  const data = isRecord(reply) ? reply['data'] : undefined;
  if (!isRecord(data) || !isRecord(data['reach']) || typeof data['notice'] !== 'boolean') return null;
  const reach = data['reach'];
  const mail = isRecord(data['mail']) ? data['mail']['blocked'] : null;
  const roles = Array.isArray(data['roles']) ? data['roles'] : [];
  return {
    reach: textOf(reach['state']),
    proxyUnchecked: reach['proxyUnchecked'] === true,
    notice: data['notice'],
    publicOrigin: textOf(data['publicOrigin']),
    websites: textsOf(data['websites']),
    mail: mail === 'no-public-origin' || mail === 'no-mail-server' ? mail : null,
    roles: roles.filter((one): one is { id: string; name: string } => isRecord(one) && typeof one['id'] === 'string' && typeof one['name'] === 'string').map((one) => ({ id: one.id, name: one.name })),
    business: textOf(data['businessName']),
    defaultLanguage: textOf(data['defaultLanguage']),
    languages: textsOf(data['languages']),
    timeZone: textOf(data['timeZone']),
  };
}

/** The status, once; null when it was refused, failed, or answered something else. */
export async function readStatus(get: (path: string) => Promise<unknown> = (path) => api.get(path)): Promise<ChatStatus | null> {
  try {
    return statusOf(await get(STATUS_PATH));
  } catch {
    return null;
  }
}

/** The one line a website pastes: Adminium's loader, told which chat to draw. */
export const snippetOf = (origin: string): string => `<script src="${origin.replace(/\/$/, '')}/x/embed.js" data-adminium-chat="${ADD_ON}" async></script>`;

/** "www.meridian.example": a website's origin as the comp writes it. */
export const hostOf = (origin: string): string => origin.replace(/^https?:\/\//, '').replace(/\/$/, '');
