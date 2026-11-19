/**
 * PEOPLE FOUND (comps 3f, 3f-2, 5d, 6d; phone 6f): everyone Lead finder kept,
 * whom this reader may read, with whether they may be e-mailed (read from the
 * record's own consent, never a constant "No") and where telling them stands.
 *
 * Filter chips: All / Told / Couldn't tell / May be e-mailed. A failed mail
 * may be sent again (the outbox's own move: failed → queued). A person this
 * reader may not read is not listed; a company they may not open is shown as
 * kept by a colleague, with no link.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { readKit, type Kit } from '../shared/door.ts';
import { longDay, shortDay } from '../shared/dates.ts';
import { Button, Link, Skeleton, ToggleChip, asDataError, useAccess, useLocaleTag, useRecords, useWrite, type AddOnTranslate, type DataRow } from '../shared/host.ts';
import { Icon, Fixed, Pill, Spinning, Value } from '../shared/parts.tsx';
import { recordAt } from '../shared/paths.ts';
import { sourceWords } from '../shared/sourceWords.ts';
import { useToast } from '../shared/toast.ts';
import { doorRefusal } from '../shared/codes.ts';
import { latestMails, tellingOf, type Telling } from './telling.ts';
import { companyName, readNav, whoIs, type Consent, type Who } from './who.ts';

type Filter = 'all' | 'told' | 'failed' | 'may';

interface Person {
  row: DataRow;
  who: Who;
  company: { name: string; page: string | null; key: string } | null;
}

/** How many people are read at once while the list is put together. */
const AT_ONCE = 6;

