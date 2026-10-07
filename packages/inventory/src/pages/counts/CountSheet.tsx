/**
 * ONE COUNT'S SHEET.
 *
 * Each count typed is saved at once, as a mark of its own: Adminium takes
 * what the books hold for that line at that moment and keeps it beside the
 * count, so a sale made a minute later is not undone when the count is
 * posted. The difference and its value are Adminium's, read back after every
 * mark; the screen never subtracts.
 *
 * Posting adjusts the lines that differ, one by one. A stock manager can
 * reverse a posted count, and cancel one that is still open.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';

import { FindOrScan } from '../shared/FindOrScan.tsx';
import {
  Alert,
  AutosaveIndicator,
  Button,
  Card,
  EmptyState,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Figure,
  Pagination,
  ProgressBar,
  Select,
  Stack,
  StatusPill,
  Switch,
  Tag,
  asDataError,
  useAccess,
  useAppToasts,
  useLocaleTag,
  useNavigate,
  useRead,
  useRecord,
  useRecords,
  useStateMove,
  useWrite,
  type AddOnTranslate,
  type DataFilter,
  type DataRow,
  type DataValue,
} from '../shared/host.ts';
import { LinesTable, type LineColumn } from '../shared/LinesTable.tsx';
import { PageFrame, useSaid } from '../shared/PageFrame.tsx';
import { QtyInput } from '../shared/QtyInput.tsx';
import { refusal } from '../shared/refusal.ts';
import { COUNT_POST, COUNT_UNDO, runSheet } from '../shared/runSheet.ts';
import { TotalsBar } from '../shared/TotalsBar.tsx';
import { plain } from '../receive/lines.ts';
import { COUNTS, STATUS_TONE, scopeWords, statusWords } from './CountsList.tsx';

const PAGE_SIZE = 100;
const LINE = ['id', 'count_id', 'level_id', 'item_id', 'item_name', 'sku', 'barcode', 'unit', 'batch_code', 'counted', 'qty_when_counted', 'counted_at', 'difference', 'is_counted', 'differs', 'status'] as const;
const text = (value: unknown): string => (value === null || value === undefined ? '' : String(value));
const isSet = (value: unknown): boolean => value === 1 || value === '1' || value === true;

type Saving = 'saving' | 'saved' | 'error';

export function CountSheet({ t, countId }: { t: AddOnTranslate; countId: string }): ReactNode {
  const access = useAccess();
  const read = useRead();
  const toasts = useAppToasts();
  const navigate = useNavigate();
  const locale = useLocaleTag();
  const [said, say] = useSaid();
  const mayOpen = access.canRead('counts');
  const money = access.canRead('count_lines', ['value']);
  const mayMark = access.canCreate('count_marks');
  const mayAdd = access.canCreate('count_lines');
  const mayPost = access.canMove('counts', 'posting', 'open');
  const mayReverse = access.canMove('counts', 'reversing', 'posted');
  const mayCancel = access.canMove('counts', 'cancelled', 'open');

  const count = useRecord('counts', mayOpen ? countId : null);
  const sheet = count.row;
  const status = text(sheet?.['status']);
  const [page, setPage] = useState(1);
  const [onlyDiffer, setOnlyDiffer] = useState(false);
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [only, setOnly] = useState<{ itemId: string; name: string } | null>(null);
  const filter = useMemo<DataFilter[]>(
    () => [{ column: 'count_id', op: 'eq', value: countId }, ...(onlyDiffer ? [{ column: 'differs', op: 'eq' as const, value: 1 }] : []), ...(onlyOpen ? [{ column: 'is_counted', op: 'eq' as const, value: 0 }] : []), ...(only === null ? [] : [{ column: 'item_id', op: 'eq' as const, value: only.itemId }])],
    [countId, onlyDiffer, onlyOpen, only],
  );
  const lines = useRecords('count_lines', { filter, sort: [{ column: 'item_name', direction: 'asc' }, { column: 'id', direction: 'asc' }], page, pageSize: PAGE_SIZE, columns: money ? [...LINE, 'value'] : LINE, enabled: mayOpen });
  // What the books hold now, for the lines on this page: a balance is read where it lives, never copied onto a line.
  const levelIds = lines.rows.map((line) => text(line['level_id']));
  const levels = useRecords('levels', { filter: [{ column: 'id', op: 'in', value: levelIds }], pageSize: PAGE_SIZE, columns: ['id', 'qty'], enabled: mayOpen && levelIds.length > 0 && access.canRead('levels') });
  const place = useRecords('places', { filter: [{ column: 'id', op: 'eq', value: text(sheet?.['place_id']) }], pageSize: 1, columns: ['id', 'name'], enabled: sheet !== null });
  const category = useRecords('categories', { filter: [{ column: 'id', op: 'eq', value: text(sheet?.['category_id']) }], pageSize: 1, columns: ['id', 'name'], enabled: sheet !== null && text(sheet['category_id']) !== '' });
  const reasons = useRecords('reasons', { filter: [{ column: 'for', op: 'eq', value: 'adjust' }, { column: 'active', op: 'eq', value: true }], sort: [{ column: 'label', direction: 'asc' }], pageSize: 100, columns: ['id', 'label'], enabled: sheet !== null && mayPost });
  const differing = useRecords('count_lines', { filter: [{ column: 'count_id', op: 'eq', value: countId }, { column: 'differs', op: 'eq', value: 1 }], sort: [{ column: 'item_name', direction: 'asc' }], pageSize: 20, columns: ['id', 'item_name', 'batch_code', 'difference', 'unit'], enabled: mayOpen });

  const marks = useWrite('count_marks');
  const lineWrites = useWrite('count_lines');
  const move = useStateMove('counts');

  const [typed, setTyped] = useState<Readonly<Record<string, string>>>({});
  const [saving, setSaving] = useState<Readonly<Record<string, Saving>>>({});
  const [lineSaid, setLineSaid] = useState<Readonly<Record<string, string>>>({});
  const [dialog, setDialog] = useState<'post' | 'reverse' | 'cancel' | null>(null);
  const [reasonId, setReasonId] = useState('');
  const [busy, setBusy] = useState(false);
  const [run, setRun] = useState<{ done: number; all: number } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [toCheck, setToCheck] = useState<string[]>([]);
  const [offer, setOffer] = useState<{ item: string; levels: DataRow[] } | null>(null);
  const scan = useRef<HTMLInputElement | null>(null);
  const focusLine = useRef<string | null>(null);

  const defaultReason = text(reasons.rows.find((reason) => text(reason['label']) === 'Count difference')?.['id'] ?? reasons.rows[0]?.['id']);
  useEffect(() => {
    if (reasonId === '' && defaultReason !== '') setReasonId(defaultReason);
  }, [reasonId, defaultReason]);

  // After a scan: the first line of the item that is not counted yet takes the caret.
  useEffect(() => {
    if (only === null || lines.loading) return;
    const first = lines.rows.find((line) => !isSet(line['is_counted'])) ?? lines.rows[0];
    if (first === undefined || focusLine.current === text(first['id'])) return;
    focusLine.current = text(first['id']);
    const field = document.getElementById(`inventory-counted-${text(first['id'])}`);
    if (field instanceof HTMLInputElement) {
      field.focus();
      field.select();
    }
  }, [only, lines.rows, lines.loading]);

  const editable = status === 'open' && mayMark;

  /** One typed count, saved as a mark: the snapshot is taken by Adminium, under the item's lock. */
  const mark = async (line: DataRow): Promise<void> => {
    const id = text(line['id']);
    const value = typed[id];
    if (value === undefined || value === plain(line['counted'] as DataValue)) return;
    setSaving((all) => ({ ...all, [id]: 'saving' }));
    setLineSaid((all) => Object.fromEntries(Object.entries(all).filter(([key]) => key !== id)));
    try {
      // A cleared field is a mark with no count: the line is uncounted again.
      await marks.create({ count_line_id: id, counted: value === '' ? null : value });
      setTyped((all) => Object.fromEntries(Object.entries(all).filter(([key]) => key !== id)));
      setSaving((all) => ({ ...all, [id]: 'saved' }));
    } catch (caught) {
      const error = asDataError(caught);
      setSaving((all) => ({ ...all, [id]: 'error' }));
      setLineSaid((all) => ({ ...all, [id]: error.code === 'POSTING_REFUSED' && error.details?.['reason'] === 'not-allowed' ? t('counts.notOpen', 'This count is no longer open') : refusal(t, error).message }));
    }
  };

  const submit = (event: FormEvent, line: DataRow): void => {
    event.preventDefault();
    void mark(line).then(() => scan.current?.focus());
  };

  const post = async (): Promise<void> => {
    if (sheet === null) return;
    setDialog(null);
    setProblem(null);
    setToCheck([]);
    setBusy(true);
    try {
      const fresh = (await read.get('counts', countId)) ?? sheet;
      const outcome = await runSheet({ read, move, updateEach: lineWrites.updateEach, onProgress: (done, all) => setRun({ done, all }), first: (line) => isSet(line['differs']) }, COUNT_POST, fresh, reasonId === '' ? undefined : { reason_id: reasonId });
      const noted = [...outcome.rows].filter(([, moved]) => moved.postings.some((posting) => (posting.notes ?? []).some((note) => note.note === 'to-check'))).map(([, moved]) => text(moved.row['item_name']));
      setToCheck(noted);
      if (outcome.finished) {
        const after = await read.get('counts', countId);
        toasts.push({ variant: 'success', title: t('counts.posted', 'Count posted · {count, plural, one {# line} other {# lines}} adjusted', { count: Number(after?.['differences'] ?? 0) }) });
      } else {
        const first = outcome.refused[0];
        const at = first === undefined ? null : await read.get('count_lines', first.id);
        setProblem(first === undefined ? t('counts.stopped', '{done} of {all} lines are posted. Go on when you are ready.', { done: outcome.done, all: outcome.all }) : t('counts.lineRefused', '{item}: {reason}', { item: text(at?.['item_name']), reason: refusal(t, first.error, { item: text(at?.['item_name']), unit: text(at?.['unit']), batch: text(at?.['batch_code']) }).message }));
      }
    } catch (caught) {
      const error = asDataError(caught);
      if (error.code === 'STATE_MOVE_REFUSED') {
        // The move's own rule: every line is counted before a count is posted.
        const now = await read.get('counts', countId);
        setProblem(t('counts.uncounted', '{count, plural, one {# line} other {# lines}} not counted yet', { count: Number(now?.['uncounted'] ?? 0) }));
        setOnlyDiffer(false);
        setOnly(null);
        setOnlyOpen(true);
        setPage(1);
      } else setProblem(refusal(t, error).message);
    } finally {
      setRun(null);
      setBusy(false);
      count.refetch();
      lines.refetch();
    }
  };

  const reverse = async (): Promise<void> => {
    if (sheet === null) return;
    setDialog(null);
    setProblem(null);
    setBusy(true);
    try {
      const fresh = (await read.get('counts', countId)) ?? sheet;
      const outcome = await runSheet({ read, move, updateEach: lineWrites.updateEach, onProgress: (done, all) => setRun({ done, all }) }, COUNT_UNDO, fresh);
      if (outcome.finished) toasts.push({ variant: 'success', title: t('counts.reversedToast', 'Count reversed') });
      else {
        const first = outcome.refused[0];
        const at = first === undefined ? null : await read.get('count_lines', first.id);
        setProblem(first === undefined ? t('counts.reverseStopped', 'Not every line is reversed yet. Go on when you are ready.') : t('counts.lineRefused', '{item}: {reason}', { item: text(at?.['item_name']), reason: refusal(t, first.error, { item: text(at?.['item_name']), unit: text(at?.['unit']), batch: text(at?.['batch_code']) }).message }));
      }
    } catch (caught) {
      setProblem(refusal(t, asDataError(caught)).message);
    } finally {
      setRun(null);
      setBusy(false);
      count.refetch();
      lines.refetch();
    }
  };

  const cancel = async (): Promise<void> => {
    setDialog(null);
    setBusy(true);
    try {
      await move(countId, 'cancelled');
      toasts.push({ variant: 'info', title: t('counts.cancelledToast', 'Count cancelled. Nothing was changed in stock.') });
    } catch (caught) {
      setProblem(refusal(t, asDataError(caught)).message);
    } finally {
      setBusy(false);
    }
  };

  /** A code that is on no line: an item of this place can still be added while the count is open. */
  const missing = async (code: string): Promise<void> => {
    setOffer(null);
    if (!mayAdd || status !== 'open' || sheet === null) return;
    for (const column of ['barcode', 'sku']) {
      const { rows } = await read.list('items', { filter: [{ column: 'active', op: 'eq', value: true }, { column, op: 'eq', value: code }], pageSize: 1, columns: ['id', 'name'] });
      const item = rows[0];
      if (item === undefined) continue;
      const here = await read.list('levels', { filter: [{ column: 'item_id', op: 'eq', value: text(item['id']) }, { column: 'place_id', op: 'eq', value: text(sheet['place_id']) }], pageSize: 50, columns: ['id', 'batch_code', 'unassigned'] });
      if (here.rows.length > 0) setOffer({ item: text(item['name']), levels: [...here.rows] });
      return;
    }
  };

  const add = async (level: DataRow): Promise<void> => {
    try {
      const { row } = await lineWrites.create({ count_id: countId, level_id: text(level['id']) });
      setOffer(null);
      setOnly({ itemId: text(row['item_id']), name: text(row['item_name']) });
      setPage(1);
    } catch (caught) {
      // A level already on the sheet is refused by the line's own key.
      setProblem(refusal(t, asDataError(caught)).message);
    }
  };

  const levelQty = (line: DataRow): string => plain(levels.rows.find((level) => text(level['id']) === text(line['level_id']))?.['qty'] as DataValue);
  const columns: LineColumn<DataRow>[] = [
    {
      key: 'item',
      label: t('counts.col.item', 'Item'),
      cell: (line) => (
        <Stack gap="xs">
          <span className="font-semibold text-fg">{text(line['item_name'])}</span>
          <span className="text-body-sm text-fg-muted">{text(line['batch_code']) === '' ? t('counts.noBatch', 'No batch') : t('counts.batch', 'Batch {code}', { code: text(line['batch_code']) })}</span>
        </Stack>
      ),
    },
    {
      key: 'sku',
      label: t('counts.col.sku', 'SKU'),
      cell: (line) => (
        <span dir="ltr">
          <Figure>{text(line['sku']) === '' ? '—' : text(line['sku'])}</Figure>
        </span>
      ),
    },
    {
      key: 'expected',
      label: t('counts.col.expected', 'Expected'),
      cell: (line) => {
        const counted = isSet(line['is_counted']);
        const then = plain(line['qty_when_counted'] as DataValue);
        const now = levelQty(line);
        return (
          <Stack gap="xs">
            <Figure>
              {counted ? then : now === '' ? '—' : now} {text(line['unit'])}
            </Figure>
            {counted && now !== '' && now !== then ? <span className="text-body-sm text-fg-muted">{t('counts.onHandNow', 'On hand now {qty}', { qty: now })}</span> : null}
          </Stack>
        );
      },
    },
    {
      key: 'counted',
      label: t('counts.col.counted', 'Counted'),
      cell: (line) => {
        const id = text(line['id']);
        const stored = plain(line['counted'] as DataValue);
        if (!editable || text(line['status']) !== 'open') return <Figure>{stored === '' ? '—' : stored}</Figure>;
        return (
          <form onSubmit={(event) => submit(event, line)}>
            <Stack gap="xs">
              <QtyInput id={`inventory-counted-${id}`} label={t('counts.countedFor', 'Counted, {item}', { item: text(line['item_name']) })} value={typed[id] ?? stored} onChange={(value) => setTyped((all) => ({ ...all, [id]: value }))} onBlur={() => void mark(line)} decimals={3} {...(lineSaid[id] === undefined ? {} : { error: lineSaid[id] })} />
              {saving[id] === undefined ? null : <AutosaveIndicator status={saving[id] as Saving} savingLabel={t('counts.saving', 'Saving')} savedLabel={t('counts.saved', 'Saved')} errorLabel={t('counts.notSaved', 'Not saved')} />}
              {saving[id] === 'error' ? (
                <Button variant="link" size="sm" onClick={() => void mark(line)}>
                  {t('shared.retry', 'Retry')}
                </Button>
              ) : null}
            </Stack>
          </form>
        );
      },
    },
    { key: 'difference', label: t('counts.col.difference', 'Difference'), cell: (line) => (isSet(line['is_counted']) ? <Figure>{signed(plain(line['difference'] as DataValue))}</Figure> : <span className="text-fg-muted">—</span>) },
    ...(money ? [{ key: 'value', label: t('counts.col.value', 'Value'), cell: (line: DataRow) => (isSet(line['is_counted']) ? <Figure>{text(line['value'])}</Figure> : <span className="text-fg-muted">—</span>) }] : []),
  ];

  if (!mayOpen) return <PageFrame t={t} title={t('counts.title', 'Counts')} refused />;
  if (count.loading) return <PageFrame t={t} title={t('counts.sheet.title', 'Count')} backTo={COUNTS} loading />;
  if (sheet === null) {
    return (
      <PageFrame t={t} title={t('counts.sheet.title', 'Count')} backTo={COUNTS} error={count.error} onRetry={count.refetch}>
        <EmptyState title={t('counts.missing.title', 'This count is not here')} body={t('counts.missing.body', 'It may have been removed, or you may not be able to see it.')} />
      </PageFrame>
    );
  }

  const all = Number(sheet['lines'] ?? 0);
  const countedLines = Number(sheet['counted_lines'] ?? 0);
  const started = text(sheet['at']) === '' ? '' : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(text(sheet['at'])));
  const differences = Number(sheet['differences'] ?? 0);
  return (
    <PageFrame
      t={t}
      title={t('counts.sheet.titlePlace', 'Count · {place}', { place: text(place.rows[0]?.['name']) })}
      subtitle={t('counts.sheet.subtitle', '{number} · {scope} · started {date}', { number: text(sheet['number']), scope: scopeWords(t, text(sheet['scope']), text(category.rows[0]?.['name'])), date: started })}
      backTo={COUNTS}
      status={said}
      testId="inventory-count-sheet"
      actions={<StatusPill status={status} tone={STATUS_TONE[status] ?? 'neutral'}>{statusWords(t, status)}</StatusPill>}
    >
      <Card>
        <Stack gap="md">
          <ProgressBar value={countedLines} max={Math.max(all, 1)} label={t('counts.progress', '{done} of {all} lines counted', { done: countedLines, all })} />
          <span className="text-body-sm text-fg-muted">{t('counts.progress', '{done} of {all} lines counted', { done: countedLines, all })}</span>
          {status === 'open' ? (
            <FindOrScan
              t={t}
              inputRef={scan}
              table="count_lines"
              where={[{ column: 'count_id', op: 'eq', value: countId }]}
              codes={['barcode', 'sku']}
              name="item_name"
              columns={LINE}
              hint={t('counts.scan.hint', 'Scan or type an item to jump to its line.')}
              missing={(code) => {
                void missing(code);
                return t('counts.scan.unknown', 'Not in this count · {code}', { code });
              }}
              onFound={(line) => {
                focusLine.current = null;
                setOnlyDiffer(false);
                setOnlyOpen(false);
                setOnly({ itemId: text(line['item_id']), name: text(line['item_name']) });
                setPage(1);
                say(t('counts.scan.now', 'Now on {item}', { item: text(line['item_name']) }));
              }}
            />
          ) : null}
          {offer === null ? null : (
            <Alert
              tone="info"
              title={t('counts.add.title', '{item} is in this place and not on this count', { item: offer.item })}
              action={
                <Stack direction="row" gap="xs" wrap>
                  {offer.levels.map((level) => (
                    <Button key={text(level['id'])} variant="secondary" size="sm" onClick={() => void add(level)}>
                      {text(level['batch_code']) === '' ? t('counts.add.plain', 'Add {item} to this count', { item: offer.item }) : t('counts.add.batch', 'Add batch {code}', { code: text(level['batch_code']) })}
                    </Button>
                  ))}
                </Stack>
              }
            />
          )}
          <Stack direction="row" gap="md" align="center" wrap>
            <Switch
              label={t('counts.filter.differ', 'Only differences')}
              checked={onlyDiffer}
              onCheckedChange={(next) => {
                setOnlyDiffer(next);
                setPage(1);
              }}
            />
            <Switch
              label={t('counts.filter.open', 'Not counted')}
              checked={onlyOpen}
              onCheckedChange={(next) => {
                setOnlyOpen(next);
                setPage(1);
              }}
            />
            {only === null ? null : (
              <Stack direction="row" gap="xs" align="center">
                <Tag tone="accent">{t('counts.filter.item', 'Showing {item}', { item: only.name })}</Tag>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    setOnly(null);
                    setPage(1);
                  }}
                >
                  {t('counts.filter.all', 'Show all')}
                </Button>
              </Stack>
            )}
          </Stack>
          <LinesTable
            label={t('counts.lines', 'Lines')}
            columns={columns}
            lines={lines.rows}
            lineKey={(line) => text(line['id'])}
            lineLabel={(line) => text(line['item_name'])}
            loading={lines.loading}
            cardsBelow={900}
            empty={
              <EmptyState
                compact
                title={onlyDiffer ? t('counts.empty.differ', 'No differences so far') : onlyOpen ? t('counts.empty.open', 'Every line is counted') : t('counts.empty.lines', 'This count has no lines')}
                {...(onlyOpen ? { body: t('counts.empty.openBody', 'Nothing is left to count here.') } : {})}
              />
            }
          />
          {page > 1 || lines.hasMore ? (
            <Pagination page={page} pageCount={lines.hasMore ? page + 1 : page} onPageChange={setPage} label={t('counts.linePages', 'Pages of lines')} previousLabel={t('shared.previous', 'Previous')} nextLabel={t('shared.next', 'Next')} pageLabel={(n) => t('shared.pageN', 'Page {n}', { n })} />
          ) : null}
          {toCheck.length === 0 ? null : <Alert tone="warn" title={t('counts.toCheck.title', 'Sold from since they were counted')} body={t('counts.toCheck.body', 'These were adjusted and stay marked to check: {items}', { items: toCheck.join(', ') })} />}
        </Stack>
      </Card>
      <TotalsBar
        label={t('counts.bar', 'This count')}
        totals={money ? t('counts.totalsMoney', '{count, plural, one {# difference} other {# differences}} · {value}', { count: differences, value: text(sheet['value']) }) : t('counts.totals', '{count, plural, one {# difference} other {# differences}}', { count: differences })}
        problem={problem}
        progress={run === null ? null : <ProgressBar value={run.done} max={Math.max(run.all, 1)} label={t('shared.progress', '{done} of {all} lines', { done: run.done, all: run.all })} />}
      >
        {status === 'open' && mayCancel ? (
          <Button variant="ghost" disabled={busy} onClick={() => setDialog('cancel')}>
            {t('counts.cancel', 'Cancel count')}
          </Button>
        ) : null}
        {status === 'open' || status === 'posting' ? (
          <Button variant="secondary" disabled={busy} onClick={() => void navigate({ to: COUNTS })}>
            {t('counts.doneForNow', 'Done for now')}
          </Button>
        ) : null}
        {(status === 'open' || status === 'posting') && mayPost ? (
          <Button variant="primary" loading={busy} disabled={busy} onClick={() => (status === 'posting' ? void post() : setDialog('post'))}>
            {status === 'posting' ? t('shared.continuePosting', 'Continue posting') : t('counts.post', 'Post count')}
          </Button>
        ) : null}
        {status === 'open' && !mayPost && mayMark ? <span className="text-body-sm text-fg-muted">{t('counts.askManager', 'Ask a stock manager to post this count')}</span> : null}
        {(status === 'posted' || status === 'reversing') && mayReverse ? (
          <Button variant="destructive" loading={busy} disabled={busy} onClick={() => (status === 'reversing' ? void reverse() : setDialog('reverse'))}>
            {status === 'reversing' ? t('counts.reverseContinue', 'Continue reversing') : t('counts.reverse', 'Reverse count…')}
          </Button>
        ) : null}
      </TotalsBar>
      <Dialog open={dialog !== null} onOpenChange={(next) => (next ? undefined : setDialog(null))} size="md">
        <DialogHeader
          {...(dialog === 'post' ? {} : { tone: 'danger' as const })}
          title={dialog === 'post' ? t('counts.post.title', 'Post this count?') : dialog === 'reverse' ? t('counts.reverse.title', 'Reverse this count?') : t('counts.cancel.title', 'Cancel this count?')}
          closeLabel={t('shared.close', 'Close')}
        />
        <DialogBody>
          {dialog === 'cancel' ? (
            t('counts.cancel.body', 'Nothing was posted, so nothing changes in stock. The counts typed so far are kept with the cancelled count.')
          ) : (
            <Stack gap="md">
              <span>
                {dialog === 'post'
                  ? t('counts.post.body', '{count, plural, one {# line} other {# lines}} will be adjusted. A stock manager can reverse a posted count.', { count: differences })
                  : t('counts.reverse.body', '{count, plural, one {# line} other {# lines}} will be put back as they were. A batch that would go below zero is refused, and named.', { count: differences })}
              </span>
              <Stack gap="xs">
                {differing.rows.map((line) => (
                  <Stack key={text(line['id'])} direction="row" justify="between" gap="md">
                    <span>
                      {text(line['item_name'])}
                      {text(line['batch_code']) === '' ? '' : ` · ${text(line['batch_code'])}`}
                    </span>
                    <Figure>
                      {signed(plain(line['difference'] as DataValue))} {text(line['unit'])}
                    </Figure>
                  </Stack>
                ))}
                {differences > differing.rows.length ? <span className="text-body-sm text-fg-muted">{t('counts.post.more', 'and {count} more', { count: differences - differing.rows.length })}</span> : null}
              </Stack>
              {dialog === 'post' ? <Select label={t('counts.post.reason', 'Reason')} value={reasonId} onChange={(event) => setReasonId(event.target.value)} options={reasons.rows.map((reason) => ({ value: text(reason['id']), label: text(reason['label']) }))} /> : null}
            </Stack>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setDialog(null)}>
            {t('shared.cancel', 'Cancel')}
          </Button>
          <Button variant={dialog === 'post' ? 'primary' : 'destructive'} onClick={() => (dialog === 'post' ? void post() : dialog === 'reverse' ? void reverse() : void cancel())}>
            {dialog === 'post' ? t('counts.post', 'Post count') : dialog === 'reverse' ? t('counts.reverse.yes', 'Reverse count') : t('counts.cancel', 'Cancel count')}
          </Button>
        </DialogFooter>
      </Dialog>
    </PageFrame>
  );
}

/** A difference keeps its sign beside the figure: more than the books held reads `+2`. */
function signed(value: string): string {
  return value === '' || value.startsWith('-') || !/[1-9]/.test(value) ? value : `+${value}`;
}
