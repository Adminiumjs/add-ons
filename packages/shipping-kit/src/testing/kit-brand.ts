/** A carrier that does not exist: the kit's own suite must pass without any real company's name. */
import { configureShippingKit, type CarrierBrand } from "../brand.ts";

export const TEST_BRAND: CarrierBrand = {
  addOnKey: "shipping-test",
  name: "Acme Post",
  monogram: "AP",
  idPrefix: "acme",
};

configureShippingKit(TEST_BRAND);
