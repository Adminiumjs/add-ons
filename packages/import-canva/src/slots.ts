/**
 * The slots THIS add-on fills, checked against the host's closed registry.
 *
 * This package used to get the same narrowing by re-declaring `SlotId` itself,
 * privately, as "the ids I fill" — and that gave exactly the opposite of the
 * guarantee it claimed. A private union goes on naming a slot after the host
 * stops hosting it, which is how a sibling add-on kept a fill for
 * `nav.add-on.routes` through a release with nothing ever mounting it.
 *
 * `satisfies readonly SlotId[]` against the ONE shared mirror is the real
 * check, and it bites in both directions: a typo here is a compile error, and a
 * slot the host drops disappears from `SlotId` and turns this line red.
 * `manifest.test.ts` closes the loop at the other end, asserting that what
 * `register()` fills and what the manifest declares are both exactly this list.
 */

import type { SlotId } from "@adminium/add-on-host";

export const FILLED_SLOTS = [
  "artwork.sources",
  "settings.add-on.panel",
] as const satisfies readonly SlotId[];

export type FilledSlot = (typeof FILLED_SLOTS)[number];
