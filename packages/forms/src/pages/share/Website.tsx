/**
 * "Put it on your website": the two lines a website pastes, the websites
 * the form shows on, and "Check a website".
 *
 * A form shows in a frame only on a website listed on the Privacy page
 * ("Your websites"); a website not on the list gets a refusal from the
 * browser. "Check a website" answers with the list's own check, so what it
 * says is what the Privacy page would say of the same address.
 */
import { useState, type ReactNode } from 'react';

import { Alert, Button, Card, Divider, Input, Link, Stack, type AddOnTranslate } from '../shared/host.ts';
import { checkSite, formLine, hostOf, loaderLine, WEBSITES_AT } from './links.ts';
import { CardTitle, Icon, MARK, sentence, useCopy } from './parts.tsx';

function Line({ text, copyLabel, onCopy, t }: { text: string; copyLabel: string; onCopy: () => void; t: AddOnTranslate }): ReactNode {
  return (
    <div className="flex items-center gap-2 rounded-[10px] border border-border bg-surface-2 py-1.5 ps-3 pe-1.5">
      <code dir="ltr" className="min-w-0 flex-1 text-start font-mono text-[12px] [overflow-wrap:anywhere]">
        {text}
      </code>
      <Button variant="secondary" size="sm" aria-label={copyLabel} iconLeft={<Icon name="copy" small />} onClick={onCopy}>
        {t('share.copy', 'Copy')}
      </Button>
    </div>
  );
}

function Answer({ t, typed, self, listed }: { t: AddOnTranslate; typed: string; self: string | null; listed: readonly string[] }): ReactNode {
  const answer = checkSite(typed, { self, listed });
  if (answer === null) return null;
  const host = (
    <bdi dir="ltr" className="font-mono">
      {answer.host}
    </bdi>
  );
  switch (answer.verdict) {
    case 'listed':
      return <Alert tone="pos" title={sentence(t('share.check.listed', '{host} is one of your websites. The form shows there.', { host: MARK.a }), { a: host })} />;
    case 'unlisted':
      return (
        <Alert
          tone="warn"
          title={sentence(t('share.check.unlisted', "{host} isn't one of your websites: add it in {privacy}.", { host: MARK.a, privacy: MARK.b }), {
            a: host,
            b: <Link to={WEBSITES_AT}>{t('share.check.privacy', 'Privacy & public pages')}</Link>,
          })}
        />
      );
    case 'self':
      return <Alert tone="info" title={sentence(t('share.check.self', "{host} is this server's own address: the form's link opens there.", { host: MARK.a }), { a: host })} />;
    case 'not-https':
      return <Alert tone="warn" title={t('share.check.notHttps', 'Only a website on https:// can show the form.')} />;
    case 'not-address':
      return <Alert tone="warn" title={t('share.check.notAddress', "That isn't a website address.")} />;
  }
}

export function WebsiteCard({ t, publicOrigin, slug, websites }: { t: AddOnTranslate; publicOrigin: string; slug: string; websites: readonly string[] }): ReactNode {
  const copy = useCopy(t);
  const [typed, setTyped] = useState('');
  const loader = loaderLine(publicOrigin);
  const place = formLine(slug);
  return (
    <Card title={<CardTitle icon="code-xml">{t('share.website.title', 'Put it on your website')}</CardTitle>} description={t('share.website.body', 'Paste these two lines where the form should show.')}>
      <Stack gap="md">
        <Stack gap="sm">
          <Line t={t} text={loader} copyLabel={t('share.website.copyLoader', 'Copy the loader line')} onCopy={() => copy(loader, t('share.toast.loader', 'Loader line copied.'))} />
          <Line t={t} text={place} copyLabel={t('share.website.copyForm', 'Copy the form line')} onCopy={() => copy(place, t('share.toast.form', 'Form line copied.'))} />
        </Stack>
        <div className="flex flex-wrap items-center gap-2 text-[12.5px]" data-testid="share-shows-on">
          <span className="font-bold">{t('share.website.showsOn', 'Shows on:')}</span>
          {websites.length === 0 ? (
            <span className="text-fg-muted">{t('share.website.none', 'No website is listed yet.')}</span>
          ) : (
            websites.map((origin) => (
              <span key={origin} dir="ltr" className="inline-flex h-6 items-center gap-1.5 rounded-md bg-surface-3 px-2 font-mono text-[11.5px]">
                <Icon name="globe" small />
                {hostOf(origin)}
              </span>
            ))
          )}
        </div>
        <Divider />
        <Stack gap="sm">
          <div className="max-w-[360px]">
            <Input label={t('share.check.label', 'Check a website')} value={typed} onChange={(event) => setTyped(event.target.value)} dir="ltr" placeholder="events.meridian.example" />
          </div>
          <div aria-live="polite">
            <Answer t={t} typed={typed} self={publicOrigin} listed={websites} />
          </div>
        </Stack>
      </Stack>
    </Card>
  );
}
