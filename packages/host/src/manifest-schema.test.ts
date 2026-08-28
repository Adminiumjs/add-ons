/**
 * EVERY MANIFEST IN THIS REPO, PUT THROUGH THE REAL VALIDATOR.
 *
 * ── WHAT THIS EXISTS TO STOP, WHICH ALREADY HAPPENED ────────────────────────
 *
 * Each add-on carries a `manifest.test.ts` that checks "the rules 24 §5.3 names
 * by issue code", restated by hand, because this repo is not the product's repo
 * and `@adminium/manifest` is not on a registry. Restating a schema is a copy,
 * and a copy with nothing watching it drifts — that is the same argument
 * `host-mirror.test.ts` was written for, one file over, and it came true the
 * same way.
 *
 * The personalizer's manifest declared its two dashboard mounts as bare
 * `{ "table": "products" }` / `{ "table": "order_lines" }`, which is what 24
 * §8B writes in prose. `attachTargetSchema` REQUIRES `app` — `"*"` is the value
 * it provides for a target that is not host-specific, and a dashboard mount is
 * exactly that — so `validateManifest` returned `ok: false` on two paths. Its
 * own suite asserted `attaches` EQUALLED the invalid array, so the gate was
 * green precisely because it had written the defect down as the expectation. A
 * third issue nobody had found sat underneath: `default_finish` was declared
 * `"type": "text"`, which is not one of the six the settings union carries.
 *
 * A hand-restated rule can only ever catch what its author already knew. This
 * runs the actual code the product runs.
 *
 * ── AN ORDINARY DEVDEPENDENCY NOW (changed 2026-08-15) ──────────────────────
 *
 * This used to load the validator from a SIBLING CHECKOUT by path, because
 * `@adminium/manifest` was on no registry and could not be installed from a
 * path either: its `package.json` declares `zod: "catalog:"` and
 * `@adminium/add-on-contracts: "workspace:*"`, two pnpm protocols npm does not
 * understand. The cost was that a clean clone — and CI — had no product beside
 * it, so this entire block SKIPPED. The suite written to catch a drifting
 * hand-restated schema was the one not running where drift lands.
 *
 * The fix this file asked for was taken: both packages published 2026-08-14.
 * `@adminiumjs/manifest@0.2.1` ships FULLY RESOLVED ranges — `zod: "^4.4.3"`,
 * `@adminium/add-on-contracts: "npm:@adminiumjs/add-on-contracts@0.2.1"` —
 * because the publisher rewrites both protocols on the way out. So it installs
 * like anything else, and this suite can no longer silently not run.
 *
 * NOTE THE SCOPE: the published name is `@adminiumjs/manifest`, NOT
 * `@adminium/manifest` — `npm view @adminium/…` always 404s and means nothing.
 * It is a devDependency and must stay one: `purity.test.ts` forbids a runtime
 * dependency here, because every add-on would inherit it as a D7 violation.
 *
 * THE HOST APPS below are a different question and still skip. `print-shop` and
 * `maker-shop` are standalone repos, not published packages, so there is
 * nothing to install and a sibling checkout is still the only way to read them.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateManifest } from '@adminiumjs/manifest';
import { describe, expect, it } from 'vitest';

/** `packages/` — this repo's own, holding one directory per add-on. */
const PACKAGES = fileURLToPath(new URL('../..', import.meta.url));

/**
 * `ValidateManifestResult` is a DISCRIMINATED UNION — `issues` exists only on
 * the `ok: false` branch. The hand-rolled `{ ok: boolean; issues?: … }` this
 * file used to declare was looser than the real thing and would have accepted
 * `result.issues` on a success, which is precisely the class of drift the suite
 * exists to stop. Narrow instead of optional-chaining.
 */
function issuesOf(result: ReturnType<typeof validateManifest>) {
  return result.ok ? [] : result.issues;
}

/** Every `manifest.json` this repo ships, by the package that owns it. */
function manifests(): { pkg: string; manifest: unknown }[] {
  return readdirSync(PACKAGES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ pkg: entry.name, file: join(PACKAGES, entry.name, 'manifest.json') }))
    .filter((entry) => existsSync(entry.file))
    .map((entry) => ({
      pkg: entry.pkg,
      manifest: JSON.parse(readFileSync(entry.file, 'utf8')) as unknown,
    }));
}

describe('the manifests pass @adminiumjs/manifest itself', () => {
  it.each(manifests())('$pkg validates against the frozen v1 schema', ({ manifest }) => {
    const result = validateManifest(manifest);
    expect(issuesOf(result), 'the real validator rejects this manifest').toEqual([]);
    expect(result.ok).toBe(true);
  });

  /**
   * THE GATE, PROVED — because a validator nobody has watched reject something
   * is a validator that might not be wired up at all. This is the exact shape
   * the personalizer shipped: a dashboard mount naming a table and no app.
   */
  it('rejects the attach target this repo actually shipped', () => {
    const [first] = manifests();
    const broken = structuredClone(first!.manifest) as {
      addOn: { attaches: unknown[] };
    };
    broken.addOn.attaches = [{ table: 'products' }];

    const result = validateManifest(broken);
    expect(result.ok).toBe(false);
    expect(issuesOf(result).some((issue) => issue.path.startsWith('addOn.attaches'))).toBe(true);
  });
});

