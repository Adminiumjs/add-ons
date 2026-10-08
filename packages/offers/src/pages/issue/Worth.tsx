/**
 * WHAT A VOUCHER IS WORTH: an amount, a percent, one named thing, or a pack
 * of uses of a named thing. The same four for one voucher and for a batch.
 *
 * A named thing is a row of a table that an order's lines sell — picked from
 * the tables the place's own rules name, searched by the server.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Alert, Button, Field, NumberInput, RadioCard, RadioGroup, SearchInput, Select, Stack, Tag, asDataError, type AddOnTranslate, type DataValue } from '../shared/host.ts';
import { refusal } from '../shared/refusal.ts';
import { mapped, things, type Mapped, type Thing, type WhatTable } from '../shared/things.ts';
import type { Wrong } from './form.tsx';

export interface Worth {
  worth: 'amount' | 'percent' | 'thing' | 'pack';
  value: string;
  /** Index into the tables a thing can be picked from. */
  table: string;
  thing: Thing | null;
  uses: string;
}
export const NO_WORTH: Worth = { worth: 'amount', value: '', table: '', thing: null, uses: '10' };

const named = (worth: Worth): boolean => worth.worth === 'thing' || worth.worth === 'pack';

/** What is wrong with it, by field. */
export function checkWorth(t: AddOnTranslate, worth: Worth, tables: readonly WhatTable[]): Record<string, string> {
  const found: Record<string, string> = {};
  if (!named(worth)) {
    const number = Number(worth.value);
    if (!/^\d+(\.\d+)?$/.test(worth.value) || number <= 0) found['value'] = t('issue.worth.valueNeeded', 'Enter a value above zero.');
    else if (worth.worth === 'percent' && number > 100) found['value'] = t('issue.worth.percentMax', 'A percent is 100 at most.');
    return found;
  }
  if (worth.thing === null || tables[Number(worth.table)] === undefined) found['source_row'] = t('issue.worth.thingNeeded', 'Choose what it is for.');
  if (worth.worth === 'pack') {
    const uses = Number(worth.uses);
    if (!/^\d+$/.test(worth.uses) || uses < 2 || uses > 50) found['uses_total'] = t('issue.worth.usesRange', 'A pack has from 2 to 50 uses.');
  }
  return found;
}

/** The columns a voucher or a batch keeps its worth in. */
export function worthValues(worth: Worth, tables: readonly WhatTable[]): Record<string, DataValue> {
  if (!named(worth)) return { worth: worth.worth, value: worth.value, uses_total: 1 };
  const table = tables[Number(worth.table)] as WhatTable;
  return { worth: worth.worth, what: table.as, source_table: table.ref, source_row: worth.thing?.key ?? '', units: 1, uses_total: worth.worth === 'pack' ? Number(worth.uses) : 1 };
}

/** The tables a thing can be picked from; null while they are read. */
export function useWhat(t: AddOnTranslate): { mapped: Mapped | null; failed: string | null } {
  const [read, setRead] = useState<Mapped | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    mapped().then(
      (next) => (live ? setRead(next) : undefined),
      (caught: unknown) => (live ? setFailed(refusal(t, asDataError(caught)).message) : undefined),
    );
    return () => {
      live = false;
    };
  }, [t]);
  return { mapped: read, failed };
}

export function WorthFields({ t, worth, onChange, what, wrong }: { t: AddOnTranslate; worth: Worth; onChange: (next: Worth) => void; what: Mapped | null; wrong: Wrong }): ReactNode {
  const [search, setSearch] = useState('');
  const [found, setFound] = useState<readonly Thing[]>([]);
  const [said, setSaid] = useState<string | null>(null);
  const turn = useRef(0);
  const tables = what?.what ?? [];
  const table = tables[Number(worth.table)];

  const find = async (typed: string): Promise<void> => {
    if (what === null || table === undefined) return;
    const mine = (turn.current += 1);
    try {
      const rows = await things(what.connectionId, table.table, typed);
      if (mine !== turn.current) return;
      setFound(rows);
      setSaid(rows.length === 0 ? t('issue.worth.noneFound', 'Nothing found.') : null);
    } catch (caught) {
      if (mine === turn.current) setSaid(refusal(t, asDataError(caught)).message);
    }
  };
  const on = (field: string): { error?: string } => (wrong[field] === undefined ? {} : { error: wrong[field] });

  return (
    <Stack gap="md">
      <RadioGroup value={worth.worth} onValueChange={(value) => onChange({ ...worth, worth: value as Worth['worth'] })} aria-label={t('issue.worth.label', 'Worth')}>
        <RadioCard value="amount" title={t('issue.worth.amount', 'An amount')} description={t('issue.worth.amountHint', 'Takes this much off an order')} />
        <RadioCard value="percent" title={t('issue.worth.percent', 'A percent')} description={t('issue.worth.percentHint', 'Takes this share off an order')} />
        <RadioCard value="thing" title={t('issue.worth.thing', 'One thing')} description={t('issue.worth.thingHint', 'Pays for one named thing')} />
        <RadioCard value="pack" title={t('issue.worth.pack', 'A pack')} description={t('issue.worth.packHint', 'So many uses of one named thing')} />
      </RadioGroup>
      {named(worth) ? null : <NumberInput label={worth.worth === 'percent' ? t('issue.worth.percentValue', 'Percent') : t('issue.worth.amountValue', 'Amount')} value={worth.value} onChange={(value) => onChange({ ...worth, value })} decimals={2} required {...(worth.worth === 'percent' ? { unit: '%' } : {})} {...on('value')} />}
      {named(worth) && what !== null && tables.length === 0 ? <Alert tone="warn" title={t('issue.worth.noTables', 'Nothing here says what its lines sell yet.')} body={t('issue.worth.noTablesBody', 'Add a rule under Offer rules first.')} /> : null}
      {named(worth) && tables.length > 0 ? (
        <>
          <Select
            label={t('issue.worth.table', 'From')}
            value={worth.table}
            options={[{ value: '', label: t('issue.worth.choose', 'Choose…') }, ...tables.map((one, index) => ({ value: String(index), label: one.label }))]}
            onChange={(event) => {
              setFound([]);
              setSearch('');
              onChange({ ...worth, table: event.target.value, thing: null });
            }}
          />
          {table === undefined ? null : (
            <Field label={t('issue.worth.what', 'What it is for')} required {...on('source_row')}>
              <SearchInput
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  void find(event.target.value);
                }}
                onSubmit={(value) => {
                  const picked = found.find((thing) => thing.key === value);
                  if (picked === undefined) return void find(value);
                  setSearch('');
                  setFound([]);
                  onChange({ ...worth, thing: picked });
                }}
                options={found.map((thing) => ({ value: thing.key, label: thing.label }))}
                placeholder={t('issue.worth.search', 'Search by name')}
              />
            </Field>
          )}
          {worth.thing === null ? null : (
            <Stack direction="row" gap="sm" align="center">
              <Tag tone="accent">{worth.thing.label}</Tag>
              <Button variant="link" size="sm" onClick={() => onChange({ ...worth, thing: null })}>
                {t('issue.worth.change', 'Change')}
              </Button>
            </Stack>
          )}
          {said === null ? null : <span className="text-body-sm text-fg-muted">{said}</span>}
        </>
      ) : null}
      {worth.worth === 'pack' ? <NumberInput label={t('issue.worth.uses', 'Uses')} value={worth.uses} onChange={(uses) => onChange({ ...worth, uses })} whole required hint={t('issue.worth.usesHint', 'From 2 to 50')} {...on('uses_total')} /> : null}
    </Stack>
  );
}
