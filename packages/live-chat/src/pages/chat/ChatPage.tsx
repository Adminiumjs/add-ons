/**
 * THE PAGE `live-chat`: the inbox, and Chat settings, by the address the
 * dashboard hands it (`route.ts`).
 */
import type { ReactNode } from 'react';

import { EmptyState, Link, PageActions, PageSurface, useParams, useSearch, type AddOnTranslate } from '../shared/host.ts';
import { inboxAt } from '../shared/paths.ts';
import { Inbox } from '../inbox/Inbox.tsx';
import { Settings } from '../settings/Settings.tsx';
import { conversationIdOf, routeOf } from './route.ts';

export function ChatPage({ t }: { t: AddOnTranslate }): ReactNode {
  const { _splat } = useParams({ strict: false });
  const search = useSearch({ strict: false });
  const route = routeOf(_splat ?? '');
  if (route.screen === 'settings') return <Settings t={t} />;
  if (route.screen === 'inbox') return <Inbox t={t} conversationId={conversationIdOf(search['conversation'])} />;
  return (
    <PageSurface padding="standard" width="wide">
      <PageActions title={t('inbox.page', 'Live chat')} documentTitle={t('inbox.page', 'Live chat')} />
      <EmptyState title={t('shared.missing', 'This page is not here')} actions={<Link to={inboxAt()}>{t('shared.backToChat', 'Back to the chats')}</Link>} />
    </PageSurface>
  );
}
