/**
 * A SURVEY'S INVITATIONS (comp 631-649): who it was sent to, and who answered.
 *
 * An invitation is a row the "Send a survey" step of a rule writes, mailed by
 * the add-on's outbox with the person's own link; the link is spent when they
 * answer. Nothing here writes one: this screen reads them, as the reader.
 *
 * The counts are Adminium's (`invited`, `answered`), never counted from the
 * rows. Which rules sent the survey, and as which kind of mail, is read from
 * the newest invitation and from whether any other rule or kind sent one.
 *
 * An open-link survey a rule mails has invitations with no link of their own:
 * whoever answers is not matched to one, so it shows no "Answered".
 */
import { useEffect, useState, type ReactNode } from 'react';

import { Card, DataTable, EmptyState, Link, Pagination, Stack, useAccess, useFormSummary, useLocaleTag, useRead, useRecords, type AddOnTranslate, type DataFilter, type DataRow, type TableColumn } from '../shared/host.ts';
import type { TabProps } from '../shared/slot.ts';
import { Figures, Icon } from './parts.tsx';
import { dateOf, shownOf } from './Results.tsx';
import { surveyOf } from './survey.ts';

/** How many invitations a page shows. */
export const INVITATIONS_PAGE = 25;
/** Where a survey's rules are made and changed. */
export const RULES_AT = '/automations';

type MailKind = 'marketing' | 'service';
const kindOf = (value: unknown): MailKind | null => (value === 'marketing' || value === 'service' ? value : null);

function Figure3({ label, n, positive }: { label: string; n: number; positive?: boolean }): ReactNode {
  return (
    <span className="min-w-0 flex-1" data-part="invitations-count">
      <Card>
        <span className="flex flex-col gap-1">
          <span className="text-[10.5px] font-bold uppercase tracking-wide text-fg-subtle">{label}</span>
          {positive === true ? <span className="font-mono text-[24px] font-bold text-pos">{String(n)}</span> : <span className="font-mono text-[24px] font-bold text-fg">{String(n)}</span>}
        </span>
      </Card>
    </span>
  );
}

/** The kind of mail an invitation went as, as the table and the line say it. */
function mailWords(t: AddOnTranslate, kind: MailKind | null, inSentence: boolean): string {
  if (kind === 'service') return inSentence ? t('surveys.invites.serviceMail', 'service mail') : t('surveys.invites.service', 'Service mail');
  if (kind === 'marketing') return inSentence ? t('surveys.invites.marketingMail', 'marketing mail') : t('surveys.invites.marketing', 'Marketing mail');
  return '';
}

/** The most rules a survey's line counts one by one. */
export const RULES_COUNTED = 8;

interface Senders {
  /** Each rule that sent the survey, the newest first. */
  rules: string[];
  kinds: MailKind[];
}

/**
 * Which rules sent the survey and as which kinds of mail: the newest
 * invitation's rule, then one row of any other rule, and so on, a row a
 * rule; a kind of mail is one row each. Read again when the count changes.
 */
function useSenders(formId: string, invited: number, enabled: boolean): Senders | null {
  const read = useRead();
  const [senders, setSenders] = useState<Senders | null>(null);
  useEffect(() => {
    let gone = false;
    if (!enabled) return undefined;
    const mine: DataFilter = { column: 'form_id', op: 'eq', value: formId };
    void (async () => {
      try {
        const rules: string[] = [];
        for (let i = 0; i < RULES_COUNTED; i += 1) {
          const others = rules.map((rule): DataFilter => ({ column: 'rule_name', op: 'neq', value: rule }));
          const { rows } = await read.list('invitations', { filter: [mine, ...others, { column: 'rule_name', op: 'notEmpty' }], sort: [{ column: 'invited_at', direction: 'desc' }], pageSize: 1, columns: ['id', 'rule_name'] });
          const rule = rows[0]?.['rule_name'];
          if (typeof rule !== 'string' || rule === '') break;
          rules.push(rule);
        }
        const kinds: MailKind[] = [];
        for (const kind of ['marketing', 'service'] as const) {
          const { rows } = await read.list('invitations', { filter: [mine, { column: 'class', op: 'eq', value: kind }], pageSize: 1, columns: ['id'] });
          if (rows.length > 0) kinds.push(kind);
        }
        if (!gone) setSenders(rules.length === 0 && kinds.length === 0 ? null : { rules, kinds });
      } catch {
        // The line is a help, not the screen: without it the table still says everything.
        if (!gone) setSenders(null);
      }
    })();
    return () => {
      gone = true;
    };
  }, [read, formId, invited, enabled]);
  return senders;
}

/** "Invited 41 · Answered 23 · Waiting 18. Sent by the rule Ask about the fit-out as marketing mail." (comp 637). */
function SentBy({ t, invited, answered, open, senders }: { t: AddOnTranslate; invited: number; answered: number; open: boolean; senders: Senders }): ReactNode {
  const counts = open
    ? t('surveys.invites.lineOpen', 'Invited {invited}.', { invited })
    : t('surveys.invites.line', 'Invited {invited} · Answered {answered} · Waiting {waiting}.', { invited, answered, waiting: Math.max(0, invited - answered) });
  const kind = senders.kinds.length > 1 ? t('surveys.invites.bothMails', 'marketing and service mail') : mailWords(t, senders.kinds[0] ?? null, true);
  const one = senders.rules.length === 1 ? senders.rules[0]! : null;
  // The rule's name is a link, set where the sentence puts it in each language.
  const MARK = '\uE000';
  const sentence =
    senders.rules.length === 0
      ? t('surveys.invites.byNoRule', 'Sent as {kind}.', { kind })
      : one !== null
      ? t('surveys.invites.byRule', 'Sent by the rule {rule} as {kind}.', { rule: MARK, kind })
      : senders.rules.length >= RULES_COUNTED
        ? t('surveys.invites.byManyRules', 'Sent by {n} or more rules as {kind}. {rules}', { n: RULES_COUNTED, kind, rules: MARK })
        : t('surveys.invites.byRules', 'Sent by {n} rules as {kind}. {rules}', { n: senders.rules.length, kind, rules: MARK });
  const [before, after] = sentence.split(MARK) as [string, string | undefined];
  const linked = senders.rules.length > 0;
  return (
    <span className="flex items-center gap-2 text-body-sm text-fg-muted" data-part="sent-by">
      <Icon name="mail" />
      <span>
        <Figures text={`${counts} `} />
        {before}
        {linked ? (
          <Link to={RULES_AT}>
            <span className="font-bold">{one ?? t('surveys.invites.rulesLink', 'See the rules')}</span>
          </Link>
        ) : null}
        {after ?? ''}
      </span>
    </span>
  );
}

