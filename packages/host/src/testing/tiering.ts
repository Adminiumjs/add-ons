/**
 * THE BANNED IDEAS, SPELT IN EVERY LANGUAGE — one table, for every add-on here.
 *
 * ── WHY IT IS IN THE SHARED MIRROR ──────────────────────────────────────────
 *
 * [Added 2026-08-11, wave 4b round 4.] There were SIX copies of this table:
 * one per host, one in three add-ons' `src/testing/lexicon.ts`, and one written
 * inline inside `import-canva`'s `strings.test.ts`. They had already diverged —
 * some carried `\bpro\b` for English, some did not — which is the same thing
 * that happened to the host contract before this repo existed, and it has the
 * same answer: one file, and a suite pointed at it.
 *
 * It matters more here than most tables, because a shelf where the host forbids
 * a word and an add-on advertises it is not a shelf with a rule.
 *
 * The hosts keep an identical copy in their own `src/testing/lexicon.ts` — they
 * cannot import from this repo — and their `builtOutput.test.ts` pins the
 * carve-out lists so a divergence is a line somebody has to write.
 *
 *
 * [Rewritten 2026-08-11, wave 4b round 4.] What stood here was a table called
 * `TIERING_WORDS` holding, per language, the spelling of ONE idea — "premium".
 * It was a fingerprint, and it was proven blind: planting
 * "الترقية إلى الباقة المدفوعة" ("upgrade to the paid plan") in an ar-EG bundle
 * and "Jetzt auf den bezahlten Tarif wechseln" ("switch to the paid tariff
 * now") in a de-DE one left all twelve built-output cases green. Neither
 * sentence contains an English banned run, and neither is the word "premium".
 *
 * This wave has now been bitten three separate times by a fingerprint standing
 * in for a rule — SCARCITY, the mount grep, and a coverage test that listed its
 * own hole — so the shape is the defect, not the missing entry.
 *
 * ── WHAT THE RULE IS ────────────────────────────────────────────────────────
 *
 * 17 §2 bans a set of IDEAS and happens to spell them in English:
 * `pricing`, `plan`, `tier`, `billing`, `upgrade`, `free`, plus D12's
 * `premium`/`pro`. Copy in the other seven languages says the same things in
 * its own words and the release grep cannot see any of it.
 *
 * So the table below is `IDEA × LANGUAGE`, and it is TOTAL BY TYPE: every idea
 * has a cell in every non-English language, and adding a language or an idea is
 * a compile-and-test failure until somebody fills the cells in.
 *
 * ── AND TOTAL BY TYPE IS NOT COMPLETE, WHICH IS THIS FILE'S OWN TRAP ────────
 *
 * [Round 6.] The paragraph that stood here said the totality made this "a rule
 * rather than a list — you cannot forget a cell, you can only leave a list
 * short." That is false, and it is the eleventh fingerprint-standing-in-for-a-
 * rule this wave has found. YOU CANNOT FORGET A CELL; YOU CAN LEAVE EVERY CELL
 * SHORT. Each one is a hand-picked list of stems, so the table catches its own
 * examples and looks finished while doing it. Two plants walked through it:
 *
 *     "Wechseln Sie jetzt zur kostenpflichtigen Vollversion."   (de-DE)
 *     "انتقل إلى النسخة المدفوعة للحصول على مزايا إضافية."        (ar-EG)
 *
 * "Switch now to the paid full version" and "move to the paid version for extra
 * benefits" — a paid-tier upsell in two shipped locales, with every built-output
 * case green. Neither says Tarif, Abo, Preisstufe, باقة or ترقية. They did not
 * have to: a language has more than one way to say a thing, and a stem list
 * knows the ways its author thought of.
 *
 * ── A COMPLETE MECHANICAL RULE HERE IS IMPOSSIBLE, AND SAYING SO IS THE ─────
 * ── ONLY HONEST THING TO DO ─────────────────────────────────────────────────
 *
 * The rule being enforced is: v1 ships completely free of charge, so no
 * sentence anywhere may raise the subject of paying for the product. Deciding
 * whether an arbitrary sentence in seven languages raises that subject is
 * reading for MEANING. No list of stems can do it, no larger list can do it,
 * and a bigger table would only be a slower way to arrive back here — the same
 * conclusion `app-neutral.test.ts` reached about `ONE_SHOP_WORDS` and wrote
 * down rather than papering over.
 *
 * SO THIS TABLE IS A REGRESSION SET. It holds every spelling that has actually
 * got through, in every language, and it will go on growing that way. It is
 * worth having and it must not be read as coverage: a green run here means
 * "nothing we have been bitten by before", never "no upsell in this bundle".
 *
 * ── WHAT A REVIEWER MUST DO, BECAUSE THE GATE CANNOT ────────────────────────
 *
 * For every new or changed string in ANY locale, ask one question:
 *
 *     does this sentence tell the reader that something costs money, or that
 *     more of the product can be had by paying — in any words at all?
 *
 * If yes, it does not ship, whatever language it is in and whatever words it
 * used. A translator reaching for their language's natural marketing phrase is
 * the ordinary way this arrives; it is not a translation error, it is a release
 * defect, and it is caught by reading rather than by grepping.
 *
 * ── AND THE MECHANICAL CHECK THAT IS POSSIBLE, WHICH IS OVER CHANGE ─────────
 *
 * "Does this sentence mean X" is undecidable here. "Has a human read every
 * sentence that ships" is not. Each host carries a copy ledger over its whole
 * message bundle — `i18n/reviewed-copy.json`, one fingerprint per key across
 * all eight locales — and a string that is added, edited or removed in any
 * language fails that suite until somebody updates the ledger, naming the keys
 * that moved. That is the gate this table cannot be; it decides nothing about
 * the words and it makes the reading happen.
 *
 * ── AND WHY THE STEMS ARE THE COMMERCIAL ONES, NOT THE ORDINARY ONES ────────
 *
 * A shop says "price" on every page and must go on saying it: the English ban
 * is on `pricing`, not `price`, and the same distinction has to be kept in each
 * language or the gate fails on copy that is simply copy. So German is
 * `Preisgestaltung` and not `Preis`, French is `tarification` and not `tarif`,
 * Czech is `cenový plán` and not `cena`. Three words that would have been
 * obvious choices are DELIBERATELY ABSENT, each because it means something
 * ordinary in a shop that posts parcels: German `Paket`, Czech `balíček` and
 * Danish `pakke` all mean "parcel", and banning them would ban the delivery
 * add-on's own vocabulary in three languages.
 *
 * A cell may be empty ONLY where the language borrows the English word and the
 * substring ban already catches it — `upgrade` in Danish, say. `[]` is written
 * out and the reason is in the comment beside it, so an empty cell is a
 * decision on the page rather than a gap.
 */

