/**
 * THE SHARED DIGIT SUITE, run against this add-on's own seam and bundle.
 *
 * See `@adminium/add-on-host/testing`'s `numerals.ts`. `translator` here did
 * `String(params[name])` like the other two, and had shipped no numeric call
 * site yet — which is exactly the case a per-package test written after the
 * fact would have missed.
 */

import { describe, expect, it } from "vitest";

import { describeNumerals } from "@adminium/add-on-host/testing";

import { designStudioStrings, NOT_A_QUANTITY, translator } from "./strings.ts";

describeNumerals({
  name: "design-studio",
  arabic: designStudioStrings["ar-EG"],
  substitute: (value) =>
    translator("ar-EG")("addon.design-studio.legend.bleedValue", { v: value }),
  /*
   * READ FROM `strings.ts`, not written out here. The hosts read the same
   * export off the vendored bundle, so this add-on's allowances and the ones
   * every host applies to it are one declaration rather than three that drift —
   * see the block above `NOT_A_QUANTITY` for the defect that made that
   * necessary.
   */
  allowed: NOT_A_QUANTITY,
});

describe("the allowances travel with the strings (24 AC20/D21)", () => {
  it("declares the one Latin figure in this bundle, with a reason", () => {
    expect(NOT_A_QUANTITY.map((entry) => entry.phrase)).toEqual(["07700 900 000"]);
    for (const entry of NOT_A_QUANTITY) expect(entry.why.length).toBeGreaterThan(30);
  });
});
