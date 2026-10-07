/**
 * WHAT A POSTING INTO THE STOCK LEDGER WRITES.
 *
 * Adminium calls `rows(input)` inside the save of a row that posts here, with
 * the lines to work out, the rows it read for them and the one settings row.
 * The answer is the rows to insert or update, or the lines that are refused;
 * Adminium checks it and writes it with the row, or saves nothing.
 *
 * It is pure: the same input gives the same answer. The moment is `input.now`
 * and `input.today`, never a clock of its own.
 */
import type { PostingInput, PostingOutput } from '@adminium/add-on-contracts';

function rows(_input: PostingInput): PostingOutput {
  return { rows: [] };
}

export default { rows };
