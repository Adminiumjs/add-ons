/**
 * STOCK RULES: which tables take from stock, and when.
 *
 * A card for each rule, an app's first and then the owner's. Everyone who may
 * open the page reads them; only someone who may change how tables work can
 * add one, edit one or switch one off — and an app's own rule can be switched
 * off, never rewritten: its steps change with an update of the app.
 *
 * The routes are the ledger's own (nothing here is Inventory's server code):
 * the page reads a rule, sends it back whole, and shows what Adminium answers.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  Alert,
  Button,
  Card,
  EmptyState,
  RadioCard,
  RadioGroup,
  Select,
  Sheet,
  SheetBody,
  SheetFooter,
  SheetHeader,
  Spinner,
  Stack,
  Switch,
  Tag,
  api,
  asDataError,
  lucideByName,
  useAccess,
  useAppToasts,
  useLocaleTag,
  useRecords,
  useSearch,
  type AddOnTranslate,
  type DataError,
} from '../shared/host.ts';
import { PageFrame } from '../shared/PageFrame.tsx';
import { refusal } from '../shared/refusal.ts';
import { EMPTY, appName, formOf, formProblems, nextId, ruleOf, sentence, type Form, type Listed, type Names, type SourceTable, type When } from './rule.ts';

const LEDGER = '/api/v1/ledgers/inventory/stock';
const text = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

interface Kit {
  connectionId: string;
  tables: Record<string, { id: string }>;
}
interface Sources {
  tables: SourceTable[];
}

/** What the page read, or why it could not. */
interface Read {
  kit: Kit;
  rules: Listed[];
  canChange: boolean;
  sources: Sources | null;
}

const NUMBERS = new Set(['int', 'integer', 'bigint', 'decimal', 'number', 'float', 'money']);
const TIMES = new Set(['timestamptz', 'timestamp', 'datetime', 'date']);

