/**
 * NO ADD-ON DESCRIBES ONE HOST'S WORKFLOW IN ITS OWN VOICE.
 *
 * ── THE DEFECT, AS IT WAS FOUND ─────────────────────────────────────────────
 *
 * D21's claim is that a slot id names a SURFACE rather than an app, and the
 * repo goes to some trouble to keep the TYPES honest about that: the payload
 * registry is shared, the mirror is guarded, `job.dispatch.actions` was renamed.
 * None of that reaches the WORDS, and the words are what a shop owner reads.
 *
 * Design Studio's settings panel, mounted in Birch Row — two people, a laser
 * and a kiln — said "The works checks it like any other job before it goes on a
 * press" and "Designs made here go straight to prepress". Both sentences are
 * true of Marlow Press and of nowhere else. The German and Czech copy went
 * further and named the shop by trade outright (`Druckerei`, `tiskárna`), and
 * the Arabic said `المطبعة` — the printing house — in four separate strings.
 * Nothing was red, because a translated sentence is data to every other gate in
 * this repo.
 *
 * ── WHY THE LIST IS ONE-SIDED, WHICH IS A DECISION AND NOT AN OVERSIGHT ─────
 *
 * There is no matching ban on the personalizer's `laser`, `timber` or `cut`.
 * The distinction is whose process the sentence is about:
 *
 *   AN ADD-ON MAY DESCRIBE ITS OWN OUTPUT. "Send it to your laser the way you
 *   always do" is the Live Personalizer saying what the file it produces is for.
 *   That is the product describing itself, in the shop's language or not, and it
 *   is the same sentence in every host that mounts it.
 *
 *   AN ADD-ON MAY NOT DESCRIBE THE HOST'S. "The works checks it before it goes
 *   on a press" is a claim about how the SHOP runs, written by somebody who has
 *   seen one shop. It is false in the second host by construction, and there is
 *   no version of it an add-on could know.
 *
 * So what is banned is the vocabulary of one trade's internal workflow, in all
 * eight languages, and the neutral replacements are the ones the copy now uses:
 * "the shop", "an order", "before anything is made", "goes straight to making".
 *
 * ── IT READS TEXT ───────────────────────────────────────────────────────────
 *
 * `packages/host` cannot import an add-on — the dependency runs the other way —
 * so it reads each bundle as a file, the way `host-mirror.test.ts` reads the
 * hosts'. The strings are literals and the ban is on literals, so there is
 * nothing a parser would add.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THIS GATE IS INCOMPLETE, AND CANNOT BE MADE COMPLETE. READ THIS BEFORE YOU
 * TRUST A GREEN RUN.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `ONE_SHOP_WORDS` is a list of about twenty-five phrases. It catches host-
 * specific prose written in a vocabulary somebody has already thought of, and
 * NOTHING ELSE. A verifier rewrote one Design Studio line to
 *
 *     "The guillotine trims it after the litho run and the bindery folds it."
 *
 * — a sentence about a print works' internal process, in an add-on that renders
 * unchanged on a maker studio's shelf, describing three machines a maker studio
 * does not own — and this file stayed green. It is the third time this list has
 * been beaten in its own history, and every previous repair was to add the
 * words that beat it, which produces a longer list with the same hole.
 *
 * ── WHY IT CANNOT BE A RULE, WHICH IS A PROPERTY OF THE SUBJECT ─────────────
 *
 * The other guards in this wave were fingerprints that could be turned into
 * rules because the category had a structural definition: an outbound request
 * needs an address and a sink; a quantity opens with its figure; a mount is a
 * mount because React called it. D21's line has no structural definition at
 * all. It divides sentences by WHOSE PROCESS THEY DESCRIBE, and both sides of
 * that line are ordinary English about making things:
 *
 *     "Send it to your laser the way you always do"   — the add-on's own
 *                                                       output. Fine.
 *     "The guillotine trims it after the litho run"   — the HOST's workflow.
 *                                                       Forbidden.
 *
 * Nothing in the letters tells them apart. Both name a machine, both are true
 * of some shop, and which one is a defect depends on whether the sentence is a
 * claim about the app the add-on happens to be installed in. A machine cannot
 * decide that, and a list that pretends to is worse than an honest gap, because
 * a green run reads as a clearance.
 *
 * ── SO WHAT THIS FILE ACTUALLY PROMISES ─────────────────────────────────────
 *
 * The list is a REGRESSION SET, not a rule. Every entry is a phrase that
 * reached a screen once. A green run means: none of the specific sentences this
 * repo has already got wrong has come back. It does not mean the copy is
 * app-neutral.
 *
 * TWO OTHER GATES IN THIS FILE ARE RULES, and they carry what can be carried:
 * `HOST_IDENTITY` below is complete over the thing it names (a host's shop,
 * town or reference prefix is a closed set — there are two hosts), and the
 * ledger at the foot is complete over CHANGE (no user-visible string enters or
 * changes, IN ANY OF THE EIGHT LOCALES, without somebody reviewing it — see its
 * own header for why it stopped fingerprinting the English alone).
 *
 * ── WHAT A REVIEWER MUST DO, BECAUSE NO SUITE WILL DO IT ───────────────────
 *
 * When the ledger below fails on a new or changed string, read the sentence and
 * ask ONE question:
 *
 *     Is this a claim about how the SHOP works, or about what the ADD-ON does?
 *
 * A claim about the shop — what happens to the job after it leaves this screen,
 * what machine it goes on, who checks it, what the shop calls its own steps —
 * is a defect however it is worded, because the add-on is installed in a second
 * shop where it is false and the add-on cannot know which. Rewrite it as what
 * the add-on does, or hand it to the host through the payload (`hostSays` is
 * how the personalizer does exactly this).
 *
 * If the sentence you rejected used a word that is not in `ONE_SHOP_WORDS`, add
 * it — not because that closes the hole, but because the regression set is only
 * worth what has been put into it.
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const PACKAGES = fileURLToPath(new URL('../..', import.meta.url));

/**
 * One shop's trade, or one shop's internal step, in the languages this repo
 * ships. Each entry says what it names and what to write instead.
 */
