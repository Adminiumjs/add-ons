/**
 * A HOST, FOR THE SCREENS' OWN TESTS.
 *
 * A screen runs inside Adminium and takes every part and every read from it.
 * A test has no Adminium, so this publishes one before any test file is
 * imported — the order the shims need, which is why it is a setup file.
 *
 * WHAT IS REAL: React. WHAT IS A STAND-IN: everything the dashboard gives —
 * each part is the plainest element that does the part's job (a button is a
 * button, a field is a labelled input), and the data kit is a small world of
 * rows held in memory (`world`), filtered, sorted and paged the way the data
 * routes do. So these suites prove what a screen ASKS FOR and what it SHOWS;
 * how the parts look, and what a real server answers, are proved elsewhere
 * (the engine's own suites and the walk in a browser).
 */
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import { HOST_API_VERSION, installAddOnRuntime } from '@adminium/add-on-contracts/runtime';

type Row = Record<string, string | number | boolean | null>;
type Values = Readonly<Record<string, string | number | boolean | null>>;
interface Filter {
  column: string;
  op: string;
  value?: unknown;
}
interface ListOptions {
  filter?: readonly Filter[];
  sort?: readonly { column: string; direction: 'asc' | 'desc' }[];
  page?: number;
  pageSize?: number;
  columns?: readonly string[];
  enabled?: boolean;
}
interface Refusal {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
type Each = { key: string; ok: true; row: Row; postings?: unknown[] } | { key: string; ok: false; error: Refusal } | { key: string; ok: false; notRun: true };

export class Refused extends Error {
  readonly code: string;
  readonly details: Record<string, unknown> | undefined;
  readonly status = 409;
  constructor(code: string, message = '', details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export interface Call {
  kind: 'create' | 'update' | 'remove' | 'updateEach' | 'createEach' | 'tree' | 'move' | 'list' | 'get' | 'look-up' | 'document' | 'export' | 'download' | 'api';
  table: string;
  key?: string;
  values?: unknown;
  options?: unknown;
}

/** The world a test sets up and then reads back. Reset before every test. */
export const world = {
  tables: {} as Record<string, Row[]>,
  /** Columns a reader may not read, by table; a table listed under `closed` may not be read at all. */
  unreadable: {} as Record<string, string[]>,
  closed: new Set<string>(),
  /** What the reader may not do: `create:items`, `update:counts`, `move:receipts:posting`. */
  cannot: new Set<string>(),
  has: {} as Record<string, boolean>,
  calls: [] as Call[],
  /** What Adminium decides on a saved row; the default decides nothing. */
  decide: ((_table: string, row: Row): Row => row) as (table: string, row: Row) => Row,
  /** Answers a row-by-row change; absent, every row is changed. */
  updateEach: null as null | ((table: string, keys: readonly string[], values: Values, options: { from?: string } | undefined) => Each[] | Promise<Each[]>),
  /** Answers a move; absent, the state is set. */
  move: null as null | ((table: string, key: string, to: string, values: Values | undefined) => void),
  /** Answers a save before it is made: throw a `Refused` to refuse it. */
  before: null as null | ((kind: Call['kind'], table: string, values: unknown) => void),
  /** Answers a look-up; absent, nothing is found. */
  lookUp: null as null | ((typed: string) => unknown),
  /** Answers a call of the dashboard's own `api`, by method and path; absent, an empty object. */
  api: null as null | ((method: string, path: string, payload: unknown) => unknown),
  /** What a create hands back once beside its row: a code and a print token. */
  once: null as null | ((table: string, row: Row) => unknown[]),
  /** Answers a row-by-row create; absent, every row is made. */
  createEach: null as null | ((table: string, rows: readonly Values[]) => Each[]),
  search: {} as Record<string, unknown>,
  splat: '',
  navigated: [] as { to: string; search?: Record<string, unknown>; replace?: boolean }[],
  toasts: [] as { variant?: string; title: unknown }[],
  locale: 'en-US',
  nextId: 1000,
};

const listeners = new Set<() => void>();
let version = 0;
const changed = (): void => {
  version += 1;
  for (const listener of listeners) listener();
};
const useWorld = (): number => React.useSyncExternalStore((listener) => (listeners.add(listener), () => listeners.delete(listener)), () => version);

export function resetWorld(): void {
  world.tables = {};
  world.unreadable = {};
  world.closed = new Set();
  world.cannot = new Set();
  world.has = {};
  world.calls = [];
  world.decide = (_table, row) => row;
  world.updateEach = null;
  world.move = null;
  world.before = null;
  world.lookUp = null;
  world.api = null;
  world.once = null;
  world.createEach = null;
  world.search = {};
  world.splat = '';
  world.navigated = [];
  world.toasts = [];
  world.locale = 'en-US';
  world.nextId = 1000;
  changed();
}

/** Put rows into the world (and tell every list that reads them). */
export function seed(table: string, rows: readonly Row[]): void {
  world.tables[table] = rows.map((row) => ({ ...row }));
  changed();
}

const loose = (value: unknown): string => (value === true ? '1' : value === false ? '0' : value === null || value === undefined ? '' : String(value));
const numberOf = (value: unknown): number => Number(value);

function meets(row: Row, filter: Filter): boolean {
  const held = row[filter.column];
  switch (filter.op) {
    case 'eq':
      return loose(held).toLowerCase() === loose(filter.value).toLowerCase();
    case 'neq':
      return loose(held) !== loose(filter.value);
    case 'in':
      return (filter.value as unknown[]).map(loose).includes(loose(held));
    case 'gt':
      return numberOf(held) > numberOf(filter.value);
    case 'gte':
      return numberOf(held) >= numberOf(filter.value);
    case 'lt':
      return numberOf(held) < numberOf(filter.value);
    case 'lte':
      return numberOf(held) <= numberOf(filter.value);
    case 'contains':
      return loose(held).toLowerCase().includes(loose(filter.value).toLowerCase());
    case 'empty':
      return held === null || held === undefined || held === '';
    case 'notEmpty':
      return !(held === null || held === undefined || held === '');
    default:
      throw new Error(`no such filter: ${filter.op}`);
  }
}

function listed(table: string, options: ListOptions = {}): { rows: Row[]; hasMore: boolean } {
  if (world.closed.has(table)) throw new Refused('TABLE_FORBIDDEN', 'You may not read this table.');
  const hidden = world.unreadable[table] ?? [];
  for (const column of options.columns ?? []) {
    if (hidden.includes(column)) throw new Refused('COLUMN_FORBIDDEN', `You may not read ${column}.`, { column });
  }
  let rows = (world.tables[table] ?? []).filter((row) => (options.filter ?? []).every((filter) => meets(row, filter)));
  for (const sort of [...(options.sort ?? [])].reverse()) {
    rows = [...rows].sort((a, b) => {
      const [x, y] = [a[sort.column], b[sort.column]];
      const order = typeof x === 'number' && typeof y === 'number' ? x - y : loose(x).localeCompare(loose(y), 'en', { numeric: true });
      return sort.direction === 'asc' ? order : -order;
    });
  }
  const size = options.pageSize ?? 50;
  const start = ((options.page ?? 1) - 1) * size;
  const page = rows.slice(start, start + size).map((row) => Object.fromEntries(Object.entries(row).filter(([column]) => !hidden.includes(column) && (options.columns === undefined || options.columns.includes(column)))) as Row);
  return { rows: page, hasMore: rows.length > start + size };
}

const find = (table: string, key: string | number): Row | undefined => (world.tables[table] ?? []).find((row) => loose(row['id']) === loose(key));
const shown = (table: string, row: Row): Row => Object.fromEntries(Object.entries(row).filter(([column]) => !(world.unreadable[table] ?? []).includes(column))) as Row;
const asRefusal = (caught: unknown): Refusal => (caught instanceof Refused ? { code: caught.code, message: caught.message, ...(caught.details === undefined ? {} : { details: caught.details }) } : { code: 'CLIENT_ERROR', message: String(caught) });

function insert(table: string, values: Values): Row {
  const row = world.decide(table, { id: (world.nextId += 1), ...values });
  (world.tables[table] ??= []).push(row);
  return row;
}

function useRecords(table: string, options: ListOptions = {}) {
  useWorld();
  if (options.enabled === false) return { rows: [], hasMore: false, loading: false, error: null, refetch: () => undefined };
  try {
    return { ...listed(table, options), loading: false, error: null, refetch: () => undefined };
  } catch (caught) {
    return { rows: [], hasMore: false, loading: false, error: asRefusal(caught), refetch: () => undefined };
  }
}

function useRecord(table: string, key: string | number | null) {
  useWorld();
  const row = key === null ? undefined : find(table, key);
  return { row: row === undefined ? null : shown(table, row), loading: false, error: null, refetch: () => undefined };
}

const reads = {
  list: async (table: string, options?: ListOptions) => {
    world.calls.push({ kind: 'list', table, options });
    return listed(table, options);
  },
  get: async (table: string, key: string | number) => {
    world.calls.push({ kind: 'get', table, key: String(key) });
    const row = find(table, key);
    return row === undefined ? null : shown(table, row);
  },
};

function writes(table: string) {
  return {
    create: async (values: Values) => {
      world.calls.push({ kind: 'create', table, values });
      world.before?.('create', table, values);
      const row = insert(table, values);
      changed();
      const once = world.once?.(table, row);
      return { row: shown(table, row), ...(once === undefined ? {} : { once }) };
    },
    update: async (key: string | number, values: Values) => {
      world.calls.push({ kind: 'update', table, key: String(key), values });
      world.before?.('update', table, values);
      const row = find(table, key);
      if (row === undefined) throw new Refused('NOT_FOUND');
      Object.assign(row, world.decide(table, { ...row, ...values }));
      changed();
      return { row: shown(table, row) };
    },
    remove: async (key: string | number) => {
      world.calls.push({ kind: 'remove', table, key: String(key) });
      world.before?.('remove', table, key);
      world.tables[table] = (world.tables[table] ?? []).filter((row) => loose(row['id']) !== loose(key));
      changed();
    },
    updateEach: async (keys: readonly (string | number)[], values: Values, options?: { from?: string }) => {
      const ids = keys.map(String);
      world.calls.push({ kind: 'updateEach', table, values: { ids, values }, options });
      const results: Each[] =
        world.updateEach !== null
          ? await world.updateEach(table, ids, values, options)
          : ids.map((key) => {
              const row = find(table, key);
              if (row === undefined) return { key, ok: false, error: { code: 'NOT_FOUND', message: '' } };
              // A row that is no longer in the state it was seen in is refused, never moved twice.
              if (options?.from !== undefined && row['status'] !== options.from) return { key, ok: false, error: { code: 'STATE_MOVE_REFUSED', message: '' } };
              Object.assign(row, world.decide(table, { ...row, ...values }));
              return { key, ok: true, row: shown(table, row) };
            });
      changed();
      return results;
    },
    createEach: async (rows: readonly Values[]) => {
      world.calls.push({ kind: 'createEach', table, values: rows });
      const results: Each[] = world.createEach !== null ? world.createEach(table, rows) : rows.map((values, index) => ({ key: String(index), ok: true as const, row: shown(table, insert(table, values)) }));
      changed();
      return results;
    },
    saving: false,
    error: null,
  };
}

interface Tree {
  values: Values;
  children?: Record<string, readonly Tree[]>;
}

/** The column a child table points at its parent with, as the manifest names it. */
const VIA: Record<string, string> = { card_actions: 'card_id', voucher_actions: 'voucher_id', offer_breaks: 'offer_id', offer_targets: 'offer_id', codes: 'offer_id', batch_chunks: 'batch_id' };

function treeWrites(table: string) {
  return {
    create: async (tree: Tree) => {
      world.calls.push({ kind: 'tree', table, values: tree });
      world.before?.('tree', table, tree);
      const parent = insert(table, tree.values);
      for (const [child, rows] of Object.entries(tree.children ?? {})) {
        for (const row of rows) insert(child, { ...row.values, [VIA[child] ?? `${table}_id`]: parent['id'] as number });
      }
      // What the sheet counts of its own lines is decided once they are in.
      Object.assign(parent, world.decide(table, parent));
      changed();
      const once = world.once?.(table, parent);
      return { row: shown(table, parent), ...(once === undefined ? {} : { once }) };
    },
    dryRun: async () => ({}),
    saving: false,
    error: null,
  };
}

function useStateMove(table: string) {
  return async (key: string | number, to: string, values?: Values) => {
    world.calls.push({ kind: 'move', table, key: String(key), values: { to, ...(values === undefined ? {} : { values }) } });
    if (world.cannot.has(`move:${table}:${to}`)) throw new Refused('FORBIDDEN');
    world.before?.('move', table, { key: String(key), to, values });
    const row = find(table, key);
    if (row === undefined) throw new Refused('NOT_FOUND');
    if (world.move !== null) world.move(table, String(key), to, values);
    else Object.assign(row, world.decide(table, { ...row, ...(values ?? {}), status: to }));
    changed();
    return { row: shown(table, row) };
  };
}

function useAccess() {
  useWorld();
  return {
    ready: true,
    canRead: (table: string, columns?: readonly string[]) => !world.closed.has(table) && (columns ?? []).every((column) => !(world.unreadable[table] ?? []).includes(column)),
    canCreate: (table: string) => !world.cannot.has(`create:${table}`),
    canUpdate: (table: string) => !world.cannot.has(`update:${table}`),
    canMove: (table: string, to: string) => !world.cannot.has(`move:${table}:${to}`) && !world.cannot.has(`update:${table}`),
    has: (feature: string) => world.has[feature] === true,
  };
}

/* ── the parts, each the plainest thing that does its job ───────────────── */

type Props = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const box =
  (part: string) =>
  ({ children, title, description, actions, start, end, aside }: Props) => (
    <div data-part={part}>
      {title === undefined ? null : <div data-slot="title">{title}</div>}
      {description === undefined ? null : <div data-slot="description">{description}</div>}
      {actions}
      {start}
      {children}
      {end}
      {aside}
    </div>
  );

function Labelled({ label, hint, error, id, children }: { label?: React.ReactNode; hint?: React.ReactNode; error?: React.ReactNode; id: string; children: React.ReactNode }) {
  return (
    <span data-part="field">
      {label === undefined ? null : <label htmlFor={id}>{label}</label>}
      {children}
      {error === undefined || error === null || error === false ? null : (
        <span role="alert" data-slot="error">
          {error}
        </span>
      )}
      {hint === undefined ? null : <span data-slot="hint">{hint}</span>}
    </span>
  );
}

function Input({ label, hint, error, id, ...rest }: Props) {
  const made = React.useId();
  return (
    <Labelled label={label} hint={hint} error={error} id={id ?? made}>
      <input id={id ?? made} {...rest} />
    </Labelled>
  );
}

function NumberInput({ label, hint, error, id, value, onChange, unit, disabled, onBlur, decimals, whole, negative, required, placeholder, ...aria }: Props) {
  const made = React.useId();
  void decimals;
  void whole;
  void negative;
  return (
    <Labelled label={label} hint={hint} error={error} id={id ?? made}>
      <input id={id ?? made} inputMode="decimal" value={value} disabled={disabled} required={required} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} onBlur={() => onBlur?.()} {...aria} />
      {unit === undefined ? null : <span data-slot="unit">{unit}</span>}
    </Labelled>
  );
}

function Select({ label, hint, error, id, options, ...rest }: Props) {
  const made = React.useId();
  return (
    <Labelled label={label} hint={hint} error={error} id={id ?? made}>
      <select id={id ?? made} {...rest}>
        {(options as { value: string; label: string }[]).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Labelled>
  );
}

function Field({ label, hint, error, children }: Props) {
  const made = React.useId();
  return (
    <Labelled label={label} hint={hint} error={error} id={made}>
      {React.cloneElement(children as React.ReactElement<{ id?: string }>, { id: made })}
    </Labelled>
  );
}

function SearchInput({ value, onChange, onSubmit, options, kbd, inputClassName, ref, ...rest }: Props) {
  void kbd;
  void inputClassName;
  return (
    <span data-part="search">
      <input
        ref={ref}
        role="combobox"
        aria-expanded={(options ?? []).length > 0}
        value={value}
        onChange={onChange}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onSubmit?.(value);
        }}
        {...rest}
        autoFocus={false}
      />
      {(options as { value: string; label: React.ReactNode }[] | undefined)?.map((option) => (
        <button key={option.value} type="button" role="option" aria-selected="false" onClick={() => onSubmit?.(option.value)}>
          {option.label}
        </button>
      ))}
    </span>
  );
}

const Button = ({ children, loading, variant, size, iconLeft, ...rest }: Props) => {
  void variant;
  void size;
  return (
    <button type="button" data-loading={loading === true ? '' : undefined} {...rest}>
      {iconLeft}
      {children}
    </button>
  );
};
const IconButton = ({ label, children, variant, ...rest }: Props) => {
  void variant;
  return (
    <button type="button" aria-label={label} {...rest}>
      {children}
    </button>
  );
};
const Alert = ({ title, body, action, role, tone }: Props) => (
  <div role={role ?? 'status'} data-part="alert" data-tone={tone ?? 'info'}>
    <span data-slot="title">{title}</span>
    {body === undefined ? null : <span data-slot="body">{body}</span>}
    {action}
  </div>
);
const Opened = ({ open, children, part }: Props) => (open === true ? <div role="dialog" data-part={part}>{children}</div> : null);
const Head = ({ title, subtitle }: Props) => (
  <div>
    <h2>{title}</h2>
    {subtitle === undefined ? null : <p>{subtitle}</p>}
  </div>
);
const EmptyState = ({ title, body, actions }: Props) => (
  <div data-part="empty">
    <span data-slot="title">{title}</span>
    {body === undefined ? null : <span data-slot="body">{body}</span>}
    {actions}
  </div>
);

function DataTable({ columns, rows, onRowClick, loading, empty, rowKey }: Props) {
  if (loading === true) return <div role="status">loading</div>;
  const list = (rows ?? []) as Row[];
  if (list.length === 0) return <div data-part="table-empty">{empty}</div>;
  return (
    <table>
      <thead>
        <tr>
          {(columns as { key: string; label: string }[]).map((column) => (
            <th key={column.key}>{column.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {list.map((row) => (
          <tr key={String(row[(rowKey as string | undefined) ?? 'id'])} data-row={String(row['id'])} onClick={() => onRowClick?.(row)}>
            {(columns as { key: string; render?: (row: Row) => React.ReactNode }[]).map((column) => (
              <td key={column.key}>{column.render === undefined ? loose(row[column.key]) : column.render(row)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const RadioContext = React.createContext<{ value: string; onValueChange: (value: string) => void }>({ value: '', onValueChange: () => undefined });
const RadioGroup = ({ value, onValueChange, children, ...aria }: Props) => (
  <div role="radiogroup" {...aria}>
    <RadioContext.Provider value={{ value, onValueChange }}>{children}</RadioContext.Provider>
  </div>
);
function RadioCard({ value, title, description, disabled }: Props) {
  const group = React.useContext(RadioContext);
  return (
    <button type="button" role="radio" aria-checked={group.value === value} disabled={disabled} onClick={() => group.onValueChange(value)}>
      {title}
      {description === undefined ? null : <span>{description}</span>}
    </button>
  );
}
const Switch = ({ label, checked, onCheckedChange, disabled, id }: Props) => (
  <label>
    <input id={id} type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(event) => onCheckedChange(event.target.checked)} />
    {label}
  </label>
);
const Pagination = ({ page, pageCount, onPageChange, previousLabel, nextLabel, label }: Props) => (
  <nav aria-label={label}>
    <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
      {previousLabel}
    </button>
    <span data-slot="page">{page}</span>
    <button type="button" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
      {nextLabel}
    </button>
  </nav>
);
const Text = ({ children }: Props) => <span>{children}</span>;
const Segmented = ({ options, value, onValueChange, disabled, ...aria }: Props) => (
  <div role="radiogroup" {...aria}>
    {(options as { value: string; label: React.ReactNode }[]).map((option) => (
      <button key={option.value} type="button" role="radio" aria-checked={option.value === value} disabled={disabled} onClick={() => onValueChange(option.value)}>
        {option.label}
      </button>
    ))}
  </div>
);
const TabsContext = React.createContext<{ value: string; onValueChange: (value: string) => void }>({ value: '', onValueChange: () => undefined });
const Tabs = ({ value, onValueChange, children }: Props) => <TabsContext.Provider value={{ value, onValueChange }}>{children}</TabsContext.Provider>;
const TabsList = ({ children, ...aria }: Props) => (
  <div role="tablist" {...aria}>
    {children}
  </div>
);
function TabsTrigger({ value, disabled, children }: Props) {
  const tabs = React.useContext(TabsContext);
  return (
    <button type="button" role="tab" aria-selected={tabs.value === value} disabled={disabled} onClick={() => tabs.onValueChange(value)}>
      {children}
    </button>
  );
}
function TabsContent({ value, children }: Props) {
  const tabs = React.useContext(TabsContext);
  return tabs.value === value ? <div role="tabpanel">{children}</div> : null;
}
const Textarea = ({ error, ...rest }: Props) => {
  void error;
  return <textarea {...rest} />;
};
const Checkbox = ({ checked, onCheckedChange, ...rest }: Props) => <input type="checkbox" checked={checked === true} onChange={(event) => onCheckedChange(event.target.checked)} {...rest} />;
const Combobox = ({ options, value, onValueChange, emptyText, error, placeholder, ...rest }: Props) => {
  void emptyText;
  void error;
  return (
    <select value={value ?? ''} onChange={(event) => onValueChange(event.target.value === '' ? null : event.target.value)} {...rest}>
      <option value="">{placeholder ?? ''}</option>
      {(options as { value: string; label: string }[]).map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};
const ToggleChip = ({ pressed, onPressedChange, children, ...rest }: Props) => (
  <button type="button" aria-pressed={pressed} onClick={() => onPressedChange(!pressed)} {...rest}>
    {children}
  </button>
);
const AffixInput = ({ prefix, trailing, error, ...rest }: Props) => {
  void error;
  return (
    <span data-part="input-group">
      {prefix}
      <input {...rest} />
      {trailing}
    </span>
  );
};
const KeyValueList = ({ items }: Props) => (
  <dl>
    {(items as { label: React.ReactNode; value: React.ReactNode }[]).map((item, index) => (
      <div key={String(index)}>
        <dt>{item.label}</dt>
        <dd>{item.value}</dd>
      </div>
    ))}
  </dl>
);
const Stat = ({ label, value, hint }: Props) => (
  <div data-part="stat">
    <span data-slot="label">{label}</span>
    <span data-slot="value">{value}</span>
    {hint === undefined ? null : <span data-slot="hint">{hint}</span>}
  </div>
);
const Menu = ({ label, children }: Props) => (
  <div role="menu" aria-label={label}>
    {children}
  </div>
);

/* ── words ──────────────────────────────────────────────────────────────── */

const registered = new Map<string, string>();

/** `{name}` and `{name, plural, one {…} other {…}}` — what the screens' sentences use. */
export function format(message: string, args: Record<string, unknown> = {}): string {
  let out = '';
  for (let i = 0; i < message.length; i += 1) {
    if (message[i] !== '{') {
      out += message[i];
      continue;
    }
    let depth = 0;
    let j = i;
    for (; j < message.length; j += 1) {
      if (message[j] === '{') depth += 1;
      if (message[j] === '}' && (depth -= 1) === 0) break;
    }
    const body = message.slice(i + 1, j);
    const comma = body.indexOf(',');
    if (comma === -1) out += String(args[body.trim()] ?? `{${body}}`);
    else {
      const count = Number(args[body.slice(0, comma).trim()]);
      const branches = [...body.matchAll(/(=\d+|\w+)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g)].map((match) => [match[1], match[2]] as const);
      const pick = branches.find(([name]) => name === `=${String(count)}`) ?? (count === 1 ? branches.find(([name]) => name === 'one') : undefined) ?? branches.find(([name]) => name === 'other');
      out += format((pick?.[1] ?? '').replaceAll('#', String(count)), args);
    }
    i = j;
  }
  return out;
}

const app = {
  ApiError: Refused,
  PageActions: ({ title, subtitle, children }: Props) => (
    <div data-part="page-actions">
      {title === undefined ? null : <h1>{title}</h1>}
      {subtitle === undefined ? null : <p>{subtitle}</p>}
      {children}
    </div>
  ),
  PageSurface: ({ children, testId }: Props) => <div data-testid={testId ?? 'page-surface'}>{children}</div>,
  api: Object.fromEntries(
    ['get', 'post', 'put', 'patch', 'delete'].map((method) => [
      method,
      async (path: string, payload?: unknown) => {
        world.calls.push({ kind: 'api', table: `${method} ${path}`, values: payload });
        return world.api === null ? {} : world.api(method, path, payload);
      },
    ]),
  ) as Record<string, (path: string, payload?: unknown) => Promise<unknown>>,
  formatSince: () => null,
  lucideByName: (name: string) => () => <span aria-hidden="true" data-icon={name} />,
  registerMessages: (addOnKey: string, bundles: Record<string, Record<string, string>>) => {
    for (const [tag, flat] of Object.entries(bundles)) for (const [key, words] of Object.entries(flat)) registered.set(`${tag}|${addOnKey}|${key}`, words);
    return (key: string, fallback: string, args?: Record<string, unknown>) => format(registered.get(`${world.locale}|${addOnKey}|${key}`) ?? fallback, args);
  },
  t: (_key: string, fallback: string, args?: Record<string, unknown>) => format(fallback, args),
  useLocaleTag: () => world.locale,
  useAppToasts: () => ({
    push: (toast: { variant?: string; title: unknown }) => {
      world.toasts.push(toast);
      return String(world.toasts.length);
    },
    dismiss: () => undefined,
  }),
  useShortcut: () => undefined,
};
/** The stand-in `api`, for a test to answer a route with. */
export const api = app.api;

installAddOnRuntime({
  react: React as unknown as Readonly<Record<string, unknown>>,
  jsx: { jsx, jsxs, Fragment },
  reactDom: ReactDOM as unknown as Readonly<Record<string, unknown>>,
  host: {
    version: HOST_API_VERSION,
    ui: {
      Alert,
      AutosaveIndicator: ({ status, savingLabel, savedLabel, errorLabel }: Props) => <span data-part="autosave">{status === 'saving' ? savingLabel : status === 'saved' ? savedLabel : status === 'error' ? errorLabel : ''}</span>,
      Badge: Text,
      Button,
      EmptyState,
      IconButton,
      Modal: (props: Props) => <Opened {...props} part="modal" />,
      ModalBody: box('modal-body'),
      ModalFooter: box('modal-footer'),
      ModalHeader: Head,
      Popover: box('popover'),
      PopoverContent: box('popover-content'),
      PopoverTrigger: box('popover-trigger'),
      SearchInput,
      SegmentedControl: Segmented,
      Spinner: ({ label }: Props) => <span role="status">{label}</span>,
      Tabs,
      TabsContent,
      TabsList,
      TabsTrigger,
      Tag: ({ children }: Props) => <span data-part="tag">{children}</span>,
      cn: (...parts: unknown[]) => parts.filter((part) => typeof part === 'string').join(' '),
    },
    router: {
      useBlocker: () => undefined,
      useNavigate: () => (to: { to: string; search?: Record<string, unknown>; replace?: boolean }) => {
        world.navigated.push(to);
      },
      useParams: () => ({ _splat: world.splat }),
      useSearch: () => world.search,
    },
    query: {},
    i18n: {},
    app,
    data: {
      version: 1,
      Card: box('card'),
      Grid: box('grid'),
      Stack: box('stack'),
      Sheet: (props: Props) => <Opened {...props} part="sheet" />,
      SheetHeader: Head,
      SheetBody: box('sheet-body'),
      SheetFooter: box('sheet-footer'),
      StickyBar: box('sticky-bar'),
      Divider: () => <hr />,
      Skeleton: () => <span data-part="skeleton" />,
      DataTable,
      Stat,
      KeyValueList,
      StatusPill: ({ status, children }: Props) => <span data-part="status" data-status={status}>{children ?? status}</span>,
      ProgressBar: ({ value, max, label }: Props) => <div role="progressbar" aria-valuenow={value} aria-valuemax={max} aria-label={label} />,
      Pagination,
      MonoText: Text,
      Field,
      Input,
      NumberInput,
      Textarea,
      DateInput: ({ error, ...rest }: Props) => {
        void error;
        return <input type="date" {...rest} />;
      },
      Select,
      Combobox,
      Switch,
      Checkbox,
      RadioGroup,
      RadioCard,
      ToggleChip,
      InputGroup: AffixInput,
      Menu,
      MenuItem: ({ onSelect, children }: Props) => <button type="button" onClick={() => onSelect()}>{children}</button>,
      ConfirmModal: box('confirm'),
      Link: ({ to, children }: Props) => <a href={to}>{children}</a>,
      useRecords,
      useRecord,
      // A new object every draw, as a host may hand one: a screen that keyed an effect on it would never settle.
      useRead: () => ({ ...reads }),
      useWrite: writes,
      useTreeWrite: treeWrites,
      useStateMove,
      useAccess,
      useLookUp: () => ({
        find: async (typed: string) => {
          world.calls.push({ kind: 'look-up', table: 'offers', values: typed });
          return world.lookUp === null ? null : world.lookUp(typed);
        },
        finding: false,
        error: null,
      }),
      useWords: () => ({ ask: async () => [] }),
      useDocument: () => ({
        open: async (kind: string, table: string, key: string | number, options?: unknown) => {
          world.calls.push({ kind: 'document', table, key: String(key), values: kind, options });
          world.before?.('document', table, { kind, key: String(key), options });
        },
        opening: false,
        error: null,
      }),
      useExport: () => ({
        start: async (table: string, options: unknown) => {
          world.calls.push({ kind: 'export', table, options });
          return 'export-1';
        },
        download: async (id: string) => {
          world.calls.push({ kind: 'download', table: '', key: id });
        },
        running: false,
        error: null,
      }),
    },
  } as never,
});
