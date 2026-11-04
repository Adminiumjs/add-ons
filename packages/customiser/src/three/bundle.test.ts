/**
 * THE 2D EDITOR NEVER IMPORTS three.js.
 *
 * Walks the static imports from the customer's editor's entry: none of them
 * reaches `three` (or a file that imports it). The 3D stage is reached only
 * by the one `import()` in `load.ts`, so a print shop's customers never
 * download it.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = new URL('..', import.meta.url).pathname;

/** The modules a file imports or re-exports statically (type-only ones are erased and left out). */
function staticImports(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  return [...text.matchAll(/^(?:import|export)\s+(?!type\b)[^'";]*?from\s+'([^']+)'|^import\s+'([^']+)'/gm)].map((one) => one[1] ?? one[2]!);
}

function reach(entry: string): { files: Set<string>; packages: Set<string> } {
  const files = new Set<string>();
  const packages = new Set<string>();
  const walk = (file: string): void => {
    if (files.has(file)) return;
    files.add(file);
    for (const name of staticImports(file)) {
      if (name.startsWith('.')) walk(resolve(dirname(file), name));
      else packages.add(name);
    }
  };
  walk(entry);
  return { files, packages };
}

describe('the customer’s editor, without its 3D stage', () => {
  it('reaches no part of three.js by a static import', () => {
    const { files, packages } = reach(join(SRC, 'browser/index.ts'));
    expect(files.size).toBeGreaterThan(20);
    expect([...packages].filter((name) => name === 'three' || name.startsWith('three/'))).toEqual([]);
    expect([...files].filter((file) => /three\/(stage3d|piece)\.ts$/.test(file))).toEqual([]);
  });

  it('fetches the stage by one dynamic import', () => {
    // `typeof import(…)` is a type, erased from the build.
    expect(readFileSync(join(SRC, 'three/load.ts'), 'utf8').match(/(?<!typeof )import\('[^']+'\)/g)).toEqual(["import('./stage3d.ts')"]);
  });
});
