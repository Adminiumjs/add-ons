# Holiday Calendars — an Adminium add-on

**Who does this business use for the public-holiday calendar?**

Curated country and region day-sets, shipped as static data inside the add-on. An operator picks a
country and a year in the settings panel, looks at the named days, and imports them. Nothing is
fetched, there is no account, no credential and no network allow-list, and the whole of the data is
in the bundle the host has already loaded.

**Scope boundary, and it is a hard line.** This carries public-holiday day-sets and lets somebody
choose one. It is **not** a rota, **not** a leave engine, **not** an absence tracker and **not** a
booking calendar. Both of its hosts already own those, and an add-on that grew one would be a
second, disagreeing copy of a screen the app is built around.

## What it attaches to

| Slot | Surface | What appears |
|---|---|---|
| `settings.add-on.panel` | admin | the picker, the preview, the import, the days held now, a day of the business's own, the countries with no set, and who keeps the data current |

One slot, and that is the whole of what it draws. **The work is the data.** What this add-on
contributes is a list of days; the days themselves are drawn by the host, on the host's own screens,
through the read surface below. An add-on that also drew a calendar would be a second, disagreeing
copy of one the app already has.

`attaches` names `hr` (people-ops), `clinic` (clinic-desk) and `clients` (the Client Portal) rather
than `"*"`, because `"*"` claims every app that will ever exist and an unfalsifiable claim is worse
than a wrong one. Each range is the minor line that app ships on — `^0.1.0` for people-ops,
`^0.2.0` for clinic-desk and the Client Portal. All three are validated on every run by
`packages/host/src/manifest-schema.test.ts`, which puts this manifest through the product's own
validator against each app's declared tables.

people-ops and clinic-desk vendor the add-on host and read the days at their own mount sites, so the
attach-surface gate sees them consume this add-on. **The Client Portal has no add-on seam and
imports no add-on code at all**: it reads this add-on's public setting `days` from the config
Adminium gives its staff screens (see below), so the suite checks its claim for installability only
and says so out loud (`names every app an add-on may target but cannot yet draw in`).

---

## The data

### Which countries, and why that list and not a longer one

**The eight locales this repository ships name eight places. Five of them have a set here; three of
them cannot have one, and the picker names them.**

That is the whole selection rule, and it is a rule rather than a list on purpose: "the countries
whose languages we already speak" is defensible in a sentence, and "the twelve countries somebody
had an afternoon for" is not.

| Set | Days | What it is |
|---|---|---|
| United States | 11 | the federal holidays, weekday rules and all |
| Germany | 9 | the days that are holidays in **every** federal state |
| France | 11 | the days named in the labour code |
| France — Alsace-Moselle | 13 | the national eleven, plus the two kept in Bas-Rhin, Haut-Rhin and Moselle |
| Czechia | 13 | the state holidays and the other holidays |
| Denmark | 10 | the church holidays, after the 2024 change |

Years: **2026 and 2027**. The list is short because every year in it is a year somebody has checked.
The expander would happily produce 2085; the honest number is the number that has been read through,
so "we have not reviewed that year yet" is a state the product can be in and can say.

### The refusal this product ships of its own accord

Several states do not have a public-holiday calendar anybody can compute. They **announce** one,
each year, by decree — and a data pack that guessed them would be worse than a pack that has none,
because a guess is indistinguishable from a fact once it is on a rota.

So the picker **names them, with the reason**, where somebody is choosing:

| Country | Why there is no set |
|---|---|
| China | the State Council publishes each year's arrangement in the autumn, together with the weekends that are worked to bridge the breaks |
| Taiwan | the calendar is published a year at a time, with its make-up days and its shifted weekends |
| Egypt | Islamic dates follow the moon and are settled by sighting, and several national days are moved to the nearest Thursday by decree each year |

Silently omitting them would leave an operator in Cairo assuming Egypt had not been got round to
yet, which is a different and false statement. It is also the honest answer to "why only five
countries": the constraint is not effort, it is what can be known in advance.

