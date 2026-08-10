/**
 * The release grep, run against the thing that actually ships.
 *
 * The sweep that gates a release (17 §2, 24 D10) greps BUILT output
 * case-insensitively for a set of substrings. Every other check in this repo
 * reads sources, and sources are not what the sweep reads — which matters here
 * more than it looks, because a Vite library build KEEPS COMMENTS. A source
 * comment that spells a banned run out while explaining why it is banned ships
 * that run in `dist/client.js`, passes every string-level test, and
 * fails the release. That is not hypothetical: it is exactly what this file was
 * added to catch, and the two comments it caught are now written so that they
 * name the pattern instead of quoting it.
 *
 * The check is a SUBSTRING check over whole files, not a word check over
 * translations, because that is how the release grep behaves. Genuine
 * homographs — French `propre`, Czech `Projde`, and the English identifiers the
 * host's own payload shape forces on us — are carved out one token at a time
 * below, with the reason written down. A token that is not on that list fails,
 * which means the carve-out list is a record of decisions rather than a filter
 * someone widened until the test went quiet.
 */

import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { OUTPUT } from "../vite.config.ts";
import { OAUTH, VENDOR_API_HOST } from "./oauth.ts";
import { DIST, PACKAGE_ROOT, distFiles, distRelative, ensureFreshBuild, readDist } from "./testing/built.ts";

ensureFreshBuild();

/** The two files the manifest names, absolute. */
const CLIENT = join(PACKAGE_ROOT, OUTPUT.client);
const SERVER = join(PACKAGE_ROOT, OUTPUT.server);

/**
 * Everything the release grep would read.
 *
 * The filter is an allow-list, which is only safe while nothing ELSE lands in
 * dist/ — and a sibling repo shipped this wave's blocker twice over by trusting
 * exactly that, the second time through a source map the gate had been told to
 * skip. So the list of emitted files is asserted below rather than assumed, and
 * a new extension appearing in dist/ fails the suite instead of vanishing from
 * it.
 */
const SHIPPED = distFiles().filter((f) => /\.(js|css|html)$/.test(f));

/**
 * The sweep's set, plus the two D12 adds for add-ons. Case-insensitive
 * substrings, in the order they appear in 17 §2 so a reader can diff the two.
 *
 * `/mo` is the ninth run in that list and is checked separately below, because
 * it is the one that is not a run of LETTERS — the tokeniser this file uses
 * would never produce it.
 */
const BANNED_RUNS = [
  "pricing",
  "tier",
  "billing",
  "upgrade",
  "free",
  "plan",
  "premium",
  "pro",
] as const;

/**
 * CARVE-OUTS — every word in the built output that legitimately contains one of
 * the runs above. Compared case-insensitively against whole tokens (a maximal
 * run of letters), so `propre` here does NOT license `pro` standing alone.
 *
 * Adding a line is a decision, not a formality: it says this word is an
 * ordinary word of its language or an identifier the host's own API forces, and
 * that a customer reading it would never take it for a word about money. If a
 * new token turns up that does not fit that description, the fix is to reword
 * the copy or the comment, not to extend this list.
 */
const ALLOWED_TOKENS: Record<string, string> = {
  // ── Genuine homographs in the seven non-English locales ──────────────────
  //    None of these is about money, and each is the ordinary word its
  //    language uses for what the sentence is saying.
  angesprochen: "de-DE — 'contacted', past participle of ansprechen",
  propre: "fr-FR — 'own', as in 'their own account'",
  proviennent: "fr-FR — 'come from', of the fixture data",
  Projde: "cs-CZ — 'it goes through', of the checks",
  "Probíhají": "cs-CZ — 'are running', of the checks",

  // ── English identifiers and comment words ────────────────────────────────
  //    `product*` and `provenance` are field names, two of them dictated by
  //    the host's own slot payload (`job.ts`), so they cannot be renamed away
  //    from this list without breaking the seam.
  product: "identifier — the host's Configuration field",
  productKey: "identifier — JobSpec field, host's shape",
  productLabel: "identifier — JobSpec field, host's shape",
  provenance: "identifier — how the file on screen got there",
  Promise: "identifier — the language's own",
  stopPropagation: "identifier — the DOM's own",
  proper: "comment — 'a proper noun', about the company name",
  approximated: "comment — the D12 rule: never traced or approximated",
};

