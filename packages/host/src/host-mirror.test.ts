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
 * Where the host apps are expected to be: beside this repo, the same
 * arrangement `scripts/sync-to-host.sh` assumes and the same one each host's
 * own `sync-add-ons.sh` assumed before it.
 *
 *   <somewhere>/add-ons      ← this repo
 *   <somewhere>/print-shop   ← the first host
 *   <somewhere>/maker-shop   ← the second host
 *
 * `ADMINIUM_PRINT_SHOP` / `ADMINIUM_MAKER_SHOP` override them for a checkout
 * that lives elsewhere.
 *
 * TWO HOSTS, AND THE SECOND ONE IS THE POINT. D21's claim is that a slot id
 * names a surface rather than an app, and the only evidence for that claim is a
 * second host mounting the same ids. Checking one host would have let the
 * mirror drift towards whichever app happened to be checked out — which is the
 * disease, one directory further up.
 */
interface Host {
  name: string;
  root: string;
}

const HOSTS: readonly Host[] = [
  {
    name: 'print-shop',
    root:
      process.env.ADMINIUM_PRINT_SHOP ??
      fileURLToPath(new URL('../../../../print-shop', import.meta.url)),
  },
  {
    name: 'maker-shop',
    root:
      process.env.ADMINIUM_MAKER_SHOP ??
      fileURLToPath(new URL('../../../../maker-shop', import.meta.url)),
  },
];

const hostTs = (host: Host) => join(host.root, 'src', 'add-ons', 'host.ts');
const slotsTs = (host: Host) => join(host.root, 'src', 'add-ons', 'slots.ts');
/**
 * THE PAYLOADS ARE A SECOND FILE NOW, and the guard has to read it or it would
 * check the seam and miss the thing that actually broke. `SampleJob` used to be
 * declared in `host.ts` beside `AddOn`; the per-slot payloads live in
 * `payloads.ts` in all three repos, and a member added there is exactly as
 * invisible as a member added to `AddOn` was.
 */
const payloadsTs = (host: Host) => join(host.root, 'src', 'add-ons', 'payloads.ts');
const isPresent = (host: Host) => existsSync(hostTs(host)) && existsSync(slotsTs(host));

