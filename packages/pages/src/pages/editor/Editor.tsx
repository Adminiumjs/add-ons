/**
 * THE EDITOR: one landing page (comp boards 2–5, `States` 3a–3d and 4a–4d).
 *
 * Its own, in the e-mail editor's look, from the kit's parts (D60):
 *
 * - THE TOP BAR, as Forms' builder fills it: Back, the page's name and status,
 *   then its language, the save state, Undo / Redo, "Draft with Milo",
 *   "Preview" and "Publish" (a draft) or "Update" (a page that was
 *   published). At a phone's width the middle ones fold into "More".
 * - THE CANVAS (`Canvas.tsx`): the page as the shared renderer draws it, at
 *   desktop width or at a phone's.
 * - THE INSPECTOR, 288 wide beside the canvas (in sheets on a phone): the
 *   Sections, and the Design of the selected section or of the page.
 *
 * A reader who may not change pages sees all of it and changes none of it: no
 * write control is drawn and nothing is ever written.
 */
import type { LandingBlockKind } from '@adminium/add-on-contracts/landing';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  asDataError,
  AutosaveIndicator,
  Button,
  Dialog,
  DialogBody,
  DialogHeader,
  EmptyState,
  IconButton,
  Link,
  Menu,
  MenuItem,
  PageActions,
  PageSurface,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SegmentedControl,
  Sheet,
  SheetBody,
  SheetHeader,
  Skeleton,
  Spinner,
  StatusPill,
  StickyBar,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useAccess,
  useLocaleTag,
  useNavigate,
  useRead,
  useRecord,
  useRecords,
  useSearch,
  useStateMove,
  useWrite,
  type AddOnTranslate,
  type DataValue,
  type Tone,
} from '../shared/host.ts';
import { listAt, pageAt, PAGES_TABLE } from '../shared/paths.ts';
import { useToast } from '../shared/toast.ts';
import { BlockFields, type OtherPage } from './BlockFields.tsx';
import { Canvas, Icon } from './Canvas.tsx';
import { blankBlock, checkAll, freshId, hasForm, insertAfter, markCount, newPage, problemsOf, publishable, remove, roomFor, samePage, update, type Page, type Problem } from './doc.ts';
import { makeHome, readDomains, readLiveForms, type LeftOut, type LiveForm } from './engine.ts';
import { KIND_ICON, kindHint, kindName } from './kinds.ts';
import { MiloBand, MiloDialog } from './Milo.tsx';
import { Outline } from './Outline.tsx';
import { PageSettings } from './PageSettings.tsx';
import { Picker } from './Picker.tsx';
import { BlockedCards, PublishPanel, useLandingStatus } from './Publish.tsx';
import { isRightToLeft, languageName, PAGE_LANGUAGES, pageRowOf, startingLanguage } from './row.ts';
import { freeSlug, slugOf } from './slug.ts';
import { useEditing, type Copy, type PageRow } from './store.ts';
import { useEditorStyles } from './styles.ts';
import { refusalWords } from './words.ts';

/** Whether the screen is wide enough for the inspector beside the canvas (the house's `md`). */
function useWide(): boolean {
  const query = '(min-width: 768px)';
  const [wide, setWide] = useState(() => (typeof window === 'undefined' || typeof window.matchMedia !== 'function' ? true : window.matchMedia(query).matches));
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const list = window.matchMedia(query);
    const heard = (): void => setWide(list.matches);
    list.addEventListener('change', heard);
    return () => list.removeEventListener('change', heard);
  }, []);
  return wide;
}

/** A section's new id: short, and none the page has. */
const makeId = (): string => `b${Math.random().toString(36).slice(2, 10)}`;

/** Whether a page already holds an address, for a new page or a copy to find one nobody holds. */
function useSlugTaken(): (slug: string) => Promise<boolean> {
  const read = useRead();
  return useCallback(async (slug: string) => (await read.list(PAGES_TABLE, { filter: [{ column: 'slug', op: 'eq', value: slug }], columns: ['id'], pageSize: 1 })).rows.length > 0, [read]);
}

export function Editor({ t, pageKey, milo }: { t: AddOnTranslate; pageKey: string | null; milo: boolean }): ReactNode {
  useEditorStyles();
  const search = useSearch({ strict: false });
  const asked = milo || search['milo'] === '1' || search['milo'] === 1 || search['milo'] === true;
  return pageKey === null ? <NewPage t={t} milo={asked} /> : <PageScreen t={t} pageKey={pageKey} milo={asked} />;
}

