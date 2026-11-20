/**
 * MONEY ON A CARD: paying with one, giving money back to one, putting value
 * on one, closing one — and the card a shopper's sale makes, and cancels
 * again when the sale is undone.
 *
 * A card's ledger is rows that take from it (`taken` above nothing) and rows
 * that give to it (`taken` below nothing); Adminium adds them up under the
 * card's lock and refuses a row that would take it below nothing. Every row
 * says what it left on the card, so a receipt printed again still reads true.
 *
 * A line whose card link is empty — a cash payment in a table that also
 * takes cards, an ordinary line beside one that loads a card — is no card's
 * business: nothing is written for it, and staff are told it was not linked.
 * The one exception is a shopper's line that sells a card: it names none
 * because its own sale makes it (`issue`, below).
 */

import type { PostingInput, PostingLine } from '@adminium/add-on-contracts';

import { least, toUnits } from '../units.ts';
import { addDays, addMonths } from './dates.ts';
import { actedBy, amountText, Answer, Balances, read, reverseCardRows, same, scaleOf, textOf, wholeOf, written, yes, type Row } from './ledger.ts';

/** Why a card cannot be used as it stands; null when it can. A card not yet sold holds nothing to use. */
function unusable(card: Row, today: string): 'inactive' | 'void' | 'expired' | null {
  const status = textOf(card['status']);
  if (status === 'inactive') return 'inactive';
  if (status === 'void') return 'void';
  const lastDay = textOf(card['expires_on']);
  return status === 'expired' || (lastDay !== null && lastDay < today) ? 'expired' : null;
}

const scaleFor = (input: PostingInput, names: readonly string[], cards: readonly Row[], more: readonly unknown[] = []): number =>
  scaleOf(...input.lines.flatMap((line) => names.map((name) => line.inputs[name])), ...cards.map((card) => card['balance']), ...more);

/** A card pays what is due, as far as it goes — or exactly what was asked of it. */
export function spend(input: PostingInput, answer: Answer): void {
  const cards = read(input, 'card');
  const balances = new Balances(cards, scaleFor(input, ['due', 'ask'], cards));
  const scale = balances.scale;
  for (const line of input.lines) {
    const id = line.inputs['card'];
    if (textOf(id) === null) {
      answer.note(line.line, 'not-linked');
      continue;
    }
    const card = balances.card(id);
    if (card === undefined) {
      answer.refuse(line.line, 'not-valid');
      continue;
    }
    const state = unusable(card, input.today);
    if (state !== null) {
      answer.refuse(line.line, state);
      continue;
    }
    // Store credit is spent at a desk, where somebody can see whose it is.
    if (textOf(card['kind']) === 'credit' && input.origin === 'public') {
      answer.refuse(line.line, 'not-valid');
      continue;
    }
    const due = toUnits(line.inputs['due'], scale);
    if (due === null || due <= 0n) {
      answer.refuse(line.line, 'not-allowed');
      continue;
    }
    const balance = balances.of(id);
    if (balance <= 0n) {
      answer.refuse(line.line, 'empty', balances.text(balance < 0n ? 0n : balance));
      continue;
    }
    const ask = toUnits(line.inputs['ask'], scale);
    if (ask !== null && (ask <= 0n || ask > due)) {
      answer.refuse(line.line, 'not-allowed');
      continue;
    }
    if (ask !== null && balance < ask) {
      answer.refuse(line.line, 'empty', balances.text(balance));
      continue;
    }
    const amount = ask ?? least(balance, due);
    const after = balances.move(id, amount);
    answer.decide(line.line, 'amount', balances.text(amount));
    answer.decide(line.line, 'balance_after', balances.text(after));
    answer.insert('card_ledger', line.line, { card_id: card['id'] ?? null, kind: 'spend', taken: balances.text(amount), value: balances.text(amount), balance_after: balances.text(after), ...actedBy(input, line) });
  }
}