export function Invitations({ t, form }: TabProps): ReactNode {
  const locale = useLocaleTag();
  const access = useAccess();
  const live = form.state !== 'draft';
  const { summary } = useFormSummary(live ? form.id : null);
  const open = surveyOf(shownOf(form).settings).mode === 'anonymous';
  const [page, setPage] = useState(1);
  const named = access.canRead('invitations', ['name', 'company']);
  const read = useRecords('invitations', {
    filter: [{ column: 'form_id', op: 'eq', value: form.id }],
    sort: [{ column: 'invited_at', direction: 'desc' }],
    page,
    pageSize: INVITATIONS_PAGE,
    columns: ['id', 'invited_at', 'answered_at', 'class', ...(named ? ['name', 'company'] : [])],
    enabled: live,
  });
  const invited = summary?.invited ?? 0;
  const answered = summary?.answered ?? 0;
  const senders = useSenders(form.id, invited, live);

  if (!live) return <EmptyState title={t('surveys.invites.draft.title', 'No invitations yet')} body={t('surveys.invites.draft.body', 'Once the survey is published, a rule with the step "Send a survey" invites people to it.')} />;

  const text = (row: DataRow, column: string): string => (typeof row[column] === 'string' ? (row[column] as string) : '');
  const columns: TableColumn[] = [
    { key: 'name', label: t('surveys.invites.column.name', 'Name'), render: (row) => <span className="font-bold text-fg">{text(row, 'name')}</span> },
    { key: 'company', label: t('surveys.invites.column.company', 'Company'), render: (row) => <span className="text-fg-muted">{text(row, 'company')}</span> },
    { key: 'invited_at', label: t('surveys.invites.column.invited', 'Invited'), render: (row) => <span className="font-mono text-body-sm">{dateOf(row['invited_at'], locale)}</span> },
    ...(open
      ? []
      : [
          {
            key: 'answered_at',
            label: t('surveys.invites.column.answered', 'Answered'),
            render: (row: DataRow) => (dateOf(row['answered_at'], locale) === '' ? <span className="text-body-sm text-fg-subtle">{t('surveys.invites.notYet', 'Not yet')}</span> : <span className="font-mono text-body-sm font-bold text-pos">{dateOf(row['answered_at'], locale)}</span>),
          },
        ]),
    { key: 'class', label: t('surveys.invites.column.kind', 'Kind of mail'), render: (row) => <span className="text-body-sm text-fg-muted">{mailWords(t, kindOf(row['class']), false)}</span> },
  ];
  const shown = named ? columns : columns.filter((column) => column.key !== 'name' && column.key !== 'company');
  const pages = Math.max(1, Math.ceil(invited / INVITATIONS_PAGE));

  return (
    <Stack gap="md">
      <span className="flex gap-4 max-sm:gap-2" data-part="invitations-counts">
        <Figure3 label={t('surveys.invites.invited', 'Invited')} n={invited} />
        {open ? null : (
          <>
            <Figure3 label={t('surveys.invites.answered', 'Answered')} n={answered} positive />
            <Figure3 label={t('surveys.invites.waiting', 'Waiting')} n={Math.max(0, invited - answered)} />
          </>
        )}
      </span>
      {senders === null ? null : <SentBy t={t} invited={invited} answered={answered} open={open} senders={senders} />}
      <Card padded={false}>
        <DataTable
          columns={shown}
          rows={read.rows}
          loading={read.loading}
          cardsBelow={680}
          empty={
            <EmptyState
              compact
              title={t('surveys.invites.empty.title', 'Nobody invited yet')}
              body={open ? t('surveys.invites.empty.open', 'This survey takes answers from its open link. A rule with the step "Send a survey" can also mail the link.') : t('surveys.invites.empty.named', 'A rule with the step "Send a survey" invites people. Add one to a rule on the Automation rules page.')}
              actions={<Link to={RULES_AT}>{t('surveys.invites.rulesLink', 'See the rules')}</Link>}
            />
          }
        />
        {read.rows.length === 0 ? null : (
          <span className="flex flex-wrap items-center justify-between gap-2 p-2 text-caption text-fg-subtle" data-part="invitations-showing">
            <Figures text={t('surveys.invites.showing', 'Showing {n} of {total}', { n: read.rows.length, total: invited })} />
            {pages > 1 ? (
              <Pagination
                page={page}
                pageCount={pages}
                onPageChange={setPage}
                label={t('surveys.invites.pages', 'Pages of invitations')}
                previousLabel={t('surveys.invites.previous', 'Previous')}
                nextLabel={t('surveys.invites.next', 'Next')}
                pageLabel={(n) => t('surveys.invites.page', 'Page {n}', { n })}
              />
            ) : null}
          </span>
        )}
      </Card>
    </Stack>
  );
}
