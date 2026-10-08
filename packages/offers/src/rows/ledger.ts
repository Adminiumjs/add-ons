/**
 * WHAT EVERY ACTION OF THE LEDGER SHARES.
 *
 * A call is one action over one or more lines. The answer is rows to write,
 * amounts decided, lines refused and things staff are told — built up here,
 * with the figures of a line read at the finest scale any of them was handed
 * in, so nothing is rounded on the way through.
 */

import type { PlannedRow, PostingInput, PostingLine, PostingNote, PostingOutput, PostingReason } from '@adminium/add-on-contracts';

import { fromUnits, toUnits } from '../units.ts';

export type Scalar = string | number | boolean | null;
export type Row = Readonly<Record<string, Scalar>>;

/** Yes, as each database says it. */
export const yes = (value: unknown): boolean => value === true || value === 1 || value === '1' || value === 'true' || value === 't';
/** A value as text, or null for nothing. */
export const textOf = (value: unknown): string | null => (value === null || value === undefined || value === '' ? null : String(value));
/** A whole number, or null. */
export function wholeOf(value: unknown): number | null {
  const text = textOf(value);
  return text === null || !/^-?\d+(\.0+)?$/.test(text) ? null : Number.parseInt(text, 10);
}
export const same = (a: unknown, b: unknown): boolean => a !== null && a !== undefined && b !== null && b !== undefined && String(a) === String(b);

/** The decimals of a figure written as text. */
const decimals = (value: unknown): number => (typeof value === 'string' || typeof value === 'number' ? (String(value).split('.')[1] ?? '').length : 0);
/** The scale a call's money is worked at: the finest any figure came in, two at the least, six at the most. */
export function scaleOf(...figures: unknown[]): number {
  return Math.min(6, Math.max(2, ...figures.map(decimals)));
}

/**
 * An amount as an answer writes it: at the scale it was worked at, less the
 * noughts past the cents. One database hands a balance over as `62.0000` and
 * another as `62`; what is left on a card is told as `2.00` on both.
 */
export function amountText(units: bigint, scale: number): string {
  const text = fromUnits(units, scale);
  const trimmed = scale > 2 ? text.replace(/0+$/, '') : text;
  const [whole, fraction = ''] = trimmed.split('.');
  return `${whole!}.${fraction.padEnd(2, '0')}`;
}

/** The answer of one call, as it is built. */
export class Answer {
  readonly rows: PlannedRow[] = [];
  readonly decides: NonNullable<PostingOutput['decides']> = [];
  readonly refusals: NonNullable<PostingOutput['refusals']> = [];
  readonly notes: NonNullable<PostingOutput['notes']> = [];

  insert(table: string, line: string, values: Record<string, Scalar>): void {
    // Nothing is said of a column that holds nothing: the database's own default stands.
    this.rows.push({ op: 'insert', table, line, values: Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) as never });
  }
  update(table: string, line: string, id: Scalar, set: Record<string, Scalar>): void {
    this.rows.push({ op: 'update', table, line, key: { id: id as string | number }, set });
  }
  decide(line: string, input: string, value: string): void {
    this.decides.push({ line, input, value });
  }
  refuse(line: string, reason: PostingReason, left?: string): void {
    this.refusals.push({ line, reason, ...(left === undefined ? {} : { left }) });
  }
  note(line: string, note: PostingNote): void {
    this.notes.push({ line, note });
  }
  /** As the contract carries it: a list that is empty is left out. */
  out(phase: PostingInput['phase']): PostingOutput {
    return {
      rows: this.rows,
      ...(this.decides.length === 0 ? {} : { decides: this.decides }),
      // A reverse refuses nothing: what was written is always given back.
      ...(this.refusals.length === 0 || phase === 'reverse' ? {} : { refusals: this.refusals }),
      ...(this.notes.length === 0 ? {} : { notes: this.notes }),
    };
  }
}

/** The row that acted: the line's own under a link, else the source — with the label the host mapped, and the moment. */
export function actedBy(input: PostingInput, line: PostingLine): { source_table: string; source_row: string; source_label: string | null; at: string } {
  return { source_table: line.lineTable === '' ? input.source.table : line.lineTable, source_row: line.line === '' ? input.source.row : line.line, source_label: textOf(line.inputs['label']), at: input.now };
}