/** Money given back to the card a payment came from: never more than that payment took and has not had back. */
export function refund(input: PostingInput, answer: Answer): void {
  const cards = read(input, 'card');
  const spends = read(input, 'spend');
  const given = read(input, 'given');
  const balances = new Balances(cards, scaleFor(input, ['amount'], cards, [...spends, ...given].flatMap((row) => [row['value'], row['taken']])));
  const scale = balances.scale;
  /** What each spend has had back in this call, beside what its rows say. */
  const back = new Map<string, bigint>();
  for (const line of input.lines) {
    const paid = spends.filter((row) => same(row['source_table'], line.inputs['against_table']) && same(row['source_row'], line.inputs['against_row']));
    // The payment this goes back to was not a card's.
    if (paid.length === 0) {
      answer.note(line.line, 'not-linked');
      continue;
    }
    const amount = toUnits(line.inputs['amount'], scale);
    if (amount === null || amount <= 0n) {
      answer.refuse(line.line, 'not-allowed');
      continue;
    }
    // Every row against a spend: what was given back (a row that gives to the card), less what was taken again.
    const leftOf = (row: Row): bigint => (toUnits(row['value'], scale) ?? 0n) - given.filter((one) => same(one['against_id'], row['id'])).reduce((total, one) => total - (toUnits(one['taken'], scale) ?? 0n), 0n) - (back.get(String(row['id'])) ?? 0n);
    // A payment posted, undone and posted again has a row for each time: the one that still holds the money, whatever order they were read in.
    const byLeft = [...paid].sort((a, b) => (leftOf(a) === leftOf(b) ? (String(a['id']) < String(b['id']) ? -1 : 1) : leftOf(a) > leftOf(b) ? -1 : 1));
    const spent = byLeft[0] as Row;
    const left = leftOf(spent);
    if (amount > left) {
      answer.refuse(line.line, 'refund-over', amountText(left < 0n ? 0n : left, scale));
      continue;
    }
    back.set(String(spent['id']), (back.get(String(spent['id'])) ?? 0n) + amount);
    // Back to the same card, whatever has become of it since.
    const after = balances.move(spent['card_id'], -amount);
    answer.insert('card_ledger', line.line, { card_id: spent['card_id'] ?? null, kind: 'refund', taken: balances.text(-amount), value: balances.text(amount), balance_after: balances.text(after), against_id: spent['id'] ?? null, ...actedBy(input, line) });
  }
}

/** The day a card stops, and the day its holder is reminded: so many months from today, where the place sets a limit at all. */
function lastDays(input: PostingInput): { expires_on: string; remind_on: string | null } | null {
  const months = wholeOf(input.settings['card_expiry_months']);
  const expires = months === null || months < 1 ? null : addMonths(input.today, months);
  if (expires === null) return null;
  return { expires_on: expires, remind_on: addDays(expires, -(wholeOf(input.settings['card_reminder_days']) ?? 30)) };
}

/**
 * Value put on a card: by a sale line once its order is paid (`issue`), or by
 * a manager's hand (`card-action`, action `issue` or `top_up`). The first
 * value a card gets makes it active; store credit is money given back, and
 * is written as such.
 */
function load(input: PostingInput, answer: Answer, line: PostingLine, balances: Balances, card: Row, amount: bigint, opts: { byHand: boolean; note: string | null; judged?: boolean }): void {
  const scale = balances.scale;
  const status = textOf(card['status']);
  const credit = textOf(card['kind']) === 'credit';
  if (yes(input.settings['cards_paused']) && opts.judged !== true) return answer.refuse(line.line, 'not-allowed');
  if (status === 'void') return answer.refuse(line.line, 'void');
  const lastDay = textOf(card['expires_on']);
  if (status === 'expired' || (lastDay !== null && lastDay < input.today)) return answer.refuse(line.line, 'expired');
  // Store credit is given, never sold.
  if (credit && !opts.byHand) return answer.refuse(line.line, 'not-allowed');
  const balance = balances.of(card['id']);
  const [low, high] = [toUnits(input.settings['card_min'], scale), toUnits(input.settings['card_max'], scale)];
  const outside = opts.judged !== true && ((!credit && low !== null && amount < low) || (high !== null && (balance + amount > high || (!credit && amount > high))));
  if (amount <= 0n || outside) return answer.refuse(line.line, 'not-allowed');
  const after = balances.move(card['id'], -amount);
  const first = status === 'inactive' && !balances.activated.has(String(card['id']));
  if (first) balances.activated.add(String(card['id']));
  answer.insert('card_ledger', line.line, {
    card_id: card['id'] ?? null,
    kind: credit ? 'refund' : first ? 'issue' : 'top_up',
    taken: balances.text(-amount),
    value: balances.text(amount),
    balance_after: balances.text(after),
    ...(opts.note === null ? {} : { note: opts.note }),
    ...actedBy(input, line),
  });
  // A card's months start again with every value put on it; credit never runs out.
  const days = credit ? null : lastDays(input);
  if (first) {
    const sendOn = textOf(card['send_on']);
    answer.update('gift_cards', line.line, card['id'] ?? null, {
      status: 'active',
      issued_at: input.now,
      ...(days === null ? {} : days),
      // Which first mail goes out: set once, in the write that makes the card active.
      notify: credit ? 'credit' : sendOn !== null && sendOn > input.today ? 'card_dated' : 'card',
    });
  } else if (days !== null) answer.update('gift_cards', line.line, card['id'] ?? null, days);
}

