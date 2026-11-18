/**
 * THE ROWS, AS THE SCREENS READ THEM: leniently, and a funnel's steps checked
 * on read, at most eight.
 */
import { describe, expect, it } from 'vitest';

import { FUNNEL_STEPS_MAX, funnelRowOf, headingOf, pageAddress, pageRowOf, stepsOf, storedSteps } from './rows.ts';

describe('a page row', () => {
  it('shows strangers’ heading for a live page, and the draft’s for a draft', () => {
    const live = pageRowOf({ id: 1, name: 'Open day', slug: 'open-day', state: 'live', language: 'en-US', draft: JSON.stringify({ blocks: [{ kind: 'hero', heading: 'Being written' }] }), published: JSON.stringify({ blocks: [{ kind: 'hero', heading: 'Seen now' }] }) });
    expect(live).toEqual({ key: '1', name: 'Open day', slug: 'open-day', state: 'live', language: 'en-US', heading: 'Seen now' });
    const draft = pageRowOf({ id: 2, name: 'Spring', slug: 'spring', state: 'draft', draft: { blocks: [{ kind: 'heading', text: 'Spring' }] } as never, published: null });
    expect(draft.heading).toBe('Spring');
    expect(pageRowOf({ id: 3, state: 'gone' }).state).toBe('draft');
  });

  it('takes the first Hero, else the first Heading, else the title', () => {
    expect(headingOf({ title: 'T', blocks: [{ kind: 'text', text: 'x' }, { kind: 'heading', text: 'H' }, { kind: 'hero', heading: 'Hero' }] })).toBe('Hero');
    expect(headingOf({ title: 'T', blocks: [{ kind: 'heading', text: 'H' }] })).toBe('H');
    expect(headingOf({ title: 'T', blocks: [] })).toBe('T');
    expect(headingOf('nonsense')).toBe('');
  });

  it('is at its address on the install’s public address, or at the path alone', () => {
    expect(pageAddress('https://crm.example/', 'open-day')).toBe('https://crm.example/x/pages/open-day');
    expect(pageAddress(null, 'open-day')).toBe('/x/pages/open-day');
  });
});

describe('a funnel’s steps', () => {
  it('are pages and forms by their keys; anything else is left out', () => {
    expect(stepsOf([{ kind: 'page', key: '1' }, { kind: 'form', key: 7, addOn: 'forms' }, { kind: 'form', key: '8' }, { kind: 'rule', key: '1' }, { kind: 'page', key: { '@ref': 'x' } }, { kind: 'page', key: '../x' }, 'page'])).toEqual([
      { kind: 'page', key: '1' },
      { kind: 'form', key: '7', addOn: 'forms' },
      { kind: 'form', key: '8', addOn: null },
    ]);
    expect(stepsOf(JSON.stringify([{ kind: 'page', key: '2' }]))).toEqual([{ kind: 'page', key: '2' }]);
    expect(stepsOf('{broken')).toEqual([]);
    expect(stepsOf(null)).toEqual([]);
  });

  it('are at most eight, read or stored', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ kind: 'page' as const, key: String(i + 1) }));
    expect(FUNNEL_STEPS_MAX).toBe(8);
    expect(stepsOf(many)).toHaveLength(8);
    expect(storedSteps(many)).toHaveLength(8);
  });

  it('are stored as the shared shape, a form’s add-on only where it is known', () => {
    expect(storedSteps([{ kind: 'page', key: '1' }, { kind: 'form', key: '7', addOn: 'forms' }, { kind: 'form', key: '8', addOn: null }])).toEqual([
      { kind: 'page', key: '1' },
      { kind: 'form', key: '7', addOn: 'forms' },
      { kind: 'form', key: '8' },
    ]);
  });

  it('come with the funnel’s name and its rule, none when empty', () => {
    expect(funnelRowOf({ id: 11, name: 'Open day', steps: null, rule_id: '' })).toEqual({ key: '11', name: 'Open day', steps: [], ruleId: null });
    expect(funnelRowOf({ id: 11, name: 'Open day', steps: null, rule_id: 'r1' }).ruleId).toBe('r1');
  });
});
