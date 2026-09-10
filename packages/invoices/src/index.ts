/**
 * `@adminium/add-on-invoices` — the client entry point, and the add-on's own
 * registration.
 *
 * ── WHAT THIS PACKAGE IS, IN ONE SENTENCE ──────────────────────────────────
 *
 * It turns a record into a document somebody can keep: an invoice, a receipt
 * or a credit note, drawn as a web page and — where the base-14 fonts can
 * draw the language — as a PDF, from values the host hands over and nothing
 * else.
 *
 * ── WHAT IT DELIBERATELY IS NOT ────────────────────────────────────────────
 *
 * It is not an accounting product and says so in every locale. It keeps no
 * ledger, tracks no balance, and its arithmetic is confined to adding up the
 * lines it was given under one written law (`money.ts`, 34 D20). "Total" on a
 * document from here is a total, never a "total due": recorded payments do not
 * reduce it, because there is no balance model behind it and "due" would be a
 * claim the document cannot support.
 *
 * It also does not decide WHICH column means what. That is the host's
 * projection at the mount site — see `host/subjectFromHost.ts`, which carries
 * the whole argument.
 */

import { createElement } from 'react';

import type { AddOn } from '@adminium/add-on-host';

import { strings } from './i18n/strings.ts';
import { DEFAULT_SETTING_VALUES } from './settings.ts';
import { DocumentAction } from './ui/DocumentAction.tsx';
import { SettingsPanel } from './ui/SettingsPanel.tsx';

export function register(): AddOn {
  return {
    key: 'invoices',
    /*
     * A NAME AND NOT A `nameKey`. The described-but-not-built shelf stubs use
     * `nameKey` because their "name" is a sentence that would sit in English
     * on an Arabic shelf. This is a real thing with a real name, and a
     * translated name is a different thing. Everything ABOUT it translates,
     * and does.
     */
    name: 'Invoices & Receipts',
    shortName: 'Invoices',
    lineKey: 'addon.invoices.line',
    whatKey: 'addon.invoices.what',
    // Three letters on a neutral tile. There is no mark to redraw here (24 D12
    // — this add-on names no company) and the tile is drawn the same way
    // regardless, because a shelf has to read as one system rather than as
    // twenty marks.
    monogram: 'INV',
    /*
     * `data` from the closed five (24 D2). Not `payments`, which is the
     * tempting one and is wrong: this add-on takes no money, moves none, and
     * knows nothing about whether anything was ever settled. It renders a
     * document from rows. What it adds to a deployment is a way to draw its
     * own data, which is what `data` means.
     */
    category: 'data',
    /*
     * NOTHING TO CONNECT TO. No credential, no account, no authorization step
     * — the fonts' metrics are compiled into the bundle the host already
     * loaded, and the figures are the deployment's own.
     */
    connect: 'none',
    permissions: [],
    settings: [],
    defaultSettings: { ...DEFAULT_SETTING_VALUES },
    // The host merges these into its own bundle at registration and asserts
    // that all eight locales carry every key of the English set.
    messages: strings,
    /*
     * D16, and it is easy to state honestly here: there is no credential to
     * remove, so the whole of "what goes" is the buttons, and the whole of
     * "what stays" is every document already made. Both halves are checked by
     * `packages/host/src/disconnect-copy.test.ts`, which fails an add-on that
     * puts a removal under the heading saying things survive.
     */
    disconnect: {
      goesKey: 'addon.invoices.disconnect.goes',
      staysKey: 'addon.invoices.disconnect.stays',
    },
    /*
     * The deployment's seeded record of using this add-on, newest first —
     * RELATIVE, and pinned to nobody's Wednesday. The host dates these against
     * its own clock with `resolveActivity`.
     *
     * BOTH LINES ARE SIMULATED RESULTS and both are paired with a demo label
     * (24 D11, 25 D9). `sources.test.ts` asserts the pairing by counting: a
     * seeded line without one is a fabricated fact on somebody's screen.
     */
    activity: [
      { minutesAgo: 24, messageKey: 'addon.invoices.activity.rendered' },
      { minutesAgo: 1_190, messageKey: 'addon.invoices.activity.sent' },
    ],
    /*
     * IT NAMES NO COMPANY, which for an add-on whose whole job is printing a
     * company's name deserves the distinction: the company on a document is
     * the OPERATOR'S, and it arrives in the subject at render time. See
     * `add-on-facts.ts` for the three places a supplier could have got in —
     * the paper sizes, the font, and the payment QR — and did not.
     */
    namesCompany: false,
    noCompanyKeys: ['addon.invoices.what'],
    fills: [
      /*
       * `render` returns an ELEMENT rather than calling a function that uses
       * hooks. The host maps over fills inside its own render, so a fill that
       * called `useState` directly would be borrowing the host component's
       * hook slots — stable today, broken the first time a fill is
       * conditional.
       */
      {
        slot: 'settings.add-on.panel',
        order: 10,
        render: (payload) => createElement(SettingsPanel, { payload }),
      },
      /*
       * `record.actions` — one opening on the screen where somebody is
       * already looking at ONE record, to do a thing to it. A document for the
       * row in front of you is exactly that shape, and it is the shape the
       * slot's own dossier named first: "per-record document renders (invoice,
       * folio, receipt…)".
       *
       * THE READ-ONLY HALF, ON PURPOSE. `patchRecord` is optional on this
       * payload and this fill ignores it (34 D18) — writing a number back
       * would mean choosing a field name, which is one shop's vocabulary
       * pushed onto every host. So it works identically in a host that offers
       * a write handle and in one that does not.
       */
      {
        slot: 'record.actions',
        order: 20,
        render: (payload) => createElement(DocumentAction, { payload }),
      },
    ],
  };
}

/** The strings the host merges into its own bundle before rendering any fill. */
export { strings } from './i18n/strings.ts';

/**
 * The exported read surface (holiday-calendars' shape).
 *
 * A host that wants a document without mounting a slot calls `renderDocument`;
 * a host wiring a mount site uses `subjectFromHost` to check its projection
 * against the outline before it ships. `kinds` and `describe` are what a
 * mount site reads to know what to project in the first place.
 */
export { renderDocument, type RenderRequest } from './render.ts';
export { subjectFromHost, requiredSlotsFor, MissingSlotError } from './host/subjectFromHost.ts';
export { kinds, describe } from './kinds.ts';
export { settingsFrom, DEFAULT_SETTINGS, LOGO_DATA_URL_MAX, type InvoiceSettings } from './settings.ts';
