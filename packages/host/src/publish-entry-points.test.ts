/**
 * WHAT A TARBALL MUST HOLD, READ FROM THE MANIFEST.
 *
 * npm silently drops a `files[]` entry that is not there, so a package can be
 * packed without the very file its manifest names — and install as a section
 * with a page that never loads, or a ledger whose rule never answers. The
 * publish script refuses such a tarball; this suite hands the same check a
 * list of paths, for the real Inventory manifest, so the rule is proved
 * without packing anything.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// @ts-expect-error a plain script of the repo, read as it runs
import { declaredEntryPoints, filesFor, xray } from '../../../scripts/tarball-shape.mjs';

const PACKAGES = join(new URL('../..', import.meta.url).pathname);
const manifestOf = (name: string) => JSON.parse(readFileSync(join(PACKAGES, name, 'manifest.json'), 'utf8')) as Record<string, unknown>;
const inventory = manifestOf('inventory');
const invoices = manifestOf('invoices');

const points = (manifest: unknown): string[] => declaredEntryPoints(manifest) as string[];
const checked = (paths: string[], manifest: unknown): string | null => {
  try {
    (xray as (label: string, entries: string[], addOn: { manifest: unknown }) => void)('test', paths.map((path) => `package/${path}`), { manifest });
    return null;
  } catch (error) {
    return (error as Error).message;
  }
};
const ALWAYS = ['LICENSE', 'README.md', 'TRADEMARKS.md', 'manifest.json', 'package.json'];
const whole = (manifest: unknown): string[] => [...ALWAYS, ...points(manifest), 'dist/shared-chunk.js'];

describe('the files a manifest names', () => {
  it('a posting-rows server file is a declared entry point', () => {
    expect(points(inventory)).toContain('dist/server.js');
  });

  it('so is every page bundle, and the sample data file', () => {
    expect(points(inventory).filter((path) => path.startsWith('dist/pages/')).sort()).toEqual(['dist/pages/counts.js', 'dist/pages/opening.js', 'dist/pages/receive.js', 'dist/pages/rules.js', 'dist/pages/transfer.js']);
    expect(points(inventory)).toContain('seeds/inventory.sample.json');
    // An add-on with none of those names none.
    expect(points(invoices).some((path) => path.startsWith('seeds/'))).toBe(false);
  });

  it('only an add-on that names sample data ships a seeds folder', () => {
    expect(filesFor(inventory)).toEqual(['dist', 'seeds', 'manifest.json', 'TRADEMARKS.md', 'README.md', 'LICENSE']);
    expect(filesFor(invoices)).toEqual(['dist', 'manifest.json', 'TRADEMARKS.md', 'README.md', 'LICENSE']);
  });
});

describe('the tarball check', () => {
  it('passes a tarball that holds everything the manifest names', () => {
    expect(checked(whole(inventory), inventory)).toBeNull();
    expect(checked(whole(invoices), invoices)).toBeNull();
  });

  it('a tarball missing a declared page bundle is refused', () => {
    const refusal = checked(whole(inventory).filter((path) => path !== 'dist/pages/counts.js'), inventory);
    expect(refusal).toContain('manifest declares "dist/pages/counts.js" but the tarball has no such file');
  });

  it('a tarball missing the file that decides, or the sample its manifest names, is refused', () => {
    expect(checked(whole(inventory).filter((path) => path !== 'dist/server.js'), inventory)).toContain('"dist/server.js"');
    expect(checked(whole(inventory).filter((path) => path !== 'seeds/inventory.sample.json'), inventory)).toContain('"seeds/inventory.sample.json"');
  });

  it('a seeds file the manifest does not name is refused, and so is source, a test or a map', () => {
    expect(checked([...whole(inventory), 'seeds/notes.json'], inventory)).toContain('ships a seeds file the manifest does not name: seeds/notes.json');
    expect(checked([...whole(invoices), 'seeds/anything.json'], invoices)).toContain('seeds/anything.json');
    expect(checked([...whole(inventory), 'src/index.ts'], inventory)).toContain('ships source: src/index.ts');
    expect(checked([...whole(inventory), 'dist/server.js.map'], inventory)).toContain('ships a sourcemap');
  });
});
