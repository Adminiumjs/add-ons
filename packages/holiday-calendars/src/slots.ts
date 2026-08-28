/**
 * The slot THIS add-on fills, checked against the host's closed registry.
 *
 * One id, and a one-element list still earns the `satisfies` — it bites in both
 * directions. A typo here is a compile error, and a slot the host STOPS hosting
 * disappears from `SlotId` and turns this line red rather than leaving a fill
 * that silently never renders. A sibling add-on in this repository kept a fill
 * for `nav.add-on.routes` through a whole release with nothing mounting it,
 * because it had narrowed against a private union of its own.
 *
 * `manifest.test.ts` closes the loop at the other end, asserting that what
 * `register()` fills and what the manifest declares are both exactly this list.
 */

import type { SlotId } from "@adminium/add-on-host";

export const FILLED_SLOTS = ["settings.add-on.panel"] as const satisfies readonly SlotId[];

export type FilledSlot = (typeof FILLED_SLOTS)[number];
