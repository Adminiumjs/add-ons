/**
 * THE BUILDER'S BUTTONS IN THE TOP BAR (comp 180-207, 1097-1129): the
 * language button, the save state, "Preview" and the primary button.
 *
 * - A draft (or a closed form): "Publish". It runs every check Adminium runs
 *   when a form goes live and lists what fails; with nothing failing it is
 *   one write: the state, the published copy, the time, and at the first
 *   publish the readable link name. It stays off while the privacy notice is
 *   unset.
 * - A live form: "Close form" / "Close survey". While its draft says
 *   something its published copy does not, "Publish changes" comes first and
 *   "Close" steps back: visitors see only what was published.
 *
 * The toasts say what is true: a form strangers cannot reach is never
 * "open to visitors now".
 */
import { useState, type ReactNode } from 'react';

import { asDataError, AutosaveIndicator, Button, Dialog, DialogBody, DialogFooter, DialogHeader, useAccess, useFormTables, useLocaleTag, useNavigate, useRead, useStateMove, useWrite, type AddOnTranslate } from '../shared/host.ts';
import { formAt } from '../shared/paths.ts';
import { refusal } from '../shared/refusal.ts';
import { asJson, type FormRow } from '../shared/row.ts';
import type { TabProps } from '../shared/slot.ts';
import { useToast } from '../shared/toast.ts';
import { languageFor } from '../forms/newForm.ts';
import { publishProblems, type Problem } from './checks.ts';
import { differsFromPublished, wordIn, type Draft } from './draft.ts';
import { LanguageMenu } from './LanguageMenu.tsx';
import { kitTables } from './mapping.ts';
import { Icon } from './parts.tsx';
import { PreviewButton } from './Preview.tsx';
import { readableSlug, slugAtPublish } from './slug.ts';
import { useFormsStatus, type FormsStatus } from './status.ts';
import { useBuilder, type Builder } from './store.ts';
import { problemWords, whereWords } from './words.ts';

/** The builder of the form on screen, writing through the data kit while the reader may change forms. */
export function useFormBuilder(form: FormRow, settings: string | null = null): { builder: Builder; mayEdit: boolean } {
  const access = useAccess();
  const locale = useLocaleTag();
  const write = useWrite('forms');
  const mayEdit = access.ready && access.canUpdate('forms');
  const builder = useBuilder(form, mayEdit ? (values) => write.update(form.id, values) : null, languageFor(locale), settings);
  return { builder, mayEdit };
}

/** What a toast says once a form is live: the truth about whether strangers can open it. */
function publishedWords(t: AddOnTranslate, form: FormRow, changes: boolean, status: FormsStatus | null): string {
  const reach = status === null ? null : status.reach.state === 'reachable';
  if (changes) {
    if (reach === true) return t('builder.toast.changes', 'Changes published. They show from now on.');
    if (reach === false) return t('builder.toast.changesUnreached', 'Changes published, but nobody can reach the pages yet.');
    return t('builder.toast.changesUnknown', 'Changes published.');
  }
  if (form.kind === 'survey') {
    if (reach === true) return t('builder.toast.survey', 'Survey published. Invitation links work now.');
    if (reach === false) return t('builder.toast.surveyUnreached', 'Survey published, but invitation links can’t be opened yet.');
    return t('builder.toast.surveyUnknown', 'Survey published.');
  }
  if (reach === true) return t('builder.toast.form', 'Form published. Visitors can open it now.');
  if (reach === false) return t('builder.toast.formUnreached', 'Form published, but visitors can’t reach it yet.');
  return t('builder.toast.formUnknown', 'Form published.');
}

