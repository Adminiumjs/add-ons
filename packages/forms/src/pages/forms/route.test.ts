import { describe, expect, it } from 'vitest';

import { formAt, listAt } from '../shared/paths.ts';
import { routeOf, searchText } from './route.ts';

describe('the address a screen opens from', () => {
  it('opens the list at the add-on’s root and at the page’s own address', () => {
    expect(routeOf('')).toEqual({ screen: 'list', kind: 'form' });
    expect(routeOf('forms')).toEqual({ screen: 'list', kind: 'form' });
    expect(routeOf('forms/surveys')).toEqual({ screen: 'list', kind: 'survey' });
    expect(routeOf('surveys')).toEqual({ screen: 'list', kind: 'survey' });
  });

  it('opens a form on each of its tabs', () => {
    expect(routeOf('forms/showroom-visit')).toEqual({ screen: 'form', kind: 'form', slug: 'showroom-visit', tab: 'questions' });
    expect(routeOf('forms/showroom-visit/share')).toEqual({ screen: 'form', kind: 'form', slug: 'showroom-visit', tab: 'share' });
    expect(routeOf('forms/showroom-visit/answers')).toEqual({ screen: 'form', kind: 'form', slug: 'showroom-visit', tab: 'answers' });
  });

  it('opens a survey on each of its tabs, under the forms page or the survey ref Adminium’s links name', () => {
    for (const tab of ['questions', 'share', 'results', 'invitations'] as const) {
      expect(routeOf(`forms/surveys/fit-out/${tab}`)).toEqual({ screen: 'form', kind: 'survey', slug: 'fit-out', tab });
      expect(routeOf(`surveys/fit-out/${tab}`)).toEqual({ screen: 'form', kind: 'survey', slug: 'fit-out', tab });
    }
    expect(routeOf('forms/surveys/fit-out')).toEqual({ screen: 'form', kind: 'survey', slug: 'fit-out', tab: 'questions' });
  });

  it('opens what Adminium’s staff links name: an answer, a survey’s result, a form’s limits', () => {
    // `/add-ons/forms/forms/<slug>/answers?answer=<id>`, `/add-ons/forms/surveys/<slug>/results?answer=<id>`, `/add-ons/forms/forms/<slug>?settings=limits`.
    expect(routeOf('forms/showroom-visit/answers')).toMatchObject({ tab: 'answers' });
    expect(routeOf('surveys/fit-out/results')).toMatchObject({ kind: 'survey', tab: 'results' });
    expect(routeOf('forms/showroom-visit')).toMatchObject({ kind: 'form', tab: 'questions' });
    expect(searchText('42')).toBe('42');
    expect(searchText(42)).toBe('42');
    expect(searchText('limits')).toBe('limits');
  });

  it('opens nothing for a tab a form does not have, a path too long, or a page of another add-on', () => {
    expect(routeOf('forms/showroom-visit/results')).toEqual({ screen: 'unknown' });
    expect(routeOf('forms/surveys/fit-out/answers')).toEqual({ screen: 'unknown' });
    expect(routeOf('forms/showroom-visit/answers/more')).toEqual({ screen: 'unknown' });
    expect(routeOf('forms-settings')).toEqual({ screen: 'unknown' });
    expect(routeOf('forms/%E0%A4%A')).toEqual({ screen: 'unknown' });
    expect(searchText({ x: 1 })).toBeNull();
    expect(searchText('')).toBeNull();
  });

  it('is the way back from every address the screens make', () => {
    expect(routeOf(listAt('form').replace('/add-ons/forms/', ''))).toEqual({ screen: 'list', kind: 'form' });
    expect(routeOf(listAt('survey').replace('/add-ons/forms/', ''))).toEqual({ screen: 'list', kind: 'survey' });
    expect(routeOf(formAt('form', 'a b', 'answers').replace('/add-ons/forms/', ''))).toEqual({ screen: 'form', kind: 'form', slug: 'a b', tab: 'answers' });
    expect(routeOf(formAt('survey', 'fit-out', 'invitations').replace('/add-ons/forms/', ''))).toEqual({ screen: 'form', kind: 'survey', slug: 'fit-out', tab: 'invitations' });
    expect(formAt('form', 'x', 'questions')).toBe('/add-ons/forms/forms/x');
  });
});
