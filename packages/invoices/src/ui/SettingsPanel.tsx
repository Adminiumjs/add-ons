/**
 * `settings.add-on.panel` — the letterhead and the defaults, plus a sample.
 *
 * ── THE SAMPLE IS A SIMULATED RESULT AND IT SAYS SO (24 D11) ───────────────
 *
 * Everything drawn under "What a document looks like" comes from figures
 * invented in this file. That is genuinely useful — somebody setting a
 * letterhead wants to see it on something — and it is also exactly the kind of
 * screen that gets mistaken for real data. So the sample carries a demo chip,
 * `sources.test.ts` asserts that every result title on this surface is paired
 * with one, and the figures are obviously round rather than plausible.
 *
 * ── `payload.samples` IS REQUIRED AND THIS SURFACE USES NONE OF IT ─────────
 *
 * Worth stating plainly rather than leaving as an unused parameter. The field
 * is required because every host has a catalogue and "I have nothing to
 * sample" was not an honest state for the surfaces the slot was bought for —
 * the carrier quotes against a sample parcel, the personalizer previews on a
 * sample product. An INVOICE is not a catalogue row. There is nothing in a
 * `CatalogueSample` — key, label, quantity, weight, size, price — that this
 * add-on could draw a document from without inventing the customer, the dates
 * and the terms, and a preview built that way would be a simulated result
 * wearing a derived one's clothes.
 *
 * So the sample below is openly this add-on's own, in round invented figures,
 * behind a demo chip.
 */

import { useState } from 'react';

import type { SettingsPanelPayload } from '@adminium/add-on-host';
import { isDocumentError } from '@adminium/add-on-host/contracts';

import { useT } from '../i18n/t.ts';
import { renderDocument } from '../render.ts';
import { LOGO_DATA_URL_MAX, settingsFrom } from '../settings.ts';
import { Eyebrow, Field, Note, Panel, PanelTitle, Tag, inputStyle } from './atoms.tsx';

/** Round, invented, and paired with a demo chip wherever it is shown. */
const SAMPLE_RECORD = {
  // Not a company-shaped name. The seeded activity lines in `index.ts` name no
  // party at all — the house pattern every sibling add-on follows — and a
  // preview that invented a plausible customer would be the one screen in this
  // package where somebody could mistake made-up data for their own.
  customerName: 'Sample customer',
  customerLines: ['One Example Street'],
  currency: 'USD',
  taxRate: 2000,
  items: [
    { id: 's-1', desc: 'Design system audit', qty: 2, rate: 120_000 },
    { id: 's-2', desc: 'Schema migration', qty: 1, rate: 80_000 },
  ],
};

const SAMPLE_NOW = { iso: '2026-01-05T00:00:00.000Z', timezone: 'UTC' };

