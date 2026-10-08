/**
 * USES: of an offer, a code, a voucher, a pack.
 *
 * Where an order is posted, Adminium hands over what its price question
 * used, and each use becomes a row: held while the order is only reserved,
 * counted once it is posted, given back when it is cancelled. Adminium counts
 * those rows against an offer's and a code's limit and a pack's uses under
 * their locks, so the fifty-first of fifty is refused whoever asked first.
 * A voucher used by hand at a desk, sold on a sale line, or made by the
 * hundred for a leaflet goes through here too.
 */

import type { PostingInput, PostingUse } from '@adminium/add-on-contracts';

import { toUnits } from '../units.ts';
import { addDays } from './dates.ts';
import { actedBy, amountText, Answer, read, same, scaleOf, textOf, wholeOf, written, yes, type Row } from './ledger.ts';

/** Why a voucher or a pack cannot be used; null when it can. `units`: how many uses are asked of it. */
function unusable(voucher: Row, today: string, units: number): 'void' | 'expired' | 'inactive' | 'used-up' | null {
  const status = textOf(voucher['status']);
  if (status === 'voided') return 'void';
  const lastDay = textOf(voucher['expires_on']);
  if (status === 'expired' || (lastDay !== null && lastDay < today)) return 'expired';
  if (yes(voucher['awaiting_sale'])) return 'inactive';
  return usesLeft(voucher) < units ? 'used-up' : null;
}

/**
 * The uses a voucher has left. A voucher a batch made has had no use and no
 * balance worked out for it yet: it has all it was made with.
 */
export const usesLeft = (voucher: Row): number => wholeOf(voucher['uses_left']) ?? wholeOf(voucher['uses_total']) ?? 1;

/**
 * What of a sold voucher's price a use takes up: its share by uses, rounded
 * down, with the use that empties it taking the rest — so the uses of a pack
 * sold for $100.00 add up to $100.00 exactly.
 */
function prepaidBy(voucher: Row, uses: number, scale: number, already: bigint | null): string | null {
  if (!yes(voucher['sold'])) return null;
  const price = toUnits(voucher['sale_price'], scale);
  const total = wholeOf(voucher['uses_total']) ?? 1;
  if (price === null || total < 1) return null;
  const before = Math.max(0, total - usesLeft(voucher));
  const through = (count: number): bigint => (price * BigInt(Math.min(count, total))) / BigInt(total);
  // The use that empties it takes what its other uses have not: a use given back and taken again never adds a cent.
  if (already !== null && before + uses >= total) return amountText(price > already ? price - already : 0n, scale);
  return amountText(through(before + uses) - through(before), scale);
}

/** What the uses of a voucher that still stand have taken up of its price; null where they were not read. */
function prepaidSoFar(rows: readonly Row[] | null, voucher: Row, scale: number, without: ReadonlySet<string>, more: bigint): bigint | null {
  if (rows === null) return null;
  return rows.filter((row) => same(row['voucher_id'], voucher['id']) && textOf(row['state']) !== 'given_back' && !without.has(String(row['id']))).reduce((total, row) => total + (toUnits(row['prepaid'], scale) ?? 0n), more);
}

const kindOf = (use: PostingUse, voucher: Row | undefined): string => (voucher !== undefined ? (textOf(voucher['worth']) === 'pack' ? 'pack' : 'voucher') : use.code !== null ? 'code' : use.offer !== null ? 'offer' : 'staff');
const sameUse = (row: Row, use: PostingUse): boolean => same(row['offer_id'] ?? '', use.offer ?? '') && same(row['code_id'] ?? '', use.code ?? '') && same(row['voucher_id'] ?? '', use.voucher ?? '');
/** How many uses a use is: one, or the count a pack is asked for. Anything else is no use at all. */
function unitsOf(use: PostingUse): number {
  const units = use.units ?? 1;
  if (!Number.isInteger(units) || units < 1) throw new Error('a use of no whole number of uses');
  return units;
}

/** A voucher back in use after a use was given back: issued again, and — where its last day has passed — good for thirty days more. */
function reopen(answer: Answer, line: string, voucher: Row, today: string): void {
  const status = textOf(voucher['status']);
  const lastDay = textOf(voucher['expires_on']);
  const late = lastDay !== null && lastDay < today;
  if (status === 'voided' || (status === 'issued' && !late)) return;
  answer.update('vouchers', line, voucher['id'] ?? null, { ...(status === 'issued' ? {} : { status: 'issued' }), ...(late ? { expires_on: addDays(today, 30) } : {}) });
}

