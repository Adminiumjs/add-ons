/**
 * WHY EACH OFFER APPLIES, OR DOES NOT.
 *
 * Somebody setting an offer up tries it on a real order and wants to see, for
 * every offer there is, whether it applied and for how much — or the first
 * reason it did not: switched off, outside its hours, under its minimum, lost
 * to a better one.
 */

import type { AdjustOutput } from '@adminium/add-on-contracts';

import { fromUnits } from '../units.ts';
import type { Miss, Offer, Taken } from './standing.ts';

export function explained(offers: readonly Offer[], misses: ReadonlyMap<string, Miss>, taken: readonly Taken[], scale: number): NonNullable<AdjustOutput['explain']> {
  return offers.map((offer) => {
    const given = taken.filter((one) => one.source.offer === offer.id).reduce((total, one) => total + one.total, 0n);
    if (given > 0n) return { offer: offer.id, applies: true, amount: fromUnits(given, scale) };
    const miss = misses.get(offer.id);
    return { offer: offer.id, applies: false, ...(miss === undefined ? {} : { reason: miss.reason }) };
  });
}