export function PeopleFound({ t, onCount }: { t: AddOnTranslate; onCount?: (count: number) => void }): ReactNode {
  const locale = useLocaleTag();
  const toast = useToast();
  const access = useAccess();
  const found = useRecords('found_people', { sort: [{ column: 'found_at', direction: 'desc' }], pageSize: 199 });
  const ids = useMemo(() => found.rows.map((row) => row['id'] as string | number), [found.rows]);
  const mails = useRecords('tell_mails', { filter: [{ column: 'found_person_id', op: 'in', value: ids }], sort: [{ column: 'id', direction: 'desc' }], pageSize: 199, enabled: ids.length > 0 });
  const tellMails = useWrite('tell_mails');
  const [people, setPeople] = useState<readonly Person[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [now] = useState(() => Date.now());

  const shown = useMemo(() => found.rows.filter((row) => row['state'] !== 'objected'), [found.rows]);
  const objected = found.rows.length - shown.length;
  const rowsKey = shown.map((row) => `${String(row['id'])}:${String(row['person_key'])}`).join(',');

  useEffect(() => {
    if (found.loading) return undefined;
    let alive = true;
    (async () => {
      const kit: Kit = await readKit();
      const nav = await readNav().catch(() => []);
      const out: (Person | null)[] = new Array<Person | null>(shown.length).fill(null);
      let next = 0;
      const work = async () => {
        while (next < shown.length) {
          const at = next;
          next += 1;
          const row = shown[at]!;
          const who = await whoIs(kit.connectionId, String(row['person_table'] ?? ''), String(row['person_key'] ?? ''), nav);
          if (who === null) continue;
          const key = row['company_key'] === null || row['company_key'] === undefined ? null : String(row['company_key']);
          const named = await companyName(kit.connectionId, typeof row['company_table'] === 'string' ? row['company_table'] : null, key, kit.companies);
          out[at] = { row, who, company: named === null || key === null ? null : { ...named, key } };
        }
      };
      await Promise.all(Array.from({ length: Math.min(AT_ONCE, shown.length) }, () => work()));
      if (alive) setPeople(out.filter((one): one is Person => one !== null));
    })().catch(() => {
      if (alive) setPeople([]);
    });
    return () => {
      alive = false;
    };
    // Read again when the rows (or who they are) change, not on every draw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsKey, found.loading]);

  useEffect(() => {
    if (people !== null) onCount?.(people.length);
  }, [people, onCount]);

  const latest = useMemo(() => latestMails(mails.rows), [mails.rows]);
  const tellingFor = (person: Person): Telling => tellingOf(person.row, latest.get(String(person.row['id'])) ?? null, now);
  const keep = (person: Person): boolean => {
    if (filter === 'all') return true;
    const telling = tellingFor(person);
    if (filter === 'told') return telling.kind === 'told';
    if (filter === 'failed') return telling.kind === 'failed';
    return person.who.consent.state === 'yes';
  };

  const sendAgain = async (mail: string | null): Promise<void> => {
    if (mail === null) return;
    try {
      await tellMails.update(mail, { status: 'queued' });
      mails.refetch();
    } catch (caught) {
      toast(doorRefusal(t, asDataError(caught)), 'error');
    }
  };
  const maySend = access.canUpdate('tell_mails');

  const loading = found.loading || people === null;
  const list = (people ?? []).filter(keep);
  const count = people?.length ?? 0;

  return (
    <section aria-labelledby="lf-people" className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-b border-border px-5 py-3.5">
        <h2 id="lf-people" className="m-0 whitespace-nowrap text-[14.5px] font-bold tracking-[-0.01em]">
          {t('people.title', 'People found')} <span className="font-mono text-[12px] font-semibold text-fg-muted">{loading ? '' : String(count)}</span>
        </h2>
        {count > 0 ? (
          <div role="group" aria-label={t('people.show', 'Show')} className="ms-auto flex flex-wrap gap-1.5">
            <ToggleChip pressed={filter === 'all'} onPressedChange={() => setFilter('all')}>
              {t('people.filter.all', 'All')}
            </ToggleChip>
            <ToggleChip pressed={filter === 'told'} onPressedChange={() => setFilter('told')}>
              {t('people.filter.told', 'Told')}
            </ToggleChip>
            <ToggleChip pressed={filter === 'failed'} onPressedChange={() => setFilter('failed')}>
              {t('people.filter.failed', 'Couldn’t tell')}
            </ToggleChip>
            <ToggleChip pressed={filter === 'may'} onPressedChange={() => setFilter('may')}>
              {t('people.filter.may', 'May be e-mailed')}
            </ToggleChip>
          </div>
        ) : null}
      </div>
      {loading ? (
        <div className="flex flex-col gap-2 p-5">
          <span role="status" className="sr-only">
            {t('shared.loading', 'Loading')}
          </span>
          <Skeleton height={36} />
          <Skeleton height={36} />
        </div>
      ) : count === 0 ? (
        <div className="flex flex-col items-center gap-2.5 px-6 py-11 text-center">
          <span className="flex size-11 items-center justify-center rounded-[14px] bg-surface-3 text-fg-muted">
            <Icon name="users" />
          </span>
          <p className="m-0 text-[13px] text-fg-muted">{t('people.empty', 'No people yet. Find people from a company’s Fill in details.')}</p>
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <div className="overflow-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-surface-2">
                    <Head>{t('people.col.person', 'Person')}</Head>
                    <Head>{t('people.col.mail', 'E-mail')}</Head>
                    <Head>{t('people.col.found', 'Found')}</Head>
                    <Head>{t('people.col.may', 'May be e-mailed')}</Head>
                    <Head>{t('people.col.tell', 'Telling them')}</Head>
                  </tr>
                </thead>
                <tbody>
                  {list.map((person) => (
                    <tr key={String(person.row['id'])} className="border-t border-border align-top">
                      <td className="px-3.5 py-[13px] ps-5">
                        <span className="flex flex-col leading-normal">
                          <Name person={person} />
                          <Where t={t} person={person} />
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-[13px]">
                        <Fixed>{String(person.row['email'] ?? '—')}</Fixed>
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-[13px] text-fg-muted">
                        {sourceWords(t, String(person.row['source'] ?? '')).short} · <span className="font-mono text-[12px]">{dayOf(person.row['found_at'], locale)}</span>
                      </td>
                      <td className="px-3.5 py-[13px]">
                        <May t={t} consent={person.who.consent} long={false} locale={locale} />
                      </td>
                      <td className="px-3.5 py-[13px] pe-5">
                        <Tell t={t} telling={tellingFor(person)} first={firstOf(person.who.name)} locale={locale} maySend={maySend} onSend={sendAgain} wide />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <ul className="m-0 flex flex-col p-0 md:hidden">
            {list.map((person) => (
              <li key={String(person.row['id'])} className="flex flex-col gap-1.5 border-t border-border px-4 py-3.5">
                <span className="text-[14px]">
                  <Name person={person} />
                </span>
                <Where t={t} person={person} />
                <Fixed>{String(person.row['email'] ?? '—')}</Fixed>
                <span className="flex flex-wrap gap-1.5">
                  <May t={t} consent={person.who.consent} long locale={locale} />
                  <Tell t={t} telling={tellingFor(person)} first={firstOf(person.who.name)} locale={locale} maySend={maySend} onSend={sendAgain} wide={false} />
                </span>
              </li>
            ))}
          </ul>
          {list.length === 0 ? <p className="m-0 px-5 py-7 text-center text-[12.5px] text-fg-muted">{t('people.nobody', 'Nobody in this view.')}</p> : null}
          {objected > 0 ? (
            <div className="border-t border-border bg-surface-2 px-5 py-3 text-[12px] text-fg-muted">{t('people.objected', '{count, plural, one {# person objected and their details were deleted.} other {# people objected and their details were deleted.}}', { count: objected })}</div>
          ) : null}
        </>
      )}
    </section>
  );
}

const dayOf = (value: unknown, locale: string): string => {
  const at = typeof value === 'string' || typeof value === 'number' ? new Date(value).getTime() : Number.NaN;
  return Number.isNaN(at) ? '—' : shortDay(at, locale);
};

const firstOf = (name: string): string => name.split(/\s+/)[0] ?? name;

function Head({ children }: { children: ReactNode }): ReactNode {
  return (
    <th scope="col" className="whitespace-nowrap px-3.5 py-2.5 text-start text-[10.5px] font-bold uppercase tracking-[0.05em] text-fg-subtle">
      {children}
    </th>
  );
}

function Name({ person }: { person: Person }): ReactNode {
  const name = (
    <span className="font-bold">
      <Value>{person.who.name}</Value>
    </span>
  );
  return person.who.page === null ? name : <Link to={recordAt(person.who.page, String(person.row['person_key']))}>{name}</Link>;
}

function Where({ t, person }: { t: AddOnTranslate; person: Person }): ReactNode {
  const company = person.company;
  const at =
    company === null ? (
      t('people.colleague', 'a company kept by a colleague')
    ) : company.page === null ? (
      <Value>{company.name}</Value>
    ) : (
      <Link to={recordAt(company.page, company.key)}>
        <Value>{company.name}</Value>
      </Link>
    );
  return (
    <span className="text-[12.5px] text-fg-muted">
      {person.who.role === null ? null : (
        <>
          <Value>{person.who.role}</Value> ·{' '}
        </>
      )}
      {at}
    </span>
  );
}

const HOW: Readonly<Record<string, string>> = { 'in-person': 'in-person', phone: 'phone', email: 'email', paper: 'paper' };

function May({ t, consent, long, locale }: { t: AddOnTranslate; consent: Consent; long: boolean; locale: string }): ReactNode {
  if (consent.state === 'yes') {
    const how =
      HOW[consent.how ?? ''] === 'phone'
        ? t('people.how.phone', 'by phone')
        : HOW[consent.how ?? ''] === 'email'
          ? t('people.how.email', 'by e-mail')
          : HOW[consent.how ?? ''] === 'paper'
            ? t('people.how.paper', 'on paper')
            : HOW[consent.how ?? ''] === 'in-person'
              ? t('people.how.person', 'in person')
              : null;
    const day = consent.at === null ? null : shortDay(consent.at, locale);
    return (
      <Pill tone="pos" icon="check">
        {how === null && day === null ? t('people.yes', 'Yes') : t('people.yesHow', 'Yes · {how}', { how: [how, day].filter((part) => part !== null).join(', ') })}
      </Pill>
    );
  }
  if (consent.state === 'no') return <Pill tone="neutral">{long ? t('people.noLong', 'May not be e-mailed') : t('people.no', 'No')}</Pill>;
  return <span className="text-fg-subtle">—</span>;
}

function Tell({ t, telling, first, locale, maySend, onSend, wide }: { t: AddOnTranslate; telling: Telling; first: string; locale: string; maySend: boolean; onSend: (mail: string | null) => Promise<void>; wide: boolean }): ReactNode {
  switch (telling.kind) {
    case 'objected':
      return <Pill tone="neutral">{t('people.tell.objected', 'Objected')}</Pill>;
    case 'sending':
      return (
        <span className="inline-flex h-[22px] items-center gap-[5px] whitespace-nowrap rounded-full bg-surface-3 px-2 text-[11.5px] font-bold text-fg-muted">
          <Spinning />
          {t('people.tell.sending', 'Sending…')}
        </span>
      );
    case 'told':
      return (
        <Pill tone="pos" icon="check">
          {telling.at === null ? t('people.tell.toldNoDay', 'Told') : t('people.tell.told', 'Told on {day}', { day: shortDay(telling.at, locale) })}
        </Pill>
      );
    case 'failed':
      return (
        <span className="flex flex-col items-start gap-1.5">
          <Pill tone="danger" icon="circle-x">
            {telling.error === null ? t('people.tell.failed', 'Couldn’t tell') : t('people.tell.failedWhy', 'Couldn’t tell: {why}', { why: telling.error })}
          </Pill>
          {maySend && telling.mail !== null ? (
            <Button variant="secondary" size={wide ? 'sm' : 'lg'} onClick={() => void onSend(telling.mail)}>
              {t('people.tell.again', 'Send again')}
            </Button>
          ) : null}
          {telling.by === null ? null : <span className="max-w-[240px] text-[11.5px] text-fg-muted">{t('people.tell.deadline', 'If it can’t go by {day}, Lead finder deletes {name}.', { day: longDay(telling.by, locale), name: first })}</span>}
        </span>
      );
    case 'tell-by': {
      const day = telling.by === null ? '—' : shortDay(telling.by, locale);
      if (telling.overdue)
        return (
          <Pill tone="danger" icon="triangle-alert">
            {t('people.tell.overdue', 'Tell by {day}: overdue', { day })}
          </Pill>
        );
      if (telling.near)
        return (
          <Pill tone="warn" icon="triangle-alert">
            {t('people.tell.by', 'Tell by {day}', { day })}
          </Pill>
        );
      return (
        <Pill tone="info" icon="clock">
          {t('people.tell.by', 'Tell by {day}', { day })}
        </Pill>
      );
    }
  }
}
