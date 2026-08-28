/**
 * The slots THIS add-on fills, checked against the host's closed registry.
 *
 * `satisfies readonly SlotId[]` bites in both directions. A typo here is a
 * compile error, and a slot the registry DROPS disappears from `SlotId` and
 * turns this line red rather than leaving a fill that silently never renders —
 * which is not hypothetical: a sibling add-on in this repository kept a fill for
 * `nav.add-on.routes` through a whole release with nothing mounting it, because
 * it had narrowed against a private union of its own.
 *
 * ── THE SECOND ID IS THE POINT OF THIS PACKAGE ─────────────────────────────
 *
 * `record.actions` was bought on 2026-08-28 against a seven-exhibit dossier and
 * shipped with no fill anywhere — the registry's own entry says so, and so does
 * `payloads.ts`. This is the first. A sheet of labels for ONE catalogue row,
 * started from the screen where somebody is already looking at that row, is
 * the sentence the slot was bought for.
 *
 * `manifest.test.ts` closes the loop at the other end, asserting that what
 * `register()` fills and what the manifest declares are both exactly this list.
 */

import type { SlotId } from '@adminium/add-on-host';

export const FILLED_SLOTS = [
  'settings.add-on.panel',
  'record.actions',
] as const satisfies readonly SlotId[];

export type FilledSlot = (typeof FILLED_SLOTS)[number];
