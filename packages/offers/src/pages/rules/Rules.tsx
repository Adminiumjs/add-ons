/**
 * OFFER RULES: which of the place's own tables take discounts, take a gift
 * card as payment, sell or top up a gift card, or sell a voucher.
 *
 * A rule an app brought is shown locked: it can be switched off, never
 * changed. A rule of the place's own can be changed and removed by someone
 * who may change how Adminium works out a table's columns; everybody else
 * reads the page and changes nothing.
 *
 * THE PAGE CALLS NO SCHEMA ROUTE. Where a table has no column for a part,
 * the rule is sent with what Adminium is to add, Adminium says what that
 * will be, and adds it in the same save as the rule.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  Alert,
  Button,
  Card as Panel,
  EmptyState,
  RadioCard,
  RadioGroup,
  Select,
  Sheet,
  SheetFooter,
  SheetHeader,
  Stack,
  Switch,
  Tag,
  api,
  asDataError,
  lucideByName,
  useAppToasts,
  useLocaleTag,
  type AddOnTranslate,
  type DataError,
} from '../shared/host.ts';
import { PageFrame } from '../shared/PageFrame.tsx';
import { refusal } from '../shared/refusal.ts';
import { ADDABLE, EMPTY, PARTS, appName, cardsOf, formOf, formProblems, linesOf, sentOf, sentence, type Addable, type Card, type Form, type Names, type Posted, type Priced, type SourceColumn, type SourceTable, type When } from './rule.ts';
import { SheetPane } from '../shared/SheetPane.tsx';

const LEDGER = '/api/v1/ledgers/offers/value';
const NUMBERS = new Set(['int', 'integer', 'bigint', 'decimal', 'number', 'float', 'money']);
const MONEY = new Set(['decimal', 'number', 'float', 'money']);
const YES_NO = new Set(['bool', 'boolean']);

interface Kit {
  connectionId: string;
  tables: Record<string, { id: string }>;
  hosts: { tableRef: string; id: string }[];
}
interface Read {
  kit: Kit;
  cards: Card[];
  canChange: boolean;
  sources: SourceTable[] | null;
}
interface Editing {
  /** The card being changed, or null for a new rule. */
  card: Card | null;
  form: Form;
}
/** What Adminium said it would add, waiting for a yes. */
interface Asked {
  checksum: string;
  columns: { table: string; column: string; made: boolean }[];
  tables: string[];
}

