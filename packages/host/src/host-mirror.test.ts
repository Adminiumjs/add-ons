/**
 * THE GUARD THE ONE-REPO LAYOUT MAKES POSSIBLE, and the reason the restructure
 * was worth doing.
 *
 * `host.ts` and `slots.ts` here are a MIRROR of the host app's own
 * `src/add-ons/host.ts` and `src/add-ons/slots.ts`. A mirror with nothing
 * watching it is a copy that will drift — that is not a prediction, it is what
 * happened: three add-on repos each mirrored the same two files, each kept only
 * the members it used, and inside a day `demoSwitch`, `account`,
 * `proofsArtwork`, `nameKey` and `inDemo` existed in some copies and not
 * others. Nothing failed. Nothing could have failed, because no suite anywhere
 * had both sides in front of it.
 *
 * With one mirror in one repo there is one place to point a suite at, and this
 * is it. It reads the host's own SOURCE — not a published package, not a
 * vendored copy — and fails when the mirror is missing something the host
 * declares.
 *
 * ── DIRECTION, ON PURPOSE ───────────────────────────────────────────────────
 *
 * It checks HOST ⊆ MIRROR, not equality. The host is authoritative, so anything
 * it declares must exist here. The reverse is allowed and useful: this repo may
 * carry a member the Print Shop has not adopted yet, because an add-on can be
 * written against a seam before one particular host app grows it, and because a
 * SECOND host app will host these same slots. What is never allowed is the
 * host declaring something this file has not heard of — that is an add-on
 * compiling against a contract that no longer exists.
 *
 * ── WHY IT PARSES TEXT RATHER THAN TYPES ────────────────────────────────────
 *
 * Reading the host's declarations with the TypeScript compiler API would mean
 * this package's test run depended on being able to typecheck a different
 * repo — its imports, its tsconfig, its React version. The host's `AddOn` is a
 * flat interface of one-per-line members and `HOSTED_SLOTS` is a literal array
 * of strings; a regex over both, applied identically to both sides so neither
 * gets a friendlier reading, is the honest amount of machinery for that.
 *
 * ── AND IT SKIPS CLEANLY ────────────────────────────────────────────────────
 *
 * A clean clone of this repo alone has no host beside it. That must still build
 * and test green — an add-on author is not required to check out the app to
 * work on the add-on — so the suite reports what it looked for and skips.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/** This package's own `src/`. */
const MIRROR_SRC = fileURLToPath(new URL('.', import.meta.url));

/**
 * Where the host app is expected to be: beside this repo, the same arrangement
 * `scripts/sync-to-host.sh` assumes and the same one the host's own
 * `sync-add-ons.sh` assumed before it.
 *
 *   <somewhere>/add-ons      ← this repo
 *   <somewhere>/print-shop   ← the host
 *
 * `ADMINIUM_PRINT_SHOP` overrides it for a checkout that lives elsewhere.
 */
const DEFAULT_HOST = fileURLToPath(new URL('../../../../print-shop', import.meta.url));
const HOST_ROOT = process.env.ADMINIUM_PRINT_SHOP ?? DEFAULT_HOST;
const HOST_ADD_ONS = join(HOST_ROOT, 'src', 'add-ons');

const HOST_HOST_TS = join(HOST_ADD_ONS, 'host.ts');
const HOST_SLOTS_TS = join(HOST_ADD_ONS, 'slots.ts');

const hostPresent = existsSync(HOST_HOST_TS) && existsSync(HOST_SLOTS_TS);

/**
 * Block and line comments removed, so a word in prose is never read as code.
 *
 * An absent file reads as empty rather than throwing. `describe.skipIf` marks
 * the tests inside as skipped but STILL RUNS the factory, so a bare
 * `readFileSync` at the top of the block turned "no host checked out beside
 * this repo" — the ordinary state of a clean clone — into a suite that failed
 * to collect. The skip has to hold at read time, not only at run time.
 */
function code(path: string): string {
  if (!existsSync(path)) return '';
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '\n')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * The members of one top-level `export interface`, in declaration order.
 *
 * Anchored at exactly two spaces of indentation, which is what makes a nested
 * object type (`disconnect?: { goesKey: string; … }`) contribute its own name
 * and not its inner fields.
 */
