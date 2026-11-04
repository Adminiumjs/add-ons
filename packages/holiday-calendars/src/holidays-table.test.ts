/**
 * THE HOLIDAYS AS ROWS AN APP CAN LINK TO.
 *
 * Maker Shop and Print Shop keep their own `closures` table, and a working-day
 * date reads it. "Add as a closure" is the APP's action: it makes a closure row
 * whose link (`rules.addOnLink`) names one of this add-on's holiday rows. So
 * the add-on owes the app three things, each asserted here through the
 * product's own code rather than restated:
 *
 *   1. the days as rows, in a table of its own (`holidays`), filled at install
 *      from the same reviewed sets the panel imports from;
 *   2. an app's role may READ that table, and nothing more: the rows are
 *      reference data every app on the install shares;
 *   3. an app manifest that links its closures to it, and grants its role the
 *      read, is one the validator accepts.
 */

import { readFileSync } from "node:fs";

import { addOnRoleTableHold, validateManifest, type AddOnManifest } from "@adminiumjs/manifest";
import { describe, expect, it } from "vitest";

import manifest from "../manifest.json" with { type: "json" };
import { DAY_SETS, YEARS, expandSet } from "./daysets.ts";
import { holidayRows } from "./holidays-seed.ts";

const SEED = JSON.parse(
  readFileSync(new URL("../seeds/holidays.json", import.meta.url), "utf8"),
) as unknown[];

const table = manifest.requiredSchema.tables.find((entry) => entry.ref === "holidays")!;

function validated(): AddOnManifest {
  const result = validateManifest(manifest);
  expect(result.ok ? [] : result.issues).toEqual([]);
  return (result as { manifest: AddOnManifest }).manifest;
}

/** The smallest app that does what Maker and Print do with it. */
function linkingApp(over: { link?: unknown; actions?: string[] } = {}) {
  const en = (text: string) => ({ "en-US": text });
  return {
    kind: "app",
    manifestVersion: 1,
    key: "studio-fixture",
    name: "Studio fixture",
    version: "0.2.0",
    publisher: { id: "adminium", name: "Adminium", url: "https://adminium.dev" },
    license: "AGPL-3.0-only",
    description: { key: "app.fixture.line", fallback: "A studio that closes on public holidays." },
    categories: ["operations"],
    compatibility: { minAdminiumVersion: "0.3.28", requires: [] },
    addOns: {
      suggests: [{ key: "holiday-calendars", range: "^1.0.16", reason: en("Close for public holidays.") }],
    },
    frontends: [{ side: "staff", kind: "spa", entry: "index.html", placement: "external", routes: { studio: "/" } }],
    pages: [
      {
        ref: "studio-closures",
        template: "page-crud",
        title: { key: "app.fixture.closures", fallback: "Closures" },
        nav: { group: "workspace", icon: "calendar", order: 1 },
        bindings: { rows: "closures" },
      },
    ],
    requiredSchema: {
      tables: [
        {
          ref: "closures",
          label: en("Closure"),
          labelPlural: en("Closures"),
          keyField: "reason",
          columns: [
            { ref: "id", type: "int", role: "pk" },
            { ref: "from_date", type: "date", label: en("From") },
            { ref: "to_date", type: "date", label: en("To") },
            { ref: "reason", type: "text", maxLength: 120, nullable: true, label: en("Reason") },
            {
              ref: "holiday_id",
              type: "int",
              nullable: true,
              label: en("Public holiday"),
              rules: { addOnLink: over.link ?? { addOn: "holiday-calendars", table: "holidays" } },
            },
          ],
        },
      ],
    },
    roles: [
      {
        key: "owner",
        name: "Owner",
        permissions: ["app:@:staff", "table:@closures:read", "table:@closures:create"],
        tables: [{ addOn: "holiday-calendars", table: "holidays", actions: over.actions ?? ["read"] }],
      },
    ],
  };
}

describe("the holidays table", () => {
  it("is the add-on's own, prefixed, and the manifest still passes the real validator", () => {
    validated();
    expect(manifest.requiredSchema.prefixed).toBe(true);
    expect(table.columns.map((column) => column.ref)).toEqual(["id", "country", "region", "day", "name"]);
    // appGrants is read by Adminium 0.3.28 and later; the floor says so.
    expect(manifest.compatibility.minAdminiumVersion).toBe("0.3.28");
  });

  it("starts with every reviewed set over every reviewed year, as the panel offers them", () => {
    expect(manifest.seeds).toEqual([{ table: "holidays", file: "seeds/holidays.json" }]);
    // The file is generated from daysets.ts (`npm run seed`); a stale file fails here.
    expect(SEED).toEqual(holidayRows());
    const expected = DAY_SETS.reduce((sum, set) => sum + YEARS.reduce((n, year) => n + expandSet(set, year).length, 0), 0);
    expect(SEED).toHaveLength(expected);
    // The installer refuses a seed file of more than 200 rows (two years are 134; three would be 201).
    expect(SEED.length).toBeLessThanOrEqual(200);
  });

  it("carries the regional set apart from the national one, and the names as the state writes them", () => {
    const rows = holidayRows();
    expect(rows).toContainEqual({ country: "DE", region: null, day: "2026-10-03", name: "Tag der Deutschen Einheit" });
    const alsace = rows.filter((row) => row.region === "alsace-moselle");
    expect(alsace.length).toBeGreaterThan(rows.filter((row) => row.country === "FR" && row.region === null).length / 2);
    for (const row of rows) expect(row.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("gives an app's role a read of every column, and never a write", () => {
    const addOn = validated();
    const hold = addOnRoleTableHold(
      { addOn: "holiday-calendars", table: "holidays", actions: ["read", "create", "update"] },
      addOn,
    );
    // Asked for more, it is cut to the add-on's ceiling, and the cut is named.
    expect(hold.actions).toEqual(["read"]);
    expect(hold.narrowed?.actions).toEqual(["create", "update"]);
    expect(hold.skipped).toBe("ceiling");

    // Asked for the read alone, it is given whole: every column, so the app's
    // closure can show the day and its name.
    const read = addOnRoleTableHold({ addOn: "holiday-calendars", table: "holidays", actions: ["read"] }, addOn);
    expect(read.actions).toEqual(["read"]);
    expect(read.narrowed).toBeUndefined();
    const readable = read.readable ?? table.columns.map((column) => column.ref);
    for (const column of ["day", "name", "country", "region"]) expect(readable).toContain(column);
  });

  it("is the table an app's closures may link to", () => {
    const result = validateManifest(linkingApp());
    expect(result.ok ? [] : result.issues).toEqual([]);
  });

  it("would refuse an app linking to an add-on it does not name", () => {
    const result = validateManifest(linkingApp({ link: { addOn: "another-calendar", table: "holidays" } }));
    expect(result.ok).toBe(false);
  });
});
