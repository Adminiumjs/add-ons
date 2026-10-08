/**
 * AN OFFER RULE, AS IT IS STORED AND AS IT IS SAID.
 *
 * A rule says what one of the place's own tables has to do with offers: it
 * takes discounts, it takes a gift card as payment, it sells or tops up a
 * gift card, it sells a voucher or a pack. The first is the table's price
 * rule; the others are postings into this add-on's ledger.
 *
 * The sentence a card shows is made from the rule itself — one message for
 * each kind, with its names in places the message decides — and never from a
 * typed description: whatever a manifest declares reads the same way.
 *
 * The sheet's form is the same rule, taken apart and put together again.
 */
import type { AddOnTranslate } from '../shared/host.ts';

export type Scalar = string | number | boolean;
export type Point = { create: true } | { to: Scalar[]; from?: Scalar[] } | { column: string; in: Scalar[]; from?: Scalar[]; own?: true } | { column: string; set: true; own?: true };
export type Mapping = string | { row: true } | { parent: string } | { setting: string } | { value: Scalar };

/** A posting into the ledger, as the list route hands it. */
export interface Posted {
  id: string;
  action: string;
  table: string;
  tableLabel: string;
  owner: string | null;
  enabled: boolean;
  state: 'live' | 'off' | 'idle' | 'unavailable';
  holding: number;
  via?: string;
  post?: { on: Point };
  reverse?: { on: Point };
  map: Record<string, Mapping>;
}

