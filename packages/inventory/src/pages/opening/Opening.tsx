/**
 * OPENING STOCK: what is on the shelves the day the books begin, loaded from
 * a file.
 *
 * The file is read in the browser, each row is matched to an item by the
 * server (barcode, then SKU, then the exact name), the rows are reviewed, and
 * they are saved as receipts of kind `opening` — one receipt for every
 * thousand lines, in the file's order. Loading posts them line by line, as a
 * delivery is posted; a load that breaks off is taken up from Receipts.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { ITEM_COLUMNS } from '../shared/FindOrScan.tsx';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  FileInput,
  Link,
  Figure,
  Pagination,
  ProgressBar,
  Select,
  Stack,
  Tag,
  asDataError,
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
  type Reads,
} from '../shared/host.ts';
import { LinesTable, type LineColumn } from '../shared/LinesTable.tsx';
import { PageFrame } from '../shared/PageFrame.tsx';
import { refusal } from '../shared/refusal.ts';
import { RECEIPT_POST, runSheet } from '../shared/runSheet.ts';
import { TotalsBar } from '../shared/TotalsBar.tsx';
import { PART_MAX, ROWS_MAX, SAMPLE, parse, parts, problemsOf, type FileProblem, type FileRow } from './csv.ts';

const PAGE = '/add-ons/inventory/inventory-opening-stock';
const RECEIVE = '/add-ons/inventory/inventory-receive';
const REVIEW_PAGE = 100;
const text = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

interface Matched extends FileRow {
  item: DataRow | null;
  problems: FileProblem[];
}

/** Each row's item: by barcode, then by SKU, then by the exact name — asked of the server a hundred at a time. */
export async function matchRows(read: Reads, rows: readonly FileRow[], onProgress?: (done: number) => void): Promise<Matched[]> {
  const found = new Map<number, DataRow>();
  const by = async (column: 'barcode' | 'sku' | 'name'): Promise<void> => {
    const open = rows.filter((row) => !found.has(row.at) && row[column] !== '');
    const wanted = [...new Set(open.map((row) => row[column]))];
    const hits = new Map<string, DataRow>();
    for (let start = 0; start < wanted.length; start += 100) {
      const { rows: items } = await read.list('items', { filter: [{ column: 'active', op: 'eq', value: true }, { column, op: 'in', value: wanted.slice(start, start + 100) }], columns: ITEM_COLUMNS, pageSize: 199 });
      for (const item of items) hits.set(text(item[column]).toLowerCase(), item);
      onProgress?.(found.size + hits.size);
    }
    for (const row of open) {
      const item = hits.get(row[column].toLowerCase());
      if (item !== undefined) found.set(row.at, item);
    }
  };
  await by('barcode');
  await by('sku');
  await by('name');
  return rows.map((row) => ({ ...row, item: found.get(row.at) ?? null, problems: problemsOf(row) }));
}

const lineValues = (row: Matched): Record<string, DataValue> => ({
  item_id: text(row.item?.['id']),
  qty_typed: row.quantity,
  ...(row.unit_cost === '' ? {} : { unit_cost: row.unit_cost }),
  ...(row.batch === '' ? {} : { batch_code: row.batch }),
  ...(row.expires === '' ? {} : { expires_on: row.expires }),
});

interface Part {
  id: string;
  number: string;
  status: string;
  lines: number;
}

