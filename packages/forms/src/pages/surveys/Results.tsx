/**
 * A SURVEY'S RESULTS (comp 579-630).
 *
 * Every figure is Adminium's count over every answer, in every language
 * together (`useFormSummary`): this screen never reads answers to count
 * them. It reads answers only for the words people wrote, newest first, a
 * page at a time.
 *
 * What a survey shows of who answered follows its settings: a named survey
 * that links answers to names shows the company of each written answer; one
 * that does not, and an open-link survey, shows no name and no company.
 *
 * `?answer=<id>` (the link in a low-score bell and mail) opens on that
 * answer's words, marked, wherever in the pages they are.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { Alert, Button, Card, EmptyState, Grid, Pagination, Skeleton, Stack, Tag, useFormSummary, useLocaleTag, useRecord, useRecords, type AddOnTranslate, type DataRow, type FormSummaryAnswer } from '../shared/host.ts';
import { languageName } from '../shared/languages.ts';
import { refusal } from '../shared/refusal.ts';
import { codeOf, glanceOf, jsonOf, type FormRow } from '../shared/row.ts';
import type { TabProps } from '../shared/slot.ts';
import { AnsweredBar, CountRow, Figures, FiveStars, Head, Icon, Spread, ThreePart } from './parts.tsx';
import { keepsNamesOf, questionsOf, surveyOf, wordsIn, type QuestionGlance } from './survey.ts';

/** How many answers a page of written answers reads. */
export const TEXTS_PAGE = 10;

type Counted = FormSummaryAnswer['questions'][string];
type CountedOf<K extends string> = Extract<Counted, { kind: K }>;

/** What the answers were given to: the published survey, or the draft while there is none. */
export function shownOf(form: FormRow): { definition: unknown; settings: unknown } {
  const published = form.published;
  if (typeof published === 'object' && published !== null && 'definition' in published) {
    const held = published as { definition?: unknown; settings?: unknown };
    return { definition: held.definition, settings: held.settings ?? form.settings };
  }
  return { definition: form.definition, settings: form.settings };
}

const sum = (counts: readonly number[], from: number, to: number): number => counts.slice(from, to + 1).reduce((all, n) => all + n, 0);
const signed = (score: number): string => (score > 0 ? `+${String(score)}` : String(score));
/** A day as the comp writes one, "22 Jul 2026", in the reader's language. */
export const dateOf = (value: unknown, locale: string): string => {
  const at = typeof value === 'string' && value !== '' ? new Date(value) : null;
  return at === null || Number.isNaN(at.getTime()) ? '' : new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(at);
};

/** "23 answers from 41 invited (56%)", the bar, and the languages counted together (comp 580-586). */
function Summary({ t, summary, anonymous, languages }: { t: AddOnTranslate; summary: FormSummaryAnswer; anonymous: boolean; languages: readonly string[] }): ReactNode {
  const invited = summary.invited ?? 0;
  const answered = summary.answered ?? summary.total;
  const byInvitation = !anonymous && invited > 0;
  const pct = byInvitation ? Math.round((answered * 100) / invited) : 0;
  const spoken = [...languages, ...Object.keys(summary.byLanguage).filter((tag) => !languages.includes(tag))]
    .map((tag) => [tag, (summary.byLanguage as Readonly<Record<string, number>>)[tag] ?? 0] as const)
    .filter(([, n]) => n > 0)
    .map(([tag, n]) => `${languageName(tag)} ${String(n)}`);
  return (
    <Card>
      <span className="flex flex-wrap items-center gap-4" data-part="results-summary">
        <span className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="text-[14.5px] font-bold text-fg">
            <Figures
              text={
                byInvitation
                  ? t('surveys.results.fromInvited', '{answered, plural, one {# answer} other {# answers}} from {invited} invited ({pct}%)', { answered, invited, pct })
                  : t('surveys.results.total', '{n, plural, one {# answer} other {# answers}}', { n: summary.total })
              }
            />
          </span>
          {byInvitation ? <AnsweredBar answered={answered} invited={invited} label={t('surveys.results.answeredBar', '{pct}% answered', { pct })} /> : null}
        </span>
        {spoken.length === 0 ? null : (
          <Tag tone="info">
            <span className="inline-flex items-center gap-2">
              <Icon name="languages" />
              <Figures text={t('surveys.results.languages', 'Results from all languages together ({list})', { list: spoken.join(', ') })} />
            </span>
          </Tag>
        )}
      </span>
    </Card>
  );
}

