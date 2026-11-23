# Google Calendar

Puts each booking into a calendar the add-on keeps in the person's own Google
account, and lets their busy times block their slots. **Only times are read,
never what an event is called.**

## Setting it up

Each business registers its own Google app. Adminium hosts nobody's connection.
Open the add-on's page and follow the five-step guide, which takes about 15
minutes:

1. Create a Google Cloud project and turn on the Google Calendar API.
2. Set up Google Auth platform. Choose **Internal** if everyone is on your
   Workspace; otherwise **External**, then press **Publish app**. An app left in
   **Testing** loses every connection after 7 days.
3. Under **Data Access**, add the four permissions the guide lists: `openid`,
   `email`, `calendar.app.created` and the events busy-times permission.
4. Create a **Web application** client and paste the redirect address the guide
   shows.
5. Paste the client ID and secret, and press **Check my setup**.

The check can only tell whether the ID and secret belong together. Connect your
own calendar to finish it: that proves the redirect address and the permissions.

## What it can and cannot see

| | |
|---|---|
| `calendar.app.created` | Makes and edits only the calendar this add-on keeps |
| The events busy-times permission | Lists when someone is busy, and watches for changes |
| `openid`, `email` | The address the person signed in with |

Every busy read names the fields it wants (`start`, `end`, `status`,
`transparency`), so a title, place, description or guest is not sent, even for
an event marked public.

## Limits to know

- **Changes.** With a public https address, Google reports changes as they
  happen. Without one, busy times are found by the regular check, so one can
  take up to about 12 minutes to block a slot. A booking made in that gap shows
  as a clash.
- **Other calendars.** These permissions cannot list a person's calendars. The
  main one counts, and others are added by their calendar ID.
- **Reconnecting after a disconnect.** The calendar stays in the person's
  account, and Adminium remembers it, so connecting again uses the same one.
  These permissions cannot list calendars, so if that memory is ever lost, a
  second calendar of the same name is made.

## How it is built

`dist/server.js` implements `calendar-provider@1`. The engine runs the sign-in
and every token refresh, and hands this code a client that adds the bearer
header, so it never holds a token or the client secret. The tests run the shared
conformance kit against a stand-in shaped from Google's reference pages.