/**
 * A sale line that loads a card, once its order is paid.
 *
 * Two kinds of line come here. A till's line names a card a cashier made a
 * moment before (`card`), and loads it when the ticket is paid — as it always
 * has. A shopper's line names no card: nobody but Offers can make one, and a
 * host is never handed the key of a row Offers makes. So the card is made by
 * the sale itself, in three steps of one round (see `makeCards`, below, and
 * `unissue`): made, inactive and holding nothing, when the order is written;
 * loaded, made active and mailed when it is paid; cancelled when the order is
 * given up unpaid. Such a card carries the line that made it
 * (`source_table`, `source_row`), which is how each step finds it again.
 */
export function issue(input: PostingInput, answer: Answer): void {
  if (input.phase === 'reserve') return makeCards(input, answer);
  const cards = read(input, 'card');
  const made = madeCards(input);
  const balances = new Balances([...cards, ...made], scaleFor(input, ['amount'], [...cards, ...made], [input.settings['card_min'], input.settings['card_max']]));
  for (const line of input.lines) {
    const id = line.inputs['card'];
    const amount = toUnits(line.inputs['amount'], balances.scale);
    if (textOf(id) === null) {
      const mine = madeFor(input, line, made);
      // An ordinary sale line: no card of its own, and none it made. But a line that carries a card's amount and its
      // recipient sold a card all the same — paid in a round that never made one (posted again after a cancel, or a rule
      // with no reserve): nothing is loaded, and staff are told to look rather than that it was not linked.
      if (mine === undefined) answer.note(line.line, amount !== null && textOf(line.inputs['to_email']) !== null ? 'to-check' : 'not-linked');
      /*
       * A guest never pays an order by saving it: the money is recorded by the payment's own path, or by staff. A post
       * that a guest's own save sets off would make a card a sale made active — and mail its code — for money nobody
       * took; `move` refuses a guest for the same reason. The contract has no word of its own for "not from here", so
       * the word is `not-allowed`.
       */
      else if (input.origin === 'public') answer.refuse(line.line, 'not-allowed');
      // A card cancelled by hand while its order waited for its money. The money has come all the same: refusing would
      // refuse the payment, so nothing is put on the card and staff are told to look.
      else if (textOf(mine['status']) === 'void') answer.note(line.line, 'to-check');
      else if (amount === null) answer.refuse(line.line, 'not-allowed');
      // What was judged when the order was written (cards paused, the least and the most a card is sold for) is not
      // judged again: the shopper has paid for this card, and a setting changed since does not take it back.
      else load(input, answer, line, balances, mine, amount, { byHand: false, note: null, judged: true });
      continue;
    }
    const card = balances.card(id);
    if (card === undefined) answer.refuse(line.line, 'not-valid');
    else if (amount === null) answer.refuse(line.line, 'not-allowed');
    else load(input, answer, line, balances, card, amount, { byHand: false, note: null });
  }
}

/** The most each of a recipient's words may hold: what the card's own columns take. */
const RECIPIENT_MAX: Readonly<Record<string, number>> = { to_name: 80, sender: 80, to_email: 254, message: 200, language: 12 };
/** Digits a gift message may carry: enough for a date or a year, never a card number or a phone number in full. */
const MESSAGE_DIGITS = 20;
/** An address shaped like one: somebody, an at, a place with a dot in it. The table's own rule judges it again. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The line a row stands for, as a card a sale made names it. */
const lineOf = (input: PostingInput, line: PostingLine): { table: string; row: string } => ({ table: line.lineTable === '' ? input.source.table : line.lineTable, row: line.line === '' ? input.source.row : line.line });

