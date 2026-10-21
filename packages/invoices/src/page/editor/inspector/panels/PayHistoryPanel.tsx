// SPDX-License-Identifier: AGPL-3.0-only
/**
 * The Payment history panel.
 *
 * On an INVOICE, payments are recorded, not typed: the host's own Payment
 * panel (its balance, its payments and refunds, the pay link and "Record a
 * payment"), the switch that prints them on the document (`payhShow`), and
 * the line that says so (comp 306-334).
 *
 * On a TEMPLATE, which takes no payments, the typed rows stay as they were
 * (comp 981-987; `payhEdit` 1713, `addPayh` 1714): a card per payment — date ·
 * amount · remove, then the method — *Add payment*, *Remove section*.
 */
import { Info } from 'lucide-react';
import { cn } from '@adminium/ui';

import { t } from '../../../messages.js';
import { formatMoney } from '../../../model/money.js';
import { hostDocumentPaymentPanel } from '../../../payments.js';
import { FIELD, Note, PanelLabel, RemoveSectionButton, Toggle } from '../parts.js';
import type { PanelProps } from '../panelProps.js';
import { RowsEditor } from '../RowsEditor.js';

const CELL = cn(FIELD, 'rounded-lg bg-surface px-[9px] py-[7px] text-[12px]');

function InvoicePayments({ draft, edits, documentId, onPaymentsChanged }: PanelProps) {
  const Panel = hostDocumentPaymentPanel();
  const shown = draft.body.payhShow;
  return (
    <div className="flex flex-col gap-[14px]" data-testid="invoices-payments">
      {Panel === null || documentId === undefined ? (
        <Note>{t('inspector.payments.newerHost', 'Recording payments here needs a newer Adminium.')}</Note>
      ) : (
        <Panel documentId={documentId} onChanged={onPaymentsChanged} />
      )}
      <div className="flex items-center gap-[10px]">
        <div id="invoices-payments-show-label" className="min-w-0 flex-1 text-[12.5px] font-bold text-fg">
          {t('inspector.payments.show', 'Show payments on documents')}
        </div>
        <Toggle on={shown} labelledBy="invoices-payments-show-label" testId="invoices-payments-show" onClick={() => (shown ? edits.hideSection('payhShow') : edits.enableSection('payhShow'))} />
      </div>
      <div className="flex items-start gap-[9px] rounded-[10px] bg-surface-2 px-3 py-[11px]">
        <Info className="mt-px size-[15px] shrink-0 text-fg-subtle" aria-hidden="true" />
        <span className="text-[11.5px] leading-[1.5] text-fg-muted">
          {t('inspector.payments.info', "Payments are recorded, not typed. To print them on the invoice, keep 'Show payments on documents' on.")}
        </span>
      </div>
    </div>
  );
}

export function PayHistoryPanel(props: PanelProps) {
  if (props.kind === 'invoice') return <InvoicePayments {...props} />;
  const { draft, edits, onSelect } = props;
  const body = draft.body;
  return (
    <div className="flex flex-col gap-[9px]">
      <PanelLabel className="mb-0">{t('inspector.payhistory.payments', 'Payments')}</PanelLabel>
      <RowsEditor
        rows={body.payHist}
        addLabel={t('inspector.payhistory.add', 'Add payment')}
        removeLabel={(index) => t('inspector.payhistory.removeRow', 'Remove payment {n}', { n: index + 1 })}
        removeClassName="h-8"
        onAdd={() => edits.addRow('payHist', { date: '—', method: '—', amount: formatMoney(0, body.currency, body.cents), status: 'paid' })}
        onRemove={(index) => edits.removeRow('payHist', index)}
        renderRow={(row, index, remove) => (
          <div key={index} data-testid="invoices-row" className="flex flex-col gap-[5px] rounded-[10px] border border-border bg-surface-2 p-[9px]">
            <div className="flex gap-[6px]">
              <input
                type="text"
                aria-label={t('inspector.payhistory.date', 'Payment {n} date', { n: index + 1 })}
                placeholder={t('inspector.payhistory.datePlaceholder', 'Date')}
                value={row.date}
                onFocus={edits.beginEdit}
                onChange={(event) => edits.updateRow('payHist', index, { date: event.target.value })}
                className={cn(CELL, 'min-w-0 flex-1')}
              />
              <input
                type="text"
                aria-label={t('inspector.payhistory.amount', 'Payment {n} amount', { n: index + 1 })}
                placeholder={t('inspector.payhistory.amountPlaceholder', 'Amount')}
                value={row.amount}
                onFocus={edits.beginEdit}
                onChange={(event) => edits.updateRow('payHist', index, { amount: event.target.value })}
                className={cn(CELL, 'w-20 shrink-0 font-mono')}
              />
              {remove}
            </div>
            <input
              type="text"
              aria-label={t('inspector.payhistory.method', 'Payment {n} method', { n: index + 1 })}
              placeholder={t('inspector.payhistory.methodPlaceholder', 'Method')}
              value={row.method}
              onFocus={edits.beginEdit}
              onChange={(event) => edits.updateRow('payHist', index, { method: event.target.value })}
              className={CELL}
            />
          </div>
        )}
      />
      <RemoveSectionButton flag="payhShow" edits={edits} onSelect={onSelect} className="mt-[2px]" />
    </div>
  );
}
