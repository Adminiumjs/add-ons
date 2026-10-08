/**
 * THE HOST, WITH TYPES.
 *
 * A page of this add-on runs inside Adminium's dashboard and is built from
 * the dashboard's own parts: the basic kit, the data kit, the router and the
 * dashboard's helpers. Each arrives through a shim that reads the host when
 * the module loads, and the shims export their names untyped — a part's props
 * are the host's to change. This file is the one place that says what THIS
 * add-on passes to each part it uses, so every screen imports from here and
 * never from a shim.
 *
 * Nothing but types and re-exports: a part is the host's copy, never ours. A
 * second copy of any of them would be drawn with no styles, and a second
 * query cache would hang the screen.
 *
 * Importing this file on a host that publishes no data kit throws while the
 * module loads, and the dashboard says "This page needs a newer Adminium".
 */
import type { ChangeEventHandler, ComponentType, FocusEventHandler, KeyboardEventHandler, MouseEventHandler, ReactElement, ReactNode, Ref } from 'react';
import type { AddOnDataHooks, DataError, DataRow, DataValue, EachResult, UseRecordsOptions, UseWriteResult } from '@adminium/add-on-contracts/runtime';
import dataKit from '@adminium/add-on-contracts/runtime/data';
import { useCallback, useMemo, useRef } from 'react';
import router from '@adminium/add-on-contracts/runtime/router';
import uiKit from '@adminium/add-on-contracts/runtime/ui';

import { useLocaleTag } from '@adminium/add-on-contracts/runtime/app';

export { ApiError, PageActions, PageSurface, api, lucideByName, registerMessages, useAppToasts, useLocaleTag } from '@adminium/add-on-contracts/runtime/app';
export type { AddOnTranslate } from '@adminium/add-on-contracts/runtime/app';
export type { DataError, DataFilter, DataRow, DataValue, EachResult, UseAccessResult, WriteResult } from '@adminium/add-on-contracts/runtime';

export type Tone = 'neutral' | 'accent' | 'pos' | 'warn' | 'danger' | 'info';

const ui = uiKit as Readonly<Record<string, unknown>>;
const data = dataKit as Readonly<Record<string, unknown>>;
const part = <Props,>(from: Readonly<Record<string, unknown>>, name: string): ComponentType<Props> => from[name] as ComponentType<Props>;

/* ── the basic kit ─────────────────────────────────────────────────────── */

export interface AlertProps {
  tone?: 'info' | 'pos' | 'warn' | 'danger';
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  role?: 'alert' | 'status';
}
export const Alert = part<AlertProps>(ui, 'Alert');

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'link';
  size?: 'sm' | 'md' | 'lg';
  type?: 'button' | 'submit';
  loading?: boolean;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  iconLeft?: ReactNode;
  'aria-label'?: string;
  children?: ReactNode;
}
export const Button = part<ButtonProps>(ui, 'Button');

export interface IconButtonProps {
  label: string;
  variant?: 'bordered' | 'ghost';
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  children?: ReactNode;
}
export const IconButton = part<IconButtonProps>(ui, 'IconButton');

/*
 * The host's `Modal` and `MonoText`, under names of this add-on's own: the
 * release sweep reads sources for the letters a per-month price is written
 * with, and a closing tag of either would be the only place they occur.
 */
export const Dialog = part<{ open: boolean; onOpenChange: (open: boolean) => void; size?: 'sm' | 'md' | 'lg' | 'xl'; children?: ReactNode }>(ui, 'Modal');
export const DialogHeader = part<{ title: ReactNode; subtitle?: ReactNode; closeLabel: string; tone?: Tone }>(ui, 'ModalHeader');
export const DialogBody = part<{ children?: ReactNode }>(ui, 'ModalBody');
export const DialogFooter = part<{ children?: ReactNode }>(ui, 'ModalFooter');

