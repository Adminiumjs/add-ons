// SPDX-License-Identifier: AGPL-3.0-only
/**
 * A HOST, for the page's own tests.
 *
 * The page renders inside Adminium: its imports of `@adminium/ui`, the router,
 * the query client and the dashboard's own helpers are aliased at build time to
 * shims that read a global the host publishes. A test has no Adminium, so it
 * publishes that global itself — with the REAL libraries, which this package
 * already has, and with stand-ins for the handful of things only a running
 * dashboard can provide.
 *
 * ─── Why this is a setup file and not a helper ──────────────────────────────
 *
 * The shims read the global as their module initialises. A test that imported
 * a page module first and installed the runtime second would get the refusal
 * `requireAddOnHost` throws, which is the contract working exactly as intended
 * and a confusing way to learn it. Vitest runs `setupFiles` before it imports
 * a test file, so installing here makes the ordering impossible to get wrong.
 *
 * ─── What is real and what is a stand-in ────────────────────────────────────
 *
 * REAL: React, the JSX runtime, `@adminium/ui`, `@tanstack/react-router` and
 * `@tanstack/react-query`. A stand-in for any of those would test a different
 * component than the one that ships.
 *
 * STAND-IN: the `app` namespace — the dashboard's `t`, its API client, its
 * toasts, its page chrome. These exist only inside a running dashboard, and
 * each one here does the smallest honest thing: the translator resolves
 * registered strings, the API client goes through `fetch` so a test can stub
 * it exactly as it did in the engine, and the chrome renders its children.
 */
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import { Link, useBlocker, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import {
  QueryClient,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Alert,
  AutosaveIndicator,
  Badge,
  Button,
  EmptyState,
  IconButton,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SearchInput,
  SegmentedControl,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tag,
  cn,
} from '@adminium/ui';
import { tagForLocale } from '@adminium/i18n';
import { HOST_API_VERSION, installAddOnRuntime } from '@adminium/add-on-contracts/runtime';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/*
 * Unmount between tests. Without it the second render of a suite finds two of
 * everything — "Found multiple elements by [data-testid=…]" — and the failure
 * names the query rather than the missing cleanup.
 */
afterEach(() => {
  cleanup();
  lastToasts.length = 0;
  emitToasts([]);
});


/**
 * `{arg}`, `{arg, number}` and `{arg, plural, one {#…} other {#…}}` — the same
 * subset the engine's own test stand-in formats.
 *
 * Without it every counted string renders as its raw ICU source, and three
 * assertions about grouping failed with diffs that pointed at the grouping.
 */
function formatIcuLite(message: string, args: Record<string, unknown>): string {
  let out = '';
  let i = 0;
  while (i < message.length) {
    if (message[i] !== '{') {
      out += message[i];
      i += 1;
      continue;
    }
    let depth = 0;
    let j = i;
    for (; j < message.length; j += 1) {
      if (message[j] === '{') depth += 1;
      if (message[j] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    out += formatPlaceable(message.slice(i + 1, j), args);
    i = j + 1;
  }
  return out;
}

function formatPlaceable(body: string, args: Record<string, unknown>): string {
  const comma = body.indexOf(',');
  if (comma === -1) return String(args[body.trim()] ?? `{${body}}`);
  const name = body.slice(0, comma).trim();
  const rest = body.slice(comma + 1).trim();
  const value = args[name];
  if (rest === 'number') {
    return typeof value === 'number' ? new Intl.NumberFormat('en-US').format(value) : String(value);
  }
  if (rest.startsWith('plural,')) {
    const branches: Record<string, string> = {};
    const branchRe = /(\w+|=\d+)\s*\{/g;
    const spec = rest.slice('plural,'.length);
    let match: RegExpExecArray | null;
    while ((match = branchRe.exec(spec)) !== null) {
      const start = branchRe.lastIndex;
      let depth = 1;
      let k = start;
      for (; k < spec.length && depth > 0; k += 1) {
        if (spec[k] === '{') depth += 1;
        if (spec[k] === '}') depth -= 1;
      }
      branches[match[1] ?? ''] = spec.slice(start, k - 1);
      branchRe.lastIndex = k;
    }
    const n = typeof value === 'number' ? value : Number(value);
    const branch =
      branches[`=${n}`] ?? (n === 1 ? (branches['one'] ?? branches['other']) : branches['other']) ?? '';
    return formatIcuLite(branch, args).replaceAll('#', new Intl.NumberFormat('en-US').format(n));
  }
  return String(value ?? `{${body}}`);
}

/** Every string any add-on has registered, keyed `<namespace>:<key>`. */
const registered = new Map<string, string>();

/** The one error shape `api` rejects with; the page reads it by `instanceof`. */
class TestApiError extends Error {
  override readonly name = 'ApiError';
  readonly status: number;
  readonly code: string;
  readonly requestId: string | null;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, requestId: string | null, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
  }
}

/**
 * `fetch`, then the same envelope the dashboard's own client unwraps — so a
 * test stubs `fetch` and gets the behaviour the page sees in production,
 * including the error type it catches.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const envelope = (body ?? {}) as { error?: { code?: string; message?: string; requestId?: string } };
    throw new TestApiError(
      response.status,
      envelope.error?.code ?? 'INTERNAL',
      envelope.error?.message ?? `Request failed with status ${response.status}.`,
      envelope.error?.requestId ?? null,
    );
  }
  return body as T;
}

export interface TestToast {
  id: string;
  variant?: string | undefined;
  title: unknown;
  description?: unknown;
  action?: { label: string; onAction: () => void } | undefined;
}

/**
 * A real queue, because the page's toasts are ASSERTED ON SCREEN.
 *
 * The first stand-in only recorded pushes, and the suite's toast tests failed
 * looking for text nobody rendered — including the one that clicks Undo, which
 * is the whole behaviour worth testing. The shell renders toasts, so the
 * harness renders them (`<Toasts />` in `harness.tsx`).
 */
const toastListeners = new Set<() => void>();
let toasts: TestToast[] = [];

export function subscribeToasts(listener: () => void): () => void {
  toastListeners.add(listener);
  return () => toastListeners.delete(listener);
}

export function currentToasts(): TestToast[] {
  return toasts;
}

function emitToasts(next: TestToast[]): void {
  toasts = next;
  for (const listener of toastListeners) listener();
}

/** Every toast pushed since the last test, for assertions that prefer data. */
export const lastToasts: TestToast[] = [];

const api = {
  get: <T,>(path: string) => request<T>(path),
  post: <T,>(path: string, payload?: unknown) =>
    request<T>(path, { method: 'POST', ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) }),
  put: <T,>(path: string, payload: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(payload) }),
  patch: <T,>(path: string, payload: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(payload) }),
  delete: <T,>(path: string, payload?: unknown) =>
    request<T>(path, { method: 'DELETE', ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) }),
};

