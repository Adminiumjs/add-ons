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

import {
  foreignImportsIn,
  impuritiesIn,
  offendingAddresses,
  sendersIn,
  type InertOrigin,
} from "@adminium/add-on-host/testing";

import { strings } from "./i18n/strings.ts";
import { renderLabelPdf } from "./label.ts";
import { bannedSubstringsIn, TIERING_WORDS } from "./testing/lexicon.ts";

import { INERT_ORIGINS } from "./add-on-facts.ts";

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

/**
 * Addresses this add-on is allowed to name. There are none, and that is right:
 * it declares no `network` block, and the only way out of an add-on is the
 * `HttpClient` the host injects, bound to the manifest's allow-list. A URL here
 * would be a hostname reaching a browser with nothing checking it.
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
   * D11 AS A RULE, NOT A WORD LIST. This was a grep for four spellings until a
   * verifier put `new Image(); img.src = "https://…"` inside this package's own
   * `ui/DispatchAction.tsx` and every gate in three repos stayed green. See
   * `@adminium/add-on-host/testing`'s `egress.ts` for the two nets below and
   * the third one that runs in the host apps.
   */
  it("names no address outside the ones declared inert", () => {
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

  /*
   * THE RULE IS `@adminium/add-on-host/testing` NOW, not a pattern written out
   * here. This was the shortest of the four private copies — four spellings,
   * neither `crypto.randomUUID` nor `crypto.getRandomValues` among them — and
   * it is the add-on that ships into BOTH hosts, so a die here would have been
   * a die in two apps. See that package's `testing/purity.ts`, and
   * `host/src/shared-rule.test.ts` for the guard that fails if this line ever
   * turns back into a regex.
   */
  it("reads no real clock and rolls no dice", () => {
    const offenders = SHIPPED.flatMap((file) =>
      impuritiesIn(codeOf(file)).map((means) => `${relative(file)} → ${means}`),
    );
    expect(offenders).toEqual([]);
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

  /**
   * ── THE ONE SCREEN THAT SAID THE OPPOSITE ─────────────────────────────────
   *
   * [Added 2026-08-11, wave 4b round 4.] Every result card carries its chip and
   * every chip is behind `isDemo()`. The DEMO SWITCH's own note was not a
   * result card, so nothing above covered it — and with the switch off it read
   * "Calls go to the carrier with the account details you entered. Switch this
   * back on to stop that."
   *
   * No call is ever made. `runtime.test.ts` proves it in the exact state the
   * note describes: with the switch off and no connected transport injected —
   * which is EVERY demo build, because only a self-hosting shop injects one —
   * `usingDemo()` is still true, the seeded stand-in still answers, and the
   * chip stays on the screen. So the sentence a shop read in the connect dialog
   * and in the settings panel contradicted both the transport underneath it and
   * the panel three rows below it.
   *
   * The note says what the switch would mean in a real shop AND what this build
   * does, and this is the guard that keeps the second half there.
   *
   * ── WHY A WORD PER LOCALE ─────────────────────────────────────────────────
   *
   * "Discloses that nothing is sent" is a claim about MEANING, and the only
   * mechanical proxy for it is the word each locale's own copy uses for the
   * stand-in. The table is explicit and reviewed rather than derived, for the
   * same reason the homograph carve-outs in the hosts' lexicons are: a
   * translator changing the word is expected to change it here too, and a note
   * rewritten into a sentence that no longer mentions the demo at all is
   * exactly what this is watching for.
   */
  const DEMO_WORD: Readonly<Record<string, string>> = {
    "en-US": "demo",
    "de-DE": "Demo",
    "fr-FR": "démo",
    "cs-CZ": "ukázky",
    "da-DK": "demo",
    "zh-CN": "演示",
    "zh-TW": "示範",
    "ar-EG": "العرض التوضيحي",
  };

  it("says the demo is still answering in the note shown when the switch is OFF", () => {
    expect(Object.keys(DEMO_WORD).sort()).toEqual(Object.keys(strings).sort());
    for (const [locale, bundle] of Object.entries(strings)) {
      const note = bundle["addon.shipping-dhl.set.demoOff"]!;
      expect(
        note,
        `${locale}'s switch-off note promises live calls with no word for the stand-in ` +
          "that is in fact still answering",
      ).toContain(DEMO_WORD[locale]!);
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

    /*
     * AND SO IS A STRING THAT IS NOTHING BUT PLACEHOLDERS. `"{quantity} × {what}"`
     * is the same eight bytes in every language because there is no language in
     * it: the words arrive already translated, inside the placeholders. Marking
     * such a key "untranslated" would push a translator into inventing a
     * connective their language does not need, which is a worse bundle than the
     * one this check is defending.
     */
    const hasWords = (text: string) => /\p{L}/u.test(text.replace(/\{[^}]*\}/g, ""));

    const offenders: string[] = [];
    for (const [locale, bundle] of Object.entries(strings)) {
      if (locale === "en-US") continue;
      for (const [key, value] of Object.entries(bundle)) {
        if (exempt.has(key)) continue;
        const english = strings["en-US"][key as keyof (typeof strings)["en-US"]];
        if (!hasWords(english)) continue;
        if (value === english && english.length > 12) offenders.push(`${locale} · ${key}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
