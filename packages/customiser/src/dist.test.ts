/**
 * THE BUILT BYTES, READ BACK.
 *
 * What ships is `dist/`, so this suite builds it for real and reads what
 * landed: the files the build promises are there and nothing else is, no
 * sourcemap rides along, the customer's editor leaves React to the app that
 * imports it, and nothing banned is in any of it.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import pkg from '../package.json' with { type: 'json' };
import { BUILT_FILES, OUTPUT } from '../vite.config.ts';
import { buildForReal, DIST } from './testing/build.ts';
import { bannedHitsIn } from './testing/lexicon.ts';

function built(dir = DIST): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? built(path) : [path];
  });
}
const asRelative = (file: string) => relative(DIST, file);

beforeAll(() => {
  buildForReal();
}, 180_000);

describe('the build writes what it promises', () => {
  it('puts every file where it says, and nothing else', () => {
    for (const path of BUILT_FILES) expect(existsSync(join(DIST, '..', path)), path).toBe(true);
    expect(built().map(asRelative).sort()).toEqual(BUILT_FILES.map((path) => path.replace(/^dist\//, '')).sort());
  });

  it('is the file the package hands the apps as its browser entry', () => {
    expect(pkg.exports['./browser']).toBe(`./${OUTPUT.browser}`);
  });

  it('emits no sourcemap, and no reference to one', () => {
    for (const file of built()) {
      expect(file.endsWith('.map')).toBe(false);
      expect(readFileSync(file, 'utf8')).not.toContain('sourceMappingURL');
    }
  });

  it('passes the word gate', () => {
    for (const one of built()) {
      const hits = bannedHitsIn(readFileSync(one, 'utf8'));
      expect(hits, `${asRelative(one)}: ${hits.slice(0, 5).map((hit) => `${hit.word} at ${String(hit.at)}`).join(', ')}`).toEqual([]);
    }
  });
});

describe('the customer’s editor', () => {
  const file = (): string => readFileSync(join(DIST, '..', OUTPUT.browser), 'utf8');

  it('brings no copy of React: the app that imports it does', () => {
    expect(file()).not.toMatch(/react\.production|__SECRET_INTERNALS|__CLIENT_INTERNALS/);
  });

  it('carries the version of the design data it saves', () => {
    expect(file()).toMatch(/DESIGN_FORMAT/);
  });

  it('keeps nothing in the browser’s storage', () => {
    expect(file()).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
  });
});

describe('the 3D stage', () => {
  const read = (path: string): string => readFileSync(join(DIST, '..', path), 'utf8');

  it('is a file of its own beside the editor, which the editor only fetches when a piece is shown in 3D', () => {
    const editor = read(OUTPUT.browser);
    expect(editor).not.toContain('THREE.WebGLRenderer');
    // Its only way to the stage is the one dynamic import; React is the only thing it imports by name.
    expect([...editor.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)].map((one) => one[1])).toEqual(['./stage3d.js']);
    expect([...editor.matchAll(/^import .* from "([^"]+)";$/gm)].map((one) => one[1]).filter((name) => !/^react(\/|$)/.test(name))).toEqual([]);
  });

  it('carries three.js inside it and needs nothing from the editor', () => {
    const stage = read(OUTPUT.browser3d);
    expect(stage).toContain('THREE.WebGLRenderer');
    expect(stage).not.toMatch(/^import /m);
    expect(stage).not.toMatch(/\bimport\(/);
  });
});

