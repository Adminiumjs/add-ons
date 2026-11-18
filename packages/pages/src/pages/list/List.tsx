/**
 * THE LIST OF LANDING PAGES, with the Pages and Funnels tabs.
 *
 * A stand-in until the list is built: its title and the words a list with no
 * pages shows.
 */
import type { ReactNode } from 'react';

import { EmptyState, PageActions, PageSurface, type AddOnTranslate } from '../shared/host.ts';

export function List({ t }: { t: AddOnTranslate; tab: 'pages' | 'funnels' }): ReactNode {
  return (
    <PageSurface padding="standard" width="wide">
      <PageActions title={t('list.title', 'Landing pages')} subtitle={t('list.subtitle', 'Pages for offers and events, each at its own address.')} documentTitle={t('list.title', 'Landing pages')} />
      <EmptyState title={t('list.empty.title', 'No pages yet')} body={t('list.empty.body', 'Build a page for an offer or an event, with a form on it.')} />
    </PageSurface>
  );
}
