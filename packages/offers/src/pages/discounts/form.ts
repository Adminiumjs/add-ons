/**
 * A DISCOUNT, AS THE EDITOR HOLDS IT.
 *
 * The form is text: what a person typed, kept as typed until it is saved. It
 * is made from an offer's row with its steps, targets and first code, and
 * turned back into the values a save sends. The checks here only spare a
 * round trip — Adminium refuses the same things, and is the one that counts.
 */
import type { AddOnTranslate, DataRow, DataValue } from '../shared/host.ts';

export const LOCALES = ['en-US', 'de-DE', 'fr-FR', 'da-DK', 'cs-CZ', 'ar-EG', 'zh-CN', 'zh-TW'] as const;
export type Gives = 'percent' | 'amount' | 'fixed_price' | 'bonus_item' | 'quantity_price';
export type Trigger = 'automatic' | 'code' | 'staff';
export type Status = 'draft' | 'active' | 'paused' | 'ended';

export interface Step {
  id?: string;
  fromQty: string;
  value: string;
}
export interface Target {
  id?: string;
  kind: 'item' | 'category' | 'type' | 'tag';
  sourceTable: string;
  sourceRow: string;
  label: string;
}
export interface Form {
  name: string;
  /** What customers see, by language; the reader's own is the one field drawn. */
  publicName: Readonly<Record<string, string>>;
  gives: Gives;
  value: string;
  buyQty: string;
  steps: readonly Step[];
  appliesTo: 'order' | 'lines';
  targets: readonly Target[];
  trigger: Trigger;
  code: string;
  startsOn: string;
  endsOn: string;
  /** Sunday first, as the days are numbered where they are kept. */
  weekdays: readonly boolean[];
  allDay: boolean;
  fromTime: string;
  toTime: string;
  minSpend: string;
  minQty: string;
  groupId: string;
  firstOrderOnly: boolean;
  maxUses: string;
  maxPerCustomer: string;
  budget: string;
  combinable: boolean;
}

/** What the server keeps and the form only shows. */
export interface Stored {
  id: string | null;
  status: Status;
  uses: number;
  given: string | null;
  usedUp: boolean;
  /** The first code's row and word, as last saved. */
  codeId: string | null;
  code: string;
  codes: number;
  steps: readonly string[];
  targets: readonly string[];
}

const NO_DAYS: readonly boolean[] = [false, false, false, false, false, false, false];
export const BLANK: Form = { name: '', publicName: {}, gives: 'percent', value: '', buyQty: '2', steps: [], appliesTo: 'order', targets: [], trigger: 'automatic', code: '', startsOn: '', endsOn: '', weekdays: NO_DAYS, allDay: true, fromTime: '', toTime: '', minSpend: '', minQty: '', groupId: '', firstOrderOnly: false, maxUses: '', maxPerCustomer: '', budget: '', combinable: false };
export const NOT_STORED: Stored = { id: null, status: 'draft', uses: 0, given: null, usedUp: false, codeId: null, code: '', codes: 0, steps: [], targets: [] };

const text = (value: unknown): string => (value === null || value === undefined ? '' : String(value));
const yes = (value: unknown): boolean => value === true || value === 1 || value === '1' || value === 'true';
const day = (value: unknown): string => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : '');
/** `5.000` as `5`, `12.500` as `12.5`: a figure as a person would type it. */
export const plain = (value: unknown): string => {
  const read = text(value);
  return /^-?\d+\.\d+$/.test(read) ? read.replace(/0+$/, '').replace(/\.$/, '') : read;
};
/** An amount of money as typed: two places, however many the database wrote. */
export const cash = (value: unknown): string => {
  const read = text(value);
  if (!/^\d+(\.\d+)?$/.test(read)) return read;
  const [whole = '0', part = ''] = read.split('.');
  return `${whole}.${part.padEnd(2, '0').slice(0, Math.max(2, part.replace(/0+$/, '').length))}`;
};