const ONE_SHOP_WORDS: readonly { pattern: RegExp; means: string; instead: string }[] = [
  { pattern: /\bthe works\b/i, means: 'English, a print works — the host, named by trade', instead: 'the shop' },
  { pattern: /\bprepress\b/i, means: 'English, the step before a printing press runs', instead: 'making' },
  { pattern: /\bon a press\b/i, means: 'English, the press a print works owns', instead: 'before anything is made' },
  { pattern: /Druckerei/i, means: 'German, a printing house', instead: 'Werkstatt' },
  { pattern: /Druckvorstufe/i, means: 'German, prepress', instead: 'Fertigung' },
  { pattern: /Andruck/i, means: 'German, a press proof', instead: 'Freigabe' },
  { pattern: /pr[ée]presse/i, means: 'French, prepress', instead: 'fabrication' },
  { pattern: /bon à tirer/i, means: 'French, a press proof — the phrase is the press', instead: 'validation' },
  { pattern: /mise en machine/i, means: 'French, putting a job on the press', instead: 'fabrication' },
  { pattern: /tiskárn/i, means: 'Czech, a print shop', instead: 'dílna' },
  { pattern: /předtiskov/i, means: 'Czech, prepress', instead: 'výroba' },
  { pattern: /nátisk/i, means: 'Czech, a press proof', instead: 'náhled ke schválení' },
  { pattern: /prøvetryk/i, means: 'Danish, a press proof', instead: 'en prøve' },
  { pattern: /trykkeri/i, means: 'Danish, a printing house', instead: 'værkstedet' },
  { pattern: /印前/, means: 'Chinese, prepress', instead: '制作 / 製作' },
  /*
   * 付印前 — "before it goes to press" — and NOT 付印 on its own, which is the
   * same distinction the header draws in English. 可直接付印的 PDF is the name of
   * an ARTEFACT, the press-ready file an artwork surface exists to receive, and
   * it is the same file in every shop that takes one. 付印前 is a claim about
   * WHEN the shop looks at it, which only one shop can make.
   */
  { pattern: /付印前/, means: 'Chinese, the step before a press runs', instead: '开工前 / 開工前' },
  { pattern: /打样|打樣/, means: 'Chinese, a press proof', instead: '看样 / 看樣' },
  { pattern: /المطبعة/, means: 'Arabic, the printing house', instead: 'الورشة' },
  { pattern: /ما قبل الطبع/, means: 'Arabic, prepress', instead: 'التنفيذ' },
  /*
   * ── THE NEUTRALISATION THAT ONLY HAPPENED IN ENGLISH ────────────────────
   *
   * [Added 2026-08-11, wave 4b round 3.] `addon.design-studio.line` was
   * rewritten to "A small artwork editor inside your site." and left as a
   * PRINT artwork editor in five of the eight locales — German
   * `Druckvorlagen-Editor`, French `éditeur de fichiers d'impression`, Czech
   * `editor tiskových podkladů`, both Chinese `印刷稿编辑器` — and the German
   * disconnect line still put the shop's "Design it here" button on the
   * `Druckdatenseite`. The English string is not the app: seven eighths of the
   * readers of that shelf row were being told it edits print artwork, in an
   * add-on whose whole claim is that it runs in a shop that prints nothing.
   *
   * These are the WORD FOR ONE TRADE'S ARTEFACT, and they are banned the same
   * way its steps are. What is NOT banned, here as in the 付印前 note above, is
   * the name of a print-ready PDF — `PDF prêt à imprimer`, `trykklar PDF`,
   * `PDF připravené k tisku` — because that is a FILE a customer may be asked
   * to send, and it is the same file whoever receives it.
   */
  { pattern: /Druckvorlage/i, means: 'German, print artwork', instead: 'Gestaltung' },
  { pattern: /Druckdaten/i, means: 'German, print data', instead: 'Gestaltung' },
  {
    pattern: /fichiers d['’]impression/i,
    means: 'French, print files',
    instead: 'visuels / fichiers',
  },
  {
    pattern: /tiskov\w* (podklad|dat)/i,
    means: 'Czech, print artwork or print data',
    instead: 'grafika / podklady',
  },
  // `trykfil` — a print file. NOT `trykklar`, which is the Danish for the same
  // press-ready PDF the French and Czech lines are allowed to name.
  { pattern: /trykfil/i, means: 'Danish, print files', instead: 'materialesiden' },
  {
    pattern: /印刷稿|印刷文件|印刷檔案/,
    means: 'Chinese, print artwork or print files',
    instead: '图稿 / 圖稿 / 稿件',
  },
  { pattern: /ملفات الطباعة/, means: 'Arabic, print files', instead: 'ملفات التصميم' },
  // The two demo shops by name. An add-on that says one of these out loud is
  // wrong in the other host and wrong in every host after them.
  { pattern: /Marlow Press/i, means: 'the first host shop, by name', instead: 'the shop' },
  { pattern: /Birch Row/i, means: 'the second host shop, by name', instead: 'the shop' },
];

/** Each add-on's user-visible bundle, as text. */
function bundles(): { pkg: string; text: string }[] {
  return readdirSync(PACKAGES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ pkg: entry.name, file: join(PACKAGES, entry.name, 'src/i18n/strings.ts') }))
    .filter((entry) => existsSync(entry.file))
    .map((entry) => ({ pkg: entry.pkg, text: readFileSync(entry.file, 'utf8') }));
}

