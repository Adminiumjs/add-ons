/**
 * THE SHOP'S CUSTOMISER SETTINGS: what every base and design starts from.
 *
 * One row for the install (`settings`): the unit sizes are shown in, a new
 * page's bleed and safe line, where light becomes dark when a shopper makes
 * their logo one colour (the line the shopper's editor starts on, and the
 * proof is made at), the thinnest line the machine keeps, and how sharp a
 * picture must be. Each figure is saved when its field is left, as the
 * set-up's other figures are. A role that may read them and not change them
 * sees them, and is told so.
 *
 * Adminium's own settings screen for an add-on draws the settings a manifest
 * declares, and the Customiser keeps its settings in a table of its own, so
 * this is where they are kept.
 */
import type { ReactNode } from 'react';

import { asDataError, Dialog, DialogBody, DialogHeader, Select, Stack, useAccess, useWrite, type AddOnTranslate, type DataError, type DataRow } from '../shared/host.ts';
import { refusal } from '../shared/refusal.ts';
import { useToast } from '../shared/toast.ts';
import { SavedNumber } from './BaseStep.tsx';
import { num, text } from './facts.ts';

export function ShopSettings({ t, open, onClose, settings, error = null }: { t: AddOnTranslate; open: boolean; onClose: () => void; settings: DataRow | null; error?: DataError | null }): ReactNode {
  const access = useAccess();
  const write = useWrite('settings');
  const toast = useToast();
  const may = access.ready && access.canUpdate('settings');
  const save = (values: Record<string, string | number>): void => {
    if (settings === null) return;
    write.update(settings['id'] as string | number, values).catch((caught: unknown) => toast(refusal(t, asDataError(caught)).message, 'error'));
  };
  const figure = (column: string, label: string, unit: string, decimals: number, hint?: string): ReactNode => (
    <SavedNumber label={label} unit={unit} decimals={decimals} value={num(settings?.[column])} disabled={!may} {...(hint === undefined ? {} : { hint })} onSave={(value) => save({ [column]: value })} />
  );
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())} size="md">
      <DialogHeader title={t('setup.settings.title', 'Shop settings')} subtitle={t('setup.settings.sub', 'What every base and design starts from.')} closeLabel={t('setup.close', 'Close')} />
      <DialogBody>
        {error !== null ? (
          <p role="alert" className="m-0 text-[12.5px] text-danger">
            {refusal(t, error).message}
          </p>
        ) : settings === null ? (
          <p className="m-0 text-[12.5px] text-fg-muted">{t('setup.settings.none', 'The Customiser’s settings are not on this install yet. Install it again to add them.')}</p>
        ) : (
          <Stack gap="md">
            {may ? null : <p className="m-0 text-[12.5px] text-fg-muted">{t('setup.settings.readOnly', 'Your role may read these settings, not change them.')}</p>}
            {figure('one_colour_threshold', t('setup.settings.threshold', 'One-colour line'), '%', 0, t('setup.settings.thresholdHint', 'Where light becomes dark when a shopper makes their logo one colour. Their editor starts here, and a proof is made at the line they leave it on.'))}
            <Select
              label={t('setup.settings.unit', 'Sizes shown in')}
              value={text(settings['length_unit']) || 'mm'}
              disabled={!may}
              onChange={(event) => save({ length_unit: event.target.value })}
              options={[
                { value: 'mm', label: t('setup.settings.mm', 'Millimetres') },
                { value: 'in', label: t('setup.settings.in', 'Inches') },
              ]}
            />
            {figure('default_bleed_mm', t('setup.settings.bleed', 'Bleed on a new page'), 'mm', 2)}
            {figure('default_safe_mm', t('setup.settings.safe', 'Safe line on a new page'), 'mm', 2)}
            {figure('smallest_line_mm', t('setup.settings.line', 'Thinnest line the machine keeps'), 'mm', 2)}
            {figure('min_dpi', t('setup.settings.dpi', 'Sharpness a picture needs at its printed size'), 'dpi', 0)}
          </Stack>
        )}
      </DialogBody>
    </Dialog>
  );
}
