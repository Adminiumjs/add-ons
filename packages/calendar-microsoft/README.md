# Outlook Calendar

Puts each booking into a calendar the add-on keeps in the person's own Microsoft
account, and lets their busy times block their slots. **Only times are read,
never what an event is called.**

## Setting it up

Each business registers its own app in Microsoft Entra. Adminium hosts nobody's
connection. Open the add-on's page and follow the five-step guide:

1. Register an app in the Microsoft Entra admin center.
2. Choose who can sign in: **Single tenant only** for a Microsoft 365 team, or
   **Any Entra ID Tenant + Personal Microsoft accounts** if anyone uses
   Outlook.com.
3. Add the delegated permission `Calendars.ReadWrite`. On Microsoft 365, an admin
   must then press **Grant admin consent**, because new organisations no longer
   let people approve calendar access themselves.
4. Add a **Web** redirect address, the one the guide shows.
5. Paste the client ID, the Directory (tenant) ID for a single-tenant app, and
   the secret's **Value**. Add the secret's end date, and you are told 30 days
   before it ends.

**When the secret ends, every Outlook connection stops at once.** That is the
business's to fix with a new secret. Nobody needs to reconnect.

## How "never reads what events are called" is kept

Microsoft's permission covers the whole calendar, and no narrower one hides
titles, so the promise rests on how this code asks:

1. Every busy read is `calendarView` with
   `$select=start,end,showAs,isAllDay,isCancelled`, on every page. It is never
   `delta`, which cannot be told to leave fields out.
2. A subscription never asks for resource data.
3. No single event of a person's calendar is ever fetched.

The one delta read is of the calendar this add-on made, to notice an event
someone deleted there. Only its id, times and version are copied from it.

## Limits to know

- **Changes.** Microsoft documents subscriptions on `/me/events` only. A change
  it does not cover is found by the regular check, so it can take up to about 12
  minutes to block a slot. A booking made in that gap shows as a clash.
- **All-day events** are read from the time Microsoft returns. In zones of UTC+13
  and UTC+14 such an event can read one day early.

## How it is built

`dist/server.js` implements `calendar-provider@1`. The engine runs the sign-in
and every token refresh, and hands this code a client that adds the bearer
header, so it never holds a token or the client secret. The tests run the shared
conformance kit against a stand-in shaped from Microsoft's reference pages.
