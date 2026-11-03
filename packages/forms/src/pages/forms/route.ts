/**
 * WHICH SCREEN AN ADDRESS OPENS.
 *
 * The dashboard hands the page everything after `/add-ons/forms/`: the page
 * ref first (`forms`), then the page's own path. Empty, it is the add-on's
 * root, which opens the list.
 */
import { PAGE, SURVEYS, type FormTab, type Kind, type SurveyTab } from '../shared/paths.ts';

export type Route =
  | { screen: 'list'; kind: Kind }
  | { screen: 'form'; kind: 'form'; slug: string; tab: FormTab }
  | { screen: 'form'; kind: 'survey'; slug: string; tab: SurveyTab }
  | { screen: 'unknown' };

const FORM_TABS: readonly FormTab[] = ['questions', 'share', 'answers'];
const SURVEY_TABS: readonly SurveyTab[] = ['questions', 'share', 'results', 'invitations'];

const decoded = (part: string): string | null => {
  try {
    return decodeURIComponent(part);
  } catch {
    return null;
  }
};

function surveyRoute(rest: readonly string[]): Route {
  if (rest.length === 0) return { screen: 'list', kind: 'survey' };
  const slug = decoded(rest[0]!);
  const tab = rest[1] === undefined ? 'questions' : SURVEY_TABS.find((one) => one === rest[1]);
  if (slug === null || tab === undefined || rest.length > 2) return { screen: 'unknown' };
  return { screen: 'form', kind: 'survey', slug, tab };
}

function formRoute(rest: readonly string[]): Route {
  if (rest.length === 0) return { screen: 'list', kind: 'form' };
  if (rest[0] === SURVEYS) return surveyRoute(rest.slice(1));
  const slug = decoded(rest[0]!);
  const tab = rest[1] === undefined ? 'questions' : FORM_TABS.find((one) => one === rest[1]);
  if (slug === null || tab === undefined || rest.length > 2) return { screen: 'unknown' };
  return { screen: 'form', kind: 'form', slug, tab };
}

/** The screen the dashboard's splat (`forms/showroom/answers`, `forms/surveys/fit-out/results`) opens. */
export function routeOf(splat: string): Route {
  const parts = splat.split('/').filter((part) => part !== '');
  if (parts.length === 0) return { screen: 'list', kind: 'form' };
  const [ref, ...rest] = parts;
  return ref === PAGE ? formRoute(rest) : { screen: 'unknown' };
}

/** A search value a link put in the address, as text; anything else is nothing. */
export const searchText = (value: unknown): string | null => (typeof value === 'string' && value !== '' && value.length <= 200 ? value : typeof value === 'number' ? String(value) : null);
