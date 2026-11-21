/**
 * WHAT THE TWO CALENDAR SCREENS WORK OUT, with no React and no call: the two
 * status cards, the count, who may be sent a link, and what "Check my setup"
 * can truthfully say.
 *
 * ─── "READY" IS EARNED ──────────────────────────────────────────────────────
 * With nobody signed in, a provider can only say whether the ID and secret
 * belong together. A wrong redirect address, an API left off and an app left in
 * Testing show only when someone connects. So a saved app reads "Almost ready"
 * until the first person has connected through it.
 */

export type Reach = 'cannot-connect' | 'poll-only' | 'push';
export type InstallState = 'ready' | 'not-set-up' | 'secret-refused' | 'cannot-read-keys';
export type AccountState = 'connecting' | 'connected' | 'partial' | 'reconnect' | 'disconnecting' | 'setup';

export interface InstallInfo {
  key: string;
  registered: boolean;
  clientId: string | null;
  tenant: string | null;
  redirectUri: string | null;
  redirectMoved: boolean;
  reach: Reach;
  install: InstallState;
  accounts: number;
  secretEndsOn: string | null;
}

export interface PersonAccount {
  id: string;
  state: AccountState;
  since: number;
  address: string | null;
  addressDiffers: boolean;
  grantEndsAt: number | null;
}

export interface Person {
  connection: string;
  table: string;
  row: string;
  name: string | null;
  address: string | null;
  account: PersonAccount | null;
  lastSyncedAt: number | null;
  elsewhere: boolean;
}

export type SetupCard = 'not-set-up' | 'almost' | 'ready' | 'refused' | 'keys-lost';
export type InstantCard = 'waiting' | 'on' | 'polling' | 'cannot';

export function setupCard(info: Pick<InstallInfo, 'install' | 'registered' | 'accounts'>): SetupCard {
  if (info.install === 'secret-refused') return 'refused';
  if (info.install === 'cannot-read-keys') return 'keys-lost';
  if (!info.registered || info.install === 'not-set-up') return 'not-set-up';
  return info.accounts > 0 ? 'ready' : 'almost';
}

export function instantCard(info: Pick<InstallInfo, 'reach' | 'registered'>): InstantCard {
  if (info.reach === 'cannot-connect') return 'cannot';
  if (!info.registered) return 'waiting';
  return info.reach === 'push' ? 'on' : 'polling';
}

/** A person with a connection that works now, or is being made. */
const working = (state: AccountState): boolean => state === 'connected' || state === 'connecting';

export function countsOf(people: readonly Person[]): { connected: number; reconnect: number } {
  let connected = 0;
  let reconnect = 0;
  for (const person of people) {
    if (person.account === null || person.account.state === 'disconnecting') continue;
    if (working(person.account.state) || person.account.state === 'setup') connected += 1;
    else reconnect += 1;
  }
  return { connected, reconnect };
}

/** The rows of "Connected accounts", and who the invite panel offers. */
export function splitPeople(people: readonly Person[]): { connected: Person[]; invite: Person[] } {
  const shown = people.filter((person) => person.account !== null && person.account.state !== 'disconnecting');
  const invite = people.filter((person) => person.account === null && !person.elsewhere);
  return { connected: shown, invite };
}

export const initialsOf = (name: string | null, address: string | null): string => {
  const words = (name ?? address ?? '?').trim().split(/\s+/);
  return words.slice(0, 2).map((word) => [...word][0]?.toUpperCase() ?? '').join('');
};

export const firstNameOf = (person: Pick<Person, 'name' | 'address'>): string => person.name?.trim().split(/\s+/)[0] ?? person.address ?? '';

const DAY_MS = 86_400_000;

/** Whole days until a date; negative once it has passed. */
export function daysUntil(date: string, now: number): number {
  return Math.ceil((Date.parse(`${date}T00:00:00Z`) - now) / DAY_MS);
}

export type SecretNotice = { kind: 'none' } | { kind: 'soon'; days: number } | { kind: 'past' };

/** Thirty days before the secret's written end date, the page says so. */
export function secretNotice(date: string | null, now: number): SecretNotice {
  if (date === null) return { kind: 'none' };
  const days = daysUntil(date, now);
  if (days < 0) return { kind: 'past' };
  return days <= 30 ? { kind: 'soon', days } : { kind: 'none' };
}

const GOOGLE_CLIENT = /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/;
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOMAIN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const isGoogleClientId = (value: string): boolean => GOOGLE_CLIENT.test(value);
export const isMicrosoftClientId = (value: string): boolean => GUID.test(value);
/** A directory: its ID, or its domain. `common` is what "work and personal accounts" uses, and is not typed. */
export const isTenant = (value: string): boolean => GUID.test(value) || DOMAIN.test(value);
export const isDay = (value: string): boolean => DAY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

export type LocalProblem = 'empty' | 'client-shape' | 'tenant-needed' | 'tenant-shape' | 'date-shape';

export interface SetupDraft {
  clientId: string;
  /** Empty: keep the saved one. */
  secret: string;
  hasSavedSecret: boolean;
  /** Microsoft only: `null` for Google. */
  tenant: string | null;
  singleTenant: boolean;
  /** Microsoft only: the secret's end date, optional. */
  endsOn: string;
}

/** What can be judged before anything is sent. */
export function localProblem(draft: SetupDraft, clientOk: (value: string) => boolean): LocalProblem | null {
  const clientId = draft.clientId.trim();
  if (clientId === '' || (draft.secret.trim() === '' && !draft.hasSavedSecret)) return 'empty';
  if (!clientOk(clientId)) return 'client-shape';
  if (draft.tenant !== null) {
    const tenant = draft.tenant.trim();
    if (draft.singleTenant && tenant === '') return 'tenant-needed';
    if (tenant !== '' && !isTenant(tenant)) return 'tenant-shape';
  }
  if (draft.endsOn.trim() !== '' && !isDay(draft.endsOn.trim())) return 'date-shape';
  return null;
}

export type CheckAnswer = 'accepted' | 'refused' | 'expired' | 'not-set-up' | 'unknown' | 'unreachable';
export type CheckResult = 'good' | 'unproved' | 'refused' | 'expired' | 'unreachable';

export function checkResult(answer: CheckAnswer): CheckResult {
  switch (answer) {
    case 'accepted':
      return 'good';
    case 'unknown':
      return 'unproved';
    case 'refused':
    case 'not-set-up':
      return 'refused';
    case 'expired':
      return 'expired';
    case 'unreachable':
      return 'unreachable';
  }
}

export interface CalendarChip {
  id: string;
  /** The main calendar is `primary`. */
  main: boolean;
  on: boolean;
}

/** A calendar id typed by hand, judged before it is added. */
export type AddCalendarProblem = 'empty' | 'spaces' | 'already';

export function addCalendarProblem(value: string, known: readonly string[]): AddCalendarProblem | null {
  const id = value.trim();
  if (id === '') return 'empty';
  if (/\s/.test(id)) return 'spaces';
  return known.includes(id) ? 'already' : null;
}

/** The ISO day `days` after a moment, for the busy count's range. */
export const dayAfter = (now: number, days: number): string => new Date(now + days * DAY_MS).toISOString().slice(0, 10);
