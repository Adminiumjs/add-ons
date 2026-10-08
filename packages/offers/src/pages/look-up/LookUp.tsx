/**
 * LOOK UP: type or scan a code, or a customer's address, and see what it is,
 * what it is worth and what happened to it.
 *
 * WHAT IS TYPED STAYS HERE. The value lives in this screen's state and is
 * sent in the body of one call; it is never put in an address, and no answer
 * carries a whole code back. The heading repeats what the person typed and
 * everything else says "ending Q4XP".
 *
 * EVERY FIGURE IS AN ANSWER. After anything is saved the screen looks the
 * same value up again: nothing on the card is worked out here.
 */
import { useCallback, useRef, useState, type ReactNode } from 'react';

import { CodeEnd } from '../shared/codes.tsx';
import {
  Alert,
  Button,
  Card,
  DataTable,
  EmptyState,
  KeyValueList,
  Link,
  ProgressBar,
  SearchInput,
  Stack,
  Stat,
  StatusPill,
  asDataError,
  money,
  useAppToasts,
  useDocument,
  useLocaleTag,
  useLookUp,
  useRecord,
  useStateMove,
  useWrite,
  type AddOnTranslate,
  type DataError,
  type DataRow,
  type TableColumn,
} from '../shared/host.ts';
import { PageFrame, useSaid } from '../shared/PageFrame.tsx';
import { BATCHES, DISCOUNTS, ISSUE, LOOK_UP, recordAt } from '../shared/paths.ts';
import { refusal } from '../shared/refusal.ts';
import { useRole, type Role } from '../shared/role.ts';
import { CancelDialog, CreditDialog, MoneyDialog } from './Dialogs.tsx';
import { read, todayOf, type Shown, type ShownCard, type ShownCode, type ShownVoucher } from './read.ts';
import { announce, cardPill, ledgerKind, stateOfUse, toneOf, voucherPill, whyNot } from './words.ts';

type Found = { typed: string; shown: Shown } | { typed: string; shown: null };
type Open = null | { dialog: 'top-up' | 'adjust' | 'cancel'; card: ShownCard } | { dialog: 'credit'; address: string; card: ShownCard | null };

const isCard = (shown: Shown): shown is ShownCard => shown.kind === 'card' || shown.kind === 'credit';
const isVoucher = (shown: Shown): shown is ShownVoucher => shown.kind === 'voucher' || shown.kind === 'pack';
const pillOf = (t: AddOnTranslate, shown: Shown): string => (isCard(shown) ? cardPill(t, shown.pill) : isVoucher(shown) ? voucherPill(t, shown.pill, shown.kind === 'pack') : '');
const isAddress = (typed: string): boolean => typed.includes('@');