/**
 * The cards this round made, each as it stands now: what the round wrote,
 * read again for its state where the read has it. A card that is in the
 * read and not in what the round wrote was made by another round.
 */
function madeCards(input: PostingInput): Row[] {
  const fresh = read(input, 'made');
  return written(input, 'gift_cards').map((row) => fresh.find((one) => same(one['id'], row['id'])) ?? row);
}

/** The card a line's own sale made: the one that names the line. */
function madeFor(input: PostingInput, line: PostingLine, made: readonly Row[]): Row | undefined {
  const own = lineOf(input, line);
  return made.find((card) => same(card['source_table'], own.table) && same(card['source_row'], own.row));
}

/**
 * The order is written: a card is made for each line that loads one and
 * names none, inactive and holding nothing, with whom it is for. Whether
 * cards are sold at all, and for how much, is judged here — the shopper
 * hears it before paying. A line that names a card (a till's) loads it when
 * paid and has nothing to do yet.
 *
 * Nothing about a stranger's words is trusted beyond what the card's own
 * columns take: a value they would refuse is refused here, by name, rather
 * than failing the save with a row Adminium cannot write.
 */
function makeCards(input: PostingInput, answer: Answer): void {
  const scale = scaleOf(...input.lines.map((line) => line.inputs['amount']), input.settings['card_min'], input.settings['card_max']);
  const [low, high] = [toUnits(input.settings['card_min'], scale), toUnits(input.settings['card_max'], scale)];
  for (const line of input.lines) {
    if (textOf(line.inputs['card']) !== null) continue;
    const amount = toUnits(line.inputs['amount'], scale);
    // An ordinary line: it loads no card.
    if (amount === null) {
      answer.note(line.line, 'not-linked');
      continue;
    }
    if (yes(input.settings['cards_paused']) || amount <= 0n || (low !== null && amount < low) || (high !== null && amount > high)) {
      answer.refuse(line.line, 'not-allowed');
      continue;
    }
    const words = Object.fromEntries(Object.keys(RECIPIENT_MAX).map((name) => [name, textOf(line.inputs[name])]));
    const email = words['to_email'] ?? null;
    const tooLong = Object.entries(words).some(([name, value]) => value !== null && [...value].length > (RECIPIENT_MAX[name] ?? 0));
    const digits = (words['message'] ?? '').replace(/\D/g, '').length;
    // A card nobody is sent is a card nobody can use: its code is told to its recipient and to nobody else.
    if (email === null || !EMAIL.test(email.trim()) || tooLong || digits > MESSAGE_DIGITS) {
      answer.refuse(line.line, 'not-allowed');
      continue;
    }
    const own = lineOf(input, line);
    answer.insert('gift_cards', line.line, {
      kind: 'card',
      status: 'inactive',
      recipient_name: words['to_name'] ?? null,
      recipient_email: email.trim(),
      sender_name: words['sender'] ?? null,
      message: words['message'] ?? null,
      language: words['language'] ?? null,
      source_table: own.table,
      source_row: own.row,
    });
  }
}

/** The words a card cancelled by a sale's own undoing keeps, for staff. Rows hold no language, so they are plain English. */
export const UNPAID_REASON = 'Its order was cancelled before it was paid.';
export const RECALL_REASON = 'Its order was cancelled after it was paid.';

/**
 * Whether the card's holder was ever sent their card: then they are told,
 * too, when it is cancelled. A card dated for a later day has not been sent
 * yet, and its mail is dropped with the card.
 */
const wasSent = (card: Row, today: string): boolean => {
  const notify = textOf(card['notify']);
  const sendOn = textOf(card['send_on']);
  return textOf(card['recipient_email']) !== null && (notify === 'card' || (notify === 'card_dated' && (sendOn === null || sendOn <= today)));
};

