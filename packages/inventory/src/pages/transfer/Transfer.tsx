/**
 * TRANSFER: stock moved from one place to another, line by line.
 *
 * Receive's second form with two places and no cost. Each line posts an out
 * and an in that belong together, so the item's total does not move. A line
 * above what the books hold is not refused: it goes through and is told.
 *
 * The two places are set when the transfer is made and never after; a wrong
 * place is a new transfer.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { FindOrScan, ITEM_COLUMNS } from '../shared/FindOrScan.tsx';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Grid,
  IconButton,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Figure,
  ProgressBar,
  Select,
  Stack,
  Tag,
  asDataError,
  listAll,
  lucideByName,
  useAccess,
  useAppToasts,
  useNavigate,
  useRead,
  useRecords,
  useStateMove,
  useTreeWrite,
  useWrite,
  type AddOnTranslate,
  type DataRow,
  type DataValue,
} from '../shared/host.ts';
import { LinesTable, type LineColumn } from '../shared/LinesTable.tsx';
import { PageFrame, useSaid } from '../shared/PageFrame.tsx';
import { QtyInput } from '../shared/QtyInput.tsx';
import { refusal } from '../shared/refusal.ts';
import { TRANSFER_POST, TRANSFER_UNDO, runSheet } from '../shared/runSheet.ts';
import { TotalsBar } from '../shared/TotalsBar.tsx';
import { plain, plusOne, positive } from '../receive/lines.ts';

const PAGE = '/add-ons/inventory/inventory-transfer';
const LIST = '/p/inventory-transfers';
const text = (value: unknown): string => (value === null || value === undefined ? '' : String(value));
const truthy = (value: unknown): boolean => value === true || value === 1 || value === '1';

export interface MoveLine {
  key: string;
  id: string | null;
  itemId: string;
  itemName: string;
  sku: string;
  unit: string;
  decimals: number;
  tracks: boolean;
  batchId: string;
  qty: string;
  status: string;
  dirty: boolean;
  /** Told by the ledger when the line went in: more than the books held. */
  short: boolean;
}

let made = 0;

function lineOf(row: DataRow, item: DataRow | undefined): MoveLine {
  return {
    key: `row-${text(row['id'])}`,
    id: text(row['id']),
    itemId: text(row['item_id']),
    itemName: text(row['item_name']),
    sku: text(item?.['sku']),
    unit: text(row['unit']),
    decimals: Number(item?.['decimals'] ?? 0) || 0,
    tracks: truthy(item?.['tracks_batches']),
    batchId: text(row['batch_id']),
    qty: plain(row['qty'] as DataValue),
    status: text(row['status']) || 'draft',
    dirty: false,
    short: false,
  };
}

const valuesOf = (line: MoveLine): Record<string, DataValue> => ({ item_id: line.itemId, qty: line.qty, batch_id: line.batchId === '' ? null : line.batchId });

