/**
 * The rules that are easier to break than to notice.
 *
 * Four of this wave's non-negotiables cannot be checked by reading a diff,
 * because each of them is about an ABSENCE: no real call, no real clock, no
 * secret in the browser, no physical CSS direction. A grep over the sources is
 * the only test shape that catches them, so it lives here rather than in a
 * review checklist somebody will one day skim. `built-output.test.ts` is its
 * pair, checking the same repo from the other end — what actually shipped.
 *
 * Deliberately the same shape as `packages/shipping-dhl/src/sources.test.ts`, so
 * that a reader who has seen one add-on's guard suite has seen them all and a
 * rule added to one is obviously missing from the other.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  foreignImportsIn,
  impuritiesIn,
  offendingAddresses,
  sendersIn,
  type InertOrigin,
} from "@adminium/add-on-host/testing";

import { INERT_ORIGINS } from "./add-on-facts.ts";

const SRC = new URL(".", import.meta.url).pathname;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const ALL = walk(SRC);
/** The shipped half: everything that is not itself a test or a test helper. */
const SHIPPED = ALL.filter(
  (f) => /\.(ts|tsx)$/.test(f) && !f.includes(".test.") && !f.includes(`${"testing"}/`),
);
/** The half that renders — where a secret would actually reach a browser. */
const CLIENT = SHIPPED.filter((f) => f.includes(`${"client"}/`));
const STYLES = ALL.filter((f) => f.endsWith(".css"));

const read = (file: string): string => readFileSync(file, "utf8");

/**
 * The source with its comments removed.
 *
 * Every rule below is about what the CODE does, and the comments explaining
 * those rules necessarily name the very things they forbid — `oauth.ts` talks
 * at length about the token exchange it must never perform. Stripping first is
 * what lets the prose stay specific.
 */
const codeOf = (file: string): string =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
const relative = (file: string): string => file.slice(SRC.length);

/**
 * THE ADDRESSES THIS ADD-ON IS ALLOWED TO NAME, AND WHY NAMING THEM IS SAFE.
 *
 * This is the one add-on in the wave that declares a third party at all, so it
 * is the one where the distinction has to be written down rather than assumed.
 * `oauth.ts` holds the vendor's authorize and token endpoints as CONSTANTS the
 * host reads: 24 §5.6 gives the authorization-code exchange to the host, this
 * package has no client secret, performs no exchange, and — see the case below
 * — carries nothing that could issue a request if it wanted to. The manifest's
 * `network.allow` pins the same hostname and the host refuses and audits
 * anything else.
 *
 * Declaring an endpoint and being able to reach one are different things, and
 * the two nets are what keep them different. Anything not on this list is
 * reported, including a second path on a host already here.
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

describe("no real third-party call (24 D11)", () => {
  /*
   * D11 AS A RULE, NOT A WORD LIST. This was a grep for five spellings until a
   * verifier put `new Image(); img.src = "https://…"` into a sibling package
   * and every gate in three repos stayed green — an image beacon is a request
   * and none of the five words appear in one. See `egress.ts` in
   * `@adminium/add-on-host/testing`.
   */
  it("names no address outside the ones declared inert", () => {
    const offenders = [...SHIPPED, ...STYLES].flatMap((file) =>
      offendingAddresses(codeOf(file), INERT).map((url) => `${relative(file)} → ${url}`),
    );
    expect(offenders).toEqual([]);
  });

  it("carries nothing that can issue a request", () => {
    // Which is what makes the two declared URLs above harmless: an address with
    // no way to send is a string.
    const offenders = SHIPPED.flatMap((file) => [
      ...sendersIn(codeOf(file)).map((means) => `${relative(file)} → ${means}`),
      ...foreignImportsIn(codeOf(file)).map((spec) => `${relative(file)} → ${spec}`),
    ]);
    expect(offenders).toEqual([]);
  });

  it("declares an authorized client rather than building one", () => {
    // `oauth.ts` describes the client the HOST hands over. If it ever gained an
    // implementation, this add-on would be holding the shop's credentials.
    const oauth = codeOf(join(SRC, "oauth.ts"));
    expect(oauth).not.toMatch(/grant_type|client_secret|code_verifier|refresh_token/);
  });
});

describe("no real clock, no dice (24 D6/D11)", () => {
  /*
   * THE RULE IS `@adminium/add-on-host/testing` NOW, not a pattern written out
   * here. There was one of these per package and none of the four checked
   * `crypto.getRandomValues` — see that package's `testing/purity.ts` for the
   * mutant that walked past all of them, and `host/src/shared-rule.test.ts` for
   * the guard that fails if this line ever turns back into a regex.
   */
  it("reads no wall clock and rolls no random number", () => {
    // `new Date(iso)` and `Date.UTC(…)` are fine and both are used here: the
    // shared rule bans the argument-less call and leaves arithmetic over a
    // value the caller passed in alone, which is exactly the line this add-on
    // needs drawn.
    const offenders = SHIPPED.flatMap((file) =>
      impuritiesIn(codeOf(file)).map((means) => `${relative(file)} → ${means}`),
    );
    expect(offenders).toEqual([]);
  });

  it("has exactly one pinned clock, and it is the host's moment", () => {
    // Wednesday 5 August 2026, 10:20 — the same moment the host pins. Two
    // visitors a month apart see the same four designs edited on the same days.
    const index = read(join(SRC, "index.ts"));
    expect(index).toContain('iso: "2026-08-05"');
    const declarations = SHIPPED.filter((f) => /PINNED_CLOCK\s*:/.test(codeOf(f)));
    expect(declarations.map(relative)).toEqual(["index.ts"]);
  });
});

