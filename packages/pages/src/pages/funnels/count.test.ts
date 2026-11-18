/**
 * A FUNNEL'S CARDS AND THEIR COUNTS (comp 5; states 2d–2f).
 */
import { describe, expect, it } from 'vitest';

import type { EngineApi, LiveForm } from '../../engine.ts';
import { pageRowOf, stepsOf, type PageRow } from '../shared/rows.ts';
import { FORMS, FUNNEL, PAGES } from '../testing/fixtures.ts';
import { barOf, cardsOf, countCards, percentOf } from './count.ts';

const pages = new Map<string, PageRow>(PAGES.map((row) => [String(row.id), pageRowOf(row as never)]));
const forms = FORMS as unknown as LiveForm[];
const range = { from: '2026-07-01', to: '2026-07-28' };

describe('the cards', () => {
  it('draw a page step as one card and a form step as two, counted on the page before it', () => {
    const cards = cardsOf(stepsOf(FUNNEL.steps), pages, forms);
    expect(cards.map((card) => [card.n, card.kind, card.title, card.unit])).toEqual([
      [1, 'page', 'Showroom open day', 'views'],
      [2, 'form-opened', 'Book a showroom visit', 'views'],
      [3, 'form-sent', 'Book a showroom visit', 'sends'],
      [4, 'page', 'Thanks, see you there', 'views'],
    ]);
    expect(cards[0]?.sub).toEqual({ kind: 'address', path: '/x/pages/open-day' });
    expect(cards[1]?.sub).toEqual({ kind: 'on', page: 'Showroom open day' });
    expect(cards.map((card) => card.ask && [card.ask.kind, card.ask.thing, card.ask.place ?? ''])).toEqual([
      ['page', '1', ''],
      ['form-opened', '7', '1'],
      ['form-sent', '7', '1'],
      ['page', '5', ''],
    ]);
  });

  it('count a form with no page before it on its own page, and every send', () => {
    const cards = cardsOf([{ kind: 'form', key: '7', addOn: 'forms' }], pages, forms);
    expect(cards.map((card) => card.ask && [card.ask.kind, card.ask.place ?? null])).toEqual([
      ['form-page', null],
      ['form-sent', null],
    ]);
    expect(cards[0]?.sub).toEqual({ kind: 'own' });
  });

  it('draw a deleted page and a form that is no longer live as removed, counting nothing', () => {
    const cards = cardsOf([{ kind: 'page', key: '99' }, { kind: 'form', key: '8', addOn: 'forms' }], pages, forms);
    expect(cards.map((card) => [card.kind, card.removed, card.ask])).toEqual([
      ['page', true, null],
      ['form-opened', true, null],
      ['form-sent', true, null],
    ]);
  });

  it('mark a page that is off, and still count what it had', () => {
    const [card] = cardsOf([{ kind: 'page', key: '4' }], pages, forms);
    expect(card).toMatchObject({ off: true, removed: false, ask: { kind: 'page', thing: '4' } });
  });

  it('find a form by its add-on when the step names one', () => {
    const other = [...forms, { ...forms[0]!, addOn: 'surveys', name: 'Another form, same key' }];
    expect(cardsOf([{ kind: 'form', key: '7', addOn: 'surveys' }], pages, other)[0]?.title).toBe('Another form, same key');
  });
});

describe('what went on', () => {
  it('is this step over the one before, rounded, as the comp: 25%, 31%, 98%', () => {
    expect([percentOf(310, 1240), percentOf(96, 310), percentOf(94, 96)]).toEqual(['25%', '31%', '98%']);
  });

  it('is “—”, never 0%, when the step before counted nothing or a step counts nothing', () => {
    expect(percentOf(0, 0)).toBeNull();
    expect(percentOf(5, null)).toBeNull();
    expect(percentOf(null, 5)).toBeNull();
    expect(percentOf(0, 5)).toBe('0%');
  });

  it('draws a bar against the largest count, at least a sliver for a count above 0', () => {
    expect([barOf(1240, 1240), barOf(310, 1240), barOf(1, 1240), barOf(0, 1240), barOf(null, 1240), barOf(5, 0)]).toEqual([100, 25, 2, 0, 0, 0]);
  });
});

describe('the counts', () => {
  const answer = (path: string) => {
    const url = new URL(path, 'https://x.example');
    const kind = url.searchParams.get('kind');
    const views: Record<string, number> = kind === 'page' ? { '1': 1240, '5': 94 } : kind === 'form-opened' ? { '7': 310 } : { '7': 96 };
    return { data: { level: 'counts', countingSince: null, things: (url.searchParams.get('things') ?? '').split(',').map((thing) => ({ thing, days: [{ day: '2026-07-02', place: url.searchParams.get('place') ?? '', views: views[thing] ?? 0 }] })) } };
  };

  it('ask the pages in one read, and each form card in its own, under each add-on’s install', async () => {
    const asked: string[] = [];
    const api: EngineApi = { get: async (path) => (asked.push(path), answer(path)) };
    const cards = cardsOf(stepsOf(FUNNEL.steps), pages, forms);
    const counted = await countCards(api, cards, range, 'install-pages', (form) => form.installId);
    expect(counted.counts).toEqual([1240, 310, 96, 94]);
    expect(counted.level).toBe('counts');
    expect(asked.map((path) => new URL(path, 'https://x.example').searchParams.toString()).sort()).toEqual(
      [
        'installId=install-pages&kind=page&things=1%2C5&from=2026-07-01&to=2026-07-28',
        'installId=install-forms&kind=form-opened&things=7&from=2026-07-01&to=2026-07-28&place=1',
        'installId=install-forms&kind=form-sent&things=7&from=2026-07-01&to=2026-07-28&place=1',
      ].sort(),
    );
  });

  it('count nothing where an install is not known, or a read fails', async () => {
    const api: EngineApi = {
      get: async (path) => {
        if (path.includes('form-sent')) throw new Error('refused');
        return answer(path);
      },
    };
    const cards = cardsOf(stepsOf(FUNNEL.steps), pages, forms);
    expect((await countCards(api, cards, range, null, (form) => form.installId)).counts).toEqual([null, 310, null, null]);
  });
});
