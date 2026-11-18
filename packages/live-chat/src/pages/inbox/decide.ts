/**
 * THE INBOX, DECIDED: which chats a filter shows and in what order, how many
 * are waiting, how long each has waited, and what each staff line says.
 *
 * Pure: the screens draw what these answer, and the tests hold them.
 */
import type { AddOnTranslate } from '../shared/host.ts';
import { firstNameOf, pageOf, type Conversation, type Message } from '../shared/rows.ts';

export type Filter = 'waiting' | 'mine' | 'all';
export const FILTERS: readonly Filter[] = ['waiting', 'mine', 'all'];

/** When a chat began to wait for a person: its last "asked" or "handed over" line, else when it started. */
export function waitingSince(conversation: Conversation, messages: readonly Message[]): number | null {
  const asked = messages.filter((message) => message.conversationId === conversation.id && message.kind === 'system' && (message.event === 'asked' || message.event === 'handed-over'));
  const last = asked.reduce<number | null>((at, message) => (message.sentAt !== null && (at === null || message.sentAt > at) ? message.sentAt : at), null);
  return last ?? conversation.startedAt;
}

const newestFirst = (a: Conversation, b: Conversation): number => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0) || Number(b.id) - Number(a.id);

/**
 * The chats a filter shows:
 * - waiting for a person: nobody has taken them, oldest waiting first;
 * - mine: the ones the reader took, newest first;
 * - all: every chat, newest first.
 */
export function shown(conversations: readonly Conversation[], filter: Filter, me: string | null, messages: readonly Message[]): Conversation[] {
  if (filter === 'waiting') {
    const since = (conversation: Conversation): number => waitingSince(conversation, messages) ?? 0;
    return conversations.filter((conversation) => conversation.state === 'waiting').sort((a, b) => since(a) - since(b) || Number(a.id) - Number(b.id));
  }
  if (filter === 'mine') return conversations.filter((conversation) => me !== null && conversation.takenBy === me).sort(newestFirst);
  return [...conversations].sort(newestFirst);
}

/** How many chats wait for a person: the count on the filter. */
export const waitingCount = (conversations: readonly Conversation[]): number => conversations.filter((conversation) => conversation.state === 'waiting').length;

/** The newest message of each chat, for its row's preview. */
export function latestByConversation(messages: readonly Message[]): ReadonlyMap<string, Message> {
  const out = new Map<string, Message>();
  for (const message of messages) {
    if (message.kind === 'system') continue;
    const held = out.get(message.conversationId);
    if (held === undefined || Number(message.id) > Number(held.id)) out.set(message.conversationId, message);
  }
  return out;
}

/** A time as the comps write it: the clock today, the weekday this week, else the day and month. */
export function whenOf(at: number | null, now: number, locale: string): string {
  if (at === null) return '';
  const date = new Date(at);
  const today = new Date(now);
  if (date.toDateString() === today.toDateString()) return clockOf(at, locale);
  if (now - at < 6 * 86_400_000 && now >= at) return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date);
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(date);
}

/** The clock, as 09:30. */
export const clockOf = (at: number | null, locale: string): string => (at === null ? '' : new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(at)));

/** How long a chat has waited, as "12 min" or "3 h". */
export function waitedOf(t: AddOnTranslate, since: number | null, now: number): string {
  if (since === null) return '';
  const minutes = Math.max(0, Math.floor((now - since) / 60_000));
  if (minutes < 60) return t('inbox.waited.minutes', '{count} min', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return t('inbox.waited.hours', '{count} h', { count: hours });
  return t('inbox.waited.days', '{count} d', { count: Math.floor(hours / 24) });
}

/** A staff member's first name, by id, from the people of the server. */
export const staffFirst = (people: ReadonlyMap<string, string>, id: string | null): string | null => (id === null ? null : firstNameOf(people.get(id) ?? null));

/**
 * What a staff line says. Staff read the event, never the stored English body:
 * - asked: the visitor pressed "Talk to a person";
 * - handed-over: the automatic answers handed the chat over themselves;
 * - taken, closed, reopened, enquiry: by a staff member, named;
 * - left: the visitor left the page, timed at their last heartbeat.
 */
export function systemLine(t: AddOnTranslate, message: Message, conversation: Conversation, people: ReadonlyMap<string, string>, locale: string): string {
  const time = clockOf(message.sentAt, locale);
  const visitor = firstNameOf(conversation.name);
  const staff = staffFirst(people, message.authorId);
  switch (message.event) {
    case 'asked':
      return visitor === null ? t('thread.line.askedVisitor', 'The visitor asked for a person · {time}', { time }) : t('thread.line.asked', '{name} asked for a person · {time}', { name: visitor, time });
    case 'handed-over':
      return t('thread.line.handed', 'Handed to a person · {time}', { time });
    case 'taken':
      return staff === null ? t('thread.line.takenSomeone', 'Someone took over · automatic answers stopped') : t('thread.line.taken', '{name} took over · automatic answers stopped', { name: staff });
    case 'closed':
      return staff === null ? t('thread.line.closedSomeone', 'Chat closed · {time}', { time }) : t('thread.line.closed', '{name} closed the chat', { name: staff });
    case 'reopened':
      return staff === null ? t('thread.line.reopenedSomeone', 'Chat reopened · {time}', { time }) : t('thread.line.reopened', '{name} reopened the chat', { name: staff });
    case 'left':
      return visitor === null ? t('thread.line.leftVisitor', 'The visitor left the page · {time}', { time }) : t('thread.line.left', '{name} left the page · {time}', { name: visitor, time });
    case 'enquiry':
      return staff === null ? t('thread.line.enquirySomeone', 'An enquiry was made from this chat') : t('thread.line.enquiry', '{name} made an enquiry from this chat', { name: staff });
    default:
      return message.body;
  }
}

/** The line every thread starts with: where and when the chat began. */
export function startLine(t: AddOnTranslate, conversation: Conversation, locale: string): string {
  const time = clockOf(conversation.startedAt, locale);
  const page = pageOf(conversation.cameFrom);
  return page === null ? t('thread.line.startedNowhere', 'Chat started · {time}', { time }) : t('thread.line.started', 'Chat started on {page} · {time}', { page, time });
}