/** A name kept by language, however the database handed it: a map, its text, or one bare name. */
export function namesOf(stored: unknown): Record<string, string> {
  let read: unknown = stored;
  if (typeof read === 'string') {
    const trimmed = read.trim();
    if (trimmed === '') return {};
    try {
      read = trimmed.startsWith('{') || trimmed.startsWith('"') ? JSON.parse(trimmed) : trimmed;
    } catch {
      read = trimmed;
    }
    if (typeof read === 'string') return read.trim() === '' ? {} : { 'en-US': read.trim() };
  }
  if (typeof read !== 'object' || read === null || Array.isArray(read)) return {};
  const out: Record<string, string> = {};
  for (const [locale, name] of Object.entries(read)) if (typeof name === 'string' && name.trim() !== '') out[locale] = name;
  return out;
}

/** The form and what is stored, from an offer's row and its three lists. */
export function fromRows(offer: DataRow, steps: readonly DataRow[], targets: readonly DataRow[], codes: readonly DataRow[]): { form: Form; stored: Stored } {
  const days = Array.from(text(offer['weekdays']).match(/[0-6]/g) ?? []);
  const gives = (['percent', 'amount', 'fixed_price', 'bonus_item', 'quantity_price'] as const).find((one) => one === offer['gives']) ?? 'percent';
  const sorted = [...steps].sort((a, b) => Number(a['from_qty']) - Number(b['from_qty']));
  const first = [...codes].sort((a, b) => Number(a['id']) - Number(b['id']))[0];
  const [from, to] = [text(offer['from_time']), text(offer['to_time'])];
  const money = gives === 'amount' || gives === 'fixed_price';
  return {
    form: {
      name: text(offer['name']),
      publicName: namesOf(offer['public_name']),
      gives,
      value: money ? cash(offer['value']) : plain(offer['value']),
      buyQty: text(offer['buy_qty']) === '' ? '2' : text(offer['buy_qty']),
      steps: sorted.map((row) => ({ id: text(row['id']), fromQty: text(row['from_qty']), value: plain(row['value']) })),
      appliesTo: offer['applies_to'] === 'lines' ? 'lines' : 'order',
      targets: targets.map((row) => ({ id: text(row['id']), kind: (['item', 'category', 'type', 'tag'] as const).find((kind) => kind === row['kind']) ?? 'item', sourceTable: text(row['source_table']), sourceRow: text(row['source_row']), label: text(row['label']) })),
      trigger: (['automatic', 'code', 'staff'] as const).find((one) => one === offer['trigger']) ?? 'automatic',
      code: text(first?.['code']),
      startsOn: day(offer['starts_on']),
      endsOn: day(offer['ends_on']),
      weekdays: NO_DAYS.map((_, index) => days.includes(String(index))),
      allDay: from === '' && to === '',
      fromTime: from,
      toTime: to,
      minSpend: cash(offer['min_spend']),
      minQty: text(offer['min_qty']),
      groupId: text(offer['group_id']),
      firstOrderOnly: yes(offer['first_order_only']),
      maxUses: text(offer['max_uses']),
      maxPerCustomer: text(offer['max_per_customer']),
      budget: offer['budget_open'] === null || offer['budget_open'] === undefined || yes(offer['budget_open']) ? '' : cash(offer['budget']),
      combinable: yes(offer['combinable']),
    },
    stored: {
      id: text(offer['id']),
      status: (['draft', 'active', 'paused', 'ended'] as const).find((one) => one === offer['status']) ?? 'draft',
      uses: Number(offer['uses'] ?? 0) || 0,
      given: offer['given'] === null || offer['given'] === undefined ? null : text(offer['given']),
      usedUp: yes(offer['used_up']),
      codeId: first === undefined ? null : text(first['id']),
      code: text(first?.['code']),
      codes: codes.length,
      steps: sorted.map((row) => text(row['id'])),
      targets: targets.map((row) => text(row['id'])),
    },
  };
}

const whole = (value: string): number | null => (/^\d+$/.test(value) ? Number(value) : null);
const decimal = (value: string): number | null => (/^\d+(\.\d+)?$/.test(value) ? Number(value) : null);
/** A code as it is kept: letters and digits, upper case. */
export const codeWord = (typed: string): string => typed.replace(/[\s-]/g, '').toUpperCase();

