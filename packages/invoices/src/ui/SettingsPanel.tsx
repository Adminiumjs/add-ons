/**
 * `settings.add-on.panel` — the letterhead, the numbering, the defaults a new
 * document starts from, the reminder ladders, plus a sample.
 *
 * ── A FIELD THAT FEEDS A RULE IS CHECKED WHERE IT IS TYPED ─────────────────
 *
 * The prefixes, first numbers, default rate and ladders are read by
 * ADMINIUM'S rules when an app's row is created, far from this screen. A value
 * the rule cannot use would surface there as a refused create nobody could
 * connect to this panel, so each is checked here, when it is committed (on
 * leaving the field), and a bad one is never saved: a prefix only in the
 * characters the numbering rule accepts, a first number that only moves up
 * (a number already given must never be given again), a rate from 0 to 100,
 * and ladders of three rising days.
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

import { useState, type ReactNode } from 'react';

import type { SettingsPanelPayload } from '@adminium/add-on-host';
import { isDocumentError } from '@adminium/add-on-host/contracts';

import type { StringKey } from '../i18n/strings.ts';
import { useT } from '../i18n/t.ts';
import { renderDocument } from '../render.ts';
import {
  LADDERS,
  LOGO_DATA_URL_MAX,
  PREFIX_PATTERN,
  SERIES,
  TERMS,
  ladderDaysOf,
  settingsFrom,
  type Ladder,
  type Series,
} from '../settings.ts';
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

const TERM_KEYS: Readonly<Record<(typeof TERMS)[number], StringKey>> = {
  net7: 'addon.invoices.terms.net7',
  net14: 'addon.invoices.terms.net14',
  net30: 'addon.invoices.terms.net30',
  'on-receipt': 'addon.invoices.terms.onReceipt',
};

const LADDER_KEYS: Readonly<Record<Ladder, StringKey>> = {
  gentle: 'addon.invoices.ladder.gentle',
  standard: 'addon.invoices.ladder.standard',
  firm: 'addon.invoices.ladder.firm',
};

const PREFIX_KEYS: Readonly<Record<Series, StringKey>> = {
  invoice: 'addon.invoices.setting.prefix_invoice',
  receipt: 'addon.invoices.setting.prefix_receipt',
  quote: 'addon.invoices.setting.prefix_quote',
};

const START_KEYS: Readonly<Record<Series, StringKey>> = {
  invoice: 'addon.invoices.setting.number_start_invoice',
  receipt: 'addon.invoices.setting.number_start_receipt',
  quote: 'addon.invoices.setting.number_start_quote',
};

/**
 * A text field that commits when it is left, not on every key: a first
 * number typed as "1", then "15", must not be judged at "1".
 */
function Committed({
  value,
  onCommit,
  inputMode,
}: {
  value: string;
  onCommit: (typed: string) => boolean;
  inputMode?: 'numeric' | 'decimal';
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      style={inputStyle}
      inputMode={inputMode}
      value={draft ?? value}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onBlur={() => {
        if (draft === null) return;
        // A value the rule cannot use is not saved; the field goes back to the
        // saved one and the note under it says why.
        onCommit(draft.trim());
        setDraft(null);
      }}
    />
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBlockStart: 16 }}>
      <Eyebrow>{title}</Eyebrow>
      {children}
    </div>
  );
}

