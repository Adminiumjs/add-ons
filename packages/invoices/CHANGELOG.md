# @adminium/add-on-invoices

## 1.0.6

### Patch Changes

- e973000: Invoices & Receipts: a document's lines can carry the day each is for (`items.date`) and the choices made on them (`items.options`, a list of names). The names print under the line one after another, "Farro · Grilled chicken · Avocado", above any reduction; when any line has a day, the lines print it in a column before the description, or under the line on an 80 mm till roll. An invoice gains the period it covers (`serviceFrom`, `serviceTo`, printed as "Period of service", in German "Leistungszeitraum") and a `reference` printed beside its number. Each is optional, and a document that maps none of them draws to exactly the bytes it drew before. At most 40 names print under a line, then how many more. A day the calendar does not have, such as 2026-02-30, now prints as the app stored it on every day of a document, where before it failed the document or printed the day it rolled over to. Holiday Calendars attaches to online ordering (`ordering`, `^0.2.0`), which reads the days from the public setting and writes a closure row for each day on a staff click. A day of the business's own may have a name of at most 120 characters, what such a closure can hold.

## 1.0.5

### Patch Changes

- 475aefe: On an Arabic printed copy an amount reads as it is written, its currency beside its digits, instead of being turned around by the page's right-to-left direction.

## 1.0.4

### Patch Changes

- cf6e34d: Receipts drawn from an app's own rows print what the money was for. The receipt kind gains three optional slots — `serviceDate` (the day of a visit or a repair), `attendedBy` (who gave the service or served at the till) and `reference` (an insurer's claim number, an order number) — drawn beside the receipt number, on the page and in the PDF, only when the app maps them. A payment method is read in the spellings apps store (`transfer`, `bank_transfer`, `credit_card`, `check`, `gift_card`, `qr`, in any case) and anything else prints as the app wrote it. A receipt number that is only digits, as Adminium's register hands out, prints in the receipt series (`REC-2`, not `2`); a number with a prefix is left alone. A till's receipt that maps its lines keeps them when the amount charged is mapped too, and can map the ticket's stored subtotal, tax and total, with a reduction taken off the whole ticket printed as its own row.

  Barcode Labels explains its `count` slot in eight languages: left unmapped a sheet carries one label, or the number a request asks for, kept between one and 240.

## 1.0.3

### Patch Changes

- 775c6a7: Every add-on now needs Adminium 0.3.1 or later. That release checks the app versions an add-on attaches to, reads the invoice and quote shapes, and draws the letterhead's tax number, payment instructions and footer.
- e666d6e: Invoices & Receipts gives apps the shapes of an invoice and a quote to build on — gapless numbers, every line, the tax and the total in the currency's own decimals, payments and three held reminders — and draws quotes, receipts and statements with the business's tax number, how to pay and a footer.

## 1.0.2

### Patch Changes

- 1f493a1: The invoice manager and editor are the add-on's own page

  The surface moved out of Adminium itself: the add-on declares a page, and the
  host mounts it and gives it a navigation row. The floor rises to 0.2.12 — the
  first release whose host publishes the runtime this page calls — and the
  release tool will refuse to ship this until that version exists.

## 1.0.1

### Patch Changes

- First release. Invoices, receipts and credit notes drawn from your own records through the `document-render` contract. Needs Adminium 0.2.6 or later.
- `compatibility.minAdminiumVersion` now names the first Adminium release that can install this add-on. Every 1.0.0 file claimed 1.0.0, a version no Adminium release has reached.
