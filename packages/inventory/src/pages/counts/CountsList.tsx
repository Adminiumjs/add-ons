/**
 * THE COUNTS, AND STARTING ONE.
 *
 * A count is started for one place and one scope. Nothing stops a second
 * count of the same place — the dialog shows the ones still open there — and
 * sales made while a count is under way are kept: each line is compared with
 * what the books held at the moment its count was typed.
 */
import { useState, type ReactNode } from 'react';

import {
  Alert,
  Button,
  DataTable,
  EmptyState,
  Link,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Figure,
  Pagination,
  RadioCard,
  RadioGroup,
  Select,
  Stack,
  StatusPill,
  asDataError,
  useAccess,
  useAppToasts,
  useLocaleTag,
  useNavigate,
  useRead,
  useRecords,
  useTreeWrite,
  type AddOnTranslate,
  type DataRow,
  type TableColumn,
  type Tone,
} from '../shared/host.ts';
import { PageFrame } from '../shared/PageFrame.tsx';
import { refusal } from '../shared/refusal.ts';
import { COUNT_MAX, levelsInScope, type Scope } from './scope.ts';

export const COUNTS = '/add-ons/inventory/inventory-counts';
const PAGE_SIZE = 25;
const text = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

export const STATUS_TONE: Readonly<Record<string, Tone>> = { open: 'info', posting: 'info', posted: 'pos', reversing: 'warn', cancelled: 'neutral', reversed: 'warn' };

export function statusWords(t: AddOnTranslate, status: string): string {
  switch (status) {
    case 'open':
      return t('counts.status.open', 'Counting');
    case 'posting':
      return t('counts.status.posting', 'Posting');
    case 'posted':
      return t('counts.status.posted', 'Posted');
    case 'reversing':
      return t('counts.status.reversing', 'Reversing');
    case 'reversed':
      return t('counts.status.reversed', 'Reversed');
    case 'cancelled':
      return t('counts.status.cancelled', 'Cancelled');
    default:
      return status;
  }
}

export function scopeWords(t: AddOnTranslate, scope: string, category: string): string {
  switch (scope) {
    case 'category':
      return category === '' ? t('counts.scope.category', 'One category') : t('counts.scope.categoryNamed', 'Category: {category}', { category });
    case 'stale':
      return t('counts.scope.stale', 'Not counted lately');
    case 'to_check':
      return t('counts.scope.toCheck', 'Marked to check');
    default:
      return t('counts.scope.all', 'Everything in this place');
  }
}

