/**
 * THE CHAT'S SETTINGS ROW, AS THE PAGE EDITS IT.
 *
 * Read from the one settings row into a draft the page changes, and written
 * back by "Save changes" as the columns Adminium reads (`hours`, `welcome`,
 * `outside_words`, `automatic`, `daily_tokens`, `milo_drafts`, `tell`,
 * `transcripts_months`, `theme`, `closed_until`). A JSON column left empty
 * means the stock words, no hours (always outside hours) and "tell every
 * reader": the page writes null, never an empty object, for those.
 */
import { jsonOf } from '../shared/rows.ts';
import type { DataRow, DataValue } from '../shared/host.ts';

/** The days the page lists, Monday first; Adminium's hours name them by these keys. */
export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Day = (typeof DAYS)[number];

export interface DayHours {
  on: boolean;
  from: string;
  to: string;
}

export interface Told {
  kind: 'role' | 'person';
  id: string;
}

export type Theme = 'light' | 'dark' | 'visitor';
export const THEMES: readonly Theme[] = ['light', 'dark', 'visitor'];
/** How long conversations may be kept, in months. */
export const KEEP_MONTHS = [3, 6, 12, 24] as const;

export interface Draft {
  hours: Record<Day, DayHours>;
  closedUntil: string;
  welcome: Record<string, string>;
  outside: Record<string, string>;
  automatic: boolean;
  /** The limit as typed: empty is no automatic answers (0). */
  dailyTokens: string;
  miloDrafts: boolean;
  tell: Told[];
  /** Null: kept until removed. */
  months: number | null;
  theme: Theme;
}

/**
 * THE NEXT OPENING, IN THE OWNER'S OUTSIDE-HOURS WORDS. Adminium keeps the
 * token `{opens}` in the text and the window fills it with the next opening
 * time. The editor shows it as the comp writes it, "9:00 tomorrow", in the
 * language of each variation, and puts the token back when it saves.
 */
export const OPENS_TOKEN = '{opens}';
export const OPENS_SHOWN: Readonly<Record<string, string>> = {
  'en-US': '9:00 tomorrow',
  'de-DE': 'morgen um 9:00',
  'fr-FR': 'demain à 9:00',
  'da-DK': 'kl. 9:00 i morgen',
  'cs-CZ': 'zítra v 9:00',
  'ar-EG': '9:00 غدًا',
  'zh-CN': '明天 9:00',
  'zh-TW': '明天 9:00',
};
export const opensShown = (language: string): string => OPENS_SHOWN[language] ?? OPENS_SHOWN['en-US']!;

/** Outside-hours words as the editor shows them: the token as its phrase, per language. */
export const opensToShown = (words: Record<string, string>): Record<string, string> => Object.fromEntries(Object.entries(words).map(([language, text]) => [language, text.replaceAll(OPENS_TOKEN, opensShown(language))]));
/** Outside-hours words as Adminium keeps them: the phrase as the token, per language. */
export const shownToOpens = (words: Record<string, string>): Record<string, string> => Object.fromEntries(Object.entries(words).map(([language, text]) => [language, text.replaceAll(opensShown(language), OPENS_TOKEN)]));

/** A new chat's opening hours as the page offers them before any are saved: weekdays 9:00 to 17:30. */
const SUGGESTED: DayHours = { on: true, from: '09:00', to: '17:30' };