describe("secrets never reach the browser (24 D15)", () => {
  it("names no credential in any client module", () => {
    const offenders = CLIENT.filter((file) =>
      /api_key|apiKey|client_secret|clientSecret|access_token|accessToken|refresh_token|bearer/i.test(
        codeOf(file),
      ),
    );
    expect(offenders.map(relative)).toEqual([]);
  });

  it("declares no settings at all, which is the strongest form of that", () => {
    // A setting that does not exist cannot be marked secret, cannot be read by
    // a client half, and cannot leak. The account is the whole of the
    // configuration and the host owns it.
    expect(codeOf(join(SRC, "index.ts"))).toContain("settings: []");
  });

  it("reads no storage the host did not hand it", () => {
    const offenders = SHIPPED.filter((file) =>
      /localStorage|sessionStorage|document\.cookie|indexedDB/.test(codeOf(file)),
    );
    expect(offenders.map(relative)).toEqual([]);
  });
});

describe("CSS logical properties only", () => {
  it("uses no physical direction in the stylesheet", () => {
    // The host renders Arabic right-to-left with no RTL stylesheet, so a
    // physical `left` is a bug that exactly one of eight locales would show.
    const physical =
      /(^|[\s;{])(margin|padding|border|inset)-(left|right)\b|(^|[\s;{])(left|right)\s*:|text-align\s*:\s*(left|right)/m;
    const offenders = STYLES.filter((file) =>
      physical.test(read(file).replace(/\/\*[\s\S]*?\*\//g, " ")),
    );
    expect(offenders.map(relative)).toEqual([]);
  });

  it("uses no physical direction in an inline style either", () => {
    const physical = /(margin|padding|border|inset)(Left|Right)\b|textAlign\s*:\s*"(left|right)"/;
    const offenders = CLIENT.filter((file) => physical.test(codeOf(file)));
    expect(offenders.map(relative)).toEqual([]);
  });

  it("renders no anchor, so no href can carry a banned path", () => {
    // 17 §2: no href may contain the run that reads as a per-month charge. This
    // add-on links nowhere — it fills a slot inside an app it does not own.
    const offenders = SHIPPED.filter((file) => /href=|window\.open\(/.test(codeOf(file)));
    expect(offenders.map(relative)).toEqual([]);
  });
});

/**
 * AC7: "every simulated result is labelled as such in the UI".
 *
 * Every step of this flow shows something a real account would have supplied,
 * and for a while only the last of them said so — which is the version of this
 * rule that is worse than none, because a customer who sees one labelled screen
 * reasonably concludes the unlabelled ones were real.
 *
 * There is no DOM harness in this repo (D7 allows no runtime dependency the
 * host lacks, and a renderer for four assertions is not a dependency worth
 * taking), so the check is structural: each step's own module must render the
 * label for that step, and must do it behind the transport's `simulated` flag
 * so a self-host build with a real client shows none of them.
 */
describe("every simulated surface carries its label (24 D11, AC7)", () => {
  const flow = codeOf(join(SRC, "client/ImportFlow.tsx"));
  const consent = codeOf(join(SRC, "client/ConsentPanel.tsx"));

  it("labels the connect card, the picker and the import result", () => {
    for (const key of ["demo.connect", "demo.pick", "demo.note"]) {
      expect(flow, `ImportFlow is missing ${key}`).toContain(`"${key}"`);
    }
  });

  it("labels the consent panel, which is where access is actually granted", () => {
    expect(consent).toContain('"demo.consent"');
    // The panel cannot read the transport itself — it is rendered as a sibling
    // of the sheet — so the flag is passed in. If that prop went away the panel
    // would silently label nothing.
    expect(consent).toMatch(/simulated\s*:\s*boolean/);
    expect(flow).toMatch(/simulated=\{transport\.simulated\}/);
  });

  it("guards every label on the transport's own flag, never on a build switch", () => {
    // Four labels, four guards: three in the flow (`transport.simulated` on
    // connect and pick, `simulated` inside the import step) and one in the
    // consent panel.
    const guards = [...flow.matchAll(/simulated\s*&&/g)].length;
    expect(guards).toBe(3);
    expect([...consent.matchAll(/simulated\s*&&/g)]).toHaveLength(1);
    // And no import.meta.env / NODE_ENV anywhere near them: whether a result is
    // simulated is a fact about the transport, not about how it was built.
    expect(flow).not.toMatch(/import\.meta\.env|NODE_ENV/);
    expect(consent).not.toMatch(/import\.meta\.env|NODE_ENV/);
  });

  it("keeps a label for every step the flow has", () => {
    // If a fifth step is ever added, the step list and the label list move
    // apart here rather than in front of a customer.
    const steps = [...flow.matchAll(/type Step = ([^;]+);/g)][0]?.[1] ?? "";
    expect(steps.split("|").map((s) => s.trim().replace(/"/g, ""))).toEqual([
      "connect",
      "pick",
      "import",
    ]);
  });
});

describe("no real logo, and no claim of a partnership (24 D12)", () => {
  it("draws the company as letters in a tile and nothing else", () => {
    // No `<svg>`, no `<img>`, no background-image: the monogram is text.
    const offenders = CLIENT.filter((file) => /<img\b|<svg\b|background-image/.test(codeOf(file)));
    expect(offenders.map(relative)).toEqual([]);
  });

  it("states no partnership in anything it renders", () => {
    // Comments stripped first, and deliberately: `index.ts` and `oauth.ts` both
    // explain at length that no partnership may be claimed, and a rule stated
    // in prose is not a claim made to a customer.
    const CLAIMS = /\bpartner|\bofficial\b|\bendorse|authoris?ed reseller|certified by/i;
    const offenders = SHIPPED.filter((file) => CLAIMS.test(codeOf(file)));
    expect(offenders.map(relative)).toEqual([]);
  });
});
