/**
 * A FUNNEL'S STEPS, AS CARDS WITH THEIR VIEWS.
 *
 * A step is a page or a form. A page step is one card, its page's views. A
 * form step is two cards: the form coming into view, and the form sent. Where
 * the step before is a page, both are counted on that page (Adminium keeps a
 * form's counts by the page it was on); where it is not, "opened" is the
 * form's own page being opened, and "sent" is every send.
 *
 * A step whose page was deleted, or whose form is no longer live, is drawn as
 * removed and counts nothing; a page that is off keeps the views it had.
 *
 * `cardsOf` and `percentOf` are pure; `countCards` asks Adminium.
 */
import { readViews, totalOf, type CountingLevel, type EngineApi, type LiveForm, type ViewCounts, type ViewKind } from '../../engine.ts';
import type { DayRange } from '../shared/days.ts';
import { pagePath, type PageRow, type Step } from '../shared/rows.ts';

export type CardKind = 'page' | 'form-opened' | 'form-sent';

export interface Card {
  /** Its place among the cards, from 1. */
  n: number;
  kind: CardKind;
  /** The page's or the form's name; empty when it was removed. */
  title: string;
  /** Under the title: the page's address, the page the form is on, or nothing. */
  sub: { kind: 'address'; path: string } | { kind: 'on'; page: string } | { kind: 'own' } | null;
  removed: boolean;
  /** The page is switched off: its views are from before. */
  off: boolean;
  unit: 'views' | 'sends';
  /** What is counted, and where; null when the card counts nothing. */
  ask: { install: 'pages' | { form: LiveForm }; kind: ViewKind; thing: string; place?: string } | null;
}

/** The live form a step names: by its add-on when the step says, else the first of that key. */
export const formOf = (forms: readonly LiveForm[], step: Extract<Step, { kind: 'form' }>): LiveForm | undefined => forms.find((form) => form.key === step.key && (step.addOn === null || form.addOn === step.addOn));

export function cardsOf(steps: readonly Step[], pages: ReadonlyMap<string, PageRow>, forms: readonly LiveForm[]): Card[] {
  const out: Omit<Card, 'n'>[] = [];
  steps.forEach((step, i) => {
    if (step.kind === 'page') {
      const page = pages.get(step.key);
      out.push(
        page === undefined
          ? { kind: 'page', title: '', sub: null, removed: true, off: false, unit: 'views', ask: null }
          : { kind: 'page', title: page.name, sub: { kind: 'address', path: pagePath(page.slug) }, removed: false, off: page.state === 'off', unit: 'views', ask: { install: 'pages', kind: 'page', thing: page.key } },
      );
      return;
    }
    const form = formOf(forms, step);
    const before = steps[i - 1];
    const on = before?.kind === 'page' ? pages.get(before.key) : undefined;
    if (form === undefined) {
      out.push({ kind: 'form-opened', title: '', sub: null, removed: true, off: false, unit: 'views', ask: null });
      out.push({ kind: 'form-sent', title: '', sub: null, removed: true, off: false, unit: 'sends', ask: null });
      return;
    }
    const sub: Card['sub'] = on === undefined ? { kind: 'own' } : { kind: 'on', page: on.name };
    const place = on === undefined ? {} : { place: on.key };
    out.push({ kind: 'form-opened', title: form.name, sub, removed: false, off: false, unit: 'views', ask: { install: { form }, kind: on === undefined ? 'form-page' : 'form-opened', thing: form.key, ...place } });
    out.push({ kind: 'form-sent', title: form.name, sub, removed: false, off: false, unit: 'sends', ask: { install: { form }, kind: 'form-sent', thing: form.key, ...place } });
  });
  return out.map((card, i) => ({ ...card, n: i + 1 }));
}

/** "This step ÷ the one before", rounded; null (drawn "—") when either counts nothing or the one before is 0. */
export function percentOf(count: number | null, before: number | null): string | null {
  if (count === null || before === null || before === 0) return null;
  return `${String(Math.round((count / before) * 100))}%`;
}

/** A bar's length against the largest count, in percent: at least 2 for a count above 0. */
export function barOf(count: number | null, largest: number): number {
  if (count === null || count <= 0 || largest <= 0) return 0;
  return Math.max(2, Math.round((count / largest) * 100));
}

export interface Counted {
  /** Each card's count, in order; null where it counts nothing or could not be read. */
  counts: (number | null)[];
  level: CountingLevel | null;
  countingSince: number | null;
}

/** Where a form's counts are kept: its install id, else nothing to ask. */
export type InstallOf = (form: LiveForm) => string | null;

/**
 * Every card's count over the range. The pages are asked in one read; each
 * form card in a read of its own (a funnel has at most eight steps).
 */
export async function countCards(api: EngineApi, cards: readonly Card[], range: DayRange, pagesInstall: string | null, installOf: InstallOf): Promise<Counted> {
  const pageThings = cards.flatMap((card) => (card.ask !== null && card.ask.install === 'pages' ? [card.ask.thing] : []));
  const reads: ViewCounts[] = [];
  let pageCounts: ViewCounts | null = null;
  if (pagesInstall !== null && pageThings.length > 0) {
    pageCounts = await readViews(api, { installId: pagesInstall, kind: 'page', things: pageThings, ...range }).catch(() => null);
    if (pageCounts !== null) reads.push(pageCounts);
  }
  const counts = await Promise.all(
    cards.map(async (card): Promise<number | null> => {
      const ask = card.ask;
      if (ask === null) return null;
      if (ask.install === 'pages') return pageCounts === null ? null : totalOf(pageCounts, ask.thing);
      const install = installOf(ask.install.form);
      if (install === null) return null;
      const read = await readViews(api, { installId: install, kind: ask.kind, things: [ask.thing], ...range, ...(ask.place === undefined ? {} : { place: ask.place }) }).catch(() => null);
      if (read === null) return null;
      reads.push(read);
      return totalOf(read, ask.thing);
    }),
  );
  const said = reads.find((read) => read.level !== null) ?? null;
  return { counts, level: said?.level ?? null, countingSince: said?.countingSince ?? null };
}
