/** The words a look-up result is said with: one message per state, never a sentence glued from parts. */
import type { AddOnTranslate } from '../shared/host.ts';
import type { CardPill, Shown, VoucherPill, Why } from './read.ts';

export function cardPill(t: AddOnTranslate, pill: CardPill): string {
  switch (pill) {
    case 'inactive':
      return t('lookup.pill.inactive', 'Inactive');
    case 'active':
      return t('lookup.pill.active', 'Active');
    case 'void':
      return t('lookup.pill.cancelled', 'Cancelled');
    case 'expired':
      return t('lookup.pill.expired', 'Expired');
  }
}

export function voucherPill(t: AddOnTranslate, pill: VoucherPill, pack: boolean): string {
  switch (pill) {
    case 'issued':
      return pack ? t('lookup.pill.active', 'Active') : t('lookup.pill.notUsed', 'Not used');
    case 'used':
      return t('lookup.pill.used', 'Used');
    case 'used-up':
      return t('lookup.pill.usedUp', 'Used up');
    case 'expired':
      return t('lookup.pill.expired', 'Expired');
    case 'voided':
      return t('lookup.pill.cancelled', 'Cancelled');
    case 'not-sold':
      return t('lookup.pill.notSold', 'Not sold yet');
  }
}

export const toneOf = (usable: boolean, why: Why): 'pos' | 'warn' | 'danger' | 'neutral' => (usable ? 'pos' : why === 'void' ? 'danger' : why === 'inactive' || why === 'not-sold' ? 'neutral' : 'warn');

/** Why it cannot be used now; null when it can. */
export function whyNot(t: AddOnTranslate, shown: Shown, date: (day: string) => string): string | null {
  switch (shown.why) {
    case null:
      return null;
    case 'inactive':
      return t('lookup.why.inactive', 'Not sold yet · it cannot be spent');
    case 'not-sold':
      return t('lookup.why.notSold', 'Not sold yet · it cannot be used');
    case 'void':
      return t('lookup.why.cancelled', 'Cancelled · it cannot be used');
    case 'expired':
      return shown.expires === null ? t('lookup.why.expired', 'Expired') : t('lookup.why.expiredOn', 'Expired {date}', { date: date(shown.expires) });
    case 'empty':
      return t('lookup.why.empty', 'Nothing is left on it');
    case 'used':
      return t('lookup.why.used', 'Already used');
    case 'used-up':
      return shown.kind === 'code' ? t('lookup.why.codeUsedUp', 'Every use of this code is taken') : t('lookup.why.usedUp', 'Every use is taken');
    case 'switched-off':
      return t('lookup.why.off', 'This code is switched off');
  }
}

export function ledgerKind(t: AddOnTranslate, kind: unknown): string {
  switch (kind) {
    case 'issue':
      return t('lookup.row.issue', 'Issued');
    case 'top_up':
      return t('lookup.row.topUp', 'Topped up');
    case 'spend':
      return t('lookup.row.spend', 'Spent');
    case 'refund':
      return t('lookup.row.refund', 'Put back');
    case 'adjust':
      return t('lookup.row.adjust', 'Adjusted');
    case 'void':
      return t('lookup.row.void', 'Cancelled');
    case 'expire':
      return t('lookup.row.expire', 'Expired');
    default:
      return String(kind ?? '');
  }
}

export function stateOfUse(t: AddOnTranslate, state: unknown): string {
  switch (state) {
    case 'held':
      return t('lookup.use.held', 'Held');
    case 'counted':
      return t('lookup.use.counted', 'Used');
    case 'given_back':
      return t('lookup.use.givenBack', 'Given back');
    default:
      return String(state ?? '');
  }
}

/** The one line a screen reader is told about a result. */
export function announce(t: AddOnTranslate, shown: Shown, pill: string, amount: string): string {
  if (shown.kind === 'card') return shown.balance === null ? t('lookup.said.cardNoBalance', 'Gift card ending {last4}, {pill}', { last4: shown.last4 ?? '', pill }) : t('lookup.said.card', 'Gift card ending {last4}, {pill}, {amount} left', { last4: shown.last4 ?? '', pill, amount });
  if (shown.kind === 'credit') return t('lookup.said.credit', 'Credit, {pill}, {amount} left', { pill, amount });
  if (shown.kind === 'pack') return t('lookup.said.pack', 'Pack ending {last4}, {pill}, {left} of {total} left', { last4: shown.last4 ?? '', pill, left: shown.usesLeft ?? 0, total: shown.usesTotal ?? 0 });
  if (shown.kind === 'voucher') return t('lookup.said.voucher', 'Voucher ending {last4}, {pill}', { last4: shown.last4 ?? '', pill });
  return shown.usable ? t('lookup.said.code', 'A discount code that works') : t('lookup.said.codeNot', 'A discount code that does not work now');
}
