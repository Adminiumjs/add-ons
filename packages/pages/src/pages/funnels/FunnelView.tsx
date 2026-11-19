/**
 * ONE FUNNEL (comp 5 and 8; the states 2c–2i).
 *
 * Its steps as cards with the views of each over a range of days, the share
 * that went on from the step before, and a note with the counting level; when
 * counting started inside the range, a line says so. At "Off" there is
 * nothing to count, and the cards keep their names with no number. Then "What
 * happens after": the rule linked to the funnel, its name and its steps,
 * "Open rule" only for someone who manages rules.
 *
 * The funnel's menu (Edit funnel, Delete funnel) and "Link a rule" show only
 * to someone who may change funnels.
 */
import { useEffect, useState, type ReactNode } from 'react';

import { readFunnelRule, type FunnelRule } from '../../engine.ts';
import {
  Alert,
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
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
  RadioCard,
  RadioGroup,
  Skeleton,
  api,
  asDataError,
  useAccess,
  useLocaleTag,
  useNavigate,
  useRecord,
  useRecords,
  useWrite,
  type AddOnTranslate,
} from '../shared/host.ts';
import { dayIn, dayWords, RANGES, rangeOf, rangeWords, startsInside, type RangeChoice } from '../shared/days.ts';
import { formInstallOf, useLanding } from '../shared/landing.tsx';
import { Address, Icon, MicroTitle, SmallIcon, WayIcon } from '../shared/parts.tsx';
import { ADD_ON, FUNNELS_TABLE, listAt, PAGES_TABLE, PRIVACY } from '../shared/paths.ts';
import { refusal } from '../shared/refusal.ts';
import { funnelRowOf, PAGE_LIST_COLUMNS, pageRowOf, type FunnelRow, type PageRow } from '../shared/rows.ts';
import { useToast } from '../shared/toast.ts';
import { barOf, cardsOf, countCards, percentOf, type Card, type Counted } from './count.ts';
import { FunnelDialog } from './FunnelDialog.tsx';
import { kindWords, levelWords, unitWords } from './words.ts';

/** Where the rules are, in Adminium's own screens: one rule opened by its id. */
export const ruleAt = (id: string): string => `/automations?rule=${encodeURIComponent(id)}`;

function rangeName(t: AddOnTranslate, choice: RangeChoice): string {
  switch (choice) {
    case 'this-month':
      return t('funnels.range.thisMonth', 'This month');
    case 'last-month':
      return t('funnels.range.lastMonth', 'Last month');
    case 'last-7':
      return t('funnels.range.last7', 'Last 7 days');
    case 'last-30':
      return t('funnels.range.last30', 'Last 30 days');
    case 'last-12-months':
      return t('funnels.range.last12', 'Last 12 months');
  }
}

