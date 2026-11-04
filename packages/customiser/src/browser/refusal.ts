/**
 * A DESIGN THE SHOP'S ORDER REFUSED, AS THE EDITOR SHOWS IT.
 *
 * When the app's order is refused because of a design (Adminium asked the
 * Customiser, and a line's design does not stand), the public client's
 * error carries the reason and the part: `PUBLIC_WRITE_REFUSED` with
 * `reason` from the closed list and `part`. The app hands this to the
 * editor as `refused`, which shows it at the part's field and in the checks.
 */
import { REASONS, type Refusal } from '../rules/index.ts';

export function designRefusal(error: unknown): Refusal | null {
  if (typeof error !== 'object' || error === null) return null;
  const { code, params } = error as { code?: unknown; params?: unknown };
  if (code !== 'PUBLIC_WRITE_REFUSED' || typeof params !== 'object' || params === null) return null;
  const { reason, part } = params as { reason?: unknown; part?: unknown };
  if (typeof reason !== 'string' || !(REASONS as readonly string[]).includes(reason)) return null;
  return typeof part === 'string' && part !== '' ? { reason: reason as Refusal['reason'], part } : { reason: reason as Refusal['reason'] };
}
