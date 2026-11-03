/**
 * WHAT A REFUSAL SAYS.
 *
 * Adminium decides; a screen only words what it was told, in the reader's
 * language, and puts it on the field the refusal names when it names one.
 */
import type { AddOnTranslate, DataError } from './host.ts';

export interface Said {
  message: string;
  /** The field it belongs on, where the refusal names one. */
  field?: string;
  /** Two saves met: the same call may be sent once more by the person. */
  again?: boolean;
}

const text = (value: unknown): string | undefined => (typeof value === 'string' && value !== '' ? value : undefined);

export function refusal(t: AddOnTranslate, error: DataError): Said {
  const column = text(error.details?.['column']) ?? text(error.details?.['path']);
  switch (error.code) {
    case 'UNIQUE_VIOLATION':
      return { message: t('shared.refusal.slugTaken', 'Another form already uses that link name.'), field: column ?? 'slug' };
    case 'WRITE_CONFLICT':
    case 'CAPACITY_BUSY':
      return { message: t('shared.refusal.conflict', 'Someone else changed this at the same time. Nothing was saved. Try again.'), again: true };
    case 'RATE_LIMITED':
      return { message: t('shared.refusal.rate', 'Too many tries. Wait a minute.') };
    case 'STATE_MOVE_REFUSED':
      return { message: t('shared.refusal.state', 'This form changed meanwhile. Open it again to see where it stands.') };
    case 'DELETE_REFUSED':
    case 'ROW_LOCKED':
      return { message: t('shared.refusal.notDraft', 'Only a draft can be deleted. Close a live form instead.') };
    case 'FORBIDDEN':
    case 'TABLE_FORBIDDEN':
    case 'COLUMN_FORBIDDEN':
      return { message: t('shared.refusal.forbidden', 'You do not have permission to do this.') };
    case 'NOT_FOUND':
      return { message: t('shared.refusal.notFound', 'This is not there any more.') };
    case 'FEATURE_OFF':
      return { message: t('shared.refusal.off', 'Forms & surveys is switched off right now.') };
    default:
      // A column's own refusal carries the server's sentence, already in the reader's language.
      if (column !== undefined && error.message !== '') return { message: error.message, field: column };
      return { message: error.message !== '' ? error.message : t('shared.refusal.other', 'This could not be saved. Try again.') };
  }
}