/**
 * The shell's topbar, as much of it as the page can observe.
 *
 * The page does not render its own `<h1>`: it PUBLISHES a title and the shell
 * draws it. A stand-in that swallowed the title would make every assertion
 * about the heading fail for a reason that has nothing to do with the page, so
 * this renders the same three things the shell does — heading, subtitle, and
 * the actions themselves.
 */
function PageActions({
  title,
  subtitle,
  backTo,
  children,
}: {
  title?: string;
  subtitle?: string;
  backTo?: string;
  children?: React.ReactNode;
}) {
  return (
    <div data-testid="page-actions">
      {/* The shell draws the back link, and the editor's discard guard hangs
          off a click on it — so a stand-in without it cannot test the guard. */}
      {/* A ROUTER link, not an anchor: the editor guards unsaved changes with
          `useBlocker`, which only sees navigation the router performs. With a
          plain `<a>` the click left the page and the guard never opened. */}
      {backTo === undefined ? null : <Link to={backTo}>Back</Link>}
      {title === undefined ? null : <h1>{title}</h1>}
      {subtitle === undefined ? null : <p data-testid="page-subtitle">{subtitle}</p>}
      {children}
    </div>
  );
}

function PageSurface({ children }: { children: React.ReactNode }) {
  return <div data-testid="page-surface">{children}</div>;
}

const NeutralIcon = ({ className }: { className?: string }) => (
  <span aria-hidden="true" className={className} />
);

