/**
 * WHERE EACH SCREEN OF THIS ADD-ON LIVES IN THE DASHBOARD.
 *
 * One code page, `live-chat`, holds every screen: the dashboard opens the page
 * the first segment after `/add-ons/live-chat/` names and hands it the rest.
 *
 * - The inbox and a conversation: `/add-ons/live-chat/live-chat`, a
 *   conversation opened by `?conversation=<id>`. Adminium's "a chat is
 *   waiting" notice links there.
 * - Chat settings, with the answers: `/add-ons/live-chat/live-chat/settings`.
 */
export const ADD_ON = 'live-chat';
/** The code page's ref: the add-on's key. */
export const PAGE = 'live-chat';
/** The path segment the settings live under, inside the page. */
export const SETTINGS = 'settings';

const BASE = `/add-ons/${ADD_ON}/${PAGE}`;

/** The inbox. */
export const inboxAt = (): string => BASE;
/** One conversation, opened in the inbox. */
export const conversationAt = (id: string): string => `${BASE}?conversation=${encodeURIComponent(id)}`;
/** Chat settings. */
export const settingsAt = (): string => `${BASE}/${SETTINGS}`;

/** Adminium's own screens these pages link to. */
export const PRIVACY = '/studio/privacy';
export const EMAIL_SETTINGS = '/studio/settings';
export const MILO_SETTINGS = '/studio/settings/ai';
