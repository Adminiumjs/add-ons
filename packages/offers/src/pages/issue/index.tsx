/**
 * The Issue sheet's module: what the manifest's page `offers-issue` points
 * at. `?tab=gift-card|voucher|batch` opens that tab; `?back=<path>` is where
 * closing goes.
 */
import type { ReactNode } from 'react';

import { wordsFor } from '../shared/messages.ts';
import { ISSUE, REFUSAL, SHARED } from '../strings/index.ts';
import { Issue } from './Issue.tsx';

const t = wordsFor(SHARED, REFUSAL, ISSUE);

export default function IssuePage(): ReactNode {
  return <Issue t={t} />;
}