export function SettingsPanel({ payload }: { payload: SettingsPanelPayload }) {
  const t = useT();
  const settings = settingsFrom(payload.settings);
  const [logoProblem, setLogoProblem] = useState<string | null>(null);
  const [problem, setProblem] = useState<{ key: string; text: string } | null>(null);

  const set = (key: string, value: unknown) => {
    payload.patch({ [key]: value });
  };
  const refuse = (key: string, text: string): false => {
    setProblem({ key, text });
    return false;
  };
  const accept = (key: string, value: unknown): true => {
    if (problem?.key === key) setProblem(null);
    set(key, value);
    return true;
  };
  const noteFor = (key: string, help: string): string => (problem?.key === key ? problem.text : help);

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

      <Section title={t('addon.invoices.settings.section.letterhead')}>
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

        <Field label={t('addon.invoices.setting.tax_name')}>
          <input
            style={inputStyle}
            value={settings.taxName}
            onChange={(event) => {
              // One idea, two keys: the newer name and the older word for the
              // tax line are kept in step so neither reader is left behind.
              payload.patch({ tax_name: event.target.value, tax_label: event.target.value });
            }}
          />
        </Field>
        <Note>{t('addon.invoices.setting.tax_name.help')}</Note>

        <Field label={t('addon.invoices.setting.tax_number')}>
          <input
            style={inputStyle}
            value={settings.taxNumber}
            onChange={(event) => {
              set('tax_number', event.target.value);
            }}
          />
        </Field>
        <Note>{t('addon.invoices.setting.tax_number.help')}</Note>

        <Field label={t('addon.invoices.setting.payment_instructions')}>
          <textarea
            style={{ ...inputStyle, minHeight: 64 }}
            value={settings.paymentInstructions}
            onChange={(event) => {
              set('payment_instructions', event.target.value);
            }}
          />
        </Field>
        <Note>{t('addon.invoices.setting.payment_instructions.help')}</Note>

        <Field label={t('addon.invoices.setting.footer')}>
          <textarea
            style={{ ...inputStyle, minHeight: 48 }}
            value={settings.footer}
            onChange={(event) => {
              set('footer', event.target.value);
            }}
          />
        </Field>
        <Note>{t('addon.invoices.setting.footer.help')}</Note>
      </Section>

      <Section title={t('addon.invoices.settings.section.numbers')}>
        {SERIES.map((series) => (
          <div key={series} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Field label={t(PREFIX_KEYS[series])}>
              <Committed
                value={settings.prefixes[series]}
                onCommit={(typed) =>
                  PREFIX_PATTERN.test(typed)
                    ? accept(`prefix_${series}`, typed)
                    : refuse(`prefix_${series}`, t('addon.invoices.problem.prefix'))
                }
              />
            </Field>
            <Field label={t(START_KEYS[series])}>
              <Committed
                inputMode="numeric"
                value={String(settings.starts[series])}
                onCommit={(typed) => {
                  const start = Number(typed);
                  const lowest = settings.starts[series];
                  return Number.isInteger(start) && start >= lowest
                    ? accept(`number_start_${series}`, start)
                    : refuse(`number_start_${series}`, t('addon.invoices.problem.start', { number: lowest }));
                }}
              />
            </Field>
          </div>
        ))}
        <Note>
          {problem !== null && /^(prefix|number_start)_/.test(problem.key)
            ? problem.text
            : `${t('addon.invoices.setting.prefix.help')} ${t('addon.invoices.setting.number_start.help')}`}
        </Note>
      </Section>

      <Section title={t('addon.invoices.settings.section.defaults')}>
        <Field label={t('addon.invoices.setting.default_tax_rate')}>
          <Committed
            inputMode="decimal"
            value={String(settings.defaultTaxRate)}
            onCommit={(typed) => {
              const rate = Number(typed.replace(',', '.'));
              return typed !== '' && Number.isFinite(rate) && rate >= 0 && rate <= 100
                ? accept('default_tax_rate', rate)
                : refuse('default_tax_rate', t('addon.invoices.problem.rate'));
            }}
          />
        </Field>
        <Note>{noteFor('default_tax_rate', t('addon.invoices.setting.default_tax_rate.help'))}</Note>

        <Field label={t('addon.invoices.setting.default_terms')}>
          <select
            style={inputStyle}
            value={settings.defaultTerms}
            onChange={(event) => {
              set('default_terms', event.target.value);
            }}
          >
            {TERMS.map((terms) => (
              <option key={terms} value={terms}>
                {t(TERM_KEYS[terms])}
              </option>
            ))}
          </select>
        </Field>
        <Note>{t('addon.invoices.setting.default_terms.help')}</Note>
      </Section>

      <Section title={t('addon.invoices.settings.section.reminders')}>
        {LADDERS.map((ladder) => (
          <Field key={ladder} label={t(LADDER_KEYS[ladder])}>
            <Committed
              value={settings.ladders[ladder].join(', ')}
              onCommit={(typed) => {
                const days = ladderDaysOf(typed.split(/[\s,;]+/).filter((part) => part !== ''));
                return days === null
                  ? refuse('ladders', t('addon.invoices.problem.ladder'))
                  : accept('ladders', { ...settings.ladders, [ladder]: days });
              }}
            />
          </Field>
        ))}
        <Note>{noteFor('ladders', t('addon.invoices.setting.ladders.help'))}</Note>

        <Field label={t('addon.invoices.setting.default_ladder')}>
          <select
            style={inputStyle}
            value={settings.defaultLadder}
            onChange={(event) => {
              set('default_ladder', event.target.value);
            }}
          >
            {LADDERS.map((ladder) => (
              <option key={ladder} value={ladder}>
                {t(LADDER_KEYS[ladder])}
              </option>
            ))}
          </select>
        </Field>
        <Note>{t('addon.invoices.setting.default_ladder.help')}</Note>
      </Section>

      <Section title={t('addon.invoices.settings.section.printing')}>
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

        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBlockStart: 8 }}>
          <input
            type="checkbox"
            checked={settings.showPaymentLedger}
            onChange={(event) => {
              set('show_payment_ledger', event.target.checked);
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-muted)' }}>
            {t('addon.invoices.setting.show_payment_ledger')}
          </span>
        </label>
        <Note>{t('addon.invoices.setting.show_payment_ledger.help')}</Note>

        <Field label={t('addon.invoices.setting.entities')}>
          {/*
            * A TEXT FIELD, and it is not the design anybody wanted.
            *
            * The obvious control is a list of this deployment's record kinds
            * with a checkbox each, and it cannot be built from here:
            * `SettingsPanelPayload` carries `samples`, which is
            * `CatalogueSample[]` — key, label, quantity, weight, size, price.
            * That payload was shaped for the carrier and the personalizer,
            * whose settings genuinely need a sample PRODUCT to quote and to
            * preview against. An invoice is not a catalogue row, so there is
            * nothing in it this surface can honestly use, and dressing a
            * product key up as a record kind would put a list of the wrong
            * things in front of somebody with no way to tell.
            *
            * So: comma-separated ids, and the help text says where they come
            * from. The record surface names the same id in its own empty state
            * (`DocumentAction.tsx`), which is how somebody finds out what to
            * type. Widening the payload with the host's entity vocabulary is
            * the real fix and belongs to the slot, not to this add-on.
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
      </Section>

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