export function CountsList({ t, startOpen }: { t: AddOnTranslate; startOpen: boolean }): ReactNode {
  const access = useAccess();
  const navigate = useNavigate();
  const locale = useLocaleTag();
  const mayOpen = access.canRead('counts');
  const mayStart = access.canCreate('counts');
  const money = access.canRead('counts', ['value']);
  const [page, setPage] = useState(1);
  const [starting, setStarting] = useState(startOpen);
  const counts = useRecords('counts', { sort: [{ column: 'id', direction: 'desc' }], page, pageSize: PAGE_SIZE, columns: ['id', 'number', 'place_id', 'scope', 'category_id', 'status', 'differences', 'at', ...(money ? ['value'] : [])], enabled: mayOpen });
  const places = useRecords('places', { sort: [{ column: 'name', direction: 'asc' }], pageSize: 199, columns: ['id', 'name', 'active'], enabled: mayOpen });
  const categories = useRecords('categories', { sort: [{ column: 'name', direction: 'asc' }], pageSize: 199, columns: ['id', 'name'], enabled: mayOpen });
  const nameOf = (rows: readonly DataRow[], id: unknown): string => text(rows.find((row) => text(row['id']) === text(id))?.['name']);
  const when = (iso: unknown): string => (text(iso) === '' ? '' : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(text(iso))));

  if (!mayOpen) return <PageFrame t={t} title={t('counts.title', 'Counts')} refused />;
  const columns: TableColumn[] = [
    { key: 'number', label: t('counts.col.count', 'Count'), render: (row) => <Figure>{text(row['number'])}</Figure> },
    { key: 'place_id', label: t('counts.col.place', 'Place'), render: (row) => nameOf(places.rows, row['place_id']) },
    { key: 'scope', label: t('counts.col.scope', 'Scope'), render: (row) => scopeWords(t, text(row['scope']), nameOf(categories.rows, row['category_id'])) },
    { key: 'at', label: t('counts.col.started', 'Started'), render: (row) => when(row['at']) },
    { key: 'status', label: t('counts.col.status', 'Status'), render: (row) => <StatusPill status={text(row['status'])} tone={STATUS_TONE[text(row['status'])] ?? 'neutral'}>{statusWords(t, text(row['status']))}</StatusPill> },
    { key: 'differences', label: t('counts.col.differences', 'Differences'), align: 'end' },
    ...(money ? [{ key: 'value', label: t('counts.col.value', 'Value'), align: 'end' as const, render: (row: DataRow) => <Figure>{text(row['value'])}</Figure> }] : []),
  ];
  return (
    <PageFrame
      t={t}
      title={t('counts.title', 'Counts')}
      error={counts.error}
      onRetry={counts.refetch}
      testId="inventory-counts"
      actions={
        mayStart ? (
          <Button variant="primary" onClick={() => setStarting(true)}>
            {t('counts.start', 'Start a count')}
          </Button>
        ) : null
      }
    >
      <DataTable
        columns={columns}
        rows={counts.rows}
        loading={counts.loading}
        cardsBelow={720}
        onRowClick={(row) => void navigate({ to: `${COUNTS}/${text(row['id'])}` })}
        empty={<EmptyState title={t('counts.empty.title', 'No counts yet')} body={t('counts.empty.body', 'Count a place to check the books against the shelves.')} {...(mayStart ? { actions: <Button onClick={() => setStarting(true)}>{t('counts.start', 'Start a count')}</Button> } : {})} />}
      />
      {page > 1 || counts.hasMore ? (
        <Pagination page={page} pageCount={counts.hasMore ? page + 1 : page} onPageChange={setPage} label={t('counts.pages', 'Pages of counts')} previousLabel={t('shared.previous', 'Previous')} nextLabel={t('shared.next', 'Next')} pageLabel={(n) => t('shared.pageN', 'Page {n}', { n })} />
      ) : null}
      {mayStart ? <StartDialog t={t} open={starting} onClose={() => setStarting(false)} places={places.rows.filter((place) => place['active'] !== false && place['active'] !== 0)} categories={categories.rows} /> : null}
    </PageFrame>
  );
}

