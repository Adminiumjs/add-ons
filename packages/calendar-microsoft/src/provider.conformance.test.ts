/** The `calendar-provider@1` kit, run against this provider and the stand-in for Graph. */
import { calendarProviderConformance } from '@adminium/add-on-contracts/testing/calendar-provider';

import { createCalendarProvider } from './provider.ts';
import { createFakeGraph } from './testing/fake-graph.ts';

const graph = createFakeGraph();

calendarProviderConformance({
  name: 'Outlook Calendar',
  make: () => createCalendarProvider({ http: graph.http }),
  driver: {
    ...graph.driver,
    addBusy: ({ start, end }) => graph.driver.addBusy({ calendarId: 'primary', start, end }),
  },
  mainCalendar: 'primary',
  forbiddenWords: ['Private dentist visit', 'Do not share', '12 Hidden Lane', 'friend@example.test'],
});