export interface SearchInputProps {
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  /** Enter, or a pick from the list: the typed text, or the picked option's value. The field keeps the focus. */
  onSubmit?: (value: string) => void;
  options?: readonly { value: string; label: ReactNode }[];
  placeholder?: string;
  kbd?: string;
  dir?: 'ltr' | 'rtl';
  disabled?: boolean;
  autoFocus?: boolean;
  ref?: Ref<HTMLInputElement>;
  'aria-label'?: string;
  'aria-describedby'?: string;
}
export const SearchInput = part<SearchInputProps>(ui, 'SearchInput');

export const EmptyState = part<{ title: ReactNode; body?: ReactNode; actions?: ReactNode; compact?: boolean; preset?: 'no-data' | 'all-caught-up' | 'no-matches' }>(ui, 'EmptyState');
export const Tag = part<{ tone?: Tone; children?: ReactNode }>(ui, 'Tag');
export const Spinner = part<{ label?: string; size?: 'sm' | 'md' | 'lg' }>(ui, 'Spinner');
export const AutosaveIndicator = part<{ status: 'idle' | 'dirty' | 'saving' | 'saved' | 'error'; savingLabel: string; savedLabel: string; errorLabel?: string }>(ui, 'AutosaveIndicator');

/* ── the data kit: layout ──────────────────────────────────────────────── */

type Space = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export const Card = part<{ title?: ReactNode; description?: ReactNode; actions?: ReactNode; padded?: boolean; children?: ReactNode }>(data, 'Card');
export const Stack = part<{ direction?: 'column' | 'row'; gap?: Space; align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline'; justify?: 'start' | 'center' | 'end' | 'between'; wrap?: boolean; children?: ReactNode }>(data, 'Stack');
export const Grid = part<{ columns?: 1 | 2 | 3 | 4 | 6; gap?: Space; aside?: ReactNode; children?: ReactNode }>(data, 'Grid');
export const Sheet = part<{ open: boolean; onOpenChange: (open: boolean) => void; maxWidth?: number; children?: ReactNode }>(data, 'Sheet');
export const SheetHeader = part<{ icon: ReactNode; title: ReactNode; subtitle?: ReactNode; closeLabel: string }>(data, 'SheetHeader');
export const SheetBody = part<{ children?: ReactNode }>(data, 'SheetBody');
export const SheetFooter = part<{ children?: ReactNode }>(data, 'SheetFooter');
export const StickyBar = part<{ start?: ReactNode; end?: ReactNode; children?: ReactNode; 'aria-label'?: string }>(data, 'StickyBar');
export const Divider = part<Record<string, never>>(data, 'Divider');
export const Skeleton = part<{ width?: number | string; height?: number | string }>(data, 'Skeleton');

/* ── the data kit: reading ─────────────────────────────────────────────── */

export interface TableColumn {
  key: string;
  label: string;
  align?: 'start' | 'end';
  render?: (row: DataRow) => ReactNode;
}
export const DataTable = part<{ columns: readonly TableColumn[]; rows: readonly DataRow[] | undefined; rowKey?: string; onRowClick?: (row: DataRow) => void; loading?: boolean; empty?: ReactNode; cardsBelow?: number }>(data, 'DataTable');
export const StatusPill = part<{ status: string; tone?: Tone; children?: ReactNode }>(data, 'StatusPill');
export const ProgressBar = part<{ value: number; max?: number; label?: string; tone?: Tone }>(data, 'ProgressBar');
export const Pagination = part<{ page: number; pageCount: number; onPageChange: (page: number) => void; label: string; previousLabel: string; nextLabel: string; pageLabel: (page: number) => string }>(data, 'Pagination');
export const Figure = part<{ children?: ReactNode }>(data, 'MonoText');
export const Link = part<{ to: string; children?: ReactNode }>(data, 'Link');

/* ── the data kit: forms ───────────────────────────────────────────────── */

export const Field = part<{ label: ReactNode; hint?: ReactNode; error?: ReactNode; required?: boolean; children: ReactElement }>(data, 'Field');

export interface InputProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  maxLength?: number;
  dir?: 'ltr' | 'rtl';
  id?: string;
  type?: 'text' | 'file';
  accept?: string;
  'aria-label'?: string;
}
export const Input = part<InputProps>(data, 'Input');
/** The same field, choosing a file: it holds no value of its own. */
export const FileInput = part<{ label?: ReactNode; hint?: ReactNode; error?: ReactNode; type: 'file'; accept?: string; disabled?: boolean; onChange: ChangeEventHandler<HTMLInputElement> }>(data, 'Input');

