/** The Look up screen's module: what the manifest's page `offers-look-up` points at. */
import type { ReactNode } from 'react';

import { wordsFor } from '../shared/messages.ts';
import { LOOKUP, REFUSAL, SHARED } from '../strings/index.ts';
import { LookUp } from './LookUp.tsx';

const t = wordsFor(SHARED, REFUSAL, LOOKUP);

export default function LookUpPage(): ReactNode {
  return <LookUp t={t} />;
}
