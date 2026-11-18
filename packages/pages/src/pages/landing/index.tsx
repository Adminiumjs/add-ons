/**
 * The module the manifest's page `pages` points at: the list of landing
 * pages, the funnels and the editor, with every language of their words.
 */
import type { ReactNode } from 'react';

import { wordsFor } from '../shared/messages.ts';
import { EDITOR, FUNNELS, LIST, SHARED } from '../strings/index.ts';
import { LandingPage } from './LandingPage.tsx';

const t = wordsFor(SHARED, LIST, FUNNELS, EDITOR);

export default function LandingPages(): ReactNode {
  return <LandingPage t={t} />;
}
