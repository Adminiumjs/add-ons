/**
 * THE LIST OF LANDING PAGES, with the Pages and Funnels tabs (comp 1a–1c,
 * and 2a for the Funnels tab when it is empty).
 *
 * Pages show as cards or as a list: each with its status, its address and
 * this month's views; a draft has none yet. Search reads the name and the
 * address. "New page" and "Draft with Milo" show only to someone who may make
 * a page; everyone who may read the pages may open one.
 */
import { useState, type ReactNode } from 'react';

import {
  Button,
  DataTable,
  EmptyState,
  IconButton,
  PageActions,
  PageSurface,
  SearchInput,
  SegmentedControl,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  api,
  useAccess,
  useLocaleTag,
  useNavigate,
  useRecords,
  type AddOnTranslate,
  type DataRow,
} from '../shared/host.ts';
import { useLanding } from '../shared/landing.tsx';
import { Address, Icon, PagePill, SmallIcon } from '../shared/parts.tsx';
import { FUNNELS_TABLE, listAt, newPageAt, pageAt, PAGES_TABLE } from '../shared/paths.ts';
import { PAGE_LIST_COLUMNS, pageAddress, pagePath, pageRowOf, type PageRow } from '../shared/rows.ts';
import { useToast } from '../shared/toast.ts';
import { FunnelsTab } from '../funnels/FunnelsTab.tsx';
import { usePageViews } from './views.ts';

type Tab = 'pages' | 'funnels';

/** The pages a search finds: by name or by address, ignoring case. */
export function matching(pages: readonly PageRow[], typed: string): PageRow[] {
  const q = typed.trim().toLowerCase();
  return q === '' ? [...pages] : pages.filter((page) => `${page.name} ${pagePath(page.slug)}`.toLowerCase().includes(q));
}