/** What an order used: held at a reserve, counted at a post, given back at a reverse. */
export function redeem(input: PostingInput, answer: Answer): void {
  const line = input.lines[0]?.line ?? '';
  const [offers, codes, vouchers] = [read(input, 'offers'), read(input, 'codes'), read(input, 'vouchers')];
  const mine = written(input, 'redemptions').filter((row) => textOf(row['state']) !== 'given_back');
  const uses = input.phase === 'reverse' ? [] : (input.uses ?? []);
  const spent = input.reads['spent'] === undefined ? null : read(input, 'spent');
  const scale = scaleOf(...uses.map((use) => use.amount), ...mine.map((row) => row['amount']), ...offers.flatMap((row) => [row['budget_left'], row['budget']]), ...vouchers.map((row) => row['sale_price']), ...(spent ?? []).map((row) => row['prepaid']));
  const acted = input.lines[0] === undefined ? null : actedBy(input, input.lines[0]);
  /**
   * WHAT THE ROUND HOLDS AND THE ORDER STILL HAS. A held use is this order's
   * own only while it is the same use for the same amount: an order changed
   * between the hold and the payment gives the old one back and is judged for
   * the new one, since a row once written keeps its figures.
   */
  const kept = new Map<PostingUse, Row>();
  const keptIds = new Set<string>();
  for (const use of uses) {
    const amount = toUnits(use.amount, scale);
    if (amount === null || amount < 0n) throw new Error('a use of no amount');
    const held = mine.find((row) => !keptIds.has(String(row['id'])) && sameUse(row, use) && (toUnits(row['amount'], scale) ?? 0n) === amount && (wholeOf(row['uses']) ?? 1) === unitsOf(use));
    if (held === undefined) continue;
    kept.set(use, held);
    keptIds.add(String(held['id']));
  }
  /** What this call gives back: it frees the room the same order is about to be judged for. */
  const freed = mine.filter((row) => !keptIds.has(String(row['id'])));
  const freedIds = new Set(freed.map((row) => String(row['id'])));
  const freedOf = (column: string, id: unknown): Row[] => freed.filter((row) => same(row[column], id));
  /** What this call adds to each offer's and code's uses and budget, and takes of each voucher's, beside what their rows say. */
  const moreUses = new Map<string, number>();
  const moreGiven = new Map<string, bigint>();
  const taken = new Map<string, number>();
  const morePrepaid = new Map<string, bigint>();

  for (const use of uses) {
    const offer = use.offer === null ? undefined : offers.find((row) => same(row['id'], use.offer));
    const code = use.code === null ? undefined : codes.find((row) => same(row['id'], use.code));
    const voucher = use.voucher === null ? undefined : vouchers.find((row) => same(row['id'], use.voucher));
    if ((use.offer !== null && offer === undefined) || (use.code !== null && code === undefined) || (use.voucher !== null && voucher === undefined)) throw new Error('a use names a row that was not read');
    const units = unitsOf(use);
    // A use this round already holds is this order's own: counted now, and judged no second time.
    const held = kept.get(use);
    if (held !== undefined) {
      if (input.phase === 'post' && textOf(held['state']) === 'held') answer.update('redemptions', line, held['id'] ?? null, { state: 'counted', at: input.now });
      continue;
    }
    const amount = toUnits(use.amount, scale) ?? 0n;
    if (offer !== undefined) {
      const key = String(offer['id']);
      const most = wholeOf(offer['max_uses']);
      const used = (wholeOf(offer['uses']) ?? 0) - freedOf('offer_id', offer['id']).length + (moreUses.get(key) ?? 0);
      const open = offer['budget_open'] === null || offer['budget_open'] === undefined || yes(offer['budget_open']);
      const budget = (toUnits(offer['budget_left'], scale) ?? toUnits(offer['budget'], scale) ?? 0n) + freedOf('offer_id', offer['id']).reduce((total, row) => total + (toUnits(row['amount'], scale) ?? 0n), 0n) - (moreGiven.get(key) ?? 0n);
      if ((most !== null && used >= most) || (!open && budget < amount)) {
        answer.refuse(line, 'used-up');
        continue;
      }
      moreUses.set(key, (moreUses.get(key) ?? 0) + 1);
      moreGiven.set(key, (moreGiven.get(key) ?? 0n) + amount);
      // The flag a list shows: the last use, or a budget this use spends to the last unit.
      if ((most !== null && used + 1 >= most) || (!open && budget === amount)) answer.update('offers', line, offer['id'] ?? null, { used_up: true });
    }
    if (code !== undefined) {
      const key = `code ${String(code['id'])}`;
      const most = wholeOf(code['max_uses']);
      if (most !== null && (wholeOf(code['uses']) ?? 0) - freedOf('code_id', code['id']).length + (moreUses.get(key) ?? 0) >= most) {
        answer.refuse(line, 'used-up');
        continue;
      }
      moreUses.set(key, (moreUses.get(key) ?? 0) + 1);
    }
    let prepaid: string | null = null;
    if (voucher !== undefined) {
      const before = taken.get(String(voucher['id'])) ?? 0;
      const back = freedOf('voucher_id', voucher['id']).reduce((total, one) => total + (wholeOf(one['uses']) ?? 1), 0);
      const row = { ...voucher, uses_left: usesLeft(voucher) + back - before };
      const state = unusable(row, input.today, units);
      if (state !== null) {
        answer.refuse(line, state);
        continue;
      }
      taken.set(String(voucher['id']), before + units);
      prepaid = prepaidBy(row, units, scale, prepaidSoFar(spent, voucher, scale, freedIds, morePrepaid.get(String(voucher['id'])) ?? 0n));
      if (prepaid !== null) morePrepaid.set(String(voucher['id']), (morePrepaid.get(String(voucher['id'])) ?? 0n) + (toUnits(prepaid, scale) ?? 0n));
      if (usesLeft(row) - units <= 0 && textOf(voucher['status']) !== 'used') answer.update('vouchers', line, voucher['id'] ?? null, { status: 'used' });
    }
    answer.insert('redemptions', line, {
      kind: kindOf(use, voucher),
      offer_id: offer?.['id'] ?? null,
      code_id: code?.['id'] ?? null,
      voucher_id: voucher?.['id'] ?? null,
      // Why staff took something off: the reason on the order, for a reduction that is nobody's but theirs — where it is a reason there is.
      reason_id: use.offer === null && use.voucher === null && use.code === null ? (read(input, 'reasons').find((row) => same(row['id'], input.lines[0]?.inputs['reason']))?.['id'] ?? null) : null,
      source_table: acted?.source_table ?? input.source.table,
      source_row: acted?.source_row ?? input.source.row,
      source_label: acted?.source_label ?? null,
      customer: use.customer ?? null,
      amount: amountText(amount, scale),
      uses: units,
      prepaid,
      state: input.phase === 'reserve' ? 'held' : 'counted',
      at: input.now,
    });
  }

  // What the round holds and the order no longer has — every row of it, on a reverse — is given back.
  for (const row of freed) {
    answer.update('redemptions', line, row['id'] ?? null, { state: 'given_back', given_back_at: input.now });
    const offer = offers.find((one) => same(one['id'], row['offer_id']));
    // The flag comes off unless this same call has just set it again.
    if (offer !== undefined && yes(offer['used_up']) && !moreUses.has(String(offer['id']))) answer.update('offers', line, offer['id'] ?? null, { used_up: false });
    const voucher = vouchers.find((one) => same(one['id'], row['voucher_id']));
    if (voucher !== undefined && !taken.has(String(voucher['id']))) reopen(answer, line, voucher, input.today);
  }
}

