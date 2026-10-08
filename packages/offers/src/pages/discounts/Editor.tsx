/**
 * THE DISCOUNT EDITOR: what it gives, what it applies to, how it starts,
 * when, for whom, its limits, and whether it adds to others — with the
 * discount tried on a saved order beside it.
 *
 * THE SERVER DECIDES. The state, the uses, the amount given and "used up"
 * are read from the row a save or a move answers with; none is worked out
 * here. A refused save keeps every typed value and says why on the field.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  AffixInput,
  Alert,
  Button,
  Card,
  DateInput,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Field,
  Grid,
  IconButton,
  Input,
  Menu,
  MenuItem,
  NumberInput,
  RadioCard,
  RadioGroup,
  SegmentedControl,
  Select,
  Stack,
  StatusPill,
  Switch,
  Tag,
  ToggleChip,
  asDataError,
  lucideByName,
  money,
  useAppToasts,
  useBlocker,
  useLocaleTag,
  useNavigate,
  useRead,
  useRecord,
  useRecords,
  useStateMove,
  useTreeWrite,
  useWrite,
  type AddOnTranslate,
  type DataRow,
} from '../shared/host.ts';
import { PageFrame } from '../shared/PageFrame.tsx';
import { DISCOUNTS } from '../shared/paths.ts';
import { refusal } from '../shared/refusal.ts';
import { useRole } from '../shared/role.ts';
import { mapped as readMapped, type Mapped } from '../shared/things.ts';
import { BLANK, LOCALES, NOT_STORED, check, fromRows, needsTargets, neverApplies, offerValues, rekeyed, same, type Form, type Gives, type Stored, type Target, type Trigger } from './form.ts';
import { askCode, saveDiscount } from './save.ts';
import { TargetPicker } from './TargetPicker.tsx';
import { TryPane } from './TryPane.tsx';
import { pillOf, pillTone, pillWords, shortDay, weekOrder, weekdayName } from './words.ts';

const text = (value: unknown): string => (value === null || value === undefined ? '' : String(value));
/** Below this the try pane is a bar and a sheet. */
const WIDE = 1180;

function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < WIDE);
  useEffect(() => {
    const read = (): void => setNarrow(window.innerWidth < WIDE);
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);
  return narrow;
}

