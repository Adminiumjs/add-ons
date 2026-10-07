/**
 * The Receive screen's module: what the manifest's page `inventory-receive`
 * points at. The address says which receipt — `?receipt=` a saved one,
 * `?po=` a new one against an order, neither a new one with no order. With
 * both, the receipt is the one meant.
 */
import type { ReactNode } from 'react';

import { useSearch } from '../shared/host.ts';
import { wordsFor } from '../shared/messages.ts';
import { Receive } from './Receive.tsx';

const t = wordsFor('shared', 'refusal', 'receive');

const one = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : typeof value === 'number' ? String(value) : null);

export default function ReceivePage(): ReactNode {
  const search = useSearch({ strict: false });
  const receiptId = one(search['receipt']);
  const poId = receiptId === null ? one(search['po']) : null;
  // A different receipt is a different screen: nothing typed on one is carried to another.
  return <Receive key={`${receiptId ?? ''}|${poId ?? ''}`} t={t} receiptId={receiptId} poId={poId} />;
}