export function Opening({ t, receiptId }: { t: AddOnTranslate; receiptId: string | null }): ReactNode {
  const access = useAccess();
  const read = useRead();
  const toasts = useAppToasts();
  const navigate = useNavigate();
  const mayOpen = access.canCreate('receipts') && access.canRead('receipt_lines', ['unit_cost']);
  const mayAddItems = access.canCreate('items');
  const places = useRecords('places', { filter: [{ column: 'active', op: 'eq', value: true }], sort: [{ column: 'name', direction: 'asc' }], pageSize: 199, columns: ['id', 'name'], enabled: mayOpen });
  const settings = useRecords('settings', { pageSize: 1, columns: ['default_place_id', 'default_unit_id'], enabled: mayOpen });
  const receipts = useTreeWrite('receipts');
  const lineWrites = useWrite('receipt_lines');
  const items = useWrite('items');
  const move = useStateMove('receipts');

  const [placeId, setPlaceId] = useState('');
  const [rows, setRows] = useState<Matched[] | null>(null);
  const [reading, setReading] = useState<number | null>(null);
  const [fileSaid, setFileSaid] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [saved, setSaved] = useState<Part[]>([]);
  const [busy, setBusy] = useState<'make' | 'save' | 'load' | null>(null);
  const [run, setRun] = useState<{ part: number; done: number; all: number } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const defaultPlace = text(settings.rows[0]?.['default_place_id']);
  useEffect(() => {
    if (placeId === '' && defaultPlace !== '') setPlaceId(defaultPlace);
  }, [placeId, defaultPlace]);

  // A draft to go on with: the one receipt the address names.
  useEffect(() => {
    if (receiptId === null || !mayOpen) return;
    let live = true;
    void read.get('receipts', receiptId).then((row) => {
      if (live && row !== null && row['kind'] === 'opening') setSaved([{ id: text(row['id']), number: text(row['number']), status: text(row['status']), lines: Number(row['lines'] ?? 0) }]);
    });
    return () => {
      live = false;
    };
  }, [read, receiptId, mayOpen]);

  const unmatched = useMemo(() => (rows ?? []).filter((row) => row.item === null), [rows]);
  const ready = useMemo(() => (rows ?? []).filter((row) => row.item !== null), [rows]);
  const wrong = ready.filter((row) => row.problems.length > 0);
  const working = busy !== null || reading !== null;

  const choose = async (file: File | undefined): Promise<void> => {
    setFileSaid(null);
    setProblem(null);
    setRows(null);
    setPage(1);
    if (file === undefined) return;
    const parsed = parse(await file.text());
    if (!parsed.ok) {
      setFileSaid(
        parsed.why === 'too-many'
          ? t('opening.file.tooMany', 'This file has {count} rows. A file may hold up to {max}: split it and load each part.', { count: parsed.count ?? 0, max: ROWS_MAX })
          : parsed.why === 'header'
            ? t('opening.file.header', 'The first row must name the columns: quantity, and one of sku, barcode or name. Download the sample file to see them.')
            : t('opening.file.empty', 'This file has no rows.'),
      );
      return;
    }
    setReading(0);
    try {
      setRows(await matchRows(read, parsed.rows, (done) => setReading(done)));
    } catch (caught) {
      setFileSaid(refusal(t, asDataError(caught)).message);
    } finally {
      setReading(null);
    }
  };

  const makeItems = async (): Promise<void> => {
    setBusy('make');
    setProblem(null);
    try {
      const unitId = text(settings.rows[0]?.['default_unit_id']);
      const made = new Map<string, DataRow>();
      for (const row of unmatched) {
        const key = `${row.barcode}|${row.sku}|${row.name}`.toLowerCase();
        if (row.name === '' || made.has(key)) continue;
        const { row: item } = await items.create({ name: row.name, ...(row.barcode === '' ? {} : { barcode: row.barcode }), ...(row.sku === '' ? {} : { sku: row.sku }), ...(unitId === '' ? {} : { unit_id: unitId }) });
        made.set(key, item);
      }
      setRows((all) => (all ?? []).map((row) => (row.item === null ? { ...row, item: made.get(`${row.barcode}|${row.sku}|${row.name}`.toLowerCase()) ?? null } : row)));
      toasts.push({ variant: 'success', title: t('opening.itemsMade', '{count, plural, one {# item} other {# items}} made', { count: made.size }) });
    } catch (caught) {
      setProblem(refusal(t, asDataError(caught)).message);
    } finally {
      setBusy(null);
    }
  };

  const saveDraft = async (): Promise<void> => {
    setProblem(null);
    if (placeId === '') {
      setProblem(t('opening.choosePlace', 'Choose the place this stock is in'));
      return;
    }
    if (wrong.length > 0) {
      setProblem(t('opening.fixFirst', '{count, plural, one {# row needs} other {# rows need}} fixing in the file first', { count: wrong.length }));
      return;
    }
    if (ready.length === 0) {
      setProblem(t('opening.nothing', 'There is nothing to load'));
      return;
    }
    setBusy('save');
    const made: Part[] = [];
    try {
      for (const chunk of parts(ready, PART_MAX)) {
        const { row } = await receipts.create({ values: { kind: 'opening', place_id: placeId }, children: { receipt_lines: chunk.map((line) => ({ values: lineValues(line) })) } });
        made.push({ id: text(row['id']), number: text(row['number']), status: text(row['status']) || 'draft', lines: chunk.length });
      }
      setSaved(made);
      setRows(null);
      toasts.push({ variant: 'success', title: t('opening.draftSaved', 'Draft saved. Find it under Receipts.') });
      await navigate({ to: PAGE, search: { receipt: made[0]?.id }, replace: true });
    } catch (caught) {
      // What was saved before the refusal stays saved, and is listed.
      setSaved(made);
      setProblem(refusal(t, asDataError(caught)).message);
    } finally {
      setBusy(null);
    }
  };

  const load = async (): Promise<void> => {
    setProblem(null);
    setBusy('load');
    try {
      for (const [index, part] of saved.entries()) {
        if (part.status !== 'draft' && part.status !== 'posting') continue;
        const sheet = await read.get('receipts', part.id);
        if (sheet === null) continue;
        const outcome = await runSheet({ read, move, updateEach: lineWrites.updateEach, onProgress: (done, all) => setRun({ part: index + 1, done, all }) }, RECEIPT_POST, sheet);
        const now = await read.get('receipts', part.id);
        setSaved((all) => all.map((candidate) => (candidate.id === part.id ? { ...candidate, status: text(now?.['status']) || candidate.status } : candidate)));
        if (!outcome.finished) {
          const first = outcome.refused[0];
          setProblem(
            first === undefined
              ? t('opening.stopped', 'Part {part}: {done} of {all} lines are in. Go on when you are ready.', { part: index + 1, done: outcome.done, all: outcome.all })
              : t('opening.stoppedAt', 'Part {part}: a line was refused. {reason} Open the part to correct it.', { part: index + 1, reason: refusal(t, first.error).message }),
          );
          return;
        }
      }
      toasts.push({ variant: 'success', title: t('opening.loaded', 'Opening stock loaded') });
    } catch (caught) {
      setProblem(refusal(t, asDataError(caught)).message);
    } finally {
      setRun(null);
      setBusy(null);
    }
  };

  const download = (): void => {
    const url = URL.createObjectURL(new Blob([SAMPLE], { type: 'text/csv' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'opening-stock.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const columns: LineColumn<Matched>[] = [
    {
      key: 'item',
      label: t('opening.col.item', 'Item'),
      cell: (row) => (
        <Stack gap="xs">
          <span className="font-semibold text-fg">{text(row.item?.['name'])}</span>
          <span className="text-body-sm text-fg-muted">{t('opening.row', 'Row {at}', { at: row.at })}</span>
        </Stack>
      ),
    },
    { key: 'qty', label: t('opening.col.qty', 'Quantity'), cell: (row) => <Cell value={`${row.quantity} ${text(row.item?.['unit'])}`} bad={row.problems.includes('quantity') ? t('opening.err.qty', 'Enter a quantity above zero, with a point for decimals') : null} /> },
    { key: 'cost', label: t('opening.col.cost', 'Unit cost'), cell: (row) => <Cell value={row.unit_cost === '' ? '—' : row.unit_cost} bad={row.problems.includes('unit_cost') ? t('opening.err.cost', 'Enter a cost like 1.10') : null} /> },
    { key: 'batch', label: t('opening.col.batch', 'Batch'), cell: (row) => <span dir="ltr">{row.batch === '' ? '—' : row.batch}</span> },
    { key: 'expires', label: t('opening.col.expires', 'Expires'), cell: (row) => <Cell value={row.expires === '' ? '—' : row.expires} bad={row.problems.includes('expires') ? t('opening.err.expires', 'Write the date as 2027-04-30') : null} /> },
  ];

  if (!mayOpen) return <PageFrame t={t} title={t('opening.title', 'Opening stock')} refused />;
  const pages = Math.max(1, Math.ceil(ready.length / REVIEW_PAGE));
  const many = parts(ready, PART_MAX).length;
  const toLoad = saved.some((part) => part.status === 'draft' || part.status === 'posting');
  return (
    <PageFrame t={t} title={t('opening.title', 'Opening stock')} testId="inventory-opening">
      {saved.length > 0 ? (
        <Card title={t('opening.saved.title', 'Saved to load')}>
          <Stack gap="sm">
            {saved.map((part, index) => (
              <Stack key={part.id} direction="row" justify="between" align="center" wrap gap="md">
                <span>
                  {saved.length > 1 ? t('opening.part', 'Opening stock, part {n} of {m}', { n: index + 1, m: saved.length }) : t('opening.onePart', 'Opening stock')} · <Figure>{part.number}</Figure> · {t('opening.partLines', '{count, plural, one {# line} other {# lines}}', { count: part.lines })}
                </span>
                <Stack direction="row" gap="sm" align="center">
                  <Tag tone={part.status === 'posted' ? 'pos' : part.status === 'posting' ? 'warn' : 'neutral'}>{part.status === 'posted' ? t('opening.status.loaded', 'Loaded') : part.status === 'posting' ? t('opening.status.partly', 'Partly loaded') : t('opening.status.draft', 'Draft')}</Tag>
                  <Link to={`${RECEIVE}?receipt=${encodeURIComponent(part.id)}`}>{t('opening.openPart', 'Open')}</Link>
                </Stack>
              </Stack>
            ))}
          </Stack>
        </Card>
      ) : null}
      {saved.length === 0 ? (
        <Card title={t('opening.file.title', 'The file')} description={t('opening.file.body', 'One row for each item, or for each batch of an item. Dates are written 2027-04-30; decimals take a point.')}>
          <Stack gap="md">
            <Select label={t('opening.place', 'Place')} value={placeId} onChange={(event) => setPlaceId(event.target.value)} options={[{ value: '', label: t('opening.choose', 'Choose a place') }, ...places.rows.map((place) => ({ value: text(place['id']), label: text(place['name']) }))]} disabled={working} required />
            <FileInput label={t('opening.file.choose', 'Choose a CSV file')} type="file" accept=".csv,text/csv" disabled={working} onChange={(event) => void choose(event.target.files?.[0])} {...(fileSaid === null ? {} : { error: fileSaid })} />
            <Stack direction="row">
              <Button variant="link" onClick={download}>
                {t('opening.sample', 'Download a sample file')}
              </Button>
            </Stack>
            {reading === null ? null : <span role="status">{t('opening.reading', 'Reading the file · {done} rows matched so far', { done: reading })}</span>}
          </Stack>
        </Card>
      ) : null}
      {rows !== null && unmatched.length > 0 ? (
        <Alert
          tone="warn"
          title={t('opening.unmatched.title', '{count, plural, one {# row matches} other {# rows match}} no item', { count: unmatched.length })}
          body={t('opening.unmatched.body', 'Rows {rows}{more}. They are left out unless you make the items.', { rows: unmatched.slice(0, 12).map((row) => row.at).join(', '), more: unmatched.length > 12 ? ' …' : '' })}
          action={
            <Stack direction="row" gap="xs">
              {mayAddItems && unmatched.some((row) => row.name !== '') ? (
                <Button variant="secondary" size="sm" loading={busy === 'make'} disabled={working} onClick={() => void makeItems()}>
                  {t('opening.unmatched.make', 'Make these items')}
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" disabled={working} onClick={() => setRows((all) => (all ?? []).filter((row) => row.item !== null))}>
                {t('opening.unmatched.leave', 'Leave out')}
              </Button>
            </Stack>
          }
        />
      ) : null}
      {saved.length === 0 ? (
        <Card title={t('opening.review', 'Review')} description={rows === null ? undefined : t('opening.reviewCount', '{count, plural, one {# line} other {# lines}} to load', { count: ready.length })}>
          <Stack gap="md">
            {many > 1 ? <Alert tone="info" title={t('opening.parts', '{count} lines: this is saved as {parts} receipts, in the order of the file.', { count: ready.length, parts: many })} /> : null}
            <LinesTable label={t('opening.review', 'Review')} columns={columns} lines={ready.slice((page - 1) * REVIEW_PAGE, page * REVIEW_PAGE)} lineKey={(row) => String(row.at)} lineLabel={(row) => text(row.item?.['name'])} empty={<EmptyState compact title={t('opening.empty', 'Choose a file to begin')} />} />
            {pages > 1 ? <Pagination page={page} pageCount={pages} onPageChange={setPage} label={t('opening.pages', 'Pages of lines')} previousLabel={t('shared.previous', 'Previous')} nextLabel={t('shared.next', 'Next')} pageLabel={(n) => t('shared.pageN', 'Page {n}', { n })} /> : null}
          </Stack>
        </Card>
      ) : null}
      <TotalsBar
        label={t('opening.bar', 'Opening stock')}
        totals={saved.length > 0 ? t('opening.totalsSaved', '{count, plural, one {# receipt} other {# receipts}} saved', { count: saved.length }) : t('opening.totals', '{count, plural, one {# line} other {# lines}} to load', { count: ready.length })}
        problem={problem}
        progress={run === null ? null : <ProgressBar value={run.done} max={Math.max(run.all, 1)} label={t('opening.progress', 'Part {part}: {done} of {all} lines', { part: run.part, done: run.done, all: run.all })} />}
      >
        {saved.length === 0 ? (
          <Button variant="primary" loading={busy === 'save'} disabled={working || rows === null} onClick={() => void saveDraft()}>
            {t('opening.saveDraft', 'Save as draft')}
          </Button>
        ) : toLoad ? (
          <Button variant="primary" loading={busy === 'load'} disabled={working} onClick={() => void load()}>
            {saved.some((part) => part.status === 'posting') ? t('shared.continuePosting', 'Continue posting') : t('opening.load', 'Load opening stock')}
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => void navigate({ to: PAGE })}>
            {t('opening.another', 'Load another file')}
          </Button>
        )}
      </TotalsBar>
    </PageFrame>
  );
}

function Cell({ value, bad }: { value: string; bad: string | null }): ReactNode {
  return (
    <Stack gap="xs">
      <span dir="ltr">
        <Figure>{value}</Figure>
      </span>
      {bad === null ? null : <Tag tone="danger">{bad}</Tag>}
    </Stack>
  );
}
