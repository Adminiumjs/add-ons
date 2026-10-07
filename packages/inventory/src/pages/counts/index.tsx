/**
 * The Counts screens' module: what the manifest's page `inventory-counts`
 * points at. One address under the dashboard's router, two screens: the list,
 * and `/<count>` one count's sheet — which is why the page is declared with
 * `detail: true`.
 */
import type { ReactNode } from 'react';

import { useParams, useSearch } from '../shared/host.ts';
import { wordsFor } from '../shared/messages.ts';
import { COUNTS, REFUSAL, SHARED } from '../strings/index.ts';
import { CountSheet } from './CountSheet.tsx';
import { CountsList } from './CountsList.tsx';

const t = wordsFor(SHARED, REFUSAL, COUNTS);

export default function CountsPage(): ReactNode {
  const { _splat } = useParams({ strict: false });
  const id = (_splat ?? '').split('/').filter(Boolean)[1];
  const start = useSearch({ strict: false })['start'];
  if (id !== undefined) return <CountSheet key={id} t={t} countId={id} />;
  return <CountsList t={t} startOpen={start === 1 || start === '1' || start === true} />;
}
