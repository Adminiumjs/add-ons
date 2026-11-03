/**
 * THE SHARE TAB: how a form reaches people.
 *
 * - "Link": the form's own address, to copy; and, when visitors cannot open
 *   it yet, why, worded from Adminium's reach answer.
 * - "Put it on your website": the two lines, where it shows, and a check of
 *   any website (`Website.tsx`).
 * - "QR code": the link as a code, and as files (`QrCard.tsx`).
 * - "Send by e-mail": a new campaign holding the link, for whoever may send
 *   campaigns.
 *
 * A survey is shared the same way when it keeps no names. A survey that
 * keeps names has no open link: each person gets their own from the rule
 * that invites them, so the tab says so and opens that rule.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { Alert, Button, Card, Link, Skeleton, Stack, api, useAccess, useLocaleTag, useNavigate, useRecords, type AddOnTranslate } from '../shared/host.ts';
import { isAnonymous, jsonOf, type FormRow } from '../shared/row.ts';
import type { TabProps } from '../shared/slot.ts';
import { campaignAt, formLink, PUBLIC_ADDRESS_AT, rulesAt } from './links.ts';
import { CardTitle, Icon, useCopy } from './parts.tsx';
import { QrCard } from './QrCard.tsx';
import { useShareStatus, type ReachState, type ShareStatus } from './status.ts';
import { WebsiteCard } from './Website.tsx';

/** Who may start a campaign: the e-mail screens' own grant, as the forms kit reports it. */
export const MAY_SEND_CAMPAIGNS = 'system:settings:manage';

/** Whether strangers answer a survey by name: what is live, for a live or closed one; the draft's own words for a draft. */
export function keepsNames(form: FormRow): boolean {
  const published = jsonOf(form.published);
  const settings = form.state !== 'draft' && typeof published === 'object' && published !== null && 'settings' in published ? (published as { settings: unknown }).settings : form.settings;
  return !isAnonymous(jsonOf(settings));
}

/** The rules that have sent this survey, by the name each invitation keeps. */
function useRuleNames(form: FormRow): readonly string[] {
  const access = useAccess();
  const read = useRecords('invitations', {
    filter: [
      { column: 'form_id', op: 'eq', value: form.id },
      { column: 'rule_name', op: 'notEmpty' },
    ],
    columns: ['id', 'rule_name'],
    pageSize: 199,
    enabled: access.ready && access.canRead('invitations'),
  });
  const names = read.rows.map((row) => row['rule_name']).filter((name): name is string => typeof name === 'string' && name !== '');
  const key = [...new Set(names)].join('\n');
  return useMemo(() => (key === '' ? [] : key.split('\n')), [key]);
}

/** Each rule's id by its name, for a reader who may open the rules; `refused` for one who may not. */
function useRuleIds(asked: boolean): { ids: ReadonlyMap<string, string> | null; refused: boolean } {
  const [state, setState] = useState<{ ids: ReadonlyMap<string, string> | null; refused: boolean }>({ ids: null, refused: false });
  useEffect(() => {
    if (!asked) return undefined;
    let live = true;
    api.get<{ rules?: readonly { id?: unknown; name?: unknown }[] }>('/api/v1/automations').then(
      (reply) => {
        const ids = new Map<string, string>();
        for (const rule of reply.rules ?? []) if (typeof rule.id === 'string' && typeof rule.name === 'string' && !ids.has(rule.name)) ids.set(rule.name, rule.id);
        if (live) setState({ ids, refused: false });
      },
      () => {
        if (live) setState({ ids: null, refused: true });
      },
    );
    return () => {
      live = false;
    };
  }, [asked]);
  return state;
}

