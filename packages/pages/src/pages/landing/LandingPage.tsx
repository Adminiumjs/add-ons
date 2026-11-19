/**
 * THE PAGE `pages`: the list with its Pages and Funnels tabs, one funnel, and
 * the editor, by the address the dashboard hands it (`route.ts`). What
 * Adminium says of the pages (their status, the install ids, the live forms)
 * is read once here, for every screen.
 */
import { useEffect, useState, type ReactNode } from 'react';

import { readScope } from '../../install.ts';
import { api, EmptyState, Link, PageActions, PageSurface, useParams, useSearch, type AddOnTranslate } from '../shared/host.ts';
import { ADD_ON, listAt } from '../shared/paths.ts';
import { Editor } from '../editor/Editor.tsx';
import { FunnelView } from '../funnels/FunnelView.tsx';
import { List } from '../list/List.tsx';
import { LandingProvider, useLandingReads } from '../shared/landing.tsx';
import { routeOf } from './route.ts';

export function LandingPage({ t }: { t: AddOnTranslate }): ReactNode {
  const scoped = useScope();
  // Nothing is drawn for the moment the kit takes to answer: the dashboard's own read of it is as quick.
  return scoped ? <Scoped t={t} /> : null;
}

/**
 * Which copy of the add-on the page is open for, asked of the kit before any
 * landing route is (`install.ts`): true once the kit has answered, or failed.
 */
function useScope(): boolean {
  const [scoped, setScoped] = useState(false);
  useEffect(() => {
    let live = true;
    void readScope((path) => api.get<unknown>(path), ADD_ON).then(() => {
      if (live) setScoped(true);
    });
    return () => {
      live = false;
    };
  }, []);
  return scoped;
}

function Scoped({ t }: { t: AddOnTranslate }): ReactNode {
  const landing = useLandingReads();
  return (
    <LandingProvider value={landing}>
      <Screen t={t} />
    </LandingProvider>
  );
}

function Screen({ t }: { t: AddOnTranslate }): ReactNode {
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
      return <FunnelView t={t} funnelKey={route.key} />;
    case 'unknown':
      return (
        <PageSurface padding="standard" width="wide">
          <PageActions title={t('list.title', 'Landing pages')} documentTitle={t('list.title', 'Landing pages')} />
          <EmptyState title={t('shared.missing', 'This page is not here')} actions={<Link to={listAt()}>{t('shared.backToList', 'Back to the landing pages')}</Link>} />
        </PageSurface>
      );
  }
}
