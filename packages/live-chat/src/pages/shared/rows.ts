/**
 * THE ROWS, READ.
 *
 * A row comes from the data kit as the database handed it back: a number may
 * be a string, a yes may be `1`, a JSON column may be text (SQLite) or already
 * parsed (Postgres, MySQL). Each reader here takes what is there and claims
 * nothing that is not.
 */
import type { DataRow } from './host.ts';

export type ConversationState = 'bot' | 'waiting' | 'open' | 'closed';
export type MessageKind = 'visitor' | 'staff' | 'automatic' | 'system';

export interface Conversation {
  id: string;
  state: ConversationState;
  startedAt: number | null;
  lastMessageAt: number | null;
  language: string;
  name: string | null;
  email: string | null;
  cameFrom: string | null;
  outsideHours: boolean;
  takenBy: string | null;
  becameTable: string | null;
  becameKey: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  kind: MessageKind;
  body: string;
  event: string | null;
  answerRef: string | null;
  authorId: string | null;
  sentAt: number | null;
}

/** One language's version of an answer. */
export interface Version {
  title: string;
  text: string;
  examples: string[];
}

export interface Answer {
  id: string;
  ref: string;
  versions: Record<string, Version>;
  active: boolean;
  position: number;
}

const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : typeof value === 'number' || typeof value === 'bigint' ? String(value) : null);
const yes = (value: unknown): boolean => value === true || value === 1 || value === '1' || value === 'true' || value === 't';
const whole = (value: unknown, fallback: number): number => {
  const number = typeof value === 'string' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) ? Math.trunc(number) : fallback;
};

/** A moment as epoch milliseconds, or null. */
export function epochOf(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value !== 'string' || value === '') return null;
  const at = Date.parse(value.includes('T') || value.endsWith('Z') ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(at) ? null : at;
}

/** A JSON column, whichever way the engine handed it back. */
export function jsonOf(value: unknown): unknown {
  if (typeof value !== 'string') return value ?? null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

const STATES: readonly ConversationState[] = ['bot', 'waiting', 'open', 'closed'];
const KINDS: readonly MessageKind[] = ['visitor', 'staff', 'automatic', 'system'];

export function conversationOf(row: DataRow): Conversation {
  const state = STATES.find((one) => one === row['state']) ?? 'waiting';
  return {
    id: text(row['id']) ?? '',
    state,
    startedAt: epochOf(row['started_at']),
    lastMessageAt: epochOf(row['last_message_at']),
    language: text(row['language']) ?? '',
    name: text(row['name']),
    email: text(row['email']),
    cameFrom: text(row['came_from']),
    outsideHours: yes(row['outside_hours']),
    takenBy: text(row['taken_by']),
    becameTable: text(row['became_table']),
    becameKey: text(row['became_key']),
  };
}

export function messageOf(row: DataRow): Message {
  return {
    id: text(row['id']) ?? '',
    conversationId: text(row['conversation_id']) ?? '',
    kind: KINDS.find((one) => one === row['kind']) ?? 'system',
    body: typeof row['body'] === 'string' ? row['body'] : '',
    event: text(row['event']),
    answerRef: text(row['answer_ref']),
    authorId: text(row['author_id']),
    sentAt: epochOf(row['sent_at']),
  };
}

/** An answer's versions, each language's title, text and examples, as far as they read. */
export function versionsOf(value: unknown): Record<string, Version> {
  const read = jsonOf(value);
  if (read === null || typeof read !== 'object' || Array.isArray(read)) return {};
  const out: Record<string, Version> = {};
  for (const [tag, one] of Object.entries(read as Record<string, unknown>)) {
    if (one === null || typeof one !== 'object') continue;
    const version = one as Record<string, unknown>;
    out[tag] = {
      title: typeof version['title'] === 'string' ? version['title'] : '',
      text: typeof version['text'] === 'string' ? version['text'] : '',
      examples: Array.isArray(version['examples']) ? version['examples'].filter((example): example is string => typeof example === 'string') : [],
    };
  }
  return out;
}

export function answerOf(row: DataRow): Answer {
  return {
    id: text(row['id']) ?? '',
    ref: text(row['ref']) ?? '',
    versions: versionsOf(row['versions']),
    active: row['active'] === undefined || row['active'] === null ? true : yes(row['active']),
    position: whole(row['position'], 0),
  };
}

/** A version is written when its question and its answer are. */
export const written = (version: Version | undefined): boolean => version !== undefined && version.title.trim() !== '' && version.text.trim() !== '';

/** An answer in a language: that language's version, else the default's, else any written one. */
export function versionIn(answer: Answer, language: string, defaultLanguage: string): Version | null {
  const pick = [answer.versions[language], answer.versions[defaultLanguage], ...Object.values(answer.versions)].find(written);
  return pick ?? null;
}

/** The visitor's first name, as they typed it, or null. */
export const firstNameOf = (name: string | null): string | null => {
  const first = (name ?? '').trim().split(/\s+/)[0] ?? '';
  return first === '' ? null : first;
};

/** Up to two initials of a name. */
export function initialsOf(name: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter((part) => part !== '');
  if (parts.length === 0) return '';
  const letters = parts.length === 1 ? [parts[0]!] : [parts[0]!, parts[parts.length - 1]!];
  return letters.map((part) => [...part][0]!.toLocaleUpperCase()).join('');
}

/** "www.meridian.example/showroom": a page's address without its scheme, as the comps write it. */
export const pageOf = (url: string | null): string | null => (url === null ? null : url.replace(/^https?:\/\//, '').replace(/\/$/, ''));