/** A voucher used, given a use back, or cancelled, by hand at a desk. */
export function voucherAction(input: PostingInput, answer: Answer): void {
  const vouchers = read(input, 'voucher');
  const counted = read(input, 'last');
  const scale = scaleOf(...vouchers.map((row) => row['sale_price']));
  for (const line of input.lines) {
    const voucher = vouchers.find((row) => same(row['id'], line.inputs['voucher']));
    if (voucher === undefined) throw new Error('a hand action names a voucher that was not read');
    const action = textOf(line.inputs['action']);
    if (action === 'use') {
      const state = unusable(voucher, input.today, 1);
      if (state !== null) {
        answer.refuse(line.line, state);
        continue;
      }
      answer.insert('redemptions', line.line, {
        kind: textOf(voucher['worth']) === 'pack' ? 'pack' : 'voucher',
        offer_id: null,
        code_id: null,
        voucher_id: voucher['id'] ?? null,
        reason_id: null,
        ...actedBy(input, line),
        customer: null,
        amount: amountText(0n, scale),
        uses: 1,
        prepaid: prepaidBy(voucher, 1, scale, prepaidSoFar(input.reads['spent'] === undefined ? null : read(input, 'spent'), voucher, scale, new Set(), 0n)),
        state: 'counted',
      });
      if (usesLeft(voucher) - 1 <= 0) answer.update('vouchers', line.line, voucher['id'] ?? null, { status: 'used' });
    } else if (action === 'give_back') {
      // The newest counted use of this voucher.
      const last = counted.filter((row) => same(row['voucher_id'], voucher['id'])).sort((a, b) => (String(a['at'] ?? '') === String(b['at'] ?? '') ? (Number.isFinite(Number(a['id'])) && Number.isFinite(Number(b['id'])) ? Number(b['id']) - Number(a['id']) : String(a['id']) < String(b['id']) ? 1 : -1) : String(a['at'] ?? '') < String(b['at'] ?? '') ? 1 : -1))[0];
      if (last === undefined || textOf(voucher['status']) === 'voided') {
        answer.refuse(line.line, 'not-allowed');
        continue;
      }
      answer.update('redemptions', line.line, last['id'] ?? null, { state: 'given_back', given_back_at: input.now });
      reopen(answer, line.line, voucher, input.today);
    } else if (action === 'void') {
      if (textOf(voucher['status']) === 'voided') answer.refuse(line.line, 'void');
      else answer.update('vouchers', line.line, voucher['id'] ?? null, { status: 'voided' });
    } else throw new Error(`a hand action of an unknown kind: ${String(action)}`);
  }
}

