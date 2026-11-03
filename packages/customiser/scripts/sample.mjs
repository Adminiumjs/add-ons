/**
 * The sample files, written from `src/sample/bundle.ts`: one per shop app.
 *
 *   node scripts/sample.mjs           writes seeds/maker.sample.json and seeds/printing.sample.json
 *   node scripts/sample.mjs --check   writes nothing; fails when a file is behind
 *
 * `src/sample.test.ts` runs the same comparison, and checks every row against
 * the manifest's tables.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSample, SAMPLE_APPS } from '../src/sample/bundle.ts';

const SEEDS = resolve(dirname(fileURLToPath(import.meta.url)), '../seeds');
/** Where one app's file is written. */
export const targetOf = (app) => resolve(SEEDS, `${app}.sample.json`);
export { SAMPLE_APPS };

/** One row a line: a file a person can read and a diff can show. */
export function written(bundle) {
  const tables = bundle.tables.map((table) => {
    const { rows, ...rest } = table;
    return `    { ${Object.entries(rest).map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(', ')}, "rows": [\n${rows.map((row) => `      ${JSON.stringify(row)}`).join(',\n')}\n    ] }`;
  });
  return `{\n  "format": ${JSON.stringify(bundle.format)},\n  "app": ${JSON.stringify(bundle.app)},\n  "addOn": ${JSON.stringify(bundle.addOn)},\n  "tables": [\n${tables.join(',\n')}\n  ]\n}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let behind = false;
  for (const app of SAMPLE_APPS) {
    const text = written(buildSample(app));
    if (process.argv.includes('--check')) {
      let now = '';
      try {
        now = readFileSync(targetOf(app), 'utf8');
      } catch {
        /* not written yet */
      }
      if (now !== text) {
        console.error(`seeds/${app}.sample.json is behind src/sample: run \`node scripts/sample.mjs\`.`);
        behind = true;
      }
    } else {
      writeFileSync(targetOf(app), text);
      const bundle = JSON.parse(text);
      console.log(`${app}: ${bundle.tables.map((table) => `${table.ref} ${table.rows.length}`).join(' · ')}`);
    }
  }
  if (behind) process.exit(1);
}