A set for one of these could ship as a set of **announced years** — a literal list of dates for the
years a decree has actually been published for, with no rule, no expansion and a hard stop at the
last announced year rather than a silent empty result. That is a different data shape and a
different product. It is not this one.

### What a set deliberately does not carry

**Substitute days.** Where a holiday falls at the weekend, some countries move the day off to the
nearest weekday — American federal practice is the clearest case, and 4 July 2026 is a Saturday. This
set names 4 July and no other day.

A day-set says WHICH DAYS THE STATE NAMES. Whether a particular business shifts its own closure is a
decision that business makes, it differs between employers inside one country, and both hosts
already have a weekend predicate sitting next to where they merge these days in. Emitting a
substitute would be this package inventing a day the statute does not name.

*What would change it:* a host that genuinely needs the observed day. The answer then is a
per-country substitution rule read off each country's own statute — never one global rule, because
there is no global rule — arriving as a new field on `DaySet`, with the same anchor-date suite behind
it. It is not "a small addition to the expander".

**German state holidays.** Ten of the sixteen states add days on top of the national nine, several of
them varying from one municipality to the next (Bavaria's Mariä Himmelfahrt is observed in some and
not others). A set that got that wrong would be wrong in exactly the silent way this package exists
to avoid. The German set says in the picker that it is the national nine.

**Orthodox Easter.** `easterSunday` computes the Western (Gregorian) date. No set here needs the
Julian reckoning; a country whose holidays follow it needs its own rule, not a parameter on this one.

### Why the day-sets are rules rather than a typed-out list of dates

A hand-typed list of dates for two years is 130-odd numbers, and every one of them is a chance to
transcribe a digit wrong in a way no reader would catch. A rule is short enough to check by eye
against the statute it came from, it is the same shape every year, and it makes "and 2028" a one-line
change.

The cost is that the expansion could be self-consistently wrong — a mis-transcribed Easter is still a
Sunday in April — so `daysets.test.ts` pins **anchor dates known from outside this repository** and
`civil.test.ts` pins five years of Easter and both years of every American weekday holiday. An anchor
generated from the code it is anchoring agrees with every bug that code has.

### Names are data, not copy

`Tag der Deutschen Einheit`, `Velký pátek`, `Thanksgiving Day` and the other sixty live in
`src/daysets.ts`, in the language of the country whose holiday it is. They are **not** i18n keys and
they are not translated.

A holiday's name is a proper noun belonging to a country. Translating it does not localise it; it
renames it. And the mechanical half is what makes this work today with no change in either host:
people-ops declares `Holiday.name` as an i18n key and resolves it through `label()`, which is
`tOr(key, key)` — it falls back to the string itself — so a literal name arrives on that app's
calendar, its request form and its skipped-days list exactly as written, with nothing added to any
bundle. clinic-desk's `closures.reason` is a plain text column and takes it the same way.

An i18n key would need the HOST to carry sixty-odd keys in eight languages for days it does not own,
and a key the host has not got renders as `holiday.us.thanksgiving` on somebody's screen.

Everything this add-on says **about** those days — the areas' names, what each set covers, the
refusals, the counts, the maintenance line — is translated, in all eight locales, in
`src/i18n/strings.ts`.

---

## Accuracy, and who keeps it

**Maintained by the Adminium add-ons maintainers.** Last read through **28 August 2026**; the next
yearly read is due **31 August 2027**. A wrong date should be reported as an issue on the add-ons
repository.

That is in the package's own copy as well as here, at the foot of the settings panel, where an
operator is looking — not only in a README nobody opens. Every set additionally carries its own
`derivation`: which statute it was taken from, and when somebody last checked it against that
source. `daysets.test.ts` fails a set that carries neither, and fails a set whose review date is
older than the pack's own.

**The cadence is annual, in late summer**, and that is chosen rather than arbitrary: far enough ahead
of the new year for a business to have next year's calendar before it schedules against it, and late
enough that most states have published any change for that year.

