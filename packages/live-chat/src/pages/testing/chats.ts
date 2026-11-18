/**
 * THE COMPS' CHATS, AS ROWS: Marta (her chat with an automatic answer and a
 * request for a person), the anonymous visitor, Tomas, and Ines (closed),
 * on Tuesday 28 July 2026, as the comps' sample day has them. Website chats
 * only: the comps' two internal conversations are not this add-on's.
 */
import { api, seed, world } from './host.tsx';

type Row = Record<string, string | number | boolean | null>;

/** The comps' "now": Tuesday 28 July 2026, 09:35 in UTC. */
export const NOW = Date.parse('2026-07-28T09:35:00Z');
const at = (clock: string, day = '2026-07-28'): string => `${day}T${clock}:00.000Z`;

export const DANA = 'u-dana';
export const SAM = 'u-sam';
export const PEOPLE = [
  { id: DANA, name: 'Dana Whitlock' },
  { id: SAM, name: 'Sam Okafor' },
];

export const conversation = (id: number, more: Row): Row => ({
  id,
  started_at: at('09:30'),
  last_message_at: at('09:33'),
  state: 'waiting',
  language: 'en-US',
  name: null,
  email: null,
  came_from: null,
  outside_hours: false,
  taken_by: null,
  taken_at: null,
  last_visitor_at: null,
  last_staff_at: null,
  closed_at: null,
  became_table: null,
  became_key: null,
  automatic_count: 0,
  ...more,
});

let nextMessage = 100;
export const message = (conversationId: number, kind: string, body: string, clock: string, more: Row = {}): Row => ({
  id: (nextMessage += 1),
  conversation_id: conversationId,
  kind,
  body,
  event: null,
  answer_ref: null,
  author_id: null,
  drafted: false,
  sent_at: at(clock),
  mailed_at: null,
  ...more,
});

export const ANSWERS: Row[] = [
  { id: 1, ref: 'deliver', position: 1, active: true, versions: JSON.stringify({ 'en-US': { title: 'Do you deliver outside the UK?', text: 'We fit out offices across the UK and Ireland. For anywhere else, ask us and we’ll see what we can do.', examples: ['do you ship to France', 'can you fit out an office in Dublin'] }, 'de-DE': { title: 'Liefern Sie außerhalb des Vereinigten Königreichs?', text: 'Wir richten Büros im ganzen Vereinigten Königreich und in Irland ein.', examples: [] } }) },
  { id: 2, ref: 'showroom', position: 2, active: true, versions: JSON.stringify({ 'en-US': { title: 'Can I visit the showroom?', text: 'Yes: Leeds, Monday to Friday 9:00–17:30.', examples: ['where is your showroom'] } }) },
  { id: 3, ref: 'fit-out', position: 3, active: true, versions: JSON.stringify({ 'en-US': { title: 'How long does a fit-out take?', text: 'Most take 2–6 weeks from the signed quote.', examples: [] } }) },
  { id: 4, ref: 'old-furniture', position: 4, active: true, versions: JSON.stringify({ 'en-US': { title: 'Do you take old furniture away?', text: 'Yes, we can clear and recycle your old furniture as part of the job.', examples: ['can you remove our old desks', 'do you recycle old chairs'] } }) },
];

/** Marta: started on the showroom page, an automatic answer, then asked for a person. */
export const MARTA = conversation(1, { name: 'Marta Kovac', email: 'marta.kovac@cobaltlegal.example', came_from: 'https://www.meridian.example/showroom', last_message_at: at('09:33') });
export const VISITOR = conversation(2, { started_at: at('09:20'), last_message_at: at('09:22'), came_from: 'https://www.meridian.example/booths' });
export const TOMAS = conversation(3, { name: 'Tomas Reidy', email: 'tomas.reidy@nordwind.example', started_at: at('09:03'), last_message_at: at('09:05'), came_from: 'https://www.meridian.example/showroom' });
export const INES = conversation(5, { name: 'Ines Vaughan', email: 'ines.vaughan@junoanalytics.example', state: 'closed', taken_by: DANA, started_at: at('14:02', '2026-07-27'), last_message_at: at('14:10', '2026-07-27'), closed_at: at('14:10', '2026-07-27'), came_from: 'https://www.meridian.example/seating' });