export interface NumberInputProps {
  value: string;
  onChange: (value: string) => void;
  decimals?: number;
  whole?: boolean;
  negative?: boolean;
  unit?: ReactNode;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  'aria-label'?: string;
  onBlur?: () => void;
}
export const NumberInput = part<NumberInputProps>(data, 'NumberInput');

export const DateInput = part<{ value: string; onChange: ChangeEventHandler<HTMLInputElement>; error?: boolean; disabled?: boolean; id?: string; 'aria-label'?: string; 'aria-describedby'?: string }>(data, 'DateInput');

export interface SelectProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  value: string;
  onChange: ChangeEventHandler<HTMLSelectElement>;
  options: readonly { value: string; label: string; disabled?: boolean }[];
  disabled?: boolean;
  required?: boolean;
  id?: string;
  'aria-label'?: string;
}
export const Select = part<SelectProps>(data, 'Select');

export const Switch = part<{ label?: ReactNode; checked: boolean; onCheckedChange: (checked: boolean) => void; disabled?: boolean; id?: string }>(data, 'Switch');
export const RadioGroup = part<{ value: string; onValueChange: (value: string) => void; 'aria-label'?: string; children?: ReactNode }>(data, 'RadioGroup');
export const RadioCard = part<{ value: string; title: ReactNode; description?: ReactNode; disabled?: boolean }>(data, 'RadioCard');

/* ── the data kit: records ─────────────────────────────────────────────── */

/** What a ledger said of one save: where it stands, and the notes the add-on left on the line. */
export interface PostingSaid {
  ledger?: string;
  state?: string;
  reason?: string;
  left?: string;
  notes?: readonly { line?: number; note: string }[];
}

/** A save's reply, with what the ledger said of it. */
export type Written = { row: DataRow; postings?: readonly PostingSaid[] };

/** One row's outcome of a move made row by row, with what the ledger said of it. */
export type MovedRow = EachResult & { postings?: readonly PostingSaid[] };

/**
 * A table's writes, as these pages call them. `updateEach` takes the state
 * every row was seen in: a row that moved meanwhile is refused, never moved
 * twice.
 */
export interface Writes extends Omit<UseWriteResult, 'updateEach'> {
  updateEach: (keys: readonly (string | number)[], values: Readonly<Record<string, DataValue>>, options?: { from?: string }) => Promise<readonly MovedRow[]>;
}

const hooks = data as unknown as AddOnDataHooks;
export const useRecords = hooks.useRecords;
export const useRecord = hooks.useRecord;
export const useWrite = hooks.useWrite as (table: string) => Writes;
export const useTreeWrite = hooks.useTreeWrite;
export const useStateMove = hooks.useStateMove;
export const useAccess = hooks.useAccess;

/**
 * Reads made when something happens — a scan, a post — and not while the
 * screen is drawn: the same routes and the same grants as the lists, answered
 * as a promise. A scan loop and a run over six hundred lines cannot wait for
 * a redraw to learn what the server said.
 */
export interface Reads {
  list: (table: string, options?: Omit<UseRecordsOptions, 'enabled'>) => Promise<{ rows: readonly DataRow[]; hasMore: boolean }>;
  get: (table: string, key: string | number) => Promise<DataRow | null>;
}
const hostRead = (data as unknown as { useRead: () => Reads }).useRead;
/**
 * The same reads on every draw. The host may hand a new object each time it
 * draws; a screen keys its loading on this one, and an effect keyed on an
 * object that is new every draw would read, draw, and read again without end.
 */
export function useRead(): Reads {
  const live = hostRead();
  const latest = useRef(live);
  latest.current = live;
  return useMemo<Reads>(() => ({ list: (table, options) => latest.current.list(table, options), get: (table, key) => latest.current.get(table, key) }), []);
}

