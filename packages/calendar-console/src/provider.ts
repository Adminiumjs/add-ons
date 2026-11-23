/**
 * WHAT DIFFERS BETWEEN THE TWO ADD-ONS: names, the guide's five steps, the
 * client ID's shape, and how "Check my setup" asks the provider.
 */
import { isGoogleClientId, isMicrosoftClientId } from './model.ts';
import type { WordKey } from './words/index.ts';

export interface GuideChip {
  /** Text copied as it stands. `redirect` is this install's own address. */
  text: string | 'redirect';
  note?: WordKey;
}

export interface GuideChoice {
  id: string;
  title: WordKey;
  pick: WordKey;
  body: WordKey;
}

export interface GuideStep {
  short: WordKey;
  title: WordKey;
  body: WordKey;
  chips?: readonly GuideChip[];
  body2?: WordKey;
  choices?: readonly GuideChoice[];
  warn?: WordKey;
  link?: { place: string; url: string };
  note?: WordKey;
  /** Shown only for this choice of step 2. */
  noteFor?: { choice: string; note: WordKey };
  keys?: boolean;
}

export interface CalendarProviderScreen {
  key: 'calendar-google' | 'calendar-microsoft';
  company: 'Google' | 'Microsoft';
  product: 'Google Calendar' | 'Outlook Calendar';
  icon: 'calendar' | 'calendar-days';
  clientOk: (value: string) => boolean;
  clientPlaceholder: string;
  clientShapeError: WordKey;
  refusedError: WordKey;
  need: WordKey;
  /** Microsoft keeps a directory, and the secret's end date. */
  hasTenant: boolean;
  /** The choice of step 2 that needs the directory. */
  singleTenantChoice: string | null;
  /** How the check asks: a made-up code, or the app's own sign-in on a named directory. */
  check: { grant: 'pair' } | { grant: 'app'; scope: string };
  addHelp: WordKey | null;
  addPlaceholder: string;
  trouble: readonly WordKey[];
  steps: readonly GuideStep[];
}

const SCOPE = 'https://www.googleapis.com/auth/';
const PROJECT_NAME = 'Adminium calendar';

export const GOOGLE_SCREEN: CalendarProviderScreen = {
  key: 'calendar-google',
  company: 'Google',
  product: 'Google Calendar',
  icon: 'calendar',
  clientOk: isGoogleClientId,
  clientPlaceholder: '…apps.googleusercontent.com',
  clientShapeError: 'errGoogleShape',
  refusedError: 'errGoogleRefused',
  need: 'needGoogle',
  hasTenant: false,
  singleTenantChoice: null,
  check: { grant: 'pair' },
  addHelp: 'addHelpGoogle',
  addPlaceholder: 'abc123@group.calendar.google.com',
  trouble: ['troubleGoogleRedirect', 'troubleGoogleApi', 'troubleGoogleTesting'],
  steps: [
    { short: 'g1Short', title: 'g1Title', body: 'g1Body', chips: [{ text: PROJECT_NAME }], body2: 'g1Body2', link: { place: 'Google Cloud console', url: 'https://console.cloud.google.com' } },
    {
      short: 'g2Short',
      title: 'g2Title',
      body: 'g2Body',
      choices: [
        { id: 'workspace', title: 'g2CardWorkspace', pick: 'g2PickWorkspace', body: 'g2NoteWorkspace' },
        { id: 'gmail', title: 'g2CardGmail', pick: 'g2PickGmail', body: 'g2NoteGmail' },
      ],
      warn: 'g2Warn',
    },
    {
      short: 'g3Short',
      title: 'g3Title',
      body: 'g3Body',
      chips: [
        { text: `${SCOPE}calendar.app.created`, note: 'g3ChipOwn' },
        { text: `${SCOPE}calendar.events.freebusy`, note: 'g3ChipBusy' },
        { text: 'openid email', note: 'g3ChipWho' },
      ],
      note: 'g3Note',
    },
    { short: 'g4Short', title: 'g4Title', body: 'g4Body', chips: [{ text: 'redirect' }], note: 'g4Note' },
    { short: 'g5Short', title: 'g5Title', body: 'g5Body', keys: true },
  ],
};

export const MICROSOFT_SCREEN: CalendarProviderScreen = {
  key: 'calendar-microsoft',
  company: 'Microsoft',
  product: 'Outlook Calendar',
  icon: 'calendar-days',
  clientOk: isMicrosoftClientId,
  clientPlaceholder: '00000000-0000-0000-0000-000000000000',
  clientShapeError: 'errMicrosoftShape',
  refusedError: 'errMicrosoftRefused',
  need: 'needMicrosoft',
  hasTenant: true,
  singleTenantChoice: 'single',
  // The app's own sign-in, which Microsoft allows only on a named directory: without one the engine answers "unknown".
  check: { grant: 'app', scope: 'https://graph.microsoft.com/.default' },
  addHelp: null,
  addPlaceholder: '',
  trouble: ['troubleMicrosoftRedirect', 'troubleMicrosoftConsent', 'troubleMicrosoftSingle'],
  steps: [
    { short: 'm1Short', title: 'm1Title', body: 'm1Body', chips: [{ text: PROJECT_NAME }], note: 'm1Note', link: { place: 'Microsoft Entra admin center', url: 'https://entra.microsoft.com' } },
    {
      short: 'm2Short',
      title: 'm2Title',
      body: 'm2Body',
      choices: [
        { id: 'single', title: 'm2CardSingle', pick: 'm2PickSingle', body: 'm2NoteSingle' },
        { id: 'mixed', title: 'm2CardMixed', pick: 'm2PickMixed', body: 'm2NoteMixed' },
      ],
    },
    { short: 'm3Short', title: 'm3Title', body: 'm3Body', chips: [{ text: 'Calendars.ReadWrite', note: 'm3Chip' }], note: 'm3Note', noteFor: { choice: 'single', note: 'm3Admin' } },
    { short: 'm4Short', title: 'm4Title', body: 'm4Body', chips: [{ text: 'redirect' }], note: 'g4Note' },
    { short: 'm5Short', title: 'm5Title', body: 'm5Body', keys: true },
  ],
};