/** Why visitors cannot open the link, from the reach answer; null when they can. */
function reachLine(t: AddOnTranslate, hasLink: boolean, reach: ReachState | null): { words: string; fix: boolean } | null {
  if (reach === 'network-off' || reach === 'desktop') return { words: t('share.reach.off', "This server doesn't serve public pages, so visitors can't open this link."), fix: false };
  if (!hasLink) {
    // TODO(0.3.41): only an Adminium without the status read leaves both unsaid.
    if (reach === null) return { words: t('share.link.older', 'This Adminium cannot show the link here yet. It shows once Adminium is updated.'), fix: false };
    return { words: t('share.reach.notSet', 'This server has no public address yet, so the form has no link.'), fix: true };
  }
  if (reach === null || reach === 'reachable') return null;
  if (reach === 'proxy-hidden') return { words: t('share.reach.proxy', "Visitors can't send this form yet: this server is behind a proxy that hides their addresses. Ask whoever runs Adminium to fix it."), fix: false };
  return { words: t('share.reach.address', "Visitors can't open this link: the server's public address must be an https address on the internet."), fix: true };
}

function ReachWarning({ t, line }: { t: AddOnTranslate; line: { words: string; fix: boolean } }): ReactNode {
  const access = useAccess();
  // TODO(0.3.41): the forms kit reports this grant from 0.3.41; before it, everyone is asked to ask.
  const maySet = access.has(MAY_SEND_CAMPAIGNS);
  const fix = !line.fix ? undefined : maySet ? <Link to={PUBLIC_ADDRESS_AT}>{t('share.reach.setIt', 'Set the public address')}</Link> : <span>{t('share.reach.ask', 'Ask whoever runs Adminium to set it.')}</span>;
  return <Alert tone="warn" title={line.words} {...(fix === undefined ? {} : { body: fix })} />;
}

function LinkCard({ t, form, status, link, rules }: { t: AddOnTranslate; form: FormRow; status: ShareStatus; link: string | null; rules: readonly string[] }): ReactNode {
  const copy = useCopy(t);
  const locale = useLocaleTag();
  const survey = form.kind === 'survey';
  const note =
    form.state === 'draft'
      ? survey
        ? t('share.link.draftSurvey', 'The link works once the survey is published.')
        : t('share.link.draft', 'The link works once the form is published.')
      : survey
        ? t('share.link.anonymous', 'This link takes answers without a name.')
        : t('share.link.note', "Anyone with the link can open the form while it's live.");
  const reach = reachLine(t, link !== null, status.reach);
  return (
    <Card title={<CardTitle icon="link">{t('share.link.title', 'Link')}</CardTitle>}>
      <Stack gap="sm">
        <div className="flex gap-2">
          <input
            readOnly
            dir="ltr"
            value={link ?? ''}
            aria-label={survey ? t('share.link.labelSurvey', 'Link to the survey') : t('share.link.label', 'Link to the form')}
            onFocus={(event) => event.currentTarget.select()}
            className="h-[38px] min-w-0 flex-1 rounded-[10px] border border-border-strong bg-surface-2 px-3 font-mono text-[12.5px] text-fg"
          />
          <Button variant="primary" iconLeft={<Icon name="copy" />} disabled={link === null} onClick={() => link !== null && copy(link, t('share.toast.link', 'Link copied.'))}>
            {t('share.copy', 'Copy')}
          </Button>
        </div>
        {link === null ? null : <span className="text-[12.5px] text-fg-muted">{note}</span>}
        {survey && rules.length > 0 ? <span className="text-[12.5px] text-fg-muted">{t('share.link.alsoRules', 'Rules that also send it: {rules}.', { rules: new Intl.ListFormat(locale, { type: 'conjunction' }).format(rules) })}</span> : null}
        {reach === null ? null : <ReachWarning t={t} line={reach} />}
      </Stack>
    </Card>
  );
}

function MailCard({ t, link }: { t: AddOnTranslate; link: string }): ReactNode {
  const access = useAccess();
  const navigate = useNavigate();
  // TODO(0.3.41): the forms kit reports this grant from 0.3.41; before it, the button stays off.
  const may = access.has(MAY_SEND_CAMPAIGNS);
  const target = campaignAt(link);
  return (
    <Card title={<CardTitle icon="mail">{t('share.mail.title', 'Send by e-mail')}</CardTitle>}>
      <Stack gap="sm" align="start">
        <span className="text-body-sm text-fg-muted">{t('share.mail.body', 'Opens a new campaign with the link in it. Nothing is sent until you send the campaign.')}</span>
        <Button variant="secondary" iconLeft={<Icon name="mail" />} disabled={!may || target === null} onClick={() => target !== null && void navigate(target)}>
          {t('share.mail.button', 'Send by e-mail')}
        </Button>
        {target === null ? (
          <span className="text-caption text-fg-muted">{t('share.mail.notHttps', 'A campaign can carry only an https:// link.')}</span>
        ) : !may ? (
          <span className="text-caption text-fg-muted">{t('share.mail.cannot', "Campaigns are sent by people who may change Adminium's settings. Ask one of them.")}</span>
        ) : null}
      </Stack>
    </Card>
  );
}

