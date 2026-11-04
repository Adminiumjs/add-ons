/**
 * THE VERSION AN ORDER SNAPSHOTS, OVER THE BUILT FILE.
 *
 * `posting-rows@1`'s own suite runs over the cases against the file an
 * install would run, in the bare context a save runs it in: the answer's
 * shape, only the tables and columns the ledger writes, the same answer
 * twice and on another clock, a look ahead answered as the save. Below it,
 * what the suite cannot know: an order makes the next version from what the
 * customer chose and locks the draft; a repeat order of an unchanged design
 * makes none; two lines of one design in one save make one; a design gone is
 * refused.
 */
import type { PostingInput, PostingLine } from '@adminium/add-on-contracts';
import { postingRowsConformance, type PostingRowsCase } from '@adminium/add-on-contracts/testing';
import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };
import { buildForReal } from './testing/build.ts';
import { builtCheck, builtProvider } from './testing/vm.ts';

buildForReal();
const provider = builtProvider();
const ledger = manifest.addOn.ledgers[0] as unknown as { id: string; writes: Record<string, { insert?: string[]; update?: { by: string[]; set: string[] } }> };

const VALUES = JSON.stringify({ format: 1, finish: 'engraved', parts: { sign: { text: 'Iris’s Books', font: 'Cormorant Garamond', size: 10 } } });
const line = (key: string, design: string | number): PostingLine => ({ line: key, lineTable: 'maker_order_lines', inputs: { design }, multipliers: {}, round: 1 });
function input(lines: PostingLine[], reads: PostingInput['reads'], extra: Partial<PostingInput> = {}): PostingInput {
  return {
    contract: 'posting-rows@1',
    ledger: 'designs',
    action: 'order',
    posting: 'design',
    phase: 'post',
    mode: 'save',
    origin: 'public',
    now: '2026-08-05T15:01:00.000Z',
    today: '2026-08-05',
    zone: 'Europe/London',
    currency: 'GBP',
    source: { table: 'maker_orders', row: '2288' },
    lines,
    reads,
    settings: {},
    written: {},
    version: '1.0.15',
    ...extra,
  };
}
const design = (state: 'draft' | 'ordered', values = VALUES) => ({ id: 1, app: 'maker', values, state });

const CASES: PostingRowsCase[] = [
  {
    name: 'a first order makes version 1 from what the customer chose and marks the design ordered',
    input: input([line('l_6120', 1)], { design: [design('draft')], versions: [] }),
    expect: { rows: [{ op: 'insert', table: 'design_versions', values: { app: 'maker', design_id: 1, version: 1, values: VALUES, note: null } }, { op: 'update', table: 'designs', key: { id: 1 }, set: { state: 'ordered' } }] },
  },
  {
    name: 'a repeat order of a design that did not change makes no version',
    input: input([line('l_7001', 1)], { design: [design('ordered')], versions: [{ id: 9, design_id: 1, version: 1, values: VALUES }] }),
    expect: { rows: [] },
  },
  {
    name: 'an ordered design the shop changed for a proof is snapshotted as the next version',
    input: input([line('l_7002', 1)], { design: [design('ordered', JSON.stringify({ format: 1, parts: { sign: { text: 'Iris’s Books', size: 12 } } }))], versions: [{ id: 9, design_id: 1, version: 1, values: VALUES }, { id: 10, design_id: 1, version: 2, values: VALUES }] }),
    expect: { rows: [{ op: 'insert', table: 'design_versions', values: { version: 3 } }] },
  },
  {
    name: 'two lines of one design in one save make one version',
    input: input([line('l_1', 1), line('l_2', 1)], { design: [design('draft')], versions: [] }),
    expect: { rows: [{ op: 'insert', table: 'design_versions', line: 'l_1', values: { version: 1 } }, { op: 'update', table: 'designs', line: 'l_1' }] },
  },
  {
    name: 'a design that is not there any more is refused',
    input: input([line('l_6120', 404)], { design: [], versions: [] }),
    expect: { refusals: [{ line: 'l_6120', reason: 'not-valid' }] },
  },
];

postingRowsConformance(provider, {
  ledgers: { [ledger.id]: { writes: ledger.writes } },
  cases: CASES,
  source: builtCheck(),
});

describe('what the shared suite does not compare', () => {
  it('writes the whole answer of each case, and nothing more', () => {
    expect(provider.rows(CASES[0]!.input).rows).toHaveLength(2);
    expect(provider.rows(CASES[3]!.input).rows).toHaveLength(2);
    expect(provider.rows(CASES[4]!.input).rows).toEqual([]);
  });

  it('compares what a design holds, not how its text was spelled', () => {
    const reordered = JSON.stringify({ parts: { sign: { size: 10, font: 'Cormorant Garamond', text: 'Iris’s Books' } }, finish: 'engraved', format: 1 });
    expect(provider.rows(input([line('l', 1)], { design: [design('ordered', reordered)], versions: [{ id: 9, design_id: 1, version: 1, values: VALUES }] })).rows).toEqual([]);
  });

  it('is the same file that answers the design question', () => {
    expect(typeof provider.check).toBe('function');
    expect(manifest.addOn.provides.map((one) => one.server)).toEqual(['dist/check.js', 'dist/check.js']);
  });
});