/**
 * ── A MANIFEST IS ONLY VALID *SOMEWHERE* ────────────────────────────────────
 *
 * The block above validates each manifest ALONE, and alone is not how the
 * installer calls it. Two of the v1 rules — ATTACH_TARGET_UNKNOWN and
 * SCOPE_OUT_OF_RANGE — are questions about the app the add-on is being
 * installed INTO, and `validateManifest` skips both when it is not told which
 * app that is. So a manifest can pass here and be rejected on the way in.
 *
 * IT ALREADY WAS. The Live Personalizer's `attaches` names two apps, and it
 * asked for `records:order_lines:read`. `maker` has an `order_lines` table;
 * `printing` does not — its line is a `job` — so installing it into the Print
 * Shop returned SCOPE_OUT_OF_RANGE on `addOn.scopes.1`. Everything in this repo
 * was green: the add-on's own suite asserted the scope list it shipped, and the
 * gate one block up asked the validator a question that could not see the app.
 * An add-on that declares it runs in two apps and cannot install in one of them
 * is the same failure as the contract defect this wave opened with — a claim
 * about portability that nothing had ever tried.
 *
 * So this block asks the question the installer asks: for EVERY app an add-on
 * attaches to, is this manifest installable THERE. The host app's table list
 * comes from the host's own `manifest.json` in its sibling checkout — the app
 * is authoritative about its own schema, the same direction `host-mirror.test.ts`
 * reads in — and `knownAppKeys` is the set of apps actually checked out, so an
 * `attaches` entry naming an app nobody has is reported rather than skipped.
 *
 * `app: "*"` targets are not validated against a host: they are the generated
 * dashboard, whose tables are whatever the shop's own schema turned out to be.
 *
 * It skips cleanly, like every other cross-repo guard here: a clean clone with
 * no hosts beside it says what it looked for and passes.
 */
interface HostApp {
  name: string;
  key: string;
  tables: readonly string[];
  /**
   * The slots this app's build actually mounts — its own `HOSTED_SLOTS` — or
   * `undefined` for an app that HAS NO ADD-ON SEAM AT ALL.
   *
   * ── WHY THE THIRD STATE EXISTS (added 2026-08-28, wave 6) ────────────────
   *
   * This was `readonly string[]`, and the two states it could express were "the
   * slots this host mounts" and "we could not parse them" — both spelled `[]`.
   * That was true of every app anybody had put in `HOST_ROOTS`, because the two
   * demo shops were built as add-on hosts from the first day.
   *
   * `holiday-calendars` attaches to `hr` (people-ops) and `clinic` (clinic-desk).
   * Both are real apps with real manifests and real tables; neither has a
   * `src/add-ons/` directory, because nothing has retrofitted the host seam into
   * them yet — the add-on RUNTIME does not exist (26), and that retrofit is its
   * own task. So there are now three genuinely different things to say:
   *
   *   a list        — this app mounts these slots;
   *   `[]`          — it has a `slots.ts` and nothing came out of it, which is a
   *                   PARSE FAILURE and must fail loudly, because a guard that
   *                   silently read zero slots passes everything below it;
   *   `undefined`   — it has no add-on seam, so "which slots does it mount" is
   *                   not a question with an answer yet.
   *
   * Collapsing the last two would have meant either a false red (an app failing
   * for not having a file it was never given) or a false green (a parse failure
   * excused as an absence). The third state is what keeps both honest, and the
   * apps in it are NAMED by their own case below rather than skipped in silence.
   */
  hostedSlots: readonly string[] | undefined;
  /**
   * THE ADD-ON KEYS THIS HOST READS DATA FROM, which is the SECOND way an
   * add-on can draw something in an app (see `emptyAttachClaims`).
   *
   * An add-on that fills a working surface proves its presence by the slot it
   * fills. A DATA PACK has no working surface to fill: it hands the host an
   * array through a plain exported function and the HOST renders it, at the
   * mount site, into the host's own records. `holiday-calendars` is the first
   * of those, and it is why this field exists — its entire slot footprint is
   * `settings.add-on.panel`, and by slots alone it is indistinguishable from
   * the defect the gate below was written to catch.
   *
   * The evidence is an IMPORT, and it is deliberately narrow: a host module
   * outside `vendor/` importing a binding OTHER THAN `register` from an
   * add-on's vendored entry. `register` is excluded because every host imports
   * it for every add-on — counting it would make this field true of everything
   * and prove nothing at all.
   */
  readsDataFrom: readonly string[];
}

