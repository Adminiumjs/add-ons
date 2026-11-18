import { describe, expect, it } from 'vitest';

import { format } from '../testing/host.tsx';
import { MAIL_REASONS, type MailReason } from '../shared/chat.ts';
import { conversationOf, messageOf } from '../shared/rows.ts';
import { MARTA, TOMAS, VISITOR, messages } from '../testing/chats.ts';
import { mailLine } from './mailLine.ts';
import { latestByConversation, shown, systemLine, waitedOf, waitingSince } from './decide.ts';

const t = (_key: string, fallback: string, args?: Record<string, unknown>): string => format(fallback, args);
const left = (reason: MailReason | null, ready = reason === null) => ({ presence: 'left' as const, mail: { ready, reason, used: 0, max: 3 } });

describe('the line under the composer (CR9)', () => {
  it('is nothing while the visitor is on the page, or before Adminium said', () => {
    expect(mailLine(t, null, 'Marta Kovac', 'marta@example.com')).toBeNull();
    expect(mailLine(t, { presence: 'on-page', mail: { ready: true, reason: null, used: 0, max: 3 } }, 'Marta Kovac', 'marta@example.com')).toBeNull();
  });

  it('words every reason Adminium gives, each its own way, and names the visitor, never by a pronoun', () => {
    const said = Object.fromEntries(MAIL_REASONS.map((reason) => [reason, mailLine(t, left(reason), 'Marta Kovac', 'marta@example.com')]));
    expect(said['no-mail-server']).toEqual({ text: 'Marta has left the page. Your reply shows only if Marta comes back. E-mail isn’t set up:', link: { to: 'email', label: 'Workspace settings → Email' } });
    expect(said['no-public-origin']).toEqual({ text: 'Marta has left the page. Your reply shows only if Marta comes back. E-mail can’t go out: this server has no public address.', link: { to: 'privacy', label: 'Privacy and public pages' } });
    expect(said['cap']).toEqual({ text: 'Marta has left the page. Your reply shows only if Marta comes back. Today’s e-mail replies to this chat are used up.', link: null });
    expect(said['no-email']).toEqual({ text: 'Marta has left the page. Your reply shows only if Marta comes back. No e-mail address was left in this chat.', link: null });
    expect(said['sample']).toEqual({ text: 'Marta has left the page. Your reply shows only if Marta comes back. This is a sample chat, so no e-mail goes out.', link: null });
    for (const line of Object.values(said)) expect(line?.text).not.toMatch(/\b(she|he|her|him|they)\b/i);
    expect(new Set(Object.values(said).map((line) => line?.text)).size).toBe(MAIL_REASONS.length);
  });

  it('says the reply goes by e-mail when it will (2f)', () => {
    expect(mailLine(t, left(null), 'Marta Kovac', 'marta.kovac@cobaltlegal.example')).toEqual({ text: 'Marta has left the page. Your reply also goes to marta.kovac@cobaltlegal.example by e-mail.', link: null });
  });

  it('calls a visitor who gave no name "the visitor"', () => {
    expect(mailLine(t, left('no-email'), null, null)?.text).toBe('The visitor has left the page. Your reply shows only if the visitor comes back. No e-mail address was left in this chat.');
  });
});

describe('the inbox, decided', () => {
  const rows = messages().map(messageOf);
  const chats = [MARTA, VISITOR, TOMAS].map(conversationOf);

  it('waits from the last "asked" or "handed over" line', () => {
    expect(new Date(waitingSince(chats[2]!, rows) ?? 0).toISOString()).toBe('2026-07-28T09:05:00.000Z');
  });

  it('lists the waiting oldest first, mine by who took them, and all newest first', () => {
    expect(shown(chats, 'waiting', null, rows).map((one) => one.id)).toEqual(['3', '2', '1']);
    expect(shown(chats, 'all', null, rows).map((one) => one.id)).toEqual(['1', '2', '3']);
    expect(shown([{ ...chats[0]!, takenBy: 'u1' }, ...chats.slice(1)], 'mine', 'u1', rows).map((one) => one.id)).toEqual(['1']);
    expect(shown(chats, 'mine', null, rows)).toEqual([]);
  });

  it('words a wait in minutes, then hours, then days', () => {
    const now = Date.parse('2026-07-28T12:00:00Z');
    expect(waitedOf(t, now - 12 * 60_000, now)).toBe('12 min');
    expect(waitedOf(t, now - 3 * 3_600_000, now)).toBe('3 h');
    expect(waitedOf(t, now - 3 * 86_400_000, now)).toBe('3 d');
  });

  it('previews each chat by its newest message that is not a staff line', () => {
    expect(latestByConversation(rows).get('1')?.body).toBe('Great. Can someone look at our office layout? About 40 desks.');
  });

  it('words a staff line from its event, not from the English stored with it', () => {
    const line = (event: string, author: string | null = null) => systemLine(t, { ...rows[4]!, event, authorId: author }, chats[0]!, new Map([['u-dana', 'Dana Whitlock']]), 'en-GB');
    expect(line('asked')).toBe('Marta asked for a person · 09:33');
    expect(line('handed-over')).toBe('Handed to a person · 09:33');
    expect(line('taken', 'u-dana')).toBe('Dana took over · automatic answers stopped');
    expect(line('closed', 'u-dana')).toBe('Dana closed the chat');
    expect(line('reopened', 'u-dana')).toBe('Dana reopened the chat');
    expect(line('left')).toBe('Marta left the page · 09:33');
    expect(line('enquiry', 'u-dana')).toBe('Dana made an enquiry from this chat');
  });
});