export function FunnelView({ t, funnelKey }: { t: AddOnTranslate; funnelKey: string }): ReactNode {
  const navigate = useNavigate();
  const access = useAccess();
  const landing = useLanding();
  const locale = useLocaleTag();
  const toast = useToast();
  const write = useWrite(FUNNELS_TABLE);
  const [choice, setChoice] = useState<RangeChoice>('this-month');
  const [dates, setDates] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteSaid, setDeleteSaid] = useState<string | null>(null);
  const read = useRecord(FUNNELS_TABLE, funnelKey);
  const pagesRead = useRecords(PAGES_TABLE, { columns: PAGE_LIST_COLUMNS, pageSize: 199 });
  const pages: PageRow[] = pagesRead.rows.map(pageRowOf);
  const funnel: FunnelRow | null = read.row === null ? null : funnelRowOf(read.row);
  const mayChange = access.canUpdate(FUNNELS_TABLE);
  const range = rangeOf(choice, landing.today);
  const number = new Intl.NumberFormat(locale);

  const cards: Card[] = funnel === null ? [] : cardsOf(funnel.steps, new Map(pages.map((page) => [page.key, page])), landing.forms ?? []);
  const [counted, setCounted] = useState<Counted | null>(null);
  const [rule, setRule] = useState<FunnelRule | 'loading' | 'failed'>('loading');
  const cardsSignature = JSON.stringify(cards.map((card) => card.ask));
  const ready = landing.ready && !pagesRead.loading && funnel !== null;
  useEffect(() => {
    if (!ready) return;
    let live = true;
    setCounted(null);
    void countCards(api, cards, range, landing.pagesInstall, (form) => formInstallOf(landing, form)).then((done) => {
      if (live) setCounted(done);
    });
    return () => {
      live = false;
    };
    // The cards' asks, the range and the install are all the counts are read from.
  }, [ready, cardsSignature, range.from, range.to, landing.pagesInstall]);
  const ruleId = funnel?.ruleId ?? null;
  useEffect(() => {
    let live = true;
    if (ruleId === null) {
      setRule({ state: 'none' });
      return;
    }
    setRule('loading');
    readFunnelRule(api, ADD_ON, funnelKey).then(
      (found) => {
        if (live) setRule(found);
      },
      () => {
        if (live) setRule('failed');
      },
    );
    return () => {
      live = false;
    };
  }, [funnelKey, ruleId]);

  if (read.loading)
    return (
      <PageSurface padding="standard" width="wide">
        <Skeleton height={160} />
      </PageSurface>
    );
  if (funnel === null)
    return (
      <PageSurface padding="standard" width="wide">
        <PageActions title={t('funnels.title', 'Funnels')} documentTitle={t('funnels.title', 'Funnels')} backTo={listAt('funnels')} />
        <EmptyState title={t('funnels.missing', 'This funnel is not here any more')} actions={<Link to={listAt('funnels')}>{t('funnels.back', 'Back to the funnels')}</Link>} />
      </PageSurface>
    );

  const level = counted?.level ?? null;
  const counting = level !== 'off';
  const counts = counted?.counts ?? cards.map(() => null);
  const largest = Math.max(0, ...counts.map((count) => count ?? 0));
  const nothing = counted !== null && counting && cards.length > 0 && counts.every((count) => count === null || count === 0);
  const since = counted?.countingSince === null || counted?.countingSince === undefined ? null : dayIn(counted.countingSince, landing.zone);

  const remove = async (): Promise<void> => {
    try {
      await write.remove(funnel.key);
      toast(t('funnels.deleted', 'Funnel deleted.'));
      void navigate({ to: listAt('funnels') });
    } catch (caught) {
      setDeleteSaid(refusal(t, asDataError(caught)).message);
    }
  };

  return (
    <PageSurface padding="standard" width="wide">
      <PageActions title={funnel.name} subtitle={t('funnels.crumb', 'Landing pages / Funnels')} documentTitle={funnel.name} backTo={listAt('funnels')}>
        <Popover open={dates} onOpenChange={setDates}>
          <PopoverTrigger asChild>
            <Button variant="secondary" iconLeft={<Icon name="calendar" />} aria-label={t('funnels.range.button', 'Date range: {name}, {dates}', { name: rangeName(t, choice), dates: rangeWords(range, locale) })}>
              <span className="inline-flex items-center gap-2">
                {rangeName(t, choice)}
                <span className="font-mono font-semibold text-fg-muted">{rangeWords(range, locale)}</span>
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" aria-label={t('funnels.range.title', 'Date range')}>
            <span className="flex w-72 max-w-full flex-col gap-1">
              <MicroTitle>{t('funnels.range.title', 'Date range')}</MicroTitle>
              <RadioGroup
                value={choice}
                aria-label={t('funnels.range.title', 'Date range')}
                onValueChange={(value) => {
                  const picked = RANGES.find((one) => one === value);
                  if (picked !== undefined) setChoice(picked);
                  setDates(false);
                }}
              >
                {RANGES.map((one) => (
                  <RadioCard key={one} value={one} title={rangeName(t, one)} description={rangeWords(rangeOf(one, landing.today), locale)} />
                ))}
              </RadioGroup>
              {landing.status?.viewCountsMonths === null || landing.status?.viewCountsMonths === undefined ? null : (
                <span className="border-t border-border pt-2 text-[12px] text-fg-muted">{t('funnels.range.kept', '{months, plural, one {Counts are kept for # month.} other {Counts are kept for # months.}}', { months: landing.status.viewCountsMonths })}</span>
              )}
            </span>
          </PopoverContent>
        </Popover>
        {mayChange ? (
          <Menu
            label={t('funnels.menu', 'Funnel menu')}
            align="end"
            trigger={
              <IconButton variant="bordered" label={t('funnels.menu', 'Funnel menu')}>
                <Icon name="ellipsis" />
              </IconButton>
            }
          >
            <MenuItem icon={<SmallIcon name="pencil" />} onSelect={() => setEditing(true)}>
              {t('funnels.edit', 'Edit funnel')}
            </MenuItem>
            <MenuItem danger icon={<SmallIcon name="trash-2" />} onSelect={() => setDeleting(true)}>
              {t('funnels.delete', 'Delete funnel')}
            </MenuItem>
          </Menu>
        ) : null}
      </PageActions>

      <span className="flex flex-col gap-5">
        {counting && startsInside(since, range) && since !== null ? <Alert tone="info" title={t('funnels.started', 'Counting started on {day}. Days before that show nothing.', { day: dayWords(since, locale) })} /> : null}

        <section aria-labelledby="funnel-steps" className="flex flex-col gap-3">
          <h2 id="funnel-steps" className="m-0 text-[14.5px] font-bold tracking-[-0.01em]">
            {t('funnels.steps', 'Steps')}
          </h2>
          {cards.length === 0 ? (
            <p className="m-0 text-[13px] text-fg-muted">{t('funnels.noSteps', 'This funnel has no steps yet.')}</p>
          ) : (
            <ol className="m-0 flex list-none flex-col items-stretch gap-0 p-0 md:flex-row">
              {cards.map((card, i) => (
                <StepItem key={card.n} t={t} card={card} first={i === 0} counting={counting && counted !== null} count={counts[i] ?? null} percent={i === 0 ? null : percentOf(counts[i] ?? null, counts[i - 1] ?? null)} largest={largest} number={number} />
              ))}
            </ol>
          )}
          {counted !== null && !counting ? (
            <span className="flex flex-wrap items-center gap-3 rounded-[14px] border border-border bg-surface p-4 shadow-sm">
              <span className="flex size-9 items-center justify-center rounded-lg bg-surface-3 text-fg-muted">
                <Icon name="eye-off" />
              </span>
              <span className="flex-1 text-[13.5px] font-bold">{t('funnels.off', 'Counting is off, so there is nothing to show.')}</span>
              <Link to={PRIVACY}>{t('funnels.offLink', 'Visitor counting →')}</Link>
            </span>
          ) : null}
          {nothing ? <p className="m-0 text-[13px] text-fg-muted">{t('funnels.nothing', 'No views in this range yet.')}</p> : null}
          {counted !== null && counting ? (
            <p className="m-0 flex items-start gap-2 text-[12.5px] text-fg-muted">
              <span className="text-info">
                <SmallIcon name="info" />
              </span>
              <span>{t('funnels.note', 'Views, not people. Known bots are left out. Counting: {level}.', { level: levelWords(t, level) })}</span>
            </p>
          ) : null}
        </section>

        <section aria-labelledby="funnel-after" className="flex flex-col gap-3">
          <h2 id="funnel-after" className="m-0 text-[14.5px] font-bold tracking-[-0.01em]">
            {t('funnels.after', 'What happens after')}
          </h2>
          <After t={t} rule={rule} mayChange={mayChange} onLink={() => setEditing(true)} />
        </section>
      </span>

      {editing ? <FunnelDialog t={t} funnel={funnel} pages={pages} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} /> : null}
      {deleting ? (
        <Dialog open onOpenChange={(open) => (open ? undefined : setDeleting(false))} size="sm">
          <DialogHeader title={t('funnels.deleteTitle', 'Delete the funnel “{name}”?', { name: funnel.name })} closeLabel={t('shared.close', 'Close')} tone="danger" />
          <DialogBody>
            <span className="flex flex-col gap-2">
              <span className="text-[13px] text-fg-muted">{t('funnels.deleteBody', 'Its pages, forms and counts stay.')}</span>
              {deleteSaid === null ? null : (
                <span role="alert" className="text-[12.5px] text-danger">
                  {deleteSaid}
                </span>
              )}
            </span>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleting(false)}>
              {t('shared.cancel', 'Cancel')}
            </Button>
            <Button variant="destructive" iconLeft={<SmallIcon name="trash-2" />} onClick={() => void remove()}>
              {t('funnels.delete', 'Delete funnel')}
            </Button>
          </DialogFooter>
        </Dialog>
      ) : null}
    </PageSurface>
  );
}

