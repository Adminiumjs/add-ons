/**
 * ONE ANSWER, WHOLE: the side sheet.
 *
 * Every question of the published copy strangers answered, label over
 * answer; a question its "show if" kept from them says why it was not asked;
 * the files, which staff alone open; the tick and where its confirmation
 * stands; the row the answer became; the website it was sent from. An answer
 * to a question the owner has since taken out is still shown, under the
 * question's id: nothing an answer holds is dropped from sight.
 *
 * The host's sheet moves the focus in when it opens, gives it back to the
 * name that opened it when it closes, and closes on Escape.
 */
import type { ReactNode } from 'react';

import { Button, SheetFooter, SheetHeader, Skeleton, Stack, useAccess, useLocaleTag, useNavigate, useRecords, type AddOnTranslate } from '../shared/host.ts';
import { languageName } from '../shared/languages.ts';
import type { FormRow } from '../shared/row.ts';
import { BecameText, FileChips } from './cells.tsx';
import { Icon, Sheet, SheetPane, keyValue } from './parts.tsx';
import { ANSWER_COLUMNS, FILE_COLUMNS, answerOf, askedOf, becameOf, fileOf, notAskedOf, shownOf, tickOf, whenOf, wordsIn, type Answer, type AnswerFile, type OpenedTable, type Question, type Questions } from './read.ts';

export interface AnswerSheetProps {
  t: AddOnTranslate;
  form: FormRow;
  /** The form's name, in the reader's language. */
  title: string;
  /** The answer open, or null when the sheet is shut. */
  id: string | null;
  questions: Questions;
  tables: readonly OpenedTable[];
  mayDelete: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
}

/** One question and its answer: the question small over the answer. */
function Line({ label, children }: { label: ReactNode; children: ReactNode }): ReactNode {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-2.5">
      <span className="text-caption font-semibold text-fg-subtle">{label}</span>
      <span className="break-words text-body-sm text-fg">{children}</span>
    </div>
  );
}

function Files({ t, label, files }: { t: AddOnTranslate; label: string; files: readonly AnswerFile[] }): ReactNode {
  return (
    <div className="flex flex-col gap-1.5 border-b border-border py-2.5">
      <span className="inline-flex items-center gap-1.5 text-caption font-semibold text-fg-subtle">
        {label}
        <Icon name="lock" />
        <span className="font-normal">{t('answers.sheet.staffOnly', 'Staff only')}</span>
      </span>
      {files.length === 0 ? <span className="text-body-sm text-fg-muted">{t('answers.sheet.noFiles', 'No files')}</span> : <FileChips t={t} files={files} />}
    </div>
  );
}

function Body({ t, answer, files, questions, tables }: { t: AddOnTranslate; answer: Answer; files: readonly AnswerFile[]; questions: Questions; tables: readonly OpenedTable[] }): ReactNode {
  const locale = useLocaleTag();
  const order = [locale, answer.language, questions.defaultLanguage];
  const asked = askedOf(questions, answer.values);
  const known = new Set(questions.list.map((one) => one.id));
  const label = (question: Question): string => wordsIn(question.label, order) ?? question.id;
  const lines: ReactNode[] = [];
  for (const question of questions.list) {
    const value = answer.values[question.id];
    if (question.kind === 'file') {
      lines.push(<Files key={question.id} t={t} label={label(question)} files={files.filter((file) => file.question === question.id)} />);
    } else if (question.kind === 'tick') {
      const ticked = value === true;
      const wording = ticked && answer.consentWording !== null ? answer.consentWording : label(question);
      lines.push(
        <Line key={question.id} label={wording}>
          {tickOf(t, answer, question, ticked, locale)}
        </Line>,
      );
    } else if (question.kind === 'hidden') {
      // A field filled from the page's address: shown only where it was filled.
      if (value !== undefined) lines.push(<Line key={question.id} label={label(question)}>{shownOf(t, question, value, order, locale).text}</Line>);
    } else if (value === undefined && !asked.has(question.id) && question.showIf !== undefined) {
      lines.push(
        <Line key={question.id} label={label(question)}>
          <span className="text-fg-muted">{notAskedOf(t, question, questions, answer.values, order)}</span>
        </Line>,
      );
    } else {
      const shown = shownOf(t, question, value, order, locale);
      lines.push(
        <Line key={question.id} label={label(question)}>
          {shown.mono ? <span className="font-mono">{shown.text}</span> : shown.text}
        </Line>,
      );
    }
  }
  // Answers to questions the published copy no longer has: under the question's id, never dropped.
  for (const [id, value] of Object.entries(answer.values)) {
    if (known.has(id)) continue;
    lines.push(
      <Line key={id} label={<span className="font-mono">{id}</span>}>
        {shownOf(t, undefined, value, order, locale).text}
      </Line>,
    );
  }
  // Files of a question no longer asked.
  const orphans = files.filter((file) => !known.has(file.question));
  if (orphans.length > 0) lines.push(<Files key="files-left" t={t} label={t('answers.sheet.files', 'Files')} files={orphans} />);
  lines.push(
    <Line key="became" label={t('answers.sheet.became', 'Became')}>
      <BecameText t={t} became={becameOf(answer, tables)} />
    </Line>,
  );
  if (answer.sentFrom !== null) {
    lines.push(
      <Line key="from" label={t('answers.sheet.from', 'Sent from')}>
        <span className="font-mono" dir="ltr">
          {answer.sentFrom}
        </span>
      </Line>,
    );
  }
  return <Stack gap="none">{lines}</Stack>;
}

