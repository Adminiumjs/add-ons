#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Pack, X-ray, upload and LEDGER every add-on in this repository
 * (32-add-on-distribution.md §2, D1/D7; 48-self-hosted-downloads.md D1/D5/D6).
 *
 * Add-ons are not published to npm. Each packed file goes into the Adminiumjs
 * downloads bucket at `add-ons/<key>/<key>-<version>.tgz`, is read back from
 * https://downloads.adminium.dev, and only then enters the ledger. `npm pack`
 * survives as the LOCAL packer, because the server's hardened unpacker reads
 * exactly its tar shape (48 D5). The bucket client is `scripts/r2.mjs`,
 * vendored byte for byte from the Adminium monorepo's
 * `workplan/tools/app-release/r2.mjs` — the same file every app repo releases with.
 *
 * ── WHY A SCRIPT ────────────────────────────────────────────────────────────
 *
 *  - The packed NAME differs from the source name: `@adminium/add-on-x` is
 *    rewritten to `@adminiumjs/add-on-x` at pack time. The name only labels
 *    the tarball's package.json and the ledger row now — nothing resolves it
 *    on a registry — but it stays so every row, old and new, reads the same.
 *  - `devDependencies` name `@adminium/add-on-host`, which is on no registry,
 *    and `scripts` name tsconfigs that `files[]` excludes. Both would ship as
 *    instructions a consumer cannot follow.
 *  - The LICENSE lives once, at the repo root, and AGPL §4 wants it in every
 *    copy. npm only picks up a LICENSE from the PACKAGE root, so one is staged
 *    beside each package at pack time and removed afterwards.
 *  - The release LEDGER records the integrity of the exact bytes the public
 *    address serves. The marketplace catalog carries it to every server, which
 *    keeps a download only if its bytes hash to it (48 D3).
 *
 * ── WHAT THIS DELIBERATELY DOES *NOT* COPY FROM THE MONOREPO ────────────────
 *
 * No alias rewriting, no topological sort, no internal-graph assertion. Those
 * exist there because its packages depend on each other. Here they do not:
 * measured across all six built bundles, the only bare imports are `react`,
 * `react/jsx-runtime` and `lucide-react`. Publish order is therefore arbitrary,
 * and machinery for edges that do not exist is machinery that rots.
 *
 * ── PACK EVERYTHING, THEN UPLOAD EVERYTHING ─────────────────────────────────
 *
 * The one structural idea worth copying wholesale. A released version is
 * IMMUTABLE — the bucket lock keeps every file for good — so a defect
 * discovered while packing package five must not leave four already in the
 * bucket. Every tarball is built and X-rayed first; nothing is uploaded until
 * all of them pass.
 *
 * ── RE-RUNNING IS THE RECOVERY ──────────────────────────────────────────────
 *
 * If an upload or a read-back fails part-way, no ledger is written and no tag
 * is cut, so the same version can be dispatched again. Files already in the
 * bucket with the same bytes are accepted (`npm pack` is reproducible from the
 * same sources); a file there with DIFFERENT bytes stops the run, and that
 * version number is burned for every add-on in the fixed group.
 *
 *   node scripts/publish-add-ons.mjs --dry-run     # pack + X-ray, upload nothing
 *   node scripts/publish-add-ons.mjs               # upload, read back, write the ledger
 *
 * A real run needs R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID and
 * R2_SECRET_ACCESS_KEY; release.yml maps them from the Adminiumjs organization.
 * Both runs first read the newest published @adminiumjs/adminium from the npm
 * registry, and refuse any manifest whose compatibility.minAdminiumVersion is
 * newer (48-self-hosted-downloads.md A17).
 */

import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertMinimumReleased, newestAdminium, objectKeyFor, publishObject, r2ConfigFromEnv, sriOf } from './r2.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES = join(ROOT, 'packages');
const OUT_DIR = join(ROOT, 'scripts/out');
const ROOT_LICENSE = join(ROOT, 'LICENSE');
const LEDGER = join(ROOT, 'RELEASES.json');

const SCOPE = process.env['NPM_SCOPE'] ?? 'adminiumjs';
const DRY_RUN = process.argv.includes('--dry-run');
const UNKNOWN = process.argv.slice(2).filter((arg) => arg !== '--dry-run');
if (UNKNOWN.length > 0) {
  throw new Error(`unknown argument(s): ${UNKNOWN.join(' ')} — the only flag is --dry-run`);
}

/** The `files[]` allow-list every add-on declares (D1). */
const FILES_FIELD = ['dist', 'manifest.json', 'TRADEMARKS.md', 'README.md', 'LICENSE'];

/** Files every tarball must carry besides its own `dist/`. */
const REQUIRED = ['LICENSE', 'README.md', 'TRADEMARKS.md', 'manifest.json', 'package.json'];