export function Transfer({ t, transferId }: { t: AddOnTranslate; transferId: string | null }): ReactNode {
  const access = useAccess();
  const read = useRead();
  const toasts = useAppToasts();
  const navigate = useNavigate();
  const [said, say] = useSaid();
  const mayOpen = access.canRead('transfers');
  const mayUndo = access.canMove('transfers', 'reversing', 'done');
  const transfers = useTreeWrite('transfers');
  const lineWrites = useWrite('transfer_lines');
  const move = useStateMove('transfers');
  const places = useRecords('places', { filter: [{ column: 'active', op: 'eq', value: true }], sort: [{ column: 'name', direction: 'asc' }], pageSize: 199, columns: ['id', 'name'], enabled: mayOpen });

  const [sheet, setSheet] = useState<DataRow | null | 'missing'>(transferId === null ? null : 'missing');
  const [ready, setReady] = useState(transferId === null);
  const [failed, setFailed] = useState<ReturnType<typeof asDataError> | null>(null);
  const [lines, setLines] = useState<MoveLine[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [busy, setBusy] = useState<'save' | 'post' | 'undo' | null>(null);
  const [run, setRun] = useState<{ done: number; all: number } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [toSaid, setToSaid] = useState<string | null>(null);
  const [lineSaid, setLineSaid] = useState<Readonly<Record<string, string>>>({});
  const [confirmUndo, setConfirmUndo] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    if (transferId === null) return;
    try {
      const row = await read.get('transfers', transferId);
      if (row === null) {
        setSheet('missing');
        setReady(true);
        return;
      }
      const saved = await listAll(read, 'transfer_lines', { filter: [{ column: 'transfer_id', op: 'eq', value: transferId }], sort: [{ column: 'id', direction: 'asc' }] });
      const ids = [...new Set(saved.map((line) => text(line['item_id'])))];
      const items = new Map<string, DataRow>();
      for (let start = 0; start < ids.length; start += 100) {
        const { rows } = await read.list('items', { filter: [{ column: 'id', op: 'in', value: ids.slice(start, start + 100) }], columns: ITEM_COLUMNS, pageSize: 100 });
        for (const item of rows) items.set(text(item['id']), item);
      }
      setSheet(row);
      setFromId(text(row['from_place_id']));
      setToId(text(row['to_place_id']));
      setLines((before) => {
        const told = new Set(before.filter((line) => line.short).map((line) => line.id));
        return saved.map((line) => ({ ...lineOf(line, items.get(text(line['item_id']))), short: told.has(text(line['id'])) }));
      });
      setRemoved([]);
      setFailed(null);
      setReady(true);
    } catch (caught) {
      setFailed(asDataError(caught));
    }
  }, [read, transferId]);

  useEffect(() => {
    if (mayOpen) void load();
  }, [load, mayOpen]);

  const saved = sheet !== null && sheet !== 'missing' ? sheet : null;
  const status = text(saved?.['status']) || 'draft';
  const open = status === 'draft';
  const typed = lines.filter((line) => line.status === 'draft' && line.qty.trim() !== '');
  const dirty = removed.length > 0 || lines.some((line) => line.dirty);
  const working = busy !== null;

  const change = (key: string, patch: Partial<MoveLine>): void => {
    setLines((all) => all.map((line) => (line.key === key ? { ...line, ...patch, dirty: true } : line)));
    setLineSaid((all) => Object.fromEntries(Object.entries(all).filter(([k]) => k !== key)));
  };

  const found = (item: DataRow): void => {
    const itemId = text(item['id']);
    const last = [...lines].reverse().find((line) => line.itemId === itemId && line.status === 'draft');
    if (last !== undefined) {
      const qty = plusOne(last.qty);
      change(last.key, { qty });
      say(t('transfer.scan.raised', '{item} · now {qty} {unit}', { item: last.itemName, qty, unit: last.unit }));
      return;
    }
    const line: MoveLine = { key: `new-${String((made += 1))}`, id: null, itemId, itemName: text(item['name']), sku: text(item['sku']), unit: text(item['unit']), decimals: Number(item['decimals'] ?? 0) || 0, tracks: truthy(item['tracks_batches']), batchId: '', qty: '1', status: 'draft', dirty: true, short: false };
    setLines((all) => [...all, line]);
    say(t('transfer.scan.added', '{item} added · 1 {unit}', { item: line.itemName, unit: line.unit }));
  };

  const save = async (): Promise<string | null> => {
    setProblem(null);
    setToSaid(null);
    setLineSaid({});
    const bad = typed.find((line) => !positive(line.qty));
    if (bad !== undefined) {
      setLineSaid({ [bad.key]: t('transfer.err.qty', 'Enter how many you are moving') });
      setProblem(t('transfer.fixFirst', 'A line needs fixing first'));
      return null;
    }
    if (saved === null) {
      if (fromId === '' || toId === '') {
        setProblem(t('transfer.choosePlaces', 'Choose where the stock comes from and where it goes'));
        return null;
      }
      // The page will not save one place twice; Adminium refuses it too, in its own words.
      if (fromId === toId) {
        setToSaid(t('transfer.samePlace', 'Choose a different place'));
        return null;
      }
      if (typed.length === 0) {
        setProblem(t('transfer.nothing', 'Add something to move first'));
        return null;
      }
      try {
        const made_ = await transfers.create({ values: { from_place_id: fromId, to_place_id: toId }, children: { transfer_lines: typed.map((line) => ({ values: valuesOf(line) })) } });
        return text(made_.row['id']);
      } catch (caught) {
        setProblem(refusal(t, asDataError(caught)).message);
        return null;
      }
    }
    const id = text(saved['id']);
    try {
      for (const gone of removed) await lineWrites.remove(gone);
      setRemoved([]);
    } catch (caught) {
      setProblem(refusal(t, asDataError(caught)).message);
      return null;
    }
    for (const line of lines) {
      if (line.status !== 'draft' || !line.dirty) continue;
      try {
        if (line.id === null) {
          if (line.qty.trim() === '') continue;
          const row = await lineWrites.create({ transfer_id: id, ...valuesOf(line) });
          setLines((all) => all.map((candidate) => (candidate.key === line.key ? { ...candidate, id: text(row.row['id']), dirty: false } : candidate)));
        } else if (line.qty.trim() === '') await lineWrites.remove(line.id);
        else {
          await lineWrites.update(line.id, valuesOf(line));
          setLines((all) => all.map((candidate) => (candidate.key === line.key ? { ...candidate, dirty: false } : candidate)));
        }
      } catch (caught) {
        const words = refusal(t, asDataError(caught), { item: line.itemName, unit: line.unit });
        setLineSaid((all) => ({ ...all, [line.key]: words.message }));
        setProblem(t('transfer.lineRefused', '{item}: {reason}', { item: line.itemName, reason: words.message }));
        return null;
      }
    }
    return id;
  };

  const after = async (id: string): Promise<void> => {
    if (saved === null) await navigate({ to: PAGE, search: { transfer: id }, replace: true });
    else await load();
  };

  const saveDraft = async (): Promise<void> => {
    setBusy('save');
    try {
      const id = await save();
      if (id === null) return;
      toasts.push({ variant: 'success', title: t('transfer.draftSaved', 'Draft saved. Find it under Transfers.') });
      await after(id);
    } finally {
      setBusy(null);
    }
  };

  const go = async (which: 'post' | 'undo'): Promise<void> => {
    setConfirmUndo(false);
    setBusy(which);
    try {
      const id = which === 'post' ? await save() : text(saved?.['id']);
      if (id === null || id === '') return;
      const row = await read.get('transfers', id);
      if (row === null) return;
      const outcome = await runSheet({ read, move, updateEach: lineWrites.updateEach, onProgress: (done, all) => setRun({ done, all }) }, which === 'post' ? TRANSFER_POST : TRANSFER_UNDO, row);
      // What the ledger told of a line that went in: more was moved than the books held.
      const told = [...outcome.rows].filter(([, moved]) => moved.postings.some((posting) => (posting.notes ?? []).some((note) => note.note === 'short')));
      const short = new Set(told.map(([key]) => key));
      if (short.size > 0) {
        setLines((all) => all.map((line) => (line.id !== null && short.has(line.id) ? { ...line, short: true } : line)));
        // Said in a toast too: a transfer saved a moment ago is drawn again from the server, which keeps no note.
        toasts.push({ variant: 'warning', title: t('transfer.shortToast', 'More was moved than the books held: {items}', { items: told.map(([, moved]) => text(moved.row['item_name'])).join(', ') }), duration: null });
      }
      if (outcome.finished) toasts.push({ variant: 'success', title: which === 'post' ? t('transfer.done', 'Transfer done') : t('transfer.undone', 'Transfer undone') });
      else {
        const first = outcome.refused[0];
        const at = first === undefined ? undefined : lines.find((line) => line.id === first.id);
        const words = first === undefined ? null : refusal(t, first.error, at === undefined ? {} : { item: at.itemName, unit: at.unit });
        if (at !== undefined && words !== null) setLineSaid({ [at.key]: words.message });
        setProblem(words === null ? t('transfer.stopped', '{done} of {all} lines are done. Go on when you are ready.', { done: outcome.done, all: outcome.all }) : t('transfer.lineRefused', '{item}: {reason}', { item: at?.itemName ?? '', reason: words.message }));
      }
      await after(id);
    } catch (caught) {
      const error = asDataError(caught);
      const words = refusal(t, error);
      // The planner's own word for two places that are one.
      if (error.code === 'POSTING_REFUSED' && error.details?.['reason'] === 'not-allowed') setToSaid(t('transfer.samePlace', 'Choose a different place'));
      else setProblem(words.message);
      if (saved !== null) await load();
    } finally {
      setRun(null);
      setBusy(null);
    }
  };

  const placeName = (id: string): string => text(places.rows.find((place) => text(place['id']) === id)?.['name']);
  const columns = useMemo<LineColumn<MoveLine>[]>(
    () => [
      {
        key: 'item',
        label: t('transfer.col.item', 'Item'),
        cell: (line) => (
          <Stack gap="xs">
            <span className="font-semibold text-fg">{line.itemName}</span>
            {line.sku === '' ? null : (
              <span dir="ltr">
                <Figure>{line.sku}</Figure>
              </span>
            )}
          </Stack>
        ),
      },
      { key: 'batch', label: t('transfer.col.batch', 'Batch'), cell: (line) => (line.tracks ? <BatchSelect t={t} line={line} fromId={fromId} disabled={working || line.status !== 'draft'} onChange={(batchId) => change(line.key, { batchId })} /> : <span className="text-fg-muted">—</span>) },
      {
        key: 'qty',
        label: t('transfer.col.qty', 'Quantity'),
        cell: (line) => (
          <Stack gap="xs">
            <QtyInput label={t('transfer.col.qty', 'Quantity')} value={line.qty} onChange={(qty) => change(line.key, { qty })} decimals={line.decimals} unit={line.unit} disabled={working || line.status !== 'draft'} {...(lineSaid[line.key] === undefined ? {} : { error: lineSaid[line.key] })} />
            {line.short ? <Tag tone="warn">{t('transfer.short', 'More than the books held')}</Tag> : null}
            {line.status === 'posted' ? <Tag tone="pos">{t('transfer.lineDone', 'Moved')}</Tag> : null}
            {line.status === 'reversed' ? <Tag tone="warn">{t('transfer.lineUndone', 'Undone')}</Tag> : null}
          </Stack>
        ),
      },
    ],
    [t, fromId, working, lineSaid],
  );

  if (!mayOpen) return <PageFrame t={t} title={t('transfer.title', 'Transfer stock')} refused />;
  if (transferId !== null && ready && sheet === 'missing') {
    return (
      <PageFrame t={t} title={t('transfer.title', 'Transfer stock')} backTo={LIST}>
        <EmptyState title={t('transfer.missing.title', 'This transfer is not here')} body={t('transfer.missing.body', 'It may have been removed, or you may not be able to see it.')} />
      </PageFrame>
    );
  }
  if (!ready) return <PageFrame t={t} title={t('transfer.title', 'Transfer stock')} backTo={LIST} loading={failed === null} error={failed} onRetry={() => void load()} />;

  const Trash = lucideByName('trash-2');
  const placeOptions = [{ value: '', label: t('transfer.choose', 'Choose a place') }, ...places.rows.map((place) => ({ value: text(place['id']), label: text(place['name']) }))];
  const ended = status === 'done' || status === 'reversing' || status === 'reversed';
  return (
    <PageFrame t={t} title={t('transfer.title', 'Transfer stock')} subtitle={text(saved?.['number'])} backTo={LIST} status={said} testId="inventory-transfer">
      {status === 'posting' ? <Alert tone="warn" title={t('transfer.posting', 'This transfer is partly done. Go on when you are ready.')} /> : null}
      {status === 'reversing' ? <Alert tone="warn" title={t('transfer.reversing', 'This transfer is partly undone. Go on when you are ready.')} /> : null}
      {status === 'reversed' ? <Alert tone="info" title={t('transfer.reversed', 'This transfer was undone.')} /> : null}
      <Card title={t('transfer.places', 'From and to')}>
        <Grid columns={2} gap="md">
          {saved === null ? <Select label={t('transfer.from', 'From')} value={fromId} onChange={(event) => setFromId(event.target.value)} options={placeOptions} disabled={working} required /> : <Fixed label={t('transfer.from', 'From')} value={placeName(fromId)} />}
          {saved === null ? (
            <Select
              label={t('transfer.to', 'To')}
              value={toId}
              onChange={(event) => {
                setToId(event.target.value);
                setToSaid(null);
              }}
              options={placeOptions}
              disabled={working}
              required
              {...(toSaid === null ? {} : { error: toSaid })}
            />
          ) : (
            <Stack gap="xs">
              <Fixed label={t('transfer.to', 'To')} value={placeName(toId)} />
              {toSaid === null ? null : <Alert tone="danger" role="alert" title={toSaid} />}
            </Stack>
          )}
        </Grid>
      </Card>
      <Card title={t('transfer.lines', 'Lines')} description={t('transfer.lineCount', '{count, plural, one {# line} other {# lines}}', { count: lines.length })}>
        <Stack gap="md">
          {open ? <FindOrScan t={t} onFound={found} disabled={working} hint={t('transfer.scan.hint', 'A scanner types into this field. Each scan adds one.')} /> : null}
          <LinesTable
            label={t('transfer.lines', 'Lines')}
            columns={columns}
            lines={lines}
            lineKey={(line) => line.key}
            lineLabel={(line) => line.itemName}
            empty={<EmptyState compact title={t('transfer.empty.title', 'Nothing added yet')} body={t('transfer.empty.body', "Scan an item or type its name above. Each item you add becomes a line.")} />}
            under={(line) =>
              open && line.status === 'draft' ? (
                <Stack direction="row" justify="end">
                  <IconButton
                    label={t('transfer.remove', 'Remove {item}', { item: line.itemName })}
                    variant="ghost"
                    disabled={working}
                    onClick={() => {
                      setLines((all) => all.filter((candidate) => candidate.key !== line.key));
                      if (line.id !== null) setRemoved((ids) => [...ids, line.id as string]);
                    }}
                  >
                    <Trash />
                  </IconButton>
                </Stack>
              ) : null
            }
          />
        </Stack>
      </Card>
      <TotalsBar
        label={t('transfer.bar', 'This transfer')}
        totals={saved !== null && !dirty ? t('transfer.totals', 'Moving {count, plural, one {# line} other {# lines}}', { count: Number(saved['lines'] ?? lines.length) }) : t('transfer.totalsTyped', '{count, plural, one {# line} other {# lines}} to move', { count: typed.length })}
        problem={problem}
        progress={run === null ? null : <ProgressBar value={run.done} max={Math.max(run.all, 1)} label={t('shared.progress', '{done} of {all} lines', { done: run.done, all: run.all })} />}
      >
        {open ? (
          <Button variant="secondary" loading={busy === 'save'} disabled={working} onClick={() => void saveDraft()}>
            {t('transfer.saveDraft', 'Save as draft')}
          </Button>
        ) : null}
        {open || status === 'posting' ? (
          <Button variant="primary" loading={busy === 'post'} disabled={working} onClick={() => void go('post')}>
            {status === 'posting' ? t('shared.continuePosting', 'Continue posting') : t('transfer.finish', 'Done')}
          </Button>
        ) : null}
        {ended && mayUndo && status !== 'reversed' ? (
          <Button variant="destructive" loading={busy === 'undo'} disabled={working} onClick={() => (status === 'reversing' ? void go('undo') : setConfirmUndo(true))}>
            {status === 'reversing' ? t('transfer.undoContinue', 'Continue undoing') : t('transfer.undo', 'Undo this transfer')}
          </Button>
        ) : null}
      </TotalsBar>
      <Dialog open={confirmUndo} onOpenChange={(next) => (next ? undefined : setConfirmUndo(false))} size="sm">
        <DialogHeader tone="danger" title={t('transfer.undo.title', 'Undo this transfer?')} closeLabel={t('shared.close', 'Close')} />
        <DialogBody>{t('transfer.undo.body', 'Every line is moved back, one by one. A line whose stock has already been used cannot be undone, and is named.')}</DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setConfirmUndo(false)}>
            {t('shared.cancel', 'Cancel')}
          </Button>
          <Button variant="destructive" onClick={() => void go('undo')}>
            {t('transfer.undo', 'Undo this transfer')}
          </Button>
        </DialogFooter>
      </Dialog>
    </PageFrame>
  );
}

