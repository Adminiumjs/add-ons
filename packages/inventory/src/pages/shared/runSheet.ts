/**
 * A SHEET POSTED, OR TAKEN BACK, LINE BY LINE.
 *
 * A receipt, a transfer and a count go the same way: the sheet moves to a
 * state that says "its lines are going in", each line moves in a save of its
 * own (`runLines`), and when none is left the sheet moves to its end state —
 * which Adminium refuses while a line is still out. A run that stops leaves
 * the sheet in the middle state, and the same call takes it up again: it
 * reads which lines are still to go and sends only those.
 *
 * Adminium answers "too many requests" when one person's screens ask for
 * more than their share of a minute, and says when the minute ends. That is
 * no refusal of the sheet: the run waits until then and takes itself up
 * again, a few times at most, so nobody is left to press a button after
 * guessing how long to wait.
 */
import { asDataError, listAll, type DataError, type DataRow, type PostingSaid, type Reads, type Writes, type Written } from './host.ts';
import { runLines, type RunOutcome } from './runLines.ts';

/** How often one run waits a full minute out before it stops and says so. */
export const LIMIT_WAITS = 3;
const WAIT_MIN_MS = 500;
const WAIT_MAX_MS = 65_000;
const WAIT_UNSAID_MS = 5_000;

const overLimit = (error: DataError): boolean => error.code === 'RATE_LIMITED';

/** How long until Adminium takes requests again, from what its refusal said. */
export function limitWait(error: DataError, now: number = Date.now()): number {
  const until = Date.parse(String(error.details?.['resetAt'] ?? ''));
  if (Number.isNaN(until)) return WAIT_UNSAID_MS;
  return Math.min(Math.max(until - now + 250, WAIT_MIN_MS), WAIT_MAX_MS);
}

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
  /** Told when the run waits for Adminium to take requests again, and for how long. */
  onWaiting?: (ms: number) => void;
  /** The wait itself; a test passes its own. */
  sleep?: (ms: number) => Promise<void>;
}

export interface SheetOutcome extends RunOutcome {
  /** The sheet reached its end state. */
  finished: boolean;
}

export async function runSheet(deps: SheetDeps, steps: SheetSteps, sheet: DataRow, startValues?: Readonly<Record<string, string | number | boolean | null>>): Promise<SheetOutcome> {
  const id = String(sheet['id']);
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  // What the whole run moved, over every pass: a pass that ends on a refused move has still put its lines in.
  const so: Moved = { done: 0, all: null, rows: new Map() };
  let at = sheet;
  for (let waits = 0; ; waits += 1) {
    let limited: DataError | undefined;
    try {
      // After a wait the sheet is read again: the move that was refused may or may not have been made.
      if (waits > 0) at = (await deps.read.get(steps.sheet, id)) ?? at;
      const pass = await runOnce(deps, steps, at, startValues, so);
      limited = pass.refused.find((refused) => overLimit(refused.error))?.error;
      if (limited === undefined || waits >= LIMIT_WAITS) return { done: so.done, all: so.all ?? 0, rows: so.rows, refused: pass.refused, finished: pass.finished };
    } catch (caught) {
      limited = asDataError(caught);
      if (!overLimit(limited) || waits >= LIMIT_WAITS) throw caught;
    }
    const ms = limitWait(limited);
    deps.onWaiting?.(ms);
    await sleep(ms);
  }
}

interface Moved {
  done: number;
  all: number | null;
  rows: Map<string, { row: DataRow; postings: readonly PostingSaid[] }>;
}

/** One pass: start the sheet if it has not started, send the lines still to go, end it when none is left. */
async function runOnce(deps: SheetDeps, steps: SheetSteps, sheet: DataRow, startValues: Readonly<Record<string, string | number | boolean | null>> | undefined, so: Moved): Promise<Pick<SheetOutcome, 'refused' | 'finished'>> {
  const id = String(sheet['id']);
  const status = String(sheet['status'] ?? '');
  if (status === steps.before) await deps.move(id, steps.during, startValues);
  else if (status !== steps.during) throw Object.assign(new Error(`The sheet is ${status}.`), { code: 'CLIENT_ERROR' });
  const waiting = await listAll(deps.read, steps.lines, { filter: [{ column: steps.via, op: 'eq', value: id }, { column: 'status', op: 'eq', value: steps.lineFrom }], sort: [{ column: 'id', direction: 'asc' }] });
  const all = (so.all ??= waiting.length);
  const before = so.done;
  const ordered = deps.first === undefined ? waiting : [...waiting.filter(deps.first), ...waiting.filter((line) => !deps.first?.(line))];
  const outcome = await runLines(deps.updateEach, ordered.map((line) => String(line['id'])), steps.lineTo, steps.lineFrom, (moved) => deps.onProgress?.(before + moved, all));
  so.done += outcome.done;
  for (const [key, moved] of outcome.rows) so.rows.set(key, moved);
  if (outcome.refused.length > 0 || outcome.done < outcome.all) return { refused: outcome.refused, finished: false };
  await deps.move(id, steps.after);
  return { refused: [], finished: true };
}

export const RECEIPT_POST: SheetSteps = { sheet: 'receipts', lines: 'receipt_lines', via: 'receipt_id', before: 'draft', during: 'posting', after: 'posted', lineFrom: 'draft', lineTo: 'posted' };
export const RECEIPT_UNDO: SheetSteps = { sheet: 'receipts', lines: 'receipt_lines', via: 'receipt_id', before: 'posted', during: 'reversing', after: 'reversed', lineFrom: 'posted', lineTo: 'reversed' };
export const TRANSFER_POST: SheetSteps = { sheet: 'transfers', lines: 'transfer_lines', via: 'transfer_id', before: 'draft', during: 'posting', after: 'done', lineFrom: 'draft', lineTo: 'posted' };
export const TRANSFER_UNDO: SheetSteps = { sheet: 'transfers', lines: 'transfer_lines', via: 'transfer_id', before: 'done', during: 'reversing', after: 'reversed', lineFrom: 'posted', lineTo: 'reversed' };
export const COUNT_POST: SheetSteps = { sheet: 'counts', lines: 'count_lines', via: 'count_id', before: 'open', during: 'posting', after: 'posted', lineFrom: 'open', lineTo: 'posted' };
export const COUNT_UNDO: SheetSteps = { sheet: 'counts', lines: 'count_lines', via: 'count_id', before: 'posted', during: 'reversing', after: 'reversed', lineFrom: 'posted', lineTo: 'reversed' };
