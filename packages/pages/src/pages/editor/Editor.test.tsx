// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Refused, resetWorld, seed, world, type Call } from '../testing/host.tsx';
import { DRAFT_PATH, FORMS_PATH, picturesPath, statusPath, SURFACES_PATH, DOMAINS_PATH } from './engine.ts';
import { resetEditors, SAVE_DELAY_MS } from './store.ts';

const { default: LandingPages } = await import('../landing/index.tsx');

type Row = Record<string, string | number | boolean | null>;

const HERO = { id: 'h1', kind: 'hero', heading: 'Open day at our Leeds showroom', text: 'Sit in the new booths and try the desks.' };
const TEXT = { id: 't1', kind: 'text', text: 'Talk to the people who fit them.' };
const FEATURES = { id: 'f1', kind: 'features', items: [{ icon: 'volume-x', heading: 'Quiet inside', text: 'Talk at a normal voice.' }] };

function pageRow(more: Partial<Record<string, unknown>> = {}): Row {
  const draft = (more['draft'] as unknown) ?? { v: 1, title: 'Showroom open day', description: 'Sit in the new booths.', blocks: [HERO, TEXT, FEATURES] };
  return {
    id: 7,
    name: 'Showroom open day',
    slug: 'open-day',
    state: 'draft',
    language: 'en-US',
    published: null,
    published_at: null,
    updated_at: '2026-11-03T10:00:00.000Z',
    ...more,
    // Text, the way SQLite hands a JSON column back.
    draft: JSON.stringify(draft),
  } as Row;
}

interface Serve {
  notice?: boolean;
  reach?: string;
  hosts?: { host: string; home: string }[];
  homeOf?: string[];
  forms?: unknown[];
  other?: (method: string, path: string, payload: unknown) => unknown;
}
function serve(more: Serve = {}): void {
  world.api = (method, path, payload) => {
    if (method === 'get' && path === statusPath('7')) {
      const hosts = more.hosts ?? [];
      return {
        data: {
          reach: { state: more.reach ?? 'reachable', proxyUnchecked: false },
          notice: more.notice ?? true,
          publicOrigin: 'https://crm.example.test',
          hosts,
          page: {
            key: '7',
            slug: 'open-day',
            state: 'live',
            addresses: [...hosts.map((one) => ({ host: one.host, url: `https://${one.host}/x/pages/open-day`, home: (more.homeOf ?? []).includes(one.host) })), { host: 'crm.example.test', url: 'https://crm.example.test/x/pages/open-day', home: false }],
            canonical: 'https://crm.example.test/x/pages/open-day',
            homeOf: more.homeOf ?? [],
          },
        },
      };
    }
    if (method === 'get' && path === FORMS_PATH) return { data: { forms: more.forms ?? [] } };
    return more.other?.(method, path, payload) ?? {};
  };
}

const open = async (key = '7'): Promise<void> => {
  world.splat = `pages/page/${key}`;
  render(<LandingPages />);
  await screen.findByRole('tablist', { name: 'Inspector' });
};
const updates = (): Call[] => world.calls.filter((call) => call.kind === 'update' && call.table === 'pages');
const moves = (): Call[] => world.calls.filter((call) => call.kind === 'move' && call.table === 'pages');
const stored = (): Record<string, unknown> => world.tables['pages']?.[0] as Record<string, unknown>;
const draftNow = (): { blocks: { id: string; kind: string; milo?: boolean }[] } => {
  const value = stored()['draft'];
  return (typeof value === 'string' ? JSON.parse(value) : value) as { blocks: { id: string; kind: string; milo?: boolean }[] };
};
const toastTitles = (): string[] => world.toasts.map((toast) => String(toast.title));
const sectionsList = (): HTMLElement => document.querySelector('ol[data-lpe-rows]') as HTMLElement;
const publishPanel = (): HTMLElement => screen.getByRole('dialog', { name: /Publish|Update/ });
/** The picker: the one dialog open as a modal (the test host draws a popover's panel always). */
const pickerDialog = (): HTMLElement => document.querySelector('[data-part="modal"]') as HTMLElement;
/** The canvas's own rules: its ring, its "Milo · check" chips and the line where a section goes. */
const canvasRules = (): string => document.querySelector('[data-lpe-frame-wrap] style')?.textContent ?? '';
const miloChips = (): number => (canvasRules().match(/::after\{content:"Milo · check";\}/g) ?? []).length;
const wideButton = (name: string): HTMLElement => screen.getAllByRole('button', { name })[0] as HTMLElement;

