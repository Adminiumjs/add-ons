/**
 * ADMINIUM'S CHAT ROUTES, AS THESE PAGES CALL THEM.
 *
 * Adminium alone writes a conversation, its messages and its choices: a page
 * never saves one of those rows itself. It asks one of these routes, which
 * check the person's own grants and write through the chat's store, so the
 * visitor's window and every open inbox hear it.
 *
 *   GET  conversations/:id/presence  on the page or left, and whether a reply is mailed
 *   POST conversations/:id/take      it is mine to answer (`force` takes it from a colleague)
 *   POST conversations/:id/reply     a reply, mailed when the visitor left
 *   POST conversations/:id/close     closed
 *   POST conversations/:id/reopen    open again, mine
 *   POST conversations/:id/enquiry   "Make an enquiry": a row in the table an app opens to the chat
 *   POST conversations/:id/draft     "Draft with Milo": words to read, never sent
 *   GET  pause / POST resume         new chats paused by the breaker, and opened again
 *   GET  ai / POST ai/try            what the automatic answers can do here, and "Try a question"
 *
 * Every answer is `{ data }`; a refusal throws the host's `ApiError` with its
 * status, its code and its details (`reason`, and `by` for a chat someone
 * else is answering).
 */
import { ADD_ON } from './paths.ts';
import { api } from './host.ts';

const BASE = `/api/v1/chat/${ADD_ON}`;
const conversation = (id: string, act: string): string => `${BASE}/conversations/${encodeURIComponent(id)}/${act}`;

/** A colleague, as Adminium names them. */
export interface ChatPerson {
  id: string;
  name: string;
  firstName: string;
  initials: string;
}

/** Where a conversation stands, as an act answers it. Never what the visitor typed: the page reads the row. */
export interface ConversationView {
  id: string;
  state: 'bot' | 'waiting' | 'open' | 'closed';
  outsideHours: boolean;
  takenBy: ChatPerson | null;
  takenAt: string | null;
  lastVisitorAt: string | null;
  lastStaffAt: string | null;
  closedAt: string | null;
  became: { table: string; key: string } | null;
}

/** Why a reply was not mailed: no public address, no mail server, today's three used, no address left, a sample chat. */
export const MAIL_REASONS = ['no-public-origin', 'no-mail-server', 'cap', 'no-email', 'sample'] as const;
export type MailReason = (typeof MAIL_REASONS)[number];

export interface Presence {
  presence: 'on-page' | 'left';
  lastVisitorAt: string | null;
  outsideHours: boolean;
  mail: { ready: boolean; reason: MailReason | null; used: number; max: number };
  conversation: ConversationView;
}

export interface Replied {
  message: { id: string; kind: string; body: string; event: string | null; authorId: string | null; drafted: boolean; sentAt: string; mailedAt: string | null };
  conversation: ConversationView;
  presence: 'on-page' | 'left';
  mailed: boolean;
  reason: MailReason | null;
}

export interface Enquired {
  became: { connectionId: string; tableId: string; table: string; key: string };
  conversation: ConversationView;
}

/** What the automatic answers can do on this server, today's tokens, and the sentence shown beside the switch. */
export interface AiState {
  usable: boolean;
  refusal: 'no-provider' | 'network-disabled' | 'off-here' | null;
  service: { provider: string; name: string } | null;
  notice: string | null;
  today: { day: string; spent: number; reserved: number; limit: number };
}

export interface Tried {
  answerRef: string | null;
  outcome: 'answered' | 'hand-over' | 'error' | 'budget' | 'cap' | 'off';
  tokensIn: number;
  tokensOut: number;
}

const data = <T,>(reply: unknown): T => (reply as { data: T }).data;

export const chatRoutes = {
  presence: async (id: string): Promise<Presence> => data<Presence>(await api.get(conversation(id, 'presence'))),
  take: async (id: string, force = false): Promise<ConversationView> => data<ConversationView>(await api.post(conversation(id, 'take'), force ? { force: true } : {})),
  reply: async (id: string, body: string, drafted: boolean): Promise<Replied> => data<Replied>(await api.post(conversation(id, 'reply'), { body, ...(drafted ? { drafted: true } : {}) })),
  close: async (id: string): Promise<ConversationView> => data<ConversationView>(await api.post(conversation(id, 'close'), {})),
  reopen: async (id: string): Promise<ConversationView> => data<ConversationView>(await api.post(conversation(id, 'reopen'), {})),
  enquiry: async (id: string): Promise<Enquired> => data<Enquired>(await api.post(conversation(id, 'enquiry'), {})),
  draft: async (id: string): Promise<{ draft: string; tokens: number }> => data<{ draft: string; tokens: number }>(await api.post(conversation(id, 'draft'), {})),
  pause: async (): Promise<{ pausedUntil: string | null }> => data<{ pausedUntil: string | null }>(await api.get(`${BASE}/pause`)),
  resume: async (): Promise<{ resumed: boolean }> => data<{ resumed: boolean }>(await api.post(`${BASE}/resume`, {})),
  ai: async (): Promise<AiState> => data<AiState>(await api.get(`${BASE}/ai`)),
  tryQuestion: async (question: string): Promise<Tried> => data<Tried>(await api.post(`${BASE}/ai/try`, { question })),
};

/** The people of this server, by id: who took a chat and who wrote a line. */
export async function readPeople(): Promise<ReadonlyMap<string, string>> {
  const reply = (await api.get('/api/v1/people?limit=200')) as { people?: unknown };
  const people = Array.isArray(reply.people) ? reply.people : [];
  return new Map(people.filter((one): one is { id: string; name: string } => typeof one === 'object' && one !== null && typeof (one as { id?: unknown }).id === 'string' && typeof (one as { name?: unknown }).name === 'string').map((one) => [one.id, one.name]));
}

/** The signed-in person's id. */
export async function readMe(): Promise<string | null> {
  const reply = (await api.get('/api/v1/me')) as { data?: { user?: { id?: unknown } } };
  const id = reply.data?.user?.id;
  return typeof id === 'string' ? id : null;
}

/** A refusal's status, code and details, whatever threw it. */
export function refusalOf(caught: unknown): { status: number | null; code: string; reason: string | null; details: Readonly<Record<string, unknown>> } {
  const error = (typeof caught === 'object' && caught !== null ? caught : {}) as { status?: unknown; code?: unknown; details?: unknown };
  const details = typeof error.details === 'object' && error.details !== null ? (error.details as Record<string, unknown>) : {};
  return {
    status: typeof error.status === 'number' ? error.status : null,
    code: typeof error.code === 'string' ? error.code : 'CLIENT_ERROR',
    reason: typeof details['reason'] === 'string' ? details['reason'] : null,
    details,
  };
}

/** The colleague a 409 `taken` names, or null. */
export function takenByOf(caught: unknown): ChatPerson | null {
  const said = refusalOf(caught);
  if (said.reason !== 'taken') return null;
  const by = said.details['by'];
  if (typeof by !== 'object' || by === null) return { id: '', name: '', firstName: '', initials: '' };
  const one = by as Record<string, unknown>;
  const text = (key: string): string => (typeof one[key] === 'string' ? (one[key] as string) : '');
  return { id: text('id'), name: text('name'), firstName: text('firstName'), initials: text('initials') };
}
