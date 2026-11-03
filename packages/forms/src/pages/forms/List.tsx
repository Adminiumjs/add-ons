/**
 * THE LIST: every form and every survey, as cards or as a list.
 *
 * One read of the forms table names them all. Each card then asks Adminium
 * for its own counted results, one request a card and none for a draft, which
 * has never taken an answer: a count is always counted, never stored.
 */
import { useState, type ReactNode } from 'react';

import { Button, Card, DataTable, Dialog, DialogBody, DialogFooter, DialogHeader, Divider, EmptyState, Grid, Link, SegmentedControl, Stack, Tabs, TabsContent, TabsList, TabsTrigger, Tag, asDataError, formatSince, lucideByName, useAccess, useFormSummary, useLocaleTag, useNavigate, useRecords, useWrite, type AddOnTranslate, type TableColumn } from '../shared/host.ts';
import { PageFrame, useSaid } from '../shared/PageFrame.tsx';
import { formAt, listAt, type Kind } from '../shared/paths.ts';
import { refusal } from '../shared/refusal.ts';
import { codeOf, epochOf, formRowOf, glanceOf, isAnonymous, titleOf, type FormRow } from '../shared/row.ts';
import { StatePill } from '../shared/StatePill.tsx';
import { useToast } from '../shared/toast.ts';
import { draftValues, newSlug } from './newForm.ts';

/** What the list reads of each form: never the published copy. */
const COLUMNS = ['id', 'name', 'slug', 'kind', 'state', 'definition', 'settings', 'updated_at', 'closed_at'];
/** The most forms one read names; the most recently changed first. */
export const LIST_MAX = 199;

const Icon = ({ name }: { name: string }): ReactNode => {
  const Found = lucideByName(name);
  return <Found className="size-4" />;
};

/** How many answers a form has: counted by Adminium, and nothing asked for a draft. */
function useCount(form: FormRow): { answers: number | null; invited: number | null; score: number | null } {
  const counted = form.state !== 'draft';
  const { summary } = useFormSummary(counted ? form.id : null);
  if (!counted) return { answers: 0, invited: null, score: null };
  return { answers: summary?.total ?? null, invited: summary?.invited ?? null, score: summary?.recommendScore ?? null };
}

const signed = (score: number): string => (score > 0 ? `+${String(score)}` : String(score));

function Languages({ form }: { form: FormRow }): ReactNode {
  return (
    <span className="flex flex-wrap gap-1.5">
      {glanceOf(form.definition).languages.map((tag) => (
        <Tag key={tag}>
          <span className="font-mono" lang={tag}>
            {codeOf(tag)}
          </span>
        </Tag>
      ))}
    </span>
  );
}

function Updated({ t, form }: { t: AddOnTranslate; form: FormRow }): ReactNode {
  const locale = useLocaleTag();
  const since = formatSince(epochOf(form.updatedAt), locale, Date.now());
  return since === null ? null : <span className="text-caption text-fg-subtle">{t('list.updated', 'Updated {since}', { since })}</span>;
}

function AnswerCount({ form }: { form: FormRow }): ReactNode {
  const { answers } = useCount(form);
  return <span className="font-mono">{answers === null ? '…' : String(answers)}</span>;
}

/** The line under a survey's count: who was invited and how they score it, or when it closed. */
function SurveyLine({ t, form }: { t: AddOnTranslate; form: FormRow }): ReactNode {
  const locale = useLocaleTag();
  const { invited, score } = useCount(form);
  if (form.state === 'closed') {
    const at = epochOf(form.closedAt);
    if (at === null) return null;
    const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(at);
    return <span className="text-body-sm text-fg-muted">{t('list.closedOn', 'Closed {date}', { date })}</span>;
  }
  const parts: string[] = [];
  if (!isAnonymous(form.settings) && invited !== null && invited > 0) parts.push(t('list.invited', '{count} invited', { count: invited }));
  if (score !== null) parts.push(t('list.score', 'recommend score {score}', { score: signed(score) }));
  return parts.length === 0 ? null : <span className="text-body-sm text-fg-muted">{parts.join(' · ')}</span>;
}

function DeleteDraft({ t, form, onAsk }: { t: AddOnTranslate; form: FormRow; onAsk: (form: FormRow) => void }): ReactNode {
  return (
    <Button variant="ghost" size="sm" iconLeft={<Icon name="trash-2" />} onClick={() => onAsk(form)}>
      {t('list.deleteDraft', 'Delete draft')}
    </Button>
  );
}

