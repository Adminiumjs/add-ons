// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Refused, resetWorld, seed, world } from '../testing/host.tsx';
import { ANSWERS, DANA, INES, MARTA, NOW, SAM, TOMAS, VISITOR, chatCalls, conversation, messages, presence, seedInbox, type Answered } from '../testing/chats.ts';
import { Inbox } from './Inbox.tsx';

async function draw(more: { conversation?: string | null; milo?: boolean; answer?: Answered; width?: number } = {}): Promise<ReturnType<typeof render>> {
  seedInbox({ ...(more.milo === undefined ? {} : { milo: more.milo }), ...(more.answer === undefined ? {} : { answer: more.answer }) });
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: more.width ?? 1440 });
  const { wordsFor } = await import('../shared/messages.ts');
  const strings = await import('../strings/index.ts');
  const t = wordsFor(strings.SHARED, strings.INBOX, strings.THREAD, strings.RAIL);
  const view = render(<Inbox t={t} conversationId={more.conversation === undefined ? '1' : more.conversation} />);
  // The signed-in person, the people and the presence read arrive after the first draw.
  await act(async () => undefined);
  await act(async () => undefined);
  return view;
}

const rows = (): HTMLElement[] => screen.getAllByRole('listitem').filter((item) => item.closest('[role="list"]')?.parentElement?.querySelector('h2') !== null);
const rowNames = (): string[] => rows().map((row) => row.querySelector('bdi')?.textContent ?? '');
const filter = (name: RegExp): HTMLElement => within(screen.getByRole('group', { name: 'Filter conversations' })).getByRole('button', { name });
const log = (): HTMLElement => screen.getByRole('log', { name: 'Conversation' });

beforeEach(() => {
  const start = performance.now();
  vi.spyOn(Date, 'now').mockImplementation(() => NOW + (performance.now() - start));
  resetWorld();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the inbox (comp board 2)', () => {
  it('lists the website’s chats, newest first, each with the Website chip, and opens the one the address names', async () => {
    await draw();
    expect(screen.getByRole('heading', { name: 'Chat', level: 2 })).toBeTruthy();
    expect(rowNames()).toEqual(['Marta Kovac', 'Visitor', 'Tomas Reidy', 'Ines Vaughan']);
    for (const row of rows()) expect(within(row).getByText('Website')).toBeTruthy();
    expect(within(rows()[0]!).getByRole('button').getAttribute('aria-current')).toBe('true');
    expect(screen.getByRole('heading', { name: 'Chat', level: 2 }).parentElement?.querySelector('[aria-label="Chat settings"]')).toBeTruthy();
  });

  it('marks a chat that waits with the amber dot and its reader name', async () => {
    await draw();
    expect(within(rows()[0]!).getByRole('img', { name: 'Waiting for a person' })).toBeTruthy();
    expect(within(rows()[3]!).queryByRole('img', { name: 'Waiting for a person' })).toBeNull();
  });

  it('follows the conversations and the messages live, where the host can', async () => {
    await draw();
    expect(world.live).toEqual(expect.arrayContaining([{ table: 'conversations', enabled: true }, { table: 'messages', enabled: true }]));
  });

  it('filters as a toggle group: All at the start, Waiting oldest first with how long each waited, and Mine', async () => {
    await draw();
    expect(screen.getByRole('group', { name: 'Filter conversations' })).toBeTruthy();
    expect(filter(/^All$/).getAttribute('aria-pressed')).toBe('true');
    expect(filter(/Waiting for a person/).getAttribute('aria-pressed')).toBe('false');
    expect(within(filter(/Waiting for a person/)).getByText('3')).toBeTruthy();
    fireEvent.click(filter(/Waiting for a person/));
    expect(filter(/Waiting for a person/).getAttribute('aria-pressed')).toBe('true');
    // Tomas waited from 09:05, the visitor from 09:22, Marta from 09:33: oldest first, with the minutes waited.
    expect(rowNames()).toEqual(['Tomas Reidy', 'Visitor', 'Marta Kovac']);
    expect(within(rows()[0]!).getByText('30 min')).toBeTruthy();
    expect(within(rows()[2]!).getByText('2 min')).toBeTruthy();
    fireEvent.click(filter(/^Mine$/));
    expect(rowNames()).toEqual(['Ines Vaughan']);
  });

  it('finds a chat by what was typed in the search', async () => {
    await draw();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search conversations…' }), { target: { value: 'colleagues' } });
    expect(rowNames()).toEqual(['Tomas Reidy']);
  });
});