/** One step's card, with the arrow from the step before drawn inside the item, so the list counts steps only. */
function StepItem({ t, card, first, counting, count, percent, largest, number }: { t: AddOnTranslate; card: Card; first: boolean; counting: boolean; count: number | null; percent: string | null; largest: number; number: Intl.NumberFormat }): ReactNode {
  const unit = unitWords(t, card.unit, count);
  const title = card.removed ? t('funnels.removed', 'Removed') : card.title;
  const shownCount = count === null ? '—' : number.format(count);
  const label = card.removed
    ? t('funnels.stepRemoved', 'Step {n}: {title}, removed', { n: card.n, title: kindWords(t, card.kind) })
    : counting
      ? t('funnels.stepCounted', 'Step {n}: {title}, {count} {unit}', { n: card.n, title, count: shownCount, unit })
      : t('funnels.stepNamed', 'Step {n}: {title}', { n: card.n, title });
  const width = barOf(count, largest);
  return (
    <li aria-label={label} className="flex min-w-0 flex-1 flex-col md:flex-row">
      {first ? null : (
        <span aria-hidden="true" className="flex shrink-0 items-center justify-center gap-2 py-2 md:flex-col md:px-3">
          <span className="hidden text-fg-subtle md:flex">
            <WayIcon name="arrow-right" />
          </span>
          <span className="inline-flex text-fg-subtle md:hidden">
            <Icon name="arrow-down" />
          </span>
          {counting ? (
            <>
              <span className="inline-flex h-[22px] items-center rounded-full bg-surface-3 px-2 font-mono text-[12px] font-bold">{percent ?? '—'}</span>
              <span className="text-[11.5px] text-fg-muted">{t('funnels.wentOn', 'went on')}</span>
            </>
          ) : null}
        </span>
      )}
      {card.removed ? (
        <span className="flex min-w-0 flex-1 flex-col gap-2 rounded-[14px] border border-dashed border-border-strong bg-surface-2 p-4 text-fg-muted">
          <span className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-surface-3 font-mono text-[11.5px] font-bold">{card.n}</span>
            <MicroTitle>{kindWords(t, card.kind)}</MicroTitle>
          </span>
          <span className="text-[13px] font-bold text-fg">{t('funnels.removed', 'Removed')}</span>
          <span className="text-[12px]">{card.kind === 'page' ? t('funnels.removedPageLine', 'This page was deleted.') : t('funnels.removedFormLine', 'This form was removed or is no longer live.')}</span>
        </span>
      ) : (
        <span className="flex min-w-0 flex-1 flex-col gap-2 rounded-[14px] border border-border bg-surface p-4 shadow-sm">
          <span className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-surface-3 font-mono text-[11.5px] font-bold">{card.n}</span>
            <span className="min-w-0 flex-1">
              <MicroTitle>{kindWords(t, card.kind)}</MicroTitle>
            </span>
            {card.off ? <span className="whitespace-nowrap rounded-full bg-surface-3 px-2 text-[11.5px] font-bold text-fg-muted">{t('shared.state.off', 'Off')}</span> : null}
          </span>
          <h3 className="m-0 text-[14px] font-bold leading-[1.35]">{card.title}</h3>
          {card.sub === null ? null : card.sub.kind === 'address' ? (
            <Address>{card.sub.path}</Address>
          ) : (
            <span className="text-[11.5px] text-fg-muted">{card.sub.kind === 'on' ? t('funnels.onPage', 'On {page}', { page: card.sub.page }) : t('funnels.ownPage', 'On its own page')}</span>
          )}
          {counting ? (
            <>
              <span className="mt-1.5 flex items-baseline gap-1.5">
                <span className="font-mono text-[26px] font-bold tracking-[-0.02em]">{shownCount}</span>
                <span className="text-[12.5px] text-fg-muted">{unit}</span>
              </span>
              <Bar width={width} />
            </>
          ) : null}
        </span>
      )}
    </li>
  );
}

