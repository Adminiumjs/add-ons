/**
 * WHERE EACH SCREEN OF THIS ADD-ON LIVES IN THE DASHBOARD.
 *
 * One code page, `pages`, holds every screen: the dashboard opens the page the
 * first segment after `/add-ons/pages/` names and hands it the rest.
 *
 * - The list of pages: `/add-ons/pages/pages`; the Funnels tab
 *   `/add-ons/pages/pages/funnels`.
 * - A new page: `/add-ons/pages/pages/new` (with `?milo=1`, Milo's dialog open).
 * - One page in the editor: `/add-ons/pages/pages/page/<key>`.
 * - One funnel: `/add-ons/pages/pages/funnels/<key>`.
 */
export const ADD_ON = 'pages';
/** The code page's ref. */
export const PAGE = 'pages';
/** The tables, by the refs the manifest gives them. */
export const PAGES_TABLE = 'pages';
export const FUNNELS_TABLE = 'funnels';

/** The path segments under the code page. */
export const NEW = 'new';
export const EDIT = 'page';
export const FUNNELS = 'funnels';

const BASE = `/add-ons/${ADD_ON}/${PAGE}`;

/** The list, on one of its two tabs. */
export const listAt = (tab: 'pages' | 'funnels' = 'pages'): string => (tab === 'funnels' ? `${BASE}/${FUNNELS}` : BASE);
/** A new page; with Milo's dialog open when asked. */
export const newPageAt = (milo = false): string => (milo ? `${BASE}/${NEW}?milo=1` : `${BASE}/${NEW}`);
/** One page in the editor. */
export const pageAt = (key: string): string => `${BASE}/${EDIT}/${encodeURIComponent(key)}`;
/** One funnel. */
export const funnelAt = (key: string): string => `${BASE}/${FUNNELS}/${encodeURIComponent(key)}`;

/** Adminium's own screens these pages link to. */
export const PRIVACY = '/studio/privacy';
/** Studio's Hosted apps, where a pages host is set up. */
export const HOSTED_APPS = '/studio/apps';
