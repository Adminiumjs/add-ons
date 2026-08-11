/**
 * WHERE THE PARCEL IS GOING, AND WHAT HAPPENS WHEN NOBODY KNOWS.
 *
 * This suite exists because of a real defect, and it is worth naming precisely
 * so it cannot come back under a different spelling. `destinationFor()` took a
 * customer key, looked it up in an address book THIS ADD-ON SHIPPED, and ended
 * in `?? DESTINATIONS.harbour`. The print shop resolves its own customer keys
 * to display names before it hands a job to a slot, so every lookup missed and
 * every miss fell through to the same seeded address — the staff dispatch screen
 * pre-filled one bakery's street, city and postcode for every job in the works,
 * in the same quiet grey box a correct address uses, one click from being
 * printed onto a label.
 *
 * ── AND THE SECOND DEFECT, WHICH THE FIRST ONE HID ──────────────────────────
 *
 * The address book itself. It was keyed by ONE host's customers, so in any
 * other shop it resolved nothing at all — which the fallback then papered over.
 * A shop knows where its customer lives; an add-on does not, and should not
 * carry a directory of somebody else's trade. `OutboundOrder.destination` is
 * the host's to supply, and this module now READS it rather than guessing.
 *
 * Three properties are asserted here, and all three are load-bearing:
 *
 *   1. what the host supplied is what gets used, unchanged;
 *   2. when the host supplied nothing — or half of something — the result is an
 *      UNRESOLVED STATE THE WORKS CAN SEE, never an address of any kind;
 *   3. the unresolved surface renders as an obviously-empty form, and carries
 *      no trace of any other order's address.
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { OutboundOrder, PostalAddress } from "@adminium/add-on-host";
import {
  addressIsUsable,
  blankAddress,
  DEMO_ORIGIN,
  originOf,
  resolveDestination,
  SAMPLE_ORDER,
} from "./seed.ts";
import { UnresolvedDestination } from "./ui/DispatchAction.tsx";
import { strings } from "./i18n/strings.ts";

/** Somebody else's parcel, whose address must never stand in for this one's. */
const OTHER: PostalAddress = {
  name: "Harbour Bakery",
  lines: ["12 Quay Street"],
  city: "Marlow",
  postcode: "ML7 1AA",
  country: "GB",
};

const order = (over: Partial<OutboundOrder> = {}): OutboundOrder => ({
  ...SAMPLE_ORDER,
  ...over,
});

describe("reading the destination the host supplied", () => {
  it("uses it exactly as it arrived", () => {
    const found = resolveDestination(order({ destination: OTHER }));
    expect(found).toEqual({
      status: "resolved",
      address: {
        name: OTHER.name,
        lines: [...OTHER.lines],
        city: OTHER.city,
        postcode: OTHER.postcode,
        country: OTHER.country,
      },
    });
  });

  it("works for a host whose customers this add-on has never heard of", () => {
    // The whole point of moving the address to the payload: a maker studio's
    // private customers are not in anybody's directory, and never were.
    const found = resolveDestination(
      order({
        recipient: { name: "Bex T." },
        destination: {
          name: "Bex T.",
          lines: ["4 Marine Parade"],
          city: "Saltburn",
          postcode: "TS12 1DP",
          country: "GB",
        },
      }),
    );
    expect(found.status).toBe("resolved");
  });

  it("hands the collection address over as the carrier contract wants it", () => {
    expect(originOf(order())).toEqual(DEMO_ORIGIN);
  });
});

describe("an order nobody can place", () => {
  const STRANGER = "Ashcombe Bindery";

  it("comes back unresolved rather than as somebody else's address", () => {
    const found = resolveDestination(
      order({ recipient: { name: STRANGER }, destination: undefined }),
    );
    expect(found).toEqual({ status: "unresolved", customer: STRANGER });
    // The precise regression: no address, of any kind, is handed back.
    expect(found).not.toHaveProperty("address");
  });

  it("does not accept a half-filled record either", () => {
    // A host that carries the field but has never filled it in is the same
    // situation as a host that carries no field, and must read the same.
    const found = resolveDestination(
      order({
        recipient: { name: STRANGER },
        destination: { name: STRANGER, lines: [], city: "  ", postcode: "", country: "GB" },
      }),
    );
    expect(found).toEqual({ status: "unresolved", customer: STRANGER });
  });

  it("starts an empty form that carries no street, town or postcode", () => {
    const blank = blankAddress(STRANGER, DEMO_ORIGIN.country);
    expect(blank.name).toBe(STRANGER);
    expect(blank.city).toBe("");
    expect(blank.postcode).toBe("");
    expect(blank.lines.join("")).toBe("");
    // A country is not an address, and the one the shop collects from is the
    // honest default.
    expect(blank.country).toBe(DEMO_ORIGIN.country);
    expect(JSON.stringify(blank)).not.toContain(OTHER.postcode);
  });

  it("cannot be quoted until a town and a postcode are typed", () => {
    // This is what disables "Get rates" and the retry button, so an empty
    // address can never reach `quote`, `book` or a printed label.
    const blank = blankAddress(STRANGER, "GB");
    expect(addressIsUsable(blank)).toBe(false);
    expect(addressIsUsable({ ...blank, city: "Ashcombe" })).toBe(false);
    expect(addressIsUsable({ ...blank, city: "Ashcombe", postcode: "AC1 4TR" })).toBe(true);
    expect(addressIsUsable({ ...blank, city: "  ", postcode: "  " })).toBe(false);
  });

  it("SHOWS the works that it is unresolved, in words, on the dispatch surface", () => {
    // Rendered rather than reasoned about: the defect was invisible precisely
    // because the wrong address rendered like a right one.
    const raw = renderToStaticMarkup(
      createElement(UnresolvedDestination, {
        customer: STRANGER,
        to: blankAddress(STRANGER, "GB"),
        onChange: () => {},
      }),
    );
    // React escapes apostrophes and ampersands into entities; the reader sees
    // the character, so the assertions compare what the reader sees.
    const markup = raw
      .replace(/&#x27;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&");

    const en = strings["en-US"];
    expect(markup).toContain(en["addon.shipping-dhl.dest.unknownTitle"]);
    expect(markup).toContain(STRANGER);
    // The sentence names the customer that could not be placed.
    expect(markup).toContain(
      en["addon.shipping-dhl.dest.unknownBody"].replace("{customer}", STRANGER),
    );
    // And not one character of another parcel's address is on the screen.
    expect(markup).not.toContain(OTHER.postcode);
    expect(markup).not.toContain(OTHER.city);
    for (const line of OTHER.lines) expect(markup).not.toContain(line);
  });
});
