/**
 * WHO A FOUND PERSON IS, AS THIS READER MAY SEE THEM.
 *
 * A `found_people` row names the people row it links (`person_table`, as
 * `<app>:<ref>`, and `person_key`) and the company row (`company_table`,
 * `company_key`); the person's name, role and consent live on those rows,
 * which belong to the app. They are read here as the person: the data routes
 * with the reader's own grants and row limits, and the consent panel's read
 * of the record. A person the reader may not read is not listed (their row
 * says nothing to them); a company they may not open is "kept by a
 * colleague", with no link and no values.
 *
 * Which table `crm:contacts` is, and the page a reader opens its rows on,
 * come from the reader's own navigation (`/api/v1/bootstrap`: the pages they
 * may open, with each page's table and app).
 */
import { api } from '../shared/host.ts';
import { readRow, type CompaniesHost } from '../shared/door.ts';
import { instantOf } from '../shared/dates.ts';

export interface NavPage {
  slug: string;
  sourceTable: string | null;
  appKey: string | null;
  connectionId: string | null;
}

/** The pages this reader may open, from their navigation. */
export async function readNav(): Promise<NavPage[]> {
  const reply = await api.get<Record<string, unknown>>('/api/v1/bootstrap');
  const tree = ((reply['data'] as Record<string, unknown> | undefined)?.['nav'] ?? reply['nav']) as { groups?: { items?: unknown[] }[] } | undefined;
  const items = (tree?.groups ?? []).flatMap((group) => group.items ?? []) as Record<string, unknown>[];
  return items
    .filter((item) => typeof item['slug'] === 'string')
    .map((item) => ({
      slug: item['slug'] as string,
      sourceTable: typeof item['sourceTable'] === 'string' ? (item['sourceTable'] as string) : null,
      appKey: typeof item['appKey'] === 'string' ? (item['appKey'] as string) : null,
      connectionId: typeof item['connectionId'] === 'string' ? (item['connectionId'] as string) : null,
    }));
}

/** A stored table name (`crm:contacts`, or a table id), as the table id to read and the page to link to. */
export function tableOf(stored: string, nav: readonly NavPage[], connectionId: string): { ids: string[]; page: string | null } {
  const cut = stored.indexOf(':');
  const maker = cut > 0 ? stored.slice(0, cut) : null;
  const ref = cut > 0 ? stored.slice(cut + 1) : stored;
  const ours = nav.filter((page) => page.connectionId === null || page.connectionId === connectionId);
  // The app's page whose table is the ref, or ends with it (an app's tables may carry its prefix).
  const page = ours.find((one) => one.sourceTable !== null && (maker === null || one.appKey === maker) && (one.sourceTable === ref || one.sourceTable.endsWith(`_${ref}`) || one.sourceTable === stored));
  const ids = [...new Set([...(page?.sourceTable === undefined || page.sourceTable === null ? [] : [page.sourceTable]), ref, stored])];
  return { ids, page: page?.slug ?? null };
}

/** What "May be e-mailed" says: yes, with how and when they agreed; no; or not known here. */
export type Consent = { state: 'yes'; how: string | null; at: number | null } | { state: 'no' } | { state: 'unknown' };

export interface Who {
  name: string;
  role: string | null;
  page: string | null;
  tableId: string;
  consent: Consent;
}

/** The columns a role is kept in, by the names apps give them. */
const ROLE_COLUMNS = ['job_title', 'role', 'title', 'position'];

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : typeof value === 'number' ? String(value) : null);

const statusOf = (caught: unknown): number => (typeof caught === 'object' && caught !== null && typeof (caught as { status?: unknown }).status === 'number' ? (caught as { status: number }).status : 0);

/**
 * One found person as this reader may see them; null when they may not read
 * the person (refused, or not there). A table name that is not this one is
 * tried as the next.
 */
export async function whoIs(connectionId: string, stored: string, key: string, nav: readonly NavPage[]): Promise<Who | null> {
  const { ids, page } = tableOf(stored, nav, connectionId);
  for (const tableId of ids) {
    let row: Record<string, unknown> | null;
    try {
      row = await readRow(connectionId, tableId, key);
    } catch (caught) {
      // Refused, or gone: this reader may not see them. Not this table (an unknown name): the next.
      const status = statusOf(caught);
      if (status === 403 || status === 404) return null;
      continue;
    }
    if (row === null) return null;
    const consent = await consentOf(connectionId, tableId, key);
    const nameColumn = consent.nameColumn;
    const name = text(nameColumn === null ? undefined : row[nameColumn]) ?? text(row['name']) ?? text(row['full_name']) ?? [text(row['first_name']), text(row['last_name'])].filter((part) => part !== null).join(' ');
    const role = ROLE_COLUMNS.map((column) => text(row![column])).find((value) => value !== null) ?? null;
    return { name: name === '' ? '—' : name, role, page, tableId, consent: consent.consent };
  }
  return null;
}

/** What the record's consent panel says (read as the person); not known when it cannot be read. */
async function consentOf(connectionId: string, table: string, recordId: string): Promise<{ consent: Consent; nameColumn: string | null }> {
  try {
    const reply = await api.post<{ data?: { declared?: boolean; columns?: { name?: string | null }; purposes?: { state?: string; event?: { how?: string | null; at?: number } | null }[] } }>('/api/v1/consent/panel', { connectionId, table, recordId });
    const panel = reply.data;
    if (panel === undefined || panel.declared !== true) return { consent: { state: 'unknown' }, nameColumn: panel?.columns?.name ?? null };
    const yes = (panel.purposes ?? []).find((purpose) => purpose.state === 'yes');
    return {
      consent: yes === undefined ? { state: 'no' } : { state: 'yes', how: yes.event?.how ?? null, at: instantOf(yes.event?.at ?? null) },
      nameColumn: panel.columns?.name ?? null,
    };
  } catch {
    return { consent: { state: 'unknown' }, nameColumn: null };
  }
}

/** A company's name as this reader may see it; null when they may not open it ("kept by a colleague"). */
export async function companyName(connectionId: string, stored: string | null, key: string | null, hosts: readonly CompaniesHost[]): Promise<{ name: string; page: string | null } | null> {
  if (stored === null || key === null) return null;
  const host = hosts.find((one) => one.tableRef === stored || one.id === stored);
  if (host === undefined) return null;
  try {
    const row = await readRow(connectionId, host.id, key);
    const name = text(row?.['name']);
    return name === null ? null : { name, page: host.page ?? null };
  } catch {
    return null;
  }
}
