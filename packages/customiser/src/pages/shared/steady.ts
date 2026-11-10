/**
 * A LIST READ ONCE, NOT AFTER EVERY SAVE.
 *
 * Adminium reads every list of a page again after any write the page makes
 * (a write may move rows of several tables). A screen that saves a file and
 * reads fourteen tables would read all fourteen again for each file. Most
 * of them are what the screen draws from and never changes itself: the
 * shop's bases, designs, fonts, colours. Those are read here once for each
 * question, then held: the list is switched off once it has answered, so a
 * write elsewhere on the page does not read it again, and Adminium keeps
 * the answer it had. A question that changes (another base) is read anew;
 * a refusal is not held, so a list that failed is still read as it was.
 */
import { useEffect, useState } from 'react';

import { useRecords, type DataRow, type DataValue } from './host.ts';

type Options = NonNullable<Parameters<typeof useRecords>[1]>;
export type Steady = ReturnType<typeof useRecords>;

/** A list read once for each question, then held while the screen is open. */
export function useSteadyRecords(table: string, options: Options): Steady {
  const { enabled, ...question } = options;
  const wanted = enabled !== false;
  const key = `${table}\u0000${JSON.stringify(question)}`;
  const [held, setHeld] = useState<string | null>(null);
  const steady = held === key;
  const result = useRecords(table, { ...question, enabled: wanted && !steady });
  const answered = wanted && !steady && !result.loading && result.error === null;
  useEffect(() => {
    if (answered) setHeld(key);
  }, [answered, key]);
  return steady ? { ...result, loading: false, error: null } : result;
}

/** One row by its key, read once and held: `useSteadyRecords` on the key, shaped as a row. */
export function useSteadyRecord(table: string, key: DataValue | null): { row: DataRow | null; loading: boolean; error: Steady['error'] } {
  const read = useSteadyRecords(table, { filter: [{ column: 'id', op: 'eq', value: key }], pageSize: 1, enabled: key !== null });
  return { row: key === null ? null : (read.rows[0] ?? null), loading: read.loading, error: read.error };
}