export function LookUp({ t }: { t: AddOnTranslate }): ReactNode {
  const role = useRole();
  const locale = useLocaleTag();
  const toasts = useAppToasts();
  const lookUp = useLookUp('offers');
  const [typed, setTyped] = useState('');
  const [fieldSaid, setFieldSaid] = useState<string | null>(null);
  const [failed, setFailed] = useState<DataError | null>(null);
  const [found, setFound] = useState<Found | null>(null);
  const [open, setOpen] = useState<Open>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionSaid, setActionSaid] = useState<string | null>(null);
  const [said, say] = useSaid();
  const turn = useRef(0);

  const date = useCallback((day: string): string => formatDay(day, locale), [locale]);

  const submit = useCallback(
    async (value: string): Promise<void> => {
      const asked = value.trim();
      if (asked === '') {
        setFieldSaid(t('lookup.field.empty', 'Type or scan a code first.'));
        return;
      }
      setFieldSaid(null);
      setActionSaid(null);
      const mine = (turn.current += 1);
      try {
        const answer = await lookUp.find(asked);
        // A slower answer to an older question is dropped.
        if (mine !== turn.current) return;
        setFailed(null);
        if (answer === null) {
          setFound({ typed: asked, shown: null });
          say(t('lookup.said.nothing', 'Nothing has this code'));
          return;
        }
        const shown = read(answer, todayOf(new Date()));
        setFound({ typed: asked, shown });
        say(announce(t, shown, pillOf(t, shown), 'balance' in shown ? money(shown.balance, locale) : ''));
      } catch (caught) {
        if (mine !== turn.current) return;
        setFailed(asDataError(caught));
      }
    },
    [lookUp, t, say, locale],
  );

  /** One save from the card's own buttons, then the same value looked up again. */
  const act = useCallback(
    async (name: string, save: () => Promise<string>): Promise<void> => {
      if (found === null || busy !== null) return;
      setBusy(name);
      setActionSaid(null);
      try {
        const title = await save();
        toasts.push({ variant: 'success', title });
        await submit(found.typed);
      } catch (caught) {
        setActionSaid(refusal(t, asDataError(caught), name === 'print' ? 'print' : undefined).message);
      } finally {
        setBusy(null);
      }
    },
    [found, busy, submit, t, toasts],
  );

  const saved = async (title: string): Promise<void> => {
    setOpen(null);
    toasts.push({ variant: 'success', title });
    if (found !== null) await submit(found.typed);
  };

  const issue = role.issueVoucher || role.cardMoney ? <Link to={`${ISSUE}?back=${encodeURIComponent(LOOK_UP)}`}>{t('lookup.issue', 'Issue')}</Link> : undefined;

  return (
    <PageFrame t={t} title={t('lookup.title', 'Look up')} subtitle={t('lookup.subtitle', 'Gift cards, vouchers, packs, discount codes and credit')} status={said} width="content" testId="offers-look-up" actions={issue}>
      <Card>
        <Stack gap="sm">
          <Stack direction="row" gap="sm" align="end">
            <SearchInput
              value={typed}
              onChange={(event) => {
                setTyped(event.target.value);
                setFieldSaid(null);
              }}
              onSubmit={(value) => void submit(value)}
              placeholder={t('lookup.field.placeholder', 'GC-7K2M-W3HN-Q4XP or name@example.com')}
              aria-label={t('lookup.field.label', "Type or scan a code, or a customer's email")}
              dir="ltr"
              autoFocus
              {...(fieldSaid === null ? {} : { 'aria-describedby': 'offers-look-up-said' })}
            />
            <Button variant="primary" loading={lookUp.finding} onClick={() => void submit(typed)}>
              {t('lookup.go', 'Look up')}
            </Button>
          </Stack>
          {fieldSaid === null ? null : (
            <div id="offers-look-up-said">
              <Alert tone="warn" role="alert" title={fieldSaid} />
            </div>
          )}
        </Stack>
      </Card>

      {failed === null ? null : <Alert tone="danger" role="alert" title={t('lookup.failed', 'This could not be looked up')} body={refusal(t, failed).message} action={<Button variant="secondary" size="sm" onClick={() => void submit(typed)}>{t('shared.retry', 'Try again')}</Button>} />}

      {found === null ? (
        <EmptyState compact title={t('lookup.start.title', 'Nothing looked up yet')} body={t('lookup.start.body', 'Scan the code on a card or a voucher, or type it. For credit, type the customer’s email.')} />
      ) : found.shown === null ? (
        <EmptyState
          title={isAddress(found.typed) ? t('lookup.none.address', 'No credit for {typed}', { typed: found.typed }) : t('lookup.none.code', 'Nothing has this code · {typed}', { typed: found.typed })}
          body={isAddress(found.typed) ? t('lookup.none.addressBody', 'This address holds no credit.') : t('lookup.none.codeBody', 'Check the characters and try another code.')}
          {...(isAddress(found.typed) && role.cardMoney ? { actions: <Button onClick={() => setOpen({ dialog: 'credit', address: found.typed, card: null })}>{t('lookup.giveCredit', 'Give credit')}</Button> } : {})}
        />
      ) : (
        <Stack gap="md">
          {actionSaid === null ? null : <Alert tone="danger" role="alert" title={actionSaid} />}
          {isCard(found.shown) ? <CardResult t={t} typed={found.typed} shown={found.shown} role={role} locale={locale} date={date} busy={busy} act={act} onOpen={setOpen} /> : null}
          {isVoucher(found.shown) ? <VoucherResult t={t} typed={found.typed} shown={found.shown} role={role} locale={locale} date={date} busy={busy} act={act} /> : null}
          {found.shown.kind === 'code' ? <CodeResult t={t} typed={found.typed} shown={found.shown} date={date} /> : null}
        </Stack>
      )}

      {open !== null && (open.dialog === 'top-up' || open.dialog === 'adjust') ? <MoneyDialog t={t} kind={open.dialog} card={open.card} onClose={() => setOpen(null)} onSaved={saved} /> : null}
      {open !== null && open.dialog === 'cancel' ? <CancelDialog t={t} card={open.card} onClose={() => setOpen(null)} onSaved={saved} /> : null}
      {open !== null && open.dialog === 'credit' ? <CreditDialog t={t} address={open.address} card={open.card} onClose={() => setOpen(null)} onSaved={saved} /> : null}
    </PageFrame>
  );
}

