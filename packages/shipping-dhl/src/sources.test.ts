/**
 * The rules that are easier to break than to notice.
 *
 * Four of this wave's non-negotiables cannot be checked by reading a diff,
 * because each of them is about an ABSENCE: no real call, no real clock, no
 * physical CSS direction, no secret in the browser. A grep over the sources is
 * the only test shape that catches them, so it lives here rather than in a
 * review checklist somebody will one day skim.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { strings } from "./i18n/strings.ts";
import { renderLabelPdf } from "./label.ts";
import { bannedSubstringsIn, TIERING_WORDS } from "./testing/lexicon.ts";

const SRC = new URL(".", import.meta.url).pathname;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const ALL = walk(SRC).filter((f) => /\.(ts|tsx)$/.test(f));
/** The shipped half: everything that is not itself a test or a test helper. */
const SHIPPED = ALL.filter((f) => !f.includes(".test.") && !f.includes(`${"testing"}/`));
const UI = SHIPPED.filter((f) => f.includes(`${"ui"}/`));

const read = (file: string) => readFileSync(file, "utf8");

/**
 * The source with its comments removed.
 *
 * Every rule below is about what the CODE does, and the comments explaining
 * those rules necessarily quote the very things they forbid — this file's own
 * `Date.now()` would fail its own grep otherwise. Stripping first is what lets
 * the prose stay specific.
 */
const codeOf = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
const relative = (file: string) => file.slice(SRC.length);

