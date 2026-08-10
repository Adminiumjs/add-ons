/**
 * WHERE THE PARCEL IS GOING, AND WHAT HAPPENS WHEN NOBODY KNOWS.
 *
 * This suite exists because of a real defect, and it is worth naming precisely
 * so it cannot come back under a different spelling. `destinationFor()` took a
 * customer KEY and ended in `?? DESTINATIONS.harbour`. The print shop resolves
 * its own customer keys to display NAMES before it hands a job to a slot, so
 * every lookup missed and every miss fell through to the same seeded address —
 * the staff dispatch screen pre-filled Harbour Bakery's street, city and
 * postcode for every job in the works, in the same quiet grey box a correct
 * address uses, one click away from being printed onto a label.
 *
 * Two properties are asserted here, and both are load-bearing:
 *
 *   1. resolution works for the host as it actually is (by name) and for the
 *      host as the contract prefers (by key);
 *   2. when neither matches, the result is an UNRESOLVED STATE THE WORKS CAN
 *      SEE — never another customer's address.
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  addressIsUsable,
  blankAddress,
  DESTINATIONS,
  DISPATCH_READY,
  resolveDestination,
  WORKS_ADDRESS,
} from "./seed.ts";
import { UnresolvedDestination } from "./ui/DispatchAction.tsx";
import { strings } from "./i18n/strings.ts";

/** Every postcode the seed knows — none of them may stand in for another. */
const SEEDED_POSTCODES = Object.values(DESTINATIONS).map((a) => a.postcode);

describe("resolving a host job to a destination", () => {
  it("matches on the display name the print shop actually passes", () => {
    // `Job.customer` is a display name in the host (`src/data/source.ts`
    // resolves the key before the slot ever sees the job).
    const found = resolveDestination({ customer: "Kestrel Joinery" });
    expect(found).toEqual({
      status: "resolved",
      address: DESTINATIONS.kestrel,
      matchedOn: "name",
    });
  });

  it("matches on the key when a host has one to give, and prefers it", () => {
    const byField = resolveDestination({ customer: "Kestrel Joinery", customerKey: "harbour" });
    expect(byField).toMatchObject({ status: "resolved", matchedOn: "key" });
    expect(byField).toMatchObject({ address: DESTINATIONS.harbour });

    // A host that still puts the key in `customer` is matched too, and the
    // result says which spelling won.
    expect(resolveDestination({ customer: "tworivers" })).toMatchObject({
      status: "resolved",
      matchedOn: "key",
      address: DESTINATIONS.tworivers,
    });
  });

  it("is not fooled by case or stray whitespace in a name", () => {
    expect(resolveDestination({ customer: "  two rivers cycles " })).toMatchObject({
      status: "resolved",
      address: DESTINATIONS.tworivers,
    });
  });

  it("places every job the works can dispatch", () => {
    // The two seeded jobs, and the seven customers the print shop ships with:
    // a works can move any job to *ready*, so an address book covering only the
    // comp's two jobs would leave the rest looking broken.
    for (const job of DISPATCH_READY) {
      expect(resolveDestination(job).status, job.ref).toBe("resolved");
    }
    for (const name of Object.values(DESTINATIONS).map((a) => a.name)) {
      expect(resolveDestination({ customer: name }).status, name).toBe("resolved");
    }
  });
});

describe("a customer nobody can place", () => {
  const STRANGER = "Ashcombe Bindery";

  it("comes back unresolved rather than as somebody else's address", () => {
    const found = resolveDestination({ customer: STRANGER });
    expect(found).toEqual({ status: "unresolved", customer: STRANGER });
    // The precise regression: no address, of any kind, is handed back.
    expect(found).not.toHaveProperty("address");
  });

  it("does not fall through when a bad key is given either", () => {
    expect(resolveDestination({ customer: STRANGER, customerKey: "not-a-customer" })).toEqual({
      status: "unresolved",
      customer: STRANGER,
    });
  });

  it("starts an empty form that carries no seeded street, town or postcode", () => {
    const blank = blankAddress(STRANGER);
    expect(blank.name).toBe(STRANGER);
    expect(blank.city).toBe("");
    expect(blank.postcode).toBe("");
    expect(blank.lines.join("")).toBe("");
    // A country is not an address, and the works' own is the honest default.
    expect(blank.country).toBe(WORKS_ADDRESS.country);
    for (const postcode of SEEDED_POSTCODES) {
      expect(JSON.stringify(blank)).not.toContain(postcode);
    }
  });

  it("cannot be quoted until a town and a postcode are typed", () => {
    // This is what disables "Get rates" and the retry button, so an empty
    // address can never reach `quote`, `book` or a printed label.
    const blank = blankAddress(STRANGER);
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
        to: blankAddress(STRANGER),
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
    // And not one character of anybody else's address is on the screen.
    for (const address of Object.values(DESTINATIONS)) {
      expect(markup).not.toContain(address.postcode);
      expect(markup).not.toContain(address.city);
      for (const line of address.lines) expect(markup).not.toContain(line);
    }
  });
});
