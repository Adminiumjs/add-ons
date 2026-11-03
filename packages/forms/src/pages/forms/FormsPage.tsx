/**
 * THE PAGE `forms`: the list, and every form's and survey's screens, by the
 * address the dashboard hands it (`route.ts`).
 */
import type { ReactNode } from 'react';

import { useParams, useSearch, type AddOnTranslate } from '../shared/host.ts';
import { FormScreen, NotFound } from './FormScreen.tsx';
import { List } from './List.tsx';
import { routeOf, searchText } from './route.ts';

export function FormsPage({ t }: { t: AddOnTranslate }): ReactNode {
  const { _splat } = useParams({ strict: false });
  const search = useSearch({ strict: false });
  const route = routeOf(_splat ?? '');
  if (route.screen === 'list') return <List t={t} kind={route.kind} />;
  if (route.screen === 'unknown') return <NotFound t={t} kind="form" />;
  return <FormScreen key={`${route.kind}:${route.slug}`} t={t} kind={route.kind} slug={route.slug} tab={route.tab} answer={searchText(search['answer'])} settings={searchText(search['settings'])} />;
}
