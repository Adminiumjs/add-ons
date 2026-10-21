// SPDX-License-Identifier: AGPL-3.0-only
/**
 * @vitest-environment happy-dom
 *
 * An invoice takes payments: its currency carries an ISO code (picked with
 * the symbol, held once a payment stands), Paid is never picked by hand and
 * the panel says it follows the balance, the Payment history section shows
 * the host's own Payment panel (or says plainly that the host is too old),
 * and the sheet prints Paid, Balance due and the recorded payments. A
 * template keeps the typed rows and the five statuses it always had.
 */
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requireAddOnHost } from '@adminium/add-on-contracts/runtime';

import type { EditorDraft } from '../../model/doc.js';
import type { DocumentEdits } from '../../model/edits.js';
import { currencyCodeOf, emptyBody, normalizeBody, type InvoiceBody } from '../../model/envelope.js';
import { totalsOf } from '../../model/money.js';
import { hundredthsOf, type DocumentPayments } from '../../payments.js';
import { PayhistoryBlock } from '../canvas/blocks/lists.js';
import { TotalsBlock } from '../canvas/blocks/items.js';
import type { BlockProps } from '../canvas/blocks/types.js';
import type { PanelProps } from './panelProps.js';
import { PayHistoryPanel } from './panels/PayHistoryPanel.js';
import { ThemePanel } from './panels/ThemePanel.js';

function body(patch: Partial<InvoiceBody> = {}): InvoiceBody {
  return { ...emptyBody(), currency: '€', currencyCode: 'EUR', items: [{ id: 'l1', desc: 'Cake', qty: '1', rate: '120' }], taxRate: '0', ...patch };
}

function draftOf(patch: Partial<InvoiceBody> = {}, status: EditorDraft['status'] = 'sent'): EditorDraft {
  return { name: 'Bakery order', status, topic: 'other', lang: 'en', body: body(patch) };
}

function edits(): DocumentEdits {
  return new Proxy({} as DocumentEdits, {
    get(target, key: string) {
      const store = target as unknown as Record<string, unknown>;
      store[key] ??= vi.fn();
      return store[key];
    },
  });
}

function panelProps(draft: EditorDraft, over: Partial<PanelProps> = {}): PanelProps {
  return { draft, edits: edits(), totals: totalsOf(draft.body), onSelect: vi.fn(), onOpenAdd: vi.fn(), onImageRejected: vi.fn(), kind: 'invoice', documentId: 'inv_1', payments: null, ...over };
}

const PAID: DocumentPayments = {
  currency: 'EUR',
  total: '120.00',
  due: '70.00',
  paid: '50.00',
  payments: [
    { id: 'kept:1', amount: '60.00', currency: 'EUR', refunded: '10.00', way: 'bank-transfer', wayLabel: null, test: false, paidOn: '2026-10-20', recordedBy: 'Tom Becker' },
    { id: 'kept:2', amount: '5.00', currency: 'EUR', refunded: '0', way: 'online', wayLabel: 'Visa ••4242', test: true, paidOn: '2026-10-21', recordedBy: null },
  ],
};

describe('the ISO code and the hundredths', () => {
  it('reads a code only when it is three letters, and never gives a stored body one', () => {
    expect(currencyCodeOf(' eur ')).toBe('EUR');
    expect(currencyCodeOf('euro')).toBeNull();
    expect(currencyCodeOf(12)).toBeNull();
    expect(normalizeBody({ currency: '€' }).currencyCode).toBeNull();
    expect(normalizeBody({ currency: '$', currencyCode: 'cad' }).currencyCode).toBe('CAD');
  });

  it('turns a decimal into hundredths exactly', () => {
    expect(hundredthsOf('70.00')).toBe(7000);
    expect(hundredthsOf('1200')).toBe(120000);
    expect(hundredthsOf('12.345')).toBe(1234);
    expect(hundredthsOf('0.5')).toBe(50);
    expect(hundredthsOf('-3.10')).toBe(-310);
    expect(hundredthsOf('1e3')).toBeNull();
  });
});