/**
 * A day as the reader's language writes it; the text as it came when it is no
 * day. A bare day is that day everywhere; a moment is the day it was where
 * the reader is.
 */
export function formatDay(value: unknown, locale: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) return value === null || value === undefined ? '' : String(value);
  if (value.length > 10) {
    const moment = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
    if (!Number.isNaN(moment.getTime())) return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(moment);
  }
  const [year = 0, month = 1, day = 1] = value.slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)));
}

const Amount = ({ value, locale }: { value: unknown; locale: string }): ReactNode => <span dir="ltr">{money(value, locale)}</span>;

interface ResultProps<S> {
  t: AddOnTranslate;
  typed: string;
  shown: S;
  role: Role;
  locale: string;
  date: (day: string) => string;
  busy: string | null;
  act: (name: string, save: () => Promise<string>) => Promise<void>;
}

function CardResult({ t, typed, shown, role, locale, date, busy, act, onOpen }: ResultProps<ShownCard> & { onOpen: (open: Open) => void }): ReactNode {
  const move = useStateMove('gift_cards');
  const documents = useDocument();
  const credit = shown.kind === 'credit';
  const why = whyNot(t, shown, date);
  const columns: TableColumn[] = [
    { key: 'at', label: t('lookup.col.date', 'Date'), render: (row) => formatDay(row['at'], locale) },
    { key: 'kind', label: t('lookup.col.what', 'What'), render: (row) => ledgerKind(t, row['kind']) },
    { key: 'amount', label: t('lookup.col.amount', 'Amount'), align: 'end', render: (row) => <Amount value={row['amount']} locale={locale} /> },
    { key: 'balance_after', label: t('lookup.col.leftAfter', 'Left after'), align: 'end', render: (row) => <Amount value={row['balance_after']} locale={locale} /> },
    { key: 'source_label', label: t('lookup.col.where', 'Where'), render: (row) => text(row['note']) ?? text(row['source_label']) ?? '' },
  ];
  const active = shown.pill === 'active';
  const mayCancel = role.cancelCard && !credit && (shown.pill === 'active' || shown.pill === 'inactive');
  const maySend = !credit && active && role.sendCard && shown.hasAddress !== false;
  return (
    <Card
      title={<span dir="ltr">{typed}</span>}
      description={credit ? t('lookup.kind.credit', 'Credit') : t('lookup.kind.card', 'Gift card')}
      actions={<StatusPill status={shown.pill} tone={toneOf(shown.usable, shown.why)}>{cardPill(t, shown.pill)}</StatusPill>}
    >
      <Stack gap="md">
        {why === null ? null : <Alert tone={shown.why === 'void' ? 'danger' : 'warn'} title={why} />}
        {shown.moved ? <Alert tone="info" title={t('lookup.moved', 'An older card · it works at a staffed counter only')} /> : null}
        {shown.balance === null ? null : <Stat label={t('lookup.left', 'Left')} value={<Amount value={shown.balance} locale={locale} />} />}
        <KeyValueList
          items={[
            ...(credit ? [] : [{ label: t('lookup.code', 'Code'), value: <CodeEnd last4={shown.last4} /> }]),
            { label: t('lookup.useBy', 'Use it by'), value: shown.expires === null ? t('lookup.never', 'Never expires') : date(shown.expires) },
            ...(shown.recipient === null ? [] : [{ label: t('lookup.for', 'For'), value: shown.recipient }]),
            ...(shown.sender === null ? [] : [{ label: t('lookup.from', 'From'), value: shown.sender }]),
            ...(shown.issued === null ? [] : [{ label: t('lookup.issued', 'Issued'), value: formatDay(shown.issued, locale) }]),
          ]}
        />
        <Stack direction="row" gap="sm" wrap>
          {role.cardMoney && active ? (
            <Button variant="primary" onClick={() => onOpen(credit ? { dialog: 'credit', address: typed, card: shown } : { dialog: 'top-up', card: shown })}>
              {credit ? t('lookup.addCredit', 'Add credit') : t('lookup.topUp', 'Top up')}
            </Button>
          ) : null}
          {role.cardMoney && active && !credit ? (
            <Button variant="secondary" onClick={() => onOpen({ dialog: 'adjust', card: shown })}>
              {t('lookup.adjust', 'Adjust')}
            </Button>
          ) : null}
          {maySend ? (
            <Button variant="secondary" loading={busy === 'send'} onClick={() => void act('send', async () => (await move(shown.key, 'send-again'), shown.recipient === null ? t('lookup.queued', 'Queued to send again') : t('lookup.queuedFor', 'Queued for {name}', { name: shown.recipient })))}>
              {t('lookup.sendAgain', 'Send again')}
            </Button>
          ) : null}
          {role.readsCode && !credit && active ? (
            <Button variant="secondary" loading={busy === 'print'} onClick={() => void act('print', async () => (await documents.open('gift-card', 'gift_cards', shown.key, { print: true }), t('lookup.printing', 'Opened to print')))}>
              {t('lookup.print', 'Print')}
            </Button>
          ) : null}
          {mayCancel ? (
            <Button variant="destructive" onClick={() => onOpen({ dialog: 'cancel', card: shown })}>
              {t('lookup.cancelCard', 'Cancel the card')}
            </Button>
          ) : null}
        </Stack>
        {role.ready && !role.cardMoney ? <span className="text-body-sm text-fg-muted">{t('lookup.askManager', 'A manager can top up, adjust or cancel it.')}</span> : null}
        <DataTable columns={columns} rows={numbered(shown.rows)} rowKey="n" empty={t('lookup.noActivity', 'Nothing has happened to it yet.')} />
      </Stack>
    </Card>
  );
}

