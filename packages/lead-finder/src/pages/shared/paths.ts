/**
 * WHERE EACH SCREEN OF THIS ADD-ON LIVES IN THE DASHBOARD.
 *
 * One code page, `lead-finder`, holds every screen: the dashboard opens the
 * page the first segment after `/add-ons/lead-finder/` names and hands it the
 * rest.
 *
 * - Find companies: `/add-ons/lead-finder/lead-finder`.
 * - People found: `/add-ons/lead-finder/lead-finder/people`.
 * - Settings, off the rail as Forms' are: `…/settings/sources` (the Sources
 *   cards) and `…/settings/people` (the People card), and the mail a found
 *   person is sent, `…/settings/people/mail`.
 */
export const ADD_ON = 'lead-finder';
/** The code page's ref: the add-on's key. */
export const PAGE = 'lead-finder';

const BASE = `/add-ons/${ADD_ON}/${PAGE}`;

export const findAt = (): string => BASE;
export const peopleFoundAt = (): string => `${BASE}/people`;
export const sourcesAt = (): string => `${BASE}/settings/sources`;
export const peopleSettingsAt = (): string => `${BASE}/settings/people`;
export const mailAt = (): string => `${BASE}/settings/people/mail`;

/** A record of a generated page of an app's table (`/p/<page>/r/<key>`). */
export const recordAt = (page: string, key: string): string => `/p/${encodeURIComponent(page)}/r/${encodeURIComponent(key)}`;

/** Adminium's own screens these pages point at. */
export const EMAIL_SETTINGS = '/studio/settings';
export const PRIVACY = '/studio/privacy';
