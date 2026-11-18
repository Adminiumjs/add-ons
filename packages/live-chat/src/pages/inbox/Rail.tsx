/**
 * THE SIDE RAIL (comp 2b, 2f's rail, 2h): who the visitor is, as far as the
 * chat knows.
 *
 * - Their name as they typed it, or "Visitor — no e-mail yet".
 * - Whether they are on the page or left it, from Adminium's presence read.
 * - The e-mail they typed, "· not confirmed": nobody checked it is theirs.
 * - "Came from": the page the window was opened on.
 * - "Contact" only once the chat became a row ("Make an enquiry"): a typed
 *   address is never matched to a contact by itself.
 * - When it started, its language, and every automatic answer it was given.
 */
import type { ReactNode } from 'react';

import { useLocaleTag, useRecords, type AddOnTranslate } from '../shared/host.ts';
import type { Presence } from '../shared/chat.ts';
import { Avatar, Icon, MicroTitle, SmallIcon, toneOf } from '../shared/parts.tsx';
import { initialsOf, messageOf, pageOf, type Answer, type Conversation } from '../shared/rows.ts';
import { clockOf, whenOf } from './decide.ts';
import { Segs } from '../shared/Segs.tsx';
import { questionOf, tableName } from './Thread.tsx';

/** A language's name in the reader's own language: "English", "German"; Chinese by its script. */
export function languageIn(tag: string, locale: string): string {
  if (tag === '') return '';
  const asked = tag === 'zh-CN' ? 'zh-Hans' : tag === 'zh-TW' ? 'zh-Hant' : (tag.split('-')[0] ?? tag);
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(asked) ?? tag;
  } catch {
    return tag;
  }
}

function Entry({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11.5px] text-fg-subtle">{label}</dt>
      <dd className="m-0">{children}</dd>
    </div>
  );
}

export function Rail({ t, conversation, answers, presence, onClose }: { t: AddOnTranslate; conversation: Conversation; answers: readonly Answer[]; presence: Presence | null; onClose: (() => void) | null }): ReactNode {
  const locale = useLocaleTag();
  const automatic = useRecords('messages', {
    filter: [
      { column: 'conversation_id', op: 'eq', value: conversation.id },
      { column: 'kind', op: 'eq', value: 'automatic' },
    ],
    sort: [{ column: 'id', direction: 'asc' }],
    pageSize: 50,
  }).rows.map(messageOf);

  const page = pageOf(conversation.cameFrom);
  const left = presence?.presence === 'left';
  const lastSeen = presence?.lastVisitorAt === null || presence?.lastVisitorAt === undefined ? null : Date.parse(presence.lastVisitorAt);
  const became = conversation.becameTable === null || conversation.becameKey === null ? null : { table: conversation.becameTable, key: conversation.becameKey };
  const named = conversation.name !== null || conversation.email !== null;

  return (
    <aside aria-label={t('rail.details', 'Visitor details')} className="flex w-64 shrink-0 flex-col gap-[18px] overflow-auto border-s border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <span className="flex-1">
          <MicroTitle>{t('rail.visitor', 'Visitor')}</MicroTitle>
        </span>
        {onClose === null ? null : (
          <button type="button" aria-label={t('rail.closeDetails', 'Close details')} onClick={onClose} className="inline-flex size-9 items-center justify-center rounded-[10px] border border-border bg-surface text-fg-muted hover:bg-surface-3">
            <Icon name="x" />
          </button>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Avatar initials={conversation.name === null ? 'V' : initialsOf(conversation.name)} tone={toneOf(conversation.id, conversation.name !== null)} size={44} />
          <bdi className="text-[14px] font-bold">{named ? (conversation.name ?? t('inbox.visitor', 'Visitor')) : t('rail.noEmail', 'Visitor — no e-mail yet')}</bdi>
        </div>
        {presence === null ? null : left ? (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-fg-muted">
            <SmallIcon name="log-out" />
            <span>
              <Segs text={t('rail.left', 'Left the page · {time}', { time: clockOf(lastSeen, locale) })} />
            </span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-fg-muted">
            <SmallIcon name="app-window" />
            <span>{t('rail.here', 'On the page · now')}</span>
          </span>
        )}
      </div>
      <dl className="m-0 flex flex-col gap-3">
        {conversation.email === null ? null : (
          <Entry label={t('rail.email', 'E-mail')}>
            <span className="text-[12.5px] [overflow-wrap:anywhere]">
              <bdi dir="ltr" className="font-mono text-[11.5px]">
                {conversation.email}
              </bdi>
              {' '}
              <span className="text-fg-muted">{t('rail.notConfirmed', '· not confirmed')}</span>
            </span>
          </Entry>
        )}
        {page === null || conversation.cameFrom === null ? null : (
          <Entry label={t('rail.cameFrom', 'Came from')}>
            <a href={conversation.cameFrom} target="_blank" rel="noopener noreferrer" dir="ltr" className="font-mono text-[11.5px] text-accent [overflow-wrap:anywhere]">
              {page}
            </a>
          </Entry>
        )}
        {became === null ? null : (
          <Entry label={t('rail.contact', 'Contact')}>
            <span className="text-[13px] font-bold text-accent">{t('rail.row', '{key} in {table}', { key: became.key, table: tableName(became.table) })}</span>
          </Entry>
        )}
        <Entry label={t('rail.started', 'Started')}>
          <span className="font-mono text-[12.5px]">{whenOf(conversation.startedAt, Date.now(), locale) === clockOf(conversation.startedAt, locale) ? clockOf(conversation.startedAt, locale) : `${whenOf(conversation.startedAt, Date.now(), locale)}, ${clockOf(conversation.startedAt, locale)}`}</span>
        </Entry>
        <Entry label={t('rail.language', 'Language')}>
          <span className="text-[13px]">{languageIn(conversation.language, locale)}</span>
        </Entry>
        {became === null ? null : (
          <Entry label={t('rail.enquiry', 'Enquiry')}>
            <span className="flex flex-wrap gap-1.5 text-[13px]">
              <span className="font-mono text-[12.5px] font-bold text-accent">{became.key}</span>
              <span className="text-fg-muted">{t('rail.in', 'in {table}', { table: tableName(became.table) })}</span>
            </span>
          </Entry>
        )}
      </dl>
      {automatic.length === 0 ? null : (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <MicroTitle>{t('rail.used', 'Automatic answers in this chat')}</MicroTitle>
          {automatic.map((message) => (
            <div key={message.id} className="flex items-start gap-2 text-[12.5px]">
              <span className="inline-flex pt-0.5 text-fg-muted">
                <SmallIcon name="book-open" />
              </span>
              <span className="min-w-0 flex-1">{questionOf(answers, message.answerRef, conversation.language) ?? message.body}</span>
              <span className="font-mono text-[11.5px] text-fg-subtle">{clockOf(message.sentAt, locale)}</span>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