A data pack without an owner and a cadence rots invisibly. Denmark deleted a public holiday with
effect from 2024 — Store Bededag, the fourth Friday after Easter — and a set built from a source
published before 2023 still carries it with nothing about the resulting calendar looking wrong. That
is the single clearest illustration of why the review date exists, and there is a test named after it.

---

## How a host consumes this

`SettingsPanelPayload.patch` writes **the add-on's own values**. It does not write host tables, it
cannot, and no slot in the closed registry would let it. So an import lands in this add-on's own
settings document, and the HOST merges what it finds into whatever it passes its own engine, at the
mount site — the host-maps-at-the-seam rule `@adminium/add-on-host`'s `payloads.ts` codifies, applied
to data instead of to a payload.

### The read surface

```ts
import { nonWorkingDays, epochDayOf } from '@adminium/add-on-holiday-calendars';

interface NonWorkingDay {
  /** ISO `YYYY-MM-DD`. */
  readonly date: string;
  /** In the country's own language for an imported day; the operator's words otherwise. */
  readonly name: string;
  /** Which curated set it came from, or absent for a day somebody typed. */
  readonly from?: { country: string; region?: string; year: number };
}

function nonWorkingDays(values: AddOnSettingValues | undefined): readonly NonWorkingDay[];
```

Pure, total, sorted by date then by name, and defined for values it has never seen: an add-on that
has just been connected and has imported nothing returns `[]`, and a host merging `[]` behaves
exactly as it did before the add-on existed. That is 24 D6 — the app is designed with the hole
already in it — expressed as a return value.

**Nothing else is public.** `StoredDay`, `STORAGE_KEY` and `applyImport` are this package's private
document. A host that reached into an add-on's storage would be coupled to a shape that is expected
to change, and the first change would break two apps this repository does not build.

**It is called `nonWorkingDays` because that is the question both hosts already ask**, in their own
source, in almost those words: `isWorkday(serial, holidays)` in people-ops' `src/lib/leave.ts`, and
`isWorkingDay(iso)` in clinic-desk's `src/lib/schedule.ts`. It is deliberately not `holidays()`,
because half of what it returns is days the operator typed and a clinic that shuts for a training
afternoon has not declared a public holiday — and not `closures()`, which is one host's own word for
its own table.

**It hands out ISO days** because the two hosts store a day two different ways and neither is more
correct. people-ops uses a day serial (whole days since the Unix epoch, UTC) and every leave balance
in that app is arithmetic on it; clinic-desk uses `YYYY-MM-DD` text in a `date` column. The ISO
string converts exactly to both, sorts correctly as text, and is what a person would type.
`epochDayOf` is the conversion for the host that wants the serial — a pure function over the string,
**not** a second field on the record, because a record carrying both would be two statements of one
fact.

### people-ops (`hr`)

`src/lib/leave.ts` takes its holidays as an ARGUMENT everywhere — `holidayOn`, `isWorkday`,
`workingDays`, `balanceFor`, `monthGrid`, `holidaysThisQuarter` — so the engine is already
source-agnostic. The mount site maps and concatenates:

```ts
const fromAddOn: Holiday[] = nonWorkingDays(settings['holiday-calendars']).map((day) => ({
  serial: epochDayOf(day.date)!,   // `Holiday.serial` — whole days since the epoch, UTC
  name: day.name,                  // resolved through `label()`, which falls back to the string
}));

const holidays = [...HOLIDAYS, ...fromAddOn];
```

Every computed leave balance comes off that array, with no change to the engine at all.

### clinic-desk (`clinic`)

The desk offers each day as a SUGGESTION on Hours & closures, because the server's booking rule
reads only rows in the `closures` table — a day held in an add-on's settings cannot close the
diary. "Add as a closure" writes the row; a closure is a span, and a public holiday is a span of
one day:

