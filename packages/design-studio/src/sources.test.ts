/**
 * The rules that are easier to break than to notice.
 *
 * Modelled on `packages/shipping-dhl/src/sources.test.ts`, and here for the same
 * reason: several of this wave's non-negotiables are about an ABSENCE — no real
 * call, no real clock, no physical CSS direction, no secret in the browser, no
 * renderer in the server half — and an absence cannot be reviewed by reading a
 * diff. A grep over the sources is the only shape of test that catches them, so
 * it lives here rather than in a checklist somebody will one day skim.
 *
 * This suite reads SOURCES. `built-output.test.ts` reads the artefact. They
 * overlap on purpose: this one names the file that broke the rule, that one
 * proves the rule survived the build.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  foreignImportsIn,
  impuritiesIn,
  offendingAddresses,
  sendersIn,
  type InertOrigin,
  RAW_CONTROL_EXPLANATION,
  rawControlOffences,
} from "@adminium/add-on-host/testing";

import manifest from "../manifest.json";

import { INERT_ORIGINS } from "./add-on-facts.ts";

const SRC = fileURLToPath(new URL(".", import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const ALL = walk(SRC);
const relative = (file: string) => file.slice(SRC.length);

/** The shipped half: everything that is not itself a test or a test helper. */
const SHIPPED = ALL.filter(
  (f) => /\.(ts|tsx)$/.test(f) && !f.includes(".test.") && !f.includes(`${"testing"}${"/"}`),
);
const UI = SHIPPED.filter((f) => f.includes(`${"ui"}${"/"}`));
const STYLES = ALL.filter((f) => f.endsWith(".css"));

const read = (file: string) => readFileSync(file, "utf8");

/**
 * The source with its comments removed.
 *
 * Every rule below is about what the CODE does, and the comments explaining
 * those rules necessarily quote the very things they forbid — `doc.ts` says in
 * words that it reads no clock, and would fail its own grep otherwise.
 * Stripping first is what lets the prose stay specific.
 */
const codeOf = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

/**
 * Addresses this add-on is allowed to name — none.
 *
 * It declares NO egress at all (`manifest.json` has no `network` block and no
 * `outbound-http` capability), so unlike the carrier there is not even a
 * host-injected client to reach for. A URL here would be a hole with nothing on
 * the other side of it.
 */
/**
 * READ OFF THE ADD-ON'S OWN DECLARATION, never written out here.
 *
 * `add-on-facts.ts` carries the reasoning: an address this package names is a
 * fact about this package, and both hosts discover it by vendoring the file
 * rather than by keeping a copy of it in an exemption list of their own.
 * Declaring it there and asserting it here is what keeps the two in step —
 * this suite is the one that fails if an origin is declared and then named
 * nowhere, or named and not declared.
 */
const INERT: readonly InertOrigin[] = INERT_ORIGINS;

