/**
 * "FILL IN DETAILS": the sheet a company's record opens (comps 2f, 2g, 2h,
 * 2i; Lead Finder 2a–2e; phone 6e). The `record.actions` fill's content.
 *
 * Nothing is fetched until "Look up"; "Stop" ends it at once. Adminium reads
 * the company's own website (when the website reader is on) and asks the
 * register chosen; the sheet shows what each found against what the record
 * holds now, ticked, and nothing changes until "Fill in ticked" or "Fill in
 * all". Several companies by that name: "Which one is it?", and "Use this
 * one" asks the register again by the chosen one's number. A detail somebody
 * changed after the look-up refuses the fill as a whole.
 *
 * With people kept and a Hunter key: "People at {domain}", "Find people",
 * and "Keep ticked people": each one kept is told at once.
 *
 * The host hands the sheet `{ table, rowKey, row, grants, close }`: the
 * record as this reader sees it. Every read and write goes through the lead
 * door, as the person; the sheet writes nothing itself.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';

import { doorRefusal, keepReasonWords, sourceRefusal, websiteWords } from '../shared/codes.ts';
import { longDay, shortDay } from '../shared/dates.ts';
import { door, isStopped, peopleOn as readPeopleOn, readKit, sources as sourceRoutes, type FoundView, type LeadField, type LookupReply, type PeopleReply, type SourceView } from '../shared/door.ts';
import { Button, Checkbox, Link, Select, asDataError, useLocaleTag, type AddOnTranslate } from '../shared/host.ts';
import { Icon, MicroTitle, Fixed, Note, Pill, SmallIcon, Spinning, Value } from '../shared/parts.tsx';
import { peopleSettingsAt, sourcesAt } from '../shared/paths.ts';
import { sourceRank, sourceWords } from '../shared/sourceWords.ts';
import { useToast } from '../shared/toast.ts';
import { firstTicks, mergeFields, rowsOf, type FieldRow } from './fields.ts';

/** What the host hands a `record.actions` fill. */
export interface RecordActionPayload {
  /** The record's table, as its app names it (`<app>:<ref>`). */
  table: string;
  rowKey: string;
  /** The record as this reader sees it. */
  row: Readonly<Record<string, unknown>>;
  grants: { update: boolean };
  close(): void;
}

interface Setup {
  registers: SourceView[];
  website: SourceView | null;
  hunter: SourceView | null;
  peopleOn: boolean | null;
  /** The record's own website and name and town, by the columns its table declares. */
  site: string | null;
  name: string;
  town: string | null;
}

type Phase = { kind: 'idle' } | { kind: 'reading'; register: string | null; host: string | null } | { kind: 'done'; reply: LookupReply; register: string | null; at: number } | { kind: 'stopped' };

type Pick = { kind: 'none' } | { kind: 'asking'; source: string; matches: FoundView[]; chosen: string | null } | { kind: 'refused-all'; source: string };

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : typeof value === 'number' ? String(value) : null);

