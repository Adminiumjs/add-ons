/**
 * THE LINE UNDER THE COMPOSER ONCE THE VISITOR HAS LEFT (comp 2f, 2g).
 *
 * While the visitor is on the page, nothing: the reply shows in their window.
 * Once they left (or the chat came outside hours), Adminium says whether a
 * reply would also be mailed, and why not. Each reason has its own sentence,
 * worded by the reason Adminium gives, never guessed:
 *
 * - mailed: "{name} has left the page. Your reply also goes to {email} by e-mail." (2f)
 * - no mail server: 2g's line, with its link to the e-mail settings;
 * - no public address: the same pattern, with its link to Privacy and public pages;
 * - today's three e-mail replies used: the same pattern, its own reason;
 * - no address left: the same pattern, its own reason;
 * - a sample chat: no e-mail goes out from one.
 *
 * The visitor is named by what they typed, never by a pronoun: a visitor has
 * no stored gender, and eight languages would each need to guess one.
 */
import type { AddOnTranslate } from '../shared/host.ts';
import type { MailReason, Presence } from '../shared/chat.ts';
import { firstNameOf } from '../shared/rows.ts';

export interface MailLine {
  text: string;
  /** A link after the text, to where the reason is fixed. */
  link: { to: 'email' | 'privacy'; label: string } | null;
}

/** The line, or null while the visitor is on the page. */
export function mailLine(t: AddOnTranslate, presence: Pick<Presence, 'presence' | 'mail'> | null, visitorName: string | null, email: string | null): MailLine | null {
  if (presence === null || presence.presence !== 'left') return null;
  const first = firstNameOf(visitorName);
  const reason: MailReason | null = presence.mail.ready && email !== null ? null : (presence.mail.reason ?? (email === null ? 'no-email' : null));
  if (reason === null) {
    return {
      text: first === null ? t('thread.mail.goesVisitor', 'The visitor has left the page. Your reply also goes to {email} by e-mail.', { email: email ?? '' }) : t('thread.mail.goes', '{name} has left the page. Your reply also goes to {email} by e-mail.', { name: first, email: email ?? '' }),
      link: null,
    };
  }
  const left = first === null ? t('thread.mail.leftVisitor', 'The visitor has left the page. Your reply shows only if the visitor comes back.') : t('thread.mail.left', '{name} has left the page. Your reply shows only if {name} comes back.', { name: first });
  switch (reason) {
    case 'no-mail-server':
      return { text: `${left} ${t('thread.mail.noServer', 'E-mail isn’t set up:')}`, link: { to: 'email', label: t('thread.mail.emailLink', 'Workspace settings → Email') } };
    case 'no-public-origin':
      return { text: `${left} ${t('thread.mail.noAddress', 'E-mail can’t go out: this server has no public address.')}`, link: { to: 'privacy', label: t('thread.mail.privacyLink', 'Privacy and public pages') } };
    case 'cap':
      return { text: `${left} ${t('thread.mail.cap', 'Today’s e-mail replies to this chat are used up.')}`, link: null };
    case 'no-email':
      return { text: `${left} ${t('thread.mail.noEmail', 'No e-mail address was left in this chat.')}`, link: null };
    case 'sample':
      return { text: `${left} ${t('thread.mail.sample', 'This is a sample chat, so no e-mail goes out.')}`, link: null };
  }
}
