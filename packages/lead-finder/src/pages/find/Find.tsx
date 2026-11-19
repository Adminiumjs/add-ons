/**
 * FIND COMPANIES (comps 1c, 1c-2, 1d, 1e; phone 6c): companies by what they
 * do and where, from one source that finds them, a page at a time, and
 * "Add {n} to {table}".
 *
 * - "Search in" offers only the sources that find companies and are on.
 *   None: "No source can search. Turn one on in Sources."
 * - Each found company says whether it is here already ("Already here", a
 *   link; "Already here · kept by a colleague", no link and no values),
 *   added just now, flagged by its register (no sales contact), or a sole
 *   trader (a person).
 * - "Add" names what was found (its `ref`) with a retry key per company:
 *   Adminium writes what it found, never what the page holds.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';

import { addReasonWords, doorRefusal, sourceRefusal, type Said } from '../shared/codes.ts';
import { activityOptions, activityWords } from '../shared/activities.ts';
import { shortDay } from '../shared/dates.ts';
import { door, readKit, retryKey, sources as sourceRoutes, type CompaniesHost, type FoundView, type SourceView } from '../shared/door.ts';
import { Button, Checkbox, Combobox, Field, Input, Link, SegmentedControl, Skeleton, asDataError, useLocaleTag, type AddOnTranslate } from '../shared/host.ts';
import { Icon, Fixed, Pill, SmallIcon, Spinning, StateCard, Value } from '../shared/parts.tsx';
import { recordAt, sourcesAt } from '../shared/paths.ts';
import { sourceRank, sourceWords } from '../shared/sourceWords.ts';
import { useToast } from '../shared/toast.ts';
import { hasTickBox, rowState, tickable, websiteOf, type RowState } from './rows.ts';

/** How many companies one page of a search asks for. */
export const PAGE_SIZE = 20;

type Setup = { status: 'loading' } | { status: 'failed'; message: string } | { status: 'ready'; finders: SourceView[]; all: SourceView[]; table: CompaniesHost | null };

interface Query {
  source: string;
  activity: string;
  where: string;
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'searching'; query: Query }
  | { kind: 'refused'; query: Query; said: Said }
  | { kind: 'list'; query: Query; companies: FoundView[]; next: string | null; total: number | null; at: number };

