/**
 * The Transfer screen's module: what the manifest's page `inventory-transfer`
 * points at. `?transfer=` is a saved transfer to go on with; none is a new one.
 */
import type { ReactNode } from 'react';

import { useSearch } from '../shared/host.ts';
import { wordsFor } from '../shared/messages.ts';
import { REFUSAL, SHARED, TRANSFER } from '../strings/index.ts';
import { Transfer } from './Transfer.tsx';

const t = wordsFor(SHARED, REFUSAL, TRANSFER);

export default function TransferPage(): ReactNode {
  const value = useSearch({ strict: false })['transfer'];
  const transferId = typeof value === 'string' && value !== '' ? value : typeof value === 'number' ? String(value) : null;
  return <Transfer key={transferId ?? ''} t={t} transferId={transferId} />;
}
