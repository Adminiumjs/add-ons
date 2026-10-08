/** Where each screen of this add-on lives in the dashboard. A code never enters one of these. */
export const DISCOUNTS = '/add-ons/offers/offers-discounts';
export const LOOK_UP = '/add-ons/offers/offers-look-up';
export const ISSUE = '/add-ons/offers/offers-issue';
export const RULES = '/add-ons/offers/offers-rules';
/** A generated list, and a row of it: `<list>/r/<key>`. */
export const BATCHES = '/p/offers-voucher-batches';
export const recordAt = (list: string, key: string): string => `${list}/r/${encodeURIComponent(key)}`;
