/**
 * THE GOOGLE REVIEWS SCREEN: one place and one key per app, the restriction
 * the key must carry, where the box shows, and the real box to test it with.
 * The frame is made only when "See our Google reviews" is pressed, so nothing
 * loads from Google before that, here as on the customer's pages.
 */
import app from '@adminium/add-on-contracts/runtime/app';
import dataKit from '@adminium/add-on-contracts/runtime/data';
import type { AddOnDataHooks, DataRow } from '@adminium/add-on-contracts/runtime';
import uiKit from '@adminium/add-on-contracts/runtime/ui';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ComponentType, type CSSProperties, type ReactNode } from 'react';

import { CHANNEL, readHeight, type ShowMessage } from '../../frame/protocol.ts';
import { appsOf, canUse, draftOf, edited, isBrowserKey, isPlaceId, keyChips, type Draft } from './model.ts';
import { pageWords } from './words.ts';

const ui = uiKit as unknown as Readonly<Record<string, ComponentType<Record<string, unknown>>>>;
const kit = dataKit as unknown as Readonly<Record<string, ComponentType<Record<string, unknown>>>>;
const hooks = dataKit as unknown as AddOnDataHooks;
const Button = ui['Button']!;
const Alert = ui['Alert']!;
const Input = kit['Input']!;
const Skeleton = kit['Skeleton']!;
const { PageSurface, PageActions, api, useLocaleTag } = app as unknown as {
  PageSurface: ComponentType<{ width?: string; children?: ReactNode }>;
  PageActions: ComponentType<{ title: string; documentTitle: string; subtitle?: string }>;
  api: { get<T>(url: string): Promise<T> };
  useLocaleTag: () => string;
};

const FRAME = '/x/add-on-frame/google-reviews';
const SANDBOX = 'allow-scripts allow-popups allow-popups-to-escape-sandbox';
const card: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: 16, display: 'grid', gap: 10, background: 'var(--surface)' };
const muted: CSSProperties = { color: 'var(--fg-muted)', fontSize: 13, margin: 0 };
const h2: CSSProperties = { fontSize: 14, fontWeight: 700, margin: 0 };

/** The real box: a frame made on the press, told the place and the key once it says it is ready. */
function TestBox({ show, title, onFailed }: { show: ShowMessage; title: string; onFailed: () => void }): ReactNode {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(120);
  useEffect(() => {
    const listen = (event: MessageEvent): void => {
      if (event.source !== frame.current?.contentWindow) return;
      const data = event.data as { channel?: unknown; event?: unknown };
      if (data?.channel !== CHANNEL) return;
      if (data.event === 'ready') frame.current?.contentWindow?.postMessage(show, '*');
      else if (data.event === 'failed') onFailed();
      else {
        const px = readHeight(data);
        if (px !== null) setHeight(px);
      }
    };
    window.addEventListener('message', listen);
    return () => window.removeEventListener('message', listen);
  }, [show, onFailed]);
  return <iframe ref={frame} src={FRAME} title={title} sandbox={SANDBOX} referrerPolicy="strict-origin-when-cross-origin" style={{ width: '100%', height, border: 0, display: 'block' }} />;
}

function Copy({ text, label, done }: { text: string; label: string; done: string }): ReactNode {
  const [copied, setCopied] = useState(false);
  return (
    <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <code dir="ltr" style={{ fontSize: 13 }}>{text}</code>
      <Button variant="ghost" size="sm" onClick={() => void navigator.clipboard?.writeText(text).then(() => setCopied(true))}>{copied ? done : label}</Button>
    </span>
  );
}