/**
 * The ideas 17 §2 and 24 D12 forbid, named once.
 *
 * `paid` ON ITS OWN IS DELIBERATELY NOT ONE OF THEM, and the attempt is worth
 * recording. It was in this list for one run and came straight back out: a shop
 * is PAID for what it makes, so `screen.confirm.paid` reads "المدفوع" and the
 * add-on shelf has a "المدفوعات" category, both of them ordinary and both of
 * them hits.
 *
 * `paid-version` IS one of them, and it is the round-6 regression. "The paid
 * version" and "the full version" are how an upsell is written when the writer
 * is not reaching for a plan or a tier — which is exactly what both plants did,
 * in two languages, past a table that had a cell for every idea it knew about.
 * The phrase is the unit: `paid` alone is a shop's own word, `paid version` is
 * never anything else.
 */
export const BANNED_IDEAS = [
  "pricing",
  "plan",
  "tier",
  "billing",
  "upgrade",
  "free",
  "premium",
  "paid-version",
] as const;

export type BannedIdea = (typeof BANNED_IDEAS)[number];

/** The seven languages whose spellings the English substring ban cannot see. */
export const OTHER_LANGUAGES = [
  "de-DE",
  "fr-FR",
  "cs-CZ",
  "da-DK",
  "zh-CN",
  "zh-TW",
  "ar-EG",
] as const;

