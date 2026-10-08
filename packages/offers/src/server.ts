/**
 * THE FILE THAT DECIDES.
 *
 * Adminium asks this add-on two questions, inside the save that needs the
 * answer. `adjust`: what do this order's reductions come to, line by line?
 * `rows`: which rows does this use, this card payment, this sale make? Both
 * are plain functions of what they are handed: nothing is read from anywhere,
 * no clock is looked at, and the same input always gives the same answer.
 * Adminium reads, checks the answer and writes; this file only decides.
 */

import { adjust } from './adjust/index.ts';
import { rows } from './rows/index.ts';

export default { rows, adjust };
