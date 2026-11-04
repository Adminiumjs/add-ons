/**
 * The module the manifest's page `customiser` points at: a product's
 * customising set-up, with every language of its words.
 */
import type { ReactNode } from 'react';

import { wordsFor } from '../shared/messages.ts';
import { DESIGNS, SETUP, SHARED } from '../strings/index.ts';
import { SetupPage } from '../setup/SetupPage.tsx';

const t = wordsFor(SHARED, SETUP, DESIGNS);

export default function Customiser(): ReactNode {
  return <SetupPage t={t} />;
}
