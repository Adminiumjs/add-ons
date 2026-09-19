// SPDX-License-Identifier: AGPL-3.0-only
/**
 * The page this add-on contributes to the dashboard rail, and the module the
 * manifest points `pages[].client` at.
 *
 * ONE ROUTE, TWO SCREENS. The host gives an add-on a single splat route, so the
 * manager and the editor are chosen here from the path the host is on rather
 * than by a router this package does not own: `documents` is the list,
 * `documents/<id>` is one document. That keeps the editor's own URL shareable,
 * which is the whole reason the manifest declares `detail: true`.
 *
 * The strings are awaited before anything renders — see `messages.ts`.
 */
import { use } from 'react';
import { useParams } from '@tanstack/react-router';

import { InvoiceEditorPage } from './InvoiceEditorPage.js';
import { InvoicesPage } from './InvoicesPage.js';
import { pageMessagesReady } from './messages.js';

export default function InvoicesAddOnPage() {
  use(pageMessagesReady());
  const { _splat } = useParams({ strict: false }) as { _splat?: string };
  const segments = (_splat ?? '').split('/').filter(Boolean);
  // `documents` | `documents/<id>`
  const id = segments.length > 1 ? segments[1] : undefined;
  return id === undefined ? <InvoicesPage /> : <InvoiceEditorPage id={id} />;
}