function Fixed({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <Stack gap="xs">
      <span className="text-body-sm text-fg-muted">{label}</span>
      <span className="text-fg">{value === '' ? '—' : value}</span>
    </Stack>
  );
}

/** The batches of an item that have stock where the transfer comes from. */
function BatchSelect({ t, line, fromId, disabled, onChange }: { t: AddOnTranslate; line: MoveLine; fromId: string; disabled: boolean; onChange: (batchId: string) => void }): ReactNode {
  const levels = useRecords('levels', { filter: [{ column: 'item_id', op: 'eq', value: line.itemId }, { column: 'place_id', op: 'eq', value: fromId }, { column: 'qty', op: 'gt', value: 0 }], sort: [{ column: 'expires_on', direction: 'asc' }], pageSize: 100, columns: ['id', 'batch_id', 'batch_code', 'unassigned', 'qty'], enabled: fromId !== '' });
  const options = [
    { value: '', label: t('transfer.batch.any', 'Earliest expiry first') },
    ...levels.rows.filter((level) => !truthy(level['unassigned'])).map((level) => ({ value: text(level['batch_id']), label: t('transfer.batch.option', '{code} · {qty} {unit}', { code: text(level['batch_code']), qty: plain(level['qty'] as DataValue), unit: line.unit }) })),
  ];
  // A saved batch that has no stock left here is still the one the line names.
  if (line.batchId !== '' && !options.some((option) => option.value === line.batchId)) options.push({ value: line.batchId, label: t('transfer.batch.kept', 'The batch chosen before') });
  return <Select aria-label={t('transfer.col.batch', 'Batch')} value={line.batchId} onChange={(event) => onChange(event.target.value)} options={options} disabled={disabled} />;
}
