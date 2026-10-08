/** Why a discount did not apply, and why a typed code was refused: the server's reason, in the reader's words. */
import type { AddOnTranslate } from '../shared/host.ts';

export function explainWords(t: AddOnTranslate, reason: string | undefined): string {
  switch (reason) {
    case 'no-code-typed':
      return t('discounts.why.noCode', 'needs its code');
    case 'outside-days':
      return t('discounts.why.days', 'not on this day');
    case 'outside-hours':
      return t('discounts.why.hours', 'not at this time of day');
    case 'used-up':
      return t('discounts.why.usedUp', 'every use is taken');
    case 'ended':
    case 'expired':
      return t('discounts.why.ended', 'it has ended');
    case 'paused':
    case 'inactive':
      return t('discounts.why.paused', 'it is paused');
    case 'draft':
      return t('discounts.why.draft', 'it is a draft');
    case 'not-yet':
      return t('discounts.why.notYet', 'it has not started');
    case 'needs-minimum':
      return t('discounts.why.minimum', 'the order is under its minimum spend');
    case 'not-for-these-items':
      return t('discounts.why.items', 'nothing on this order is what it is for');
    case 'not-combinable':
      return t('discounts.why.alone', 'another discount gives more, and it is used alone');
    case 'needs-sign-in':
    case 'needs-customer':
      return t('discounts.why.signIn', 'needs a signed-in customer');
    case 'not-in-group':
      return t('discounts.why.group', 'the customer is not in its group');
    case 'not-first-order':
      return t('discounts.why.first', 'this is not a first order');
    case 'needs-quantity':
      return t('discounts.why.quantity', 'not enough of what it is for');
    case 'over-limit':
    case 'over-ceiling':
      return t('discounts.why.limit', 'over a limit');
    case 'void':
      return t('discounts.why.cancelled', 'it was cancelled');
    default:
      return t('discounts.why.unknown', 'it does not apply here');
  }
}