const present = HOSTS.filter(isPresent);
const absent = HOSTS.filter((h) => !isPresent(h));

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
  /*
   * BOTH SPELLINGS OF A MEMBER NAME. `SlotPayloads` keys its members by slot
   * id — `'artwork.sources': ArtworkSlotPayload;` — and a pattern that knew
   * only bare identifiers read that interface as EMPTY, which is the one shape
   * where a missing member would mean a whole surface silently unmapped.
   */
  return [...body.matchAll(/^ {2}'?"?([\w.-]+)'?"?\??[?:(]/gm)].map((m) => m[1]!);
}

/** The string literals of a top-level `export const NAME = [ … ] as const`. */
function constArray(source: string, name: string): string[] {
  const match = new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\]`).exec(source);
  if (match === null) return [];
  return [...match[1]!.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]!);
}

/** The `key: 'value'` pairs of a top-level `export const NAME: … = { … }`. */
function recordEntries(source: string, name: string): [string, string][] {
  const match = new RegExp(`export const ${name}[^=]*= \\{([\\s\\S]*?)\\n\\};`).exec(source);
  if (match === null) return [];
  return [...match[1]!.matchAll(/^ {2}['"]?([\w.-]+)['"]?: '([\w-]+)'/gm)].map((m) => [
    m[1]!,
    m[2]!,
  ]);
}

/** The keys of a top-level `export const NAME: … = { … }` record. */
function recordKeys(source: string, name: string): string[] {
  const match = new RegExp(`export const ${name}[^=]*= \\{([\\s\\S]*?)\\n\\};`).exec(source);
  if (match === null) return [];
  return [...match[1]!.matchAll(/^ {2}['"]?([\w.-]+)['"]?:/gm)].map((m) => m[1]!);
}

// In the reporter's default output a skipped file shows only a count, so the
// reason goes where someone reading a green run will actually see it. A clean
// clone of this repo alone has NEITHER host beside it and is expected to be
// green; a clone with one of the two is checked against that one.
for (const host of absent) {
  console.info(
    `[add-on-host] drift guard skipped for ${host.name}: no checkout at ${host.root}. ` +
      `Clone it beside this repo, or point ADMINIUM_${host.name.replace('-', '_').toUpperCase()} at it.`,
  );
}

describe.each(present)('the mirror has not drifted from $name', (host) => {
  // The seam and the payloads, read as one text on both sides: which of the
  // two files a shape sits in is a filing decision, and the guard is about
  // whether the shape exists at all.
  const hostSource = code(hostTs(host)) + '\n' + code(payloadsTs(host));
  const hostSlots = code(slotsTs(host));
  const mirrorSource =
    code(join(MIRROR_SRC, 'host.ts')) + '\n' + code(join(MIRROR_SRC, 'payloads.ts'));
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
    // The two halves of the 2026-08-10 repair: what a host SUPPLIES so a seeded
    // line can be dated, and what an add-on DECLARES now that it may no longer
    // invent an instant or a paperwork reference. Both are skipped on a host
    // that has not adopted them yet — the guard's direction is HOST ⊆ MIRROR.
    'ActivityContext',
    'SeededActivityEntry',
    'DemoSwitch',
    'Permission',
    'ResolvedFill',
    'AddOnRegistry',
    // ── the payloads, one per slot in the closed registry ──────────────────
    //
    // THE LIST THAT WOULD HAVE CAUGHT IT. These shapes were not mirrored at
    // all: each add-on declared its own reading of "what arrived", so nothing
    // anywhere compared a payload against the host that sends it. A field the
    // host adds, renames or drops is a red suite in one place now.
    'SlotPayload',
    'Dimensions',
    'Money',
    'PostalAddress',
    'Party',
    // A clock is a HOST fact, and this add-on repo learned it by hard-coding
    // one: `PINNED_NOW` agreed with the host it was written against and with no
    // other, so the second host's dispatch panel quoted somebody else's
    // Wednesday. It crosses the seam now, so it is mirrored like everything
    // else that crosses.
    'ShopClock',
    'SlotItem',
    'CatalogueSample',
    'HostProduct',
    'LineOrder',
    'OutboundOrder',
    'ArtworkJob',
    'ArtworkResult',
    'ArtworkSlotPayload',
    'CheckoutPayload',
    'DispatchPayload',
    'SettingsPanelPayload',
    'PersonalizePayload',
    'CartLinePayload',
    'ProductAdminPayload',
    'OrderLinePayload',
    'RecordEditorPayload',
    'SlotPayloads',
  ])('carries every member of the host %s interface', (name) => {
    /*
     * A HOST THAT DOES NOT DECLARE THE INTERFACE AT ALL IS NOT DRIFT. Both
     * hosts declare every payload today — the registry is closed and each maps
     * all eleven — but a host is allowed to be behind, and a suite that read
     * "not declared" as "the parse failed" would be red on a tree where
     * everything is correct. The direction is still HOST ⊆ MIRROR — what is
     * never allowed is a host declaring a MEMBER this file has not heard of.
     *
     * The parse-failure guard survives in the shape that can still catch it: if
     * the word `interface <name>` appears in the host's source, the member list
     * must be non-empty.
     */
    if (!new RegExp(`\\binterface ${name}\\b`).test(hostSource)) return;
    const declared = interfaceMembers(hostSource, name);
    expect(declared, `${name} is declared in ${host.name} but parsed empty`).not.toEqual([]);

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
   * And it agrees about how each one FILLS. `SLOT_FILL` decides whether a
   * second add-on filling the same slot is rendered or dropped, which is a
   * difference an add-on author has to be able to read correctly — and it is a
   * rule of the closed registry rather than a choice a host gets to make, so
   * value agreement is the right check for it and only for it.
   */
  it.each(['SLOT_FILL'])('agrees with the host about %s', (name) => {
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
   * SLOT_EMPTY_BEHAVIOUR IS CHECKED FOR COMPLETENESS, NOT FOR AGREEMENT, and
   * the difference is this wave's ruling — `slots.ts` carries the reasoning.
   *
   * What a host draws where nothing fills a slot is a property of that host's
   * SCREEN. Marlow Press puts `settings.add-on.panel` under its own heading and
   * speaks into it; Birch Row inlines the same panel with no heading and stays
   * silent. Both are right, and the old check — every host must match this
   * repo's copy of the first host's table — could only be satisfied by one of
   * them changing a screen that was already correct. Whether a claim matches a
   * screen is a question only that host's own render suite can ask, and both
   * hosts' `slotRender.test.tsx` ask it in both directions.
   *
   * SO THIS KEEPS THE HALF THAT IS STILL CROSS-REPO, and it catches drift the
   * value check never could: a host that mounts a slot and never decides what
   * its empty state is, or decides one for a slot it does not mount. Both are
   * silent today — a missing key would only surface as a `undefined !==
   * 'silent'` comparison inside the host's own render suite, which reads as a
   * pass — and both are exactly the kind of thing that arrives with a new mount
   * added in a hurry.
   */
  it('decides an empty behaviour for every slot it mounts, and only those', () => {
    const hosted = constArray(hostSlots, 'HOSTED_SLOTS');
    expect(hosted.length, 'failed to parse HOSTED_SLOTS in the host').toBeGreaterThan(0);

    const declared = recordEntries(hostSlots, 'SLOT_EMPTY_BEHAVIOUR');
    expect(
      declared.length,
      `failed to parse SLOT_EMPTY_BEHAVIOUR in ${host.name}`,
    ).toBeGreaterThan(0);

    const keys = declared.map(([slot]) => slot);
    const undecided = hosted.filter((slot) => !keys.includes(slot));
    expect(
      undecided,
      `${host.name} mounts these and says nothing about their empty state: ${undecided.join(', ')}`,
    ).toEqual([]);

    const unmounted = keys.filter((slot) => !hosted.includes(slot));
    expect(
      unmounted,
      `${host.name} declares an empty state for slots it does not mount: ${unmounted.join(', ')}`,
    ).toEqual([]);

    const strange = declared.filter(([, value]) => value !== 'speaks' && value !== 'silent');
    expect(
      strange.map(([slot, value]) => `${slot}: ${value}`),
      'a value that is neither speaks nor silent',
    ).toEqual([]);
  });

  /**
   * AND THE MIRROR ITSELF DECLARES NO VALUES, which is the ratchet on the
   * ruling above. Re-adding a shared table here would make one shop's screen
   * speak for another's again, and it would do it quietly: nothing else in this
   * repo reads such a table, so nothing else would go red.
   */
  it('keeps no shared table of empty behaviours of its own', () => {
    expect(
      recordEntries(mirrorSlots, 'SLOT_EMPTY_BEHAVIOUR'),
      'the mirror declares SLOT_EMPTY_BEHAVIOUR values; empty behaviour is per host — see slots.ts',
    ).toEqual([]);
  });

  /**
   * The vocabularies, which are closed sets rather than open ones: an add-on
   * that declared a category the host cannot render would be a shelf row with
   * no home.
   */
  it.each(['AddOnCategory', 'ConnectKind'])('carries the whole %s vocabulary', (name) => {
    // BOTH QUOTE STYLES. The Print Shop writes single quotes and Birch Row
    // writes double ones, and a pattern that knew only the first read the
    // second host's closed vocabulary as an empty union — a guard reporting
    // "this is not a union" about a file in which it plainly is.
    const members = (source: string): string[] => {
      const match = new RegExp(`export type ${name} =([^;]*);`).exec(source);
      return match === null
        ? []
        : [...match[1]!.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]!).sort();
    };
    const declared = members(hostSource);
    expect(declared, `${name} is not a union in the host's host.ts`).not.toEqual([]);
    expect(members(mirrorSource)).toEqual(declared);
  });
});

