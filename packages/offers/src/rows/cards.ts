/**
 * MONEY ON A CARD: paying with one, giving money back to one, putting value
 * on one, closing one.
 *
 * A card's ledger is rows that take from it (`taken` above nothing) and rows
 * that give to it (`taken` below nothing); Adminium adds them up under the
 * card's lock and refuses a row that would take it below nothing. Every row
 * says what it left on the card, so a receipt printed again still reads true.
 *
 * A line whose card link is empty — a cash payment in a table that also
 * takes cards, an ordinary line beside one that loads a card — is no card's
 * business: nothing is written for it, and staff are told it was not linked.
 */

import type { PostingInput, PostingLine } from '@adminium/add-on-contracts';

import { least, toUnits } from '../units.ts';
import { addDays, addMonths } from './dates.ts';
import { actedBy, amountText, Answer, Balances, read, same, scaleOf, textOf, wholeOf, yes, type Row } from './ledger.ts';

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
function load(input: PostingInput, answer: Answer, line: PostingLine, balances: Balances, card: Row, amount: bigint, opts: { byHand: boolean; note: string | null }): void {
  const scale = balances.scale;
  const status = textOf(card['status']);
  const credit = textOf(card['kind']) === 'credit';
  if (yes(input.settings['cards_paused'])) return answer.refuse(line.line, 'not-allowed');
  if (status === 'void') return answer.refuse(line.line, 'void');
  const lastDay = textOf(card['expires_on']);
  if (status === 'expired' || (lastDay !== null && lastDay < input.today)) return answer.refuse(line.line, 'expired');
  // Store credit is given, never sold.
  if (credit && !opts.byHand) return answer.refuse(line.line, 'not-allowed');
  const balance = balances.of(card['id']);
  const [low, high] = [toUnits(input.settings['card_min'], scale), toUnits(input.settings['card_max'], scale)];
  if (amount <= 0n || (!credit && low !== null && amount < low) || (high !== null && (balance + amount > high || (!credit && amount > high)))) return answer.refuse(line.line, 'not-allowed');
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

/** A sale line that loads a card, once its order is paid. */
export function issue(input: PostingInput, answer: Answer): void {
  const cards = read(input, 'card');
  const balances = new Balances(cards, scaleFor(input, ['amount'], cards, [input.settings['card_min'], input.settings['card_max']]));
  for (const line of input.lines) {
    const id = line.inputs['card'];
    // An ordinary sale line.
    if (textOf(id) === null) {
      answer.note(line.line, 'not-linked');
      continue;
    }
    const card = balances.card(id);
    const amount = toUnits(line.inputs['amount'], balances.scale);
    if (card === undefined) answer.refuse(line.line, 'not-valid');
    else if (amount === null) answer.refuse(line.line, 'not-allowed');
    else load(input, answer, line, balances, card, amount, { byHand: false, note: null });
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