describe("no real third-party call, no real clock (24 D11)", () => {
  it("has no fetch, no XHR and no WebSocket anywhere in the shipped sources", () => {
    const offenders = SHIPPED.filter((file) =>
      /\bfetch\s*\(|XMLHttpRequest|new WebSocket|navigator\.sendBeacon/.test(codeOf(file)),
    );
    // The ONLY way out is the `HttpClient` the host injects, bound to the
    // manifest's allow-list. A `fetch` here would be an egress hole.
    expect(offenders.map(relative)).toEqual([]);
  });

  it("reads no real clock and rolls no dice", () => {
    const offenders = SHIPPED.filter((file) =>
      /Date\.now\s*\(|Math\.random\s*\(|new Date\s*\(\s*\)|performance\.now\s*\(/.test(codeOf(file)),
    );
    expect(offenders.map(relative)).toEqual([]);
  });
});

describe("secrets are server-only (24 D15)", () => {
  it("keeps every secret setting out of the client half", () => {
    // The packer greps a built bundle for the keys of settings marked secret;
    // this catches it a build earlier, at the import that would have leaked it.
    const offenders = UI.filter((file) =>
      /api_key|account_number|apiKey|accountNumber|CarrierCredentials/.test(codeOf(file)),
    );
    expect(offenders.map(relative)).toEqual([]);
  });

  it("keeps the real transport out of the client half as well", () => {
    const offenders = UI.filter((file) => /from "\.\.\/(carrier|http)\.ts"/.test(codeOf(file)));
    expect(offenders.map(relative)).toEqual([]);
  });

  it("cannot reach the real transport from the client entry, at any depth", () => {
    // The check that actually bites. A direct import is easy to spot in review;
    // a three-hop path from `index.ts` through a helper is not, and the symptom
    // — a credential-reading module sitting in a browser bundle — shows up only
    // when someone greps the built file, which is how this was caught once.
    const seen = new Set<string>();
    const walkImports = (file: string): void => {
      if (seen.has(file)) return;
      seen.add(file);
      for (const [, spec] of codeOf(file).matchAll(/from "(\.[^"]+)"/g)) {
        walkImports(join(file, "..", spec));
      }
    };
    walkImports(join(SRC, "index.ts"));

    const reachable = [...seen].map(relative).sort();
    expect(reachable).not.toContain("carrier.ts");
    expect(reachable).not.toContain("http.ts");
    expect(reachable).not.toContain("server.ts");
    // The demo transport IS reachable, and has to be: in demo mode there is no
    // server for it to run on. It holds no credential and makes no call.
    expect(reachable).toContain("demo-carrier.ts");
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
    // one place a link was tempting says in words why there is nothing to link
    // to (`panel.noPage`), which is a stronger answer than a dead link.
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
    expect(offenders).toEqual([]);
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

  it("has no string containing the banned path fragment", () => {
    // 17 §2 bans any href containing "/mo". This add-on renders no anchors at
    // all, but a string is where one would arrive first, so the fragment is
    // asserted over the strings as well as over the built output.
    const offenders: string[] = [];
    for (const [locale, bundle] of Object.entries(strings)) {
      for (const [key, value] of Object.entries(bundle)) {
        if (value.toLowerCase().includes("/mo")) offenders.push(`${locale} · ${key}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the generated label clear of them too", () => {
    // The label is user-visible: it gets downloaded, printed and pinned to a
    // parcel, so it is copy like any other.
    const pdf = renderLabelPdf({
      tracking: "00 3400 1234 5678 9012",
      service: "Economy, second working day",
      reference: "MP-4126",
      collection: "2026-08-05 14:00-17:00",
      delivery: "2026-08-07",
      to: {
        name: "Kestrel Joinery",
        lines: ["The Joinery Shop"],
        city: "Nether Wold",
        postcode: "NW3 6BD",
        country: "GB",
      },
      from: { name: "Marlow Press", city: "Marlow", postcode: "ML7 2QF", country: "GB" },
    });
    expect(bannedSubstringsIn(pdf)).toEqual([]);
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
 * AC7, made executable: EVERY PANEL THAT SHOWS A CARRIER RESULT SAYS IT IS ONE.
 *
 * The chip is not decoration on the happy path. Rates, a booked collection, a
 * refusal and a scan timeline are all things a real carrier would have produced,
 * and each of them renders in its own titled card — so each of them carries its
 * own label, because a reviewer screenshots one card, not the page. Two of the
 * four went out without one: the refusal card quoted the demo carrier's words
 * verbatim in quotation marks, and the staff tracking timeline listed places and
 * times, and neither said where any of it came from.
 *
 * The pairs below are `title key → label key`. A card that renders the first and
 * not the second fails here, which is what makes deleting a chip a red suite
 * rather than a quiet regression.
 */
describe("every simulated result is labelled as one (24 D11 / AC7)", () => {
  const LABELLED: Readonly<Record<string, readonly [string, string][]>> = {
    "DispatchAction.tsx": [
      ["addon.shipping-dhl.rates.title", "addon.shipping-dhl.rates.simulated"],
      ["addon.shipping-dhl.error.title", "addon.shipping-dhl.error.simulated"],
      ["addon.shipping-dhl.booked.title", "addon.shipping-dhl.demoChip"],
      ["addon.shipping-dhl.tracking.title", "addon.shipping-dhl.tracking.simulated"],
    ],
    "DeliveryMethods.tsx": [
      ["addon.shipping-dhl.checkout.title", "addon.shipping-dhl.checkout.simulated"],
    ],
    "TrackingPanel.tsx": [
      ["addon.shipping-dhl.booked.tracking", "addon.shipping-dhl.demoChip"],
    ],
  };

  it("pairs every result card in the UI with its own demo label", () => {
    const offenders: string[] = [];
    for (const [file, pairs] of Object.entries(LABELLED)) {
      const source = UI.find((f) => f.endsWith(file));
      expect(source, `${file} is not in the UI`).toBeDefined();
      const code = codeOf(source!);
      for (const [title, label] of pairs) {
        if (!code.includes(title)) offenders.push(`${file} no longer renders ${title}`);
        else if (!code.includes(label)) offenders.push(`${file} · ${title} has no demo label`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("guards every one of those labels behind `isDemo()`", () => {
    // A chip hard-coded on would be a lie the other way round: with real
    // credentials the results are real, and the screen has to stop saying so.
    for (const [file, pairs] of Object.entries(LABELLED)) {
      const code = codeOf(UI.find((f) => f.endsWith(file))!);
      const chips = new Set(pairs.map(([, label]) => label)).size;
      expect(
        [...code.matchAll(/isDemo\(\)/g)].length,
        `${file} renders ${chips} demo labels and has fewer isDemo() guards`,
      ).toBeGreaterThanOrEqual(chips);
    }
  });

  it("has a chip string for each of them, in all eight locales", () => {
    const chipKeys = [...new Set(Object.values(LABELLED).flat().map(([, label]) => label))];
    for (const [locale, bundle] of Object.entries(strings)) {
      for (const key of chipKeys) {
        expect(Object.keys(bundle), `${locale} is missing ${key}`).toContain(key);
      }
    }
  });
});

describe("all eight locales carry all the keys", () => {
  it("has parity with English, key for key", () => {
    // The type annotation in `strings.ts` makes this a compile error too. The
    // runtime check earns its place by naming WHICH key is missing, which the
    // compiler's error does not always manage across eight objects.
    const english = Object.keys(strings["en-US"]).sort();
    for (const [locale, bundle] of Object.entries(strings)) {
      expect(Object.keys(bundle).sort(), `locale ${locale}`).toEqual(english);
    }
  });

  it("namespaces every key under the add-on's own key", () => {
    const stray = Object.keys(strings["en-US"]).filter((k) => !k.startsWith("addon.shipping-dhl."));
    expect(stray).toEqual([]);
  });

  it("leaves no English behind in the other seven", () => {
    // A translated bundle that is byte-identical to English for a real sentence
    // is an untranslated bundle. Short shared tokens are exempt — "Service",
    // "DHL" and "API" are the same word in more than one of these languages.
    const exempt = new Set(["addon.shipping-dhl.booked.service"]);
    const offenders: string[] = [];
    for (const [locale, bundle] of Object.entries(strings)) {
      if (locale === "en-US") continue;
      for (const [key, value] of Object.entries(bundle)) {
        if (exempt.has(key)) continue;
        const english = strings["en-US"][key as keyof (typeof strings)["en-US"]];
        if (value === english && english.length > 12) offenders.push(`${locale} · ${key}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
