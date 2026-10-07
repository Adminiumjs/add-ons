/**
 * A STOCK RULE, AS IT IS STORED AND AS IT IS SAID.
 *
 * A rule is a posting on somebody's table: when a row gets somewhere, stock
 * is held, taken or put back. The sentence a card shows is made from the rule
 * itself — one message for each clause, with its names in places the message
 * decides, so word order is the translator's — and never from an app's name:
 * whatever a manifest declares reads the same way.
 *
 * The sheet's form is the same rule, taken apart and put together again.
 */
import type { AddOnTranslate } from '../shared/host.ts';

export type Scalar = string | number | boolean;
export type Point = { create: true } | { to: Scalar[]; from?: Scalar[] } | { column: string; in: Scalar[]; from?: Scalar[]; own?: true } | { column: string; set: true; own?: true };
export type Mapping = string | { row: true } | { parent: string } | { setting: string } | { value: Scalar };

export interface Rule {
  id: string;
  action: string;
  via?: string;
  reserve?: { on: Point };
  post?: { on: Point };
  reverse?: { on: Point };
  map: Record<string, Mapping>;
  multipliers?: Record<string, Mapping>;
  heldUntil?: Mapping;
}

export interface Listed extends Rule {
  table: string;
  tableLabel: string;
  owner: string | null;
  enabled: boolean;
  state: 'live' | 'off' | 'idle' | 'unavailable';
  holding: number;
  unplanned: number;
}

export interface SourceColumn {
  name: string;
  label: string;
  type: string;
  enum?: string[];
  decided: boolean;
}
export interface SourceTable {
  table: string;
  label: string;
  states?: string[];
  columns: SourceColumn[];
  lineOf?: { table: string; via: string }[];
}

/** What a sentence needs to name things as a person does. */
export interface Names {
  /** A column's label on the rule's table (or its parent's, for a rule reached through a link). */
  column: (name: string) => string;
  /** The parent row's name, for a rule on a line: "the order". Absent: "the row". */
  parent?: string;
  place: (id: string) => string;
  list: (values: readonly string[]) => string;
}

const one = (mapping: Mapping | undefined): string | null => (typeof mapping === 'string' ? mapping : null);

function point(t: AddOnTranslate, at: Point, names: Names): string {
  const row = names.parent === undefined ? t('rules.point.row', 'the row') : names.parent;
  if ('create' in at) return t('rules.point.create', 'the row is created');
  if ('to' in at) {
    return at.from === undefined
      ? t('rules.point.to', '{row} moves to {states}', { row, states: names.list(at.to.map(String)) })
      : t('rules.point.from', '{row} moves to {states} from {fromStates}', { row, states: names.list(at.to.map(String)), fromStates: names.list(at.from.map(String)) });
  }
  if ('set' in at) return t('rules.point.set', '{column} is set', { column: names.column(at.column) });
  return t('rules.point.in', '{column} becomes {values}', { column: names.column(at.column), values: names.list(at.in.map(String)) });
}

function what(t: AddOnTranslate, rule: Rule, names: Names): string {
  const source = rule.map['what'] ?? rule.map['item'];
  const quantity = rule.map['quantity'];
  const many = typeof quantity === 'string' ? names.column(quantity) : typeof quantity === 'object' && 'value' in quantity ? String(quantity.value) : '1';
  if (typeof source === 'object' && 'row' in source) return many === '1' ? t('rules.what.row', "this row's item") : t('rules.what.rowMany', "{quantity} of this row's item", { quantity: many });
  if (typeof source === 'string') return t('rules.what.column', '{quantity} of {column}', { quantity: many, column: names.column(source) });
  return t('rules.what.recorded', 'what is recorded on it');
}

/**
 * The rule's clauses, in the order they happen: hold, take, put back, then
 * where from and what it is counted by.
 */
export function sentence(t: AddOnTranslate, rule: Rule, names: Names): string[] {
  const out: string[] = [];
  if (rule.reserve !== undefined) out.push(t('rules.rule.hold', 'When {point}, hold the stock.', { point: point(t, rule.reserve.on, names) }));
  if (rule.post !== undefined) {
    out.push(rule.action === 'return' ? t('rules.rule.give', 'When {point}, put {what} back on the shelf.', { point: point(t, rule.post.on, names), what: what(t, rule, names) }) : t('rules.rule.take', 'When {point}, take {what}.', { point: point(t, rule.post.on, names), what: what(t, rule, names) }));
  }
  if (rule.reverse !== undefined) out.push(t('rules.rule.back', 'When {point}, put it back.', { point: point(t, rule.reverse.on, names) }));
  const place = rule.map['place'];
  if (typeof place === 'string') out.push(t('rules.rule.fromColumn', 'From the place in {column}.', { column: names.column(place) }));
  else if (typeof place === 'object' && 'value' in place) out.push(t('rules.rule.from', 'From {place}.', { place: names.place(String(place.value)) }));
  else if (typeof place === 'object' && 'parent' in place) out.push(t('rules.rule.fromColumn', 'From the place in {column}.', { column: names.column(place.parent) }));
  const by = Object.values(rule.multipliers ?? {}).map(one).filter((column): column is string => column !== null);
  if (by.length > 0) out.push(t('rules.rule.count', 'Counting {multipliers}.', { multipliers: names.list(by.map(names.column)) }));
  return out;
}

