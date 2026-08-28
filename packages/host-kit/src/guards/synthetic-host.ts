/**
 * A WHOLE HOST, IN A TEMP DIRECTORY, so a guard can be caught failing.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * Every guard in this package is an ABSENCE: it walks a host's files and
 * asserts a list is empty. Run against a clean tree, all nine pass, and a guard
 * that has never been seen to fail is indistinguishable from one that reads
 * nothing at all. That is not a hypothetical failure mode here — it is the one
 * this repository has met most often. A gate went blind because a glob stopped
 * matching; a gate went blind because a prefix was renamed in a component and
 * missed in four test files; a gate went blind because a comment stripper ate
 * the line it was pointed at. Every one of them stayed green.
 *
 * So this package's own suite plants the defect and checks the guard reports
 * it. Most of that is done against the pure detectors, which take text and
 * return findings. Four of the guards cannot be — `brand`, `label-pairing`'s
 * source half, `vendored` and `tier` all ask questions about a TREE: which
 * files exist, what a `package.json` declares, whether an exemption still names
 * a real file. Those need a host, and `config.ts` anticipated exactly this when
 * it made `rootDir` absolute: "two of the guards are driven from the kit's own
 * suites against a synthetic host in a temp directory, and a guard that only
 * works when the process happens to have been started in the right place cannot
 * be proven to bite."
 *
 * ── IT SHIPS INTO EVERY HOST, AND THAT IS THE LESSER EVIL ───────────────────
 *
 * The install vendors `src/guards/`, so this module lands in twelve hosts that
 * will never call it. Two alternatives were considered and both are worse: a
 * copy of it inside each of the four test files that need it is the exact
 * hand-copy drift this whole package exists to end, and a build step that
 * excluded it would make the vendored tree differ from the source tree, which
 * is what `vendored.ts` exists to detect. It imports nothing but `node:` and
 * this package's own types, no guard references it, and `brand.ts` already
 * refuses to let any shipped file reach this directory at all.
 *
 * ── THE DEFAULT HOST IS CLEAN, AND EVERY TEST BREAKS IT ON PURPOSE ──────────
 *
 * `syntheticHost()` with no arguments builds a tier-1 host that passes all
 * seven no-DOM guards. A test then adds ONE bad file and asserts ONE guard
 * reports it — so a failure names the thing that changed rather than a pile of
 * findings a reader has to sort through.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import type { SlotId } from '@adminium/add-on-host';

import type { HostKitConfig, HostKitTier } from '../config.ts';

/** The one add-on the default host vendors. */
const ADD_ON = 'shipping-example';

const header = (from: string): string =>
  [
    '/*',
    ` * VENDORED from add-ons/packages/${from} — synced by scripts/sync-add-ons.sh.`,
    ' * Never hand-edit this copy: edit the monorepo and re-run the sync.',
    ' */',
    '',
  ].join('\n');

/**
 * The files a clean host has, keyed by path relative to its root.
 *
 * Every one of them is here because a guard reads it, and a reader adding one
 * should be able to say which. In order: the package manifest `tier.ts` reads;
 * a screen that mounts a slot and names an add-on correctly; the registry with
 * the one import line `brand.ts` forgives; three vendored files; the stylesheet
 * `styles.ts` looks for; and a suite naming every tier-1 guard, without which
 * `tier.ts` reports this host as having installed nothing.
 */
