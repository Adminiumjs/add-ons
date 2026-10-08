/**
 * RECEIVE: a delivery typed or scanned in, saved as a draft, and posted line
 * by line.
 *
 * With a purchase order the lines are the order's, and the place is the
 * order's; with none, every scan adds a line and the place is chosen. What
 * was typed stays on the screen whatever Adminium answers; what Adminium
 * decided — the units, the cost it used, the amount, what is on hand — is
 * read back from it and shown from there.
 *
 * The same screen takes a draft up again, goes on with a receipt whose
 * posting broke off, and shows a posted one with its ways back (`Posted.tsx`).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { FindOrScan, ITEM_COLUMNS } from '../shared/FindOrScan.tsx';
import {
  Alert,
  Button,
  Card,
  DateInput,
  EmptyState,
  Field,
  Grid,
  IconButton,
  Input,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Figure,
  NumberInput,
  ProgressBar,
  Select,
  Stack,
  Tag,
  asDataError,
  listAll,
  lucideByName,
  useMoney,
  useAccess,
  useAppToasts,
  useLocaleTag,
  useNavigate,
  useRead,
  useRecords,
  useStateMove,
  useTreeWrite,
  useWrite,
  type AddOnTranslate,
  type DataRow,
  type Reads,
} from '../shared/host.ts';
import { LinesTable, type LineColumn } from '../shared/LinesTable.tsx';
import { PageFrame, useSaid } from '../shared/PageFrame.tsx';
import { QtyInput } from '../shared/QtyInput.tsx';
import { refusal } from '../shared/refusal.ts';
import { RECEIPT_POST, runSheet } from '../shared/runSheet.ts';
import { TotalsBar } from '../shared/TotalsBar.tsx';
import { countProblems, lineForItem, lineValues, mergeLines, plain, plusOne, positive, problemsOf, typedOn, type Line, type Problems } from './lines.ts';
import { against, times, wholeTimes } from '../shared/sums.ts';
import { NewItemSheet } from './NewItemSheet.tsx';
import { Posted } from './Posted.tsx';

const PAGE = '/add-ons/inventory/inventory-receive';
const LINE_BASE = ['id', 'receipt_id', 'po_line_id', 'item_id', 'item_name', 'unit', 'packs', 'pack_size', 'qty_typed', 'qty', 'batch_code', 'expires_on', 'status'] as const;
const LINE_COSTS = ['unit_cost', 'cost_used', 'amount'] as const;
const PO_LINE = ['id', 'po_id', 'item_id', 'item_name', 'unit', 'supplier_code', 'pack_name', 'packs', 'pack_size', 'qty', 'received', 'open_qty'] as const;
const ORDER = ['id', 'number', 'supplier_id', 'supplier_name', 'sent_at', 'expected_on', 'place_id', 'place_name', 'status', 'closed_at'] as const;

const text = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

export interface Loaded {
  receipt: DataRow | null;
  order: DataRow | null;
  lines: Line[];
}

/** Everything one receipt shows, read as it stands now. */
export async function loadReceipt(read: Reads, at: { receiptId: string | null; poId: string | null }, costs: boolean, totals: boolean): Promise<Loaded | 'missing'> {
  const receipt = at.receiptId === null ? null : await read.get('receipts', at.receiptId);
  if (at.receiptId !== null && receipt === null) return 'missing';
  const orderId = receipt === null ? at.poId : text(receipt['po_id']) || null;
  const order = orderId === null ? null : await read.get('purchase_orders', orderId);
  if (receipt === null && at.poId !== null && order === null) return 'missing';
  const poLines = order === null ? [] : await listAll(read, 'po_lines', { filter: [{ column: 'po_id', op: 'eq', value: text(order['id']) }], sort: [{ column: 'id', direction: 'asc' }], columns: costs ? [...PO_LINE, 'unit_cost'] : PO_LINE });
  const saved =
    receipt === null
      ? []
      : await listAll(read, 'receipt_lines', { filter: [{ column: 'receipt_id', op: 'eq', value: text(receipt['id']) }], sort: [{ column: 'id', direction: 'asc' }], columns: costs ? [...LINE_BASE, ...LINE_COSTS] : LINE_BASE });
  const ids = [...new Set([...poLines, ...saved].map((row) => text(row['item_id'])))];
  const items = new Map<string, DataRow>();
  for (let start = 0; start < ids.length; start += 100) {
    const { rows } = await read.list('items', { filter: [{ column: 'id', op: 'in', value: ids.slice(start, start + 100) }], columns: ITEM_COLUMNS, pageSize: 100 });
    for (const row of rows) items.set(text(row['id']), row);
  }
  void totals;
  // An order's lines still to come are offered while the receipt can still take lines.
  const open = receipt === null || receipt['status'] === 'draft' ? poLines : [];
  return { receipt, order, lines: mergeLines(saved, open, items) };
}

