/**
 * CHAT SETTINGS (comp 3a, 3b, 3c, 3d, 3e): the add-on's own page in the
 * Library, opened from the inbox's gear.
 *
 * - Opening hours, day by day, in the time zone the chat's hours are in, and
 *   "Closed until" a day (a holiday).
 * - The words outside hours and the welcome line, each in every language the
 *   chat offers (the language variations).
 * - Automatic answers: blocked until there is an answer, a daily limit and an
 *   AI service; today's use of the limit; the AI service's own sentence;
 *   Milo drafting; who is told; and the first line the window shows, as a
 *   visitor reads it.
 * - The answers, and "Try a question".
 * - Putting the chat on a website, or what keeps it off one.
 * - How long conversations are kept.
 *
 * One "Save changes" writes the settings row; the answers save themselves.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { Button, DateInput, Link, PageActions, PageSurface, Popover, PopoverContent, PopoverTrigger, SegmentedControl, Skeleton, Stack, asDataError, useAccess, useLocaleTag, useNavigate, useRecords, useWrite, type AddOnTranslate } from '../shared/host.ts';
import { chatRoutes, type AiState } from '../shared/chat.ts';
import { isRightToLeft, languageName } from '../shared/languages.ts';
import { Icon } from '../shared/parts.tsx';
import { MILO_SETTINGS, PRIVACY, inboxAt } from '../shared/paths.ts';
import { refusal } from '../shared/refusal.ts';
import { answerOf } from '../shared/rows.ts';
import { useToast } from '../shared/toast.ts';
import { Answers, codeOf } from './Answers.tsx';
import { DAYS, KEEP_MONTHS, opensShown, THEMES, automaticBlocked, clockShown, draftIssues, draftOf, firstLineKind, tokensValue, valuesOf, type Day, type Draft } from './draft.ts';
import { Section, SectionTitle, Toggle } from './parts.tsx';
import { readStatus, type ChatStatus } from './status.ts';
import { Tell } from './Tell.tsx';
import { TryQuestion } from './TryQuestion.tsx';
import { Website } from './Website.tsx';

/** Before the status answers (or when it is refused): no languages beyond the default, no roles to name. */
const NO_LANGUAGES: readonly string[] = [];
const NO_ROLES: ChatStatus['roles'] = [];

/** A weekday's name in the reader's language, Monday first. */
export function dayName(day: Day, locale: string): string {
  // 1 January 2024 was a Monday.
  return new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1 + DAYS.indexOf(day))));
}

