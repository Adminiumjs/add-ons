/**
 * WHAT A REFUSAL SAYS.
 *
 * Adminium decides; a screen only words what it was told, in the reader's
 * language.
 */
import type { AddOnTranslate, DataError } from './host.ts';

export interface Said {
  message: string;
}

export function refusal(t: AddOnTranslate, error: DataError): Said {
  switch (error.code) {
    case 'WRITE_CONFLICT':
      return { message: t('shared.refusal.conflict', 'Someone else changed this at the same time. Nothing was saved. Try again.') };
    case 'RATE_LIMITED':
      return { message: t('shared.refusal.rate', 'Too many tries. Wait a minute.') };
    case 'UNIQUE_VIOLATION':
      return { message: t('shared.refusal.taken', 'Another answer already uses that question.') };
    case 'FORBIDDEN':
    case 'TABLE_FORBIDDEN':
    case 'COLUMN_FORBIDDEN':
      return { message: t('shared.refusal.forbidden', 'You do not have permission to do this.') };
    case 'NOT_FOUND':
      return { message: t('shared.refusal.notFound', 'This is not there any more.') };
    default:
      return { message: error.message !== '' ? error.message : t('shared.refusal.other', 'This could not be saved. Try again.') };
  }
}
