import { describe, expect, it } from 'vitest';

import { formAt, listAt } from '../shared/paths.ts';
import { newSlug } from './newForm.ts';
import { routeOf, searchText } from './route.ts';

describe('the address a screen opens from', () => {
  it('opens the list at the add-on’s root and at the page’s own address', () => {
    expect(routeOf('')).toEqual({ screen: 'list', kind: 'form' });
    expect(routeOf('forms')).toEqual({ screen: 'list', kind: 'form' });
    expect(routeOf('forms/surveys')).toEqual({ screen: 'list', kind: 'survey' });
  });

  it('opens a form on each of its tabs', () => {
    expect(routeOf('forms/showroom-visit')).toEqual({ screen: 'form', kind: 'form', slug: 'showroom-visit', tab: 'questions' });
    expect(routeOf('forms/showroom-visit/share')).toEqual({ screen: 'form', kind: 'form', slug: 'showroom-visit', tab: 'share' });
    expect(routeOf('forms/showroom-visit/answers')).toEqual({ screen: 'form', kind: 'form', slug: 'showroom-visit', tab: 'answers' });
  });

  it('opens a survey on each of its tabs, inside the forms page', () => {
    for (const tab of ['questions', 'share', 'results', 'invitations'] as const) {
      expect(routeOf(`forms/surveys/fit-out/${tab}`)).toEqual({ screen: 'form', kind: 'survey', slug: 'fit-out', tab });
    }
    // There is no page `surveys`: a page ref is the add-on's key or starts with it.
    expect(routeOf('surveys/fit-out/results')).toEqual({ screen: 'unknown' });
    expect(routeOf('forms/surveys/fit-out')).toEqual({ screen: 'form', kind: 'survey', slug: 'fit-out', tab: 'questions' });
  });

  it('opens what Adminium’s staff links name: an answer, a survey’s result, a form’s limits', () => {
    // `/add-ons/forms/forms/<slug>/answers?answer=<id>`, `/add-ons/forms/forms/surveys/<slug>/results?answer=<id>`, `/add-ons/forms/forms/<slug>?settings=limits`.
    expect(routeOf('forms/showroom-visit/answers')).toMatchObject({ tab: 'answers' });
    expect(routeOf('forms/surveys/fit-out/results')).toMatchObject({ kind: 'survey', tab: 'results' });
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

describe('a new link name', () => {
  it('is one Adminium serves, never a word it reserves, and opens its own form', () => {
    // The door's rule (Adminium 0.3.40, `FORM_SLUG`), as the address bar holds it.
    const served = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;
    for (let i = 0; i < 200; i += 1) {
      for (const kind of ['form', 'survey'] as const) {
        const slug = newSlug(kind);
        expect(slug).toMatch(served);
        expect(['api', 'surveys']).not.toContain(slug);
        expect(routeOf(formAt(kind, slug).replace('/add-ons/forms/', ''))).toMatchObject({ screen: 'form', kind, slug });
      }
    }
    expect(newSlug('form', (bytes) => bytes.fill(0))).toBe('form-aaaaaa');
  });
});
