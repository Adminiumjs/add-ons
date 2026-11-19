/**
 * THE WORDS A FUNNEL IS DRAWN WITH: a step's kind, its name, a count's unit,
 * the counting level.
 */
import type { CountingLevel, LiveForm } from '../../engine.ts';
import type { AddOnTranslate } from '../shared/host.ts';
import type { PageRow, Step } from '../shared/rows.ts';
import { UNKNOWN_COUNT } from '../shared/days.ts';
import { formOf, type Card } from './count.ts';

/** A card's kind in small capitals: "Page", "Form · opened", "Form · sent". */
export function kindWords(t: AddOnTranslate, kind: Card['kind']): string {
  if (kind === 'page') return t('funnels.kind.page', 'Page');
  if (kind === 'form-opened') return t('funnels.kind.opened', 'Form · opened');
  return t('funnels.kind.sent', 'Form · sent');
}

/** A step's kind in the funnel dialog: a form step is one row there. */
export const stepKindWords = (t: AddOnTranslate, step: Step): string => (step.kind === 'page' ? t('funnels.kind.page', 'Page') : t('funnels.kind.form', 'Form'));

/** A step's name: the page's or the form's, or that it is gone. */
export function stepNameOf(t: AddOnTranslate, step: Step, pages: readonly PageRow[], forms: readonly LiveForm[]): string {
  if (step.kind === 'page') return pages.find((page) => page.key === step.key)?.name ?? t('funnels.removedPage', 'A deleted page');
  return formOf(forms, step)?.name ?? t('funnels.removedForm', 'A form that is not live');
}

export const stepNamesOf = (t: AddOnTranslate, steps: readonly Step[], pages: readonly PageRow[], forms: readonly LiveForm[]): string[] => steps.map((step) => stepNameOf(t, step, pages, forms));

/**
 * What a step counts, as the noun after its number, in the language's own
 * plural form for that number (Czech and Arabic have more than two; Chinese
 * one). A count not known yet takes the form for several.
 */
export function unitWords(t: AddOnTranslate, unit: Card['unit'], count: number | null): string {
  const n = count ?? UNKNOWN_COUNT;
  return unit === 'sends' ? t('funnels.sendCount', '{count, plural, one {send} other {sends}}', { count: n }) : t('funnels.viewCount', '{count, plural, one {view} other {views}}', { count: n });
}

/** The counting level as the note says it. */
export function levelWords(t: AddOnTranslate, level: CountingLevel | null): string {
  if (level === 'off') return t('funnels.level.off', 'Off');
  if (level === 'visitor') return t('funnels.level.visitor', 'Per visitor');
  return t('funnels.level.counts', 'Counts only');
}