function StartDialog({ t, open, onClose, places, categories }: { t: AddOnTranslate; open: boolean; onClose: () => void; places: readonly DataRow[]; categories: readonly DataRow[] }): ReactNode {
  const read = useRead();
  const toasts = useAppToasts();
  const navigate = useNavigate();
  const counts = useTreeWrite('counts');
  const settings = useRecords('settings', { pageSize: 1, columns: ['default_place_id', 'count_stale_days'], enabled: open });
  const [placeId, setPlaceId] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [categoryId, setCategoryId] = useState('');
  const [reading, setReading] = useState<number | null>(null);
  const [said, setSaid] = useState<{ field?: string; message: string } | null>(null);
  const place = placeId !== '' ? placeId : text(settings.rows[0]?.['default_place_id']);
  const days = Number(settings.rows[0]?.['count_stale_days'] ?? 90) || 90;
  const openHere = useRecords('counts', { filter: [{ column: 'place_id', op: 'eq', value: place }, { column: 'status', op: 'in', value: ['open', 'posting'] }], pageSize: 10, columns: ['id', 'number'], enabled: open && place !== '' });

  const start = async (): Promise<void> => {
    setSaid(null);
    if (place === '') {
      setSaid({ field: 'place_id', message: t('counts.start.choosePlace', 'Choose a place') });
      return;
    }
    if (scope === 'category' && categoryId === '') {
      setSaid({ field: 'category_id', message: t('counts.start.chooseCategory', 'Choose a category') });
      return;
    }
    setReading(0);
    try {
      const levels = await levelsInScope(read, { placeId: place, scope, ...(scope === 'category' ? { categoryId } : {}), ...(scope === 'stale' ? { before: new Date(Date.now() - days * 86_400_000).toISOString() } : {}) }, setReading);
      if (levels.length === 0) {
        setSaid({ message: t('counts.start.nothing', 'Nothing in this place matches: there is no line to count.') });
        return;
      }
      const made: string[] = [];
      for (let from = 0; from < levels.length; from += COUNT_MAX) {
        const { row } = await counts.create({ values: { place_id: place, scope, ...(scope === 'category' ? { category_id: categoryId } : {}) }, children: { count_lines: levels.slice(from, from + COUNT_MAX).map((level) => ({ values: { level_id: level } })) } });
        made.push(text(row['id']));
      }
      toasts.push({
        variant: 'success',
        title: made.length > 1 ? t('counts.start.doneParts', 'Count started for {place} as {parts} counts', { place: text(places.find((row) => text(row['id']) === place)?.['name']), parts: made.length }) : t('counts.start.done', 'Count started for {place}', { place: text(places.find((row) => text(row['id']) === place)?.['name']) }),
      });
      onClose();
      await navigate({ to: `${COUNTS}/${made[0] as string}` });
    } catch (caught) {
      const words = refusal(t, asDataError(caught));
      setSaid({ message: words.message, ...(words.field === undefined ? {} : { field: words.field }) });
    } finally {
      setReading(null);
    }
  };

  const on = (field: string): { error?: string } => (said?.field === field ? { error: said.message } : {});
  return (
    <Dialog open={open} onOpenChange={(next) => (next || reading !== null ? undefined : onClose())} size="md">
      <DialogHeader title={t('counts.start.title', 'Start a count')} closeLabel={t('shared.close', 'Close')} />
      <DialogBody>
        <Stack gap="md">
          <Select label={t('counts.start.place', 'Place')} value={place} onChange={(event) => setPlaceId(event.target.value)} options={[{ value: '', label: t('counts.start.choosePlace', 'Choose a place') }, ...places.map((row) => ({ value: text(row['id']), label: text(row['name']) }))]} disabled={reading !== null} required {...on('place_id')} />
          <RadioGroup value={scope} onValueChange={(next) => setScope(next as Scope)} aria-label={t('counts.start.what', 'What to count')}>
            <RadioCard value="all" title={t('counts.scope.all', 'Everything in this place')} />
            <RadioCard value="category" title={t('counts.scope.category', 'One category')} />
            <RadioCard value="stale" title={t('counts.scope.staleDays', 'Items not counted for {days} days', { days })} />
            <RadioCard value="to_check" title={t('counts.scope.toCheckItems', 'Items marked to check')} />
          </RadioGroup>
          {scope === 'category' ? <Select label={t('counts.start.category', 'Category')} value={categoryId} onChange={(event) => setCategoryId(event.target.value)} options={[{ value: '', label: t('counts.start.chooseCategory', 'Choose a category') }, ...categories.map((row) => ({ value: text(row['id']), label: text(row['name']) }))]} disabled={reading !== null} required {...on('category_id')} /> : null}
          <span className="text-body-sm text-fg-muted">{t('counts.start.help', 'Sales made while you count are kept. Each line is compared with what the books held at the moment you typed its count.')}</span>
          {openHere.rows.length > 0 ? (
            <Stack gap="xs">
              <span className="text-body-sm text-fg-muted">{t('counts.start.openHere', 'Counts still open for this place:')}</span>
              {openHere.rows.map((row) => (
                <Link key={text(row['id'])} to={`${COUNTS}/${text(row['id'])}`}>
                  {text(row['number'])}
                </Link>
              ))}
            </Stack>
          ) : null}
          {reading === null ? null : <span role="status">{t('counts.start.reading', 'Starting the count · reading {n} levels', { n: reading })}</span>}
          {said !== null && said.field === undefined ? <Alert tone="danger" role="alert" title={said.message} /> : null}
        </Stack>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" disabled={reading !== null} onClick={() => onClose()}>
          {t('shared.cancel', 'Cancel')}
        </Button>
        <Button variant="primary" loading={reading !== null} disabled={reading !== null} onClick={() => void start()}>
          {t('counts.start.go', 'Start')}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