export function Rules({ t }: { t: AddOnTranslate }): ReactNode {
  const access = useAccess();
  const toasts = useAppToasts();
  const locale = useLocaleTag();
  const opened = text(useSearch({ strict: false })['rule']);
  const mayOpen = access.canRead('settings');
  const places = useRecords('places', { sort: [{ column: 'name', direction: 'asc' }], pageSize: 199, columns: ['id', 'name', 'active'], enabled: mayOpen });

  const [read, setRead] = useState<Read | null>(null);
  const [failed, setFailed] = useState<DataError | null>(null);
  const [editing, setEditing] = useState<{ rule: Listed | null; form: Form } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<Readonly<Record<string, string>>>({});
  const [offerItems, setOfferItems] = useState<string | null>(null);

  const load = useCallback(async (): Promise<Read | null> => {
    try {
      const kit = await api.get<Kit>('/api/v1/add-ons/inventory/kit');
      const at = `?connectionId=${encodeURIComponent(kit.connectionId)}`;
      const listed = await api.get<{ postings: Listed[]; canChange: boolean }>(`${LEDGER}/postings${at}`);
      // The pickers are read only for someone who may use them.
      const sources = listed.canChange ? await api.get<Sources>(`${LEDGER}/sources${at}`) : null;
      const next = { kit, rules: listed.postings, canChange: listed.canChange, sources };
      setRead(next);
      setFailed(null);
      return next;
    } catch (caught) {
      setFailed(asDataError(caught));
      return null;
    }
  }, []);

  useEffect(() => {
    if (mayOpen) void load();
  }, [load, mayOpen]);

  // The address may name one rule: its sheet opens once the rules are read.
  useEffect(() => {
    if (opened === '' || read === null || !read.canChange || editing !== null) return;
    const rule = read.rules.find((candidate) => `${candidate.table}:${candidate.id}` === opened && candidate.owner === null);
    if (rule !== undefined) setEditing({ rule, form: formOf(rule) });
    // Only when the rules arrive: closing the sheet must not open it again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, read]);

  const list = useMemo(() => new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }), [locale]);
  const namesFor = useCallback(
    (table: string, parent?: string): Names => {
      const source = read?.sources?.tables.find((candidate) => candidate.table === table);
      return {
        column: (name) => source?.columns.find((column) => column.name === name)?.label ?? name,
        ...(parent === undefined ? {} : { parent }),
        place: (id) => text(places.rows.find((place) => text(place['id']) === id)?.['name']) || id,
        list: (values) => list.format(values),
      };
    },
    [read, places.rows, list],
  );

  if (!mayOpen) return <PageFrame t={t} title={t('rules.title', 'Stock rules')} refused />;
  if (read === null) return <PageFrame t={t} title={t('rules.title', 'Stock rules')} loading={failed === null} error={failed} onRetry={() => void load()} />;

  const base = (rule: { table: string; id: string }): string => `/api/v1/connections/${encodeURIComponent(read.kit.connectionId)}/tables/${encodeURIComponent(rule.table)}/postings/${encodeURIComponent(rule.id)}`;
  // A rule of an app this add-on is not switched on for does nothing, and is not drawn.
  const drawn = [...read.rules.filter((rule) => rule.state !== 'idle' && rule.owner !== null), ...read.rules.filter((rule) => rule.state !== 'idle' && rule.owner === null)];
  const key = (rule: Listed): string => `${rule.table}:${rule.id}`;

  const toggle = async (rule: Listed, enabled: boolean): Promise<void> => {
    setBusy(key(rule));
    setSaid((all) => Object.fromEntries(Object.entries(all).filter(([k]) => k !== key(rule))));
    try {
      const answer = await api.patch<{ enabled: boolean }>(`${base(rule)}/switch`, { enabled });
      toasts.push({ variant: 'info', title: answer.enabled ? t('rules.switchedOn', '{table} rule switched on', { table: rule.tableLabel }) : t('rules.switchedOff', '{table} rule switched off', { table: rule.tableLabel }) });
      await load();
    } catch (caught) {
      setSaid((all) => ({ ...all, [key(rule)]: refusal(t, asDataError(caught)).message }));
    } finally {
      setBusy(null);
    }
  };

  const catchUp = async (rule: Listed): Promise<void> => {
    setBusy(key(rule));
    try {
      const answer = await api.post<{ planned: number; refused: unknown[]; left: number }>(`${LEDGER}/catch-up`, { connectionId: read.kit.connectionId });
      toasts.push({ variant: answer.left === 0 ? 'success' : 'warning', title: t('rules.caughtUp', '{planned} recorded, {left} still waiting', { planned: answer.planned, left: answer.left }) });
      await load();
    } catch (caught) {
      setSaid((all) => ({ ...all, [key(rule)]: refusal(t, asDataError(caught)).message }));
    } finally {
      setBusy(null);
    }
  };

  const Plus = lucideByName('plus');
  return (
    <PageFrame
      t={t}
      title={t('rules.title', 'Stock rules')}
      testId="inventory-rules"
      actions={
        read.canChange ? (
          <Button variant="primary" iconLeft={<Plus />} onClick={() => setEditing({ rule: null, form: EMPTY })}>
            {t('rules.add', 'Add a rule')}
          </Button>
        ) : null
      }
    >
      {read.canChange ? null : <Alert tone="info" title={t('rules.fixed', 'Only someone who may change how tables work can change these rules.')} />}
      {drawn.length === 0 ? (
        <EmptyState title={t('rules.empty.title', 'No table takes from stock yet')} body={t('rules.empty.body', 'A rule says when a row of one of your tables holds, takes or puts back stock.')} {...(read.canChange ? { actions: <Button onClick={() => setEditing({ rule: null, form: EMPTY })}>{t('rules.add', 'Add a rule')}</Button> } : {})} />
      ) : null}
      {drawn.map((rule) => {
        const mine = rule.owner === null;
        const lines = sentence(t, rule, namesFor(rule.table, rule.via === undefined ? undefined : t('rules.point.parent', 'its {column}', { column: namesFor(rule.table).column(rule.via) })));
        return (
          <Card
            key={key(rule)}
            title={rule.tableLabel}
            description={mine ? t('rules.badge.yours', 'Your table') : t('rules.badge.app', 'From {app}', { app: appName(rule.owner ?? '') })}
            actions={
              <Stack direction="row" gap="sm" align="center">
                {rule.enabled ? null : <Tag tone="neutral">{t('rules.off', 'Off')}</Tag>}
                <Switch label={t('rules.switchLabel', '{table} rule', { table: rule.tableLabel })} checked={rule.enabled} disabled={!read.canChange || busy !== null} onCheckedChange={(next) => void toggle(rule, next)} />
                {mine && read.canChange ? (
                  <Button variant="secondary" size="sm" disabled={busy !== null} onClick={() => setEditing({ rule, form: formOf(rule) })}>
                    {t('rules.edit', 'Edit')}
                  </Button>
                ) : null}
              </Stack>
            }
          >
            <Stack gap="sm">
              <Stack gap="xs">
                {lines.map((line) => (
                  <span key={line} className="text-fg">
                    {line}
                  </span>
                ))}
              </Stack>
              {mine ? null : <span className="text-body-sm text-fg-muted">{t('rules.setBy', 'Set by {app}. You can switch it off; its steps change only with an update of {app}.', { app: appName(rule.owner ?? '') })}</span>}
              {rule.state === 'unavailable' ? <Alert tone="warn" title={t('rules.unavailable', 'Inventory could not answer for this table. New saves wait or are refused.')} /> : null}
              {rule.unplanned > 0 ? (
                <Alert
                  tone="warn"
                  title={t('rules.waiting', '{count, plural, one {# save is} other {# saves are}} waiting', { count: rule.unplanned })}
                  {...(read.canChange ? { action: <Button variant="secondary" size="sm" loading={busy === key(rule)} disabled={busy !== null} onClick={() => void catchUp(rule)}>{t('rules.recordNow', 'Record them now')}</Button> } : {})}
                />
              ) : null}
              {said[key(rule)] === undefined ? null : <Alert tone="danger" role="alert" title={said[key(rule)]} />}
              {mine && read.canChange && offerItems === key(rule) ? <MakeItems t={t} connectionId={read.kit.connectionId} rule={rule} source={read.sources?.tables.find((table) => table.table === rule.table)} onDone={() => setOfferItems(null)} /> : null}
              {mine && read.canChange && offerItems !== key(rule) && rule.action !== 'use-item' ? (
                <Stack direction="row">
                  <Button variant="link" size="sm" onClick={() => setOfferItems(key(rule))}>
                    {t('rules.makeItems', 'Make stock items from this table')}
                  </Button>
                </Stack>
              ) : null}
            </Stack>
          </Card>
        );
      })}
      {editing === null || read.sources === null ? null : (
        <RuleSheet
          t={t}
          editing={editing}
          sources={read.sources}
          itemsTable={read.kit.tables['items']?.id ?? ''}
          places={places.rows.filter((place) => place['active'] !== false && place['active'] !== 0).map((place) => ({ id: text(place['id']), name: text(place['name']) }))}
          names={namesFor}
          taken={read.rules.filter((rule) => rule.table === editing.form.table).map((rule) => rule.id)}
          path={base}
          onClose={() => setEditing(null)}
          onSaved={async (rule, fresh) => {
            setEditing(null);
            await load();
            // A new rule on a table that is not Inventory's own: its rows can be made into stock items.
            if (fresh && rule.action !== 'use-item') setOfferItems(`${rule.table}:${rule.id}`);
          }}
        />
      )}
    </PageFrame>
  );
}

