/** Screens under test are drawn without `register()`, so the suite names the carrier first. */
import { configureShippingKit } from "@adminium/add-on-shipping-kit/brand.ts";

import { DHL_BRAND } from "../brand.ts";

configureShippingKit(DHL_BRAND);
