/** The add-on's console screen: what the manifest's page `calendar-google-settings` points at. */
import { CalendarPage, GOOGLE_SCREEN } from '@adminium/add-on-calendar-console';
import type { ReactNode } from 'react';

export default function CalendarSettingsPage(): ReactNode {
  return <CalendarPage screen={GOOGLE_SCREEN} />;
}
