/**
 * THE INBOX (comp board 2, 2-mid, 2-phone; Visitor States 2f–2h): the
 * website's chats on the start side, the open chat in the middle, and the
 * visitor's details in the side rail.
 *
 * Website chats only: every conversation of this add-on came from a website,
 * so each row carries the "Website" chip. The filters are a toggle group:
 * "Waiting for a person" (oldest waiting first, with how long each has
 * waited), "Mine" and "All".
 *
 * Live where the host can follow a table (0.3.64): a visitor's new chat or
 * message makes the lists read again. `?conversation=<id>` opens one chat;
 * Adminium's "a chat is waiting" notice links there.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { Link, PageActions, PageSurface, Sheet, SheetBody, Spinner, useAccess, useLocaleTag, useNavigate, useRecords, type AddOnTranslate } from '../shared/host.ts';
import { chatRoutes, readMe, readPeople, type Presence } from '../shared/chat.ts';
import { useLayout, useLive, useNow } from '../shared/live.ts';
import { Avatar, Icon, WebsiteChip, toneOf } from '../shared/parts.tsx';
import { conversationAt, settingsAt } from '../shared/paths.ts';
import { answerOf, conversationOf, initialsOf, messageOf, type Conversation, type Message } from '../shared/rows.ts';
import { Segs } from '../shared/Segs.tsx';
import { FILTERS, latestByConversation, shown, waitedOf, waitingCount, waitingSince, whenOf, type Filter } from './decide.ts';
import { Rail } from './Rail.tsx';
import { Thread } from './Thread.tsx';

/** The most chats, and the most recent messages, one read names. */
export const READ_MAX = 199;
/** How often an open chat asks whether its visitor is still on the page. */
export const PRESENCE_EVERY_MS = 60_000;

function FilterButton({ t, filter, on, count, onPick }: { t: AddOnTranslate; filter: Filter; on: boolean; count: number; onPick: (filter: Filter) => void }): ReactNode {
  const label = filter === 'waiting' ? t('inbox.filter.waiting', 'Waiting for a person') : filter === 'mine' ? t('inbox.filter.mine', 'Mine') : t('inbox.filter.all', 'All');
  const counted =
    filter !== 'waiting' ? null : on ? (
      <span className="min-w-[18px] rounded-full bg-accent px-1.5 text-center font-mono text-[11.5px] font-bold text-accent-fg">{String(count)}</span>
    ) : (
      <span className="min-w-[18px] rounded-full bg-surface-3 px-1.5 text-center font-mono text-[11.5px] font-bold text-fg">{String(count)}</span>
    );
  return on ? (
    <button type="button" aria-pressed="true" onClick={() => onPick(filter)} className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-accent bg-accent-soft px-2.5 text-[12.5px] font-bold text-accent">
      {label}
      {counted}
    </button>
  ) : (
    <button type="button" aria-pressed="false" onClick={() => onPick(filter)} className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-border-strong bg-surface px-2.5 text-[12.5px] font-bold text-fg-muted hover:bg-surface-3">
      {label}
      {counted}
    </button>
  );
}

function Row({ t, conversation, latest, current, waited, when, onOpen }: { t: AddOnTranslate; conversation: Conversation; latest: Message | undefined; current: boolean; waited: string | null; when: string; onOpen: () => void }): ReactNode {
  const name = conversation.name ?? t('inbox.visitor', 'Visitor');
  const body = (
    <>
      <Avatar initials={conversation.name === null ? 'V' : initialsOf(conversation.name)} tone={toneOf(conversation.id, conversation.name !== null)} size={36} />
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="flex items-center gap-1.5">
          <bdi className="min-w-0 flex-1 truncate text-start text-[13px] font-bold">{name}</bdi>
          <span className="shrink-0 font-mono text-[11.5px] text-fg-subtle">{waited ?? when}</span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <WebsiteChip label={t('inbox.website', 'Website')} />
          <span dir="auto" className="min-w-0 flex-1 truncate text-start text-[12.5px] text-fg-muted">
            <Segs text={latest?.body ?? ''} />
          </span>
          {conversation.state === 'waiting' ? <span role="img" aria-label={t('inbox.filter.waiting', 'Waiting for a person')} className="size-2 shrink-0 rounded-full bg-warn" /> : null}
        </span>
      </span>
    </>
  );
  return (
    <div role="listitem">
      {current ? (
        <button type="button" aria-current="true" onClick={onOpen} className="flex w-full items-start gap-2.5 border-b border-s-[3px] border-b-border border-s-accent bg-accent-soft px-4 py-[13px] text-start leading-[normal] text-fg">
          {body}
        </button>
      ) : (
        <button type="button" aria-current="false" onClick={onOpen} className="flex w-full items-start gap-2.5 border-b border-s-[3px] border-b-border border-s-transparent px-4 py-[13px] text-start leading-[normal] text-fg hover:bg-surface-2">
          {body}
        </button>
      )}
    </div>
  );
}

