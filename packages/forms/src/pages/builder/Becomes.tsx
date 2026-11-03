/**
 * "EACH ANSWER BECOMES" (comp 301-330, E4.5): a new row in a table an app
 * opens to forms, or nothing but the answer kept here.
 *
 * Only the tables Adminium lists for this add-on are offered ("{table} —
 * {app}"); with none, only "Just keep the answers". The map is built from
 * the chosen table's columns: each column a question may fill, with the
 * questions that can (a column filled once, a question filling one column).
 * A link to another row is never offered to a question; on a named survey
 * that keeps names it shows locked, filled from the invitation. The table's
 * source column is the fixed row every new row gets.
 */
import type { ReactNode } from 'react';

import { Input, RadioCard, RadioGroup, Select, useFormTables, type AddOnTranslate } from '../shared/host.ts';
import { becomesFor, mapColumn, numberOf, wordIn, type Becomes as BecomesValue, type Draft } from './draft.ts';
import { fillerOf, fillersOf, mapFor, mappable, offEnum, kitTables, type KitTable } from './mapping.ts';
import { Icon } from './parts.tsx';
import type { Builder } from './store.ts';

/** The fixed source row's value at first: the form's title in its own language. */
const sourceFor = (table: KitTable, draft: Draft): { column: string; value: string } | undefined => {
  if (table.sourceColumn === undefined) return undefined;
  const title = wordIn(draft.definition.title, draft.definition.defaultLanguage).trim().slice(0, 200);
  return { column: table.sourceColumn, value: title === '' ? table.label : title };
};

export function becomesSummary(t: AddOnTranslate, draft: Draft, tables: readonly KitTable[]): string {
  const becomes = draft.settings.becomes;
  if (becomes === null || becomes === undefined) return t('builder.becomes.keep', 'Just keep the answers');
  const table = tables.find((one) => one.id === becomes.table);
  return t('builder.becomes.summary', 'A new row in {table}', { table: table === undefined ? becomes.table : `${table.label} — ${table.app}` });
}