/** A website as the host part only: "cobaltlegal.example". */
export function domainOf(site: string | null): string | null {
  if (site === null) return null;
  const host = site.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split(/[/?#]/)[0]?.toLowerCase() ?? '';
  return host === '' ? null : host.replace(/^www\./, '');
}

export function FillSheet({ t, payload }: { t: AddOnTranslate; payload: RecordActionPayload }): ReactNode {
  const locale = useLocaleTag();
  const toast = useToast();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [register, setRegister] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [pick, setPick] = useState<Pick>({ kind: 'none' });
  const [ticks, setTicks] = useState<ReadonlySet<LeadField>>(new Set());
  const [filling, setFilling] = useState(false);
  const [line, setLine] = useState('');
  const stop = useRef<AbortController | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [list, kit] = await Promise.all([sourceRoutes.list(), readKit()]);
      const host = kit.companies.find((one) => one.tableRef === payload.table || one.id === payload.table);
      const siteColumn = host?.lead.website ?? 'website';
      const townColumn = host?.lead.address?.['town'] ?? 'town';
      const sorted = [...list.sources].sort((a, b) => sourceRank(a.id) - sourceRank(b.id));
      const peopleOn = await readPeopleOn(kit).catch(() => null);
      if (!alive) return;
      const registers = sorted.filter((one) => !one.website && one.on && one.gives.includes('fill') && !one.gives.includes('people'));
      setSetup({
        registers,
        website: sorted.find((one) => one.website) ?? null,
        hunter: sorted.find((one) => one.gives.includes('people')) ?? null,
        peopleOn,
        site: text(payload.row[siteColumn]),
        name: text(payload.row['name']) ?? payload.rowKey,
        town: text(payload.row[townColumn]),
      });
      setRegister(registers[0]?.id ?? '');
    })().catch((caught: unknown) => {
      if (alive) setLine(doorRefusal(t, asDataError(caught)));
    });
    return () => {
      alive = false;
      stop.current?.abort();
    };
    // The record is read once per record: a host may hand a new `row` object on every draw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload.table, payload.rowKey, t]);

  const reply = phase.kind === 'done' ? phase.reply : null;
  const websiteId = setup?.website?.id ?? 'website';
  const rows = useMemo(() => (reply === null ? [] : rowsOf(reply.fields, websiteId)), [reply, websiteId]);

  if (!payload.grants.update) {
    return (
      <Note tone="quiet" icon="lock">
        {t('fill.readOnly', 'You may read this company, not change it.')}
      </Note>
    );
  }
  if (setup === null) {
    return line === '' ? (
      <span className="flex items-center gap-2 text-[13px] text-fg-muted">
        <Spinning />
        {t('shared.loading', 'Loading')}
      </span>
    ) : (
      <Note tone="danger" icon="circle-alert">
        {line}
      </Note>
    );
  }

  const readsSite = setup.website !== null && setup.website.on && setup.site !== null;
  const registerName = (id: string | null) => (id === null || id === '' ? '' : sourceWords(t, id).short);

  const ask = async (body: { sources: string[]; website: boolean; confirmedHost?: string; number?: string; name?: string; town?: string }, merge: LookupReply | null): Promise<LookupReply | null> => {
    stop.current?.abort();
    const controller = new AbortController();
    stop.current = controller;
    try {
      const answer = await door.lookup({ table: payload.table, record: payload.rowKey, ...body }, controller.signal);
      return merge === null ? answer : { ...answer, sources: [...merge.sources.filter((one) => !answer.sources.some((two) => two.source === one.source)), ...answer.sources], website: body.website ? answer.website : merge.website, fields: mergeFields(merge.fields, answer.fields) };
    } finally {
      if (stop.current === controller) stop.current = null;
    }
  };

  const shown = (answer: LookupReply, chosenRegister: string | null): void => {
    const next = rowsOf(answer.fields, websiteId);
    setTicks(firstTicks(next));
    setPhase({ kind: 'done', reply: answer, register: chosenRegister, at: Date.now() });
    const several = answer.sources.find((one) => one.outcome === 'several');
    setPick(several === undefined ? { kind: 'none' } : { kind: 'asking', source: several.source, matches: several.matches, chosen: null });
    setLine(several !== undefined ? t('fill.said.several', '{source} has several companies by this name.', { source: registerName(several.source) }) : t('fill.said.found', '{count, plural, =0 {Nothing new found.} one {# detail found.} other {# details found.}}', { count: next.length }));
  };

  const lookUp = (event?: FormEvent, confirmedHost?: string): void => {
    event?.preventDefault();
    const chosen = register === '' ? null : register;
    if (chosen === null && !readsSite) return;
    setPhase({ kind: 'reading', register: chosen, host: readsSite ? domainOf(setup.site) : null });
    setPick({ kind: 'none' });
    setLine(t('fill.said.reading', 'Looking up…'));
    ask({ sources: chosen === null ? [] : [chosen], website: readsSite, ...(confirmedHost === undefined ? {} : { confirmedHost }) }, null).then(
      (answer) => {
        if (answer !== null) shown(answer, chosen);
      },
      (caught: unknown) => {
        if (isStopped(caught)) return;
        setPhase({ kind: 'idle' });
        const said = doorRefusal(t, asDataError(caught));
        setLine(said);
        toast(said, 'error');
      },
    );
  };

  const stopNow = (): void => {
    stop.current?.abort();
    stop.current = null;
    setPhase({ kind: 'stopped' });
    setLine(t('fill.said.stopped', 'Stopped. Nothing was read.'));
  };

  /** A second question on top of the first answer: the website again, or the register by the chosen one. */
  const askAgain = (body: { sources: string[]; website: boolean; confirmedHost?: string; number?: string; name?: string; town?: string }): void => {
    if (phase.kind !== 'done') return;
    const before = phase.reply;
    const chosenRegister = phase.register;
    setPhase({ kind: 'reading', register: body.sources[0] ?? null, host: body.website ? (body.confirmedHost ?? domainOf(setup.site)) : null });
    ask(body, before).then(
      (answer) => {
        if (answer !== null) shown(answer, chosenRegister);
      },
      (caught: unknown) => {
        if (isStopped(caught)) return;
        setPhase({ kind: 'done', reply: before, register: chosenRegister, at: Date.now() });
        toast(doorRefusal(t, asDataError(caught)), 'error');
      },
    );
  };

  const useChosen = (): void => {
    if (pick.kind !== 'asking' || pick.chosen === null) return;
    const match = pick.matches.find((one) => one.ref === pick.chosen);
    if (match === undefined) return;
    askAgain({ sources: [pick.source], website: false, ...(match.number === undefined ? { name: match.name, ...(match.address?.town === undefined ? {} : { town: match.address.town }) } : { number: match.number }) });
  };

  const fill = async (only: readonly FieldRow[]): Promise<void> => {
    if (only.length === 0) return;
    setFilling(true);
    try {
      await door.fill({ table: payload.table, record: payload.rowKey, fields: only.map((row) => ({ field: row.field, source: row.source, now: row.now })) });
      toast(t('fill.filled', '{count, plural, one {# detail filled in.} other {# details filled in.}}', { count: only.length }));
      payload.close();
    } catch (caught) {
      const error = asDataError(caught);
      if (error.code === 'FIELD_CHANGED') {
        const details = (error.details ?? {}) as { field?: unknown; by?: unknown };
        const field = typeof details.field === 'string' ? fieldLabel(t, details.field as LeadField) : null;
        const by = typeof details.by === 'string' && details.by.trim() !== '' ? details.by : null;
        toast(
          field === null
            ? t('door.fieldChanged', 'A detail was changed after you looked. Look up again.')
            : by === null
              ? t('fill.changed', '{field} was changed after you looked. Look up again.', { field })
              : t('fill.changedBy', '{field} was changed by {name} after you looked. Look up again.', { field, name: by }),
          'error',
        );
      } else toast(doorRefusal(t, error), 'error');
    } finally {
      setFilling(false);
    }
  };

  const reading = phase.kind === 'reading';
  const ticked = rows.filter((row) => ticks.has(row.field));
  const allTicked = rows.length > 0 && ticked.length === rows.length;
  const day = phase.kind === 'done' ? longDay(phase.at, locale) : '';
  const chosenRegister = phase.kind === 'done' ? phase.register : null;
  const registerAnswer = reply?.sources.find((one) => one.source === chosenRegister) ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-4 pb-4">
        <p className="m-0 text-[12.5px] text-fg-muted">
          {t('fill.sub', '{name}. Nothing changes until you press Fill in.', { name: setup.name })}
        </p>
        <form onSubmit={lookUp} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-bold text-fg-muted">{t('fill.website', 'Website')}</span>
            <input type="url" dir="ltr" readOnly value={setup.site ?? ''} placeholder={t('fill.noWebsite', 'No website on this record')} className="h-11 min-w-0 rounded-[10px] border border-border-strong bg-surface-2 px-3 font-mono text-[12.5px] text-fg" />
          </label>
          {setup.registers.length > 0 ? (
            <Select label={t('fill.register', 'Register')} value={register} disabled={reading} onChange={(event) => setRegister(event.target.value)} options={setup.registers.map((one) => ({ value: one.id, label: sourceWords(t, one.id).name }))} />
          ) : (
            <span className="text-[12.5px] text-fg-muted">{t('fill.noRegister', 'No register is on. Turn one on in Sources.')}</span>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="secondary" disabled={reading || (register === '' && !readsSite)} iconLeft={<Icon name="search" />}>
              {t('fill.lookUp', 'Look up')}
            </Button>
            {reading ? (
              <Button variant="ghost" onClick={stopNow} iconLeft={<Icon name="square" />}>
                {t('fill.stop', 'Stop')}
              </Button>
            ) : null}
          </div>
        </form>

        <div role="status" aria-live="polite" className="sr-only">
          {line}
        </div>

        {reading ? (
          <div className="flex flex-col gap-2.5 rounded-[10px] border border-border bg-surface-2 px-4 py-3.5">
            {phase.host === null ? null : (
              <span className="flex items-center gap-[9px] text-[13px]">
                <Spinning />
                <span>{t('fill.reading', 'Reading {host}…', { host: phase.host })}</span>
              </span>
            )}
            {phase.register === null ? null : (
              <span className="flex items-center gap-[9px] text-[13px]">
                <Spinning />
                {t('fill.asking', 'Asking {source}…', { source: registerName(phase.register) })}
              </span>
            )}
          </div>
        ) : null}

        {phase.kind === 'stopped' ? (
          <Note tone="quiet" icon="circle-pause">
            {t('fill.said.stopped', 'Stopped. Nothing was read.')}
          </Note>
        ) : null}

        {reply !== null && reply.website !== null && reply.website.outcome !== 'read' ? (
          <WebsiteNote t={t} outcome={reply.website} onConfirm={(host) => askAgain({ sources: [], website: true, confirmedHost: host })} onRetry={() => askAgain({ sources: [], website: true })} />
        ) : null}

        {registerAnswer !== null && registerAnswer.outcome === 'none' ? (
          <Note tone="quiet" icon="landmark">
            {t('door.noMatch', '{source} has no company by this name.', { source: registerName(registerAnswer.source) })}
          </Note>
        ) : null}
        {registerAnswer !== null && registerAnswer.outcome === 'refused' ? (
          <Note tone="danger" icon="landmark">
            {sourceRefusal(t, { code: registerAnswer.code ?? 'UNAVAILABLE', message: registerAnswer.message ?? '' }, setup.registers.find((one) => one.id === registerAnswer.source), registerAnswer.source).message}
          </Note>
        ) : null}

        {pick.kind === 'asking' ? (
          <Picker
            t={t}
            name={setup.name}
            town={setup.town}
            source={registerName(pick.source)}
            matches={pick.matches}
            chosen={pick.chosen}
            onChoose={(ref) => setPick({ ...pick, chosen: ref })}
            onUse={useChosen}
            onNone={() => setPick({ kind: 'refused-all', source: pick.source })}
          />
        ) : null}
        {pick.kind === 'refused-all' ? (
          <Note tone="quiet" icon="landmark">
            {t('fill.noneOfThese', 'None of these. Nothing from {source} is filled in.', { source: registerName(pick.source) })}
          </Note>
        ) : null}

        {rows.length > 0 ? (
          <section aria-labelledby="lf-fill-found" className="flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <h3 id="lf-fill-found" className="m-0 flex-1 text-[14.5px] font-bold tracking-[-0.01em]">
                {t('fill.found', '{count, plural, one {# detail found} other {# details found}}', { count: rows.length })}
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setTicks(allTicked ? new Set() : new Set(rows.map((row) => row.field)))}>
                {allTicked ? t('fill.untickAll', 'Untick all') : t('fill.tickAll', 'Tick all')}
              </Button>
            </div>
            <ul className="m-0 flex flex-col gap-2 p-0">
              {rows.map((row) => (
                <FieldLine
                  key={row.field}
                  t={t}
                  row={row}
                  ticked={ticks.has(row.field)}
                  website={row.source === websiteId}
                  day={day}
                  onTick={(on) =>
                    setTicks((was) => {
                      const next = new Set(was);
                      if (on) next.add(row.field);
                      else next.delete(row.field);
                      return next;
                    })
                  }
                />
              ))}
            </ul>
          </section>
        ) : null}

        {setup.hunter !== null ? <PeopleAt t={t} payload={payload} setup={setup} hunter={setup.hunter} locale={locale} /> : null}
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-2.5 border-t border-border bg-surface-2 px-5 py-3.5">
        <span className="min-w-0 flex-1 basis-64 text-[12.5px] text-fg-muted">{t('fill.nothingYet', 'Nothing changes until you press Fill in.')}</span>
        <Button variant="secondary" disabled={ticked.length === 0 || filling} onClick={() => void fill(ticked)}>
          {t('fill.fillTicked', 'Fill in ticked ({count})', { count: ticked.length })}
        </Button>
        <Button variant="primary" disabled={rows.length === 0 || filling} loading={filling} onClick={() => void fill(rows)} iconLeft={<Icon name="check" />}>
          {t('fill.fillAll', 'Fill in all')}
        </Button>
      </div>
    </div>
  );
}

