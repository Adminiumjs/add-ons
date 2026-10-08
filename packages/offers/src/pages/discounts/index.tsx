/** The screen's module: what the manifest's page points at. */
import type { ReactNode } from 'react';

import { wordsFor } from '../shared/messages.ts';
import { PageFrame } from '../shared/PageFrame.tsx';
import { DISCOUNTS, REFUSAL, SHARED } from '../strings/index.ts';

const t = wordsFor(SHARED, REFUSAL, DISCOUNTS);

export default function DiscountsPage(): ReactNode {
  return <PageFrame t={t} title={t('discounts.title', 'Discounts')} />;
}
