/**
 * WHEREVER THE COMPANY IS NAMED, THE DISCLAIMER IS ON THE SAME SCREEN (24 AC6).
 *
 * ── THE DEFECT ──────────────────────────────────────────────────────────────
 *
 * The customer's own order page has two states, and only one of them carried
 * the line. With a parcel on its way, `TrackingPanel` drew the timeline and
 * ended with "Adminium is not affiliated with this company." — correct. With
 * the carrier connected and NOTHING DISPATCHED YET, it drew the brand chip
 * reading "DHL" and the sentence "This order has not gone out with a carrier
 * yet.", and stopped. `<NotAffiliated>` sat inside the has-tracking branch
 * alone; a page-wide grep for `affiliat` on a connected, undispatched order
 * came back empty.
 *
 * The reasoning behind the original placement — that a tracking timeline is
 * where the company is really named — does not survive being looked at. The
 * monogram reads DHL. That is the company, named as plainly as a word names
 * anything, and a customer whose order has not shipped yet sees THAT card and
 * no other. AC6 is about the screen a reader is on, not about the richest of
 * the screens they might reach later.
 *
 * ── SO THE RULE IS STATED OVER BOTH STATES, RENDERED ────────────────────────
 *
 * Both branches of the panel are rendered and asked the same question: is the
 * company named here, and if so is the disclaimer here too. Rendering rather
 * than reading the source, because the defect was a JSX node inside the wrong
 * `if` — every source-level check in this repo would have found the component
 * imported, used, and translated in eight languages.
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";

import { PINNED_NOW } from "./clock.ts";
import { resetRuntime } from "./runtime.ts";
import { SAMPLE_ORDER } from "./seed.ts";
import { strings } from "./i18n/strings.ts";
import { TrackingPanel } from "./ui/TrackingPanel.tsx";

const en = strings["en-US"];
/** The three letters the neutral monogram tile carries. Never a logo (D12). */
const COMPANY = "DHL";

beforeEach(() => {
  resetRuntime();
});

function panel(): string {
  return renderToStaticMarkup(
    createElement(TrackingPanel, { order: SAMPLE_ORDER, now: PINNED_NOW }),
  );
}

describe("the customer's order page names the company honestly", () => {
  it("carries the disclaimer on the state where nothing has shipped yet", () => {
    const markup = panel();

    // This IS the un-dispatched state — the one the defect was in.
    expect(markup).toContain(en["addon.shipping-dhl.panel.notSent"]);
    // The company is named here, by the monogram if by nothing else.
    expect(markup).toContain(COMPANY);
    // And so is the fact that naming it is not a relationship.
    expect(
      markup,
      "the company is named with no not-affiliated line anywhere on the card",
    ).toContain(en["addon.shipping-dhl.notAffiliated"]);
  });

  it("says it in every language, on that same state", () => {
    /*
     * A disclaimer that only exists in English is a disclaimer seven eighths of
     * this app's readers do not get. The panel renders whatever the document's
     * `lang` resolves to; the bundle is what decides whether there is anything
     * to render, so that is what is checked here.
     */
    for (const [locale, table] of Object.entries(strings)) {
      const line = table["addon.shipping-dhl.notAffiliated"];
      expect(line, `${locale} has no not-affiliated line`).toBeDefined();
      expect(line.length, `${locale}'s not-affiliated line is empty`).toBeGreaterThan(10);
    }
  });

  it("does not name the company anywhere the disclaimer is missing", () => {
    /*
     * The rule as a rule rather than as two cases: for this surface, in both of
     * its states, naming and disclaiming travel together. If a later change
     * adds a third state, it fails here rather than shipping.
     */
    const markup = panel();
    const namesIt = markup.includes(COMPANY);
    const disclaims = markup.includes(en["addon.shipping-dhl.notAffiliated"]);
    expect({ namesIt, disclaims }).toEqual({ namesIt: true, disclaims: true });
  });
});
