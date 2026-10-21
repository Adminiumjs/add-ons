// SPDX-License-Identifier: AGPL-3.0-only
/**
 * The Title & theme panel (comp 783-804): document title, the five swatches
 * (1577), the four currencies (1578), the decimals toggle (788, 1607), the five
 * statuses (1579, `statusMeta` 1393), the five topics with their glyphs
 * (1635-1639; labels per the banned-word lexicon), the six language re-tag
 * pills (1640-1644) with the comp's own note that the toolbar's language button
 * is the better path, and the background image with its overlay slider capped
 * at 95 % (795-803, 1733).
 */
import { Lock, Upload } from 'lucide-react';
import { cn } from '@adminium/ui';

import { t } from '../../../messages.js';
import { invoiceIcon } from '../../../icons.js';
import { ACCENT_SWATCHES, CURRENCIES, INVOICE_STATUSES, INVOICE_TOPICS, MORE_CURRENCIES, currencyCodeForSymbol, type InvoiceStatus, type InvoiceTopic } from '../../../model/envelope.js';
import { hasLivePayment, printedPayments } from '../../../payments.js';
import { DOCUMENT_LANGUAGES } from '../../../model/languages.js';
import { DASHED, Divider, FIELD, FOCUS, FileLabel, Note, OptionButton, PanelLabel, RangeInput, Swatch, TextField, Toggle, type OptionTone } from '../parts.js';
import type { PanelProps } from '../panelProps.js';
import { uploadFromInput } from '../upload.js';

/** The comp's `statusMeta` (1393): Draft grey, Sent accent, Paid and Live green, Overdue red. */
const STATUS_TONE: Readonly<Record<InvoiceStatus, OptionTone>> = { draft: 'neutral', sent: 'accent', paid: 'pos', live: 'pos', overdue: 'danger' };

export function statusLabel(status: InvoiceStatus): string {
  switch (status) {
    case 'draft':
      return t('inspector.theme.status.draft', 'Draft');
    case 'sent':
      return t('inspector.theme.status.sent', 'Sent');
    case 'paid':
      return t('inspector.theme.status.paid', 'Paid');
    case 'live':
      return t('inspector.theme.status.live', 'Live');
    case 'overdue':
      return t('inspector.theme.status.overdue', 'Overdue');
  }
}

/** The comp's `topics()` (1173-1180) with the first label re-worded for the banned-word lexicon. */
export function topicOption(topic: InvoiceTopic): { label: string; icon: string } {
  switch (topic) {
    case 'recurring':
      return { label: t('inspector.theme.topic.recurring', 'Recurring'), icon: 'repeat' };
    case 'services':
      return { label: t('inspector.theme.topic.services', 'Professional services'), icon: 'briefcase' };
    case 'receipts':
      return { label: t('inspector.theme.topic.receipts', 'Receipts & refunds'), icon: 'receipt' };
    case 'sales':
      return { label: t('inspector.theme.topic.sales', 'Sales & quotes'), icon: 'file-signature' };
    case 'logistics':
      return { label: t('inspector.theme.topic.logistics', 'Shipping & logistics'), icon: 'ship' };
    case 'other':
      return { label: t('inspector.theme.topic.other', 'Uncategorised'), icon: 'folder' };
  }
}

const SMALL_BUTTON = 'rounded-[9px] border border-border bg-surface px-[11px] py-[7px] text-[11.5px] font-bold transition-colors hover:border-border-strong';

/** An invoice's statuses a person picks: Paid is the balance's to set and clear. */
const PICKED_STATUSES: readonly InvoiceStatus[] = INVOICE_STATUSES.filter((status) => status !== 'paid');