/** What needs fixing, by field. The same things Adminium refuses; found here they cost no round trip. */
export function check(t: AddOnTranslate, form: Form, stored: Stored, mainLocale: string): Record<string, string> {
  const found: Record<string, string> = {};
  if (form.name.trim() === '') found['name'] = t('discounts.check.name', 'Give it a name your team will know.');
  if ((form.publicName[mainLocale] ?? '').trim() === '') found['public_name'] = t('discounts.check.publicName', 'Add the line customers see on the receipt.');
  const value = decimal(form.value);
  if (form.gives === 'percent' && (value === null || value <= 0 || value > 100)) found['value'] = t('discounts.check.percent', 'Enter a percent from 1 to 100.');
  if (form.gives === 'amount' && (value === null || value <= 0)) found['value'] = t('discounts.check.amount', 'Enter an amount, like 5.00.');
  if (form.gives === 'fixed_price' && (value === null || value < 0)) found['value'] = t('discounts.check.price', 'Enter a price, like 10.00.');
  if (form.gives === 'bonus_item') {
    const buy = whole(form.buyQty);
    if (buy === null || buy < 2 || buy > 10) found['buy_qty'] = t('discounts.check.buy', 'Enter a number from 2 to 10.');
  }
  if (form.gives === 'quantity_price') {
    if (form.steps.length === 0) found['steps'] = t('discounts.check.noSteps', 'Add at least one step.');
    form.steps.forEach((step, index) => {
      const [from, off] = [whole(step.fromQty), decimal(step.value)];
      const before = index === 0 ? null : form.steps[index - 1];
      if (from === null || from < 2) found[`steps.${String(index)}.from_qty`] = t('discounts.check.stepFrom', 'Start each step at 2 or more.');
      else if (before !== null && before !== undefined && from <= (whole(before.fromQty) ?? 0)) found[`steps.${String(index)}.from_qty`] = t('discounts.check.stepRising', 'Each step starts above the one before ({n} each).', { n: before.fromQty });
      if (off === null || off <= 0 || off > 100) found[`steps.${String(index)}.value`] = t('discounts.check.percent', 'Enter a percent from 1 to 100.');
      else if (before !== null && before !== undefined && off <= (decimal(before.value) ?? 0)) found[`steps.${String(index)}.value`] = t('discounts.check.stepMore', 'Give more off than the step before ({n} %).', { n: before.value });
    });
  }
  if (needsTargets(form) && form.targets.length === 0) found['targets'] = t('discounts.check.targets', 'Choose at least one item, category or type.');
  if (form.trigger === 'code' && codeWord(form.code) === '') found['code'] = t('discounts.check.code', 'Enter a code, or make one.');
  if (form.startsOn !== '' && form.endsOn !== '' && form.endsOn < form.startsOn) found['ends_on'] = t('discounts.check.until', 'Until is before From, so this can never apply. Pick a date on or after From.');
  if (!form.allDay) {
    if (form.fromTime === '' || form.toTime === '') found['to_time'] = t('discounts.check.hours', 'Enter both times, or switch All day on.');
    else if (form.toTime <= form.fromTime) found['to_time'] = t('discounts.check.hoursOrder', 'Until must be later than From.');
  }
  if (form.minSpend !== '' && decimal(form.minSpend) === null) found['min_spend'] = t('discounts.check.amount', 'Enter an amount, like 5.00.');
  if (form.minQty !== '' && (whole(form.minQty) ?? 0) < 1) found['min_qty'] = t('discounts.check.count', 'Enter a whole number, 1 or more.');
  const most = form.maxUses === '' ? null : whole(form.maxUses);
  if (form.maxUses !== '' && (most === null || most < 1)) found['max_uses'] = t('discounts.check.count', 'Enter a whole number, 1 or more.');
  else if (most !== null && most < stored.uses) found['max_uses'] = t('discounts.check.usesTaken', '{n} are already used. Enter {n} or more.', { n: stored.uses });
  if (form.maxPerCustomer !== '' && (whole(form.maxPerCustomer) ?? 0) < 1) found['max_per_customer'] = t('discounts.check.count', 'Enter a whole number, 1 or more.');
  if (form.budget !== '' && (decimal(form.budget) ?? 0) <= 0) found['budget'] = t('discounts.check.amount', 'Enter an amount, like 5.00.');
  return found;
}

/** Whether the form can ever apply as it stands: Until not before From. */
export const neverApplies = (form: Form): boolean => form.startsOn !== '' && form.endsOn !== '' && form.endsOn < form.startsOn;
/** A 2 for 1, a fixed price and a price by quantity are about named things; the others may be. */
export const needsTargets = (form: Form): boolean => form.gives === 'bonus_item' || form.gives === 'fixed_price' || form.gives === 'quantity_price' || form.appliesTo === 'lines';

