/**
 * ONE CALENDAR ADD-ON'S PAGE: what it does, the two status cards, and everyone
 * connected through it, each with their calendars, busy count and "Disconnect".
 * Drawn from `Calendars and Embeds`, part 1. Its guide is `Guide.tsx`, opened at
 * `#guide` so the browser's back button returns here.
 *
 * Every figure is read: nothing here is typed in. Each action goes through the
 * engine's own route, which asks this person's grants again.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { Guide } from './Guide.tsx';
import { Alert, Button, Checkbox, Input, Modal, ModalBody, ModalFooter, ModalHeader, PageActions, PageSurface, Skeleton, Switch, api, card, dotStyle, lucideByName, mono, muted, pillStyle, subtle, useLocaleTag, well, type Tone } from './kit.ts';
import { addCalendarProblem, countsOf, dayAfter, firstNameOf, initialsOf, instantCard, secretNotice, setupCard, splitPeople, type InstallInfo, type InstantCard, type Person, type SetupCard } from './model.ts';
import type { CalendarProviderScreen } from './provider.ts';
import { fill, wordsFor, type WordKey, type Words } from './words/index.ts';

interface RowState {
  state: string;
  lastSyncedAt: number | null;
  readCalendars: string[] | null;
  countAllDay: boolean;
  traits: { listsCalendars: boolean; allDayKnown: boolean; busyPush: boolean } | null;
  calendars: { id: string; name: string; primary: boolean; writable: boolean }[] | null;
}

const SETUP: Record<SetupCard, { tone: Tone; pill: WordKey; line: WordKey; primary: boolean }> = {
  'not-set-up': { tone: 'neutral', pill: 'pillNotSetUp', line: 'setupNot', primary: true },
  almost: { tone: 'warn', pill: 'pillAlmost', line: 'setupAlmost', primary: false },
  ready: { tone: 'pos', pill: 'pillReady', line: 'setupReady', primary: false },
  refused: { tone: 'danger', pill: 'pillRefused', line: 'setupRefused', primary: true },
  'keys-lost': { tone: 'danger', pill: 'pillKeysLost', line: 'setupKeysLost', primary: true },
};

const INSTANT: Record<InstantCard, { tone: Tone; pill: WordKey; line: WordKey; two?: WordKey }> = {
  waiting: { tone: 'neutral', pill: 'pillWaiting', line: 'instantWaiting' },
  on: { tone: 'pos', pill: 'pillOn', line: 'instantOn' },
  polling: { tone: 'warn', pill: 'pillPolling', line: 'instantPolling', two: 'instantPollingTwo' },
  cannot: { tone: 'danger', pill: 'pillCannot', line: 'instantCannot' },
};

function Pill({ tone, children }: { tone: Tone; children: ReactNode }): ReactNode {
  return (
    <span style={pillStyle(tone)}>
      <span style={dotStyle(tone)} />
      {children}
    </span>
  );
}

function Glyph({ name, size = 16 }: { name: string; size?: number }): ReactNode {
  const Of = lucideByName(name);
  return Of ? <Of size={size} aria-hidden /> : null;
}

function StatusCard({ icon, title, tone, pill, children }: { icon: string; title: string; tone: Tone; pill: string; children: ReactNode }): ReactNode {
  return (
    <section style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--surface-3)', color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Glyph name={icon} />
        </span>
        <h2 style={{ fontSize: 14, fontWeight: 700, flex: 1, minWidth: 140, margin: 0 }}>{title}</h2>
        <Pill tone={tone}>{pill}</Pill>
      </div>
      {children}
    </section>
  );
}

const pathOf = (key: string, tail: string) => `/api/v1/add-ons/${key}/connect/${tail}`;
const rowQuery = (person: Person, more: Record<string, string> = {}) => new URLSearchParams({ connection: person.connection, table: person.table, row: person.row, ...more }).toString();
const rowBody = (person: Person) => ({ connection: person.connection, table: person.table, row: person.row });

function errorCode(error: unknown): string | null {
  const details = (error as { details?: { reason?: unknown } } | null)?.details;
  return typeof details?.reason === 'string' ? details.reason : null;
}

function usePage(screen: CalendarProviderScreen) {
  const [info, setInfo] = useState<InstallInfo | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [failed, setFailed] = useState<'load' | 'forbidden' | null>(null);
  const load = useCallback(async () => {
    try {
      const [install, list] = await Promise.all([api.get<InstallInfo>(pathOf(screen.key, 'accounts')), api.get<{ people: Person[] }>(pathOf(screen.key, 'people'))]);
      setInfo(install);
      setPeople(list.people);
      setFailed(null);
    } catch (error) {
      setFailed((error as { status?: number }).status === 403 ? 'forbidden' : 'load');
    }
  }, [screen.key]);
  useEffect(() => {
    void load();
  }, [load]);
  return { info, people, failed, load };
}

export function CalendarPage({ screen }: { screen: CalendarProviderScreen }): ReactNode {
  const locale = useLocaleTag();
  const w = wordsFor(locale);
  const { info, people, failed, load } = usePage(screen);
  const [guide, setGuide] = useState(() => window.location.hash === '#guide');
  const [said, setSaid] = useState<string | null>(null);
  const [invite, setInvite] = useState(false);

  useEffect(() => {
    const follow = (): void => setGuide(window.location.hash === '#guide');
    window.addEventListener('hashchange', follow);
    return () => window.removeEventListener('hashchange', follow);
  }, []);

  if (failed !== null) {
    return (
      <PageSurface width="content">
        <PageActions title={screen.product} documentTitle={screen.product} />
        <Alert tone={failed === 'forbidden' ? 'info' : 'danger'} title={failed === 'forbidden' ? w.noPermission : w.loadFailed} />
        {failed === 'load' ? <div style={{ marginTop: 12 }}><Button variant="secondary" onClick={() => void load()}>{w.retry}</Button></div> : null}
      </PageSurface>
    );
  }
  if (info === null) {
    return (
      <PageSurface width="content">
        <Skeleton height={120} />
      </PageSurface>
    );
  }
  if (guide) {
    return (
      <Guide
        screen={screen}
        w={w}
        info={info}
        onSaved={() => void load()}
        onBack={() => {
          window.location.hash = '';
          setGuide(false);
        }}
        onConnectMine={() => {
          window.location.hash = '';
          setGuide(false);
          setInvite(true);
        }}
      />
    );
  }

  const company = screen.company;
  const setup = SETUP[setupCard(info)];
  const instant = INSTANT[instantCard(info)];
  const notice = secretNotice(info.secretEndsOn, Date.now());
  const date = info.secretEndsOn === null ? '' : formatDay(info.secretEndsOn, locale);
  const counts = countsOf(people);
  const { connected, invite: invitable } = splitPeople(people);
  const canInvite = info.registered && info.reach !== 'cannot-connect' && info.install === 'ready';
  const lines = [fill(w.whatOne, { company }), w.whatTwo, w.whatThree];

  return (
    <PageSurface width="content">
      <PageActions title={screen.product} documentTitle={screen.product} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Glyph name={screen.icon} size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 4, margin: 0, padding: 0, listStyle: 'none' }}>
              {lines.map((line) => (
                <li key={line} style={{ display: 'flex', gap: 9, fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.5 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--fg-subtle)', flexShrink: 0, marginTop: 8 }} />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <p style={subtle}>{fill(w.notAffiliated, { company })}</p>
          </div>
        </div>

        {info.redirectMoved ? <Alert tone="warn" title={fill(w.redirectMoved, { company })} /> : null}
        {notice.kind === 'soon' ? <Alert tone="warn" title={fill(w.secretSoon, { company, days: notice.days, date })} /> : null}
        {notice.kind === 'past' ? <Alert tone="danger" title={fill(w.secretPast, { company, date })} /> : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 14 }}>
          <StatusCard icon="key-round" title={fill(w.setupTitle, { company })} tone={setup.tone} pill={w[setup.pill]}>
            <p style={muted}>{fill(w[setup.line], { company })}</p>
            <div>
              <Button variant={setup.primary ? 'primary' : 'secondary'} size="sm" onClick={() => { window.location.hash = 'guide'; setGuide(true); }}>
                {info.registered ? w.reviewSetup : w.openGuide}
              </Button>
            </div>
          </StatusCard>
          <StatusCard icon="zap" title={w.instantTitle} tone={instant.tone} pill={w[instant.pill]}>
            <p style={muted}>{fill(w[instant.line], { company })}</p>
            {instant.two === undefined ? null : <p style={subtle}>{w[instant.two]}</p>}
          </StatusCard>
        </div>

        {said === null ? null : (
          <div role="status" style={{ padding: '8px 12px', borderRadius: 10, background: 'var(--surface-3)', fontSize: 12.5 }}>
            {said}
          </div>
        )}

        <section aria-labelledby="calendar-accounts" style={{ ...card, padding: 0, gap: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12, padding: 20 }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 8px' }}>
                <h2 id="calendar-accounts" style={{ fontSize: 14.5, fontWeight: 700, margin: 0 }}>{w.accountsTitle}</h2>
                <span style={{ ...mono, fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 6, background: 'var(--surface-3)', color: 'var(--fg-muted)', whiteSpace: 'nowrap' }}>
                  {counts.reconnect > 0 ? fill(w.countBoth, counts) : fill(w.countConnected, counts)}
                </span>
              </div>
              <p style={{ ...muted, marginTop: 3 }}>{w.accountsNote}</p>
            </div>
            <Button variant="secondary" size="sm" aria-expanded={invite} disabled={!canInvite} onClick={() => setInvite(!invite)}>
              <Glyph name="mail" size={15} />
              {w.sendToMember}
            </Button>
          </div>
          {!canInvite ? <p style={{ ...subtle, padding: '0 20px 14px' }}>{fill(w.inviteNeedsSetup, { company })}</p> : null}
          {invite && canInvite ? <InvitePanel screen={screen} w={w} people={invitable} /> : null}
          {connected.length === 0 ? (
            <div style={{ borderTop: '1px solid var(--border)', padding: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>{w.nobodyYet}</p>
              <p style={{ ...muted, marginTop: 3 }}>{w.nobodyNote}</p>
            </div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {connected.map((person) => (
                <AccountRow key={`${person.table}:${person.row}`} screen={screen} w={w} locale={locale} person={person} onChanged={() => void load()} onSaid={setSaid} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageSurface>
  );
}

function formatDay(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`));
}

const formatStamp = (at: number, locale: string): string => new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(at));
const formatTime = (at: number, locale: string): string => new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(new Date(at));

function Avatar({ person }: { person: Person }): ReactNode {
  return (
    <div aria-hidden style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface-3)', color: 'var(--fg)', fontWeight: 700, fontSize: 12.5, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {initialsOf(person.name, person.address)}
    </div>
  );
}

function SendLink({ w, person, primary = true }: { w: Words; person: Person; primary?: boolean }): ReactNode {
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'copied'>('idle');
  const [error, setError] = useState<string | null>(null);
  const copy = person.address === null;
  const press = async (): Promise<void> => {
    setState('busy');
    setError(null);
    try {
      const answer = await api.post<{ url: string | null }>('/api/v1/connected-accounts/link', { ...rowBody(person), ...(copy ? { copy: true } : {}) });
      if (copy && answer.url !== null) {
        await navigator.clipboard.writeText(answer.url);
        setState('copied');
      } else setState('sent');
    } catch (failure) {
      setState('idle');
      setError(errorCode(failure) === 'MAIL_OFF' ? w.mailOff : w.linkFailed);
    }
  };
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
      <Button variant={state === 'sent' || state === 'copied' || !primary ? 'secondary' : 'primary'} size="sm" disabled={state === 'busy'} onClick={() => void press()}>
        {state === 'sent' ? w.linkSent : state === 'copied' ? w.linkCopied : copy ? w.copyLink : w.sendLink}
      </Button>
      {copy && state === 'idle' ? <span style={subtle}>{w.noAddress}</span> : null}
      {error === null ? null : <span role="alert" style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)' }}>{error}</span>}
    </span>
  );
}

function InvitePanel({ screen, w, people }: { screen: CalendarProviderScreen; w: Words; people: readonly Person[] }): ReactNode {
  const [error, setError] = useState(false);
  const here = async (person: Person): Promise<void> => {
    setError(false);
    try {
      const { url } = await api.post<{ url: string }>('/api/v1/connected-accounts/connect', { ...rowBody(person), addOn: screen.key });
      window.location.assign(url);
    } catch {
      setError(true);
    }
  };
  return (
    <div style={{ ...well, margin: '0 20px 20px', background: 'var(--surface-2)' }}>
      <p style={muted}>{fill(w.inviteNote, { company: screen.company })}</p>
      {people.length === 0 ? <p style={subtle}>{w.inviteNone}</p> : null}
      {people.map((person) => (
        <div key={`${person.table}:${person.row}`} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Avatar person={person} />
          <span style={{ flex: 1, minWidth: 120, fontSize: 13, fontWeight: 700 }}>{person.name ?? person.address}</span>
          <Button variant="ghost" size="sm" onClick={() => void here(person)}>{w.connectHere}</Button>
          <SendLink w={w} person={person} />
        </div>
      ))}
      {error ? <p role="alert" style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)', margin: 0 }}>{w.errSelfLink}</p> : null}
    </div>
  );
}

function AccountRow({ screen, w, locale, person, onChanged, onSaid }: { screen: CalendarProviderScreen; w: Words; locale: string; person: Person; onChanged: () => void; onSaid: (text: string) => void }): ReactNode {
  const [open, setOpen] = useState(false);
  const account = person.account!;
  const name = person.name ?? person.address ?? '';
  const first = firstNameOf(person);
  const company = screen.company;
  const since = formatStamp(account.since, locale);
  const needs = account.state === 'reconnect' || account.state === 'partial';
  const tone: Tone = account.state === 'connected' ? 'pos' : account.state === 'connecting' ? 'neutral' : account.state === 'setup' ? 'danger' : 'warn';
  const status =
    account.state === 'connected' ? w.stateConnected
    : account.state === 'connecting' ? w.stateConnecting
    : account.state === 'partial' ? w.statePartial
    : account.state === 'setup' ? w.stateSetup
    : fill(w.stateReconnect, { date: since });
  const lastSynced = person.lastSyncedAt === null ? null : fill(w.lastSynced, { when: isToday(person.lastSyncedAt) ? formatTime(person.lastSyncedAt, locale) : formatStamp(person.lastSyncedAt, locale) });
  return (
    <li style={{ borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px 12px', padding: '12px 20px' }}>
        <Avatar person={person} />
        <div style={{ flex: 1, minWidth: 170 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>{name}</div>
          <div dir="ltr" style={{ ...mono, fontSize: 12, color: 'var(--fg-muted)', overflowWrap: 'anywhere', textAlign: 'start', unicodeBidi: 'isolate' }}>{account.address ?? person.address}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
          <Pill tone={tone}>{status}</Pill>
          {lastSynced !== null && !needs ? <span style={{ fontSize: 11.5, color: 'var(--fg-subtle)' }}>{lastSynced}</span> : null}
        </div>
        {needs ? <SendLink w={w} person={person} /> : null}
        <Button variant="secondary" size="sm" aria-expanded={open} aria-label={fill(open ? w.hideDetails : w.showDetails, { name })} onClick={() => setOpen(!open)}>
          <span style={{ display: 'flex', transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }}>
            <Glyph name="chevron-down" />
          </span>
        </Button>
      </div>
      {open ? <AccountDetail screen={screen} w={w} person={person} first={first} name={name} needs={needs} since={since} company={company} locale={locale} onChanged={onChanged} onSaid={onSaid} /> : null}
    </li>
  );
}

const isToday = (at: number): boolean => new Date(at).toDateString() === new Date().toDateString();

function AccountDetail({ screen, w, person, first, name, needs, since, company, locale, onChanged, onSaid }: { screen: CalendarProviderScreen; w: Words; person: Person; first: string; name: string; needs: boolean; since: string; company: string; locale: string; onChanged: () => void; onSaid: (text: string) => void }): ReactNode {
  const account = person.account!;
  const [state, setState] = useState<RowState | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [synced, setSynced] = useState<'idle' | 'done' | 'failed'>('idle');
  const [asking, setAsking] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const read = useCallback(async () => {
    const now = Date.now();
    const [row, spans] = await Promise.all([
      api.get<{ calendar: RowState | null }>(`/api/v1/calendar-sync/row?${rowQuery(person)}`),
      api.get<{ busy: unknown[] }>(`/api/v1/calendar-sync/busy?${rowQuery(person, { from: dayAfter(now, 0), to: dayAfter(now, 14) })}`),
    ]);
    setState(row.calendar);
    setBusy(spans.busy.length);
  }, [person]);

  useEffect(() => {
    read().catch(() => setFailed(true));
  }, [read]);

  const choose = async (body: { readCalendars?: string[] | null; countAllDay?: boolean }): Promise<boolean> => {
    try {
      await api.post('/api/v1/calendar-sync/row/choices', { ...rowBody(person), ...body });
      await read();
      return true;
    } catch {
      return false;
    }
  };

  const reading = state?.readCalendars ?? ['primary'];
  const listed = state?.traits?.listsCalendars === true;
  // A calendar the service lists by name; otherwise the main one, plus ids typed by hand.
  const rows = listed
    ? (state?.calendars ?? []).filter((one) => one.writable || reading.includes(one.id)).map((one) => ({ id: one.primary ? 'primary' : one.id, name: one.primary ? w.mainCalendar : one.name, sub: one.primary ? (account.address ?? '') : '' }))
    : [...new Set(['primary', ...reading])].map((id) => ({ id, name: id === 'primary' ? w.mainCalendar : w.addedCalendar, sub: id === 'primary' ? (account.address ?? '') : id }));

  const toggle = async (id: string, on: boolean): Promise<void> => {
    const next = on ? [...new Set([...reading, id])] : reading.filter((one) => one !== id);
    if (next.length === 0) return;
    await choose({ readCalendars: next });
  };

  const addCalendar = async (): Promise<void> => {
    const wrong = addCalendarProblem(value, rows.map((one) => one.id));
    if (wrong !== null) {
      setProblem(wrong === 'empty' ? w.addEmpty : wrong === 'spaces' ? w.addSpaces : w.addAlready);
      return;
    }
    if (await choose({ readCalendars: [...new Set([...reading, value.trim()])] })) {
      setAdding(false);
      setValue('');
      setProblem(null);
    } else setProblem(w.addFailed);
  };

  const syncNow = async (): Promise<void> => {
    try {
      await api.post('/api/v1/calendar-sync/row/sync-now', rowBody(person));
      setSynced('done');
      onChanged();
    } catch {
      setSynced('failed');
    }
  };

  const disconnect = async (): Promise<void> => {
    setLeaving(true);
    try {
      const ended = await api.post<{ incomplete: boolean }>('/api/v1/connected-accounts/disconnect', { ...rowBody(person), addOn: screen.key });
      onSaid(fill(ended.incomplete ? w.disconnectPartly : w.disconnected, { name }));
      setAsking(false);
      onChanged();
    } catch {
      onSaid(w.disconnectFailed);
      setAsking(false);
    } finally {
      setLeaving(false);
    }
  };

  const allDayShown = state?.traits?.allDayKnown !== false;
  const inputId = `calendar-add-${person.row}`;
  const errorId = `${inputId}-error`;
  const grantEnds = account.grantEndsAt !== null && account.grantEndsAt - Date.now() < 8 * 86_400_000;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 20px 18px', paddingInlineStart: 'min(68px, 8vw)' }}>
      {needs ? (
        <div role="note" style={{ display: 'flex', gap: 10, padding: '11px 13px', borderRadius: 10, background: 'var(--warn-soft)', fontSize: 12.5, lineHeight: 1.5 }}>
          <span style={{ display: 'flex', color: 'var(--warn)', flexShrink: 0, marginTop: 1 }}>
            <Glyph name="unplug" />
          </span>
          <span>{account.state === 'partial' ? fill(w.partialText, { first, company }) : fill(w.needsText, { company, date: since, first })}</span>
        </div>
      ) : null}
      {account.addressDiffers ? <Alert tone="info" title={w.addressDiffers} /> : null}
      {grantEnds ? <Alert tone="warn" title={fill(w.grantEnds, { company, date: formatStamp(account.grantEndsAt!, locale) })} /> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
        <div style={well}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-muted)', margin: 0 }}>{w.calendarsTitle}</h3>
          {rows.map((one) => (
            <label key={one.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, cursor: 'pointer' }}>
              <Checkbox checked={reading.includes(one.id)} disabled={needs} onCheckedChange={(on: boolean) => void toggle(one.id, on)} aria-label={one.name} />
              <span style={{ minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, display: 'block' }}>{one.name}</span>
                {one.sub === '' ? null : <span dir="ltr" style={{ ...mono, fontSize: 11.5, color: 'var(--fg-muted)', overflowWrap: 'anywhere', unicodeBidi: 'isolate' }}>{one.sub}</span>}
              </span>
            </label>
          ))}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, color: 'var(--fg-subtle)' }}>
            <Checkbox checked={false} disabled aria-label={w.ownCalendarAria} />
            <span>
              <span style={{ fontSize: 13, fontWeight: 700, display: 'block', color: 'var(--fg-muted)' }}>{w.ownCalendar}</span>
              <span style={{ fontSize: 11.5 }}>{w.ownCalendarNote}</span>
            </span>
          </div>
          {listed || needs ? null : adding ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor={inputId} style={{ fontSize: 12, fontWeight: 700 }}>{w.calendarId}</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <Input id={inputId} dir="ltr" value={value} placeholder={screen.addPlaceholder} aria-invalid={problem !== null} aria-describedby={problem === null ? undefined : errorId} onChange={(event: { target: { value: string } }) => { setValue(event.target.value); setProblem(null); }} />
                </div>
                <Button size="sm" onClick={() => void addCalendar()}>{w.add}</Button>
                <Button size="sm" variant="secondary" onClick={() => { setAdding(false); setProblem(null); }}>{w.cancel}</Button>
              </div>
              {problem === null ? null : <p id={errorId} role="alert" style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)', margin: 0 }}>{problem}</p>}
              {screen.addHelp === null ? null : <p style={{ ...subtle, fontSize: 11.5 }}>{w[screen.addHelp]}</p>}
            </div>
          ) : (
            <div>
              <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
                <Glyph name="plus" size={14} />
                {w.addCalendar}
              </Button>
            </div>
          )}
        </div>
        <div style={{ ...well, gap: 6 }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-muted)', margin: 0 }}>{w.busyTitle}</h3>
          <div style={{ ...mono, fontSize: 26, fontWeight: 600, letterSpacing: '-.02em' }}>{needs || busy === null ? '—' : busy}</div>
          <p style={{ ...muted, fontSize: 12 }}>{fill(needs ? w.busyUnknown : w.busyNote, { first })}</p>
        </div>
      </div>
      {failed ? <Alert tone="danger" title={w.loadFailed} /> : null}
      {allDayShown ? (
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
          <Switch checked={state?.countAllDay === true} disabled={needs} onCheckedChange={(on: boolean) => void choose({ countAllDay: on })} aria-label={w.allDay} />
          <span>
            <span style={{ fontWeight: 700, display: 'block', fontSize: 13 }}>{w.allDay}</span>
            <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{state?.countAllDay === true ? w.allDayOn : w.allDayOff}</span>
          </span>
        </label>
      ) : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <Button variant="secondary" size="sm" disabled={needs} onClick={() => void syncNow()}>
          <Glyph name="refresh-cw" size={14} />
          {synced === 'done' ? w.syncedNow : w.syncNow}
        </Button>
        <Button variant="destructiveSoft" size="sm" onClick={() => setAsking(true)}>{w.disconnect}</Button>
        {synced === 'failed' ? <span role="alert" style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)' }}>{w.syncFailed}</span> : null}
      </div>
      <Modal open={asking} onOpenChange={(next: boolean) => { if (!leaving) setAsking(next); }}>
        <ModalHeader title={fill(w.disconnectTitle, { name })} closeLabel={w.cancel} />
        <ModalBody>
          <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0 }}>{fill(w.disconnectBody, { first, product: screen.product })}</p>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" disabled={leaving} onClick={() => setAsking(false)}>{w.keepConnected}</Button>
          <Button variant="destructive" disabled={leaving} onClick={() => void disconnect()}>{w.disconnect}</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
