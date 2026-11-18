// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Refused, resetWorld, seed, world } from '../testing/host.tsx';
import { ANSWERS, PEOPLE } from '../testing/chats.ts';
import { Settings } from './Settings.tsx';

const STATUS = '/api/v1/chat/live-chat/status';
const REACHABLE = {
  data: {
    mail: { sends: true, blocked: null },
    reach: { state: 'reachable', proxyUnchecked: false },
    notice: true,
    publicOrigin: 'https://crm.meridian.example',
    websites: ['https://www.meridian.example'],
    roles: [{ id: 'r-sales', name: 'Sales' }],
    languages: ['en-US', 'de-DE', 'ar-EG', 'fr-FR'],
    defaultLanguage: 'en-US',
    businessName: 'Meridian',
    timeZone: 'Europe/London',
  },
};
const AI = (more: Record<string, unknown> = {}) => ({ data: { usable: true, refusal: null, service: { provider: 'anthropic', name: 'Anthropic' }, notice: 'Visitors’ messages are sent to Anthropic to pick an answer.', today: { day: '2026-07-28', spent: 37, reserved: 0, limit: 200 }, ...more } });

type Answer = (method: string, path: string, payload: unknown) => unknown;

async function draw(more: { row?: Record<string, unknown> | null; answers?: boolean; status?: unknown; ai?: unknown; pause?: string | null; answer?: Answer } = {}): Promise<void> {
  seed('settings', more.row === null ? [] : [{ id: 1, hours: null, time_zone: null, closed_until: null, welcome: null, outside_words: null, automatic: false, daily_tokens: 0, milo_drafts: false, tell: null, transcripts_months: 12, theme: 'light', ...(more.row ?? {}) }]);
  seed('answers', more.answers === false ? [] : ANSWERS);
  world.api = (method, path, payload) => {
    const answered = more.answer?.(method, path, payload);
    if (answered !== undefined) return answered;
    if (path === STATUS) return more.status ?? REACHABLE;
    if (path === '/api/v1/chat/live-chat/ai') return more.ai ?? AI();
    if (path === '/api/v1/chat/live-chat/pause') return { data: { pausedUntil: more.pause ?? null } };
    if (path.startsWith('/api/v1/people')) return { people: PEOPLE };
    return { data: {} };
  };
  const { wordsFor } = await import('../shared/messages.ts');
  const strings = await import('../strings/index.ts');
  const t = wordsFor(strings.SHARED, strings.SETTINGS, strings.ANSWERS);
  render(<Settings t={t} />);
  await act(async () => undefined);
  await act(async () => undefined);
}

const card = (title: string): HTMLElement => screen.getByRole('heading', { name: title }).closest('section') as HTMLElement;
const autoSwitch = (): HTMLElement => within(card('Automatic answers')).getAllByRole('switch')[0]!;
const saved = (): Record<string, unknown> | undefined => world.calls.filter((call) => call.kind === 'update' && call.table === 'settings').at(-1)?.values as Record<string, unknown> | undefined;

beforeEach(() => resetWorld());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Chat settings with automatic answers off, as installed (comp 3a)', () => {
  it('draws the cards in the comp’s order, with the time zone, Monday to Friday open and the weekend closed', async () => {
    await draw({ answers: false });
    const titles = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
    expect(titles).toEqual(['Opening hours', 'Welcome line', 'Automatic answers', 'Answers', 'Put it on your website']);
    expect(within(card('Opening hours')).getByText('Europe/London')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Open on Monday' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('switch', { name: 'Open on Sunday' }).getAttribute('aria-checked')).toBe('false');
    expect((screen.getByRole('textbox', { name: 'Monday opens' }) as HTMLInputElement).value).toBe('9:00');
    expect((screen.getByRole('textbox', { name: 'Monday closes' }) as HTMLInputElement).value).toBe('17:30');
    expect(within(card('Opening hours')).getAllByText('Closed')).toHaveLength(2);
  });

  it('keeps the automatic switch blocked until there is an answer and a limit, and says why when pressed', async () => {
    await draw({ answers: false });
    expect(autoSwitch().getAttribute('aria-disabled')).toBe('true');
    expect(within(card('Automatic answers')).getByText('They stay off until you write some answers and set a daily limit.')).toBeTruthy();
    fireEvent.click(autoSwitch());
    expect(world.toasts.at(-1)?.title).toBe('Write an answer and set a daily limit first.');
    expect(autoSwitch().getAttribute('aria-checked')).toBe('false');
    // The limit starts empty: 0 is no automatic answers.
    expect((screen.getByLabelText('Daily limit:') as HTMLInputElement).value).toBe('');
    expect(screen.getByText('No answers yet. Write the questions people ask and the answer you want them to get.')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Try a question' })).toBeNull();
  });

  it('shows the first line a visitor reads: a person answers, with the privacy notice', async () => {
    await draw({ answers: false });
    const first = within(card('Automatic answers')).getByText('The chat’s first line').nextElementSibling as HTMLElement;
    expect(first.textContent).toBe('A person answers here. Privacy notice.');
  });
});

