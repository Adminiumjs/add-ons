/**
 * THE SETUP GUIDE: five numbered steps, then the ID and secret, and "Check my
 * setup". Drawn from `Calendars and Embeds`, part 2, with the labels the two
 * consoles use today.
 *
 * WHAT THE CHECK SAYS. Only what a provider can tell with nobody signed in: the
 * fields' shape, and whether the ID and secret belong together. It saves first,
 * because only the engine holds the secret. A good answer still asks the owner
 * to connect their own calendar, which is what proves the rest.
 */
import { useEffect, useState, type ReactNode } from 'react';

import { Alert, Button, Input, PageActions, PageSurface, api, card, lucideByName, mono, muted, subtle, well } from './kit.ts';
import { checkResult, localProblem, type CheckAnswer, type CheckResult, type InstallInfo, type LocalProblem } from './model.ts';
import type { CalendarProviderScreen, GuideChip, GuideStep } from './provider.ts';
import { fill, type WordKey, type Words } from './words/index.ts';

function Glyph({ name, size = 16 }: { name: string; size?: number }): ReactNode {
  const Of = lucideByName(name);
  return Of ? <Of size={size} aria-hidden /> : null;
}

function Chip({ chip, redirect, w }: { chip: GuideChip; redirect: string | null; w: Words }): ReactNode {
  const [copied, setCopied] = useState(false);
  const text = chip.text === 'redirect' ? redirect : chip.text;
  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px 6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
        <code dir="ltr" style={{ ...mono, fontSize: 12, fontWeight: 600, flex: 1, minWidth: 0, overflowWrap: 'anywhere', textAlign: 'start', unicodeBidi: 'isolate' }}>{text ?? '—'}</code>
        <Button variant="secondary" size="sm" disabled={text === null} onClick={() => { if (text !== null) void navigator.clipboard?.writeText(text).then(() => setCopied(true)); }}>
          <span aria-live="polite">{copied ? w.copied : w.copy}</span>
        </Button>
      </div>
      {chip.note === undefined ? null : <span style={{ ...muted, fontSize: 12 }}>{w[chip.note]}</span>}
    </div>
  );
}

function Choice({ step, choice, onChoose, w }: { step: GuideStep; choice: string | null; onChoose: (id: string) => void; w: Words }): ReactNode {
  const choices = step.choices ?? [];
  const move = (index: number): void => {
    const next = choices[(index + choices.length) % choices.length]!;
    onChoose(next.id);
    document.getElementById(`guide-choice-${next.id}`)?.focus();
  };
  return (
    <div role="radiogroup" aria-label={w[step.title]} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 10 }}>
      {choices.map((one, index) => {
        const selected = choice === one.id;
        return (
          <button
            key={one.id}
            id={`guide-choice-${one.id}`}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected || (choice === null && index === 0) ? 0 : -1}
            onClick={() => onChoose(one.id)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
                event.preventDefault();
                move(index + 1);
              } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
                event.preventDefault();
                move(index - 1);
              }
            }}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 11, textAlign: 'start', padding: 14, borderRadius: 12, cursor: 'pointer', border: `1px solid ${selected ? 'var(--accent)' : 'var(--border-strong)'}`, boxShadow: selected ? 'inset 0 0 0 1px var(--accent)' : 'none', background: selected ? 'var(--accent-soft)' : 'var(--surface)', color: 'var(--fg)', font: 'inherit' }}
          >
            <span aria-hidden style={{ width: 16, height: 16, borderRadius: '50%', border: `${selected ? 5 : 1.5}px solid ${selected ? 'var(--accent)' : 'var(--border-strong)'}`, flexShrink: 0, marginTop: 2 }} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{w[one.title]}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent)' }}>{w[one.pick]}</span>
              <span style={{ fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.5 }}>{w[one.body]}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

type Outcome = { kind: 'local'; problem: LocalProblem } | { kind: 'check'; result: CheckResult } | { kind: 'save-failed' };

