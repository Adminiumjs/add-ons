/** The kit's copy as a DHL screen reads it, with the company's name filled in. */
import { kitMessages } from "@adminium/add-on-shipping-kit";
import type { LocaleTag, StringKey } from "@adminium/add-on-shipping-kit/i18n/strings.ts";

import { DHL_BRAND } from "../brand.ts";

export const strings = kitMessages(DHL_BRAND.name) as Record<LocaleTag, Record<StringKey, string>>;