/**
 * The string literals alone. A comment explaining the ban must be able to quote
 * the banned word — this file does, one directory over — without the gate
 * reading its own reasoning as an offence.
 */
function literals(source: string): string[] {
  return [...source.matchAll(/^\s*['"][\w.-]+['"]:\s*$|^\s*(?:['"][\w.-]+['"]:\s*)?(["'])((?:[^\\]|\\.)*?)\1,?\s*$/gm)]
    .map((match) => match[2] ?? '')
    .filter((value) => value.length > 0);
}

describe('an add-on’s own words are app-neutral (D21) — REGRESSION SET ONLY', () => {
  /*
   * SEE THE HEADER. This case cannot fail for a sentence nobody has written
   * before, and a green run here is not a clearance. The ledger at the foot of
   * this file is the part that is complete, and a human reading a diff is the
   * part that decides.
   */
  it.each(bundles())('$pkg repeats none of the host-specific phrases already found', ({ text }) => {
    const copy = literals(text);
    expect(copy.length, 'no strings were parsed out of the bundle at all').toBeGreaterThan(50);

    const offences: string[] = [];
    for (const line of copy) {
      for (const banned of ONE_SHOP_WORDS) {
        if (banned.pattern.test(line)) {
          offences.push(`${banned.means} — write ${banned.instead} instead:\n    ${line}`);
        }
      }
    }
    expect(offences, `\n${offences.join('\n')}\n`).toEqual([]);
  });
});