/** A Score 0–10: the recommend score and how it splits, and the eleven bars (comp 587-607). */
function ScoreCard({ t, question, counted, title }: { t: AddOnTranslate; question: QuestionGlance; counted: CountedOf<'score'>; title: string }): ReactNode {
  const id = useId();
  const counts = counted.counts;
  const would = sum(counts, 9, 10);
  const neutral = sum(counts, 7, 8);
  const wouldnt = sum(counts, 0, 6);
  const spread = t('surveys.results.spread', 'Spread of scores from 0 to 10: {list}', { list: counts.map((n, score) => `${String(score)}: ${String(n)}`).join(', ') });
  return (
    <section aria-labelledby={id} data-part="score-card" data-question={question.id}>
      <Card>
        <Stack gap="md">
          <Head kind={t('surveys.results.kind.score', 'Score 0–10')} title={title} id={id} />
          {counted.answered === 0 ? (
            <span className="text-body-sm text-fg-subtle">{t('surveys.results.noScores', 'No scores yet.')}</span>
          ) : (
            <span className="grid items-end gap-6 md:grid-cols-2">
              {question.recommend ? (
                <span className="flex flex-col gap-3">
                  <span className="text-body-sm font-bold text-fg-muted">{t('surveys.results.recommend', 'Recommend score')}</span>
                  <span dir="ltr" className="text-start font-mono text-[38px] font-bold leading-none text-fg" data-part="recommend-score">
                    {counted.recommendScore === null ? '' : signed(counted.recommendScore)}
                  </span>
                  <ThreePart would={would} neutral={neutral} wouldnt={wouldnt} label={t('surveys.results.splitLabel', "Would recommend {would}, neutral {neutral}, wouldn't {wouldnt}", { would, neutral, wouldnt })} />
                  <span className="text-body text-fg" data-part="split">
                    <Figures text={t('surveys.results.split', "Would recommend {would} · Neutral {neutral} · Wouldn't {wouldnt}", { would, neutral, wouldnt })} />
                  </span>
                  <span className="text-caption text-fg-subtle">{t('surveys.results.definition', "The share who would recommend (9–10) minus the share who wouldn't (0–6).")}</span>
                </span>
              ) : null}
              <span className="flex flex-col gap-2">
                <Spread counts={counts} label={spread} />
                <span className="text-caption text-fg-subtle">{t('surveys.results.bands', "0–6 wouldn't · 7–8 neutral · 9–10 would recommend")}</span>
              </span>
            </span>
          )}
        </Stack>
      </Card>
    </section>
  );
}

/** Stars: the average of five, and how many gave each, five stars first (comp 609-617). */
function StarsCard({ t, question, counted, title }: { t: AddOnTranslate; question: QuestionGlance; counted: CountedOf<'stars'>; title: string }): ReactNode {
  const id = useId();
  return (
    <section aria-labelledby={id} data-part="stars-card" data-question={question.id}>
      <Card>
        <Stack gap="md">
          <Head kind={t('surveys.results.kind.stars', 'Stars')} title={title} id={id} />
          {counted.average === null ? (
            <span className="text-body-sm text-fg-subtle">{t('surveys.results.noStars', 'No stars given yet.')}</span>
          ) : (
            <>
              <span className="flex items-center gap-3">
                <span className="text-[20px] font-extrabold text-fg" data-part="stars-average">
                  <Figures text={t('surveys.results.ofFive', '{average} of 5', { average: counted.average.toFixed(1) })} />
                </span>
                <FiveStars average={counted.average} />
              </span>
              <span className="flex flex-col gap-2">
                {[5, 4, 3, 2, 1].map((stars) => (
                  <CountRow
                    key={String(stars)}
                    mono
                    tone="warn"
                    n={counted.counts[stars - 1] ?? 0}
                    of={counted.answered}
                    label={
                      <>
                        <span>{String(stars)}</span>
                        <span className="sr-only">{t('surveys.results.stars', '{n, plural, one {# star} other {# stars}}', { n: stars })}</span>
                        <Icon name="star" />
                      </>
                    }
                  />
                ))}
              </span>
            </>
          )}
        </Stack>
      </Card>
    </section>
  );
}

/** One choice or several: a row a choice, in the stars card's pattern (the comp draws none). */
function ChoicesCard({ t, question, counted, title, locale, fallback }: { t: AddOnTranslate; question: QuestionGlance; counted: CountedOf<'one' | 'several'>; title: string; locale: string; fallback: string | null }): ReactNode {
  const id = useId();
  return (
    <section aria-labelledby={id} data-part="choices-card" data-question={question.id}>
      <Card>
        <Stack gap="md">
          <Head kind={question.kind === 'one' ? t('surveys.results.kind.one', 'One choice') : t('surveys.results.kind.several', 'Several choices')} title={title} id={id} />
          <span className="flex flex-col gap-2">
            {question.choices.map((choice) => (
              <CountRow key={choice.id} tone="accent" n={counted.choices[choice.id] ?? 0} of={counted.answered} label={wordsIn(choice.label, locale, fallback)} />
            ))}
          </span>
        </Stack>
      </Card>
    </section>
  );
}