function VoucherResult({ t, typed, shown, role, locale, date, busy, act }: ResultProps<ShownVoucher>): ReactNode {
  const actions = useWrite('voucher_actions');
  const move = useStateMove('vouchers');
  const documents = useDocument();
  // Only a reader who may read batches asks for one, and is given the link to it.
  const batch = useRecord('voucher_batches', role.readsBatches ? shown.batch : null);
  const pack = shown.kind === 'pack';
  const why = whyNot(t, shown, date);
  const columns: TableColumn[] = [
    { key: 'at', label: t('lookup.col.date', 'Date'), render: (row) => formatDay(row['at'], locale) },
    { key: 'state', label: t('lookup.col.what', 'What'), render: (row) => stateOfUse(t, row['state']) },
    { key: 'amount', label: t('lookup.col.amount', 'Amount'), align: 'end', render: (row) => <Amount value={row['amount']} locale={locale} /> },
    { key: 'source_label', label: t('lookup.col.where', 'Where') },
  ];
  const use = async (): Promise<string> => {
    await actions.create({ voucher_id: Number.isFinite(Number(shown.key)) ? Number(shown.key) : shown.key, action: 'use' });
    // What is left is read again from Adminium, not counted down here.
    return pack ? t('lookup.useRecorded', '1 use recorded') : t('lookup.markedUsed', 'Marked as used');
  };
  return (
    <Card
      title={<span dir="ltr">{typed}</span>}
      description={pack ? t('lookup.kind.pack', 'Pack') : t('lookup.kind.voucher', 'Voucher')}
      actions={<StatusPill status={shown.pill} tone={toneOf(shown.usable, shown.why)}>{voucherPill(t, shown.pill, pack)}</StatusPill>}
    >
      <Stack gap="md">
        {why === null ? null : <Alert tone={shown.why === 'void' ? 'danger' : 'warn'} title={why} />}
        {pack && shown.usesLeft !== null && shown.usesTotal !== null ? (
          <Stack gap="xs">
            <Stat label={t('lookup.usesLeft', 'Uses left')} value={<span dir="ltr">{t('lookup.leftOf', '{left} of {total}', { left: shown.usesLeft, total: shown.usesTotal })}</span>} />
            <ProgressBar value={shown.usesLeft} max={shown.usesTotal} label={t('lookup.usesLeft', 'Uses left')} />
          </Stack>
        ) : null}
        <KeyValueList
          items={[
            { label: t('lookup.code', 'Code'), value: <CodeEnd last4={shown.last4} /> },
            ...(shown.name === null ? [] : [{ label: t('lookup.what', 'What it is'), value: shown.name }]),
            ...(shown.value === null || pack ? [] : [{ label: t('lookup.worth', 'Worth'), value: shown.worth === 'percent' ? <span dir="ltr">{t('lookup.percent', '{n}%', { n: trimmed(shown.value) })}</span> : <Amount value={shown.value} locale={locale} /> }]),
            { label: t('lookup.useBy', 'Use it by'), value: shown.expires === null ? t('lookup.never', 'Never expires') : date(shown.expires) },
            ...(shown.holder === null ? [] : [{ label: t('lookup.for', 'For'), value: shown.holder }]),
            ...(shown.batch === null || !role.readsBatches ? [] : [{ label: t('lookup.batch', 'Batch'), value: <Link to={recordAt(BATCHES, shown.batch)}>{text(batch.row?.['name']) ?? t('lookup.openBatch', 'Open the batch')}</Link> }]),
          ]}
        />
        <Stack direction="row" gap="sm" wrap>
          {role.useVoucher && shown.usable ? (
            <Button variant="primary" loading={busy === 'use'} onClick={() => void act('use', use)}>
              {pack ? t('lookup.useOne', 'Use one now') : t('lookup.markUsed', 'Mark as used')}
            </Button>
          ) : null}
          {role.sendVoucher && shown.pill === 'issued' ? (
            <Button variant="secondary" loading={busy === 'send'} onClick={() => void act('send', async () => (await move(shown.key, 'send-again'), shown.holder === null ? t('lookup.queued', 'Queued to send again') : t('lookup.queuedFor', 'Queued for {name}', { name: shown.holder })))}>
              {t('lookup.sendAgain', 'Send again')}
            </Button>
          ) : null}
          {role.readsCode && shown.pill === 'issued' ? (
            <Button variant="secondary" loading={busy === 'print'} onClick={() => void act('print', async () => (await documents.open('voucher', 'vouchers', shown.key, { print: true }), t('lookup.printing', 'Opened to print')))}>
              {t('lookup.print', 'Print')}
            </Button>
          ) : null}
        </Stack>
        <DataTable columns={columns} rows={numbered(shown.rows)} rowKey="n" empty={t('lookup.noUses', 'It has not been used yet.')} />
      </Stack>
    </Card>
  );
}

