/**
 * What the two shop settings panels share: a save never drops the part of the
 * shop's setup the other panel owns, and a refusal is read by its code.
 */
import type { EngineInternational, EngineInternationalBody } from "@adminium/add-on-host/engine-carrier";

import type { StringKey } from "../i18n/strings.ts";

/**
 * The whole setup as the engine keeps it, with this panel's changes on top.
 * `first` is used only while nothing is saved, so adding a country never moves
 * a currency or origin the owner chose. Export numbers left out stay as they are.
 */
export function savedBody(
  view: EngineInternational,
  first: Pick<EngineInternationalBody, "currency" | "originCountry">,
  change: Partial<EngineInternationalBody> = {},
): EngineInternationalBody {
  const held = view.settings;
  return {
    countries: held?.countries ?? [],
    currency: held?.currency ?? first.currency,
    originCountry: held?.originCountry ?? first.originCountry,
    ...(held?.description === undefined ? {} : { description: held.description }),
    ...(held?.hsCode === undefined ? {} : { hsCode: held.hsCode }),
    ...(held === null ? {} : { signerId: held.signerId, products: held.products }),
    ...change,
  };
}

export function refusalWords(code: string): StringKey {
  switch (code) {
    case "CUSTOMS_NOT_DECLARED":
      return "addon.shipping-kit.customs.refused.app.next";
    case "CUSTOMS_SIGNER":
      return "addon.shipping-kit.customs.noSigner.manage";
    case "CSRF_FAILED":
      return "addon.shipping-kit.engine.refused.csrf.next";
    case "FORBIDDEN":
      return "addon.shipping-kit.settings.noRight";
    default:
      return "addon.shipping-kit.settings.saveFailed";
  }
}
