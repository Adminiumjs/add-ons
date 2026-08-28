/**
 * What the host gets when it registers this add-on.
 *
 * One function returning one plain object. No side effects at import time, no
 * global registration, no reaching into the host: the host asks, the add-on
 * answers, and everything the host needs to draw a shelf row and two surfaces
 * is in the value it gets back.
 *
 * SCOPE, stated where somebody would come looking to widen it (24 §7): this
 * gives a catalogue row a number, checks that the number is well formed, and
 * draws a sheet of labels for one row. It is not a stock system, not a till,
 * not a numbering authority and not a scanner. The last of those is the one
 * worth naming, because it is what everybody assumes an add-on called this
 * would do — see the header on the record fill below.
 *
 * ── WHAT THIS OBJECT LEAVES OUT, AND WHY EACH ABSENCE IS A DECISION ────────
 *
 * `demoSwitch` — absent. It exists so a credentialled add-on can offer "use a
 * stand-in instead of calling the real service" (24 D11). Nothing here calls
 * anything, so there is nothing to stand in for, and a switch offering to
 * disable a call that does not happen would be a lie in the connect dialog.
 *
 * `applySettings` — absent. Every engine in this package takes the values as an
 * ARGUMENT — `codeFor(values, sku)`, `assignCode(current, …)` — so there is no
 * module-level copy to keep in step, no push to miss, and no state that can be
 * one change behind what the shop last saved. A host that never calls
 * `applySettings` is not a host this add-on can be stale in.
 *
 * `permissions` — empty. It is what connecting LETS the add-on do, shown as
 * ticked rows before a shop agrees. This one reads one record it is handed,
 * writes no host record and reaches nowhere; the honest length of that list is
 * zero, and inventing a row so the dialog looked substantial would be asking
 * for a power to reassure somebody.
 *
 * `settings` — empty, which is NOT the same as storing nothing. `AddOn.settings`
 * is what the HOST's manage panel may render, and the host can only draw the
 * controls its vocabulary knows: a switch, a time, a text box, a multi-select.
 * What this add-on stores is a table of rows and their numbers, which is none
 * of those, and it is edited in `settings.add-on.panel` — the slot that exists
 * precisely so an add-on can own a form the host could not describe.
 * `manifest.json` still declares the key as a `json` setting, because an
 * installer should be able to see everything a package will write.
 */

import { createElement } from 'react';

import type { AddOn } from '@adminium/add-on-host';

import { strings } from './i18n/strings.ts';
import { RecordAction } from './ui/RecordAction.tsx';
import { SettingsPanel } from './ui/SettingsPanel.tsx';