const orNull = (value: string): string | null => (value.trim() === '' ? null : value.trim());
const countOrNull = (value: string): number | null => whole(value.trim());

/** The offer's own columns, as a save and a try send them. */
export function offerValues(form: Form): Record<string, DataValue> {
  const names = Object.fromEntries(Object.entries(form.publicName).filter(([, name]) => name.trim() !== '').map(([locale, name]) => [locale, name.trim()]));
  const numbered = form.gives === 'percent' || form.gives === 'amount' || form.gives === 'fixed_price';
  return {
    name: form.name.trim(),
    // Kept by language, as one value: a map is what the column holds.
    public_name: names as unknown as DataValue,
    gives: form.gives,
    value: numbered ? orNull(form.value) : null,
    buy_qty: form.gives === 'bonus_item' ? countOrNull(form.buyQty) : null,
    // One is on us, always: there is no control for more.
    bonus_qty: form.gives === 'bonus_item' ? 1 : null,
    trigger: form.trigger,
    applies_to: needsTargets(form) ? 'lines' : 'order',
    starts_on: orNull(form.startsOn),
    ends_on: orNull(form.endsOn),
    weekdays: form.weekdays.some(Boolean) ? form.weekdays.flatMap((on, index) => (on ? [String(index)] : [])).join(',') : null,
    from_time: form.allDay ? null : orNull(form.fromTime),
    to_time: form.allDay ? null : orNull(form.toTime),
    min_spend: orNull(form.minSpend),
    min_qty: countOrNull(form.minQty),
    first_order_only: form.firstOrderOnly,
    group_id: form.groupId === '' ? null : (countOrNull(form.groupId) ?? form.groupId),
    max_uses: countOrNull(form.maxUses),
    max_per_customer: countOrNull(form.maxPerCustomer),
    budget_open: form.budget.trim() === '',
    budget: orNull(form.budget),
    combinable: form.combinable,
  };
}

export const stepValues = (step: Step): Record<string, DataValue> => ({ from_qty: Number(step.fromQty), value: step.value });
export const targetValues = (target: Target): Record<string, DataValue> => ({ kind: target.kind, source_table: target.sourceTable, source_row: target.sourceRow, label: target.label });
/** The targets a save keeps: none for a discount on the whole order. */
export const keptTargets = (form: Form): readonly Target[] => (needsTargets(form) ? form.targets : []);
export const keptSteps = (form: Form): readonly Step[] => (form.gives === 'quantity_price' ? form.steps : []);

/** The same form? Compared as what a save would send, so a space typed and taken out again is no change. */
export const same = (a: Form, b: Form): boolean => JSON.stringify([offerValues(a), keptSteps(a).map(stepValues), keptTargets(a).map(targetValues), a.trigger === 'code' ? codeWord(a.code) : '']) === JSON.stringify([offerValues(b), keptSteps(b).map(stepValues), keptTargets(b).map(targetValues), b.trigger === 'code' ? codeWord(b.code) : '']);

/**
 * The form after a save that stopped part-way: what was typed stays, and each
 * step and target carries the key of the row that is really there now — so
 * the next save neither makes a row twice nor removes one that is gone.
 */
export function rekeyed(form: Form, steps: readonly Step[], targets: readonly Target[]): Form {
  const left = [...steps];
  const take = <Row extends { id?: string }>(pool: Row[], fits: (row: Row) => boolean): string | undefined => {
    const at = pool.findIndex(fits);
    return at === -1 ? undefined : pool.splice(at, 1)[0]?.id;
  };
  const kept = [...targets];
  return {
    ...form,
    steps: form.steps.map(({ id: _id, ...step }) => {
      const id = take(left, (row) => row.fromQty === step.fromQty);
      return id === undefined ? step : { ...step, id };
    }),
    targets: form.targets.map(({ id: _id, ...target }) => {
      const id = take(kept, (row) => row.kind === target.kind && row.sourceTable === target.sourceTable && row.sourceRow === target.sourceRow);
      return id === undefined ? target : { ...target, id };
    }),
  };
}
