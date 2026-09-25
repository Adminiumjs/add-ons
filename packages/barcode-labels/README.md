# Barcode Labels — an Adminium add-on

**What number goes on the sticker, and how does it get onto paper?**

A catalogue row is given an EAN-13 or a Code 128 number, the number is checked, and a sheet of
labels for that row is drawn as a PDF from the row's own screen. Both symbologies are encoded here,
from tables compiled into the bundle: nothing is fetched, there is no account, no credential and no
network allow-list.

**Scope boundary, and it is a hard line.**

* It **draws** a number the shop already owns. It does not issue one, does not register one, and
  cannot make one unique beyond the shop it is installed in — that is a numbering authority's job,
  and getting a company prefix is something the shop does directly.
* It does **not** read a scanner. **The engine owns barcode scanning** (owner ruling O3,
  2026-08-28): the register-scan and keyboard-wedge hook is a `barcode-scanner` capability in the
  closed capabilities registry, which point-of-sale declares. There is no camera decode here, no
  wedge listener, and no place for one.
* It is **not** a stock system and not a till. Both host apps already own those.

---

## What it attaches to

| Slot | Surface | What appears |
|---|---|---|
| `record.actions` | both | on a catalogue row: the number, its bars, how many labels, and a sheet |
| `settings.add-on.panel` | admin | the numbers given out, the form that gives one, and what a sheet is |

### `record.actions` — this is the first fill of that slot, anywhere

The slot was bought on 2026-08-28 against a seven-exhibit dossier and **shipped unfilled**. The
closed registry's own entry says so; `packages/host/src/payloads.ts` repeats the consequence, that a
reader will not find a fill by grepping. This is it.

What the registry says the slot is for is *one opening, on the screen where somebody is already
looking at ONE record, to do a thing to it*. A sheet of labels for the row in front of you is that
sentence with nothing left over: the person is on the row's screen because the row is what they are
dealing with, and there is no other screen in either host where the request makes sense — a sheet of
labels is **for** a row, and a list of rows is not a row.

**`patchRecord` is never called.** The payload carries an optional write handle and its own comment
explains that hosts genuinely differ about whether an add-on may write back. This add-on is squarely
in the read-only half, and it did not merely end up there: the obvious write is to stamp the number
onto the record so the shop's own list can show it, and to do that the add-on would have to pick a
**field name**. `barcode`? `ean`? `code`? Nothing on the payload says what the shop calls that
column, or whether it has one, and choosing one would be an add-on inventing a host's schema — which
is `payloads.ts`'s founding mistake in the other direction.

So the number lives in this add-on's own table, the record is read and never written, and the screen
says so. The payoff is that the absence costs nothing: the surface renders **the same markup**
whether the host offers a handle or not, and `record-action.test.tsx` renders it both ways and
compares them, so an edit that reached for the handle turns that case red.

### `attaches` names three apps and not `"*"`

`factory` (factory-ops) and `maker` (maker-shop) on `^0.1.0`, and `pos` (Point of Sale) on `^0.2.0` —
each the minor line that app ships on. `"*"` claims every app that will ever exist, and an
unfalsifiable claim is worse than a wrong one — a reader cannot tell it from a checked one.

### Shelf labels at a till (`pos`) — the number from the host's own column

Point of Sale keeps each product's number on the menu item itself (`menu_items.barcode`), not in this
add-on's list, and it mounts no add-on slot. So it reaches the label sheet the other way: through
the `document-render` provider, with a document profile the app ships that MAPS its columns onto the
sheet's slots — the row's key onto `sku`, `barcode` onto `code`, the item's name onto `reference`.
Nothing is copied into this add-on and nothing is written back to the till.

No column says which symbology a till's number is, so when `symbology` is not mapped the number
decides: thirteen digits are EAN-13 — and the check digit is still checked, so a mistyped product
number is refused rather than drawn as some other code — and anything else is Code 128. `entity`,
the small word above the reference, is optional for the same reason: a till has no column for it.

A till keeps no count either, so `count` is left unmapped: the sheet carries one label, or the
number the request for it asks for, read as a whole number and kept between one and 240 (ten
sheets of 24).

The sheet is drawn in the base-14 fonts' ASCII, as every sheet here is, so an item name with an
accent is refused `LATIN_ONLY`, naming the letters, rather than printed with holes in it.

---

## The two symbologies

