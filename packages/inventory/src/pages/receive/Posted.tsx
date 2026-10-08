/**
 * A POSTED RECEIPT: what went in, read back from Adminium — the order's state
 * after it, what is on hand now — and the two ways back a stock manager has:
 * undo the whole receipt line by line, or send one line back to its supplier.
 */
import { useState, type ReactNode } from 'react';

import {
  Alert,
  Button,
  Card,
  Divider,
  Link,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Figure,
  ProgressBar,
  Stack,
  Tag,
  asDataError,
  useMoney,
  useAccess,
  useAppToasts,
  useLocaleTag,
  useNavigate,
  useRead,
  useRecords,
  useStateMove,
  useWrite,
  type AddOnTranslate,
  type DataRow,
} from '../shared/host.ts';
import { PageFrame } from '../shared/PageFrame.tsx';
import { refusal } from '../shared/refusal.ts';
import { RECEIPT_UNDO, runSheet } from '../shared/runSheet.ts';
import { plain, type Line } from './lines.ts';

const PAGE = '/add-ons/inventory/inventory-receive';
const text = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

export interface PostedProps {
  t: AddOnTranslate;
  receipt: DataRow;
  order: DataRow | null;
  lines: readonly Line[];
  costs: boolean;
  totals: boolean;
  /** Something the post learnt that the reader should be told once. */
  note: string | null;
  onChanged: () => void;
}

