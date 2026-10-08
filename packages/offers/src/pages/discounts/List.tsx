/**
 * THE DISCOUNTS LIST: every discount with what it gives, how it starts, the
 * limits that are set, its state and what it has given so far. The counts and
 * the amounts are Adminium's own columns; nothing is added up here.
 */
import type { ReactNode } from 'react';

import { Button, Card, DataTable, EmptyState, StatusPill, Tag, money, useLocaleTag, useNavigate, useRecords, type AddOnTranslate, type DataRow, type TableColumn } from '../shared/host.ts';
import { PageFrame } from '../shared/PageFrame.tsx';
import { DISCOUNTS } from '../shared/paths.ts';
import { useRole } from '../shared/role.ts';
import { givesWords, limitWords, pillOf, pillTone, pillWords, targetNames } from './words.ts';

const text = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

export function List({ t }: { t: AddOnTranslate }): ReactNode {
  const locale = useLocaleTag();
  const role = useRole();
  const navigate = useNavigate();
  const offers = useRecords('offers', { sort: [{ column: 'name', direction: 'asc' }], pageSize: 199 });
  const ids = offers.rows.map((row) => row['id'] ?? null);
  const codes = useRecords('codes', { filter: [{ column: 'offer_id', op: 'in', value: ids }], pageSize: 199, columns: ['id', 'offer_id', 'code'], enabled: ids.length > 0 });
  const targets = useRecords('offer_targets', { filter: [{ column: 'offer_id', op: 'in', value: ids }], pageSize: 199, columns: ['id', 'offer_id', 'label'], enabled: ids.length > 0 });
  const of = (rows: readonly DataRow[], offer: DataRow): DataRow[] => rows.filter((row) => text(row['offer_id']) === text(offer['id']));

  const starts = (offer: DataRow): ReactNode => {
    if (offer['trigger'] === 'staff') return t('discounts.starts.staff', 'Only staff');
    if (offer['trigger'] !== 'code') return t('discounts.starts.itself', 'By itself');
    const own = of(codes.rows, offer);
    if (own.length === 0) return t('discounts.starts.code', 'Code');
    if (own.length > 1) return t('discounts.starts.codes', '{n} codes', { n: own.length });
    return (
      <span dir="ltr">
        <Tag>{text(own[0]?.['code'])}</Tag>
      </span>
    );
  };
  const columns: TableColumn[] = [
    { key: 'name', label: t('discounts.col.name', 'Name') },
    { key: 'gives', label: t('discounts.col.gives', 'What it gives'), render: (row) => givesWords(t, row, row['applies_to'] === 'lines' ? targetNames(t, of(targets.rows, row).map((target) => text(target['label']))) : '', locale) },
    { key: 'trigger', label: t('discounts.col.starts', 'How it starts'), render: starts },
    { key: 'limits', label: t('discounts.col.limits', 'Limits'), render: (row) => limitWords(t, row, locale).slice(0, 2).join(', ') || '—' },
    { key: 'status', label: t('discounts.col.status', 'Status'), render: (row) => <StatusPill status={pillOf(row)} tone={pillTone(pillOf(row))}>{pillWords(t, pillOf(row))}</StatusPill> },
    { key: 'uses', label: t('discounts.col.uses', 'Uses'), align: 'end', render: (row) => <span dir="ltr">{text(row['uses'] ?? 0)}</span> },
    { key: 'given', label: t('discounts.col.given', 'Given'), align: 'end', render: (row) => <span dir="ltr">{money(row['given'] ?? '0', locale)}</span> },
  ];
  const add = role.editOffers ? <Button variant="primary" onClick={() => void navigate({ to: `${DISCOUNTS}/new` })}>{t('discounts.new', 'New discount')}</Button> : undefined;

  return (
    <PageFrame t={t} title={t('discounts.title', 'Discounts')} loading={offers.loading} error={offers.error} onRetry={offers.refetch} actions={add} testId="offers-discounts">
      {offers.rows.length === 0 ? (
        <EmptyState title={t('discounts.empty.title', 'No discounts yet')} body={t('discounts.empty.body', 'A discount takes something off an order by itself, with a code, or when staff give it.')} {...(add === undefined ? {} : { actions: add })} />
      ) : (
        <Card title={t('discounts.all', 'All discounts')} description={t('discounts.count', '{n, plural, one {# discount} other {# discounts}} · uses and amount given to date', { n: offers.rows.length })} padded={false}>
          <DataTable columns={columns} rows={offers.rows} onRowClick={(row) => void navigate({ to: `${DISCOUNTS}/${encodeURIComponent(text(row['id']))}` })} cardsBelow={640} />
        </Card>
      )}
    </PageFrame>
  );
}
