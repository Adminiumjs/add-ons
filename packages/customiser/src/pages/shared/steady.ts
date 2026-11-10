/**
 * A LIST READ ONCE, NOT AFTER EVERY SAVE.
 *
 * Adminium reads every list of a page again after any write the page makes
 * (a write may move rows of several tables). A screen that saves a file and
 * reads fourteen tables would read all fourteen again for each file. Most
 * of them are what the screen draws from and never changes itself: the
 * shop's bases, designs, fonts, colours. Those are read here once for each
 * question, then held: the list is switched off once it has answered, so a
 * write elsewhere on the page does not read it again. The rows it answered
 * are kept here, not left to the host: a list switched off "reads nothing",
 * and a shop app's own screens hand it back empty (only Adminium's dashboard
 * keeps the last answer). A question that changes (another base) is read anew.
 */
import { useEffect, useState } from 'react';

import { useRecords, type DataRow, type DataValue } from './host.ts';

type Options = NonNullable<Parameters<typeof useRecords>[1]>;
export type Steady = ReturnType<typeof useRecords>;

/**
 * A list read once for each question, then held while the screen is open.
 *
 * A question is held only once it has been seen loading and then answered:
 * Adminium shows a list's last answer while a new question loads, without
 * saying it is loading, so an answer seen without a load first may be the
 * last question's rows, never this one's. A list that is not held reads as
 * any other list. A refusal is passed on, held or not.
 */
export function useSteadyRecords(table: string, options: Options): Steady {
  const { enabled, ...question } = options;
  const wanted = enabled !== false;
  const key = `${table}\u0000${JSON.stringify(question)}`;
  const [seen, setSeen] = useState<string | null>(null);
  const [held, setHeld] = useState<{ key: string; rows: Steady['rows']; hasMore: boolean } | null>(null);
  const steady = held !== null && held.key === key;
  const result = useRecords(table, { ...question, enabled: wanted && !steady });
  const loading = wanted && !steady && result.loading;
  const answered = wanted && !steady && seen === key && !result.loading && result.error === null;
  useEffect(() => {
    if (loading) setSeen(key);
  }, [loading, key]);
  useEffect(() => {
    if (answered) setHeld({ key, rows: result.rows, hasMore: result.hasMore });
  }, [answered, key, result.rows, result.hasMore]);
  // Held: the rows it answered, whatever the switched-off list hands back.
  return steady ? { ...result, rows: held.rows, hasMore: held.hasMore, loading: false } : result;
}

/** One row by its key, read once and held: `useSteadyRecords` on the key, shaped as a row. */
export function useSteadyRecord(table: string, key: DataValue | null): { row: DataRow | null; loading: boolean; error: Steady['error'] } {
  const read = useSteadyRecords(table, { filter: [{ column: 'id', op: 'eq', value: key }], pageSize: 1, enabled: key !== null });
  return { row: key === null ? null : (read.rows[0] ?? null), loading: read.loading, error: read.error };
}