function FormCard({ t, form, mayDelete, onDelete }: { t: AddOnTranslate; form: FormRow; mayDelete: boolean; onDelete: (form: FormRow) => void }): ReactNode {
  const locale = useLocaleTag();
  const { answers } = useCount(form);
  return (
    <Card padded>
      <Stack gap="md">
              <Stack direction="row" align="center" justify="between">
                <span className="inline-flex size-9 items-center justify-center rounded-lg bg-accent-soft text-accent" aria-hidden="true">
                  <Icon name={form.kind === 'survey' ? 'message-square-text' : 'clipboard-list'} />
                </span>
                <StatePill t={t} state={form.state} />
        </Stack>
        <Stack gap="xs">
          <span className="font-bold text-fg">
            <Link to={formAt(form.kind, form.slug)}>
              <bdi>{titleOf(form, locale)}</bdi>
            </Link>
          </span>
          <span className="text-body-sm text-fg-muted">
            {answers === null ? '…' : t('list.answers', '{count, plural, one {# answer} other {# answers}}', { count: answers })}
          </span>
          {form.kind === 'survey' ? <SurveyLine t={t} form={form} /> : null}
        </Stack>
        <Divider />
        <Stack direction="row" align="center" justify="between" wrap>
          <Languages form={form} />
          <Updated t={t} form={form} />
        </Stack>
        {mayDelete && form.state === 'draft' ? <DeleteDraft t={t} form={form} onAsk={onDelete} /> : null}
      </Stack>
    </Card>
  );
}

