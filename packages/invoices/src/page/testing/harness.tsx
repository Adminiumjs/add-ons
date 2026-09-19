// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Mounting the page the way the HOST mounts it.
 *
 * In the engine these suites built the whole dashboard router and navigated to
 * `/invoices`. There is no dashboard here, and the page does not own a router
 * anyway — the host gives it one splat route and the page reads the path. So
 * the harness builds that one route and nothing else, which is both smaller and
 * closer to what actually happens in production.
 */
import type React from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  type AnyRouter,
} from '@tanstack/react-router';
import { useSyncExternalStore } from 'react';
import { render } from '@testing-library/react';

import { currentToasts, subscribeToasts } from './host.js';

/**
 * The shell's toast stack, as much of it as a test can observe: the title, the
 * description and the action button. The page raises toasts and asserts on
 * them — "Template duplicated", then a click on Undo — so they have to be on
 * screen, not only in an array.
 */
function Toasts() {
  const items = useSyncExternalStore(subscribeToasts, currentToasts, currentToasts);
  return (
    <div data-testid="toasts">
      {items.map((toast) => (
        <div key={toast.id} role="status">
          <span>{toast.title as React.ReactNode}</span>
          {toast.description === undefined ? null : <span>{toast.description as React.ReactNode}</span>}
          {toast.action === undefined ? null : (
            <button type="button" onClick={toast.action.onAction}>
              {toast.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * A client with retries off and no cache between tests.
 *
 * Retries turn one stubbed failure into three and a test that asserts an error
 * state waits for all of them; the engine's own test client does the same.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

/** `{ data }` or an error envelope, the shape `api` unwraps. */
export function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  } as unknown as Response;
}

export interface MountResult {
  queryClient: QueryClient;
  view: ReturnType<typeof render>;
  /**
   * The router, so a test can assert where a click navigated to.
   *
   * `AnyRouter` rather than the inferred type: the concrete one carries the
   * whole route tree in its generics, and a caller that only reads
   * `state.location.pathname` should not have to name it.
   */
  router: AnyRouter;
}

/**
 * Render `element` under the host's route shape: `/add-ons/invoices/$`.
 *
 * `path` is what the host's URL would be, so a test can mount the manager
 * (`documents`) or one document (`documents/inv_1`) exactly as a click would.
 */
export function mountPage(element: ReactNode, path = '/add-ons/invoices/documents'): MountResult {
  const queryClient = createTestQueryClient();
  const rootRoute = createRootRoute();
  const pageRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/add-ons/invoices/$',
    component: () => <>{element}</>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([pageRoute]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toasts />
    </QueryClientProvider>,
  );
  return { queryClient, view, router };
}