export function Posted({ t, receipt, order, lines, costs, totals, note, onChanged }: PostedProps): ReactNode {
  const access = useAccess();
  const read = useRead();
  const toasts = useAppToasts();
  const navigate = useNavigate();
  const locale = useLocaleTag();
  const cash = useMoney();
  const status = text(receipt['status']);
  const mayUndo = access.canMove('receipts', 'reversing', 'posted') || (status === 'reversing' && access.canMove('receipts', 'reversed', 'reversing'));
  const maySendBack = access.canMove('receipt_lines', 'sent_back', 'posted');
  const moveReceipt = useStateMove('receipts');
  const moveLine = useStateMove('receipt_lines');
  const lineWrites = useWrite('receipt_lines');

  const itemIds = [...new Set(lines.map((line) => line.itemId))];
  const points = useRecords('stock_points', { filter: [{ column: 'place_id', op: 'eq', value: text(receipt['place_id']) }, { column: 'item_id', op: 'in', value: itemIds }], pageSize: 199, columns: ['id', 'item_id', 'on_hand'], enabled: itemIds.length > 0 && access.canRead('stock_points') });
  const stillOpen = useRecords('po_lines', { filter: [{ column: 'po_id', op: 'eq', value: text(order?.['id']) }, { column: 'open_qty', op: 'gt', value: 0 }], pageSize: 50, columns: ['id', 'item_name', 'unit', 'open_qty'], enabled: order !== null });
  const place = useRecords('places', { filter: [{ column: 'id', op: 'eq', value: text(receipt['place_id']) }], pageSize: 1, columns: ['id', 'name'] });

  const [confirm, setConfirm] = useState<'undo' | Line | null>(null);
  const [busy, setBusy] = useState(false);
  const [run, setRun] = useState<{ done: number; all: number } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const onHand = (itemId: string): string => plain(points.rows.find((point) => text(point['item_id']) === itemId)?.['on_hand']);
  const when = text(receipt['received_at']) === '' ? '' : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(text(receipt['received_at'])));
  const day = (iso: string): string => (iso === '' ? '' : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)));

  const undo = async (): Promise<void> => {
    setConfirm(null);
    setProblem(null);
    setBusy(true);
    try {
      const sheet = (await read.get('receipts', text(receipt['id']))) ?? receipt;
      const outcome = await runSheet({ read, move: moveReceipt, updateEach: lineWrites.updateEach, onProgress: (done, all) => setRun({ done, all }) }, RECEIPT_UNDO, sheet);
      if (outcome.finished) toasts.push({ variant: 'success', title: t('receive.undone', 'Receipt undone') });
      else {
        const first = outcome.refused[0];
        const at = first === undefined ? undefined : lines.find((line) => line.id === first.id);
        setProblem(first === undefined ? t('receive.undoStopped', 'Not every line is undone yet. Go on when you are ready.') : t('receive.lineRefused', '{item}: {reason}', { item: at?.itemName ?? '', reason: refusal(t, first.error, at === undefined ? {} : { item: at.itemName, unit: at.unit, batch: at.batch }).message }));
      }
    } catch (caught) {
      const error = asDataError(caught);
      // The one move that is refused by a rule here: the order reads received.
      setProblem(error.code === 'STATE_MOVE_REFUSED' && order !== null ? t('receive.reopenFirst', 'Reopen the order first') : refusal(t, error).message);
    } finally {
      setRun(null);
      setBusy(false);
      onChanged();
    }
  };

  const sendBack = async (line: Line): Promise<void> => {
    setConfirm(null);
    setProblem(null);
    if (line.id === null) return;
    setBusy(true);
    try {
      await moveLine(line.id, 'sent_back');
      toasts.push({ variant: 'success', title: t('receive.sentBack', '{item} sent back', { item: line.itemName }) });
    } catch (caught) {
      setProblem(t('receive.lineRefused', '{item}: {reason}', { item: line.itemName, reason: refusal(t, asDataError(caught), { item: line.itemName, unit: line.unit, batch: line.batch }).message }));
    } finally {
      setBusy(false);
      onChanged();
    }
  };

  // An order that was never numbered is named by its supplier.
  const number = text(order?.['number']) || text(order?.['supplier_name']);
  const heading = status === 'reversed' ? t('receive.reversed.title', 'Receipt undone') : status === 'reversing' ? t('receive.reversing.title', 'This receipt is partly undone') : t('receive.posted.title', 'Receipt posted');
  return (
    <PageFrame t={t} title={t('receive.title', 'Receive stock')} backTo={PAGE} testId="inventory-receive-posted">
      {note === null ? null : <Alert tone="warn" title={note} />}
      <Card title={heading} description={t('receive.posted.where', 'Into {place} · {when} · {by}', { place: text(place.rows[0]?.['name']), when, by: text(receipt['by']) })}>
        <Stack gap="md">
          {status === 'reversed' ? (
            <span>{t('receive.reversed.body', 'Every line was taken out of stock again. The receipt stays on record.')}</span>
          ) : order === null ? (
            <span>{text(receipt['supplier_id']) === '' ? t('receive.posted.plain', 'Stock received.') : t('receive.posted.noOrder', 'Stock received from its supplier.')}</span>
          ) : order['status'] === 'received' ? (
            <span>{t('receive.posted.full', '{order} is fully received.', { order: number })}</span>
          ) : (
            <Stack gap="xs">
              {stillOpen.rows.length === 0 ? <span>{t('receive.posted.part', '{order} is partly received.', { order: number })}</span> : null}
              {stillOpen.rows.map((open) => (
                <span key={text(open['id'])}>{t('receive.posted.toCome', '{order} is partly received. {qty} {unit} of {item} still to come.', { order: number, qty: plain(open['open_qty']), unit: text(open['unit']), item: text(open['item_name']) })}</span>
              ))}
            </Stack>
          )}
          {Number(receipt['lines_to_check'] ?? 0) > 0 && costs ? <Alert tone="warn" title={t('receive.costToCheck', 'A line was posted at the average cost because none was known. Check its cost.')} /> : null}
          {lines.map((line) => (
            <Stack key={line.key} gap="xs">
              <Divider />
              <Stack direction="row" justify="between" align="start" wrap gap="md">
                <Stack gap="xs">
                  <span className="font-semibold text-fg">{line.itemName}</span>
                  {line.batch === '' ? null : (
                    <span className="text-body-sm text-fg-muted">
                      {line.expires === '' ? t('receive.posted.batch', 'Batch {code}', { code: line.batch }) : t('receive.posted.batchExpires', 'Batch {code} · expires {date}', { code: line.batch, date: day(line.expires) })}
                    </span>
                  )}
                  {onHand(line.itemId) === '' ? null : <span className="text-body-sm text-fg-muted">{t('receive.posted.onHand', 'On hand now {qty} {unit}', { qty: onHand(line.itemId), unit: line.unit })}</span>}
                </Stack>
                <Stack direction="row" gap="md" align="center" wrap>
                  {line.status === 'sent_back' ? <Tag tone="warn">{t('receive.status.sentBack', 'Sent back')}</Tag> : null}
                  {line.status === 'reversed' ? <Tag tone="warn">{t('receive.status.reversed', 'Undone')}</Tag> : null}
                  <Figure>
                    {plain(line.saved?.['qty'])} {line.unit}
                  </Figure>
                  {costs ? <Figure>{cash(line.saved?.['amount'])}</Figure> : null}
                  {maySendBack && status === 'posted' && line.status === 'posted' ? (
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirm(line)}>
                      {t('receive.sendBack', 'Send back to supplier')}
                    </Button>
                  ) : null}
                </Stack>
              </Stack>
            </Stack>
          ))}
          <Divider />
          <span className="font-semibold text-fg">
            {totals ? t('receive.posted.totalsMoney', 'Received {units} units · {total}', { units: plain(receipt['units']), total: cash(receipt['total']) }) : t('receive.posted.totalsUnits', 'Received {units} units', { units: plain(receipt['units']) })}
          </span>
          {run === null ? null : <ProgressBar value={run.done} max={Math.max(run.all, 1)} label={t('shared.progress', '{done} of {all} lines', { done: run.done, all: run.all })} />}
          {problem === null ? null : <Alert tone="danger" role="alert" title={problem} />}
          <Stack direction="row" gap="sm" wrap>
            <Button variant="secondary" onClick={() => void navigate({ to: PAGE })}>
              {t('receive.another', 'Receive another delivery')}
            </Button>
            <Link to="/p/inventory-movements">{t('receive.seeMovements', 'See movements')}</Link>
            <Link to="/p/inventory-overview">{t('receive.overview', 'Stock overview')}</Link>
            {mayUndo && (status === 'posted' || status === 'reversing') ? (
              <Button variant="destructive" loading={busy} disabled={busy} onClick={() => (status === 'reversing' ? void undo() : setConfirm('undo'))}>
                {status === 'reversing' ? t('receive.undoContinue', 'Continue undoing') : t('receive.undo', 'Undo this receipt')}
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </Card>
      <Dialog open={confirm !== null} onOpenChange={(open) => (open ? undefined : setConfirm(null))} size="sm">
        <DialogHeader tone="danger" title={confirm === 'undo' ? t('receive.undo.title', 'Undo this receipt?') : t('receive.sendBack.title', 'Send this line back to its supplier?')} closeLabel={t('shared.close', 'Close')} />
        <DialogBody>
          {confirm === 'undo'
            ? t('receive.undo.body', 'Every line is taken out of stock again, one by one. A line whose stock has already been used cannot be undone, and is named.')
            : t('receive.sendBack.body', 'The whole line leaves stock at its cost and counts as on order again. To write off part of a line, use "Use stock" on the item instead.')}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setConfirm(null)}>
            {t('shared.cancel', 'Cancel')}
          </Button>
          <Button variant="destructive" onClick={() => (confirm === 'undo' ? void undo() : confirm !== null ? void sendBack(confirm) : undefined)}>
            {confirm === 'undo' ? t('receive.undo', 'Undo this receipt') : t('receive.sendBack', 'Send back to supplier')}
          </Button>
        </DialogFooter>
      </Dialog>
    </PageFrame>
  );
}
