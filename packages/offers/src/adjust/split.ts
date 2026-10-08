/**
 * ONE AMOUNT OVER SEVERAL LINES.
 *
 * A reduction of the whole order is shared out over its lines in proportion
 * to what each has left. Each share is rounded DOWN; the units left over go
 * one each to the largest remainders, the earlier line on a tie. So the
 * shares add up to the amount exactly: $5.00 over 28.00 / 15.00 / 6.50 is
 * 2.83 / 1.51 / 0.66, where rounding each share to the nearest cent would
 * give away $5.01.
 */

import { least, most, sum } from '../units.ts';

/** `total` in proportion to `weights`, to the unit, adding up to `total` exactly. */
export function proportion(total: bigint, weights: readonly bigint[]): bigint[] {
  const whole = sum(weights.map((one) => most(one, 0n)));
  if (total <= 0n || whole <= 0n) return weights.map(() => 0n);
  const shares = weights.map((one) => (most(one, 0n) * total) / whole);
  const remainders = weights.map((one, at) => ({ at, rest: (most(one, 0n) * total) % whole }));
  let over = total - sum(shares);
  for (const { at } of remainders.sort((a, b) => (a.rest === b.rest ? a.at - b.at : a.rest > b.rest ? -1 : 1))) {
    if (over <= 0n) break;
    shares[at] = shares[at]! + 1n;
    over -= 1n;
  }
  return shares;
}

/** A reduction shared over what each line has left; never more than there is, so no line goes below nothing. */
export function split(total: bigint, left: readonly bigint[]): bigint[] {
  return proportion(least(total, sum(left.map((one) => most(one, 0n)))), left);
}
