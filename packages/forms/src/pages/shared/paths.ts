/**
 * WHERE EACH SCREEN OF THIS ADD-ON LIVES IN THE DASHBOARD.
 *
 * One code page, `forms`, holds every screen: the dashboard opens the page the
 * first segment after `/add-ons/forms/` names and hands it the rest
 * (`routeOf`). A form is `/add-ons/forms/forms/<slug>[/share|/answers]`, a
 * survey `/add-ons/forms/forms/surveys/<slug>[/share|/results|/invitations]`.
 *
 * Adminium's own mails and bells link to `/add-ons/forms/forms/<slug>/answers`
 * and `/add-ons/forms/surveys/<slug>/results`: the second names the page ref
 * `surveys`, which `routeOf` reads as a survey too, so either address opens
 * the same screen whichever page the manifest serves it from.
 */
export const ADD_ON = 'forms';
/** The code page's ref, and the ref Adminium's links name for a survey. */
export const PAGE = 'forms';
export const SURVEYS = 'surveys';

export type Kind = 'form' | 'survey';
export type FormTab = 'questions' | 'share' | 'answers';
export type SurveyTab = 'questions' | 'share' | 'results' | 'invitations';

const BASE = `/add-ons/${ADD_ON}/${PAGE}`;
const slugPart = (slug: string): string => encodeURIComponent(slug);

/** The list, on its forms or its surveys tab. */
export const listAt = (kind: Kind): string => (kind === 'survey' ? `${BASE}/${SURVEYS}` : BASE);
/** A form or a survey, on one of its tabs (the questions when none). */
export function formAt(kind: Kind, slug: string, tab?: FormTab | SurveyTab): string {
  const at = kind === 'survey' ? `${BASE}/${SURVEYS}/${slugPart(slug)}` : `${BASE}/${slugPart(slug)}`;
  return tab === undefined || tab === 'questions' ? at : `${at}/${tab}`;
}
/** The generated page that keeps how long answers are kept. */
export const SETTINGS = '/p/forms-settings';
