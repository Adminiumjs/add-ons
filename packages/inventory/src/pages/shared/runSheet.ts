/**
 * A SHEET POSTED, OR TAKEN BACK, LINE BY LINE.
 *
 * A receipt, a transfer and a count go the same way: the sheet moves to a
 * state that says "its lines are going in", each line moves in a save of its
 * own (`runLines`), and when none is left the sheet moves to its end state —
 * which Adminium refuses while a line is still out. A run that stops leaves
 * the sheet in the middle state, and the same call takes it up again: it
 * reads which lines are still to go and sends only those.
 */
import { listAll, type DataRow, type Reads, type Writes, type Written } from './host.ts';
import { runLines, type RunOutcome } from './runLines.ts';

export interface SheetSteps {
  /** The sheet's table, its lines' table and the line's link to its sheet. */
  sheet: string;
  lines: string;
  via: string;
  /** The sheet's state before, while its lines move, and after. */
  before: string;
  during: string;
  after: string;
  /** A line's state before and after. */
  lineFrom: string;
  lineTo: string;
}

export interface SheetDeps {
  read: Reads;
  move: (key: string | number, to: string, values?: Readonly<Record<string, string | number | boolean | null>>) => Promise<Written>;
  updateEach: Writes['updateEach'];
  onProgress?: (done: number, all: number) => void;
  /** Lines to send first (a count's lines that differ). */
  first?: (line: DataRow) => boolean;
}

export interface SheetOutcome extends RunOutcome {
  /** The sheet reached its end state. */
  finished: boolean;
}

export async function runSheet(deps: SheetDeps, steps: SheetSteps, sheet: DataRow, startValues?: Readonly<Record<string, string | number | boolean | null>>): Promise<SheetOutcome> {
  const id = String(sheet['id']);
  const status = String(sheet['status'] ?? '');
  if (status === steps.before) await deps.move(id, steps.during, startValues);
  else if (status !== steps.during) throw Object.assign(new Error(`The sheet is ${status}.`), { code: 'CLIENT_ERROR' });
  const waiting = await listAll(deps.read, steps.lines, { filter: [{ column: steps.via, op: 'eq', value: id }, { column: 'status', op: 'eq', value: steps.lineFrom }], sort: [{ column: 'id', direction: 'asc' }] });
  const ordered = deps.first === undefined ? waiting : [...waiting.filter(deps.first), ...waiting.filter((line) => !deps.first?.(line))];
  const outcome = await runLines(deps.updateEach, ordered.map((line) => String(line['id'])), steps.lineTo, steps.lineFrom, deps.onProgress);
  if (outcome.refused.length > 0 || outcome.done < outcome.all) return { ...outcome, finished: false };
  await deps.move(id, steps.after);
  return { ...outcome, finished: true };
}

export const RECEIPT_POST: SheetSteps = { sheet: 'receipts', lines: 'receipt_lines', via: 'receipt_id', before: 'draft', during: 'posting', after: 'posted', lineFrom: 'draft', lineTo: 'posted' };
export const RECEIPT_UNDO: SheetSteps = { sheet: 'receipts', lines: 'receipt_lines', via: 'receipt_id', before: 'posted', during: 'reversing', after: 'reversed', lineFrom: 'posted', lineTo: 'reversed' };
export const TRANSFER_POST: SheetSteps = { sheet: 'transfers', lines: 'transfer_lines', via: 'transfer_id', before: 'draft', during: 'posting', after: 'done', lineFrom: 'draft', lineTo: 'posted' };
export const TRANSFER_UNDO: SheetSteps = { sheet: 'transfers', lines: 'transfer_lines', via: 'transfer_id', before: 'done', during: 'reversing', after: 'reversed', lineFrom: 'posted', lineTo: 'reversed' };
export const COUNT_POST: SheetSteps = { sheet: 'counts', lines: 'count_lines', via: 'count_id', before: 'open', during: 'posting', after: 'posted', lineFrom: 'open', lineTo: 'posted' };
export const COUNT_UNDO: SheetSteps = { sheet: 'counts', lines: 'count_lines', via: 'count_id', before: 'posted', during: 'reversing', after: 'reversed', lineFrom: 'posted', lineTo: 'reversed' };
