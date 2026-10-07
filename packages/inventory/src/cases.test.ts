/**
 * THE WORKED EXAMPLES, RUN.
 *
 * Every case is run against the source and against the built file, in the
 * bare context a save runs it in: the answers must be the ones written down,
 * and the same from both.
 */

import { beforeAll, describe, expect, it } from 'vitest';

import type { PostingRowsProvider } from '@adminium/add-on-contracts';

import server from './server/index.ts';
import { CASES } from './server/cases/index.ts';
import { buildForReal } from './testing/build.ts';
import { builtProvider } from './testing/vm.ts';

let built: PostingRowsProvider;
beforeAll(() => {
  buildForReal();
  built = builtProvider();
}, 180_000);

describe('the worked examples', () => {
  it('are each named once', () => {
    expect(CASES.length).toBeGreaterThan(20);
    expect(new Set(CASES.map((one) => one.name)).size).toBe(CASES.length);
  });

  it.each(CASES.map((one) => [one.name, one] as const))('%s', (_name, one) => {
    const answer = server.rows(structuredClone(one.input));
    if (one.expect.rows !== undefined) expect(answer.rows).toEqual(one.expect.rows);
    expect(answer.refusals ?? []).toEqual(one.expect.refusals ?? []);
    expect(answer.notes ?? []).toEqual(one.expect.notes ?? []);
    if (one.expect.words !== undefined) expect(answer.words).toEqual(one.expect.words);
    // The built file, in the bare context, says the same.
    expect(built.rows(structuredClone(one.input))).toEqual(JSON.parse(JSON.stringify(answer)));
  });
});