/** A voucher or a pack sold on a sale line, once its order is paid: no longer waiting, and carrying what it was sold for. */
export function sell(input: PostingInput, answer: Answer): void {
  const vouchers = read(input, 'voucher');
  const scale = scaleOf(...input.lines.map((line) => line.inputs['amount']));
  for (const line of input.lines) {
    const id = line.inputs['voucher'];
    // An ordinary sale line.
    if (textOf(id) === null) {
      answer.note(line.line, 'not-linked');
      continue;
    }
    const voucher = vouchers.find((row) => same(row['id'], id));
    const amount = toUnits(line.inputs['amount'], scale);
    if (voucher === undefined) throw new Error('a sale line names a voucher that was not read');
    if (input.phase === 'reverse') {
      // The sale undone: waiting again, unless somebody has used it since.
      if (usesLeft(voucher) < (wholeOf(voucher['uses_total']) ?? 1) || textOf(voucher['status']) !== 'issued') answer.note(line.line, 'to-check');
      else if (yes(voucher['sold'])) answer.update('vouchers', line.line, voucher['id'] ?? null, { sold: false, awaiting_sale: true, sale_price: null, tax_later: false });
      continue;
    }
    // A voucher cancelled or past its day while it waited is not sold: nobody could use it.
    const status = textOf(voucher['status']);
    const lastDay = textOf(voucher['expires_on']);
    if (status === 'voided' || status === 'expired' || (lastDay !== null && lastDay < input.today)) {
      answer.refuse(line.line, status === 'voided' ? 'void' : 'expired');
      continue;
    }
    if (!yes(voucher['awaiting_sale']) || amount === null || amount < 0n) {
      answer.refuse(line.line, 'not-allowed');
      continue;
    }
    answer.update('vouchers', line.line, voucher['id'] ?? null, { sold: true, awaiting_sale: false, sale_price: amountText(amount, scale), tax_later: yes(line.inputs['tax_later']) });
  }
}

/** The most vouchers one part of a batch makes: what one answer may hold. */
export const PART_MAX = 500;

/** A part of a batch: so many vouchers, each a copy of the batch's own description. Adminium makes each one's code. */
export function make(input: PostingInput, answer: Answer): void {
  const batches = read(input, 'batch');
  for (const line of input.lines) {
    const batch = batches.find((row) => same(row['id'], line.inputs['batch']));
    const size = wholeOf(line.inputs['size']);
    if (batch === undefined || size === null || size < 1 || size > PART_MAX) throw new Error('a part of a batch that was not read, or of a size no part has');
    for (let made = 0; made < size; made += 1) {
      answer.insert('vouchers', line.line, {
        batch_id: batch['id'] ?? null,
        worth: batch['worth'] ?? null,
        value: batch['value'] ?? null,
        what: batch['what'] ?? null,
        source_table: batch['source_table'] ?? '',
        source_row: batch['source_row'] ?? '',
        units: batch['units'] ?? 1,
        public_name: batch['public_name'] ?? '',
        uses_total: batch['uses_total'] ?? 1,
        expires_on: batch['expires_on'] ?? null,
        note: batch['note'] ?? null,
      });
    }
  }
}
