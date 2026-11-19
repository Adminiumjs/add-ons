/**
 * The module the manifest's page `lead-finder` points at: Find companies,
 * People found and the settings, with every language of their words.
 */
import type { ReactNode } from 'react';

import { wordsFor } from '../shared/messages.ts';
import { DOOR, FIND, MAIL, PEOPLE, SETTINGS, SHARED, SOURCE } from '../strings/index.ts';
import { FinderPage } from './FinderPage.tsx';

const t = wordsFor(SHARED, SOURCE, DOOR, FIND, PEOPLE, SETTINGS, MAIL);

export default function LeadFinder(): ReactNode {
  return <FinderPage t={t} />;
}