describe('the Title & theme panel of an invoice', () => {
  it('picks the symbol and its code together, from the chips or the list', async () => {
    const props = panelProps(draftOf({ currency: '$', currencyCode: null }));
    render(<ThemePanel {...props} />);
    const user = userEvent.setup();
    // `$` says no one currency: none is chosen, and the panel asks.
    expect(screen.getByText('Pick the currency to take payments: $ is used by more than one.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'USD $' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'GBP £' }));
    expect(props.edits.histSetCurrency).toHaveBeenCalledWith('£', 'GBP');
    await user.selectOptions(screen.getByRole('combobox', { name: 'More currencies' }), 'CAD');
    expect(props.edits.histSetCurrency).toHaveBeenCalledWith('C$', 'CAD');
  });

  it('shows a code from the list as chosen, and none of the chips', () => {
    render(<ThemePanel {...panelProps(draftOf({ currency: 'C$', currencyCode: 'CAD' }))} />);
    expect((screen.getByRole('combobox', { name: 'More currencies' }) as HTMLSelectElement).value).toBe('CAD');
    expect(screen.getByRole('button', { name: 'USD $' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('holds the currency once a payment stands, and leaves a test payment out of it', () => {
    render(<ThemePanel {...panelProps(draftOf(), { payments: PAID })} />);
    expect(screen.getByText('This invoice has payments in EUR, so its currency stays EUR.')).toBeDefined();
    expect((screen.getByRole('button', { name: 'EUR €' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('combobox', { name: 'More currencies' }) as HTMLSelectElement).disabled).toBe(true);
  });

  it('never offers Paid, shows it locked when the balance set it, and says why', () => {
    const { unmount } = render(<ThemePanel {...panelProps(draftOf())} />);
    const statuses = within(screen.getByRole('group', { name: 'Status' }));
    expect(statuses.getAllByRole('button').map((button) => button.textContent)).toEqual(['Draft', 'Sent', 'Live', 'Overdue']);
    expect(screen.getByText('Becomes Paid by itself when the balance is zero.')).toBeDefined();
    expect(screen.queryByTestId('invoices-status-paid')).toBeNull();
    unmount();
    render(<ThemePanel {...panelProps(draftOf({}, 'paid'))} />);
    expect(screen.getByTestId('invoices-status-paid').textContent).toBe('Paid');
  });

  it('keeps all five statuses on a template, with no word about the balance', () => {
    render(<ThemePanel {...panelProps(draftOf(), { kind: 'template' })} />);
    expect(within(screen.getByRole('group', { name: 'Status' })).getAllByRole('button')).toHaveLength(5);
    expect(screen.queryByText('Becomes Paid by itself when the balance is zero.')).toBeNull();
  });
});

describe('the Payment history section of an invoice', () => {
  const app = requireAddOnHost().app as Record<string, unknown>;
  afterEach(() => {
    delete app['DocumentPaymentPanel'];
  });

  it('shows the host Payment panel for the invoice, the print switch and the line that explains it', async () => {
    const changed = vi.fn();
    app['DocumentPaymentPanel'] = ({ documentId, onChanged }: { documentId: string; onChanged?: () => void }) => (
      <button type="button" onClick={onChanged}>
        host panel {documentId}
      </button>
    );
    const props = panelProps(draftOf({ payhShow: true }), { onPaymentsChanged: changed });
    render(<PayHistoryPanel {...props} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'host panel inv_1' }));
    expect(changed).toHaveBeenCalled();
    const show = screen.getByRole('switch', { name: 'Show payments on documents' });
    expect(show.getAttribute('aria-checked')).toBe('true');
    await user.click(show);
    expect(props.edits.hideSection).toHaveBeenCalledWith('payhShow');
    expect(screen.getByText("Payments are recorded, not typed. To print them on the invoice, keep 'Show payments on documents' on.")).toBeDefined();
    // Payments are recorded, not typed: no row to type.
    expect(screen.queryByRole('button', { name: 'Add payment' })).toBeNull();
  });

  it('says plainly when the host is older than the panel', () => {
    render(<PayHistoryPanel {...panelProps(draftOf())} />);
    expect(screen.getByText('Recording payments here needs a newer Adminium.')).toBeDefined();
  });

  it('keeps the typed rows on a template', () => {
    render(<PayHistoryPanel {...panelProps(draftOf(), { kind: 'template' })} />);
    expect(screen.getByRole('button', { name: 'Add payment' })).toBeDefined();
  });
});

describe('the sheet of an invoice that takes payments', () => {
  function blockProps(patch: Partial<InvoiceBody>, payments: DocumentPayments | null): BlockProps {
    const b = body(patch);
    return { body: b, totals: totalsOf(b), payments, edits: edits(), section: 'items', onSelect: vi.fn(), onRemoveCustom: vi.fn(), onImageRejected: vi.fn() };
  }

  it('prints Paid and Balance due under the total, from the sheet’s own total', () => {
    render(<TotalsBlock {...blockProps({}, PAID)} />);
    expect(screen.getByTestId('invoices-paid').textContent).toBe('−€50.00');
    expect(screen.getByTestId('invoices-balance-due').textContent).toBe('€70.00');
  });

  it('prints no balance for a template, or an invoice with no code yet', () => {
    render(<TotalsBlock {...blockProps({}, null)} />);
    expect(screen.queryByTestId('invoices-balance')).toBeNull();
  });

  it('prints the recorded live payments net of refunds, never a test one', () => {
    render(<PayhistoryBlock {...blockProps({ payhShow: true, payHist: [{ date: '1 Oct', method: 'Typed', amount: '€1.00', status: 'paid' }] }, PAID)} />);
    const rows = screen.getAllByTestId('invoices-recorded-payment');
    expect(rows.map((row) => row.textContent)).toEqual(['2026-10-20 · Bank transfer€50.00']);
    expect(screen.queryByText('Typed')).toBeNull();
  });

  it('prints the rows typed before payments were recorded when none is recorded', () => {
    render(<PayhistoryBlock {...blockProps({ payhShow: true, payHist: [{ date: '1 Oct', method: 'Typed', amount: '€1.00', status: 'paid' }] }, { ...PAID, payments: [] })} />);
    expect(screen.getByText('Typed')).toBeDefined();
  });
});
