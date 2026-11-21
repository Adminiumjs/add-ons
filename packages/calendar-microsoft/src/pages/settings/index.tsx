/** The add-on's console screen: what the manifest's page `calendar-microsoft-settings` points at. */
import { CalendarPage, MICROSOFT_SCREEN } from '@adminium/add-on-calendar-console';
import type { ReactNode } from 'react';

export default function CalendarSettingsPage(): ReactNode {
  return <CalendarPage screen={MICROSOFT_SCREEN} />;
}