function Hours({ t, draft, change, zone, locale, languages, defaultLanguage }: { t: AddOnTranslate; draft: Draft; change: (next: (was: Draft) => Draft) => void; zone: string | null; locale: string; languages: readonly string[]; defaultLanguage: string }): ReactNode {
  const setDay = (day: Day, next: Partial<Draft['hours'][Day]>): void => change((was) => ({ ...was, hours: { ...was.hours, [day]: { ...was.hours[day], ...next } } }));
  const issue = draftIssues(draft);
  return (
    <Section labelledBy="chat-hours-title">
      <div className="flex flex-wrap items-baseline gap-2.5">
        <span className="flex-1">
          <SectionTitle id="chat-hours-title">{t('settings.hours.title', 'Opening hours')}</SectionTitle>
        </span>
        {zone === null ? null : <span className="font-mono text-[11.5px] text-fg-subtle">{zone}</span>}
      </div>
      <div className="flex flex-col">
        {DAYS.map((day) => {
          const one = draft.hours[day];
          const name = dayName(day, locale);
          return (
            <div key={day} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border py-[13px]">
              <Toggle on={one.on} label={t('settings.hours.open', 'Open on {day}', { day: name })} onPress={() => setDay(day, { on: !one.on })} />
              <span className="min-w-24 text-[13px] font-semibold">{name}</span>
              {one.on ? (
                <span className="flex items-center gap-2">
                  <input aria-label={t('settings.hours.from', '{day} opens', { day: name })} dir="ltr" value={clockShown(one.from)} onChange={(event) => setDay(day, { from: event.target.value })} className="h-[34px] w-[76px] rounded-[10px] border border-border-strong bg-surface px-2.5 font-mono text-[12.5px] text-fg" />
                  <span className="text-fg-subtle">–</span>
                  <input aria-label={t('settings.hours.to', '{day} closes', { day: name })} dir="ltr" value={clockShown(one.to)} onChange={(event) => setDay(day, { to: event.target.value })} className="h-[34px] w-[76px] rounded-[10px] border border-border-strong bg-surface px-2.5 font-mono text-[12.5px] text-fg" />
                </span>
              ) : (
                <span className="text-[13px] text-fg-muted">{t('settings.hours.closed', 'Closed')}</span>
              )}
              {issue?.day === day ? (
                <span role="alert" className="basis-full text-[12.5px] text-danger">
                  {t('settings.hours.bad', 'Write the times like 9:00 and 17:30, the opening first.')}
                </span>
              ) : null}
            </div>
          );
        })}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border py-[13px]">
          <label htmlFor="chat-closed-until" className="min-w-24 text-[13px] font-semibold">
            {t('settings.hours.closedUntil', 'Closed until')}
          </label>
          <span className="w-[200px]">
            <DateInput id="chat-closed-until" value={draft.closedUntil} onChange={(event) => change((was) => ({ ...was, closedUntil: event.target.value }))} />
          </span>
          <span className="text-[11.5px] text-fg-subtle">{t('settings.hours.closedUntilHint', 'For a holiday: closed every day before this one.')}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="chat-outside" className="flex-1 text-[13px] font-bold">
            {t('settings.outside.title', 'Outside hours')}
          </label>
          <Variations t={t} field="outside" draft={draft} change={change} languages={languages} defaultLanguage={defaultLanguage} />
        </div>
        <textarea
          id="chat-outside"
          rows={2}
          value={draft.outside[defaultLanguage] ?? ''}
          placeholder={t('settings.outside.stock', 'We’re away until {opens}.', { opens: opensShown(defaultLanguage) })}
          onChange={(event) => change((was) => ({ ...was, outside: { ...was.outside, [defaultLanguage]: event.target.value } }))}
          className="resize-y rounded-[10px] border border-border-strong bg-surface px-3 py-2.5 text-[13px] leading-normal text-fg"
        />
        <p className="m-0 text-[11.5px] text-fg-subtle">{t('settings.outside.hint', '“{opens}” changes to the next opening time. No automatic answers outside hours.', { opens: opensShown(defaultLanguage) })}</p>
      </div>
    </Section>
  );
}

/**
 * The language variations of one owner-written text (the welcome line, or the
 * words outside hours): one row per language the chat offers, its status, and
 * a language added. A language is offered once it has words.
 */
