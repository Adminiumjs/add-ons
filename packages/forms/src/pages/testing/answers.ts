/**
 * The showroom form of the comp, and its answers, as the data kit hands them
 * back: for the Answers tab's own tests.
 */
type Row = Record<string, string | number | boolean | null>;

const en = (words: string, de?: string): Record<string, string> => ({ 'en-US': words, ...(de === undefined ? {} : { 'de-DE': de }) });

export const SHOWROOM = {
  v: 1,
  kind: 'form',
  languages: ['en-US', 'de-DE'],
  defaultLanguage: 'en-US',
  title: en('Book a showroom visit', 'Showroom-Besuch buchen'),
  questions: [
    { id: 'qname', kind: 'short', role: 'name', required: true, maxLength: 200, label: en('Your name', 'Ihr Name') },
    { id: 'qmail', kind: 'short', role: 'email', check: 'email', required: true, maxLength: 200, label: en('Work e-mail', 'Geschäftliche E-Mail') },
    { id: 'qco', kind: 'short', role: 'company', maxLength: 200, label: en('Company', 'Firma') },
    { id: 'qday', kind: 'date', from: 'today', label: en('Which day suits you?', 'Welcher Tag passt Ihnen?') },
    { id: 'qcount', kind: 'number', whole: true, label: en('How many of you?', 'Wie viele kommen?') },
    {
      id: 'qsee',
      kind: 'several',
      label: en('What would you like to see?', 'Was möchten Sie sehen?'),
      choices: [
        { id: 'seating', label: en('Seating', 'Sitzmöbel') },
        { id: 'booths', label: en('Acoustic booths', 'Akustikkabinen') },
        { id: 'storage', label: en('Storage', 'Stauraum') },
      ],
    },
    { id: 'qseats', kind: 'number', label: en('Roughly how many seats?', 'Ungefähr wie viele Plätze?'), showIf: { question: 'qsee', includes: 'seating' } },
    { id: 'qroom', kind: 'one', label: en('Which room?', 'Welcher Raum?'), choices: [{ id: 'north', label: en('North hall', 'Nordhalle') }, { id: 'south', label: en('South hall', 'Südhalle') }] },
    { id: 'qstars', kind: 'stars', label: en('How was the booking?', 'Wie war die Buchung?') },
    { id: 'qscore', kind: 'score', label: en('How likely are you to come back?', 'Wie wahrscheinlich kommen Sie wieder?') },
    { id: 'qnote', kind: 'long', maxLength: 2000, label: en('Anything else?', 'Sonst noch etwas?') },
    { id: 'qfiles', kind: 'file', maxMb: 10, kinds: ['pdf', 'jpg'], many: true, label: en('Drawings of your space', 'Zeichnungen Ihrer Räume') },
    { id: 'qtick', kind: 'tick', purpose: 'newsletter', wordingVersion: 3, wordingChangedAt: '2026-07-01', confirm: true, label: en('Send me the newsletter, about once a month.', 'Schicken Sie mir den Newsletter.') },
    { id: 'qsrc', kind: 'hidden', param: 'from', label: en('Source', 'Quelle') },
  ],
  ending: { kind: 'words', words: en('Thanks', 'Danke') },
};

export const BECOMES = { becomes: { table: 'tbl-enquiries', map: { qname: 'person', qmail: 'email' } }, tell: [], limits: { perHour: 200, harder: false } };
export const KEEPS = { becomes: null, tell: [], limits: { perHour: 200, harder: false } };

export function showroom(more: { id?: number; settings?: unknown; definition?: unknown } = {}): Row {
  const definition = more.definition ?? SHOWROOM;
  const settings = more.settings ?? BECOMES;
  return {
    id: more.id ?? 7,
    name: 'Book a showroom visit',
    slug: 'showroom-visit',
    kind: 'form',
    state: 'live',
    definition: JSON.stringify(definition),
    settings: JSON.stringify(settings),
    published: JSON.stringify({ definition, settings }),
    published_at: '2026-07-01T09:00:00.000Z',
    updated_at: '2026-07-01T09:00:00.000Z',
    closed_at: null,
  };
}

