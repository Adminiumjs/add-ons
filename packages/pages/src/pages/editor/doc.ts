/**
 * THE PAGE AS THE EDITOR HOLDS IT, AND EVERY CHANGE IT MAKES TO IT.
 *
 * The page's working copy is a page document in the shared vocabulary
 * (`@adminium/add-on-contracts/landing`), kept in the row's `draft`. A draft
 * may be half made: a new section's words are empty until someone writes
 * them, a picture may not be chosen yet. So the editor never holds a draft to
 * the vocabulary while it is edited; it reads a stored one leniently
 * (`draftOf`), and only publishing holds it to `parseLandingPage`, through
 * `problemsOf`, as the engine's seal does.
 *
 * Milo's mark: a section Milo wrote carries `milo: true` until a person looks
 * at it. Any change a person makes to a section clears its mark (`update`),
 * and so does checking it; a page with a mark left is never published.
 *
 * Pure: no I/O, no clock. A new section's id comes from the caller.
 */
import {
  LANDING_BLOCKS_MAX,
  LANDING_COLUMNS_MAX,
  LANDING_FEATURE_ICONS,
  LANDING_SPACER_SIZES,
  LANDING_VOCABULARY_VERSION,
  hasMiloMarks,
  landingBlockSchema,
  parseLandingPage,
  type LandingBlock,
  type LandingBlockKind,
  type LandingBlockOf,
  type LandingLink,
  type LandingPage,
  type PictureRef,
} from '@adminium/add-on-contracts/landing';

import { isPageSlug } from './slug.ts';

export type Page = LandingPage;
export type Block = LandingBlock;
export type BlockOf<K extends LandingBlockKind> = LandingBlockOf<K>;
export type Link = LandingLink;
export type Picture = PictureRef;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * The default title of a Questions and answers section, in the page's own
 * language: the title is the section's own field, written in the language the
 * page is, not the language of whoever edits it.
 */
const QUESTIONS_TITLE: Readonly<Record<string, string>> = {
  en: 'Questions and answers',
  de: 'Fragen und Antworten',
  fr: 'Questions et réponses',
  da: 'Spørgsmål og svar',
  cs: 'Otázky a odpovědi',
  ar: 'أسئلة وأجوبة',
  'zh-CN': '问题与解答',
  'zh-TW': '問題與解答',
};

export function questionsTitleIn(language: string): string {
  return QUESTIONS_TITLE[language] ?? QUESTIONS_TITLE[language.split('-')[0] ?? ''] ?? (QUESTIONS_TITLE['en'] as string);
}

/** A new page: its title (the name it was given) and nothing on it yet. */
export function newPage(title: string): Page {
  return { v: LANDING_VOCABULARY_VERSION, title, description: '', blocks: [] };
}

/** A section of a kind, with nothing written in it yet. */
export function blankBlock(kind: LandingBlockKind, id: string, language: string): Block {
  switch (kind) {
    case 'hero':
      return { id, kind, heading: '', text: '' };
    case 'heading':
      return { id, kind, text: '' };
    case 'text':
      return { id, kind, text: '' };
    case 'picture':
      return { id, kind, picture: { file: '', alt: '' } };
    case 'button':
      return { id, kind, label: '', link: { kind: 'url', href: '' } };
    case 'columns':
      return { id, kind, columns: [{ text: '' }, { text: '' }] };
    case 'features':
      return { id, kind, items: [{ heading: '', text: '' }] };
    case 'quote':
      return { id, kind, text: '', who: '' };
    case 'questions':
      return { id, kind, title: questionsTitleIn(language), items: [{ question: '', answer: '' }] };
    case 'spacer':
      return { id, kind, size: 'm' };
    case 'form':
      return { id, kind, form: '', addOn: '' };
  }
}

/* ── reading a stored draft ─────────────────────────────────────────────── */

const KINDS = new Set<string>(['hero', 'heading', 'text', 'picture', 'button', 'columns', 'features', 'quote', 'questions', 'spacer', 'form']);

function linkOf(value: unknown): Link {
  if (isRecord(value)) {
    if (value['kind'] === 'form') return { kind: 'form' };
    if (value['kind'] === 'page' && typeof value['key'] === 'string') return { kind: 'page', key: value['key'] };
    if (value['kind'] === 'url') return { kind: 'url', href: textOf(value['href']) };
  }
  return { kind: 'url', href: '' };
}

function pictureOf(value: unknown): Picture | undefined {
  if (!isRecord(value)) return undefined;
  const file = textOf(value['file']);
  return value['decorative'] === true ? { file, decorative: true } : { file, alt: textOf(value['alt']) };
}

