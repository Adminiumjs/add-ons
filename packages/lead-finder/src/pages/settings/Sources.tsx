/**
 * SOURCES (comps 4b, 4b-2): a card per source, in the comp's order.
 *
 * Each card says what the source gives, the hosts it may contact (the
 * engine's own list: a source's calls reach those and no other), its licence
 * line, and its note. A source with a key shows the saved key's last four
 * with Replace and Check (accepted, refused, can't reach), or "Key not set"
 * with a password field and Check (which saves, then checks); a paid source
 * shows today's look-ups against its daily limit, with Edit. The switch puts
 * a source in use; with no key, or a refused one, it waits.
 *
 * A reader without the settings grant sees every card and changes nothing.
 */
import { useEffect, useState, type ReactNode } from 'react';

import { sources as routes, type CheckView, type SourceView } from '../shared/door.ts';
import { clockTime } from '../shared/dates.ts';
import { Button, NumberInput, Skeleton, Switch, asDataError, useLocaleTag, type AddOnTranslate } from '../shared/host.ts';
import { Icon, Pill, SmallIcon, Spinning } from '../shared/parts.tsx';
import { sourceRank, sourceWords } from '../shared/sourceWords.ts';
import { useToast } from '../shared/toast.ts';
import { doorRefusal } from '../shared/codes.ts';

type Load = { status: 'loading' } | { status: 'failed'; message: string } | { status: 'ready'; canManage: boolean; sources: SourceView[] };

/** The shortest key a source is sent: anything shorter is a key not pasted whole. */
export const KEY_MIN = 8;

export function Sources({ t }: { t: AddOnTranslate }): ReactNode {
  const [load, setLoad] = useState<Load>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    routes.list().then(
      (reply) => {
        if (alive) setLoad({ status: 'ready', canManage: reply.canManage, sources: [...reply.sources].sort((a, b) => sourceRank(a.id) - sourceRank(b.id)) });
      },
      (caught: unknown) => {
        if (alive) setLoad({ status: 'failed', message: doorRefusal(t, asDataError(caught)) });
      },
    );
    return () => {
      alive = false;
    };
  }, [t]);

  if (load.status === 'loading')
    return (
      <div className="flex flex-col gap-3">
        <span role="status" className="sr-only">
          {t('shared.loading', 'Loading')}
        </span>
        <Skeleton height={120} />
        <Skeleton height={120} />
      </div>
    );
  if (load.status === 'failed')
    return (
      <p role="alert" className="m-0 text-[13px] text-danger">
        {load.message}
      </p>
    );

  const replace = (next: SourceView) => setLoad((was) => (was.status === 'ready' ? { ...was, sources: was.sources.map((one) => (one.id === next.id ? next : one)) } : was));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="m-0 text-[18px] font-extrabold tracking-[-0.02em]">{t('settings.sources.title', 'Sources')}</h2>
        <p className="m-0 mt-1 text-[13px] text-fg-muted">{t('settings.sources.sub', 'Where Lead finder looks. Each source talks only to the address shown on its card.')}</p>
        {load.canManage ? null : <p className="m-0 mt-1 text-[12.5px] text-fg-muted">{t('settings.sources.readOnly', 'Only people who keep the settings of Lead finder can change these.')}</p>}
      </div>
      {load.sources.map((source) => (
        <SourceCard key={source.id} t={t} source={source} canManage={load.canManage} onChange={replace} />
      ))}
    </div>
  );
}

type Message = { tone: 'wait' | 'ok' | 'error'; words: string } | null;

