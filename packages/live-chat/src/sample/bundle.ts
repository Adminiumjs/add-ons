/**
 * THE SAMPLE: what a fresh install can add, to see the inbox and the settings
 * with something in them.
 *
 * Four answers, each in English and German, and three chats in three states:
 * one the automatic answers took care of, one waiting for a person, and one
 * closed. The visitors are made up and leave no e-mail, so no reply is ever
 * mailed to anybody from a sample chat. Nothing here turns automatic answers
 * on: a sample never spends a token.
 *
 * `scripts/sample.mjs` writes this to `seeds/live-chat.sample.json`;
 * `sample.test.ts` fails when the file is behind.
 */
export type Row = Record<string, unknown>;
export interface Bundle {
  format: 'adminium.sample/1';
  app: 'live-chat';
  tables: { ref: string; onlyIfEmpty?: true; rows: Row[] }[];
}

const ago = (duration: string): { '@ago': string } => ({ '@ago': duration });
const version = (title: string, text: string, examples: string[]) => ({ title, text, examples });

const ANSWERS: Row[] = [
  {
    ref: 'opening-hours',
    position: 1,
    active: true,
    versions: {
      'en-US': version('When are you open?', 'We answer here Monday to Friday, 9:00 to 17:30. Outside those hours, leave your question and your e-mail, and we reply the next working day.', ['are you open on saturday', 'what time do you close']),
      'de-DE': version('Wann sind Sie erreichbar?', 'Wir antworten hier montags bis freitags von 9:00 bis 17:30 Uhr. Außerhalb dieser Zeiten hinterlassen Sie Ihre Frage und Ihre E-Mail-Adresse, und wir antworten am nächsten Werktag.', ['haben Sie samstags geöffnet', 'wann schließen Sie']),
    },
  },
  {
    ref: 'delivery-time',
    position: 2,
    active: true,
    versions: {
      'en-US': version('How long does delivery take?', 'Most orders arrive in 3 to 5 working days. We send the tracking link by e-mail when your order leaves us.', ['when will my order arrive', 'how fast do you ship']),
      'de-DE': version('Wie lange dauert die Lieferung?', 'Die meisten Bestellungen kommen in 3 bis 5 Werktagen an. Den Link zur Sendungsverfolgung senden wir per E-Mail, sobald Ihre Bestellung unterwegs ist.', ['wann kommt meine Bestellung', 'wie schnell liefern Sie']),
    },
  },
  {
    ref: 'change-order',
    position: 3,
    active: true,
    versions: {
      'en-US': version('Can I change my order?', 'Yes, until it is packed. Write your order number here and a person will change it for you.', ['can I add something to my order', 'I ordered the wrong size']),
      'de-DE': version('Kann ich meine Bestellung ändern?', 'Ja, solange sie noch nicht verpackt ist. Schreiben Sie Ihre Bestellnummer hier, und eine Person ändert sie für Sie.', ['kann ich noch etwas hinzufügen', 'ich habe die falsche Größe bestellt']),
    },
  },
  {
    ref: 'returns',
    position: 4,
    active: true,
    versions: {
      'en-US': version('How do I send something back?', 'You can send it back within 30 days. Write your order number here and we send you the return label.', ['how do returns work', 'can I get a refund']),
      'de-DE': version('Wie sende ich etwas zurück?', 'Sie können es innerhalb von 30 Tagen zurücksenden. Schreiben Sie Ihre Bestellnummer hier, und wir senden Ihnen das Rücksendeetikett.', ['wie funktioniert die Rücksendung', 'bekomme ich mein Geld zurück']),
    },
  },
];

const CONVERSATIONS: Row[] = [
  { '@label': 'chat:answered', started_at: ago('PT26M'), last_message_at: ago('PT25M'), state: 'bot', language: 'en-US', name: 'Alex Morgan', came_from: 'https://www.example.com/shop', outside_hours: false, automatic_count: 1 },
  { '@label': 'chat:waiting', started_at: ago('PT14M'), last_message_at: ago('PT12M'), state: 'waiting', language: 'de-DE', name: 'Jonas Weber', came_from: 'https://www.example.com/kontakt', outside_hours: false, automatic_count: 0 },
  { '@label': 'chat:closed', started_at: ago('P1DT2H'), last_message_at: ago('P1DT1H50M'), state: 'closed', language: 'en-US', name: null, came_from: 'https://www.example.com/', outside_hours: false, closed_at: ago('P1DT1H50M'), automatic_count: 1 },
];

const chat = (label: string) => ({ '@ref': label });

const MESSAGES: Row[] = [
  { conversation_id: chat('chat:answered'), kind: 'visitor', body: 'how long does delivery take?', drafted: false, sent_at: ago('PT26M') },
  { conversation_id: chat('chat:answered'), kind: 'automatic', body: 'Most orders arrive in 3 to 5 working days. We send the tracking link by e-mail when your order leaves us.', answer_ref: 'delivery-time', drafted: false, sent_at: ago('PT25M') },
  { conversation_id: chat('chat:waiting'), kind: 'visitor', body: 'Hallo, ich habe gestern bestellt. Kann ich noch die Adresse ändern?', drafted: false, sent_at: ago('PT14M') },
  { conversation_id: chat('chat:waiting'), kind: 'system', body: 'The visitor asked for a person.', event: 'asked', drafted: false, sent_at: ago('PT12M') },
  { conversation_id: chat('chat:closed'), kind: 'visitor', body: 'are you open on saturday?', drafted: false, sent_at: ago('P1DT2H') },
  { conversation_id: chat('chat:closed'), kind: 'automatic', body: 'We answer here Monday to Friday, 9:00 to 17:30. Outside those hours, leave your question and your e-mail, and we reply the next working day.', answer_ref: 'opening-hours', drafted: false, sent_at: ago('P1DT1H59M') },
  { conversation_id: chat('chat:closed'), kind: 'system', body: 'The chat was closed.', event: 'closed', drafted: false, sent_at: ago('P1DT1H50M') },
];

export function buildSample(): Bundle {
  return {
    format: 'adminium.sample/1',
    app: 'live-chat',
    tables: [
      { ref: 'answers', rows: ANSWERS },
      { ref: 'conversations', rows: CONVERSATIONS },
      { ref: 'messages', rows: MESSAGES },
    ],
  };
}
