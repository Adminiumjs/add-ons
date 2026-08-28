/**
 * The rules that are easier to break than to notice.
 *
 * Each of these is about an ABSENCE — no real call, no real clock, no physical
 * CSS direction, no company named, no module that could only run on a server
 * reachable from the browser half. A grep over the sources is the only test
 * shape that catches an absence, so it lives here rather than in a review
 * checklist somebody will one day skim.
 *
 * The rules themselves come from `@adminium/add-on-host/testing` and are NOT
 * restated here. Four add-ons in this repository each wrote their own regular
 * expression for "no clock, no dice", none of the four checked
 * `crypto.getRandomValues`, and a die appended to a shipped engine left every
 * package green. `packages/host/src/shared-rule.test.ts` is the guard that
 * fails if this file ever grows a pattern of its own.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  foreignImportsIn,
  impuritiesIn,
  offendingAddresses,
  sendersIn,
  RAW_CONTROL_EXPLANATION,
  rawControlOffences,
  type InertOrigin,
} from "@adminium/add-on-host/testing";

import { COMPANY_MARKS, INERT_ORIGINS } from "./add-on-facts.ts";
import { DAY_SETS } from "./daysets.ts";
import { strings } from "./i18n/strings.ts";
import { register } from "./index.ts";
import { bannedSubstringsIn, TIERING_WORDS } from "./testing/lexicon.ts";

const SRC = new URL(".", import.meta.url).pathname;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const ALL = walk(SRC).filter((file) => /\.(ts|tsx)$/.test(file));
/** The shipped half: everything that is not itself a test or a test helper. */
const SHIPPED = ALL.filter((file) => !file.includes(".test.") && !file.includes(`${"testing"}/`));
const UI = SHIPPED.filter((file) => file.includes(`${"ui"}/`));

const read = (file: string) => readFileSync(file, "utf8");

/**
 * The source with its comments removed.
 *
 * Every rule below is about what the CODE does, and the comments explaining
 * those rules necessarily quote the very things they forbid — this file's own
 * mention of a clock would fail its own grep otherwise.
 */
const codeOf = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
const relative = (file: string) => file.slice(SRC.length);

/**
 * READ OFF THE ADD-ON'S OWN DECLARATION, never written out here.
 *
 * `add-on-facts.ts` carries the reasoning: an address this package names is a
 * fact about this package, and a host discovers it by vendoring the file rather
 * than by keeping a copy in an exemption list of its own. It is empty, which is
 * the strictest possible state — every address anywhere in the sources is a
 * finding.
 */
const INERT: readonly InertOrigin[] = INERT_ORIGINS;

