#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Copy each package's `package.json` version into its `manifest.json`
 * (32-add-on-distribution.md §2 step 3).
 *
 * TWO FILES CARRY THE SAME VERSION, AND ONLY ONE TOOL BUMPS IT. `changeset
 * version` knows about `package.json` and nothing else, so after every bump the
 * manifest is one release behind — and the manifest's version is the one a
 * DEPLOYMENT sees: it is what the catalog feed lists, what the package store
 * puts in the path, and what the install seam addresses. A skew there is not
 * cosmetic; it means the thing you installed is not the thing the feed named.
 *
 * So this runs as part of `npm run version`, wired into the same command that
 * does the bump, rather than as a step someone remembers. The release workflow
 * asserts parity again before it packs anything, because "remembered to run the
 * script" is not a property you want to find out about after an immutable
 * publish.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES = join(ROOT, 'packages');

let changed = 0;
let seen = 0;

for (const entry of readdirSync(PACKAGES, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const dir = join(PACKAGES, entry.name);
  const manifestPath = join(dir, 'manifest.json');
  // Same discovery rule as the publish script and `trademarks.test.ts`: a
  // package is an add-on when it carries a manifest. `host` and `host-kit`
  // have none and are skipped by construction.
  if (!existsSync(manifestPath)) continue;
  seen += 1;

  const version = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version;
  const raw = readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);
  if (manifest.version === version) continue;

  // Rewritten with a targeted replace rather than JSON.stringify: the
  // manifests are hand-maintained documents and reformatting the whole file on
  // a version bump would bury the one real change in a whole-file diff.
  const updated = raw.replace(
    /("version"\s*:\s*)"[^"]*"/,
    (_match, prefix) => `${prefix}${JSON.stringify(version)}`,
  );
  if (JSON.parse(updated).version !== version) {
    throw new Error(`${entry.name}: could not rewrite the version field in manifest.json`);
  }
  writeFileSync(manifestPath, updated);
  console.log(`  ${entry.name}: manifest.json ${manifest.version} -> ${version}`);
  changed += 1;
}

if (seen === 0) {
  throw new Error('no add-on manifests found under packages/ — refusing to report success');
}
console.log(`sync-manifest-versions: ${changed} of ${seen} manifest(s) updated.`);
