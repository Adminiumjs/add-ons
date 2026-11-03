/** Forms rows as the data kit hands them back, for the screens' tests. */
type Row = Record<string, string | number | boolean | null>;

export function definition(kind: 'form' | 'survey', title: string, languages: string[] = ['en-US'], questions = 2): Record<string, unknown> {
  return {
    v: 1,
    kind,
    languages,
    defaultLanguage: languages[0],
    title: Object.fromEntries(languages.map((tag) => [tag, tag === 'en-US' ? title : `${title} (${tag})`])),
    questions: Array.from({ length: questions }, (_, i) => ({ id: `q${String(i + 1)}`, kind: 'long', label: Object.fromEntries(languages.map((tag) => [tag, `Q${String(i + 1)}`])) })),
    ending: { kind: 'words', words: Object.fromEntries(languages.map((tag) => [tag, 'Thanks'])) },
  };
}

/** A row; JSON columns as the text some databases hand back, unless `asObjects`. */
export function formRow(id: number, more: { slug: string; kind?: 'form' | 'survey'; state?: 'draft' | 'live' | 'closed'; title: string; languages?: string[]; questions?: number; updated?: string; closed?: string | null; settings?: Record<string, unknown>; asObjects?: boolean }): Row {
  const kind = more.kind ?? 'form';
  const json = (value: unknown) => (more.asObjects === true ? (value as never) : JSON.stringify(value));
  return {
    id,
    name: more.title,
    slug: more.slug,
    kind,
    state: more.state ?? 'live',
    definition: json(definition(kind, more.title, more.languages, more.questions)),
    settings: json(more.settings ?? { becomes: null, tell: [], limits: { perHour: 200, harder: false } }),
    published: null,
    published_at: null,
    updated_at: more.updated ?? '2026-11-03T10:00:00.000Z',
    closed_at: more.closed ?? null,
  };
}

export const summary = (total: number, more: { invited?: number | null; answered?: number | null; recommendScore?: number | null } = {}) => ({
  total,
  byLanguage: {},
  recommendScore: more.recommendScore ?? null,
  questions: {},
  invited: more.invited ?? null,
  answered: more.answered ?? null,
});
