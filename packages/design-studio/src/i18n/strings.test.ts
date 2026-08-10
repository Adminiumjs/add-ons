import { describe, expect, it } from "vitest";

import { LOCALE_TAGS, designStudioStrings, translator } from "./strings.ts";
import { LAYOUTS, SWATCHES } from "../layouts.ts";
import { TIERING_WORDS, scanForBannedLexicon } from "../testing/lexicon.ts";

const EN = designStudioStrings["en-US"];
const EN_KEYS = Object.keys(EN).sort();

/**
 * The keys a locale is allowed to spell exactly as English spells them.
 *
 * Each entry names the key, the locales it covers and why the word is the same
 * — a shared loanword, an international unit, a colour name that travelled with
 * the ink it names. This is the complete list; anything else identical to
 * English is an untranslated string, and the test above says so.
 */
const SHARED_WITH_ENGLISH: readonly {
  key: keyof typeof EN;
  locales: readonly (typeof LOCALE_TAGS)[number][];
  why: string;
}[] = [
  {
    key: "addon.design-studio.insp.mm",
    locales: ["de-DE", "fr-FR", "cs-CZ", "da-DK"],
    why: "`mm` is the SI symbol for a millimetre. It is not a word in any language and does not decline, so translating it would be inventing a unit.",
  },
  {
    key: "addon.design-studio.tool.text",
    locales: ["de-DE", "cs-CZ"],
    why: "German `Text` and Czech `text` are the ordinary nouns, spelt as English spells them. Capitalisation is German's, not English's.",
  },
  {
    key: "addon.design-studio.insp.text",
    locales: ["de-DE", "cs-CZ"],
    why: "Same word as the tool above, in the inspector heading: German `Text`, Czech `text`. One noun, two places it appears.",
  },
  {
    key: "addon.design-studio.layer.text",
    locales: ["de-DE", "cs-CZ"],
    why: "Same word again, this time as the name of a layer in the list. German `Text`, Czech `text`.",
  },
  {
    key: "addon.design-studio.tool.ellipse",
    locales: ["de-DE", "fr-FR", "da-DK"],
    why: "German `Ellipse`, French `ellipse` and Danish `ellipse` are all the Greek geometric term, borrowed unchanged into each.",
  },
  {
    key: "addon.design-studio.layer.ellipse",
    locales: ["de-DE", "fr-FR", "da-DK"],
    why: "The same geometric term as the tool, used as the layer's name. Borrowed unchanged into German, French and Danish.",
  },
  {
    key: "addon.design-studio.tool.image",
    locales: ["fr-FR"],
    why: "French `image` is the ordinary noun for a picture, and English borrowed it from French rather than the other way round.",
  },
  {
    key: "addon.design-studio.layer.image",
    locales: ["fr-FR"],
    why: "The same French noun, naming a layer. `Photo` would be narrower than what this layer can hold.",
  },
  {
    key: "addon.design-studio.tool.rect",
    locales: ["fr-FR"],
    why: "French `rectangle` is the same Latin-derived word, spelt identically. The French label is capitalised as a heading, as English is.",
  },
  {
    key: "addon.design-studio.layer.rect",
    locales: ["fr-FR"],
    why: "The same French word naming a layer rather than a tool.",
  },
  {
    key: "addon.design-studio.insp.radius",
    locales: ["da-DK"],
    why: "Danish `radius` is the ordinary geometric noun, taken from Latin exactly as English took it. `Hjørneafrunding` would be a description, not the term.",
  },
  {
    key: "addon.design-studio.swatch.magenta",
    locales: ["de-DE", "fr-FR", "da-DK"],
    why: "`Magenta` is a process-ink name: the M of CMYK. Printers in all three languages say it, and a translated ink name would not identify the ink.",
  },
  {
    key: "addon.design-studio.swatch.indigo",
    locales: ["de-DE", "fr-FR", "da-DK"],
    why: "`Indigo` is the dye's own name, from the plant, and it travelled into all three languages with the dye.",
  },
  {
    /*
     * THE ONE A REVIEWER SHOULD LOOK AT TWICE, and the reason this list exists.
     *
     * German writes `Roll-up-Banner` and Danish `Roll-up-banner` — those are
     * not translations either, they are the same English loanword put through
     * each language's compounding rules. Czech does not compound loanwords that
     * way: the Czech print trade writes the two words apart, which comes out
     * identical to English. French is the only one of the four that has a
     * native term, `banderole enroulable`, and it uses it.
     *
     * So this is kept rather than translated, and it is kept HERE, in a list
     * a reader can argue with, rather than passing quietly because the test
     * only sampled four other keys.
     */
    key: "addon.design-studio.layout.roll-up",
    locales: ["cs-CZ"],
    why: "Czech: the print trade uses the English loanword and writes it as two words, so the Czech term is spelt exactly as the English one is.",
  },
];