describe("no real third-party call, no real clock (24 D11)", () => {
  /*
   * D11 AS A RULE, NOT A WORD LIST. This was a grep for five spellings until a
   * verifier put `new Image(); img.src = "https://…"` into a sibling package
   * and every gate in three repos stayed green. `egress.ts` in
   * `@adminium/add-on-host/testing` carries the argument; the two nets below
   * are an ADDRESS nobody declared inert and an API whose only purpose is to
   * issue a request, and the third — the value, at run time — is in the hosts.
   */
  it("names no address outside the ones declared inert", () => {
    const offenders = [...SHIPPED, ...STYLES].flatMap((file) =>
      offendingAddresses(codeOf(file), INERT).map((url) => `${relative(file)} → ${url}`),
    );
    expect(offenders).toEqual([]);
  });

  it("carries nothing that can issue a request", () => {
    const offenders = SHIPPED.flatMap((file) => [
      ...sendersIn(codeOf(file)).map((means) => `${relative(file)} → ${means}`),
      ...foreignImportsIn(codeOf(file)).map((spec) => `${relative(file)} → ${spec}`),
    ]);
    expect(offenders).toEqual([]);
  });

  it("agrees with the manifest, which asks for no egress", () => {
    expect(manifest.addOn).not.toHaveProperty("network");
    expect(manifest.capabilities).not.toContain("outbound-http");
    // No third party means no demo transport to seed: there is nothing to
    // simulate when there is nothing to call.
    expect(manifest.addOn).not.toHaveProperty("demoTransport");
  });

  /*
   * THE RULE IS `@adminium/add-on-host/testing` NOW, not a pattern written out
   * here. There was one of these per package and none of the four checked
   * `crypto.getRandomValues` — see that package's `testing/purity.ts` for the
   * mutant that walked past all of them, and `host/src/shared-rule.test.ts` for
   * the guard that fails if this line ever turns back into a regex.
   */
  it("reads no real clock and rolls no dice", () => {
    // The whole editor is deterministic: ids come from a counter on the
    // document, the seeded activity carries its own pinned dates, and two runs
    // of the same demo produce byte-identical output a year apart (21 D6).
    const offenders = SHIPPED.flatMap((file) =>
      impuritiesIn(codeOf(file)).map((means) => `${relative(file)} → ${means}`),
    );
    expect(offenders).toEqual([]);
  });

  it("pulls in no Node built-in, because the client half runs in a browser", () => {
    const offenders = SHIPPED.filter((file) => /from\s*["']node:/.test(codeOf(file)));
    expect(offenders.map(relative)).toEqual([]);
  });
});

describe("the job's bleed reaches the document (24 §5.5)", () => {
  /*
   * ANOTHER RULE ABOUT AN ABSENCE, which is why it is a grep.
   *
   * Every document this add-on built used to carry a constant 3mm bleed, so a
   * host asking for anything else — including the `bleedMm: 0` a host that
   * reproduces onto a fixed-size object honestly declares — got a file at a size
   * it never asked for, and then rejected it with its own `checkArtwork()`. The
   * repair is that `createArtworkSource` binds `job.bleedMm` into a `startDoc`
   * and hands that to `open()`.
   *
   * What makes it stay repaired is that there is no second way to start a
   * document. A `docFromLayout()` or `createDoc()` call in a component takes the
   * bleed's default and looks perfectly correct doing it — the reviewable
   * symptom is not the call site but the absence of the job at it.
   */
  const UI_CONSTRUCTORS = /\b(docFromLayout|createDoc)\s*\(/;

  it("builds no document inside a component, where the job is not in hand", () => {
    const offenders = UI.filter((file) => UI_CONSTRUCTORS.test(codeOf(file)));
    expect(offenders.map(relative)).toEqual([]);
  });

  it("reads the field, in the one place that holds the job", () => {
    // The other half of the rule: a grep that only forbids would be satisfied by
    // an add-on that had stopped making documents at all.
    expect(codeOf(join(SRC, "artworkSource.ts"))).toMatch(/job\.bleedMm/);
  });
});

describe("secrets are server-only (24 D15)", () => {
  it("has no secret setting to leak in the first place", () => {
    const settings = manifest.settings as { key: string; secret?: boolean }[];
    expect(settings.filter((s) => s.secret === true)).toEqual([]);
    // Which is why every setting is public: `connect: { kind: "none" }` means
    // there is no credential anywhere in this add-on, on either side.
    expect(manifest.addOn.publicSettings).toEqual(settings.map((s) => s.key));
    expect(manifest.addOn.connect.kind).toBe("none");
  });

  it("names no credential anywhere in the shipped sources", () => {
    /*
     * Identifier shapes, not the word "api-key": `ConnectKind` in
     * `@adminium/add-on-host` is
     * the closed vocabulary of §5.6 and its `"api-key"` member is a way of
     * connecting, not a secret. What must never appear is a NAME a credential
     * would be read under — `api_key`, `accessToken`, `clientSecret` — which is
     * how the packer greps a built bundle one build later.
     */
    const offenders = SHIPPED.filter((file) =>
      /\bapi_key\b|\bapiKey\b|\baccess_token\b|\baccessToken\b|\bclient_secret\b|\bclientSecret\b|\bcredentials?\b/i.test(
        codeOf(file),
      ),
    );
    expect(offenders.map(relative)).toEqual([]);
  });
});

describe("the client and server halves stay apart", () => {
  /** Follows relative imports from one entry and returns everything reachable. */
  const reachableFrom = (entry: string): string[] => {
    const seen = new Set<string>();
    const walkImports = (file: string): void => {
      if (seen.has(file)) return;
      seen.add(file);
      for (const [, spec] of codeOf(file).matchAll(/from\s*["'](\.[^"']+)["']/g)) {
        walkImports(join(file, "..", spec));
      }
    };
    walkImports(entry);
    return [...seen].map(relative).sort();
  };

  it("keeps the server half clear of the renderer, at any depth", () => {
    // The check that actually bites. A direct `import { useState }` is easy to
    // spot in review; a three-hop path from the entry through a helper is not,
    // and the symptom — a React tree inside the half the host runs
    // server-side — shows up only when someone greps the built file.
    const reachable = reachableFrom(join(SRC, "server", "artwork-source.ts"));
    expect(reachable.filter((file) => file.startsWith("ui/"))).toEqual([]);
    expect(reachable.filter((file) => file.endsWith(".tsx"))).toEqual([]);

    const offenders = reachable.filter((file) =>
      /from\s*["'](react|react-dom|react\/jsx-runtime|lucide-react)["']/.test(
        codeOf(join(SRC, file)),
      ),
    );
    expect(offenders).toEqual([]);
  });

  it("lets the client half reach the engine, because the editor runs in the browser", () => {
    // The reverse direction is NOT symmetrical and should not be. This add-on
    // makes no call: the editor, the document engine and the `artwork-source`
    // implementation all run in the customer's browser, and the server half
    // exists for a Phase B install that re-derives a record without one.
    const reachable = reachableFrom(join(SRC, "index.ts"));
    expect(reachable).toContain("artworkSource.ts");
    expect(reachable).toContain("doc.ts");
    // …but never through the server entry, which is a packaging boundary.
    expect(reachable.filter((file) => file.startsWith("server/"))).toEqual([]);
  });
});

describe("CSS logical properties only", () => {
  // The host renders Arabic right-to-left with no RTL stylesheet, so a physical
  // `left` is a bug exactly one of eight locales would show.
  const PHYSICAL_JS =
    /\b(margin|padding|border|inset)(Left|Right)\b|textAlign:\s*["'](left|right)["']|\b(left|right):\s*[\d-]/;
  const PHYSICAL_CSS =
    /(^|[\s;{])(margin|padding|border|inset)-(left|right)\s*:|(^|[\s;{])(left|right)\s*:|text-align\s*:\s*(left|right)/m;

  it("uses no physical direction in any rendered style", () => {
    const offenders = UI.filter((file) => PHYSICAL_JS.test(codeOf(file)));
    expect(offenders.map(relative)).toEqual([]);
  });

  it("uses no physical direction in the stylesheet either", () => {
    const offenders = STYLES.filter((file) =>
      PHYSICAL_CSS.test(read(file).replace(/\/\*[\s\S]*?\*\//g, " ")),
    );
    expect(offenders.map(relative)).toEqual([]);
  });

  it("has no link at all, so none of them can contain a banned path", () => {
    // 17 §2: no href may contain "/mo". This add-on renders no anchors — the
    // editor is a route inside the host's own shell, reached through the slot
    // rather than through a URL this repo writes down.
    const offenders = SHIPPED.filter((file) => /href=/.test(codeOf(file)));
    expect(offenders.map(relative)).toEqual([]);
  });
});

/**
 * ── EVERY SOURCE FILE IS TEXT, OR THE TOOLS QUIETLY STOP READING IT ─────────
 *
 * The rule and the reasoning are in `@adminium/add-on-host/testing`'s
 * `encoding.ts`, imported rather than restated for the reason
 * `shared-rule.test.ts` gives: a scanner kept one-per-package is not one rule,
 * it is N rules that agree until one of them is repaired.
 */
describe("every source file is text a tool will read", () => {
  it("writes control characters as escapes, never as raw bytes", () => {
    const offenders = ALL.flatMap((path) =>
      rawControlOffences(path.slice(SRC.length), readFileSync(path, "utf8")),
    );
    expect(offenders, `\n${RAW_CONTROL_EXPLANATION}\n${offenders.join("\n")}\n`).toEqual([]);
  });
});
