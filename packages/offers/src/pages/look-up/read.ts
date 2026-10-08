/**
 * WHAT A LOOK-UP ANSWER SAYS.
 *
 * Adminium answers a look-up with rows, not with a judgement: the row found,
 * as far as the reader may see it, and its history. This turns that into what
 * the result card shows — which pill, whether it can be used now and, if not,
 * why. One function with no state, so every case is a row in a test.
 *
 * It decides nothing that counts: the server judges again at every save.
 */
import type { DataRow, LookUpAnswer } from '../shared/host.ts';

export type CardPill = 'inactive' | 'active' | 'void' | 'expired';
export type VoucherPill = 'issued' | 'used' | 'used-up' | 'expired' | 'voided' | 'not-sold';
export type Why = 'inactive' | 'void' | 'expired' | 'empty' | 'used' | 'used-up' | 'not-sold' | 'switched-off' | null;

interface Base {
  table: string;
  key: string;
  last4: string | null;
  usable: boolean;
  why: Why;
  expires: string | null;
  rows: readonly DataRow[];
}
export interface ShownCard extends Base {
  kind: 'card' | 'credit';
  pill: CardPill;
  /** Absent for a reader who may not see it. */
  balance: string | null;
  /** An older card, brought in from a till: it works at a staffed counter only. */
  moved: boolean;
  /** Whether the card has an address to send to; null when the reader is not told. */
  hasAddress: boolean | null;
  recipient: string | null;
  sender: string | null;
  issued: string | null;
}
export interface ShownVoucher extends Base {
  kind: 'voucher' | 'pack';
  pill: VoucherPill;
  worth: string;
  value: string | null;
  name: string | null;
  holder: string | null;
  usesLeft: number | null;
  usesTotal: number | null;
  batch: string | null;
}
export interface ShownCode extends Base {
  kind: 'code';
  offer: string | null;
  uses: number | null;
  maxUses: number | null;
}
export type Shown = ShownCard | ShownVoucher | ShownCode;

const text = (value: unknown): string | null => (value === null || value === undefined || value === '' ? null : String(value));
const whole = (value: unknown): number | null => (value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value));
const yes = (value: unknown): boolean => value === true || value === 1 || value === '1' || value === 'true';
/** A day, whatever the database wrote after it. */
const day = (value: unknown): string | null => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null);
/** More than nothing: a text amount, never a float sum. */
const some = (amount: string | null): boolean => amount !== null && /[1-9]/.test(amount) && !amount.trim().startsWith('-');

function card(answer: LookUpAnswer, today: string): ShownCard {
  const row = answer.row;
  const pill = (['inactive', 'active', 'void', 'expired'] as const).find((state) => state === row['status']) ?? 'inactive';
  const credit = row['kind'] === 'credit' || answer.kind === 'address';
  const expires = credit ? null : day(row['expires_on']);
  const balance = text(row['balance']);
  const past = expires !== null && expires < today;
  const why: Why = pill === 'void' ? 'void' : pill === 'inactive' ? 'inactive' : pill === 'expired' || past ? 'expired' : balance !== null && !some(balance) ? 'empty' : null;
  return {
    kind: credit ? 'credit' : 'card',
    table: answer.table,
    key: answer.key,
    last4: credit ? null : (answer.last4 ?? null),
    pill: past && pill === 'active' ? 'expired' : pill,
    usable: why === null,
    why,
    balance,
    expires,
    moved: text(row['moved_table']) !== null,
    hasAddress: 'recipient_email' in row ? text(row['recipient_email']) !== null : null,
    recipient: text(row['recipient_name']),
    sender: text(row['sender_name']),
    issued: text(row['issued_at']),
    rows: answer.rows ?? [],
  };
}

function voucher(answer: LookUpAnswer, today: string): ShownVoucher {
  const row = answer.row;
  const pack = answer.kind === 'pack';
  const total = whole(row['uses_total']);
  // A voucher nobody has used yet has no figure worked out: every use it was made with is left.
  const left = whole(row['uses_left']) ?? total;
  const expires = day(row['expires_on']);
  const past = expires !== null && expires < today;
  const status = text(row['status']) ?? 'issued';
  const waiting = yes(row['awaiting_sale']);
  let pill: VoucherPill = status === 'voided' ? 'voided' : status === 'expired' || past ? 'expired' : status === 'used' || (left !== null && left < 1) ? (pack ? 'used-up' : 'used') : waiting ? 'not-sold' : 'issued';
  if (pack && pill === 'used') pill = 'used-up';
  const why: Why = pill === 'issued' ? null : pill === 'voided' ? 'void' : pill;
  return {
    kind: pack ? 'pack' : 'voucher',
    table: answer.table,
    key: answer.key,
    last4: answer.last4 ?? text(row['code_last4']),
    pill,
    usable: why === null,
    why,
    expires,
    worth: text(row['worth']) ?? (pack ? 'pack' : 'amount'),
    value: text(row['value']),
    name: text(row['public_name']),
    holder: text(row['holder_name']),
    usesLeft: left,
    usesTotal: total,
    batch: text(row['batch_id']),
    rows: answer.rows ?? [],
  };
}

function code(answer: LookUpAnswer, today: string): ShownCode {
  const row = answer.row;
  const expires = day(row['valid_until']);
  const uses = whole(row['uses']);
  const max = whole(row['max_uses']);
  const why: Why = !yes(row['active']) ? 'switched-off' : expires !== null && expires < today ? 'expired' : max !== null && uses !== null && uses >= max ? 'used-up' : null;
  return { kind: 'code', table: answer.table, key: answer.key, last4: null, usable: why === null, why, expires, offer: text(row['offer_id']), uses, maxUses: max, rows: [] };
}

/** What the card shows of an answer; `today` is the reader's day, `YYYY-MM-DD`. */
export function read(answer: LookUpAnswer, today: string): Shown {
  if (answer.kind === 'gift-card' || answer.kind === 'address') return card(answer, today);
  if (answer.kind === 'pack' || answer.kind === 'voucher') return voucher(answer, today);
  return code(answer, today);
}

/** The reader's own day. */
export function todayOf(now: Date): string {
  const two = (part: number): string => String(part).padStart(2, '0');
  return `${String(now.getFullYear())}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
}