```ts
const rows = nonWorkingDays(settings['holiday-calendars']).map((day) => ({
  from_date: day.date,
  to_date: day.date,
  label: day.name,      // the country's own name for the day, never run through `t()`
  clinician_id: null,   // the schema's own way of saying the whole practice is shut
}));
```

### the Client Portal (`clients`)

The portal's screens import no add-on code. Adminium hands its staff screens the public settings of
the add-ons the app suggests, and `days` is one of them: a list in which every entry carries `date`
(`YYYY-MM-DD`) and `name`, exactly the two fields `nonWorkingDays` returns (an entry may also carry
`from`, which the portal ignores). The portal suggests this add-on for its Schedule and Capacity
screens: a day in the list is taken out of every person's working week, and shown on the schedule
under its own name.

Nothing is written back and nothing is required: with the add-on absent the list is empty and the
weeks are what they were.

Three hosts, three record shapes, one list, and none of them reaches into this add-on's private
fields. All three mappings are exercised in `calendar.test.ts` — not because this repository can test
another application, but because a claim in a README that no code has ever run is a claim on trust.

---

## The two behaviours

### The refusal (25 D10)

**Importing a year refuses when one of its days falls on a date the operator has already entered by
hand.** It names every collision, says what both sides call the day, and the fix is to remove the
hand-written row — after which the same import succeeds.

That is a real rule and not an invented obstacle. Two rows on one date is not a crash; it is an
**ambiguity**, and the damage is that the add-on would resolve it silently and differently in each
host. Both consuming hosts look a day up by taking the first match — people-ops' `holidayOn` is a
`.find()` — so which name a person reads would depend on the order two lists happened to be
concatenated in. The operator wrote "Closed — family" on 25 December on purpose; the set says
"Juledag"; one of those is about to win, and nothing in this package is entitled to pick.

Two things are deliberately **not** collisions, and they are what keep the rule honest:

- **Two curated sets sharing a date.** Import Germany and France for 2026 and both name 25 December.
  A business that operates in both countries genuinely has two names for that day, neither of them an
  operator's decision, and refusing would make the second country unimportable for no reason.
- **Re-importing the same set.** The days it is about to lay down are the days it laid down last
  time. The naive form of this check refuses the second import of every year against its own output,
  which is why the rule is written against **origin** rather than against **date**.

### Idempotency

**Re-importing a year produces a list deeply equal to the first import, and never touches a day
somebody typed.**

One line carries it: everything stamped with this set's origin goes, everything else stays, and this
year's days are laid down once each. Nothing is appended to, so nothing can accumulate — and a day
with no origin can never match an origin.

**The filter is on `from`, not on `date`, and the difference is the worst bug this add-on could
have.** A date-based replace would delete a clinic's own closure on any date a public holiday
happened to share, silently, on a re-import nobody thought was destructive. A clinic shuts for
reasons that are not public holidays, and losing one of those loses a real appointment. The test
that guards it puts a business's own days on 24 December and 17 August and then imports four sets
across both years twice over.

D16 is the same promise one level up: disconnecting takes the surfaces and leaves every day behind.

---

## What makes this package different from its siblings

**`connect: { kind: "none" }`.** No credential, no account, no authorization step.

**No egress at all**, which is stricter than an allow-list. There is no `network` block, no
`outbound-http` capability, and `compatibility.requires` is `[]`. A host cannot bind an HTTP client
to a hostname this add-on has not declared, and it has declared none.

**No server half, and no demo transport.** Every other add-on here builds two bundles; this one
builds `dist/client.js` and nothing else. `demoTransport` exists because 24 D11 forbids a real
third-party call in a demo and an add-on that would otherwise make one needs a stand-in. There is no
call here to stand in for, and shipping an empty server module so the manifest could carry the field
would be a module that exists to satisfy a schema.

**No `applySettings`.** Every other add-on keeps a module-level copy of its settings because its
engines are handed settings rather than a store. This add-on's engines take the values as an
argument, so there is no copy to keep in step and no state that can be one change behind what the
business last saved.

