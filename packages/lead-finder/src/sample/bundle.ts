/**
 * THE SAMPLE: what an install can add to see "People found" and the field
 * notes with something in them.
 *
 * What Lead finder finds is kept in an APP's tables: a found company is a
 * row of the app's companies table, a found person a row of its people table
 * (only the found record, its source and its tell mail are this add-on's).
 * An add-on's own sample file can write only its own tables, so the sample
 * is the app's to ship, as rows for this add-on (`sampleData.addOns`): this
 * file writes them for the CRM (`app: "crm"`), and names the CRM's own sample
 * rows they belong to by their labels. `CRM_ROWS` are those rows, for the
 * CRM's own sample file to carry.
 *
 * Everything is made up: the companies of the shared sample, with numbers
 * that fail their registers' check digits (UK numbers in the unallocated
 * `98` block, a Norwegian number that fails mod-11), `.example` sites and
 * addresses, made-up streets, and people with nothing that identifies anyone.
 * Hunter found the people: one was told, one is waiting to be told, one could
 * not be told (the address bounced), and one agreed by phone after being told.
 *
 * `scripts/sample.mjs` writes this to `seeds/`; `sample.test.ts` fails when
 * the files are behind.
 */
export type Row = Record<string, unknown>;
export interface Section {
  format: 'adminium.sample/1';
  app: 'crm';
  addOn: 'lead-finder';
  tables: { ref: string; rows: Row[] }[];
}

const ago = (duration: string): { '@ago': string } => ({ '@ago': duration });
const day = (days: number): { '@day': number } => ({ '@day': days });
const ref = (label: string): { '@ref': string } => ({ '@ref': label });
const table = (name: string): { '@table': string } => ({ '@table': name });

/** The CRM's rows these belong to, by the labels the CRM's own sample gives them. */
export const CRM_ROWS: { companies: Row[]; contacts: Row[] } = {
  companies: [
    { '@label': 'co:kestrel-yard', name: 'Kestrel Yard Architects', company_number: '98000412', sector: 'Architectural activities', website: 'https://kestrelyard.example', phone: '0113 496 0412', address_lines: 'Unit 4, Calder Wharf Lane', town: 'Leeds', region: 'West Yorkshire', postal_code: 'LS1 0ZZ', country: 'GB', about: 'A small practice drawing homes and workshops.' },
    { '@label': 'co:millbeck', name: 'Millbeck Drawing Office', company_number: '98001537', sector: 'Architectural activities', website: 'https://millbeck.example', address_lines: '22 Fennel Row', town: 'Leeds', region: 'West Yorkshire', postal_code: 'LS2 0ZZ', country: 'GB' },
    { '@label': 'co:ouseburn', name: 'Ouseburn Studio', company_number: '98002264', sector: 'Architectural activities', website: 'https://ouseburn.example', address_lines: '3 Lime Kiln Court', town: 'Newcastle upon Tyne', region: 'Tyne and Wear', postal_code: 'NE1 0ZZ', country: 'GB' },
    { '@label': 'co:tannery-row', name: 'Tannery Row Design', company_number: '98003391', sector: 'Architectural activities', website: 'https://tanneryrow.example', address_lines: '7 Tannery Row', town: 'Leeds', region: 'West Yorkshire', postal_code: 'LS3 0ZZ', country: 'GB' },
    { '@label': 'co:fjordlys', name: 'Fjordlys Arkitekter AS', company_number: '923456781', sector: 'Arkitektvirksomhet', website: 'https://www.fjordlys.example', phone: '55 00 00 00', address_lines: 'Lysverkgata 5', town: 'Bergen', postal_code: '5003', country: 'NO' },
  ],
  contacts: [
    { '@label': 'ct:robin-hale', company_id: ref('co:kestrel-yard'), name: 'Robin Hale', job_title: 'Director', email: 'robin@kestrelyard.example', may_email: false, won_deals: 0 },
    { '@label': 'ct:sam-ellery', company_id: ref('co:kestrel-yard'), name: 'Sam Ellery', job_title: 'Architect', email: 'sam@kestrelyard.example', may_email: false, won_deals: 0 },
    { '@label': 'ct:jo-ashby', company_id: ref('co:millbeck'), name: 'Jo Ashby', job_title: 'Director', email: 'jo@millbeck.example', may_email: false, won_deals: 0 },
    // Told, then agreed by phone: an ordinary contact who may be e-mailed for that purpose.
    { '@label': 'ct:kari-vik', company_id: ref('co:fjordlys'), name: 'Kari Vik', job_title: 'Daglig leder', email: 'kari@fjordlys.example', may_email: true, may_email_at: ago('P20D'), won_deals: 0 },
  ],
};