/** A new page: made at once as a draft at an address nobody holds, then opened in the editor. */
function NewPage({ t, milo }: { t: AddOnTranslate; milo: boolean }): ReactNode {
  const access = useAccess();
  const write = useWrite(PAGES_TABLE);
  const navigate = useNavigate();
  const locale = useLocaleTag();
  const taken = useSlugTaken();
  const [failed, setFailed] = useState<string | null>(null);
  const started = useRef(false);
  const mayCreate = access.ready && access.canCreate(PAGES_TABLE);

  useEffect(() => {
    if (!mayCreate || started.current) return;
    started.current = true;
    void (async () => {
      try {
        const name = t('editor.new.name', 'New page');
        const slug = await freeSlug(slugOf(name), taken);
        if (slug === null) throw new Error(t('editor.new.noAddress', 'No address was left for the page. Try another name.'));
        const made = await write.create({ name, slug, language: startingLanguage(locale), draft: newPage(name) as unknown as DataValue });
        const key = String(made.row['id'] ?? '');
        await navigate({ to: pageAt(key), ...(milo ? { search: { milo: '1' } } : {}), replace: true });
      } catch (caught) {
        setFailed(refusalWords(t, asDataError(caught)));
      }
    })();
  }, [mayCreate, t, taken, write, locale, milo, navigate]);

  const title = t('editor.new.title', 'New page');
  return (
    <PageSurface padding="standard" width="wide">
      <PageActions title={title} documentTitle={title} backTo={listAt()} />
      {access.ready && !mayCreate ? (
        <EmptyState title={t('editor.new.forbidden', 'You may not make pages here.')} actions={<Link to={listAt()}>{t('editor.back', 'Back to the landing pages')}</Link>} />
      ) : failed !== null ? (
        <EmptyState title={t('editor.new.failed', 'The page could not be made.')} body={failed} actions={<Link to={listAt()}>{t('editor.back', 'Back to the landing pages')}</Link>} />
      ) : (
        <Spinner label={t('editor.new.making', 'Making the page…')} />
      )}
    </PageSurface>
  );
}

function PageScreen({ t, pageKey, milo }: { t: AddOnTranslate; pageKey: string; milo: boolean }): ReactNode {
  const { row, loading, refetch } = useRecord(PAGES_TABLE, pageKey);
  if (row === null) {
    const title = t('editor.title', 'Page');
    return (
      <PageSurface padding="standard" width="wide">
        <PageActions title={title} documentTitle={title} backTo={listAt()} />
        {loading ? <Skeleton height={420} /> : <EmptyState title={t('editor.missing', 'This page is not here any more.')} actions={<Link to={listAt()}>{t('editor.back', 'Back to the landing pages')}</Link>} />}
      </PageSurface>
    );
  }
  return <Workspace key={pageKey} t={t} row={pageRowOf(row)} refetch={refetch} milo={milo} />;
}

const STATE_TONE: Readonly<Record<PageRow['state'], Tone>> = { draft: 'info', live: 'pos', off: 'neutral' };

function stateName(t: AddOnTranslate, state: PageRow['state']): string {
  if (state === 'live') return t('editor.state.live', 'Live');
  if (state === 'off') return t('editor.state.off', 'Off');
  return t('editor.state.draft', 'Draft');
}

/** The live forms a Form section may show, read once. */
function useLiveForms(): { forms: readonly LiveForm[]; read: boolean } {
  const [forms, setForms] = useState<readonly LiveForm[]>([]);
  const [read, setRead] = useState(false);
  useEffect(() => {
    let live = true;
    readLiveForms().then(
      (found) => {
        if (!live) return;
        setForms(found);
        setRead(true);
      },
      () => (live ? setRead(false) : undefined),
    );
    return () => {
      live = false;
    };
  }, []);
  return { forms, read };
}