/**
 * A sale undone: what it put on a till's card is taken back, as it always
 * was (`reverseCardRows`). A card the sale made itself is treated by what the
 * round reached:
 *
 *  - never paid — the card holds nothing and nobody has it: it is cancelled;
 *  - paid — it was mailed and may have been spent. A reverse cannot refuse,
 *    and taking back what is on it would let the order's money go back even
 *    when the card was spent. So it is left as it stands, for `recall`, which
 *    the same cancel posts and which runs after every reverse of the save:
 *    it cancels the card while unspent and refuses the cancel when not.
 */
export function unissue(input: PostingInput, answer: Answer): void {
  const made = madeCards(input);
  const ids = new Set(made.map((card) => String(card['id'])));
  const rows = written(input, 'card_ledger');
  reverseCardRows(input, answer, 'adjust', rows.filter((row) => !ids.has(String(row['card_id']))));
  for (const line of input.lines) {
    if (textOf(line.inputs['card']) !== null) continue;
    const card = madeFor(input, line, made);
    if (card === undefined || rows.some((row) => same(row['card_id'], card['id']))) continue;
    const status = textOf(card['status']);
    if (status === 'void') continue;
    // Loaded by a manager's hand since it was made: it holds what somebody gave it, and is not this sale's to cancel.
    if (status !== 'inactive') {
      answer.note(line.line, 'to-check');
      continue;
    }
    answer.update('gift_cards', line.line, card['id'] ?? null, { status: 'void', void_reason: UNPAID_REASON, ...(wasSent(card, input.today) ? { notify: 'cancelled' } : {}) });
  }
}

/**
 * A card a sale loaded, cancelled because the sale is: named by the line
 * that sold it, under the card's own lock — the lock a payment by the card
 * takes — so a spend and a recall take turns, and the second sees what the
 * first did.
 *
 * Only the sale that first loaded a card — the one that made it a card a
 * holder could use — recalls it: a top-up on a card somebody already held is
 * taken back by the sale's own reverse, as it always was.
 *
 * Refused when the card has paid for anything — what its payments took, less
 * what went back to them — or, while it is still in use, holds less than the
 * sale put on it: giving the order's money back would then pay for goods
 * twice. Spending is read from the card's own rows, never from its balance
 * or its state alone: a top-up since, or a manager cancelling the card by
 * hand after it was spent, would hide it. Otherwise what is on the card is
 * written off with one row and the card is cancelled; a recipient who was
 * sent the card is told, and staff are told to look when anything but the
 * sale put value on it. A line that loaded no card and a sale already taken
 * back have nothing to recall; nor has a card cancelled or run out by its
 * last day without a cent of it spent — it is dead already, and the order's
 * money may go back.
 *
 * A card that ran out by its last day after being spent is refused like any
 * spent card: its order is not cancelled and refunded through the recall,
 * and staff refund by hand what they judge is owed.
 *
 * The refusal's word is `used-up`, with what is left: the contract a ledger
 * answers in has no word of its own for "partly spent".
 */