beforeEach(() => {
  resetWorld();
  resetEditors();
  serve();
});
afterEach(() => cleanup());

describe('the canvas', () => {
  it('draws the page with the shared renderer, one "Edit" button per section and one main heading', async () => {
    seed('pages', [pageRow()]);
    await open();
    expect(screen.getByRole('heading', { level: 1, name: 'Open day at our Leeds showroom' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit Hero' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit Text' })).toBeTruthy();
    expect(document.querySelectorAll('[data-lpe-frame] [data-block-id]')).toHaveLength(3);
  });

  it('draws an Arabic page right to left, in Arabic', async () => {
    seed('pages', [pageRow({ language: 'ar-EG', draft: { v: 1, title: 'كبائن', description: 'د', blocks: [{ id: 'h', kind: 'heading', text: 'كبائن هادئة للمكاتب المفتوحة' }] } })]);
    await open();
    const page = document.querySelector('[data-lpe-frame] .lp') as HTMLElement;
    expect(page.getAttribute('dir')).toBe('rtl');
    expect(page.getAttribute('lang')).toBe('ar-EG');
  });

  it('selects a section from its "Edit" button, rings it and opens its settings', async () => {
    seed('pages', [pageRow()]);
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Text' }));
    expect(document.querySelector('[data-lpe-frame-wrap] style')?.textContent).toContain('[data-block-id="t1"]');
    expect(screen.getByRole('tab', { name: 'Design' }).getAttribute('aria-selected')).toBe('true');
    expect((screen.getByLabelText('Text') as HTMLTextAreaElement).value).toBe('Talk to the people who fit them.');
  });

  it('shows a page with no section as empty, with both ways to start', async () => {
    seed('pages', [pageRow({ draft: { v: 1, title: 'x', description: '', blocks: [] } })]);
    await open();
    expect(screen.getByText('This page is empty')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Draft with Milo' }).length).toBeGreaterThan(0);
  });
});

describe('the sections', () => {
  it('adds a section after the selected one, says so, selects it, and writes the draft once it is still', async () => {
    seed('pages', [pageRow()]);
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Hero' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a section after this one' }));
    const picker = pickerDialog();
    expect(within(picker).getByText('Goes after Hero')).toBeTruthy();
    expect(canvasRules()).toContain('[data-block-id="h1"]::before{content:"New section goes here";}');
    // No pay link and no footer to pick.
    expect(within(picker).queryByText('Pay link')).toBeNull();
    expect(within(picker).queryByText('Footer')).toBeNull();
    fireEvent.click(within(picker).getByRole('button', { name: /Quote/ }));
    expect(toastTitles()).toContain('Quote added after Hero.');
    await waitFor(() => expect(updates().length).toBe(1), { timeout: SAVE_DELAY_MS * 4 });
    expect(draftNow().blocks.map((block) => block.kind)).toEqual(['hero', 'quote', 'text', 'features']);
  });

  it('adds a second section of a kind the page already has', async () => {
    seed('pages', [pageRow()]);
    await open();
    fireEvent.click(within(sectionsList().parentElement as HTMLElement).getByRole('button', { name: 'Add a section' }));
    expect(screen.getByText('Goes at the end of the page')).toBeTruthy();
    fireEvent.click(within(pickerDialog()).getByRole('button', { name: /^Hero/ }));
    expect(toastTitles()).toContain('Hero added after Features.');
    fireEvent.click(screen.getByRole('tab', { name: 'Sections' }));
    expect(within(sectionsList()).getAllByText('Hero')).toHaveLength(2);
  });

  it('moves a section with Move up, says its new place, and keeps the focus on it', async () => {
    seed('pages', [pageRow()]);
    await open();
    const up = screen.getByRole('button', { name: 'Move Features up' });
    fireEvent.click(up);
    expect(screen.getByText('Features moved to 2 of 3.')).toBeTruthy();
    expect(within(sectionsList()).getAllByRole('button', { pressed: false }).map((button) => button.textContent)).toEqual(['Hero', 'Features', 'Text']);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Move Features up');
    fireEvent.click(screen.getByRole('button', { name: 'Move Features up' }));
    expect(screen.getByText('Features moved to 1 of 3.')).toBeTruthy();
    // At the top it cannot go further up: the focus is on Move down.
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Move Features down');
    expect(screen.getByRole('button', { name: 'Move Features up' }).getAttribute('aria-disabled')).toBe('true');
  });

  it('takes a change back with Undo and puts it back with Redo', async () => {
    seed('pages', [pageRow()]);
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Move Features up' }));
    fireEvent.click(wideButton('Undo'));
    expect(within(sectionsList()).getAllByRole('button', { pressed: false }).map((button) => button.textContent)).toEqual(['Hero', 'Text', 'Features']);
    fireEvent.click(wideButton('Redo'));
    expect(within(sectionsList()).getAllByRole('button', { pressed: false }).map((button) => button.textContent)).toEqual(['Hero', 'Features', 'Text']);
  });

  it('removes a section', async () => {
    seed('pages', [pageRow()]);
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Text' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove this section' }));
    expect(toastTitles()).toContain('Text removed.');
    expect(document.querySelectorAll('[data-lpe-frame] [data-block-id]')).toHaveLength(2);
  });
});

