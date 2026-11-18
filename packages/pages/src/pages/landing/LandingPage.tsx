/**
 * THE PAGE `pages`: the list with its Pages and Funnels tabs, one funnel, and
 * the editor, by the address the dashboard hands it (`route.ts`).
 */
import type { ReactNode } from 'react';

import { EmptyState, Link, PageActions, PageSurface, useParams, useSearch, type AddOnTranslate } from '../shared/host.ts';
import { listAt } from '../shared/paths.ts';
import { Editor } from '../editor/Editor.tsx';
import { List } from '../list/List.tsx';
import { routeOf } from './route.ts';

export function LandingPage({ t }: { t: AddOnTranslate }): ReactNode {
  const { _splat } = useParams({ strict: false });
  const search = useSearch({ strict: false });
  const route = routeOf(_splat ?? '', search);
  switch (route.screen) {
    case 'list':
      return <List t={t} tab={route.tab} />;
    case 'new':
      return <Editor t={t} pageKey={null} milo={route.milo} />;
    case 'editor':
      return <Editor t={t} pageKey={route.key} milo={false} />;
    case 'funnel':
      return (
        <PageSurface padding="standard" width="wide">
          <PageActions title={t('funnels.title', 'Funnels')} documentTitle={t('funnels.title', 'Funnels')} backTo={listAt('funnels')} />
          <EmptyState title={t('shared.missing', 'This page is not here')} actions={<Link to={listAt('funnels')}>{t('shared.backToList', 'Back to the landing pages')}</Link>} />
        </PageSurface>
      );
    case 'unknown':
      return (
        <PageSurface padding="standard" width="wide">
          <PageActions title={t('list.title', 'Landing pages')} documentTitle={t('list.title', 'Landing pages')} />
          <EmptyState title={t('shared.missing', 'This page is not here')} actions={<Link to={listAt()}>{t('shared.backToList', 'Back to the landing pages')}</Link>} />
        </PageSurface>
      );
  }
}