export function List({ t, kind }: { t: AddOnTranslate; kind: Kind }): ReactNode {
  const navigate = useNavigate();
  const access = useAccess();
  const locale = useLocaleTag();
  const toast = useToast();
  const [said, say] = useSaid();
  const read = useRecords('forms', { sort: [{ column: 'updated_at', direction: 'desc' }], pageSize: LIST_MAX, columns: COLUMNS, enabled: access.ready && access.canRead('forms') });
  const write = useWrite('forms');
  const [view, setView] = useState<'cards' | 'list'>('cards');
  const [making, setMaking] = useState(false);
  const [asked, setAsked] = useState<FormRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const all = read.rows.map(formRowOf);
  const shown = all.filter((form) => form.kind === kind);
  const counts = { form: all.filter((form) => form.kind === 'form').length, survey: all.filter((form) => form.kind === 'survey').length };
  const mayMake = access.canCreate('forms');

  const make = async (): Promise<void> => {
    setMaking(true);
    try {
      // A random name that is taken already is tried once more with another.
      for (let attempt = 0; ; attempt += 1) {
        const slug = newSlug(kind);
        try {
          await write.create(draftValues(t, kind, locale, slug));
          await navigate({ to: formAt(kind, slug) });
          return;
        } catch (caught) {
          if (asDataError(caught).code !== 'UNIQUE_VIOLATION' || attempt > 0) throw caught;
        }
      }
    } catch (caught) {
      toast(refusal(t, asDataError(caught)).message, 'error');
    } finally {
      setMaking(false);
    }
  };

  const remove = async (form: FormRow): Promise<void> => {
    setDeleting(true);
    try {
      await write.remove(form.id);
      setAsked(null);
      read.refetch();
      const words = t('list.deleted', 'Draft deleted.');
      toast(words);
      say(words);
    } catch (caught) {
      toast(refusal(t, asDataError(caught)).message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const newLabel = kind === 'survey' ? t('list.newSurvey', 'New survey') : t('list.newForm', 'New form');
  const newButton = mayMake ? (
    <Button variant="primary" iconLeft={<Icon name="plus" />} loading={making} onClick={() => void make()}>
      {newLabel}
    </Button>
  ) : null;

  const columns: TableColumn[] = [
    {
      key: 'name',
      label: t('list.column.name', 'Name'),
      render: (row) => {
        const form = formRowOf(row);
        return (
          <span className="inline-flex items-center gap-2">
            <span className="text-accent" aria-hidden="true">
              <Icon name={form.kind === 'survey' ? 'message-square-text' : 'clipboard-list'} />
            </span>
            <span className="font-bold">
              <Link to={formAt(form.kind, form.slug)}>
                <bdi>{titleOf(form, locale)}</bdi>
              </Link>
            </span>
          </span>
        );
      },
    },
    { key: 'state', label: t('list.column.status', 'Status'), render: (row) => <StatePill t={t} state={formRowOf(row).state} /> },
    { key: 'answers', label: t('list.column.answers', 'Answers'), render: (row) => <AnswerCount form={formRowOf(row)} /> },
    { key: 'languages', label: t('list.column.languages', 'Languages'), render: (row) => <Languages form={formRowOf(row)} /> },
    { key: 'updated_at', label: t('list.column.updated', 'Updated'), render: (row) => <Updated t={t} form={formRowOf(row)} /> },
    ...(mayMake ? [{ key: 'delete', label: t('list.column.actions', 'Actions'), render: (row: (typeof read.rows)[number]) => (formRowOf(row).state === 'draft' ? <DeleteDraft t={t} form={formRowOf(row)} onAsk={setAsked} /> : null) }] : []),
  ];

  const empty =
    kind === 'survey' ? (
      <EmptyState title={t('list.empty.surveys.title', 'No surveys yet')} body={t('list.empty.surveys.body', 'Ask your customers how a job went. A rule sends the survey after the job, and each answer is counted in its results.')} actions={newButton} />
    ) : (
      <EmptyState title={t('list.empty.forms.title', 'No forms yet')} body={t('list.empty.forms.body', 'Make a form your website visitors can fill in. Each answer can become a row in one of your tables.')} actions={newButton} />
    );

  return (
    <PageFrame t={t} title={t('list.title', 'Forms')} actions={newButton} loading={!access.ready || read.loading} refused={access.ready && !access.canRead('forms')} error={read.error} onRetry={read.refetch} status={said} testId="forms-list">
      {/* The list is the open tab's own panel: the tab names it (`aria-controls`), so it must be there. */}
      <Tabs value={kind} onValueChange={(value) => void navigate({ to: listAt(value === 'survey' ? 'survey' : 'form') })} variant="underline">
        <Stack direction="row" align="center" justify="between" wrap>
          <TabsList aria-label={t('list.tabs', 'Forms or surveys')}>
            <TabsTrigger value="form">
              <span className="inline-flex items-center gap-2">
                {t('list.tab.forms', 'Forms')}
                <span className="font-mono text-caption text-fg-subtle">{String(counts.form)}</span>
              </span>
            </TabsTrigger>
            <TabsTrigger value="survey">
              <span className="inline-flex items-center gap-2">
                {t('list.tab.surveys', 'Surveys')}
                <span className="font-mono text-caption text-fg-subtle">{String(counts.survey)}</span>
              </span>
            </TabsTrigger>
          </TabsList>
          {shown.length === 0 ? null : (
            <SegmentedControl
              aria-label={t('list.view', 'View')}
              value={view}
              onValueChange={(value) => setView(value === 'list' ? 'list' : 'cards')}
              options={[
                { value: 'cards', label: <span className="inline-flex items-center gap-1.5"><Icon name="layout-grid" />{t('list.view.cards', 'Cards')}</span> },
                { value: 'list', label: <span className="inline-flex items-center gap-1.5"><Icon name="list" />{t('list.view.list', 'List')}</span> },
              ]}
            />
          )}
        </Stack>
        <TabsContent value={kind}>
          <Stack gap="md">
            {shown.length === 0 ? (
              empty
            ) : view === 'cards' ? (
              <Grid columns={3} gap="md">
                {shown.map((form) => (
                  <FormCard key={form.id} t={t} form={form} mayDelete={mayMake} onDelete={setAsked} />
                ))}
              </Grid>
            ) : (
              <DataTable columns={columns} rows={read.rows.filter((row) => formRowOf(row).kind === kind)} cardsBelow={680} />
            )}
            {read.hasMore ? <span className="text-body-sm text-fg-muted">{t('list.more', 'Showing the {count} most recently changed.', { count: LIST_MAX })}</span> : null}
          </Stack>
        </TabsContent>
      </Tabs>
      <Dialog open={asked !== null} onOpenChange={(open) => (open ? undefined : setAsked(null))} size="sm">
        <DialogHeader title={t('list.delete.title', 'Delete this draft?')} closeLabel={t('shared.close', 'Close')} tone="danger" />
        <DialogBody>
          <span className="text-body text-fg-muted">{t('list.delete.body', '“{name}” and its questions are deleted. This can’t be undone.', { name: asked === null ? '' : titleOf(asked, locale) })}</span>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setAsked(null)}>
            {t('shared.cancel', 'Cancel')}
          </Button>
          <Button variant="destructive" loading={deleting} onClick={() => (asked === null ? undefined : void remove(asked))}>
            {t('list.delete.confirm', 'Delete')}
          </Button>
        </DialogFooter>
      </Dialog>
    </PageFrame>
  );
}
