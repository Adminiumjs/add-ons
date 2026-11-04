/**
 * Writes `seeds/holidays.json`: every reviewed day-set expanded over every
 * reviewed year, as the rows the add-on's `holidays` table starts with. The
 * day-sets in `src/daysets.ts` stay the one source; `src/holidays-seed.test.ts`
 * fails when this file and that source disagree, so re-run this after a change
 * there: `npm run seed`.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const { holidayRows } = await import("../src/holidays-seed.ts");
const out = fileURLToPath(new URL("../seeds/holidays.json", import.meta.url));
writeFileSync(out, `${JSON.stringify(holidayRows(), null, 2)}\n`);
console.log(`wrote ${String(holidayRows().length)} rows to seeds/holidays.json`);
