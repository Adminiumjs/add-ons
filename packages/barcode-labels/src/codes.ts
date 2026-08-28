/**
 * THE ADD-ON'S OWN MAPPING TABLE, AND THE TWO THINGS IT REFUSES.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * WHERE A CODE LIVES, AND WHY IT IS NOT ON THE HOST'S RECORD
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * `SettingsPanelPayload.patch` writes THE ADD-ON'S OWN VALUES. There is no slot
 * in the closed registry that lets an add-on add a column to a host's table,
 * and there should not be: a shop that removed this add-on would be left with a
 * column nothing maintains, in a table it did not design.
 *
 * So the map from a catalogue row to its barcode lives here, under this
 * add-on's own settings key, and the HOST reads it through `codeFor` at
 * whatever mount site wants it. That is the same arrangement `holiday-calendars`
 * uses for its day-sets, applied to a lookup instead of a list: the add-on says
 * what it knows in its own shape, and the host says what that means in its.
 *
 * ── AND THE KEY IT IS INDEXED BY IS THE HOST'S, WHICH IS THE SEAM ──────────
 *
 * A row is named by the host's own stable key for the thing it sells —
 * `CatalogueSample.key` on the settings surface, `RecordActionsPayload.recordId`
 * on the record one. This add-on never looks inside a record to work out which
 * row it is holding, and the reason is written at length in
 * `@adminium/add-on-host`'s `payloads.ts`: `recordId` exists precisely because
 * `id`, `ref`, `number` and `code` are all in use as the identity field across
 * the fifteen apps, and an add-on guessing between them is one shop's layout
 * leaking in by the back door.
 *
 * THE HONEST LIMIT OF THAT, SAID HERE AND SAID AGAIN ON SCREEN: this add-on
 * cannot check that the two namespaces meet. A host that mounts the record
 * surface on a screen whose `recordId` is not a catalogue key will find that
 * nothing it assigned in the settings form is ever found. There is no field on
 * either payload that would let the add-on notice, so instead of guessing it
 * NAMES THE KEY IT LOOKED UP in the empty state — an operator who sees a key
 * they do not recognise knows immediately what has happened, which is the most
 * an add-on on this seam can honestly do.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * THE TWO REFUSALS (25 D10)
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Both are refusals by a REAL RULE with a REAL FIX, and both exist because the
 * thing they prevent fails silently at a till rather than loudly here.
 *
 * ── ONE: THE CHECK DIGIT ───────────────────────────────────────────────────
 *
 * An EAN-13 carries its own checksum in its last digit. A thirteen-digit number
 * whose last digit is wrong is not a slightly-wrong barcode — it is not a
 * barcode: a scanner computes the check for itself and reports nothing at all,
 * so the label prints, looks right, goes on the box, and the failure surfaces
 * weeks later at somebody's counter with no clue attached.
 *
 * It is also the most fixable error there is, which is what makes it worth
 * refusing rather than warning about: this package knows exactly which digit
 * the first twelve demand, so the refusal NAMES IT. "The last digit should be
 * 7" is a refusal an operator clears in one keystroke.
 *
 * WHAT IT DOES NOT DO IS SILENTLY CORRECT IT. A number a shop typed is a number
 * a shop believes it owns; changing the last digit for them would hand back a
 * different article number from the one on their own paperwork, and they would
 * have no way to tell. The whole value of the refusal is that a person looks at
 * the two numbers.
 *
 * ── TWO: TWO ROWS, ONE CODE ────────────────────────────────────────────────
 *
 * A barcode is an identity. Two rows carrying the same one is not a duplicate
 * record — it is an AMBIGUITY, and it is resolved at the till by whichever row
 * the shop's own lookup happens to find first. That is the same class of
 * collision `holiday-calendars` refuses when an imported holiday lands on a day
 * somebody wrote in by hand, and it is refused here for the same reason: the
 * add-on is not entitled to pick, and picking silently is the worst of the
 * available behaviours.
 *
 * So the refusal names THE ROW THAT ALREADY HOLDS THE CODE, and the fix is to
 * change one of the two.
 *
 * IT COMPARES THE CODE TEXT AND IGNORES THE SYMBOLOGY, which is the part worth
 * reading twice. A scanner hands the till a string of characters and does not
 * say which symbology it came off; `5901234123457` drawn as an EAN-13 and the
 * same digits drawn as a Code 128 arrive identical. Comparing the pair
 * `(symbology, code)` would have let those two coexist and would have been
 * exactly wrong.
 *
 * ── AND WHAT IS *NOT* A COLLISION, WHICH IS THE HALF THAT KEEPS IT USABLE ──
 *
 * GIVING A ROW THE CODE IT ALREADY HAS. Re-assigning is how an operator changes
 * the symbology, or re-types a number to check it; refusing against the row's
 * own current code would make the form refuse the state it is already in. So
 * the duplicate check looks at OTHER rows only, and a re-assignment replaces.
 *
 * GIVING A ROW A DIFFERENT CODE. A row holds exactly one code — the second
 * assignment replaces the first rather than accumulating, which is what makes
 * the table idempotent under repeated pressing of one button.
 */