/**
 * The string literals of a top-level `export const NAME = [ … ] as const`,
 * comments stripped first so a slot id quoted in prose is never read as code.
 *
 * The same shape `host-mirror.test.ts` uses, and for the same reason: reading a
 * sibling repo's declarations with the TypeScript compiler API would make this
 * suite depend on being able to typecheck a different repo.
 */
function constArrayIn(path: string, name: string): string[] | undefined {
  // A MISSING FILE IS NOT AN EMPTY LIST. See `HostApp.hostedSlots`: an app with
  // no add-on seam and an app whose seam this cannot read need different
  // answers, and this is the only place that can tell them apart.
  if (!existsSync(path)) return undefined;
  const source = readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '\n')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  const match = new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\]`).exec(source);
  if (match === null) return [];
  return [...match[1]!.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]!);
}

/**
 * Which add-ons a host READS, as opposed to which it mounts.
 *
 * Reads every `.ts`/`.tsx` under the host's own `src/add-ons/` EXCEPT the
 * vendored tree — a vendored file importing its own sibling says nothing about
 * the host — and returns the add-on keys it pulls a non-`register` binding from.
 *
 * Text, not types, for the same reason `constArrayIn` is: this suite must not
 * depend on being able to typecheck a different repo. Comments are stripped
 * first, so the sentence in a host's `registry.ts` EXPLAINING that it imports
 * `nonWorkingDays` does not itself count as importing it — which it otherwise
 * would, and that is exactly the kind of false green this file exists to refuse.
 */
function dataReadersIn(root: string): string[] {
  const dir = join(root, 'src', 'add-ons');
  if (!existsSync(dir)) return [];
  const walk = (at: string): string[] =>
    readdirSync(at, { withFileTypes: true }).flatMap((entry) => {
      if (entry.name === 'vendor') return [];
      const full = join(at, entry.name);
      if (entry.isDirectory()) return walk(full);
      return /\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.') ? [full] : [];
    });
  const keys = new Set<string>();
  for (const file of walk(dir)) {
    const code = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '\n')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    for (const m of code.matchAll(
      /import\s*\{([^}]*)\}\s*from\s*['"][^'"]*vendor\/([a-z][a-z0-9-]*)\/[^'"]*['"]/g,
    )) {
      const key = m[2]!;
      if (key === 'host') continue;
      const bound = m[1]!
        .split(',')
        .map((part) => part.replace(/\btype\b/g, '').split(/\bas\b/)[0]!.trim())
        .filter((part) => part.length > 0);
      if (bound.some((name) => name !== 'register')) keys.add(key);
    }
  }
  return [...keys].sort();
}

const HOST_ROOTS: readonly { name: string; root: string }[] = [
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
  /*
   * ── THE TWO APPS THAT ARE TARGETS WITHOUT BEING HOSTS ────────────────────
   *
   * [Added 2026-08-28, wave 6.] `holiday-calendars` attaches to `hr` and
   * `clinic`, and until these two lines existed the stray case below reported
   * that claim as unverifiable — correctly, since neither app was checked out
   * as far as this suite knew, and an `attaches` entry naming an app nobody has
   * is a claim nothing can test.
   *
   * They ARE checked out; nobody had told this file about them. Adding them buys
   * the check that matters for a manifest: `validateManifest` runs against each
   * app's OWN declared tables, so a scope naming a table people-ops has not got
   * is refused here rather than by an installer. What it does NOT buy is the
   * attach-surface gate, because neither app mounts add-on slots yet — see
   * `HostApp.hostedSlots`.
   */
  {
    name: 'people-ops',
    root:
      process.env.ADMINIUM_PEOPLE_OPS ??
      fileURLToPath(new URL('../../../../people-ops', import.meta.url)),
  },
  {
    name: 'clinic-desk',
    root:
      process.env.ADMINIUM_CLINIC_DESK ??
      fileURLToPath(new URL('../../../../clinic-desk', import.meta.url)),
  },
  /*
   * ── THE FIRST HOST THAT MOUNTS A STRICT SUBSET (31-T06) ──────────────────
   *
   * [Added 2026-08-28, wave 6.] `factory-ops` — app key `factory` — hosts
   * `order.dispatch.actions` and `settings.add-on.panel` and nothing else: its
   * manifest declares one frontend, `side: "staff"`, so the carrier's two
   * customer-facing fills have nowhere to draw and never render there.
   *
   * That is worth a line of its own because it is the case the attach-surface
   * gate below was written for and had never met. `print-shop` and `maker-shop`
   * both mount a superset of what the carrier fills, so "attaches to an app it
   * can work in" and "attaches to an app that mounts everything it fills" gave
   * the same answer in both. Here they diverge, and the gate's own rule — an
   * add-on must fill at least one slot the host mounts BEYOND the add-on's own
   * management surface — is the one that turns out to be right.
   */
  {
    name: 'factory-ops',
    root:
      process.env.ADMINIUM_FACTORY_OPS ??
      fileURLToPath(new URL('../../../../factory-ops', import.meta.url)),
  },
  /*
   * ── AND THE OTHER HALF OF THAT SUBSET (31-T05) ───────────────────────────
   *
   * [Added 2026-08-28, wave 6.] `ecommerce-storefront` — app key
   * `ecommerce-shop` — is `factory-ops`'s mirror image. Its manifest declares
   * one frontend, `side: "customer"`, so it hosts `checkout.delivery.methods`
   * and `order.dispatch.panel` and CANNOT host `order.dispatch.actions`: that
   * is somebody standing in a warehouse, and this app has no screen where that
   * person works.
   *
   * The two together are what makes the attach-surface gate below worth having
   * rather than merely true. One host mounting a strict subset could be a host
   * that had not finished; two hosts mounting COMPLEMENTARY subsets of one
   * add-on's four fills, with no change to a line of that add-on, is 24 D21
   * demonstrated from both ends.
   */
  {
    name: 'ecommerce-storefront',
    root:
      process.env.ADMINIUM_ECOMMERCE_STOREFRONT ??
      fileURLToPath(new URL('../../../../ecommerce-storefront', import.meta.url)),
  },
];

/** The checked-out directory a host name stands for. */
function rootOf(name: string): string {
  return HOST_ROOTS.find((entry) => entry.name === name)!.root;
}

/** Each host app that is actually checked out, read from its own manifest. */
function hostApps(): HostApp[] {
  const out: HostApp[] = [];
  for (const { name, root } of HOST_ROOTS) {
    const file = join(root, 'manifest.json');
    if (!existsSync(file)) continue;
    const doc = JSON.parse(readFileSync(file, 'utf8')) as {
      kind?: string;
      key?: string;
      requiredSchema?: { tables?: { ref: string }[] };
    };
    if (doc.kind !== 'app' || typeof doc.key !== 'string') continue;
    out.push({
      name,
      key: doc.key,
      tables: (doc.requiredSchema?.tables ?? []).map((table) => table.ref),
      hostedSlots: constArrayIn(join(root, 'src', 'add-ons', 'slots.ts'), 'HOSTED_SLOTS'),
      readsDataFrom: dataReadersIn(root),
    });
  }
  return out;
}

const HOSTS = hostApps();

if (HOSTS.length === 0) {
  console.info(
    '[add-on-host] no add-on was validated against a host app: none of ' +
      `${HOST_ROOTS.map((h) => h.root).join(', ')} holds an app manifest. ` +
      'Check the hosts out beside this repo (or point ADMINIUM_PRINT_SHOP / ' +
      'ADMINIUM_MAKER_SHOP at them) and every add-on is checked for the two rules ' +
      'that only make sense against an app: ATTACH_TARGET_UNKNOWN and SCOPE_OUT_OF_RANGE.',
  );
}

/** One row per (add-on, app it attaches to), which is one row per install. */
function installs(): { pkg: string; app: string; manifest: unknown }[] {
  const known = new Map(HOSTS.map((host) => [host.key, host]));
  return manifests().flatMap(({ pkg, manifest }) => {
    const doc = manifest as { addOn?: { attaches?: { app?: string; table?: string }[] } };
    return (doc.addOn?.attaches ?? [])
      .filter((target) => target.app !== '*' && known.has(target.app ?? ''))
      .map((target) => ({ pkg, app: target.app!, manifest }));
  });
}

describe.skipIf(HOSTS.length === 0)(
  'every add-on installs into every app it says it attaches to',
  () => {
    const known = HOSTS.map((host) => host.key);

    it.each(installs())('$pkg installs into $app', ({ app, manifest }) => {
      const host = HOSTS.find((entry) => entry.key === app)!;
      expect(host.tables.length, `${host.name} declares no tables`).toBeGreaterThan(0);

      const result = validateManifest(manifest, {
        knownAppKeys: known,
        hostTables: host.tables,
      });
      expect(
        issuesOf(result),
        `the installer would refuse this add-on for the "${app}" app`,
      ).toEqual([]);
      expect(result.ok).toBe(true);
    });

    /**
     * AN `attaches` ENTRY NAMING AN APP NOBODY HAS is skipped by `installs()`
     * — it has no host to be checked against — and a skipped row reads exactly
     * like a passing one. So the app keys are named here as well: every app an
     * add-on attaches to is one of the hosts this repo knows about, or the
     * claim is unverifiable and this is where that is said out loud.
     */
    it('attaches to no app this repo cannot check it against', () => {
      const strays: string[] = [];
      for (const { pkg, manifest } of manifests()) {
        const doc = manifest as { addOn?: { attaches?: { app?: string }[] } };
        for (const target of doc.addOn?.attaches ?? []) {
          if (target.app === '*' || known.includes(target.app ?? '')) continue;
          strays.push(`${pkg} attaches to "${target.app}", which is not a host checked out here`);
        }
      }
      expect(strays, `\n${strays.join('\n')}\n`).toEqual([]);
    });

    /**
     * THE GATE, PROVED, in the exact shape that shipped: a `records:` scope on
     * a table the host app has not got. Without this, a green run cannot be
     * told apart from a run that forgot to pass `hostTables`.
     */
    it('refuses a scope on a table the host app does not have', () => {
      const host = HOSTS[0]!;
      const [first] = manifests();
      const broken = structuredClone(first!.manifest) as { addOn: { scopes: string[] } };
      broken.addOn.scopes = ['records:no_such_table:read'];

      const result = validateManifest(broken, {
        knownAppKeys: known,
        hostTables: host.tables,
      });
      expect(result.ok).toBe(false);
      expect(
        issuesOf(result).some((issue) => issue.path === 'addOn.scopes.0'),
        'the scope check did not run — was hostTables passed?',
      ).toBe(true);
    });
  },
);

/**
 * ── AN ATTACH CLAIM THAT RESOLVES TO NOWHERE ────────────────────────────────
 *
 * [Added 2026-08-11, wave 4b round 4.] Every rule above is about whether an
 * add-on can be INSTALLED into an app. None of them asks the next question:
 * once installed, does it DRAW anything there.
 *
 * The Live Personalizer's manifest named `printing` and the print works mounts
 * none of the six surfaces it fills. Registered in a scratch print-shop it ran
 * cleanly, validated cleanly, and personalized nothing — the two builds have
 * exactly one slot in common and it is the add-on's own settings form. A shop
 * that installed it got a page of controls for a feature with nowhere to
 * happen. Nothing anywhere could have caught that: the schema does not know
 * what a host mounts, and the host does not know what has claimed it.
 *
 * ── WHY THE SETTINGS PANEL DOES NOT COUNT ───────────────────────────────────
 *
 * The obvious rule — "the intersection must be non-empty" — is blind to the
 * exact case it was written for, because `settings.add-on.panel` is in that
 * intersection. Every host mounts it and very nearly every add-on fills it, and
 * it is the one slot that exists ONLY BECAUSE the add-on is installed: it
 * configures the add-on and does nothing in the shop. An add-on whose entire
 * presence in an app is its own settings form has not attached to that app in
 * any sense a shop owner would recognise.
 *
 * So the rule is stated over the surfaces where an add-on does WORK. That is a
 * property of the slot, not of this wave's add-ons, and it is written as a
 * named set rather than an inline `!==` so that adding a second management
 * slot to the registry is a decision somebody makes here on purpose.
 *
 * ── DIRECTION, AND WHAT IT DELIBERATELY DOES NOT SAY ────────────────────────
 *
 * It does NOT require a host to mount every slot an add-on fills. That is D21's
 * whole point and this repo relies on it: the delivery add-on fills
 * `artwork.sources` in one host and not the other, and a fill nobody mounts is
 * dropped in silence. What is forbidden is claiming an app where the count of
 * mounted, working surfaces is ZERO.
 *
 * `app: "*"` is not checked, for the same reason it is not checked above: it
 * names the generated dashboard and every app that does not exist yet, and the
 * only honest thing to say about a host nobody has is nothing.
 *
 * ── A `table` KEY IS NOT AN EXEMPTION, AND USED TO BE ───────────────────────
 *
 * The first version of this gate opened with
 *
 *     if (target.app === "*" || target.table !== undefined) continue;
 *
 * which skipped ANY target carrying a `table`, whatever `app` said. The reason
 * the second clause looked harmless is that the only table targets in this repo
 * are `{ app: "*", table: … }`, so it was true of every case its author had in
 * front of them — and the first clause already covered all of those.
 *
 * What it actually bought was a four-character bypass of the whole rule. The
 * mutant the gate was written for is a manifest attaching to `printing` and
 * filling nothing that works there; adding `"table": "anything"` beside it made
 * that manifest pass. A table target NAMES A TABLE INSIDE AN APP, so if the app
 * is a real host and the add-on draws nothing there, the claim is exactly as
 * empty as it would be without the key. The `table` clause is gone, and the
 * fixture below is the same false claim with the key added.
 */
const SELF_MANAGEMENT_SLOTS: readonly string[] = ['settings.add-on.panel'];

/**
 * One line per attach claim that would draw nothing in the app it names.
 *
 * Both the manifests and the hosts are ARGUMENTS. The real call passes the real
 * ones; the proof below passes a fixture through this same function, so a
 * mutation to the rule fails the proof — which is not true of a proof that
 * restates the rule beside it.
 */
function emptyAttachClaims(
  docs: readonly { pkg: string; manifest: unknown }[],
  hosts: readonly HostApp[],
): string[] {
  const byKey = new Map(hosts.map((host) => [host.key, host]));
  const out: string[] = [];
  for (const { pkg, manifest } of docs) {
    const doc = manifest as {
      key?: string;
      addOn?: { attaches?: { app?: string; table?: string }[]; slots?: { slot: string }[] };
    };
    /*
     * The add-on's OWN key, not its package directory name. They agree for every
     * package here and are still different things — `readsDataFrom` holds what a
     * host vendored, and a host vendors by key.
     */
    const key = doc.key ?? pkg;
    const fills = (doc.addOn?.slots ?? []).map((fill) => fill.slot);
    for (const target of doc.addOn?.attaches ?? []) {
      if (target.app === '*') continue;
      const host = byKey.get(target.app ?? '');
      if (host === undefined) continue;
      /*
       * AN APP WITH NO ADD-ON SEAM IS NOT AN EMPTY CLAIM, and reading it as one
       * would be this gate's own founding mistake in reverse. The question here
       * is "does the add-on draw anything in the app it names"; an app that
       * mounts no slots at all has not answered it, and reporting `undefined`
       * as zero would fail an add-on for something the APP has not done yet.
       *
       * The exemption is not silent: `appsWithNoAddOnSeam` below names every
       * app in this state, so a host that quietly LOST its `slots.ts` shows up
       * as an app that stopped hosting add-ons rather than as a gate going
       * green.
       */
      const hosted = host.hostedSlots;
      if (hosted === undefined) continue;
      const working = fills.filter(
        (slot) => hosted.includes(slot) && !SELF_MANAGEMENT_SLOTS.includes(slot),
      );
      if (working.length > 0) continue;
      /*
       * THE SECOND WAY AN ADD-ON DRAWS SOMETHING, and it is an EXTENSION of
       * this rule rather than a hole in it.
       *
       * [Added 2026-08-28, wave 6. See 31-add-on-candidates.md §12.3e.]
       *
       * Everything above assumes an add-on reaches an app through a SLOT, which
       * was true of every add-on that existed when this gate was written.
       * `holiday-calendars` is the first that does not: it fills
       * `settings.add-on.panel` and nothing else, and does its whole job through
       * a plain exported function the HOST calls — the host merges the array it
       * returns into the host's own records, at the mount site. Installed and
       * imported, the leave form's working-day count moves and the clinic day
       * sheet shows shut. By slots alone that is indistinguishable from the
       * Live Personalizer defect above, and it is the opposite of it.
       *
       * SO THE QUESTION IS UNCHANGED — does it draw anything here — AND THE
       * EVIDENCE GAINS A SECOND SHAPE. The temptation was to exempt data packs;
       * that would have weakened the gate to make a build pass, which is the one
       * move this file exists to refuse. Reading the host's own imports instead
       * makes it STRICTER for this class: until now the gate had no opinion at
       * all about whether any host actually consumes a data pack, and now a data
       * pack nobody reads is an empty claim like any other.
       *
       * It cannot launder the case above. The Live Personalizer fills working
       * slots its host does not mount, and no host imports anything from it but
       * `register` — so this clause never fires for it, which the fixtures below
       * assert rather than assume.
       */
      if (host.readsDataFrom.includes(key)) continue;
      const shared = fills.filter((slot) => hosted.includes(slot));
      out.push(
        `${pkg} attaches to "${target.app}" (${host.name}), which mounts ` +
          (shared.length === 0
            ? 'none of the slots it fills'
            : `only ${shared.join(', ')} — the add-on's own management surface, and nothing it works in`),
      );
    }
  }
  return out;
}

