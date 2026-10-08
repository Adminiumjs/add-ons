/**
 * THE OFFERS HANDED IN, AND THE CODES TYPED.
 *
 * Adminium reads the offers with their breaks and targets and looks every
 * typed code up before it asks. Here they are put in order: each offer with
 * what belongs to it, an offer being tried in place of the stored one, and
 * each typed code as what it turned out to be — a discount code that brings
 * its offer in, a voucher or a pack, or nothing anybody knows.
 */

import type { AdjustInput } from '@adminium/add-on-contracts';

import { dayOf, keyOf, textOf, wholeOf, yes, type Offer, type Refused, type Row, type TypedVoucher } from './standing.ts';
import { offerName } from './names.ts';
import { earned } from './refund.ts';

/** Offers run in the order of their keys: a number before a greater number, the one being tried last. */
function byKey(a: Offer, b: Offer): number {
  const [x, y] = [Number(a.id), Number(b.id)];
  if (Number.isFinite(x) && Number.isFinite(y)) return x - y;
  if (Number.isFinite(x) !== Number.isFinite(y)) return Number.isFinite(x) ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Every offer of the question, each with its breaks and targets; in a try, the one not saved yet stands in for its stored self. */
export function offersOf(input: AdjustInput): Offer[] {
  const rows = (name: string): Row[] => (input.offers[name] ?? []) as Row[];
  const of = (name: string, id: string): Row[] => rows(name).filter((row) => keyOf(row['offer_id']) === id);
  const build = (row: Row, id: string, draft: boolean): Offer => ({ id, row: draft ? { ...row, status: 'active' } : row, breaks: of('breaks', id), targets: of('targets', id), name: offerName(row['public_name'], textOf(row['name']) ?? ''), codes: [], typed: null, draft });
  // A row with no key is no offer anybody could name.
  const out = rows('offers')
    .filter((row) => textOf(row['id']) !== null)
    .map((row) => build(row, keyOf(row['id']), false));
  if (input.mode === 'try' && input.draft !== undefined) {
    const tried = input.draft as Row;
    const id = textOf(tried['id']) ?? 'draft';
    const at = out.findIndex((offer) => offer.id === id);
    if (at === -1) out.push(build(tried, id, true));
    else out[at] = build(tried, id, true);
  }
  return out.sort(byKey);
}

/**
 * The typed codes, in the order typed. A discount code names its offer (and
 * is refused here when its own last day has passed); a voucher or a pack is
 * judged by its row; a code no row was found for is not known.
 */
export function typedOf(input: AdjustInput, offers: Offer[]): { vouchers: TypedVoucher[]; refused: Refused[] } {
  const vouchers: TypedVoucher[] = [];
  const refused: Refused[] = [];
  const seen = new Set<string>();
  const own = (id: string): number => ((input.held?.['redemptions'] ?? []) as Row[]).filter((row) => keyOf(row['voucher_id']) === id).reduce((total, row) => total + (wholeOf(row['uses']) ?? 1), 0);
  for (const code of input.codes) {
    const row = code.row as Row | null;
    if (row === null || code.kind === null) {
      refused.push({ typed: code.typed, reason: 'unknown' });
      continue;
    }
    const id = keyOf(row['id']);
    // The same row typed twice is one code.
    if (seen.has(`${code.kind}:${id}`)) continue;
    seen.add(`${code.kind}:${id}`);
    if (code.kind === 'code') {
      const offer = offers.find((one) => one.id === keyOf(row['offer_id']));
      if (offer === undefined) refused.push({ typed: code.typed, reason: 'unknown' });
      else if (!earned(input) && (dayOf(row['valid_until']) ?? '9999') < input.today) refused.push({ typed: code.typed, reason: 'expired' });
      else offer.codes.push({ typed: code.typed, code: id, row });
      continue;
    }
    // A voucher or a pack: which, the row says — never the word in front of what was typed.
    const status = textOf(row['status']);
    const lastDay = dayOf(row['expires_on']);
    const worth = textOf(row['worth']);
    const holder = textOf(row['holder_key']);
    // What it is worth is one of four things; a row that says none of them is nothing anybody can use.
    const reason = !['amount', 'percent', 'thing', 'pack'].includes(worth ?? '')
      ? 'unknown'
      : earned(input)
        ? null
        : status === 'voided'
        ? 'void'
        : status === 'expired' || (lastDay !== null && lastDay < input.today)
          ? 'expired'
          : yes(row['awaiting_sale'])
            ? 'inactive'
            : (wholeOf(row['uses_left']) ?? 0) + own(id) < 1
              ? 'used-up'
              : holder !== null && input.customer?.key !== holder
                ? // A named voucher is its holder's: staff are told so, and nobody else is told it exists.
                  input.origin === 'staff'
                  ? 'needs-customer'
                  : 'unknown'
                : null;
    if (reason === null) vouchers.push({ typed: code.typed, id, row });
    else refused.push({ typed: code.typed, reason });
  }
  return { vouchers, refused };
}
