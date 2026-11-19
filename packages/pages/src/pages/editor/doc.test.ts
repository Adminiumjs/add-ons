import { parseLandingPage } from '@adminium/add-on-contracts/landing';
import { describe, expect, it } from 'vitest';

import { blankBlock, checkAll, draftOf, freshId, insertAfter, markCount, move, newPage, problemsOf, publishable, remove, samePage, update, type Page } from './doc.ts';
import { freeSlug, slugOf, typedSlug } from './slug.ts';

const page = (blocks: Page['blocks']): Page => ({ v: 1, title: 'Showroom open day', description: 'Come and sit in the new booths.', blocks });
const hero = { id: 'b1', kind: 'hero' as const, heading: 'Open day at our Leeds showroom', text: 'Sit in the new booths.' };
const text = { id: 'b2', kind: 'text' as const, text: 'Talk to the people who fit them.' };
const spacer = { id: 'b3', kind: 'spacer' as const, size: 'm' as const };

describe('a stored draft, read leniently', () => {
  it('reads one stored as text, the way SQLite hands a JSON column back, and one stored as an object', () => {
    const stored = page([hero, text]);
    expect(draftOf(JSON.stringify(stored), 'x', 'en-US')).toEqual(stored);
    expect(draftOf(stored, 'x', 'en-US')).toEqual(stored);
  });

  it('keeps a half-made section with what it has and empties what it lacks', () => {
    const read = draftOf({ v: 1, title: 'T', description: '', blocks: [{ id: 'h', kind: 'hero', heading: 'Only a heading' }, { id: 'q', kind: 'questions' }] }, 'x', 'de-DE');
    expect(read.blocks[0]).toEqual({ id: 'h', kind: 'hero', heading: 'Only a heading', text: '' });
    expect(read.blocks[1]).toEqual({ id: 'q', kind: 'questions', title: 'Fragen und Antworten', items: [{ question: '', answer: '' }] });
  });

  it('leaves out what is no section: an unknown kind, no id, an id twice, and a pay link or a footer', () => {
    const read = draftOf({ blocks: [{ id: 'a', kind: 'paylink' }, { kind: 'text', text: 'x' }, { id: 'f', kind: 'footer' }, { id: 't', kind: 'text', text: 'one' }, { id: 't', kind: 'text', text: 'two' }] }, 'Name', 'en-US');
    expect(read.blocks).toEqual([{ id: 't', kind: 'text', text: 'one' }]);
    expect(read.title).toBe('Name');
  });

  it('starts an empty page under the name when there is no draft, or it is not JSON', () => {
    expect(draftOf(null, 'Spring offer', 'en-US')).toEqual(newPage('Spring offer'));
    expect(draftOf('{not json', 'Spring offer', 'en-US')).toEqual(newPage('Spring offer'));
  });

  it('keeps a mark Milo left on a section it reads half made', () => {
    expect(draftOf({ blocks: [{ id: 'm', kind: 'heading', milo: true }] }, 'x', 'en-US').blocks[0]).toEqual({ id: 'm', kind: 'heading', milo: true, text: '' });
  });
});

describe('changes to the sections', () => {
  it('puts a new section after the one named, or at the end', () => {
    const start = page([hero, text]);
    expect(insertAfter(start, 'b1', spacer).blocks.map((block) => block.id)).toEqual(['b1', 'b3', 'b2']);
    expect(insertAfter(start, null, spacer).blocks.map((block) => block.id)).toEqual(['b1', 'b2', 'b3']);
    expect(insertAfter(start, 'gone', spacer).blocks.map((block) => block.id)).toEqual(['b1', 'b2', 'b3']);
  });

  it('adds no section past the 60 a page holds', () => {
    const full = page(Array.from({ length: 60 }, (_, index) => ({ id: `s${String(index)}`, kind: 'spacer' as const, size: 's' as const })));
    expect(insertAfter(full, null, spacer).blocks).toHaveLength(60);
  });

  it('moves a section one place, and not past either end', () => {
    const start = page([hero, text, spacer]);
    expect(move(start, 'b2', -1).blocks.map((block) => block.id)).toEqual(['b2', 'b1', 'b3']);
    expect(move(start, 'b2', 1).blocks.map((block) => block.id)).toEqual(['b1', 'b3', 'b2']);
    expect(move(start, 'b1', -1)).toBe(start);
    expect(move(start, 'b3', 1)).toBe(start);
  });

  it('removes a section', () => {
    expect(remove(page([hero, text]), 'b1').blocks).toEqual([text]);
  });

  it('takes Milo’s mark off a section a person changes, and only that one', () => {
    const start = page([{ ...hero, milo: true }, { ...text, milo: true }]);
    const after = update(start, 'b1', (block) => ({ ...block, heading: 'A better heading' }) as typeof block);
    expect(after.blocks[0]).toEqual({ ...hero, heading: 'A better heading' });
    expect(after.blocks[1]?.milo).toBe(true);
    expect(markCount(after)).toBe(1);
    expect(markCount(checkAll(after))).toBe(0);
  });

  it('gives a new section an id no section of the page has', () => {
    const ids = ['b1', 'b1', 'b9'];
    expect(freshId(page([hero]), () => ids.shift() ?? 'z')).toBe('b9');
  });

  it('makes a blank section of every kind, which the canvas can draw and publishing refuses until it is filled', () => {
    for (const kind of ['hero', 'heading', 'text', 'picture', 'button', 'columns', 'features', 'quote', 'questions', 'form'] as const) {
      const blank = blankBlock(kind, 'n1', 'en-US');
      expect(blank.kind).toBe(kind);
      expect(parseLandingPage(page([blank])).ok, kind).toBe(false);
    }
    expect(parseLandingPage(page([blankBlock('spacer', 'n1', 'en-US')])).ok).toBe(true);
  });
});