/** One stored section, read leniently: what is there is kept, what is missing is empty. Null for what is no section. */
function blockOf(value: unknown, language: string): Block | null {
  if (!isRecord(value) || typeof value['kind'] !== 'string' || !KINDS.has(value['kind']) || typeof value['id'] !== 'string' || value['id'] === '') return null;
  const whole = landingBlockSchema.safeParse(value);
  if (whole.success) return whole.data;
  const kind = value['kind'] as LandingBlockKind;
  const id = value['id'];
  const milo = value['milo'] === true ? { milo: true as const } : {};
  const button = isRecord(value['button']) ? { button: { label: textOf(value['button']['label']), link: linkOf(value['button']['link']) } } : {};
  const picture = pictureOf(value['picture']);
  switch (kind) {
    case 'hero':
      return { id, kind, ...milo, heading: textOf(value['heading']), text: textOf(value['text']), ...button, ...(picture === undefined ? {} : { picture }) };
    case 'heading':
    case 'text':
      return { id, kind, ...milo, text: textOf(value['text']) };
    case 'picture':
      return { id, kind, ...milo, picture: picture ?? { file: '', alt: '' } };
    case 'button':
      return { id, kind, ...milo, label: textOf(value['label']), link: linkOf(value['link']) };
    case 'columns': {
      const listed = Array.isArray(value['columns']) ? value['columns'].filter(isRecord) : [];
      const columns = listed.slice(0, LANDING_COLUMNS_MAX).map((one) => {
        const heading = typeof one['heading'] === 'string' ? { heading: one['heading'] } : {};
        const pic = pictureOf(one['picture']);
        return { ...heading, text: textOf(one['text']), ...(pic === undefined ? {} : { picture: pic }) };
      });
      while (columns.length < 2) columns.push({ text: '' });
      return { id, kind, ...milo, columns };
    }
    case 'features': {
      const icons = new Set<string>(LANDING_FEATURE_ICONS);
      const items = (Array.isArray(value['items']) ? value['items'].filter(isRecord) : []).map((item) => ({
        ...(typeof item['icon'] === 'string' && icons.has(item['icon']) ? { icon: item['icon'] as (typeof LANDING_FEATURE_ICONS)[number] } : {}),
        heading: textOf(item['heading']),
        text: textOf(item['text']),
      }));
      return { id, kind, ...milo, ...(typeof value['title'] === 'string' ? { title: value['title'] } : {}), items: items.length > 0 ? items : [{ heading: '', text: '' }] };
    }
    case 'quote':
      return { id, kind, ...milo, text: textOf(value['text']), who: textOf(value['who']) };
    case 'questions': {
      const items = (Array.isArray(value['items']) ? value['items'].filter(isRecord) : []).map((item) => ({ question: textOf(item['question']), answer: textOf(item['answer']) }));
      return { id, kind, ...milo, title: typeof value['title'] === 'string' ? value['title'] : questionsTitleIn(language), items: items.length > 0 ? items : [{ question: '', answer: '' }] };
    }
    case 'spacer':
      return { id, kind, ...milo, size: (LANDING_SPACER_SIZES as readonly string[]).includes(textOf(value['size'])) ? (value['size'] as 's' | 'm' | 'l') : 'm' };
    case 'form':
      return { id, kind, ...milo, form: textOf(value['form']), addOn: textOf(value['addOn']) };
  }
}

/**
 * A stored draft as the editor holds it, whichever way the database handed
 * the JSON back. What cannot be a section is left out; a page with no draft
 * at all starts empty under `title`.
 */
export function draftOf(stored: unknown, title: string, language: string): Page {
  let value = stored;
  if (typeof stored === 'string') {
    try {
      value = JSON.parse(stored) as unknown;
    } catch {
      value = null;
    }
  }
  if (!isRecord(value)) return newPage(title);
  const ids = new Set<string>();
  const blocks: Block[] = [];
  for (const one of Array.isArray(value['blocks']) ? value['blocks'] : []) {
    const block = blockOf(one, language);
    if (block === null || ids.has(block.id)) continue;
    ids.add(block.id);
    blocks.push(block);
  }
  const picture = pictureOf(value['picture']);
  return {
    v: LANDING_VOCABULARY_VERSION,
    title: typeof value['title'] === 'string' ? value['title'] : title,
    description: textOf(value['description']),
    ...(picture === undefined ? {} : { picture }),
    blocks: blocks.slice(0, LANDING_BLOCKS_MAX),
  };
}

/* ── changes ────────────────────────────────────────────────────────────── */

/** A section's place on the page, or -1. */
export const indexOf = (page: Page, id: string): number => page.blocks.findIndex((block) => block.id === id);

/** Whether another section fits on the page. */
export const roomFor = (page: Page): boolean => page.blocks.length < LANDING_BLOCKS_MAX;

/** The page with `block` put after the section `after`; at the end when `after` is null or gone. */
export function insertAfter(page: Page, after: string | null, block: Block): Page {
  if (!roomFor(page)) return page;
  const at = after === null ? -1 : indexOf(page, after);
  const blocks = [...page.blocks];
  blocks.splice(at < 0 ? blocks.length : at + 1, 0, block);
  return { ...page, blocks };
}

