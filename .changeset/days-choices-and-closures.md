---
'@adminium/add-on-invoices': patch
'@adminium/add-on-holiday-calendars': patch
---

Invoices & Receipts: a document's lines can carry the day each is for (`items.date`) and the choices made on them (`items.options`, a list of names). The names print under the line one after another, "Farro · Grilled chicken · Avocado", above any reduction; when any line has a day, the lines print it in a column before the description, or under the line on an 80 mm till roll. An invoice gains the period it covers (`serviceFrom`, `serviceTo`, printed as "Period of service", in German "Leistungszeitraum") and a `reference` printed beside its number. Each is optional, and a document that maps none of them draws to exactly the bytes it drew before. Holiday Calendars attaches to online ordering (`ordering`, `^0.2.0`), which reads the days from the public setting and writes a closure row for each day on a staff click.
