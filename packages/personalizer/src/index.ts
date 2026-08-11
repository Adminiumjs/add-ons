/**
 * Live Personalizer — the add-on's registration (24 §8B).
 *
 * `register()` returns the object `@adminium/add-on-host` describes, and that
 * object is the whole public surface: the host's registry indexes it, the
 * dock's toggle flips it on and off, and its six fills are the only places this
 * add-on ever draws. There is no side effect on import — no global, no patched
 * host, no listener — which is what lets a host register it, unregister it, and
 * be back at exactly its base state (D6).
 *
 * `connect: "none"` is the honest answer and it changes what the connect dialog
 * shows: no credential form, no account, one click. The permission list is
 * still explicit, because "it needs nothing" is a claim a shop owner should be
 * able to read rather than infer from an empty form.
 */

import { createElement } from 'react';

import type { AddOn } from '@adminium/add-on-host';

import { FACE_IDS } from './faces.ts';
import { personalizerStrings } from './i18n/strings.ts';
import {
  AdminFill,
  LinePreviewFill,
  OrderLineFill,
  PersonalizeFill,
  RouteFill,
  SettingsFill,
} from './ui/fills.tsx';
import './styles/personalizer.css';

export function register(): AddOn {
  return {
    key: 'personalizer',
    // A name, not an i18n key: a translated product name is a different
    // product. Everything ABOUT the add-on below is a key and does translate.
    name: 'Live Personalizer',
    shortName: 'Live Personalizer',
    lineKey: 'addon.personalizer.line',
    whatKey: 'addon.personalizer.what',
    // Two letters in a neutral tile. Never a logo (D12) — and there is no
    // company here to have one.
    monogram: 'LP',
    category: 'artwork',
    connect: 'none',

    permissions: [
      { key: 'addon.personalizer.perm.readPieces' },
      { key: 'addon.personalizer.perm.saveDesigns' },
      { key: 'addon.personalizer.perm.storePreviews' },
      { key: 'addon.personalizer.perm.noAccount' },
    ],

    /*
     * MACHINE KEYS, matching `manifest.json` and the values the panel saves.
     * The words on the controls are in `ui/fills.tsx`, where the add-on renders
     * its own form — a host that translated a setting would be writing copy for
     * a product it does not own.
     */
    settings: [
      { key: 'offered_fonts', kind: 'multi', options: FACE_IDS },
      { key: 'proof_required', kind: 'boolean' },
      { key: 'default_finish', kind: 'multi', options: ['engraved', 'raised', 'printed', 'painted'] },
    ],

    defaultSettings: {
      // All five alphabets on. A shop that wants fewer turns them off; a shop
      // that does nothing gets everything the laser cuts.
      offered_fonts: [...FACE_IDS],
      // Default ON. The studio shows a picture and waits for a yes before
      // cutting, and the shop's own copy already says so — an add-on that
      // quietly switched it off would be overruling the shop's promise from
      // inside a settings panel.
      proof_required: true,
      default_finish: 'engraved',
    },

    // The host merges these into its own bundle at registration and refuses a
    // bundle that is not complete in all eight locales.
    messages: personalizerStrings,

    disconnect: {
      goesKey: 'addon.personalizer.disconnect.goes',
      staysKey: 'addon.personalizer.disconnect.stays',
    },

    /*
     * The shop's seeded record of using this add-on, newest first — RELATIVE,
     * and referring rather than naming.
     *
     * IT USED TO BE FOUR HOST FACTS WRITTEN DOWN IN AN ADD-ON'S REPO:
     * `2026-08-06`, `11:24`, and `BR-2284`/`BR-2281`. Those are Birch Row's
     * Thursday and Birch Row's paperwork, and the host printed all four
     * verbatim — so registering this add-on in Marlow Press, which is pinned to
     * Wednesday the 5th and has never issued a reference beginning `BR`, put
     * another shop's history on this shop's screen under neutral field names.
     * Nothing threw, because nothing anywhere compared them.
     *
     * So: how long ago, and WHICH OF YOUR OWN references. `resolveActivity`
     * dates them against the host's own pinned clock and hands them its own
     * recent records, which is the only party that can. Still no clock is read
     * here, so the list is the same list on every run and a screenshot taken
     * today matches the app in a year.
     *
     * The middle line carries no `refIndex` on purpose: drawing the areas on a
     * new piece is not about an order, and `act.2` takes no `{ref}`.
     */
    activity: [
      { minutesAgo: 316, refIndex: 0, messageKey: 'addon.personalizer.act.1' },
      { minutesAgo: 1_478, messageKey: 'addon.personalizer.act.2' },
      { minutesAgo: 1_862, refIndex: 1, messageKey: 'addon.personalizer.act.3' },
    ],

    /*
     * The host asks; it does not read `proof_required` itself. The switch is
     * this add-on's and the sentence the customer sees is the shop's, so the
     * question crosses the seam as a question rather than as a field name.
     */
    proofsArtwork: (settings) =>
      (settings as { proof_required?: boolean }).proof_required !== false,

    /**
     * FALSE, and the consequence is deliberate: the host renders "Adminium is
     * not affiliated with this company" only where a company is named, and this
     * add-on names none. It connects to nothing, calls nothing and needs no
     * account. Carrying a disclaimer about a company that does not exist would
     * be noise, and `TRADEMARKS.md` records the same fact in writing.
     */
    namesCompany: false,
    noCompanyKeys: ['addon.personalizer.noCompany', 'addon.personalizer.noAccount'],

    fills: [
      /*
       * NOT ONE CAST. Every `render` here used to end in `payload as …`, which
       * was not a style choice: `AddOnFill<never>` erased the parameter type, so
       * a cast was the only way in and the compiler never once compared what a
       * host passes with what these components read. The fill type is
       * parameterised by slot id now, so each `payload` arrives already typed as
       * that surface's payload — and a component reading a field the surface
       * does not carry fails to build in THIS repo rather than throwing in
       * somebody else's.
       */
      {
        slot: 'product.options.personalize',
        order: 10,
        render: (payload) => createElement(PersonalizeFill, { payload }),
      },
      {
        slot: 'cart.line.preview',
        order: 10,
        render: (payload) => createElement(LinePreviewFill, { payload }),
      },
      {
        slot: 'product.admin.panel',
        order: 10,
        render: (payload) => createElement(AdminFill, { payload }),
      },
      {
        slot: 'order.line.actions',
        order: 10,
        render: (payload) => createElement(OrderLineFill, { payload }),
      },
      {
        slot: 'nav.add-on.routes',
        order: 10,
        render: () => createElement(RouteFill),
      },
      {
        slot: 'settings.add-on.panel',
        order: 10,
        render: (payload) =>
          createElement(SettingsFill, { payload }),
      },
    ],
  };
}