/* ── the sheet's form ──────────────────────────────────────────────────── */

export type When = { kind: 'never' } | { kind: 'create' } | { kind: 'moves'; to: string[] } | { kind: 'becomes'; column: string; values: string[] } | { kind: 'set'; column: string };

export interface Form {
  table: string;
  /** `row`: the row itself is what is used; else the link column that names it. */
  used: 'row' | string;
  /** A number column, or empty for one each time. */
  quantity: string;
  night: string;
  guest: string;
  hold: When;
  take: When;
  back: When;
  /** Empty: the default place. `place:<id>`: one place. `column:<name>`: a column of the table. */
  place: string;
  /** The column a hold lasts until; asked for when a Hold step is chosen. */
  until: string;
}

export const EMPTY: Form = { table: '', used: 'row', quantity: '', night: '', guest: '', hold: { kind: 'never' }, take: { kind: 'never' }, back: { kind: 'never' }, place: '', until: '' };

const pointOf = (when: When): Point | null => (when.kind === 'never' ? null : when.kind === 'create' ? { create: true } : when.kind === 'moves' ? { to: when.to } : when.kind === 'set' ? { column: when.column, set: true } : { column: when.column, in: when.values });

function whenOf(phase: { on: Point } | undefined): When {
  if (phase === undefined) return { kind: 'never' };
  const at = phase.on;
  if ('create' in at) return { kind: 'create' };
  if ('to' in at) return { kind: 'moves', to: at.to.map(String) };
  if ('set' in at) return { kind: 'set', column: at.column };
  return { kind: 'becomes', column: at.column, values: at.in.map(String) };
}

export type FormProblem = 'table' | 'take' | 'until' | 'when';

/** What the sheet cannot send as it stands. */
export function formProblems(form: Form): FormProblem[] {
  const out: FormProblem[] = [];
  if (form.table === '') out.push('table');
  // A rule that neither holds nor takes does nothing.
  if (form.hold.kind === 'never' && form.take.kind === 'never') out.push('take');
  if (form.hold.kind !== 'never' && form.until === '') out.push('until');
  for (const when of [form.hold, form.take, form.back]) {
    if ((when.kind === 'moves' && when.to.length === 0) || (when.kind === 'becomes' && (when.column === '' || when.values.length === 0)) || (when.kind === 'set' && when.column === '')) out.push('when');
  }
  return [...new Set(out)];
}

/**
 * The rule a form says. A linked column that points at this add-on's own
 * items names the stock item itself, so the rule is `use-item`; anything else
 * is `use`, or `hold` when stock is held first.
 */
export function ruleOf(form: Form, itemsTable: string, source: SourceTable | undefined): Omit<Rule, 'id'> {
  const toItems = form.used !== 'row' && source?.lineOf?.some((link) => link.via === form.used && link.table === itemsTable) === true;
  const holds = form.hold.kind !== 'never';
  const map: Record<string, Mapping> = {};
  if (toItems) map['item'] = form.used;
  else map['what'] = form.used === 'row' ? { row: true } : form.used;
  map['quantity'] = form.quantity === '' ? { value: 1 } : form.quantity;
  if (form.place.startsWith('place:')) map['place'] = { value: Number(form.place.slice(6)) || form.place.slice(6) };
  else if (form.place.startsWith('column:')) map['place'] = form.place.slice(7);
  const multipliers: Record<string, Mapping> = { ...(form.night === '' ? {} : { night: form.night }), ...(form.guest === '' ? {} : { guest: form.guest }) };
  const [reserve, post, reverse] = [pointOf(form.hold), pointOf(form.take), pointOf(form.back)];
  return {
    action: toItems ? 'use-item' : holds ? 'hold' : 'use',
    ...(reserve === null ? {} : { reserve: { on: reserve } }),
    ...(post === null ? {} : { post: { on: post } }),
    ...(reverse === null ? {} : { reverse: { on: reverse } }),
    map,
    ...(Object.keys(multipliers).length === 0 ? {} : { multipliers }),
    ...(holds && form.until !== '' ? { heldUntil: form.until } : {}),
  };
}

export function formOf(rule: Listed): Form {
  const source = rule.map['what'] ?? rule.map['item'];
  const place = rule.map['place'];
  const quantity = rule.map['quantity'];
  return {
    table: rule.table,
    used: typeof source === 'string' ? source : 'row',
    quantity: typeof quantity === 'string' ? quantity : '',
    night: one(rule.multipliers?.['night']) ?? '',
    guest: one(rule.multipliers?.['guest']) ?? '',
    hold: whenOf(rule.reserve),
    take: whenOf(rule.post),
    back: whenOf(rule.reverse),
    place: typeof place === 'string' ? `column:${place}` : typeof place === 'object' && 'value' in place ? `place:${String(place.value)}` : '',
    until: one(rule.heldUntil) ?? '',
  };
}

/** A new rule's id on its table: `stock-<n>`, the first number no rule there holds. */
export function nextId(taken: readonly string[]): string {
  for (let n = 1; ; n += 1) if (!taken.includes(`stock-${String(n)}`)) return `stock-${String(n)}`;
}

/** An app's key as a name, until the dashboard tells its own: `online-ordering` reads "Online ordering". */
export const appName = (key: string): string => {
  const words = key.replaceAll('-', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};