function cleanFiles(prefix: string): Record<string, string> {
  return {
    'package.json': JSON.stringify(
      {
        name: 'synthetic-host',
        private: true,
        devDependencies: { typescript: '^5.7.2', vitest: '^3.2.4' },
        dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' },
      },
      null,
      2,
    ),
    'src/screens/Shop.tsx': [
      "import { AddOnSlot } from '../add-ons/kit/AddOnSlot.tsx';",
      "import { Affiliation } from '../components/Affiliation.tsx';",
      '',
      'export const Shop = () => (',
      '  <section>',
      '    <h3>{addOn.name}</h3>',
      '    <Affiliation />',
      '    <AddOnSlot slot="order.dispatch.actions" payload={{ order, now }} />',
      '  </section>',
      ');',
      '',
    ].join('\n'),
    'src/components/Affiliation.tsx': [
      'export const Affiliation = () => <p>{t(`addon.host.notAffiliated`)}</p>;',
      '',
    ].join('\n'),
    'src/add-ons/registry.ts': [
      `import { register as shippingExample } from './vendor/${ADD_ON}/index.ts';`,
      '',
      'export const demoAddOns = () => [shippingExample()];',
      '',
    ].join('\n'),
    'src/add-ons/vendor/host/host.ts': [
      header('host/src/host.ts'),
      'export interface AddOn {',
      '  key: string;',
      '}',
      '',
    ].join('\n'),
    [`src/add-ons/vendor/${ADD_ON}/index.ts`]: [
      header(`${ADD_ON}/src/index.ts`),
      "import type { AddOn } from '../host/host.ts';",
      '',
      'export const register = (): AddOn => ({ key: "shipping-example" });',
      '',
    ].join('\n'),
    [`src/add-ons/vendor/${ADD_ON}/add-on-facts.ts`]: [
      header(`${ADD_ON}/src/add-on-facts.ts`),
      'export const INERT_ORIGINS = [];',
      'export const NEVER_IN_A_BROWSER = [];',
      'export const COMPANY_MARKS = [];',
      '',
    ].join('\n'),
    'src/styles/components.css': [
      `.${prefix}-slot-spare {`,
      '  display: contents;',
      '}',
      `.${prefix}-slot-fill:not(:empty):not([data-drew="none"]) ~ .${prefix}-slot-spare {`,
      '  display: none;',
      '}',
      '',
    ].join('\n'),
    'src/kit.test.ts': [
      '// Names every tier-1 guard, which is what `tier.ts` reads to decide whether',
      '// this host installed the kit or merely vendored it.',
      'lexiconGuard(hostKit, scope);',
      'brandGuard(hostKit);',
      'labelPairingSourceGuard(hostKit);',
      'payloadCastsGuard(hostKit);',
      'factsGuard(hostKit);',
      'vendoredGuard(hostKit);',
      'stylesGuard(hostKit);',
      'tierGuard(hostKit);',
      '',
    ].join('\n'),
  };
}

export interface SyntheticHostSpec {
  appKey?: string;
  classPrefix?: string;
  tier?: HostKitTier;
  hostedSlots?: readonly SlotId[];
  localeTags?: readonly string[];
  affiliationExempt?: Readonly<Record<string, string>>;
  /** Stylesheets, relative to the host root. */
  stylesheets?: readonly string[];
  /**
   * Files to ADD or REPLACE, relative to the host root.
   *
   * A `null` value deletes one of the defaults, which is how a test plants "the
   * sync never ran" or "this host has no stylesheet" rather than "this host has
   * a broken one" — two different findings, and a guard that conflates them
   * tells a reader to look in the wrong place.
   */
  files?: Readonly<Record<string, string | null>>;
}

export interface SyntheticHost {
  config: HostKitConfig;
  /** Write one more file after the fact, for a test that plants mid-run. */
  write(relative: string, contents: string): void;
  /** Remove the temp tree. Always call it, and call it in `afterEach`. */
  dispose(): void;
}

/** Build a host on disk and hand back the config the guards take. */
export function syntheticHost(spec: SyntheticHostSpec = {}): SyntheticHost {
  const prefix = spec.classPrefix ?? 'sx';
  const rootDir = mkdtempSync(join(tmpdir(), 'host-kit-'));

  const write = (relative: string, contents: string): void => {
    const path = join(rootDir, relative);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents, 'utf8');
  };

  const files: Record<string, string | null> = { ...cleanFiles(prefix), ...(spec.files ?? {}) };
  for (const [relative, contents] of Object.entries(files)) {
    if (contents === null) continue;
    write(relative, contents);
  }

  const srcDir = join(rootDir, 'src');
  const config: HostKitConfig = {
    appKey: spec.appKey ?? 'synthetic-host',
    classPrefix: prefix,
    hostedSlots: spec.hostedSlots ?? ['order.dispatch.actions'],
    slotEmptyBehaviour: Object.fromEntries(
      (spec.hostedSlots ?? ['order.dispatch.actions']).map((slot) => [slot, 'silent' as const]),
    ) as HostKitConfig['slotEmptyBehaviour'],
    tier: spec.tier ?? 1,
    rootDir,
    srcDir,
    vendorDir: join(srcDir, 'add-ons', 'vendor'),
    localeTags: spec.localeTags ?? ['en-US'],
    stylesheets: (spec.stylesheets ?? ['src/styles/components.css']).map((file) =>
      join(rootDir, file),
    ),
    affiliationExempt: spec.affiliationExempt ?? {},
  };

  return {
    config,
    write,
    dispose: () => rmSync(rootDir, { recursive: true, force: true }),
  };
}