Both are hand-rolled, because 25 D11 allows an add-on no runtime dependency the host has not got,
and the host has React. A barcode is a lookup table, a weighted sum and a fixed guard pattern; the
sibling delivery add-on writes a whole PDF from nothing for the same reason.

### EAN-13

Thirteen digits, ninety-five modules, and **the first digit is not drawn at all** — it is carried by
*which* of two alphabets each of the six left-hand digits is written in, in a pattern the first
digit selects. A scanner reads the six left digits, notices which alphabets it needed, and looks the
first digit up from that.

Three alphabets, thirty entries, all copied by hand — which makes them the likeliest thing in the
package to have a typo in. They are not independent, and `ean13.test.ts` asserts the relations
rather than trusting the transcription:

* `R[d]` is `L[d]` with every module flipped;
* `G[d]` is `R[d]` backwards;
* every `L` entry has an odd number of dark modules and every `G` and `R` entry an even one — which
  *is* the mechanism that carries the undrawn first digit;
* every entry is exactly two bars and two spaces.

Then the anchors: whole ninety-five-module encodings of `5901234123457` and `4006381333931`, pinned
as bit strings so they can be compared character for character against any published table, and the
check digits of four real numbers a reader can redo by hand.

It is drawn at the **nominal module width its standard fixes** — 0.33 mm — and centred, never
stretched to fill the label. Stretching would push the magnification outside the range the standard
allows, silently, on a label that still looked fine.

### Code 128, set B

Set B and only set B. What a shop types is a reference it already uses on its own paperwork —
`ADM-4417`, `WAL-COAST-06` — and every character of every such reference is in set B. Set C would
save modules only on a code that is all digits, and a thirteen-digit all-digit code is an EAN-13,
which this add-on already draws at the size a counter expects.

The table is 107 six-digit width patterns. `code128.test.ts` puts it through three structural facts
of the published table, each of which a mistyped digit breaks:

* six widths summing to eleven, every entry;
* an **even** number of bar modules in every entry — the self-checking property the symbology is
  built on, which needs no reference to hand;
* all 107 distinct.

Then the anchor: the symbol values and the checksum of the example every account of this symbology
works through, and its 134 modules end to end.

The checksum is a weighted sum **modulo 103** — the size of the character set, not of the table,
because 103 to 106 are the starts and the stop and a checksum can never be one of them. Using 107
would be the kind of mistake that works for most inputs.

Code 128 has no nominal size, so it is fitted to the label — capped at the same 0.33 mm so a short
reference does not come out with bars twice the width of the EAN-13 on the sticker beside it, and
floored at 0.19 mm, which is where the length limit comes from.

---

## The two refusals (25 D10)

Both exist because the thing they prevent fails **silently at a counter** rather than loudly here.

### The check digit

An EAN-13 carries its own checksum in its last digit. A thirteen-digit number whose last digit is
wrong is not a slightly-wrong barcode — it is not a barcode: a scanner computes the check for itself
and reports nothing at all. The label prints, looks right, goes on the box, and the failure surfaces
weeks later at somebody's counter with no clue attached.

It is also the most fixable error there is, which is what makes it worth refusing rather than
warning about. This package knows exactly which digit the first twelve demand, so **the refusal
names it**:

> The last digit is worked out from the twelve before it, and for those twelve it should be 7 rather
> than 0. Either the last digit is mistyped or one of the others is, and a scanner will read neither.

**It never corrects it silently.** A number a shop typed is a number a shop believes it owns;
changing the last digit for them would hand back a different article number from the one on their
own paperwork, with no way to tell. The whole value of the refusal is that a person looks at the two
numbers.

### Two rows, one number

A barcode is an identity. Two rows carrying the same one is not a duplicate record, it is an
**ambiguity**, resolved at the counter by whichever row the shop's own lookup happens to find first.
The add-on is not entitled to pick, and picking silently is the worst available behaviour. So the
refusal **names the row that already holds the number**, and the fix is to change one of the two.

**It compares the code text and ignores the symbology**, which is the part worth reading twice. A
scanner hands a till a run of characters and does not say which symbology it came off:
`5901234123457` drawn as an EAN-13 and the same digits drawn as a Code 128 arrive identical.
Comparing the pair `(symbology, code)` would have let those two coexist and would have been exactly
wrong.

And what is **not** a collision, which is the half that keeps it usable:

* giving a row the number it already has — that is how somebody changes the symbology, or re-types a
  number to check it, and refusing would make the form refuse the state it is already in;