/**
 * ONE EGRESS DETECTOR, THREE REPOS, BYTE FOR BYTE.
 *
 * ── WHY THE FILE IS COPIED AT ALL ───────────────────────────────────────────
 *
 * `testing/egress.ts` states D11's rule — can anything here cause a request to
 * a host we do not control — and all three repos need it. None of them can
 * import it from the others: a host app is a standalone Vite SPA published from
 * a clean clone with no sibling checkout of anything, and this repo has to be
 * green with no host beside it. So there are three copies, for the same reason
 * `host.ts` has three, and with the same consequence if nothing watches them.
 *
 * ── AND WHY THIS IS EQUALITY, WHERE THE MIRROR ABOVE IS CONTAINMENT ─────────
 *
 * The seam guard checks HOST ⊆ MIRROR, because a host may lag a contract the
 * add-ons have already adopted. Nothing like that is true here: a repair to a
 * detector is a repair everywhere or it is a hole in whichever repo missed it,
 * and this wave has already shipped that exact shape — `captionsUnder`'s
 * blindness above a mount was found and fixed in one host, and the other kept
 * the defect for three rounds because the repair never crossed the gap.
 *
 * So the copies must be IDENTICAL, and a diff is a failure whichever direction
 * it points in.
 */
const EGRESS = 'src/testing/egress.ts';
const MIRROR_EGRESS = join(MIRROR_SRC, 'testing', 'egress.ts');

