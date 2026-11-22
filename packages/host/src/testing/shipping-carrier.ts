/**
 * `describeShippingCarrier` — COPIED VERBATIM from
 * `@adminium/add-on-contracts/testing`, with only the import paths changed to
 * the local mirror.
 *
 * The suite is part of the contract, not a courtesy. THE CLAIM THE DELIVERY
 * ADD-ON EXISTS TO MAKE — "each delivery company is its own add-on, and the
 * next one is that package with `carrier.ts` replaced" — rests entirely on this
 * file passing against BOTH transports. Without it the claim is a sentence in a
 * document.
 *
 * Do not soften an assertion here to make an implementation pass. If a
 * transport cannot satisfy it, the transport is wrong, or the contract needs a
 * deliberate amendment in the package these lines were copied from — and then
 * here.
 */

import { describe, expect, it } from 'vitest';

import {
  CarrierError,
  type Address,
  type BookingDetails,
  type OrderRef,
  type Parcel,
  type Rate,
  type ShippingCarrier,
} from '../contracts/shipping-carrier.ts';
import {
  cancelResultSchema,
  carrierCredentialCheckSchema,
  rateSchema,
  recoveryResultSchema,
  shipmentDocumentFileSchema,
  shipmentSchema,
  trackEventSchema,
} from './schemas.ts';

export interface ShippingCarrierFixtures {
  parcel: Parcel;
  from: Address;
  to: Address;
  /** An address the carrier refuses — the failure path must be demonstrable. */
  rejectedTo: Address;
  order: OrderRef;
}

/**
 * ── WHAT A REAL CARRIER CANNOT PROMISE (ruled 2026-11-21) ───────────────────
 *
 * This is a deliberate amendment, in the same spirit as the inbound one below,
 * and the defaults keep every existing transport on the strict assertions. A
 * real label service buys a new label on every purchase call, so "buy this once"
 * is proved by the engine's booking ledger, across a second press, a reload and
 * a restart. A fake in-memory map that made a real transport pass here would be
 * exactly the guard that does not survive a restart.
 */
export interface ShippingCarrierTraits {
  /** `false` when every `book` call is a new purchase at the carrier. */
  bookIsIdempotent?: boolean;
  /** `false` when a new booking has no tracking events yet, as in a carrier's test mode. */
  eventsAfterBooking?: boolean;
}

/** A quote's handle and expiry are new on every quote. What it offers must not be. */
function offer(rate: Rate): Rate {
  const copy = { ...rate };
  delete copy.ref;
  delete copy.expiresAt;
  return copy;
}

