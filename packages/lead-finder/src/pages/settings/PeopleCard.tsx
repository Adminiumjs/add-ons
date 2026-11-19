/**
 * THE PEOPLE CARD (comps 3d, 3d-2, 3e): whether Lead finder keeps the people
 * Hunter finds at a company, why, and for how long.
 *
 * - The switch is refused by Adminium until everything the tell mail needs
 *   is there; the card lists what is missing, each a link to where it is put
 *   right, and the switch stays off.
 * - "Why you keep them": one plain sentence per language a found person may
 *   be told in (English, the reader's, and the language of each register
 *   that is on), chips saying which are written.
 * - "Keep found people for": 1, 2 or 3 years.
 * - With people on: they start at "may not be e-mailed", and are written to
 *   one to one, never in a campaign, and only after they agree.
 *
 * The settings row is the add-on's own (`settings`), written through the
 * kit as the person; a reader without its update grant changes nothing.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { sources as sourceRoutes } from '../shared/door.ts';
import { Link, Select, Skeleton, Switch, ToggleChip, asDataError, useAccess, useLocaleTag, useRecords, useWrite, type AddOnTranslate, type DataRow } from '../shared/host.ts';
import { isRightToLeft, languageIn, languageName } from '../shared/languages.ts';
import { Icon, Note, Pill, SmallIcon } from '../shared/parts.tsx';
import { EMAIL_SETTINGS, PRIVACY, mailAt } from '../shared/paths.ts';
import { useToast } from '../shared/toast.ts';
import { doorRefusal } from '../shared/codes.ts';
import { isSwitchRefusal, problemsOf, type Problem } from './problems.ts';

/** The eight languages a found person may be told in. */
const TELLABLE = ['en-US', 'de-DE', 'fr-FR', 'da-DK', 'cs-CZ', 'ar-EG', 'zh-CN', 'zh-TW'] as const;

/** A register's language, by the source that searches its country. */
const REGISTER_LANGUAGE: Readonly<Record<string, string>> = { 'companies-house': 'en-US', france: 'fr-FR' };

const yes = (value: unknown): boolean => value === true || value === 1 || value === '1' || value === 'true' || value === 't';