/** Apps that mount add-ons at all — the only ones the surface gate can judge. */
const ADD_ON_HOSTS = HOSTS.filter((host) => host.hostedSlots !== undefined);
/** Apps an add-on can be INSTALLED into that have no seam to draw on yet. */
const TARGET_ONLY = HOSTS.filter((host) => host.hostedSlots === undefined);

const slotsReadable = ADD_ON_HOSTS.every((host) => host.hostedSlots!.length > 0);

if (ADD_ON_HOSTS.length > 0 && !slotsReadable) {
  console.info(
    '[add-on-host] the attach-surface gate was not run: HOSTED_SLOTS could not be parsed out ' +
      `of ${ADD_ON_HOSTS.filter((h) => h.hostedSlots!.length === 0)
        .map((h) => join(h.name, 'src/add-ons/slots.ts'))
        .join(', ')}. An add-on could claim an app it draws nothing in.`,
  );
}

describe.skipIf(HOSTS.length === 0)('an attach claim resolves to a surface somebody mounts', () => {
  it('parsed the hosted slots out of every host that mounts add-ons', () => {
    // A guard that silently read zero slots would pass everything below it.
    // Scoped to the apps that HAVE a seam: an app with none is a different
    // state and is named by its own case, not failed here.
    for (const host of ADD_ON_HOSTS) {
      expect(
        host.hostedSlots!.length,
        `failed to parse HOSTED_SLOTS in ${host.name}`,
      ).toBeGreaterThan(0);
    }
    expect(ADD_ON_HOSTS.length, 'no app in HOST_ROOTS mounts add-ons at all').toBeGreaterThan(0);
  });

  /**
   * ── THE EXEMPTION, SAID OUT LOUD ──────────────────────────────────────────
   *
   * `emptyAttachClaims` cannot judge an app that mounts no slots, so it skips
   * one — and a skip that nobody can see is the failure mode this whole file
   * keeps finding. This case prints them.
   *
   * It is deliberately NOT an assertion that the list is empty. Two apps are in
   * it today on purpose: people-ops and clinic-desk consume `holiday-calendars`
   * as DATA, through a read surface the host calls at its own mount site, and
   * neither has been given an add-on seam. That is a real, current state of the
   * fleet, and the honest thing for a suite to do with it is name it rather
   * than pretend either that it is fine or that it is a failure.
   *
   * WHAT IT DOES ASSERT is that the state is knowable: every such app is one
   * this repository can see, and it is missing the seam FILE rather than
   * failing to parse it — which is the difference the third state of
   * `hostedSlots` exists to carry.
   */
  it('names every app an add-on may target but cannot yet draw in', () => {
    const named = TARGET_ONLY.map((host) => `${host.name} (${host.key})`);
    if (named.length > 0) {
      console.info(
        `[add-on-host] these apps have manifests and tables but no src/add-ons/slots.ts, so an ` +
          `attach claim on them is checked for INSTALLABILITY only: ${named.join(', ')}`,
      );
    }
    for (const host of TARGET_ONLY) {
      expect(existsSync(join(rootOf(host.name), 'manifest.json')), host.name).toBe(true);
      expect(existsSync(join(rootOf(host.name), 'src', 'add-ons', 'slots.ts')), host.name).toBe(
        false,
      );
    }
  });

  it('has no add-on claiming an app whose hosted slots it cannot fill', () => {
    const empty = emptyAttachClaims(manifests(), HOSTS);
    expect(empty, `\n${empty.join('\n')}\n`).toEqual([]);
  });

  /**
   * THE GATE, PROVED — twice, because it has two ways to go blind.
   *
   * The first fixture is an add-on that shares NO slot with the host: the
   * ordinary case, and the one any version of this rule would catch.
   *
   * The second is THE SHAPE THAT SHIPPED, and it is the one worth having: an
   * add-on that shares exactly `settings.add-on.panel` and nothing else. A gate
   * written as "the intersection must be non-empty" passes it, which is why
   * `SELF_MANAGEMENT_SLOTS` exists — and this fixture is what fails if somebody
   * later decides that set looks like an over-complication and deletes it.
   *
   * Both go through `emptyAttachClaims` itself rather than through a restated
   * copy of its rule, and the third case asserts the gate still says nothing
   * about an add-on that DOES fill a working surface — a guard that reported
   * everything would pass these two and be worthless.
   */
  it.each([
    { name: 'no slot in common at all', slots: ['product.options.personalize'], reports: 1 },
    {
      name: 'nothing in common but the add-on’s own settings form',
      slots: ['product.options.personalize', 'settings.add-on.panel'],
      reports: 1,
    },
    {
      name: 'one surface the host really mounts',
      slots: ['order.dispatch.panel', 'settings.add-on.panel'],
      reports: 0,
    },
  ])('reports $reports claim(s) for an add-on filling $name', ({ slots, reports }) => {
    const pretend: HostApp = {
      name: 'a made-up host',
      key: 'fixture-app',
      tables: [],
      hostedSlots: ['order.dispatch.panel', 'settings.add-on.panel'],
      // Reads NOTHING. The data-pack clause must not fire for any case above,
      // or these three would be passing for a reason they did not intend.
      readsDataFrom: [],
    };
    const fixture = {
      pkg: 'fixture-add-on',
      manifest: {
        key: 'fixture-add-on',
        addOn: {
          attaches: [{ app: 'fixture-app', range: '^1.0.0' }],
          slots: slots.map((slot) => ({ slot })),
        },
      },
    };

    const found = emptyAttachClaims([fixture], [pretend]);
    expect(found).toHaveLength(reports);
    if (reports > 0) expect(found[0]).toContain('fixture-app');
  });

  /**
   * ── THE DATA-PACK CLAUSE, PROVED IN BOTH DIRECTIONS ─────────────────────────
   *
   * [Added 2026-08-28, wave 6.] The clause that lets a host's own IMPORT stand
   * in for a mounted working slot is the one thing in this gate that can make it
   * weaker, so it is asserted from both ends against the SAME fixture: the only
   * difference between the two cases below is whether the host reads the add-on.
   *
   * The second case is the one that matters. An add-on whose whole presence is
   * its settings form, that no host reads, is STILL an empty claim — so the
   * clause cannot be used to wave through the defect this gate was written for.
   */
  it.each([
    { name: 'a host that reads it', readsDataFrom: ['fixture-pack'], reports: 0 },
    { name: 'a host that does not', readsDataFrom: [], reports: 1 },
  ])('a data pack filling only its own settings form: $name', ({ readsDataFrom, reports }) => {
    const pretend: HostApp = {
      name: 'a made-up host',
      key: 'fixture-app',
      tables: [],
      hostedSlots: ['order.dispatch.panel', 'settings.add-on.panel'],
      readsDataFrom,
    };
    const pack = {
      pkg: 'fixture-pack',
      manifest: {
        key: 'fixture-pack',
        addOn: {
          attaches: [{ app: 'fixture-app', range: '^1.0.0' }],
          slots: [{ slot: 'settings.add-on.panel' }],
        },
      },
    };

    expect(emptyAttachClaims([pack], [pretend])).toHaveLength(reports);
  });

  /**
   * AND IT KEYS OFF THE ADD-ON'S OWN KEY, not the package directory name.
   *
   * A host vendors by key. If this ever read `pkg` instead, a host reading add-on
   * `a` would excuse an empty claim by add-on `b` whose directory happened to be
   * named `a` — a bypass nobody would find by reading the rule.
   */
  it('does not credit a read of a different add-on', () => {
    const pretend: HostApp = {
      name: 'a made-up host',
      key: 'fixture-app',
      tables: [],
      hostedSlots: ['settings.add-on.panel'],
      readsDataFrom: ['some-other-add-on'],
    };
    const pack = {
      pkg: 'fixture-pack',
      manifest: {
        key: 'fixture-pack',
        addOn: {
          attaches: [{ app: 'fixture-app', range: '^1.0.0' }],
          slots: [{ slot: 'settings.add-on.panel' }],
        },
      },
    };
    expect(emptyAttachClaims([pack], [pretend])).toHaveLength(1);
  });

  /**
   * THE GUARD ON THE GUARD: the reader found something in the real tree.
   *
   * `dataReadersIn` is a regex over a sibling repo's source. A rename, a moved
   * directory or a changed import style would make it return `[]` for every
   * host — and `[]` is exactly the shape "this host reads nothing" takes, so the
   * gate would go on passing while the clause silently stopped meaning anything.
   * The real hosts are the only thing that can catch that.
   */
  it('reads at least one real host that consumes an add-on as data', () => {
    const readers = HOSTS.filter((host) => host.readsDataFrom.length > 0);
    expect(
      readers.map((host) => `${host.name} → ${host.readsDataFrom.join(', ')}`),
      'no checked-out host imports a non-`register` binding from a vendored add-on: ' +
        'either none does, or `dataReadersIn` has stopped matching how they import',
    ).not.toEqual([]);
  });

  /**
   * THE FOUR-CHARACTER BYPASS, KEPT AS THE CASE THAT WOULD REOPEN IT.
   *
   * The gate skipped every target carrying a `table`, so the false claim it was
   * written to catch passed with `"table": "anything"` written beside it. Both
   * fixtures below are the SAME empty claim and differ only by that key; a
   * `table` clause anywhere in `emptyAttachClaims` makes the second pass and
   * fails here.
   *
   * The third fixture is what the clause was mistaken for: a table target on
   * `app: "*"`, which is the shape both dashboard mounts in this repo use and
   * which is skipped by the `"*"` rule that was always there. It stays quiet,
   * so closing the hole did not close the door the personalizer walks through.
   */
  it('is not fooled by a table key beside a false app claim', () => {
    const pretend: HostApp = {
      name: 'a made-up host',
      key: 'fixture-app',
      tables: ['products'],
      hostedSlots: ['order.dispatch.panel', 'settings.add-on.panel'],
      readsDataFrom: [],
    };
    const claiming = (target: Record<string, unknown>) => ({
      pkg: 'fixture-add-on',
      manifest: {
        addOn: {
          attaches: [target],
          slots: [{ slot: 'product.options.personalize' }, { slot: 'settings.add-on.panel' }],
        },
      },
    });

    // The claim the gate was written for.
    expect(
      emptyAttachClaims([claiming({ app: 'fixture-app', range: '^1.0.0' })], [pretend]),
    ).toHaveLength(1);
    // The same claim, with the four characters that used to switch the gate off.
    expect(
      emptyAttachClaims(
        [claiming({ app: 'fixture-app', range: '^1.0.0', table: 'products' })],
        [pretend],
      ),
    ).toHaveLength(1);
    // And a dashboard mount, which names no host and is still nobody's business.
    expect(emptyAttachClaims([claiming({ app: '*', table: 'products' })], [pretend])).toEqual([]);
  });
});