/**
 * A HOST'S IDENTITY IS NOT COPY, WHICH IS EXACTLY WHY IT GOT THROUGH.
 *
 * ── THE DEFECT ──────────────────────────────────────────────────────────────
 *
 * Canva Import's demo transport held `DEMO_ACCOUNT = "studio@marlowpress.test"`
 * — the FIRST host's shop, hard-coded in an add-on, rendered on the SECOND
 * host's Add-ons drawer as "studio@marlowpress.test · authorized Aug 1", in the
 * quiet grey card a genuine connection uses, in eight languages. The DHL demo
 * carrier's fallback origin held `city: "Marlow"`, and a switch on the settings
 * panel was enough to put it into a maker studio's tracking scans.
 *
 * Neither is a translated sentence, so the check above never looked at it:
 * `bundles()` reads `src/i18n/strings.ts` and nothing else. Neither is a host
 * fact crossing the seam, so the payload guards never looked at it either. A
 * shop's name reached a screen through the one door with nothing on it.
 *
 * ── SO THIS ONE READS EVERY SHIPPED SOURCE, NOT THE COPY FILE ───────────────
 *
 * String literals from every `.ts`/`.tsx` an add-on ships — comments stripped
 * first, so the paragraph you are reading, which has to be able to name the
 * shops, is not itself an offence. Tests and `src/testing/` are excluded: a
 * fixture may say `MP-4127`, because a fixture is how you check that a host's
 * own reference survives a round trip, and nothing there reaches a reader.
 *
 * WHAT IT LOOKS FOR is the two demo shops in every spelling a value can take —
 * with a space, without one, as an e-mail domain — their towns, and their order
 * reference prefixes. An add-on that needs one of these needs it from the host.
 */
const HOST_IDENTITY: readonly { pattern: RegExp; means: string }[] = [
  { pattern: /marlow/i, means: 'the first host shop or its town (Marlow Press, Marlow)' },
  { pattern: /birch\s*row/i, means: 'the second host shop (Birch Row)' },
  { pattern: /saltburn/i, means: 'the second host shop’s town (Saltburn)' },
  { pattern: /castleton/i, means: 'the town the second host’s demo parcel goes to' },
  { pattern: /\bMP-\d{3,}\b/, means: 'a Marlow Press job reference' },
  { pattern: /\bBR-\d{3,}\b/, means: 'a Birch Row order reference' },
];