const mappedName = (key) => `@${SCOPE}/add-on-${key}`;

/**
 * Discovered, never listed — the same rule `trademarks.test.ts` uses: a package
 * is an add-on when it carries a `manifest.json`. `host` and `host-kit` have
 * none and are excluded by construction rather than by a list someone has to
 * remember to update (24 D7 keeps both private permanently).
 */
function addOns() {
  return readdirSync(PACKAGES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ name: entry.name, dir: join(PACKAGES, entry.name) }))
    .filter((pkg) => existsSync(join(pkg.dir, 'manifest.json')))
    .map((pkg) => ({
      ...pkg,
      pkgPath: join(pkg.dir, 'package.json'),
      pkg: JSON.parse(readFileSync(join(pkg.dir, 'package.json'), 'utf8')),
      manifest: JSON.parse(readFileSync(join(pkg.dir, 'manifest.json'), 'utf8')),
    }))
    .sort((a, b) => (a.name < b.name ? -1 : 1));
}

/** The publish-time package.json: mapped name, no devDeps, no scripts. */
function publishManifest({ pkg, manifest }) {
  const out = structuredClone(pkg);
  out.name = mappedName(manifest.key);
  delete out.private;
  delete out.devDependencies;
  delete out.scripts;
  out.files = [...FILES_FIELD];
  return out;
}

/** Every path the manifest declares, relative to the package root. */
function declaredEntryPoints(manifest) {
  const addOn = manifest.addOn ?? {};
  const paths = [
    ...(addOn.slots ?? []).map((slot) => slot.client),
    ...(addOn.provides ?? []).map((provide) => provide.server),
    addOn.demoTransport,
  ].filter((path) => typeof path === 'string');
  return [...new Set(paths)];
}

/**
 * The X-ray. Refuses a tarball that grew, shrank, or lost a declared half.
 *
 * D1 asks that "the tarball cannot silently grow or lose a half"; both
 * directions are checked here because both have already happened once in this
 * repo's history in the abstract: WITHOUT `files[]`, `npm pack` ships all of
 * `src/` — every `.test.ts` included — and NO `dist/` at all, because the root
 * `.gitignore`'s `dist` entry applies to packing. The tarball was exactly
 * inverted, and nothing would have said so.
 */