export function recall(input: PostingInput, answer: Answer): void {
  const sold = read(input, 'sold');
  const cards = read(input, 'card');
  const given = read(input, 'given');
  /** Every row of each card the sales loaded: what was spent from it is read here. */
  const history = read(input, 'history');
  const balances = new Balances(cards, scaleFor(input, [], cards, [...sold, ...given, ...history].flatMap((row) => [row['value'], row['taken']])));
  const scale = balances.scale;
  const cancelled = new Set<string>();
  for (const line of input.lines) {
    const sale = line.inputs['sale'] as { table?: unknown; row?: unknown } | null | undefined;
    const loads = sold.filter((row) => same(row['source_table'], sale?.table) && same(row['source_row'], sale?.row));
    if (loads.length === 0) {
      answer.note(line.line, 'not-linked');
      continue;
    }
    // What the sale put on each card and still has there: each load, less what a reverse took back against it.
    const put = new Map<string, bigint>();
    for (const row of loads) {
      const back = given.filter((one) => same(one['against_id'], row['id'])).reduce((total, one) => total + (toUnits(one['taken'], scale) ?? 0n), 0n);
      put.set(String(row['card_id']), (put.get(String(row['card_id'])) ?? 0n) + (toUnits(row['value'], scale) ?? 0n) - back);
    }
    for (const [id, loaded] of put) {
      const card = balances.card(id);
      if (card === undefined) throw new Error('a sale names a card that was not read');
      if (cancelled.has(id) || loaded <= 0n) continue;
      const rows = history.filter((row) => same(row['card_id'], id));
      const isLoad = (ref: unknown): boolean => loads.some((row) => same(row['id'], ref));
      const spends = new Set(rows.filter((row) => textOf(row['kind']) === 'spend').map((row) => String(row['id'])));
      // What the card's payments took, less what went back to them, plus what was taken again: the whole of each payment's chain.
      const spent = rows.filter((row) => spends.has(String(row['id'])) || spends.has(String(row['against_id']))).reduce((total, row) => total + (toUnits(row['taken'], scale) ?? 0n), 0n);
      const status = textOf(card['status']);
      const dead = status === 'void' || status === 'expired';
      const balance = dead ? 0n : balances.of(id);
      if (spent > 0n || (!dead && balance < loaded)) {
        answer.refuse(line.line, 'used-up', balances.text(balance < 0n ? 0n : balance));
        continue;
      }
      if (dead) continue;
      cancelled.add(id);
      // Value put on by somebody else — a top-up, a correction by hand — goes with the card, and staff are told to look.
      const others = rows.some((row) => !isLoad(row['id']) && !isLoad(row['against_id']) && !spends.has(String(row['id'])) && !spends.has(String(row['against_id'])));
      if (others || balance > loaded) answer.note(line.line, 'to-check');
      answer.insert('card_ledger', line.line, { card_id: card['id'] ?? null, kind: 'void', taken: balances.text(balance), value: balances.text(balance), balance_after: balances.text(balances.move(id, balance)), ...actedBy(input, line) });
      answer.update('gift_cards', line.line, card['id'] ?? null, { status: 'void', void_reason: textOf(line.inputs['reason']) ?? RECALL_REASON, ...(wasSent(card, input.today) ? { notify: 'cancelled' } : {}) });
    }
  }
}

/** What a manager does to a card by hand: the first value, more value, or a correction either way. */
export function cardAction(input: PostingInput, answer: Answer): void {
  const cards = read(input, 'card');
  const balances = new Balances(cards, scaleFor(input, ['amount'], cards, [input.settings['card_min'], input.settings['card_max']]));
  for (const line of input.lines) {
    const card = balances.card(line.inputs['card']);
    if (card === undefined) throw new Error('a hand action names a card that was not read');
    const action = textOf(line.inputs['action']);
    const amount = toUnits(line.inputs['amount'], balances.scale);
    const note = textOf(line.inputs['reason']);
    if (action === 'issue' || action === 'top_up') {
      if (amount === null) answer.refuse(line.line, 'not-allowed');
      else load(input, answer, line, balances, card, amount, { byHand: true, note });
      continue;
    }
    if (action !== 'adjust') throw new Error(`a hand action of an unknown kind: ${String(action)}`);
    // A correction is signed as the holder sees it: more on the card, or less.
    const state = unusable(card, input.today);
    if (state !== null) {
      answer.refuse(line.line, state);
      continue;
    }
    if (amount === null || amount === 0n) {
      answer.refuse(line.line, 'not-allowed');
      continue;
    }
    const balance = balances.of(card['id']);
    if (amount < 0n && -amount > balance) {
      answer.refuse(line.line, 'empty', balances.text(balance));
      continue;
    }
    const after = balances.move(card['id'], -amount);
    answer.insert('card_ledger', line.line, { card_id: card['id'] ?? null, kind: 'adjust', taken: balances.text(-amount), value: balances.text(amount < 0n ? -amount : amount), balance_after: balances.text(after), ...(note === null ? {} : { note }), ...actedBy(input, line) });
  }
}

/** A card cancelled, or past its last day: what was left on it is closed out with one row. A card holding nothing needs none. */
export function close(input: PostingInput, answer: Answer, kind: 'void' | 'expire'): void {
  const cards = read(input, 'card');
  const balances = new Balances(cards, scaleFor(input, [], cards));
  for (const line of input.lines) {
    const named = line.inputs['card'] as { row?: unknown } | null | undefined;
    const card = cards.find((one) => same(one['id'], named?.row)) ?? (cards.length === 1 ? cards[0] : undefined);
    if (card === undefined) throw new Error('a card was closed that was not read');
    const balance = balances.of(card['id']);
    if (balance <= 0n) continue;
    answer.insert('card_ledger', line.line, { card_id: card['id'] ?? null, kind, taken: balances.text(balance), value: balances.text(balance), balance_after: balances.text(balances.move(card['id'], balance)), ...actedBy(input, line) });
  }
}

