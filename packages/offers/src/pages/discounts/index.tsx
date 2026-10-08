/**
 * The Discounts screen's module: what the manifest's page `offers-discounts`
 * points at. The list at the page's own address, a blank editor at `/new`,
 * and a discount's editor at `/<its key>`.
 */
import type { ReactNode } from 'react';

import { useParams } from '../shared/host.ts';
import { wordsFor } from '../shared/messages.ts';
import { DISCOUNTS, REFUSAL, SHARED } from '../strings/index.ts';
import { Editor } from './Editor.tsx';
import { List } from './List.tsx';

const t = wordsFor(SHARED, REFUSAL, DISCOUNTS);

export default function DiscountsPage(): ReactNode {
  const { _splat } = useParams({ strict: false });
  const id = (_splat ?? '').split('/').filter(Boolean)[1];
  if (id === undefined) return <List t={t} />;
  return <Editor key={id} t={t} offerId={id === 'new' ? null : decodeURIComponent(id)} />;
}