**No scopes, and no `requiredSchema`.** It reads no host record and writes none, and it brings no
table. The honest length of that list is zero.

**It names no company** — the first add-on in this repository of which that is true. `namesCompany`
is `false` and `noCompanyKeys` carries the positive statement the host renders where a
not-affiliated line would otherwise go, because rendering nothing there is indistinguishable from
having forgotten it.

That last one is the interesting check. `COMPANY_MARKS` in `src/add-on-facts.ts` is `[]`, and **an
empty list is exactly the shape a broken one takes**: a glob that stopped matching, a file nobody
filled in, and a correct declaration all export the same value. So the emptiness is not asserted on
its own. `sources.test.ts` sweeps every shipped source and all eight locale bundles for the marks the
*sibling* add-ons declare — a real needle list — and proves the sweep is not vacuous by running the
same predicate over text that does name a company. `packages/host/src/trademarks.test.ts` closes it
from outside, by requiring this package's row in `TRADEMARKS.md` to say `*(none)*` precisely because
this export is empty.

---

## Refused adjacencies

Recorded here so the boundary is ruled rather than rediscovered.

- **This is NOT the refused record-import contract**: curated first-party datasets behind a fixed
  picker, with no user-supplied import surface.
- **This is NOT the spreadsheet-import engine carve-out**: no spreadsheet, no user file, nothing
  uploaded.
- **There is deliberately NO dayset-source contract**: a second data pack is not independent code, so
  a contract would fail the two-implementation gate spirit (24 section 5.5).

The third is worth a sentence more, because it is the one somebody will want to add. The
implementation contracts in this repository exist where two genuinely different implementations meet
one interface — a real carrier and a demo carrier, two artwork sources. A second country's holidays
are not a second implementation of anything; they are more rows in `DAY_SETS`, behind the same
expander, checked by the same suite. A contract there would be an interface with one side.

---

## Building and checking

```
npm run typecheck    # tsc -b --force
npm test             # 256 cases, including a real `vite build` for the dist grep
npm run build        # tsc -b && vite build → dist/client.js
```

The suites, and what each is for:

| File | What it holds the line on |
|---|---|
| `civil.test.ts` | the arithmetic, against five years of Easter and both years of every American weekday holiday — facts from outside this repository |
| `daysets.test.ts` | the data's own integrity: no duplicate day in a set, every date real and inside its year, every set carrying its derivation and review date, and literal anchor dates per country |
| `calendar.test.ts` | the refusal, idempotency, the tolerant read, and the three hosts' mappings |
| `manifest.test.ts` | the manifest against `register()`, the build, and the four empty declarations |
| `sources.test.ts` | no address, no clock, no die, no physical CSS direction, no company named, nothing test-only reachable from the entry |
| `i18n/strings.test.ts` | eight locales complete, actually translated, and every set's limits surviving translation |
| `i18n/numerals.test.ts` | the shared digit suite, plus the one number that must go round it |
| `ui/settings-panel.test.tsx` | the panel renders words, renders what is held, and renders every outcome the engine can return |
| `dist.test.ts` | the release grep over built bytes, and the shared purity rule pointed at them |

Two of those deserve a note.

**`dist.test.ts` is not a formality and it caught something.** A Vite library build does not strip
comments that sit inside an expression, so five occurrences of "product" and "promising" written
inside `register()`'s object literal went straight into `dist/client.js` while every source-level
check was green. The release sweep would have found them. They were reworded rather than carved out.

**The i18n length checks had to learn that a character count is not a length.** The first version was
a flat floor — a note had to be over 45 characters — and both Chinese bundles failed immediately with
copy that was perfectly correct: 十一个联邦假日 carries the same six English words in seven characters.
The floor is scaled now by how compactly each locale writes this bundle, computed from the very text
it is judging.

## Trademarks

See [`TRADEMARKS.md`](./TRADEMARKS.md), which points at the repository's single
[`TRADEMARKS.md`](../../TRADEMARKS.md). This add-on references no mark at all, which is exactly why
it still has a section there.