/**
 * TOTAL BY TYPE, WHICH IS WHAT MAKES IT A RULE RATHER THAN A LIST.
 *
 * `Record<Language, Record<BannedIdea, …>>` over the two arrays above: delete a
 * cell and `tsc` names the missing idea; add a language or an idea and every
 * gap is a compile error until somebody fills it in. A list can be short and
 * look finished — that is exactly what the one-word table it replaced did.
 */
export const IDEA_IN_LANGUAGE: Record<
  (typeof OTHER_LANGUAGES)[number],
  Record<BannedIdea, RegExp[]>
> = {
  "de-DE": {
    // Preisgestaltung/Preismodell — never bare `Preis`, which is what every
    // product page says, and never `Preisliste`: the delivery add-on's German
    // copy says "Die Preisliste dahinter wird … gepflegt" of the carrier's own
    // rate card, and a PRICE LIST is a thing a shop has. English bans `pricing`
    // and does not ban `price list` either.
    pricing: [/preisgestaltung/i, /preismodell/i],
    // `Tarif` is the word the plant used. A print works and a maker studio
    // never say it; a mobile network does.
    plan: [/\btarif/i, /\babo\b/i, /abonnement/i],
    tier: [/preisstufe/i, /\bstufenpreis/i, /\btarif/i],
    billing: [/abrechnung/i, /rechnungsstellung/i],
    // German borrows "Upgrade", which the English substring ban already sees;
    // these are the German-formed alternatives it does not.
    upgrade: [/höherstufen/i, /hochstufen/i, /aufwerten auf/i],
    free: [/kostenlos/i, /\bgratis/i, /umsonst/i],
    premium: [/premium/i, /\bprofi/i],
    // THE ROUND-6 PLANT: "Wechseln Sie jetzt zur kostenpflichtigen
    // Vollversion." `kostenpflichtig` is "subject to a charge" and a works
    // never says it; `Vollversion`/`Bezahlversion` are the software-upsell
    // words. Bare `Kosten` is absent on purpose — a shop talks about costs.
    "paid-version": [/kostenpflichtig/i, /vollversion/i, /bezahlversion/i],
  },
  "fr-FR": {
    // `tarif` alone is French for "rate" and is legitimate on a delivery page.
    pricing: [/tarification/i, /grille tarifaire/i],
    plan: [/forfait/i, /abonnement/i],
    // NEVER bare `palier`: it is the French for a quantity BREAK, and the
    // works' own price page is headed "Paliers de quantité". English calls
    // those "breaks" and does not ban the word either.
    tier: [/palier tarifaire/i, /niveau tarifaire/i],
    billing: [/facturation/i],
    upgrade: [/mise à niveau/i, /surclassement/i, /passer à l'offre/i],
    free: [/gratuit/i],
    premium: [/premium/i],
    // `payant` qualifies a THING that costs; a works quotes prices without it.
    "paid-version": [/version payante/i, /version complète/i, /offre payante/i],
  },
  "cs-CZ": {
    // `ceník` is an ordinary price list and a works has one; `cenový plán` is
    // the commercial idea.
    pricing: [/cenový plán/i, /cenová politika/i],
    plan: [/\btarif/i, /předplatn/i],
    tier: [/cenová hladina/i, /\btarif/i],
    billing: [/fakturace/i, /vyúčtování/i],
    upgrade: [/povýšit na/i, /vyšší tarif/i],
    free: [/zdarma/i, /zadarmo/i, /bezplatn/i],
    premium: [/prémiov/i, /profesion\u00e1l/i],
    // `placená verze` / `plná verze`. `\S*` rather than `\w*`: Czech endings
    // are accented and `\w` is ASCII, so `plná verze` slipped a `\w*` pattern.
    "paid-version": [/placen\S*\s+verz/i, /pln\S*\s+verz/i],
  },
  "da-DK": {
    // `prisliste` is an ordinary price list; `prisplan`/`prismodel` are not.
    pricing: [/prisplan/i, /prismodel/i],
    plan: [/abonnement/i],
    tier: [/prisniveau/i, /pristrin/i],
    billing: [/fakturering/i, /betalingsplan/i],
    // Danish borrows "upgrade" as `opgradering`, which the substring ban does
    // NOT see — `opgrader` is not `upgrade`.
    upgrade: [/opgrader/i],
    free: [/\bgratis/i, /vederlagsfri/i],
    premium: [/premium/i],
    "paid-version": [/betalingsversion/i, /betalt version/i, /fuld version/i],
  },
  "zh-CN": {
    pricing: [/定价/, /价格方案/],
    plan: [/套餐/, /订阅/],
    // NEVER bare `档位`: the delivery copy says 档位由我们替您选好 of the weight
    // bracket a parcel falls into, which is a bracket and not a plan.
    tier: [/价格档/, /套餐档/],
    billing: [/账单/, /计费/],
    upgrade: [/升级/],
    free: [/免费/],
    premium: [/高级版/, /专业版/],
    "paid-version": [/付费版/, /完整版/],
  },
  "zh-TW": {
    pricing: [/定價/, /價格方案/],
    plan: [/方案/, /訂閱/],
    // NEVER bare `級距`, for the same reason as zh-CN's 档位.
    tier: [/價格級/, /方案級/],
    billing: [/帳單/, /計費/],
    upgrade: [/升級/],
    free: [/免費/],
    premium: [/高級版/, /專業版/],
    "paid-version": [/付費版/, /完整版/],
  },
  "ar-EG": {
    pricing: [/التسعير/, /تسعير/],
    // `باقة` — the plant's word for a package a shop pays for.
    plan: [/باقة/, /الباقة/, /اشتراك/],
    tier: [/فئة سعرية/, /مستوى سعري/],
    billing: [/فوترة/, /الفوترة/],
    // `ترقية` — the plant's word for "upgrade".
    upgrade: [/ترقية/],
    free: [/مجان/],
    premium: [/احترافي/, /مميز/],
    // THE OTHER ROUND-6 PLANT: "انتقل إلى النسخة المدفوعة …". The PHRASE, never bare
    // مدفوع — a shop's own confirm screen says المدفوع of an order.
    "paid-version": [
      /النسخة المدفوعة/,
      /نسخة مدفوعة/,
      /الإصدار المدفوع/,
      /النسخة الكاملة/,
    ],
  },
};

/**
 * The per-locale view the message-bundle suites want.
 *
 * `en-US` is the English substring ban's own job, so its only entry is the pair
 * D12 adds on top: `premium` is not in 17 §2's run of substrings.
 */
export const TIERING_WORDS: Record<string, RegExp[]> = {
  /*
   * `\bpro\b` is here and is NOT in the hosts' copy, on purpose. A host runs a
   * standalone-token check of its own with `PRO_PHRASES` carved out — Czech's
   * "pro kterou" is a preposition — and putting the pattern here as well would
   * step around those carve-outs. An add-on's bundle has no such check, so this
   * is where its English "Pro" is caught.
   */
  /*
   * English's own cell, which is NOT empty and used to be nearly so. 17 §2's
   * substring run covers `pricing plan tier billing upgrade free /mo` and D12
   * adds `premium`; none of them appears in "switch to the paid version for
   * more", which is the round-6 plant written in English. The hole was in every
   * language including this one.
   */
  "en-US": [/premium/i, /\bpro\b/i, /paid version/i, /full version/i, /paid account/i],
  ...Object.fromEntries(
    OTHER_LANGUAGES.map((language) => [
      language,
      BANNED_IDEAS.flatMap((idea) => IDEA_IN_LANGUAGE[language][idea]),
    ]),
  ),
};