export function Editor({ t, offerId }: { t: AddOnTranslate; offerId: string | null }): ReactNode {
  const locale = useLocaleTag();
  const mainLocale = (LOCALES as readonly string[]).includes(locale) ? locale : 'en-US';
  const role = useRole();
  const toasts = useAppToasts();
  const navigate = useNavigate();
  const narrow = useNarrow();
  const offer = useRecord('offers', offerId);
  const byOffer = offerId === null ? [] : [{ column: 'offer_id', op: 'eq' as const, value: /^\d+$/.test(offerId) ? Number(offerId) : offerId }];
  const steps = useRecords('offer_breaks', { filter: byOffer, pageSize: 50, enabled: offerId !== null });
  const targets = useRecords('offer_targets', { filter: byOffer, pageSize: 199, enabled: offerId !== null });
  const codes = useRecords('codes', { filter: byOffer, pageSize: 50, sort: [{ column: 'id', direction: 'asc' }], enabled: offerId !== null });
  // A reader who may not read the groups is asked for none: a grouped discount then reads "A customer group".
  const groups = useRecords('groups', { sort: [{ column: 'name', direction: 'asc' }], pageSize: 199, columns: ['id', 'name'], enabled: role.readsGroups });
  const reads = useRead();
  const savers = { tree: useTreeWrite('offers'), offers: useWrite('offers'), steps: useWrite('offer_breaks'), targets: useWrite('offer_targets'), codes: useWrite('codes') };
  const move = useStateMove('offers');

  const [form, setForm] = useState<Form>(BLANK);
  const [loaded, setLoaded] = useState<Form>(BLANK);
  const [stored, setStored] = useState<Stored>(NOT_STORED);
  const [row, setRow] = useState<DataRow | null>(null);
  const [ready, setReady] = useState(offerId === null);
  const [wrong, setWrong] = useState<Readonly<Record<string, string>>>({});
  const [said, setSaid] = useState<string | null>(null);
  const [warned, setWarned] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [ending, setEnding] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [raising, setRaising] = useState(false);
  const [moreNames, setMoreNames] = useState(false);
  const [map, setMap] = useState<Mapped | null>(null);
  const [mapSaid, setMapSaid] = useState<string | null>(null);
  const usesRef = useRef<HTMLDivElement | null>(null);
  const leaving = useRef(false);

  const lists = offerId === null || (!steps.loading && !targets.loading && !codes.loading);
  // What was read, as text: a list handed anew on every draw is the same read while its rows are the same.
  const read = offer.row === null || !lists ? null : JSON.stringify([offer.row, steps.rows, targets.rows, codes.rows]);
  const typing = useRef(false);
  // The form is filled from a whole read, and again from a later one only while nothing typed is unsaved.
  useEffect(() => {
    if (read === null || (ready && typing.current)) return;
    const [offerRow, stepRows, targetRows, codeRows] = JSON.parse(read) as [DataRow, DataRow[], DataRow[], DataRow[]];
    const filled = fromRows(offerRow, stepRows, targetRows, codeRows);
    setForm(filled.form);
    setLoaded(filled.form);
    setStored(filled.stored);
    setRow(offerRow);
    setReady(true);
  }, [read, ready]);

  useEffect(() => {
    let live = true;
    readMapped().then(
      (next) => (live ? setMap(next) : undefined),
      (caught: unknown) => (live ? setMapSaid(refusal(t, asDataError(caught)).message) : undefined),
    );
    return () => {
      live = false;
    };
  }, [t]);

  // "Raise the limit" opens the field and puts the person in it, once it can take them.
  useEffect(() => {
    if (raising) usesRef.current?.querySelector('input')?.focus();
  }, [raising]);

  const dirty = !same(form, loaded);
  typing.current = dirty;
  const blocker = useBlocker({ shouldBlockFn: () => dirty && !leaving.current, enableBeforeUnload: () => dirty && !leaving.current, withResolver: true });
  const draft = useMemo(() => {
    const values = offerValues(form);
    // A try takes plain values: the names by language go as their text, and a draft is tried as if it were on.
    return { ...values, public_name: JSON.stringify(values['public_name']), status: 'active' };
  }, [form]);

  const pill = row === null ? 'draft' : pillOf(row);
  const ended = stored.status === 'ended';
  const usedUp = stored.usedUp && stored.status === 'active';
  const mayEdit = role.editOffers;
  const locked = !mayEdit || ended || (usedUp && !raising);
  const set = (patch: Partial<Form>): void => setForm((held) => ({ ...held, ...patch }));
  const on = (field: string): { error?: string } => (wrong[field] === undefined ? {} : { error: wrong[field] });

  /** What the server answered for the offer: its state and its counts replace the page's. */
  const took = (answered: DataRow, next: Form): void => {
    const merged = { ...(row ?? {}), ...answered };
    setRow(merged);
    setLoaded(next);
    setStored((held) => ({ ...held, id: text(merged['id']), status: (['draft', 'active', 'paused', 'ended'] as const).find((one) => one === merged['status']) ?? held.status, uses: Number(merged['uses'] ?? held.uses) || 0, given: merged['given'] === undefined || merged['given'] === null ? held.given : text(merged['given']), usedUp: merged['used_up'] === true || merged['used_up'] === 1 }));
  };

  /** The discount as it stands on the server now, read at once (not when the screen next draws). */
  const reread = async (id: string): Promise<{ form: Form; stored: Stored } | null> => {
    const key = /^\d+$/.test(id) ? Number(id) : id;
    const by = [{ column: 'offer_id', op: 'eq' as const, value: key }];
    const [offerRow, stepRows, targetRows, codeRows] = await Promise.all([reads.get('offers', key), reads.list('offer_breaks', { filter: by, pageSize: 50 }), reads.list('offer_targets', { filter: by, pageSize: 199 }), reads.list('codes', { filter: by, pageSize: 50, sort: [{ column: 'id', direction: 'asc' }] })]);
    return offerRow === null ? null : fromRows(offerRow, stepRows.rows, targetRows.rows, codeRows.rows);
  };

  const save = async (thenOn: boolean): Promise<void> => {
    const found = check(t, form, stored, mainLocale);
    setWrong(found);
    setSaid(null);
    if (Object.keys(found).length > 0) {
      toasts.push({ variant: 'error', title: t('discounts.fix', 'Fix {n, plural, one {# thing} other {# things}} before saving', { n: Object.keys(found).length }) });
      return;
    }
    if (busy !== null) return;
    setBusy(thenOn ? 'on' : 'save');
    try {
      const saved = await saveDiscount(savers, form, stored);
      if (!saved.ok) {
        setWrong({ code: t('refusal.codeTaken', 'That code is already used by another discount.') });
        return;
      }
      setWarned(saved.lookAlike === null ? null : t('discounts.lookAlike', '{typed} reads like {code} ({name}). Customers may mix them up.', { typed: form.code.trim().toUpperCase(), code: saved.lookAlike.code, name: saved.lookAlike.name }));
      const id = text(saved.row['id']);
      took(saved.row, form);
      setRaising(false);
      let moved: DataRow | null = null;
      if (thenOn) {
        try {
          moved = (await move(/^\d+$/.test(id) ? Number(id) : id, 'switch-on')).row;
          took({ ...saved.row, ...moved }, form);
        } catch (caught) {
          // The draft is saved; only the switch was refused.
          setSaid(refusal(t, asDataError(caught)).message);
        }
      }
      toasts.push({ variant: 'success', title: moved !== null ? t('discounts.switchedOn', '{name} is switched on', { name: form.name.trim() }) : t('discounts.saved', '{name} saved', { name: form.name.trim() }) });
      if (stored.id === null) {
        leaving.current = true;
        await navigate({ to: `${DISCOUNTS}/${encodeURIComponent(id)}`, replace: true });
      } else {
        // Its lists were changed row by row: read them again before anything else can be saved, so the next save knows each row's key.
        const fresh = await reread(stored.id);
        if (fresh !== null) {
          setForm(fresh.form);
          setLoaded(fresh.form);
          setStored(fresh.stored);
        }
      }
    } catch (caught) {
      const refused = refusal(t, asDataError(caught));
      if (refused.field === undefined) setSaid(refused.message);
      else setWrong({ [refused.field]: refused.message });
      // A save that stopped part-way has changed some rows: what is typed stays, and is matched to what is there now.
      if (stored.id !== null) {
        const fresh = await reread(stored.id).catch(() => null);
        if (fresh !== null) {
          setStored(fresh.stored);
          setForm((held) => rekeyed(held, fresh.form.steps, fresh.form.targets));
        }
      }
    } finally {
      setBusy(null);
    }
  };

  /** A move and nothing else: what is typed and unsaved stays typed and unsaved. */
  const act = async (action: 'pause' | 'resume' | 'end-now' | 'run-again', done: string, values?: Record<string, string>): Promise<void> => {
    if (stored.id === null || busy !== null) return;
    setBusy(action);
    setSaid(null);
    try {
      const moved = (await move(/^\d+$/.test(stored.id) ? Number(stored.id) : stored.id, action, values)).row;
      const next = values?.['ends_on'] === undefined ? loaded : { ...loaded, endsOn: values['ends_on'] };
      if (values?.['ends_on'] !== undefined) set({ endsOn: values['ends_on'] });
      took(moved, next);
      toasts.push({ variant: 'success', title: done });
      setEnding(false);
      setRunning(null);
    } catch (caught) {
      setSaid(refusal(t, asDataError(caught)).message);
    } finally {
      setBusy(null);
    }
  };

  const makeCode = async (): Promise<void> => {
    if (busy !== null) return;
    setBusy('code');
    try {
      const made = await askCode();
      set({ code: made.code });
      setWrong((held) => Object.fromEntries(Object.entries(held).filter(([field]) => field !== 'code')));
      toasts.push({ variant: 'info', title: t('discounts.codeMade', 'Made the code {code}', { code: made.code }) });
    } catch (caught) {
      setWrong((held) => ({ ...held, code: refusal(t, asDataError(caught)).message }));
    } finally {
      setBusy(null);
    }
  };

  const today = new Date();
  const todayText = `${String(today.getFullYear())}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const name = form.name.trim() === '' ? t('discounts.newTitle', 'New discount') : form.name.trim();
  const fixes = Object.keys(wrong).length;
  const Trash = lucideByName('trash-2');
  const signedInOnly = t('discounts.signedInOnly', 'Only for a signed-in customer, or one your staff name. Guests do not get it.');

  const header = !mayEdit ? undefined : (
    <Stack direction="row" gap="sm" wrap>
      {stored.status === 'active' ? (
        <Button variant="secondary" loading={busy === 'pause'} disabled={busy !== null} onClick={() => void act('pause', t('discounts.paused', '{name} is paused', { name }))}>
          {dirty ? t('discounts.pauseUnsaved', 'Pause (your changes are not saved)') : t('discounts.pause', 'Pause')}
        </Button>
      ) : null}
      {stored.status === 'paused' ? (
        <Button variant="secondary" loading={busy === 'resume'} disabled={busy !== null} onClick={() => void act('resume', t('discounts.resumed', '{name} is on again', { name }))}>
          {dirty ? t('discounts.resumeUnsaved', 'Resume (your changes are not saved)') : t('discounts.resume', 'Resume')}
        </Button>
      ) : null}
      {ended ? (
        <Button variant="primary" onClick={() => setRunning(form.endsOn >= todayText ? form.endsOn : '')}>
          {t('discounts.runAgain', 'Run again')}
        </Button>
      ) : null}
      {stored.status === 'active' || stored.status === 'paused' ? (
        <Menu label={t('discounts.more', 'More')}>
          <MenuItem danger onSelect={() => setEnding(true)}>
            {t('discounts.endNow', 'End now')}
          </MenuItem>
        </Menu>
      ) : null}
      {stored.status === 'draft' ? (
        <>
          <Button variant="secondary" loading={busy === 'save'} disabled={busy !== null} onClick={() => void save(false)}>
            {t('discounts.saveDraft', 'Save draft')}
          </Button>
          <Button variant="primary" loading={busy === 'on'} disabled={busy !== null} onClick={() => void save(true)}>
            {t('discounts.switchOn', 'Switch on')}
          </Button>
        </>
      ) : ended ? null : (
        <Button variant="primary" loading={busy === 'save'} disabled={locked || busy !== null} onClick={() => void save(false)}>
          {t('discounts.save', 'Save')}
        </Button>
      )}
    </Stack>
  );

  const subtitle = stored.id === null || stored.status === 'draft' ? t('discounts.notLive', 'Not live yet') : t('discounts.totals', '{uses, plural, one {# use} other {# uses}} · {given} given', { uses: stored.uses, given: money(stored.given ?? '0', locale) });
  const adornment = (
    <Stack direction="row" gap="xs">
      <StatusPill status={pill} tone={pillTone(pill)}>
        {pillWords(t, pill)}
      </StatusPill>
      {neverApplies(form) ? <Tag tone="danger">{t('discounts.never', 'Can never apply')}</Tag> : null}
    </Stack>
  );

  const valueField =
    form.gives === 'percent' ? (
      <Field label={t('discounts.value.percent', 'Percent off')} required {...on('value')}>
        <AffixInput value={form.value} inputMode="decimal" dir="ltr" trailing="%" disabled={locked} error={wrong['value'] !== undefined} onChange={(event) => set({ value: event.target.value })} />
      </Field>
    ) : form.gives === 'amount' ? (
      <Field label={t('discounts.value.amount', 'Amount off')} hint={t('discounts.value.amountHint', 'Never more than what it applies to.')} required {...on('value')}>
        <AffixInput value={form.value} inputMode="decimal" dir="ltr" disabled={locked} error={wrong['value'] !== undefined} onChange={(event) => set({ value: event.target.value })} />
      </Field>
    ) : form.gives === 'fixed_price' ? (
      <Field label={t('discounts.value.price', 'Sells for, each')} hint={t('discounts.value.priceHint', 'Items that already cost less keep their price.')} required {...on('value')}>
        <AffixInput value={form.value} inputMode="decimal" dir="ltr" disabled={locked} error={wrong['value'] !== undefined} onChange={(event) => set({ value: event.target.value })} />
      </Field>
    ) : form.gives === 'bonus_item' ? (
      <NumberInput label={t('discounts.value.buy', 'Buy')} value={form.buyQty} onChange={(buyQty) => set({ buyQty })} whole required disabled={locked} unit={t('discounts.each', 'each')} hint={Number(form.buyQty) > 2 ? t('discounts.value.cheapest', 'The cheapest one is on us.') : t('discounts.value.cheaper', 'The cheaper one is on us.')} {...on('buy_qty')} />
    ) : (
      <Stack gap="sm">
        <span className="text-body-sm text-fg-muted">{t('discounts.steps.rule', 'The more they buy of what it applies to, the bigger the reduction. The highest step reached counts.')}</span>
        {wrong['steps'] === undefined ? null : <Alert tone="danger" role="alert" title={wrong['steps']} />}
        {form.steps.map((step, index) => (
          <Stack key={String(index)} direction="row" gap="sm" align="end">
            <NumberInput label={t('discounts.steps.from', 'From')} value={step.fromQty} whole disabled={locked} unit={t('discounts.each', 'each')} onChange={(fromQty) => set({ steps: form.steps.map((held, at) => (at === index ? { ...held, fromQty } : held)) })} {...on(`steps.${String(index)}.from_qty`)} />
            <NumberInput label={t('discounts.steps.off', 'Percent off')} value={step.value} decimals={2} disabled={locked} unit="%" onChange={(value) => set({ steps: form.steps.map((held, at) => (at === index ? { ...held, value } : held)) })} {...on(`steps.${String(index)}.value`)} />
            <IconButton label={t('discounts.steps.remove', 'Remove this step')} variant="ghost" disabled={locked} onClick={() => set({ steps: form.steps.filter((_, at) => at !== index) })}>
              {Trash === undefined ? null : <Trash />}
            </IconButton>
          </Stack>
        ))}
        <Stack direction="row">
          <Button variant="secondary" size="sm" disabled={locked} onClick={() => set({ steps: [...form.steps, { fromQty: '', value: '' }] })}>
            {t('discounts.steps.add', 'Add a step')}
          </Button>
        </Stack>
      </Stack>
    );

  const targetsNeeded = needsTargets(form);
  const body = (
    <Stack gap="lg">
      {said === null ? null : <Alert tone="danger" role="alert" title={said} />}
      {fixes === 0 ? null : <Alert tone="danger" role="alert" title={t('discounts.fixes', '{n, plural, one {# thing needs} other {# things need}} fixing before you can save.', { n: fixes })} {...(fixes === 1 ? { body: Object.values(wrong)[0] } : {})} />}
      {mapSaid === null ? null : <Alert tone="warn" title={t('discounts.noMap', 'What your tables sell could not be read, so items cannot be chosen and the discount cannot be tried.')} body={mapSaid} />}
      {!mayEdit ? <Alert tone="info" title={t('discounts.readOnly', 'You can read this discount. A manager can change it.')} /> : null}
      {ended ? <Alert tone="info" title={t('discounts.ended.title', 'This discount has ended')} body={t('discounts.ended.body', 'Run it again with a later Until date.')} /> : null}
      {usedUp && !raising ? (
        <Alert
          tone="warn"
          title={t('discounts.usedUp.title', 'All {n} uses are taken', { n: stored.uses })}
          body={t('discounts.usedUp.body', 'Read only until you raise the limit.')}
          {...(mayEdit
            ? {
                action: (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setRaising(true)}
                  >
                    {t('discounts.usedUp.raise', 'Raise the limit')}
                  </Button>
                ),
              }
            : {})}
        />
      ) : null}

      <Card title={t('discounts.section.name', 'Name')}>
        <Stack gap="md">
          <Input label={t('discounts.name', 'Name (internal)')} value={form.name} maxLength={80} required disabled={locked} onChange={(event) => set({ name: event.target.value })} {...on('name')} />
          <Input label={t('discounts.publicName', 'What customers see')} hint={t('discounts.publicNameHint', 'The line on a receipt.')} value={form.publicName[mainLocale] ?? ''} maxLength={120} required disabled={locked} onChange={(event) => set({ publicName: { ...form.publicName, [mainLocale]: event.target.value } })} {...on('public_name')} />
          <Stack direction="row">
            <Button variant="link" size="sm" onClick={() => setMoreNames((open) => !open)}>
              {moreNames ? t('discounts.fewerLanguages', 'Fewer languages') : t('discounts.moreLanguages', 'More languages')}
            </Button>
          </Stack>
          {moreNames
            ? LOCALES.filter((tag) => tag !== mainLocale).map((tag) => (
                <Input key={tag} label={t('discounts.publicNameIn', 'What customers see · {language}', { language: new Intl.DisplayNames([locale], { type: 'language' }).of(tag) ?? tag })} value={form.publicName[tag] ?? ''} maxLength={120} disabled={locked} dir={tag === 'ar-EG' ? 'rtl' : 'ltr'} onChange={(event) => set({ publicName: { ...form.publicName, [tag]: event.target.value } })} />
              ))
            : null}
        </Stack>
      </Card>

      <Card title={t('discounts.section.gives', 'What it gives')}>
        <Stack gap="md">
          <SegmentedControl
            aria-label={t('discounts.section.gives', 'What it gives')}
            value={form.gives}
            disabled={locked}
            onValueChange={(gives) => set({ gives: gives as Gives })}
            options={[
              { value: 'percent', label: t('discounts.kind.percent', 'Percent off') },
              { value: 'amount', label: t('discounts.kind.amount', 'Amount off') },
              { value: 'fixed_price', label: t('discounts.kind.price', 'Fixed price') },
              { value: 'bonus_item', label: t('discounts.kind.bonus', '2 for 1 and similar') },
              { value: 'quantity_price', label: t('discounts.kind.steps', 'Price by quantity') },
            ]}
          />
          {valueField}
        </Stack>
      </Card>

      <Card title={t('discounts.section.applies', 'What it applies to')}>
        <Stack gap="md">
          <RadioGroup value={targetsNeeded ? 'lines' : 'order'} onValueChange={(appliesTo) => set({ appliesTo: appliesTo === 'lines' ? 'lines' : 'order' })} aria-label={t('discounts.section.applies', 'What it applies to')}>
            <RadioCard value="order" title={t('discounts.applies.order', 'The whole order')} description={form.gives === 'percent' || form.gives === 'amount' ? t('discounts.applies.orderHint', 'Everything in the basket') : t('discounts.applies.orderNo', 'This kind needs items to choose from')} disabled={locked || (form.gives !== 'percent' && form.gives !== 'amount')} />
            <RadioCard value="lines" title={t('discounts.applies.lines', 'Only these items')} description={t('discounts.applies.linesHint', 'Items, categories or types')} disabled={locked} />
          </RadioGroup>
          {targetsNeeded ? (
            <Stack gap="sm">
              <Stack direction="row" gap="sm" wrap align="center">
                {form.targets.map((target, index) => (
                  <Tag key={String(index)} tone="accent">
                    {target.label}
                  </Tag>
                ))}
                <Button variant="secondary" size="sm" disabled={locked || map === null || (map.what.length === 0 && !map.tags)} onClick={() => setPicking(true)}>
                  {form.targets.length === 0 ? t('discounts.chooseItems', 'Choose items') : t('discounts.changeItems', 'Change')}
                </Button>
              </Stack>
              {map !== null && map.what.length === 0 && !map.tags ? <span className="text-body-sm text-fg-muted">{t('discounts.noTables', 'Nothing here says what its lines sell yet. Add a rule under Offer rules first.')}</span> : null}
              {wrong['targets'] === undefined ? null : <Alert tone="danger" role="alert" title={wrong['targets']} />}
            </Stack>
          ) : null}
        </Stack>
      </Card>

      <Card title={t('discounts.section.starts', 'How it starts')}>
        <Stack gap="md">
          <RadioGroup value={form.trigger} onValueChange={(trigger) => set({ trigger: trigger as Trigger })} aria-label={t('discounts.section.starts', 'How it starts')}>
            <RadioCard value="automatic" title={t('discounts.starts.itself', 'By itself')} description={t('discounts.starts.itselfHint', 'Applies when the order fits')} disabled={locked} />
            <RadioCard value="code" title={t('discounts.starts.withCode', 'With a code')} description={t('discounts.starts.withCodeHint', 'Customer gives a code')} disabled={locked} />
            <RadioCard value="staff" title={t('discounts.starts.staffOnly', 'Only staff can give it')} description={t('discounts.starts.staffHint', 'Picked at the till')} disabled={locked} />
          </RadioGroup>
          {form.trigger === 'code' ? (
            <Stack gap="sm">
              <Stack direction="row" gap="sm" align="end">
                <Input label={t('discounts.code', 'Code')} hint={t('discounts.codeHint', 'Letters and numbers. Customers type it at checkout or say it at the till.')} value={form.code} maxLength={24} dir="ltr" required disabled={locked} onChange={(event) => set({ code: event.target.value.toUpperCase() })} {...on('code')} />
                <Button variant="secondary" loading={busy === 'code'} disabled={locked} onClick={() => void makeCode()}>
                  {t('discounts.makeCode', 'Make one for me')}
                </Button>
              </Stack>
              {warned === null ? null : <Alert tone="warn" title={warned} />}
              {stored.codes > 1 ? <span className="text-body-sm text-fg-muted">{t('discounts.moreCodes', 'This discount has {n} codes. The others are under Codes.', { n: stored.codes })}</span> : null}
            </Stack>
          ) : null}
          {form.trigger === 'staff' ? <span className="text-body-sm text-fg-muted">{t('discounts.staffNote', "Shows in the till's discount list. Staff limits and reasons still apply.")}</span> : null}
        </Stack>
      </Card>

      <Card title={t('discounts.section.when', 'When')}>
        <Stack gap="md">
          <Grid columns={2} gap="md">
            <Field label={t('discounts.from', 'From')} hint={t('discounts.fromHint', "From the start of that day, on the venue's clock.")} {...on('starts_on')}>
              <DateInput value={form.startsOn} disabled={locked} onChange={(event) => set({ startsOn: event.target.value })} />
            </Field>
            <Field label={t('discounts.until', 'Until (optional)')} hint={t('discounts.untilHint', "To the end of that day, on the venue's clock.")} {...on('ends_on')}>
              <DateInput value={form.endsOn} disabled={locked} error={wrong['ends_on'] !== undefined} onChange={(event) => set({ endsOn: event.target.value })} />
            </Field>
          </Grid>
          <Field label={t('discounts.days', 'Days of the week')} hint={t('discounts.daysHint', 'None chosen means every day.')}>
            <Stack direction="row" gap="xs" wrap>
              {weekOrder(locale).map((index) => (
                <ToggleChip key={String(index)} pressed={form.weekdays[index] === true} disabled={locked} aria-label={weekdayName(index, locale)} onPressedChange={(pressed) => set({ weekdays: form.weekdays.map((held, at) => (at === index ? pressed : held)) })}>
                  {weekdayName(index, locale, 'short')}
                </ToggleChip>
              ))}
            </Stack>
          </Field>
          <Switch label={t('discounts.allDay', 'All day')} checked={form.allDay} disabled={locked} onCheckedChange={(allDay) => set({ allDay })} />
          {form.allDay ? null : (
            <Grid columns={2} gap="md">
              <Input label={t('discounts.fromTime', 'From, as 09:00')} value={form.fromTime} maxLength={5} dir="ltr" placeholder="09:00" disabled={locked} onChange={(event) => set({ fromTime: event.target.value })} {...on('from_time')} />
              <Input label={t('discounts.toTime', 'Until, as 17:00')} hint={t('discounts.hoursHint', 'Hours cannot run past midnight.')} value={form.toTime} maxLength={5} dir="ltr" placeholder="17:00" disabled={locked} onChange={(event) => set({ toTime: event.target.value })} {...on('to_time')} />
            </Grid>
          )}
        </Stack>
      </Card>

      <Card title={t('discounts.section.who', 'Who gets it')}>
        <Stack gap="md">
          <Grid columns={2} gap="md">
            <NumberInput label={t('discounts.minSpend', 'Minimum spend')} hint={t('discounts.minSpendHint', 'Of the goods, after the reductions that come before it.')} value={form.minSpend} decimals={2} disabled={locked} onChange={(minSpend) => set({ minSpend })} {...on('min_spend')} />
            <NumberInput label={t('discounts.minQty', 'Minimum quantity')} hint={t('discounts.minQtyHint', 'Of what it applies to.')} value={form.minQty} whole disabled={locked} unit={t('discounts.each', 'each')} onChange={(minQty) => set({ minQty })} {...on('min_qty')} />
          </Grid>
          <Select label={t('discounts.group', 'Customer group')} hint={signedInOnly} value={form.groupId} disabled={locked} options={[{ value: '', label: t('discounts.anyone', 'Anyone') }, ...groups.rows.map((group) => ({ value: text(group['id']), label: text(group['name']) })), ...(form.groupId !== '' && !groups.rows.some((group) => text(group['id']) === form.groupId) ? [{ value: form.groupId, label: t('discounts.aGroup', 'A customer group') }] : [])]} onChange={(event) => set({ groupId: event.target.value })} {...on('group_id')} />
          <Stack gap="xs">
            <Switch label={t('discounts.firstOrder', 'First order only')} checked={form.firstOrderOnly} disabled={locked} onCheckedChange={(firstOrderOnly) => set({ firstOrderOnly })} />
            <span className="text-body-sm text-fg-muted">{signedInOnly}</span>
          </Stack>
        </Stack>
      </Card>

      <Card title={t('discounts.section.limits', 'Limits')}>
        <Grid columns={2} gap="md">
          <div ref={usesRef}>
            <NumberInput label={t('discounts.maxUses', 'Total uses')} hint={t('discounts.usesSoFar', '{n} used', { n: stored.uses })} value={form.maxUses} whole disabled={!mayEdit || ended || (usedUp && !raising)} onChange={(maxUses) => set({ maxUses })} {...on('max_uses')} />
          </div>
          <NumberInput label={t('discounts.perCustomer', 'Uses per customer')} hint={signedInOnly} value={form.maxPerCustomer} whole disabled={locked} onChange={(maxPerCustomer) => set({ maxPerCustomer })} {...on('max_per_customer')} />
          <NumberInput label={t('discounts.budget', 'Stop after this much is given')} hint={t('discounts.givenSoFar', '{amount} given so far', { amount: money(stored.given ?? '0', locale) })} value={form.budget} decimals={2} disabled={locked} onChange={(budget) => set({ budget })} {...on('budget')} />
        </Grid>
      </Card>

      <Card title={t('discounts.section.combine', 'With other discounts')}>
        <Stack gap="sm">
          <Switch label={t('discounts.combinable', 'Can be combined')} checked={form.combinable} disabled={locked} onCheckedChange={(combinable) => set({ combinable })} />
          <span className="text-body-sm text-fg-muted">{form.combinable ? t('discounts.combineOn', 'Adds to other combinable discounts on the same order.') : t('discounts.combineOff', 'Used alone, only when it gives more than the others together.')}</span>
          <span className="text-body-sm text-fg-muted">{t('discounts.houseRule', 'Customers get every combinable discount, one code, and otherwise the best single one.')}</span>
        </Stack>
      </Card>
    </Stack>
  );

  const pane = <TryPane t={t} mapped={map} draft={draft} offerId={stored.id} name={form.publicName[mainLocale]?.trim() || form.name.trim()} unsaved={dirty || stored.status === 'draft'} narrow={narrow} />;
  const missing = offerId !== null && !offer.loading && offer.row === null && offer.error === null;

  return (
    <PageFrame t={t} title={name} subtitle={subtitle} backTo={DISCOUNTS} adornment={adornment} actions={header} loading={!ready && !missing && offer.error === null} error={offer.error} onRetry={offer.refetch} width="wide" testId="offers-discount">
      {missing ? (
        <Alert tone="warn" title={t('discounts.missing', 'This discount is not here')} body={t('discounts.missingBody', 'It may have been removed, or you may not be able to see it.')} />
      ) : narrow ? (
        <>
          {body}
          {pane}
        </>
      ) : (
        <Grid columns={1} gap="lg" aside={pane}>
          {body}
        </Grid>
      )}

      {picking && map !== null ? (
        <TargetPicker
          t={t}
          mapped={map}
          chosen={form.targets}
          onClose={() => setPicking(false)}
          onDone={(next: readonly Target[]) => {
            // A row kept before keeps its key: only what is new is made, only what is gone is removed.
            set({ targets: next.map((target) => form.targets.find((held) => held.kind === target.kind && held.sourceTable === target.sourceTable && held.sourceRow === target.sourceRow) ?? target) });
            setPicking(false);
          }}
        />
      ) : null}

      {ending ? (
        <Dialog open onOpenChange={(open) => (open ? undefined : setEnding(false))} size="sm">
          <DialogHeader title={t('discounts.end.title', 'End {name} now?', { name })} subtitle={t('discounts.end.body', 'It stops applying at once.')} closeLabel={t('shared.close', 'Close')} tone="danger" />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEnding(false)}>
              {t('shared.cancel', 'Cancel')}
            </Button>
            <Button variant="destructive" loading={busy === 'end-now'} onClick={() => void act('end-now', t('discounts.endedNow', '{name} has ended', { name }))}>
              {t('discounts.endNow', 'End now')}
            </Button>
          </DialogFooter>
        </Dialog>
      ) : null}

      {running !== null ? (
        <Dialog open onOpenChange={(open) => (open ? undefined : setRunning(null))} size="sm">
          <DialogHeader title={t('discounts.run.title', 'Run {name} again', { name })} closeLabel={t('shared.close', 'Close')} />
          <DialogBody>
            <Field label={t('discounts.run.until', 'Until')} required {...(running !== '' && running < todayText ? { error: t('discounts.run.ahead', 'Choose today or a later day.') } : { hint: t('discounts.run.hint', 'It runs to the end of that day.') })}>
              <DateInput value={running} onChange={(event) => setRunning(event.target.value)} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRunning(null)}>
              {t('shared.cancel', 'Cancel')}
            </Button>
            <Button variant="primary" loading={busy === 'run-again'} disabled={running === '' || running < todayText || busy !== null} onClick={() => void act('run-again', t('discounts.ranAgain', '{name} runs again until {date}', { name, date: shortDay(running, locale) }), { ends_on: running })}>
              {t('discounts.runAgain', 'Run again')}
            </Button>
          </DialogFooter>
        </Dialog>
      ) : null}

      {blocker?.status === 'blocked' ? (
        <Dialog open onOpenChange={(open) => (open ? undefined : blocker.reset?.())} size="sm">
          <DialogHeader title={t('discounts.leave.title', 'Leave without saving?')} subtitle={t('discounts.leave.body', 'What you changed is lost.')} closeLabel={t('shared.close', 'Close')} />
          <DialogFooter>
            <Button variant="secondary" onClick={() => blocker.reset?.()}>
              {t('discounts.leave.stay', 'Keep editing')}
            </Button>
            <Button variant="destructive" onClick={() => blocker.proceed?.()}>
              {t('discounts.leave.go', 'Leave')}
            </Button>
          </DialogFooter>
        </Dialog>
      ) : null}
    </PageFrame>
  );
}
