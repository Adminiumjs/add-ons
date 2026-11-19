/**
 * The sample files, written from `src/sample/bundle.ts`.
 *
 *   node scripts/sample.mjs           writes the two files below
 *   node scripts/sample.mjs --check   writes nothing; fails when a file is behind
 *
 * - `seeds/lead-finder.crm.sample.json`: the CRM's rows for Lead finder (the
 *   CRM names it in `sampleData.addOns["lead-finder"].file`);
 * - `seeds/crm-rows.sample.json`: the CRM's own sample rows those belong to,
 *   by the labels they name, for the CRM's own sample file to carry.
 *
 * `src/sample.test.ts` runs the same comparison, and checks both.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSample, CRM_ROWS } from '../src/sample/bundle.ts';

const SEEDS = resolve(dirname(fileURLToPath(import.meta.url)), '../seeds');
export const TARGET = resolve(SEEDS, 'lead-finder.crm.sample.json');
export const CRM_TARGET = resolve(SEEDS, 'crm-rows.sample.json');

/** One row a line: a file a person can read and a diff can show. */
export function written(bundle) {
  const tables = bundle.tables.map((table) => {
    const { rows, ...rest } = table;
    return `    { ${Object.entries(rest).map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(', ')}, "rows": [\n${rows.map((row) => `      ${JSON.stringify(row)}`).join(',\n')}\n    ] }`;
  });
  const head = Object.entries(bundle)
    .filter(([key]) => key !== 'tables')
    .map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},\n`)
    .join('');
  return `{\n${head}  "tables": [\n${tables.join(',\n')}\n  ]\n}\n`;
}

/** The CRM's own rows, in the sample format of the CRM's own file. */
export function crmRows() {
  return { format: 'adminium.sample/1', app: 'crm', tables: [{ ref: 'companies', rows: CRM_ROWS.companies }, { ref: 'contacts', rows: CRM_ROWS.contacts }] };
}

const FILES = () => [
  [TARGET, written(buildSample())],
  [CRM_TARGET, written(crmRows())],
];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [target, text] of FILES()) {
    if (process.argv.includes('--check')) {
      let now = '';
      try {
        now = readFileSync(target, 'utf8');
      } catch {
        /* not written yet */
      }
      if (now !== text) {
        console.error(`${target} is behind src/sample: run \`node scripts/sample.mjs\`.`);
        process.exit(1);
      }
    } else {
      writeFileSync(target, text);
      const bundle = JSON.parse(text);
      console.log(`${target}: ${bundle.tables.map((one) => `${one.ref} ${one.rows.length}`).join(' · ')}`);
    }
  }
}
