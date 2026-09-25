---
'@adminium/add-on-barcode-labels': patch
'@adminium/add-on-holiday-calendars': patch
---

Barcode Labels attaches to Point of Sale (`pos`, `^0.2.0`) for shelf labels: a label sheet can be drawn from a host's own barcode column mapped onto its `code` slot, with the symbology read from the number (thirteen digits are EAN-13, check digit still checked; anything else Code 128) and the entity word optional. Holiday Calendars attaches to the Client Portal (`clients`, `^0.2.0`), which reads the public `days` setting to take holidays out of a studio's working weeks; its README now maps a day onto Clinic Desk's closure row as `from_date`, `to_date`, `label`.
