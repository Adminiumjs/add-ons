/**
 * WHAT A REFUSAL SAYS, AND WHERE.
 *
 * Adminium decides; a screen only words what it was told. One sentence per
 * refusal, in the reader's language, and the field it lands on when the
 * refusal names one. Nothing a refusal leaves out is filled in here: a caller
 * who may not read the stock tables is sent no figure, and is shown none.
 */
import type { AddOnTranslate, DataError } from './host.ts';

export interface Said {
  /** The sentence to show. */
  message: string;
  /** The field it belongs on, where the refusal names one. */
  field?: string;
  /** Two saves met: the same call may be sent once more. */
  again?: boolean;
}

/** What a refusal may be told about the line it is shown on. */
export interface Subject {
  item?: string;
  unit?: string;
  batch?: string;
}

const text = (value: unknown): string | undefined => (typeof value === 'string' && value !== '' ? value : typeof value === 'number' ? String(value) : undefined);

/** What a `STATE_MOVE_REFUSED` still asks for, in the order its `requires` is judged. */
function unmet(t: AddOnTranslate, details: Readonly<Record<string, unknown>>): string {
  const requires = (details['requires'] ?? {}) as { children?: unknown; where?: unknown; linked?: unknown };
  if (requires.children !== undefined) return t('refusal.move.children', 'Add a line first.');
  if (requires.linked !== undefined) return t('refusal.move.linked', 'This sheet is not open for that any more.');
  if (requires.where !== undefined) return t('refusal.move.where', 'Some lines are not in yet.');
  return t('refusal.move.other', 'This cannot be done yet.');
}

export function refusal(t: AddOnTranslate, error: DataError, subject: Subject = {}): Said {
  const details = error.details ?? {};
  const column = text(details['column']) ?? text(details['path']);
  switch (error.code) {
    case 'POSTING_REFUSED': {
      const left = text(details['left']);
      switch (details['reason']) {
        case 'expired':
          return { message: t('refusal.expired', 'This batch has already expired'), field: 'expires_on' };
        case 'needs-batch':
          return { message: t('refusal.needsBatch', 'Enter the batch number'), field: 'batch_code' };
        case 'out-of-stock':
          return left !== undefined && subject.item !== undefined
            ? { message: t('refusal.outOfStockLeft', 'Only {left} {unit} of {item} are left in batch {batch}: this line cannot be undone', { left, unit: subject.unit ?? '', item: subject.item, batch: subject.batch ?? '' }) }
            : { message: t('refusal.outOfStock', 'Not enough left to undo this line') };
        case 'not-allowed':
          return { message: t('refusal.notAllowed', 'This is not allowed here.') };
        case 'receipt-open':
          return { message: t('refusal.receiptOpen', '{rows, plural, one {# row is} other {# rows are}} holding stock: put them back first', { rows: Number(details['rows'] ?? 0) }) };
        case 'one-at-a-time':
          return { message: t('refusal.oneAtATime', 'These lines are saved one at a time.') };
        case 'too-large':
          return { message: t('refusal.tooLarge', 'This line is too large to post in one go. Split it into smaller lines.') };
        default:
          return { message: t('refusal.stock', 'Stock could not be updated. Nothing was changed for this line. Try again; if it keeps failing, tell whoever looks after Adminium.') };
      }
    }
    case 'WRITE_CONFLICT':
    case 'CAPACITY_BUSY':
      return { message: t('refusal.conflict', 'Someone else changed this at the same time. Try again.'), again: true };
    case 'STATE_MOVE_REFUSED':
      return { message: unmet(t, details) };
    case 'CAPACITY_FULL':
      return { message: t('refusal.full', 'A purchase order holds 50 lines. Start another order for the rest.') };
    case 'FORBIDDEN':
    case 'TABLE_FORBIDDEN':
    case 'COLUMN_FORBIDDEN':
      return { message: t('refusal.forbidden', 'You do not have permission to do this.') };
    default:
      // A column's own refusal carries the server's sentence, already in the reader's language.
      if (column !== undefined && error.message !== '') return { message: error.message, field: column };
      return { message: error.message !== '' ? error.message : t('refusal.other', 'This could not be saved. Try again.') };
  }
}
