// SPDX-License-Identifier: AGPL-3.0-only
/**
 * EVERY ADD-ON, PACKED AS THE RELEASE PACKS IT.
 *
 * Release 1.0.16 shipped Holiday Calendars without `seeds/holidays.json`, the
 * starting rows its manifest names, and installing it stopped at the seeds
 * stage. Its own pack suite passed: it packed with the package's `files[]`,
 * while the release staged a different list it worked out from the manifest.
 *
 * So this packs each add-on with the very `package.json` the publish script
 * stages (`publishManifest` in `scripts/tarball-shape.mjs`), in a copy of the
 * package so the work tree is never touched, and holds the tarball to the
 * manifest: every file it names is in, byte for byte the size on disk, and
 * nothing rides along beside `dist/` and the papers.
 *
 * The copy's `dist/` is a stand-in: one file per path the manifest names in
 * it, and one chunk it does not name. Tests run before any build, so the real
 * one may be missing; what it holds is the package's own pack suite's and the
 * release X-ray's to check. What this proves is the rule that picks the
 * files, over every real manifest and every real file it names.
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// @ts-expect-error a plain script of the repo, read as the release runs it
import { declaredEntryPoints, publishManifest, REQUIRED, xray } from '../../../scripts/tarball-shape.mjs';

const PACKAGES = join(new URL('../..', import.meta.url).pathname);
const REPO = join(PACKAGES, '..');

interface AddOn {
  name: string;
  dir: string;
  pkg: Record<string, unknown>;
  manifest: Record<string, unknown>;
  read: (path: string) => unknown;
}

const readerFor = (dir: string) => (path: string): unknown => {
  try {
    return JSON.parse(readFileSync(join(dir, path), 'utf8'));
  } catch {
    return undefined;
  }
};

/** Discovered like the publish script does: a package with a `manifest.json` is an add-on. */
const found: AddOn[] = readdirSync(PACKAGES, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(PACKAGES, entry.name, 'manifest.json')))
  .map((entry) => {
    const dir = join(PACKAGES, entry.name);
    return {
      name: entry.name,
      dir,
      pkg: JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Record<string, unknown>,
      manifest: JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as Record<string, unknown>,
      read: readerFor(dir),
    };
  })
  .sort((a, b) => (a.name < b.name ? -1 : 1));

const named = (addOn: AddOn): string[] => declaredEntryPoints(addOn.manifest, { read: addOn.read }) as string[];

const npm = (): string => {
  const beside = join(dirname(process.execPath), 'npm');
  return existsSync(beside) ? beside : 'npm';
};

const scratch = mkdtempSync(join(tmpdir(), 'add-on-tarballs-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** A copy of the package staged as the release stages it, packed with `--dry-run`: the tarball's members and sizes. */
function packAsReleased(addOn: AddOn): Map<string, number> {
  const copy = join(scratch, addOn.name);
  cpSync(addOn.dir, copy, {
    recursive: true,
    filter: (source) => {
      const first = relative(addOn.dir, source).split(sep)[0];
      return first !== 'node_modules' && first !== 'dist';
    },
  });
  for (const path of [...named(addOn).filter((one) => one.startsWith('dist/')), 'dist/chunks/shared.js']) {
    mkdirSync(dirname(join(copy, path)), { recursive: true });
    writeFileSync(join(copy, path), 'export {};\n');
  }
  writeFileSync(join(copy, 'package.json'), `${JSON.stringify(publishManifest(addOn, { read: addOn.read }), null, 2)}\n`);
  if (!existsSync(join(copy, 'LICENSE'))) copyFileSync(join(REPO, 'LICENSE'), join(copy, 'LICENSE'));
  const out = execFileSync(npm(), ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: copy, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const [report] = JSON.parse(out) as [{ files: { path: string; size: number }[] }];
  return new Map(report.files.map((file) => [file.path, file.size]));
}

describe('release tarballs: discovery', () => {
  it('packs all thirteen add-ons, and refuses to pass over none', () => {
    expect(found.map((addOn) => addOn.name)).toEqual([
      'barcode-labels',
      'customiser',
      'design-studio',
      'forms',
      'holiday-calendars',
      'import-canva',
      'inventory',
      'invoices',
      'offers',
      'payments-paypal',
      'payments-stripe',
      'personalizer',
      'shipping-dhl',
    ]);
  });

  it('reads the starting rows of Holiday Calendars as a file its manifest names', () => {
    // The file 1.0.16 and 1.0.17 left out, so the rule below cannot pass while missing it.
    expect(named(found.find((addOn) => addOn.name === 'holiday-calendars')!)).toContain('seeds/holidays.json');
  });
});

describe.each(found)('release tarballs: $name', (addOn) => {
  let members: Map<string, number>;
  beforeAll(() => {
    members = packAsReleased(addOn);
  }, 60_000);

  it('ships every file its manifest names', () => {
    for (const path of named(addOn)) expect([...members.keys()], `${addOn.name} names ${path}`).toContain(path);
  });

  it('ships each named file outside dist as it is on disk', () => {
    for (const path of named(addOn).filter((one) => !one.startsWith('dist/'))) {
      expect(members.get(path), path).toBe(statSync(join(addOn.dir, path)).size);
    }
  });

  it('ships beside dist only the papers and the files the manifest names', () => {
    const outside = [...members.keys()].filter((path) => !path.startsWith('dist/')).sort();
    expect(outside).toEqual([...new Set([...(REQUIRED as string[]), ...named(addOn).filter((path) => !path.startsWith('dist/'))])].sort());
    // The chunk no manifest names rides along with the rest of the build.
    expect(members.has('dist/chunks/shared.js')).toBe(true);
  });

  it('passes the X-ray the release runs over it', () => {
    const label = `${addOn.name} as released`;
    expect(() => (xray as (label: string, entries: string[], addOn: { manifest: unknown; read: unknown }) => void)(label, [...members.keys()].map((path) => `package/${path}`), { manifest: addOn.manifest, read: addOn.read })).not.toThrow();
  });
});
