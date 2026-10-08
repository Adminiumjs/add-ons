/**
 * WHETHER AN OFFER STANDS, AND FOR WHOM.
 *
 * Before an offer touches a line it has to be running: switched on, inside
 * its days and its hours, with its code typed where it takes one, and with
 * uses left. Then, where it is kept for somebody — a first order, a group, so
 * many times a customer — the buyer has to be known and be that somebody.
 * The first thing that is not so is the reason given.
 */

import type { AdjustInput, ExplainReason } from '@adminium/add-on-contracts';

import { keyOf, textOf, wholeOf, yes, type Offer, type Row } from './standing.ts';

/** How many of the order's own held uses name an offer or a code: they are this order's, and are not counted against it. */
export function ownUses(input: AdjustInput, column: 'offer_id' | 'code_id', id: string): number {
  return ((input.held?.['redemptions'] ?? []) as Row[]).filter((row) => keyOf(row[column]) === id).length;
}

/** `HH:MM` text, or null for anything else. */
const clock = (value: unknown): string | null => (typeof value === 'string' && /^\d{2}:\d{2}/.test(value) ? value.slice(0, 5) : null);

/** Whether the offer is running at all, now, at this door, with uses left. Null: it is. */
export function standing(offer: Offer, input: AdjustInput): ExplainReason | null {
  const row = offer.row;
  const status = textOf(row['status']);
  if (status === 'draft' || status === 'paused' || status === 'ended') return status;
  const [starts, ends] = [textOf(row['starts_on']), textOf(row['ends_on'])];
  if (starts !== null && starts > input.today) return 'not-yet';
  if (ends !== null && ends < input.today) return 'ended';
  const days = textOf(row['weekdays']);
  if (days !== null && !days.split(',').map((day) => day.trim()).includes(String(input.weekday))) return 'outside-days';
  const [from, to] = [clock(row['from_time']), clock(row['to_time'])];
  // From the first minute to just before the last. Hours that end at or before they begin hold at no time of day.
  if ((from !== null && input.time < from) || (to !== null && input.time >= to)) return 'outside-hours';
  const trigger = textOf(row['trigger']);
  if (trigger === 'staff' && input.origin !== 'staff') return 'no-code-typed';
  if (trigger === 'code' && offer.typed === null) return 'no-code-typed';
  const most = wholeOf(row['max_uses']);
  if (most !== null && (wholeOf(row['uses']) ?? 0) - ownUses(input, 'offer_id', offer.id) >= most) return 'used-up';
  if (offer.typed !== null) {
    const codeMost = wholeOf(offer.typed.row['max_uses']);
    if (codeMost !== null && (wholeOf(offer.typed.row['uses']) ?? 0) - ownUses(input, 'code_id', offer.typed.code) >= codeMost) return 'used-up';
  }
  return null;
}

/** Whether the offer is kept for somebody: a first order, a group, so many times each. */
export const forSomebody = (offer: Offer): boolean => yes(offer.row['first_order_only']) || textOf(offer.row['group_id']) !== null || wholeOf(offer.row['max_per_customer']) !== null;

/**
 * Whether the buyer is who the offer is kept for. Nobody proved: an offer
 * that came by itself simply does not apply; one whose code was typed says
 * to sign in (to a guest) or to name a customer (to staff).
 */
export function person(offer: Offer, input: AdjustInput): ExplainReason | null {
  if (!forSomebody(offer)) return null;
  const customer = input.customer;
  if (customer === null) return input.guest ? 'needs-sign-in' : 'needs-customer';
  const group = textOf(offer.row['group_id']);
  if (group !== null && !customer.groups.map(keyOf).includes(group)) return 'not-in-group';
  if (yes(offer.row['first_order_only']) && customer.orders > 0) return 'not-first-order';
  const each = wholeOf(offer.row['max_per_customer']);
  // Adminium has already taken this order's own held uses out of the count it hands in.
  if (each !== null && (customer.uses[offer.id] ?? 0) >= each) return 'over-limit';
  return null;
}
