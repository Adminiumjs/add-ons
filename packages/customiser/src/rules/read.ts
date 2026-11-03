/**
 * READING A ROW THE SAME WAY, WHOEVER HANDS IT IN.
 *
 * The rules are asked in two places that hold the same rows differently. In
 * the browser a row comes from the shop app's public read: numbers are
 * numbers and a JSON column is already parsed. On the server Adminium hands
 * the rows as it stores them: a decimal is text ("20.00"), a JSON column is
 * text, a key may be a number or text, and a yes/no may be 1 or `true`. These
 * helpers read either, so a rule never depends on who asked.
 */

/** One row of a table, as it is handed in. */
export type Row = Readonly<Record<string, unknown>>;

/** A number, from a number or from text that is one; anything else is none. */
export function num(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Yes, from `true`, 1, "1", "true" or "t" (how the three databases keep it); anything else is no. */
export const yes = (value: unknown): boolean => value === true || value === 1 || value === '1' || value === 'true' || value === 't';

/** Text, or none. */
export const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/** Whether two keys name the same row: 7 and "7" do; none and none do. */
export function sameKey(a: unknown, b: unknown): boolean {
  const empty = (value: unknown) => value === null || value === undefined || value === '';
  if (empty(a) || empty(b)) return empty(a) && empty(b);
  return String(a) === String(b);
}

export const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** A JSON column's value: parsed when it is text, as it is otherwise. `undefined` when the text is not JSON. */
export function json(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

/** A list of text, or none when the value is not one. */
export function words(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((one) => typeof one === 'string') ? [...(value as string[])] : null;
}

/** A list of numbers, or none when the value is not one. */
export function numbers(value: unknown): number[] | null {
  return Array.isArray(value) && value.every((one) => typeof one === 'number' && Number.isFinite(one)) ? [...(value as number[])] : null;
}

/** Rows in the order the shop set them (`position`), then by key, so every answer lists things the same way. */
export function inOrder<T extends Row>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => (num(a['position']) ?? 0) - (num(b['position']) ?? 0) || byKey(a['id'], b['id']));
}

/** Keys compared as numbers when both are, else as text: no language's collation, so every place sorts alike. */
function byKey(a: unknown, b: unknown): number {
  const [x, y] = [num(a), num(b)];
  if (x !== null && y !== null) return x - y;
  const [p, q] = [String(a ?? ''), String(b ?? '')];
  return p < q ? -1 : p > q ? 1 : 0;
}