/** A detail's name, as the sheet labels its row. */
export function fieldLabel(t: AddOnTranslate, field: LeadField): string {
  switch (field) {
    case 'name':
      return t('fill.field.name', 'Registered name');
    case 'number':
      return t('fill.field.number', 'Company number');
    case 'website':
      return t('fill.field.website', 'Website');
    case 'phone':
      return t('fill.field.phone', 'Phone');
    case 'lines':
      return t('fill.field.lines', 'Address');
    case 'town':
      return t('fill.field.town', 'Town');
    case 'region':
      return t('fill.field.region', 'Region');
    case 'postalCode':
      return t('fill.field.postalCode', 'Postcode');
    case 'country':
      return t('fill.field.country', 'Country');
    case 'activity':
      return t('fill.field.activity', 'What they do');
    case 'about':
      return t('fill.field.about', 'About');
  }
}

const MONO_FIELDS: ReadonlySet<LeadField> = new Set(['number', 'website', 'phone', 'postalCode']);

function FieldLine({ t, row, ticked, website, day, onTick }: { t: AddOnTranslate; row: FieldRow; ticked: boolean; website: boolean; day: string; onTick: (on: boolean) => void }): ReactNode {
  const id = `lf-fill-${row.field}`;
  const label = fieldLabel(t, row.field);
  const body = (
    <>
      <span className="flex size-11 shrink-0 items-center justify-center">
        <Checkbox id={id} checked={ticked} onCheckedChange={onTick} aria-label={t('fill.tickOne', 'Fill in {field}', { field: label })} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-2 py-3 pe-3.5">
        <span className="text-[14px] font-bold">{label}</span>
        <span className="grid grid-cols-2 gap-3">
          <span className="flex min-w-0 flex-col gap-0.5">
            <MicroTitle>{t('fill.now', 'Now')}</MicroTitle>
            {MONO_FIELDS.has(row.field) ? <span className="text-[12.5px] text-fg-muted [overflow-wrap:anywhere]">{row.now === null ? '—' : <Fixed>{row.now}</Fixed>}</span> : <span className="text-[12.5px] text-fg-muted [overflow-wrap:anywhere]">{row.now === null ? '—' : <Value>{row.now}</Value>}</span>}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <MicroTitle>{t('fill.foundLabel', 'Found')}</MicroTitle>
            {MONO_FIELDS.has(row.field) ? (
              <span className="text-[13px] font-semibold [overflow-wrap:anywhere]">
                <Fixed>{row.found}</Fixed>
              </span>
            ) : (
              <span className="text-[13px] font-semibold [overflow-wrap:anywhere]">
                <Value>{row.found}</Value>
              </span>
            )}
          </span>
        </span>
        <span className="flex items-center gap-[5px] text-[11.5px] text-fg-subtle">
          {website ? <SmallIcon name="globe" /> : <SmallIcon name="landmark" />}
          {website ? t('fill.fromWebsite', 'The website’s home page') : sourceWords(t, row.source).short} · <span className="font-mono">{day}</span>
        </span>
      </span>
    </>
  );
  return ticked ? <li className="flex items-start gap-0.5 rounded-[10px] border border-accent bg-accent-soft">{body}</li> : <li className="flex items-start gap-0.5 rounded-[10px] border border-border bg-surface">{body}</li>;
}

