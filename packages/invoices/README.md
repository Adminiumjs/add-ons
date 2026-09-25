# Invoices & Receipts

Turns a record into a document somebody can keep: an **invoice**, a **quote**,
a **receipt**, a **credit note** or a **statement**, drawn as a web page in
every language and — where the built-in fonts can draw the language — as a PDF.

Nothing is fetched from anywhere and no account is needed. The sheet is drawn
from tables compiled into the bundle, and the figures are the deployment's own.

## Two ways to use it

**Map a table you already have.** You say which table holds the invoices and
which columns hold the customer, the dates and the lines. A document is drawn
from that, in the language you choose. It implements the `document-render@1`
contract, so Adminium's own document machinery — the stored mappings, the
record trigger, the render job — can drive it without knowing which
implementation it has.

**Build an app's tables on its shapes.** The add-on defines two shapes that an
app builds its own tables on (`addOn.shapes` in `manifest.json`):

- `invoices/invoice@1` — a document (numbered, sent, void), its lines and its
  payments;
- `invoices/quote@1` — a document (sent, accepted, declined, withdrawn) and its
  lines.

On a table built on a shape, Adminium keeps the rules the shape declares: the
numbers run without gaps per series (`INV-`, `REC-`, and the quote series), each
line's amount, the tax and the total are worked out in the currency's own
decimals, the balance falls as payments are recorded, a sent invoice is locked,
and three reminders wait for each unpaid invoice until somebody sends them. The
documents print those stored figures as they are.

## Receipts from an app's own rows

An app can ship a document profile for the `receipt` kind on a table of its
own — a practice's payments, a till's tickets — rather than on a shape.

- **What it was for.** Besides the invoice it pays, a receipt can name the day
  of the service (`serviceDate`), who gave it or served at the till
  (`attendedBy`) and a reference the payer asked for (`reference`). Each is
  optional and printed beside the receipt number only when it holds a value.
- **How it was paid.** `paidWith` is read in the spellings apps store —
  `bank-transfer`, `transfer`, `bank_transfer`, `card`, `credit_card`,
  `debit_card`, `cheque`, `check`, `cash`, `gift_card`, `qr`, `other`, in any
  case — and printed in the document's language. Anything else prints exactly
  as the app wrote it.
- **Its number.** Left unmapped, Adminium's register numbers the receipt with
  bare digits; the page prints them after the receipt series' prefix (`REC-2`).
  A number with letters in it is the app's own and prints as it is.
- **A sale.** A receipt that maps `items` is drawn with its lines, even when it
  maps the amount received too. Map the stored `subtotal`, `tax` and `total`
  (the total before the tip) and they print as stored; a total below subtotal
  and tax prints the difference as a reduction.

## What it records, and what it never does

**It records payments** — each one somebody enters against an invoice, with its
own receipt number, its date and how it was made — and the balance left after
them. A voided payment stays on file and stops counting.

**It never takes a payment.** It charges no card, holds no bank details but the
instructions you type for your clients to read, and moves no money: a payment
is only ever what a person records after the money has arrived.

**It does not decide which column means what.** The host maps its own record
onto the outline's slot ids at the mount site, and this add-on validates that
mapping — see `subjectFromHost.ts`, which carries the argument at length.

## Settings

The letterhead (name, address lines, image, tax name and number), how your
clients pay you, the footer, the prefix and first number of each series, the
default tax rate and terms, and the three reminder ladders — gentle (7, 21, 45
days after the due date), standard (3, 14, 30) and firm (1, 7, 21). A default is
copied onto a document when it is created, so changing a setting never changes
a document already made.

## Languages

The document's chrome is written in all eight compiled locales (`words.ts`), and
figures are written the way the document's language writes them, with the
currency's own sign. PDF is drawn in the base-14 fonts, which cover Latin
scripts; a document in a language they cannot draw — Arabic, both Chinese
scripts — gets the print copy, right to left where the language runs that way,
with the note "For this language, use Print and choose Save as PDF."

## Licence

AGPL-3.0-only.
