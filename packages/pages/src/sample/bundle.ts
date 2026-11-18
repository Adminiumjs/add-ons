/**
 * THE SAMPLE: what a fresh install can add, to see the list and a funnel with
 * something in them.
 *
 * Two pages in two languages: a live one in English, with its published copy,
 * and a draft in German that nobody has published yet. One funnel, "Open
 * day", whose step is the live page. No page names a form, a picture or
 * another add-on's row (none of those is there on a fresh install), and every
 * text is plain, as the landing vocabulary takes it.
 *
 * `scripts/sample.mjs` writes this to `seeds/pages.sample.json`;
 * `sample.test.ts` fails when the file is behind, and parses every page in it.
 */
export type Row = Record<string, unknown>;
export interface Bundle {
  format: 'adminium.sample/1';
  app: 'pages';
  tables: { ref: string; onlyIfEmpty?: true; rows: Row[] }[];
}

const ago = (duration: string): { '@ago': string } => ({ '@ago': duration });

/** The live page, in English: what strangers see, and what staff are working on, the same. */
export const OPEN_DAY = {
  v: 1,
  title: 'Showroom open day',
  description: 'Thursday 18 September, 10:00 to 19:00. Try the new booths and desks in our showroom.',
  blocks: [
    { id: 'hero', kind: 'hero', heading: 'Open day at our showroom', text: 'Thursday 18 September, 10:00 to 19:00. Sit in the new booths, try the desks, and talk to the people who fit them.' },
    {
      id: 'features',
      kind: 'features',
      items: [
        { icon: 'volume-x', heading: 'Quieter floors', text: 'Booths that cut the noise of a busy floor by half.' },
        { icon: 'move', heading: 'Desks that move', text: 'Sit or stand, at the touch of a key.' },
        { icon: 'calendar', heading: 'Fitted in a weekend', text: 'We work while your office is closed.' },
      ],
    },
    {
      id: 'questions',
      kind: 'questions',
      title: 'Questions and answers',
      items: [
        { question: 'Is there parking?', answer: 'Yes, 20 spaces behind the showroom.' },
        { question: 'Can I bring my team?', answer: 'Yes, up to eight people.' },
      ],
    },
  ],
} as const;

/** The draft, in German: a spring offer nobody has published yet. */
export const SPRING_OFFER = {
  v: 1,
  title: 'Schallschutzkabinen im Frühling',
  description: 'Kabinen für Großraumbüros, in einem Tag aufgestellt.',
  blocks: [
    { id: 'hero', kind: 'hero', heading: 'Ruhige Kabinen für Großraumbüros', text: 'Jede Kabine bietet Platz für zwei, passt durch eine normale Tür und steht in einem Tag.' },
    { id: 'text', kind: 'text', text: 'Besuchen Sie uns und sehen Sie, wie eine Kabine in Ihrem Büro stehen würde.' },
  ],
} as const;

const PAGES: Row[] = [
  { '@label': 'page:open-day', name: 'Showroom open day', slug: 'open-day', state: 'live', language: 'en-US', draft: OPEN_DAY, published: OPEN_DAY, published_at: ago('P12D') },
  { '@label': 'page:spring', name: 'Frühlingsangebot', slug: 'fruehlingsangebot', state: 'draft', language: 'de-DE', draft: SPRING_OFFER, published: null, published_at: null },
];

const FUNNELS: Row[] = [{ '@label': 'funnel:open-day', name: 'Open day', steps: [{ kind: 'page', key: { '@ref': 'page:open-day' } }], rule_id: null }];

export function buildSample(): Bundle {
  return {
    format: 'adminium.sample/1',
    app: 'pages',
    tables: [
      { ref: 'pages', rows: PAGES },
      { ref: 'funnels', rows: FUNNELS },
    ],
  };
}
