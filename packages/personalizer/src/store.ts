/**
 * WHERE A SHOPPER'S CHOICES LIVE BETWEEN THE PIECE'S PAGE AND THE BASKET.
 *
 * The host owns the basket. What it stores per line is a piece, a size, a
 * finish, a quantity and THE SHOPPER'S OWN WORDS — a plain string, because that
 * is what a shop with no add-on connected has and what its empty state is built
 * around (24 D19). A host that had to grow a `personalization` column the
 * moment an add-on arrived would be a host that knows which add-ons exist.
 *
 * So the words stay the host's and the rest is ours, and the two are joined by
 * a key derived from BOTH: the piece and the words. That is not a hack, it is
 * the same content-addressing the picture store uses one file over — two basket
 * lines carrying the same words on the same piece ARE the same personalization,
 * and there is no state to keep in step because there is no identity to lose.
 *
 * What it costs: two lines of the same piece with the same words and different
 * fonts collapse into one. In a shop where the words are a family name and a
 * date that is the right trade; in one where it is not, the host has a column
 * to add and this module has a `lineId` to take instead. The seam does not
 * move.
 */

import type { Personalization, Template } from '@adminium/add-on-host/contracts';

import { templateFor } from './seed.ts';
import { check } from './template.ts';

const chosen = new Map<string, Personalization>();

/**
 * The key: the piece and the words, which is what makes two lines the same.
 *
 * The separator is a NUL because it is the one character a product key and a
 * shopper's words cannot contain, so no pair of fields can spell another pair's
 * key — `"a b" + "c"` and `"a" + "b c"` are one key under a space and two under
 * this. It is written as an ESCAPE and must stay one: it was a raw NUL byte in
 * the file until 2026-08-12, which made every tool that sniffs for binary skip
 * the module — `file` called it data and `grep` matched nothing in it, silently,
 * including the greps a reviewer runs by hand.
 */
function keyOf(productKey: string, words: string): string {
  return `${productKey}\x00${words}`;
}

/**
 * The shopper's words, in the order the maker drew the areas, in the shopper's
 * own text.
 *
 * This is what the host stores in its own note field, so a basket line reads
 * the same whether or not this add-on is connected — and, when it is
 * disconnected, the words the customer asked for are still on the order in
 * plain language rather than inside a picture nobody can open (D16).
 */
export function summarize(p: Personalization): string {
  const template = templateFor(p.templateId);
  if (template === undefined) return '';
  return template.zones
    .map((zone) => (p.values[zone.id] ?? '').trim())
    .filter((value) => value !== '')
    .join(' · ');
}

/** Remember what a shopper chose, and hand back the words the host will store. */
export function remember(p: Personalization): string {
  const words = summarize(p);
  chosen.set(keyOf(p.templateId, words), p);
  return words;
}

/** What a basket or order line's words resolve to, if this add-on drew them. */
export function recall(productKey: string, words: string): Personalization | undefined {
  return chosen.get(keyOf(productKey, words.trim()));
}

/** Everything a shopper has configured — what a disconnect would keep (D16). */
export function rememberedCount(): number {
  return chosen.size;
}

/**
 * The personalizations that are on a REAL LINE of the host's — a basket line,
 * an order line, a proof — as opposed to every wording anybody has typed.
 *
 * ── WHY IT IS A SECOND MAP AND NOT JUST `chosen` ───────────────────────────
 *
 * `commit` files a picture on every keystroke that leaves the piece makeable,
 * and it has to: `recall` keys a personalization by the shopper's words, so a
 * basket line can only find its picture if the picture was filed under exactly
 * the words the line ended up carrying. The cost is that `chosen` also holds
 * every makeable PREFIX — "The Hartleys" on the way to "The Hartleys · est.
 * 2019" — which is right for a lookup and wrong for a list.
 *
 * The bench sheet is a list, and a maker reading four rows where two pieces are
 * being cut would trust it once and never again. So the sheet reads this map,
 * which is written from `personalizationOf` — the one helper the cart line, the
 * order line and the proof all resolve through, and therefore the only place
 * that means "a line of this shop's actually carries these words".
 *
 * ── AND WHY THE HOST STILL DOES NOT TELL US ITS ORDERS ─────────────────────
 *
 * Nothing here reads a reference, a line id or a stage. What is recorded is
 * that SOME line resolved to this personalization, which is a fact about this
 * add-on's own output. `nav.add-on.routes` carries no payload but the settings,
 * and an add-on that listed "today's orders" would be inventing a shop's
 * paperwork — the defect `seed.ts` records against the references that used to
 * live in this package.
 *
 * Writing it from a render is safe and deliberate: the key is the content, so a
 * double render in strict mode sets the same entry twice and changes nothing.
 */
const onLines = new Map<string, Personalization>();

/** Record that a host line resolved to this personalization. Idempotent. */
export function drewForLine(p: Personalization): void {
  onLines.set(keyOf(p.templateId, summarize(p)), p);
}

/**
 * What is on a line, in the order the lines were first drawn.
 *
 * A Map preserves insertion order, which is the order the shop asked about
 * them — close enough to the order they will be cut in to be useful, and
 * honest about being neither more nor less than that.
 */
export function remembered(): readonly Personalization[] {
  return [...onLines.values()];
}

export function forgetAll(): void {
  chosen.clear();
  onLines.clear();
}