describe('a thread (comp board 2, 2f)', () => {
  it('draws the start line, the visitor’s messages, the automatic answer naming its answer, and the staff line from its event', async () => {
    await draw();
    const thread = log();
    expect(within(thread).getByText((_, node) => node?.textContent === 'Chat started on www.meridian.example/showroom · 09:30' && node.tagName === 'P')).toBeTruthy();
    expect(within(thread).getByText('do you take away our old desks?')).toBeTruthy();
    expect(within(thread).getByText('Automatic answer')).toBeTruthy();
    expect(within(thread).getByText('From: Do you take old furniture away?')).toBeTruthy();
    // The visitor pressed "Talk to a person".
    expect(within(thread).getByText((_, node) => node?.textContent === 'Marta asked for a person · 09:33' && node.tagName === 'P')).toBeTruthy();
  });

  it('says "Handed to a person" when the automatic answers handed the chat over themselves, never that the visitor asked', async () => {
    await draw({ conversation: '3' });
    expect(within(log()).getByText((_, node) => node?.textContent === 'Handed to a person · 09:05' && node.tagName === 'P')).toBeTruthy();
    expect(within(log()).queryByText(/asked for a person/)).toBeNull();
  });

  it('has a waiting pill and Take over, Make an enquiry and Close chat for someone who may answer, and no attachment button', async () => {
    await draw();
    expect(screen.getAllByText('Waiting for a person').some((node) => node.closest('header') !== null)).toBe(true);
    expect(screen.getByRole('button', { name: 'Take over' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Make an enquiry' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close chat' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /attachment/i })).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Write a message…' })).toBeTruthy();
  });

  it('takes over through Adminium, and says so', async () => {
    await draw({ answer: (method, path) => (method === 'post' && path.endsWith('/take') ? { data: { id: '1', state: 'open' } } : undefined) });
    fireEvent.click(screen.getByRole('button', { name: 'Take over' }));
    await waitFor(() => expect(chatCalls()).toContain('post /api/v1/chat/live-chat/conversations/1/take'));
    await waitFor(() => expect(world.toasts.map((toast) => toast.title)).toContain('You took over. Automatic answers stopped in this chat.'));
  });

  it('on a 409 "taken", says who is answering, and offers to take it over anyway', async () => {
    await draw({
      answer: (method, path, payload) => {
        if (method === 'post' && path.endsWith('/take') && (payload as { force?: boolean }).force !== true) throw new Refused('CONFLICT', 'Sam is answering this chat.', { reason: 'taken', by: { id: SAM, name: 'Sam Okafor', firstName: 'Sam', initials: 'SO' } });
        if (method === 'post' && path.endsWith('/take')) return { data: { id: '1', state: 'open' } };
        return undefined;
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Take over' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Sam is answering this chat.'));
    expect(screen.getByText('Sam is answering')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Take over anyway' }));
    await waitFor(() => expect(world.calls.filter((call) => call.table.endsWith('/take')).map((call) => call.values)).toEqual([{}, { force: true }]));
  });

  it('shows "Sam is answering" on a chat a colleague holds', async () => {
    seed('conversations', []);
    await draw();
    seed('conversations', [{ ...MARTA, state: 'open', taken_by: SAM }]);
    await act(async () => undefined);
    expect(screen.getByText('Sam is answering')).toBeTruthy();
  });

  it('sends a reply as the person’s own press, through Adminium, and empties the box', async () => {
    await draw({ answer: (method, path) => (method === 'post' && path.endsWith('/reply') ? { data: { message: {}, conversation: {}, presence: 'on-page', mailed: false, reason: null } } : undefined) });
    const box = screen.getByRole('textbox', { name: 'Write a message…' }) as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: 'Hi Marta, I’m Dana.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(world.calls.find((call) => call.table.endsWith('/reply'))?.values).toEqual({ body: 'Hi Marta, I’m Dana.' }));
    await waitFor(() => expect(box.value).toBe(''));
  });

  it('while the automatic answers still have a chat, says so, says sending takes it over, and takes it before the reply', async () => {
    seedInbox();
    await draw({ conversation: '9', answer: (method) => (method === 'post' ? { data: { message: {}, conversation: {}, presence: 'on-page', mailed: false, reason: null } } : undefined) });
    seed('conversations', [conversation(9, { name: 'Ruth Adeyemi', state: 'bot' })]);
    await act(async () => undefined);
    expect(screen.getByText('Automatic answers are on in this chat. Take over stops them.')).toBeTruthy();
    expect(screen.getByText('Sending also takes over this chat.')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Write a message…' }), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(chatCalls().filter((call) => call.startsWith('post'))).toEqual(['post /api/v1/chat/live-chat/conversations/9/take', 'post /api/v1/chat/live-chat/conversations/9/reply']));
  });

  it('on a chat a person already has, shows neither the automatic answers’ line nor the send hint', async () => {
    await draw();
    expect(screen.queryByText('Automatic answers are on in this chat. Take over stops them.')).toBeNull();
    expect(screen.queryByText('Sending also takes over this chat.')).toBeNull();
  });

  it('closes a chat, and offers Reopen on a closed one, with the closed note and no Send', async () => {
    await draw({ answer: (method, path) => (method === 'post' && path.endsWith('/close') ? { data: { id: '1', state: 'closed' } } : undefined) });
    fireEvent.click(screen.getByRole('button', { name: 'Close chat' }));
    await waitFor(() => expect(chatCalls()).toContain('post /api/v1/chat/live-chat/conversations/1/close'));
    cleanup();
    await draw({ conversation: '5' });
    expect(screen.getByRole('button', { name: 'Reopen chat' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Close chat' })).toBeNull();
    expect(screen.getByText('This chat is closed.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(log()).getByText('Dana closed the chat')).toBeTruthy();
  });

  it('makes an enquiry, then shows its chip and the "Contact" row instead of the button', async () => {
    await draw({ answer: (method, path) => (method === 'post' && path.endsWith('/enquiry') ? { data: { became: { connectionId: 'c1', tableId: 't1', table: 'crm:enquiries', key: '1043' }, conversation: {} } } : undefined) });
    expect(screen.queryByText('Contact')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Make an enquiry' }));
    await waitFor(() => expect(screen.getByText('Enquiry 1043')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Make an enquiry' })).toBeNull();
    expect(world.toasts.map((toast) => toast.title)).toContain('Enquiry 1043 made in enquiries');
  });
});

describe('Milo, only while the chat’s Milo drafting is on', () => {
  it('hides "Draft with Milo" and "Ask Milo" when it is off', async () => {
    await draw({ milo: false });
    expect(screen.queryByRole('button', { name: 'Draft with Milo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ask Milo' })).toBeNull();
  });

  it('shows both when it is on; a draft fills the box with its strip, and is never sent by itself', async () => {
    await draw({ milo: true, answer: (method, path) => (method === 'post' && path.endsWith('/draft') ? { data: { draft: 'Hi Marta, I’m Dana from Meridian.', tokens: 120 } } : undefined) });
    expect(screen.getByRole('button', { name: 'Ask Milo' }).getAttribute('title')).toBe('Ask Milo about this conversation');
    fireEvent.click(screen.getByRole('button', { name: 'Draft with Milo' }));
    await waitFor(() => expect((screen.getByRole('textbox', { name: 'Write a message…' }) as HTMLTextAreaElement).value).toBe('Hi Marta, I’m Dana from Meridian.'));
    expect(screen.getByText('Milo wrote this draft — read it before sending')).toBeTruthy();
    expect(chatCalls().some((call) => call.endsWith('/reply'))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect((screen.getByRole('textbox', { name: 'Write a message…' }) as HTMLTextAreaElement).value).toBe('');
  });

  it('puts what was typed back when a draft replaced it', async () => {
    await draw({ milo: true, answer: (method, path) => (method === 'post' && path.endsWith('/draft') ? { data: { draft: 'Milo’s words.', tokens: 10 } } : undefined) });
    fireEvent.change(screen.getByRole('textbox', { name: 'Write a message…' }), { target: { value: 'My own words' } });
    fireEvent.click(screen.getByRole('button', { name: 'Draft with Milo' }));
    await waitFor(() => expect(world.toasts.at(-1)?.title).toBe('Milo’s draft replaced what you wrote.'));
    act(() => world.toasts.at(-1)?.action?.onAction());
    expect((screen.getByRole('textbox', { name: 'Write a message…' }) as HTMLTextAreaElement).value).toBe('My own words');
  });

  it('presses Milo’s own shortcut on the window for "Ask Milo"', async () => {
    await draw({ milo: true });
    const pressed: KeyboardEvent[] = [];
    const listen = (event: KeyboardEvent): void => void pressed.push(event);
    window.addEventListener('keydown', listen);
    fireEvent.click(screen.getByRole('button', { name: 'Ask Milo' }));
    window.removeEventListener('keydown', listen);
    expect(pressed.map((event) => event.key)).toEqual(['.']);
  });
});

describe('a reader who may not answer', () => {
  it('reads the chat, and sees no Take over, no Reply and no Close', async () => {
    world.cannot.add('update:conversations');
    await draw();
    expect(within(log()).getByText('do you take away our old desks?')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Take over' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close chat' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Make an enquiry' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Write a message…' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
  });

  it('who may not read the chats at all is told so, and nothing is read', async () => {
    world.closed.add('conversations');
    await draw();
    expect(screen.getByText('You do not have permission to open this')).toBeTruthy();
  });
});

describe('the side rail (comp 2b, 2f, 2h)', () => {
  it('names the visitor, their e-mail "· not confirmed", where they came from, when and in what language, and the automatic answers used', async () => {
    await draw();
    const rail = screen.getByRole('complementary', { name: 'Visitor details' });
    expect(within(rail).getByText('Marta Kovac')).toBeTruthy();
    expect(within(rail).getByText('marta.kovac@cobaltlegal.example')).toBeTruthy();
    expect(within(rail).getByText('· not confirmed')).toBeTruthy();
    expect(within(rail).getByRole('link', { name: 'www.meridian.example/showroom' }).getAttribute('href')).toBe('https://www.meridian.example/showroom');
    expect(within(rail).getByText('09:30')).toBeTruthy();
    expect(within(rail).getByText('English')).toBeTruthy();
    expect(within(rail).getByText('Automatic answers in this chat')).toBeTruthy();
    expect(within(rail).getByText('Do you take old furniture away?')).toBeTruthy();
    expect(within(rail).getByText('On the page · now')).toBeTruthy();
  });

  it('says "Visitor — no e-mail yet" for a visitor who left nothing', async () => {
    await draw({ conversation: '2' });
    expect(within(screen.getByRole('complementary', { name: 'Visitor details' })).getByText('Visitor — no e-mail yet')).toBeTruthy();
  });

  it('has a "Contact" row only once the chat became a row, never from the typed e-mail', async () => {
    await draw();
    expect(within(screen.getByRole('complementary', { name: 'Visitor details' })).queryByText('Contact')).toBeNull();
    cleanup();
    seedInbox();
    await draw();
    seed('conversations', [{ ...MARTA, became_table: 'crm:enquiries', became_key: '1043' }]);
    await act(async () => undefined);
    const rail = screen.getByRole('complementary', { name: 'Visitor details' });
    expect(within(rail).getByText('Contact')).toBeTruthy();
    expect(within(rail).getByText('1043 in enquiries')).toBeTruthy();
  });

  it('says when the visitor left the page', async () => {
    await draw({ answer: (_method, path) => (path.endsWith('/presence') ? presence('left', null) : undefined) });
    expect(screen.getByRole('complementary', { name: 'Visitor details' }).textContent).toContain('Left the page · 10:02');
  });
});

describe('the line under the composer once the visitor left (2f, 2g)', () => {
  const line = (): string => screen.getByText((_, node) => node?.tagName === 'P' && (node.textContent ?? '').includes('has left the page')).textContent ?? '';

  it('says the reply also goes by e-mail when it will', async () => {
    await draw({ answer: (_method, path) => (path.endsWith('/presence') ? presence('left', null) : undefined) });
    expect(line()).toBe('Marta has left the page. Your reply also goes to marta.kovac@cobaltlegal.example by e-mail.');
  });

  it('gives the mail server’s reason with its link to the e-mail settings', async () => {
    await draw({ answer: (_method, path) => (path.endsWith('/presence') ? presence('left', 'no-mail-server') : undefined) });
    expect(line()).toBe('Marta has left the page. Your reply shows only if Marta comes back. E-mail isn’t set up: Workspace settings → Email.');
    expect(screen.getByRole('link', { name: 'Workspace settings → Email' }).getAttribute('href')).toBe('/studio/settings');
  });

  it('gives the public address’s reason with its link to Privacy and public pages', async () => {
    await draw({ answer: (_method, path) => (path.endsWith('/presence') ? presence('left', 'no-public-origin') : undefined) });
    expect(line()).toBe('Marta has left the page. Your reply shows only if Marta comes back. E-mail can’t go out: this server has no public address. Privacy and public pages.');
    expect(screen.getByRole('link', { name: 'Privacy and public pages' }).getAttribute('href')).toBe('/studio/privacy');
  });

  it('says nothing while the visitor is on the page', async () => {
    await draw();
    expect(screen.queryByText((_, node) => node?.tagName === 'P' && (node.textContent ?? '').includes('has left the page'))).toBeNull();
  });
});

describe('at narrower widths (comp 2-mid, 2-phone)', () => {
  it('below 1180, puts the side rail behind the info button', async () => {
    await draw({ width: 1024 });
    expect(screen.queryByRole('complementary', { name: 'Visitor details' })).toBeNull();
    const info = screen.getByRole('button', { name: 'Visitor details' });
    expect(info.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(info);
    expect(within(document.querySelector('[data-part="sheet"]') as HTMLElement).getByRole('complementary', { name: 'Visitor details' })).toBeTruthy();
  });

  it('keeps room for the dashboard’s Milo bubble beside the composer once the side rail is not beside it', async () => {
    await draw({ width: 1024 });
    expect(screen.getByRole('textbox', { name: 'Write a message…' }).closest('[data-sticky-footer]')).not.toBeNull();
    cleanup();
    await draw({ width: 1440 });
    expect(screen.getByRole('textbox', { name: 'Write a message…' }).closest('[data-sticky-footer]')).toBeNull();
  });

  it('below 700, shows the thread first, and Back goes to the inbox', async () => {
    await draw({ width: 390 });
    expect(screen.queryByRole('heading', { name: 'Chat', level: 2 })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back to conversations' }));
    expect(screen.getByRole('heading', { name: 'Chat', level: 2 })).toBeTruthy();
  });
});

describe('the comps’ fixtures', () => {
  it('are the comps’ own: four website chats and the four answers', () => {
    expect([MARTA, VISITOR, TOMAS, INES].map((row) => row['name'])).toEqual(['Marta Kovac', null, 'Tomas Reidy', 'Ines Vaughan']);
    expect(ANSWERS).toHaveLength(4);
    expect(messages().filter((row) => row['event'] === 'closed')[0]?.['author_id']).toBe(DANA);
  });
});