/** The purpose a row holds, by language: the JSON column as the kit hands it, or as text. */
export function purposeOf(value: unknown): Record<string, string> {
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = null;
    }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
  return Object.fromEntries(Object.entries(parsed as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

const closest = (locale: string): string => TELLABLE.find((tag) => tag === locale) ?? TELLABLE.find((tag) => tag.split('-')[0] === locale.split('-')[0]) ?? 'en-US';

export function PeopleCard({ t }: { t: AddOnTranslate }): ReactNode {
  const locale = useLocaleTag();
  const toast = useToast();
  const access = useAccess();
  const settings = useRecords('settings', { pageSize: 1 });
  const write = useWrite('settings');
  const row: DataRow | null = settings.rows[0] ?? null;
  const mayChange = access.canUpdate('settings') && (row !== null || access.canCreate('settings'));

  const [registers, setRegisters] = useState<readonly string[]>([]);
  const [problems, setProblems] = useState<readonly Problem[]>([]);
  const [named, setNamed] = useState<readonly string[]>([]);
  const [language, setLanguage] = useState(closest(locale));
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const field = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let alive = true;
    sourceRoutes.list().then(
      (reply) => {
        if (alive) setRegisters(reply.sources.filter((one) => one.on && REGISTER_LANGUAGE[one.id] !== undefined).map((one) => one.id));
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, []);

  const stored = useMemo(() => purposeOf(row?.['purpose']), [row]);
  const purpose = draft ?? stored;
  const on = yes(row?.['people_on']);
  const keepYears = Number(row?.['keep_years'] ?? 3);

  /** The languages the sentence is asked for, and why each one is. */
  const languages = useMemo(() => {
    const out = new Map<string, string | null>();
    out.set('en-US', null);
    out.set(closest(locale), null);
    for (const id of registers) if (!out.has(REGISTER_LANGUAGE[id]!)) out.set(REGISTER_LANGUAGE[id]!, id);
    for (const tag of Object.keys(stored)) if (!out.has(tag)) out.set(tag, null);
    for (const tag of named) if (!out.has(tag)) out.set(tag, null);
    return [...out];
  }, [locale, registers, stored, named]);

  const save = async (values: Record<string, unknown>): Promise<boolean> => {
    setSaving(true);
    try {
      if (row === null) await write.create(values as never);
      else await write.update(row['id'] as string | number, values as never);
      settings.refetch();
      return true;
    } catch (caught) {
      const error = asDataError(caught);
      if (isSwitchRefusal(error.details)) {
        const found = problemsOf(error.details, error.message);
        setProblems(found);
        setNamed(found.flatMap((one) => (one.code === 'purpose' ? [one.language] : [])));
      } else if ((error.details as { hook?: unknown } | undefined)?.hook === 'leads.purpose') setFieldError(t('settings.people.noLinks', 'One plain sentence with no links: it goes in the mail.'));
      else toast(doorRefusal(t, error), 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (next: boolean): Promise<void> => {
    if (next) {
      setProblems([]);
      if (await save({ people_on: true, ...(draft === null ? {} : { purpose: draft }) })) toast(t('settings.people.onToast', 'Lead finder keeps people from now on.'));
    } else if (await save({ people_on: false })) toast(t('settings.people.offToast', 'Lead finder keeps companies only from now on.'));
  };

  const savePurpose = async (): Promise<void> => {
    if (draft === null) return;
    setFieldError(null);
    const cleaned = Object.fromEntries(Object.entries(draft).map(([tag, words]) => [tag, words.trim()]).filter(([, words]) => words !== ''));
    if (await save({ purpose: cleaned })) {
      setDraft(null);
      setProblems((was) => was.filter((one) => !(one.code === 'purpose' && cleaned[one.language] !== undefined)));
    }
  };

  if (settings.loading)
    return (
      <div className="flex flex-col gap-3">
        <span role="status" className="sr-only">
          {t('shared.loading', 'Loading')}
        </span>
        <Skeleton height={200} />
      </div>
    );

  const missing = languages.filter(([tag]) => (purpose[tag] ?? '').trim() === '');

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="m-0 text-[18px] font-extrabold tracking-[-0.02em]">{t('settings.people.title', 'People')}</h2>
        <p className="m-0 mt-1 text-[13px] text-fg-muted">{t('settings.people.sub', 'What Lead finder keeps about the people at the companies it finds.')}</p>
      </div>
      <section aria-labelledby="lf-people-switch" className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-sm">
        <div className="flex items-start gap-5 p-5">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
              <h3 id="lf-people-switch" className="m-0 text-[14px] font-bold">
                {t('settings.people.switch', 'Store people, not just companies')}
              </h3>
              {on ? <Pill tone="pos">{t('settings.people.on', 'On')}</Pill> : <Pill tone="neutral">{t('settings.people.off', 'Off')}</Pill>}
            </div>
            <p className="m-0 max-w-[760px] text-[12.5px] leading-normal text-fg-muted">
              {t('settings.people.explain', 'Off: Lead finder keeps limited companies only. Sole traders are people, so it leaves them out. On: it also keeps the people Hunter finds at a company. Each one gets a short mail at once saying where we found their details, with a way to object.')}
            </p>
            {on ? (
              <span className="max-w-[760px]">
                <Note tone="info" icon="mail-x">
                  {t('settings.people.oneToOne', 'People Lead finder finds start at ‘may not be e-mailed’. Write to them one to one, never in a campaign, and only after they agree.')}
                </Note>
              </span>
            ) : null}
          </div>
          <Switch label={<span className="sr-only">{t('settings.people.switch', 'Store people, not just companies')}</span>} checked={on} disabled={!mayChange || saving} onCheckedChange={(next) => void toggle(next)} />
        </div>
        <div role="alert" className="px-5">
          {problems.length > 0 && !on ? (
            <div className="mb-5 flex items-start gap-2.5 rounded-[10px] bg-danger-soft px-4 py-3.5 text-danger">
              <Icon name="circle-alert" />
              <div className="flex min-w-0 flex-col gap-1.5">
                <strong className="text-[13px]">{t('settings.people.cannot', 'Lead finder can’t keep people yet:')}</strong>
                <ul className="m-0 flex flex-col gap-1 ps-4 text-[12.5px]">
                  {problems.map((problem, at) => (
                    <li key={String(at)}>
                      <ProblemLine
                        t={t}
                        locale={locale}
                        problem={problem}
                        onPurpose={(tag) => {
                          setLanguage(tag);
                          setTimeout(() => field.current?.focus(), 0);
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-5 border-t border-border p-5">
          <div className="flex max-w-[760px] flex-col gap-2">
            <label htmlFor="lf-why" className="text-[12.5px] font-bold text-fg-muted">
              {t('settings.people.why', 'Why you keep them')}
            </label>
            <div role="group" aria-label={t('settings.people.whyLanguage', 'Language of the sentence')} className="flex flex-wrap gap-1.5">
              {languages.map(([tag]) => {
                const written = (purpose[tag] ?? '').trim() !== '';
                return (
                  <ToggleChip key={tag} pressed={language === tag} onPressedChange={() => setLanguage(tag)} aria-label={written ? t('settings.people.written', '{language}, written', { language: languageName(tag) }) : t('settings.people.unwritten', '{language}, not written yet', { language: languageName(tag) })}>
                    <span className="inline-flex items-center gap-1.5">
                      {written ? <SmallIcon name="check" /> : <SmallIcon name="triangle-alert" />}
                      {languageName(tag)}
                    </span>
                  </ToggleChip>
                );
              })}
            </div>
            <input
              id="lf-why"
              ref={field}
              lang={language}
              dir={isRightToLeft(language) ? 'rtl' : 'ltr'}
              value={purpose[language] ?? ''}
              disabled={!mayChange}
              onChange={(event) => setDraft({ ...purpose, [language]: event.target.value })}
              onBlur={() => void savePurpose()}
              aria-describedby="lf-why-hint"
              className="h-11 min-w-0 rounded-[10px] border border-border-strong bg-surface px-3 text-[13px] text-fg"
            />
            <span id="lf-why-hint" className="text-[12px] text-fg-muted">
              {t('settings.people.whyHint', 'One plain sentence. It goes in the mail. No links.')}
            </span>
            {fieldError === null ? null : (
              <span role="alert" className="text-[12px] font-semibold text-danger">
                {fieldError}
              </span>
            )}
            {missing.map(([tag, register]) => (
              <span key={tag} className="flex items-center gap-1.5 text-[12px] font-semibold text-warn">
                <SmallIcon name="triangle-alert" />
                {register === 'france'
                  ? t('settings.people.missingFrance', '{language}: Not written yet. You search the Register of France.', { language: languageName(tag) })
                  : t('settings.people.missing', '{language}: Not written yet.', { language: languageName(tag) })}
              </span>
            ))}
          </div>
          <div className="flex max-w-[760px] flex-col gap-2">
            <span className="w-[200px]">
              <Select
                label={t('settings.people.keep', 'Keep found people for')}
                value={String(keepYears)}
                disabled={!mayChange}
                onChange={(event) => void save({ keep_years: Number(event.target.value) })}
                options={[1, 2, 3].map((years) => ({ value: String(years), label: t('settings.people.years', '{count, plural, one {# year} other {# years}}', { count: years }) }))}
              />
            </span>
            <span className="text-[12px] text-fg-muted">{t('settings.people.keepHint', 'From when they were found, or from the last time they wrote to you. Then Lead finder deletes them.')}</span>
          </div>
          <Link to={mailAt()}>
            <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold">
              <Icon name="mail" />
              {t('settings.people.seeMail', 'See the mail it sends')}
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}

function ProblemLine({ t, locale, problem, onPurpose }: { t: AddOnTranslate; locale: string; problem: Problem; onPurpose: (tag: string) => void }): ReactNode {
  switch (problem.code) {
    case 'purpose':
      return (
        <a
          href="#lf-why"
          onClick={(event) => {
            event.preventDefault();
            onPurpose(problem.language);
          }}
          className="font-bold text-danger underline"
        >
          {t('settings.problem.purpose', 'Write the {language} version of why you keep them.', { language: languageIn(problem.language, locale) })}
        </a>
      );
    case 'keep-years':
      return <span className="font-bold">{t('settings.problem.keep', 'Choose how long found people are kept.')}</span>;
    case 'mail-server':
      return (
        <Link to={EMAIL_SETTINGS}>
          <span className="font-bold text-danger underline">{t('settings.problem.mail', 'E-mail isn’t set up: Settings → Email.')}</span>
        </Link>
      );
    case 'public-origin':
      return (
        <Link to={EMAIL_SETTINGS}>
          <span className="font-bold text-danger underline">{t('settings.problem.origin', 'Set the “Address in email links”: Settings → Senders.')}</span>
        </Link>
      );
    case 'mail-door':
      return <span className="font-bold">{t('settings.problem.door', 'The page a person objects on can’t be reached from outside: check this server’s public address.')}</span>;
    case 'privacy-notice':
      return (
        <Link to={PRIVACY}>
          <span className="font-bold text-danger underline">{t('settings.problem.notice', 'Set the business name and the address of the privacy notice: Server settings → Privacy & public pages.')}</span>
        </Link>
      );
    case 'tell-mail':
      return <span className="font-bold">{t('settings.problem.tellMail', 'This version of Lead finder has no mail to tell a person where their details came from.')}</span>;
    case 'tables':
      return <span className="font-bold">{t('settings.problem.tables', 'The tables Lead finder keeps found people in are not here.')}</span>;
    case 'other':
      return <span className="font-bold">{problem.words}</span>;
  }
}