installAddOnRuntime({
  react: React as unknown as Readonly<Record<string, unknown>>,
  jsx: { jsx, jsxs, Fragment },
  reactDom: ReactDOM as unknown as Readonly<Record<string, unknown>>,
  host: {
    version: HOST_API_VERSION,
    ui: {
      Alert, AutosaveIndicator, Badge, Button, EmptyState, IconButton, Modal, ModalBody,
      ModalFooter, ModalHeader, Popover, PopoverContent, PopoverTrigger, SearchInput,
      SegmentedControl, Spinner, Tabs, TabsContent, TabsList, TabsTrigger, Tag, cn,
    },
    router: { useBlocker, useNavigate, useParams, useSearch },
    query: { QueryClient, queryOptions, useMutation, useQuery, useQueryClient },
    i18n: { tagForLocale },
    app: {
      ApiError: TestApiError,
      PageActions,
      PageSurface,
      api,
      /*
       * The host's own ladder, unit by unit — not a minutes-only shortcut.
       *
       * The first version formatted everything as minutes, so a row edited two
       * days ago read "-2,880 minutes ago" and three assertions failed with
       * diffs that looked like grouping bugs. A stand-in that is subtly wrong
       * costs more than one that is obviously missing.
       */
      formatSince: (epochMs: number | null, localeTag: string, now: number) => {
        if (epochMs === null || !Number.isFinite(epochMs)) return null;
        const delta = epochMs - now;
        const units: [Intl.RelativeTimeFormatUnit, number][] = [
          ['year', 31_536_000_000],
          ['month', 2_592_000_000],
          ['week', 604_800_000],
          ['day', 86_400_000],
          ['hour', 3_600_000],
          ['minute', 60_000],
        ];
        const relative = new Intl.RelativeTimeFormat(localeTag);
        for (const [unit, ms] of units) {
          if (Math.abs(delta) >= ms) return relative.format(Math.round(delta / ms), unit);
        }
        return relative.format(Math.round(delta / 1000), 'second');
      },
      lucideByName: () => NeutralIcon,
      registerMessages: (addOnKey: string, bundles: Record<string, Record<string, string>>) => {
        const namespace = `addon.${addOnKey}`;
        for (const [tag, flat] of Object.entries(bundles)) {
          if (tag !== 'en-US') continue; // the suite reads English
          for (const [key, value] of Object.entries(flat)) {
            registered.set(`${namespace}:${key}`, value);
          }
        }
        return (key: string, fallback: string, args?: Record<string, unknown>) =>
          formatIcuLite(registered.get(`${namespace}:${key}`) ?? fallback, args ?? {});
      },
      t: (_key: string, fallback: string, args?: Record<string, unknown>) =>
        formatIcuLite(fallback, args ?? {}),
      useAppToasts: () => ({
        push: (toast: Omit<TestToast, 'id'>) => {
          const id = `toast_${String(toasts.length + 1)}`;
          const entry = { ...toast, id };
          lastToasts.push(entry);
          emitToasts([entry, ...toasts]);
          return id;
        },
        dismiss: (id?: string) => {
          emitToasts(id === undefined ? [] : toasts.filter((toast) => toast.id !== id));
        },
      }),
      useLocaleTag: () => 'en-US',
      /*
       * A REAL key listener, not a no-op.
       *
       * The page registers `Ctrl/⌘+S` and its test presses it. A stand-in that
       * accepted the registration and did nothing made that test fail with
       * "expected [] to have a length of 1" — a save that never happened,
       * reported as a missing request.
       */
      useShortcut: (def: { keys: readonly string[]; handler?: (event: KeyboardEvent) => void }) => {
        React.useEffect(() => {
          const handler = def.handler;
          if (handler === undefined) return;
          const letter = [...def.keys].reverse().find((key) => /^[A-Za-z]$/.test(key));
          if (letter === undefined) return;
          const onKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === letter.toLowerCase()) {
              event.preventDefault();
              handler(event);
            }
          };
          window.addEventListener('keydown', onKeyDown);
          return () => {
            window.removeEventListener('keydown', onKeyDown);
          };
        }, [def.handler]);
      },
    },
  },
});
