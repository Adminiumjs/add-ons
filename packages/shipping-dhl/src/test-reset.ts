/**
 * EVERYTHING THIS ADD-ON REMEMBERS BETWEEN RENDERS, DROPPED.
 *
 * ── WHY THIS IS THE ADD-ON'S FILE AND NOT THE HOST'S ────────────────────────
 *
 * A host that tours its own app has to put the shop back the way it found it
 * between passes, or the second pass is standing somewhere the first one left
 * it. It can do that for its OWN store, and it cannot do it for ours: what this
 * package remembers between renders is a memoized demo carrier, the shipments
 * booked into it, the settings a panel last applied — module state behind three
 * different seams, none of which a host knows the names of.
 *
 * The host used to not do it at all, and it failed exactly the way this wave's
 * other host-local lists failed — SILENTLY, and in the direction that looks
 * fine. `maker-shop`'s affiliation gate tours the whole app once per locale, in
 * one process. The first tour booked a collection through the demo carrier; the
 * carrier is memoized and only rebuilt when the clock CHANGES, and the clock is
 * pinned, so it was never rebuilt. From the second locale onward the order was
 * already booked, "Get rates" and "Book the collection" were no longer on the
 * page, and the three surfaces where this add-on names a carrier were toured in
 * ENGLISH ONLY. Eight locales went green having checked one.
 *
 * So the reset travels with the add-on, like `COMPANY_MARKS`, `INERT_ORIGINS`
 * and `NEVER_IN_A_BROWSER` before it. A host globs whatever it has vendored and
 * calls this; it never learns what is inside.
 *
 * ── AND WHY IT IS NOT EXPORTED FROM `index.ts` ──────────────────────────────
 *
 * `index.ts` is the CLIENT entry point, and its own comment is the rule:
 * anything reachable from it ends up in a browser. This is a test seam. It is
 * vendored — a host's harness has to be able to import it — and it is reachable
 * from nothing a shopper loads.
 */

import { resetRuntime } from "./runtime.ts";
import { applySettings, DEFAULT_SETTINGS } from "./settings.ts";

/**
 * Drop the memoized transport, the connected-mode injection and the settings a
 * panel applied.
 *
 * The settings matter as much as the carrier and are the easier half to forget:
 * a tour that presses "use the demo carrier" has changed `collection_cutoff`
 * and `demo_transport` for every render after it, and a cutoff is what decides
 * whether the van calls today — so the dates on every later screen would be
 * this suite's doing rather than the shop's.
 */
export function resetAll(): void {
  resetRuntime();
  applySettings({ ...DEFAULT_SETTINGS });
}
