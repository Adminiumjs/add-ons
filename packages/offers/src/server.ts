/**
 * THE FILE THAT DECIDES.
 *
 * Adminium asks this add-on two questions, inside the save that needs the
 * answer. `adjust`: what do this order's reductions come to, line by line?
 * `rows`: which rows does this use, this card payment, this sale make? Both
 * are plain functions of what they are handed: nothing is read from anywhere,
 * no clock is looked at, and the same input always gives the same answer.
 * Adminium reads, checks the answer and writes; this file only decides.
 *
 * Neither decides anything yet: an order keeps its price and a posting makes
 * no row.
 */

import type { AdjustInput, AdjustOutput, PostingInput, PostingOutput } from '@adminium/add-on-contracts';

/** The rows a posting makes. */
function rows(input: PostingInput): PostingOutput {
  void input;
  return { rows: [] };
}

/** What an order's reductions come to. */
function adjust(input: AdjustInput): AdjustOutput {
  return { lines: input.lines.map((line) => ({ key: line.key, discount: '0' })), order: { discount: '0' }, applied: [], uses: [], refused: [] };
}

export default { rows, adjust };
