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
import { gzipSync } from 'node:zlib';
import { beforeAll, describe, expect, it } from 'vitest';

import pkg from '../package.json' with { type: 'json' };
import { BUILT_FILES, FONT_FILES, FONTS_FROM, OUTPUT } from '../vite.config.ts';
import { STARTER_FONTS } from './manifest/fonts.ts';
import { starterFontPath, starterLicencePath } from './pages/setup/starter.ts';
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
    expect(built().map(asRelative).sort()).toEqual([...BUILT_FILES, ...FONT_FILES].map((path) => path.replace(/^dist\//, '')).sort());
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
    // The starter fonts are not the add-on's words: a font is packed binary, and a licence is the SIL's text, shipped as it is (checked below).
    const fonts = new Set(FONT_FILES.map((path) => join(DIST, '..', path)));
    for (const one of built().filter((file) => !fonts.has(file))) {
      const hits = bannedHitsIn(readFileSync(one, 'utf8'));
      expect(hits, `${asRelative(one)}: ${hits.slice(0, 5).map((hit) => `${hit.word} at ${String(hit.at)}`).join(', ')}`).toEqual([]);
    }
  });
});

describe('the starter fonts', () => {
  const page = OUTPUT.pages['customiser']!;
  const folder = page.slice(0, page.lastIndexOf('/') + 1);

  it('ship every starter family’s font and its licence beside the set-up page, and nothing else', () => {
    const expected = STARTER_FONTS.flatMap((font) => [starterFontPath(font.family), starterLicencePath(font.family)]).map((path) => `${folder}${path}`);
    expect([...FONT_FILES].sort()).toEqual(expected.sort());
    expect(readdirSync(join(DIST, '..', FONTS_FROM)).sort()).toEqual(expected.map((path) => path.slice(path.lastIndexOf('/') + 1)).sort());
  });

  it('are the bytes in the repository, each a WOFF2 font under the upload’s 2 MB', () => {
    for (const path of FONT_FILES) {
      const shipped = readFileSync(join(DIST, '..', path));
      expect(shipped.equals(readFileSync(join(DIST, '..', FONTS_FROM, path.slice(path.lastIndexOf('/') + 1)))), path).toBe(true);
      if (!path.endsWith('.woff2')) continue;
      expect(shipped.subarray(0, 4).toString('latin1'), path).toBe('wOF2');
      expect(shipped.length, path).toBeLessThanOrEqual(2 * 1024 * 1024);
    }
  });

  it('each carry the SIL Open Font License 1.1 with the family’s own copyright', () => {
    for (const path of FONT_FILES.filter((one) => one.endsWith('.txt'))) {
      const licence = readFileSync(join(DIST, '..', path), 'utf8');
      expect(licence, path).toMatch(/^Copyright /);
      expect(licence, path).toContain('This Font Software is licensed under the SIL Open Font License, Version 1.1.');
      expect(licence, path).toContain('SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007');
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

  it('is the only file with three.js in it: the 2D editor carries none of it', () => {
    const editor = read(OUTPUT.browser);
    for (const name of ['WebGLRenderer', 'BufferGeometry', 'Matrix4', 'PerspectiveCamera']) expect(editor, name).not.toContain(name);
  });

  it('carries three.js inside it and needs nothing from the editor', () => {
    const stage = read(OUTPUT.browser3d);
    expect(stage).toContain('THREE.WebGLRenderer');
    expect(stage).not.toMatch(/^import /m);
    expect(stage).not.toMatch(/\bimport\(/);
  });
});


/**
 * WHAT EACH FILE WEIGHS, WRITTEN DOWN.
 *
 * Measured on the minified build (whitespace and syntax; names kept), in
 * kibibytes as written and as gzip sends them, each with a little room
 * above. A file that grows past its line is a change someone made: look at
 * what it pulled in, then move the line here on purpose, with the new size.
 * Before minifying (the build as the 3D pieces left it): the editor 434 /
 * 114, the stage 1,164 / 254, the set-up page 2,056 / 491, the line panel
 * 2,594 / 660, the product panel 1,419 / 330.
 */
const SIZES: Readonly<Record<string, { kib: number; gzip: number }>> = {
  [OUTPUT.browser]: { kib: 440, gzip: 115 },
  [OUTPUT.browser3d]: { kib: 720, gzip: 190 },
  [OUTPUT.browserCss]: { kib: 46, gzip: 9 },
  [OUTPUT.check]: { kib: 18, gzip: 7 },
  [OUTPUT.pages['customiser']!]: { kib: 1680, gzip: 430 },
  [OUTPUT.panels['customiser-line']!]: { kib: 2090, gzip: 590 },
  [OUTPUT.panels['customiser-product']!]: { kib: 1075, gzip: 275 },
};

describe('the sizes', () => {
  it('name every file the build writes', () => {
    expect(Object.keys(SIZES).sort()).toEqual([...BUILT_FILES].sort());
  });

  it('keep each file under its line, as written and as sent', () => {
    for (const [path, most] of Object.entries(SIZES)) {
      const bytes = readFileSync(join(DIST, '..', path));
      expect(bytes.length / 1024, `${path} as written`).toBeLessThanOrEqual(most.kib);
      expect(gzipSync(bytes).length / 1024, `${path} gzipped`).toBeLessThanOrEqual(most.gzip);
    }
  });

  it('are minified: no file of code keeps the indentation a library build writes', () => {
    for (const path of BUILT_FILES.filter((one) => one.endsWith('.js') && one !== OUTPUT.check)) {
      const text = readFileSync(join(DIST, '..', path), 'utf8');
      const indented = text.split('\n').filter((line) => /^ {2,}\S/.test(line)).length;
      expect(indented, path).toBeLessThan(50);
    }
  });
});