/** Every source an add-on SHIPS: no suites, no `testing/` harness. */
function shipped(pkg: string): { file: string; text: string }[] {
  const root = join(PACKAGES, pkg, 'src');
  const out: { file: string; text: string }[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'testing') walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) continue;
      out.push({ file: full.slice(root.length + 1), text: readFileSync(full, 'utf8') });
    }
  };
  walk(root);
  return out;
}

/** Every quoted run in a source, with comments removed first. */
function allLiterals(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
  return [...code.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)].map((m) => m[2]!);
}

describe('no add-on hard-codes a host’s identity (D21)', () => {
  it.each(bundles())('$pkg names no shop, town or reference of any host', ({ pkg }) => {
    const files = shipped(pkg);
    // The guard has to have READ something, or an empty result reads as a pass.
    expect(files.length, `no shipped sources found for ${pkg}`).toBeGreaterThan(3);

    const offences: string[] = [];
    let seen = 0;
    for (const { file, text } of files) {
      for (const value of allLiterals(text)) {
        seen += 1;
        for (const banned of HOST_IDENTITY) {
          if (banned.pattern.test(value)) {
            offences.push(`${file} — ${banned.means}:\n    ${value}`);
          }
        }
      }
    }
    expect(seen, `no string literals were parsed out of ${pkg} at all`).toBeGreaterThan(50);
    expect(offences, `\n${offences.join('\n')}\n`).toEqual([]);
  });
});