describe('a reader who may not change pages', () => {
  it('sees the page and its settings, and no control that writes', async () => {
    world.cannot.add('update:pages');
    world.cannot.add('create:pages');
    world.cannot.add('move:pages:live');
    seed('pages', [pageRow()]);
    await open();
    expect(screen.getByText('You may read this page, not change it.')).toBeTruthy();
    for (const name of ['Undo', 'Redo', 'Draft with Milo', 'Add a section', 'Move Features up', 'Publish']) expect(screen.queryByRole('button', { name }), name).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Hero' }));
    expect((screen.getByLabelText('Heading') as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Remove this section' })).toBeNull();
    await act(async () => new Promise((resolve) => setTimeout(resolve, SAVE_DELAY_MS * 2)));
    expect(updates()).toEqual([]);
  });
});

describe('publishing', () => {
  it('publishes a draft: the working copy becomes the published one and the page goes live, in one move', async () => {
    seed('pages', [pageRow()]);
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(within(publishPanel()).getByText('Publish this page?')).toBeTruthy();
    expect(within(publishPanel()).getByText('https://crm.example.test/x/pages/open-day')).toBeTruthy();
    fireEvent.click(within(publishPanel()).getByRole('button', { name: 'Publish now' }));
    await waitFor(() => expect(moves()).toHaveLength(1));
    const values = (moves()[0]?.values as { to: string; values: Record<string, unknown> }).values;
    expect((moves()[0]?.values as { to: string }).to).toBe('live');
    expect(Object.keys(values)).toEqual(['published']);
    expect((values['published'] as { blocks: unknown[] }).blocks).toHaveLength(3);
    await waitFor(() => expect(toastTitles()).toContain('Published. The page is live.'));
  });

  it('says a page was published but nobody can reach it yet, when the public pages are out of reach', async () => {
    serve({ reach: 'network-off' });
    seed('pages', [pageRow()]);
    await open();
    await screen.findByText(/Public pages are switched off on this server\./);
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    fireEvent.click(within(publishPanel()).getByRole('button', { name: 'Publish now' }));
    await waitFor(() => expect(toastTitles()).toContain('Published, but visitors can’t reach the page yet.'));
  });

  it('keeps Publish off while the privacy notice is unset, and says where to set it', async () => {
    serve({ notice: false });
    seed('pages', [pageRow()]);
    await open();
    await screen.findAllByText(/Set your privacy notice first/);
    expect((screen.getByRole('button', { name: 'Publish' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('link', { name: 'Privacy & public pages' }).getAttribute('href') ?? screen.getByRole('link', { name: 'Privacy & public pages' }).textContent).toBeTruthy();
  });

  it('will not publish a page Milo wrote until a person has looked at it, and lists why', async () => {
    seed('pages', [pageRow({ draft: { v: 1, title: 'Spring open day', description: 'd', blocks: [{ ...HERO, milo: true }, TEXT] } })]);
    await open();
    expect(screen.getByRole('region', { name: 'Milo’s draft' })).toBeTruthy();
    expect(miloChips()).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    fireEvent.click(within(publishPanel()).getByRole('button', { name: 'Publish now' }));
    expect(within(publishPanel()).getByText('Not ready to publish')).toBeTruthy();
    expect(within(publishPanel()).getByText('Some sections still carry Milo’s mark. Look at each one, or press “Looks right”.')).toBeTruthy();
    expect(moves()).toEqual([]);
    // A person looks: the marks come off, and then it publishes.
    fireEvent.click(screen.getByRole('button', { name: 'Looks right' }));
    expect(miloChips()).toBe(0);
    fireEvent.click(within(publishPanel()).getByRole('button', { name: 'Publish now' }));
    await waitFor(() => expect(moves()).toHaveLength(1));
    const published = ((moves()[0]?.values as { values: Record<string, unknown> }).values['published'] as { blocks: { milo?: boolean }[] }).blocks;
    expect(published.some((block) => block.milo === true)).toBe(false);
  });

  it('lists a field the page cannot go live with, and shows it', async () => {
    seed('pages', [pageRow({ draft: { v: 1, title: 'x', description: 'd', blocks: [{ ...HERO, heading: '' }, TEXT] } })]);
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    fireEvent.click(within(publishPanel()).getByRole('button', { name: 'Publish now' }));
    expect(within(publishPanel()).getByText('Heading is empty.')).toBeTruthy();
    fireEvent.click(within(publishPanel()).getByRole('button', { name: 'Show me' }));
    expect(screen.getByLabelText('Heading')).toBeTruthy();
    expect(moves()).toEqual([]);
  });

  it('says what Adminium refused in its own words, and claims nothing was published', async () => {
    world.before = (kind, _table, values) => {
      if (kind === 'move' && (values as { to?: string }).to === 'live') throw new Refused('VALIDATION_FAILED', 'This page cannot be published while a section still carries Milo’s mark.', { reason: 'landing-marked' });
    };
    seed('pages', [pageRow()]);
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    fireEvent.click(within(publishPanel()).getByRole('button', { name: 'Publish now' }));
    await waitFor(() => expect(within(publishPanel()).getByRole('alert').textContent).toContain('This page can’t be published while a section still carries Milo’s mark. Look at each one first.'));
    expect(toastTitles()).not.toContain('Published. The page is live.');
    expect(stored()['state']).toBe('draft');
  });

  it('updates a live page that has changes with one write of its published copy', async () => {
    const draft = { v: 1, title: 'Showroom open day', description: 'Sit in the new booths.', blocks: [HERO, TEXT] };
    seed('pages', [pageRow({ state: 'live', draft, published: JSON.stringify({ ...draft, blocks: [HERO] }) })]);
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    expect(within(publishPanel()).getByText('Live')).toBeTruthy();
    fireEvent.click(within(publishPanel()).getByRole('button', { name: 'Publish the changes' }));
    await waitFor(() => expect(updates().some((call) => Object.keys(call.values as object).includes('published'))).toBe(true));
    expect(moves()).toEqual([]);
    await waitFor(() => expect(toastTitles()).toContain('Changes published. Visitors see them from now on.'));
  });

  it('asks before switching off a page that is a host’s home: keeping it on leaves it live', async () => {
    serve({ hosts: [{ host: 'events.example.test', home: '/x/pages/open-day' }], homeOf: ['events.example.test'] });
    const draft = { v: 1, title: 'Showroom open day', description: 'Sit in the new booths.', blocks: [HERO] };
    seed('pages', [pageRow({ state: 'live', draft, published: JSON.stringify(draft) })]);
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    await within(publishPanel()).findByText('https://crm.example.test/x/pages/open-day');
    const toggle = within(publishPanel()).getByRole('switch', { name: 'Show this page' });
    fireEvent.click(toggle);
    const ask = within(publishPanel()).getByRole('alertdialog');
    expect(ask.textContent).toContain('This page is the home of events.example.test.');
    // The switch says what is true: still on.
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(ask).getByRole('button', { name: 'Keep it on' }));
    expect(moves()).toEqual([]);
    fireEvent.click(toggle);
    fireEvent.click(within(within(publishPanel()).getByRole('alertdialog')).getByRole('button', { name: 'Switch it off' }));
    await waitFor(() => expect(moves().map((call) => (call.values as { to: string }).to)).toEqual(['off']));
  });
});

describe('Draft with Milo', () => {
  it('drafts the page into the working copy with every section marked, and "Looks right" takes the marks off', async () => {
    seed('pages', [pageRow({ draft: { v: 1, title: 'Spring open day', description: '', blocks: [] } })]);
    serve({ other: (method, path) => (method === 'post' && path === DRAFT_PATH ? { data: { page: { v: 1, title: 'Spring open day', description: 'Come in.', blocks: [{ ...HERO, milo: true }, { ...TEXT, milo: true }] }, left: [{ what: 'quote', block: 'q' }], tokens: 10 } } : undefined) });
    await open();
    fireEvent.click(screen.getAllByRole('button', { name: 'Draft with Milo' })[0] as HTMLElement);
    fireEvent.change(screen.getByLabelText('What is the page for?'), { target: { value: 'A page for our spring showroom open day with a booking form' } });
    fireEvent.click(screen.getByRole('button', { name: 'Draft it' }));
    await screen.findByRole('region', { name: 'Milo’s draft' });
    const asked = world.calls.find((call) => call.kind === 'api' && call.table === `post ${DRAFT_PATH}`);
    expect(asked?.values).toEqual({ description: 'A page for our spring showroom open day with a booking form', language: 'en-US', pageKey: '7' });
    expect(miloChips()).toBe(2);
    expect(toastTitles()).toContain('Milo drafted the page. Check each section.');
    fireEvent.click(screen.getByRole('button', { name: 'Looks right' }));
    expect(screen.queryByRole('region', { name: 'Milo’s draft' })).toBeNull();
    await waitFor(() => expect(draftNow().blocks.some((block) => block.milo === true)).toBe(false), { timeout: SAVE_DELAY_MS * 4 });
  });

  it('takes one section’s mark off when a person changes it', async () => {
    seed('pages', [pageRow({ draft: { v: 1, title: 'x', description: 'd', blocks: [{ ...HERO, milo: true }, { ...TEXT, milo: true }] } })]);
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Text' }));
    fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'Talk to the fitters.' } });
    expect(miloChips()).toBe(1);
  });

  it('puts the page back as it was with "Undo all"', async () => {
    seed('pages', [pageRow({ draft: { v: 1, title: 'Spring', description: '', blocks: [] } })]);
    serve({ other: (method, path) => (method === 'post' && path === DRAFT_PATH ? { data: { page: { v: 1, title: 'Spring', description: 'd', blocks: [{ ...TEXT, milo: true }] }, left: [], tokens: 1 } } : undefined) });
    await open();
    fireEvent.click(screen.getAllByRole('button', { name: 'Draft with Milo' })[0] as HTMLElement);
    fireEvent.change(screen.getByLabelText('What is the page for?'), { target: { value: 'An offer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Draft it' }));
    await screen.findByRole('region', { name: 'Milo’s draft' });
    fireEvent.click(screen.getByRole('button', { name: 'Undo all' }));
    expect(screen.getByText('This page is empty')).toBeTruthy();
    expect(toastTitles()).toContain('Draft removed. The page is empty again.');
  });

  it('says why Milo did not draft, and changes nothing', async () => {
    seed('pages', [pageRow({ draft: { v: 1, title: 'Spring', description: '', blocks: [] } })]);
    serve({
      other: (method, path) => {
        if (method === 'post' && path === DRAFT_PATH) throw new Refused('RATE_LIMITED', 'Your Milo allowance for today is used.', { reason: 'allowance' });
        return undefined;
      },
    });
    await open();
    fireEvent.click(screen.getAllByRole('button', { name: 'Draft with Milo' })[0] as HTMLElement);
    fireEvent.change(screen.getByLabelText('What is the page for?'), { target: { value: 'An offer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Draft it' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Your Milo allowance for today is used. Try again tomorrow.');
    expect(screen.getByText('This page is empty')).toBeTruthy();
  });
});

describe('pictures', () => {
  it('keeps a picture chosen from Files as the page’s own copy, and the page names that copy', async () => {
    seed('pages', [pageRow({ draft: { v: 1, title: 'x', description: 'd', blocks: [{ id: 'p1', kind: 'picture', picture: { file: '', alt: '' } }] } })]);
    serve({
      other: (method, path, payload) => {
        if (method === 'get' && path.startsWith('/api/v1/files?')) return { data: [{ id: 'LIB1', filename: 'booths.jpg', mime: 'image/jpeg', contentPath: '/api/v1/files/LIB1/content', deletedAt: null }], nextCursor: null };
        if (method === 'post' && path === picturesPath('7')) return { data: { id: payload !== null && (payload as { file?: string }).file === 'LIB1' ? 'OWN1' : 'x', mime: 'image/jpeg', sizeBytes: 10 } };
        return undefined;
      },
    });
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Picture' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose from Files' }));
    fireEvent.click(await screen.findByRole('button', { name: /booths\.jpg/ }));
    await waitFor(() => expect((document.querySelector('[data-lpe-frame] .lp-picture img') as HTMLImageElement | null)?.getAttribute('src')).toBe('/api/v1/landing/pages/pictures/OWN1?page=7'));
    fireEvent.change(screen.getByLabelText('Describe the picture'), { target: { value: 'Two grey booths' } });
    await waitFor(() => expect(JSON.stringify(draftNow())).toContain('"file":"OWN1"'), { timeout: SAVE_DELAY_MS * 4 });
  });

  it('keeps the picture as it was when Adminium refuses the file, and says why at once', async () => {
    seed('pages', [pageRow({ draft: { v: 1, title: 'x', description: 'd', blocks: [{ id: 'p1', kind: 'picture', picture: { file: 'OLD1', alt: 'Booths' } }] } })]);
    serve({
      other: (method, path) => {
        if (method === 'get' && path.startsWith('/api/v1/files?')) return { data: [{ id: 'SVG1', filename: 'logo.png', mime: 'image/png', contentPath: '/c', deletedAt: null }], nextCursor: null };
        if (method === 'post' && path === picturesPath('7')) throw new Refused('VALIDATION_FAILED', "This file can't be used.", { reason: 'picture-refused', why: 'type' });
        return undefined;
      },
    });
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Picture' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose from Files' }));
    fireEvent.click(await screen.findByRole('button', { name: /logo\.png/ }));
    expect((await screen.findByRole('alert')).textContent).toBe('This file can’t be used. Use a PNG, JPEG, WebP or GIF of up to 5 MB.');
    expect((document.querySelector('[data-lpe-frame] .lp-picture img') as HTMLImageElement).getAttribute('src')).toContain('OLD1');
  });

  it('asks for a description, or takes the picture as decoration', async () => {
    seed('pages', [pageRow({ draft: { v: 1, title: 'x', description: 'd', blocks: [{ id: 'p1', kind: 'picture', picture: { file: 'OLD1', alt: 'Booths' } }] } })]);
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Picture' }));
    fireEvent.click(screen.getByRole('checkbox'));
    expect((screen.getByLabelText('Describe the picture') as HTMLInputElement).disabled).toBe(true);
    expect((document.querySelector('[data-lpe-frame] .lp-picture img') as HTMLImageElement).getAttribute('alt')).toBe('');
  });
});