export function HeaderActions({ t, form, settings }: TabProps): ReactNode {
  const { builder, mayEdit } = useFormBuilder(form, settings);
  const { status } = useFormsStatus();
  const access = useAccess();
  const move = useStateMove('forms');
  const write = useWrite('forms');
  const read = useRead();
  const navigate = useNavigate();
  const toast = useToast();
  const { tables } = useFormTables();
  const [problems, setProblems] = useState<Problem[] | null>(null);
  const [busy, setBusy] = useState(false);

  const live = form.state === 'live';
  const changes = live && differsFromPublished(builder.draft, form.published);
  const noticeUnset = status?.notice === false;
  const mayPublish = mayEdit && (live || access.canMove('forms', 'live'));
  const mayClose = access.ready && access.canMove('forms', 'closed');

  const publish = async (): Promise<void> => {
    setBusy(true);
    try {
      const draft: Draft = builder.draft;
      const d = draft.definition;
      // The first time a form goes live it takes a readable link name, kept for good after.
      const first = form.state === 'draft' && form.publishedAt === null;
      const title = wordIn(d.title, d.defaultLanguage);
      const wanted = first ? readableSlug(title) : null;
      const clash = wanted !== null && wanted !== form.slug ? (await read.list('forms', { filter: [{ column: 'slug', op: 'eq', value: wanted }], columns: ['id'], pageSize: 2 })).rows.some((row) => String(row['id']) !== form.id) : false;
      const slug = slugAtPublish(form.slug, first, title, () => clash);
      const found = publishProblems(draft, { notice: status?.notice ?? null, tables: kitTables(tables), slug });
      if (found.length > 0) {
        setProblems(found);
        return;
      }
      const values = {
        definition: asJson(d),
        settings: asJson(draft.settings),
        name: title.trim().slice(0, 200) || form.name,
        published: asJson({ definition: d, settings: draft.settings }),
        published_at: new Date().toISOString(),
        ...(slug === form.slug ? {} : { slug }),
      };
      if (live) await write.update(form.id, values);
      else await move(form.id, 'live', values);
      builder.written(draft);
      toast(publishedWords(t, form, live, status));
      if (slug !== form.slug) await navigate({ to: formAt(form.kind, slug), replace: true });
    } catch (caught) {
      toast(refusal(t, asDataError(caught)).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const close = async (): Promise<void> => {
    setBusy(true);
    try {
      await builder.flush();
      await move(form.id, 'closed');
      toast(form.kind === 'survey' ? t('builder.toast.surveyClosed', 'Survey closed. Invitation links now say it is closed.') : t('builder.toast.formClosed', 'Form closed. Visitors now see “This form is closed.”'));
    } catch (caught) {
      toast(refusal(t, asDataError(caught)).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const goTo = (problem: Problem): void => {
    const where = problem.where;
    if (where.at === 'question' || where.at === 'section') builder.select(where.id);
    if (where.at === 'settings') {
      builder.setOpen(where.section);
      if (problem.question !== undefined) builder.select(problem.question);
    }
    setProblems(null);
    void navigate({ to: formAt(form.kind, form.slug) });
  };

  const closeLabel = form.kind === 'survey' ? t('builder.closeSurvey', 'Close survey') : t('builder.closeForm', 'Close form');
  const d = builder.draft.definition;

  return (
    <>
      <LanguageMenu t={t} builder={builder} mayEdit={mayEdit} />
      <AutosaveIndicator status={builder.save} savingLabel={t('builder.saving', 'Saving')} savedLabel={t('builder.saved', 'All changes saved')} errorLabel={t('builder.saveFailed', 'Not saved')} />
      {builder.save === 'error' ? (
        <Button variant="ghost" size="sm" onClick={() => void builder.flush()}>
          {t('shared.retry', 'Try again')}
        </Button>
      ) : null}
      <PreviewButton t={t} form={form} builder={builder} />
      {live ? (
        <>
          {changes && mayEdit ? (
            <Button variant="primary" iconLeft={<Icon name="send" />} loading={busy} disabled={noticeUnset} onClick={() => void publish()}>
              {t('builder.publishChanges', 'Publish changes')}
            </Button>
          ) : null}
          {mayClose ? (
            <Button variant={changes && mayEdit ? 'secondary' : 'primary'} iconLeft={<Icon name="x" />} loading={busy && !changes} onClick={() => void close()}>
              {closeLabel}
            </Button>
          ) : null}
        </>
      ) : mayPublish ? (
        <Button variant="primary" iconLeft={<Icon name="send" />} loading={busy} disabled={noticeUnset} onClick={() => void publish()}>
          {t('builder.publish', 'Publish')}
        </Button>
      ) : null}
      <Dialog open={problems !== null} onOpenChange={(open) => (open ? undefined : setProblems(null))} size="md">
        <DialogHeader title={t('builder.check.title', 'Not ready to publish')} subtitle={t('builder.check.subtitle', 'Fix these first. Nothing was published.')} closeLabel={t('shared.close', 'Close')} tone="warn" />
        <DialogBody>
          <ul className="flex list-none flex-col gap-3" aria-label={t('builder.check.list', 'What to fix')}>
            {(problems ?? []).map((problem, index) => (
              <li key={String(index)} className="flex flex-col gap-0.5">
                <span className="text-caption font-bold text-fg-subtle">
                  <bdi>{whereWords(t, problem, d, builder.editing)}</bdi>
                </span>
                <span className="text-body-sm text-fg">{problemWords(t, problem)}</span>
                {problem.code === 'notice-unset' ? null : (
                  <span>
                    <Button variant="link" size="sm" onClick={() => goTo(problem)}>
                      {t('builder.check.show', 'Show me')}
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setProblems(null)}>
            {t('shared.close', 'Close')}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