const ALLOWED = new Set(Object.keys(ALLOWED_TOKENS).map((w) => w.toLowerCase()));

/**
 * Maximal runs of letters. `\p{L}` rather than `\w`, because JavaScript's `\w`
 * is ASCII-only even under the `u` flag — with it, Czech "Probíhají" tokenises
 * as "Prob" + "haj", the first of which contains a banned run and matches no
 * carve-out. A tokeniser that splits a word in half turns every accented
 * language into false positives.
 */
const TOKENS = /\p{L}+/gu;

/**
 * WHY TOKENISING IS STILL A SUBSTRING GREP — read this before "simplifying" it.
 *
 * The release gate (17 §2, D10) is a case-insensitive SUBSTRING grep. This file
 * splits the bytes into words first, which looks like a weaker, word-anchored
 * check and is not one: the comparison below is `token.includes(run)`, not
 * `token === run`. A run buried in the middle of a word still matches, which is
 * exactly what catches D10's two named traps — "ex**plan**ation" and
 * "fron**tier**" — and `scan()` is self-tested on both of them further down so
 * that stops being a claim.
 *
 * THE ONLY thing the tokenising buys is the carve-out list: a substring grep
 * cannot tell French `propre` from an English `pro`, so it cannot allow one
 * without allowing the other. Tokens can, one word at a time, with the language
 * and the meaning written beside it.
 *
 * So: DO NOT change `includes` to `===`, and DO NOT add a `\b` anchor. Either
 * one turns this from the release gate into something that merely resembles it,
 * and the two traps above would sail through. If a word here is a false
 * positive, the fix is a line in `ALLOWED_TOKENS` naming why — never a looser
 * match.
 */
function scan(text: string, run: string): { token: string; around: string }[] {
  const hits: { token: string; around: string }[] = [];
  for (const match of text.matchAll(TOKENS)) {
    const token = match[0];
    if (!token.toLowerCase().includes(run)) continue;
    if (ALLOWED.has(token.toLowerCase())) continue;
    // The surrounding characters make a failure actionable: a banned run inside
    // a comment reads very differently from one inside a string.
    const at = match.index ?? 0;
    hits.push({ token, around: text.slice(Math.max(0, at - 45), at + 45).replace(/\s+/g, " ") });
  }
  return hits;
}

describe('dist/ holds nothing the ban grep cannot read', () => {
  /*
   * The allow-list above reads .js/.css/.html. This asserts that is ALL there
   * is, so the exemption and the absence stay one decision. Source maps are the
   * specific hazard: they are verbatim copies of the sources, comments and all.
   */
  it('emits no source maps', () => {
    const maps = distFiles().filter((f) => f.endsWith('.map'));
    expect(maps, `dist/ carries maps the grep cannot see: ${maps.join(', ')}`).toEqual([]);
  });

  it('emits nothing outside the extensions the grep reads', () => {
    const unread = distFiles().filter((f) => !/\.(js|css|html)$/.test(f));
    expect(unread, `dist/ carries files no gate reads: ${unread.join(', ')}`).toEqual([]);
  });
});

describe("the built output exists to be greppable at all", () => {
  it("emitted the client bundle, its stylesheet and the server half", () => {
    const names = SHIPPED.map(distRelative).sort();
    expect(names).toContain("client.js");
    expect(names).toContain("client.css");
    expect(names).toContain("server.js");
  });

  it("leaves the client half a single self-contained ESM file (D7)", () => {
    // An add-on's client half builds to ONE bundle. A shared chunk between the
    // two halves would make the client import a sibling the manifest does not
    // name — and the host loads only what the manifest names.
    const relativeImports = [...readDist(CLIENT).matchAll(/from\s*"(\.[^"]*)"/g)].map((m) => m[1]);
    expect(relativeImports).toEqual([]);
  });

  it("greps a build no older than the sources that produced it", () => {
    // `ensureFreshBuild` is what guarantees this; the assertion is here so a
    // reader knows the file list above is not a stale directory listing.
    expect(SHIPPED.length).toBeGreaterThan(0);
    expect(DIST.endsWith("/dist")).toBe(true);
  });
});

