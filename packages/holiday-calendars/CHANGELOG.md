# @adminium/add-on-holiday-calendars

## 1.0.12

## 1.0.11

## 1.0.10

## 1.0.9

## 1.0.8

### Patch Changes

- 6edde71: Holiday Calendars also attaches to Clinic Desk and Online ordering at 0.3, and Barcode Labels to Point of Sale at 0.3, so an install that has one of them keeps it when the app is updated.

## 1.0.7

## 1.0.6

### Patch Changes

- e973000: Invoices & Receipts: a document's lines can carry the day each is for (`items.date`) and the choices made on them (`items.options`, a list of names). The names print under the line one after another, "Farro · Grilled chicken · Avocado", above any reduction; when any line has a day, the lines print it in a column before the description, or under the line on an 80 mm till roll. An invoice gains the period it covers (`serviceFrom`, `serviceTo`, printed as "Period of service", in German "Leistungszeitraum") and a `reference` printed beside its number. Each is optional, and a document that maps none of them draws to exactly the bytes it drew before. At most 40 names print under a line, then how many more. A day the calendar does not have, such as 2026-02-30, now prints as the app stored it on every day of a document, where before it failed the document or printed the day it rolled over to. Holiday Calendars attaches to online ordering (`ordering`, `^0.2.0`), which reads the days from the public setting and writes a closure row for each day on a staff click. A day of the business's own may have a name of at most 120 characters, what such a closure can hold.

## 1.0.5

## 1.0.4

## 1.0.3

### Patch Changes

- 775c6a7: Every add-on now needs Adminium 0.3.1 or later. That release checks the app versions an add-on attaches to, reads the invoice and quote shapes, and draws the letterhead's tax number, payment instructions and footer.
- 775c6a7: `addOn.attaches` now names the app versions that ship. Every range said `^1.0.0`, a major no app has reached: apps are 0.x and patch-only, so each range is now the minor line its app ships on — `^0.2.0` for Clinic Desk, `^0.1.0` for every other app.
- 775c6a7: Barcode Labels attaches to Point of Sale (`pos`, `^0.2.0`) for shelf labels: a label sheet can be drawn from a host's own barcode column mapped onto its `code` slot, with the symbology read from the number (thirteen digits are EAN-13, check digit still checked; anything else Code 128) and the entity word optional. Holiday Calendars attaches to the Client Portal (`clients`, `^0.2.0`), which reads the public `days` setting to take holidays out of a studio's working weeks; its README now maps a day onto Clinic Desk's closure row as `from_date`, `to_date`, `label`.

## 1.0.2

## 1.0.1

### Patch Changes

- `compatibility.minAdminiumVersion` now names the first Adminium release that can install this add-on. Every 1.0.0 file claimed 1.0.0, a version no Adminium release has reached.