export function Inbox({ t, conversationId }: { t: AddOnTranslate; conversationId: string | null }): ReactNode {
  const access = useAccess();
  const navigate = useNavigate();
  const locale = useLocaleTag();
  const layout = useLayout();
  const now = useNow();
  const mayRead = access.ready && access.canRead('conversations');
  const mayReadMessages = access.ready && access.canRead('messages');
  const mayAnswer = access.ready && access.canUpdate('conversations');
  useLive('conversations', mayRead);
  useLive('messages', mayReadMessages);

  const conversationsRead = useRecords('conversations', { sort: [{ column: 'last_message_at', direction: 'desc' }], pageSize: READ_MAX, enabled: mayRead });
  const recentRead = useRecords('messages', { sort: [{ column: 'id', direction: 'desc' }], pageSize: READ_MAX, enabled: mayReadMessages });
  const settingsRead = useRecords('settings', { pageSize: 1, enabled: access.ready && access.canRead('settings') });
  const answersRead = useRecords('answers', { pageSize: READ_MAX, enabled: access.ready && access.canRead('answers') });

  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [me, setMe] = useState<string | null>(null);
  const [people, setPeople] = useState<ReadonlyMap<string, string>>(new Map());
  const [view, setView] = useState<'inbox' | 'thread'>('thread');
  const [railOpen, setRailOpen] = useState(false);
  const [presence, setPresence] = useState<Presence | null>(null);

  useEffect(() => {
    let live = true;
    readMe().then(
      (id) => live && setMe(id),
      () => undefined,
    );
    readPeople().then(
      (found) => live && setPeople(found),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);

  const conversations = useMemo(() => conversationsRead.rows.map(conversationOf), [conversationsRead.rows]);
  const recent = useMemo(() => recentRead.rows.map(messageOf), [recentRead.rows]);
  const latest = useMemo(() => latestByConversation(recent), [recent]);
  const answers = useMemo(() => answersRead.rows.map(answerOf), [answersRead.rows]);
  const settingsRow = settingsRead.rows[0];
  const miloOn = settingsRow !== undefined && (settingsRow['milo_drafts'] === true || settingsRow['milo_drafts'] === 1 || settingsRow['milo_drafts'] === '1');

  const typed = query.trim().toLowerCase();
  const list = shown(conversations, filter, me, recent).filter((conversation) => typed === '' || [conversation.name ?? '', conversation.email ?? '', latest.get(conversation.id)?.body ?? ''].join(' ').toLowerCase().includes(typed));
  const current = conversations.find((conversation) => conversation.id === conversationId) ?? (layout === 'phone' ? undefined : list[0]);

  // On the page or left, and the reply mail's state: asked when a chat opens, as its messages come, and every minute.
  // A staff read is also when Adminium writes the visitor's "left" line, and counts the chat as opened.
  const currentId = current?.id ?? null;
  const currentLast = currentId === null ? null : (latest.get(currentId)?.id ?? null);
  useEffect(() => {
    setPresence(null);
    if (currentId === null) return;
    let live = true;
    const ask = (): void => {
      chatRoutes.presence(currentId).then(
        (said) => live && setPresence(said),
        () => undefined,
      );
    };
    ask();
    const timer = setInterval(ask, PRESENCE_EVERY_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [currentId, currentLast]);

  const open = (id: string): void => {
    setView('thread');
    setRailOpen(false);
    void navigate({ to: conversationAt(id).split('?')[0]!, search: { conversation: id }, replace: true });
  };

  const inboxInside = (
    <>
      <div className="flex flex-col gap-3 border-b border-border px-4 pb-3 pt-[18px]">
        <div className="flex items-center gap-2">
          <h2 className="m-0 flex-1 text-[18px] font-extrabold tracking-[-0.02em]">{t('inbox.title', 'Chat')}</h2>
          <Link to={settingsAt()}>
            <span aria-label={t('inbox.settings', 'Chat settings')} title={t('inbox.settings', 'Chat settings')} className="inline-flex size-9 items-center justify-center rounded-[10px] border border-border bg-surface text-fg-muted hover:bg-surface-3">
              <Icon name="settings-2" />
            </span>
          </Link>
        </div>
        <div className="flex h-[38px] items-center gap-2 rounded-[10px] border border-border-strong bg-surface-2 px-[11px]">
          <span className="text-fg-subtle">
            <Icon name="search" />
          </span>
          <input aria-label={t('inbox.search', 'Search conversations…')} placeholder={t('inbox.search', 'Search conversations…')} value={query} onChange={(event) => setQuery(event.target.value)} className="w-full min-w-0 border-0 bg-transparent text-[12.5px] text-fg outline-none" />
        </div>
        <div role="group" aria-label={t('inbox.filters', 'Filter conversations')} className="flex flex-wrap gap-1.5">
          {FILTERS.map((one) => (
            <FilterButton key={one} t={t} filter={one} on={filter === one} count={waitingCount(conversations)} onPick={setFilter} />
          ))}
        </div>
      </div>
      <div role="list" className="flex-1 overflow-auto">
        {list.map((conversation) => (
          <Row
            key={conversation.id}
            t={t}
            conversation={conversation}
            latest={latest.get(conversation.id)}
            current={current?.id === conversation.id}
            waited={conversation.state === 'waiting' ? waitedOf(t, waitingSince(conversation, recent), now) : null}
            when={whenOf(conversation.lastMessageAt, now, locale)}
            onOpen={() => open(conversation.id)}
          />
        ))}
        {list.length === 0 && !conversationsRead.loading ? <p className="m-0 px-4 py-7 text-center text-[12.5px] text-fg-subtle">{t('inbox.none', 'No conversations')}</p> : null}
        {conversationsRead.loading ? (
          <div className="flex justify-center py-7">
            <Spinner label={t('shared.loading', 'Loading')} />
          </div>
        ) : null}
      </div>
    </>
  );
  const inboxColumn =
    layout === 'phone' ? <div className="flex min-w-0 flex-1 flex-col bg-surface">{inboxInside}</div> : <div className="flex w-72 shrink-0 flex-col border-e border-border bg-surface">{inboxInside}</div>;

  const rail = current === undefined ? null : <Rail t={t} conversation={current} answers={answers} presence={presence} onClose={layout === 'wide' ? null : () => setRailOpen(false)} />;

  const thread =
    current === undefined ? (
      <div className="flex min-w-0 flex-1 items-center justify-center p-5">
        <p className="m-0 text-[12.5px] text-fg-subtle">{t('inbox.pick', 'Pick a conversation to read it.')}</p>
      </div>
    ) : (
      <Thread
        key={current.id}
        t={t}
        conversation={current}
        answers={answers}
        people={people}
        me={me}
        mayAnswer={mayAnswer}
        miloOn={miloOn}
        layout={layout}
        railOpen={railOpen}
        onRail={() => setRailOpen((was) => !was)}
        onBack={() => setView('inbox')}
        presence={presence}
        setPresence={setPresence}
        onChanged={() => {
          conversationsRead.refetch();
          recentRead.refetch();
        }}
      />
    );

  if (access.ready && !mayRead) {
    return (
      <PageSurface padding="standard" width="wide">
        <PageActions title={t('inbox.page', 'Live chat')} documentTitle={t('inbox.page', 'Live chat')} />
        <p className="m-0 text-body text-fg-muted">{t('shared.refused.title', 'You do not have permission to open this')}</p>
      </PageSurface>
    );
  }

  return (
    <PageSurface padding="none" fill className="leading-[normal]">
      <PageActions title={t('inbox.page', 'Live chat')} documentTitle={t('inbox.page', 'Live chat')} />
      <div className="flex min-h-0 flex-1 text-[13px] leading-normal">
        {layout === 'phone' ? (view === 'inbox' || current === undefined ? inboxColumn : thread) : inboxColumn}
        {layout === 'phone' ? null : thread}
        {layout === 'wide' ? rail : null}
      </div>
      {layout !== 'wide' && rail !== null ? (
        <Sheet open={railOpen} onOpenChange={setRailOpen} maxWidth={320}>
          <SheetBody>{rail}</SheetBody>
        </Sheet>
      ) : null}
    </PageSurface>
  );
}