function outcomeWords(outcome: Outcome, screen: CalendarProviderScreen, w: Words): { good: boolean; title: string; body: string } {
  const bad = (body: string) => ({ good: false, title: w.notReady, body });
  if (outcome.kind === 'save-failed') return bad(w.errSave);
  if (outcome.kind === 'local') {
    const key: Record<LocalProblem, WordKey> = { empty: 'errEmpty', 'client-shape': screen.clientShapeError, 'tenant-needed': 'errTenantNeeded', 'tenant-shape': 'errTenantShape', 'date-shape': 'errDate' };
    return bad(w[key[outcome.problem]]);
  }
  switch (outcome.result) {
    case 'good':
      return { good: true, title: w.goodTitle, body: w.goodBody };
    case 'unproved':
      return { good: true, title: w.unprovedTitle, body: w.unprovedBody };
    case 'refused':
      return bad(w[screen.refusedError]);
    case 'expired':
      return bad(w.errExpired);
    case 'unreachable':
      return bad(fill(w.errUnreachable, { company: screen.company }));
  }
}

function Keys({ screen, w, info, choice, onSaved, onConnectMine }: { screen: CalendarProviderScreen; w: Words; info: InstallInfo; choice: string | null; onSaved: () => void; onConnectMine: () => void }): ReactNode {
  const [clientId, setClientId] = useState(info.clientId ?? '');
  const [secret, setSecret] = useState('');
  const [tenant, setTenant] = useState(info.tenant ?? '');
  const [endsOn, setEndsOn] = useState(info.secretEndsOn ?? '');
  const [checking, setChecking] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const edited = (set: (value: string) => void) => (event: { target: { value: string } }) => {
    set(event.target.value);
    setOutcome(null);
  };
  const single = choice === null ? info.tenant !== null : choice === screen.singleTenantChoice;
  const problemField = outcome?.kind === 'local' ? outcome.problem : null;
  const clientBad = problemField === 'client-shape' || (problemField === 'empty' && clientId.trim() === '');
  const secretBad = problemField === 'empty' && secret.trim() === '' && !info.registered;
  const tenantBad = problemField === 'tenant-needed' || problemField === 'tenant-shape';
  const dateBad = problemField === 'date-shape';
  const said = outcome === null ? null : outcomeWords(outcome, screen, w);

  const press = async (): Promise<void> => {
    const draft = { clientId, secret, hasSavedSecret: info.registered, tenant: screen.hasTenant ? tenant : null, singleTenant: screen.hasTenant && single, endsOn };
    const problem = localProblem(draft, screen.clientOk);
    if (problem !== null) {
      setOutcome({ kind: 'local', problem });
      return;
    }
    setChecking(true);
    setOutcome(null);
    try {
      const directory = screen.hasTenant && single ? tenant.trim() : null;
      await api.put(`/api/v1/add-ons/${screen.key}/connect/app`, {
        clientId: clientId.trim(),
        ...(secret.trim() === '' ? {} : { clientSecret: secret.trim() }),
        ...(screen.hasTenant ? { tenant: directory === '' ? null : directory, secretEndsOn: endsOn.trim() === '' ? null : endsOn.trim() } : {}),
      });
      setSecret('');
      onSaved();
    } catch {
      setChecking(false);
      setOutcome({ kind: 'save-failed' });
      return;
    }
    try {
      const { result } = await api.post<{ result: CheckAnswer }>(`/api/v1/add-ons/${screen.key}/connect/check`, screen.check);
      setOutcome({ kind: 'check', result: checkResult(result) });
      onSaved();
    } catch {
      setOutcome({ kind: 'check', result: 'unreachable' });
    } finally {
      setChecking(false);
    }
  };

  const field = (id: string, label: string, control: ReactNode, help?: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label htmlFor={id} style={{ fontSize: 12.5, fontWeight: 700 }}>{label}</label>
      {control}
      {help === undefined ? null : <span id={`${id}-help`} style={{ ...subtle, fontSize: 11.5 }}>{help}</span>}
    </div>
  );
  const describedBy = (bad: boolean, id: string, help = false): string | undefined => [bad ? 'guide-result' : '', help ? `${id}-help` : ''].filter(Boolean).join(' ') || undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {field('guide-client', w.clientId, <Input id="guide-client" dir="ltr" autoComplete="off" value={clientId} placeholder={screen.clientPlaceholder} aria-invalid={clientBad} aria-describedby={describedBy(clientBad, 'guide-client')} onChange={edited(setClientId)} />)}
      {screen.hasTenant && single ? field('guide-tenant', w.tenantId, <Input id="guide-tenant" dir="ltr" autoComplete="off" value={tenant} placeholder="00000000-0000-0000-0000-000000000000" aria-invalid={tenantBad} aria-describedby={describedBy(tenantBad, 'guide-tenant', true)} onChange={edited(setTenant)} />, w.tenantHelp) : null}
      {field('guide-secret', w.clientSecret, <Input id="guide-secret" dir="ltr" type="password" autoComplete="new-password" value={secret} aria-invalid={secretBad} aria-describedby={describedBy(secretBad, 'guide-secret', info.registered)} onChange={edited(setSecret)} />, info.registered ? w.secretKept : undefined)}
      {screen.hasTenant ? field('guide-ends', w.secretEnds, <Input id="guide-ends" dir="ltr" type="date" value={endsOn} aria-invalid={dateBad} aria-describedby={describedBy(dateBad, 'guide-ends', true)} onChange={edited(setEndsOn)} />, w.secretEndsHelp) : null}
      <div>
        <Button disabled={checking} onClick={() => void press()}>{checking ? w.checking : w.check}</Button>
      </div>
      <div aria-live="polite">
        {checking ? <span className="sr-only">{w.checking}</span> : null}
        {said === null ? null : (
          <div id="guide-result" role={said.good ? 'status' : 'alert'} style={{ display: 'flex', gap: 10, padding: '11px 13px', borderRadius: 10, background: said.good ? 'var(--pos-soft)' : 'var(--danger-soft)', fontSize: 12.5, lineHeight: 1.5 }}>
            <span style={{ display: 'flex', color: said.good ? 'var(--pos)' : 'var(--danger)', flexShrink: 0, marginTop: 1 }}>
              <Glyph name={said.good ? 'circle-check' : 'circle-alert'} />
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
              <strong>{said.title}</strong>
              <span style={{ overflowWrap: 'anywhere' }}>{said.body}</span>
              {said.good ? <Button size="sm" variant="secondary" onClick={onConnectMine}>{w.connectMine}</Button> : null}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Under 768 px the side list of steps goes, as drawn. */
function usePhone(): boolean {
  const [phone, setPhone] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const follow = (): void => setPhone(query.matches);
    query.addEventListener('change', follow);
    return () => query.removeEventListener('change', follow);
  }, []);
  return phone;
}

export function Guide({ screen, w, info, onSaved, onBack, onConnectMine }: { screen: CalendarProviderScreen; w: Words; info: InstallInfo; onSaved: () => void; onBack: () => void; onConnectMine: () => void }): ReactNode {
  const company = screen.company;
  const title = fill(w.setupTitle, { company });
  // A saved directory means the single-tenant card was chosen.
  const [choice, setChoice] = useState<string | null>(() => (screen.hasTenant && info.tenant !== null ? screen.singleTenantChoice : null));
  const phone = usePhone();
  return (
    <PageSurface width="content">
      <PageActions title={title} documentTitle={title} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <Button variant="ghost" size="sm" onClick={onBack}>
            <span style={{ display: 'flex' }} className="rtl:-scale-x-100"><Glyph name="arrow-left" size={15} /></span>
            {fill(w.backTo, { product: screen.product })}
          </Button>
        </div>
        <p style={{ ...muted, fontWeight: 600 }}>{w.guideTime}</p>
        <section style={{ ...well, background: 'var(--accent-soft)', borderColor: 'transparent' }}>
          <h2 style={{ fontSize: 13.5, fontWeight: 700, margin: 0 }}>{w.ownTitle}</h2>
          <p style={{ ...muted, color: 'var(--fg)' }}>{fill(w.ownBody, { company })} {w[screen.need]}</p>
        </section>
        {info.reach === 'cannot-connect' ? <Alert tone="warn" title={w.noPublicTitle}>{fill(w.noPublicBody, { company })}</Alert> : null}
        <div style={phone ? { display: 'flex', flexDirection: 'column', gap: 14 } : { display: 'grid', gridTemplateColumns: '196px minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
          <nav aria-label={w.steps} hidden={phone} style={{ display: phone ? 'none' : 'flex', flexDirection: 'column', gap: 2, position: 'sticky', top: 12 }}>
            <h2 style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-subtle)', margin: '0 0 6px', paddingInline: 10 }}>{w.steps}</h2>
            {screen.steps.map((step, index) => (
              <a key={step.short} href={`#guide`} onClick={(event) => { event.preventDefault(); document.getElementById(`guide-step-${String(index + 1)}`)?.scrollIntoView({ block: 'start' }); }} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', borderRadius: 10, fontSize: 12.5, lineHeight: 1.4, fontWeight: 600, color: 'var(--fg-muted)', textDecoration: 'none' }}>
                <span style={{ ...mono, width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 600, border: '1.5px solid var(--border-strong)', color: 'var(--fg-subtle)' }}>{index + 1}</span>
                <span>{w[step.short]}</span>
              </a>
            ))}
          </nav>
          <ol style={{ display: 'flex', flexDirection: 'column', gap: 14, margin: 0, padding: 0, listStyle: 'none', minWidth: 0 }}>
            {screen.steps.map((step, index) => (
              <li key={step.short} id={`guide-step-${String(index + 1)}`} style={{ ...card, gap: 12, scrollMarginTop: 12 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ ...mono, width: 24, height: 24, borderRadius: 7, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>{index + 1}</span>
                  <h3 style={{ fontSize: 14, fontWeight: 700, margin: '2px 0 0' }}>{w[step.title]}</h3>
                </div>
                <p style={{ ...muted, fontSize: 13 }}>{w[step.body]}</p>
                {step.chips?.map((chip) => <Chip key={chip.text} chip={chip} redirect={info.redirectUri} w={w} />)}
                {step.body2 === undefined ? null : <p style={{ ...muted, fontSize: 13 }}>{w[step.body2]}</p>}
                {step.choices === undefined ? null : <Choice step={step} choice={choice} onChoose={setChoice} w={w} />}
                {step.warn === undefined ? null : (
                  <div role="note" style={{ display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'var(--warn-soft)', fontSize: 12.5, lineHeight: 1.5 }}>
                    <span style={{ display: 'flex', color: 'var(--warn)', flexShrink: 0, marginTop: 1 }}><Glyph name="triangle-alert" /></span>
                    <span>{w[step.warn]}</span>
                  </div>
                )}
                {step.link === undefined ? null : (
                  <a href={step.link.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 700, color: 'var(--accent)' }}>
                    {fill(w.openExternal, { place: step.link.place })}
                    <Glyph name="arrow-up-right" size={14} />
                  </a>
                )}
                {step.note === undefined ? null : <p style={subtle}>{w[step.note]}</p>}
                {step.noteFor !== undefined && choice === step.noteFor.choice ? <Alert tone="warn" title={w[step.noteFor.note]} /> : null}
                {step.keys === true ? <Keys screen={screen} w={w} info={info} choice={choice} onSaved={onSaved} onConnectMine={onConnectMine} /> : null}
              </li>
            ))}
          </ol>
        </div>
        <details style={{ ...card, gap: 8 }}>
          <summary style={{ fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{fill(w.troubleTitle, { company })}</summary>
          <ul style={{ margin: '8px 0 0', paddingInlineStart: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {screen.trouble.map((key) => <li key={key} style={{ ...muted, overflowWrap: 'anywhere' }}>{w[key]}</li>)}
          </ul>
        </details>
      </div>
    </PageSurface>
  );
}