function WebsiteNote({ t, outcome, onConfirm, onRetry }: { t: AddOnTranslate; outcome: NonNullable<LookupReply['website']>; onConfirm: (host: string) => void; onRetry: () => void }): ReactNode {
  const words = websiteWords(t, outcome.outcome, outcome.host);
  if (outcome.outcome === 'asks' && outcome.host !== null) {
    const host = outcome.host;
    return (
      <div className="flex flex-col gap-2.5 rounded-[10px] bg-info-soft px-3.5 py-3 text-[13px] text-info">
        <span className="flex items-start gap-2.5">
          <Icon name="external-link" />
          <span>{words}</span>
        </span>
        <span>
          <Button variant="secondary" size="sm" onClick={() => onConfirm(host)}>
            {t('fill.readThere', 'Read {host}', { host })}
          </Button>
        </span>
      </div>
    );
  }
  if (outcome.outcome === 'refused-by-site')
    return (
      <Note tone="warn" icon="shield-off">
        {words}
      </Note>
    );
  if (outcome.outcome === 'unreachable')
    return (
      <div className="flex flex-wrap items-center gap-2.5 rounded-[10px] bg-danger-soft px-3.5 py-3 text-[13px] font-semibold text-danger">
        <Icon name="wifi-off" />
        <span className="min-w-0 flex-1">{words}</span>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t('shared.retry', 'Try again')}
        </Button>
      </div>
    );
  return (
    <Note tone="quiet" icon="globe">
      {words}
    </Note>
  );
}

