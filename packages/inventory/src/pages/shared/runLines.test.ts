import { describe, expect, it } from 'vitest';

import type { DataValue, MovedRow } from './host.ts';
import { CALL_MAX, runLines } from './runLines.ts';

type Sent = { ids: string[]; values: Readonly<Record<string, DataValue>>; from: string | undefined };

/** A server that answers each call with what `answer` says of each id. */
function server(answer: (id: string, call: number) => MovedRow) {
  const sent: Sent[] = [];
  const updateEach = async (keys: readonly (string | number)[], values: Readonly<Record<string, DataValue>>, options?: { from?: string }): Promise<readonly MovedRow[]> => {
    const ids = keys.map(String);
    sent.push({ ids, values, from: options?.from });
    return ids.map((id) => answer(id, sent.length));
  };
  return { sent, updateEach };
}

const ok = (id: string): MovedRow => ({ key: id, ok: true, row: { id, status: 'posted' } });
const ids = (count: number): string[] => Array.from({ length: count }, (_unused, index) => String(index + 1));

describe('lines moved one by one', () => {
  it('sends six hundred lines as two calls, in order, each with the state the lines were seen in', async () => {
    const { sent, updateEach } = server(ok);
    const seen: [number, number][] = [];
    const outcome = await runLines(updateEach, ids(600), 'posted', 'draft', (done, all) => seen.push([done, all]));
    expect(sent.map((call) => call.ids.length)).toEqual([CALL_MAX, 100]);
    expect(sent[0]?.ids[0]).toBe('1');
    expect(sent[1]?.ids[0]).toBe('501');
    expect(sent.every((call) => call.from === 'draft' && call.values['status'] === 'posted')).toBe(true);
    expect(outcome).toMatchObject({ done: 600, all: 600, refused: [] });
    expect(seen).toEqual([
      [500, 600],
      [600, 600],
    ]);
  });

  it('sends again the rows the call ran out of time for, before the rest', async () => {
    // The first call reaches only its first two rows.
    const { sent, updateEach } = server((id, call) => (call === 1 && Number(id) > 2 ? { key: id, ok: false, notRun: true } : ok(id)));
    const outcome = await runLines(updateEach, ids(5), 'posted', 'draft');
    expect(sent.map((call) => call.ids)).toEqual([
      ['1', '2', '3', '4', '5'],
      ['3', '4', '5'],
    ]);
    expect(outcome.done).toBe(5);
  });

  it('stops after the call that refused a line, and says which and why', async () => {
    const { sent, updateEach } = server((id) => (id === '3' ? { key: id, ok: false, error: { code: 'POSTING_REFUSED', message: '', details: { reason: 'needs-batch' } } } : ok(id)));
    const outcome = await runLines(updateEach, ids(600), 'posted', 'draft');
    // The second call is never made: what is in stays in, and the run is taken up from the screen.
    expect(sent).toHaveLength(1);
    expect(outcome.done).toBe(499);
    expect(outcome.refused).toEqual([{ id: '3', error: { code: 'POSTING_REFUSED', message: '', details: { reason: 'needs-batch' } } }]);
  });

  it('sends a line two saves met on once more, and only once', async () => {
    const met: MovedRow = { key: '2', ok: false, error: { code: 'WRITE_CONFLICT', message: '', details: { retry: true } } };
    const once = server((id, call) => (id === '2' && call === 1 ? met : ok(id)));
    expect(await runLines(once.updateEach, ids(3), 'posted', 'draft')).toMatchObject({ done: 3, refused: [] });
    expect(once.sent.map((call) => call.ids)).toEqual([['1', '2', '3'], ['2']]);

    const always = server((id) => (id === '2' ? met : ok(id)));
    const outcome = await runLines(always.updateEach, ids(3), 'posted', 'draft');
    expect(always.sent).toHaveLength(2);
    expect(outcome.refused.map((row) => row.id)).toEqual(['2']);
  });

  it('gives up on a run that moves nothing twice running, instead of asking for ever', async () => {
    const { sent, updateEach } = server((id) => ({ key: id, ok: false, notRun: true }));
    const outcome = await runLines(updateEach, ids(3), 'posted', 'draft');
    expect(sent).toHaveLength(2);
    expect(outcome).toMatchObject({ done: 0, all: 3, refused: [] });
  });

  it('keeps what the ledger said of each line', async () => {
    const { updateEach } = server((id) => ({ ...ok(id), postings: [{ ledger: 'stock', state: 'posted', notes: id === '2' ? [{ line: 0, note: 'short' }] : [] }] }) as MovedRow);
    const outcome = await runLines(updateEach, ids(2), 'posted', 'draft');
    expect(outcome.rows.get('2')?.postings[0]?.notes).toEqual([{ line: 0, note: 'short' }]);
  });
});