export function List({ t, tab }: { t: AddOnTranslate; tab: Tab }): ReactNode {
  const navigate = useNavigate();
  const access = useAccess();
  const landing = useLanding();
  const locale = useLocaleTag();
  const toast = useToast();
  const [typed, setTyped] = useState('');
  const [shown, setShown] = useState<'cards' | 'rows'>('cards');
  const read = useRecords(PAGES_TABLE, { columns: PAGE_LIST_COLUMNS, sort: [{ column: 'updated_at', direction: 'desc' }], pageSize: 199 });
  const funnels = useRecords(FUNNELS_TABLE, { columns: ['id'], pageSize: 199 });
  const pages = read.rows.map(pageRowOf);
  const views = usePageViews(api, landing.pagesInstall, landing.today, pages);
  const found = matching(pages, typed);
  const mayMake = access.canCreate(PAGES_TABLE);
  const number = new Intl.NumberFormat(locale);

  const copy = (page: PageRow): void => {
    const address = pageAddress(landing.status?.publicOrigin ?? null, page.slug);
    const done = navigator.clipboard?.writeText(address);
    if (done === undefined) toast(t('list.copyFailed', 'The address could not be copied.'), 'error');
    else void done.then(() => toast(t('list.copied', 'Address copied.')), () => toast(t('list.copyFailed', 'The address could not be copied.'), 'error'));
  };
  const open = (page: PageRow): void => void navigate({ to: pageAt(page.key) });
  const openWords = access.canUpdate(PAGES_TABLE) ? t('list.edit', 'Edit') : t('list.open', 'Open');
  const viewsOf = (page: PageRow): { count: string; label: string } => {
    if (page.state === 'draft') return { count: '—', label: t('list.notLive', 'not live yet') };
    const count = views?.get(page.key);
    return { count: count === undefined ? '—' : number.format(count), label: t('list.viewsThisMonth', 'views this month') };
  };

  const makers = mayMake ? (
    <>
      <Button variant="secondary" iconLeft={<Icon name="sparkles" />} onClick={() => void navigate({ to: newPageAt(true) })}>
        {t('list.milo', 'Draft with Milo')}
      </Button>
      <Button variant="primary" iconLeft={<Icon name="plus" />} onClick={() => void navigate({ to: newPageAt() })}>
        {t('list.new', 'New page')}
      </Button>
    </>
  ) : null;

  const pagesTab = (): ReactNode => {
    if (read.error !== null) return <EmptyState title={t('shared.failed', 'This could not be loaded')} actions={<Button onClick={() => read.refetch()}>{t('shared.retry', 'Try again')}</Button>} />;
    if (!read.loading && pages.length === 0) return <EmptyState title={t('list.empty.title', 'No pages yet')} body={t('list.empty.body', 'Build a page for an offer or an event, with a form on it.')} actions={makers} />;
    if (!read.loading && found.length === 0) return <p className="rounded-[14px] border border-border bg-surface px-5 py-12 text-center text-[13px] text-fg-muted">{t('list.noMatch', 'No pages match “{typed}”.', { typed: typed.trim() })}</p>;
    if (shown === 'rows')
      return (
        <DataTable
          loading={read.loading}
          rows={found.map((page) => ({ id: page.key }) as DataRow)}
          columns={[
            { key: 'name', label: t('list.col.page', 'Page'), render: (row) => <span className="font-bold">{found.find((page) => page.key === row['id'])?.name}</span> },
            { key: 'state', label: t('list.col.status', 'Status'), render: (row) => <PagePill t={t} state={found.find((page) => page.key === row['id'])?.state ?? 'draft'} /> },
            { key: 'slug', label: t('list.col.address', 'Address'), render: (row) => <Address>{pagePath(found.find((page) => page.key === row['id'])?.slug ?? '')}</Address> },
            {
              key: 'views',
              label: t('list.col.views', 'Views this month'),
              render: (row) => {
                const page = found.find((one) => one.key === row['id']);
                const said = page === undefined ? null : viewsOf(page);
                return (
                  <span className="whitespace-nowrap">
                    <span className="font-mono font-bold">{said?.count}</span> <span className="text-fg-muted">{page?.state === 'draft' ? said?.label : t('list.views', 'views')}</span>
                  </span>
                );
              },
            },
            {
              key: 'open',
              label: '',
              align: 'end',
              render: (row) => (
                <Button variant="link" onClick={() => void navigate({ to: pageAt(String(row['id'])) })}>
                  {openWords}
                </Button>
              ),
            },
          ]}
        />
      );
    return (
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy={read.loading}>
        {found.map((page) => {
          const said = viewsOf(page);
          return (
            <li key={page.key} className="flex flex-col overflow-hidden rounded-[14px] border border-border bg-surface shadow-sm">
              <Thumbnail heading={page.heading} />
              <span className="flex flex-col gap-2 p-4">
                <span className="flex items-center gap-2">
                  <h3 className="m-0 min-w-0 flex-1 truncate text-[14px] font-bold">{page.name}</h3>
                  <PagePill t={t} state={page.state} />
                </span>
                <Address>{pagePath(page.slug)}</Address>
                <span className="flex items-center gap-1.5 text-[12.5px] text-fg-muted">
                  <SmallIcon name="eye" />
                  <span className="font-mono font-bold text-fg">{said.count}</span>
                  <span>{said.label}</span>
                </span>
                <span className="mt-1 flex items-center gap-1.5">
                  <span className="flex flex-1 flex-col">
                    <Button variant="secondary" size="sm" iconLeft={<SmallIcon name="pencil" />} onClick={() => open(page)}>
                      {openWords}
                    </Button>
                  </span>
                  <IconButton variant="bordered" label={t('list.copy', 'Copy the address of {name}', { name: page.name })} onClick={() => copy(page)}>
                    <SmallIcon name="copy" />
                  </IconButton>
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <PageSurface padding="standard" width="wide">
      <PageActions title={t('list.title', 'Landing pages')} subtitle={t('list.subtitle', 'Pages for offers and events, each at its own address.')} documentTitle={t('list.title', 'Landing pages')}>
        {makers}
      </PageActions>
      <Tabs value={tab} onValueChange={(value) => void navigate({ to: listAt(value === 'funnels' ? 'funnels' : 'pages') })} variant="pill">
        <span className="flex flex-col gap-[18px]">
          <span className="flex flex-wrap items-center gap-3">
            <TabsList aria-label={t('list.title', 'Landing pages')}>
              <TabsTrigger value="pages">
                <span className="inline-flex items-center gap-1.5">
                  <SmallIcon name="panels-top-left" />
                  {t('list.tab.pages', 'Pages')}
                  <span className="font-mono text-[11.5px] text-fg-subtle">{read.loading ? '' : number.format(pages.length)}</span>
                </span>
              </TabsTrigger>
              <TabsTrigger value="funnels">
                <span className="inline-flex items-center gap-1.5">
                  <SmallIcon name="filter" />
                  {t('list.tab.funnels', 'Funnels')}
                  <span className="font-mono text-[11.5px] text-fg-subtle">{funnels.loading ? '' : number.format(funnels.rows.length)}</span>
                </span>
              </TabsTrigger>
            </TabsList>
            {tab === 'pages' && pages.length > 0 ? (
              <span className="ms-auto flex flex-wrap items-center gap-3">
                <span className="w-60 max-w-full">
                  <SearchInput value={typed} onChange={(event) => setTyped(event.target.value)} placeholder={t('list.search', 'Search pages')} aria-label={t('list.search', 'Search pages')} />
                </span>
                <SegmentedControl
                  aria-label={t('list.showAs', 'Show pages as')}
                  value={shown}
                  onValueChange={(value) => setShown(value === 'rows' ? 'rows' : 'cards')}
                  options={[
                    {
                      value: 'cards',
                      label: (
                        <span className="inline-flex items-center gap-1.5">
                          <SmallIcon name="layout-grid" />
                          <span className="sr-only">{t('list.cards', 'Cards')}</span>
                        </span>
                      ),
                    },
                    {
                      value: 'rows',
                      label: (
                        <span className="inline-flex items-center gap-1.5">
                          <SmallIcon name="list" />
                          <span className="sr-only">{t('list.rows', 'List')}</span>
                        </span>
                      ),
                    },
                  ]}
                />
              </span>
            ) : null}
          </span>
          <TabsContent value="pages">{pagesTab()}</TabsContent>
          <TabsContent value="funnels">
            <FunnelsTab t={t} pages={pages} pagesLoading={read.loading} />
          </TabsContent>
        </span>
      </Tabs>
    </PageSurface>
  );
}

/** A little picture of the page: its main heading over the shapes of a page. Decoration: the card says the rest. */
function Thumbnail({ heading }: { heading: string }): ReactNode {
  return (
    <span aria-hidden="true" className="block border-b border-border bg-surface-2 px-4 pt-4">
      <span className="flex h-32 flex-col gap-2 overflow-hidden rounded-t-lg border border-border bg-surface p-3">
        <span className="flex items-center gap-1.5">
          <span className="size-3.5 rounded-md bg-accent" />
          <span className="h-1.5 w-24 rounded-full bg-surface-3" />
        </span>
        <span className="grid grid-cols-2 items-center gap-2.5">
          <span className="flex min-w-0 flex-col gap-1.5">
            <span className="truncate text-[10.5px] font-extrabold text-fg">{heading}</span>
            <span className="h-1.5 rounded-full bg-surface-3" />
            <span className="h-1.5 w-24 max-w-full rounded-full bg-surface-3" />
            <span className="h-3 w-10 rounded-md bg-accent" />
          </span>
          <span className="h-16 rounded-md bg-surface-3" />
        </span>
      </span>
    </span>
  );
}
