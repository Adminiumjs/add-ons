// SPDX-License-Identifier: AGPL-3.0-only
/**
 * An invoice's payments, as Adminium keeps them: what the canvas prints (the
 * Paid and Balance due lines, the recorded payments) and what the inspector
 * needs to know (is there a payment, in which currency).
 *
 * Read from the host's `POST /api/v1/payments/panel` under the SAME query key
 * the host's own Payment panel uses, so the two read one cache: a payment
 * recorded in the panel refreshes the sheet too.
 *
 * TYPE-ONLY MIRROR of the panel reply (`routes/payments/panel.ts` in the
 * engine), the fields this page reads and no more.
 */
import { useQuery } from '@tanstack/react-query';
import type { ComponentType } from 'react';
import { requireAddOnHost } from '@adminium/add-on-contracts/runtime';
import { api } from '@adminium/add-on-contracts/runtime/app';

export interface DocumentPayment {
  id: string;
  amount: string;
  currency: string;
  refunded: string;
  /** `bank-transfer`, `cash`, `card`, `cheque`, `other`, `online`. */
  way: string;
  /** The service's or the person's label for the way ("Visa ••4242"). */
  wayLabel: string | null;
  test: boolean;
  /** `YYYY-MM-DD`. */
  paidOn: string;
  recordedBy: string | null;
}

export interface DocumentPayments {
  currency: string;
  total: string;
  due: string;
  /** Paid so far, net of refunds. */
  paid: string;
  payments: DocumentPayment[];
}

/** The host Payment panel's own key for a designer invoice. */
export function paymentsKey(documentId: string) {
  return ['payment-panel', 'document', documentId] as const;
}

/** The invoice's payments; null while unknown, for a template, or when the host keeps none for it. */
export function useDocumentPayments(documentId: string, enabled: boolean): DocumentPayments | null {
  const query = useQuery({
    queryKey: paymentsKey(documentId),
    queryFn: async () => (await api.post<{ data: DocumentPayments | null }>('/api/v1/payments/panel', { documentId })).data,
    enabled,
    staleTime: 30_000,
    // An older host answers 422 for a document: no payments, not a retried error.
    retry: false,
  });
  return enabled ? (query.data ?? null) : null;
}

/** The live payments the sheet prints: no test payment ever reaches a document. */
export function printedPayments(payments: DocumentPayments | null): DocumentPayment[] {
  return payments === null ? [] : payments.payments.filter((payment) => !payment.test);
}

/** Whether a payment stands on the invoice, so its currency is held. */
export function hasLivePayment(payments: DocumentPayments | null): boolean {
  return printedPayments(payments).length > 0;
}

/**
 * A decimal amount ("70.00", "1200", "12.345") as hundredths, the sheet's own
 * unit (every total is kept in hundredths, whatever the currency); null for
 * anything that is not a plain decimal. Exact: no float is involved.
 */
export function hundredthsOf(amount: string): number | null {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(amount.trim());
  if (match === null) return null;
  const whole = Number(match[2]);
  const fraction = Number(((match[3] ?? '') + '00').slice(0, 2));
  const value = whole * 100 + fraction;
  return match[1] === '-' ? -value : value;
}

/** What the host's Payment panel for a designer invoice takes. */
export interface HostDocumentPaymentPanelProps {
  documentId: string;
  onChanged?: (() => void) | undefined;
}

/**
 * The host's own Payment panel for a designer invoice; null on a host older
 * than it, which the page then says plainly instead of drawing nothing.
 */
export function hostDocumentPaymentPanel(): ComponentType<HostDocumentPaymentPanelProps> | null {
  const panel = (requireAddOnHost().app as Readonly<Record<string, unknown>>)['DocumentPaymentPanel'];
  return typeof panel === 'function' ? (panel as ComponentType<HostDocumentPaymentPanelProps>) : null;
}