describe("locale parity", () => {
  it("covers all eight locales", () => {
    expect(LOCALE_TAGS).toEqual([
      "en-US",
      "de-DE",
      "fr-FR",
      "cs-CZ",
      "da-DK",
      "zh-CN",
      "zh-TW",
      "ar-EG",
    ]);
  });

  /**
   * The host's `Area<>` type already turns a missing key into a compile error,
   * but only once the host is rebuilt against this module. Catching it here
   * means the failure lands in the repo that caused it.
   */
  it.each(LOCALE_TAGS)("%s carries every English key and no extras", (tag) => {
    expect(Object.keys(designStudioStrings[tag]).sort()).toEqual(EN_KEYS);
  });

  it.each(LOCALE_TAGS)("%s leaves nothing blank", (tag) => {
    const blank = Object.entries(designStudioStrings[tag])
      .filter(([, v]) => v.trim().length === 0)
      .map(([k]) => k);
    expect(blank).toEqual([]);
  });

  /**
   * EVERY KEY, not a sample of four.
   *
   * This used to check four long sentences and call it done, which meant an
   * untranslated label could sit in a locale for as long as nobody looked —
   * and one did: `layout.roll-up` was verbatim English in Czech while German,
   * French and Danish all had their own. A sample cannot find that; only the
   * full comparison can.
   *
   * The cost of the full comparison is that some words ARE the same in two
   * languages, and pretending otherwise would mean mistranslating them on
   * purpose. So the exceptions are listed one at a time, with the reason, in
   * `SHARED_WITH_ENGLISH` below. The list is the whole set of places where a
   * locale is allowed to read like English, and it is short enough to read.
   */
  it("does not leave English standing in the other seven", () => {
    const standing: string[] = [];
    for (const tag of LOCALE_TAGS.filter((t) => t !== "en-US")) {
      for (const key of EN_KEYS as (keyof typeof EN)[]) {
        if (designStudioStrings[tag][key] !== EN[key]) continue;
        const shared = SHARED_WITH_ENGLISH.find(
          (entry) => entry.key === key && (entry.locales as readonly string[]).includes(tag),
        );
        if (shared === undefined) standing.push(`${tag} ${key} = “${EN[key]}”`);
      }
    }
    expect(standing).toEqual([]);
  });

  it("keeps every shared-with-English entry live, so the list cannot rot", () => {
    // The other direction: an entry that no longer describes anything is an
    // exemption nobody is checking. If a translator gives Czech its own word
    // for a layout, the entry has to go rather than linger.
    const dead = SHARED_WITH_ENGLISH.flatMap((entry) =>
      entry.locales
        .filter((tag) => designStudioStrings[tag][entry.key] !== EN[entry.key])
        .map((tag) => `${tag} ${entry.key}`),
    );
    expect(dead).toEqual([]);
    for (const entry of SHARED_WITH_ENGLISH) expect(entry.why.length).toBeGreaterThan(25);
  });

  it("keeps every placeholder a locale inherits from English", () => {
    const placeholders = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort();
    for (const tag of LOCALE_TAGS) {
      for (const key of EN_KEYS as (keyof typeof EN)[]) {
        expect(placeholders(designStudioStrings[tag][key]), `${tag} ${key}`).toEqual(
          placeholders(EN[key]),
        );
      }
    }
  });
});

/**
 * The release sweep (17 §2) greps BUILT HTML case-insensitively for
 * `pricing|plan|tier|billing|upgrade|/mo|free`, as SUBSTRINGS — which is why
 * "explanation", "frontier" and French "métier" are traps, and why this test
 * checks substrings rather than words. D12 adds "premium" and "pro" for add-ons
 * specifically: the ban is on the tiering IDEA, not only on the word, and this
 * editor is deliberately small rather than a cut-down version of a bigger one.
 *
 * ALL NINE RUNS ARE CARRIED, INCLUDING `pro`, and none is word-anchored. What
 * makes that survivable is the named-token list in `testing/lexicon.ts`: the
 * words that merely contain a banned run — `proof`, `product`, `Propriétés`,
 * `rozprostření` — are forgiven ONE AT A TIME, each with a sentence saying what
 * it means. A weaker pattern would forgive the marketing use along with them.
 */
