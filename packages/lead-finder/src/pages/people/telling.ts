/**
 * "TELLING THEM": where a found person's tell mail stands, from their
 * `found_people` row and the latest of their mails (`tell_mails`).
 *
 * - Objected: they objected, and their details were deleted.
 * - Told on {day}: the mail went.
 * - Sending…: a mail is queued to go (just kept, or sent again).
 * - Couldn't tell: the mail failed; it may be sent again, and if it cannot
 *   go by the "tell by" day, Lead finder deletes them.
 * - Tell by {day}: waiting; within five days it is near, after it overdue.
 */
import { daysUntil, instantOf } from '../shared/dates.ts';

export interface MailRow {
  id: string;
  status: string;
  error: string | null;
}

export type Telling =
  | { kind: 'objected' }
  | { kind: 'sending' }
  | { kind: 'told'; at: number | null }
  | { kind: 'failed'; error: string | null; by: number | null; mail: string | null }
  | { kind: 'tell-by'; by: number | null; near: boolean; overdue: boolean };

/** A tell-by day this many days off, or fewer, is near. */
export const NEAR_DAYS = 5;

export function tellingOf(row: Readonly<Record<string, unknown>>, mail: MailRow | null, now: number): Telling {
  const state = row['state'];
  if (state === 'objected') return { kind: 'objected' };
  if (state === 'told') return { kind: 'told', at: instantOf(row['told_at']) };
  if (mail?.status === 'queued') return { kind: 'sending' };
  const by = instantOf(row['tell_by']);
  if (state === 'failed') return { kind: 'failed', error: mail?.error ?? null, by, mail: mail?.status === 'failed' ? mail.id : null };
  const days = by === null ? null : daysUntil(by, now);
  return { kind: 'tell-by', by, near: days !== null && days >= 0 && days <= NEAR_DAYS, overdue: days !== null && days < 0 };
}

/** The latest mail of each found person, by the person's row id. */
export function latestMails(rows: readonly Readonly<Record<string, unknown>>[]): Map<string, MailRow> {
  const out = new Map<string, MailRow & { order: number }>();
  for (const row of rows) {
    const person = row['found_person_id'];
    if (person === null || person === undefined) continue;
    const id = String(row['id']);
    const order = Number(row['id']);
    const known = out.get(String(person));
    if (known !== undefined && known.order >= order) continue;
    out.set(String(person), { id, order, status: String(row['status'] ?? ''), error: typeof row['error'] === 'string' ? row['error'] : null });
  }
  return new Map([...out].map(([key, value]) => [key, { id: value.id, status: value.status, error: value.error }]));
}