import type { AddOnSettingValues } from '@adminium/add-on-host';

import {
  encodeCode128,
  firstUndrawable,
  isSetB,
} from './code128.ts';
import { checkDigitFor, encodeEan13, isThirteenDigits } from './ean13.ts';
import { CODE128_MAX_LENGTH } from './geometry.ts';
import type { Modules } from './modules.ts';

/**
 * The one key this add-on stores anything under.
 *
 * `manifest.json` declares it as a `json` setting and lists it in
 * `publicSettings`, which is the manifest's way of saying the client bundle may
 * read it. It may: there is no credential in this package to keep out of a
 * browser, and the form that writes it is the only thing that reads it.
 */
export const STORAGE_KEY = 'codes';

/** The two symbologies this add-on draws. */
export type Symbology = 'ean13' | 'code128';

export const SYMBOLOGIES: readonly Symbology[] = ['ean13', 'code128'];

/** One catalogue row and the number given to it. */
export interface AssignedCode {
  /** The host's own stable key for the row. Never a field dug out of a record. */
  readonly sku: string;
  readonly symbology: Symbology;
  /** As the shop typed it, trimmed at the ends and not otherwise touched. */
  readonly code: string;
}

/**
 * Sorted by row key, so the table has an order that does not depend on which
 * code somebody happened to assign first.
 *
 * It matters more than tidiness: `writeStored` hands this straight to the host,
 * and a list whose order moved on every save would make every write look like a
 * change to anything watching the document.
 */
function ordered(codes: readonly AssignedCode[]): readonly AssignedCode[] {
  return [...codes].sort((a, b) => (a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0));
}

/**
 * READ WHAT IS THERE, BELIEVING NONE OF IT.
 *
 * The host holds an add-on's values as an opaque record and is right to — it
 * has no business knowing their types — which makes this the boundary where
 * they become typed. A document written by an older build of this add-on, or
 * hand-edited, has to come back as the entries that ARE readable rather than as
 * a throw in the middle of somebody's settings screen.
 *
 * AN ENTRY WHOSE CODE IS NOT DRAWABLE IS DROPPED, and that is the strict
 * reading on purpose. Everything else in this package assumes a stored code can
 * be encoded — `modulesFor` throws otherwise, deliberately — so admitting an
 * unencodable one here would move the failure from a quiet drop at the boundary
 * to an exception inside a render. A dropped entry is visible: the row shows as
 * having no code, in the form where a code is given.
 */
export function readStored(values: AddOnSettingValues | undefined): readonly AssignedCode[] {
  const raw = (values ?? {})[STORAGE_KEY];
  if (!Array.isArray(raw)) return [];

  const out: AssignedCode[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const sku = record['sku'];
    const symbology = record['symbology'];
    const code = record['code'];
    if (typeof sku !== 'string' || sku.trim() === '') continue;
    if (symbology !== 'ean13' && symbology !== 'code128') continue;
    if (typeof code !== 'string') continue;
    if (!isDrawable(symbology, code)) continue;
    // A document naming one row twice is a document one of whose entries is
    // going to be ignored whatever this does. Keeping the first is the only
    // choice that is stable under re-reading the same document.
    if (seen.has(sku)) continue;
    seen.add(sku);
    out.push({ sku, symbology, code });
  }
  return ordered(out);
}

/** Hand back to the host in the shape `patch` takes. */
export function writeStored(codes: readonly AssignedCode[]): Record<string, unknown> {
  return { [STORAGE_KEY]: ordered(codes) };
}

/** Can this code be drawn in this symbology at all? The shape question, not the rule one. */
export function isDrawable(symbology: Symbology, code: string): boolean {
  return symbology === 'ean13'
    ? isThirteenDigits(code)
    : code.length > 0 && code.length <= CODE128_MAX_LENGTH && isSetB(code);
}

// ── the refusals ────────────────────────────────────────────────────────────

/**
 * WHY A CODE WAS NOT TAKEN.
 *
 * Every variant carries whatever the sentence needs to name — the digit that
 * was expected, the character that cannot be drawn, the row that already holds
 * the number — because a refusal an operator cannot act on is an obstacle.
 * `ui/SettingsPanel.tsx` renders one message per variant and
 * `settings-panel.test.tsx` asserts that every variant this type can take has a
 * message, so a variant added here without copy is a red suite rather than a
 * blank red box on somebody's screen.
 */
export type Refusal =
  | { readonly why: 'noRow' }
  | { readonly why: 'empty' }
  | { readonly why: 'ean13Shape'; readonly given: number }
  | { readonly why: 'ean13Check'; readonly expected: number; readonly given: number }
  | { readonly why: 'code128Character'; readonly character: string }
  | { readonly why: 'code128TooLong'; readonly limit: number; readonly given: number }
  | { readonly why: 'duplicate'; readonly heldBy: string };