export function AnswerSheet({ t, form, title, id, questions, tables, mayDelete, onClose, onDelete }: AnswerSheetProps): ReactNode {
  const access = useAccess();
  const locale = useLocaleTag();
  const navigate = useNavigate();
  const columns = ANSWER_COLUMNS.filter((column) => access.canRead('answers', [column]));
  const read = useRecords('answers', { filter: [{ column: 'id', op: 'eq', value: id === null ? null : keyValue(id) }, { column: 'form_id', op: 'eq', value: keyValue(form.id) }], pageSize: 1, columns: [...columns], enabled: id !== null });
  const filesRead = useRecords('answer_files', { filter: [{ column: 'answer_id', op: 'eq', value: id === null ? null : keyValue(id) }], pageSize: 50, columns: [...FILE_COLUMNS], enabled: id !== null && access.canRead('answer_files') });
  const row = read.rows[0];
  const answer = row === undefined ? null : answerOf(row);
  const files = filesRead.rows.map(fileOf);
  const became = answer === null ? null : becameOf(answer, tables);
  const name = answer === null ? '' : (answer.name ?? t('answers.noName', 'No name given'));
  const language = answer === null || answer.language === '' ? '' : languageName(answer.language);

  return (
    <Sheet open={id !== null} onOpenChange={(open) => (open ? undefined : onClose())} maxWidth={460} className="ms-auto">
      <SheetHeader
        icon={<Icon name="inbox" />}
        title={answer === null ? t('answers.sheet.title', 'One answer') : name}
        subtitle={
          <span className="flex flex-col gap-0.5">
            <span className="text-micro uppercase tracking-wide text-fg-subtle">{t('answers.sheet.of', 'Answer · {form}', { form: title })}</span>
            {answer === null ? null : (
              <span className="text-caption text-fg-muted">
                <span className="font-mono">{whenOf(answer.submittedAt, locale, true)}</span>
                {language === '' ? null : ` · ${language}`}
              </span>
            )}
          </span>
        }
        closeLabel={t('shared.close', 'Close')}
      />
      <SheetPane>
        {read.loading ? (
          <Stack gap="sm">
            <Skeleton height={44} />
            <Skeleton height={44} />
          </Stack>
        ) : answer === null ? (
          <span className="text-body-sm text-fg-muted">{t('answers.sheet.gone', 'This answer is not here any more. It may have been deleted.')}</span>
        ) : (
          <Body t={t} answer={answer} files={files} questions={questions} tables={tables} />
        )}
      </SheetPane>
      {answer === null || (!mayDelete && (became === null || became.to === null)) ? null : (
        <SheetFooter>
          {mayDelete ? (
            <Button variant="destructive" iconLeft={<Icon name="trash-2" />} onClick={() => onDelete(answer.id)}>
              {t('answers.sheet.delete', 'Delete answer')}
            </Button>
          ) : null}
          {became !== null && became.to !== null ? (
            <Button variant="primary" onClick={() => void navigate({ to: became.to as string })}>
              {t('answers.sheet.open', 'Open in {table}', { table: became.table })}
            </Button>
          ) : null}
        </SheetFooter>
      )}
    </Sheet>
  );
}