export function Rules({ t }: { t: AddOnTranslate }): ReactNode {
  const toasts = useAppToasts();
  const locale = useLocaleTag();
  const [read, setRead] = useState<Read | null>(null);
  const [failed, setFailed] = useState<DataError | null>(null);
  const [said, setSaid] = useState<Readonly<Record<string, string>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async (): Promise<Read | null> => {
    try {
      const kit = await api.get<Kit>('/api/v1/add-ons/offers/kit');
      const at = `?connectionId=${encodeURIComponent(kit.connectionId)}`;
      const priced = await api.get<{ adjusts: Priced[]; canChange: boolean }>(`/api/v1/add-ons/offers/adjusts${at}`);
      const posted = await api.get<{ postings: Posted[]; canChange: boolean }>(`${LEDGER}/postings${at}`);
      const canChange = priced.canChange && posted.canChange;
      // The pickers are read only for someone who may use them.
      const sources = canChange ? (await api.get<{ tables: SourceTable[] }>(`${LEDGER}/sources${at}`)).tables : null;
      // This add-on's own tables post into its ledger too: how a hand action posts is how Offers works, not a rule anybody set.
      const own = new Set(Object.values(kit.tables).map((table) => table.id));
      const next = { kit, cards: cardsOf(priced.adjusts, posted.postings.filter((rule) => !own.has(rule.table) && rule.owner !== 'offers')), canChange, sources };
      setRead(next);
      setFailed(null);
      return next;
    } catch (caught) {
      setFailed(asDataError(caught));
      return null;
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const list = useMemo(() => new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }), [locale]);
  const names = useMemo<Names>(() => {
    const tables = read?.sources ?? [];
    return {
      table: (id) => tables.find((table) => table.table === id)?.label ?? read?.cards.find((card) => card.table === id)?.tableLabel ?? id,
      column: (table, name) => tables.find((candidate) => candidate.table === table)?.columns.find((column) => column.name === name)?.label ?? name,
      list: (values) => list.format(values),
    };
  }, [read, list]);

  if (read === null) return <PageFrame t={t} title={t('rules.title', 'Offer rules')} loading={failed === null} error={failed} onRetry={() => void load()} testId="offers-rules" />;

  const key = (card: Card): string => `${card.table}:${card.kind}`;
  const tableAt = (table: string): string => `/api/v1/connections/${encodeURIComponent(read.kit.connectionId)}/tables/${encodeURIComponent(table)}`;
  const postingAt = (table: string, id: string): string => `${tableAt(table)}/postings/${encodeURIComponent(id)}`;
  const refOf = (table: string): string => read.kit.hosts.find((host) => host.id === table)?.tableRef ?? table;

  const toggle = async (card: Card, enabled: boolean): Promise<void> => {
    setBusy(key(card));
    setSaid((all) => Object.fromEntries(Object.entries(all).filter(([held]) => held !== key(card))));
    try {
      if (card.kind === 'discounts') await api.patch(`${tableAt(card.table)}/adjust/switch`, { enabled });
      else await api.patch(`${postingAt(card.table, card.posted.id)}/switch`, { enabled });
      toasts.push({ variant: 'info', title: enabled ? t('rules.switchedOn', '{table} rule switched on', { table: card.tableLabel }) : t('rules.switchedOff', '{table} rule switched off', { table: card.tableLabel }) });
      await load();
    } catch (caught) {
      setSaid((all) => ({ ...all, [key(card)]: refusal(t, asDataError(caught)).message }));
    } finally {
      setBusy(null);
    }
  };

  /** A posting that stands by itself — a refund's, or a stray record of uses — is removed from its card. */
  const removeAlone = async (card: Card): Promise<void> => {
    if (card.kind === 'discounts') return;
    setBusy(key(card));
    setSaid((all) => Object.fromEntries(Object.entries(all).filter(([held]) => held !== key(card))));
    try {
      await api.delete(postingAt(card.table, card.posted.id));
      toasts.push({ variant: 'success', title: t('rules.removed', 'Rule removed from {table}', { table: card.tableLabel }) });
      setRemoving(null);
      await load();
    } catch (caught) {
      setSaid((all) => ({ ...all, [key(card)]: refusal(t, asDataError(caught)).message }));
    } finally {
      setBusy(null);
    }
  };

  const title = (kind: Card['kind']): string =>
    kind === 'discounts'
      ? t('rules.kind.discounts', 'Takes discounts')
      : kind === 'pays'
        ? t('rules.kind.pays', 'Takes a gift card as payment')
        : kind === 'refunds'
          ? t('rules.kind.refunds', 'Gives a card payment back')
          : kind === 'sells-cards'
            ? t('rules.kind.sellsCards', 'Sells or tops up a gift card')
            : kind === 'sells-vouchers'
              ? t('rules.kind.sellsVouchers', 'Sells a voucher or a pack')
              : kind === 'uses'
                ? t('rules.kind.uses', 'Records what was used')
                : t('rules.kind.moved', 'Brought in older gift cards');
  const Lock = lucideByName('lock');

  return (
    <PageFrame
      t={t}
      title={t('rules.title', 'Offer rules')}
      subtitle={t('rules.subtitle', 'What your own tables have to do with discounts, vouchers and gift cards')}
      testId="offers-rules"
      actions={read.canChange ? <Button variant="primary" onClick={() => setEditing({ card: null, form: EMPTY })}>{t('rules.add', 'Add a rule')}</Button> : undefined}
    >
      {read.canChange ? null : <Alert tone="info" title={t('rules.readOnly', "Only someone who may change how Adminium works out a table's columns can change these.")} />}
      {read.cards.length === 0 ? <EmptyState title={t('rules.none.title', 'No table has anything to do with offers yet')} body={t('rules.none.body', 'An app that takes discounts or gift cards brings its rules with it. For a table of your own, add a rule.')} /> : null}
      {read.cards.map((card) => {
        const locked = card.owner !== null || card.kind === 'moved';
        // A rule that reads its rows as lines of another row was drawn in a file: it is shown, and changed there.
        const inFile = card.kind !== 'discounts' && card.posted.via !== undefined;
        const changeable = read.canChange && !locked && !inFile && card.kind !== 'refunds' && card.kind !== 'uses';
        const removable = read.canChange && !locked && (card.kind === 'refunds' || card.kind === 'uses');
        return (
          <Panel
            key={key(card)}
            title={card.tableLabel}
            description={title(card.kind)}
            actions={
              <Stack direction="row" gap="sm" align="center">
                {card.owner !== null ? (
                  <Tag>
                    {Lock === undefined ? null : <Lock className="size-4" />}
                    {t('rules.from', 'From {app}', { app: card.kind === 'discounts' && card.ownerName !== undefined ? card.ownerName : appName(card.owner) })}
                  </Tag>
                ) : (
                  <Tag tone="accent">{t('rules.yours', 'Your table')}</Tag>
                )}
                {card.kind === 'moved' ? null : <Switch label={t('rules.on', 'On')} checked={card.enabled} disabled={!read.canChange || busy !== null} onCheckedChange={(enabled) => void toggle(card, enabled)} />}
              </Stack>
            }
          >
            <Stack gap="sm">
              {sentence(t, card, names).map((line) => (
                <span key={line}>{line}</span>
              ))}
              {card.state === 'unavailable' ? <Alert tone="warn" title={t('rules.unavailable', 'This rule cannot run right now: Offers is switched off or not answering.')} /> : null}
              {card.holding > 0 ? <span className="text-body-sm text-fg-muted">{t('rules.holding', '{rows, plural, one {# row is} other {# rows are}} holding a use or a card payment.', { rows: card.holding })}</span> : null}
              {inFile && !locked ? <span className="text-body-sm text-fg-muted">{t('rules.inFile', 'This rule was drawn in a project file. Change it there.')}</span> : null}
              {said[key(card)] === undefined ? null : <Alert tone="danger" role="alert" title={said[key(card)]} />}
              {changeable ? (
                <Stack direction="row" gap="sm">
                  <Button variant="secondary" size="sm" onClick={() => setEditing({ card, form: formOf(card) ?? { ...EMPTY, table: card.table } })}>
                    {t('rules.edit', 'Edit')}
                  </Button>
                </Stack>
              ) : null}
              {removable ? (
                <Stack direction="row" gap="sm">
                  {removing === key(card) ? (
                    <>
                      <Button variant="destructive" size="sm" loading={busy === key(card)} onClick={() => void removeAlone(card)}>
                        {t('rules.remove', 'Remove rule')}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setRemoving(null)}>
                        {t('shared.cancel', 'Cancel')}
                      </Button>
                    </>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => setRemoving(key(card))}>
                      {t('rules.remove', 'Remove rule')}
                    </Button>
                  )}
                </Stack>
              ) : null}
            </Stack>
          </Panel>
        );
      })}
      {editing !== null && read.sources !== null ? (
        <RuleSheet
          t={t}
          editing={editing}
          sources={read.sources}
          ownTables={read.kit.tables}
          names={names}
          tableAt={tableAt}
          postingAt={postingAt}
          refOf={refOf}
          onClose={() => setEditing(null)}
          onSaved={async (words) => {
            setEditing(null);
            toasts.push({ variant: 'success', title: words });
            await load();
          }}
        />
      ) : null}
    </PageFrame>
  );
}