/**
 * ══════════════════════════════════════════════════════════════════════════
 * THE LEDGER: NO COPY ENTERS OR CHANGES, IN ANY LANGUAGE, WITHOUT SOMEBODY
 * READING IT.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * The header says plainly that `ONE_SHOP_WORDS` is a regression set and cannot
 * be made complete: D21's line divides sentences by whose process they describe
 * and nothing in the letters tells the two sides apart. The same is true, and
 * with a far worse consequence, of the tiering question 17 asks — v1 ships free
 * of charge and must never raise the subject of paying, in any language — which
 * `testing/tiering.ts` answers with a hand-written table of stems per language
 * and says, in its own header, that it is a regression set too.
 *
 * A gate that cannot judge the words should not imply that it has. What CAN be
 * made complete is a gate over CHANGE, and this is it:
 *
 *     every user-visible string in every add-on is fingerprinted here, in all
 *     eight locales, key by key, and any addition, edit or removal fails until
 *     a reviewer has read the keys it names
 *
 * It decides nothing about the copy. Its whole job is to make sure the
 * judgement the header describes actually happens — that a new sentence cannot
 * reach eight locales and two hosts because it happened to use a vocabulary
 * nobody had thought to ban.
 *
 * ── WHY IT IS ALL EIGHT LOCALES AND NOT THE ENGLISH ────────────────────────
 *
 * [Widened 2026-08-11, wave 4b round 7. It fingerprinted the `en-US` block of
 * each package and nothing else, on the reasoning that the neutrality question
 * is about the SENTENCE rather than about eight spellings of it.]
 *
 * That reasoning was right about D21 and wrong about everything else this
 * ledger is the compensating mechanism for. A verifier planted one plausible
 * tiering sentence in each of the seven non-English blocks of
 * `addon.personalizer.noAccount` — a line that renders on the shelf card, in
 * the manage drawer and beside every surface the add-on fills — and all three
 * repositories stayed green: the English had not moved, so the ledger had
 * nothing to say, and the stem tables had never been given those words.
 *
 * A translator's sentence is the shape with the least English-language
 * oversight and the most direct release consequence. It is now the shape this
 * file is built around: the fingerprint of a key is over its value in all eight
 * locales, so a single word moving in one of them is a named failure.
 *
 * ── AND WHY PER KEY RATHER THAN PER PACKAGE ────────────────────────────────
 *
 * Because the failure has to say what to read. One hash per bundle goes red on
 * every copy edit and tells a reviewer nothing about which sentence moved,
 * which trains everybody to re-run with `UPDATE_COPY_LEDGER=1` without looking
 * — the failure mode that makes a ratchet worse than nothing.
 *
 * ── HOW TO CLEAR A FAILURE, WHICH IS THE POINT OF THE FAILURE ──────────────
 *
 *   1. Read the diff to the add-on's `i18n/strings.ts` for the keys named
 *      below — EVERY language, not only the English.
 *   2. Of each new or changed sentence ask three questions, none of which any
 *      suite in this repo can ask:
 *        · Does it tell a reader that something costs money, or that more of
 *          the product can be had by paying, in any words at all? v1 is free of
 *          charge and may not raise the subject (17 §2). If yes, it does not
 *          ship.
 *        · Is it a claim about how the SHOP works rather than about what the
 *          ADD-ON does? See the header — that is D21's line, and an add-on
 *          installed in a second shop makes such a claim false by construction.
 *        · Does it name a real company as anything other than not affiliated
 *          (AC6)?
 *   3. Only then re-run with `UPDATE_COPY_LEDGER=1`, which rewrites
 *      `reviewed-copy.json` in place, and commit it beside the strings.
 *
 * Updating without step 2 is the one way to make this worthless, and it is the
 * same cost as any ratchet: it is only as good as the reading it forces.
 *
 * ── THE HOSTS DO NOT FINGERPRINT THIS COPY AGAIN, ON PURPOSE ───────────────
 *
 * Both hosts carry a ledger of the same shape (`src/i18n/reviewedCopy.test.ts`)
 * over the areas THEY author, and neither covers the add-on strings they
 * vendor. That is not a hole: a vendored file is byte-identical to the one
 * here or `scripts/sync-add-ons.sh status` is red, so there is exactly one
 * place an add-on's sentence can be written and exactly one ledger that has to
 * be cleared to write it. Fingerprinting it twice would mean vendoring an
 * add-on turned a host's ledger red — the host-holds-an-add-on's-fact defect
 * this wave has now found five times.
 *
 * ── HOW A BUNDLE IS FOUND: BY SHAPE, AND IT FAILS CLOSED ───────────────────
 *
 * The modules are imported rather than parsed. The first draft of this ledger
 * read the source TEXT and brace-matched `"en-US": {`, which matched inside a
 * comment in two of the four packages and fingerprinted a two-line example —
 * green, and about nothing. Values are what a reader reads, so values are what
 * is hashed.
 *
 * The export is found by SHAPE — an object with all eight locale tags, each an
 * object of strings — and not by name, because the four packages call theirs
 * `designStudioStrings`, `importCanvaStrings`, `personalizerStrings` and
 * `strings`, and a list of four names is a guard fitted to the four packages
 * its author had open. A package whose bundle cannot be found, or which has two
 * things that look like one, FAILS: a ledger that quietly stops covering a
 * bundle is the hole this closes.
 */

/** The eight locales every add-on in this repo ships, in a fixed order. */
const LOCALES = ['en-US', 'de-DE', 'fr-FR', 'cs-CZ', 'da-DK', 'zh-CN', 'zh-TW', 'ar-EG'] as const;

const LEDGER = fileURLToPath(new URL('./reviewed-copy.json', import.meta.url));

const fingerprint = (text: string): string =>
  createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16);

/**
 * Every add-on's string module, imported. The glob is over the sibling packages
 * — `packages/host` cannot IMPORT an add-on as a dependency, and does not: this
 * is a test reading data files that happen to be TypeScript.
 */
const STRING_MODULES = import.meta.glob<Record<string, unknown>>('../../*/src/i18n/strings.ts', {
  eager: true,
});

type Bundle = Record<string, Record<string, unknown>>;

/** `{ locale: { key: value } }` over all eight locales, or not a bundle. */
function asBundle(value: unknown): Bundle | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  for (const locale of LOCALES) {
    const block = record[locale];
    if (typeof block !== 'object' || block === null || Array.isArray(block)) return null;
    // A locale block is hundreds of strings. Anything tiny is an example in a
    // comment or a lookup table, and a fingerprint of one of those is a green
    // run about nothing.
    if (Object.keys(block as object).length < 10) return null;
  }
  return record as Bundle;
}

