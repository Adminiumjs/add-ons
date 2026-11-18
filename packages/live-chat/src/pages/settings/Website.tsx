/**
 * PUTTING THE CHAT ON A WEBSITE (comp 3a/3b "Put it on your website", 3d).
 *
 * The one line a website pastes: Adminium's loader, told which chat to draw
 * (`data-adminium-chat`), from this server's public address. In its place,
 * whatever keeps the chat off a website, each in a card of its own, worded
 * from the reason Adminium gives, as the forms builder words them:
 * - no privacy notice: the chat's first line links to it;
 * - strangers cannot reach this server (each reach state its own words),
 *   and a doubt about the proxy in front of it;
 * - no mail goes out: e-mail replies to a visitor who left wait;
 * - new chats paused by the breaker, with Resume.
 *
 * "Try the chat" opens the window as it is set now, writing nothing.
 */
import { useState, type ReactNode } from 'react';

import { Button, Link, Sheet, SheetBody, SheetHeader, useAppToasts, type AddOnTranslate } from '../shared/host.ts';
import { Icon } from '../shared/parts.tsx';
import { ADD_ON, PRIVACY, EMAIL_SETTINGS } from '../shared/paths.ts';
import { hostOf, snippetOf, type ChatStatus } from './status.ts';
import { Section, SectionTitle } from './parts.tsx';

const NO_ADDRESS = new Set(['not-set', 'this-computer', 'private-network', 'dot-local', 'not-https']);

/** Why strangers cannot open the chat, and what fixes it: the reach state's own words. */
export function reachWords(t: AddOnTranslate, state: string): { title: string; text: string; link: 'privacy' | null } {
  if (state === 'network-off') return { title: t('settings.block.off', 'Public pages are switched off on this server.'), text: t('settings.block.offFix', 'Set ADMINIUM_NETWORK_FEATURES=on on the server, restart it, then check again.'), link: null };
  if (state === 'desktop') return { title: t('settings.block.desktop', 'This server runs on this computer only.'), text: t('settings.block.desktopFix', 'Run Adminium on a server with a public https address to chat with visitors.'), link: null };
  if (state === 'proxy-hidden') return { title: t('settings.block.proxy', 'This server is behind a proxy that hides visitors’ addresses, so limits on the chat can’t work.'), text: t('settings.block.proxyFix', 'Ask whoever runs this server to set ADMINIUM_TRUST_PROXY=on and restart.'), link: null };
  if (NO_ADDRESS.has(state)) return { title: t('settings.block.noAddress', 'This server has no public https address.'), text: t('settings.block.noAddressFix', 'Forms, chat and unsubscribe links need one. Set it in Privacy and public pages.'), link: 'privacy' };
  return { title: t('settings.block.unreached', 'Visitors can’t reach this server’s public pages.'), text: t('settings.block.unreachedFix', 'Check the address in Privacy and public pages.'), link: 'privacy' };
}

function Blocked({ t, title, text, link }: { t: AddOnTranslate; title: string; text: string; link: ReactNode }): ReactNode {
  return (
    <section role="alert" className="flex items-start gap-3.5 rounded-[14px] border border-border-strong bg-surface p-5 shadow-sm">
      <span aria-hidden="true" className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-warn-soft text-warn">
        <Icon name="lock" />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-fg-subtle">{t('settings.embed.title', 'Put it on your website')}</span>
        <h3 className="m-0 text-[14.5px] font-bold tracking-[-0.01em]">{title}</h3>
        <p className="m-0 text-[12.5px] leading-normal text-fg-muted">{text}</p>
        {link === null ? null : <span className="mt-1 text-[13px] font-bold">{link}</span>}
      </div>
    </section>
  );
}

