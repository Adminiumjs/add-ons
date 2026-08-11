/**
 * THE SHARED DIGIT SUITE, run against this add-on's own seam and bundle.
 *
 * See `@adminium/add-on-host/testing`'s `numerals.ts` for what it asserts and
 * why it lives there rather than four times over. This package is where the
 * defect was found: `translate` did `String(params[name])`, so the basket line
 * and the maker's order line drew "8.5 مم" beside the host's own "٣ مم".
 */

import { describeNumerals } from '@adminium/add-on-host/testing';

import { personalizerStrings } from './strings.ts';
import { translate } from './t.ts';

describeNumerals({
  name: 'personalizer',
  arabic: personalizerStrings['ar-EG'],
  // `sizeUnit` is "{mm} مم" in Arabic — one placeholder, and the exact one the
  // two order lines were rendering wrong.
  substitute: (value) => translate('ar-EG', 'addon.personalizer.sizeUnit', { mm: value }),
});
