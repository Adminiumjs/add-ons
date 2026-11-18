/**
 * PUBLISHING, AS FORMS PUBLISHES (D65; comp 650-722, `States` 604-639).
 *
 * - What keeps a page from working is said above the canvas, in Forms' own
 *   words (`BlockedCards`): the privacy notice unset (Publish stays off until
 *   it is set), strangers unable to reach the public pages (a page is still
 *   published, and the editor says nobody can reach it yet), or a proxy
 *   Adminium cannot see behind.
 * - Publish opens a small panel: on a draft, "Publish this page?" with its
 *   address and "Publish now"; on a live page its address, Copy, Open and the
 *   changes to publish; on a page that is off, what visitors see. Live and off
 *   end with "Show this page".
 * - Publishing copies the working copy into the published one and sets the
 *   page live, in one write; Update does the same for a live page. The editor
 *   checks first what Adminium's seal would refuse (Milo's marks, a field the
 *   page cannot be drawn with, the address) and lists it; whatever Adminium
 *   still refuses is said in its words.
 * - Switching off a page that is a pages host's home asks first (D-M6-1): the
 *   switch stays on until "Switch it off".
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { Alert, Button, Link, type AddOnTranslate } from '../shared/host.ts';
import { PRIVACY } from '../shared/paths.ts';
import { Icon } from './Canvas.tsx';
import type { Page, Problem } from './doc.ts';
import { readStatus, type LandingStatus } from './engine.ts';
import { problemWords, whereOf } from './words.ts';

/** The status of the page, read when the editor opens and again after each publish. */
export function useLandingStatus(pageKey: string): { status: LandingStatus | null; loaded: boolean; refetch: () => Promise<void> } {
  const [status, setStatus] = useState<LandingStatus | null>(null);
  const [loaded, setLoaded] = useState(false);
  const live = useRef(true);
  const refetch = useCallback(async () => {
    try {
      const read = await readStatus(pageKey);
      if (live.current) setStatus(read);
    } catch {
      // An Adminium without the read, or a reader it refuses: no card shows and nothing is blocked here (Adminium still refuses).
      if (live.current) setStatus(null);
    } finally {
      if (live.current) setLoaded(true);
    }
  }, [pageKey]);
  useEffect(() => {
    live.current = true;
    void refetch();
    return () => {
      live.current = false;
    };
  }, [refetch]);
  return { status, loaded, refetch };
}

const NO_ADDRESS = new Set(['not-set', 'this-computer', 'private-network', 'dot-local', 'not-https']);

/** Why strangers cannot reach the public pages, as Forms' builder words it, and what fixes it. */
export function reachWords(t: AddOnTranslate, state: string): { a: string; note: ReactNode } {
  if (state === 'network-off') return { a: t('editor.block.off', 'Public pages are switched off on this server.'), note: t('editor.block.offFix', 'Set ADMINIUM_NETWORK_FEATURES=on on the server, restart it, then check again.') };
  if (state === 'desktop') return { a: t('editor.block.desktop', 'This server runs on this computer only.'), note: t('editor.block.desktopFix', 'Run Adminium on a server with a public https address to show pages to visitors.') };
  if (state === 'proxy-hidden') return { a: t('editor.block.proxy', 'This server is behind a proxy that hides visitors’ addresses.'), note: t('editor.block.proxyFix', 'Ask whoever runs this server to set ADMINIUM_TRUST_PROXY=on and restart.') };
  if (NO_ADDRESS.has(state))
    return {
      a: t('editor.block.noAddress', 'This server has no public https address.'),
      note: (
        <>
          {t('editor.block.noAddressFix', 'Pages, forms and chat need one. Set it in')} <Link to={PRIVACY}>{t('editor.block.privacyLink', 'Privacy & public pages')}</Link>
        </>
      ),
    };
  return { a: t('editor.block.unreached', 'Visitors can’t reach this server’s public pages.'), note: <Link to={PRIVACY}>{t('editor.block.privacyLink', 'Privacy & public pages')}</Link> };
}