export function Find({ t, onSaid }: { t: AddOnTranslate; onSaid: (words: string) => void }): ReactNode {
  const locale = useLocaleTag();
  const toast = useToast();
  const [setup, setSetup] = useState<Setup>({ status: 'loading' });
  const [source, setSource] = useState('');
  const [activity, setActivity] = useState<string | null>(null);
  const [where, setWhere] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [picks, setPicks] = useState<ReadonlySet<string>>(new Set());
  const [added, setAdded] = useState<ReadonlyMap<string, string | null>>(new Map());
  const [adding, setAdding] = useState(false);
  const [more, setMore] = useState(false);
  const [tip, setTip] = useState<string | null>(null);
  const retries = useRef(new Map<string, string>());

  useEffect(() => {
    let alive = true;
    Promise.all([sourceRoutes.list(), readKit()]).then(
      ([list, kit]) => {
        if (!alive) return;
        const all = [...list.sources].sort((a, b) => sourceRank(a.id) - sourceRank(b.id));
        const finders = all.filter((one) => !one.website && one.on && one.gives.includes('find'));
        setSetup({ status: 'ready', finders, all, table: kit.companies[0] ?? null });
        setSource((was) => (was !== '' ? was : (finders[0]?.id ?? '')));
      },
      (caught: unknown) => {
        if (alive) setSetup({ status: 'failed', message: doorRefusal(t, asDataError(caught)) });
      },
    );
    return () => {
      alive = false;
    };
  }, [t]);

  useEffect(() => {
    if (tip === null) return undefined;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTip(null);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [tip]);

  const options = useMemo(() => activityOptions(source, locale), [source, locale]);

  if (setup.status === 'loading') {
    return (
      <div className="flex flex-col gap-3">
        <span role="status" className="sr-only">
          {t('shared.loading', 'Loading')}
        </span>
        <Skeleton height={96} />
        <Skeleton height={240} />
      </div>
    );
  }
  if (setup.status === 'failed') {
    return (
      <StateCard tone="danger" icon="circle-alert">
        {setup.message}
      </StateCard>
    );
  }
  if (setup.finders.length === 0) {
    return (
      <StateCard tone="neutral" icon="plug-zap" action={<SourcesLink t={t} />}>
        {t('find.noSource', 'No source can search. Turn one on in Sources.')}
      </StateCard>
    );
  }

  const table = setup.table;
  const tableLabel = table?.label ?? '';
  const sourceView = (id: string) => setup.all.find((one) => one.id === id);
  const country = sourceWords(t, source).country ?? 'GB';

  const ask = async (query: Query, cursor: string | null): Promise<void> => {
    const found = await door.search({
      source: query.source,
      ...(table === null ? {} : { table: table.tableRef }),
      activity: query.activity,
      place: { text: query.where, country: sourceWords(t, query.source).country ?? country },
      cursor,
      size: PAGE_SIZE,
    });
    setPhase((was) => {
      const earlier = cursor !== null && was.kind === 'list' ? was.companies : [];
      const seen = new Set(earlier.map((one) => one.ref));
      return { kind: 'list', query, companies: [...earlier, ...found.companies.filter((one) => !seen.has(one.ref))], next: found.next, total: found.total, at: was.kind === 'list' && cursor !== null ? was.at : Date.now() };
    });
    if (cursor === null) onSaid(found.companies.length === 0 ? t('find.empty', 'No companies found. Try a wider place.') : t('find.foundSaid', '{count, plural, one {# company found} other {# companies found}}', { count: found.companies.length }));
  };

  const search = (event?: FormEvent): void => {
    event?.preventDefault();
    if (activity === null) return;
    const query: Query = { source, activity, where: where.trim() };
    setPhase({ kind: 'searching', query });
    setPicks(new Set());
    setAdded(new Map());
    retries.current = new Map();
    onSaid(t('find.searching', 'Searching {source}…', { source: sourceWords(t, source).short }));
    ask(query, null).catch((caught: unknown) => {
      const said = sourceRefusal(t, asDataError(caught), sourceView(query.source), query.source);
      setPhase({ kind: 'refused', query, said });
      onSaid(said.message);
    });
  };

  const showMore = (): void => {
    if (phase.kind !== 'list' || phase.next === null) return;
    setMore(true);
    ask(phase.query, phase.next)
      .catch((caught: unknown) => toast(sourceRefusal(t, asDataError(caught), sourceView(phase.query.source), phase.query.source).message, 'error'))
      .finally(() => setMore(false));
  };

  const list = phase.kind === 'list' ? phase.companies : [];
  const stateOf = (company: FoundView): RowState => rowState(company, added.has(company.ref));
  const open = list.filter((company) => tickable(stateOf(company)));
  const ticked = open.filter((company) => picks.has(company.ref));
  const allTicked = open.length > 0 && ticked.length === open.length;

  const tick = (ref: string, on: boolean): void =>
    setPicks((was) => {
      const next = new Set(was);
      if (on) next.add(ref);
      else next.delete(ref);
      return next;
    });
  const tickAll = (): void => setPicks(allTicked ? new Set() : new Set(open.map((company) => company.ref)));

  const add = async (): Promise<void> => {
    if (phase.kind !== 'list' || ticked.length === 0) return;
    const retryOf = (ref: string): string => {
      const known = retries.current.get(ref);
      if (known !== undefined) return known;
      const made = retryKey();
      retries.current.set(ref, made);
      return made;
    };
    setAdding(true);
    try {
      const reply = await door.add({ source: phase.query.source, ...(table === null ? {} : { table: table.tableRef }), companies: ticked.map((company) => ({ ref: company.ref, retryKey: retryOf(company.ref) })) });
      const done = reply.results.filter((one) => one.outcome === 'added');
      setAdded((was) => {
        const next = new Map(was);
        for (const one of done) next.set(one.ref, one.key);
        return next;
      });
      setPicks(new Set());
      if (done.length > 0) {
        const owned = table?.lead.owner !== undefined;
        toast(
          owned
            ? t('find.addedOwned', '{count, plural, one {# company added to {table}, owned by you.} other {# companies added to {table}, owned by you.}}', { count: done.length, table: tableLabel })
            : t('find.added', '{count, plural, one {# company added to {table}.} other {# companies added to {table}.}}', { count: done.length, table: tableLabel }),
        );
      }
      const refused = reply.results.filter((one) => one.outcome === 'refused');
      if (refused.length > 0) toast(t('find.notAdded', '{count, plural, one {# not added: {why}} other {# not added. The first: {why}}}', { count: refused.length, why: addReasonWords(t, refused[0]!.reason) }), 'error');
    } catch (caught) {
      toast(doorRefusal(t, asDataError(caught)), 'error');
    } finally {
      setAdding(false);
    }
  };

  const sourceShort = phase.kind === 'idle' ? '' : sourceWords(t, phase.query.source).short;
  const queryLine = phase.kind === 'idle' ? '' : `${activityWords(phase.query.source, phase.query.activity, locale)} · ${phase.query.where === '' ? t('find.everywhere', 'everywhere') : phase.query.where}`;
  const foundOn = phase.kind === 'list' ? shortDay(phase.at, locale) : '';

  return (
    <div className="flex flex-col gap-4">
      <form role="search" aria-label={t('find.formLabel', 'Find companies')} onSubmit={search} className="flex flex-wrap items-end gap-3.5 rounded-[14px] border border-border bg-surface p-5 shadow-sm">
        <span className="min-w-0 flex-1 basis-64">
          <Field label={t('find.what', 'What they do')}>
            <Combobox options={options} value={activity} onValueChange={setActivity} emptyText={t('find.whatNone', 'No activity by those words')} placeholder={t('find.whatHint', 'Type what they do')} />
          </Field>
        </span>
        <span className="min-w-0 flex-1 basis-64">
          <Input label={t('find.where', 'Where')} value={where} onChange={(event) => setWhere(event.target.value)} placeholder={t('find.whereHint', 'A town or a postcode')} />
        </span>
        <span className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[12.5px] font-bold text-fg-muted">{t('find.searchIn', 'Search in')}</span>
          <SegmentedControl
            aria-label={t('find.searchIn', 'Search in')}
            options={setup.finders.map((one) => ({ value: one.id, label: sourceWords(t, one.id).name }))}
            value={source}
            onValueChange={(next) => {
              setSource(next);
              setActivity(null);
            }}
          />
        </span>
        <Button type="submit" variant="primary" disabled={activity === null || phase.kind === 'searching'} iconLeft={<Icon name="search" />}>
          {t('find.search', 'Search')}
        </Button>
      </form>

      {phase.kind === 'searching' ? (
        <section aria-busy="true" className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-sm">
          <div className="flex items-center gap-[9px] px-5 py-3.5 text-[14px] font-bold">
            <Spinning />
            {t('find.searching', 'Searching {source}…', { source: sourceShort })}
          </div>
          {[0, 1, 2].map((line) => (
            <div key={line} className="flex items-center gap-3.5 border-t border-border px-5 py-3.5">
              <Skeleton width={16} height={16} />
              <Skeleton width={28} height={28} />
              <Skeleton width="40%" height={10} />
              <Skeleton width="20%" height={10} />
            </div>
          ))}
        </section>
      ) : null}

      {phase.kind === 'refused' ? <Refused t={t} said={phase.said} onRetry={() => search()} /> : null}

      {phase.kind === 'list' && list.length === 0 ? (
        <section aria-live="polite" className="flex flex-col items-center gap-2 rounded-[14px] border border-border bg-surface px-6 py-14 text-center shadow-sm">
          <span className="flex size-11 items-center justify-center rounded-[14px] bg-surface-3 text-fg-muted">
            <Icon name="search-x" />
          </span>
          <h2 className="m-0 text-[14.5px] font-bold">{t('find.empty', 'No companies found. Try a wider place.')}</h2>
          <p className="m-0 text-[12.5px] text-fg-muted">{queryLine}</p>
        </section>
      ) : null}

      {phase.kind === 'list' && list.length > 0 ? (
        <section aria-labelledby="lf-results" className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-sm">
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5 border-b border-border px-5 py-3.5">
            <div className="flex min-w-0 flex-col">
              <h2 id="lf-results" className="m-0 text-[14.5px] font-bold tracking-[-0.01em]">
                <CountLabel t={t} companies={list} total={phase.total} />
              </h2>
              <span className="text-[12.5px] text-fg-muted">{queryLine}</span>
            </div>
            <div className="ms-auto flex flex-wrap items-center gap-2.5">
              <span className="text-[12.5px] text-fg-muted">{ticked.length === 0 ? t('find.tickHint', 'Tick the ones to add') : t('find.ticked', '{count} ticked', { count: ticked.length })}</span>
              <Button variant="primary" disabled={ticked.length === 0 || table === null} loading={adding} onClick={() => void add()} iconLeft={<Icon name="building-2" />}>
                {ticked.length === 0 ? t('find.addNone', 'Add to {table}', { table: tableLabel }) : t('find.add', 'Add {count} to {table}', { count: ticked.length, table: tableLabel })}
              </Button>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="overflow-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-surface-2">
                    <th scope="col" className="w-12 py-2.5 ps-5 text-start">
                      <Checkbox checked={allTicked} disabled={open.length === 0} onCheckedChange={tickAll} aria-label={t('find.tickAll', 'Tick all')} />
                    </th>
                    <Head>{t('find.col.company', 'Company')}</Head>
                    <Head>{t('find.col.town', 'Town')}</Head>
                    <Head>{t('find.col.what', 'What they do')}</Head>
                    <Head>{t('find.col.number', 'Company number')}</Head>
                    <Head>{t('find.col.website', 'Website')}</Head>
                    <Head>{t('find.col.found', 'Found')}</Head>
                    <th scope="col" className="px-3.5 py-2.5">
                      <span className="sr-only">{t('find.col.here', 'In {table}', { table: tableLabel })}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((company) => (
                    <WideRow key={company.ref} t={t} company={company} state={stateOf(company)} picked={picks.has(company.ref)} onPick={(on) => tick(company.ref, on)} table={table} source={sourceShort} day={foundOn} tip={tip} setTip={setTip} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="md:hidden">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2">
              <Checkbox checked={allTicked} disabled={open.length === 0} onCheckedChange={tickAll} aria-label={t('find.tickAll', 'Tick all')} />
              <span className="text-[12.5px] font-bold text-fg-muted">{t('find.tickAll', 'Tick all')}</span>
            </div>
            <ul className="m-0 flex flex-col p-0">
              {list.map((company) => (
                <NarrowRow key={company.ref} t={t} company={company} state={stateOf(company)} picked={picks.has(company.ref)} onPick={(on) => tick(company.ref, on)} table={table} source={sourceShort} day={foundOn} />
              ))}
            </ul>
          </div>
          {phase.next !== null ? (
            <div className="flex justify-center border-t border-border p-3.5">
              <Button variant="secondary" loading={more} onClick={showMore}>
                {t('find.more', 'Show {count} more', { count: PAGE_SIZE })}
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function SourcesLink({ t }: { t: AddOnTranslate }): ReactNode {
  return (
    <Link to={sourcesAt()}>
      <span className="inline-flex items-center gap-[7px] font-bold">
        <Icon name="plug" />
        {t('shared.sources', 'Sources')}
      </span>
    </Link>
  );
}

/** A refused search: its own card, with Sources or Try again as the refusal asks. */
function Refused({ t, said, onRetry }: { t: AddOnTranslate; said: Said; onRetry: () => void }): ReactNode {
  if (said.kind === 'key' || said.kind === 'off')
    return (
      <StateCard tone="danger" icon="key-round" action={<SourcesLink t={t} />}>
        {said.message}
      </StateCard>
    );
  if (said.kind === 'limit')
    return (
      <StateCard tone="warn" icon="gauge" action={<SourcesLink t={t} />}>
        {said.message}
      </StateCard>
    );
  if (said.kind === 'down')
    return (
      <StateCard
        tone="danger"
        icon="wifi-off"
        live
        action={
          <Button variant="secondary" onClick={onRetry} iconLeft={<Icon name="rotate-cw" />}>
            {t('shared.retry', 'Try again')}
          </Button>
        }
      >
        {said.message}
      </StateCard>
    );
  return (
    <StateCard tone="danger" icon="circle-alert">
      {said.message}
    </StateCard>
  );
}

function CountLabel({ t, companies, total }: { t: AddOnTranslate; companies: readonly FoundView[]; total: number | null }): ReactNode {
  if (total !== null && total > companies.length) return <>{t('find.showing', 'Showing {shown} of {total}', { shown: companies.length, total })}</>;
  const sole = companies.filter((company) => company.natural).length;
  const firms = companies.length - sole;
  if (sole === 0) return <>{t('find.count', '{count, plural, one {# company} other {# companies}}', { count: firms })}</>;
  return <>{t('find.countSole', '{count, plural, one {# company} other {# companies}} · {sole, plural, one {# sole trader} other {# sole traders}}', { count: firms, sole })}</>;
}

function Head({ children }: { children: ReactNode }): ReactNode {
  return (
    <th scope="col" className="whitespace-nowrap px-3.5 py-2.5 text-start text-[10.5px] font-bold uppercase tracking-[0.05em] text-fg-subtle">
      {children}
    </th>
  );
}

interface RowProps {
  t: AddOnTranslate;
  company: FoundView;
  state: RowState;
  picked: boolean;
  onPick: (on: boolean) => void;
  table: CompaniesHost | null;
  source: string;
  day: string;
}

/** The pill at a row's end: Added, Already here (a link), kept by a colleague, no sales contact, sole trader. */
function Chip({ t, company, state, table, tip, setTip }: Pick<RowProps, 't' | 'company' | 'state' | 'table'> & { tip?: string | null; setTip?: (ref: string | null) => void }): ReactNode {
  if (state === 'added')
    return (
      <Pill tone="pos" icon="check">
        {t('find.chip.added', 'Added')}
      </Pill>
    );
  if (state === 'here') {
    const key = company.here?.key ?? null;
    const pill = (
      <Pill tone="info" icon="building-2">
        {t('find.chip.here', 'Already here')}
        <span className="sr-only">{t('find.chip.hereOpen', ': open {name} in {table}', { name: company.name, table: table?.label ?? '' })}</span>
      </Pill>
    );
    return key !== null && table?.page !== undefined ? <Link to={recordAt(table.page, key)}>{pill}</Link> : pill;
  }
  if (state === 'colleague')
    return (
      <Pill tone="neutral" icon="lock">
        {t('find.chip.colleague', 'Already here · kept by a colleague')}
      </Pill>
    );
  if (state === 'no-sales') {
    const id = `lf-tip-${company.ref}`;
    const shown = tip === company.ref;
    return (
      <span className="relative inline-flex">
        <span tabIndex={0} aria-describedby={id} onMouseEnter={() => setTip?.(company.ref)} onMouseLeave={() => setTip?.(null)} onFocus={() => setTip?.(company.ref)} onBlur={() => setTip?.(null)}>
          <Pill tone="warn" icon="shield-alert">
            {t('find.chip.noSales', 'Asked not to be contacted for sales')}
          </Pill>
        </span>
        {shown ? (
          <span id={id} role="tooltip" className="absolute end-0 top-full z-20 mt-2 w-72 whitespace-normal rounded-[10px] bg-fg px-3 py-2.5 text-start text-[12px] font-medium leading-normal text-bg shadow-sm">
            {t('find.chip.noSalesTip', 'This business told the register it does not want sales contact. You can still fill in its details on a record you already have.')}
          </span>
        ) : (
          <span id={id} className="sr-only">
            {t('find.chip.noSalesTip', 'This business told the register it does not want sales contact. You can still fill in its details on a record you already have.')}
          </span>
        )}
      </span>
    );
  }
  if (state === 'sole')
    return (
      <Pill tone="neutral" icon="user-round">
        {t('find.chip.sole', 'Sole trader: a person')}
      </Pill>
    );
  return null;
}

function WideRow({ t, company, state, picked, onPick, table, source, day, tip, setTip }: RowProps & { tip: string | null; setTip: (ref: string | null) => void }): ReactNode {
  const site = websiteOf(company);
  const box = hasTickBox(state) ? <Checkbox checked={picked && tickable(state)} disabled={!tickable(state)} onCheckedChange={onPick} aria-label={t('find.tickOne', 'Tick {name}', { name: company.name })} /> : null;
  const cells = (
    <>
      <td className="py-[13px] ps-5 align-top">{box}</td>
      <td className="px-3.5 py-[13px]">
        <span className="flex items-start gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-3 text-fg-muted">
            <SmallIcon name="building-2" />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5 pt-1">
            <span className="whitespace-nowrap font-bold">
              <Value>{company.name}</Value>
            </span>
            {state === 'sole' ? <span className="max-w-[300px] text-[12px] text-fg-muted">{addReasonWords(t, company.blocked?.reason ?? 'sole-trader')}</span> : null}
          </span>
        </span>
      </td>
      <td className="whitespace-nowrap px-3.5 py-[13px] text-fg-muted">
        <Value>{company.address?.town ?? '—'}</Value>
      </td>
      <td className="px-3.5 py-[13px] text-fg-muted">
        <Value>{company.activity?.label ?? '—'}</Value>
      </td>
      <td className="whitespace-nowrap px-3.5 py-[13px]">{company.number === undefined ? <span className="text-fg-subtle">—</span> : <Fixed>{company.number}</Fixed>}</td>
      <td className="whitespace-nowrap px-3.5 py-[13px]">
        {site === null ? (
          <span className="text-fg-subtle">—</span>
        ) : (
          <a href={site.href} target="_blank" rel="noopener noreferrer" dir="ltr" className="font-mono text-[12px] text-accent">
            {site.shown}
          </a>
        )}
      </td>
      <td className="whitespace-nowrap px-3.5 py-[13px] text-[12.5px] text-fg-muted">
        {t('find.foundIn', 'Found in {source}', { source })} · <span className="font-mono text-[12px]">{day}</span>
      </td>
      <td className="whitespace-nowrap py-[13px] pe-5 ps-3.5">
        <Chip t={t} company={company} state={state} table={table} tip={tip} setTip={setTip} />
      </td>
    </>
  );
  return picked && tickable(state) ? <tr className="border-t border-border bg-accent-soft">{cells}</tr> : <tr className="border-t border-border">{cells}</tr>;
}

function NarrowRow({ t, company, state, picked, onPick, table, source, day }: RowProps): ReactNode {
  const site = websiteOf(company);
  const body = (
    <>
      <span className="flex size-11 shrink-0 items-center justify-center">{hasTickBox(state) ? <Checkbox checked={picked && tickable(state)} disabled={!tickable(state)} onCheckedChange={onPick} aria-label={t('find.tickOne', 'Tick {name}', { name: company.name })} /> : null}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-1 py-3.5 pe-4">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-bold">
            <Value>{company.name}</Value>
          </span>
          <Chip t={t} company={company} state={state} table={table} />
        </span>
        <span className="text-[12.5px] text-fg-muted">
          <Value>{company.activity?.label ?? '—'}</Value> · <Value>{company.address?.town ?? '—'}</Value>
        </span>
        {company.number === undefined ? null : <Fixed>{company.number}</Fixed>}
        {site === null ? null : (
          <a href={site.href} target="_blank" rel="noopener noreferrer" dir="ltr" className="font-mono text-[12px] text-accent">
            {site.shown}
          </a>
        )}
        {state === 'sole' ? <span className="text-[12px] text-fg-muted">{addReasonWords(t, company.blocked?.reason ?? 'sole-trader')}</span> : null}
        <span className="text-[11.5px] text-fg-muted">
          {t('find.foundIn', 'Found in {source}', { source })} · <span className="font-mono">{day}</span>
        </span>
      </span>
    </>
  );
  return picked && tickable(state) ? <li className="flex items-start gap-0.5 border-t border-border bg-accent-soft ps-1">{body}</li> : <li className="flex items-start gap-0.5 border-t border-border ps-1">{body}</li>;
}