/** A survey that keeps names: no open link, only the rule that invites each person. */
function NamedSurveyCard({ t, rules }: { t: AddOnTranslate; rules: readonly string[] }): ReactNode {
  const navigate = useNavigate();
  const { ids, refused } = useRuleIds(true);
  let action: ReactNode = null;
  if (refused) {
    action =
      rules.length === 0 ? (
        <span className="text-caption text-fg-muted">{t('share.survey.askRule', 'Ask someone who manages automation rules to make one that sends it.')}</span>
      ) : (
        rules.map((name) => (
          <span key={name} className="text-body-sm text-fg">
            {t('share.survey.sentBy', 'Sent by the rule "{name}".', { name })}
          </span>
        ))
      );
  } else if (ids !== null) {
    action =
      rules.length === 0 ? (
        <Button variant="secondary" iconLeft={<Icon name="workflow" />} onClick={() => void navigate(rulesAt())}>
          {t('share.survey.makeRule', 'Make a rule that sends it')}
        </Button>
      ) : (
        rules.map((name) => (
          <Button key={name} variant="secondary" iconLeft={<Icon name="mail" />} onClick={() => void navigate(rulesAt(ids.get(name)))}>
            {t('share.survey.openRule', 'Open the rule "{name}"', { name })}
          </Button>
        ))
      );
  }
  return (
    <Card title={<CardTitle icon="mail">{t('share.mail.title', 'Send by e-mail')}</CardTitle>}>
      <Stack gap="sm" align="start">
        <span className="text-body-sm text-fg-muted">{t('share.survey.named', 'Survey invitations go out from a rule, so each person gets their own link and shows up under Invitations.')}</span>
        {action}
      </Stack>
    </Card>
  );
}

export function Share({ t, form }: TabProps): ReactNode {
  const { status, failed, retry } = useShareStatus();
  const rules = useRuleNames(form);
  const named = form.kind === 'survey' && keepsNames(form);

  if (named) {
    // Nothing of the status is shown: there is no open link to put anywhere.
    return (
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.4fr_1fr]" data-testid="share">
        <div className="flex min-w-0 flex-col gap-4">
          <NamedSurveyCard t={t} rules={rules} />
        </div>
      </div>
    );
  }
  if (failed) {
    return (
      <Alert
        tone="danger"
        role="alert"
        title={t('shared.failed.title', 'This could not be loaded')}
        action={
          <Button variant="secondary" size="sm" onClick={() => retry()}>
            {t('shared.retry', 'Try again')}
          </Button>
        }
      />
    );
  }
  if (status === null) {
    return (
      <Stack gap="sm">
        <span role="status" className="sr-only">
          {t('shared.loading', 'Loading')}
        </span>
        <Skeleton height={120} />
        <Skeleton height={120} />
      </Stack>
    );
  }

  const link = formLink(status.publicOrigin, form.slug);
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.4fr_1fr]" data-testid="share">
      <div className="flex min-w-0 flex-col gap-4">
        <LinkCard t={t} form={form} status={status} link={link} rules={rules} />
        {link === null || status.publicOrigin === null ? null : <WebsiteCard t={t} publicOrigin={status.publicOrigin} slug={form.slug} websites={status.websites} />}
      </div>
      {link === null ? null : (
        <div className="flex min-w-0 flex-col gap-4">
          <QrCard t={t} link={link} slug={form.slug} />
          <MailCard t={t} link={link} />
        </div>
      )}
    </div>
  );
}