export function Website({ t, status, pausedUntil, mayResume, onResume, locale }: { t: AddOnTranslate; status: ChatStatus | null; pausedUntil: string | null; mayResume: boolean; onResume: () => Promise<void>; locale: string }): ReactNode {
  const toasts = useAppToasts();
  const [trying, setTrying] = useState(false);
  const privacyLink = <Link to={PRIVACY}>{t('settings.block.privacyLink', 'Open Privacy and public pages')}</Link>;

  const cards: ReactNode[] = [];
  if (status !== null && status.notice === false) cards.push(<Blocked key="notice" t={t} title={t('settings.block.notice', 'Set your privacy notice first.')} text={t('settings.block.noticeText', 'The chat links to your privacy notice in its first line, so it can’t go on your website without one.')} link={privacyLink} />);
  if (status?.reach !== null && status?.reach !== undefined && status.reach !== 'reachable') {
    const words = reachWords(t, status.reach);
    cards.push(<Blocked key="reach" t={t} title={words.title} text={words.text} link={words.link === null ? null : privacyLink} />);
  }
  if (status?.mail !== null && status?.mail !== undefined)
    cards.push(
      <Blocked
        key="mail"
        t={t}
        title={status.mail === 'no-public-origin' ? t('settings.block.mailAddress', 'No mail goes out yet: this server has no public address.') : t('settings.block.mailServer', 'No mail goes out yet: no mail server is set.')}
        text={t('settings.block.mailText', 'The chat works, but a reply to a visitor who left the page can’t go by e-mail until it is set.')}
        link={status.mail === 'no-public-origin' ? privacyLink : <Link to={EMAIL_SETTINGS}>{t('settings.block.emailLink', 'Open the e-mail settings')}</Link>}
      />,
    );
  if (pausedUntil !== null) {
    const until = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(pausedUntil));
    cards.push(
      <Blocked
        key="paused"
        t={t}
        title={t('settings.pause.title', 'New chats are paused until {time}.', { time: until })}
        text={t('settings.pause.text', 'More new chats started in an hour than a website usually sees, so new visitors don’t see the chat for now. Chats already going carry on.')}
        link={
          mayResume ? (
            <Button variant="secondary" size="sm" iconLeft={<Icon name="play" />} onClick={() => void onResume()}>
              {t('settings.pause.resume', 'Resume')}
            </Button>
          ) : null
        }
      />,
    );
  }

  const blockedOff = status !== null && (status.notice === false || (status.reach !== null && status.reach !== 'reachable'));
  const origin = status?.publicOrigin ?? null;
  const line = origin === null ? null : snippetOf(origin);
  const copy = async (): Promise<void> => {
    if (line === null) return;
    try {
      await navigator.clipboard.writeText(line);
      toasts.push({ variant: 'success', title: t('settings.embed.copied', 'Copied') } as never);
    } catch {
      toasts.push({ variant: 'error', title: t('settings.embed.copyFailed', 'Couldn’t copy. Select the line and copy it.') } as never);
    }
  };

  return (
    <>
      {blockedOff || line === null ? null : (
        <Section labelledBy="chat-embed-title">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="flex-1">
              <SectionTitle id="chat-embed-title">{t('settings.embed.title', 'Put it on your website')}</SectionTitle>
            </span>
            {status === null || status.websites.length === 0 ? null : (
              <span className="inline-flex items-center gap-1.5 text-[12.5px] text-fg-muted">
                <Icon name="globe" />
                {t('settings.embed.showsOn', 'Shows on:')}
                <Link to={PRIVACY}>
                  <span className="font-mono text-fg">{status.websites.map(hostOf).join(', ')}</span>
                </Link>
              </span>
            )}
          </div>
          <p className="m-0 text-[12.5px] text-fg-muted">{t('settings.embed.paste', 'Paste this line into your website’s pages, just before </body>.')}</p>
          <div className="flex items-center gap-2 rounded-[10px] border border-border bg-surface-2 py-1.5 pe-1.5 ps-3">
            <code dir="ltr" className="min-w-0 flex-1 font-mono text-[12.5px] text-fg [overflow-wrap:anywhere]">
              {line}
            </code>
            <Button variant="secondary" size="sm" iconLeft={<Icon name="copy" />} aria-label={t('settings.embed.copyLabel', 'Copy the loader line')} onClick={() => void copy()}>
              {t('settings.embed.copy', 'Copy')}
            </Button>
          </div>
          {status !== null && status.proxyUnchecked ? <p className="m-0 text-[12.5px] text-fg-muted">{t('settings.block.proxyUnchecked', 'If visitors reach this server through a proxy or a load balancer, they will see “not available” until the server is told to trust it. Your host’s guide says how.')}</p> : null}
          <div>
            <Button variant="secondary" iconLeft={<Icon name="message-circle" />} onClick={() => setTrying(true)}>
              {t('settings.try.open', 'Try the chat')}
            </Button>
          </div>
        </Section>
      )}
      {cards}
      <Sheet open={trying} onOpenChange={setTrying} maxWidth={440}>
        <SheetHeader icon={<Icon name="message-circle" />} title={t('settings.try.open', 'Try the chat')} subtitle={t('settings.try.note', 'As visitors see it now. Nothing you write here is kept.')} closeLabel={t('shared.close', 'Close')} />
        <SheetBody>{trying ? <iframe title={t('settings.try.open', 'Try the chat')} src={`/x/chat/${ADD_ON}?preview=1`} className="h-[560px] w-full rounded-[20px] border border-border" /> : null}</SheetBody>
      </Sheet>
    </>
  );
}