describe("no real third-party call, no real clock (24 D11)", () => {
  it("found sources to read at all", () => {
    // A walk that returned nothing would agree with every case below.
    expect(SHIPPED.length).toBeGreaterThan(6);
    expect(UI.length).toBeGreaterThan(1);
  });

  it("names no address, anywhere, because none is declared inert", () => {
    const offenders = SHIPPED.flatMap((file) =>
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

  it("reads no real clock and rolls no dice", () => {
    const offenders = SHIPPED.flatMap((file) =>
      impuritiesIn(codeOf(file)).map((means) => `${relative(file)} → ${means}`),
    );
    expect(offenders).toEqual([]);
  });

  /**
   * ── THE ONE `Date` IN THE PACKAGE, AND WHERE IT IS ALLOWED TO BE ───────────
   *
   * `impuritiesIn` bans `new Date()` with NO argument, which is the real clock.
   * `new Date(Date.UTC(y, m, d))` is a calendar day and is fine — but it is
   * fine in exactly one place, and this case is what keeps it there.
   *
   * `civil.ts` exists so that every date this add-on computes is integer
   * arithmetic. The single reason a `Date` is constructed at all is that
   * `Intl.DateTimeFormat` takes one, so it belongs at the formatting seam and
   * nowhere else. A `Date` appearing in an engine would be a day that can slide
   * across a timezone boundary, which is the whole failure `civil.ts` was
   * written against.
   */
  it("constructs a Date only where a formatter demands one", () => {
    /*
     * A PLAIN SUBSTRING AND NOT A PATTERN, on purpose. Written as a regular
     * expression this reads as a second, private copy of the shared purity rule
     * — `restatementsIn` reports exactly that spelling, and it is right to:
     * two rules where there should be one means only one of them gets repaired.
     * This is a narrower question the shared rule does not ask (WHERE a legal
     * `Date` may be built), so it is asked in a form that cannot be mistaken
     * for the rule itself.
     */
    const constructs = (file: string) => codeOf(file).includes("new Date(");
    const offenders = SHIPPED.filter(
      (file) => constructs(file) && !file.endsWith(join("i18n", "t.ts")),
    );
    expect(offenders.map(relative)).toEqual([]);
    // …and the allowed one really is there, or this case is guarding nothing.
    const seam = SHIPPED.find((file) => file.endsWith(join("i18n", "t.ts")))!;
    expect(codeOf(seam).includes("new Date(Date.UTC(")).toBe(true);
  });
});

/**
 * ── THE SEPARATION THAT REPLACES A CLIENT/SERVER SPLIT ─────────────────────
 *
 * Every other add-on here has a server half and a suite that walks the import
 * graph to keep the credential-reading module out of the browser. This one has
 * no credential and no server half, so that suite would have nothing to look
 * for — and "there is nothing to leak" is a claim worth checking rather than
 * assuming.
 *
 * What IS worth keeping out of the client entry is `src/testing/`: the lexicon
 * spells every banned word out, so a bundle that reached it would fail the very
 * grep it defines. That is the same shape of rule with a different needle.
 */
describe("nothing test-only is reachable from the client entry", () => {
  const reachableFromIndex = (): string[] => {
    const seen = new Set<string>();
    const walkImports = (file: string): void => {
      if (seen.has(file)) return;
      seen.add(file);
      for (const [, spec] of codeOf(file).matchAll(/from "(\.[^"]+)"/g)) {
        walkImports(join(file, "..", spec));
      }
    };
    walkImports(join(SRC, "index.ts"));
    return [...seen].map(relative).sort();
  };

  it("cannot reach `testing/` from `index.ts`, at any depth", () => {
    const reachable = reachableFromIndex();
    expect(reachable.filter((file) => file.startsWith("testing/"))).toEqual([]);
  });

  it("reaches the data and the panel, so the walk is walking something", () => {
    const reachable = reachableFromIndex();
    for (const file of ["daysets.ts", "calendar.ts", "civil.ts", join("ui", "SettingsPanel.tsx")]) {
      expect(reachable, `${file} is not reachable from the entry`).toContain(file);
    }
  });
});

describe("CSS logical properties only", () => {
  it("uses no physical direction in any rendered style", () => {
    // The host renders Arabic right-to-left with no RTL stylesheet, so a
    // physical `left` is a bug that only one of eight locales would show.
    const physical =
      /\b(margin|padding|border|inset)(Left|Right)\b|textAlign:\s*"(left|right)"|\b(left|right):\s*\d/;
    const offenders = UI.filter((file) => physical.test(codeOf(file)));
    expect(offenders.map(relative)).toEqual([]);
  });

  it("has no link at all, so none of them can contain a banned path", () => {
    // 17 §2: no href may contain "/mo". This add-on renders no anchors — the
    // one place a link was tempting is the line telling somebody where to
    // report a wrong date, and it says where in words instead. A URL in a
    // shipped source would also be the first thing the egress net reports.
    const offenders = UI.filter((file) => /href=/.test(codeOf(file)));
    expect(offenders.map(relative)).toEqual([]);
  });
});

describe("the vocabulary ban, in all eight locales", () => {
  it("keeps every user-visible string clear of the banned SUBSTRINGS", () => {
    const offenders: string[] = [];
    for (const [locale, bundle] of Object.entries(strings)) {
      for (const [key, value] of Object.entries(bundle)) {
        for (const word of bannedSubstringsIn(value)) {
          offenders.push(`${locale} · ${key} · contains "${word}" · ${value}`);
        }
      }
    }
    expect(offenders, `\n${offenders.join("\n")}\n`).toEqual([]);
  });

  it("never calls this add-on premium or pro, in any locale's own words", () => {
    const offenders: string[] = [];
    for (const [locale, bundle] of Object.entries(strings)) {
      const patterns = TIERING_WORDS[locale];
      expect(patterns, `locale ${locale} has no tiering-word table`).toBeDefined();
      for (const [key, value] of Object.entries(bundle)) {
        if (patterns!.some((re) => re.test(value))) offenders.push(`${locale} · ${key} · ${value}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  /**
   * THE HOLIDAY NAMES ARE SWEPT TOO, and they are not in the locale bundles.
   *
   * `daysets.ts` carries sixty-odd proper nouns in five languages, every one of
   * which is rendered on a screen. Nothing above looks at them — the bundle
   * checks read `strings` — so a country whose holiday happened to be spelt
   * with a banned run would have shipped it. The names are DATA and cannot be
   * reworded to suit a gate, which is precisely why somebody has to know before
   * the set is added rather than after.
   */
  it("keeps the day-set data clear of them as well", () => {
    const offenders: string[] = [];
    for (const set of DAY_SETS) {
      for (const day of set.days) {
        for (const word of bannedSubstringsIn(day.name)) {
          offenders.push(`${set.country}${set.region ? `/${set.region}` : ""} · ${day.name} · "${word}"`);
        }
      }
    }
    expect(offenders, `\n${offenders.join("\n")}\n`).toEqual([]);
  });

  it("has no string containing the banned path fragment", () => {
    const offenders: string[] = [];
    for (const [locale, bundle] of Object.entries(strings)) {
      for (const [key, value] of Object.entries(bundle)) {
        if (value.toLowerCase().includes("/mo")) offenders.push(`${locale} · ${key}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("never states or implies a partnership", () => {
    const CLAIMS = /partner|official|endorse|authoris?ed reseller|certified by/i;
    const offenders: string[] = [];
    for (const [locale, bundle] of Object.entries(strings)) {
      for (const [key, value] of Object.entries(bundle)) {
        if (CLAIMS.test(value)) offenders.push(`${locale} · ${key}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * IT NAMES NO COMPANY — AND AN EMPTY GATE PROVES NOTHING, SO THIS ONE DOES NOT
 * REST ON THE EMPTY LIST
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * This is the first add-on in the repository whose `COMPANY_MARKS` is `[]`, and
 * `[]` is exactly the shape a BROKEN declaration takes: a glob that stopped
 * matching, a file somebody never filled in, and a correct statement all export
 * the same value. A host reading it cannot tell them apart, and a gate over an
 * empty needle list is green about nothing.
 *
 * So the emptiness is checked against things that would ALL have to be wrong
 * together for it to be an accident:
 *
 *   · `register()` says `namesCompany: false` AND supplies `noCompanyKeys`, so
 *     the host renders the positive statement where a not-affiliated line would
 *     go — rendering nothing there is indistinguishable from forgetting it;
 *   · the sources and all eight bundles are swept for the marks the SIBLING
 *     add-ons declare, which is a real needle list and not an empty one;
 *   · the packaged sweep has to have READ something, so a walk that found no
 *     files fails rather than passing.
 *
 * `packages/host/src/trademarks.test.ts` closes the last side from outside:
 * this package's row in `TRADEMARKS.md` must say `*(none)*` precisely because
 * this export is empty.
 */
describe("this add-on names no company (24 AC6, D12)", () => {
  /**
   * The marks the OTHER add-ons in this repository declare, written here as the
   * needle list this package is swept with.
   *
   * Hard-coded rather than globbed off the siblings, and that is deliberate:
   * a glob would make this case's strength depend on which packages happen to
   * be checked out, which is the "empty list passes everything" failure again
   * one level up. These are three words a reviewer can read.
   */
  const SIBLING_MARKS = ["DHL", "Deutsche Post", "Canva"];

  it("declares no mark, and says so in the shape a host reads", () => {
    expect(COMPANY_MARKS).toEqual([]);
    expect(register().namesCompany).toBe(false);
    expect(register().noCompanyKeys).toEqual(["addon.holiday-calendars.noCompany"]);
  });

  it("states the positive fact in all eight locales, where the notice would go", () => {
    for (const key of register().noCompanyKeys!) {
      for (const [locale, bundle] of Object.entries(strings)) {
        const value = (bundle as Record<string, string>)[key];
        expect(value, `${locale} has no ${key}`).toBeTruthy();
        expect(value!.length, `${locale} · ${key} is a stub`).toBeGreaterThan(40);
      }
    }
  });

  it("mentions none of the marks its siblings declare, in any source", () => {
    const offenders = SHIPPED.flatMap((file) =>
      SIBLING_MARKS.filter((mark) => read(file).includes(mark)).map(
        (mark) => `${relative(file)} names ${mark}`,
      ),
    );
    expect(offenders).toEqual([]);
  });

  it("mentions none of them in any locale bundle either", () => {
    const offenders: string[] = [];
    for (const [locale, bundle] of Object.entries(strings)) {
      for (const [key, value] of Object.entries(bundle)) {
        for (const mark of SIBLING_MARKS) {
          if (value.includes(mark)) offenders.push(`${locale} · ${key} names ${mark}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("would find a mark if one were there, so the sweep is not vacuous", () => {
    // The proof the three cases above need: the same predicate, run over text
    // that DOES name a company, reports it. Without this a green run cannot be
    // told from a run that read nothing.
    const planted = "Rates come back from DHL, which is not affiliated with us.";
    expect(SIBLING_MARKS.filter((mark) => planted.includes(mark))).toEqual(["DHL"]);
  });
});

describe("all eight locales carry all the keys", () => {
  it("has parity with English, key for key", () => {
    // The type annotation in `strings.ts` makes this a compile error too. The
    // runtime check earns its place by naming WHICH key is missing, which the
    // compiler's error does not always manage across eight objects.
    const english = Object.keys(strings["en-US"]).sort();
    expect(english.length).toBeGreaterThan(40);
    for (const [locale, bundle] of Object.entries(strings)) {
      expect(Object.keys(bundle).sort(), `locale ${locale}`).toEqual(english);
    }
  });

  it("namespaces every key under the add-on's own key", () => {
    const stray = Object.keys(strings["en-US"]).filter(
      (key) => !key.startsWith("addon.holiday-calendars."),
    );
    expect(stray).toEqual([]);
  });
});

/**
 * ── EVERY SOURCE FILE IS TEXT, OR THE TOOLS QUIETLY STOP READING IT ─────────
 *
 * The rule and the reasoning are in `@adminium/add-on-host/testing`'s
 * `encoding.ts`, imported rather than restated for the reason
 * `shared-rule.test.ts` gives: a scanner kept one-per-package is not one rule,
 * it is N rules that agree until one of them is repaired. It matters more than
 * most for being unenforced, because its failure mode is a tool reporting
 * NOTHING and being believed — a raw control byte makes `grep` skip a file
 * silently, with exit status 0.
 */
describe("every source file is text a tool will read", () => {
  it("writes control characters as escapes, never as raw bytes", () => {
    const offenders = ALL.flatMap((path) =>
      rawControlOffences(path.slice(SRC.length), readFileSync(path, "utf8")),
    );
    expect(offenders, `\n${RAW_CONTROL_EXPLANATION}\n${offenders.join("\n")}\n`).toEqual([]);
  });
});
