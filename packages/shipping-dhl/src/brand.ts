import type { CarrierBrand } from "@adminium/add-on-shipping-kit/brand.ts";

import { ADD_ON_KEY } from "./add-on-key.ts";

/** Who the shared screens are drawing for. The company is named only to say what is connected to. */
export const DHL_BRAND: CarrierBrand = {
  addOnKey: ADD_ON_KEY,
  name: "DHL",
  monogram: "DHL",
  idPrefix: "dhl",
};