export function describeShippingCarrier(
  impl: ShippingCarrier,
  fixtures: ShippingCarrierFixtures,
  traits: ShippingCarrierTraits = {},
): void {
  const details: BookingDetails = { parcel: fixtures.parcel, from: fixtures.from, to: fixtures.to };
  const bookOne = async () => {
    const [rate] = await impl.quote(fixtures.parcel, fixtures.from, fixtures.to);
    expect(rate).toBeDefined();
    return impl.book(rate!, fixtures.order, details);
  };

  describe(`shipping-carrier@1 conformance — ${impl.key}`, () => {
    it('has a non-empty key', () => {
      expect(impl.key).toMatch(/^[a-z][a-z0-9-]*$/);
    });

    it('quotes at least one rate, each of the declared shape', async () => {
      const rates = await impl.quote(fixtures.parcel, fixtures.from, fixtures.to);
      expect(rates.length).toBeGreaterThan(0);
      for (const rate of rates) {
        const parsed = rateSchema.safeParse(rate);
        expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
      }
    });

    it('quote is side-effect free — the same call twice gives the same rates', async () => {
      const a = await impl.quote(fixtures.parcel, fixtures.from, fixtures.to);
      const b = await impl.quote(fixtures.parcel, fixtures.from, fixtures.to);
      expect(b.map(offer)).toEqual(a.map(offer));
    });

    it('surfaces a refusal as a typed CarrierError carrying the carrier’s own message', async () => {
      await expect(
        impl.quote(fixtures.parcel, fixtures.from, fixtures.rejectedTo),
      ).rejects.toBeInstanceOf(CarrierError);

      try {
        await impl.quote(fixtures.parcel, fixtures.from, fixtures.rejectedTo);
        expect.unreachable('the rejected address should not have quoted');
      } catch (err) {
        expect(err).toBeInstanceOf(CarrierError);
        const carrier = err as CarrierError;
        expect(carrier.carrierMessage.trim().length).toBeGreaterThan(0);
        expect(carrier.code.trim().length).toBeGreaterThan(0);
      }
    });

    /*
     * ── THE INBOUND DIRECTION (ruled 2026-09-01) ────────────────────────────
     *
     * The contract is direction-agnostic and these two cases are what that
     * sentence means executably. A RETURN — a customer sending a parcel back to
     * the business — is the same contract with the route reversed: `quote(parcel,
     * from, to)` takes two addresses and has no opinion about which one is the
     * shop; `book` buys a prepaid label the SENDER applies, whoever the sender
     * is; `track` follows the parcel toward whoever is receiving it. No member
     * changes shape, which is why this is a conformance amendment and not a
     * version bump.
     *
     * The refusal is symmetric too, and that is a rule rather than a
     * convenience: a label must carry a resolvable address at BOTH ends, so a
     * carrier that would refuse an address as a recipient refuses it as a
     * sender. The case reuses `rejectedTo` deliberately — the fixture is "an
     * address the carrier refuses", and which end it sits at is not part of
     * what makes it refusable.
     */
    it('quote is direction-symmetric — the same route reversed still quotes', async () => {
      const rates = await impl.quote(fixtures.parcel, fixtures.to, fixtures.from);
      expect(rates.length).toBeGreaterThan(0);
      for (const rate of rates) {
        const parsed = rateSchema.safeParse(rate);
        expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
      }
    });

    it('refuses an unserviceable sender exactly as it refuses a recipient', async () => {
      await expect(
        impl.quote(fixtures.parcel, fixtures.rejectedTo, fixtures.to),
      ).rejects.toBeInstanceOf(CarrierError);
    });

    it('books a shipment of the declared shape', async () => {
      const shipment = await bookOne();
      const parsed = shipmentSchema.safeParse(shipment);
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    });

    it.runIf(traits.bookIsIdempotent !== false)('book is idempotent for one OrderRef', async () => {
      const [rate] = await impl.quote(fixtures.parcel, fixtures.from, fixtures.to);
      const first = await impl.book(rate!, fixtures.order, details);
      const second = await impl.book(rate!, fixtures.order, details);
      expect(second.id).toBe(first.id);
      expect(second.tracking).toBe(first.tracking);
    });

    it('tracks a booked shipment with events of the declared shape', async () => {
      const shipment = await bookOne();
      const events = await impl.track(
        shipment.tracking,
        shipment.carrierToken === undefined ? undefined : { carrierToken: shipment.carrierToken },
      );
      if (traits.eventsAfterBooking !== false) expect(events.length).toBeGreaterThan(0);
      for (const event of events) {
        const parsed = trackEventSchema.safeParse(event);
        expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
      }
    });

    it('returns empty rather than throwing for an unknown tracking reference', async () => {
      await expect(impl.track('no-such-reference-0000')).resolves.toEqual([]);
    });

    it('produces a label file for a booked shipment', async () => {
      const shipment = await bookOne();
      const file = await impl.label(shipment.id);
      expect(file.fileId.length).toBeGreaterThan(0);
      expect(file.bytes).toBeGreaterThan(0);
    });

    it('cancels a booked shipment and says what happened', async () => {
      const shipment = await bookOne();
      if (impl.requestCancel === undefined) {
        await expect(impl.cancel(shipment.id)).resolves.toBeUndefined();
        return;
      }
      const parsed = cancelResultSchema.safeParse(await impl.requestCancel(shipment.id));
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    });

    /*
     * The members below are optional, so a transport that has one answers for it
     * here. A transport without one skips the case rather than passing it.
     */
    it.runIf(impl.cancelStatus !== undefined)('reports a cancel request of the declared shape', async () => {
      const shipment = await bookOne();
      await impl.requestCancel?.(shipment.id);
      const parsed = cancelResultSchema.safeParse(await impl.cancelStatus!(shipment.id));
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    });

    it.runIf(impl.fetchDocument !== undefined)('fetches the label file itself', async () => {
      const shipment = await bookOne();
      const file = await impl.fetchDocument!(shipment.id, 'label');
      const parsed = shipmentDocumentFileSchema.safeParse(file);
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
      expect(file.kind).toBe('label');
    });

    it.runIf(impl.checkCredentials !== undefined)('reports a credential check of the declared shape', async () => {
      const parsed = carrierCredentialCheckSchema.safeParse(
        await impl.checkCredentials!({ country: fixtures.from.country }),
      );
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    });

    it.runIf(impl.recover !== undefined)('recovers a purchase it really made', async () => {
      const shipment = await bookOne();
      const result = await impl.recover!(fixtures.order);
      const parsed = recoveryResultSchema.safeParse(result);
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
      expect(result.outcome).toBe('found');
      if (result.outcome === 'found') expect(result.shipment.tracking).toBe(shipment.tracking);
    });

    it.runIf(impl.recover !== undefined)('never reports a purchase for an order it never booked', async () => {
      const result = await impl.recover!({ reference: 'no-such-order-0000' });
      const parsed = recoveryResultSchema.safeParse(result);
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
      expect(result.outcome).not.toBe('found');
    });
  });
}
