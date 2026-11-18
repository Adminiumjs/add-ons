/**
 * ONE CHAT (comp board 2's middle; 2f, 2g): its header with what a person may
 * do, the conversation, and the composer.
 *
 * - Take over, Make an enquiry, Close chat / Reopen chat and Ask Milo, each
 *   only for someone who may answer the chat's conversations; Ask Milo, and
 *   Draft with Milo, only while the chat's Milo drafting is on.
 * - Someone else answering it: Adminium refuses a take with their name, and
 *   the header says "Sam is answering", with "Take over anyway".
 * - The automatic answers' line and "Sending also takes over this chat" show
 *   only while the automatic answers still have the chat.
 * - Once the visitor has left, the line under the composer says whether a
 *   reply is also mailed, and why not (`mailLine.ts`).
 * - Send is always the person's own press: a Milo draft fills the box and
 *   waits there.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { Alert, Button, IconButton, Link, useAppToasts, useLocaleTag, useRecords, type AddOnTranslate } from '../shared/host.ts';
import { chatRoutes, refusalOf, takenByOf, type ChatPerson, type Presence } from '../shared/chat.ts';
import { openMilo, type Layout } from '../shared/live.ts';
import { Avatar, Icon, Pill, SmallIcon, WebsiteChip, toneOf } from '../shared/parts.tsx';
import { EMAIL_SETTINGS, PRIVACY } from '../shared/paths.ts';
import { initialsOf, messageOf, pageOf, versionIn, type Answer, type Conversation, type Message } from '../shared/rows.ts';
import { Segs } from '../shared/Segs.tsx';
import { useToast } from '../shared/toast.ts';
import { mailLine } from './mailLine.ts';
import { clockOf, startLine, systemLine } from './decide.ts';

/** The most messages of one chat one read names: the newest. */
const THREAD_MAX = 199;

export interface ThreadProps {
  t: AddOnTranslate;
  conversation: Conversation;
  answers: readonly Answer[];
  people: ReadonlyMap<string, string>;
  me: string | null;
  mayAnswer: boolean;
  miloOn: boolean;
  layout: Layout;
  railOpen: boolean;
  onRail: () => void;
  onBack: () => void;
  onChanged: () => void;
  /** On the page or left, and the reply mail's state: the inbox asks, and the rail reads it too. */
  presence: Presence | null;
  setPresence: (next: (was: Presence | null) => Presence | null) => void;
}

/** The question an automatic answer was picked as, in the chat's language. */
export function questionOf(answers: readonly Answer[], ref: string | null, language: string): string | null {
  const answer = answers.find((one) => one.ref === ref);
  if (answer === undefined) return null;
  return versionIn(answer, language, Object.keys(answer.versions)[0] ?? language)?.title ?? null;
}

function Bubble({ t, message, conversation, answers, locale }: { t: AddOnTranslate; message: Message; conversation: Conversation; answers: readonly Answer[]; locale: string }): ReactNode {
  const time = clockOf(message.sentAt, locale);
  if (message.kind === 'visitor') {
    return (
      <div className="flex max-w-[80%] shrink-0 items-end gap-[9px]">
        <Avatar initials={conversation.name === null ? 'V' : initialsOf(conversation.name)} tone={toneOf(conversation.id, conversation.name !== null)} size={28} />
        <div className="flex min-w-0 flex-col gap-[3px]">
          <div dir="auto" className="rounded-[14px] rounded-es-sm border border-border bg-surface px-3 py-2 text-[13px] leading-normal text-fg shadow-sm [overflow-wrap:anywhere]">
            <Segs text={message.body} />
          </div>
          <span className="font-mono text-[10.5px] text-fg-subtle">{time}</span>
        </div>
      </div>
    );
  }
  if (message.kind === 'automatic') {
    const question = questionOf(answers, message.answerRef, conversation.language);
    return (
      <div className="flex max-w-[80%] shrink-0 flex-col items-end gap-[5px] self-end">
        <span className="flex flex-wrap items-center justify-end gap-2">
          <span className="inline-flex items-center gap-[5px] text-[10.5px] font-bold uppercase tracking-[0.05em] text-accent">
            <SmallIcon name="book-open" />
            {t('thread.automatic', 'Automatic answer')}
          </span>
          {question === null ? null : <span className="text-[11.5px] text-fg-muted">{t('thread.from', 'From: {question}', { question })}</span>}
        </span>
        <div dir="auto" className="rounded-[14px] rounded-ee-sm border border-dashed border-accent bg-accent-soft px-3 py-2 text-[13px] leading-normal text-fg [overflow-wrap:anywhere]">
          <Segs text={message.body} />
        </div>
        <span className="font-mono text-[10.5px] text-fg-subtle">{time}</span>
      </div>
    );
  }
  return (
    <div className="flex max-w-[80%] shrink-0 flex-col items-end gap-[3px] self-end">
      <div dir="auto" className="rounded-[14px] rounded-ee-sm bg-accent px-3 py-2 text-[13px] leading-normal text-accent-fg [overflow-wrap:anywhere]">
        <Segs text={message.body} />
      </div>
      <span className="font-mono text-[10.5px] text-fg-subtle">{time}</span>
    </div>
  );
}

