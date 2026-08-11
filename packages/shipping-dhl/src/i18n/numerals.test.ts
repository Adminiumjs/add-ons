/**
 * THE SHARED DIGIT SUITE, run against this add-on's own seam and bundle.
 *
 * See `@adminium/add-on-host/testing`'s `numerals.ts`. This package's `t` seam
 * was already right; its BUNDLE was not — "سريع، قبل 12:00" was a clock face a
 * translator typed, with no number in it for any formatter to reach.
 */

import { describeNumerals } from "@adminium/add-on-host/testing";

import { strings } from "./strings.ts";
import { translate } from "./t.ts";

describeNumerals({
  name: "shipping-dhl",
  arabic: strings["ar-EG"],
  substitute: (value) => translate("ar-EG", "addon.shipping-dhl.set.weightKg", { kg: value }),
});
