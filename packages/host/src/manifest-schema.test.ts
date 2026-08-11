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
 * ── HOW IT REACHES A PACKAGE IT CANNOT INSTALL ──────────────────────────────
 *
 * `@adminium/manifest` is published to no registry, and it cannot be installed
 * from a path either: its own `package.json` declares `zod: "catalog:"` and
 * `@adminium/add-on-contracts: "workspace:*"`, two pnpm protocols npm does not
 * understand, so `npm i file:../adminium/packages/manifest` fails at resolve.
 *
 * So it is loaded the way the host seam already is: from a SIBLING CHECKOUT, by
 * path, at run time. Its built `dist/` imports `@adminium/add-on-contracts` and
 * `zod` as bare specifiers, and Node resolves both from the importing file's
 * own directory — inside the product's `node_modules`, not this repo's — so the
 * validator that runs here is byte-for-byte the one that runs there.
 *
 *   <somewhere>/add-ons     ← this repo
 *   <somewhere>/adminium    ← the product, with packages/manifest built
 *
 * `ADMINIUM_REPO` points elsewhere. A clean clone of this repo alone has no
 * product beside it and must still be green — an add-on author is not required
 * to check out the product to work on an add-on — so it reports what it looked
 * for and skips, exactly as the mirror guard does.
 *
 * THE PROPER FIX IS TO PUBLISH. `@adminium/manifest` and
 * `@adminium/add-on-contracts` are already versioned, AGPL-licensed and
 * `files: ["dist"]`; publishing them turns this from a skippable path lookup
 * into an ordinary devDependency that CI cannot be missing. That is a decision
 * for the product's release process rather than something an add-on repo can
 * take, and it is recorded here so the skip is a known cost rather than a
 * silent one.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/** `packages/` — this repo's own, holding one directory per add-on. */
const PACKAGES = fileURLToPath(new URL('../..', import.meta.url));

const PRODUCT_ROOT =
  process.env.ADMINIUM_REPO ?? fileURLToPath(new URL('../../../../adminium', import.meta.url));

const VALIDATOR = join(PRODUCT_ROOT, 'packages', 'manifest', 'dist', 'index.js');

interface Issue {
  path: string;
  message: string;
}

interface ValidateOptions {
  knownAppKeys?: readonly string[];
  hostTables?: readonly string[];
}

interface Validator {
  validateManifest: (
    value: unknown,
    opts?: ValidateOptions,
  ) => { ok: boolean; issues?: readonly Issue[] };
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

const available = existsSync(VALIDATOR);

if (!available) {
  console.info(
    `[add-on-host] the real manifest validator was not run: nothing at ${VALIDATOR}. ` +
      'Clone the product beside this repo (or point ADMINIUM_REPO at it) and build ' +
      'packages/manifest, and every manifest here is checked against the schema the ' +
      'product enforces.',
  );
}

describe.skipIf(!available)('the manifests pass @adminium/manifest itself', () => {
  it.each(manifests())('$pkg validates against the frozen v1 schema', async ({ manifest }) => {
    const { validateManifest } = (await import(
      /* @vite-ignore */ pathToFileURL(VALIDATOR).href
    )) as Validator;

    const result = validateManifest(manifest);
    expect(
      result.issues ?? [],
      'the real validator rejects this manifest',
    ).toEqual([]);
    expect(result.ok).toBe(true);
  });

  /**
   * THE GATE, PROVED — because a validator nobody has watched reject something
   * is a validator that might not be wired up at all. This is the exact shape
   * the personalizer shipped: a dashboard mount naming a table and no app.
   */
  it('rejects the attach target this repo actually shipped', async () => {
    const { validateManifest } = (await import(
      /* @vite-ignore */ pathToFileURL(VALIDATOR).href
    )) as Validator;

    const [first] = manifests();
    const broken = structuredClone(first!.manifest) as {
      addOn: { attaches: unknown[] };
    };
    broken.addOn.attaches = [{ table: 'products' }];

    const result = validateManifest(broken);
    expect(result.ok).toBe(false);
    expect(result.issues?.some((issue) => issue.path.startsWith('addOn.attaches'))).toBe(true);
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
  /** The slots this app's build actually mounts — its own `HOSTED_SLOTS`. */
  hostedSlots: readonly string[];
}

/**
 * The string literals of a top-level `export const NAME = [ … ] as const`,
 * comments stripped first so a slot id quoted in prose is never read as code.
 *
 * The same shape `host-mirror.test.ts` uses, and for the same reason: reading a
 * sibling repo's declarations with the TypeScript compiler API would make this
 * suite depend on being able to typecheck a different repo.
 */
function constArrayIn(path: string, name: string): string[] {
  if (!existsSync(path)) return [];
  const source = readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '\n')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  const match = new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\]`).exec(source);
  if (match === null) return [];
  return [...match[1]!.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]!);
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
];

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
    });
  }
  return out;
}

const HOSTS = hostApps();

if (available && HOSTS.length === 0) {
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

describe.skipIf(!available || HOSTS.length === 0)(
  'every add-on installs into every app it says it attaches to',
  () => {
    const known = HOSTS.map((host) => host.key);

    it.each(installs())('$pkg installs into $app', async ({ app, manifest }) => {
      const { validateManifest } = (await import(
        /* @vite-ignore */ pathToFileURL(VALIDATOR).href
      )) as Validator;

      const host = HOSTS.find((entry) => entry.key === app)!;
      expect(host.tables.length, `${host.name} declares no tables`).toBeGreaterThan(0);

      const result = validateManifest(manifest, {
        knownAppKeys: known,
        hostTables: host.tables,
      });
      expect(
        result.issues ?? [],
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
    it('refuses a scope on a table the host app does not have', async () => {
      const { validateManifest } = (await import(
        /* @vite-ignore */ pathToFileURL(VALIDATOR).href
      )) as Validator;

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
        result.issues?.some((issue) => issue.path === 'addOn.scopes.0'),
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
      addOn?: { attaches?: { app?: string; table?: string }[]; slots?: { slot: string }[] };
    };
    const fills = (doc.addOn?.slots ?? []).map((fill) => fill.slot);
    for (const target of doc.addOn?.attaches ?? []) {
      if (target.app === '*') continue;
      const host = byKey.get(target.app ?? '');
      if (host === undefined) continue;
      const working = fills.filter(
        (slot) => host.hostedSlots.includes(slot) && !SELF_MANAGEMENT_SLOTS.includes(slot),
      );
      if (working.length > 0) continue;
      const shared = fills.filter((slot) => host.hostedSlots.includes(slot));
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

const slotsReadable = HOSTS.every((host) => host.hostedSlots.length > 0);

if (HOSTS.length > 0 && !slotsReadable) {
  console.info(
    '[add-on-host] the attach-surface gate was not run: HOSTED_SLOTS could not be parsed out ' +
      `of ${HOSTS.filter((h) => h.hostedSlots.length === 0)
        .map((h) => join(h.name, 'src/add-ons/slots.ts'))
        .join(', ')}. An add-on could claim an app it draws nothing in.`,
  );
}

describe.skipIf(HOSTS.length === 0)('an attach claim resolves to a surface somebody mounts', () => {
  it('parsed the hosted slots out of every host checked out', () => {
    // A guard that silently read zero slots would pass everything below it.
    for (const host of HOSTS) {
      expect(host.hostedSlots.length, `failed to parse HOSTED_SLOTS in ${host.name}`).toBeGreaterThan(
        0,
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
    };
    const fixture = {
      pkg: 'fixture-add-on',
      manifest: {
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
