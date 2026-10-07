/**
 * THE CONTRACT'S OWN CHECKS, OVER THE BUILT FILE.
 *
 * `posting-rows@1` ships a conformance suite: the answer has the contract's
 * shape and at most its rows, writes only the tables and columns the ledger
 * lets it, gives back exactly what a round wrote, never refuses a reverse,
 * and says the same twice. It is run here over every worked example, against
 * the file an install would run, in the bare context it would run it in.
 */

import { postingRowsConformance, type PostingRowsCase } from '@adminium/add-on-contracts/testing';

import manifest from '../manifest.json' with { type: 'json' };
import { CASES } from './server/cases/index.ts';
import { buildForReal } from './testing/build.ts';
import { builtProvider, builtServer } from './testing/vm.ts';

// Built before the suite is registered: its first check reads the file's own text.
buildForReal();

const [stock] = (manifest.addOn as unknown as { ledgers: { id: string; writes: Record<string, { insert?: string[]; update?: { by: string[]; set: string[] } }> }[] }).ledgers;
if (stock === undefined) throw new Error('the manifest declares no ledger');

postingRowsConformance(builtProvider(), {
  ledgers: {
    [stock.id]: {
      writes: stock.writes,
      // What a round and its reverse must bring back to nothing.
      sums: { movements: ['qty'], on_order_moves: ['qty'] },
    },
  },
  cases: CASES.map((one): PostingRowsCase => ({
    name: one.name,
    input: one.input,
    expect: { ...(one.expect.rows === undefined ? {} : { rows: one.expect.rows as unknown as Record<string, unknown>[] }), ...(one.expect.refusals === undefined ? {} : { refusals: one.expect.refusals }) },
  })),
  source: builtServer(),
});
