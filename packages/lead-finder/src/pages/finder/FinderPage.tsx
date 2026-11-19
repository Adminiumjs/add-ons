/**
 * THE PAGE `lead-finder`: Find companies and People found (console tabs), and
 * the settings off the rail (Sources, People, the mail's preview), by the
 * address the dashboard hands it (`route.ts`).
 */
import { useState, type ReactNode } from 'react';

import { Button, EmptyState, Link, PageActions, PageSurface, Tabs, TabsContent, TabsList, TabsTrigger, useNavigate, useParams, type AddOnTranslate } from '../shared/host.ts';
import { useSaid } from '../shared/said.ts';
import { Icon } from '../shared/parts.tsx';
import { findAt, peopleFoundAt, peopleSettingsAt, sourcesAt } from '../shared/paths.ts';
import { Find } from '../find/Find.tsx';
import { PeopleFound } from '../people/PeopleFound.tsx';
import { MailPreview } from '../settings/MailPreview.tsx';
import { PeopleCard } from '../settings/PeopleCard.tsx';
import { Sources } from '../settings/Sources.tsx';
import { routeOf } from './route.ts';

export function FinderPage({ t }: { t: AddOnTranslate }): ReactNode {
  const { _splat } = useParams({ strict: false });
  const route = routeOf(_splat ?? '');
  const navigate = useNavigate();
  const [said, say] = useSaid();
  const [count, setCount] = useState<number | null>(null);
  const title = t('find.page', 'Lead finder');

  if (route.screen === 'find' || route.screen === 'people') {
    return (
      <PageSurface width="wide" className="leading-[normal]">
        <PageActions title={title} subtitle={t('find.sub', 'Find companies by trade and town, and add them to your companies.')} documentTitle={title}>
          <Link to={sourcesAt()}>
            <span className="inline-flex items-center gap-[7px] text-[12.5px] font-bold">
              <Icon name="plug" />
              {t('shared.sources', 'Sources')}
            </span>
          </Link>
        </PageActions>
        <div className="flex flex-col gap-4">
          <Tabs value={route.screen} onValueChange={(next) => void navigate({ to: next === 'people' ? peopleFoundAt() : findAt() })}>
            <TabsList aria-label={title}>
              <TabsTrigger value="find">{t('find.tab', 'Find companies')}</TabsTrigger>
              <TabsTrigger value="people">
                <span className="inline-flex items-center gap-[7px]">
                  {t('people.tab', 'People found')}
                  {count === null ? null : <span className="rounded-md bg-surface-3 px-1.5 font-mono text-[11.5px] text-fg-muted">{String(count)}</span>}
                </span>
              </TabsTrigger>
            </TabsList>
            {/* Every tab has its panel, the one not shown kept empty and hidden: each tab's "controls" names a panel that is there. */}
            <TabsContent value="find" forceMount hidden={route.screen !== 'find'}>
              {route.screen === 'find' ? <Find t={t} onSaid={say} /> : null}
            </TabsContent>
            <TabsContent value="people" forceMount hidden={route.screen !== 'people'}>
              {route.screen === 'people' ? <PeopleFound t={t} onCount={setCount} /> : null}
            </TabsContent>
          </Tabs>
        </div>
        <div role="status" aria-live="polite" className="sr-only">
          {said}
        </div>
      </PageSurface>
    );
  }

  if (route.screen === 'sources' || route.screen === 'people-settings' || route.screen === 'mail') {
    const settings = t('settings.page', 'Lead finder settings');
    return (
      <PageSurface width="wide" className="leading-[normal]">
        <PageActions title={settings} subtitle={t('settings.sub', 'Where Lead finder looks, and what it keeps about people.')} documentTitle={settings} backTo={findAt()} />
        <div className="flex flex-col gap-4">
          <Tabs value={route.screen === 'sources' ? 'sources' : 'people'} onValueChange={(next) => void navigate({ to: next === 'people' ? peopleSettingsAt() : sourcesAt() })}>
            <TabsList aria-label={settings}>
              <TabsTrigger value="sources">{t('settings.sources.title', 'Sources')}</TabsTrigger>
              <TabsTrigger value="people">{t('settings.people.title', 'People')}</TabsTrigger>
            </TabsList>
            <TabsContent value="sources" forceMount hidden={route.screen !== 'sources'}>
              {route.screen === 'sources' ? <Sources t={t} /> : null}
            </TabsContent>
            <TabsContent value="people" forceMount hidden={route.screen === 'sources'}>
              {route.screen === 'people-settings' ? <PeopleCard t={t} /> : route.screen === 'mail' ? <MailPreview t={t} /> : null}
            </TabsContent>
          </Tabs>
        </div>
      </PageSurface>
    );
  }

  return (
    <PageSurface padding="standard" width="wide">
      <PageActions title={title} documentTitle={title} />
      <EmptyState
        title={t('shared.missing', 'This page is not here')}
        actions={
          <Button variant="secondary" onClick={() => void navigate({ to: findAt() })}>
            {t('shared.backToFind', 'Back to Find companies')}
          </Button>
        }
      />
    </PageSurface>
  );
}
