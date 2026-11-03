/**
 * A FORM'S ANSWERS: the table, its filters, the CSV, picking and deleting,
 * the side sheet of one answer, and a card per answer on a phone.
 *
 * Adminium alone writes an answer (the door checks it, and keeps the name
 * and the address on the row itself). Staff read answers here and delete
 * them, never write one; deleting takes the answer's files with it, which
 * the engine does on its own. Everything is read as the signed-in reader
 * through the data kit, page by page, with the server filtering: nothing
 * here reads every row to filter in the browser.
 *
 * `?answer=<id>`, the link in Adminium's own bell and staff mail, opens that
 * answer's sheet as the tab is drawn.
 */
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  Alert,
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  EmptyState,
  IconButton,
  Pagination,
  SearchInput,
  SegmentedControl,
  Select,
  Skeleton,
  Stack,
  asDataError,
  useAccess,
  useExport,
  useFormSummary,
  useFormTables,
  useLocaleTag,
  useNavigate,
  useRecords,
  useWrite,
  type DataError,
} from '../shared/host.ts';
import { languageName } from '../shared/languages.ts';
import { formAt } from '../shared/paths.ts';
import { refusal } from '../shared/refusal.ts';
import { codeOf, titleOf } from '../shared/row.ts';
import type { TabProps } from '../shared/slot.ts';
import { useToast } from '../shared/toast.ts';
import { ExportNotReady, exportReady } from './exportReady.ts';
import { AnswerSheet } from './AnswerSheet.tsx';
import { BecameText, FileChips, LanguageChip } from './cells.tsx';
import { DataTable, Icon, keyValue, useMayDelete, useNarrow, type Column } from './parts.tsx';
import {
  ANSWER_COLUMNS,
  EXPORT_COLUMNS,
  FILE_COLUMNS,
  PAGE_SIZE,
  answerOf,
  becameOf,
  becomesOf,
  companyQuestion,
  emailQuestion,
  fileOf,
  filtersOf,
  questionsOf,
  sinceOf,
  whenOf,
  wordsIn,
  type Answer,
  type AnswerFile,
  type OpenedTable,
  type When,
} from './read.ts';

/** Narrower than this, the tab is a phone's: a card per answer (the comp's 680). */
const PHONE = 680;
/** How long typing rests before the list is asked again. */
const TYPING_MS = 300;
/** The element each answer's name is, so a staff link can bring it into view. */
const nameId = (id: string): string => `forms-answer-${id}`;

/** One answer as a row and as a card: the answer, and what is shown of it beside its own columns. */
interface Shown {
  answer: Answer;
  files: readonly AnswerFile[];
}

export function Answers(props: TabProps): ReactNode {
  const { t } = props;
  const access = useAccess();
  if (!access.ready) return <Skeleton height={44} />;
  if (!access.canRead('answers')) return <EmptyState title={t('shared.refused.title', 'You do not have permission to open this')} body={t('shared.refused.body', 'Ask a manager if you need it.')} />;
  return <AnswersList {...props} />;
}