const yes = (value: unknown): boolean => value === true || value === 1 || value === '1' || value === 'true' || value === 't';
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function wordsOf(value: unknown): Record<string, string> {
  const read = jsonOf(value);
  if (!isRecord(read)) return {};
  return Object.fromEntries(Object.entries(read).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

function hoursOf(value: unknown): Record<Day, DayHours> {
  const read = jsonOf(value);
  const stored = isRecord(read) ? read : null;
  return Object.fromEntries(
    DAYS.map((day) => {
      // No hours saved at all: the page suggests weekdays, and nothing is saved until the owner saves.
      if (stored === null) return [day, day === 'sat' || day === 'sun' ? { ...SUGGESTED, on: false } : { ...SUGGESTED }];
      const spans = stored[day];
      const first = Array.isArray(spans) && Array.isArray(spans[0]) ? (spans[0] as unknown[]) : null;
      if (first === null || typeof first[0] !== 'string' || typeof first[1] !== 'string') return [day, { ...SUGGESTED, on: false }];
      return [day, { on: true, from: first[0], to: first[1] }];
    }),
  ) as Record<Day, DayHours>;
}

function tellOf(value: unknown): Told[] {
  const read = jsonOf(value);
  if (!Array.isArray(read)) return [];
  return read.filter((one): one is Told => isRecord(one) && (one['kind'] === 'role' || one['kind'] === 'person') && typeof one['id'] === 'string');
}

/** The draft a settings row stands for (no row: every default). */
export function draftOf(row: DataRow | undefined): Draft {
  const months = row?.['transcripts_months'];
  const theme = THEMES.find((one) => one === row?.['theme']) ?? 'light';
  const tokens = Number(row?.['daily_tokens'] ?? 0);
  const closed = row?.['closed_until'];
  return {
    hours: hoursOf(row?.['hours'] ?? null),
    closedUntil: typeof closed === 'string' ? closed.slice(0, 10) : '',
    welcome: wordsOf(row?.['welcome']),
    outside: opensToShown(wordsOf(row?.['outside_words'])),
    automatic: yes(row?.['automatic']),
    dailyTokens: Number.isFinite(tokens) && tokens > 0 ? String(Math.trunc(tokens)) : '',
    miloDrafts: yes(row?.['milo_drafts']),
    tell: tellOf(row?.['tell']),
    months: row === undefined ? 12 : months === null || months === undefined ? null : Number(months),
    theme,
  };
}

/** A clock as Adminium keeps it: "9:00" is "09:00"; anything that is not a time is null. */
export function clockValue(typed: string): string | null {
  const found = /^\s*(\d{1,2})[:.](\d{2})\s*$/.exec(typed);
  if (found === null) return null;
  const hours = Number(found[1]);
  const minutes = Number(found[2]);
  if (hours > 24 || minutes > 59 || (hours === 24 && minutes !== 0)) return null;
  return `${String(hours).padStart(2, '0')}:${found[2]}`;
}

/** A clock as the page shows it: "09:00" is "9:00", as the comp writes it. */
export const clockShown = (stored: string): string => stored.replace(/^0(\d):/, '$1:');

/** The limit as Adminium keeps it: a whole number of tokens a day, 0 when empty. Null when not a number. */
export function tokensValue(typed: string): number | null {
  if (typed.trim() === '') return 0;
  if (!/^\d{1,9}$/.test(typed.trim())) return null;
  return Number(typed.trim());
}

/** What is wrong with the draft, field by field, before it is saved. */
export function draftIssues(draft: Draft): { day?: Day; field: 'hours' | 'tokens' } | null {
  for (const day of DAYS) {
    const hours = draft.hours[day];
    if (!hours.on) continue;
    const from = clockValue(hours.from);
    const to = clockValue(hours.to);
    if (from === null || to === null || from >= to) return { day, field: 'hours' };
  }
  if (tokensValue(draft.dailyTokens) === null) return { field: 'tokens' };
  return null;
}

const wordsValue = (words: Record<string, string>): Record<string, string> | null => {
  const kept = Object.fromEntries(Object.entries(words).filter(([, text]) => text.trim() !== ''));
  return Object.keys(kept).length === 0 ? null : kept;
};

/** The columns "Save changes" writes. Call only with a draft `draftIssues` passes. */
export function valuesOf(draft: Draft): Record<string, DataValue> {
  const hours: Record<string, [string, string][]> = {};
  for (const day of DAYS) {
    const one = draft.hours[day];
    if (one.on) hours[day] = [[clockValue(one.from)!, clockValue(one.to)!]];
  }
  return {
    hours: hours as unknown as DataValue,
    closed_until: draft.closedUntil === '' ? null : draft.closedUntil,
    welcome: wordsValue(draft.welcome) as unknown as DataValue,
    outside_words: wordsValue(shownToOpens(draft.outside)) as unknown as DataValue,
    automatic: draft.automatic,
    daily_tokens: tokensValue(draft.dailyTokens) ?? 0,
    milo_drafts: draft.miloDrafts,
    tell: (draft.tell.length === 0 ? null : draft.tell) as unknown as DataValue,
    transcripts_months: draft.months,
    theme: draft.theme,
  };
}

/**
 * Whether automatic answers can be switched on: at least one answer, a limit
 * above 0, and an AI service this server can use. The switch says why not.
 */
export function automaticBlocked(answers: number, draft: Draft, usable: boolean | null): 'answers' | 'limit' | 'service' | null {
  if (answers === 0) return 'answers';
  if ((tokensValue(draft.dailyTokens) ?? 0) <= 0) return 'limit';
  if (usable === false) return 'service';
  return null;
}

/**
 * The window's first line, as a visitor reads it (Q-M):
 * - A: automatic answers really run (switched on, a limit, a usable service);
 * - B: they do not, and Milo drafting is on: staff may use the AI service;
 * - C: neither: a person answers.
 */
export function firstLineKind(draft: Draft, usable: boolean | null, answers: number): 'A' | 'B' | 'C' {
  if (draft.automatic && automaticBlocked(answers, draft, usable) === null && usable === true) return 'A';
  if (draft.miloDrafts && usable === true) return 'B';
  return 'C';
}