/** The language a page is written in: one per page, chosen from the eight. */
function LanguageList({ t, current, mayEdit, onPick }: { t: AddOnTranslate; current: string; mayEdit: boolean; onPick: (tag: string) => void }): ReactNode {
  return (
    <div className="flex flex-col gap-1" role="radiogroup" aria-label={t('editor.lang.title', 'Language')}>
      <span data-lpe-micro="">{t('editor.lang.title', 'Language')}</span>
      {PAGE_LANGUAGES.map((tag) => (
        <button key={tag} type="button" role="radio" aria-checked={tag === current} disabled={!mayEdit && tag !== current} data-lpe-row="" {...(tag === current ? { 'data-lpe-on': '' } : {})} onClick={() => onPick(tag)}>
          <span lang={tag} dir={isRightToLeft(tag) ? 'rtl' : 'ltr'} className="flex-1">
            {languageName(tag)}
          </span>
          {tag === current ? <Icon name="check" /> : null}
        </button>
      ))}
      <p data-lpe-note="">{t('editor.lang.note', 'One language per page. For another language, make a copy of the page and write it in that language.')}</p>
    </div>
  );
}

interface PickerAt {
  /** The section the new one goes after; null at the end. */
  after: string | null;
}

function Workspace({ t, row, refetch, milo }: { t: AddOnTranslate; row: PageRow; refetch: () => void; milo: boolean }): ReactNode {
  const access = useAccess();
  const write = useWrite(PAGES_TABLE);
  const move = useStateMove(PAGES_TABLE);
  const navigate = useNavigate();
  const toast = useToast();
  const taken = useSlugTaken();
  const wide = useWide();
  const mayEdit = access.ready && access.canUpdate(PAGES_TABLE);
  const mayCreate = access.ready && access.canCreate(PAGES_TABLE);
  const mayGoLive = mayEdit && access.canMove(PAGES_TABLE, 'live', row.state);
  const mayGoOff = access.ready && access.canMove(PAGES_TABLE, 'off', row.state);
  const editing = useEditing(row, mayEdit ? (values) => write.update(row.key, values) : null);
  const { status, refetch: refetchStatus } = useLandingStatus(row.key);
  const { forms, read: formsRead } = useLiveForms();
  const others = useRecords(PAGES_TABLE, { columns: ['id', 'name', 'state'], pageSize: 199 });
  const pages: OtherPage[] = useMemo(() => others.rows.filter((one) => String(one['id']) !== row.key).map((one) => ({ key: String(one['id']), name: String(one['name'] ?? ''), live: one['state'] === 'live' })), [others.rows, row.key]);

  const [width, setWidth] = useState<'desktop' | 'phone'>('desktop');
  const [preview, setPreview] = useState(false);
  const [tab, setTab] = useState<'sections' | 'design'>('sections');
  const [designOf, setDesignOf] = useState<'page' | 'block'>('page');
  const [picker, setPicker] = useState<PickerAt | null>(null);
  const [miloOpen, setMiloOpen] = useState(milo && mayEdit);
  const [publishOpen, setPublishOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [sheet, setSheet] = useState<'sections' | 'design' | null>(null);
  const [problems, setProblems] = useState<readonly Problem[] | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState<readonly LeftOut[]>([]);
  const [mayChangeHosts, setMayChangeHosts] = useState<boolean | null>(null);
  const beforeMilo = useRef<Copy | null>(null);

  const { copy, selected } = editing;
  const page = copy.page;
  const block = selected === null ? null : (page.blocks.find((one) => one.id === selected) ?? null);
  const marks = markCount(page);
  const changes = row.state !== 'draft' && !samePage(page, row.published);

  useEffect(() => {
    if (milo && mayEdit) setMiloOpen(true);
  }, [milo, mayEdit]);

  // Whether this person may change which page a host opens on: asked only once there is a host to change.
  const hostCount = status?.hosts.length ?? 0;
  useEffect(() => {
    if (hostCount === 0 || mayChangeHosts !== null) return;
    let live = true;
    void readDomains().then((domains) => (live ? setMayChangeHosts(domains !== null) : undefined));
    return () => {
      live = false;
    };
  }, [hostCount, mayChangeHosts]);

  // Escape leaves Preview (the top overlay closes itself first).
  useEffect(() => {
    if (!preview) return;
    const heard = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !event.defaultPrevented) setPreview(false);
    };
    document.addEventListener('keydown', heard);
    return () => document.removeEventListener('keydown', heard);
  }, [preview]);

  const changePage = (next: (page: Page) => Page, group?: string): void => editing.change((current) => ({ ...current, page: next(current.page) }), group);

  const select = (id: string): void => {
    editing.select(id);
    setDesignOf('block');
    setTab('design');
  };
  const openSettings = (): void => {
    editing.select(null);
    setDesignOf('page');
    setTab('design');
    if (!wide) setSheet('design');
  };

  const pick = (kind: LandingBlockKind): void => {
    const at = picker;
    setPicker(null);
    if (at === null || !roomFor(page)) return;
    const after = at.after ?? page.blocks.at(-1)?.id ?? null;
    const afterBlock = after === null ? null : (page.blocks.find((one) => one.id === after) ?? null);
    const made = blankBlock(kind, freshId(page, makeId), copy.language);
    changePage((current) => insertAfter(current, after, made));
    select(made.id);
    if (!wide) setSheet('design');
    toast(afterBlock === null ? t('editor.toast.added', '{kind} added.', { kind: kindName(t, kind) }) : t('editor.toast.addedAfter', '{kind} added after {after}.', { kind: kindName(t, kind), after: kindName(t, afterBlock.kind) }));
  };

  const removeSelected = (): void => {
    if (block === null) return;
    const kind = kindName(t, block.kind);
    changePage((current) => remove(current, block.id));
    editing.select(null);
    setTab('sections');
    toast(t('editor.toast.removed', '{kind} removed.', { kind }));
  };

  const copyAddress = (address: string): void => {
    void navigator.clipboard?.writeText(address).then(
      () => toast(t('editor.toast.copied', 'Address copied.')),
      () => toast(t('editor.toast.notCopied', 'The address could not be copied.'), 'error'),
    );
  };

  /** Publish (a draft or a page that is off) or Update (a live page): the working copy, checked, as the published one. */
  const publish = async (): Promise<void> => {
    setRefused(null);
    const found = problemsOf(page, row.slug);
    if (found.length > 0) {
      setProblems(found);
      return;
    }
    const doc = publishable(page);
    if (doc === null) return;
    setProblems(null);
    setBusy(true);
    try {
      await editing.flush();
      const values = { published: doc as unknown as DataValue };
      if (row.state === 'live') await write.update(row.key, values);
      else await move(row.key, 'live', values);
      const reach = status === null ? null : status.reach.state === 'reachable';
      if (row.state === 'live') toast(t('editor.toast.changes', 'Changes published. Visitors see them from now on.'));
      else if (reach === false) toast(t('editor.toast.publishedUnreached', 'Published, but visitors can’t reach the page yet.'));
      else toast(t('editor.toast.published', 'Published. The page is live.'));
      setPublishOpen(false);
      refetch();
      void refetchStatus();
    } catch (caught) {
      const words = refusalWords(t, asDataError(caught));
      setRefused(words);
      toast(words, 'error');
    } finally {
      setBusy(false);
    }
  };

  const turn = async (on: boolean): Promise<void> => {
    try {
      await move(row.key, on ? 'live' : 'off');
      toast(on ? t('editor.toast.liveAgain', 'The page is live again.') : t('editor.toast.off', 'The page is off. Visitors see “This page isn’t available.”'));
      refetch();
      void refetchStatus();
    } catch (caught) {
      toast(refusalWords(t, asDataError(caught)), 'error');
    }
  };

  const saveSlug = async (slug: string): Promise<string | null> => {
    try {
      await editing.flush();
      await write.update(row.key, { slug });
      refetch();
      void refetchStatus();
      return null;
    } catch (caught) {
      return refusalWords(t, asDataError(caught));
    }
  };

  const makeCopy = async (): Promise<void> => {
    try {
      await editing.flush();
      const name = t('editor.copy.name', '{name} (copy)', { name: copy.name }).slice(0, 200);
      const slug = await freeSlug(`${row.slug}-copy`, taken);
      if (slug === null) throw new Error(t('editor.new.noAddress', 'No address was left for the page. Try another name.'));
      const made = await write.create({ name, slug, language: copy.language, draft: page as unknown as DataValue });
      toast(t('editor.toast.copy', 'Copy made. Choose its language, then write it in that language.'));
      await navigate({ to: pageAt(String(made.row['id'] ?? '')) });
    } catch (caught) {
      toast(refusalWords(t, asDataError(caught)), 'error');
    }
  };

  const showProblem = (problem: Problem): void => {
    setPublishOpen(false);
    if (problem.code === 'field' && problem.block !== null) select(problem.block);
    else if (problem.code === 'marked') {
      const first = page.blocks.find((one) => one.milo === true);
      if (first !== undefined) select(first.id);
    } else openSettings();
    if (!wide) setSheet('design');
  };

  const drafted = (next: Page, leftOut: readonly LeftOut[]): void => {
    beforeMilo.current = copy;
    editing.change((current) => ({ ...current, page: { ...next, title: next.title.trim() === '' ? current.page.title : next.title, ...(current.page.picture === undefined ? {} : { picture: current.page.picture }) } }));
    setLeft(leftOut);
    setMiloOpen(false);
    editing.select(null);
    setTab('sections');
    toast(t('editor.toast.drafted', 'Milo drafted the page. Check each section.'));
  };

  const looksRight = (): void => {
    changePage(checkAll);
    beforeMilo.current = null;
    setLeft([]);
    toast(t('editor.toast.kept', 'Draft kept. Publish when you’re ready.'));
  };

  const undoAll = (): void => {
    const before = beforeMilo.current;
    // Put back the page as it was before the draft; once that is gone (the editor was opened again), take Milo's sections off.
    editing.change((current) => (before === null ? { ...current, page: { ...current.page, blocks: current.page.blocks.filter((one) => one.milo !== true) } } : before));
    beforeMilo.current = null;
    setLeft([]);
    editing.select(null);
    toast(before === null || before.page.blocks.length === 0 ? t('editor.toast.draftGone', 'Draft removed. The page is empty again.') : t('editor.toast.draftGoneBack', 'Draft removed. The page is as it was.'));
  };

  const language = copy.language;
  const formName = (id: string): string | null => {
    const one = page.blocks.find((b) => b.id === id);
    if (one?.kind !== 'form') return null;
    return forms.find((form) => form.key === one.form && form.addOn === one.addOn)?.name ?? null;
  };

  const outline = (inSheet: boolean): ReactNode => (
    <Outline
      t={t}
      page={page}
      selected={selected}
      mayEdit={mayEdit}
      inSheet={inSheet}
      formName={formName}
      onSelect={(id) => {
        select(id);
        if (!wide) setSheet('design');
      }}
      onPageSettings={openSettings}
      onAdd={() => {
        setSheet(null);
        setPicker({ after: null });
      }}
      onMove={(next) => editing.change((current) => ({ ...current, page: next }))}
    />
  );

  const design = (): ReactNode => {
    if (designOf === 'block' && block !== null) {
      return (
        <div data-lpe-fields="">
          <div data-lpe-head="">
            <IconButton label={t('editor.design.back', 'Back to sections')} variant="ghost" onClick={() => setTab('sections')}>
              <span className="rtl:-scale-x-100">
                <Icon name="arrow-left" />
              </span>
            </IconButton>
            <Icon name={KIND_ICON[block.kind]} />
            <span>
              <b>{kindName(t, block.kind)}</b>
              <small>{kindHint(t, block.kind)}</small>
            </span>
          </div>
          {block.milo === true && mayEdit ? (
            <div data-lpe-group="">
              <span className="text-[12.5px]">{t('editor.design.miloNote', 'Milo wrote this section. Read it through, change what is wrong, then say it looks right.')}</span>
              <span>
                <Button variant="secondary" size="sm" iconLeft={<Icon name="check" />} onClick={() => changePage((current) => update(current, block.id, (one) => one))}>
                  {t('editor.design.checked', 'It looks right')}
                </Button>
              </span>
            </div>
          ) : null}
          <BlockFields t={t} pageKey={row.key} block={block} language={language} mayEdit={mayEdit} hasForm={hasForm(page)} pages={pages} forms={forms} formsRead={formsRead} onChange={(change, group) => changePage((current) => update(current, block.id, change), group)} />
          {mayEdit ? (
            <div className="flex flex-col gap-2">
              <Button variant="secondary" size="sm" iconLeft={<Icon name="plus" />} disabled={!roomFor(page)} onClick={() => setPicker({ after: block.id })}>
                {t('editor.design.addAfter', 'Add a section after this one')}
              </Button>
              <Button variant="destructive" size="sm" iconLeft={<Icon name="trash-2" />} onClick={removeSelected}>
                {t('editor.design.remove', 'Remove this section')}
              </Button>
            </div>
          ) : null}
        </div>
      );
    }
    return (
      <div data-lpe-fields="">
        <div data-lpe-head="">
          <IconButton label={t('editor.design.back', 'Back to sections')} variant="ghost" onClick={() => setTab('sections')}>
            <span className="rtl:-scale-x-100">
              <Icon name="arrow-left" />
            </span>
          </IconButton>
          <Icon name="globe" />
          <span>
            <b>{t('editor.design.page', 'Page')}</b>
            <small>{t('editor.design.pageHint', 'Address, title, sharing')}</small>
          </span>
        </div>
        <PageSettings
          t={t}
          pageKey={row.key}
          name={copy.name}
          slug={row.slug}
          state={row.state}
          title={page.title}
          description={page.description}
          picture={page.picture}
          status={status}
          mayEdit={mayEdit}
          mayMove={row.state === 'live' ? mayGoOff : mayGoLive}
          mayChangeHosts={mayChangeHosts}
          onName={(name) => editing.change((current) => ({ ...current, name }), 'name')}
          onSlug={saveSlug}
          onTitle={(title) => changePage((current) => ({ ...current, title }), 'title')}
          onDescription={(description) => changePage((current) => ({ ...current, description }), 'description')}
          onPicture={(picture) =>
            changePage((current) => {
              const { picture: _picture, ...rest } = current;
              return picture === undefined ? rest : { ...rest, picture };
            })
          }
          onMakeHome={async (host) => {
            await makeHome(host, row.slug);
            await refetchStatus();
          }}
          onTurn={(on) => void turn(on)}
          onCopy={copyAddress}
          onMakeCopy={() => void makeCopy()}
        />
      </div>
    );
  };

  const inspector = (inSheet: boolean): ReactNode => (
    <Tabs value={tab} onValueChange={(value) => setTab(value === 'design' ? 'design' : 'sections')}>
      <TabsList aria-label={t('editor.inspector', 'Inspector')}>
        <TabsTrigger value="sections">{t('editor.tab.sections', 'Sections')}</TabsTrigger>
        <TabsTrigger value="design">{t('editor.tab.design', 'Design')}</TabsTrigger>
      </TabsList>
      <TabsContent value="sections">{outline(inSheet)}</TabsContent>
      <TabsContent value="design">{design()}</TabsContent>
    </Tabs>
  );

  const primary = row.state === 'draft' ? t('editor.publish', 'Publish') : t('editor.update', 'Update');
  const noticeUnset = status?.notice === false;
  const name = copy.name.trim() === '' ? row.name : copy.name;
  const publishButton = (
    <Popover
      open={publishOpen}
      onOpenChange={(open) => {
        setPublishOpen(open);
        if (open) {
          setProblems(null);
          setRefused(null);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="primary" iconLeft={<Icon name="globe" />} disabled={row.state === 'draft' && noticeUnset}>
          {primary}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label={primary}>
        <PublishPanel
          t={t}
          state={row.state}
          slug={row.slug}
          status={status}
          page={page}
          changes={changes}
          busy={busy}
          mayPublish={row.state === 'live' ? mayEdit : mayGoLive}
          mayMove={row.state === 'live' ? mayGoOff : mayGoLive}
          problems={problems}
          refused={refused}
          onPublish={() => void publish()}
          onTurn={(on) => void turn(on)}
          onShow={showProblem}
          onCopy={copyAddress}
        />
      </PopoverContent>
    </Popover>
  );

  return (
    <PageSurface padding="standard" width="full">
      <PageActions
        title={name}
        documentTitle={name}
        backTo={listAt()}
        titleAdornment={
          <StatusPill status={row.state} tone={STATE_TONE[row.state]}>
            {stateName(t, row.state)}
          </StatusPill>
        }
      >
        <span className="hidden items-center gap-2 md:flex">
          <Popover open={languageOpen} onOpenChange={setLanguageOpen}>
            <PopoverTrigger asChild>
              <Button variant="secondary" iconLeft={<Icon name="languages" />} aria-label={t('editor.lang.button', 'Language: {language}', { language: languageName(language) })}>
                <span lang={language}>{languageName(language)}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" aria-label={t('editor.lang.title', 'Language')}>
              <LanguageList
                t={t}
                current={language}
                mayEdit={mayEdit}
                onPick={(tag) => {
                  if (tag !== language) editing.change((current) => ({ ...current, language: tag }));
                  setLanguageOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
          <AutosaveIndicator status={editing.save} savingLabel={t('editor.saving', 'Saving')} savedLabel={t('editor.saved', 'All changes saved')} errorLabel={t('editor.saveFailed', 'Not saved')} />
          {editing.save === 'error' ? (
            <Button variant="ghost" size="sm" onClick={() => void editing.flush()}>
              {t('editor.retry', 'Try again')}
            </Button>
          ) : null}
          {mayEdit ? (
            <>
              <IconButton label={t('editor.undo', 'Undo')} variant="bordered" disabled={!editing.canUndo} onClick={() => {
                editing.undo();
                toast(t('editor.toast.undone', 'Undone.'));
              }}>
                <span className="rtl:-scale-x-100">
                  <Icon name="undo-2" />
                </span>
              </IconButton>
              <IconButton label={t('editor.redo', 'Redo')} variant="bordered" disabled={!editing.canRedo} onClick={() => {
                editing.redo();
                toast(t('editor.toast.redone', 'Done again.'));
              }}>
                <span className="rtl:-scale-x-100">
                  <Icon name="redo-2" />
                </span>
              </IconButton>
              <Button variant="secondary" iconLeft={<Icon name="sparkles" />} onClick={() => setMiloOpen(true)}>
                {t('editor.milo.button', 'Draft with Milo')}
              </Button>
            </>
          ) : null}
          <Button variant={preview ? 'secondary' : 'ghost'} iconLeft={<Icon name={preview ? 'pencil' : 'eye'} />} onClick={() => setPreview(!preview)}>
            {preview ? t('editor.previewClose', 'Close preview') : t('editor.preview', 'Preview')}
          </Button>
        </span>
        <span className="md:hidden">
          <Menu label={t('editor.more', 'More')} align="end">
            <MenuItem icon={<Icon name="languages" />} onSelect={() => setLanguageOpen(true)}>
              {t('editor.lang.button', 'Language: {language}', { language: languageName(language) })}
            </MenuItem>
            {mayEdit ? (
              <>
                <MenuItem icon={<Icon name="undo-2" />} disabled={!editing.canUndo} onSelect={editing.undo}>
                  {t('editor.undo', 'Undo')}
                </MenuItem>
                <MenuItem icon={<Icon name="redo-2" />} disabled={!editing.canRedo} onSelect={editing.redo}>
                  {t('editor.redo', 'Redo')}
                </MenuItem>
                <MenuItem icon={<Icon name="sparkles" />} onSelect={() => setMiloOpen(true)}>
                  {t('editor.milo.button', 'Draft with Milo')}
                </MenuItem>
              </>
            ) : null}
            <MenuItem icon={<Icon name="eye" />} onSelect={() => setPreview(!preview)}>
              {preview ? t('editor.previewClose', 'Close preview') : t('editor.preview', 'Preview')}
            </MenuItem>
            {mayCreate ? (
              <MenuItem icon={<Icon name="copy-plus" />} onSelect={() => void makeCopy()}>
                {t('editor.copy.make', 'Make a copy')}
              </MenuItem>
            ) : null}
          </Menu>
        </span>
        {mayEdit || row.state !== 'draft' ? publishButton : null}
      </PageActions>

      <div data-lpe="">
        <div className="flex flex-col gap-3 pb-0.5">
          <BlockedCards t={t} status={status} />
          {marks > 0 && !preview ? <MiloBand t={t} left={left} mayEdit={mayEdit} onLooksRight={looksRight} onUndoAll={undoAll} /> : null}
        </div>
        <div data-lpe-body="">
          <div data-lpe-main="">
            <div data-lpe-bar="">
              <span data-lpe-line="">
                {preview ? t('editor.canvas.previewLine', 'Preview · as visitors see it. Escape or Preview closes it.') : mayEdit ? t('editor.canvas.line', 'Live preview · click any part of the page to edit it') : t('editor.canvas.readLine', 'You may read this page, not change it.')}
              </span>
              <SegmentedControl
                aria-label={t('editor.canvas.width', 'Canvas width')}
                value={width}
                onValueChange={(value) => setWidth(value === 'phone' ? 'phone' : 'desktop')}
                options={[
                  { value: 'desktop', label: t('editor.canvas.desktop', 'Desktop') },
                  { value: 'phone', label: t('editor.canvas.phone', 'Phone') },
                ]}
              />
            </div>
            {page.blocks.length === 0 && !preview ? (
              <div data-lpe-frame-wrap="" data-lpe-width={width}>
                <div data-lpe-frame="" data-lpe-width={width} dir={isRightToLeft(language) ? 'rtl' : 'ltr'}>
                  <div data-lpe-empty="">
                    <span data-lpe-tile="muted">
                      <Icon name="panels-top-left" />
                    </span>
                    <span className="text-[14.5px] font-bold">{t('editor.empty.title', 'This page is empty')}</span>
                    <span className="text-[13px] text-fg-muted">{mayEdit ? t('editor.empty.body', 'Add a section, or describe the page and Milo drafts it.') : t('editor.empty.readBody', 'Nobody has added a section yet.')}</span>
                    {mayEdit ? (
                      <span className="flex flex-wrap justify-center gap-2 pt-2">
                        <Button variant="secondary" iconLeft={<Icon name="plus" />} onClick={() => setPicker({ after: null })}>
                          {t('editor.outline.add', 'Add a section')}
                        </Button>
                        <Button variant="primary" iconLeft={<Icon name="sparkles" />} onClick={() => setMiloOpen(true)}>
                          {t('editor.milo.button', 'Draft with Milo')}
                        </Button>
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <Canvas
                t={t}
                pageKey={row.key}
                page={page}
                language={language}
                width={width}
                preview={preview}
                selected={selected}
                gapAfter={picker === null ? null : (picker.after ?? 'end')}
                forms={forms}
                onSelect={(id) => {
                  select(id);
                }}
              />
            )}
          </div>
          {preview || !wide ? null : (
            <aside data-lpe-aside="" aria-label={t('editor.inspector', 'Inspector')}>
              {inspector(false)}
            </aside>
          )}
        </div>
        {preview || wide ? null : (
          <StickyBar aria-label={t('editor.bar', 'Editing')}>
            <span className="flex w-full gap-2">
              <Button variant="secondary" iconLeft={<Icon name="pencil" />} disabled={block === null} onClick={() => {
                setTab('design');
                setSheet('design');
              }}>
                {block === null ? t('editor.bar.editNothing', 'Choose a section') : t('editor.canvas.edit', 'Edit {kind}', { kind: kindName(t, block.kind) })}
              </Button>
              <Button variant="secondary" iconLeft={<Icon name="layout-list" />} onClick={() => setSheet('sections')}>
                {t('editor.tab.sections', 'Sections')}
              </Button>
            </span>
          </StickyBar>
        )}
      </div>

      <Sheet open={sheet !== null && !wide} onOpenChange={(open) => (open ? undefined : setSheet(null))} maxWidth={480}>
        <SheetHeader icon={<Icon name={sheet === 'sections' ? 'layout-list' : block === null ? 'globe' : KIND_ICON[block.kind]} />} title={sheet === 'sections' ? t('editor.tab.sections', 'Sections') : block === null || designOf === 'page' ? t('editor.design.page', 'Page') : kindName(t, block.kind)} subtitle={name} closeLabel={t('editor.close', 'Close')} />
        <SheetBody>{sheet === 'sections' ? outline(true) : design()}</SheetBody>
      </Sheet>

      {!wide ? (
        <Dialog open={languageOpen} onOpenChange={setLanguageOpen} size="sm">
          <DialogHeader title={t('editor.lang.title', 'Language')} closeLabel={t('editor.close', 'Close')} />
          <DialogBody>
            <LanguageList
              t={t}
              current={language}
              mayEdit={mayEdit}
              onPick={(tag) => {
                if (tag !== language) editing.change((current) => ({ ...current, language: tag }));
                setLanguageOpen(false);
              }}
            />
          </DialogBody>
        </Dialog>
      ) : null}

      <Picker
        t={t}
        open={picker !== null}
        afterKind={picker?.after === null || picker === null ? (page.blocks.at(-1)?.kind ?? null) : (page.blocks.find((one) => one.id === picker.after)?.kind ?? null)}
        atEnd={picker !== null && (picker.after === null || picker.after === page.blocks.at(-1)?.id)}
        full={!roomFor(page)}
        onOpenChange={(open) => (open ? undefined : setPicker(null))}
        onPick={pick}
      />
      {mayEdit ? <MiloDialog t={t} open={miloOpen} pageKey={row.key} language={language} title={page.title} onOpenChange={setMiloOpen} onDrafted={drafted} /> : null}
    </PageSurface>
  );
}