describe("the vocabulary ban, over BUILT output (17 §2, 24 D10)", () => {
  it.each(BANNED_RUNS)("has no un-carved-out '%s' anywhere in dist", (run) => {
    const offences: string[] = [];
    for (const file of SHIPPED) {
      for (const hit of scan(readDist(file), run)) {
        offences.push(`${distRelative(file)}: "${hit.token}" (…${hit.around}…)`);
      }
    }
    expect(offences).toEqual([]);
  });

  /**
   * THE MATCHER'S OWN TEST — the guard on the guard.
   *
   * D10 names two substring traps precisely because they are the ones a
   * word-anchored gate misses: "explanation" hides `plan`, "frontier" hides
   * `tier`. This case feeds them to the same `scan()` every assertion above
   * uses, so a future edit that anchors the match to word boundaries fails HERE
   * — loudly, with the reason in the title — instead of silently letting the
   * next release ship the word it was written to catch.
   */
  it("catches a banned run hidden INSIDE a longer word (D10's two traps)", () => {
    expect(scan("An explanation follows.", "plan").map((h) => h.token)).toEqual(["explanation"]);
    expect(scan("the frontier", "tier").map((h) => h.token)).toEqual(["frontier"]);
    // And the carve-out list is per-token, so allowing `propre` does not allow
    // a bare `pro` beside it.
    expect(scan("propre", "pro")).toEqual([]);
    expect(scan("pro", "pro").map((h) => h.token)).toEqual(["pro"]);
  });

  it("carries no carve-out that nothing in the build needs", () => {
    // A carve-out list is only a record of decisions while every line on it is
    // still load-bearing. One that outlives the word it was written for is a
    // hole somebody can walk a real violation through — `pro` would be carved
    // out "because of propre" long after the French sentence changed.
    const all = SHIPPED.map(readDist).join("\n").toLowerCase();
    const stale = Object.keys(ALLOWED_TOKENS).filter((w) => !all.includes(w.toLowerCase()));
    expect(stale).toEqual([]);
  });

  /**
   * The ninth run in 17 §2's list, and the only one the tokeniser above cannot
   * see: `/mo` is a slash and two letters, so no `\p{L}+` token ever contains
   * it. It gets a plain case-insensitive substring test over the same bytes —
   * which is what the release grep does to every run, and what catches a
   * `/models`, `/monogram` or `/monitor` href as well as a literal "$9/mo"
   * (D10's closing paragraph names all three).
   */
  it("has no path or word reading as a per-month charge", () => {
    const offences = SHIPPED.filter((f) => readDist(f).toLowerCase().includes("/mo")).map(
      distRelative,
    );
    expect(offences).toEqual([]);
  });

  /**
   * The regression guard, stated as its own case so the reason survives.
   *
   * The two comments this file first caught were a module header listing the
   * banned words and a translator note beside the German step label quoting the
   * run that a borrowed verb's ending carries. Both have been rewritten to name
   * the pattern rather than the fragment, and the words themselves now live
   * only in `i18n/strings.test.ts`, which is never bundled.
   */
  it("keeps the translator note out of the shipped bundle", () => {
    const client = readDist(CLIENT);
    for (const run of BANNED_RUNS) {
      if (run === "pro") continue; // covered token-by-token above
      expect(client.toLowerCase().includes(run), `client bundle contains "${run}"`).toBe(false);
    }
  });
});

