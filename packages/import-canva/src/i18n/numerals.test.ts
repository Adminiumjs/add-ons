/**
 * THE SHARED DIGIT SUITE, run against this add-on's own seam and bundle.
 *
 * See `@adminium/add-on-host/testing`'s `numerals.ts`. `makeT` here did
 * `String(params[name])` like the other two.
 */

import { describeNumerals } from "@adminium/add-on-host/testing";

import { importCanvaStrings } from "./strings.ts";
import { makeT } from "./t.ts";

describeNumerals({
  name: "import-canva",
  arabic: importCanvaStrings["ar-EG"],
  substitute: (value) => makeT("ar-EG")("check.bleedOk", { mm: value }),
});