function Picker({ t, name, town, source, matches, chosen, onChoose, onUse, onNone }: { t: AddOnTranslate; name: string; town: string | null; source: string; matches: readonly FoundView[]; chosen: string | null; onChoose: (ref: string) => void; onUse: () => void; onNone: () => void }): ReactNode {
  return (
    <div role="radiogroup" aria-labelledby="lf-pick-q" className="flex flex-col gap-2.5 rounded-[14px] border border-border-strong bg-surface-2 p-4">
      <span className="flex items-start gap-[9px] text-info">
        <Icon name="landmark" />
        <h3 id="lf-pick-q" className="m-0 text-[13.5px] font-bold leading-normal text-fg">
          {t('fill.pick.question', '{source} has {count} companies called {name}. Which one is it?', { source, count: matches.length, name })}
        </h3>
      </span>
      {matches.map((match) => {
        const same = town !== null && (match.address?.town ?? '').trim().toLowerCase() === town.toLowerCase();
        const body = (
          <>
            <span className="flex size-11 shrink-0 items-center justify-center">
              <input type="radio" name="lf-pick" checked={chosen === match.ref} onChange={() => onChoose(match.ref)} className="size-4" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1 py-3 pe-3.5">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[13.5px] font-bold">
                  <Value>{match.name}</Value>
                </span>
                {same ? (
                  <Pill tone="info" icon="map-pin">
                    {t('fill.pick.sameTown', 'Same town as this record')}
                  </Pill>
                ) : null}
              </span>
              <span className="text-[12.5px] text-fg-muted">
                {match.number === undefined ? null : (
                  <>
                    <Fixed>{match.number}</Fixed> ·{' '}
                  </>
                )}
                <Value>{match.address?.town ?? '—'}</Value>
                {match.activity?.label === undefined ? null : (
                  <>
                    {' · '}
                    <Value>{match.activity.label}</Value>
                  </>
                )}
              </span>
            </span>
          </>
        );
        return chosen === match.ref ? (
          <label key={match.ref} className="flex cursor-pointer items-start gap-0.5 rounded-[10px] border border-accent bg-accent-soft">
            {body}
          </label>
        ) : (
          <label key={match.ref} className="flex cursor-pointer items-start gap-0.5 rounded-[10px] border border-border-strong bg-surface">
            {body}
          </label>
        );
      })}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button variant="primary" disabled={chosen === null} onClick={onUse}>
          {t('fill.pick.use', 'Use this one')}
        </Button>
        <Button variant="secondary" onClick={onNone}>
          {t('fill.pick.none', 'None of these')}
        </Button>
      </div>
    </div>
  );
}