// The engine and the contract implementation, for a host that wants them
// without the React half — the server side of a Phase B install, and the
// website's demo build, both do.
export { createProductPersonalizer, KEY, drawPreview, drawProduction } from './personalizer.ts';
export {
  check,
  fit,
  isRequired,
  previewSvg,
  productionSvg,
  toProductionPaths,
  defaultSizeMm,
  settingsFor,
  digestOf,
  LAYER_COLOUR,
  type Check,
  type Fit,
  type ProductionFile,
} from './template.ts';
export { FACES, FACE_IDS, FACE_LIST, faceOf, lineWidthMm, type Face, type FaceId } from './faces.ts';
export { MATERIALS, PIECES, pieceFor, type Piece } from './pieces.ts';
export { COASTER_TEMPLATE, SIGN_TEMPLATE, TEMPLATES, SAMPLE_LINES, sampleFor, sampleThat, templateFor } from './seed.ts';
export { personalizerStrings } from './i18n/strings.ts';
export { recall, remember, summarize, isReady } from './store.ts';
export { FILLED_SLOTS, DECLARED_SLOTS, PHASE_B_SLOTS } from './slots.ts';
export type { AddOn } from '@adminium/add-on-host';
export type {
  Personalization,
  ProductPersonalizer,
  Template,
  Verdict,
  Zone,
} from '@adminium/add-on-host/contracts';