describe.each(present)('the egress detector is the same file in $name', (host) => {
  it('is byte for byte the copy in this package', () => {
    const theirs = join(host.root, 'src', 'testing', 'egress.ts');
    expect(
      existsSync(theirs),
      `${host.name} carries no ${EGRESS}. D11's rule is stated in that file; a host ` +
        'without it has no third net, and the two static ones cannot see a value.',
    ).toBe(true);

    const mine = readFileSync(MIRROR_EGRESS, 'utf8');
    const yours = readFileSync(theirs, 'utf8');
    // Reported as a first-difference rather than as two 20 KB blobs: a diff of
    // whole files here is unreadable and nobody acts on an unreadable failure.
    if (mine !== yours) {
      const at = [...mine].findIndex((ch, i) => ch !== yours[i]);
      expect(
        `${host.name} ${EGRESS} differs at character ${at}: ` +
          `…${yours.slice(Math.max(0, at - 60), at + 60)}…`,
      ).toBe(
        `${host.name} ${EGRESS} differs at character ${at}: ` +
          `…${mine.slice(Math.max(0, at - 60), at + 60)}…`,
      );
    }
    expect(yours).toEqual(mine);
  });
});

/**
 * ── THE PURITY RULE, SAME RULE AGAIN ────────────────────────────────────────
 *
 * `testing/purity.ts` answers "can this code produce a different answer twice",
 * and it is one file for the reason the file itself gives: there were three
 * regular expressions, they had drifted, and no suite anywhere had two of them
 * in front of it. This one banned five things, the print works checked four and
 * the maker studio three — so `performance.now()` and `crypto.randomUUID()`
 * were live in two shipped apps with every gate green.
 *
 * Equality, not containment, for the same reason the detector above is: a
 * repair to a rule is a repair everywhere, or it is a hole in whichever repo
 * missed it.
 */
const PURITY = 'src/testing/purity.ts';
const MIRROR_PURITY = join(MIRROR_SRC, 'testing', 'purity.ts');

describe.each(present)('the purity rule is the same file in $name', (host) => {
  it('is byte for byte the copy in this package', () => {
    const theirs = join(host.root, 'src', 'testing', 'purity.ts');
    expect(
      existsSync(theirs),
      `${host.name} carries no ${PURITY}, so it is checking for whatever its own ` +
        'regular expression happens to say — which is how two clocks got into two apps.',
    ).toBe(true);
    const mine = readFileSync(MIRROR_PURITY, 'utf8');
    const yours = readFileSync(theirs, 'utf8');
    if (mine !== yours) {
      const at = [...mine].findIndex((ch, i) => ch !== yours[i]);
      expect(`${host.name} ${PURITY} differs at character ${at}: …${yours.slice(Math.max(0, at - 60), at + 60)}…`).toBe(
        `${host.name} ${PURITY} differs at character ${at}: …${mine.slice(Math.max(0, at - 60), at + 60)}…`,
      );
    }
    expect(yours).toEqual(mine);
  });
});