export interface ReceiveProps {
  t: AddOnTranslate;
  receiptId: string | null;
  poId: string | null;
}

interface Run {
  done: number;
  all: number;
}

export function Receive({ t, receiptId, poId }: ReceiveProps): ReactNode {
  const access = useAccess();
  const read = useRead();
  const toasts = useAppToasts();
  const navigate = useNavigate();
  const [said, say] = useSaid();
  const [scanned, setScanned] = useState('');
  const locale = useLocaleTag();
  const cash = useMoney();
  const costs = access.canRead('receipt_lines', LINE_COSTS);
  const totals = access.canRead('receipts', ['total']);
  const mayPost = access.canMove('receipts', 'posting', 'draft');
  const mayAddItem = access.canCreate('items');
  const mayOpen = access.canRead('receipts');

  const receipts = useTreeWrite('receipts');
  const lineWrites = useWrite('receipt_lines');
  const moveReceipt = useStateMove('receipts');

  const places = useRecords('places', { filter: [{ column: 'active', op: 'eq', value: true }], sort: [{ column: 'name', direction: 'asc' }], pageSize: 199, columns: ['id', 'name'], enabled: mayOpen });
  const suppliers = useRecords('suppliers', { filter: [{ column: 'active', op: 'eq', value: true }], sort: [{ column: 'name', direction: 'asc' }], pageSize: 199, columns: ['id', 'name'], enabled: mayOpen });
  const settings = useRecords('settings', { pageSize: 1, columns: ['default_place_id'], enabled: mayOpen });
  const orders = useRecords('purchase_orders', { filter: [{ column: 'status', op: 'in', value: ['sent', 'part_received'] }], sort: [{ column: 'sent_at', direction: 'desc' }], pageSize: 50, columns: ORDER, enabled: mayOpen });

  const [loaded, setLoaded] = useState<Loaded | 'missing' | null>(null);
  const [failed, setFailed] = useState<ReturnType<typeof asDataError> | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [placeId, setPlaceId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [busy, setBusy] = useState<'save' | 'post' | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [marked, setMarked] = useState<Problems>({});
  const [lineSaid, setLineSaid] = useState<Readonly<Record<string, { field?: string; message: string }>>>({});
  const [confirmSaid, setConfirmSaid] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<string | null>(null);
  const [switchTo, setSwitchTo] = useState<string | null>(null);
  const scan = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async (): Promise<Loaded | 'missing' | null> => {
    try {
      const next = await loadReceipt(read, { receiptId, poId }, costs, totals);
      setFailed(null);
      setLoaded(next);
      if (next !== 'missing') {
        setLines(next.lines);
        setRemoved([]);
        if (next.receipt !== null) {
          setPlaceId(text(next.receipt['place_id']));
          setSupplierId(text(next.receipt['supplier_id']));
        } else if (next.order !== null) setPlaceId(text(next.order['place_id']));
      }
      return next;
    } catch (caught) {
      setFailed(asDataError(caught));
      return null;
    }
  }, [read, receiptId, poId, costs, totals]);

  useEffect(() => {
    if (mayOpen) void load();
  }, [load, mayOpen]);

  // With no order and no draft, the place starts as the one the settings name.
  const defaultPlace = text(settings.rows[0]?.['default_place_id']);
  useEffect(() => {
    if (receiptId === null && poId === null && placeId === '' && defaultPlace !== '') setPlaceId(defaultPlace);
  }, [receiptId, poId, placeId, defaultPlace]);

  const receipt = loaded !== null && loaded !== 'missing' ? loaded.receipt : null;
  const order = loaded !== null && loaded !== 'missing' ? loaded.order : null;
  const status = text(receipt?.['status']) || 'draft';
  const typed = lines.filter((line) => line.status === 'draft' && typedOn(line));
  const dirty = removed.length > 0 || lines.some((line) => line.dirty);
  const working = busy !== null;

  const change = (key: string, patch: Partial<Line>): void => {
    setLines((all) => all.map((line) => (line.key === key ? { ...line, ...patch, dirty: true } : line)));
    setLineSaid((all) => (all[key] === undefined ? all : Object.fromEntries(Object.entries(all).filter(([k]) => k !== key))));
  };

  /** What a scan did: said to a screen reader, and written under the field for everybody else. */
  const scanSaid = (words: string): void => {
    say(words);
    setScanned(words);
  };

  const found = (item: DataRow): void => {
    const itemId = text(item['id']);
    // The last line of this item that can still be typed on takes one more; a tracked item's second batch is its own line.
    const last = [...lines].reverse().find((line) => line.itemId === itemId && line.status === 'draft');
    if (last !== undefined) {
      const qty = plusOne(last.qty);
      change(last.key, { qty });
      scanSaid(t('receive.scan.raised', '{item} · now {qty} {unit}', { item: last.itemName, qty, unit: last.inPacks ? last.packName || t('receive.packs', 'packs') : last.unit }));
      return;
    }
    const line = lineForItem(item);
    setLines((all) => [...all, line]);
    scanSaid(t('receive.scan.added', '{item} added · 1 {unit}', { item: line.itemName, unit: line.inPacks ? line.packName || t('receive.pack', 'pack') : line.unit }));
  };

  const anotherBatch = (line: Line): void => {
    setLines((all) => {
      const at = all.findIndex((candidate) => candidate.key === line.key);
      const copy: Line = { ...line, key: `${line.key}-b${String(all.length)}`, id: null, qty: '', batch: '', expires: '', saved: null, dirty: true, status: 'draft' };
      return [...all.slice(0, at + 1), copy, ...all.slice(at + 1)];
    });
  };

  const remove = (line: Line): void => {
    setLines((all) => all.filter((candidate) => candidate.key !== line.key));
    if (line.id !== null) setRemoved((ids) => [...ids, line.id as string]);
    toasts.push({ variant: 'info', title: t('receive.removed', 'Removed {item}', { item: line.itemName }) });
  };

  /** Save what changed. Answers the receipt's key, or null when Adminium refused. */
  const save = async (): Promise<string | null> => {
    setProblem(null);
    setLineSaid({});
    if (receipt === null) {
      if (typed.length === 0) {
        setProblem(t('receive.nothing', 'Add something to receive first'));
        return null;
      }
      if (placeId === '') {
        setProblem(t('receive.choosePlace', 'Choose where this delivery goes'));
        return null;
      }
      try {
        const saved = await receipts.create({
          values: { place_id: placeId, kind: 'delivery', ...(order === null ? {} : { po_id: text(order['id']) }), ...(supplierId === '' ? {} : { supplier_id: supplierId }) },
          children: { receipt_lines: typed.map((line) => ({ values: lineValues(line, costs) })) },
        });
        return text(saved.row['id']);
      } catch (caught) {
        setProblem(refusal(t, asDataError(caught)).message);
        return null;
      }
    }
    const id = text(receipt['id']);
    for (const gone of removed) {
      try {
        await lineWrites.remove(gone);
      } catch (caught) {
        setProblem(refusal(t, asDataError(caught)).message);
        return null;
      }
    }
    setRemoved([]);
    for (const line of lines) {
      if (line.status !== 'draft' || !line.dirty) continue;
      try {
        if (line.id === null) {
          if (!typedOn(line)) continue;
          const made = await lineWrites.create({ receipt_id: id, ...lineValues(line, costs) });
          setLines((all) => all.map((candidate) => (candidate.key === line.key ? { ...candidate, id: text(made.row['id']), saved: made.row, dirty: false } : candidate)));
        } else if (!typedOn(line)) {
          await lineWrites.remove(line.id);
        } else {
          const kept = await lineWrites.update(line.id, lineValues(line, costs));
          setLines((all) => all.map((candidate) => (candidate.key === line.key ? { ...candidate, saved: kept.row, dirty: false } : candidate)));
        }
      } catch (caught) {
        const words = refusal(t, asDataError(caught), { item: line.itemName, unit: line.unit, batch: line.batch });
        setLineSaid((all) => ({ ...all, [line.key]: { message: words.message, ...(words.field === undefined ? {} : { field: words.field }) } }));
        setProblem(t('receive.lineRefused', '{item}: {reason}', { item: line.itemName, reason: words.message }));
        return null;
      }
    }
    return id;
  };

  const saveDraft = async (): Promise<void> => {
    setBusy('save');
    try {
      const id = await save();
      if (id === null) return;
      toasts.push({ variant: 'success', title: t('receive.draftSaved', 'Draft saved. Find it under Receipts.') });
      if (receipt === null) await navigate({ to: PAGE, search: { receipt: id }, replace: true });
      else await load();
    } finally {
      setBusy(null);
    }
  };

  const post = async (): Promise<void> => {
    const problems = problemsOf(lines);
    setMarked(problems);
    const count = countProblems(problems);
    if (count > 0) {
      setProblem(t('receive.fixFirst', '{count, plural, one {# field needs} other {# fields need}} fixing before you post', { count }));
      return;
    }
    if (status === 'draft' && typed.length === 0) {
      setProblem(t('receive.nothing', 'Add something to receive first'));
      return;
    }
    setBusy('post');
    try {
      const id = await save();
      if (id === null) return;
      const sheet = await read.get('receipts', id);
      if (sheet === null) return;
      const wasOpen = order !== null && text(order['closed_at']) === '' && order['status'] !== 'cancelled';
      setRun({ done: 0, all: Number(sheet['lines'] ?? 0) });
      const outcome = await runSheet({ read, move: moveReceipt, updateEach: lineWrites.updateEach, onProgress: (done, all) => setRun({ done, all }) }, RECEIPT_POST, sheet);
      if (!outcome.finished) {
        const after = await read.get('receipts', id);
        const first = outcome.refused[0];
        const at = first === undefined ? undefined : lines.find((line) => line.id === first.id);
        const words = first === undefined ? null : refusal(t, first.error, at === undefined ? {} : { item: at.itemName, unit: at.unit, batch: at.batch });
        if (at !== undefined && words !== null) setLineSaid({ [at.key]: { message: words.message, ...(words.field === undefined ? {} : { field: words.field }) } });
        setProblem(
          words === null
            ? t('receive.stopped', '{done} of {all} lines are in. Continue when you are ready.', { done: Number(after?.['unreversed'] ?? outcome.done), all: Number(after?.['lines'] ?? outcome.all) })
            : t('receive.stoppedAt', '{done} of {all} lines are in. {item}: {reason}', { done: Number(after?.['unreversed'] ?? outcome.done), all: Number(after?.['lines'] ?? outcome.all), item: at?.itemName ?? '', reason: words.message }),
        );
        if (receipt === null) await navigate({ to: PAGE, search: { receipt: id }, replace: true });
        else await load();
        return;
      }
      toasts.push({ variant: 'success', title: order === null ? t('receive.posted', 'Receipt posted') : t('receive.postedFor', 'Receipt posted for {order}', { order: text(order['number']) }) });
      if (order !== null && wasOpen) {
        const now = await read.get('purchase_orders', text(order['id']));
        if (now !== null && (text(now['closed_at']) !== '' || now['status'] === 'cancelled')) {
          setConfirmSaid(t('receive.closedMeanwhile', '{order} was closed while you were receiving. The stock is in; the order did not change.', { order: text(order['number']) }));
        }
      }
      if (receipt === null) await navigate({ to: PAGE, search: { receipt: id }, replace: true });
      else await load();
    } catch (caught) {
      const error = asDataError(caught);
      setProblem(error.code === 'STATE_MOVE_REFUSED' ? t('receive.notAllIn', 'Some lines are not in yet') : refusal(t, error).message);
      if (receipt !== null) await load();
    } finally {
      setRun(null);
      setBusy(null);
    }
  };

  const columns = useMemo<LineColumn<Line>[]>(() => {
    const fixed = status !== 'draft' && status !== 'posting';
    const out: LineColumn<Line>[] = [
      {
        key: 'item',
        label: t('receive.col.item', 'Item'),
        cell: (line) => (
          <Stack gap="xs">
            <span className="font-semibold text-fg">{line.itemName}</span>
            <Stack direction="row" gap="xs" align="center" wrap>
              {line.sku === '' ? null : (
                <span dir="ltr">
                  <Figure>{line.sku}</Figure>
                </span>
              )}
              {order !== null && line.poLineId === null ? <Tag tone="info">{t('receive.notOnOrder', 'Not on this order')}</Tag> : null}
            </Stack>
          </Stack>
        ),
      },
    ];
    if (order !== null) {
      out.push(
        {
          key: 'ordered',
          label: t('receive.col.ordered', 'Ordered'),
          cell: (line) =>
            line.ordered === null ? (
              '—'
            ) : (
              <Stack gap="xs">
                {line.ordered.packs === '' || line.ordered.packSize === '' ? null : (
                  <span>{t('receive.orderedPacks', '{packs} {pack} of {size}', { packs: line.ordered.packs, pack: line.ordered.packName || t('receive.packs', 'packs'), size: line.ordered.packSize })}</span>
                )}
                <span className="text-body-sm text-fg-muted">
                  {line.ordered.qty} {line.unit}
                </span>
              </Stack>
            ),
        },
        { key: 'received', label: t('receive.col.received', 'Received so far'), cell: (line) => (line.ordered === null ? '—' : `${line.ordered.received === '' ? '0' : line.ordered.received} ${line.unit}`) },
      );
    }
    out.push({
      key: 'now',
      label: t('receive.col.now', 'Receiving now'),
      cell: (line, _index, narrow) => {
        const stored = line.saved !== null && !line.dirty ? plain(line.saved['qty']) : '';
        const pack = line.packName || t('receive.packs', 'packs');
        const comes = stored !== '' ? stored : line.inPacks && positive(line.qty) ? (times(line.qty, line.packSize) ?? '') : '';
        // What this line brings, in units. A draft is not yet in what the order has received, saved or not.
        const brings = line.inPacks ? comes : line.qty.trim();
        const open = line.ordered === null || line.status !== 'draft' || !positive(brings) ? null : against(line.ordered.open, brings);
        const inPacks = open === null || !line.inPacks ? null : wholeTimes(open.by, line.packSize);
        const gap = open === null ? null : { side: open.side, qty: inPacks ?? open.by, unit: inPacks === null ? line.unit : pack };
        return (
          <Stack gap="xs">
            <QtyInput
              label={t('receive.col.now', 'Receiving now')}
              value={line.qty}
              onChange={(qty) => change(line.key, { qty })}
              packs={line.inPacks}
              decimals={line.decimals}
              unit={line.inPacks ? line.packName || t('receive.packs', 'packs') : line.unit}
              disabled={working || line.status !== 'draft' || fixed}
              {...(marked[line.key]?.qty === undefined && lineSaid[line.key]?.field !== 'qty' ? {} : { error: lineSaid[line.key]?.field === 'qty' ? lineSaid[line.key]?.message : line.inPacks ? t('receive.err.whole', 'Enter a whole number') : t('receive.err.qty', 'Enter how many you are receiving') })}
            />
            {/* The units a line of packs comes to: Adminium's figure once it has saved the line, the screen's own sum of what is typed before. */}
            {line.inPacks && comes !== '' ? (
              <span className="text-body-sm text-fg-muted" data-part="inventory-comes-to">
                = {comes} {line.unit}
              </span>
            ) : null}
            {/* Against what the order still expects, while it can still be typed: a short delivery and an over-delivery are both said before the save. */}
            {gap !== null && gap.side === 'short' ? (
              <span className="text-body-sm text-fg-muted" data-part="inventory-against-order">
                {t('receive.toCome', '{qty} {unit} still to come', { qty: gap.qty, unit: gap.unit })}
              </span>
            ) : null}
            {gap !== null && gap.side === 'over' ? (
              <span className="text-body-sm font-semibold text-fg" data-part="inventory-against-order">
                {t('receive.overOrder', '{qty} {unit} more than ordered', { qty: gap.qty, unit: gap.unit })}
              </span>
            ) : null}
            {line.packSize !== '' && line.status === 'draft' && !fixed && !narrow ? (
              <Button variant="link" size="sm" disabled={working} onClick={() => change(line.key, { inPacks: !line.inPacks, qty: '' })}>
                {line.inPacks ? t('receive.countUnits', 'Count in {unit}', { unit: line.unit }) : t('receive.countPacks', 'Count in {pack} of {size}', { pack: line.packName || t('receive.packs', 'packs'), size: line.packSize })}
              </Button>
            ) : null}
          </Stack>
        );
      },
    });
    if (costs) {
      out.push(
        {
          key: 'cost',
          label: t('receive.col.cost', 'Unit cost'),
          cell: (line) => {
            const used = line.saved !== null ? plain(line.saved['cost_used']) : '';
            return (
              <Stack gap="xs">
                <NumberInput
                  aria-label={t('receive.col.cost', 'Unit cost')}
                  value={line.unitCost}
                  onChange={(unitCost) => change(line.key, { unitCost })}
                  decimals={4}
                  unit={t('receive.per', 'per {unit}', { unit: line.unit })}
                  disabled={working || line.status !== 'draft' || fixed}
                  {...(lineSaid[line.key]?.field === 'unit_cost' ? { error: lineSaid[line.key]?.message } : {})}
                />
                {line.unitCost === '' && used !== '' && !line.dirty ? <span className="text-body-sm text-fg-muted">{t('receive.costUsed', 'Adminium used {cost}', { cost: used })}</span> : null}
                {/* Before anything is saved: the order's own cost, which is what an empty field takes. Read from the order, never worked out here. */}
                {line.unitCost === '' && line.saved === null && line.status === 'draft' && (line.ordered?.cost ?? '') !== '' ? <span className="text-body-sm text-fg-muted">{t('receive.costOrdered', 'The order says {cost}', { cost: cash(line.ordered?.cost) })}</span> : null}
              </Stack>
            );
          },
        },
        { key: 'total', label: t('receive.col.total', 'Total'), cell: (line) => (line.saved !== null && !line.dirty ? <Figure>{cash(line.saved['amount'])}</Figure> : <span className="text-fg-muted">—</span>) },
      );
    }
    return out;
  }, [t, order, status, costs, marked, lineSaid, working, locale]);

  if (!mayOpen) return <PageFrame t={t} title={t('receive.title', 'Receive stock')} refused />;
  if (loaded === 'missing') {
    return (
      <PageFrame t={t} title={t('receive.title', 'Receive stock')}>
        <EmptyState title={t('receive.missing.title', 'This receipt is not here')} body={t('receive.missing.body', 'It may have been removed, or you may not be able to see it.')} actions={<Button onClick={() => void navigate({ to: PAGE })}>{t('receive.another', 'Receive another delivery')}</Button>} />
      </PageFrame>
    );
  }
  if (loaded === null) return <PageFrame t={t} title={t('receive.title', 'Receive stock')} loading={failed === null} error={failed} onRetry={() => void load()} />;

  if (receipt !== null && (status === 'posted' || status === 'reversing' || status === 'reversed')) {
    return <Posted t={t} receipt={receipt} order={order} lines={lines} costs={costs} totals={totals} note={confirmSaid} onChanged={() => void load()} />;
  }

  const placeName = text(places.rows.find((place) => text(place['id']) === placeId)?.['name']) || text(order?.['place_name']);
  // An order with no number of its own yet is named by its supplier alone.
  const orderLabel = (row: DataRow): string => (text(row['number']) === '' ? text(row['supplier_name']) : t('receive.orderLabel', '{number} · {supplier}', { number: text(row['number']), supplier: text(row['supplier_name']) }));
  const orderOptions = [{ value: '', label: t('receive.noOrder', 'No purchase order') }, ...orders.rows.map((row) => ({ value: text(row['id']), label: orderLabel(row) })), ...(order !== null && !orders.rows.some((row) => text(row['id']) === text(order['id'])) ? [{ value: text(order['id']), label: orderLabel(order) }] : [])];
  const pick = (next: string): void => {
    if (typed.length > 0) setSwitchTo(next);
    else void navigate({ to: PAGE, search: next === '' ? {} : { po: next } });
  };
  const anyPack = lines.some((line) => line.inPacks);
  const Trash = lucideByName('trash-2');

  return (
    <PageFrame t={t} title={t('receive.title', 'Receive stock')} status={said} testId="inventory-receive">
      {status === 'posting' ? <Alert tone="warn" title={t('receive.posting.title', 'This receipt is partly in')} body={t('receive.posting.body', '{done} of {all} lines are in. Go on when you are ready; a line that is not in yet can still be corrected.', { done: Number(receipt?.['unreversed'] ?? 0), all: Number(receipt?.['lines'] ?? 0) })} /> : null}
      <Card title={t('receive.delivery', 'Delivery')}>
        <Grid columns={3} gap="md">
          {receipt === null ? (
            <Select label={t('receive.order', 'Purchase order')} value={text(order?.['id'])} onChange={(event) => pick(event.target.value)} options={orderOptions} disabled={working} />
          ) : (
            <Fixed label={t('receive.order', 'Purchase order')} value={order === null ? t('receive.noOrder', 'No purchase order') : orderLabel(order)} />
          )}
          {receipt === null && order === null ? (
            <Select label={t('receive.into', 'Into')} value={placeId} onChange={(event) => setPlaceId(event.target.value)} options={[{ value: '', label: t('receive.choose', 'Choose a place') }, ...places.rows.map((place) => ({ value: text(place['id']), label: text(place['name']) }))]} disabled={working} required />
          ) : (
            <Fixed label={t('receive.into', 'Into')} value={placeName} />
          )}
          {receipt === null && order === null ? (
            <Select label={t('receive.supplier', 'Supplier (optional)')} value={supplierId} onChange={(event) => setSupplierId(event.target.value)} options={[{ value: '', label: t('receive.noSupplier', 'No supplier') }, ...suppliers.rows.map((supplier) => ({ value: text(supplier['id']), label: text(supplier['name']) }))]} disabled={working} />
          ) : order !== null ? (
            <Fixed label={t('receive.supplierOf', 'Supplier')} value={text(order['supplier_name'])} />
          ) : (
            <Fixed label={t('receive.supplierOf', 'Supplier')} value={text(suppliers.rows.find((supplier) => text(supplier['id']) === supplierId)?.['name']) || t('receive.noSupplier', 'No supplier')} />
          )}
        </Grid>
      </Card>
      <Card title={t('receive.lines', 'Lines')} description={t('receive.lineCount', '{count, plural, one {# line} other {# lines}}', { count: lines.length })}>
        <Stack gap="md">
          {status === 'draft' ? (
            <FindOrScan
              t={t}
              inputRef={scan}
              onFound={found}
              disabled={working}
              hint={anyPack ? t('receive.scan.hintPack', 'A scanner types into this field. Each scan adds one pack.') : t('receive.scan.hintUnit', 'A scanner types into this field. Each scan adds one.')}
              {...(mayAddItem ? { onAddNew: (code: string) => setNewItem(code) } : {})}
            />
          ) : null}
          {/* The polite region has said it already: this copy is for the eye. */}
          {status === 'draft' && scanned !== '' ? (
            <span aria-hidden="true" className="text-body-sm text-fg" data-part="inventory-scanned">
              {scanned}
            </span>
          ) : null}
          <LinesTable
            label={t('receive.lines', 'Lines')}
            columns={columns}
            lines={lines}
            lineKey={(line) => line.key}
            lineLabel={(line) => line.itemName}
            empty={<EmptyState compact title={t('receive.empty.title', 'Nothing added yet')} body={t('receive.empty.body', "Scan a box or type an item's name above. Each item you add becomes a line.")} />}
            under={(line) => (
              <Stack gap="sm">
                {line.tracks ? (
                  <Grid columns={3} gap="md">
                    <Input
                      label={t('receive.batch', 'Batch')}
                      value={line.batch}
                      onChange={(event) => change(line.key, { batch: event.target.value })}
                      placeholder={t('receive.batchHint', 'As printed on the box')}
                      dir="ltr"
                      maxLength={60}
                      disabled={working || line.status !== 'draft'}
                      {...(marked[line.key]?.batch_code !== undefined || lineSaid[line.key]?.field === 'batch_code' ? { error: lineSaid[line.key]?.field === 'batch_code' ? lineSaid[line.key]?.message : t('refusal.needsBatch', 'Enter the batch number') } : {})}
                    />
                    <ExpiresField t={t} line={line} disabled={working || line.status !== 'draft'} error={lineSaid[line.key]?.field === 'expires_on' ? (lineSaid[line.key]?.message ?? null) : marked[line.key]?.expires_on !== undefined ? t('receive.err.expires', 'Enter the expiry date') : null} onChange={(expires) => change(line.key, { expires })} />
                    {line.status === 'draft' && status === 'draft' ? (
                      <Stack justify="end">
                        <Button variant="ghost" size="sm" disabled={working} onClick={() => anotherBatch(line)}>
                          {t('receive.anotherBatch', 'Another batch')}
                        </Button>
                      </Stack>
                    ) : null}
                  </Grid>
                ) : null}
                {lineSaid[line.key] !== undefined && lineSaid[line.key]?.field === undefined ? <Alert tone="danger" role="alert" title={lineSaid[line.key]?.message} /> : null}
                {line.status === 'draft' && status === 'draft' && line.ordered === null ? (
                  <Stack direction="row" justify="end">
                    <IconButton label={t('receive.remove', 'Remove {item}', { item: line.itemName })} variant="ghost" disabled={working} onClick={() => remove(line)}>
                      <Trash className="size-4" />
                    </IconButton>
                  </Stack>
                ) : null}
                {line.status === 'posted' ? <Tag tone="pos">{t('receive.lineIn', 'In')}</Tag> : null}
              </Stack>
            )}
          />
        </Stack>
      </Card>
      <TotalsBar
        label={t('receive.bar', 'This receipt')}
        totals={
          receipt !== null && !dirty
            ? totals
              ? t('receive.totalsMoney', 'Receiving {units} units · {total}', { units: plain(receipt['units']), total: cash(receipt['total']) })
              : t('receive.totalsUnits', 'Receiving {units} units', { units: plain(receipt['units']) })
            : t('receive.totalsTyped', '{count, plural, one {# line} other {# lines}} to receive', { count: typed.length })
        }
        problem={problem}
        progress={run === null ? null : <ProgressBar value={run.done} max={Math.max(run.all, 1)} label={t('shared.progress', '{done} of {all} lines', { done: run.done, all: run.all })} />}
      >
        {status === 'draft' ? (
          <Button variant="secondary" loading={busy === 'save'} disabled={working} onClick={() => void saveDraft()}>
            {t('receive.saveDraft', 'Save as draft')}
          </Button>
        ) : null}
        {mayPost || status === 'posting' ? (
          <Button variant="primary" loading={busy === 'post'} disabled={working} onClick={() => void post()}>
            {status === 'posting' ? t('shared.continuePosting', 'Continue posting') : t('receive.post', 'Post receipt')}
          </Button>
        ) : null}
      </TotalsBar>
      <NewItemSheet
        t={t}
        code={newItem}
        onClose={() => setNewItem(null)}
        onMade={(item) => {
          setNewItem(null);
          found(item);
          toasts.push({ variant: 'success', title: t('receive.itemAdded', 'Item added: {item}', { item: text(item['name']) }) });
        }}
      />
      <Dialog open={switchTo !== null} onOpenChange={(open) => (open ? undefined : setSwitchTo(null))} size="sm">
        <DialogHeader title={t('receive.discard.title', 'Discard what you have entered?')} closeLabel={t('shared.close', 'Close')} />
        <DialogBody>{t('receive.discard.body', 'The lines you typed are not saved. Changing the order starts again.')}</DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setSwitchTo(null)}>
            {t('shared.cancel', 'Cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              const next = switchTo ?? '';
              setSwitchTo(null);
              void navigate({ to: PAGE, search: next === '' ? {} : { po: next } });
            }}
          >
            {t('receive.discard.yes', 'Discard and change')}
          </Button>
        </DialogFooter>
      </Dialog>
    </PageFrame>
  );
}

