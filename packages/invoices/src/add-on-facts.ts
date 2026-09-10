/**
 * THE FACTS A HOST'S OWN GATES NEED FROM THIS ADD-ON.
 *
 * A host app runs release gates over the code it ships, and some of those
 * gates need to know things that are true of an ADD-ON: which addresses it
 * names and cannot call, which of its strings must never reach a browser,
 * which words in it belong to somebody as a mark. Those lists used to live
 * inside each host, which meant making a portable add-on pass required editing
 * an exemption list inside the app receiving it (24 AC20/D21). So the facts
 * travel with the add-on and each host discovers whatever it has vendored.
 *
 * All three are empty here, and an empty list is exactly the shape a BROKEN
 * one takes — a glob that stopped matching and a correct declaration both
 * export `[]`. So `sources.test.ts` does not merely assert the emptiness; it
 * asserts the statements that would all have to be wrong together for it to be
 * an accident.
 */

/**
 * ADDRESSES THIS ADD-ON NAMES, AND WHY NONE CAN CAUSE A REQUEST.
 *
 * Empty, and it is the strictest state there is: a host's D11 net reports
 * every absolute URL in what it ships whose origin nobody has declared inert,
 * so with nothing declared here EVERY address is a finding.
 *
 * IT IS A PLACE SOMEBODY MIGHT REASONABLY EXPECT ONE, which is worth saying
 * out loud. An invoice is the document most likely to want a live exchange
 * rate, a tax-rate lookup or a delivery receipt from a customer's portal, and
 * each of those is an obvious next feature. Each would also be a different
 * add-on: this one renders numbers that were computed elsewhere, from a
 * subject handed to it, with nothing but the bundle already loaded (25 D11).
 * The day that changes, this list grows an entry and a `network` block appears
 * in the manifest — and `manifest.test.ts` asserts the two agree, so one
 * cannot happen without the other.
 */
export const INERT_ORIGINS: readonly { origin: string; why: string }[] = [];

/**
 * STRINGS THAT MUST NEVER APPEAR IN A CLIENT BUNDLE (24 D15, D11).
 *
 * Empty, and unlike the two lists around it that needs no argument beyond the
 * manifest: `connect: { kind: "none" }`, no setting marked `secret`. There is
 * no credential, so there is no key a credential could be saved under, so
 * there is nothing for a host's bundle grep to hunt for. `manifest.test.ts`
 * asserts the manifest agrees, so this emptiness cannot quietly outlive the
 * fact that produced it.
 */
export const NEVER_IN_A_BROWSER: readonly { text: string; why: string }[] = [];

/**
 * COMPANY MARKS THIS ADD-ON'S OWN SCREENS MAY PRINT (24 AC6) — THERE ARE NONE.
 *
 * An invoice is a document that exists to name a company, so this deserves the
 * distinction spelled out: the company an invoice names is the OPERATOR'S, and
 * it arrives in the subject at render time. This add-on names none of its own
 * (24 D12 — "this add-on names no company"), and it had three chances to:
 *
 *   THE PAPER SIZES ARE STANDARDS. `A4` is ISO 216 and `Letter` is ANSI; the
 *   80 mm receipt roll is a MEASUREMENT, given in millimetres in
 *   `render/pdf.ts` rather than as any manufacturer's catalogue number.
 *
 *   THE FONT IS A STANDARD TOO, and the one place a supplier could have
 *   appeared. `Helvetica` is one of PDF's fourteen base fonts — named in the
 *   file format's own specification, which is why no font file ships here —
 *   and it is used to say which metrics the widths in `pdf/helvetica.ts` are.
 *
 *   NO PAYMENT SERVICE IS NAMED. The comp's QR slot is an image the operator
 *   supplies; nothing here knows what is in it, and no processor, scheme or
 *   bank appears in any of the eight locale bundles.
 *
 * The day any of those changes, `sources.test.ts` turns red and this list has
 * to grow an entry. That is what makes the empty case a claim instead of a
 * default.
 */
export const COMPANY_MARKS: readonly { mark: string; owner: string }[] = [];