/** The purpose each found person was kept for, as the People card said it then. */
const PURPOSE = 'To offer your company office fit-outs and furniture.';

/** A found person: who, at which company, found by Hunter when, told by and how it stands. */
function found(label: string, person: string, company: string, foundAgo: string, tellBy: number, state: 'waiting' | 'told' | 'failed', toldAgo: string | null, pages: string[]): Row {
  return {
    '@label': label,
    person_table: table('contacts'),
    person_key: ref(person),
    company_table: table('companies'),
    company_key: ref(company),
    source: 'hunter',
    found_at: ago(foundAgo),
    purpose: PURPOSE,
    tell_by: day(tellBy),
    told_at: toldAgo === null ? null : ago(toldAgo),
    state,
    source_pages: pages.join('\n'),
  };
}

const FOUND_PEOPLE: Row[] = [
  found('found:robin-hale', 'ct:robin-hale', 'co:kestrel-yard', 'P1DT2H', 29, 'told', 'P1DT2H', ['https://kestrelyard.example/team']),
  found('found:sam-ellery', 'ct:sam-ellery', 'co:kestrel-yard', 'PT20M', 30, 'waiting', null, ['https://kestrelyard.example/team', 'https://kestrelyard.example/projects/mill-yard']),
  found('found:jo-ashby', 'ct:jo-ashby', 'co:millbeck', 'P27D', 3, 'failed', null, ['https://millbeck.example/about']),
  found('found:kari-vik', 'ct:kari-vik', 'co:fjordlys', 'P24D', 6, 'told', 'P24D', ['https://www.fjordlys.example/kontakt']),
];

/** The tell mails of the people told or not told: none for the one still waiting, whose mail is not queued in a sample. */
const TELL_MAILS: Row[] = [
  { kind: 'tell', status: 'sent', to_address: 'robin@kestrelyard.example', language: 'en-US', found_person_id: ref('found:robin-hale'), sent_at: ago('P1DT2H') },
  { kind: 'tell', status: 'failed', to_address: 'jo@millbeck.example', language: 'en-US', found_person_id: ref('found:jo-ashby'), error: 'The address bounced' },
  { kind: 'tell', status: 'sent', to_address: 'kari@fjordlys.example', language: 'en-US', found_person_id: ref('found:kari-vik'), sent_at: ago('P24D') },
];

/** The sha-256 of each filled value as the record page reads it (text, trimmed): `sample.test.ts` works each out again. */
export const VALUE_HASHES: Readonly<Record<string, string>> = {
  '98000412': 'ec0b8f3a78dea5f1cd8ff6ee45452a96c90ad7ef924c92a2efee317886f0481f',
  'https://kestrelyard.example': 'bdf1f1afd031d9b268578664dbeecd6163cd9f65274bf9b0366a646192ab0a1a',
  Leeds: '8593b9db65212160979d946950601c26622a219c80f1f122679eb69ec5b96600',
  '923456781': '74c528fa4d4487ca475d23ceaf980c08a10410fc91bcd29f44d41171fb3279a8',
  'https://www.fjordlys.example': '2fa5b9df8317496da92bc0db2abb143892251bea8f3ceb8898bd2e9b2a60fb17',
};

/** A field a source filled on a company row, with the hash of the value it wrote. */
function filled(company: string, column: string, value: string, source: string, foundAgo: string): Row {
  return { table_ref: table('companies'), row_key: ref(company), column_name: column, source, found_at: ago(foundAgo), value_hash: VALUE_HASHES[value] };
}

const FIELD_SOURCES: Row[] = [
  filled('co:kestrel-yard', 'company_number', '98000412', 'companies-house', 'P2D'),
  filled('co:kestrel-yard', 'town', 'Leeds', 'companies-house', 'P2D'),
  filled('co:kestrel-yard', 'website', 'https://kestrelyard.example', 'website', 'P2D'),
  filled('co:fjordlys', 'company_number', '923456781', 'norway', 'P25D'),
  filled('co:fjordlys', 'website', 'https://www.fjordlys.example', 'norway', 'P25D'),
];

/** The CRM's rows for Lead finder. */
export function buildSample(): Section {
  return {
    format: 'adminium.sample/1',
    app: 'crm',
    addOn: 'lead-finder',
    tables: [
      { ref: 'found_people', rows: FOUND_PEOPLE },
      { ref: 'tell_mails', rows: TELL_MAILS },
      { ref: 'field_sources', rows: FIELD_SOURCES },
    ],
  };
}