function Variations({ t, field, draft, change, languages, defaultLanguage }: { t: AddOnTranslate; field: 'welcome' | 'outside'; draft: Draft; change: (next: (was: Draft) => Draft) => void; languages: readonly string[]; defaultLanguage: string }): ReactNode {
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState<string[]>([]);
  const words = draft[field];
  const rows = [...new Set([defaultLanguage, ...languages, ...Object.keys(draft.welcome), ...Object.keys(draft.outside), ...added])];
  const done = rows.filter((language) => (words[language] ?? '').trim() !== '').length;
  const others = ['en-US', 'de-DE', 'fr-FR', 'da-DK', 'cs-CZ', 'ar-EG', 'zh-CN', 'zh-TW'].filter((language) => !rows.includes(language));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" iconLeft={<Icon name="languages" />}>
          <span className="inline-flex items-center gap-[7px]">
            {t('settings.welcome.variations', 'Language variations')}
            {done === rows.length ? (
              <span className="rounded-md bg-pos-soft px-1.5 font-mono text-[11.5px] text-pos">{t('settings.welcome.of', '{done} of {all}', { done, all: rows.length })}</span>
            ) : (
              <span className="rounded-md bg-warn-soft px-1.5 font-mono text-[11.5px] text-warn">{t('settings.welcome.of', '{done} of {all}', { done, all: rows.length })}</span>
            )}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label={t('settings.welcome.variations', 'Language variations')}>
        <div className="flex w-[400px] max-w-full flex-col gap-3">
          <span className="text-[14px] font-bold">{t('settings.welcome.variations', 'Language variations')}</span>
          {rows.map((language) => {
            const text = words[language] ?? '';
            return (
              <div key={language} className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="w-8 shrink-0 font-mono text-[11.5px] font-bold text-fg-muted">{codeOf(language)}</span>
                <input
                  aria-label={languageName(language)}
                  lang={language}
                  dir={isRightToLeft(language) ? 'rtl' : 'ltr'}
                  value={text}
                  placeholder={t('settings.welcome.add', 'Add the {language} version', { language: languageName(language) })}
                  onChange={(event) => change((was) => ({ ...was, [field]: { ...was[field], [language]: event.target.value } }))}
                  className="h-9 min-w-0 flex-1 rounded-[10px] border border-border-strong bg-surface px-2.5 text-[12.5px] text-fg"
                />
                <span className="w-8 shrink-0" />
                {text.trim() === '' ? <span className="text-[11.5px] font-bold text-warn">{t('settings.welcome.needs', 'Needs translation')}</span> : <span className="text-[11.5px] font-bold text-pos">{t('settings.welcome.done', 'Done')}</span>}
              </div>
            );
          })}
          {others.length === 0 ? null : (
            <label className="flex items-center gap-2 text-[12.5px] text-fg-muted">
              {t('settings.welcome.addLanguage', 'Add a language')}
              <select aria-label={t('settings.welcome.addLanguage', 'Add a language')} value="" onChange={(event) => event.target.value !== '' && setAdded((was) => [...was, event.target.value])} className="h-9 rounded-[10px] border border-border-strong bg-surface px-2 text-[12.5px] text-fg">
                <option value="" />
                {others.map((language) => (
                  <option key={language} value={language}>
                    {languageName(language)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="flex justify-end">
            <Button variant="primary" size="sm" onClick={() => setOpen(false)}>
              {t('settings.welcome.closeVariations', 'Done')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Welcome({ t, draft, change, languages, defaultLanguage, business }: { t: AddOnTranslate; draft: Draft; change: (next: (was: Draft) => Draft) => void; languages: readonly string[]; defaultLanguage: string; business: string }): ReactNode {
  return (
    <Section labelledBy="chat-welcome-title">
      <SectionTitle id="chat-welcome-title">{t('settings.welcome.title', 'Welcome line')}</SectionTitle>
      <p className="m-0 text-[12.5px] text-fg-muted">{t('settings.welcome.hint', 'Shown under “{business}” at the top of the chat.', { business })}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label={t('settings.welcome.field', 'Welcome line, {language}', { language: languageName(defaultLanguage) })}
          value={draft.welcome[defaultLanguage] ?? ''}
          placeholder={t('settings.welcome.stock', 'We usually answer within an hour')}
          onChange={(event) => change((was) => ({ ...was, welcome: { ...was.welcome, [defaultLanguage]: event.target.value } }))}
          className="h-10 min-w-[220px] flex-1 rounded-[10px] border border-border-strong bg-surface px-3 text-[13px] text-fg"
        />
        <Variations t={t} field="welcome" draft={draft} change={change} languages={languages} defaultLanguage={defaultLanguage} />
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3.5">
        <span className="flex-1 text-[13px]">{t('settings.theme.title', 'Colours of the chat window')}</span>
        <SegmentedControl
          aria-label={t('settings.theme.title', 'Colours of the chat window')}
          value={draft.theme}
          onValueChange={(value) => change((was) => ({ ...was, theme: THEMES.find((one) => one === value) ?? 'light' }))}
          options={[
            { value: 'light', label: t('settings.theme.light', 'Light') },
            { value: 'dark', label: t('settings.theme.dark', 'Dark') },
            { value: 'visitor', label: t('settings.theme.visitor', 'As the visitor’s device') },
          ]}
        />
      </div>
    </Section>
  );
}

function Automatic({ t, draft, change, answers, ai, business, roles, onBlocked }: { t: AddOnTranslate; draft: Draft; change: (next: (was: Draft) => Draft) => void; answers: number; ai: AiState | null; business: string; roles: ChatStatus['roles']; onBlocked: (why: string) => void }): ReactNode {
  // Who is told sits where the comp draws its "Tell me when the limit runs out" row.
  const usable = ai === null ? null : ai.usable;
  const blocked = automaticBlocked(answers, draft, usable);
  const limit = tokensValue(draft.dailyTokens) ?? 0;
  const used = ai === null ? 0 : ai.today.spent + ai.today.reserved;
  const kind = firstLineKind(draft, usable, answers);
  const service = ai?.service?.name ?? '';
  const first =
    kind === 'A'
      ? t('settings.first.a', 'Some answers here are automatic, picked from answers {business} wrote. A person can take over at any time. Your messages are read by an AI service ({service}).', { business, service })
      : kind === 'B'
        ? t('settings.first.b', 'A person answers here. Staff may use an AI service ({service}) to help write replies.', { service })
        : t('settings.first.c', 'A person answers here.');
  const why = blocked === 'service' ? t('settings.auto.blockedService', 'Set an AI service in Milo settings first.') : t('settings.auto.blocked', 'Write an answer and set a daily limit first.');
  const percent = limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  return (
    <Section labelledBy="chat-auto-title">
      <div className="flex items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <SectionTitle id="chat-auto-title">{t('settings.auto.title', 'Automatic answers')}</SectionTitle>
          <p className="m-0 text-[12.5px] leading-normal text-fg-muted">
            {draft.automatic ? t('settings.auto.on', 'On. A question that matches one of your answers gets that answer, marked “Automatic answer”. Anything else goes to a person.') : t('settings.auto.off', 'They stay off until you write some answers and set a daily limit.')}
          </p>
          {ai?.notice === null || ai?.notice === undefined ? null : <p className="m-0 text-[12.5px] leading-normal text-fg-muted">{ai.notice}</p>}
        </div>
        <Toggle on={draft.automatic} blocked={!draft.automatic && blocked !== null} labelledBy="chat-auto-title" onPress={() => (!draft.automatic && blocked !== null ? onBlocked(why) : change((was) => ({ ...was, automatic: !was.automatic })))} />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <label htmlFor="chat-limit" className="font-bold">
          {t('settings.auto.limit', 'Daily limit:')}
        </label>
        <input id="chat-limit" inputMode="numeric" placeholder="20000" value={draft.dailyTokens} onChange={(event) => change((was) => ({ ...was, dailyTokens: event.target.value }))} className="h-9 w-24 rounded-[10px] border border-border-strong bg-surface px-2.5 font-mono text-[12.5px] text-fg" />
        <span>{t('settings.auto.tokens', 'tokens a day')}</span>
        {tokensValue(draft.dailyTokens) === null ? (
          <span role="alert" className="basis-full text-[12.5px] text-danger">
            {t('settings.auto.badLimit', 'Write a whole number, or leave it empty for no automatic answers.')}
          </span>
        ) : null}
      </div>
      {draft.automatic && limit > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[12.5px]">
            {t('settings.auto.used', 'Used today:')}{' '}
            <span className="font-mono">{t('settings.auto.usedOf', '{used} of {limit}', { used: used.toLocaleString(), limit: limit.toLocaleString() })}</span>
          </span>
          <UsedBar percent={percent} />
        </div>
      ) : null}
      <Tell t={t} draft={draft} change={change} roles={roles} />
      <div className="flex items-center gap-3 border-t border-border pt-3.5">
        <span id="chat-milo-title" className="flex-1 text-[13px]">
          {t('settings.milo.title', 'Milo drafts replies in these chats for staff to read and send')}
        </span>
        <Toggle on={draft.miloDrafts} labelledBy="chat-milo-title" onPress={() => change((was) => ({ ...was, miloDrafts: !was.miloDrafts }))} />
      </div>
      <p className="m-0 flex flex-wrap items-center gap-1.5 text-[11.5px] text-fg-subtle">
        <Icon name="cpu" />
        {ai === null ? null : ai.service !== null ? (
          t('settings.ai.service', 'AI service: {service}, from your workspace settings.', { service: ai.service.name })
        ) : ai.refusal === 'network-disabled' ? (
          t('settings.ai.network', 'Outside calls are switched off on this server, so no AI service can be used.')
        ) : ai.refusal === 'off-here' ? (
          t('settings.ai.offHere', 'Automatic answers can’t run on this server.')
        ) : (
          t('settings.ai.none', 'No AI service is set.')
        )}{' '}
        <span className="font-bold">
          <Link to={MILO_SETTINGS}>{t('settings.ai.link', 'Milo settings')}</Link>
        </span>
      </p>
      <div className="flex flex-col gap-1.5 border-t border-border pt-3.5">
        <span className="text-[13px] font-bold">{t('settings.first.title', 'The chat’s first line')}</span>
        <p className="m-0 rounded-[10px] border border-border bg-surface-2 px-3 py-2.5 text-[12.5px] leading-normal text-fg-muted">
          {first}{' '}
          <span className="font-bold underline">
            <Link to={PRIVACY}>{t('settings.first.privacy', 'Privacy notice.')}</Link>
          </span>
        </p>
      </div>
    </Section>
  );
}

/**
 * Today's use of the limit as a 6 px bar, in tenths: the words beside it carry
 * the numbers, so the bar is hidden from a screen reader and has no role.
 */
function UsedBar({ percent }: { percent: number }): ReactNode {
  const tenths = Math.min(10, Math.max(0, Math.round(percent / 10)));
  return (
    <div aria-hidden="true" className="flex h-1.5 overflow-hidden rounded-md bg-surface-3">
      {Array.from({ length: 10 }, (_, index) => (index < tenths ? <span key={String(index)} className="h-full flex-1 bg-accent" /> : <span key={String(index)} className="h-full flex-1 bg-transparent" />))}
    </div>
  );
}

function Keep({ t, draft, change }: { t: AddOnTranslate; draft: Draft; change: (next: (was: Draft) => Draft) => void }): ReactNode {
  const months = draft.months === null ? '' : String(draft.months);
  return (
    <section className="flex flex-col gap-2 rounded-[14px] border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="chat-keep" className="flex-1 text-[14.5px] font-bold tracking-[-0.01em]">
          {t('settings.keep.title', 'Keep conversations for:')}
        </label>
        <select id="chat-keep" value={months} onChange={(event) => change((was) => ({ ...was, months: event.target.value === '' ? null : Number(event.target.value) }))} className="h-9 rounded-[10px] border border-border-strong bg-surface px-2.5 font-mono text-[13px] text-fg">
          {KEEP_MONTHS.map((count) => (
            <option key={count} value={String(count)}>
              {t('settings.keep.months', '{count, plural, one {# month} other {# months}}', { count })}
            </option>
          ))}
          {draft.months === null ? <option value="">{t('settings.keep.always', 'Until removed')}</option> : null}
        </select>
      </div>
      <p className="m-0 text-[12.5px] text-fg-muted">{t('settings.keep.text', 'After that, the conversation and the visitor’s e-mail are deleted. Enquiries made from a chat stay.')}</p>
    </section>
  );
}

export function Settings({ t }: { t: AddOnTranslate }): ReactNode {
  const access = useAccess();
  const locale = useLocaleTag();
  const navigate = useNavigate();
  const toast = useToast();
  const mayRead = access.ready && access.canRead('settings');
  const mayChange = access.ready && access.canUpdate('settings');
  const mayAnswers = access.ready && access.canUpdate('answers');
  const settingsRead = useRecords('settings', { pageSize: 1, enabled: mayRead });
  const answersRead = useRecords('answers', { pageSize: 199, sort: [{ column: 'position', direction: 'asc' }], enabled: access.ready && access.canRead('answers') });
  const write = useWrite('settings');
  const row = settingsRead.rows[0];
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<ChatStatus | null>(null);
  const [ai, setAi] = useState<AiState | null>(null);
  const [pausedUntil, setPausedUntil] = useState<string | null>(null);

  // The row as saved, read into the draft once it arrives (and again after a save).
  useEffect(() => {
    if (!settingsRead.loading && draft === null && mayRead) setDraft(draftOf(row));
  }, [settingsRead.loading, row, draft, mayRead]);

  useEffect(() => {
    if (!mayRead) return;
    let live = true;
    void readStatus().then((read) => live && setStatus(read));
    chatRoutes.ai().then(
      (read) => live && setAi(read),
      () => undefined,
    );
    chatRoutes.pause().then(
      (read) => live && setPausedUntil(read.pausedUntil),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [mayRead]);

  const answers = useMemo(() => answersRead.rows.map(answerOf), [answersRead.rows]);
  const defaultLanguage = status?.defaultLanguage ?? 'en-US';
  const languages = status?.languages ?? NO_LANGUAGES;
  const business = status?.business ?? t('settings.business', 'your business');
  const shown = draft;
  const change = (next: (was: Draft) => Draft): void => setDraft((was) => (was === null ? was : next(was)));

  const save = async (): Promise<void> => {
    if (draft === null) return;
    if (draftIssues(draft) !== null) {
      toast(t('settings.fix', 'Fix the marked fields first.'), 'error');
      return;
    }
    setSaving(true);
    try {
      const values = valuesOf(draft);
      if (row === undefined) await write.create(values);
      else await write.update(row['id'] as string | number, values);
      toast(t('settings.saved', 'Chat settings saved'));
      settingsRead.refetch();
      chatRoutes.ai().then(setAi, () => undefined);
    } catch (caught) {
      toast(refusal(t, asDataError(caught)).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const resume = async (): Promise<void> => {
    try {
      await chatRoutes.resume();
      setPausedUntil(null);
      toast(t('settings.pause.resumed', 'New chats are open again.'));
    } catch (caught) {
      toast(refusal(t, asDataError(caught)).message, 'error');
    }
  };

  const title = t('settings.title', 'Chat settings');
  let body: ReactNode;
  if (access.ready && !mayRead) body = <p className="m-0 text-body text-fg-muted">{t('shared.refused.title', 'You do not have permission to open this')}</p>;
  else if (shown === null)
    body = (
      <Stack gap="sm">
        <Skeleton height={44} />
        <Skeleton height={44} />
        <Skeleton height={44} />
      </Stack>
    );
  else
    body = (
      <div className="flex max-w-[760px] min-w-0 flex-col gap-4 text-[13px] leading-normal">
        <div className="flex flex-col gap-1 pb-1">
          <p className="m-0 text-[13px] text-fg-muted">{t('settings.lead', 'Live chat add-on. A chat window on your website; its conversations come into the chat inbox.')}</p>
        </div>
        <Hours t={t} draft={shown} change={change} zone={status?.timeZone ?? null} locale={locale} languages={languages} defaultLanguage={defaultLanguage} />
        <Welcome t={t} draft={shown} change={change} languages={languages} defaultLanguage={defaultLanguage} business={business} />
        <Automatic t={t} draft={shown} change={change} answers={answers.filter((one) => one.active).length} ai={ai} business={business} roles={status?.roles ?? NO_ROLES} onBlocked={(why) => toast(why, 'info')} />
        <Answers t={t} answers={answers} defaultLanguage={defaultLanguage} languages={languages} mayEdit={mayAnswers} onChanged={() => answersRead.refetch()} />
        {answers.length === 0 ? null : <TryQuestion t={t} answers={answers} defaultLanguage={defaultLanguage} />}
        <Website t={t} status={status} pausedUntil={pausedUntil} mayResume={mayChange} onResume={resume} locale={locale} />
        <Keep t={t} draft={shown} change={change} />
        {mayChange ? (
          <div className="flex justify-end gap-2.5">
            <Button variant="primary" loading={saving} onClick={() => void save()}>
              {t('settings.save', 'Save changes')}
            </Button>
          </div>
        ) : null}
      </div>
    );

  return (
    <PageSurface padding="standard" width="wide" className="leading-[normal]">
      <PageActions title={title} documentTitle={title}>
        <Button variant="secondary" iconLeft={<Icon name="message-circle" />} onClick={() => void navigate({ to: inboxAt() })}>
          {t('settings.openChat', 'Open Chat')}
        </Button>
      </PageActions>
      {body}
    </PageSurface>
  );
}
