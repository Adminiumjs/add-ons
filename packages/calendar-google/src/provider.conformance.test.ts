/**
 * T08's `calendar-provider@1` kit, run against this provider and the stand-in.
 * Under the two ruled permissions a lost calendar id cannot be found again, and
 * the kit is told so; `provider.test.ts` proves what happens then.
 */
import { calendarProviderConformance } from '@adminium/add-on-contracts/testing/calendar-provider';

import { createCalendarProvider } from './provider.ts';
import { createFakeGoogle } from './testing/fake-google.ts';

const google = createFakeGoogle();

calendarProviderConformance({
  name: 'Google Calendar',
  make: () => createCalendarProvider({ http: google.http }),
  driver: google.driver,
  mainCalendar: 'primary',
  forbiddenWords: ['Private dentist visit', 'Do not share', '12 Hidden Lane', 'friend@example.test'],
  findsLostCalendar: false,
});