describe('publishing', () => {
  it('finds nothing wrong with a whole page at a good address, and copies it as it is', () => {
    const whole = page([hero, text]);
    expect(problemsOf(whole, 'open-day')).toEqual([]);
    expect(publishable(whole)).toEqual(whole);
  });

  it('refuses a page with Milo’s mark left on it, and lists it', () => {
    const marked = page([{ ...hero, milo: true }, text]);
    expect(publishable(marked)).toBeNull();
    expect(problemsOf(marked, 'open-day')).toEqual([{ code: 'marked', count: 1 }]);
    expect(publishable(checkAll(marked))).not.toBeNull();
  });

  it('refuses an address that breaks the slug rule, or one Adminium does not take', () => {
    expect(problemsOf(page([hero]), 'Open Day')).toEqual([{ code: 'slug' }]);
    // A word the addresses keep is Adminium's to judge: its status read says so, and the page passes it on.
    expect(problemsOf(page([hero]), 'login')).toEqual([]);
    expect(problemsOf(page([hero]), 'login', true)).toEqual([{ code: 'slug' }]);
  });

  it('refuses a page with no section', () => {
    expect(problemsOf(page([]), 'open-day')).toEqual([{ code: 'empty' }]);
  });

  it('names each field a page cannot go live with, on its section', () => {
    const found = problemsOf(page([{ ...hero, heading: '' }, { id: 'b4', kind: 'button', label: 'Book', link: { kind: 'url', href: 'javascript:alert(1)' } }]), 'open-day');
    expect(found).toContainEqual({ code: 'field', block: 'b1', field: 'heading', issue: 'too_small' });
    expect(found).toContainEqual({ code: 'field', block: 'b4', field: 'href', issue: 'link-https' });
  });

  it('refuses a link to the form on a page that has no form', () => {
    const found = problemsOf(page([{ id: 'b4', kind: 'button', label: 'Book', link: { kind: 'form' } }]), 'open-day');
    expect(found).toContainEqual({ code: 'field', block: 'b4', field: 'link', issue: 'link-form-missing' });
  });

  it('tells a working copy that says what the published one says, whatever order its keys are in', () => {
    expect(samePage(page([hero]), JSON.stringify({ blocks: [{ text: hero.text, heading: hero.heading, kind: 'hero', id: 'b1' }], description: 'Come and sit in the new booths.', title: 'Showroom open day', v: 1 }))).toBe(true);
    expect(samePage(page([hero]), page([text]))).toBe(false);
  });
});

describe('a page’s address', () => {
  it('is made from the name, in lower case with dashes', () => {
    expect(slugOf('Spring open day')).toBe('spring-open-day');
    expect(slugOf('Café à Paris!')).toBe('cafe-a-paris');
    expect(slugOf('عرض الربيع')).toBe('page');
    // A word the addresses keep has the shape of one: Adminium judges it once saved (`addressRefused`).
    expect(slugOf('Login')).toBe('login');
  });

  it('is typed in lower case, with spaces as dashes', () => {
    expect(typedSlug('Open Day')).toBe('open-day');
  });

  it('takes the first one nobody holds', async () => {
    const held = new Set(['new-page', 'new-page-2']);
    expect(await freeSlug('new-page', async (slug) => held.has(slug))).toBe('new-page-3');
    expect(await freeSlug('new-page', async () => true)).toBeNull();
  });
});