/** What keeps the page from working, above the canvas. */
export function BlockedCards({ t, status }: { t: AddOnTranslate; status: LandingStatus | null }): ReactNode {
  if (status === null) return null;
  const reach = status.reach.state === 'reachable' ? null : reachWords(t, status.reach.state);
  return (
    <>
      {status.notice ? null : (
        <Alert
          tone="warn"
          role="alert"
          title={
            <>
              {t('editor.block.notice', 'Set your privacy notice first')} (<Link to={PRIVACY}>{t('editor.block.privacyLink', 'Privacy & public pages')}</Link>).
            </>
          }
          body={t('editor.block.noticeNote', 'Every public page links to it in the footer. Publish stays off until it is set.')}
        />
      )}
      {reach === null ? null : <Alert tone="danger" role="alert" title={`${reach.a} ${t('editor.block.pageB', 'Visitors can’t open this page.')}`} body={reach.note} />}
      {reach === null && status.reach.proxyUnchecked ? <Alert tone="info" role="status" title={t('editor.block.proxyUnchecked', 'If visitors reach this server through a proxy or a load balancer, they will see “not available” until the server is told to trust it. Your host’s guide says how.')} /> : null}
    </>
  );
}

/** The page's address to show: its canonical one, else the first it answers on, else its path. */
export function addressOf(status: LandingStatus | null, slug: string): string {
  const page = status?.page;
  return page?.canonical ?? page?.addresses[0]?.url ?? `/x/pages/${slug}`;
}

/** "Show this page": a switch, with the question first when the page is a host's home (D-M6-1). */
export function ShowSwitch({ t, id, on, homeOf, mayMove, onTurn }: { t: AddOnTranslate; id: string; on: boolean; homeOf: readonly string[]; mayMove: boolean; onTurn: (on: boolean) => void }): ReactNode {
  const [asking, setAsking] = useState(false);
  const confirm = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (asking) confirm.current?.focus();
  }, [asking]);
  const keep = (): void => {
    setAsking(false);
    toggle.current?.focus();
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="flex min-w-0 flex-1 flex-col">
          <span id={`${id}-label`} className="text-[13px] font-bold">
            {t('editor.show.label', 'Show this page')}
          </span>
          <span className="text-[12px] text-fg-muted">{on ? t('editor.show.on', 'Visitors can open it at its address.') : t('editor.show.off', 'Visitors see “This page isn’t available.”')}</span>
        </span>
        <button
          ref={toggle}
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby={`${id}-label`}
          disabled={!mayMove}
          data-lpe-switch=""
          onClick={() => {
            if (on && homeOf.length > 0) setAsking(true);
            else onTurn(!on);
          }}
        >
          <span className="sr-only">{on ? t('editor.show.isOn', 'On') : t('editor.show.isOff', 'Off')}</span>
        </button>
      </div>
      {asking ? (
        <div
          ref={confirm}
          role="alertdialog"
          aria-labelledby={`${id}-confirm`}
          tabIndex={-1}
          data-lpe-confirm=""
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              keep();
            }
          }}
        >
          <p id={`${id}-confirm`} className="m-0 text-[13px]">
            {t('editor.show.home', 'This page is the home of {hosts}. Switch it off and visitors there see “This page isn’t available.”', { hosts: homeOf.join(', ') })}
          </p>
          <span className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={keep}>
              {t('editor.show.keep', 'Keep it on')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setAsking(false);
                onTurn(false);
              }}
            >
              {t('editor.show.switchOff', 'Switch it off')}
            </Button>
          </span>
        </div>
      ) : null}
    </div>
  );
}

export interface PublishPanelProps {
  t: AddOnTranslate;
  state: 'draft' | 'live' | 'off';
  slug: string;
  status: LandingStatus | null;
  page: Page;
  /** The working copy says something the published one does not. */
  changes: boolean;
  busy: boolean;
  mayPublish: boolean;
  mayMove: boolean;
  /** What the last check found; null before one. */
  problems: readonly Problem[] | null;
  refused: string | null;
  onPublish: () => void;
  onTurn: (on: boolean) => void;
  onShow: (problem: Problem) => void;
  onCopy: (address: string) => void;
}