/** The page without the section `id`. */
export function remove(page: Page, id: string): Page {
  return { ...page, blocks: page.blocks.filter((block) => block.id !== id) };
}

/** The page with the section `id` one place up (-1) or down (+1); unchanged at either end. */
export function move(page: Page, id: string, by: -1 | 1): Page {
  const at = indexOf(page, id);
  const to = at + by;
  if (at < 0 || to < 0 || to >= page.blocks.length) return page;
  const blocks = [...page.blocks];
  const [moved] = blocks.splice(at, 1);
  blocks.splice(to, 0, moved as Block);
  return { ...page, blocks };
}

/** A section without Milo's mark. */
export function unmarked<B extends Block>(block: B): B {
  if (block.milo === undefined) return block;
  const { milo: _milo, ...rest } = block;
  return rest as B;
}

/**
 * The page with the section `id` changed by a person: the change made, and
 * Milo's mark taken off, since a person has now looked at it.
 */
export function update(page: Page, id: string, change: (block: Block) => Block): Page {
  return { ...page, blocks: page.blocks.map((block) => (block.id === id ? unmarked(change(block)) : block)) };
}

/** The page with every mark taken off: "Looks right". */
export function checkAll(page: Page): Page {
  return { ...page, blocks: page.blocks.map((block) => unmarked(block)) };
}

/** How many sections still carry Milo's mark. */
export const markCount = (page: Page): number => page.blocks.filter((block) => block.milo === true).length;

/** A section's id that no section of the page has: `make` is asked until it gives one nobody holds. */
export function freshId(page: Page, make: () => string): string {
  const taken = new Set(page.blocks.map((block) => block.id));
  for (let tries = 0; tries < 50; tries += 1) {
    const id = make();
    if (/^[A-Za-z0-9_-]{1,40}$/.test(id) && !taken.has(id)) return id;
  }
  return `b${String(page.blocks.length + taken.size + 1)}x`;
}

/** Whether the page has a Form section: a link may go to "the form on this page" only then. */
export const hasForm = (page: Page): boolean => page.blocks.some((block) => block.kind === 'form');

/* ── publishing ─────────────────────────────────────────────────────────── */

/** One thing that keeps the page from going live, and where it is. */
export type Problem =
  | { code: 'marked'; count: number }
  | { code: 'slug' }
  | { code: 'empty' }
  | { code: 'field'; block: string | null; field: string; issue: string };

/**
 * Everything that keeps the page from being published: Milo's marks left,
 * an address that breaks the slug rule (by its shape here, or as Adminium
 * judged it: `refusedAddress`, `slug.ts`), a page with no section, and every
 * field the vocabulary refuses, each on the section it is in.
 */
export function problemsOf(page: Page, slug: string, refusedAddress = false): Problem[] {
  const found: Problem[] = [];
  const marks = markCount(page);
  if (marks > 0) found.push({ code: 'marked', count: marks });
  if (!isPageSlug(slug) || refusedAddress) found.push({ code: 'slug' });
  if (page.blocks.length === 0) found.push({ code: 'empty' });
  const parsed = parseLandingPage(page);
  if (!parsed.ok) {
    const seen = new Set<string>();
    for (const issue of parsed.issues) {
      const path = issue.path;
      const index = path[0] === 'blocks' && typeof path[1] === 'number' ? path[1] : null;
      const block = index === null ? null : (page.blocks[index]?.id ?? null);
      const rest = index === null ? path : path.slice(2);
      const field = [...rest].reverse().find((part): part is string => typeof part === 'string') ?? '';
      // A page's own marks are said once, above; one line per field is enough.
      if (field === 'milo') continue;
      const key = `${block ?? ''}:${rest.join('.')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ code: 'field', block, field, issue: issue.code });
    }
  }
  return found;
}

/** The copy a publish writes: the draft itself, which must parse whole and carry no mark. Null when it cannot. */
export function publishable(page: Page): Page | null {
  const parsed = parseLandingPage(page);
  return parsed.ok && !hasMiloMarks(parsed.page) ? parsed.page : null;
}

/** Whether two pages say the same: a live page's draft that differs from its published copy has changes to publish. */
export function samePage(a: unknown, b: unknown): boolean {
  return stable(a) === stable(b);
}

/** A value as text with its keys in order, so two equal pages read alike whatever order a database kept their keys in. */
export function stable(value: unknown): string {
  let read = value;
  if (typeof value === 'string') {
    try {
      read = JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  }
  const sorted = (one: unknown): unknown => {
    if (Array.isArray(one)) return one.map(sorted);
    if (isRecord(one))
      return Object.fromEntries(
        Object.keys(one)
          .sort()
          .map((key) => [key, sorted(one[key])]),
      );
    return one;
  };
  return JSON.stringify(sorted(read ?? null));
}
