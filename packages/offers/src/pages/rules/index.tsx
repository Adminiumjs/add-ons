/** The Offer rules screen's module: what the manifest's page `offers-rules` points at. */
import type { ReactNode } from 'react';

import { wordsFor } from '../shared/messages.ts';
import { REFUSAL, RULES, SHARED } from '../strings/index.ts';
import { Rules } from './Rules.tsx';

const t = wordsFor(SHARED, REFUSAL, RULES);

export default function RulesPage(): ReactNode {
  return <Rules t={t} />;
}
