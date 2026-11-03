/**
 * THE DESIGN QUESTION, ANSWERED BY THE BUILT FILE.
 *
 * `design-check@1` ships a conformance suite: an answer of the declared shape,
 * every line answered once, a design that stands with no refusals and one
 * that does not with at least one, the same answer twice, and a dry run
 * answered as the save is. It runs here over every case, against the file an
 * install runs, in the bare context a save runs it in (no clock, no `Intl`,
 * no module loader).
 *
 * Then what the suite cannot know: that the browser's rules and the built
 * file give the same refusals and the same features for every case, so what
 * the customer was told is what the order is held to; and that a question of
 * the most lines Adminium asks at once is answered well inside its 250 ms.
 */
import { CHECK_LINES_MAX, checkAnswerIssues, type CheckInput } from '@adminium/add-on-contracts';
import { designCheckConformance } from '@adminium/add-on-contracts/testing';
import { describe, expect, it } from 'vitest';

import { CHECK_CASES, TABLES } from './cases/check.cases.ts';
import { check } from './question/answer.ts';
import { checkDesign } from './rules/index.ts';
import { buildForReal } from './testing/build.ts';
import { browserFacts, checkInput, checkLine } from './testing/samples.ts';
import { builtCheck, builtProvider, CALL_TIMEOUT_MS, FILE_MAX_BYTES } from './testing/vm.ts';

// Built before the suite is registered.
buildForReal();
const provider = builtProvider();

designCheckConformance(provider, { cases: CHECK_CASES.map(({ name, input, expect: wanted }) => ({ name, input, expect: wanted })) });

describe('the built file', () => {
  it('is small enough for Adminium to run, and exports only the answer', () => {
    expect(Buffer.byteLength(builtCheck())).toBeLessThan(FILE_MAX_BYTES);
    expect(builtCheck()).toMatch(/module\.exports\s*=/);
  });

  it('answers as the source does', () => {
    for (const one of CHECK_CASES) expect(provider.check(one.input), one.name).toEqual(check(structuredClone(one.input)));
  });

  it('answers a line Adminium could not read the design of as unknown, never by throwing', () => {
    const input: CheckInput = { ...CHECK_CASES[0]!.input, lines: [{ key: 'bare', design: {}, rows: {}, paid: [], files: [] }] };
    const answer = provider.check(input);
    expect(checkAnswerIssues(input, answer)).toEqual([]);
    expect(answer.lines).toEqual([{ key: 'bare', ok: false, used: [], refusals: [{ reason: 'format-unknown' }] }]);
  });
});

describe('the browser and the server give one answer', () => {
  for (const one of CHECK_CASES) {
    it(one.name, () => {
      const served = provider.check(one.input);
      for (const line of one.lines) {
        const browser = checkDesign(browserFacts(line.design, TABLES, line.files));
        const server = served.lines.find((candidate) => candidate.key === line.key)!;
        expect({ ok: server.ok, refusals: server.refusals, used: server.used }, line.key).toEqual({ ok: browser.ok, refusals: browser.refusals, used: browser.used });
      }
    });
  }
});

describe('in time', () => {
  it(`answers ${String(CHECK_LINES_MAX)} lines at once well inside ${String(CALL_TIMEOUT_MS)} ms`, () => {
    const lines = CHECK_CASES.flatMap((one) => one.lines);
    const many = Array.from({ length: CHECK_LINES_MAX }, (_, i) => lines[i % lines.length]!);
    const input = checkInput(many.map((line, i) => checkLine(`${line.key}-${String(i)}`, line.design, TABLES, line.files, line.paid)));
    provider.check(input);
    const times: number[] = [];
    for (let run = 0; run < 5; run += 1) {
      const started = performance.now();
      const answer = provider.check(input);
      times.push(performance.now() - started);
      expect(answer.lines).toHaveLength(CHECK_LINES_MAX);
    }
    const one = CHECK_CASES[0]!.input;
    const single: number[] = [];
    for (let run = 0; run < 5; run += 1) {
      const started = performance.now();
      provider.check(one);
      single.push(performance.now() - started);
    }
    // The figures, for the record: a fresh bare context for each call, as a save makes one.
    console.info(`design check: one design ${Math.max(...single).toFixed(1)} ms at most, ${String(CHECK_LINES_MAX)} designs ${Math.max(...times).toFixed(1)} ms at most`);
    expect(Math.max(...single)).toBeLessThan(25);
    expect(Math.max(...times)).toBeLessThan(CALL_TIMEOUT_MS / 2);
  });
});