/** A header value that is set once and then only read. */
function Fixed({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <Stack gap="xs">
      <span className="text-body-sm text-fg-muted">{label}</span>
      <span className="text-fg">{value === '' ? '—' : value}</span>
    </Stack>
  );
}

/**
 * A batch's expiry. A code this item already has is a batch Adminium knows:
 * its date is shown, not asked for again.
 */
function ExpiresField({ t, line, disabled, error, onChange }: { t: AddOnTranslate; line: Line; disabled: boolean; error: string | null; onChange: (expires: string) => void }): ReactNode {
  const code = line.batch.trim();
  const known = useRecords('batches', { filter: [{ column: 'item_id', op: 'eq', value: line.itemId }, { column: 'code', op: 'eq', value: code }], pageSize: 1, columns: ['id', 'code', 'expires_on'], enabled: code !== '' && line.status === 'draft' });
  const row = code === '' || known.loading ? undefined : known.rows.find((batch) => text(batch['code']).toLowerCase() === code.toLowerCase());
  const date = text(row?.['expires_on']).slice(0, 10);
  const last = useRef('');
  useEffect(() => {
    if (date !== '' && date !== line.expires && last.current !== `${code}|${date}`) {
      last.current = `${code}|${date}`;
      onChange(date);
    }
  }, [date, code, line.expires, onChange]);
  return (
    <Field label={t('receive.expires', 'Expires')} {...(error === null ? {} : { error })} {...(error === null && date !== '' ? { hint: t('receive.batchKnown', 'Batch {code} is already known', { code: text(row?.['code']) }) } : {})}>
      <DateInput value={line.expires} onChange={(event) => onChange(event.target.value)} disabled={disabled || date !== ''} error={error !== null} />
    </Field>
  );
}
