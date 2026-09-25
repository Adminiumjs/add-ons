---
'@adminium/add-on-invoices': patch
'@adminium/add-on-barcode-labels': patch
---

Receipts drawn from an app's own rows print what the money was for. The receipt kind gains three optional slots — `serviceDate` (the day of a visit or a repair), `attendedBy` (who gave the service or served at the till) and `reference` (an insurer's claim number, an order number) — drawn beside the receipt number, on the page and in the PDF, only when the app maps them. A payment method is read in the spellings apps store (`transfer`, `bank_transfer`, `credit_card`, `check`, `gift_card`, `qr`, in any case) and anything else prints as the app wrote it. A receipt number that is only digits, as Adminium's register hands out, prints in the receipt series (`REC-2`, not `2`); a number with a prefix is left alone. A till's receipt that maps its lines keeps them when the amount charged is mapped too, and can map the ticket's stored subtotal, tax and total, with a reduction taken off the whole ticket printed as its own row.

Barcode Labels explains its `count` slot in eight languages: left unmapped a sheet carries one label, or the number a request asks for, kept between one and 240.
