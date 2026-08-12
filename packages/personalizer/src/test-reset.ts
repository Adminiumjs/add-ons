/**
 * EVERYTHING THIS ADD-ON REMEMBERS BETWEEN RENDERS, DROPPED.
 *
 * ── WHY THIS IS THE ADD-ON'S FILE AND NOT THE HOST'S ────────────────────────
 *
 * A host that tours its own app has to put the shop back the way it found it
 * between passes, or the second pass is standing somewhere the first one left
 * it. It can do that for its OWN store, and it cannot do it for ours: what this
 * package remembers between renders is the pictures it has drawn, the
 * personalizations it has filed and a half-open panel's resolver — module state
 * behind three different seams, none of which a host knows the names of.
 *
 * The failure this closes was measured in the delivery add-on next door and is
 * general: `maker-shop` tours its whole app once per locale in one process, and
 * an add-on's leftover state made three surfaces disappear from every tour
 * after the first. Eight locales went green having checked one. Nothing in this
 * package had to be wrong for that to happen — it is enough that a host cannot
 * reach what an add-on remembers.
 *
 * So the reset travels with the add-on, like `COMPANY_MARKS`, `INERT_ORIGINS`
 * and `NEVER_IN_A_BROWSER` before it. A host globs whatever it has vendored and
 * calls this; it never learns what is inside.
 *
 * ── AND WHY IT IS NOT EXPORTED FROM `index.ts` ──────────────────────────────
 *
 * `index.ts` is the CLIENT entry point, and anything reachable from it ends up
 * in a browser. This is a test seam. It is vendored — a host's harness has to be
 * able to import it — and it is reachable from nothing a shopper loads.
 */

import { resetFiles, settleOpen } from './personalizer.ts';
import { forgetAll } from './store.ts';

/**
 * Drop the drawn files, the filed personalizations and any half-open panel.
 *
 * `settleOpen(null)` is the one that is easy to miss. `open` hands the surface a
 * resolver and keeps it in module state until the shopper accepts or cancels;
 * a tour that unmounts the panel mid-flow never does either, so the resolver
 * outlives the render and the NEXT open finds one already pending. Settling it
 * with `null` is exactly what a cancel does, which is the truthful reading of a
 * panel that went away.
 */
export function resetAll(): void {
  settleOpen(null);
  resetFiles();
  forgetAll();
}
