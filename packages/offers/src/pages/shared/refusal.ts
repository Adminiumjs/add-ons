/**
 * WHAT A REFUSAL SAYS, AND WHERE.
 *
 * Adminium decides; a screen only words what it was told. One sentence per
 * refusal, in the reader's language, and the field it lands on when the
 * refusal names one. Nothing a refusal leaves out is filled in here: a reader
 * who may not see a card's balance is sent no figure, and is shown none.
 */
import type { AddOnTranslate, DataError } from './host.ts';

export interface Said {
  /** The sentence to show. */
  message: string;
  /** The field it belongs on, where the refusal names one. */
  field?: string;
  /** Two saves met: the same call may be sent once more by the person. */
  again?: boolean;
}

const text = (value: unknown): string | undefined => (typeof value === 'string' && value !== '' ? value : typeof value === 'number' ? String(value) : undefined);

function posting(t: AddOnTranslate, details: Readonly<Record<string, unknown>>): Said {
  const left = text(details['left']);
  switch (details['reason']) {
    case 'void':
      return { message: t('refusal.void', 'This was cancelled. Nothing was saved.') };
    case 'inactive':
      return { message: t('refusal.inactive', 'This card is not sold yet. It cannot be used.') };
    case 'expired':
      return { message: t('refusal.expired', 'This has expired. Nothing was saved.') };
    case 'used-up':
      return { message: t('refusal.usedUp', 'Every use is taken. Nothing was saved.') };
    case 'over-limit':
      return { message: t('refusal.overLimit', 'That is over the limit. Nothing was saved.') };
    case 'empty':
      return left === undefined ? { message: t('refusal.empty', 'The card does not hold that much.'), field: 'amount' } : { message: t('refusal.emptyLeft', 'The card has {left} left. Remove {left} or less.', { left }), field: 'amount' };
    case 'not-allowed':
      return { message: t('refusal.notAllowed', 'This is not allowed here.') };
    case 'receipt-open':
      return { message: t('refusal.receiptOpen', '{rows, plural, one {# row is} other {# rows are}} holding a use or a card payment: put them back first.', { rows: Number(details['rows'] ?? 0) }) };
    case 'card-pays-card':
      return { message: t('refusal.cardPaysCard', 'A table that sells gift cards cannot also take a gift card as payment.') };
    default:
      return { message: t('refusal.noAnswer', 'Offers could not answer. Nothing was saved.') };
  }
}

export function refusal(t: AddOnTranslate, error: DataError, doing?: 'print'): Said {
  const details = error.details ?? {};
  const column = text(details['column']) ?? text(details['path']);
  switch (error.code) {
    case 'POSTING_REFUSED':
      return posting(t, details);
    case 'UNIQUE_VIOLATION':
      return { message: t('refusal.codeTaken', 'That code is already used by another discount.'), field: 'code' };
    case 'BALANCE_EXCEEDED':
      return { message: t('refusal.batchFull', 'This batch already has all its codes.') };
    case 'WRITE_CONFLICT':
    case 'CAPACITY_BUSY':
      return { message: t('refusal.conflict', 'Someone else changed this at the same time. Nothing was saved. Try again.'), again: true };
    case 'RATE_LIMITED':
      return { message: t('refusal.rate', 'Too many tries. Wait a minute.') };
    case 'STATE_MOVE_REFUSED':
    case 'COLUMN_FORBIDDEN':
      return { message: t('refusal.askManager', 'Ask a manager.') };
    case 'FORBIDDEN':
    case 'TABLE_FORBIDDEN':
      return { message: t('refusal.forbidden', 'You do not have permission to do this.') };
    case 'NOT_FOUND':
      // Every miss of a print reads the same: a reader who is shown no code prints only what they have just made.
      return { message: doing === 'print' ? t('refusal.askToPrint', 'Ask a manager to print it.') : t('refusal.notFound', 'This is not there any more.') };
    case 'FEATURE_OFF':
      return { message: doing === 'print' ? t('refusal.noPrint', 'This cannot be printed right now.') : t('refusal.off', 'Offers is switched off right now.') };
    case 'DOCUMENT_NOT_DRAWN':
      return { message: t('refusal.noPrint', 'This cannot be printed right now.') };
    default:
      // A column's own refusal carries the server's sentence, already in the reader's language.
      if (column !== undefined && error.message !== '') return { message: error.message, field: column };
      return { message: error.message !== '' ? error.message : t('refusal.other', 'This could not be saved. Try again.') };
  }
}