export function SettingsPanel({ payload }: { payload: SettingsPanelPayload }) {
  const t = useT();
  const settings = settingsFrom(payload.settings);
  const [logoProblem, setLogoProblem] = useState<string | null>(null);

  const set = (key: string, value: unknown) => {
    payload.patch({ [key]: value });
  };

  const setLogo = (value: string) => {
    // Refused HERE, where somebody can see the size and do something about it
    // — not months later at render time, when the refusal would be a mystery
    // nobody could connect to a cause. `settingsFrom` drops an over-cap value
    // as a last resort; this is the message.
    if (value.length > LOGO_DATA_URL_MAX) {
      setLogoProblem(
        t('addon.invoices.logo.tooLarge', { size: `${String(Math.round(value.length / 1024))} KB` }),
      );
      return;
    }
    setLogoProblem(null);
    set('logo_data_url', value);
  };

  const sample = renderDocument({
    kind: 'invoice',
    record: SAMPLE_RECORD,
    recordId: 'sample',
    now: SAMPLE_NOW,
    settings,
  });

  return (
    <Panel>
      <PanelTitle>{t('addon.invoices.settings.title')}</PanelTitle>
      <Note style={{ marginBlockStart: 6 }}>{t('addon.invoices.settings.intro')}</Note>

      <Field label={t('addon.invoices.setting.business_name')}>
        <input
          style={inputStyle}
          value={settings.businessName}
          onChange={(event) => {
            set('business_name', event.target.value);
          }}
        />
      </Field>
      <Note>{t('addon.invoices.setting.business_name.help')}</Note>

      <Field label={t('addon.invoices.setting.business_lines')}>
        <textarea
          style={{ ...inputStyle, minHeight: 64 }}
          value={settings.businessLines.join('\n')}
          onChange={(event) => {
            set('business_lines', event.target.value.split('\n'));
          }}
        />
      </Field>
      <Note>{t('addon.invoices.setting.business_lines.help')}</Note>

      <Field label={t('addon.invoices.setting.logo_data_url')}>
        <input
          style={inputStyle}
          value={settings.logoDataUrl}
          onChange={(event) => {
            setLogo(event.target.value);
          }}
        />
      </Field>
      <Note>{logoProblem ?? t('addon.invoices.setting.logo_data_url.help')}</Note>

      <Field label={t('addon.invoices.setting.number_prefix')}>
        <input
          style={inputStyle}
          value={settings.numberPrefix}
          onChange={(event) => {
            set('number_prefix', event.target.value);
          }}
        />
      </Field>
      <Note>{t('addon.invoices.setting.number_prefix.help')}</Note>

      <Field label={t('addon.invoices.setting.terms')}>
        <textarea
          style={{ ...inputStyle, minHeight: 64 }}
          value={settings.terms}
          onChange={(event) => {
            set('terms', event.target.value);
          }}
        />
      </Field>
      <Note>{t('addon.invoices.setting.terms.help')}</Note>

      <Field label={t('addon.invoices.setting.tax_label')}>
        <input
          style={inputStyle}
          value={settings.taxLabel}
          onChange={(event) => {
            set('tax_label', event.target.value);
          }}
        />
      </Field>
      <Note>{t('addon.invoices.setting.tax_label.help')}</Note>

      <Field label={t('addon.invoices.setting.paper')}>
        <select
          style={inputStyle}
          value={settings.paper}
          onChange={(event) => {
            set('paper', event.target.value);
          }}
        >
          <option value="a4">A4</option>
          <option value="letter">Letter</option>
        </select>
      </Field>
      <Note>{t('addon.invoices.setting.paper.help')}</Note>

      <Field label={t('addon.invoices.setting.entities')}>
        {/*
          * A TEXT FIELD, and it is not the design anybody wanted.
          *
          * The obvious control is a list of this deployment's record kinds
          * with a checkbox each, and it cannot be built from here:
          * `SettingsPanelPayload` carries `samples`, which is
          * `CatalogueSample[]` — key, label, quantity, weight, size, price.
          * That payload was shaped for the carrier and the personalizer, whose
          * settings genuinely need a sample PRODUCT to quote and to preview
          * against. An invoice is not a catalogue row, so there is nothing in
          * it this surface can honestly use, and dressing a product key up as
          * a record kind would put a list of the wrong things in front of
          * somebody with no way to tell.
          *
          * So: comma-separated ids, and the help text says where they come
          * from. The record surface names the same id in its own empty state
          * (`DocumentAction.tsx`), which is how somebody finds out what to
          * type. Widening the payload with the host's entity vocabulary is the
          * real fix and belongs to the slot, not to this add-on.
          */}
        <input
          style={inputStyle}
          value={settings.entities.join(', ')}
          onChange={(event) => {
            set(
              'entities',
              event.target.value
                .split(',')
                .map((entity) => entity.trim())
                .filter((entity) => entity !== ''),
            );
          }}
        />
      </Field>
      <Note>{t('addon.invoices.setting.entities.help')}</Note>

      <div style={{ marginBlockStart: 14 }}>
        <Eyebrow>{t('addon.invoices.sample.title')}</Eyebrow>{' '}
        <Tag>{t('addon.invoices.demo')}</Tag>
        <Note style={{ marginBlockStart: 4 }}>{t('addon.invoices.sample.note')}</Note>
        {isDocumentError(sample) ? null : (
          <iframe
            title={t('addon.invoices.sample.title')}
            style={{
              inlineSize: '100%',
              blockSize: 360,
              marginBlockStart: 8,
              border: '1px solid var(--line, #e5e7eb)',
              borderRadius: 6,
              background: '#fff',
            }}
            /*
             * `srcDoc` rather than an object URL: the bytes are already in the
             * page, this is a preview nobody downloads, and a `blob:` URL here
             * would have to be revoked on unmount — a lifetime to get wrong for
             * no benefit.
             */
            srcDoc={new TextDecoder().decode(
              (sample.find((d) => d.format === 'html') ?? sample[0]!).bytes,
            )}
          />
        )}
      </div>
    </Panel>
  );
}