interface SheetProps {
  t: AddOnTranslate;
  editing: Editing;
  sources: readonly SourceTable[];
  ownTables: Kit['tables'];
  names: Names;
  tableAt: (table: string) => string;
  postingAt: (table: string, id: string) => string;
  refOf: (table: string) => string;
  onClose: () => void;
  onSaved: (words: string) => Promise<void>;
}

function RuleSheet({ t, editing, sources, ownTables, names, tableAt, postingAt, refOf, onClose, onSaved }: SheetProps): ReactNode {
  const [form, setForm] = useState<Form>(editing.form);
  const [marked, setMarked] = useState<readonly string[]>([]);
  const [said, setSaid] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [asked, setAsked] = useState<Asked | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const working = busy !== null;
  const source = sources.find((table) => table.table === form.table);
  const set = (patch: Partial<Form>): void => {
    setForm((held) => ({ ...held, ...patch }));
    setAsked(null);
  };
  const pick = (part: string, value: string): void => set({ cols: { ...form.cols, [part]: value } });

  /** The tables whose rows are lines of this one, each with the link that makes them so. */
  const lineTables = sources.flatMap((table) => (table.lineOf ?? []).filter((link) => link.table === form.table).map((link) => ({ value: `${table.table} ${link.via}`, label: table.label, table })));
  const lines = form.kind === 'discounts' ? lineTables.find((one) => one.value === (form.cols['lines'] ?? ''))?.table : undefined;
  const refunds = sources.find((table) => table.table === (form.cols['refunds'] ?? ''));

  const options = (columns: readonly SourceColumn[], kept: (column: SourceColumn) => boolean, none: string): { value: string; label: string }[] => [{ value: '', label: none }, ...columns.filter(kept).map((column) => ({ value: column.name, label: column.label }))];
  const linksTo = (from: SourceTable | undefined, to: (table: string) => boolean): { value: string; label: string }[] => (from?.lineOf ?? []).filter((link) => to(link.table)).map((link) => ({ value: link.via, label: from?.columns.find((column) => column.name === link.via)?.label ?? link.via }));
  const choose = t('rules.sheet.chooseColumn', 'Choose a column');
  const notNeeded = t('rules.sheet.notNeeded', 'Not needed');
  const missing = (part: string): { error?: string } => (marked.includes(part) ? { error: t('rules.sheet.err.part', 'Choose a column, or let Adminium add it.') } : {});
  const needed = (part: string): { error?: string } => (marked.includes(part) ? { error: t('rules.sheet.err.needed', 'Choose a column.') } : {});
  const ownId = (ref: string): string | undefined => ownTables[ref]?.id;

  const preview: Card | null = useMemo(() => {
    if (source === undefined || formProblems(form).length > 0) return null;
    const sent = sentOf(form, refOf);
    const base = { table: form.table, tableLabel: source.label, owner: null, enabled: true, state: 'live' as const, holding: 0 };
    const posted = (index: number): Posted | null => {
      const one = sent.postings[index];
      return one === undefined ? null : ({ ...base, ...(one.body as Omit<Posted, 'id' | 'action' | 'table' | 'tableLabel' | 'owner' | 'enabled' | 'state' | 'holding'>), id: one.id, action: (one.body['into'] as { action: string }).action } as Posted);
    };
    if (sent.adjust !== undefined) return { ...base, kind: 'discounts', priced: { ...base, adjust: sent.adjust.body.adjust }, uses: posted(0) };
    const first = posted(0);
    return first === null ? null : { ...base, kind: form.kind as Exclude<Addable, 'discounts'>, posted: first };
  }, [form, source, refOf]);

  const save = async (): Promise<void> => {
    const problems = formProblems(form);
    setMarked(problems);
    setSaid(null);
    if (problems.length > 0) return;
    const sent = sentOf(form, refOf);
    if (busy !== null) return;
    setBusy('save');
    try {
      const making = sent.adjust?.body.make !== undefined;
      if (sent.adjust !== undefined && making && asked === null) {
        // Adminium says what it would add. Nothing is stored — no column, no rule, no posting — until that is read and said yes to.
        const answered = await api.put<{ checksum: string; made: { columns: Asked['columns']; tables: string[] }; refusals: { table?: string; column?: string; reason: string }[] }>(`${tableAt(form.table)}/adjust`, { ...sent.adjust.body, dryRun: true });
        if (answered.refusals.length > 0) {
          setSaid(t('rules.sheet.cannotMake', 'Adminium cannot add what is missing here: {reasons}', { reasons: names.list(answered.refusals.map((refused) => refused.reason)) }));
          return;
        }
        setAsked({ checksum: answered.checksum, columns: answered.made.columns.filter((column) => column.made), tables: answered.made.tables });
        return;
      }
      // What the price rule names must be there first: the posting that records uses.
      for (const one of sent.postings) await api.put(postingAt(one.table, one.id), one.body);
      if (sent.adjust !== undefined) await api.put(`${tableAt(form.table)}/adjust`, { ...sent.adjust.body, ...(making && asked !== null ? { checksum: asked.checksum } : {}) });
      // A rule that no longer says when a row is final no longer records uses: its old posting goes with it.
      const old = editing.card?.kind === 'discounts' ? editing.card.uses : null;
      if (sent.adjust !== undefined && sent.postings.length === 0 && old !== null && old !== undefined && old.owner === null) await api.delete(postingAt(form.table, old.id));
      await onSaved(editing.card === null ? t('rules.saved.new', 'Rule added for {table}', { table: source?.label ?? form.table }) : t('rules.saved', 'Rule saved for {table}', { table: source?.label ?? form.table }));
    } catch (caught) {
      const refused = refusal(t, asDataError(caught));
      setSaid(refused.message);
      // A refusal names a column; the sheet marks the part that column was picked for.
      const part = refused.field === undefined ? undefined : Object.entries(form.cols).find(([, column]) => column === refused.field || linesOf(column).via === refused.field)?.[0];
      if (part !== undefined) setMarked([part]);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (): Promise<void> => {
    const card = editing.card;
    if (card === null || busy !== null) return;
    setBusy('remove');
    setSaid(null);
    try {
      if (card.kind === 'discounts') {
        // The rule names its posting, so the rule goes first. Where the posting then cannot go — rows still hold a
        // use — it is left as a card of its own, which says so and can be removed once they are put back.
        await api.delete(`${tableAt(card.table)}/adjust`);
        if (card.uses !== null && card.uses.owner === null) {
          try {
            await api.delete(postingAt(card.table, card.uses.id));
          } catch (caught) {
            await onSaved(t('rules.removedPart', 'Rule removed from {table}. {why}', { table: card.tableLabel, why: refusal(t, asDataError(caught)).message }));
            return;
          }
        }
      } else await api.delete(postingAt(card.table, card.posted.id));
      await onSaved(t('rules.removed', 'Rule removed from {table}', { table: card.tableLabel }));
    } catch (caught) {
      setSaid(refusal(t, asDataError(caught)).message);
      setConfirmRemove(false);
    } finally {
      setBusy(null);
    }
  };

  const Icon = lucideByName('workflow');
  const kinds: Readonly<Record<Addable, { title: string; hint: string }>> = {
    discounts: { title: t('rules.kind.discounts', 'Takes discounts'), hint: t('rules.kindHint.discounts', 'Orders, bookings, tickets: anything a discount or a code can reduce.') },
    pays: { title: t('rules.kind.pays', 'Takes a gift card as payment'), hint: t('rules.kindHint.pays', 'A table of payments, where a row can name a gift card.') },
    'sells-cards': { title: t('rules.kind.sellsCards', 'Sells or tops up a gift card'), hint: t('rules.kindHint.sellsCards', 'A table of sale lines, where a line can name the card it loads.') },
    'sells-vouchers': { title: t('rules.kind.sellsVouchers', 'Sells a voucher or a pack'), hint: t('rules.kindHint.sellsVouchers', 'A table of sale lines, where a line can name the voucher it sells.') },
  };
  const columns = source?.columns ?? [];
  const lineColumns = lines?.columns ?? [];
  const money = (column: SourceColumn): boolean => MONEY.has(column.type);
  const writable = (column: SourceColumn): boolean => !column.decided;
  const canMakeAmounts = form.kind === 'discounts' && PARTS.discounts.some(({ part, makes }) => makes === 'amounts' && (form.cols[part] ?? '') === '');

  return (
    <Sheet open onOpenChange={(next) => (next || working ? undefined : onClose())} maxWidth={600}>
      <SheetHeader icon={Icon === undefined ? null : <Icon />} title={editing.card === null ? t('rules.sheet.add', 'Add a rule') : t('rules.sheet.edit', 'Edit rule')} closeLabel={t('shared.close', 'Close')} />
      <SheetPane>
        <Stack gap="md">
          {said === null ? null : <Alert tone="danger" role="alert" title={said} />}
          <RadioGroup value={form.kind} onValueChange={(kind) => set({ ...EMPTY, kind: ADDABLE.find((one) => one === kind) ?? 'discounts', table: form.table })} aria-label={t('rules.sheet.kind', 'What the table does')}>
            {ADDABLE.map((kind) => (
              <RadioCard key={kind} value={kind} title={kinds[kind].title} description={kinds[kind].hint} disabled={working || editing.card !== null} />
            ))}
          </RadioGroup>
          <Select
            label={t('rules.sheet.table', 'Table')}
            value={form.table}
            onChange={(event) => set({ ...EMPTY, kind: form.kind, table: event.target.value })}
            options={[{ value: '', label: t('rules.sheet.chooseTable', 'Choose a table') }, ...sources.map((table) => ({ value: table.table, label: table.label }))]}
            disabled={working || editing.card !== null}
            required
            {...(marked.includes('table') ? { error: t('rules.sheet.err.table', 'Choose a table') } : {})}
          />
          {source === undefined ? null : form.kind === 'discounts' ? (
            <>
              <Select label={t('rules.part.lines', 'Its lines are rows of')} value={form.cols['lines'] ?? ''} onChange={(event) => pick('lines', event.target.value)} options={[{ value: '', label: t('rules.sheet.chooseTable', 'Choose a table') }, ...lineTables.map((one) => ({ value: one.value, label: one.label }))]} disabled={working} required {...needed('lines')} />
              {lineTables.length === 0 ? <Alert tone="warn" title={t('rules.sheet.noLines', 'No table links to this one. A table that takes discounts needs a table of lines.')} /> : null}
              {lines === undefined ? null : (
                <>
                  <Select label={t('rules.part.price', "The line's price")} value={form.cols['price'] ?? ''} onChange={(event) => pick('price', event.target.value)} options={options(lineColumns, money, choose)} disabled={working} required {...needed('price')} />
                  <Select label={t('rules.part.quantity', "The line's quantity")} value={form.cols['quantity'] ?? ''} onChange={(event) => pick('quantity', event.target.value)} options={options(lineColumns, (column) => NUMBERS.has(column.type), t('rules.sheet.one', 'One each'))} disabled={working} />
                  <Select label={t('rules.part.item', 'What the line sells')} hint={t('rules.part.itemHint', 'A link to the thing sold. Without one, a discount for named things cannot apply here; one for the whole order still does.')} value={form.cols['item'] ?? ''} onChange={(event) => pick('item', event.target.value)} options={[{ value: '', label: notNeeded }, ...linksTo(lines, (table) => table !== form.table)]} disabled={working} />
                  <Select label={t('rules.part.category', 'Its category, where the line names one')} value={form.cols['category'] ?? ''} onChange={(event) => pick('category', event.target.value)} options={[{ value: '', label: notNeeded }, ...linksTo(lines, (table) => table !== form.table)]} disabled={working} />
                  <Select label={t('rules.part.type', 'Its type, where the line names one')} value={form.cols['type'] ?? ''} onChange={(event) => pick('type', event.target.value)} options={[{ value: '', label: notNeeded }, ...linksTo(lines, (table) => table !== form.table)]} disabled={working} />
                  <Select label={t('rules.part.lineDiscount', "The line's reduction")} hint={t('rules.part.written', 'Adminium writes it.')} value={form.cols['lineDiscount'] ?? ''} onChange={(event) => pick('lineDiscount', event.target.value)} options={options(lineColumns, (column) => money(column) && writable(column), choose)} disabled={working} required {...(form.making.amounts ? {} : missing('lineDiscount'))} />
                  <Select label={t('rules.part.orderDiscount', "The row's own reduction")} hint={t('rules.part.written', 'Adminium writes it.')} value={form.cols['orderDiscount'] ?? ''} onChange={(event) => pick('orderDiscount', event.target.value)} options={options(columns, (column) => money(column) && writable(column), choose)} disabled={working} required {...(form.making.amounts ? {} : missing('orderDiscount'))} />
                  <Select label={t('rules.part.total', "The row's total")} value={form.cols['total'] ?? ''} onChange={(event) => pick('total', event.target.value)} options={options(columns, money, notNeeded)} disabled={working} />
                  {canMakeAmounts ? <Switch label={t('rules.make.amounts', 'Make it: let Adminium add the amount, subtotal, reduction and total, and the rules that work them out')} checked={form.making.amounts} disabled={working} onCheckedChange={(amounts) => set({ making: { ...form.making, amounts } })} /> : null}
                  <Switch label={t('rules.make.codes', 'Make it: add a table for the codes typed on a row')} checked={form.making.codes} disabled={working} onCheckedChange={(codes) => set({ making: { ...form.making, codes } })} />
                  <WhenField t={t} label={t('rules.part.final', 'The row is final')} hint={t('rules.part.finalHint', 'What was used is recorded then, and the price is never worked out again.')} when={form.when} source={source} disabled={working} onChange={(when) => set({ when })} {...(marked.includes('when') ? { error: t('rules.sheet.err.when', 'Finish each "when" you chose') } : {})} />
                  {form.when.kind === 'never' ? null : <WhenField t={t} label={t('rules.part.undone', 'What was used is given back')} when={form.back} source={source} disabled={working} onChange={(back) => set({ back })} />}
                </>
              )}
            </>
          ) : (
            <>
              {form.kind === 'sells-vouchers' ? (
                <Select label={t('rules.part.voucher', 'The voucher it sells')} value={form.cols['voucher'] ?? ''} onChange={(event) => pick('voucher', event.target.value)} options={[{ value: '', label: choose }, ...linksTo(source, (table) => table === ownId('vouchers'))]} disabled={working} required {...needed('voucher')} />
              ) : (
                <Select label={form.kind === 'pays' ? t('rules.part.cardPays', 'The gift card that pays') : t('rules.part.cardLoads', 'The gift card it loads')} value={form.cols['card'] ?? ''} onChange={(event) => pick('card', event.target.value)} options={[{ value: '', label: choose }, ...linksTo(source, (table) => table === ownId('gift_cards'))]} disabled={working} required {...needed('card')} />
              )}
              {form.kind !== 'sells-vouchers' && linksTo(source, (table) => table === ownId('gift_cards')).length === 0 ? <Alert tone="warn" title={t('rules.sheet.noCardLink', 'This table has no link to Gift cards. Add one first, under the table’s columns.')} /> : null}
              {form.kind === 'sells-vouchers' && linksTo(source, (table) => table === ownId('vouchers')).length === 0 ? <Alert tone="warn" title={t('rules.sheet.noVoucherLink', 'This table has no link to Vouchers. Add one first, under the table’s columns.')} /> : null}
              <Select
                label={form.kind === 'pays' ? t('rules.part.paid', 'What the card paid') : form.kind === 'sells-cards' ? t('rules.part.load', 'The amount it loads') : t('rules.part.sold', 'What it was sold for')}
                {...(form.kind === 'pays' ? { hint: t('rules.part.written', 'Adminium writes it.') } : {})}
                value={form.cols['amount'] ?? ''}
                onChange={(event) => pick('amount', event.target.value)}
                options={options(columns, form.kind === 'pays' ? (column) => money(column) && writable(column) : money, choose)}
                disabled={working}
                required
                {...needed('amount')}
              />
              {form.kind === 'pays' ? <Select label={t('rules.part.balanceAfter', 'What the card holds afterwards')} hint={t('rules.part.written', 'Adminium writes it.')} value={form.cols['balanceAfter'] ?? ''} onChange={(event) => pick('balanceAfter', event.target.value)} options={options(columns, (column) => money(column) && writable(column), choose)} disabled={working} required {...needed('balanceAfter')} /> : null}
              {form.kind === 'sells-vouchers' ? <Select label={t('rules.part.taxLater', 'Tax is charged when it is used')} value={form.cols['taxLater'] ?? ''} onChange={(event) => pick('taxLater', event.target.value)} options={options(columns, (column) => YES_NO.has(column.type), notNeeded)} disabled={working} /> : null}
              <WhenField t={t} label={form.kind === 'pays' ? t('rules.part.whenPays', 'The card pays') : form.kind === 'sells-cards' ? t('rules.part.whenLoads', 'The card is loaded') : t('rules.part.whenSold', 'The voucher is sold')} when={form.when} source={source} disabled={working} onChange={(when) => set({ when })} {...(marked.includes('when') ? { error: t('rules.sheet.err.whenNeeded', 'Choose when, and finish it.') } : {})} />
              <WhenField t={t} label={t('rules.part.back', 'It is undone')} when={form.back} source={source} disabled={working} onChange={(back) => set({ back })} />
              {form.kind === 'pays' ? (
                <>
                  <Select label={t('rules.part.refunds', 'Money given back is a row of')} value={form.cols['refunds'] ?? ''} onChange={(event) => set({ cols: { ...form.cols, refunds: event.target.value, refundRow: '', refundAmount: '' } })} options={[{ value: '', label: t('rules.sheet.noRefunds', 'No table of refunds') }, ...sources.filter((table) => (table.lineOf ?? []).some((link) => link.table === form.table)).map((table) => ({ value: table.table, label: table.label }))]} disabled={working} {...(marked.includes('refunds') ? { error: t('rules.sheet.err.refunds', 'Choose the link to the payment and the amount too.') } : {})} />
                  {refunds === undefined ? null : (
                    <>
                      <Select label={t('rules.part.refundRow', 'Its link to the payment')} value={form.cols['refundRow'] ?? ''} onChange={(event) => pick('refundRow', event.target.value)} options={[{ value: '', label: choose }, ...linksTo(refunds, (table) => table === form.table)]} disabled={working} />
                      <Select label={t('rules.part.refundAmount', 'The amount given back')} value={form.cols['refundAmount'] ?? ''} onChange={(event) => pick('refundAmount', event.target.value)} options={options(refunds.columns, money, choose)} disabled={working} />
                    </>
                  )}
                </>
              ) : null}
            </>
          )}
          {preview === null ? null : (
            <div aria-live="polite">
              <Stack gap="xs">
                <span className="text-body-sm text-fg-muted">{t('rules.sheet.reads', 'Reads as')}</span>
                {sentence(t, preview, names).map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </Stack>
            </div>
          )}
          {asked === null ? null : (
            <Alert
              tone="info"
              role="status"
              title={t('rules.make.title', 'Adminium will add this, with the rule')}
              body={names.list([...asked.columns.map((column) => t('rules.make.column', '{column} on {table}', { column: column.column, table: names.table(column.table) })), ...asked.tables.map((table) => t('rules.make.table', 'the table {table}', { table }))])}
            />
          )}
          {confirmRemove ? (
            <Alert
              tone="danger"
              title={t('rules.remove.confirm', 'Remove this rule? Rows of this table stop having anything to do with offers.')}
              action={
                <Stack direction="row" gap="xs">
                  <Button variant="destructive" size="sm" onClick={() => void remove()}>
                    {t('rules.remove', 'Remove rule')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(false)}>
                    {t('shared.cancel', 'Cancel')}
                  </Button>
                </Stack>
              }
            />
          ) : null}
        </Stack>
      </SheetPane>
      <SheetFooter>
        {editing.card === null ? null : (
          <Button variant="ghost" loading={busy === 'remove'} disabled={working} onClick={() => setConfirmRemove(true)}>
            {t('rules.remove', 'Remove rule')}
          </Button>
        )}
        <Button variant="secondary" disabled={working} onClick={() => onClose()}>
          {t('shared.cancel', 'Cancel')}
        </Button>
        <Button variant="primary" loading={busy === 'save'} disabled={working} onClick={() => void save()}>
          {asked === null ? t('rules.sheet.save', 'Save rule') : t('rules.make.save', 'Add these and save')}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}

/**
 * One "when": never, when the row is made, when it moves to a state, when a
 * column takes a value, when a column is filled. For a line of another row
 * (`own` given), the states are that row's and the columns are the line's own.
 */
function WhenField({ t, label, hint, when, source, own, disabled, onChange, error }: { t: AddOnTranslate; label: string; hint?: string; when: When; source: SourceTable; own?: SourceTable; disabled: boolean; onChange: (when: When) => void; error?: string }): ReactNode {
  const states = source.states ?? [];
  const columns = (own ?? source).columns;
  const mine = own === undefined ? {} : { own: true as const };
  const choices = columns.filter((column) => (column.enum ?? []).length > 0 && !column.decided);
  const kinds = [
    { value: 'never', label: t('rules.when.never', 'Never') },
    { value: 'create', label: t('rules.when.create', 'When the row is created') },
    ...(states.length > 0 ? [{ value: 'moves', label: t('rules.when.moves', 'When {table} moves to', { table: source.label }) }] : []),
    ...(choices.length > 0 ? [{ value: 'becomes', label: t('rules.when.becomes', 'When a column becomes') }] : []),
    { value: 'set', label: t('rules.when.set', 'When a column is set') },
  ];
  const pickKind = (kind: string): void => {
    if (kind === 'create') onChange({ kind: 'create' });
    else if (kind === 'moves') onChange({ kind: 'moves', to: [] });
    else if (kind === 'becomes') onChange({ kind: 'becomes', column: choices[0]?.name ?? '', values: [], ...mine });
    else if (kind === 'set') onChange({ kind: 'set', column: '', ...mine });
    else onChange({ kind: 'never' });
  };
  const flip = (held: readonly string[], value: string): string[] => (held.includes(value) ? held.filter((one) => one !== value) : [...held, value]);
  const values = when.kind === 'becomes' ? (columns.find((column) => column.name === when.column)?.enum ?? []) : [];
  return (
    <Stack gap="xs">
      <Select label={label} value={when.kind} onChange={(event) => pickKind(event.target.value)} options={kinds} disabled={disabled} {...(hint === undefined ? {} : { hint })} {...(error === undefined ? {} : { error })} />
      {when.kind === 'moves' ? (
        <Stack direction="row" gap="sm" wrap>
          {states.map((state) => (
            <Switch key={state} label={state} checked={when.to.includes(state)} disabled={disabled} onCheckedChange={() => onChange({ kind: 'moves', to: flip(when.to, state) })} />
          ))}
        </Stack>
      ) : null}
      {when.kind === 'becomes' ? (
        <>
          <Select aria-label={t('rules.when.column', '{label}: which column', { label })} value={when.column} onChange={(event) => onChange({ kind: 'becomes', column: event.target.value, values: [], ...mine })} options={choices.map((column) => ({ value: column.name, label: column.label }))} disabled={disabled} />
          <Stack direction="row" gap="sm" wrap>
            {values.map((value) => (
              <Switch key={value} label={value} checked={when.values.includes(value)} disabled={disabled} onCheckedChange={() => onChange({ kind: 'becomes', column: when.column, values: flip(when.values, value), ...mine })} />
            ))}
          </Stack>
        </>
      ) : null}
      {when.kind === 'set' ? (
        <Select aria-label={t('rules.when.column', '{label}: which column', { label })} value={when.column} onChange={(event) => onChange({ kind: 'set', column: event.target.value, ...mine })} options={[{ value: '', label: t('rules.sheet.chooseColumn', 'Choose a column') }, ...columns.filter((column) => !column.decided).map((column) => ({ value: column.name, label: column.label }))]} disabled={disabled} />
      ) : null}
    </Stack>
  );
}
