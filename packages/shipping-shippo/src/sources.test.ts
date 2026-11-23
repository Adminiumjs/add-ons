/**
 * The two source rules every add-on states by importing them. They are the
 * host package's, for the reason `shared-rule.test.ts` gives: a scanner kept
 * one per package is N rules that agree until one of them is repaired.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { impuritiesIn, RAW_CONTROL_EXPLANATION, rawControlOffences } from "@adminium/add-on-host/testing";

const SRC = new URL(".", import.meta.url).pathname;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const ALL = walk(SRC).filter((file) => /\.tsx?$/.test(file));
const SHIPPED = ALL.filter((file) => !/\.test\.tsx?$/.test(file) && !file.startsWith(join(SRC, "testing")));
const relative = (file: string) => file.slice(SRC.length);
const codeOf = (file: string) =>
  readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("what ships", () => {
  it("has sources to read", () => {
    expect(SHIPPED.map(relative)).toContain("carrier.ts");
  });

  it("reads no real clock and rolls no dice", () => {
    expect(SHIPPED.flatMap((file) => impuritiesIn(codeOf(file)).map((means) => `${relative(file)} → ${means}`))).toEqual([]);
  });
});

describe("every source file is text a tool will read", () => {
  it("writes control characters as escapes, never as raw bytes", () => {
    const offenders = ALL.flatMap((file) => rawControlOffences(relative(file), readFileSync(file, "utf8")));
    expect(offenders, `\n${RAW_CONTROL_EXPLANATION}\n${offenders.join("\n")}\n`).toEqual([]);
  });
});