/** A table's price rule, as the list route hands it. */
export interface Priced {
  table: string;
  tableLabel: string;
  owner: string | null;
  ownerName?: string;
  enabled: boolean;
  state: 'live' | 'off' | 'idle' | 'unavailable';
  adjust: Readonly<Record<string, unknown>>;
  holding: number;
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

/** `uses`: a posting that records what was used, standing by itself (its table's price rule is gone, or never came). */
export type Kind = 'discounts' | 'pays' | 'refunds' | 'sells-cards' | 'sells-vouchers' | 'uses' | 'moved';
/** The four an owner can add. */
export const ADDABLE = ['discounts', 'pays', 'sells-cards', 'sells-vouchers'] as const;
export type Addable = (typeof ADDABLE)[number];

export const kindOf = (action: string): Kind | null => (action === 'spend' ? 'pays' : action === 'refund' ? 'refunds' : action === 'issue' ? 'sells-cards' : action === 'sell' ? 'sells-vouchers' : action === 'redeem' ? 'uses' : action === 'move' ? 'moved' : null);
const ACTION: Readonly<Record<Exclude<Addable, 'discounts'>, string>> = { pays: 'spend', 'sells-cards': 'issue', 'sells-vouchers': 'sell' };
/** The posting each kind is stored under on an owner's table. */
export const POSTING: Readonly<Record<Addable | 'refunds', string>> = { discounts: 'offers-uses', pays: 'offers-card', refunds: 'offers-card-back', 'sells-cards': 'offers-card-load', 'sells-vouchers': 'offers-voucher-sold' };

/** One card of the page. */
export type Card = { kind: 'discounts'; table: string; tableLabel: string; owner: string | null; ownerName?: string; enabled: boolean; state: Priced['state']; holding: number; priced: Priced; uses: Posted | null } | { kind: Exclude<Kind, 'discounts'>; table: string; tableLabel: string; owner: string | null; enabled: boolean; state: Posted['state']; holding: number; posted: Posted };

/** The cards, table by table: a table's price rule with the posting that records its uses, then each other posting. */
export function cardsOf(priced: readonly Priced[], posted: readonly Posted[]): Card[] {
  const out: Card[] = [];
  const folded = new Set<Posted>();
  for (const rule of priced) {
    const uses = posted.find((one) => one.table === rule.table && one.action === 'redeem' && one.id === rule.adjust['uses']) ?? null;
    if (uses !== null) folded.add(uses);
    out.push({ kind: 'discounts', table: rule.table, tableLabel: rule.tableLabel, owner: rule.owner, ...(rule.ownerName === undefined ? {} : { ownerName: rule.ownerName }), enabled: rule.enabled, state: rule.state, holding: rule.holding + (uses?.holding ?? 0), priced: rule, uses });
  }
  for (const one of posted) {
    const kind = kindOf(one.action);
    if (kind === null || kind === 'discounts' || folded.has(one)) continue;
    out.push({ kind, table: one.table, tableLabel: one.tableLabel, owner: one.owner, enabled: one.enabled, state: one.state, holding: one.holding, posted: one });
  }
  // A rule of an app this add-on is not switched on for does nothing, and is not drawn.
  return out.filter((card) => card.state !== 'idle').sort((a, b) => (a.tableLabel === b.tableLabel ? 0 : a.tableLabel < b.tableLabel ? -1 : 1));
}

/** What a sentence needs to name things as a person does. */
export interface Names {
  table: (id: string) => string;
  column: (table: string, name: string) => string;
  list: (values: readonly string[]) => string;
}

const one = (mapping: unknown): string | null => (typeof mapping === 'string' && mapping !== '' ? mapping : null);

function point(t: AddOnTranslate, at: Point | undefined, table: string, names: Names): string {
  if (at === undefined) return t('rules.point.never', 'never');
  if ('create' in at) return t('rules.point.create', 'the row is created');
  if ('to' in at) return t('rules.point.to', 'it moves to {states}', { states: names.list(at.to.map(String)) });
  if ('set' in at) return t('rules.point.set', '{column} is set', { column: names.column(table, at.column) });
  return t('rules.point.in', '{column} becomes {values}', { column: names.column(table, at.column), values: names.list(at.in.map(String)) });
}

/** A card's sentence, from the rule as it is stored. */
export function sentence(t: AddOnTranslate, card: Card, names: Names): string[] {
  const out: string[] = [];
  if (card.kind === 'discounts') {
    const parts = ((card.priced.adjust['lines'] ?? []) as { table?: string; self?: true }[]).map((part) => (part.self === true ? card.tableLabel : names.table(part.table ?? '')));
    out.push(t('rules.says.discounts', 'Discounts and codes are worked out for each row, line by line from {lines}.', { lines: names.list(parts) }));
    if (card.uses === null) out.push(t('rules.says.noUses', 'What was used is not recorded: limits by use are not kept.'));
    else if (card.uses.reverse === undefined) out.push(t('rules.says.usesKept', 'What was used is recorded when {when}, and is never given back.', { when: point(t, card.uses.post?.on, card.table, names) }));
    else out.push(t('rules.says.uses', 'What was used is recorded when {when}, and given back when {back}.', { when: point(t, card.uses.post?.on, card.table, names), back: point(t, card.uses.reverse.on, card.table, names) }));
    return out;
  }
  const rule = card.posted;
  const at = point(t, rule.post?.on, card.table, names);
  const column = (mapping: unknown): string => (one(mapping) === null ? t('rules.says.noColumn', 'no column') : names.column(card.table, one(mapping) as string));
  if (card.kind === 'pays') out.push(t('rules.says.pays', 'A row that names a gift card in {card} is paid from the card when {when}; what the card paid is written to {amount}.', { card: column(rule.map['card']), when: at, amount: column(rule.map['amount']) }));
  if (card.kind === 'refunds') out.push(t('rules.says.refunds', 'A row gives {amount} back to the card that paid, when {when}.', { amount: column(rule.map['amount']), when: at }));
  if (card.kind === 'sells-cards') out.push(t('rules.says.sellsCards', 'A row that names a gift card in {card} puts {amount} on it when {when}.', { card: column(rule.map['card']), amount: column(rule.map['amount']), when: at }));
  if (card.kind === 'sells-vouchers') out.push(t('rules.says.sellsVouchers', 'A row that names a voucher in {voucher} marks it sold when {when}.', { voucher: column(rule.map['voucher']), when: at }));
  if (card.kind === 'uses') out.push(t('rules.says.usesAlone', 'What was used is recorded when {when}, though this table takes no discounts now. Remove it, or add the rule again.', { when: at }));
  if (card.kind === 'moved') out.push(t('rules.says.moved', 'Gift cards kept here before were brought in. This is done once, by Adminium.'));
  if (card.kind !== 'moved' && card.kind !== 'refunds' && card.kind !== 'uses' && rule.reverse !== undefined) out.push(t('rules.says.back', 'It is undone when {when}.', { when: point(t, rule.reverse.on, card.table, names) }));
  return out;
}

/* ── the sheet's form ──────────────────────────────────────────────────── */

/** `own`: the column is the row's own, where the row is a line of another (whose states `moves` names). */
export type When = { kind: 'never' } | { kind: 'create' } | { kind: 'moves'; to: string[] } | { kind: 'becomes'; column: string; values: string[]; own?: true } | { kind: 'set'; column: string; own?: true };

/** What Adminium is asked to add, where the table has no column for a part. */
export interface Making {
  /** The line's amount, the order's subtotal, reduction and total, and the rules that work them out. */
  amounts: boolean;
  /** A table for the codes typed on an order. */
  codes: boolean;
}

export interface Form {
  kind: Addable;
  table: string;
  /** Column picks, by part. Empty: not chosen. */
  cols: Readonly<Record<string, string>>;
  when: When;
  back: When;
  making: Making;
  /** The price rule being changed, as it is stored: what the sheet has no picker for is kept as it is. */
  base?: Readonly<Record<string, unknown>>;
}
export const EMPTY: Form = { kind: 'discounts', table: '', cols: {}, when: { kind: 'never' }, back: { kind: 'never' }, making: { amounts: false, codes: false } };

const pointOf = (when: When): Point | null => (when.kind === 'never' ? null : when.kind === 'create' ? { create: true } : when.kind === 'moves' ? { to: when.to } : when.kind === 'set' ? { column: when.column, set: true, ...(when.own === true ? { own: true as const } : {}) } : { column: when.column, in: when.values, ...(when.own === true ? { own: true as const } : {}) });
function whenOf(phase: { on: Point } | undefined): When {
  if (phase === undefined) return { kind: 'never' };
  const at = phase.on;
  if ('create' in at) return { kind: 'create' };
  if ('to' in at) return { kind: 'moves', to: at.to.map(String) };
  if ('set' in at) return { kind: 'set', column: at.column, ...(at.own === true ? { own: true as const } : {}) };
  return { kind: 'becomes', column: at.column, values: at.in.map(String), ...(at.own === true ? { own: true as const } : {}) };
}
const unfinished = (when: When): boolean => (when.kind === 'moves' && when.to.length === 0) || (when.kind === 'becomes' && (when.column === '' || when.values.length === 0)) || (when.kind === 'set' && when.column === '');

/** The names Adminium makes columns and the codes table under. */
export const MADE = { lineAmount: 'amount', subtotal: 'subtotal', discount: 'discount', total: 'total', codes: 'order_codes', codesVia: 'order_id', typed: 'typed', code: 'code_id', voucher: 'voucher_id', removed: 'removed_at' } as const;

/** The parts a kind asks for: which must be chosen, and which Adminium can add. */
export const PARTS: Readonly<Record<Addable, readonly { part: string; required: boolean; makes?: keyof Making }[]>> = {
  discounts: [
    { part: 'lines', required: true },
    { part: 'price', required: true },
    { part: 'quantity', required: false },
    // What a line sells: a link to the item, its category or its type, or a word kept on the line itself — one of the four at least (below).
    { part: 'item', required: false },
    { part: 'tag', required: false },
    { part: 'category', required: false },
    { part: 'type', required: false },
    { part: 'lineDiscount', required: true, makes: 'amounts' },
    { part: 'orderDiscount', required: true, makes: 'amounts' },
    { part: 'total', required: false, makes: 'amounts' },
    { part: 'codes', required: false, makes: 'codes' },
  ],
  pays: [
    { part: 'card', required: true },
    { part: 'amount', required: true },
    { part: 'balanceAfter', required: true },
    { part: 'refunds', required: false },
    { part: 'refundRow', required: false },
    { part: 'refundAmount', required: false },
  ],
  'sells-cards': [
    { part: 'card', required: true },
    { part: 'amount', required: true },
  ],
  'sells-vouchers': [
    { part: 'voucher', required: true },
    { part: 'amount', required: true },
    { part: 'taxLater', required: false },
  ],
};

/** What the sheet cannot send as it stands: a part's name, or `table`, `when`. */
export function formProblems(form: Form): string[] {
  const out: string[] = [];
  if (form.table === '') out.push('table');
  for (const { part, required, makes } of PARTS[form.kind]) {
    if (!required || (form.cols[part] ?? '') !== '') continue;
    if (makes !== undefined && form.making[makes]) continue;
    out.push(part);
  }
  // A price rule says at least one thing about what a line sells: the server takes none that says nothing.
  if (form.kind === 'discounts' && form.base === undefined && ['item', 'category', 'type', 'tag'].every((part) => (form.cols[part] ?? '') === '')) out.push('item');
  // A line of an order needs the price and the link that makes it a line.
  if (form.kind !== 'discounts' && form.when.kind === 'never') out.push('when');
  if (unfinished(form.when) || unfinished(form.back)) out.push('when');
  // A refund names its table, its link to the payment and its amount together, or none of them.
  const refund = ['refunds', 'refundRow', 'refundAmount'].filter((part) => (form.cols[part] ?? '') !== '');
  if (form.kind === 'pays' && refund.length > 0 && refund.length < 3) out.push('refunds');
  return [...new Set(out)];
}

const col = (form: Form, part: string): string => form.cols[part] ?? '';
const phases = (form: Form): { post?: { on: Point }; reverse?: { on: Point } } => {
  const [post, reverse] = [pointOf(form.when), pointOf(form.back)];
  return { ...(post === null ? {} : { post: { on: post } }), ...(reverse === null ? {} : { reverse: { on: reverse } }) };
};

/** A lines table's own id and the link that makes its rows lines: the pick is `<table> <via>`. */
export const linesOf = (pick: string): { table: string; via: string } => {
  const at = pick.lastIndexOf(' ');
  return { table: pick.slice(0, at), via: pick.slice(at + 1) };
};

export interface Sent {
  /** The table's price rule, for a table that takes discounts. */
  adjust?: { body: { adjust: Record<string, unknown>; make?: Record<string, unknown> } };
  /** Postings to store, in the order they must be stored: table, id, body. */
  postings: { table: string; id: string; body: Record<string, unknown> }[];
}

/**
 * What a form sends. A table that takes discounts gets its price rule and —
 * where the form says when an order is final — the posting that records what
 * was used, which the rule names and so must be stored first.
 */
export function sentOf(form: Form, refOf: (table: string) => string): Sent {
  const into = (action: string): { addOn: string; ledger: string; action: string } => ({ addOn: 'offers', ledger: 'value', action });
  if (form.kind === 'discounts') {
    const lines = linesOf(col(form, 'lines'));
    const make = form.making;
    const what = (['item', 'category', 'type'] as const).flatMap((as) => (col(form, as) === '' ? [] : [{ column: col(form, as), as }]));
    const final = pointOf(form.when);
    const frozen = final === null || 'create' in final ? undefined : 'to' in final ? { to: final.to } : 'set' in final ? { column: final.column, set: true } : { column: final.column, in: final.in };
    /*
     * A rule being changed keeps what the sheet has no picker for: its codes
     * table, who is buying, what staff give, further line tables, a line's
     * tags and what it leaves out. Only what the form holds is replaced.
     */
    const base = (form.base ?? {}) as { lines?: Record<string, unknown>[]; order?: Record<string, unknown>; uses?: unknown; frozen?: unknown; expect?: unknown };
    const { uses: _uses, frozen: _frozen, expect: _expect, lines: baseLines = [], order: baseOrder = {}, ...kept } = base;
    const { quantity: _quantity, what: baseWhat, ...keptPart } = (baseLines[0] ?? {}) as { quantity?: unknown; what?: { column: string; as: string }[] };
    // The word the sheet chose, then any further ones the rule already had.
    const tags = [...(col(form, 'tag') === '' ? [] : [{ column: col(form, 'tag'), as: 'tag' }]), ...(baseWhat ?? []).filter((entry) => entry.as === 'tag' && entry.column !== col(form, 'tag'))];
    const adjust: Record<string, unknown> = {
      ...kept,
      by: { addOn: 'offers' },
      lines: [{ ...keptPart, table: lines.table, via: lines.via, price: col(form, 'price'), ...(col(form, 'quantity') === '' ? {} : { quantity: col(form, 'quantity') }), discount: col(form, 'lineDiscount') || MADE.discount, what: [...what, ...tags] }, ...baseLines.slice(1)],
      order: { ...baseOrder, discount: col(form, 'orderDiscount') || MADE.discount },
      ...(make.codes ? { codes: { table: MADE.codes, via: MADE.codesVia, typed: MADE.typed, code: MADE.code, voucher: MADE.voucher, removed: MADE.removed } } : {}),
      ...(final === null ? {} : { uses: typeof base.uses === 'string' ? base.uses : POSTING.discounts }),
      ...(frozen === undefined ? {} : { frozen }),
      ...(col(form, 'total') !== '' ? { expect: col(form, 'total') } : make.amounts ? { expect: MADE.total } : {}),
    };
    const usesId = typeof base.uses === 'string' ? base.uses : POSTING.discounts;
    const asked = { ...(make.amounts ? { lineAmount: true, subtotal: true, discount: true, total: true } : {}), ...(make.codes ? { codes: { table: MADE.codes } } : {}) };
    return {
      adjust: { body: { adjust, ...(Object.keys(asked).length === 0 ? {} : { make: asked }) } },
      postings: final === null ? [] : [{ table: form.table, id: usesId, body: { into: into('redeem'), ...phases(form), map: {} } }],
    };
  }
  /*
   * A rule drawn here hears its own row and nothing else: when it is made,
   * when one of its own columns is set or becomes a value. One that reads its
   * rows as lines of an order (`via`) is an app's, drawn in its file — the
   * server takes none from a sheet, so the sheet offers none.
   */
  if (form.kind === 'pays') {
    const map: Record<string, Mapping> = { card: col(form, 'card'), amount: col(form, 'amount'), balance_after: col(form, 'balanceAfter') };
    const postings = [{ table: form.table, id: POSTING.pays, body: { into: into(ACTION.pays), ...phases(form), map } }];
    if (col(form, 'refunds') !== '') postings.push({ table: col(form, 'refunds'), id: POSTING.refunds, body: { into: into('refund'), post: { on: { create: true } }, map: { against_table: { value: refOf(form.table) }, against_row: col(form, 'refundRow'), amount: col(form, 'refundAmount') } } });
    return { postings };
  }
  const map: Record<string, Mapping> = form.kind === 'sells-cards' ? { card: col(form, 'card'), amount: col(form, 'amount') } : { voucher: col(form, 'voucher'), amount: col(form, 'amount'), ...(col(form, 'taxLater') === '' ? {} : { tax_later: col(form, 'taxLater') }) };
  return { postings: [{ table: form.table, id: POSTING[form.kind], body: { into: into(ACTION[form.kind]), ...phases(form), map } }] };
}

/** The form of a rule an owner made, to change it. */
export function formOf(card: Card): Form | null {
  if (card.kind === 'discounts') {
    const adjust = card.priced.adjust as { lines?: { table?: string; via?: string; price?: string; quantity?: string; discount?: string; what?: { column: string; as: string }[] }[]; order?: { discount?: string }; expect?: string };
    const part = adjust.lines?.[0];
    if (part === undefined || part.table === undefined) return null;
    const what = (as: string): string => part.what?.find((entry) => entry.as === as)?.column ?? '';
    return {
      kind: 'discounts',
      table: card.table,
      cols: { lines: `${part.table} ${part.via ?? ''}`, price: part.price ?? '', quantity: part.quantity ?? '', item: what('item'), category: what('category'), type: what('type'), tag: what('tag'), lineDiscount: part.discount ?? '', orderDiscount: adjust.order?.discount ?? '', total: adjust.expect ?? '' },
      when: whenOf(card.uses?.post),
      back: whenOf(card.uses?.reverse),
      making: { amounts: false, codes: false },
      base: card.priced.adjust,
    };
  }
  if (card.kind !== 'pays' && card.kind !== 'sells-cards' && card.kind !== 'sells-vouchers') return null;
  const rule = card.posted;
  // A rule that reads its rows as lines of another row was drawn in a file, and is changed there.
  if (rule.via !== undefined) return null;
  const cols: Record<string, string> = { amount: one(rule.map['amount']) ?? '' };
  if (card.kind === 'sells-vouchers') Object.assign(cols, { voucher: one(rule.map['voucher']) ?? '', taxLater: one(rule.map['tax_later']) ?? '' });
  else Object.assign(cols, { card: one(rule.map['card']) ?? '' });
  if (card.kind === 'pays') Object.assign(cols, { balanceAfter: one(rule.map['balance_after']) ?? '' });
  return { kind: card.kind, table: card.table, cols, when: whenOf(rule.post), back: whenOf(rule.reverse), making: { amounts: false, codes: false } };
}

/** An app's key as a name, until the dashboard tells its own: `online-ordering` reads "Online ordering". */
export const appName = (key: string): string => {
  const words = key.replaceAll('-', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};
