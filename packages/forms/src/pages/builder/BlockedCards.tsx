/**
 * WHAT KEEPS A FORM FROM WORKING, above the builder (comp 217-228, E4.8):
 *
 * - the privacy notice unset: no form is served without it, and Publish
 *   stays off until it is set;
 * - strangers cannot reach the public pages: worded from the reason
 *   Adminium gives, as the Privacy page's reach card words it;
 * - no mail goes out (no public address, or no mail server): the form takes
 *   answers, but confirmation mails and the e-mails to staff wait.
 */
import type { ReactNode } from 'react';

import { Alert, Link, type AddOnTranslate } from '../shared/host.ts';
import type { FormsStatus } from './status.ts';

/** The Privacy & public pages screen. */
export const PRIVACY = '/studio/privacy';

const NO_ADDRESS = new Set(['not-set', 'this-computer', 'private-network', 'dot-local', 'not-https']);

function reachWords(t: AddOnTranslate, state: string): { a: string; note: ReactNode } {
  if (state === 'network-off') return { a: t('builder.block.off', 'Public pages are switched off on this server.'), note: t('builder.block.offFix', 'Set ADMINIUM_NETWORK_FEATURES=on on the server, restart it, then check again.') };
  if (state === 'desktop') return { a: t('builder.block.desktop', 'This server runs on this computer only.'), note: t('builder.block.desktopFix', 'Run Adminium on a server with a public https address to take answers from visitors.') };
  if (state === 'proxy-hidden') return { a: t('builder.block.proxy', 'This server is behind a proxy that hides visitors’ addresses, so limits on forms can’t work.'), note: t('builder.block.proxyFix', 'Ask whoever runs this server to set ADMINIUM_TRUST_PROXY=on and restart.') };
  if (NO_ADDRESS.has(state))
    return {
      a: t('builder.block.noAddress', 'This server has no public https address.'),
      note: (
        <>
          {t('builder.block.noAddressFix', 'Forms, chat and unsubscribe links need one. Set it in')} <Link to={PRIVACY}>{t('builder.block.privacyLink', 'Privacy & public pages')}</Link>
        </>
      ),
    };
  return { a: t('builder.block.unreached', 'Visitors can’t reach this server’s public pages.'), note: <Link to={PRIVACY}>{t('builder.block.privacyLink', 'Privacy & public pages')}</Link> };
}

export function BlockedCards({ t, status, kind }: { t: AddOnTranslate; status: FormsStatus | null; kind: 'form' | 'survey' }): ReactNode {
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
              {t('builder.block.notice', 'Set your privacy notice first')} (<Link to={PRIVACY}>{t('builder.block.privacyLink', 'Privacy & public pages')}</Link>).
            </>
          }
          body={t('builder.block.noticeNote', 'Publish stays off until it is set.')}
        />
      )}
      {reach === null ? null : <Alert tone="danger" role="alert" title={`${reach.a} ${kind === 'survey' ? t('builder.block.surveyB', 'People can’t open this survey.') : t('builder.block.formB', 'Visitors can’t open this form.')}`} body={reach.note} />}
      {status.mail.blocked === null ? null : (
        <Alert
          tone="warn"
          role="alert"
          title={status.mail.blocked === 'no-public-origin' ? t('builder.block.mailAddress', 'No mail goes out yet: this server has no public address.') : t('builder.block.mailServer', 'No mail goes out yet: no mail server is set.')}
          body={t('builder.block.mailNote', 'Confirmation mails and the e-mails to staff wait until it is set.')}
        />
      )}
    </>
  );
}
