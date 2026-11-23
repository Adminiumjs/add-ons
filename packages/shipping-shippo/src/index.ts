/**
 * What the host gets when it registers this add-on: the client half.
 *
 * The real transport is not reachable from here, because this module is the
 * entry of the browser bundle. It lives behind `server.ts`.
 *
 * There is no demo. A Shippo test key is its own visible state (D5), so until
 * the engine hands in a connected client the shared screens say "not connected".
 */

import { createElement } from "react";

import type { AddOn } from "@adminium/add-on-host";
import {
  applySettings,
  configureShippingKit,
  DispatchAction,
  kitMessages,
  TrackingPanel,
} from "@adminium/add-on-shipping-kit";
import { SHIPPO_BRAND } from "./brand.ts";
import { strings as ownStrings, type LocaleTag } from "./i18n/strings.ts";

/** Shippo's own words and the shared screens' copy with its name written in, in all eight locales. */
export const strings = (() => {
  const kit = kitMessages(SHIPPO_BRAND.name);
  const merged = {} as Record<LocaleTag, Record<string, string>>;
  for (const locale of Object.keys(ownStrings) as LocaleTag[]) merged[locale] = { ...kit[locale], ...ownStrings[locale] };
  return merged;
})();

export function register(): AddOn {
  // The one place the shared screens learn whose name to show.
  configureShippingKit(SHIPPO_BRAND);
  // The kit's default is DHL's demo. This bundle has its own copy of the kit, and no demo.
  applySettings({ demo_transport: false });
  return {
    key: "shipping-shippo",
    // Named for what it does, with the company's word mark unaltered and outside the name.
    name: "Shipping labels",
    shortName: "Shippo",
    lineKey: "addon.shipping-shippo.line",
    whatKey: "addon.shipping-shippo.what",
    // Two letters of this add-on's own name on a neutral tile, never a mark or a short form of one.
    monogram: "SL",
    category: "delivery",
    connect: "api-key",
    permissions: [
      { key: "addon.shipping-shippo.perm.rates" },
      { key: "addon.shipping-shippo.perm.shipments" },
      { key: "addon.shipping-shippo.perm.labels" },
    ],
    // The key is absent on purpose: `settings` is what a browser may render.
    settings: [],
    messages: strings,
    disconnect: {
      goesKey: "addon.shipping-shippo.disconnect.goes",
      staysKey: "addon.shipping-shippo.disconnect.stays",
    },
    namesCompany: true,
    fills: [
      {
        slot: "order.dispatch.actions",
        order: 20,
        render: (payload) => createElement(DispatchAction, payload),
      },
      {
        slot: "order.dispatch.panel",
        order: 20,
        render: (payload) => createElement(TrackingPanel, payload),
      },
    ],
  };
}

export { connectEngineCarrier, useConnectedCarrier } from "@adminium/add-on-shipping-kit";