/** Each package, and the one export in it shaped like a string bundle. */
function stringBundles(): { pkg: string; bundle: Bundle | null; found: number }[] {
  return Object.entries(STRING_MODULES)
    .map(([path, module]) => {
      const pkg = /\.\.\/\.\.\/([^/]+)\//.exec(path)?.[1] ?? path;
      const found = Object.values(module)
        .map(asBundle)
        .filter((bundle): bundle is Bundle => bundle !== null);
      return { pkg, bundle: found.length === 1 ? (found[0] as Bundle) : null, found: found.length };
    })
    .sort((a, b) => (a.pkg < b.pkg ? -1 : 1));
}

/**
 * key → one fingerprint over that key's value in every locale.
 *
 * A key missing from a locale hashes differently from one that is present and
 * empty, which is the honest reading: both are things a reviewer should see.
 */
function copyOf(bundle: Bundle): Record<string, string> {
  const keys = new Set<string>();
  for (const locale of LOCALES) {
    for (const key of Object.keys(bundle[locale] ?? {})) keys.add(key);
  }
  const out: Record<string, string> = {};
  for (const key of [...keys].sort()) {
    const parts = LOCALES.map((locale) => {
      const value = bundle[locale]?.[key];
      return `${locale} ${value === undefined ? 'NOT TRANSLATED' : String(value)}`;
    });
    out[key] = fingerprint(parts.join(''));
  }
  return out;
}