export function ThemePanel({ draft, edits, onImageRejected, kind, payments, paymentsSettled = true, currencyHeldIn = null }: PanelProps) {
  const body = draft.body;
  const tintPct = Math.round(body.bgTint * 100);
  const invoice = kind === 'invoice';
  // Paid in one currency: the invoice stays in it.
  const heldIn = invoice ? ((hasLivePayment(payments ?? null) ? (printedPayments(payments ?? null)[0]?.currency ?? null) : null) ?? currencyHeldIn) : null;
  // Until the payments are known, nothing says the currency is free to change.
  const pickerOff = heldIn !== null || (invoice && !paymentsSettled);
  // The code the picker shows as chosen: the stored one, or the one a symbol can only mean.
  const code = body.currencyCode ?? currencyCodeForSymbol(body.currency);
  const chipOn = (choice: { sym: string; code: string }) => (code !== null ? code === choice.code : body.currency === choice.sym);
  const more = MORE_CURRENCIES.find((choice) => choice.code === code) ?? null;
  const statuses = invoice ? PICKED_STATUSES : INVOICE_STATUSES;
  return (
    <div className="flex flex-col gap-4">
      <TextField
        label={t('inspector.theme.documentTitle', 'Document title')}
        value={body.title}
        onFocus={edits.beginEdit}
        onChange={(value) => edits.set('title', value)}
        className="font-bold uppercase tracking-[.02em]"
        testId="invoices-document-title"
      />
      <div>
        <PanelLabel id="invoices-accent-label" className="mb-2">
          {t('inspector.theme.accentColour', 'Accent colour')}
        </PanelLabel>
        <div className="flex gap-[9px]" role="group" aria-labelledby="invoices-accent-label">
          {ACCENT_SWATCHES.map((hex) => (
            <Swatch key={hex} hex={hex} on={body.accent.toLowerCase() === hex} onClick={() => edits.histSet('accent', hex)} />
          ))}
        </div>
      </div>
      <div>
        <PanelLabel id="invoices-currency-label" className="mb-2">
          {t('inspector.theme.currency', 'Currency')}
        </PanelLabel>
        <div className="flex gap-[6px]" role="group" aria-labelledby="invoices-currency-label">
          {CURRENCIES.map((currency) => (
            <OptionButton
              key={currency.code}
              on={more === null && chipOn(currency)}
              outlined
              label={currency.label}
              value={currency.sym}
              disabled={pickerOff}
              onClick={() => edits.histSetCurrency(currency.sym, currency.code)}
              className="flex-1 rounded-[9px] px-1 py-[9px]"
            />
          ))}
        </div>
        <select
          aria-label={t('inspector.theme.currencyMore', 'More currencies')}
          data-testid="invoices-currency-more"
          value={more?.code ?? ''}
          disabled={pickerOff}
          onChange={(event) => {
            const choice = MORE_CURRENCIES.find((one) => one.code === event.target.value);
            if (choice !== undefined) edits.histSetCurrency(choice.sym, choice.code);
          }}
          className={cn(FIELD, 'mt-[6px] py-[7px] text-[12px] disabled:cursor-not-allowed disabled:opacity-60')}
        >
          <option value="">{t('inspector.theme.currencyMore', 'More currencies')}</option>
          {MORE_CURRENCIES.map((choice) => (
            <option key={choice.code} value={choice.code}>
              {choice.label}
            </option>
          ))}
        </select>
        {heldIn !== null ? (
          <Note className="mt-2">{t('inspector.theme.currencyHeld', 'This invoice has payments in {code}, so its currency stays {code}.', { code: heldIn })}</Note>
        ) : invoice && code === null ? (
          <Note className="mt-2">{t('inspector.theme.currencyAsk', 'Pick the currency to take payments: {symbol} is used by more than one.', { symbol: body.currency })}</Note>
        ) : null}
      </div>
      <div className="flex items-center gap-[10px]">
        <div className="min-w-0 flex-1">
          <div id="invoices-cents-label" className="text-[12.5px] font-bold text-fg">
            {t('inspector.theme.showDecimals', 'Show decimals')}
          </div>
          <div className="text-[10.5px] text-fg-subtle">{t('inspector.theme.showDecimalsHint', 'e.g. $290.00 vs $290')}</div>
        </div>
        <Toggle on={body.cents} labelledBy="invoices-cents-label" onClick={() => edits.histSet('cents', !body.cents)} />
      </div>
      <div>
        <PanelLabel id="invoices-status-label" className="mb-2">
          {t('inspector.theme.statusLabel', 'Status')}
        </PanelLabel>
        <div className="flex flex-wrap gap-[6px]" role="group" aria-labelledby="invoices-status-label">
          {statuses.map((status) => (
            <OptionButton key={status} on={draft.status === status} tone={STATUS_TONE[status]} label={statusLabel(status)} value={status} onClick={() => edits.histSetStatus(status)} />
          ))}
          {invoice && draft.status === 'paid' ? (
            <span data-testid="invoices-status-paid" className="inline-flex items-center gap-[6px] rounded-lg border border-transparent bg-pos-soft px-3 py-[7px] text-[11.5px] font-bold text-pos">
              {statusLabel('paid')}
              <Lock className="size-[13px] text-fg-subtle" aria-hidden="true" />
            </span>
          ) : null}
        </div>
        {invoice ? <Note className="mt-2">{t('inspector.theme.statusPaidHelp', 'Becomes Paid by itself when the balance is zero.')}</Note> : null}
      </div>
      <Divider />
      <div>
        <PanelLabel id="invoices-topic-label" className="mb-2">
          {t('inspector.theme.topicLabel', 'Topic')}
        </PanelLabel>
        <div className="flex flex-col gap-[6px]" role="group" aria-labelledby="invoices-topic-label">
          {INVOICE_TOPICS.map((topic) => {
            const { label, icon } = topicOption(topic);
            const Glyph = invoiceIcon(icon);
            return (
              <OptionButton key={topic} on={draft.topic === topic} outlined label={label} value={topic} onClick={() => edits.histSetTopic(topic)} className="w-full justify-start gap-[7px] rounded-[9px] px-[10px] py-2 text-start">
                <Glyph className="size-3.5 shrink-0" aria-hidden="true" />
                {label}
              </OptionButton>
            );
          })}
        </div>
      </div>
      <div>
        <PanelLabel id="invoices-language-label" className="mb-2">
          {t('inspector.theme.language', 'Language')}
        </PanelLabel>
        <div className="flex flex-wrap gap-[6px]" role="group" aria-labelledby="invoices-language-label">
          {DOCUMENT_LANGUAGES.map((language) => (
            <OptionButton key={language.code} on={draft.lang === language.code} outlined label={language.native} value={language.code} onClick={() => edits.histSetLang(language.code)} className="px-[11px]" />
          ))}
        </div>
        <Note className="mt-2">{t('inspector.theme.languageNote', 'Use the language button in the toolbar to create a linked variation instead of re-tagging this one.')}</Note>
      </div>
      <Divider />
      <div>
        <PanelLabel className="mb-2">{t('inspector.theme.backgroundImage', 'Background image')}</PanelLabel>
        {body.bgImage === '' ? (
          <>
            <FileLabel
              onFile={(event) => uploadFromInput(event, (dataUrl) => edits.setImage('bgImage', dataUrl), onImageRejected)}
              className={cn(DASHED, 'gap-[7px] rounded-[11px] bg-surface-2 p-[11px] text-[12px]')}
              testId="invoices-bg-upload"
            >
              <Upload className="size-[15px]" aria-hidden="true" />
              {t('inspector.theme.uploadBackground', 'Upload background')}
            </FileLabel>
            <Note className="mt-[7px]">{t('inspector.theme.backgroundHint', 'Adds a full-bleed background behind the whole invoice — great for letterhead or a watermark.')}</Note>
          </>
        ) : (
          <>
            <div className="flex items-center gap-[9px]">
              <img src={body.bgImage} alt="" className="h-[34px] w-[46px] shrink-0 rounded-[7px] border border-border object-cover" />
              <FileLabel onFile={(event) => uploadFromInput(event, (dataUrl) => edits.setImage('bgImage', dataUrl), onImageRejected)} className={cn(SMALL_BUTTON, 'text-fg-muted')} testId="invoices-bg-upload">
                {t('inspector.theme.replaceBackground', 'Replace')}
              </FileLabel>
              <button type="button" data-testid="invoices-bg-remove" onClick={() => edits.setImage('bgImage', '')} className={cn(SMALL_BUTTON, 'text-danger', FOCUS)}>
                {t('inspector.theme.removeBackground', 'Remove')}
              </button>
            </div>
            <div className="mt-[11px] flex items-center gap-[9px]">
              <span className="whitespace-nowrap text-[11px] text-fg-subtle" aria-hidden="true">
                {t('inspector.theme.overlay', 'Overlay {pct}%', { pct: tintPct })}
              </span>
              <RangeInput value={tintPct} min={0} max={95} ariaLabel={t('inspector.theme.overlayLabel', 'Overlay')} onBegin={edits.beginEdit} onChange={(value) => edits.set('bgTint', value / 100)} testId="invoices-bg-tint" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