export function Settings(): ReactNode {
  const locale = useLocaleTag();
  const w = pageWords(locale);
  const places = hooks.useRecords('places', { pageSize: 50 });
  const write = hooks.useWrite('places');
  const [apps, setApps] = useState<readonly string[] | null>(null);
  const [appKey, setAppKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [how, setHow] = useState(false);
  const [testing, setTesting] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [refused, setRefused] = useState(false);
  const [said, setSaid] = useState<'saved' | 'failed' | null>(null);

  useEffect(() => {
    let live = true;
    api.get<unknown>('/api/v1/add-ons').then((reply) => { if (live) setApps(appsOf(reply)); }, () => { if (live) setApps([]); });
    return () => { live = false; };
  }, []);

  const rows = places.rows as readonly DataRow[];
  const choices = useMemo(() => [...new Set([...(apps ?? []), ...rows.map((row) => String(row['app'] ?? '')).filter((one) => one !== '')])], [apps, rows]);
  const chosen = appKey ?? choices[0] ?? null;
  const row = rows.find((one) => one['app'] === chosen) ?? null;
  const rowKey = row === null ? null : String(row['id']);
  // The form starts over from what is stored whenever another app, or another stored row, is chosen.
  useEffect(() => { setDraft(draftOf(row)); setTesting(false); setPressed(false); setRefused(false); }, [chosen, rowKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (places.loading || apps === null || draft === null) return <PageSurface width="content"><Skeleton height={44} /></PageSurface>;
  const change = (next: Partial<Draft>): void => { setDraft(edited(draft, next)); setSaid(null); setTesting(false); setPressed(false); setRefused(false); };
  const usable = canUse(draft);
  const origin = window.location.origin;
  const set = usable && row !== null;
  const show: ShowMessage = { channel: CHANNEL, event: 'show', placeId: draft.place_id.trim(), browserKey: draft.browser_key.trim(), language: locale };
  const save = async (): Promise<void> => {
    if (chosen === null || !usable) return;
    const values = { place_id: draft.place_id.trim(), browser_key: draft.browser_key.trim(), restricted: draft.restricted, on_booking: draft.on_booking, on_reviews: draft.on_reviews, on_site: draft.on_site };
    try {
      if (row === null) await write.create({ app: chosen, ...values });
      else await write.update(String(row['id']), values);
      setSaid('saved');
      places.refetch();
    } catch {
      setSaid('failed');
    }
  };
  const where: [keyof Draft, string, string][] = [['on_booking', w.booking, w.bookingSub], ['on_reviews', w.reviews, w.reviewsSub], ['on_site', w.site, w.siteSub]];

  return (
    <PageSurface width="content">
      <PageActions title={w.title} documentTitle={w.title} subtitle={set ? w.ready : w.notSet} />
      <div style={{ display: 'grid', gap: 16 }}>
        <p style={muted}>{w.intro}</p>
        <p style={muted}>{w.notAffiliated}</p>
        {chosen === null ? <Alert tone="info" title={w.noApp} /> : null}
        {choices.length > 1 ? (
          <label style={{ display: 'grid', gap: 4, maxWidth: 280 }}>
            <span style={h2}>{w.app}</span>
            <select value={chosen ?? ''} onChange={(event: ChangeEvent<HTMLSelectElement>) => setAppKey(event.target.value)}>{choices.map((one) => <option key={one} value={one}>{one}</option>)}</select>
          </label>
        ) : null}
        <section style={card}>
          <Input label={w.placeLabel} value={draft.place_id} dir="ltr" onChange={(event: ChangeEvent<HTMLInputElement>) => change({ place_id: event.target.value })} error={draft.place_id !== '' && !isPlaceId(draft.place_id) ? w.placeBad : undefined} />
          <div><Button variant="ghost" size="sm" aria-expanded={how} onClick={() => setHow(!how)}>{w.how}</Button></div>
          {how ? (
            <div style={{ display: 'grid', gap: 6 }}>
              <ol style={{ margin: 0, paddingInlineStart: 20 }}><li>{w.how1}</li><li>{w.how2}</li><li>{w.how3}</li></ol>
              <a href="https://developers.google.com/maps/documentation/places/web-service/place-id" target="_blank" rel="noopener noreferrer">{w.finder}</a>
            </div>
          ) : null}
        </section>
        <section style={card}>
          <Input label={w.keyLabel} hint={w.keyHelp} value={draft.browser_key} dir="ltr" onChange={(event: ChangeEvent<HTMLInputElement>) => change({ browser_key: event.target.value })} error={draft.browser_key !== '' && !isBrowserKey(draft.browser_key) ? w.keyBad : undefined} />
          <div style={{ display: 'grid', gap: 8 }}>
            <h3 style={h2}>{w.required} · {w.restrictTitle}</h3>
            <p style={muted}>{w.restrictBody}</p>
            {keyChips(origin).map((chip) => <Copy key={chip} text={chip} label={w.copy} done={w.copied} />)}
            <p style={muted}>{w.chipsNote}</p>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={draft.restricted} onChange={() => change({ restricted: !draft.restricted })} />{w.restrictedTick}</label>
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            <h3 style={h2}>{w.guardTitle}</h3>
            <ul style={{ margin: 0, paddingInlineStart: 20, fontSize: 13 }}><li>{w.guardApis}</li><li>{w.guardQuota}</li></ul>
            <p style={muted}>{w.bill}</p>
          </div>
        </section>
        <section style={card}>
          <h2 style={h2}>{w.whereTitle}</h2>
          {where.map(([column, name, sub]) => (
            <label key={column} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <input type="checkbox" checked={draft[column] as boolean} onChange={() => change({ [column]: !draft[column] })} />
              <span><span style={{ display: 'block' }}>{name}</span><span style={muted}>{sub}</span></span>
            </label>
          ))}
        </section>
        <section style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ ...h2, flex: 1 }}>{w.testTitle}</h2>
            <Button variant="secondary" disabled={!usable} onClick={() => { setTesting(true); setPressed(false); setRefused(false); }}>{w.test}</Button>
          </div>
          {!draft.restricted ? <p style={muted}>{w.tickFirst}</p> : null}
          {testing ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <h3 style={h2}>{w.whatSay}</h3>
              {pressed ? <TestBox show={show} title={w.frameTitle} onFailed={() => setRefused(true)} /> : (
                <div style={{ display: 'grid', gap: 6 }}>
                  <div><Button variant="secondary" onClick={() => setPressed(true)}>{w.see}</Button></div>
                  <p style={muted}>{w.nothing}</p>
                </div>
              )}
              {refused ? <Alert tone="warn" title={w.testFailed} role="alert" /> : null}
              <p style={muted}>{w.testNote}</p>
            </div>
          ) : null}
        </section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button variant="primary" disabled={!usable || chosen === null} loading={write.saving} onClick={() => void save()}>{w.save}</Button>
          <span role="status" style={muted}>{said === 'saved' ? w.saved : said === 'failed' ? w.saveFailed : ''}</span>
        </div>
      </div>
    </PageSurface>
  );
}
