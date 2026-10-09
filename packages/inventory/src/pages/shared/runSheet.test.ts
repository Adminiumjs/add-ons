import { describe, expect, it } from 'vitest';

import type { DataValue, MovedRow } from './host.ts';
import { COUNT_POST, LIMIT_WAITS, limitWait, runSheet } from './runSheet.ts';

const limited = (resetAt?: string) => Object.assign(new Error('Too many requests.'), { code: 'RATE_LIMITED', details: { bucket: 'api', limit: 300, ...(resetAt === undefined ? {} : { resetAt }) } });

/** A count of three open lines, and a server that refuses what `refuse` names. */
function server(refuse: (what: string, nth: number) => boolean) {
  const sheet: Record<string, DataValue> = { id: 5, status: 'open' };
  const lines: Record<string, DataValue>[] = [1, 2, 3].map((id) => ({ id, count_id: 5, status: 'open' }));
  const seen: Record<string, number> = {};
  const said: string[] = [];
  const slept: number[] = [];
  const hit = (what: string): void => {
    seen[what] = (seen[what] ?? 0) + 1;
    said.push(what);
    if (refuse(what, seen[what])) throw limited(new Date(Date.now() + 2000).toISOString());
  };
  return {
    sheet,
    lines,
    said,
    slept,
    deps: {
      read: {
        list: async () => {
          hit('list');
          return { rows: lines.filter((line) => line['status'] === 'open'), hasMore: false };
        },
        get: async () => {
          hit('get');
          return { ...sheet };
        },
      },
      move: async (_key: string | number, to: string) => {
        hit(`move:${to}`);
        sheet['status'] = to;
        return { row: { ...sheet } };
      },
      updateEach: async (keys: readonly (string | number)[], values: Readonly<Record<string, DataValue>>): Promise<readonly MovedRow[]> => {
        hit('each');
        return keys.map((key) => {
          const line = lines.find((one) => String(one['id']) === String(key)) as Record<string, DataValue>;
          line['status'] = values['status'] as string;
          return { key: String(key), ok: true, row: { ...line } };
        });
      },
      sleep: async (ms: number) => {
        slept.push(ms);
      },
    },
  };
}

describe('a sheet posted while Adminium says "too many requests"', () => {
  it('waits until the minute ends and finishes by itself, sending no line twice', async () => {
    // The last move is refused once: the lines are in, the sheet is still "posting".
    const world = server((what, nth) => what === 'move:posted' && nth === 1);
    const waits: number[] = [];
    const outcome = await runSheet({ ...world.deps, onWaiting: (ms) => waits.push(ms) }, COUNT_POST, world.sheet);
    expect(outcome.finished).toBe(true);
    expect(outcome.done).toBe(3);
    expect(outcome.all).toBe(3);
    expect(world.sheet['status']).toBe('posted');
    expect(world.said.filter((what) => what === 'each')).toHaveLength(1);
    // It read the sheet again after the wait, and did not ask to start a sheet that had started.
    expect(world.said).toEqual(['move:posting', 'list', 'each', 'move:posted', 'get', 'list', 'move:posted']);
    expect(world.slept).toHaveLength(1);
    expect(world.slept[0]).toBeGreaterThan(1500);
    expect(world.slept[0]).toBeLessThanOrEqual(2250);
    expect(waits).toEqual(world.slept);
  });

  it('takes a refusal of the lines\' own call the same way', async () => {
    const world = server(() => false);
    let calls = 0;
    const each = world.deps.updateEach;
    world.deps.updateEach = async (keys, values) => {
      calls += 1;
      // The whole call refused: the host marks each of its rows with that refusal.
      if (calls === 1) return keys.map((key) => ({ key: String(key), ok: false, error: { code: 'RATE_LIMITED', message: '', details: { resetAt: new Date(Date.now() + 1000).toISOString() } } }));
      return each(keys, values);
    };
    const outcome = await runSheet(world.deps, COUNT_POST, world.sheet);
    expect(outcome.finished).toBe(true);
    expect(outcome.refused).toEqual([]);
    expect(outcome.done).toBe(3);
    expect(world.slept).toHaveLength(1);
  });

  it('stops after a few waits and hands the refusal on, the sheet left where "Continue posting" takes it up', async () => {
    const world = server((what) => what === 'move:posted');
    await expect(runSheet(world.deps, COUNT_POST, world.sheet)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    expect(world.slept).toHaveLength(LIMIT_WAITS);
    expect(world.sheet['status']).toBe('posting');
  });

  it('does not wait on any other refusal', async () => {
    const world = server(() => false);
    world.deps.move = async () => {
      throw Object.assign(new Error(''), { code: 'STATE_MOVE_REFUSED' });
    };
    await expect(runSheet(world.deps, COUNT_POST, world.sheet)).rejects.toMatchObject({ code: 'STATE_MOVE_REFUSED' });
    expect(world.slept).toEqual([]);
  });

  it('reads the wait from the refusal, within bounds', () => {
    const now = Date.parse('2026-10-09T10:00:00Z');
    expect(limitWait({ code: 'RATE_LIMITED', message: '', details: { resetAt: '2026-10-09T10:00:02Z' } }, now)).toBe(2250);
    expect(limitWait({ code: 'RATE_LIMITED', message: '', details: { resetAt: '2026-10-09T09:59:00Z' } }, now)).toBe(500);
    expect(limitWait({ code: 'RATE_LIMITED', message: '', details: { resetAt: '2026-10-09T11:00:00Z' } }, now)).toBe(65_000);
    expect(limitWait({ code: 'RATE_LIMITED', message: '' }, now)).toBe(5000);
  });
});
