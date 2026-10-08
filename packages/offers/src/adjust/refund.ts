/**
 * AN ORDER PRICED AGAIN FOR A RETURN.
 *
 * When something is given back, Adminium asks what the order would cost
 * WITHOUT the returned lines (`kept: false` on each) and refunds the
 * difference. The order earned the offers it had on the day it was made: who
 * was buying, whether an offer still runs, whether a code has uses left are
 * not asked again — Adminium hands in only the offers the order took, with
 * the clock set to when they were applied. What IS asked again is everything
 * that depends on what is left in the basket: a pair that is no longer a
 * pair, a minimum no longer met, a percent of a smaller amount.
 */

import type { AdjustInput } from '@adminium/add-on-contracts';

/** Whether this question prices what is kept of an order already made. */
export const earned = (input: AdjustInput): boolean => input.mode === 'refund';
