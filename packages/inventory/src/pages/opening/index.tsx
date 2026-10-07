/**
 * The Opening stock screen's module: what the manifest's page
 * `inventory-opening-stock` points at. `?receipt=` is a saved draft to load.
 */
import type { ReactNode } from 'react';

import { useSearch } from '../shared/host.ts';
import { wordsFor } from '../shared/messages.ts';
import { OPENING, REFUSAL, SHARED } from '../strings/index.ts';
import { Opening } from './Opening.tsx';

const t = wordsFor(SHARED, REFUSAL, OPENING);

export default function OpeningPage(): ReactNode {
  const value = useSearch({ strict: false })['receipt'];
  const receiptId = typeof value === 'string' && value !== '' ? value : typeof value === 'number' ? String(value) : null;
  return <Opening key={receiptId ?? ''} t={t} receiptId={receiptId} />;
}