describe("the vocabulary ban, in all eight locales", () => {
  /*
   * The tables come from `testing/lexicon.ts`, which is also what
   * `built-output.test.ts` runs over `dist/`. One definition, two artefacts:
   * a word that is banned in the bundle cannot be legal in the build.
   */

  it.each(LOCALE_TAGS)("%s contains none of the banned substrings", (tag) => {
    // ONE SCANNER, not a second implementation of the same idea: this is the
    // function `built-output.test.ts` runs over `dist/`, so a word that is
    // banned in the bundle cannot be legal in the build, and the named
    // exemptions are the same named exemptions in both places.
    const offences = Object.entries(designStudioStrings[tag]).flatMap(([key, value]) =>
      scanForBannedLexicon(`${tag} ${key}`, value).map(
        (offence) => `${offence.file}: “${value}” contains “${offence.hit}”`,
      ),
    );
    expect(offences).toEqual([]);
  });

  /**
   * D12's second half: never call an add-on "premium" or "pro". The ban is on
   * the TIERING IDEA, so each language is checked against its own marketing
   * words rather than against the English ones transliterated.
   *
   * Czech is the reason this is a per-locale table instead of one regex. `pro`
   * is the Czech preposition "for" and appears in perfectly ordinary sentences;
   * banning it there would be banning a function word. The words that would
   * actually be violations in Czech are `prémiový` and `profesionální`, so
   * those are what Czech is checked for.
   */
  it.each(LOCALE_TAGS)("%s never calls this add-on premium or pro", (tag) => {
    const patterns = TIERING_WORDS[tag];
    const offences = Object.entries(designStudioStrings[tag]).filter(([, v]) =>
      patterns.some((re) => re.test(v)),
    );
    expect(offences).toEqual([]);
  });

  it("has no link path containing /mo anywhere", () => {
    for (const tag of LOCALE_TAGS) {
      for (const [key, value] of Object.entries(designStudioStrings[tag])) {
        expect(value.includes("/mo"), `${tag} ${key}`).toBe(false);
      }
    }
  });
});

describe("keys the rest of the add-on points at", () => {
  it("has a name for every starting layout", () => {
    for (const layout of LAYOUTS) {
      expect(EN_KEYS).toContain(layout.key);
    }
  });

  it("has a name for every one of the twelve swatches", () => {
    expect(SWATCHES).toHaveLength(12);
    for (const swatch of SWATCHES) {
      expect(EN_KEYS).toContain(swatch.key);
    }
  });

  it("carries the who-else-is-involved sentence in all eight locales", () => {
    // The two keys `register()` hands the host as `noCompanyKeys`. Parity above
    // already proves every locale has every key; this proves these two are keys
    // at all, so a rename in `index.ts` cannot leave the detail surfaces blank.
    for (const key of ["addon.design-studio.noCompany", "addon.design-studio.noAccount"]) {
      expect(EN_KEYS).toContain(key);
      for (const tag of LOCALE_TAGS) {
        // Five, not fifty: the Chinese sentence for "no outside account at
        // all" is ten characters long, and a length gate written against
        // English would fail a locale for being concise.
        expect(designStudioStrings[tag][key as keyof typeof EN].length).toBeGreaterThan(5);
      }
    }
  });

  it("namespaces every key under the add-on's own key", () => {
    for (const key of EN_KEYS) {
      expect(key.startsWith("addon.design-studio."), key).toBe(true);
    }
  });
});

describe("the standalone translator", () => {
  it("substitutes placeholders", () => {
    const t = translator("en-US");
    expect(t("addon.design-studio.legend.bleedValue", { v: "3mm" })).toBe("3mm outside");
  });

  /**
   * The two legend phrases are fetched WITHOUT substitution so the editor can
   * split on `{v}` and put the measurement in the mono face on its own. Every
   * locale has to keep the token for that to work.
   */
  it("keeps the measurement token in the legend phrases, in every locale", () => {
    for (const tag of LOCALE_TAGS) {
      for (const key of [
        "addon.design-studio.legend.bleedValue",
        "addon.design-studio.legend.safeValue",
      ] as const) {
        expect(designStudioStrings[tag][key], `${tag} ${key}`).toContain("{v}");
      }
    }
  });

  it("falls back to English for a locale that somehow lacks a key", () => {
    const t = translator("ar-EG");
    expect(t("addon.design-studio.tile.title")).toBe("صمِّمه هنا");
  });

  it("leaves an unknown placeholder alone rather than printing undefined", () => {
    const t = translator("en-US");
    expect(t("addon.design-studio.legend.bleedValue", {})).toBe("{v} outside");
  });
});