export function messages(): Row[] {
  nextMessage = 100;
  return [
    message(1, 'visitor', 'Hello, we’re moving office in September.', '09:30'),
    message(1, 'visitor', 'do you take away our old desks?', '09:31'),
    message(1, 'automatic', 'Yes, we can clear and recycle your old furniture as part of the job.', '09:31', { answer_ref: 'old-furniture' }),
    message(1, 'visitor', 'Great. Can someone look at our office layout? About 40 desks.', '09:33'),
    message(1, 'system', 'The visitor asked for a person.', '09:33', { event: 'asked' }),
    message(2, 'visitor', 'How soon could you fit out a floor in Hull?', '09:20'),
    message(2, 'automatic', 'Most take 2–6 weeks from the signed quote.', '09:20', { answer_ref: 'fit-out' }),
    message(2, 'visitor', 'Thanks, I’d like to talk to someone.', '09:22'),
    message(2, 'system', 'The visitor asked for a person.', '09:22', { event: 'asked' }),
    message(3, 'visitor', 'Is the showroom open on Friday afternoon?', '09:03'),
    message(3, 'automatic', 'Yes: Leeds, Monday to Friday 9:00–17:30.', '09:03', { answer_ref: 'showroom' }),
    message(3, 'visitor', 'Can I bring two colleagues?', '09:05'),
    message(3, 'system', 'Handed to a person.', '09:05', { event: 'handed-over' }),
    message(5, 'visitor', 'Do you deliver outside the UK? We have a team in Dublin.', '14:02'),
    message(5, 'automatic', 'We fit out offices across the UK and Ireland.', '14:02', { answer_ref: 'deliver' }),
    message(5, 'visitor', 'Thanks, that’s all for now.', '14:04'),
    message(5, 'system', 'The chat was closed.', '14:10', { event: 'closed', author_id: DANA }),
  ].map((row) => ({ ...row, sent_at: String(row['sent_at']).startsWith('2026-07-28T14') ? String(row['sent_at']).replace('2026-07-28', '2026-07-27') : row['sent_at'] }));
}

export type Answered = (method: string, path: string, payload: unknown) => unknown;

/** A presence reply, as Adminium answers it. */
export function presence(state: 'on-page' | 'left', reason: string | null, id = '1', ready = reason === null): unknown {
  return { data: { presence: state, lastVisitorAt: '2026-07-28T10:02:00.000Z', outsideHours: false, mail: { ready, reason, used: 0, max: 3 }, conversation: { id, state: 'open', outsideHours: false, takenBy: null, takenAt: null, lastVisitorAt: null, lastStaffAt: null, closedAt: null, became: null } } };
}

/** The world the inbox suites start from: four chats, their messages, the answers, Dana signed in, Milo drafting as asked. */
export function seedInbox(more: { milo?: boolean; answer?: Answered } = {}): void {
  seed('conversations', [MARTA, VISITOR, TOMAS, INES]);
  seed('messages', messages());
  seed('answers', ANSWERS);
  seed('settings', [{ id: 1, milo_drafts: more.milo === true, automatic: false, daily_tokens: 0 }]);
  world.api = (method, path, payload) => {
    const answered = more.answer?.(method, path, payload);
    if (answered !== undefined) return answered;
    if (path === '/api/v1/me') return { data: { user: { id: DANA, name: 'Dana Whitlock' } } };
    if (path.startsWith('/api/v1/people')) return { people: PEOPLE };
    if (path.endsWith('/presence')) return presence('on-page', null, path.split('/').at(-2));
    return { data: {} };
  };
}

/** The calls made to Adminium's chat routes, as "METHOD path". */
export const chatCalls = (): string[] => world.calls.filter((call) => call.kind === 'api' && call.table.includes('/api/v1/chat/')).map((call) => call.table);

export { api };