/**
 * ── AND "IS THIS FILE STILL TEXT", WHICH IS THE SAME RULE ONE LEVEL DOWN ────
 *
 * [Added 2026-08-12, with the rule.] `testing/encoding.ts` answers whether a
 * source file is something a tool will still read, and it exists because three
 * files across these repos held RAW control bytes where an escape was meant —
 * `personalizer/src/store.ts`, this package's `app-neutral.test.ts` and both
 * hosts' `reviewedCopy.test.ts`. A raw byte makes `file` call the module data
 * and `grep` match nothing inside it, silently and with exit status 0.
 *
 * Equality rather than containment, for the reason the three rules above give:
 * the copy that misses a repair is the one whose repo goes blind, and this is
 * the rule whose whole failure mode is a tool reporting NOTHING and being
 * believed.
 */
const ENCODING = 'src/testing/encoding.ts';
const MIRROR_ENCODING = join(MIRROR_SRC, 'testing', 'encoding.ts');

describe.each(present)('the still-text rule is the same file in $name', (host) => {
  it('is byte for byte the copy in this package', () => {
    const theirs = join(host.root, 'src', 'testing', 'encoding.ts');
    expect(
      existsSync(theirs),
      `${host.name} carries no ${ENCODING}, so nothing there notices a file the ` +
        'tools have quietly stopped reading — which is how an exported reset went ' +
        'missing from a grep for it while sitting in the file being searched.',
    ).toBe(true);
    const mine = readFileSync(MIRROR_ENCODING, 'utf8');
    const yours = readFileSync(theirs, 'utf8');
    if (mine !== yours) {
      const at = [...mine].findIndex((ch, i) => ch !== yours[i]);
      expect(`${host.name} ${ENCODING} differs at character ${at}: …${yours.slice(Math.max(0, at - 60), at + 60)}…`).toBe(
        `${host.name} ${ENCODING} differs at character ${at}: …${mine.slice(Math.max(0, at - 60), at + 60)}…`,
      );
    }
    expect(yours).toEqual(mine);
  });
});

/**
 * ── AND THE "DID THE FILL DRAW ANYTHING" RULE, SAME RULE AGAIN ──────────────
 *
 * `slot-content.ts` here is `src/add-ons/slotContent.ts` in each host. It is the
 * one thing standing between an add-on that correctly draws nothing and a blank
 * box where the host's own picture used to be, and it is the THIRD depth of a
 * defect that has now been fixed once per host per round: round 2 in the studio,
 * round 5 in the works, and round 6 in both because `:empty` was never the
 * question.
 *
 * Equality rather than containment, for the reason the two above give: a rule
 * this shape, kept in three copies, is three rules — and the copy that missed a
 * repair is the one shipping the defect.
 *
 * The path differs (`slot-content.ts` here, `slotContent.ts` there) because each
 * repo names files the way the rest of that repo does. The BYTES do not.
 */
const SLOT_CONTENT = 'src/add-ons/slotContent.ts';
const MIRROR_SLOT_CONTENT = join(MIRROR_SRC, 'slot-content.ts');

describe.each(present)('the drew-anything rule is the same file in $name', (host) => {
  it('is byte for byte the copy in this package', () => {
    const theirs = join(host.root, 'src', 'add-ons', 'slotContent.ts');
    expect(
      existsSync(theirs),
      `${host.name} carries no ${SLOT_CONTENT}, so its slots are back to asking ` +
        '`:empty` \u2014 which is a question about child nodes and not about paint.',
    ).toBe(true);
    const mine = readFileSync(MIRROR_SLOT_CONTENT, 'utf8');
    const yours = readFileSync(theirs, 'utf8');
    if (mine !== yours) {
      const at = [...mine].findIndex((ch, i) => ch !== yours[i]);
      expect(
        `${host.name} ${SLOT_CONTENT} differs at character ${at}: ` +
          `\u2026${yours.slice(Math.max(0, at - 60), at + 60)}\u2026`,
      ).toBe(
        `${host.name} ${SLOT_CONTENT} differs at character ${at}: ` +
          `\u2026${mine.slice(Math.max(0, at - 60), at + 60)}\u2026`,
      );
    }
    expect(yours).toEqual(mine);
  });
});

