/**
 * THE FUNNELS TAB (comp 1a's Funnels tab, 2a when there is none).
 *
 * Each funnel with its steps' names in order and the views of its first and
 * last step this month. "New funnel" shows only to someone who may make one.
 */
import { useEffect, useState, type ReactNode } from 'react';

import { Button, DataTable, EmptyState, api, useAccess, useLocaleTag, useNavigate, useRecords, type AddOnTranslate, type DataRow } from '../shared/host.ts';
import { formInstallOf, useLanding } from '../shared/landing.tsx';
import { Icon } from '../shared/parts.tsx';
import { funnelAt, FUNNELS_TABLE } from '../shared/paths.ts';
import { FUNNEL_COLUMNS, funnelRowOf, type FunnelRow, type PageRow } from '../shared/rows.ts';
import { rangeOf, rangeWords } from '../shared/days.ts';
import { cardsOf, countCards, type Card } from './count.ts';
import { FunnelDialog } from './FunnelDialog.tsx';
import { stepNamesOf } from './words.ts';

/** The first and the last card of each funnel, with their counts this month. */
function useEnds(funnels: readonly FunnelRow[], pages: readonly PageRow[]): ReadonlyMap<string, { first: { card: Card; count: number | null } | null; last: { card: Card; count: number | null } | null }> {
  const landing = useLanding();
  const [ends, setEnds] = useState<ReadonlyMap<string, { first: { card: Card; count: number | null } | null; last: { card: Card; count: number | null } | null }>>(new Map());
  const byKey = new Map(pages.map((page) => [page.key, page]));
  const signature = JSON.stringify([funnels.map((one) => [one.key, one.steps]), pages.map((page) => [page.key, page.name, page.slug, page.state]), landing.forms?.length ?? -1, landing.pagesInstall, landing.today]);
  useEffect(() => {
    let live = true;
    const range = rangeOf('this-month', landing.today);
    void Promise.all(
      funnels.map(async (funnel) => {
        const cards = cardsOf(funnel.steps, byKey, landing.forms ?? []);
        const counted = await countCards(api, cards, range, landing.pagesInstall, (form) => formInstallOf(landing, form));
        const at = (i: number) => (cards[i] === undefined ? null : { card: cards[i], count: counted.counts[i] ?? null });
        return [funnel.key, { first: at(0), last: cards.length > 1 ? at(cards.length - 1) : null }] as const;
      }),
    ).then((all) => {
      if (live) setEnds(new Map(all));
    });
    return () => {
      live = false;
    };
    // The signature holds everything the counts are read from.
  }, [signature]);
  return ends;
}

export function FunnelsTab({ t, pages, pagesLoading }: { t: AddOnTranslate; pages: readonly PageRow[]; pagesLoading: boolean }): ReactNode {
  const navigate = useNavigate();
  const access = useAccess();
  const landing = useLanding();
  const locale = useLocaleTag();
  const [making, setMaking] = useState(false);
  const read = useRecords(FUNNELS_TABLE, { columns: FUNNEL_COLUMNS, sort: [{ column: 'name', direction: 'asc' }], pageSize: 199 });
  const funnels = read.rows.map(funnelRowOf);
  const ends = useEnds(funnels, pages);
  const mayMake = access.canCreate(FUNNELS_TABLE);
  const number = new Intl.NumberFormat(locale);
  const maker = mayMake ? (
    <Button variant="primary" iconLeft={<Icon name="plus" />} onClick={() => setMaking(true)}>
      {t('funnels.new', 'New funnel')}
    </Button>
  ) : null;
  const end = (one: { card: Card; count: number | null } | null): ReactNode =>
    one === null ? (
      <span className="text-fg-muted">—</span>
    ) : (
      <span className="whitespace-nowrap">
        <span className="font-mono font-bold">{one.count === null ? '—' : number.format(one.count)}</span> <span className="text-fg-muted">{one.card.unit === 'sends' ? t('funnels.sends', 'sends') : t('funnels.views', 'views')}</span>
      </span>
    );

  let body: ReactNode;
  if (read.error !== null) body = <EmptyState title={t('shared.failed', 'This could not be loaded')} actions={<Button onClick={() => read.refetch()}>{t('shared.retry', 'Try again')}</Button>} />;
  else if (!read.loading && funnels.length === 0)
    body = <EmptyState title={t('funnels.empty.title', 'No funnels yet')} body={t('funnels.empty.body', 'Put a page, its form and its thanks page in order to see how many views each step gets.')} actions={maker} />;
  else
    body = (
      <span className="flex flex-col gap-3">
        {maker === null ? null : <span className="flex justify-end">{maker}</span>}
        <DataTable
          loading={read.loading || pagesLoading}
          rows={funnels.map((funnel) => ({ id: funnel.key, name: funnel.name }) as DataRow)}
          columns={[
            { key: 'name', label: t('funnels.col.funnel', 'Funnel'), render: (row) => <span className="font-bold">{String(row['name'])}</span> },
            {
              key: 'steps',
              label: t('funnels.col.steps', 'Steps'),
              render: (row) => <span className="text-fg-muted">{stepNamesOf(t, funnels.find((one) => one.key === row['id'])?.steps ?? [], pages, landing.forms ?? []).join(' → ') || '—'}</span>,
            },
            { key: 'first', label: t('funnels.col.first', 'First step'), render: (row) => end(ends.get(String(row['id']))?.first ?? null) },
            { key: 'last', label: t('funnels.col.last', 'Last step'), render: (row) => end(ends.get(String(row['id']))?.last ?? null) },
            {
              key: 'open',
              // The host's table names every column; the action's own words name this one.
              label: t('funnels.open', 'Open'),
              align: 'end',
              sortable: false,
              render: (row) => (
                <Button variant="link" onClick={() => void navigate({ to: funnelAt(String(row['id'])) })}>
                  {t('funnels.open', 'Open')}
                </Button>
              ),
            },
          ]}
        />
        <p className="m-0 text-[11.5px] text-fg-subtle">
          {t('funnels.caption', 'This month, {range}. Views, not people.', { range: rangeWords(rangeOf('this-month', landing.today), locale) })}
        </p>
      </span>
    );

  return (
    <>
      {body}
      {making ? (
        <FunnelDialog
          t={t}
          funnel={null}
          pages={pages}
          onClose={() => setMaking(false)}
          onSaved={(key) => {
            setMaking(false);
            void navigate({ to: funnelAt(key) });
          }}
        />
      ) : null}
    </>
  );
}