type PeoplePhase = { kind: 'before' } | { kind: 'asking' } | { kind: 'list'; reply: PeopleReply; ticked: ReadonlySet<string> } | { kind: 'kept'; reply: PeopleReply; kept: ReadonlySet<string>; refused: ReadonlyMap<string, string> } | { kind: 'refused'; message: string; limit: boolean };

function PeopleAt({ t, payload, setup, hunter, locale }: { t: AddOnTranslate; payload: RecordActionPayload; setup: Setup; hunter: SourceView; locale: string }): ReactNode {
  const toast = useToast();
  const [phase, setPhase] = useState<PeoplePhase>({ kind: 'before' });
  const [keeping, setKeeping] = useState(false);
  const domain = domainOf(setup.site);
  const stop = useRef<AbortController | null>(null);
  useEffect(() => () => stop.current?.abort(), []);

  const title = (
    <span className="flex items-center gap-[9px]">
      <span className="text-fg-muted">
        <Icon name="users" />
      </span>
      <h3 id="lf-people-at" className="m-0 text-[14.5px] font-bold tracking-[-0.01em] [overflow-wrap:anywhere]">
        {t('fill.people.title', 'People at {domain}', { domain: domain ?? setup.name })}
      </h3>
    </span>
  );

  let body: ReactNode;
  if (setup.peopleOn === false) {
    body = (
      <div className="flex flex-wrap items-start gap-x-2.5 gap-y-2 rounded-[10px] bg-surface-3 px-3.5 py-3 text-[13px] text-fg-muted">
        <Icon name="user-x" />
        <span className="min-w-0 flex-1 basis-64">{t('door.peopleOff', 'Keeping people is off, so Lead finder fills in company details only.')}</span>
        <Link to={peopleSettingsAt()}>{t('fill.people.settings', 'People settings')}</Link>
      </div>
    );
  } else if (hunter.lastFour === null || hunter.verdict === 'refused' || !hunter.on) {
    body = (
      <Note tone="quiet" icon="key-round">
        {t('fill.people.noKey', 'Add a Hunter key in Sources to find people here.')} <Link to={sourcesAt()}>{t('shared.sources', 'Sources')}</Link>
      </Note>
    );
  } else if (hunter.dailyCap !== null && hunter.usedToday >= hunter.dailyCap) {
    body = (
      <Note tone="warn" icon="gauge">
        {t('fill.people.limit', 'Hunter: today’s limit of {count} look-ups is reached.', { count: hunter.dailyCap })}
      </Note>
    );
  } else if (domain === null) {
    body = (
      <Note tone="quiet" icon="globe">
        {t('door.noWebsite', 'This company has no website, so nobody can be looked for at it.')}
      </Note>
    );
  } else {
    const find = (): void => {
      setPhase({ kind: 'asking' });
      const controller = new AbortController();
      stop.current = controller;
      door.people({ table: payload.table, record: payload.rowKey, source: hunter.id }, controller.signal).then(
        (reply) => setPhase({ kind: 'list', reply, ticked: new Set(reply.people.filter((one) => one.note === null).map((one) => one.email)) }),
        (caught: unknown) => {
          if (isStopped(caught)) return;
          const error = asDataError(caught);
          const said = sourceRefusal(t, error, hunter, hunter.id);
          setPhase({ kind: 'refused', message: said.message, limit: said.kind === 'limit' });
        },
      );
    };
    const keep = async (reply: PeopleReply, ticked: ReadonlySet<string>): Promise<void> => {
      if (ticked.size === 0) return;
      setKeeping(true);
      try {
        const answer = await door.keep({ table: payload.table, record: payload.rowKey, source: hunter.id, emails: [...ticked] });
        const kept = new Set(answer.kept.map((one) => one.email));
        setPhase({ kind: 'kept', reply, kept, refused: new Map(answer.refused.map((one) => [one.email, one.reason])) });
        if (kept.size > 0) toast(t('fill.people.keptToast', '{count, plural, one {# person kept. Their mail is on the way.} other {# people kept. Their mails are on the way.}}', { count: kept.size }));
        if (answer.refused.length > 0) toast(t('fill.people.notKeptToast', '{count, plural, one {# person not kept: {why}} other {# people not kept. The first: {why}}}', { count: answer.refused.length, why: keepReasonWords(t, answer.refused[0]!.reason) }), 'error');
      } catch (caught) {
        toast(doorRefusal(t, asDataError(caught)), 'error');
      } finally {
        setKeeping(false);
      }
    };
    if (phase.kind === 'before')
      body = (
        <>
          <p className="m-0 text-[13px] leading-normal text-fg-muted">{t('fill.people.before', 'Hunter can look for people who work here. Each look-up counts against your Hunter account.')}</p>
          <span>
            <Button variant="secondary" onClick={find} iconLeft={<Icon name="user-search" />}>
              {t('fill.people.find', 'Find people')}
            </Button>
          </span>
        </>
      );
    else if (phase.kind === 'asking')
      body = (
        <span className="flex items-center gap-[9px] rounded-[10px] border border-border bg-surface-2 px-3.5 py-3 text-[13px]">
          <Spinning />
          {t('fill.people.asking', 'Asking Hunter…')}
        </span>
      );
    else if (phase.kind === 'refused')
      body = (
        <Note tone={phase.limit ? 'warn' : 'danger'} icon={phase.limit ? 'gauge' : 'circle-alert'}>
          {phase.message}
        </Note>
      );
    else {
      const reply = phase.reply;
      const listed = reply.people.filter((one) => one.note === null);
      const ticked = phase.kind === 'list' ? phase.ticked : new Set<string>();
      const toggle = (email: string, on: boolean) => {
        if (phase.kind !== 'list') return;
        const next = new Set(phase.ticked);
        if (on) next.add(email);
        else next.delete(email);
        setPhase({ ...phase, ticked: next });
      };
      body = (
        <>
          {listed.length === 0 ? <p className="m-0 text-[13px] text-fg-muted">{t('fill.people.none', 'Hunter found nobody here to keep.')}</p> : null}
          <ul className="m-0 flex flex-col gap-2 p-0">
            {listed.map((person) => (
              <PersonLine
                key={person.email}
                t={t}
                person={person}
                day={shortDay(Date.now(), locale)}
                state={phase.kind === 'kept' ? (phase.kept.has(person.email) ? 'kept' : phase.refused.has(person.email) ? 'refused' : 'left') : ticked.has(person.email) ? 'ticked' : 'open'}
                reason={phase.kind === 'kept' ? (phase.refused.get(person.email) ?? null) : null}
                onTick={(on) => toggle(person.email, on)}
              />
            ))}
          </ul>
          <ul className="m-0 flex flex-col gap-1.5 p-0">
            {reply.people
              .filter((one) => one.note === 'generic')
              .map((one) => (
                <li key={one.email} className="flex items-start gap-2 text-[12.5px] text-fg-muted">
                  <SmallIcon name="inbox" />
                  <span>{t('fill.people.generic', '{address} is a shared address, not a person.', { address: one.email })}</span>
                </li>
              ))}
            {reply.people
              .filter((one) => one.note === 'already-here')
              .map((one) => (
                <li key={one.email} className="flex items-start gap-2 text-[12.5px] text-fg-muted">
                  <SmallIcon name="user-check" />
                  <span>{t('fill.people.here', '{name} is already a contact.', { name: one.name })}</span>
                </li>
              ))}
            {reply.stopped > 0 ? (
              <li className="flex items-start gap-2 text-[12.5px] text-fg-muted">
                <SmallIcon name="mail-x" />
                <span>{t('fill.people.stopped', '{count, plural, one {# address is on the do-not-email list and is not kept.} other {# addresses are on the do-not-email list and are not kept.}}', { count: reply.stopped })}</span>
              </li>
            ) : null}
          </ul>
          {phase.kind === 'list' && listed.length > 0 ? (
            <>
              <Note tone="info" icon="mail">
                {t('fill.people.tell', 'Each person you keep gets a short mail at once: where we found their details, and how to object.')}
              </Note>
              <span>
                <Button variant="primary" size="lg" disabled={ticked.size === 0 || keeping} loading={keeping} onClick={() => void keep(reply, ticked)} iconLeft={<Icon name="user-plus" />}>
                  {t('fill.people.keep', 'Keep ticked people ({count})', { count: ticked.size })}
                </Button>
              </span>
            </>
          ) : null}
        </>
      );
    }
  }

  return (
    <section aria-labelledby="lf-people-at" className="flex flex-col gap-3 border-t border-border pt-[18px]">
      {title}
      <div className="flex flex-col gap-2.5">{body}</div>
    </section>
  );
}

