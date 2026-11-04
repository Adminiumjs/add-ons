/**
 * THE PANEL ON A PRODUCT: "Customising · set up in the Customiser".
 *
 * Drawn in a tab of the record page of an app's product, which links to its
 * base (`rules.addOnLink` into `bases`): the base drawn flat, and what it
 * offers — the base, its areas, its ready-made designs, its priced features
 * and whether it is published — with the way into its set-up. Read-only.
 */
import type { ReactNode } from 'react';

import { wordsFor } from '../pages/shared/messages.ts';
import { PANEL, SETUP, SHARED } from '../pages/strings/index.ts';
import { Card, EmptyState, Grid, KeyValueList, Link, Stack, StatusPill, useRecord, useRecords, type AddOnTranslate } from '../pages/shared/host.ts';
import { pageAt } from '../pages/shared/paths.ts';
import { Drawing } from '../pages/setup/Drawing.tsx';
import { boxOf, guidesOf, isPublished, kindOf, mm, num, sizeOf, takesOf, text, wordsRulesOf, yes } from '../pages/setup/facts.ts';
import { kindName } from '../pages/setup/NewBase.tsx';

const t = wordsFor(SHARED, SETUP, PANEL);

export interface PanelProps {
  connectionId: string;
  table: string;
  row: string;
  linked: string | null;
}

export function ProductPanel({ t, linked }: { t: AddOnTranslate } & PanelProps): ReactNode {
  const base = useRecord('bases', linked);
  const on = linked !== null;
  const areas = useRecords('base_areas', { filter: [{ column: 'base_id', op: 'eq', value: linked }], sort: [{ column: 'position', direction: 'asc' }], pageSize: 199, enabled: on });
  const designs = useRecords('ready_designs', { filter: [{ column: 'base_id', op: 'eq', value: linked }], sort: [{ column: 'position', direction: 'asc' }], pageSize: 199, enabled: on });
  const features = useRecords('features', { pageSize: 199, enabled: on });
  const open = <Link to={linked === null ? pageAt() : `${pageAt()}/${linked}`}>{t('panel.open', 'Open the set-up')}</Link>;
  if (!on || (!base.loading && base.row === null)) {
    return <EmptyState title={t('panel.product.none', 'Not set up for customising')} body={t('panel.product.noneBody', 'Link this product to a base in the Customiser, then set up its areas, fonts and prices.')} actions={open} />;
  }
  const row = base.row;
  if (row === null) return <EmptyState title={t('panel.loading', 'Loading')} />;
  const kind = kindOf(row);
  const size = sizeOf(row);
  const published = isPublished(row);
  const priced = new Set(areas.rows.map((area) => text(area['feature_id'])).filter((id) => id !== ''));
  const material = [text(row['material']), num(row['thickness_mm']) === null ? '' : t('panel.mm', '{n} mm', { n: mm(num(row['thickness_mm']) ?? 0) })].filter((part) => part !== '').join(' ');
  const baseLine = [kindName(t, kind), t('panel.size', '{w} × {h} mm', { w: mm(size.width), h: mm(size.height) }), material].filter((part) => part !== '').join(' · ');
  const areaLine = areas.rows
    .map((area) => {
      const takes = takesOf(area);
      const what = takes === 'logo' ? t('panel.takes.logo', 'a logo') : takes === 'both' ? t('panel.takes.both', 'words or a logo') : t('panel.takes.words', 'words');
      const parts = [what, ...(yes(area['required']) ? [t('panel.required', 'required')] : []), ...(takes === 'logo' ? [] : [String(wordsRulesOf(area).chars)])];
      return t('panel.area', '{name} ({parts})', { name: text(area['name']), parts: parts.join(', ') });
    })
    .join(' · ');
  return (
    <Card
      title={t('panel.title', 'Customising')}
      description={t('panel.product.sub', 'set up in the Customiser')}
      actions={<StatusPill status={published ? 'published' : 'draft'} tone={published ? 'pos' : 'warn'}>{published ? t('panel.published', 'Published') : t('panel.notOffered', 'Not offered yet')}</StatusPill>}
    >
      <Grid columns={2} gap="lg">
        <Drawing
          kind={kind === 'page' ? 'page' : 'piece'}
          size={size}
          guides={guidesOf(row)}
          corner={num(row['corner_mm']) ?? 0}
          areas={areas.rows.map((area) => ({ id: String(area['id']), name: text(area['name']), shape: area['shape'] === 'oval' ? 'oval' : 'rect', box: boxOf(area) }))}
          label={t('panel.product.alt', '{name}, drawn flat with its areas', { name: text(row['name']) })}
        />
        <Stack gap="md">
          <KeyValueList
            items={[
              { label: t('panel.base', 'Base'), value: baseLine, mono: true },
              { label: t('panel.areas', 'Areas'), value: areaLine === '' ? t('panel.noneYet', 'none yet') : areaLine, mono: true },
              { label: t('panel.designs', 'Designs'), value: designs.rows.length === 0 ? t('panel.noneYet', 'none yet') : designs.rows.map((design) => text(design['name'])).join(' · '), mono: true },
              { label: t('panel.priced', 'Priced'), value: priced.size === 0 ? t('panel.nothingExtra', 'nothing extra') : features.rows.filter((feature) => priced.has(text(feature['id']))).map((feature) => text(feature['name'])).join(' · '), mono: true },
              { label: t('panel.status', 'Status'), value: published ? t('panel.published', 'Published') : t('panel.notOffered', 'Not offered yet'), mono: true },
            ]}
          />
          {open}
        </Stack>
      </Grid>
    </Card>
  );
}

export default function Product(props: PanelProps): ReactNode {
  return <ProductPanel t={t} {...props} />;
}
