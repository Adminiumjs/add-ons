/**
 * The release grep, run where the release runs it: over BUILT OUTPUT.
 *
 * Every other guard in this repo reads sources. That is one inference away from
 * the thing that ships — a minifier inlines a default, a bundler keeps a
 * legal comment, a string arrives from a dependency — and the sweep (17 §2)
 * does not read sources at all. So this suite builds the add-on and greps the
 * bytes, with the FULL release list: `bannedSubstringsIn` (which now carries
 * `pro` as a substring like every other word) plus the union of the per-locale
 * tiering words, which catch the spellings no ASCII fragment can see.
 *
 * Two holes closed here, both found by re-verification and both of the same
 * shape — a gate that looked complete and was scoped away from the bytes most
 * likely to fail it:
 *
 *   1. The word list this suite used omitted `pro`, which lived only in a
 *      per-locale table that `sources.test.ts` runs over LOCALE BUNDLES. A
 *      comment reading "Pro grade, Profi service" is in no locale bundle, and
 *      it shipped in `dist/client.js` with both gates green.
 *   2. `.map` was filtered out of the walk. A sourcemap's `sourcesContent` is a
 *      verbatim copy of every source file INCLUDING its comments, so the two
 *      biggest files in `dist/` were the two most likely to carry a banned word
 *      and the only two the grep could not see. The build no longer emits them
 *      (`vite.config.ts`) AND the filter is gone, so turning sourcemaps back on
 *      fails this suite instead of quietly re-opening the hole.
 *
 * It also closes the manifest's loop. `manifest.test.ts` proves the manifest
 * names the filenames `vite.config.ts` says it writes; this proves the build
 * actually wrote them, at the paths the manifest declares, resolved the way the
 * installer resolves them (24 AC10: package-root-relative — the package
 * directory is what a host installs).
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import manifest from "../manifest.json" with { type: "json" };
import { OUTPUT } from "../vite.config.ts";
import { buildForReal, DIST, ROOT } from "./testing/build.ts";
import { bannedHitsIn, tieringHitsIn } from "./testing/lexicon.ts";

beforeAll(() => {
  buildForReal();
}, 180_000);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/**
 * EVERY FILE IN `dist/`, with no extension filter of any kind.
 *
 * The published artefact is whatever is in this directory. A gate that decides
 * some of it does not count is a gate with a hole in the shape of whatever was
 * excluded, which is how a 258 KB verbatim copy of the sources shipped past it.
 */
const built = (): string[] => walk(DIST);

const relative = (file: string) => file.slice(DIST.length + 1);

/** Every path the manifest tells an installer to load, package-root-relative. */
const DECLARED_ENTRY_POINTS = [
  ...manifest.addOn.slots.map((slot) => slot.client),
  ...manifest.addOn.provides.map((provided) => provided.server),
  manifest.addOn.demoTransport,
];

describe("the build writes what the manifest promises", () => {
  it("emits both halves, under the names the manifest uses", () => {
    for (const path of Object.values(OUTPUT)) {
      expect(existsSync(join(ROOT, path)), `${path} is missing from the build`).toBe(true);
    }
  });

  it("puts a real file at every entry point the manifest declares (AC10)", () => {
    // Driven from `manifest.json` rather than from `OUTPUT`, so this fails when
    // the manifest names something the build does not write — the failure mode
    // an installer hits at load time and nobody hits before.
    for (const path of DECLARED_ENTRY_POINTS) {
      expect(existsSync(join(ROOT, path)), `${path} is declared but not built`).toBe(true);
    }
  });

  it("ships nothing but those two modules", () => {
    // No sourcemaps, no stray assets: what the manifest names is the whole of
    // the artefact, which is what makes "grep all of `dist/`" a complete gate.
    expect(built().map(relative).sort()).toEqual(["client.js", "server.js"]);
  });

  it("emits no sourcemap, and no reference to one", () => {
    // The published artefact is not a debugging session. `sourcesContent` is a
    // verbatim copy of the sources, comments and all.
    expect(built().filter((f) => f.endsWith(".map")).map(relative)).toEqual([]);
    for (const file of built()) {
      expect(readFileSync(file, "utf8")).not.toContain("sourceMappingURL");
    }
  });

  it("leaves the client half a single self-contained ESM file", () => {
    // D7. A second entry sharing a generated chunk would make the client import
    // a sibling the manifest does not name, and the host loads only what the
    // manifest names.
    const client = readFileSync(join(ROOT, OUTPUT.client), "utf8");
    const relativeImports = [...client.matchAll(/from\s*"(\.[^"]*)"/g)].map((m) => m[1]);
    expect(relativeImports).toEqual([]);
  });

  it("keeps the credentialled half out of the client bundle (D15)", () => {
    const client = readFileSync(join(ROOT, OUTPUT.client), "utf8");
    // The secret setting keys, and the one hostname the real transport targets.
    for (const needle of ["api_key", "account_number", "express.api.dhl.com"]) {
      expect(client.includes(needle), `client bundle contains ${needle}`).toBe(false);
    }
  });
});

describe("the vocabulary ban, over built output", () => {
  it("has something to grep", () => {
    expect(built().length).toBeGreaterThan(0);
  });

  it("contains none of the banned substrings, case-insensitively", () => {
    const offenders: string[] = [];
    for (const file of built()) {
      const bytes = readFileSync(file, "utf8");
      for (const { word, at } of bannedHitsIn(bytes)) {
        offenders.push(
          `${relative(file)} · "${word}" · …${bytes.slice(Math.max(0, at - 60), at + 60)}…`,
        );
      }
    }
    expect(offenders).toEqual([]);
  });

  it("never calls this add-on premium or pro in any locale's own words", () => {
    // All eight bundles land in one built file, so the per-locale tables are
    // greped as one union here. This is what catches "prémiový" and "高级版",
    // which contain no banned ASCII fragment at all.
    const offenders: string[] = [];
    for (const file of built()) {
      const bytes = readFileSync(file, "utf8");
      for (const { pattern, at } of tieringHitsIn(bytes)) {
        offenders.push(
          `${relative(file)} · /${pattern}/ · …${bytes.slice(Math.max(0, at - 60), at + 60)}…`,
        );
      }
    }
    expect(offenders).toEqual([]);
  });
});