function SystemPill({ text }: { text: string }): ReactNode {
  return (
    <p className="m-0 my-1 max-w-[80%] shrink-0 self-center rounded-full bg-surface-3 px-2.5 py-[3px] text-center text-[11.5px] text-fg-muted">
      <Segs text={text} />
    </p>
  );
}

export function Thread({ t, conversation, answers, people, me, mayAnswer, miloOn, layout, railOpen, onRail, onBack, onChanged, presence, setPresence }: ThreadProps): ReactNode {
  const locale = useLocaleTag();
  const toast = useToast();
  const toasts = useAppToasts();
  const read = useRecords('messages', { filter: [{ column: 'conversation_id', op: 'eq', value: conversation.id }], sort: [{ column: 'id', direction: 'desc' }], pageSize: THREAD_MAX });
  const messages = useMemo(() => read.rows.map(messageOf).reverse(), [read.rows]);
  const [takenBy, setTakenBy] = useState<ChatPerson | null>(null);
  const [became, setBecame] = useState<{ table: string; key: string } | null>(conversation.becameTable === null || conversation.becameKey === null ? null : { table: conversation.becameTable, key: conversation.becameKey });
  const [input, setInput] = useState('');
  const [drafted, setDrafted] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [busy, setBusy] = useState(false);
  const log = useRef<HTMLDivElement | null>(null);

  // The newest message in view.
  useEffect(() => {
    const box = log.current;
    if (box !== null) box.scrollTop = box.scrollHeight;
  }, [messages.length]);

  const state = conversation.state;
  const closed = state === 'closed';
  const automatic = state === 'bot';
  const otherHas = takenBy !== null || (state === 'open' && conversation.takenBy !== null && me !== null && conversation.takenBy !== me);
  const answering = state === 'open' && !otherHas;
  const otherName = takenBy?.firstName || (conversation.takenBy === null ? null : (people.get(conversation.takenBy) ?? '').split(/\s+/)[0] || null);

  const fail = (caught: unknown): void => {
    const by = takenByOf(caught);
    if (by !== null) {
      setTakenBy(by);
      return;
    }
    const said = refusalOf(caught);
    const message = typeof (caught as { message?: unknown })?.message === 'string' ? (caught as { message: string }).message : '';
    toast(message !== '' ? message : t('thread.failed', 'That did not work. Try again.'), 'error');
    void said;
  };

  const act = async (run: () => Promise<void>): Promise<void> => {
    setBusy(true);
    try {
      await run();
      onChanged();
      read.refetch();
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(false);
    }
  };

  const take = (force: boolean): Promise<void> =>
    act(async () => {
      await chatRoutes.take(conversation.id, force);
      setTakenBy(null);
      toast(t('thread.toast.took', 'You took over. Automatic answers stopped in this chat.'));
    });

  const enquiry = (): Promise<void> =>
    act(async () => {
      const made = await chatRoutes.enquiry(conversation.id);
      setBecame({ table: made.became.table, key: made.became.key });
      toast(t('thread.toast.enquiry', 'Enquiry {key} made in {table}', { key: made.became.key, table: tableName(made.became.table) }));
    });

  const closeOrReopen = (): Promise<void> =>
    act(async () => {
      if (closed) {
        await chatRoutes.reopen(conversation.id);
        toast(t('thread.toast.reopened', 'Chat reopened'));
      } else {
        await chatRoutes.close(conversation.id);
        toast(t('thread.toast.closed', 'Chat closed'));
      }
    });

  const send = (): Promise<void> => {
    const body = input.trim();
    if (body === '' || closed) return Promise.resolve();
    return act(async () => {
      // The automatic answers still have the chat: sending takes it over first, as the line under the box says.
      if (automatic) await chatRoutes.take(conversation.id);
      const replied = await chatRoutes.reply(conversation.id, body, drafted);
      setInput('');
      setDrafted(false);
      setPresence((was) => (was === null ? was : { ...was, presence: replied.presence, mail: { ...was.mail, reason: replied.reason, ready: replied.mailed } }));
      toast(t('thread.toast.sent', 'Message sent'));
    });
  };

  const draft = async (): Promise<void> => {
    if (drafting) return;
    setDrafting(true);
    try {
      const written = await chatRoutes.draft(conversation.id);
      const before = input;
      setInput(written.draft);
      setDrafted(true);
      // What was typed is never lost to a draft: the toast puts it back.
      if (before.trim() !== '')
        toasts.push({ variant: 'info', title: t('thread.toast.replaced', 'Milo’s draft replaced what you wrote.'), action: { label: t('thread.undo', 'Undo'), onAction: () => { setInput(before); setDrafted(false); } } } as never);
    } catch (caught) {
      const said = refusalOf(caught);
      if (said.reason === 'allowance') toast(t('thread.draft.allowance', 'Your Milo allowance for today is used.'), 'error');
      else if (said.code === 'CHAT_DRAFT_FAILED') toast(t('thread.draft.failed', 'Milo could not write a draft. Try again.'), 'error');
      else fail(caught);
    } finally {
      setDrafting(false);
    }
  };

  const line = mailLine(t, presence, conversation.name, conversation.email);
  const name = conversation.name ?? t('inbox.visitor', 'Visitor');
  const page = pageOf(conversation.cameFrom);

  const status = closed ? (
    <Pill tone="neutral">{t('thread.status.closed', 'Closed')}</Pill>
  ) : otherHas ? (
    <Pill tone="neutral">{otherName === null ? t('thread.status.someone', 'Someone else is answering') : t('thread.status.other', '{name} is answering', { name: otherName })}</Pill>
  ) : state === 'waiting' ? (
    <Pill tone="warn">{t('inbox.filter.waiting', 'Waiting for a person')}</Pill>
  ) : answering ? (
    <Pill tone="accent">{t('thread.status.mine', 'You’re answering')}</Pill>
  ) : null;

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2.5 border-b border-border bg-surface px-5 py-3.5">
        {layout === 'phone' ? (
          <IconButton label={t('thread.back', 'Back to conversations')} variant="bordered" onClick={onBack}>
            <span className="inline-flex rtl:-scale-x-100">
              <Icon name="arrow-left" />
            </span>
          </IconButton>
        ) : null}
        <Avatar initials={conversation.name === null ? 'V' : initialsOf(conversation.name)} tone={toneOf(conversation.id, conversation.name !== null)} size={36} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <bdi className="text-[14.5px] font-bold tracking-[-0.01em]">{name}</bdi>
            {status}
          </div>
          <div className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-fg-subtle">
            <WebsiteChip label={t('inbox.website', 'Website')} />
            {page === null ? null : (
              <bdi dir="ltr" className="truncate font-mono">
                {page}
              </bdi>
            )}
          </div>
        </div>
        <div className="flex basis-full flex-wrap gap-2">
          {mayAnswer && !closed && (state !== 'open' || otherHas) ? (
            <span title={t('thread.takeHint', 'Stops automatic answers in this chat')}>
              <Button variant="primary" iconLeft={<Icon name="hand" />} disabled={busy} onClick={() => void take(otherHas)}>
                {otherHas ? t('thread.takeAnyway', 'Take over anyway') : t('thread.take', 'Take over')}
              </Button>
            </span>
          ) : null}
          {became === null ? null : (
            <span className="inline-flex h-9 items-center gap-[7px] rounded-[10px] bg-info-soft px-3.5 text-[13px] font-bold text-info">
              <Icon name="inbox" />
              <span className="font-mono">{t('thread.enquiryMade', 'Enquiry {key}', { key: became.key })}</span>
            </span>
          )}
          {mayAnswer && became === null && !closed ? (
            <Button variant="secondary" iconLeft={<Icon name="file-plus-2" />} disabled={busy} onClick={() => void enquiry()}>
              {t('thread.enquiry', 'Make an enquiry')}
            </Button>
          ) : null}
          {mayAnswer ? (
            closed ? (
              <Button variant="secondary" iconLeft={<Icon name="rotate-ccw" />} disabled={busy} onClick={() => void closeOrReopen()}>
                {t('thread.reopen', 'Reopen chat')}
              </Button>
            ) : (
              <Button variant="secondary" iconLeft={<Icon name="circle-x" />} disabled={busy} onClick={() => void closeOrReopen()}>
                {t('thread.close', 'Close chat')}
              </Button>
            )
          ) : null}
          {miloOn ? (
            <button type="button" title={t('thread.askMiloHint', 'Ask Milo about this conversation')} onClick={openMilo} className="inline-flex h-9 items-center gap-[7px] whitespace-nowrap rounded-[10px] border border-accent bg-accent-soft px-3.5 text-[13px] font-bold text-accent">
              <Icon name="sparkles" />
              {t('thread.askMilo', 'Ask Milo')}
            </button>
          ) : null}
          {layout === 'wide' ? null : (
            <button type="button" aria-label={t('thread.details', 'Visitor details')} aria-expanded={railOpen} onClick={onRail} className="inline-flex size-9 items-center justify-center rounded-[10px] border border-border bg-surface text-fg-muted hover:bg-surface-3">
              <Icon name="info" />
            </button>
          )}
        </div>
      </header>
      {takenBy !== null ? (
        <div className="px-5 pt-3">
          <Alert tone="info" role="alert" title={takenBy.firstName === '' ? t('thread.takenSomeone', 'Someone else is answering this chat.') : t('thread.taken', '{name} is answering this chat.', { name: takenBy.firstName })} />
        </div>
      ) : null}
      <div ref={log} role="log" aria-label={t('thread.log', 'Conversation')} className="flex flex-1 flex-col gap-2.5 overflow-auto p-5">
        <SystemPill text={startLine(t, conversation, locale)} />
        {messages.map((message) =>
          message.kind === 'system' ? <SystemPill key={message.id} text={systemLine(t, message, conversation, people, locale)} /> : <Bubble key={message.id} t={t} message={message} conversation={conversation} answers={answers} locale={locale} />,
        )}
      </div>
      {mayAnswer ? (
        <div className="flex flex-col gap-2.5 border-t border-border bg-surface px-5 pb-4 pt-3">
          {automatic ? (
            <p className="m-0 flex items-center gap-2 text-[12.5px] text-fg-muted">
              <span className="inline-flex text-info">
                <SmallIcon name="info" />
              </span>
              {t('thread.autoOn', 'Automatic answers are on in this chat. Take over stops them.')}
            </p>
          ) : null}
          {closed ? <p className="m-0 text-[12.5px] text-fg-muted">{t('thread.closedNote', 'This chat is closed.')}</p> : null}
          <div className="overflow-hidden rounded-[14px] border border-border-strong bg-surface">
            {drafted && input !== '' ? (
              <div className="flex items-center gap-2 border-b border-border bg-accent-soft px-3 py-2 text-[12.5px] font-semibold">
                <span className="inline-flex text-accent">
                  <SmallIcon name="sparkles" />
                </span>
                <span className="min-w-0 flex-1">{t('thread.drafted', 'Milo wrote this draft — read it before sending')}</span>
                <button
                  type="button"
                  onClick={() => {
                    setInput('');
                    setDrafted(false);
                  }}
                  className="h-8 border-0 bg-transparent px-1.5 text-[12.5px] font-bold text-accent"
                >
                  {t('thread.discard', 'Discard')}
                </button>
              </div>
            ) : null}
            {drafted && input !== '' ? (
              <textarea aria-label={t('thread.write', 'Write a message…')} placeholder={t('thread.write', 'Write a message…')} rows={4} value={input} disabled={closed} onChange={(event) => setInput(event.target.value)} className="block w-full resize-none border-0 bg-transparent px-3.5 py-3 text-[13px] leading-normal text-fg" />
            ) : (
              <textarea aria-label={t('thread.write', 'Write a message…')} placeholder={t('thread.write', 'Write a message…')} rows={2} value={input} disabled={closed} onChange={(event) => setInput(event.target.value)} className="block w-full resize-none border-0 bg-transparent px-3.5 py-3 text-[13px] leading-normal text-fg" />
            )}
            <div className="flex flex-wrap items-center gap-2 px-2.5 py-2">
              {miloOn ? (
                <Button variant="secondary" iconLeft={<Icon name="sparkles" />} disabled={drafting || closed} onClick={() => void draft()}>
                  {drafting ? t('thread.drafting', 'Milo is writing…') : t('thread.draft', 'Draft with Milo')}
                </Button>
              ) : null}
              <span className="flex-1" />
              {automatic ? <span className="text-[11.5px] text-fg-subtle">{t('thread.sendHint', 'Sending also takes over this chat.')}</span> : null}
              <Button
                variant="primary"
                iconLeft={
                  <span className="inline-flex rtl:-scale-x-100">
                    <Icon name="send" />
                  </span>
                }
                disabled={closed || busy}
                onClick={() => void send()}
              >
                {t('thread.send', 'Send')}
              </Button>
            </div>
          </div>
          {line === null ? null : (
            <p className="m-0 flex items-start gap-2 text-[12.5px] leading-normal text-fg-muted">
              <span className="inline-flex pt-0.5 text-info">
                <SmallIcon name="log-out" />
              </span>
              <span className="min-w-0 flex-1">
                <Segs text={line.text} />
                {line.link === null ? null : (
                  <>
                    {' '}
                    <span className="font-bold underline">
                      <Link to={line.link.to === 'email' ? EMAIL_SETTINGS : PRIVACY}>{line.link.label}</Link>
                    </span>
                    .
                  </>
                )}
              </span>
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** A table named by its stored ref (`crm:enquiries`): the part after the app. */
export const tableName = (ref: string): string => ref.split(':').pop() ?? ref;
