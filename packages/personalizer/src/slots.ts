/**
 * The slots THIS add-on fills, checked against the host's closed registry.
 *
 * `satisfies readonly SlotId[]` against the ONE shared mirror in
 * `packages/host` is the real check, and it bites in both directions: a typo
 * here is a compile error, and a slot the registry drops disappears from
 * `SlotId` and turns this line red. `manifest.test.ts` closes the loop at the
 * other end.
 *
 * TWO LISTS, AND THE DIFFERENCE IS THE PHASE B SPLIT (§5.10, D20).
 * `FILLED_SLOTS` is what `register()` actually renders — six. `DECLARED_SLOTS`
 * is what `manifest.json` attaches to — seven, the extra being
 * `record.editor.panel`, whose host is Adminium's generated dashboard rather
 * than an example app. Comp L designs those screens and this document specifies
 * them, but the runtime that would mount them does not exist yet, so the
 * manifest declares the attachment and the bundle ships no fill. Shipping one
 * anyway is the exact defect §5.4 records against `nav.add-on.routes`: an
 * add-on author reads the list and writes code against it.
 */

import type { SlotId } from '@adminium/add-on-host';

export const FILLED_SLOTS = [
  'product.options.personalize',
  'cart.line.preview',
  'product.admin.panel',
  'order.line.actions',
  'nav.add-on.routes',
  'settings.add-on.panel',
] as const satisfies readonly SlotId[];

export type FilledSlot = (typeof FILLED_SLOTS)[number];

/** The seventh, declared and deliberately unmounted. */
export const PHASE_B_SLOTS = ['record.editor.panel'] as const satisfies readonly SlotId[];

export const DECLARED_SLOTS = [...FILLED_SLOTS, ...PHASE_B_SLOTS] as const;