function SourceCard({ t, source, canManage, onChange }: { t: AddOnTranslate; source: SourceView; canManage: boolean; onChange: (next: SourceView) => void }): ReactNode {
  const locale = useLocaleTag();
  const toast = useToast();
  const words = sourceWords(t, source.id);
  const [editing, setEditing] = useState(source.needsKey && source.lastFour === null);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(verdictMessage(t, source, locale));
  const [limit, setLimit] = useState<string | null>(null);

  const refused = source.lastFour !== null && source.verdict === 'refused';
  const keyless = source.needsKey && source.lastFour === null;
  const waits = source.needsKey && (keyless || refused);
  const fid = `lf-key-${source.id}`;
  const mid = `lf-msg-${source.id}`;

  const answered = (check: CheckView | null, next: SourceView) => {
    onChange(next);
    if (check === null) return;
    const at = clockTime(Date.now(), locale);
    if (check.verdict === 'accepted') setMessage({ tone: 'ok', words: t('settings.key.accepted', '{source} accepted the key · {time}', { source: words.short, time: at }) });
    else if (check.verdict === 'refused') setMessage({ tone: 'error', words: t('settings.key.refused', '{source} refused this key · {time}', { source: words.short, time: at }) });
    else setMessage({ tone: 'error', words: t('settings.key.unreachable', 'Couldn’t reach {source}. Try again.', { source: words.short }) });
  };

  const save = async (): Promise<void> => {
    if (value.trim().length < KEY_MIN) {
      setMessage({ tone: 'error', words: t('settings.key.short', 'Paste the whole key first.') });
      return;
    }
    setBusy(true);
    setMessage({ tone: 'wait', words: t('settings.key.checking', 'Checking with {source}…', { source: words.short }) });
    try {
      const reply = await routes.saveKey(source.id, value.trim());
      setValue('');
      setEditing(false);
      answered(reply.check, reply.source);
    } catch (caught) {
      setMessage({ tone: 'error', words: doorRefusal(t, asDataError(caught)) });
    } finally {
      setBusy(false);
    }
  };

  const check = async (): Promise<void> => {
    setBusy(true);
    setMessage({ tone: 'wait', words: t('settings.key.checking', 'Checking with {source}…', { source: words.short }) });
    try {
      const reply = await routes.check(source.id);
      answered(reply.check, reply.source);
    } catch (caught) {
      setMessage({ tone: 'error', words: doorRefusal(t, asDataError(caught)) });
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (on: boolean): Promise<void> => {
    try {
      onChange((await routes.change(source.id, { on })).source);
    } catch (caught) {
      toast(doorRefusal(t, asDataError(caught)), 'error');
    }
  };

  const saveLimit = async (): Promise<void> => {
    const cap = Number(limit);
    if (!Number.isInteger(cap) || cap < 1) return;
    try {
      onChange((await routes.change(source.id, { dailyCap: cap })).source);
      setLimit(null);
      toast(t('settings.limit.saved', '{source}: daily limit saved, {count} look-ups.', { source: words.short, count: cap }));
    } catch (caught) {
      toast(doorRefusal(t, asDataError(caught)), 'error');
    }
  };

  return (
    <section aria-labelledby={`lf-src-${source.id}`} className="flex flex-wrap items-start gap-x-5 gap-y-4 rounded-[14px] border border-border bg-surface p-5 shadow-sm">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-surface-3 text-fg-muted">
        <Icon name={words.icon} />
      </span>
      <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <h3 id={`lf-src-${source.id}`} className="m-0 text-[14px] font-bold">
            {words.name}
          </h3>
          <Badge t={t} source={source} />
        </div>
        <p className="m-0 text-[12.5px] text-fg-muted">{words.gives}</p>
        {words.note === null ? null : <p className="m-0 text-[12.5px] text-fg-muted">{words.note}</p>}
        <p className="m-0 mt-0.5 text-[12px] text-fg-subtle">
          {t('settings.mayContact', 'May contact:')}{' '}
          {source.website ? (
            t('settings.onlyWebsite', 'only the website you enter')
          ) : (
            <span dir="ltr" className="font-mono text-[11.5px] text-fg-muted">
              {source.hosts.join(', ')}
            </span>
          )}
        </p>
        {words.licence === null ? null : (
          <p className="m-0 flex items-center gap-[5px] text-[11.5px] text-fg-subtle">
            <SmallIcon name="scale" />
            {words.licence}
          </p>
        )}
        {source.pausedFor > 0 ? <p className="m-0 text-[12px] text-warn">{t('settings.paused', 'Paused for {seconds} seconds: {source} asked us to wait.', { seconds: source.pausedFor, source: words.short })}</p> : null}
      </div>

      <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1.5">
        {source.needsKey && !editing && source.lastFour !== null ? (
          <>
            <span className="text-[12.5px] font-bold text-fg-muted">{t('settings.key.label', 'Key')}</span>
            <div className="flex flex-wrap items-center gap-2">
              <span dir="ltr" className="rounded-md bg-surface-3 px-2.5 py-1.5 font-mono text-[12.5px] text-fg">
                …{source.lastFour}
              </span>
              {canManage ? (
                <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                  {t('settings.key.replace', 'Replace')}
                </Button>
              ) : null}
              {canManage && !refused ? (
                <Button variant="secondary" size="sm" disabled={busy} onClick={() => void check()}>
                  {t('settings.key.check', 'Check')}
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
        {source.needsKey && editing && canManage ? (
          <>
            <label htmlFor={fid} className="text-[12.5px] font-bold text-fg-muted">
              {t('settings.key.label', 'Key')}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id={fid}
                type="password"
                autoComplete="off"
                dir="ltr"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={t('settings.key.paste', 'Paste the key')}
                aria-invalid={message?.tone === 'error' ? true : undefined}
                aria-describedby={mid}
                className="h-[38px] min-w-0 flex-1 rounded-[10px] border border-border-strong bg-surface px-3 font-mono text-[12.5px] text-fg"
              />
              <Button variant="secondary" disabled={busy} onClick={() => void save()}>
                {t('settings.key.check', 'Check')}
              </Button>
              {source.lastFour !== null ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditing(false);
                    setValue('');
                    setMessage(verdictMessage(t, source, locale));
                  }}
                >
                  {t('shared.cancel', 'Cancel')}
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
        {source.needsKey && editing && !canManage ? <span className="text-[12.5px] text-fg-muted">{t('settings.key.notSet', 'Key not set')}</span> : null}
        <span id={mid} aria-live="polite" className="flex flex-col">
          <MessageLine message={message} />
        </span>
        {source.paid ? (
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-2.5 text-[12.5px]">
            <span className="font-mono text-[12px]">{t('settings.limit.today', 'Today: {used} of {cap} look-ups', { used: source.usedToday, cap: source.dailyCap ?? '—' })}</span>
            {limit === null ? (
              <span className="flex items-center gap-2 text-fg-muted">
                {t('settings.limit.label', 'Daily limit')} <span className="font-mono text-[12px] text-fg">{source.dailyCap ?? '—'}</span>
                {canManage ? (
                  <Button variant="link" size="sm" onClick={() => setLimit(String(source.dailyCap ?? ''))}>
                    {t('settings.limit.edit', 'Edit')}
                  </Button>
                ) : null}
              </span>
            ) : (
              <span className="flex flex-wrap items-center gap-2">
                <span className="w-24">
                  <NumberInput label={t('settings.limit.label', 'Daily limit')} value={limit} onChange={setLimit} whole />
                </span>
                <Button variant="primary" size="sm" onClick={() => void saveLimit()}>
                  {t('settings.limit.save', 'Save')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setLimit(null)}>
                  {t('shared.cancel', 'Cancel')}
                </Button>
              </span>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex min-w-24 flex-col items-end gap-1.5">
        <Switch label={<span className="sr-only">{t('settings.use', 'Use {source}', { source: words.short })}</span>} checked={source.on && !waits} disabled={!canManage || waits} onCheckedChange={(on) => void toggle(on)} />
        <span className="text-end text-[11.5px] text-fg-subtle">{refused ? t('settings.switch.replace', 'Replace the key to use it') : keyless ? t('settings.switch.addKey', 'Add a key to use it') : source.on ? t('settings.switch.on', 'In use') : t('settings.switch.off', 'Not in use')}</span>
      </div>
    </section>
  );
}

function Badge({ t, source }: { t: AddOnTranslate; source: SourceView }): ReactNode {
  if (!source.needsKey) return <Pill tone="neutral">{t('settings.badge.none', 'Needs no key')}</Pill>;
  if (source.lastFour === null) return <Pill tone="warn">{t('settings.badge.notSet', 'Key not set')}</Pill>;
  if (source.verdict === 'refused') return <Pill tone="danger">{t('settings.badge.refused', 'Key refused')}</Pill>;
  return <Pill tone="pos">{t('settings.badge.saved', 'Key saved')}</Pill>;
}

function MessageLine({ message }: { message: Message }): ReactNode {
  if (message === null) return null;
  if (message.tone === 'wait')
    return (
      <span className="flex items-center gap-1.5 text-[12px] font-semibold text-fg-muted">
        <Spinning />
        {message.words}
      </span>
    );
  if (message.tone === 'ok')
    return (
      <span className="flex items-center gap-1.5 text-[12px] font-semibold text-pos">
        <Icon name="circle-check" />
        {message.words}
      </span>
    );
  return (
    <span className="flex items-center gap-1.5 text-[12px] font-semibold text-danger">
      <Icon name="circle-x" />
      {message.words}
    </span>
  );
}

/** What the last Check said, as the card opens. */
function verdictMessage(t: AddOnTranslate, source: SourceView, locale: string): Message {
  const short = sourceWords(t, source.id).short;
  const at = source.checkedAt === null ? '' : clockTime(source.checkedAt, locale);
  if (source.lastFour === null) return null;
  if (source.verdict === 'refused') return { tone: 'error', words: t('settings.key.refused', '{source} refused this key · {time}', { source: short, time: at }) };
  if (source.verdict === 'unreachable') return { tone: 'error', words: t('settings.key.unreachable', 'Couldn’t reach {source}. Try again.', { source: short }) };
  return null;
}

