/**
 * WHICH LEVELS A COUNT STARTS WITH.
 *
 * A count's lines are the levels of one place that its scope names:
 * everything there, one category, the items not counted for a while, or the
 * items marked to check. The screen reads them, in item-name order, and hands
 * their keys to one save that makes the count with its lines; Adminium
 * decides every other column of a line. A sheet of more than a thousand lines
 * is started as several counts.
 */
import { listAll, type DataFilter, type DataRow, type Reads } from '../shared/host.ts';

export type Scope = 'all' | 'category' | 'stale' | 'to_check';
/** The most lines one count is made with. */
export const COUNT_MAX = 1000;

const text = (value: unknown): string => (value === null || value === undefined ? '' : String(value));
const truthy = (value: unknown): boolean => value === true || value === 1 || value === '1';
const LEVEL = ['id', 'stock_point_id', 'item_name', 'unassigned', 'qty'] as const;

/** A level nobody put a batch on and that holds nothing is not worth a line. */
const worthCounting = (level: DataRow): boolean => !(truthy(level['unassigned']) && !/[1-9]/.test(text(level['qty'])));

async function levelsOfPoints(read: Reads, points: readonly DataRow[]): Promise<DataRow[]> {
  const ids = points.map((point) => text(point['id']));
  const out: DataRow[] = [];
  for (let start = 0; start < ids.length; start += 100) {
    out.push(...(await listAll(read, 'levels', { filter: [{ column: 'stock_point_id', op: 'in', value: ids.slice(start, start + 100) }], columns: LEVEL })));
  }
  return out;
}

export interface ScopeAsk {
  placeId: string;
  scope: Scope;
  categoryId?: string;
  /** For `stale`: the moment before which a stock point counts as not counted lately (ISO). */
  before?: string;
}

/** The keys of the levels a count of this scope starts with, by item name. */
export async function levelsInScope(read: Reads, ask: ScopeAsk, onProgress?: (count: number) => void): Promise<string[]> {
  const place: DataFilter = { column: 'place_id', op: 'eq', value: ask.placeId };
  let levels: DataRow[];
  if (ask.scope === 'all') {
    levels = await listAll(read, 'levels', { filter: [place], columns: LEVEL });
  } else {
    const points: DataRow[] = [];
    const take = async (more: readonly DataFilter[]): Promise<void> => {
      points.push(...(await listAll(read, 'stock_points', { filter: [place, ...more], columns: ['id'] })));
    };
    if (ask.scope === 'category') await take([{ column: 'category_id', op: 'eq', value: ask.categoryId ?? '' }]);
    else if (ask.scope === 'to_check') await take([{ column: 'needs_count', op: 'eq', value: true }]);
    else {
      // Not counted since the day the setting names, or never counted at all.
      await take([{ column: 'last_counted_at', op: 'lt', value: ask.before ?? '' }]);
      await take([{ column: 'last_counted_at', op: 'empty' }]);
    }
    onProgress?.(points.length);
    levels = await levelsOfPoints(read, points);
  }
  const kept = levels.filter(worthCounting).sort((a, b) => text(a['item_name']).localeCompare(text(b['item_name'])) || Number(a['id']) - Number(b['id']));
  onProgress?.(kept.length);
  return kept.map((level) => text(level['id']));
}