export function register(): AddOn {
  return {
    key: 'barcode-labels',
    /*
     * A NAME AND NOT A `nameKey`. The described-but-not-built shelf stubs in
     * the host apps use `nameKey` because their "name" is a sentence — "a
     * second delivery company" — that would sit in English on an Arabic shelf.
     * This is a real thing with a real name, and a translated name is a
     * different thing. Everything ABOUT it translates, and does.
     */
    name: 'Barcode Labels',
    shortName: 'Labels',
    lineKey: 'addon.barcode-labels.line',
    whatKey: 'addon.barcode-labels.what',
    // Three letters on a neutral tile. There is no mark to avoid redrawing
    // here (D12) and the tile is drawn the same way regardless, because a shelf
    // has to read as one system rather than as twenty marks.
    monogram: 'LBL',
    /*
     * `data` from the closed five (24 D2). Not `operations`, which is an APP
     * facet and belongs to the other vocabulary — an add-on is not a vertical.
     * Of the five, `data` is the one this fits: what it adds to a shop is a
     * table of numbers and a way to draw them.
     */
    category: 'data',
    /*
     * NOTHING TO CONNECT TO. No credential, no account, no authorization step —
     * both symbol tables are compiled into the bundle the host already loaded,
     * and the numbers are the shop's own.
     */
    connect: 'none',
    permissions: [],
    settings: [],
    defaultSettings: { codes: [] },
    // The host merges these into its own bundle at registration and asserts
    // that all eight locales carry every key of the English set.
    messages: strings,
    /*
     * D16, and it is easy to state honestly here: there is no credential to
     * remove, so the whole of "what goes" is the two surfaces, and the whole of
     * "what stays" is the numbers and every label already printed. Both halves
     * are checked by `packages/host/src/disconnect-copy.test.ts`, which fails an
     * add-on that puts a removal under the heading saying things survive.
     */
    disconnect: {
      goesKey: 'addon.barcode-labels.disconnect.goes',
      staysKey: 'addon.barcode-labels.disconnect.stays',
    },
    /*
     * The shop's seeded record of using this add-on, newest first — RELATIVE,
     * and pinned to nobody's Wednesday. The host dates these against its own
     * clock with `resolveActivity`.
     *
     * NEITHER LINE NAMES A REFERENCE, and that is not an oversight. `refIndex`
     * points at one of the HOST's own paperwork references — an order, a job —
     * and an entry whose index the host cannot fill is dropped. What this
     * add-on acts on is a CATALOGUE ROW, which is not paperwork and has no
     * entry in that list. A line about nothing in particular is exactly what
     * `refIndex: undefined` is for.
     */
    activity: [
      { minutesAgo: 38, messageKey: 'addon.barcode-labels.act.1' },
      { minutesAgo: 1_615, messageKey: 'addon.barcode-labels.act.2' },
    ],
    /*
     * IT NAMES NO COMPANY. `noCompanyKeys` is what the host renders where the
     * not-affiliated line would otherwise go: an absent line is
     * indistinguishable from a forgotten one, so the positive fact is stated
     * instead, in the add-on's own words and in all eight locales. Both
     * symbologies are published standards and the numbers belong to the shop —
     * see `add-on-facts.ts` for the three places a company could have got in
     * and did not.
     */
    namesCompany: false,
    noCompanyKeys: ['addon.barcode-labels.noCompany'],
    fills: [
      /*
       * `render` returns an ELEMENT rather than calling a function that uses
       * hooks. The host maps over fills inside its own render, so a fill that
       * called `useState` directly would be borrowing the host component's hook
       * slots — stable today, broken the first time a fill is conditional.
       *
       * NO CAST. `payload` arrives already typed as this slot's payload,
       * because `AddOnFill` is parameterised by slot id; a component reading a
       * field the slot does not carry is a red build in this repository rather
       * than a throw in somebody else's.
       */
      {
        slot: 'settings.add-on.panel',
        order: 10,
        render: (payload) => createElement(SettingsPanel, { payload }),
      },
      /*
       * THE FIRST FILL OF `record.actions`, ANYWHERE.
       *
       * The slot was bought on 2026-08-28 and shipped unfilled; both the closed
       * registry and `payloads.ts` say so in their own words, and both say a
       * reader will not find a fill by grepping. This is it. What it is for, in
       * that registry's own phrasing, is one opening on the screen where
       * somebody is already looking at ONE record, to do a thing to it — and a
       * sheet of labels for the row in front of you is exactly that shape.
       *
       * IT IS THE READ-ONLY HALF OF THE SLOT, ON PURPOSE. `patchRecord` is
       * optional on this payload, and the payload's own comment explains that
       * hosts genuinely differ on whether an add-on may write back. This one
       * never writes at all — see `ui/RecordAction.tsx` for why giving it a
       * field name to write into would be one shop's vocabulary pushed onto
       * every host — so it works identically in a host that offers a handle and
       * in a host that does not, which is the strongest form the payload's
       * optionality can be honoured in.
       */
      {
        slot: 'record.actions',
        order: 10,
        render: (payload) => createElement(RecordAction, { payload }),
      },
    ],
  };
}

/** The strings the host merges into its own bundle before rendering any fill. */
export { strings } from './i18n/strings.ts';

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * THE READ SURFACE — the reason a host installs this rather than the surfaces
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Two pure functions over the values the host already holds.
 *
 * `codeFor(values, sku)` answers "what number does this row carry", and
 * `undefined` for a row nobody has given one to. A host calls it wherever it
 * lists its own catalogue and shows the number in its own column, with no
 * change to any engine it owns.
 *
 * `renderLabelSheet(facts)` is the whole of the drawing, as PDF bytes. A host
 * that wanted to make a sheet from its own screen — a stock take, a goods-in
 * bench — calls it with the same shape the record surface builds and gets the
 * same document, because the record surface has no privileged path.
 *
 * WHAT IS DELIBERATELY NOT HERE: the storage shape and the two encoders.
 * `STORAGE_KEY`, `readStored`, `assignCode` and the symbol tables exist for
 * this package's own surfaces and suites and go no further. A host that reached
 * into an add-on's storage would be coupled to a shape that is expected to
 * change; a host that reached for an encoder would be drawing a barcode with no
 * quiet zone and no idea how wide a module has to be, which is the failure this
 * whole package is careful about.
 */
export { assignedCodes, codeFor, type AssignedCode, type Symbology } from './codes.ts';
export {
  labelSheetFilename,
  labelsFor,
  renderLabelSheet,
  undrawableCharacters,
  type SheetFacts,
} from './sheet.ts';

/**
 * The limits a host or a marketplace listing would otherwise have to read the
 * source to find: how many labels come off one sheet, how many a single run may
 * ask for, and how long a Code 128 reference may be on this label.
 *
 * Public because they are the honest answer to "what can I get?", and because
 * the last of them is a REFUSAL a shop can meet — `codes.ts` names it in words
 * — and a limit somebody can be refused by should be a limit they can read.
 */
export { CODE128_MAX_LENGTH, LABELS_PER_SHEET, MAX_LABELS } from './geometry.ts';
