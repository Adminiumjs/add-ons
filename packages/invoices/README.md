# Invoices & Receipts

Turns a record into a document somebody can keep: an **invoice**, a **receipt**
or a **credit note**, drawn as a web page and — where the built-in fonts can
draw the language — as a PDF.

Nothing is fetched from anywhere and no account is needed. The sheet is drawn
from tables compiled into the bundle, and the figures are the deployment's own.

## What it does

You say which table holds the invoices and which columns hold the customer, the
dates and the lines. A document is drawn from that, in the language you choose.
It implements the `document-render@1` contract, so Adminium's own document
machinery — the stored mappings, the record trigger, the render job — can drive
it without knowing which implementation it has.

## What it is not

**It is not an accounting system.** It keeps no ledger, tracks no balance, and
its arithmetic is confined to adding up the lines it is given, under one written
law (`money.ts`). "Total" on a document from here is a total, never a "total
due": recorded payments do not reduce it, because there is no balance model
behind it.

**It does not decide which column means what.** The host maps its own record
onto the outline's slot ids at the mount site, and this add-on validates that
mapping — see `subjectFromHost.ts`, which carries the argument at length.

## Languages

The document's chrome is written in all eight compiled locales (`words.ts`). PDF
is drawn in the base-14 fonts, which cover Latin scripts; a document in a
language they cannot draw gets the web page and a typed refusal naming the
characters, rather than a page of blanks.

## Licence

AGPL-3.0-only.
