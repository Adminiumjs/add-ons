// SPDX-License-Identifier: AGPL-3.0-only
/**
 * The page's message readiness, kept under its old name so the two route
 * components that await it did not have to change.
 *
 * What changed underneath: this used to wait on the ENGINE loading a deferred
 * `invoices` namespace. The strings ship in this package now, so it waits on
 * the reader's own locale chunk instead (`messages.ts`).
 */
import { pageMessagesReady } from './messages.js';

export function invoicesMessagesReady(): Promise<void> {
  return pageMessagesReady();
}