/**
 * A count's bar against the largest: a line drawn to its length in the bar's
 * own units, so no width is written while the screen runs.
 */
function Bar({ width }: { width: number }): ReactNode {
  return (
    <svg aria-hidden="true" viewBox="0 0 100 6" preserveAspectRatio="none" className="block h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
      {width === 0 ? null : <rect x="0" y="0" width={width} height="6" rx="3" className="fill-accent" />}
    </svg>
  );
}

/** "What happens after": nothing linked, a rule that was removed, or the rule's name and steps (comp 2c, 2g). */
function After({ t, rule, mayChange, onLink }: { t: AddOnTranslate; rule: FunnelRule | 'loading' | 'failed'; mayChange: boolean; onLink: () => void }): ReactNode {
  const navigate = useNavigate();
  if (rule === 'loading') return <Skeleton height={72} />;
  const link = mayChange ? (
    <Button variant="secondary" iconLeft={<SmallIcon name="link" />} onClick={onLink}>
      {t('funnels.link', 'Link a rule')}
    </Button>
  ) : null;
  if (rule === 'failed' || rule.state !== 'linked')
    return (
      <span className="flex flex-wrap items-center gap-3 rounded-[14px] border border-border bg-surface p-4 shadow-sm">
        <span className="flex size-9 items-center justify-center rounded-lg bg-surface-3 text-fg-muted">
          <Icon name="workflow" />
        </span>
        <span className="flex-1 text-[13.5px] font-bold">{rule === 'failed' ? t('funnels.ruleFailed', 'The linked rule could not be read.') : rule.state === 'removed' ? t('funnels.ruleRemoved', 'The linked rule was deleted.') : t('funnels.noRule', 'No rule linked.')}</span>
        {link}
      </span>
    );
  return (
    <span className="flex flex-col gap-3.5 rounded-[14px] border border-border bg-surface p-4 shadow-sm">
      <span className="flex flex-wrap items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <Icon name="workflow" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[14px] font-bold">{rule.name}</span>
          <span className="text-[11.5px] text-fg-muted">{t('funnels.linked', 'Rule linked to this funnel')}</span>
        </span>
        {rule.canOpen && rule.id !== null ? (
          <Button variant="secondary" onClick={() => void navigate({ to: ruleAt(rule.id as string) })}>
            <span className="inline-flex items-center gap-2">
              {t('funnels.openRule', 'Open rule')}
              <WayIcon name="arrow-right" />
            </span>
          </Button>
        ) : null}
      </span>
      {rule.chips.length === 0 ? null : (
        <ol aria-label={t('funnels.ruleSteps', '{name} steps', { name: rule.name })} className="m-0 flex list-none flex-wrap items-center gap-2 p-0">
          {rule.chips.map((chip, i) => (
            <li key={`${String(i)}:${chip.words}`} className="inline-flex items-center gap-2">
              {i === 0 ? null : (
                <span aria-hidden="true" className="inline-flex text-fg-subtle">
                  <WayIcon name="arrow-right" />
                </span>
              )}
              <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-[12.5px] font-semibold">
                {chip.icon === null ? null : (
                  <span className="text-fg-muted">
                    <SmallIcon name={chip.icon} />
                  </span>
                )}
                {chip.words}
              </span>
            </li>
          ))}
        </ol>
      )}
    </span>
  );
}