* giving a row a different number — a row holds exactly one, and the second assignment replaces the
  first rather than accumulating.

Three narrower refusals sit beside them: a code that is not thirteen digits, a character set B has
no bars for (named), and a code longer than this label can hold at a width a scanner can read (both
lengths named).

---

## The label sheet

A real PDF, assembled byte by byte the way `packages/shipping-dhl/src/label.ts` assembles one: six
object kinds, offsets collected while they are concatenated so the cross-reference table is exact,
and two of the fourteen base fonts every reader already has. A bar is `x y w h re` followed by `f` —
that is the whole trick, and it is vector, which is what makes it scan. A bitmap barcode at the
wrong resolution has bar edges landing between printer dots, and that is the classic reason a label
reads on one machine and not the next.

**The geometry is described rather than named.** A4, twenty-four labels to a sheet, three across and
eight down, each 63.5 mm by 33.9 mm, with a 2.5 mm gutter between columns. There is a very common
stationery sheet with those measurements and this add-on does not say whose it is — 24 D12 forbids
naming a company, and a stationery reference is a company's catalogue number. The measurements are
more use to a shop anyway: a name only helps somebody who buys that name.

**Nothing is printed in a label's margin and there is no cut line.** These sheets are cut already, so
a printed rectangle would land on the sticker rather than between two of them.

### Determinism

The same facts give the same bytes. No `/CreationDate`, nothing generated, and every coordinate
written through one two-decimal conversion — a `String(x)` would write `12` for one coordinate and
`12.000000000000002` for the next, which is what floating-point millimetre arithmetic does whenever
it feels like it, and a document whose bytes depend on that cannot be asserted at all.

The day printed at the foot of each label is the **shop's** day, arriving on the payload as
`ShopClock`, not a clock this add-on read. That is why the document can be dated and still be
asserted, and `sheet.test.ts` checks both halves: change the day and the bytes change, change
nothing and they do not.

### The alphabet, which is the cost of embedding no font

Not embedding a font is what keeps the bundle small and the file openable anywhere. The price is a
**Latin alphabet and no other**. A row reference written in another script has no glyphs, so it is
**dropped and the count is reported** — emitting the bytes anyway would put whatever a reader's
default encoding made of them on the sticker, and substituting a question mark would be this add-on
inventing somebody's reference. Both surfaces say so in words, in all eight languages. The bars are
unaffected: bars have no alphabet.

---

## The read surface

Two pure functions over the values the host already holds, and they are the reason a host installs
this rather than the two surfaces:

```ts
import { codeFor, renderLabelSheet } from '@adminium/add-on-barcode-labels';

// What number does this row carry? `undefined` for one nobody has given a number to.
const assigned = codeFor(settings['barcode-labels'], row.key);

// The whole of the drawing, as PDF bytes, from the same shape the record surface builds.
const pdf = renderLabelSheet({ assigned, entity: 'part', reference: row.key, count: 24, on: today });
```

`codeFor` answers `undefined` rather than a `{ found: false }` sentinel. A sentinel reads as more
explicit and is not: it lets a caller that forgot the flag carry on holding an object, which is
exactly the shape that draws an empty barcode.

**What is deliberately not exported**: the storage shape and the two encoders. A host that reached
into an add-on's storage would be coupled to a shape that is expected to change; a host that reached
for an encoder would be drawing a barcode with no quiet zone and no idea how wide a module has to
be, which is the failure this whole package is careful about.

### The one seam it cannot check, said on screen

Numbers are filed under the host's **catalogue key**, and looked up on a record by `recordId`.
Nothing on either payload lets the add-on verify the two namespaces meet, so a host that mounts the
record surface on a screen whose `recordId` is something else finds nothing, forever, with nothing
anywhere to say why.

So the empty state **names the key it looked for**. An operator who sees a key they do not recognise
has a two-second diagnosis instead of a mystery, and that is the most an add-on on this seam can
honestly do.

---

## What it deliberately does not do

**A run of labels for the whole catalogue.** `SettingsPanelPayload.samples` is one record per family
of what the shop sells — its own comment says so — and it is the only view of a catalogue any slot
payload offers. A whole-catalogue sheet needs a list-level surface, which is an open decision and not
one this add-on is entitled to assume. So the form offers the families it is handed, the settings
panel says out loud that a sheet covers one row and not a catalogue, and the record surface names
the key it looked for where the limit bites. **Where the absence shows, it is in words rather than
hidden.**