interface Written {
  id: string;
  text: string;
  language: string;
  at: string;
  invitation: string | null;
}

function writtenOf(row: DataRow, question: string): Written | null {
  const values = jsonOf(row['values']);
  const text = typeof values === 'object' && values !== null ? (values as Record<string, unknown>)[question] : undefined;
  if (typeof text !== 'string' || text.trim() === '') return null;
  const invitation = row['invitation_id'];
  return { id: String(row['id']), text, language: typeof row['language'] === 'string' ? row['language'] : '', at: typeof row['submitted_at'] === 'string' ? row['submitted_at'] : '', invitation: invitation === null || invitation === undefined || invitation === '' ? null : String(invitation) };
}

/** One answer's words, with the company it came from (when names are kept), its date and its language. */
function WrittenAnswer({ written, company, locale, marked, t }: { written: Written; company: string | null; locale: string; marked: boolean; t: AddOnTranslate }): ReactNode {
  const at = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (marked) at.current?.scrollIntoView?.({ block: 'center' });
  }, [marked]);
  const body = (
    <>
      <p lang={written.language === '' ? undefined : written.language} className="m-0 text-body text-fg">
        {written.text}
      </p>
      <span className="flex flex-wrap items-center gap-2 text-caption text-fg-subtle">
        {company === null ? null : <span className="font-bold text-fg-muted">{company}</span>}
        <span className="font-mono">{dateOf(written.at, locale)}</span>
        {written.language === '' ? null : <span className="rounded-md bg-surface-3 px-1 font-mono">{codeOf(written.language)}</span>}
        {marked ? <Tag tone="accent">{t('surveys.results.opened', 'Opened from the link')}</Tag> : null}
      </span>
    </>
  );
  return marked ? (
    <div ref={at} aria-current="true" data-answer={written.id} data-marked="" className="flex flex-col gap-1 rounded-lg bg-accent-soft p-2">
      {body}
    </div>
  ) : (
    <div data-answer={written.id} className="flex flex-col gap-1 border-t border-border py-3">
      {body}
    </div>
  );
}

const ANSWER_COLUMNS = ['id', 'submitted_at', 'language', 'values'];

/** Long text: what people wrote, newest first, a page at a time (comp 618-628). */
function TextsCard(props: { t: AddOnTranslate; form: FormRow; question: QuestionGlance; title: string; total: number; keeps: boolean; locale: string; marked: DataRow | null }): ReactNode {
  const { t, form, question, title, total, keeps, locale, marked } = props;
  const id = useId();
  const [page, setPage] = useState(1);
  const read = useRecords('answers', {
    filter: [{ column: 'form_id', op: 'eq', value: form.id }],
    sort: [{ column: 'submitted_at', direction: 'desc' }],
    page,
    pageSize: TEXTS_PAGE,
    columns: keeps ? [...ANSWER_COLUMNS, 'invitation_id'] : ANSWER_COLUMNS,
  });
  const markedWritten = marked === null ? null : writtenOf(marked, question.id);
  const shown = read.rows.map((row) => writtenOf(row, question.id)).filter((one): one is Written => one !== null);
  const list = markedWritten === null || shown.some((one) => one.id === markedWritten.id) ? shown : [markedWritten, ...shown];
  const invitations = keeps ? [...new Set(list.map((one) => one.invitation).filter((one): one is string => one !== null))] : [];
  const companies = useRecords('invitations', { filter: [{ column: 'id', op: 'in', value: invitations }], columns: ['id', 'company'], pageSize: TEXTS_PAGE + 1, enabled: invitations.length > 0 });
  const companyOf = (written: Written): string | null => {
    if (!keeps || written.invitation === null || companies.error !== null) return null;
    const found = companies.rows.find((row) => String(row['id']) === written.invitation)?.['company'];
    return typeof found === 'string' && found !== '' ? found : null;
  };
  const pages = Math.max(1, Math.ceil(total / TEXTS_PAGE));
  return (
    <section aria-labelledby={id} data-part="texts-card" data-question={question.id}>
      <Card>
        <Stack gap="sm">
          <Head kind={t('surveys.results.kind.long', 'Long text · newest first')} title={title} id={id} />
          {read.error !== null ? (
            <Alert tone="danger" title={t('surveys.results.textsFailed', 'The written answers could not be loaded')} body={refusal(t, read.error).message} action={<Button variant="secondary" size="sm" onClick={() => read.refetch()}>{t('shared.retry', 'Try again')}</Button>} />
          ) : read.loading ? (
            <Skeleton height={64} />
          ) : list.length === 0 ? (
            <span className="text-body-sm text-fg-subtle">{t('surveys.results.noTexts', 'No written answers on this page.')}</span>
          ) : (
            <span className="flex flex-col">
              {list.map((written) => (
                <WrittenAnswer key={written.id} t={t} written={written} company={companyOf(written)} locale={locale} marked={written.id === markedWritten?.id} />
              ))}
            </span>
          )}
          {pages > 1 ? (
            <Pagination
              page={page}
              pageCount={pages}
              onPageChange={setPage}
              label={t('surveys.results.pages', 'Pages of written answers')}
              previousLabel={t('surveys.results.newer', 'Newer')}
              nextLabel={t('surveys.results.older', 'Older')}
              pageLabel={(n) => t('surveys.results.page', 'Page {n}', { n })}
            />
          ) : null}
        </Stack>
      </Card>
    </section>
  );
}

