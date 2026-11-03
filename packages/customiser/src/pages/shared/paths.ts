/**
 * WHERE THE SHOP'S SCREENS OF THIS ADD-ON LIVE IN THE DASHBOARD.
 *
 * Every page of an add-on is served under `/add-ons/<key>/<page ref>`, and a
 * page ref is the add-on's key or starts with it. The pages themselves come
 * with the shop's set-up; this is the one place their addresses are made.
 */
export const ADD_ON = 'customiser';
/** The code page's ref: the add-on's key, the one ref every add-on may use. */
export const PAGE = 'customiser';

/** A page of this add-on, by its ref. */
export const pageAt = (ref: string = PAGE): string => `/add-ons/${ADD_ON}/${ref}`;