/** A read's rows. */
export const read = (input: PostingInput, name: string): Row[] => (input.reads[name] ?? []) as Row[];
/** What this round has written to a table so far. */
export const written = (input: PostingInput, table: string): Row[] => (input.written[table] ?? []) as Row[];

/**
 * A card's balance as the call goes: what its row holds, then what each line
 * before this one took or gave. Two lines of one call naming one card are
 * planned in order, each from the balance the one before left.
 */
export class Balances {
  private readonly now = new Map<string, bigint>();
  private readonly cards: readonly Row[];
  readonly scale: number;
  /** Cards this call has made active: a second line that loads one of them is a top-up. */
  readonly activated = new Set<string>();
  constructor(cards: readonly Row[], scale: number) {
    this.cards = cards;
    this.scale = scale;
  }
  card(id: unknown): Row | undefined {
    return this.cards.find((card) => same(card['id'], id));
  }
  of(id: unknown): bigint {
    return this.now.get(String(id)) ?? toUnits(this.card(id)?.['balance'], this.scale) ?? 0n;
  }
  /** Takes `taken` from the card (a negative figure gives to it) and answers what it then holds. */
  move(id: unknown, taken: bigint): bigint {
    const after = this.of(id) - taken;
    this.now.set(String(id), after);
    return after;
  }
  text(amount: bigint): string {
    return amountText(amount, this.scale);
  }
}

/**
 * What was written to a card's ledger in this round, taken back: for each row
 * the opposite one. Where the card no longer holds what would be taken off
 * it, what it holds is taken and staff are told to check — a card never goes
 * below nothing, and a reverse is never refused.
 *
 * A payment that has had some of its money back already (`given`: every row
 * written against one of these) gives back the rest, not the whole of it
 * again. And the row that takes a refund back is written against the payment
 * the refund was for, so that payment's rows always add up to what it still
 * holds of the card's money.
 */
export function reverseCardRows(input: PostingInput, answer: Answer, kind: string): void {
  const rows = written(input, 'card_ledger');
  const cards = read(input, 'card');
  const scale = scaleOf(...rows.flatMap((row) => [row['taken'], row['value']]), ...cards.map((card) => card['balance']));
  const balances = new Balances(cards, scale);
  const given = read(input, 'given');
  for (const row of rows) {
    const wrote = toUnits(row['taken'], scale) ?? 0n;
    // What the card has had back against this row since, or has had taken again.
    const since = given.filter((one) => same(one['against_id'], row['id'])).reduce((total, one) => total + (toUnits(one['taken'], scale) ?? 0n), 0n);
    const still = wrote + since;
    // Only what is still out is undone: never past nothing, and never the other way.
    const taken = wrote > 0n ? (still < 0n ? 0n : still > wrote ? wrote : still) : wrote < 0n ? (still > 0n ? 0n : still < wrote ? wrote : still) : 0n;
    if (taken === 0n) continue;
    const line = textOf(row['source_row']) !== null && input.lines.some((one) => one.line === String(row['source_row'])) ? String(row['source_row']) : (input.lines[0]?.line ?? '');
    // Giving back what was taken is always possible; taking back what was given stops at what is there.
    const there = balances.card(row['card_id']) === undefined ? null : balances.of(row['card_id']);
    // A card brought in below nothing has nothing to take, and is never given money for it.
    const held = there !== null && there < 0n ? 0n : there;
    const back = taken < 0n && held !== null && -taken > held ? -held : taken;
    if (back !== taken) answer.note(line, 'to-check');
    const value = back < 0n ? -back : back;
    answer.insert('card_ledger', line, {
      card_id: row['card_id'] ?? null,
      kind,
      taken: amountText(-back, scale),
      value: amountText(value, scale),
      balance_after: balances.text(balances.move(row['card_id'], -back)),
      against_id: row['against_id'] ?? row['id'] ?? null,
      source_table: textOf(row['source_table']) ?? input.source.table,
      source_row: textOf(row['source_row']) ?? input.source.row,
      source_label: textOf(row['source_label']),
      at: input.now,
    });
  }
}