export function Results({ t, form, answer }: TabProps): ReactNode {
  const locale = useLocaleTag();
  const live = form.state !== 'draft';
  const { summary, loading, error, refetch } = useFormSummary(live ? form.id : null);
  const marked = useRecord('answers', live ? answer : null);
  const shown = shownOf(form);
  const anonymous = surveyOf(shown.settings).mode === 'anonymous';
  const keeps = keepsNamesOf(shown.settings);
  const glance = glanceOf(shown.definition);
  const questions = questionsOf(shown.definition);

  if (!live) return <EmptyState title={t('surveys.results.draft.title', 'Nothing counted yet')} body={t('surveys.results.draft.body', 'Results are counted once the survey is published and people answer it.')} />;
  if (error !== null) {
    const limited = (error.details as { reason?: unknown } | undefined)?.reason === 'row-limit';
    return (
      <Alert
        tone={limited ? 'info' : 'danger'}
        role="alert"
        title={limited ? t('surveys.results.limited.title', 'Results are not counted for you') : t('shared.failed.title', 'This could not be loaded')}
        body={limited ? t('surveys.results.limited.body', 'You may read only some of the answers to this survey, so its results are not counted here.') : refusal(t, error).message}
        {...(limited ? {} : { action: <Button variant="secondary" size="sm" onClick={() => refetch()}>{t('shared.retry', 'Try again')}</Button> })}
      />
    );
  }
  if (loading || summary === null) {
    return (
      <Stack gap="sm">
        <span role="status" className="sr-only">
          {t('shared.loading', 'Loading')}
        </span>
        <Skeleton height={72} />
        <Skeleton height={220} />
      </Stack>
    );
  }

  const markedRow = marked.row !== null && String(marked.row['form_id']) === form.id ? marked.row : null;
  const longs = questions.filter((question) => question.kind === 'long');
  const markedSaysNothing = markedRow !== null && longs.every((question) => writtenOf(markedRow, question.id) === null);
  const titleOf = (question: QuestionGlance): string => wordsIn(question.label, locale, glance.defaultLanguage);
  const cards = questions.flatMap((question) => {
    const counted = summary.questions[question.id];
    if (counted === undefined) return [];
    if (counted.kind === 'score') return [{ wide: true, node: <ScoreCard key={question.id} t={t} question={question} counted={counted} title={titleOf(question)} /> }];
    if (counted.kind === 'stars') return [{ wide: false, node: <StarsCard key={question.id} t={t} question={question} counted={counted} title={titleOf(question)} /> }];
    if (counted.kind === 'one' || counted.kind === 'several') return [{ wide: false, node: <ChoicesCard key={question.id} t={t} question={question} counted={counted} title={titleOf(question)} locale={locale} fallback={glance.defaultLanguage} /> }];
    if (counted.kind === 'long') return [{ wide: false, node: <TextsCard key={question.id} t={t} form={form} question={question} title={titleOf(question)} total={summary.total} keeps={keeps} locale={locale} marked={markedRow} /> }];
    return [];
  });

  return (
    <Stack gap="md">
      <Summary t={t} summary={summary} anonymous={anonymous} languages={glance.languages} />
      {markedSaysNothing ? <Alert tone="info" title={t('surveys.results.openedNoWords', 'The answer this link opened left no written words. Its scores are counted below.')} /> : null}
      {summary.total === 0 ? (
        <EmptyState
          title={t('surveys.results.empty.title', 'No answers yet')}
          body={anonymous ? t('surveys.results.empty.open', 'Answers are counted here once people open the survey’s link and answer it.') : t('surveys.results.empty.named', 'Answers are counted here once a rule sends the survey and people answer it.')}
        />
      ) : (
        <>
          {cards.filter((card) => card.wide).map((card) => card.node)}
          {cards.some((card) => !card.wide) ? <Grid columns={2}>{cards.filter((card) => !card.wide).map((card) => card.node)}</Grid> : null}
        </>
      )}
    </Stack>
  );
}