function interfaceMembers(source: string, name: string): string[] {
  // `export interface AddOnFill<P = unknown, S extends SlotId = SlotId> {` and
  // `export interface SettingsPanelPayload extends SlotPayload {` are both
  // declarations of the named interface; matching only `NAME {` silently
  // returned nothing for either, which a guard must never do quietly.
  const start = new RegExp(`^export interface ${name}\\b[^{]*\\{`, 'm').exec(source);
  if (start === null) return [];
  const from = start.index;
  const body = source.slice(from, source.indexOf('\n}', from));
  return [...body.matchAll(/^ {2}(\w+)\??[?:(]/gm)].map((m) => m[1]!);
}

/** The string literals of a top-level `export const NAME = [ … ] as const`. */
function constArray(source: string, name: string): string[] {
  const match = new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\]`).exec(source);
  if (match === null) return [];
  return [...match[1]!.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]!);
}

/** The keys of a top-level `export const NAME: … = { … }` record. */
function recordKeys(source: string, name: string): string[] {
  const match = new RegExp(`export const ${name}[^=]*= \\{([\\s\\S]*?)\\n\\};`).exec(source);
  if (match === null) return [];
  return [...match[1]!.matchAll(/^ {2}['"]?([\w.-]+)['"]?:/gm)].map((m) => m[1]!);
}

const WHY_SKIPPED =
  `no host checkout at ${HOST_ROOT} — the drift guard cannot run. ` +
  'Clone the print-shop repo beside this one, or point ADMINIUM_PRINT_SHOP at it. ' +
  'A clean clone of this repo alone is expected to see this and still be green.';

const title = hostPresent
  ? 'the mirror has not drifted from the host'
  : `the mirror has not drifted from the host — SKIPPED: ${WHY_SKIPPED}`;

// In the reporter's default output a skipped file shows only a count, so the
// reason goes where someone reading a green run will actually see it.
if (!hostPresent) console.info(`[add-on-host] drift guard skipped: ${WHY_SKIPPED}`);

describe.skipIf(!hostPresent)(title, () => {
  const hostSource = code(HOST_HOST_TS);
  const hostSlots = code(HOST_SLOTS_TS);
  const mirrorSource = code(join(MIRROR_SRC, 'host.ts'));
  const mirrorSlots = code(join(MIRROR_SRC, 'slots.ts'));

  /**
   * The assertion that would have caught the drift that caused this repo to
   * exist. Every member of the host's `AddOn` must exist here — a host that
   * grows a field is a red suite in ONE place, and every add-on picks the field
   * up from one edit.
   */
  it('carries every member of the host AddOn interface', () => {
    const declared = interfaceMembers(hostSource, 'AddOn');
    expect(declared.length, 'failed to parse the host AddOn interface').toBeGreaterThan(10);

    const mirrored = new Set(interfaceMembers(mirrorSource, 'AddOn'));
    const missing = declared.filter((member) => !mirrored.has(member));
    expect(
      missing,
      `the host declares AddOn members this mirror does not: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  /**
   * The same check for every other shape the host hands across the seam. These
   * are the interfaces an add-on builds or reads by name; a member appearing on
   * one is exactly as invisible as a member appearing on `AddOn` was.
   */
  it.each([
    'AddOnFill',
    'AddOnSetting',
    'ActivityEntry',
    'DemoSwitch',
    'Permission',
    'SampleJob',
    'SettingsPanelPayload',
    'SlotPayload',
    'ResolvedFill',
    'AddOnRegistry',
  ])('carries every member of the host %s interface', (name) => {
    const declared = interfaceMembers(hostSource, name);
    expect(declared, `${name} is not an interface in the host's host.ts`).not.toEqual([]);

    const mirrored = new Set(interfaceMembers(mirrorSource, name));
    const missing = declared.filter((member) => !mirrored.has(member));
    expect(missing, `${name}: the host declares ${missing.join(', ')} and this mirror does not`).toEqual(
      [],
    );
  });

  /**
   * Every slot the host mounts must be nameable here, or an add-on cannot fill
   * it. This is the check that runs the other way round from the one an add-on
   * repo used to have: a private, narrowed `SlotId` could name a slot the host
   * had stopped hosting and nothing noticed for a release.
   */
  it('names every slot the host hosts', () => {
    const hosted = constArray(hostSlots, 'HOSTED_SLOTS');
    expect(hosted.length, 'failed to parse HOSTED_SLOTS in the host').toBeGreaterThan(0);

    const mirrored = new Set(constArray(mirrorSlots, 'HOSTED_SLOTS'));
    const missing = hosted.filter((slot) => !mirrored.has(slot));
    expect(missing, `the host mounts slots this mirror cannot name: ${missing.join(', ')}`).toEqual(
      [],
    );
  });

  /**
   * And it agrees about how each one behaves. `SLOT_FILL` decides whether a
   * second add-on filling the same slot is rendered or dropped, which is a
   * difference an add-on author has to be able to read correctly.
   */
  it.each(['SLOT_FILL', 'SLOT_EMPTY_BEHAVIOUR'])('agrees with the host about %s', (name) => {
    const hosted = recordKeys(hostSlots, name);
    expect(hosted.length, `failed to parse ${name} in the host`).toBeGreaterThan(0);

    const mirrored = recordKeys(mirrorSlots, name);
    const missing = hosted.filter((slot) => !mirrored.includes(slot));
    expect(missing, `${name}: the host declares ${missing.join(', ')} and this mirror does not`).toEqual(
      [],
    );

    for (const slot of hosted) {
      const hostValue = new RegExp(`['"]?${slot}['"]?: '([\\w-]+)'`).exec(
        hostSlots.slice(hostSlots.indexOf(`export const ${name}`)),
      );
      const mirrorValue = new RegExp(`['"]?${slot}['"]?: '([\\w-]+)'`).exec(
        mirrorSlots.slice(mirrorSlots.indexOf(`export const ${name}`)),
      );
      expect(mirrorValue?.[1], `${name}['${slot}'] disagrees with the host`).toBe(hostValue?.[1]);
    }
  });

  /**
   * The vocabularies, which are closed sets rather than open ones: an add-on
   * that declared a category the host cannot render would be a shelf row with
   * no home.
   */
  it.each(['AddOnCategory', 'ConnectKind'])('carries the whole %s vocabulary', (name) => {
    const members = (source: string): string[] => {
      const match = new RegExp(`export type ${name} =([^;]*);`).exec(source);
      return match === null ? [] : [...match[1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!).sort();
    };
    const declared = members(hostSource);
    expect(declared, `${name} is not a union in the host's host.ts`).not.toEqual([]);
    expect(members(mirrorSource)).toEqual(declared);
  });
});