describe('no add-on copy changes in any language without a reviewer looking at it', () => {
  const read = stringBundles();
  const current: Record<string, Record<string, string>> = {};
  for (const { pkg, bundle } of read) {
    if (bundle !== null) current[pkg] = copyOf(bundle);
  }

  it.each(read)('$pkg exports one bundle this can read', ({ pkg, bundle, found }) => {
    expect(
      bundle,
      `${pkg}/src/i18n/strings.ts: ${found} exports look like a bundle of eight locales, ` +
        'and exactly one must. See the header — this fails rather than skipping.',
    ).not.toBeNull();
  });

  it('covers every package that ships a string bundle', () => {
    // The guard-the-guard case, and the one that matters most: a glob that
    // stopped matching a directory, or a package added tomorrow, must not be
    // silently outside the ledger. `bundles()` finds them by reading the
    // packages directory, which is a different mechanism from the glob.
    expect(Object.keys(current).sort()).toEqual(
      bundles()
        .map((bundle) => bundle.pkg)
        .sort(),
    );
    expect(Object.keys(current).length).toBeGreaterThan(3);
  });

  it('reads all eight locales of a real bundle, package by package', () => {
    for (const [pkg, keys] of Object.entries(current)) {
      expect(Object.keys(keys).length, `${pkg} contributed almost no keys`).toBeGreaterThan(30);
    }
    expect(LOCALES.length).toBe(8);
    const total = Object.values(current).reduce((sum, keys) => sum + Object.keys(keys).length, 0);
    expect(total, 'the whole ledger is nearly empty').toBeGreaterThan(300);
  });

  it('reads four different bundles, not one thing four times', () => {
    // Every key is namespaced under `addon.<package>.`, so two packages sharing
    // one means the same module was read twice — which is how the first draft's
    // defect was found, when two packages fingerprinted alike.
    const owner = new Map<string, string>();
    const shared: string[] = [];
    for (const [pkg, keys] of Object.entries(current)) {
      for (const key of Object.keys(keys)) {
        const already = owner.get(key);
        if (already !== undefined) shared.push(`${key}: in ${already} and ${pkg}`);
        else owner.set(key, pkg);
      }
    }
    expect(shared).toEqual([]);
  });

  it('matches the reviewed ledger, key for key, in every language', () => {
    if (process.env['UPDATE_COPY_LEDGER'] === '1') {
      const sorted = Object.fromEntries(
        Object.entries(current)
          .sort(([a], [b]) => (a < b ? -1 : 1))
          .map(([pkg, keys]) => [
            pkg,
            Object.fromEntries(Object.entries(keys).sort(([a], [b]) => (a < b ? -1 : 1))),
          ]),
      );
      writeFileSync(LEDGER, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
      return;
    }

    expect(existsSync(LEDGER), `${LEDGER} is missing`).toBe(true);
    const reviewed = JSON.parse(readFileSync(LEDGER, 'utf8')) as Record<
      string,
      Record<string, string>
    >;

    const report: string[] = [];
    for (const [pkg, keys] of Object.entries(current)) {
      const before = reviewed[pkg] ?? {};
      for (const [key, hash] of Object.entries(keys)) {
        if (before[key] === undefined) report.push(`  NEW      ${pkg}  ${key}`);
        else if (before[key] !== hash) report.push(`  CHANGED  ${pkg}  ${key}`);
      }
      for (const key of Object.keys(before)) {
        if (keys[key] === undefined) report.push(`  GONE     ${pkg}  ${key}`);
      }
    }
    for (const pkg of Object.keys(reviewed)) {
      if (current[pkg] === undefined) report.push(`  GONE     ${pkg}  (the whole package)`);
    }

    expect(
      report,
      '\nCopy moved. Read these keys in EVERY language — the fingerprint is over\n' +
        'all eight locales, so a sentence that changed only in German or only in\n' +
        'Arabic is one of the lines below. Then ask of each: does it raise the\n' +
        'subject of paying (17 §2), does it describe the SHOP rather than the\n' +
        'ADD-ON (D21), does it name a company as anything but not affiliated\n' +
        '(AC6)? The stem tables in testing/tiering.ts are a regression set and\n' +
        'will not ask for you.\n\n' +
        report.join('\n') +
        '\n\nWhen you have read them: UPDATE_COPY_LEDGER=1 npm test -w @adminium/add-on-host\n',
    ).toEqual([]);
  });

  it('keeps a ledger that is worth comparing against', () => {
    const reviewed = JSON.parse(readFileSync(LEDGER, 'utf8')) as Record<
      string,
      Record<string, string>
    >;
    const entries = Object.values(reviewed).flatMap((keys) => Object.entries(keys));
    expect(entries.length, 'the ledger is empty or nearly so').toBeGreaterThan(300);
    // Every value is a real fingerprint, so a file of nulls cannot pass.
    expect(entries.filter(([, hash]) => !/^[0-9a-f]{16}$/.test(hash)).map(([key]) => key)).toEqual(
      [],
    );
  });

  it('moves when one word moves in one language that is not English', () => {
    /*
     * The case that says what this file is for. The round-7 plant changed no
     * English at all: it put a tiering sentence into the seven translations of
     * one key, and the ledger this replaces hashed the `en-US` block alone.
     */
    const base: Bundle = Object.fromEntries(
      LOCALES.map((locale) => [locale, { 'addon.x.line': 'It needs no account anywhere.' }]),
    );
    const planted: Bundle = {
      ...base,
      'de-DE': { 'addon.x.line': 'Wechseln Sie jetzt zur kostenpflichtigen Vollversion.' },
    };
    expect(copyOf(planted)['addon.x.line']).not.toBe(copyOf(base)['addon.x.line']);

    // …and a key that did not move keeps its fingerprint, or every run would
    // name every key and the report would be noise.
    const untouched: Bundle = Object.fromEntries(
      LOCALES.map((locale) => [locale, { 'addon.x.line': 'It needs no account anywhere.', 'addon.x.other': 'A' }]),
    );
    expect(copyOf(untouched)['addon.x.line']).toBe(copyOf(base)['addon.x.line']);
  });
});