describe('Chat settings with automatic answers on (comp 3b)', () => {
  const ON = { automatic: true, daily_tokens: 200 };

  it('switches on, shows today’s use of the limit, the AI service and its sentence, and the first line naming the service', async () => {
    await draw({ row: ON });
    expect(autoSwitch().getAttribute('aria-checked')).toBe('true');
    expect(autoSwitch().getAttribute('aria-disabled')).toBeNull();
    expect(within(card('Automatic answers')).getByText('On. A question that matches one of your answers gets that answer, marked “Automatic answer”. Anything else goes to a person.')).toBeTruthy();
    expect(within(card('Automatic answers')).getByText('37 of 200')).toBeTruthy();
    expect(within(card('Automatic answers')).getByText('Visitors’ messages are sent to Anthropic to pick an answer.')).toBeTruthy();
    expect(within(card('Automatic answers')).getByText(/AI service: Anthropic, from your workspace settings\./)).toBeTruthy();
    expect(within(card('Automatic answers')).getByRole('link', { name: 'Milo settings' }).getAttribute('href')).toBe('/studio/settings/ai');
    const first = within(card('Automatic answers')).getByText('The chat’s first line').nextElementSibling as HTMLElement;
    expect(first.textContent).toBe('Some answers here are automatic, picked from answers Meridian wrote. A person can take over at any time. Your messages are read by an AI service (Anthropic). Privacy notice.');
    // No role="progressbar": the words carry the numbers.
    expect(document.querySelector('[role="progressbar"]')).toBeNull();
  });

  it('says staff may use the service when only Milo drafting is on', async () => {
    await draw({ row: { milo_drafts: true } });
    const first = within(card('Automatic answers')).getByText('The chat’s first line').nextElementSibling as HTMLElement;
    expect(first.textContent).toBe('A person answers here. Staff may use an AI service (Anthropic) to help write replies. Privacy notice.');
  });

  it('blocks the switch, with the words why, when no AI service can be used', async () => {
    await draw({ row: { daily_tokens: 200 }, ai: AI({ usable: false, refusal: 'no-provider', service: null, notice: null }) });
    expect(autoSwitch().getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(autoSwitch());
    expect(world.toasts.at(-1)?.title).toBe('Set an AI service in Milo settings first.');
    expect(within(card('Automatic answers')).getByText(/No AI service is set\./)).toBeTruthy();
  });

  it('lists the four answers with their examples, the languages done and those that need translation', async () => {
    await draw({ row: ON });
    const answers = card('Answers');
    expect(within(answers).getByText('4')).toBeTruthy();
    const items = within(answers).getAllByRole('listitem');
    expect(items.map((item) => item.querySelector('span')?.textContent)).toEqual(['Do you deliver outside the UK?', 'Can I visit the showroom?', 'How long does a fit-out take?', 'Do you take old furniture away?']);
    expect(within(items[0]!).getByText('“do you ship to France”')).toBeTruthy();
    expect(within(items[0]!).getByText('EN DE')).toBeTruthy();
    expect(within(items[0]!).getByText('AR FR need translation')).toBeTruthy();
    expect(within(items[1]!).getByText('DE AR FR need translation')).toBeTruthy();
  });

  it('tries a question through Adminium’s own answerer, on Enter, never on each key', async () => {
    await draw({ row: ON, answer: (method, path, payload) => (method === 'post' && path.endsWith('/ai/try') ? { data: { answerRef: (payload as { question: string }).question.includes('chairs') ? 'old-furniture' : null, outcome: (payload as { question: string }).question.includes('chairs') ? 'answered' : 'hand-over', tokensIn: 10, tokensOut: 2 } } : undefined) });
    const field = screen.getByRole('textbox', { name: 'A visitor’s question' });
    fireEvent.change(field, { target: { value: 'can you remove old chairs' } });
    expect(world.calls.filter((call) => call.table.endsWith('/ai/try'))).toEqual([]);
    fireEvent.keyDown(field, { key: 'Enter' });
    await waitFor(() => expect(screen.getByText('Would pick: Do you take old furniture away?')).toBeTruthy());
    expect(world.calls.filter((call) => call.table.endsWith('/ai/try')).map((call) => call.values)).toEqual([{ question: 'can you remove old chairs' }]);
    fireEvent.change(field, { target: { value: 'what’s the price of a booth' } });
    fireEvent.click(screen.getByRole('button', { name: 'Try' }));
    await waitFor(() => expect(screen.getByText('Would hand over to a person')).toBeTruthy());
    expect(screen.getByText('None of your answers fits this question.')).toBeTruthy();
    expect(screen.queryByText(/Prices and stock/)).toBeNull();
  });
});

describe('the answers editor', () => {
  it('adds an answer in the chat’s default language, saying anyone may be shown it', async () => {
    await draw();
    fireEvent.click(screen.getByRole('button', { name: 'Add an answer' }));
    const dialog = document.querySelector('[data-part="modal"]') as HTMLElement;
    expect(within(dialog).getByText('Anyone may be shown this answer.')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save answer' }));
    expect(within(dialog).getByRole('alert').textContent).toBe('Write the question and the answer.');
    fireEvent.change(within(dialog).getByLabelText('Question'), { target: { value: 'Do you fit out kitchens?' } });
    fireEvent.change(within(dialog).getByLabelText('Other ways people ask it'), { target: { value: 'kitchen\ntea point' } });
    fireEvent.change(within(dialog).getByLabelText('Answer'), { target: { value: 'Yes, small office kitchens too.' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save answer' }));
    await waitFor(() => expect(world.calls.some((call) => call.kind === 'create' && call.table === 'answers')).toBe(true));
    const made = world.calls.find((call) => call.kind === 'create' && call.table === 'answers')?.values as Record<string, unknown>;
    expect(made['versions']).toEqual({ 'en-US': { title: 'Do you fit out kitchens?', text: 'Yes, small office kitchens too.', examples: ['kitchen', 'tea point'] } });
    expect(made['ref']).toMatch(/^answer-[0-9a-f]{12}$/);
    expect(made['position']).toBe(5);
    expect(made['active']).toBe(true);
  });

  it('edits one language at a time through the language menu', async () => {
    await draw();
    const showroom = within(card('Answers')).getAllByRole('listitem')[1]!;
    fireEvent.click(within(showroom).getByRole('button', { name: /Edit/ }));
    const dialog = document.querySelector('[data-part="modal"]') as HTMLElement;
    expect((within(dialog).getByLabelText('Question') as HTMLInputElement).value).toBe('Can I visit the showroom?');
    const menu = within(dialog).getByRole('dialog', { name: 'Language variations' });
    fireEvent.click(within(menu).getByText('Deutsch'));
    expect((within(dialog).getByLabelText('Question') as HTMLInputElement).value).toBe('');
    fireEvent.change(within(dialog).getByLabelText('Question'), { target: { value: 'Kann ich den Showroom besuchen?' } });
    fireEvent.change(within(dialog).getByLabelText('Answer'), { target: { value: 'Ja: Leeds, Montag bis Freitag 9:00–17:30.' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save answer' }));
    await waitFor(() => expect(world.calls.some((call) => call.kind === 'update' && call.table === 'answers')).toBe(true));
    const versions = (world.calls.find((call) => call.kind === 'update' && call.table === 'answers')?.values as { versions: Record<string, unknown> }).versions;
    expect(Object.keys(versions).sort()).toEqual(['de-DE', 'en-US']);
  });

  it('deletes at once, with Undo on the toast that puts it back', async () => {
    await draw();
    const first = within(card('Answers')).getAllByRole('listitem')[0]!;
    fireEvent.click(within(first).getByRole('button', { name: /Delete/ }));
    await waitFor(() => expect(world.calls.some((call) => call.kind === 'remove' && call.table === 'answers' && call.key === '1')).toBe(true));
    const toast = world.toasts.at(-1)!;
    expect(toast.title).toBe('Answer deleted: Do you deliver outside the UK?');
    expect(toast.action?.label).toBe('Undo');
    act(() => toast.action?.onAction());
    await waitFor(() => expect(world.calls.find((call) => call.kind === 'create' && call.table === 'answers')?.values).toMatchObject({ ref: 'deliver', position: 1 }));
  });
});

describe('putting the chat on a website', () => {
  it('gives the one loader line, from this server’s public address, told which chat to draw, and where it shows', async () => {
    await draw();
    const embed = card('Put it on your website');
    expect(within(embed).getByText('<script src="https://crm.meridian.example/x/embed.js" data-adminium-chat="live-chat" async></script>')).toBeTruthy();
    expect(within(embed).getByText('www.meridian.example')).toBeTruthy();
    expect(within(embed).getAllByText(/^Copy$/)).toHaveLength(1);
  });

  it('shows the blocked cards instead (comp 3d): the privacy notice, and public pages switched off', async () => {
    await draw({ status: { data: { ...REACHABLE.data, notice: false, reach: { state: 'network-off', proxyUnchecked: false } } } });
    expect(screen.queryByText(/x\/embed\.js/)).toBeNull();
    const alerts = screen.getAllByRole('alert');
    expect(alerts.map((alert) => alert.querySelector('h3')?.textContent)).toEqual(['Set your privacy notice first.', 'Public pages are switched off on this server.']);
    expect(within(alerts[0]!).getByRole('link', { name: 'Open Privacy and public pages' }).getAttribute('href')).toBe('/studio/privacy');
    expect(within(alerts[1]!).getByText('Set ADMINIUM_NETWORK_FEATURES=on on the server, restart it, then check again.')).toBeTruthy();
  });

  it('words every reach state, and mail that cannot go out', async () => {
    const { reachWords } = await import('./Website.tsx');
    const t = (_key: string, fallback: string): string => fallback;
    const titles = ['network-off', 'desktop', 'proxy-hidden', 'not-set', 'this-computer', 'private-network', 'dot-local', 'not-https', 'unreachable'].map((state) => reachWords(t, state).title);
    expect(new Set(titles).size).toBe(5);
    await draw({ status: { data: { ...REACHABLE.data, mail: { sends: false, blocked: 'no-mail-server' } } } });
    expect(screen.getByRole('alert').querySelector('h3')?.textContent).toBe('No mail goes out yet: no mail server is set.');
  });

  it('says when it cannot tell whether a proxy is in front of the server', async () => {
    await draw({ status: { data: { ...REACHABLE.data, reach: { state: 'reachable', proxyUnchecked: true } } } });
    expect(screen.getByText(/through a proxy or a load balancer/)).toBeTruthy();
  });

  it('asks the chat’s own status read alone: a settings manager with no Forms or privacy rights sees the snippet', async () => {
    await draw({
      answer: (_method, path) => {
        if (path.startsWith('/api/v1/forms/') || path.startsWith('/api/v1/privacy/') || path === '/api/v1/roles') throw new Refused('FORBIDDEN');
        return undefined;
      },
    });
    expect(screen.getByText('<script src="https://crm.meridian.example/x/embed.js" data-adminium-chat="live-chat" async></script>')).toBeTruthy();
    expect(screen.getByText('www.meridian.example')).toBeTruthy();
    const asked = world.calls.filter((call) => call.kind === 'api').map((call) => call.table);
    expect(asked).toContain(`get ${STATUS}`);
    expect(asked.filter((call) => /\/forms\/|\/privacy\/|\/x\/chat\/|\/roles$/.test(call))).toEqual([]);
  });

  it('shows such a manager the blocked cards from the same read', async () => {
    await draw({
      status: { data: { ...REACHABLE.data, notice: false, reach: { state: 'not-https', proxyUnchecked: false }, mail: { sends: false, blocked: 'no-public-origin' } } },
      answer: (_method, path) => {
        if (path.startsWith('/api/v1/forms/') || path.startsWith('/api/v1/privacy/')) throw new Refused('FORBIDDEN');
        return undefined;
      },
    });
    expect(screen.queryByText(/x\/embed\.js/)).toBeNull();
    expect(screen.getAllByRole('alert').map((alert) => alert.querySelector('h3')?.textContent)).toEqual(['Set your privacy notice first.', 'This server has no public https address.', 'No mail goes out yet: this server has no public address.']);
  });

  it('takes the business, the languages and the time zone from the status read', async () => {
    await draw({ status: { data: { ...REACHABLE.data, businessName: 'Hartwell & Co', languages: ['en-US', 'cs-CZ'], timeZone: 'Europe/Prague' } } });
    expect(within(card('Opening hours')).getByText('Europe/Prague')).toBeTruthy();
    // The language variations count the chat's two languages, not the four of the default status.
    expect(within(card('Welcome line')).getByText('0 of 2')).toBeTruthy();
    expect(screen.queryByText('0 of 4')).toBeNull();
    expect(screen.getByText('Shown under “Hartwell & Co” at the top of the chat.')).toBeTruthy();
  });

  it('claims nothing when the status read is refused: no snippet, no card, and the rest of the page stands', async () => {
    await draw({
      answer: (_method, path) => {
        if (path === STATUS) throw new Refused('TABLE_FORBIDDEN', 'Only someone who may read the chat’s settings reads this.', { reason: 'chat-settings-read' });
        return undefined;
      },
    });
    expect(screen.queryByText(/x\/embed\.js/)).toBeNull();
    expect(screen.queryAllByRole('alert')).toEqual([]);
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(['Opening hours', 'Welcome line', 'Automatic answers', 'Answers', 'Try a question']);
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy();
  });

  it('says new chats are paused, until when, and resumes them', async () => {
    await draw({ pause: '2026-07-28T10:35:00.000Z', answer: (method, path) => (method === 'post' && path.endsWith('/resume') ? { data: { resumed: true } } : undefined) });
    const paused = screen.getAllByRole('alert').find((alert) => alert.textContent?.includes('New chats are paused'))!;
    fireEvent.click(within(paused).getByRole('button', { name: 'Resume' }));
    await waitFor(() => expect(world.calls.some((call) => call.table === 'post /api/v1/chat/live-chat/resume')).toBe(true));
    await waitFor(() => expect(screen.queryByText(/New chats are paused/)).toBeNull());
  });

  it('opens "Try the chat": the window as it is set now, in a frame, writing nothing', async () => {
    await draw();
    fireEvent.click(screen.getByRole('button', { name: 'Try the chat' }));
    expect((document.querySelector('iframe') as HTMLIFrameElement).getAttribute('src')).toBe('/x/chat/live-chat?preview=1');
  });
});

describe('saving', () => {
  it('writes the settings row as Adminium reads it', async () => {
    await draw({ row: { automatic: false } });
    fireEvent.click(screen.getByRole('switch', { name: 'Open on Saturday' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Saturday opens' }), { target: { value: '10:00' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Saturday closes' }), { target: { value: '14:00' } });
    fireEvent.change(screen.getByLabelText('Welcome line, English'), { target: { value: 'We usually answer within an hour' } });
    fireEvent.change(screen.getByLabelText('Daily limit:'), { target: { value: '20000' } });
    fireEvent.click(screen.getByRole('switch', { name: /Milo drafts replies/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    fireEvent.change(screen.getByLabelText('Keep conversations for:'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(saved()).toBeDefined());
    expect(saved()).toEqual({
      hours: { mon: [['09:00', '17:30']], tue: [['09:00', '17:30']], wed: [['09:00', '17:30']], thu: [['09:00', '17:30']], fri: [['09:00', '17:30']], sat: [['10:00', '14:00']] },
      closed_until: null,
      welcome: { 'en-US': 'We usually answer within an hour' },
      outside_words: null,
      automatic: false,
      daily_tokens: 20000,
      milo_drafts: true,
      tell: null,
      transcripts_months: 6,
      theme: 'dark',
    });
    expect(world.toasts.at(-1)?.title).toBe('Chat settings saved');
  });

  it('keeps the next opening in the outside-hours words as Adminium’s token, shown as the comp writes it, in each language', async () => {
    await draw({ row: { outside_words: JSON.stringify({ 'en-US': 'We’re closed until {opens}.', 'de-DE': 'Geschlossen bis {opens}.' }) } });
    expect((screen.getByLabelText('Outside hours') as HTMLTextAreaElement).value).toBe('We’re closed until 9:00 tomorrow.');
    expect(within(card('Opening hours')).getByText('“9:00 tomorrow” changes to the next opening time. No automatic answers outside hours.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Outside hours'), { target: { value: 'Back at 9:00 tomorrow. Leave your question.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(saved()?.['outside_words']).toEqual({ 'en-US': 'Back at {opens}. Leave your question.', 'de-DE': 'Geschlossen bis {opens}.' }));
  });

  it('refuses a time that is not one, and saves nothing', async () => {
    await draw();
    fireEvent.change(screen.getByRole('textbox', { name: 'Monday closes' }), { target: { value: '8:00' } });
    expect(within(card('Opening hours')).getByRole('alert').textContent).toBe('Write the times like 9:00 and 17:30, the opening first.');
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await act(async () => undefined);
    expect(saved()).toBeUndefined();
  });

  it('tells the roles and people chosen', async () => {
    await draw();
    const tell = screen.getByRole('group', { name: 'Who is told' });
    expect(within(tell).getByText('Nobody chosen: everyone who may read the chats is told.')).toBeTruthy();
    fireEvent.change(within(tell).getByRole('combobox', { name: 'Tell someone else' }), { target: { value: 'role:r-sales' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(saved()?.['tell']).toEqual([{ kind: 'role', id: 'r-sales' }]));
  });

  it('is not offered to a reader who may not change the settings', async () => {
    world.cannot.add('update:settings');
    await draw();
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
  });
});