/**
 * ── AND THE SWEEP LEXICON'S TABLE, WHICH IS A REGION RATHER THAN A FILE ─────
 *
 * `testing/tiering.ts` here and `src/testing/lexicon.ts` in each host carry the
 * same `IDEA × LANGUAGE` table. The hosts' file legitimately carries much more
 * around it — the bundle scanner, the homograph carve-outs — so this compares
 * the REGION rather than the whole file: from `BANNED_IDEAS` to the start of
 * `TIERING_WORDS`, which is the table and nothing else.
 *
 * It matters because that table is a REGRESSION SET (its own header says so at
 * length, and says why it can never be complete). A regression set that exists
 * in three copies is three different sets of regressions, and the one thing a
 * regression set must never do is forget.
 */
const TABLE_FROM = 'export const BANNED_IDEAS';
const TABLE_TO = 'export const TIERING_WORDS';

function tieringTable(source: string): string | null {
  const from = source.indexOf(TABLE_FROM);
  const to = source.indexOf(TABLE_TO);
  if (from < 0 || to < 0 || to < from) return null;
  return source.slice(from, to);
}

describe.each(present)('the tiering table is the same table in $name', (host) => {
  it('matches this package’s copy, cell for cell', () => {
    const theirs = join(host.root, 'src', 'testing', 'lexicon.ts');
    expect(existsSync(theirs), `${host.name} carries no src/testing/lexicon.ts`).toBe(true);
    const mine = tieringTable(readFileSync(MIRROR_SRC + 'testing/tiering.ts', 'utf8'));
    const yours = tieringTable(readFileSync(theirs, 'utf8'));
    expect(mine, 'the table could not be found in this package').not.toBeNull();
    expect(yours, `the table could not be found in ${host.name}`).not.toBeNull();
    // A floor, so a parse that quietly returned two lines cannot pass.
    expect((mine ?? '').length).toBeGreaterThan(2_000);
    expect(yours).toEqual(mine);
  });
});

/**
 * ── AND THE LIST OF WHAT A HOST MUST DO, SAME RULE ──────────────────────────
 *
 * `testing/host-behaviours.ts` is the answer to the drift this repo keeps
 * producing: a defect found in one shop and fixed in one shop. It only works if
 * all three copies are the same file — a host holding an older list is a host
 * that is not being asked for the newest behaviour, which is the exact thing it
 * exists to prevent, restored.
 */
const BEHAVIOURS = 'src/testing/host-behaviours.ts';
const MIRROR_BEHAVIOURS = join(MIRROR_SRC, 'testing', 'host-behaviours.ts');

describe.each(present)('the host behaviour list is the same file in $name', (host) => {
  it('is byte for byte the copy in this package', () => {
    const theirs = join(host.root, 'src', 'testing', 'host-behaviours.ts');
    expect(
      existsSync(theirs),
      `${host.name} carries no ${BEHAVIOURS}, so nothing asks it for the behaviours the ` +
        'other host has already been taught.',
    ).toBe(true);

    const mine = readFileSync(MIRROR_BEHAVIOURS, 'utf8');
    const yours = readFileSync(theirs, 'utf8');
    if (mine !== yours) {
      const at = [...mine].findIndex((ch, i) => ch !== yours[i]);
      expect(
        `${host.name} ${BEHAVIOURS} differs at character ${at}: ` +
          `…${yours.slice(Math.max(0, at - 60), at + 60)}…`,
      ).toBe(
        `${host.name} ${BEHAVIOURS} differs at character ${at}: ` +
          `…${mine.slice(Math.max(0, at - 60), at + 60)}…`,
      );
    }
    expect(yours).toEqual(mine);
  });
});