function CodeResult({ t, typed, shown, date }: { t: AddOnTranslate; typed: string; shown: ShownCode; date: (day: string) => string }): ReactNode {
  const offer = useRecord('offers', shown.offer);
  const why = whyNot(t, shown, date);
  const name = text(offer.row?.['name']);
  return (
    <Card
      title={<span dir="ltr">{typed.toUpperCase()}</span>}
      description={t('lookup.kind.code', 'Discount code')}
      actions={<StatusPill status={shown.usable ? 'active' : 'off'} tone={shown.usable ? 'pos' : 'warn'}>{shown.usable ? t('lookup.pill.works', 'Works') : t('lookup.pill.doesNot', 'Does not work now')}</StatusPill>}
    >
      <Stack gap="md">
        {why === null ? null : <Alert tone="warn" title={why} />}
        <KeyValueList
          items={[
            ...(name === null ? [] : [{ label: t('lookup.discount', 'Discount'), value: name }]),
            ...(shown.uses === null ? [] : [{ label: t('lookup.uses', 'Uses'), value: <span dir="ltr">{shown.maxUses === null ? String(shown.uses) : t('lookup.leftOf', '{left} of {total}', { left: shown.uses, total: shown.maxUses })}</span> }]),
            ...(shown.expires === null ? [] : [{ label: t('lookup.validUntil', 'Works until'), value: date(shown.expires) }]),
          ]}
        />
        {shown.offer === null ? null : <Link to={`${DISCOUNTS}/${encodeURIComponent(shown.offer)}`}>{t('lookup.openDiscount', 'Open the discount')}</Link>}
      </Stack>
    </Card>
  );
}

const text = (value: unknown): string | null => (value === null || value === undefined || value === '' ? null : String(value));
/** History rows carry no key of their own: each is told apart by its place in the answer. */
const numbered = (rows: readonly DataRow[]): DataRow[] => rows.map((row, n) => ({ ...row, n }));
/** `10.00` as `10`, `12.50` as `12.5`: a percent is read, not counted. */
const trimmed = (value: string): string => (value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value);
