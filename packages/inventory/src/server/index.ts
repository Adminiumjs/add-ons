/**
 * WHAT A POSTING INTO THE STOCK LEDGER WRITES.
 *
 * Adminium calls `rows(input)` inside the save of a row that posts here, with
 * the lines to work out, the rows it read for them and the one settings row.
 * The answer is the rows to insert or update, or the lines that are refused;
 * Adminium checks it and writes it with the row, or saves nothing.
 *
 * It is pure: the same input gives the same answer. The moment is `input.now`
 * and `input.today`, never a clock of its own. When a row it needs was not
 * handed to it, it throws: it never guesses.
 */
import type { PostingInput, PostingOutput } from '@adminium/add-on-contracts';

import { Book } from './book.ts';
import { giveBack } from './give-back.ts';
import { transfer } from './transfer.ts';
import { reverse, use } from './use.ts';
import { words } from './words.ts';

function rows(input: PostingInput): PostingOutput {
  const book = new Book(input);
  if (input.mode === 'words') {
    words(book, input.action === 'use-item');
    return book.output();
  }
  // Whatever the action, a round is undone by the opposite of what it wrote: nothing is worked out again.
  if (input.phase === 'reverse') {
    reverse(book);
    return book.output();
  }
  switch (input.action) {
    case 'use':
    case 'hold':
      use(book, false);
      break;
    case 'use-item':
      use(book, true);
      break;
    case 'return':
      giveBack(book);
      break;
    case 'transfer':
      for (const line of input.lines) transfer(book, line);
      break;
    default:
      throw new Error(`the stock ledger has no action "${input.action}"`);
  }
  return book.output();
}

export default { rows };