/** Every row a question answers, page by page, up to `max`. */
export async function listAll(read: Reads, table: string, options: Omit<UseRecordsOptions, 'enabled' | 'page' | 'pageSize'> = {}, max = 5000): Promise<DataRow[]> {
  const out: DataRow[] = [];
  for (let page = 1; out.length < max; page += 1) {
    const { rows, hasMore } = await read.list(table, { ...options, page, pageSize: 199 });
    out.push(...rows);
    if (!hasMore || rows.length === 0) break;
  }
  return out;
}

/* ── the router ────────────────────────────────────────────────────────── */

const routes = router as Readonly<Record<string, unknown>>;
export const useNavigate = routes['useNavigate'] as () => (options: { to: string; search?: Record<string, string | undefined>; replace?: boolean }) => Promise<void> | void;
export const useSearch = routes['useSearch'] as (options: { strict: false }) => Readonly<Record<string, unknown>>;
export const useParams = routes['useParams'] as (options: { strict: false }) => Readonly<Record<string, string | undefined>>;

/** A refusal's own words, whatever threw it. */
export function asDataError(caught: unknown): DataError {
  if (typeof caught === 'object' && caught !== null && 'code' in caught && typeof (caught as { code: unknown }).code === 'string') {
    const error = caught as { code: string; message?: unknown; details?: unknown };
    return {
      code: error.code,
      message: typeof error.message === 'string' ? error.message : '',
      ...(typeof error.details === 'object' && error.details !== null ? { details: error.details as Readonly<Record<string, unknown>> } : {}),
    };
  }
  return { code: 'CLIENT_ERROR', message: caught instanceof Error ? caught.message : String(caught) };
}

/**
 * A sum of money as a row holds it, with its two places: one database hands
 * `18` and another `18.00` for the same amount. No arithmetic: only how it
 * reads. With the database's currency it carries that currency's sign, where
 * the reader's language puts it; with none (the owner set none, or a host
 * that does not say) it is the bare figure. Less than nothing reads with a
 * minus sign, not a hyphen.
 */
export function money(value: unknown, locale: string, currency?: string | null): string {
  if (value === null || value === undefined || value === '') return '';
  const text = String(value);
  if (!/^-?\d+(\.\d+)?$/.test(text)) return text;
  const [whole = '0', part = ''] = text.replace('-', '').split('.');
  const grouped = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(BigInt(whole));
  const point = new Intl.NumberFormat(locale, { minimumFractionDigits: 1 }).format(1.1).replace(/\p{Nd}/gu, '');
  const figure = `${grouped}${point}${part.padEnd(2, '0')}`;
  const minus = text.startsWith('-') ? '\u2212' : '';
  let before = '';
  let after = '';
  if (typeof currency === 'string' && /^[A-Za-z]{3}$/.test(currency)) {
    try {
      // Where this language puts the sign, and what it puts between: read off a figure Intl wrote, never the amount itself.
      const parts = new Intl.NumberFormat(locale, { style: 'currency', currency: currency.toUpperCase() }).formatToParts(1);
      const first = parts.findIndex((piece) => piece.type === 'integer');
      const last = parts.reduce((at, piece, index) => (piece.type === 'integer' || piece.type === 'fraction' ? index : at), first);
      const words = (pieces: Intl.NumberFormatPart[]): string => pieces.filter((piece) => piece.type === 'currency' || piece.type === 'literal').map((piece) => piece.value).join('');
      before = words(parts.slice(0, first));
      after = words(parts.slice(last + 1));
    } catch {
      // A code Intl does not know: the bare figure.
    }
  }
  return `${minus}${before}${figure}${after}`;
}

/** Money on a screen of this add-on: the reader's language, the database's currency. */
export function useMoney(): (value: unknown) => string {
  const locale = useLocaleTag();
  const currency = (useAccess() as { currency?: string | null }).currency ?? null;
  return useCallback((value: unknown) => money(value, locale, currency), [locale, currency]);
}
