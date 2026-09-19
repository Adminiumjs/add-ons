// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Where this page lives inside the host, and the only place that knows it.
 *
 * In the engine the surface owned two routes — `/invoices` and
 * `/invoices/$id` — and navigated to them by name. It does not own routes any
 * more: the host gives an add-on ONE splat route and reads the rest of the path
 * itself, so a `navigate({ to: '/invoices/$id' })` left in the moved code sent
 * the browser to an address the dashboard does not have. Its own tests caught
 * that, which is the argument for having brought them across.
 *
 * `documents` is this page's `ref` in the manifest; the host mounts it at
 * `/add-ons/<key>/<ref>`.
 */
const BASE = '/add-ons/invoices/documents';

/** The manager — optionally on a given tab. */
export function managerPath(kind?: 'template' | 'invoice'): string {
  return kind === undefined ? BASE : `${BASE}?kind=${kind}`;
}

/** One document's editor. */
export function documentPath(id: string): string {
  return `${BASE}/${id}`;
}