/** Every variant `Refusal` can take, for a suite that has to cover all of them. */
export const REFUSAL_KINDS = [
  'noRow',
  'empty',
  'ean13Shape',
  'ean13Check',
  'code128Character',
  'code128TooLong',
  'duplicate',
] as const;

export type RefusalKind = (typeof REFUSAL_KINDS)[number];

export type AssignOutcome =
  | { readonly ok: true; readonly codes: readonly AssignedCode[] }
  | { readonly ok: false; readonly refusal: Refusal };

/**
 * The rule half, with no reference to what is already stored.
 *
 * Split out from `assignCode` because the settings form wants to say what is
 * wrong with a number WHILE it is being typed, before anything is pressed, and
 * a function that also needed the current table to answer that would have made
 * the form hold state it has no other use for.
 */
export function codeRefusal(symbology: Symbology, code: string): Refusal | undefined {
  if (code === '') return { why: 'empty' };

  if (symbology === 'ean13') {
    if (!isThirteenDigits(code)) return { why: 'ean13Shape', given: code.length };
    const expected = checkDigitFor(code.slice(0, 12));
    const given = Number(code[12]);
    return expected === given ? undefined : { why: 'ean13Check', expected, given };
  }

  const undrawable = firstUndrawable(code);
  if (undrawable !== undefined) return { why: 'code128Character', character: undrawable };
  if (code.length > CODE128_MAX_LENGTH) {
    return { why: 'code128TooLong', limit: CODE128_MAX_LENGTH, given: code.length };
  }
  return undefined;
}

/**
 * Give a row a code, or say why not.
 *
 * `code` is trimmed at the ends and nowhere else. Outer whitespace is what a
 * copy-and-paste leaves behind and no shop means it; an INNER space is a
 * character set B can draw and a shop may well mean, so folding those would be
 * this add-on quietly changing a reference somebody typed.
 */
export function assignCode(
  current: readonly AssignedCode[],
  sku: string,
  symbology: Symbology,
  code: string,
): AssignOutcome {
  const row = sku.trim();
  if (row === '') return { ok: false, refusal: { why: 'noRow' } };

  const wanted = code.trim();
  const refusal = codeRefusal(symbology, wanted);
  if (refusal !== undefined) return { ok: false, refusal };

  const held = current.find((entry) => entry.sku !== row && entry.code === wanted);
  if (held !== undefined) {
    return { ok: false, refusal: { why: 'duplicate', heldBy: held.sku } };
  }

  const kept = current.filter((entry) => entry.sku !== row);
  return { ok: true, codes: ordered([...kept, { sku: row, symbology, code: wanted }]) };
}

/** Take a row's code away. Nothing else moves. */
export function forgetCode(
  current: readonly AssignedCode[],
  sku: string,
): readonly AssignedCode[] {
  return current.filter((entry) => entry.sku !== sku);
}

// ── the read surface ────────────────────────────────────────────────────────

/**
 * WHAT CODE THIS ROW HAS, OR NOTHING.
 *
 * The one lookup a host calls, and the reason a host installs this rather than
 * the two surfaces. Pure, total, and defined for values it has never seen: an
 * add-on that has just been connected and been given nothing answers
 * `undefined` for every row, and a host handling `undefined` is a host behaving
 * exactly as it did before the add-on existed. That is 24 D6 — the app is
 * designed with the hole already in it — as a return value.
 *
 * `undefined` RATHER THAN A `{ found: false }` SENTINEL, and the choice is
 * deliberate. A sentinel reads as more explicit and is not: it lets a caller
 * that forgot to look at the flag carry on holding an object, which is exactly
 * the shape that renders an empty barcode. `undefined` cannot be drawn by
 * accident, and every caller in this package has to say what it does about a
 * row nobody has given a number to — which, on both surfaces, is a sentence.
 */
export function codeFor(
  values: AddOnSettingValues | undefined,
  sku: string,
): AssignedCode | undefined {
  return readStored(values).find((entry) => entry.sku === sku);
}

/**
 * Every code the shop has given out, for a host that wants the whole table.
 *
 * `readStored` under another name, and the other name is the point: the storage
 * shape is this package's private document and will change, so a host reaching
 * for `readStored` would be coupled to it. This is the promise — three fields
 * per row, all of them things any host of this data can use.
 */
export function assignedCodes(
  values: AddOnSettingValues | undefined,
): readonly AssignedCode[] {
  return readStored(values);
}

/**
 * The modules for an assigned code.
 *
 * Dispatches on the symbology so that no caller has to, which keeps the two
 * encoders' throwing contracts in one place: everything reaching here has been
 * through `codeRefusal` or through `readStored`, both of which drop what cannot
 * be drawn, so a throw is a defect in this package rather than a shop's typo.
 */
export function modulesFor(assigned: AssignedCode): Modules {
  return assigned.symbology === 'ean13'
    ? encodeEan13(assigned.code)
    : encodeCode128(assigned.code);
}