/**
 * A card brought in from a till, one old row at a time: the old row's amount,
 * in the holder's sign, at the moment it happened. The first row makes the
 * card active; no mail goes out for a card somebody already holds, and it
 * keeps no last day.
 */
export function move(input: PostingInput, answer: Answer): void {
  const cards = read(input, 'card');
  const balances = new Balances(cards, scaleFor(input, ['amount'], cards));
  const KINDS: Readonly<Record<string, string>> = { issue: 'issue', reload: 'top_up', top_up: 'top_up', redeem: 'spend', spend: 'spend', refund: 'refund', adjust: 'adjust' };
  const activated = new Set<string>();
  /** Old cards this answer makes, by the till's key for them: the name each goes by for the rest of the answer. */
  const made = new Map<string, string>();
  for (const line of input.lines) {
    const old = textOf(line.inputs['old_card']);
    const card = cards.find((one) => same(one['moved_from'], line.inputs['old_card']));
    const amount = toUnits(line.inputs['amount'], balances.scale);
    const kind = KINDS[textOf(line.inputs['kind']) ?? ''];
    const at = textOf(line.inputs['at']) ?? input.now;
    const note = textOf(line.inputs['note']);
    if (card === undefined) {
      /*
       * The card's first old row, and no card yet: it is made here, under the
       * code it has always had. Nobody types that code — it comes from the
       * till's own row — and a second row of the same card in this answer
       * points at the card this one made.
       */
      const code = oldCode(line.inputs['old_code']);
      if (old === null || code === null) throw new Error('an old row was brought in for a card that was not made, and it names no code to make it with');
      /*
       * A card is made only while the move runs: its latch (`cards_paused`) is
       * the one thing only a Super Admin sets, and nothing a guest or a rule
       * of somebody's own can stand in for. Without it a row written into a
       * table that posts here would mint a card of any worth under any code.
       */
      if (!yes(input.settings['cards_paused']) || input.origin === 'public') {
        answer.refuse(line.line, 'not-allowed');
        continue;
      }
      if (amount === null || kind === undefined) throw new Error('an old row with no amount, or of an unknown kind');
      let label = made.get(old);
      if (label === undefined) {
        label = `card:${old}`;
        made.set(old, label);
        answer.insert('gift_cards', line.line, { kind: 'card', code, status: 'active', issued_at: at, moved_from: old, moved_table: textOf(line.inputs['old_table']) ?? '', moving: true }, label);
      }
      // The till wrote what the holder gained; the ledger writes what was taken.
      const after = balances.move(label, -amount);
      answer.insert('card_ledger', line.line, { card_id: { '@row': label }, kind, taken: balances.text(-amount), value: balances.text(amount < 0n ? -amount : amount), balance_after: balances.text(after), ...(note === null ? {} : { note }), ...actedBy(input, line), at });
      continue;
    }
    if (amount === null || kind === undefined) throw new Error('an old row with no amount, or of an unknown kind');
    const after = balances.move(card['id'], -amount);
    answer.insert('card_ledger', line.line, { card_id: card['id'] ?? null, kind, taken: balances.text(-amount), value: balances.text(amount < 0n ? -amount : amount), balance_after: balances.text(after), ...(note === null ? {} : { note }), ...actedBy(input, line), at });
    if (textOf(card['status']) === 'inactive' && !activated.has(String(card['id']))) {
      activated.add(String(card['id']));
      answer.update('gift_cards', line.line, card['id'] ?? null, { status: 'active', issued_at: at });
    }
  }
}

/**
 * An old card's code as it is kept: capitals, letters and digits only, behind
 * the word every card's code has. Only a written `GC-` is that word: a till's
 * code that happens to begin with the two letters keeps them.
 */
function oldCode(given: unknown): string | null {
  const raw = (textOf(given) ?? '').trim().toUpperCase();
  const body = (raw.startsWith('GC-') ? raw.slice(3) : raw).replace(/[^0-9A-Z]/g, '');
  return body === '' ? null : `GC-${body}`;
}
