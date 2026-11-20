/**
 * WHICH ROWS A POSTING MAKES.
 *
 * One ledger, `value`, and twelve actions: a use of an offer, a card paying,
 * money back to a card, value put on one (and the card a sale makes), a card
 * a sale loaded cancelled with the sale, a manager's hand, a card closed, a
 * voucher used or sold or made, an old card brought in. Adminium calls with
 * everything the answer may depend on and writes what comes back itself.
 * Whether the call is a look ahead, a dry run or the save changes nothing:
 * the same question has the same answer.
 *
 * A reverse refuses nothing. What a round wrote to a card's ledger is taken
 * back row by row; what it wrote as uses is given back.
 */

import type { PostingInput, PostingOutput } from '@adminium/add-on-contracts';

import { cardAction, close, issue, move, recall, refund, spend, unissue } from './cards.ts';
import { Answer, reverseCardRows } from './ledger.ts';
import { make, redeem, sell, voucherAction } from './uses.ts';

/** What a row that takes back another is called, by the action whose row it takes back. */
const TAKEN_BACK: Readonly<Record<string, string>> = { spend: 'refund', refund: 'adjust', issue: 'adjust', recall: 'adjust', 'card-action': 'adjust', void: 'adjust', expire: 'adjust', move: 'adjust' };

export function rows(input: PostingInput): PostingOutput {
  const answer = new Answer();
  const action = input.action;
  if (action === 'redeem') redeem(input, answer);
  else if (action === 'sell') sell(input, answer);
  // A sale undone gives back what it put on a till's card, and cancels a card it made whose order was never paid.
  else if (action === 'issue' && input.phase === 'reverse') unissue(input, answer);
  else if (input.phase === 'reverse') {
    const kind = TAKEN_BACK[action];
    if (kind === undefined && action !== 'voucher-action' && action !== 'make') throw new Error(`an action this ledger does not have: ${action}`);
    if (kind !== undefined) reverseCardRows(input, answer, kind);
  } else if (action === 'spend') spend(input, answer);
  else if (action === 'refund') refund(input, answer);
  else if (action === 'recall') recall(input, answer);
  else if (action === 'issue') issue(input, answer);
  else if (action === 'card-action') cardAction(input, answer);
  else if (action === 'void') close(input, answer, 'void');
  else if (action === 'expire') close(input, answer, 'expire');
  else if (action === 'voucher-action') voucherAction(input, answer);
  else if (action === 'make') make(input, answer);
  else if (action === 'move') move(input, answer);
  else throw new Error(`an action this ledger does not have: ${action}`);
  return answer.out(input.phase);
}