function PersonLine({ t, person, day, state, reason, onTick }: { t: AddOnTranslate; person: PeopleReply['people'][number]; day: string; state: 'open' | 'ticked' | 'kept' | 'refused' | 'left'; reason: string | null; onTick: (on: boolean) => void }): ReactNode {
  const id = `lf-person-${person.email}`;
  const done = state === 'kept' || state === 'refused' || state === 'left';
  const body = (
    <>
      <span className="flex size-11 shrink-0 items-center justify-center">
        {done ? (
          <span className="text-fg-subtle">
            <Icon name="user-round" />
          </span>
        ) : (
          <Checkbox id={id} checked={state === 'ticked'} onCheckedChange={onTick} aria-label={t('fill.people.tickOne', 'Keep {name}', { name: person.name })} />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-3 pe-3.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] font-bold">
            <Value>{person.name}</Value>
          </span>
          {state === 'kept' ? <Pill tone="pos">{t('fill.people.kept', 'Kept')}</Pill> : null}
          {state === 'refused' || state === 'left' ? <Pill tone="neutral">{reason === null ? t('fill.people.notKept', 'Not kept') : t('fill.people.notKeptWhy', 'Not kept: {why}', { why: keepReasonWords(t, reason) })}</Pill> : null}
        </span>
        {person.role === null ? null : (
          <span className="text-[12.5px] text-fg-muted">
            <Value>{person.role}</Value>
          </span>
        )}
        <span className="[overflow-wrap:anywhere]">
          <Fixed>{person.email}</Fixed>
        </span>
        <span className="flex items-center gap-[5px] text-[11.5px] text-fg-subtle">
          <SmallIcon name="at-sign" />
          {sourceWords(t, 'hunter').short} · <span className="font-mono">{day}</span>
        </span>
      </span>
    </>
  );
  return state === 'ticked' ? <li className="flex items-start gap-0.5 rounded-[10px] border border-accent bg-accent-soft">{body}</li> : <li className="flex items-start gap-0.5 rounded-[10px] border border-border bg-surface">{body}</li>;
}
