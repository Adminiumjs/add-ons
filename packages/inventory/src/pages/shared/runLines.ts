/**
 * LINES MOVED ONE BY ONE.
 *
 * A receipt, a transfer or a count is posted line by line: each line's move
 * is a save of its own, so a sheet of six hundred lines is not one
 * transaction, and a run that breaks is taken up where it stopped. This sends
 * the lines in calls of five hundred, in order, each with the state the lines
 * were seen in — a line that moved meanwhile is refused, never moved twice.
 *
 * A line the call's time ran out before is sent again with the next call. A
 * line refused ends the run after its call: what is in stays in, and the
 * screen says which line and why. Two saves that met are sent once more, and
 * only once.
 */
import type { DataError, DataRow, MovedRow, PostingSaid, Writes } from './host.ts';

/** The most lines one call takes. */
export const CALL_MAX = 500;

export interface Refused {
  id: string;
  error: DataError;
}

export interface RunOutcome {
  /** Lines moved by this run. */
  done: number;
  all: number;
  refused: readonly Refused[];
  /** The moved rows as stored, by key, with what the ledger said of each. */
  rows: ReadonlyMap<string, { row: DataRow; postings: readonly PostingSaid[] }>;
}

const meets = (error: DataError): boolean => (error.code === 'WRITE_CONFLICT' && error.details?.['retry'] === true) || error.code === 'CAPACITY_BUSY';

export async function runLines(
  updateEach: Writes['updateEach'],
  ids: readonly (string | number)[],
  status: string,
  from: string,
  onProgress?: (done: number, all: number) => void,
): Promise<RunOutcome> {
  const all = ids.length;
  const rows = new Map<string, { row: DataRow; postings: readonly PostingSaid[] }>();
  const refused: Refused[] = [];
  const sentAgain = new Set<string>();
  let waiting = ids.map(String);
  let done = 0;
  let idle = 0;
  // Two calls in a row that move nothing end the run: the screen offers to go on, and nothing spins.
  while (waiting.length > 0 && idle < 2) {
    const chunk = waiting.slice(0, CALL_MAX);
    const results: readonly MovedRow[] = await updateEach(chunk, { status }, { from });
    const again: string[] = [];
    let moved = 0;
    chunk.forEach((id, index) => {
      const result = results[index];
      if (result === undefined || ('notRun' in result && result.notRun)) again.push(id);
      else if (result.ok) {
        moved += 1;
        rows.set(id, { row: result.row, postings: result.postings ?? [] });
      } else if ('error' in result && meets(result.error) && !sentAgain.has(id)) {
        sentAgain.add(id);
        again.push(id);
      } else if ('error' in result) refused.push({ id, error: result.error });
    });
    done += moved;
    idle = moved === 0 ? idle + 1 : 0;
    onProgress?.(done, all);
    if (refused.length > 0) break;
    waiting = [...again, ...waiting.slice(CALL_MAX)];
  }
  return { done, all, refused, rows };
}
