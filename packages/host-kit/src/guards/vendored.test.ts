/**
 * The vendored-tree checks, driven — with the BSD `sed` failure planted.
 *
 * That failure is the reason this guard is stated over the TREE rather than
 * over the rewrite: the sync's own `status` applies the same rewrite to both
 * sides before comparing, so two files neither of which was rewritten agree
 * perfectly. The tree does not agree with itself, and that is what is checked.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { bareSpecifiersIn, syncHeaderProblems, NEVER_HAND_EDIT } from './vendored.ts';
import { codeOf, read, vendoredFiles } from './files.ts';
import { syntheticHost, type SyntheticHost } from './synthetic-host.ts';

let host: SyntheticHost | null = null;
afterEach(() => {
  host?.dispose();
  host = null;
});

const SCRIPT = 'scripts/sync-add-ons.sh';

const goodHeader = [
  '/*',
  ` * VENDORED from add-ons/packages/shipping-example/src/index.ts — synced by ${SCRIPT}.`,
  ` * ${NEVER_HAND_EDIT}: edit the monorepo and re-run the sync.`,
  ' */',
].join('\n');

describe('the sync header', () => {
  it('accepts the one the script writes', () => {
    expect(syncHeaderProblems(goodHeader, SCRIPT)).toEqual([]);
  });

  it('names each missing part separately, so a reader knows which', () => {
    expect(syncHeaderProblems('// a hand-written file', SCRIPT)).toEqual([
      'does not open with a block comment',
      `names no source package, or does not point at ${SCRIPT}`,
      `does not say “${NEVER_HAND_EDIT}”`,
    ]);
  });

  it('refuses a header that says where the copy came from and not how to redo it', () => {
    // A copy that does not say how to regenerate itself is a copy somebody
    // edits, and a hand-edit is the one thing this guard cannot see afterwards.
    expect(syncHeaderProblems(goodHeader.replace(NEVER_HAND_EDIT, 'Feel free'), SCRIPT)).toEqual([
      `does not say “${NEVER_HAND_EDIT}”`,
    ]);
  });

  it('refuses a header pointing at a script this host does not have', () => {
    expect(syncHeaderProblems(goodHeader, 'tools/other.sh')).toEqual([
      'names no source package, or does not point at tools/other.sh',
    ]);
  });
});

describe('the self-containment check', () => {
  it('reports a specifier the rewrite did not fire on', () => {
    // THE BSD `sed` FAILURE, in the exact shape it produces.
    expect(bareSpecifiersIn("import type { AddOn } from '@adminium/add-on-host';")).toEqual([
      '@adminium/add-on-host',
    ]);
    expect(bareSpecifiersIn("export { x } from '@adminium/add-on-host/slots.ts';")).toEqual([
      '@adminium/add-on-host/slots.ts',
    ]);
  });

  it('reads a dynamic import as well as a static one', () => {
    // A dynamic import that survived the rewrite fails at RUN time rather than
    // at build time, which is the worse of the two.
    expect(bareSpecifiersIn("const m = await import('@adminium/add-on-host');")).toEqual([
      '@adminium/add-on-host',
    ]);
  });

  it('says nothing about a relative path, which is what a fired rewrite leaves', () => {
    expect(bareSpecifiersIn("import type { AddOn } from '../host/host.ts';")).toEqual([]);
    expect(bareSpecifiersIn("import { x } from './rates.ts';")).toEqual([]);
  });

  it('still reports the host’s own dependencies, which the caller then forgives', () => {
    // The scanner is not the policy: it reports every bare specifier and the
    // guard filters against the host's declared runtime dependencies, so a
    // fifth one is a decision in a diff rather than a thing that slips in.
    expect(bareSpecifiersIn("import { useMemo } from 'react';")).toEqual(['react']);
  });
});

describe('over a whole vendored tree', () => {
  it('passes a clean one', () => {
    host = syntheticHost();
    const files = vendoredFiles(host.config);
    expect(files.length).toBeGreaterThan(0);
    const headerless = files.filter(
      (file) => syncHeaderProblems(read(file).split('\n').slice(0, 5).join('\n'), SCRIPT).length > 0,
    );
    expect(headerless).toEqual([]);
    const declares = files.filter((file) => /\binterface AddOn\b/.test(read(file)));
    expect(declares).toHaveLength(1);
  });

  it('reports a file the sync never touched', () => {
    host = syntheticHost({
      files: {
        'src/add-ons/vendor/shipping-example/hand-written.ts': 'export const oops = 1;\n',
      },
    });
    const headerless = vendoredFiles(host.config).filter(
      (file) => syncHeaderProblems(read(file).split('\n').slice(0, 5).join('\n'), SCRIPT).length > 0,
    );
    expect(headerless).toHaveLength(1);
  });

  it('reports a second copy of the shared contract', () => {
    /*
     * THE REASON THE THREE ADD-ON REPOS BECAME ONE. Each carried its own
     * `AddOn`; they disagreed within a day — 19 members in one, 18 in another,
     * 18 in the third — and one host held all three. Nothing failed and nothing
     * could have, because no suite anywhere had two copies in front of it.
     */
    host = syntheticHost({
      files: {
        'src/add-ons/vendor/shipping-example/host.ts':
          '/*\n * VENDORED from add-ons/packages/shipping-example/src/host.ts — synced by ' +
          `${SCRIPT}.\n * ${NEVER_HAND_EDIT}: edit the monorepo and re-run the sync.\n */\n` +
          'export interface AddOn { key: string; extra?: string }\n',
      },
    });
    const declares = vendoredFiles(host.config).filter((file) =>
      /\binterface AddOn\b/.test(read(file)),
    );
    expect(declares).toHaveLength(2);
  });

  it('reports an unrewritten import in a real file, comments stripped', () => {
    host = syntheticHost({
      files: {
        'src/add-ons/vendor/shipping-example/broken.ts':
          '/*\n * VENDORED from add-ons/packages/shipping-example/src/broken.ts — synced by ' +
          `${SCRIPT}.\n * ${NEVER_HAND_EDIT}: edit the monorepo and re-run the sync.\n */\n` +
          "import type { AddOn } from '@adminium/add-on-host';\n" +
          'export type X = AddOn;\n',
      },
    });
    const allowed = new Set(['react', 'react-dom', 'react/jsx-runtime', 'lucide-react']);
    const offenders = vendoredFiles(host.config)
      .filter((file) => /\.tsx?$/.test(file))
      .flatMap((file) => bareSpecifiersIn(codeOf(file)).filter((spec) => !allowed.has(spec)));
    expect(offenders).toEqual(['@adminium/add-on-host']);
  });

  it('finds nothing at all when pointed at a directory that is not there', () => {
    // The guard on the guard, from the other side: `walk` answers a missing
    // directory with nothing, so a mistyped `vendorDir` makes every case above
    // pass. The guard's own first case is what tells the two apart.
    host = syntheticHost();
    expect(vendoredFiles({ ...host.config, vendorDir: '/nowhere/at/all' })).toEqual([]);
  });
});
