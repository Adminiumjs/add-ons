/**
 * The Stock rules screen's module: what the manifest's page
 * `inventory-stock-rules` points at. `?rule=<table>:<rule>` opens that rule.
 */
import type { ReactNode } from 'react';

import { wordsFor } from '../shared/messages.ts';
import { Rules } from './Rules.tsx';

const t = wordsFor('shared', 'refusal', 'rules');

export default function RulesPage(): ReactNode {
  return <Rules t={t} />;
}
