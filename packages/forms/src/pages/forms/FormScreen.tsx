/**
 * ONE FORM OR SURVEY: the header every one of its screens shares, its tabs,
 * and the tab the address names.
 *
 * The header is the dashboard's own top bar: the form's name as the page's
 * title, the way back to the list, the status beside the name and the
 * builder's buttons at the end. Under it the tabs — "Questions", "Share",
 * "Answers" for a form; "Questions", "Share", "Results", "Invitations" for a
 * survey — each a link to its own address, so a staff link opens straight
 * on its tab.
 */
import type { ReactNode } from 'react';

import { Answers } from '../answers/Answers.tsx';
import { HeaderActions } from '../builder/HeaderActions.tsx';
import { Questions } from '../builder/Questions.tsx';
import { EmptyState, Link, Stack, Tabs, TabsContent, TabsList, TabsTrigger, useAccess, useFormSummary, useLocaleTag, useNavigate, useRecords, type AddOnTranslate } from '../shared/host.ts';
import { PageFrame } from '../shared/PageFrame.tsx';
import { formAt, listAt, type FormTab, type Kind, type SurveyTab } from '../shared/paths.ts';
import { formRowOf, glanceOf, titleOf } from '../shared/row.ts';
import type { TabProps } from '../shared/slot.ts';
import { StatePill } from '../shared/StatePill.tsx';
import { Share } from '../share/Share.tsx';
import { Invitations } from '../surveys/Invitations.tsx';
import { Results } from '../surveys/Results.tsx';

export interface FormScreenProps {
  t: AddOnTranslate;
  kind: Kind;
  slug: string;
  tab: FormTab | SurveyTab;
  answer: string | null;
  settings: string | null;
}

function Count({ n }: { n: number | null }): ReactNode {
  return n === null ? null : <span className="font-mono text-caption text-fg-subtle">{String(n)}</span>;
}

function TabLabel({ label, n }: { label: string; n: number | null }): ReactNode {
  return (
    <span className="inline-flex items-center gap-2">
      {label}
      <Count n={n} />
    </span>
  );
}

/** A form that is not there: the house's "not found", with the way back. */
export function NotFound({ t, kind }: { t: AddOnTranslate; kind: Kind }): ReactNode {
  return (
    <PageFrame t={t} title={t('list.title', 'Forms')} backTo={listAt(kind)} testId="forms-missing">
      <EmptyState
        title={kind === 'survey' ? t('shared.missing.survey', 'This survey is not here') : t('shared.missing.form', 'This form is not here')}
        body={t('shared.missing.body', 'It may have been deleted, or the link is not quite right.')}
        actions={<Link to={listAt(kind)}>{kind === 'survey' ? t('shared.missing.backSurveys', 'Back to surveys') : t('shared.missing.backForms', 'Back to forms')}</Link>}
      />
    </PageFrame>
  );
}

export function FormScreen({ t, kind, slug, tab, answer, settings }: FormScreenProps): ReactNode {
  const access = useAccess();
  const locale = useLocaleTag();
  const navigate = useNavigate();
  const read = useRecords('forms', { filter: [{ column: 'slug', op: 'eq', value: slug }], pageSize: 1, enabled: access.ready && access.canRead('forms') });
  const row = read.rows[0];
  const form = row === undefined ? null : formRowOf(row);
  // A draft has never taken an answer: nothing is counted for it.
  const { summary } = useFormSummary(form !== null && form.state !== 'draft' ? form.id : null);

  if (access.ready && access.canRead('forms') && !read.loading && read.error === null && form === null) return <NotFound t={t} kind={kind} />;
  if (form === null) {
    return <PageFrame t={t} title={t('list.title', 'Forms')} backTo={listAt(kind)} loading={!access.ready || read.loading} refused={access.ready && !access.canRead('forms')} error={read.error} onRetry={read.refetch} testId="forms-form" />;
  }

  // A link that names a form as a survey, or the other way round, opens the row as what it is.
  const as = form.kind;
  const tabs: readonly { value: FormTab | SurveyTab; label: string; n: number | null }[] =
    as === 'survey'
      ? [
          { value: 'questions', label: t('shared.tab.questions', 'Questions'), n: glanceOf(form.definition).questions },
          { value: 'share', label: t('shared.tab.share', 'Share'), n: null },
          { value: 'results', label: t('shared.tab.results', 'Results'), n: form.state === 'draft' ? 0 : (summary?.total ?? null) },
          { value: 'invitations', label: t('shared.tab.invitations', 'Invitations'), n: form.state === 'draft' ? 0 : (summary?.invited ?? null) },
        ]
      : [
          { value: 'questions', label: t('shared.tab.questions', 'Questions'), n: glanceOf(form.definition).questions },
          { value: 'share', label: t('shared.tab.share', 'Share'), n: null },
          { value: 'answers', label: t('shared.tab.answers', 'Answers'), n: form.state === 'draft' ? 0 : (summary?.total ?? null) },
        ];
  const open = tabs.find((one) => one.value === tab)?.value ?? 'questions';
  const props: TabProps = { t, form, refetch: read.refetch, summary, answer, settings };
  const body: Record<string, () => ReactNode> = {
    questions: () => <Questions {...props} />,
    share: () => <Share {...props} />,
    answers: () => <Answers {...props} />,
    results: () => <Results {...props} />,
    invitations: () => <Invitations {...props} />,
  };

  return (
    <PageFrame t={t} title={titleOf(form, locale)} backTo={listAt(as)} adornment={<StatePill t={t} state={form.state} />} actions={<HeaderActions {...props} />} testId="forms-form">
      <Stack gap="lg">
        <Tabs value={open} onValueChange={(value) => void navigate({ to: formAt(as, form.slug, tabs.find((one) => one.value === value)?.value ?? 'questions') })} variant="underline">
          <TabsList aria-label={as === 'survey' ? t('shared.tabs.survey', 'Parts of the survey') : t('shared.tabs.form', 'Parts of the form')}>
            {tabs.map((one) => (
              <TabsTrigger key={one.value} value={one.value}>
                <TabLabel label={one.label} n={one.n} />
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={open}>{body[open]?.()}</TabsContent>
        </Tabs>
      </Stack>
    </PageFrame>
  );
}