describe("the client / server split survives bundling (24 D15, AC10)", () => {
  const serverOut = SHIPPED.filter((f) => f === SERVER);

  it("emits server entries that import no renderer", () => {
    // The manifest's `provides[].server` and `demoTransport` are loaded by the
    // host outside a React tree — and, in a connected build, potentially
    // outside a browser. A `react` import here would mean the split is a
    // naming convention rather than a fact about the graph.
    const offenders = serverOut.filter((f) =>
      /from\s*"(react|react-dom|react\/jsx-runtime|lucide-react)"/.test(readDist(f)),
    );
    expect(offenders.map(distRelative)).toEqual([]);
  });

  it("emits server entries that reach for no DOM they have not guarded", () => {
    // `window` and `MutationObserver` have no guarded form here at all: the
    // observer that watches the host's `lang` belongs to `useT.ts`, which is
    // the React half. `document` DOES appear once — `currentTag()` reads the
    // host's `lang` when there is a document and answers `en-US` when there is
    // not — so the assertion is that every mention of it sits behind a
    // `typeof document` guard, not that the word is absent.
    //
    // This used to read `\bdocument\.` over `dist/server/**` and passed for the
    // wrong reason: the old build put the shared modules in a THIRD chunk under
    // `shared/`, which matched neither half's prefix and was therefore read by
    // nothing. One bundle per half is what makes the check real.
    for (const file of serverOut) {
      const text = readDist(file);
      expect(/\bwindow\.|MutationObserver/.test(text), distRelative(file)).toBe(false);
      const mentions = (text.match(/document/g) ?? []).length;
      const guards = (text.match(/typeof document/g) ?? []).length;
      // One guard, then the two uses it protects, in a single expression.
      expect(guards, `${distRelative(file)} touches the DOM unguarded`).toBeGreaterThan(0);
      expect(mentions).toBeLessThanOrEqual(guards * 3);
    }
  });

  it("actually loads and runs under Node, which is the property those greps stand in for", async () => {
    // The regexes above are proxies. This is the thing itself: the host loads
    // `provides[].server` and `demoTransport` outside a React tree and, in a
    // connected install, outside a browser. Vitest runs with no `document` and
    // no `window`, so an unguarded reach for either throws here rather than in
    // somebody else's install.
    const half = (await import(/* @vite-ignore */ SERVER)) as {
      createDemoTransport: (c: { iso: string; hour: number; minute: number }) => {
        simulated: boolean;
        list: () => Promise<readonly unknown[]>;
      };
      createCanvaSource: (o: { transport: unknown; choose: unknown }) => {
        key: string;
        label: () => string;
        available: (j: { trimWidthMm: number; trimHeightMm: number }) => { ok: boolean };
      };
      VENDOR_API_HOST: string;
    };

    const transport = half.createDemoTransport({ iso: "2026-08-05", hour: 10, minute: 20 });
    expect(transport.simulated).toBe(true);
    expect(await transport.list()).toHaveLength(4);

    const source = half.createCanvaSource({ transport, choose: () => Promise.resolve(null) });
    expect(source.key).toBe("import-canva");
    // `label()` is the call that goes through `t()` → `currentTag()`, i.e. the
    // one guarded `document` read in the whole bundle.
    expect(source.label()).toBeTruthy();
    expect(source.available({ trimWidthMm: 85, trimHeightMm: 55 }).ok).toBe(true);

    // And the endpoints the client half is not allowed to carry are here, where
    // the manifest says they live.
    expect(half.VENDOR_API_HOST).toBe(VENDOR_API_HOST);
  });

  it("still puts the renderer in the client bundle, so the split is real and not empty", () => {
    expect(readDist(CLIENT)).toMatch(/from\s*"react"/);
  });

  /**
   * THE VENDOR'S ENDPOINTS ARE NOT THE PAGE'S BUSINESS (§5.6, AC10).
   *
   * The host runs the OAuth flow — this add-on declares an authorize URL, a
   * token URL and a hostname, and never calls any of them. `index.ts` used to
   * re-export `OAUTH` and `VENDOR_API_HOST`, which put the vendor hostname into
   * `dist/client.js` twice: bytes served to every visitor for values only the
   * installer and the manifest read. No secret was exposed — there is none — but
   * it is surface with nothing on the other side of it.
   *
   * Asserted rather than remembered, because the re-export is a one-line
   * convenience somebody will reach for again.
   */
  it("keeps the vendor's endpoints out of the client bundle", () => {
    const client = readDist(CLIENT);
    for (const value of [VENDOR_API_HOST, OAUTH.authorizeUrl, OAUTH.tokenUrl]) {
      expect(client.includes(value), `client bundle contains "${value}"`).toBe(false);
    }
    // The stylesheet ships beside it and is served to the same page.
    expect(readDist(join(PACKAGE_ROOT, OUTPUT.clientCss)).includes(VENDOR_API_HOST)).toBe(false);
  });

  it("ships no secret setting key, because it declares no settings at all", () => {
    // D15's packer check, run a build early. This add-on has no settings, so
    // the assertion is that the words a credential would arrive under are
    // absent from every file that ships.
    const offenders = SHIPPED.filter((f) =>
      /api_key|apiKey|client_secret|clientSecret|access_token|refresh_token/.test(readDist(f)),
    );
    expect(offenders.map(distRelative)).toEqual([]);
  });
});
