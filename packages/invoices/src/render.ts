/**
 * The exported read surface — rendering a document from a host record, in a
 * page, with no server (holiday-calendars' shape, `index.ts:172`).
 *
 * ── WHY THIS EXISTS WHEN `server.ts` ALREADY DOES ──────────────────────────
 *
 * They are the same renderer. `server.ts` is the entry the ENGINE imports when
 * a stored profile names this add-on; this is the entry a SLOT FILL calls when
 * somebody presses a button on a record screen and there is nothing to wait
 * for. Both go through the same `InvoiceDocumentRenderer`, which is what makes
 * "the bytes are the same either way" a fact rather than an intention —
 * `conformance.test.ts` renders one mapping both ways and compares.
 *
 * ── THE HOST MAPS; THIS VALIDATES ──────────────────────────────────────
 *
 * `record` arrives already keyed by the outline's slot ids, because the mount
 * site did that (`host/subjectFromHost.ts` says why at length). Nothing here
 * guesses at a column name.
 */

import type { DocumentError, RenderedDocument } from '@adminium/add-on-host/contracts';

import { MissingSlotError, subjectFromHost } from './host/subjectFromHost.ts';
import { renderSync } from './server.ts';
import { settingsFrom, type InvoiceSettings } from './settings.ts';

export interface RenderRequest {
  readonly kind: string;
  /** The host's mapping: slot ids to values, made at the mount site. */
  readonly record: Readonly<Record<string, unknown>>;
  readonly recordId: string;
  /** The host's clock fact. Never a clock read here (25 D12). */
  readonly now: { readonly iso: string; readonly timezone?: string };
  readonly settings: InvoiceSettings | Readonly<Record<string, unknown>>;
  readonly locale?: string;
  readonly currency?: string;
}

function asSettings(value: RenderRequest['settings']): InvoiceSettings {
  return 'businessName' in value ? (value as InvoiceSettings) : settingsFrom(value);
}

/**
 * The settings back in the manifest's own key names — what the provider is
 * handed on the server, so the page and the server draw from one shape.
 */
function settingValues(settings: InvoiceSettings): Readonly<Record<string, unknown>> {
  return {
    business_name: settings.businessName,
    business_lines: settings.businessLines,
    logo_data_url: settings.logoDataUrl,
    tax_name: settings.taxName,
    tax_number: settings.taxNumber,
    payment_instructions: settings.paymentInstructions,
    footer: settings.footer,
    show_payment_ledger: settings.showPaymentLedger,
  };
}

/**
 * Draw a document, synchronously, from a record in front of somebody.
 *
 * SYNCHRONOUS on purpose, where the contract's `render` is async: a button in
 * a page has nothing to await, and a promise here would make every fill wire
 * up a loading state for work that takes a millisecond. The provider's own
 * `render` is synchronous inside and only wraps its result — see `server.ts`.
 */
export function renderDocument(
  request: RenderRequest,
): readonly RenderedDocument[] | DocumentError {
  const settings = asSettings(request.settings);

  let subject;
  try {
    subject = subjectFromHost(
      { fields: request.record, collections: collectionsOf(request.record) },
      request.kind,
      {
        now: { iso: request.now.iso, timezone: request.now.timezone ?? 'UTC' },
        locale: request.locale ?? 'en-US',
        currency: request.currency ?? 'USD',
        business: {
          name: settings.businessName,
          lines: settings.businessLines,
          ...(settings.logoDataUrl === '' ? {} : { logoDataUrl: settings.logoDataUrl }),
          ...(settings.taxNumber === '' ? {} : { taxNumber: settings.taxNumber }),
          ...(settings.paymentInstructions === '' ? {} : { paymentInstructions: settings.paymentInstructions }),
          ...(settings.footer === '' ? {} : { footer: settings.footer }),
        },
        entity: null,
        number: null,
      },
    );
  } catch (error) {
    // `subjectFromHost` THROWS where the contract RETURNS, because its caller
    // is a developer wiring a mount site. Here the caller is a button, so the
    // throw is turned back into the contract's own refusal.
    if (error instanceof MissingSlotError) {
      return { code: 'MISSING_SLOT', detail: error.slots.join(', ') };
    }
    throw error;
  }

  /*
   * `renderSync`, not `provider.render`. The contract's member returns a
   * promise, and a click handler cannot await one and still hand bytes to a
   * download in the same gesture — an earlier draft of this file called
   * `.then()` and returned the placeholder it had initialised, every time.
   * The provider's own work is synchronous; `server.ts` exports it under this
   * name so both entry points run the same code rather than two that agree
   * today.
   */
  return renderSync({
    kind: request.kind,
    subject,
    formats: settings.defaultFormats,
    paper: request.kind === 'receipt' ? 'receipt-80mm' : settings.paper,
    settings: settingValues(settings),
  });
}

/** The collection-shaped entries of a mapping — arrays of row objects. */
function collectionsOf(
  record: Readonly<Record<string, unknown>>,
): Record<string, readonly Readonly<Record<string, unknown>>[]> {
  const out: Record<string, readonly Readonly<Record<string, unknown>>[]> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!Array.isArray(value)) continue;
    const rows = value.filter(
      (entry): entry is Record<string, unknown> =>
        typeof entry === 'object' && entry !== null && !Array.isArray(entry),
    );
    if (rows.length === value.length) out[key] = rows;
  }
  return out;
}