function MakeItems({ t, connectionId, rule, source, onDone }: { t: AddOnTranslate; connectionId: string; rule: Listed; source: SourceTable | undefined; onDone: () => void }): ReactNode {
  const toasts = useAppToasts();
  const labels = (source?.columns ?? []).filter((column) => column.type === 'text' || column.type === 'string');
  const [label, setLabel] = useState(labels[0]?.name ?? '');
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const make = async (): Promise<void> => {
    setBusy(true);
    setSaid(null);
    try {
      let [made, skipped, after] = [0, 0, undefined as string | undefined];
      // The route answers a page at a time: the same call again, from where the last one stopped.
      for (let calls = 0; calls < 200; calls += 1) {
        const answer = await api.post<{ made: number; skipped: number; more: boolean; next?: string }>(`${LEDGER}/make-items`, { connectionId, table: rule.table, label, limit: 500, ...(after === undefined ? {} : { after }) });
        made += answer.made;
        skipped += answer.skipped;
        after = answer.next;
        if (!answer.more || answer.next === undefined) break;
      }
      toasts.push({ variant: 'success', title: t('rules.itemsMade', '{made} items made, {skipped} already linked', { made, skipped }) });
      onDone();
    } catch (caught) {
      const error = asDataError(caught);
      setSaid(error.code === 'POSTING_REFUSED' && error.details?.['reason'] === 'not-allowed' ? t('rules.needsUnit', 'Choose a default unit in Settings first') : refusal(t, error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Stack gap="sm">
      <Select label={t('rules.makeItems.label', 'The column that names each row')} value={label} onChange={(event) => setLabel(event.target.value)} options={labels.map((column) => ({ value: column.name, label: column.label }))} disabled={busy} />
      {said === null ? null : <Alert tone="danger" role="alert" title={said} />}
      <Stack direction="row" gap="sm">
        <Button variant="primary" size="sm" loading={busy} disabled={busy || label === ''} onClick={() => void make()}>
          {t('rules.makeItems.go', 'Make the items')}
        </Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => onDone()}>
          {t('shared.cancel', 'Cancel')}
        </Button>
      </Stack>
    </Stack>
  );
}

interface RuleSheetProps {
  t: AddOnTranslate;
  editing: { rule: Listed | null; form: Form };
  sources: Sources;
  itemsTable: string;
  places: readonly { id: string; name: string }[];
  names: (table: string, parent?: string) => Names;
  taken: readonly string[];
  path: (rule: { table: string; id: string }) => string;
  onClose: () => void;
  onSaved: (rule: { table: string; id: string; action: string }, fresh: boolean) => Promise<void>;
}

function RuleSheet({ t, editing, sources, itemsTable, places, names, taken, path, onClose, onSaved }: RuleSheetProps): ReactNode {
  const [form, setForm] = useState<Form>(editing.form);
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [marked, setMarked] = useState<readonly string[]>([]);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [reads, setReads] = useState<string[]>([]);
  const source = sources.tables.find((table) => table.table === form.table);
  const set = (patch: Partial<Form>): void => {
    setForm((before) => ({ ...before, ...patch }));
    setMarked([]);
  };

  // "Reads as" follows the form a moment after it stops changing: it is said aloud, and must not chatter.
  useEffect(() => {
    const timer = setTimeout(() => setReads(form.table === '' ? [] : sentence(t, { id: 'draft', ...ruleOf(form, itemsTable, source) }, names(form.table))), 400);
    return () => clearTimeout(timer);
  }, [form, itemsTable, source, names, t]);

  const save = async (): Promise<void> => {
    setSaid(null);
    const problems = formProblems(form);
    setMarked(problems);
    // Hold and Take both "Never": the error sits on the Take row, and nothing is sent.
    if (problems.length > 0) return;
    setBusy('save');
    const id = editing.rule?.id ?? nextId(taken);
    const { action, ...rest } = ruleOf(form, itemsTable, source);
    try {
      await api.put(path({ table: form.table, id }), { into: { addOn: 'inventory', ledger: 'stock', action }, ...rest });
      await onSaved({ table: form.table, id, action }, editing.rule === null);
    } catch (caught) {
      setSaid(refusal(t, asDataError(caught)).message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (): Promise<void> => {
    if (editing.rule === null) return;
    setConfirmRemove(false);
    setBusy('remove');
    try {
      await api.delete(path(editing.rule));
      await onSaved({ table: editing.rule.table, id: editing.rule.id, action: 'use-item' }, false);
    } catch (caught) {
      setSaid(refusal(t, asDataError(caught)).message);
    } finally {
      setBusy(null);
    }
  };

  const columns = source?.columns ?? [];
  const pick = (kept: (column: { name: string; type: string; decided: boolean }) => boolean, none: string): { value: string; label: string }[] => [{ value: '', label: none }, ...columns.filter(kept).map((column) => ({ value: column.name, label: column.label }))];
  const numbers = pick((column) => NUMBERS.has(column.type), t('rules.sheet.one', 'One each time'));
  const links = (source?.lineOf ?? []).map((link) => ({ value: link.via, label: columns.find((column) => column.name === link.via)?.label ?? link.via }));
  const Icon = lucideByName('workflow');
  const working = busy !== null;
  return (
    <Sheet open onOpenChange={(next) => (next || working ? undefined : onClose())} maxWidth={560}>
      <SheetHeader icon={<Icon />} title={editing.rule === null ? t('rules.sheet.add', 'Add a rule') : t('rules.sheet.edit', 'Edit rule')} closeLabel={t('shared.close', 'Close')} />
      <SheetBody>
        <Stack gap="md">
          {said === null ? null : <Alert tone="danger" role="alert" title={said} />}
          <Select
            label={t('rules.sheet.table', 'Table')}
            value={form.table}
            onChange={(event) => set({ ...EMPTY, table: event.target.value })}
            options={[{ value: '', label: t('rules.sheet.chooseTable', 'Choose a table') }, ...sources.tables.map((table) => ({ value: table.table, label: table.label }))]}
            disabled={working || editing.rule !== null}
            required
            {...(marked.includes('table') ? { error: t('rules.sheet.err.table', 'Choose a table') } : {})}
          />
          {source === undefined ? (
            form.table === '' ? null : <Spinner label={t('shared.loading', 'Loading')} />
          ) : (
            <>
              <RadioGroup value={form.used === 'row' ? 'row' : 'link'} onValueChange={(next) => set({ used: next === 'row' ? 'row' : (links[0]?.value ?? 'row') })} aria-label={t('rules.sheet.used', 'What is used')}>
                <RadioCard value="row" title={t('rules.sheet.used.row', 'This row')} description={t('rules.sheet.used.rowHelp', 'Each row of the table is something kept in stock.')} />
                <RadioCard value="link" title={t('rules.sheet.used.link', 'A linked column')} description={t('rules.sheet.used.linkHelp', 'The row points at what is used.')} disabled={links.length === 0} />
              </RadioGroup>
              {form.used === 'row' ? null : <Select label={t('rules.sheet.linkColumn', 'Which column')} value={form.used} onChange={(event) => set({ used: event.target.value })} options={links} disabled={working} />}
              <Select label={t('rules.sheet.quantity', 'How many')} value={form.quantity} onChange={(event) => set({ quantity: event.target.value })} options={numbers} disabled={working} />
              <Select label={t('rules.sheet.night', 'Counted for each night in')} value={form.night} onChange={(event) => set({ night: event.target.value })} options={pick((column) => NUMBERS.has(column.type), t('rules.sheet.notNeeded', 'Not needed'))} disabled={working} />
              <Select label={t('rules.sheet.guest', 'Counted for each guest in')} value={form.guest} onChange={(event) => set({ guest: event.target.value })} options={pick((column) => NUMBERS.has(column.type), t('rules.sheet.notNeeded', 'Not needed'))} disabled={working} />
              <WhenField t={t} label={t('rules.sheet.hold', 'Hold')} when={form.hold} source={source} disabled={working} onChange={(hold) => set({ hold })} />
              {form.hold.kind === 'never' ? null : (
                <Select
                  label={t('rules.sheet.until', 'Until when')}
                  value={form.until}
                  onChange={(event) => set({ until: event.target.value })}
                  options={pick((column) => TIMES.has(column.type), t('rules.sheet.chooseColumn', 'Choose a column'))}
                  disabled={working}
                  required
                  {...(marked.includes('until') ? { error: t('rules.sheet.err.until', 'A hold needs the column that says when it ends') } : {})}
                />
              )}
              <WhenField t={t} label={t('rules.sheet.take', 'Take')} when={form.take} source={source} disabled={working} onChange={(take) => set({ take })} {...(marked.includes('take') ? { error: t('rules.sheet.err.take', 'Choose when stock is held or taken') } : marked.includes('when') ? { error: t('rules.sheet.err.when', 'Finish each "when" you chose') } : {})} />
              <WhenField t={t} label={t('rules.sheet.back', 'Put back')} when={form.back} source={source} disabled={working} onChange={(back) => set({ back })} />
              <Select
                label={t('rules.sheet.place', 'From which place')}
                value={form.place}
                onChange={(event) => set({ place: event.target.value })}
                options={[{ value: '', label: t('rules.sheet.defaultPlace', 'The default place') }, ...places.map((place) => ({ value: `place:${place.id}`, label: place.name })), ...links.map((link) => ({ value: `column:${link.value}`, label: t('rules.sheet.placeColumn', 'The place in {column}', { column: link.label }) }))]}
                disabled={working}
              />
              <div aria-live="polite">
                <Stack gap="xs">
                  <span className="text-body-sm text-fg-muted">{t('rules.sheet.reads', 'Reads as')}</span>
                  {reads.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </Stack>
              </div>
            </>
          )}
          {confirmRemove ? (
            <Alert
              tone="danger"
              title={t('rules.remove.confirm', 'Remove this rule? Rows of this table stop taking from stock.')}
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
      </SheetBody>
      <SheetFooter>
        {editing.rule === null ? null : (
          <Button variant="ghost" loading={busy === 'remove'} disabled={working} onClick={() => setConfirmRemove(true)}>
            {t('rules.remove', 'Remove rule')}
          </Button>
        )}
        <Button variant="secondary" disabled={working} onClick={() => onClose()}>
          {t('shared.cancel', 'Cancel')}
        </Button>
        <Button variant="primary" loading={busy === 'save'} disabled={working} onClick={() => void save()}>
          {t('rules.sheet.save', 'Save rule')}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}

/** One "when": never, when the row is made, when it moves to a state, when a column takes a value, when a column is filled. */
function WhenField({ t, label, when, source, disabled, onChange, error }: { t: AddOnTranslate; label: string; when: When; source: SourceTable; disabled: boolean; onChange: (when: When) => void; error?: string }): ReactNode {
  const states = source.states ?? [];
  const choices = source.columns.filter((column) => (column.enum ?? []).length > 0 && !column.decided);
  const kinds = [
    { value: 'never', label: t('rules.when.never', 'Never') },
    { value: 'create', label: t('rules.when.create', 'When the row is created') },
    ...(states.length > 0 ? [{ value: 'moves', label: t('rules.when.moves', 'When the row moves to') }] : []),
    ...(choices.length > 0 ? [{ value: 'becomes', label: t('rules.when.becomes', 'When a column becomes') }] : []),
    { value: 'set', label: t('rules.when.set', 'When a column is set') },
  ];
  const pickKind = (kind: string): void => {
    if (kind === 'create') onChange({ kind: 'create' });
    else if (kind === 'moves') onChange({ kind: 'moves', to: [] });
    else if (kind === 'becomes') onChange({ kind: 'becomes', column: choices[0]?.name ?? '', values: [] });
    else if (kind === 'set') onChange({ kind: 'set', column: '' });
    else onChange({ kind: 'never' });
  };
  const flip = (list: readonly string[], value: string): string[] => (list.includes(value) ? list.filter((held) => held !== value) : [...list, value]);
  const values = when.kind === 'becomes' ? (source.columns.find((column) => column.name === when.column)?.enum ?? []) : [];
  return (
    <Stack gap="xs">
      <Select label={label} value={when.kind} onChange={(event) => pickKind(event.target.value)} options={kinds} disabled={disabled} {...(error === undefined ? {} : { error })} />
      {when.kind === 'moves' ? (
        <Stack direction="row" gap="sm" wrap>
          {states.map((state) => (
            <Switch key={state} label={state} checked={when.to.includes(state)} disabled={disabled} onCheckedChange={() => onChange({ kind: 'moves', to: flip(when.to, state) })} />
          ))}
        </Stack>
      ) : null}
      {when.kind === 'becomes' ? (
        <>
          <Select aria-label={t('rules.when.column', '{label}: which column', { label })} value={when.column} onChange={(event) => onChange({ kind: 'becomes', column: event.target.value, values: [] })} options={choices.map((column) => ({ value: column.name, label: column.label }))} disabled={disabled} />
          <Stack direction="row" gap="sm" wrap>
            {values.map((value) => (
              <Switch key={value} label={value} checked={when.values.includes(value)} disabled={disabled} onCheckedChange={() => onChange({ kind: 'becomes', column: when.column, values: flip(when.values, value) })} />
            ))}
          </Stack>
        </>
      ) : null}
      {when.kind === 'set' ? (
        <Select aria-label={t('rules.when.column', '{label}: which column', { label })} value={when.column} onChange={(event) => onChange({ kind: 'set', column: event.target.value })} options={[{ value: '', label: t('rules.sheet.chooseColumn', 'Choose a column') }, ...source.columns.filter((column) => !column.decided).map((column) => ({ value: column.name, label: column.label }))]} disabled={disabled} />
      ) : null}
    </Stack>
  );
}