export function BecomesSection({ t, builder, mayEdit }: { t: AddOnTranslate; builder: Builder; mayEdit: boolean }): ReactNode {
  const tables = kitTables(useFormTables().tables);
  const draft = builder.draft;
  const d = draft.definition;
  const becomes = draft.settings.becomes ?? null;
  const table = becomes === null ? undefined : tables.find((one) => one.id === becomes.table);
  const lang = builder.editing;
  const set = (next: BecomesValue | null): void => builder.change((one) => ({ ...one, settings: { ...one.settings, becomes: next } }));
  const pick = (id: string): void => {
    const chosen = tables.find((one) => one.id === id);
    if (chosen === undefined) return;
    set(becomesFor(chosen.id, becomes === null ? {} : mapFor(d, becomes.map, chosen), sourceFor(chosen, draft)));
  };
  // A named survey that keeps names fills the table's links from the invitation the answer came by.
  const named = d.kind === 'survey' && draft.settings.survey?.mode === 'named' && draft.settings.survey.linkNames;

  return (
    <span className="flex flex-col gap-2.5">
      <RadioGroup value={becomes === null ? 'keep' : 'row'} onValueChange={(value) => (value === 'keep' ? set(null) : tables[0] === undefined ? undefined : pick(table?.id ?? tables[0].id))} aria-label={t('builder.s.becomes', 'Each answer becomes')}>
        <RadioCard value="row" title={t('builder.becomes.row', 'A new row in')} disabled={!mayEdit || tables.length === 0} />
        <RadioCard value="keep" title={t('builder.becomes.keep', 'Just keep the answers')} description={t('builder.becomes.keepSub', 'Answers stay here, under Answers.')} disabled={!mayEdit} />
      </RadioGroup>
      {tables.length === 0 ? <span className="text-[11.5px] text-fg-subtle">{t('builder.becomes.none', 'No app opens a table to forms yet, so answers can only be kept here.')}</span> : null}
      {becomes === null ? null : (
        <span className="flex flex-col gap-2.5">
          <Select
            aria-label={t('builder.becomes.table', 'Table')}
            value={becomes.table}
            disabled={!mayEdit}
            options={[...(table === undefined ? [{ value: becomes.table, label: t('builder.becomes.gone', 'A table no longer open to forms') }] : []), ...tables.map((one) => ({ value: one.id, label: `${one.label} — ${one.app}` }))]}
            onChange={(event) => pick(event.target.value)}
          />
          <span className="text-[11.5px] leading-[1.45] text-fg-subtle">{t('builder.becomes.only', 'Only tables whose apps allow it are listed.')}</span>
          {table === undefined ? null : (
            <span className="flex flex-col overflow-hidden rounded-lg border border-border">
              <span className="grid grid-cols-[minmax(0,1fr)_22px_minmax(0,1fr)] gap-1.5 bg-surface-2 px-2.5 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.05em] text-fg-subtle">
                <span>{t('builder.becomes.question', 'Question')}</span>
                <span />
                <span>{t('builder.becomes.column', 'Column')}</span>
              </span>
              {mappable(table).map((column) => {
                const filler = fillerOf(becomes, column.name);
                const question = filler === null ? undefined : d.questions.find((one) => one.id === filler);
                const off = offEnum(question, column);
                return (
                  <span key={column.name} className="flex flex-col gap-1 border-t border-border px-2.5 py-1.5">
                    <span className="grid grid-cols-[minmax(0,1fr)_22px_minmax(0,1fr)] items-center gap-1.5 text-[12px]">
                      <Select
                        aria-label={t('builder.becomes.fills', 'The question that fills {column}', { column: column.label })}
                        value={filler ?? ''}
                        disabled={!mayEdit}
                        options={[{ value: '', label: '—' }, ...fillersOf(d, column).map((one) => ({ value: one.id, label: t('builder.where.question', 'Q{n} · {label}', { n: numberOf(d, one.id), label: wordIn(one.label, lang, d.defaultLanguage) }) }))]}
                        onChange={(event) => set(mapColumn(becomes, column.name, event.target.value === '' ? null : event.target.value))}
                      />
                      <span className="flex text-fg-subtle rtl:-scale-x-100" aria-hidden="true">
                        <Icon name="arrow-right" />
                      </span>
                      <bdi className="font-bold">{column.label}</bdi>
                    </span>
                    {column.required && filler === null ? <span className="text-[11.5px] font-semibold text-warn">{t('builder.becomes.required', 'Every row needs this. Pick the question that fills it.')}</span> : null}
                    {question?.kind === 'several' ? <span className="text-[11.5px] text-fg-subtle">{t('builder.becomes.several', 'The row gets the picked choices’ stored names, joined by commas.')}</span> : null}
                    {off.length > 0 ? (
                      <span className="text-[11.5px] font-semibold text-warn">
                        {t('builder.becomes.values', '{column} takes only {values}. Store these choices as one of them: {choices}.', { column: column.label, values: (column.values ?? []).join(', '), choices: off.join(', ') })}
                      </span>
                    ) : null}
                  </span>
                );
              })}
              {named
                ? table.columns
                    .filter((column) => column.link)
                    .map((column) => (
                      <span key={column.name} className="grid grid-cols-[minmax(0,1fr)_22px_minmax(0,1fr)] items-center gap-1.5 border-t border-border bg-surface-2 px-2.5 py-1.5 text-[12px]">
                        <span className="flex items-center gap-1.5 font-bold">
                          <Icon name="lock" />
                          {t('builder.becomes.invitation', 'From the invitation')}
                        </span>
                        <span className="flex text-fg-subtle rtl:-scale-x-100" aria-hidden="true">
                          <Icon name="arrow-right" />
                        </span>
                        <bdi className="font-bold">{column.label}</bdi>
                      </span>
                    ))
                : null}
              {becomes.source === undefined || table.sourceColumn === undefined ? null : (
                <span className="grid grid-cols-[minmax(0,1fr)_22px_minmax(0,1fr)] items-center gap-1.5 border-t border-border bg-surface-2 px-2.5 py-1.5 text-[12px]">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Icon name="lock" />
                    <bdi>{table.columns.find((column) => column.name === table.sourceColumn)?.label ?? table.sourceColumn}</bdi>
                  </span>
                  <span className="flex text-fg-subtle rtl:-scale-x-100" aria-hidden="true">
                    <Icon name="arrow-right" />
                  </span>
                  <Input
                    aria-label={t('builder.becomes.fixed', 'Every new row gets this value.')}
                    value={becomes.source.value}
                    maxLength={200}
                    disabled={!mayEdit}
                    onChange={(event) => set({ ...becomes, source: { column: table.sourceColumn ?? '', value: event.target.value } })}
                  />
                </span>
              )}
            </span>
          )}
          {becomes.source === undefined ? null : <span className="text-[11.5px] text-fg-subtle">{t('builder.becomes.fixed', 'Every new row gets this value.')}</span>}
        </span>
      )}
    </span>
  );
}
