/**
 * WHERE EACH SCREEN OF THIS ADD-ON LIVES IN THE DASHBOARD.
 *
 * One code page, `forms`, holds every screen: the dashboard opens the page the
 * first segment after `/add-ons/forms/` names and hands it the rest
 * (`routeOf`). A form is `/add-ons/forms/forms/<slug>[/share|/answers]`, a
 * survey `/add-ons/forms/forms/surveys/<slug>[/share|/results|/invitations]`.
 *
 * Adminium's own mails and bells link to these same addresses:
 * `/add-ons/forms/forms/<slug>/answers?answer=<id>`,
 * `/add-ons/forms/forms/surveys/<slug>/results?answer=<id>` and
 * `/add-ons/forms/forms/<slug>?settings=limits`. A page ref must be the
 * add-on's key or start with it, so there is no page `surveys`: a survey is
 * a path inside `forms`, and no form may take the slug `surveys` (nor `api`).
 */
export const ADD_ON = 'forms';
/** The code page's ref: the add-on's key, the one ref every add-on may use. */
export const PAGE = 'forms';
/** The path segment surveys live under, inside the page. */
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