/**
 * WHAT THE CUSTOMER ASKED FOR, READ BACK OUT OF THE HOST'S OWN NOTE.
 *
 * The bench is full of orders placed before this add-on was connected, and each
 * carries the shopper's words as a plain string because that is all the shop
 * ever stored. `recall` finds nothing for those — there was nothing to
 * remember — and the honest answer is NOT to show the maker a made-up
 * personalization, nor to show them nothing.
 *
 * It is to read the words. The note is split on the separator `summarize`
 * writes and laid into the areas in the order the maker drew them, so a line
 * that says "The Hartleys · est. 2019" becomes exactly the two areas it names.
 * The font, the size and the finish fall back to the piece's own defaults,
 * because the customer never chose any — and that is a true statement about
 * that order rather than an invented one.
 */
export function fromNote(productKey: string, note: string): Personalization | undefined {
  const template = templateFor(productKey);
  const words = note.trim();
  if (template === undefined || words === '') return undefined;
  const parts = words.split('·').map((part) => part.trim());
  const values: Record<string, string> = {};
  template.zones.forEach((zone, index) => {
    const part = parts[index];
    if (part !== undefined && part !== '') values[zone.id] = part;
  });
  if (Object.keys(values).length === 0) return undefined;
  return sizedToFit(
    {
      templateId: productKey,
      values,
      font: template.zones[0]?.constraints.fonts?.[0],
      finish: template.zones[0]?.finish,
    },
    template,
  );
}

/**
 * THE SIZE NOBODY CHOSE: the largest the studio cuts that the words go in at.
 *
 * A personalization read out of a note carries no size, so `settingsFor` falls
 * back to the area's own comfortable default — and a comfortable default is not
 * a promise that any particular words fit inside it. "The Hartleys · est. 2019"
 * is 86 mm of letters at that default against a 75 mm area, so EVERY seeded
 * order on the bench came back marked as not fitting, and the picture beside it
 * was of words falling off a coaster. Nothing was wrong with those orders. The
 * add-on had simply answered a question the customer never asked, and answered
 * it badly.
 *
 * What a maker actually does with wording and no stated size is cut it as large
 * as it will go, and `fit` already computes that number — it is the same
 * `setSizeMm` remedy the shopper's surface offers as a button, so this is the
 * add-on taking its own advice rather than a second rule invented here.
 *
 * It is a LOOP rather than one pass because a piece has more than one area and
 * they are measured separately: dropping the size for the long line can leave
 * the date fitting where it did not, and could in principle leave another area
 * still over. Each pass strictly lowers the size, so it terminates; four is far
 * more than the two areas any piece here carries, and a wording that still does
 * not fit at the smallest size the studio cuts is one no size can save. Those
 * come back marked, which is the honest answer.
 */
function sizedToFit(p: Personalization, template: Template): Personalization {
  let current = p;
  for (let pass = 0; pass < 4; pass += 1) {
    const overruns = check(current, template)
      .detail.filter((entry) => !entry.ok && entry.fit !== undefined && !entry.fit.fits)
      .map((entry) => (entry.fit!.fits ? undefined : entry.fit!.remedies.setSizeMm))
      .filter((size): size is number => size !== undefined);
    if (overruns.length === 0) return current;
    const next = Math.min(...overruns);
    if (current.sizeMm !== undefined && next >= current.sizeMm) return current;
    current = { ...current, sizeMm: next };
  }
  return current;
}

/** A fresh personalization for a piece, with nothing typed into it yet. */
export function blankFor(productKey: string, sizeMm: number): Personalization | undefined {
  const template = templateFor(productKey);
  if (template === undefined) return undefined;
  return {
    templateId: productKey,
    values: {},
    font: template.zones[0]?.constraints.fonts?.[0],
    sizeMm,
    finish: template.zones[0]?.finish,
  };
}

/**
 * WHAT THE SHOPPER'S SURFACE DOES WITH EACH KEYSTROKE — one function, so the
 * rule can be tested rather than read.
 *
 * It was two words inline in the fill and one of them was a bug:
 * `setNote(isReady(next) ? remember(next) : '')`. Every keystroke that left an
 * area failing WIPED the host's note field, so a shopper typing a name too long
 * for the coaster watched the shop forget they had typed anything — silently,
 * with "add to basket" still green. It is here, and named, because a rule
 * living inside a JSX callback is a rule no suite can see.
 *
 * The two halves are deliberately different:
 *
 *   THE WORDS ARE ALWAYS WRITTEN. They are the customer's, they live in the
 *   HOST's own field, and they are what survives the add-on being switched off
 *   (D16). There is no state of the world in which discarding them is right.
 *
 *   THE PICTURE IS FILED ONLY WHEN IT IS MAKEABLE. `remember` keys a
 *   personalization by those words, and a basket line that resolved to a
 *   picture of a name falling off the edge of a coaster would be a shop showing
 *   somebody a thing it cannot make as though it could.
 */
export function commit(p: Personalization, setNote: (note: string) => void): void {
  if (isReady(p)) remember(p);
  setNote(summarize(p));
}

/** True when everything required is filled in and every area fits. */
export function isReady(p: Personalization): boolean {
  const template = templateFor(p.templateId);
  if (template === undefined) return false;
  const { verdicts, blocks } = check(p, template);
  return blocks.length === 0 && verdicts.every((verdict) => verdict.ok);
}