describe('the Form section', () => {
  const FORM = { addOn: 'forms', key: '12', name: 'Book a showroom visit', slug: 'book-a-visit', languages: ['de-DE'], ending: { kind: 'landing', addOn: 'pages', page: '8', broken: false } };

  it('picks one of the live forms, shows where it goes after sending, and links to the form', async () => {
    serve({ forms: [{ ...FORM, languages: ['en-US'] }] });
    seed('pages', [pageRow({ draft: { v: 1, title: 'x', description: 'd', blocks: [{ id: 'fm', kind: 'form', form: '', addOn: '' }] } }), { ...pageRow({ id: 8, slug: 'thanks', name: 'Thanks, see you there', state: 'live' }) }]);
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Form' }));
    await waitFor(() => expect(screen.getByRole('option', { name: 'Book a showroom visit' })).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Form'), { target: { value: 'forms:12' } });
    expect(screen.getByText('Goes to the page “Thanks, see you there”')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Edit this form →' })).toBeTruthy();
    expect(screen.queryByText(/has no English version/)).toBeNull();
  });

  it('warns when the form has no version in the page’s language', async () => {
    serve({ forms: [FORM] });
    seed('pages', [pageRow({ draft: { v: 1, title: 'x', description: 'd', blocks: [{ id: 'fm', kind: 'form', form: '12', addOn: 'forms' }] } })]);
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Form' }));
    expect(await screen.findByText('This form has no English version, so visitors don’t see it on this page. Add English to the form.')).toBeTruthy();
  });
});

describe('the page’s settings', () => {
  it('holds the address to the slug rule as it is typed, and saves it on its own', async () => {
    seed('pages', [pageRow()]);
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Page settings' }));
    const address = screen.getByLabelText('Address') as HTMLInputElement;
    fireEvent.change(address, { target: { value: 'Login' } });
    expect(address.value).toBe('login');
    fireEvent.blur(address);
    expect(screen.getAllByText('Use lower-case letters, digits and dashes; not a word the addresses use (api, login, account…).').length).toBeGreaterThan(0);
    expect(updates()).toEqual([]);
    fireEvent.change(address, { target: { value: 'spring open day' } });
    fireEvent.blur(address);
    await waitFor(() => expect(updates().map((call) => call.values)).toContainEqual({ slug: 'spring-open-day' }));
  });

  it('lists each pages host with the page’s address on it, and makes it a host’s home for someone who may', async () => {
    serve({
      hosts: [{ host: 'events.example.test', home: '/x/forms/book' }],
      other: (method, path) => {
        if (method === 'get' && path === SURFACES_PATH) return { domains: { 'events.example.test': { kind: 'pages', home: '/x/forms/book' }, 'shop.example.test': { kind: 'app', appKey: 'shop', side: 'customer' } } };
        return undefined;
      },
    });
    const draft = { v: 1, title: 'Showroom open day', description: 'Sit in the new booths.', blocks: [HERO] };
    seed('pages', [pageRow({ state: 'live', draft, published: JSON.stringify(draft) })]);
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Page settings' }));
    expect(await screen.findByText('https://events.example.test/x/pages/open-day')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Make this the home of events.example.test' }));
    await waitFor(() => expect(world.calls.find((call) => call.table === `put ${DOMAINS_PATH}`)?.values).toEqual({ domains: { 'events.example.test': { kind: 'pages', home: '/x/pages/open-day' }, 'shop.example.test': { kind: 'app', appKey: 'shop', side: 'customer' } } }));
  });

  it('offers no home and no Hosted apps link to someone who may not change the hosts', async () => {
    serve({
      other: (method, path) => {
        if (method === 'get' && path === SURFACES_PATH) throw new Refused('FORBIDDEN');
        return undefined;
      },
    });
    seed('pages', [pageRow()]);
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Page settings' }));
    expect(screen.getByText('None yet.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Set one up in Hosted apps' })).toBeNull();
  });

  it('makes a copy for another language, at an address nobody holds', async () => {
    seed('pages', [pageRow(), pageRow({ id: 9, slug: 'open-day-copy', name: 'Other' })]);
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Page settings' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Make a copy' })[0] as HTMLElement);
    await waitFor(() => expect(world.calls.find((call) => call.kind === 'create')).toBeTruthy());
    const made = world.calls.find((call) => call.kind === 'create')?.values as Record<string, unknown>;
    expect(made['name']).toBe('Showroom open day (copy)');
    expect(made['slug']).toBe('open-day-copy-2');
    await waitFor(() => expect(world.navigated.at(-1)?.to).toMatch(/^\/add-ons\/pages\/pages\/page\/\d+$/));
  });
});

describe('a new page', () => {
  it('is made at once as a draft at an address nobody holds, and opened, with Milo’s dialog when asked', async () => {
    seed('pages', [pageRow({ slug: 'new-page' })]);
    world.splat = 'pages/new';
    world.search = { milo: '1' };
    render(<LandingPages />);
    await waitFor(() => expect(world.navigated).toHaveLength(1));
    const made = world.calls.find((call) => call.kind === 'create')?.values as Record<string, unknown>;
    expect(made).toMatchObject({ name: 'New page', slug: 'new-page-2', language: 'en-US' });
    expect(world.navigated[0]).toMatchObject({ search: { milo: '1' }, replace: true });
  });
});
