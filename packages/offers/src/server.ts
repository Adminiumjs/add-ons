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
 * A posting makes no row yet.
 */

import type { PostingInput, PostingOutput } from '@adminium/add-on-contracts';

import { adjust } from './adjust/index.ts';

/** The rows a posting makes. */
function rows(input: PostingInput): PostingOutput {
  void input;
  return { rows: [] };
}

export default { rows, adjust };