function AnswersList({ t, form, answer: linked }: TabProps): ReactNode {
  const access = useAccess();
  const locale = useLocaleTag();
  const navigate = useNavigate();
  const toast = useToast();
  const hintId = useId();
  const write = useWrite('answers');
  const exporter = useExport();
  const mayDelete = useMayDelete();
  const tables = useFormTables().tables as readonly OpenedTable[];
  const { summary, refetch: recount } = useFormSummary(form.state === 'draft' ? null : form.id);
  const questions = useMemo(() => questionsOf(form), [form]);
  const title = titleOf(form, locale);
  const [box, narrow] = useNarrow(PHONE);

  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');
  const [language, setLanguage] = useState('all');
  const [when, setWhen] = useState<When>('30');
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState<readonly string[]>([]);
  const [open, setOpen] = useState<string | null>(linked);
  const [asking, setAsking] = useState<readonly string[] | null>(null);
  const [deleting, setDeleting] = useState(false);

  // A staff link followed while the tab is open opens its answer too.
  useEffect(() => {
    if (linked !== null) setOpen(linked);
  }, [linked]);

  /** A new question to the list starts on its first page, with nothing picked. */
  const ask = (change: () => void): void => {
    change();
    setPage(1);
    setPicked([]);
  };
  useEffect(() => {
    if (typed === search) return undefined;
    const timer = setTimeout(() => ask(() => setSearch(typed)), TYPING_MS);
    return () => clearTimeout(timer);
  }, [typed, search]);

  // To the minute, and only when "When" changes: a list asked with a new moment on every draw would be asked for ever.
  const since = useMemo(() => sinceOf(when, Date.now()), [when]);
  const filters = useMemo(() => filtersOf(form.id, { language, since, search }), [form.id, language, since, search]);
  const columns = ANSWER_COLUMNS.filter((column) => access.canRead('answers', [column]));
  const read = useRecords('answers', { filter: filters, sort: [{ column: 'submitted_at', direction: 'desc' }], page, pageSize: PAGE_SIZE, columns: [...columns] });
  const answers = useMemo(() => read.rows.map(answerOf), [read.rows]);
  const ids = answers.map((one) => one.id);
  const filesRead = useRecords('answer_files', { filter: [{ column: 'answer_id', op: 'in', value: ids.map(keyValue) }], pageSize: 199, columns: [...FILE_COLUMNS], enabled: ids.length > 0 && access.canRead('answer_files') });
  const files = filesRead.rows.map(fileOf);
  const shown: Shown[] = answers.map((answer) => ({ answer, files: files.filter((file) => file.answerId === answer.id) }));
  const pickedHere = picked.filter((id) => ids.includes(id));

  // The answer a staff link names is brought into view once its row is drawn.
  const scrolled = useRef<string | null>(null);
  useEffect(() => {
    if (linked === null || scrolled.current === linked) return;
    const node = typeof document === 'undefined' ? null : document.getElementById(nameId(linked));
    if (node === null) return;
    scrolled.current = linked;
    node.scrollIntoView?.({ block: 'center' });
  }, [linked, answers, narrow]);

  const emailQ = emailQuestion(questions);
  const companyQ = companyQuestion(questions);
  const order = [locale, questions.defaultLanguage];
  const company = (answer: Answer): string => {
    const value = companyQ === undefined ? undefined : answer.values[companyQ.id];
    return typeof value === 'string' ? value : '';
  };
  const nameOf = (answer: Answer): string => answer.name ?? t('answers.noName', 'No name given');

  const closeSheet = (): void => {
    setOpen(null);
    // The link's answer is closed: the address no longer names it, so a reload does not open it again.
    if (linked !== null) void navigate({ to: formAt('form', form.slug, 'answers'), replace: true });
  };

  const remove = async (keys: readonly string[]): Promise<void> => {
    setDeleting(true);
    const gone: string[] = [];
    let refused: DataError | null = null;
    for (const key of keys) {
      try {
        await write.remove(keyValue(key));
        gone.push(key);
      } catch (caught) {
        refused ??= asDataError(caught);
      }
    }
    setDeleting(false);
    setAsking(null);
    setPicked((now) => now.filter((id) => !gone.includes(id)));
    if (open !== null && gone.includes(open)) closeSheet();
    read.refetch();
    recount();
    if (gone.length > 0) toast(t('answers.deleted', '{count, plural, one {# answer deleted.} other {# answers deleted.}}', { count: gone.length }));
    if (refused !== null) toast(refusal(t, refused).message, 'error');
  };

  const download = async (): Promise<void> => {
    try {
      const id = await exporter.start('answers', { filter: filters, columns: EXPORT_COLUMNS.filter((column) => access.canRead('answers', [column])), format: 'csv' });
      // The export is written by a job: opened before it is ready, the file is "Export is processing." instead.
      await exportReady(id);
      await exporter.download(id);
      toast(t('answers.csv.started', 'Downloading the answers as CSV.'), 'info');
    } catch (caught) {
      if (caught instanceof ExportNotReady) toast(t('answers.csv.failed', 'The CSV could not be made. Try again.'), 'error');
      else toast(refusal(t, asDataError(caught)).message, 'error');
    }
  };

  const pick = (id: string, on: boolean): void => setPicked((now) => (on ? [...now.filter((one) => one !== id), id] : now.filter((one) => one !== id)));
  const allPicked = ids.length > 0 && pickedHere.length === ids.length;

  /* ── the toolbar ─────────────────────────────────────────────────────── */

  const languages = questions.languages;
  const languageChoice =
    languages.length > 1 ? (
      <SegmentedControl
        aria-label={t('answers.language', 'Language')}
        value={language}
        onValueChange={(value) => ask(() => setLanguage(value))}
        options={[
          { value: 'all', label: narrow ? t('answers.language.allShort', 'All') : t('answers.language.all', 'All languages') },
          ...languages.map((tag) => ({ value: tag, label: <span lang={tag}>{narrow ? codeOf(tag) : languageName(tag)}</span> })),
        ]}
      />
    ) : null;
  const searchBox = (
    <SearchInput
      value={typed}
      onChange={(event) => setTyped(event.target.value)}
      onSubmit={(value) => ask(() => {
        setTyped(value);
        setSearch(value);
      })}
      placeholder={t('answers.search', 'Search answers')}
      aria-label={t('answers.search', 'Search answers')}
      aria-describedby={hintId}
    />
  );
  const hint = (
    <span id={hintId} className="text-caption text-fg-subtle">
      {t('answers.search.hint', 'Finds a name, or an e-mail address when what you type has an @ in it.')}
    </span>
  );
  const whenChoice = (
    <Select
      aria-label={t('answers.when', 'When')}
      value={when}
      onChange={(event) => ask(() => setWhen(event.target.value === '7' || event.target.value === 'all' ? event.target.value : '30'))}
      options={[
        { value: '7', label: t('answers.when.7', 'Last 7 days') },
        { value: '30', label: t('answers.when.30', 'Last 30 days') },
        { value: 'all', label: t('answers.when.all', 'All time') },
      ]}
    />
  );
  const toolbar = narrow ? (
    <Stack gap="sm">
      {searchBox}
      {hint}
      <Stack direction="row" align="center" gap="sm">
        <span className="min-w-0 flex-1">{languageChoice}</span>
        <IconButton label={t('answers.csv', 'Download CSV')} variant="bordered" onClick={() => void download()}>
          <Icon name="download" />
        </IconButton>
      </Stack>
      {whenChoice}
    </Stack>
  ) : (
    <Stack gap="xs">
      <Stack direction="row" align="center" gap="sm" wrap>
        {searchBox}
        {languageChoice}
        {whenChoice}
        <span className="ms-auto">
          <Button variant="secondary" iconLeft={<Icon name="download" />} loading={exporter.running} onClick={() => void download()}>
            {t('answers.csv', 'Download CSV')}
          </Button>
        </span>
      </Stack>
      {hint}
    </Stack>
  );

  const pickedBar =
    mayDelete && pickedHere.length > 0 ? (
      <div role="group" aria-label={t('answers.picked.group', 'Picked answers')} className="flex items-center gap-2 rounded-lg border border-accent bg-accent-soft px-3 py-2">
        <span className="font-bold text-body-sm">{t('answers.picked', '{count, plural, one {# picked} other {# picked}}', { count: pickedHere.length })}</span>
        {narrow ? null : (
          <Button variant="ghost" size="sm" onClick={() => setPicked([])}>
            {t('answers.picked.clear', 'Clear')}
          </Button>
        )}
        <span className="ms-auto">
          <Button variant="destructive" size="sm" iconLeft={<Icon name="trash-2" />} onClick={() => setAsking(pickedHere)}>
            {t('answers.picked.delete', 'Delete')}
          </Button>
        </span>
      </div>
    ) : null;

  /* ── the answers ─────────────────────────────────────────────────────── */

  const total = form.state === 'draft' ? 0 : (summary?.total ?? null);
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = (page - 1) * PAGE_SIZE + answers.length;
  const showing =
    answers.length === 0
      ? total === null
        ? null
        : t('answers.showing.none', 'Showing 0 of {total}', { total })
      : total === null
        ? t('answers.showing.some', 'Showing {from}–{to}', { from, to })
        : t('answers.showing', 'Showing {from}–{to} of {total}', { from, to, total });
  const filtered = search.trim() !== '' || language !== 'all' || when !== 'all';

  const pickBox = (answer: Answer): ReactNode => (
    <Checkbox checked={pickedHere.includes(answer.id)} onCheckedChange={(on) => pick(answer.id, on)} aria-label={t('answers.pick.one', 'Pick the answer from {name}', { name: nameOf(answer) })} />
  );
  const nameButton = (answer: Answer): ReactNode => (
    <button type="button" id={nameId(answer.id)} onClick={() => setOpen(answer.id)} className="min-w-0 text-start font-bold text-fg hover:underline">
      {nameOf(answer)}
    </button>
  );

  const byId = new Map(shown.map((one) => [one.answer.id, one]));
  const of = (row: { id?: unknown }): Shown => byId.get(String(row.id)) as Shown;
  const tableColumns: Column[] = [
    ...(mayDelete ? [{ key: 'pick', label: t('answers.column.pick', 'Pick'), sortable: false, render: (row: { id?: unknown }) => pickBox(of(row).answer) }] : []),
    { key: 'submitted_at', label: t('answers.column.when', 'When'), sortable: false, render: (row) => <span className="whitespace-nowrap font-mono text-caption text-fg-muted">{whenOf(of(row).answer.submittedAt, locale)}</span> },
    { key: 'name', label: t('answers.column.name', 'Name'), sortable: false, render: (row) => nameButton(of(row).answer) },
    ...(emailQ === undefined
      ? []
      : [
          {
            key: 'email',
            label: wordsIn(emailQ.label, order) ?? t('answers.column.email', 'E-mail'),
            sortable: false,
            render: (row: { id?: unknown }) => {
              const address = of(row).answer.email ?? '';
              return (
                <span className="block truncate font-mono text-caption" title={address} dir="ltr">
                  {address}
                </span>
              );
            },
          },
        ]),
    ...(companyQ === undefined ? [] : [{ key: 'company', label: wordsIn(companyQ.label, order) ?? t('answers.column.company', 'Company'), sortable: false, render: (row: { id?: unknown }) => company(of(row).answer) }]),
    { key: 'became', label: t('answers.column.became', 'Became'), sortable: false, render: (row) => <BecameText t={t} became={becameOf(of(row).answer, tables)} /> },
    { key: 'files', label: t('answers.column.files', 'Files'), sortable: false, render: (row) => <FileChips t={t} files={of(row).files} /> },
    { key: 'language', label: t('answers.column.language', 'Language'), sortable: false, render: (row) => <LanguageChip tag={of(row).answer.language} /> },
  ];

  const card = ({ answer, files: its }: Shown): ReactNode => {
    const where = [company(answer), answer.language === '' ? '' : codeOf(answer.language)].filter((part) => part !== '').join(' · ');
    return (
      <li key={answer.id}>
        <Card padded>
          <div className="flex items-start gap-1">
            {mayDelete ? <label className="inline-flex size-11 shrink-0 items-center justify-center">{pickBox(answer)}</label> : null}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center gap-2">
                {nameButton(answer)}
                <span className="ms-auto whitespace-nowrap font-mono text-caption text-fg-subtle">{whenOf(answer.submittedAt, locale)}</span>
              </div>
              {where === '' ? null : <span className="text-body-sm text-fg-muted">{where}</span>}
              <span className="text-body-sm">
                <BecameText t={t} became={becameOf(answer, tables)} />
              </span>
              <FileChips t={t} files={its} />
            </div>
          </div>
        </Card>
      </li>
    );
  };

  let list: ReactNode;
  if (read.error !== null) {
    list = <Alert tone="danger" role="alert" title={t('shared.failed.title', 'This could not be loaded')} body={refusal(t, read.error).message} action={<Button variant="secondary" size="sm" onClick={() => read.refetch()}>{t('shared.retry', 'Try again')}</Button>} />;
  } else if (read.loading) {
    list = (
      <Stack gap="sm">
        <span role="status" className="sr-only">
          {t('shared.loading', 'Loading')}
        </span>
        <Skeleton height={44} />
        <Skeleton height={44} />
      </Stack>
    );
  } else if (answers.length === 0) {
    list = filtered ? (
      <EmptyState compact preset="no-matches" title={t('answers.none.match', 'No answers match. Try another search or language.')} />
    ) : (
      <EmptyState title={t('answers.none.title', 'No answers yet')} body={t('answers.placeholder.answers', 'Every answer sent is listed here.')} />
    );
  } else if (narrow) {
    list = <ul className="flex flex-col gap-2">{shown.map(card)}</ul>;
  } else {
    list = <DataTable columns={tableColumns} rows={read.rows} rowKey="id" />;
  }

  const becomes = becomesOf(form);
  const becomesLabel = becomes === null ? null : (tables.find((one) => one.id === becomes)?.label ?? null);
  const asked = asking?.length ?? 0;

  return (
    <div ref={box} className="flex min-w-0 flex-col gap-3" data-part="forms-answers">
      {toolbar}
      {pickedBar}
      {list}
      <div className="flex flex-wrap items-center gap-3 text-caption text-fg-subtle">
        {mayDelete && answers.length > 0 && !narrow ? (
          <span className="inline-flex items-center gap-1.5">
            <Checkbox checked={allPicked} onCheckedChange={(on) => setPicked(on ? ids : [])} aria-label={t('answers.pick.all', 'Pick all shown answers')} />
            {t('answers.pick.allShort', 'Pick all shown')}
          </span>
        ) : null}
        {showing === null ? null : <span>{showing}</span>}
        <span className="ms-auto inline-flex items-center gap-1.5">
          <Icon name="lock" />
          {t('answers.staffOnly', 'Files are seen by staff only.')}
        </span>
      </div>
      {page > 1 || read.hasMore ? (
        <Pagination
          page={page}
          pageCount={read.hasMore ? page + 1 : page}
          onPageChange={(next) => {
            setPage(next);
            setPicked([]);
          }}
          label={t('answers.pages', 'Pages of answers')}
          previousLabel={t('answers.pages.previous', 'Newer answers')}
          nextLabel={t('answers.pages.next', 'Older answers')}
          pageLabel={(n) => t('answers.pages.page', 'Page {page}', { page: n })}
        />
      ) : null}
      <AnswerSheet t={t} form={form} title={title} id={open} questions={questions} tables={tables} mayDelete={mayDelete} onClose={closeSheet} onDelete={(id) => setAsking([id])} />
      <Dialog open={asking !== null} onOpenChange={(now) => (now ? undefined : setAsking(null))} size="sm">
        <DialogHeader title={t('answers.delete.title', '{count, plural, one {Delete # answer?} other {Delete # answers?}}', { count: asked })} closeLabel={t('shared.close', 'Close')} tone="danger" />
        <DialogBody>
          <span className="text-body text-fg-muted">
            {t('answers.delete.body', 'This can’t be undone.')}
            {becomesLabel === null ? null : ` ${t('answers.delete.became', '{count, plural, one {The row it became stays in {table}.} other {The rows they became stay in {table}.}}', { count: asked, table: becomesLabel })}`}
          </span>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setAsking(null)}>
            {t('shared.cancel', 'Cancel')}
          </Button>
          <Button variant="destructive" loading={deleting} onClick={() => (asking === null ? undefined : void remove(asking))}>
            {t('answers.delete.confirm', 'Delete')}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
