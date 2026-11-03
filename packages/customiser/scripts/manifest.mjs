/**
 * The manifest, written from `src/manifest/`.
 *
 *   node scripts/manifest.mjs           writes manifest.json
 *   node scripts/manifest.mjs --check   writes nothing; fails when the file is behind
 *
 * The tables, entries, roles and their words in eight languages are long and
 * repeat themselves, so they are written as code and the JSON is its output.
 * `src/manifest.test.ts` runs the same comparison.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildManifest } from '../src/manifest/build.ts';

export const TARGET = resolve(dirname(fileURLToPath(import.meta.url)), '../manifest.json');
/** The file as written: two-space JSON and a last newline, so a diff reads. */
export const written = () => `${JSON.stringify(buildManifest(), null, 2)}\n`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const text = written();
  if (process.argv.includes('--check')) {
    let now = '';
    try {
      now = readFileSync(TARGET, 'utf8');
    } catch {
      /* not written yet */
    }
    if (now !== text) {
      console.error('manifest.json is behind src/manifest: run `node scripts/manifest.mjs`.');
      process.exit(1);
    }
  } else {
    writeFileSync(TARGET, text);
  }
}