function xray(label, entries, { manifest }) {
  const problems = [];
  const paths = entries.map((path) => path.replace(/^package\//, ''));

  for (const required of REQUIRED) {
    if (!paths.includes(required)) {
      problems.push(
        required === 'LICENSE'
          ? `no LICENSE — the manifest declares "${manifest.license}" and AGPL §4 wants the text in every copy`
          : `no ${required}`,
      );
    }
  }

  // npm SILENTLY DROPS a `files[]` entry that does not exist, so a missing
  // declared entry point is invisible without this check.
  for (const entry of declaredEntryPoints(manifest)) {
    if (!paths.includes(entry)) {
      problems.push(`manifest declares "${entry}" but the tarball has no such file`);
    }
  }

  if (!paths.some((path) => path.startsWith('dist/'))) {
    problems.push('no dist/ at all — the built product is missing (see this function\'s note)');
  }
  for (const path of paths) {
    if (path.startsWith('src/')) problems.push(`ships source: ${path}`);
    if (/\.tests?\./.test(path)) problems.push(`ships a test: ${path}`);
    if (path.endsWith('.map')) problems.push(`ships a sourcemap: ${path}`);
    if (/^tsconfig|^vite\.config/.test(path)) problems.push(`ships build config: ${path}`);
  }

  if (problems.length > 0) {
    throw new Error(`${label}:\n  - ${problems.join('\n  - ')}`);
  }
}

/** Stage the publish-time package.json + LICENSE; returns the undo. */
function stage(addOn) {
  const original = readFileSync(addOn.pkgPath, 'utf8');
  const licensePath = join(addOn.dir, 'LICENSE');
  const hadLicense = existsSync(licensePath);

  writeFileSync(addOn.pkgPath, `${JSON.stringify(publishManifest(addOn), null, 2)}\n`);
  if (!hadLicense) copyFileSync(ROOT_LICENSE, licensePath);

  return () => {
    writeFileSync(addOn.pkgPath, original);
    if (!hadLicense) rmSync(licensePath, { force: true });
  };
}

function packOne(addOn) {
  const undo = stage(addOn);
  try {
    const raw = execFileSync(
      'npm',
      ['pack', '--json', '--pack-destination', OUT_DIR, '--ignore-scripts'],
      { cwd: addOn.dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
    );
    const [result] = JSON.parse(raw);
    const tarball = join(OUT_DIR, result.filename);
    xray(`${mappedName(addOn.manifest.key)}@${addOn.pkg.version}`, result.files.map((f) => f.path), addOn);
    // `npm pack --json` reports the sha512 SRI of the bytes it just wrote.
    // Asserted equal to a hash of the file on disk rather than trusted: the
    // ledger must name the bytes that are uploaded, and the upload reads the file.
    const onDisk = sriOf(readFileSync(tarball));
    if (onDisk !== result.integrity) {
      throw new Error(`${result.filename}: npm pack reported ${result.integrity}, the file hashes to ${onDisk}`);
    }
    return {
      name: mappedName(addOn.manifest.key),
      key: addOn.manifest.key,
      version: addOn.pkg.version,
      objectKey: objectKeyFor({ kind: 'add-on', key: addOn.manifest.key, version: addOn.pkg.version }),
      integrity: result.integrity,
      shasum: result.shasum,
      filename: result.filename,
      tarball,
      unpackedSize: result.unpackedSize,
      fileCount: result.entryCount ?? result.files.length,
    };
  } finally {
    undo();
  }
}

/** Into the bucket and served back with the same sha512 — or a thrown error. */
async function uploadOne(packed, config) {
  const released = await publishObject({
    config,
    kind: 'add-on',
    key: packed.key,
    version: packed.version,
    bytes: readFileSync(packed.tarball),
    log: (line) => console.log(`    ${line}`),
  });
  if (released.integrity !== packed.integrity) {
    throw new Error(`${packed.objectKey}: uploaded ${released.integrity}, packed ${packed.integrity}`);
  }
  return released;
}

async function main() {
  if (!existsSync(ROOT_LICENSE)) {
    throw new Error(`no LICENSE at ${ROOT_LICENSE}; every tarball needs one staged from it`);
  }
  // Before packing: a missing credential should cost nothing.
  const config = DRY_RUN ? undefined : r2ConfigFromEnv(process.env);
  if (config?.test) console.log(`TEST ENDPOINTS — bucket ${config.endpoint}, read-back ${config.publicBase}`);
  const found = addOns();
  if (found.length < 6) {
    // An empty or short discovery is the worst outcome: a release that silently
    // ships nothing looks exactly like a release that succeeded.
    throw new Error(`only ${found.length} add-on(s) discovered under packages/; expected at least 6`);
  }

  // Version parity, before anything is packed. `changeset version` bumps
  // package.json and leaves manifest.json behind; the two must agree because
  // the manifest's version is what a deployment installs by.
  const skewed = found.filter((a) => a.pkg.version !== a.manifest.version);
  if (skewed.length > 0) {
    throw new Error(
      'package.json and manifest.json versions disagree — run `node scripts/sync-manifest-versions.mjs`:\n' +
        skewed.map((a) => `  ${a.name}: package ${a.pkg.version}, manifest ${a.manifest.version}`).join('\n'),
    );
  }

  // A minimum no published Adminium meets would sit in every released file
  // forever (48 A17), so it is refused before anything is packed.
  const newest = await newestAdminium();
  for (const addOn of found) {
    const minimum = assertMinimumReleased(addOn.manifest, newest);
    console.log(`  ${addOn.manifest.key}@${addOn.manifest.version} needs Adminium ${minimum}`);
  }
  console.log(`Every minimum is met by a published Adminium (newest: ${newest}).`);

  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Packing ${found.length} add-on(s)…`);
  const packed = found.map((addOn) => {
    const result = packOne(addOn);
    console.log(
      `  ok  ${result.name}@${result.version}  ${result.fileCount} files, ` +
        `${(result.unpackedSize / 1024).toFixed(0)} KB unpacked`,
    );
    return result;
  });

  if (DRY_RUN) {
    console.log(`\nDry run: ${packed.length} tarball(s) in ${relative(ROOT, OUT_DIR)}, nothing uploaded.`);
    for (const p of packed) console.log(`  ${p.objectKey}  ${p.integrity}`);
    return;
  }

  console.log(`\nUploading ${packed.length} add-on(s)…`);
  for (const result of packed) {
    console.log(`  ${result.name}@${result.version}`);
    await uploadOne(result, config);
  }

  // The ledger last, and only over what the public address serves (48 D6).
  // Written atomically so an interrupted release cannot leave a half-file that
  // the website would read as the catalog's source of truth.
  const ledger = {
    schemaVersion: 1,
    releases: packed
      .map(({ name, key, version, integrity, shasum, fileCount }) => ({
        name,
        key,
        version,
        integrity,
        shasum,
        fileCount,
      }))
      .sort((a, b) => (a.name < b.name ? -1 : 1)),
  };
  const partial = `${LEDGER}.partial`;
  writeFileSync(partial, `${JSON.stringify(ledger, null, 2)}\n`);
  renameSync(partial, LEDGER);
  console.log(`\nWrote ${relative(ROOT, LEDGER)} with ${ledger.releases.length} release(s).`);
}

await main();
