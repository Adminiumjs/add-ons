/**
 * The slots this add-on fills, checked against the host's closed registry.
 * Checkout is absent because live carrier rates stay staff-only (Q9), and the
 * settings panel because Shippo's key has its own engine page (D9).
 */

import type { SlotId } from "@adminium/add-on-host";

export const FILLED_SLOTS = ["order.dispatch.panel", "order.dispatch.actions"] as const satisfies readonly SlotId[];

export type FilledSlot = (typeof FILLED_SLOTS)[number];
