# @adminium/add-on-barcode-labels

## 1.0.5

## 1.0.4

### Patch Changes

- cf6e34d: Receipts drawn from an app's own rows print what the money was for. The receipt kind gains three optional slots — `serviceDate` (the day of a visit or a repair), `attendedBy` (who gave the service or served at the till) and `reference` (an insurer's claim number, an order number) — drawn beside the receipt number, on the page and in the PDF, only when the app maps them. A payment method is read in the spellings apps store (`transfer`, `bank_transfer`, `credit_card`, `check`, `gift_card`, `qr`, in any case) and anything else prints as the app wrote it. A receipt number that is only digits, as Adminium's register hands out, prints in the receipt series (`REC-2`, not `2`); a number with a prefix is left alone. A till's receipt that maps its lines keeps them when the amount charged is mapped too, and can map the ticket's stored subtotal, tax and total, with a reduction taken off the whole ticket printed as its own row.

  Barcode Labels explains its `count` slot in eight languages: left unmapped a sheet carries one label, or the number a request asks for, kept between one and 240.

## 1.0.3

### Patch Changes

- 775c6a7: Every add-on now needs Adminium 0.3.1 or later. That release checks the app versions an add-on attaches to, reads the invoice and quote shapes, and draws the letterhead's tax number, payment instructions and footer.
- 775c6a7: `addOn.attaches` now names the app versions that ship. Every range said `^1.0.0`, a major no app has reached: apps are 0.x and patch-only, so each range is now the minor line its app ships on — `^0.2.0` for Clinic Desk, `^0.1.0` for every other app.
- 775c6a7: Barcode Labels attaches to Point of Sale (`pos`, `^0.2.0`) for shelf labels: a label sheet can be drawn from a host's own barcode column mapped onto its `code` slot, with the symbology read from the number (thirteen digits are EAN-13, check digit still checked; anything else Code 128) and the entity word optional. Holiday Calendars attaches to the Client Portal (`clients`, `^0.2.0`), which reads the public `days` setting to take holidays out of a studio's working weeks; its README now maps a day onto Clinic Desk's closure row as `from_date`, `to_date`, `label`.

## 1.0.2

## 1.0.1

### Patch Changes

- Implements the `document-render` contract, so its label sheets render through Adminium's document pipeline. Needs Adminium 0.2.6 or later.
- `compatibility.minAdminiumVersion` now names the first Adminium release that can install this add-on. Every 1.0.0 file claimed 1.0.0, a version no Adminium release has reached.