/** The clock the tests run at: the test host's. */
export const NOW = Date.parse('2026-11-03T12:00:00Z');
const daysAgo = (days: number, hour = 9): string => new Date(NOW - days * 86_400_000 - (12 - hour) * 3_600_000).toISOString();

export function answer(id: number, more: Partial<Record<string, unknown>> & { values?: Record<string, unknown> }): Row {
  const { values, ...rest } = more;
  return {
    id,
    form_id: 7,
    submitted_at: daysAgo(1),
    language: 'en-US',
    values: JSON.stringify(values ?? {}),
    email: null,
    name: null,
    became_table: null,
    became_key: null,
    invitation_id: null,
    confirm: 'none',
    consent_purpose: null,
    consent_wording: null,
    consent_version: null,
    ip: '203.0.113.9',
    user_agent: 'Test',
    sent_from: null,
    ...(rest as Row),
  };
}

export const ANSWERS: Row[] = [
  answer(1, {
    submitted_at: daysAgo(1),
    name: 'Marta Kovac',
    email: 'marta.kovac@cobaltlegal.example',
    became_table: 'crm:enquiries',
    became_key: '1042',
    confirm: 'pending',
    consent_purpose: 'newsletter',
    consent_version: 3,
    sent_from: 'https://www.meridian.example',
    values: { qname: 'Marta Kovac', qmail: 'marta.kovac@cobaltlegal.example', qco: 'Cobalt Legal', qday: '2026-08-06', qcount: 3, qsee: ['booths', 'seating'], qseats: 40, qroom: 'north', qstars: 4, qscore: 9, qfiles: ['UPLOADaaaaaaaaaaaa1'], qtick: true, qsrc: 'flyer', qgone: 'kept from an older version' },
  }),
  answer(2, {
    submitted_at: daysAgo(2),
    name: 'Ruth Adeyemi',
    email: 'ruth.adeyemi@fernway.example',
    values: { qname: 'Ruth Adeyemi', qmail: 'ruth.adeyemi@fernway.example', qco: 'Fernway Clinics', qsee: ['storage'] },
  }),
  answer(3, {
    submitted_at: daysAgo(3),
    language: 'de-DE',
    name: 'Tomas Reidy',
    email: 't.reidy@nordwind.example',
    became_table: 'crm:enquiries',
    became_key: '1040',
    confirm: 'confirmed',
    consent_version: 2,
    values: { qname: 'Tomas Reidy', qmail: 't.reidy@nordwind.example', qco: 'Nordwind Logistics', qsee: ['booths'], qtick: true },
  }),
  answer(4, {
    submitted_at: daysAgo(10),
    name: 'Old Enough',
    email: 'old@enough.example',
    confirm: 'expired',
    values: { qname: 'Old Enough', qmail: 'old@enough.example', qtick: true },
  }),
  answer(5, {
    submitted_at: daysAgo(40),
    name: 'Long Ago',
    email: 'long@ago.example',
    values: { qname: 'Long Ago', qmail: 'long@ago.example' },
  }),
];

// Another form's answer, sent the same day: never one of this form's.
ANSWERS.push(answer(6, { form_id: 8, submitted_at: daysAgo(1, 10), name: 'Other Form', email: 'other@form.example', values: {} }));

export const FILES: Row[] = [
  { id: 11, answer_id: 1, file_id: 'UPLOADaaaaaaaaaaaa1', question: 'qfiles', name: 'drawings.pdf', size: Math.round(2.1 * 1024 * 1024), kind: 'pdf', uploaded_at: daysAgo(1), expires_at: null },
  { id: 12, answer_id: 3, file_id: 'UPLOADbbbbbbbbbbbb2', question: 'qfiles', name: 'site-photos.jpg', size: 840 * 1024, kind: 'jpg', uploaded_at: daysAgo(3), expires_at: null },
];

export const ENQUIRIES = { id: 'tbl-enquiries', tableRef: 'crm:enquiries', label: 'Enquiries', app: 'Sales CRM', columns: [], page: 'team-inbox' };
