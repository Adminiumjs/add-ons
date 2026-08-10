/**
 * `describeShippingCarrier` — COPIED VERBATIM from
 * `@adminium/add-on-contracts/testing` (24 §5.5, D9), with only the import
 * paths changed to the local mirror.
 *
 * The suite is part of the contract, not a courtesy. THE CLAIM THE DELIVERY
 * ADD-ON EXISTS TO MAKE — "each delivery company is its own add-on, and the
 * next one is that package with `carrier.ts` replaced" — rests entirely on this
 * file passing against BOTH transports. Without it the claim is a sentence in a
 * document.
 *
 * Do not soften an assertion here to make an implementation pass. If a
 * transport cannot satisfy it, the transport is wrong, or the contract needs a
 * version bump in the package these lines were copied from — and then here.
 */

import { describe, expect, it } from 'vitest';

import {
  CarrierError,
  type Address,
  type OrderRef,
  type Parcel,
  type ShippingCarrier,
} from '../contracts/shipping-carrier.ts';
import { rateSchema, shipmentSchema, trackEventSchema } from './schemas.ts';

export interface ShippingCarrierFixtures {
  parcel: Parcel;
  from: Address;
  to: Address;
  /** An address the carrier refuses — the failure path must be demonstrable. */
  rejectedTo: Address;
  order: OrderRef;
}

export function describeShippingCarrier(
  impl: ShippingCarrier,
  fixtures: ShippingCarrierFixtures,
): void {
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
      expect(b).toEqual(a);
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

    it('books a shipment of the declared shape', async () => {
      const [rate] = await impl.quote(fixtures.parcel, fixtures.from, fixtures.to);
      expect(rate).toBeDefined();
      const shipment = await impl.book(rate!, fixtures.order);
      const parsed = shipmentSchema.safeParse(shipment);
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    });

    it('book is idempotent for one OrderRef', async () => {
      const [rate] = await impl.quote(fixtures.parcel, fixtures.from, fixtures.to);
      const first = await impl.book(rate!, fixtures.order);
      const second = await impl.book(rate!, fixtures.order);
      expect(second.id).toBe(first.id);
      expect(second.tracking).toBe(first.tracking);
    });

    it('tracks a booked shipment with events of the declared shape', async () => {
      const [rate] = await impl.quote(fixtures.parcel, fixtures.from, fixtures.to);
      const shipment = await impl.book(rate!, fixtures.order);
      const events = await impl.track(shipment.tracking);
      expect(events.length).toBeGreaterThan(0);
      for (const event of events) {
        const parsed = trackEventSchema.safeParse(event);
        expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
      }
    });

    it('returns empty rather than throwing for an unknown tracking reference', async () => {
      await expect(impl.track('no-such-reference-0000')).resolves.toEqual([]);
    });

    it('produces a label file for a booked shipment', async () => {
      const [rate] = await impl.quote(fixtures.parcel, fixtures.from, fixtures.to);
      const shipment = await impl.book(rate!, fixtures.order);
      const file = await impl.label(shipment.id);
      expect(file.fileId.length).toBeGreaterThan(0);
      expect(file.bytes).toBeGreaterThan(0);
    });

    it('cancels a booked shipment without throwing', async () => {
      const [rate] = await impl.quote(fixtures.parcel, fixtures.from, fixtures.to);
      const shipment = await impl.book(rate!, fixtures.order);
      await expect(impl.cancel(shipment.id)).resolves.toBeUndefined();
    });
  });
}
