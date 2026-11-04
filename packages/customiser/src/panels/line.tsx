/**
 * THE PANEL ON AN ORDER LINE: "Customising · read-only".
 *
 * Drawn in a tab of the record page of an app's order line, which links to
 * the shopper's design (`rules.addOnLink` into `designs`): which design it
 * is, what the shopper chose for each part, where it stands and its latest
 * proof. Nothing here changes the design: the shop proofs and makes from
 * its versions. The files for the machine are listed here once they are made.
 */
import type { ReactNode } from 'react';

import { Card, EmptyState, Figure, KeyValueList, Stack, StatusPill, useLocaleTag, useRecord, useRecords, type AddOnTranslate, type DataRow } from '../pages/shared/host.ts';
import { wordsFor } from '../pages/shared/messages.ts';
import { jsonOf, kindOf, mm, text } from '../pages/setup/facts.ts';
import { PANEL, SETUP, SHARED } from '../pages/strings/index.ts';
import type { PanelProps } from './product.tsx';

const t = wordsFor(SHARED, SETUP, PANEL);

/** A moment as people read it, with its weekday: "Thu 6 Aug 2026 · 16:12". */
export function moment(value: unknown, locale: string): string {
  const at = typeof value === 'string' || typeof value === 'number' ? new Date(value) : null;
  if (at === null || Number.isNaN(at.getTime())) return '';
  const day = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(at);
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(at);
  return `${day} · ${time}`;
}

/** What the shopper chose for one part, in a line: the words, the font, the size, the finish; or that they left it plain. */
export function choiceLine(t: AddOnTranslate, value: unknown, unit: 'mm' | 'pt', finishName: (code: string) => string): string {
  if (typeof value !== 'object' || value === null) return t('panel.line.plain', 'left plain');
  const chosen = value as Record<string, unknown>;
  const out: string[] = [];
  if (typeof chosen['text'] === 'string' && chosen['text'] !== '') out.push(t('panel.line.words', '“{words}”', { words: chosen['text'] }));
  if (typeof chosen['file'] === 'string' && chosen['file'] !== '') out.push(t('panel.line.logo', 'their own logo'));
  if (typeof chosen['choice'] === 'string') out.push(chosen['choice']);
  if (typeof chosen['colour'] === 'string') out.push(chosen['colour']);
  if (out.length === 0) return t('panel.line.plain', 'left plain');
  if (typeof chosen['font'] === 'string') out.push(chosen['font']);
  if (typeof chosen['size'] === 'number') out.push(`${mm(chosen['size'])} ${unit}`);
  if (typeof chosen['finish'] === 'string') out.push(finishName(chosen['finish']));
  return out.join(' · ');
}

export function LinePanel({ t, linked }: { t: AddOnTranslate } & PanelProps): ReactNode {
  const locale = useLocaleTag();
  const design = useRecord('designs', linked);
  const row = design.row;
  const readyId = row === null ? null : (row['ready_design_id'] as string | number | null);
  const baseId = row === null ? null : (row['base_id'] as string | number | null);
  const ready = useRecord('ready_designs', readyId ?? null);
  const base = useRecord('bases', baseId ?? (ready.row === null ? null : (ready.row['base_id'] as string | number)));
  const parts = useRecords('ready_parts', { filter: [{ column: 'ready_design_id', op: 'eq', value: readyId }], sort: [{ column: 'position', direction: 'asc' }], pageSize: 199, enabled: readyId !== null });
  const areas = useRecords('base_areas', { filter: [{ column: 'base_id', op: 'eq', value: base.row === null ? null : (base.row['id'] as string | number) }], sort: [{ column: 'position', direction: 'asc' }], pageSize: 199, enabled: base.row !== null });
  const versions = useRecords('design_versions', { filter: [{ column: 'design_id', op: 'eq', value: linked }], sort: [{ column: 'version', direction: 'desc' }], pageSize: 1, enabled: linked !== null });
  const finishes = useRecords('palette_colours', { pageSize: 199, enabled: row !== null });
  if (linked === null || (!design.loading && row === null)) return <EmptyState title={t('panel.line.none', 'No design on this line')} body={t('panel.line.noneBody', 'A line carries a design when the shopper ordered one they made.')} />;
  if (row === null) return <EmptyState title={t('panel.loading', 'Loading')} />;
  const unit = kindOf(base.row) === 'page' ? 'pt' : 'mm';
  const chosen = (jsonOf(row['values'])['parts'] ?? {}) as Record<string, unknown>;
  const named: DataRow[] = readyId === null ? [...areas.rows] : parts.rows.filter((part) => part['locked'] !== true && part['kind'] !== 'shape');
  const finishName = (code: string): string => text(finishes.rows.find((one) => text(one['code']) === code)?.['name']) || code;
  const latest = versions.rows[0];
  const proof = latest !== undefined && text(latest['proof_file']) !== '';
  const ordered = row['state'] === 'ordered';
  return (
    <Card
      title={t('panel.title', 'Customising')}
      description={t('panel.line.sub', 'read-only')}
      actions={<StatusPill status={proof ? 'proof' : 'none'} tone={proof ? 'info' : 'neutral'}>{proof ? t('panel.line.proof', 'Proof {n}', { n: String(latest['version']) }) : t('panel.line.noProof', 'No proof yet')}</StatusPill>}
    >
      <Stack gap="md">
        <KeyValueList
          items={[
            { label: t('panel.line.design', 'Design'), value: ready.row === null ? t('panel.line.plainPiece', 'The plain piece') : text(ready.row['name']), mono: true },
            ...named.map((part) => ({ label: text(part['name']), value: choiceLine(t, chosen[text(part['code'])], unit, finishName), mono: true })),
            { label: t('panel.line.state', 'State'), value: ordered ? t('panel.line.ordered', 'Ordered') : t('panel.line.saved', 'Saved'), mono: true },
            { label: t('panel.line.savedAs', 'Saved as'), value: t('panel.line.savedAt', 'designs / {id} · {at}', { id: String(row['id']), at: moment(row['last_changed_at'], locale) }), mono: true },
          ]}
        />
        <p className="m-0 text-[12.5px] text-fg-muted">{t('panel.line.files', 'The files for the machine are listed here once they are made.')}</p>
        <Figure>{t('panel.line.foot', "read-only · made from the shopper's saved design")}</Figure>
      </Stack>
    </Card>
  );
}

export default function Line(props: PanelProps): ReactNode {
  return <LinePanel t={t} {...props} />;
}