export function PublishPanel({ t, state, slug, status, page, changes, busy, mayPublish, mayMove, problems, refused, onPublish, onTurn, onShow, onCopy }: PublishPanelProps): ReactNode {
  const address = addressOf(status, slug);
  const reachable = status === null ? null : status.reach.state === 'reachable';
  const noticeUnset = status?.notice === false;
  const head = (tile: string, icon: string, title: string, line: string): ReactNode => (
    <div className="flex items-center gap-3">
      <span data-lpe-tile={tile}>
        <Icon name={icon} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[14.5px] font-bold">{title}</span>
        <span className="text-[12px] text-fg-muted">{line}</span>
      </span>
    </div>
  );
  const shown = (
    <div data-lpe-address="">
      <bdi dir="ltr">{address}</bdi>
    </div>
  );
  const unreached = reachable === false ? <p data-lpe-note="">{t('editor.publish.unreached', 'Visitors can’t reach it yet: see the note above the page.')}</p> : null;

  return (
    <div data-lpe-pop="">
      {problems !== null && problems.length > 0 ? (
        <div className="flex flex-col gap-2">
          {head('warn', 'circle-alert', t('editor.publish.notReady', 'Not ready to publish'), t('editor.publish.fixFirst', 'Fix these first. Nothing was published.'))}
          <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label={t('editor.publish.toFix', 'What to fix')}>
            {problems.map((problem, index) => (
              <li key={String(index)} className="flex flex-col gap-1">
                <span className="text-[11.5px] font-bold text-fg-subtle">{whereOf(t, problem, page)}</span>
                <span className="text-[13px]">{problemWords(t, problem)}</span>
                <span>
                  <Button variant="link" size="sm" onClick={() => onShow(problem)}>
                    {t('editor.publish.show', 'Show me')}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {refused === null ? null : (
        <p data-lpe-alert="" role="alert">
          <Icon name="circle-alert" />
          <span>{refused}</span>
        </p>
      )}
      {state === 'draft' ? (
        <>
          {head('accent', 'globe', t('editor.publish.ready', 'Publish this page?'), t('editor.publish.readyLine', 'It goes live at this address.'))}
          {shown}
          {unreached}
          {noticeUnset ? <p data-lpe-note="">{t('editor.publish.notice', 'Set your privacy notice first. The page stays a draft until then.')}</p> : null}
          {mayPublish ? (
            <Button variant="primary" loading={busy} disabled={noticeUnset} onClick={onPublish}>
              {t('editor.publish.now', 'Publish now')}
            </Button>
          ) : null}
        </>
      ) : null}
      {state === 'live' ? (
        <>
          {head('pos', 'circle-check', t('editor.publish.live', 'Live'), reachable === false ? t('editor.publish.liveUnreached', 'Published, but visitors can’t reach it yet.') : t('editor.publish.liveLine', 'Anyone with the address can open it.'))}
          <div className="flex flex-col gap-1.5">
            <span data-lpe-micro="">{t('editor.publish.liveAt', 'Live at')}</span>
            {shown}
            <span className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" iconLeft={<Icon name="copy" />} onClick={() => onCopy(address)}>
                {t('editor.publish.copy', 'Copy')}
              </Button>
              {address.startsWith('https:') ? (
                <a href={address} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-accent">
                  <Icon name="external-link" />
                  {t('editor.publish.open', 'Open')}
                </a>
              ) : null}
            </span>
          </div>
          {changes ? (
            mayPublish ? (
              <Button variant="primary" loading={busy} disabled={noticeUnset} onClick={onPublish}>
                {t('editor.publish.changes', 'Publish the changes')}
              </Button>
            ) : null
          ) : (
            <p data-lpe-note="">{t('editor.publish.same', 'Visitors see the page as it is here.')}</p>
          )}
        </>
      ) : null}
      {state === 'off' ? (
        <>
          {head('muted', 'eye-off', t('editor.publish.off', 'Off'), t('editor.publish.offLine', 'Visitors see “This page isn’t available.”'))}
          {shown}
        </>
      ) : null}
      {state === 'draft' ? null : <ShowSwitch t={t} id="lpe-pop-show" on={state === 'live'} homeOf={status?.page?.homeOf ?? []} mayMove={mayMove} onTurn={onTurn} />}
    </div>
  );
}