**Anything that reads a scanner**, per O3 above.

**Allocating or looking up a number.** There is no `network` block, no `outbound-http` capability and
no address anywhere in the sources — `add-on-facts.ts` declares `INERT_ORIGINS` empty, which is the
strictest state there is, because a host's egress net then reports *every* address as a finding.

---

## What is not wired up yet

One thing is outstanding. A second was, and cleared the same day — both are kept, because a gap that
closes is the most useful kind to have written down.

1. ~~**No host mounts `record.actions`.**~~ **CLEARED 2026-08-28.** Both `factory-ops` and
   `maker-shop` now declare the id in their own `HOSTED_SLOTS` and mount it, and this add-on is the
   fill. That makes it the first fill of `record.actions` anywhere — the slot was bought unfilled —
   and, because there are **two** hosts rather than one, the first evidence that the id names a
   SURFACE rather than an app (24 D21).

2. **The published validator predates the slot, and it is a release behind in two steps rather than
   one.** `record.actions` was added to the registry in the Adminium monorepo on 2026-08-28 and that
   package has not been republished, so `validateManifest` rejects this manifest with `Invalid
   option` on `addOn.slots.1.slot`. That is the validator being behind, not the manifest being wrong.

   **The detail that matters, and it was nearly got wrong:** npm carries `0.2.1`, `0.2.2-rc.0` and
   `0.2.2`, this repo's dependency range is `^0.2.1` — which would take `0.2.2` — and
   `package-lock.json` pins `add-on-contracts-0.2.1.tgz`, so `npm ci` installs **0.2.1**. A whole
   release has already come and gone without this lockfile noticing. So clearing this needs **two**
   owner-initiated steps, not one: cut a release carrying the twelfth slot (the changeset for it is
   in the Adminium monorepo), *then* refresh this repo's lockfile.

**Recorded rather than worked around, and that was decided rather than assumed.** Three independent
readings were taken of whether to add a self-clearing "pending release" marker to
`packages/host/src/manifest-schema.test.ts` instead of leaving three cases red. Two of three said
leave it red, and the case that carried it is the lockfile fact above: a marker sold on clearing
itself at the release **would not have cleared at the release**, because nothing here re-resolves the
dependency. Two further objections stood unanswered — in CI the Adminium checkout does not exist at
all, so the local-versus-published comparison a marker needs cannot be made where the gate is
actually enforced; and the version of the marker that avoids naming an id would excuse *any* string
the enum rejects, reopening the same class of bypass this file already keeps a fixture against.

So the three failures stay. They name the package, the field, the index, the rejected value and the
entire accepted vocabulary, which is more than a marker would have said — and nothing is blocked by
them: npm does not abort the workspace loop, and the other seven packages and the other 28 cases in
that file run and pass.

---

## Trademarks

**None.** See [`TRADEMARKS.md`](./TRADEMARKS.md), which points at the repository's single file.

A barcode is where a reader most expects a company to turn up, and this add-on had three chances to
name one and takes none of them: the symbologies are published standards, the numbers are the shop's
own, and the label sheet is described by its measurements rather than by a catalogue number.
`sources.test.ts` checks all three — a numbering authority, a stationery reference, a scanner or
printer make — as well as the marks its sibling add-ons declare, and shows the sweep is not vacuous
by running the same predicate over text that *does* name a company.

---

## Tests

```
npm run typecheck && npm test && npm run build
```

279 cases over eleven files. The ones worth knowing about:

| File | What it holds |
|---|---|
| `ean13.test.ts` | the table relations, and two whole encodings pinned from outside |
| `code128.test.ts` | the three structural facts of the 107-entry table, and a published example end to end |
| `codes.test.ts` | both refusals, each with a matching case saying what it does **not** refuse |
| `sheet.test.ts` | the cross-reference offsets followed to the objects they claim; the same bytes twice; the bars are the encoding |
| `record-action.test.tsx` | the surface renders identically with and without `patchRecord` |
| `sources.test.ts` | no address, no clock, no `Date` at all, no company in three directions |
| `dist.test.ts` | the release grep over built bytes, where a comment inside an expression survives |

The last of those earns its place: this add-on's subject is the thing a shop sells, and the ordinary
English word for that carries a run the release sweep bans. Every one of them was reworded rather
than carved out, in all eight languages — and the built-output grep caught one that every
source-level check had passed, in a comment inside an object literal, exactly as its own header
warned.
