/**
 * The module the manifest's page `forms` points at: every screen of Forms &
 * surveys, with every language of their words.
 */
import type { ReactNode } from 'react';

import { wordsFor } from '../shared/messages.ts';
import { ANSWERS, BUILDER, LIST, SHARE, SHARED, SURVEYS } from '../strings/index.ts';
import { FormsPage } from './FormsPage.tsx';

const t = wordsFor(SHARED, LIST, BUILDER, ANSWERS, SURVEYS, SHARE);

export default function Forms(): ReactNode {
  return <FormsPage t={t} />;
}
