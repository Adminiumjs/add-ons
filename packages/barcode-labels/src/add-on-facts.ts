/**
 * THE FACTS A HOST'S OWN GATES NEED FROM THIS ADD-ON.
 *
 * ── WHY THESE LIVE HERE AND NOT IN THE APPS THAT RECEIVE THEM ───────────────
 *
 * A host app runs release gates over the code it ships, and some of those gates
 * need to know things that are true of an ADD-ON: which addresses it names and
 * cannot call, which of its strings must never reach a browser, which words in
 * it belong to somebody as a mark. All three used to be written out inside each
 * host — so one shop's D11 list carried another add-on's endpoints, and BOTH
 * hosts' bundle gates carried the delivery add-on's secret setting keys.
 *
 * That is AC20/D21 broken: making a portable add-on pass required editing an
 * exemption list inside the app receiving it. So the facts travel with the
 * add-on, and each host discovers whatever it has VENDORED with
 * `import.meta.glob`. Vendor this add-on and its facts arrive; drop it and they
 * leave; nothing in either host changes either way.
 *
 * ── AND THEY ARE CHECKED AGAINST THE MANIFEST, NOT TRUSTED ──────────────────
 *
 * `manifest.test.ts` asserts these cover every `secret: true` setting key and
 * every `network.allow` hostname the manifest declares. For this add-on both of
 * those lists are empty, which is why the suite here has to do more than tick
 * them off — see below.
 */

/**
 * ADDRESSES THIS ADD-ON NAMES, AND WHY NONE CAN CAUSE A REQUEST.
 *
 * Empty, and it is the strictest state there is: a host's D11 net reports every
 * absolute URL in what it ships whose origin nobody has declared inert, so with
 * nothing declared here EVERY address is a finding. This add-on has no
 * `network` block, no `outbound-http` capability and nobody to reach — naming
 * an address would mean coming here and writing down why it stays a string.
 *
 * IT IS THE ONE PLACE SOMEBODY MIGHT REASONABLY EXPECT ONE, which is worth
 * saying. An article number is issued by a numbering authority, that authority
 * has a register, and an add-on that looked a number up in it would be the
 * obvious next feature. It would also be a different add-on: this one draws a
 * number the shop already owns, and the whole of its claim is that it does so
 * with nothing but the bundle the host has already loaded.
 */
export const INERT_ORIGINS: readonly { origin: string; why: string }[] = [];

/**
 * STRINGS THAT MUST NEVER APPEAR IN A CLIENT BUNDLE (24 D15, D11).
 *
 * Empty, and unlike the two lists around it that needs no argument beyond the
 * manifest: this add-on declares `connect: { kind: "none" }` and carries no
 * setting marked `secret`. There is no credential, so there is no key a
 * credential could be saved under, so there is nothing for a host's bundle grep
 * to hunt for. `manifest.test.ts` asserts the manifest agrees — that no setting
 * it declares is secret — so this emptiness cannot quietly outlive the fact
 * that produced it.
 */
export const NEVER_IN_A_BROWSER: readonly { text: string; why: string }[] = [];

/**
 * COMPANY MARKS THIS ADD-ON'S OWN SCREENS MAY PRINT (24 AC6) — THERE ARE NONE.
 *
 * ── AN EMPTY GATE PROVES NOTHING, SO THIS ONE IS ESTABLISHED ELSEWHERE ─────
 *
 * An empty list is exactly the shape a BROKEN one takes: a glob that stopped
 * matching, a file somebody forgot to fill in, and a correct declaration all
 * export `[]`, and a host reading it cannot tell them apart. A green gate over
 * an empty needle list is a green gate about nothing. `holiday-calendars` was
 * the first package here to face that and its answer is the one copied below,
 * because the answer is about the SHAPE of the claim rather than about days.
 *
 * So `sources.test.ts` does not merely assert the emptiness. It asserts that
 * the emptiness is DELIBERATE, by checking the statements that would all have
 * to be wrong together for it to be an accident:
 *
 *   · `register()` reports `namesCompany: false` and supplies `noCompanyKeys`,
 *     so the host renders the positive statement where a not-affiliated line
 *     would go rather than rendering nothing (which is indistinguishable from
 *     having forgotten it);
 *   · the shipped sources and the eight locale bundles contain none of the
 *     marks any SIBLING add-on in this repository declares, which is a real
 *     needle list rather than an empty one;
 *   · `TRADEMARKS.md`'s row for this package says `*(none)*`, which
 *     `packages/host`'s own suite cross-checks against this very export.
 *
 * ── AND THERE IS A SECOND THING TO SAY HERE, WHICH IS THIS PACKAGE'S OWN ───
 *
 * A barcode is where a reader most expects a company to turn up, and this
 * add-on had three chances to name one and takes none of them:
 *
 *   THE SYMBOLOGIES ARE STANDARDS. `EAN-13` and `Code 128` are the names of
 *   published symbologies, the way `PDF` and `ISO 3166` are names of published
 *   things. They belong to standards bodies, not to a supplier, and this add-on
 *   uses them to say what it draws.
 *
 *   THE NUMBERS ARE THE SHOP'S. Nothing here allocates or registers a number.
 *   The shop types one it already owns, and the only opinion this package has
 *   about it is arithmetic — see the check-digit refusal in `codes.ts`.
 *
 *   THE LABEL SHEET IS DESCRIBED, NOT NAMED. There is a very common stationery
 *   sheet with the measurements in `geometry.ts`, and that file gives the
 *   measurements instead of the catalogue number, for exactly this reason.
 *
 * The day any of those changes, all of the checks above turn red at once and
 * this list has to grow an entry. That is what makes the empty case a claim
 * instead of a default.
 */
export const COMPANY_MARKS: readonly { mark: string; owner: string }[] = [];
