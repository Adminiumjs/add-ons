/**
 * THE MAPPING IS INVERTED — THE HOST MAPS, THIS ADD-ON VALIDATES.
 *
 * This file is the whole of that decision (34 §5.3), and the decision is worth
 * more than the forty lines under it.
 *
 * The obvious design is the other one: the add-on ships a table for each
 * host it knows about — a `sale` becomes a receipt this way, an `order`
 * becomes an invoice that way. It is obvious and it is wrong twice over.
 *
 *   IT MAKES THE ADD-ON NAME ITS HOSTS. A table for the till's `sale` shape
 *   puts the word `point-of-sale` inside a package that is supposed to serve
 *   any deployment, and `sources.test.ts` in every add-on here greps for
 *   exactly that. The trap is known to run the other way too — a host naming
 *   one add-on has no add-on layer — and it runs this way just as easily.
 *
 *   AND THE ALTERNATIVE IS NOT A PRODUCT. The other way to avoid naming hosts
 *   is to make a shop owner hand-edit a JSON mapping in a settings panel.
 *   Nobody does that, and a feature nobody uses is a feature that is broken
 *   and silent about it.
 *
 * So the HOST maps its own record onto the outline's slot ids at the mount
 * site — `record: subjectFieldsOf(sale)` keyed by `describe('receipt')` — and
 * this function checks that mapping against the outline. A fourth host is a
 * mount-site mapping and nothing else; this package names no host; and the
 * refusal, when a mapping is short, is TYPED rather than a document with a
 * blank where the customer's name should be.
 *
 * `holiday-calendars` settled this shape first, for day-sets. It is the same
 * shape for the same reason.
 */

import type { DocumentSubject } from '@adminium/add-on-host/contracts';

import { describe } from '../kinds.ts';

export interface HostMapping {
  /** Scalar slots by id. Money in integer minor units, percent in basis points. */
  readonly fields: Readonly<Record<string, unknown>>;
  readonly collections?: Readonly<
    Record<string, readonly Readonly<Record<string, unknown>>[]>
  >;
}

export interface HostContext {
  /** The host's own clock fact — never read from `Date` here (25 D12). */
  readonly now: { readonly iso: string; readonly timezone: string };
  readonly locale: string;
  readonly currency: string;
  /** The letterhead; the last four are optional, as the contract's newer fields are. */
  readonly business: {
    readonly name: string;
    readonly lines: readonly string[];
    readonly logoDataUrl?: string;
    readonly taxNumber?: string;
    readonly paymentInstructions?: string;
    readonly footer?: string;
  };
  /** `null` where the host has no durable record yet — a till before a sale is saved. */
  readonly entity: DocumentSubject['entity'];
  /** `null` until the engine mints one. */
  readonly number: string | null;
}

export class MissingSlotError extends Error {
  readonly code = 'MISSING_SLOT';
  /** Every slot that was short, not just the first. */
  readonly slots: readonly string[];

  constructor(slots: readonly string[]) {
    super(`the host mapping has no value for: ${slots.join(', ')}`);
    this.name = 'MissingSlotError';
    this.slots = slots;
  }
}

/**
 * A host mapping → a subject this provider will render, or a typed refusal.
 *
 * THIS THROWS WHERE `render` RETURNS. The two are different audiences on
 * purpose: `render` is called by the engine's job runner with a stored profile,
 * where a refusal is data to record against the document row; this is called
 * from a host's own mount site, at build time, where a mapping missing a
 * required slot is a MISTAKE IN THE HOST'S CODE and should stop the developer
 * writing it rather than produce a runtime value they then have to inspect.
 * The kit's tier-1 guard (34-T28) asserts the same rule at build time for the
 * same reason.
 */
export function subjectFromHost(
  mapping: HostMapping,
  kind: string,
  context: HostContext,
): DocumentSubject {
  const outline = describe(kind);

  const missing = outline.slots
    .filter((slot) => slot.required && slot.default === undefined)
    .filter((slot) => {
      const value = mapping.fields[slot.id];
      return value === undefined || value === null || value === '';
    })
    .map((slot) => slot.id);

  if (missing.length > 0) throw new MissingSlotError(missing);

  return {
    now: { iso: context.now.iso, timezone: context.now.timezone },
    locale: context.locale,
    currency: context.currency,
    // Spread rather than listed: the letterhead fields a newer contract adds
    // ride through to the renderer, which reads each only when it is there.
    business: { ...context.business, lines: [...context.business.lines] },
    entity: context.entity,
    number: context.number,
    fields: { ...mapping.fields },
    collections: { ...(mapping.collections ?? {}) },
  };
}

/** The slot ids a host has to supply for `kind`, so a mount site can be checked. */
export function requiredSlotsFor(kind: string): readonly string[] {
  return describe(kind)
    .slots.filter((slot) => slot.required && slot.default === undefined)
    .map((slot) => slot.id);
}
