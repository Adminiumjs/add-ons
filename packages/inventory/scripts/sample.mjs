/**
 * The sample data file, written from the facts in `src/sample/data.ts`.
 *
 *   node scripts/sample.mjs           writes seeds/inventory.sample.json
 *   node scripts/sample.mjs --check   writes nothing; fails when the file is behind
 *
 * `src/sample.test.ts` runs the same comparison, and works every figure the
 * screens show out of the file again.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSample } from '../src/sample/bundle.ts';

export const TARGET = resolve(dirname(fileURLToPath(import.meta.url)), '../seeds/inventory.sample.json');
/** One row a line: a file a person can read and a diff can show. */
export function written(bundle) {
  const tables = bundle.tables.map((table) => {
    const { rows, ...rest } = table;
    return `    { ${Object.entries(rest).map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(', ')}, "rows": [\n${rows.map((row) => `      ${JSON.stringify(row)}`).join(',\n')}\n    ] }`;
  });
  return `{\n  "format": ${JSON.stringify(bundle.format)},\n  "app": ${JSON.stringify(bundle.app)},\n  "tables": [\n${tables.join(',\n')}\n  ]\n}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const text = written(buildSample());
  if (process.argv.includes('--check')) {
    let now = '';
    try {
      now = readFileSync(TARGET, 'utf8');
    } catch {
      /* not written yet */
    }
    if (now !== text) {
      console.error('seeds/inventory.sample.json is behind src/sample: run `node scripts/sample.mjs`.');
      process.exit(1);
    }
  } else {
    writeFileSync(TARGET, text);
    const bundle = JSON.parse(text);
    console.log(bundle.tables.map((table) => `${table.ref} ${table.rows.length}`).join(' · '));
    console.log(`${bundle.tables.reduce((sum, table) => sum + table.rows.length, 0)} rows`);
  }
}
