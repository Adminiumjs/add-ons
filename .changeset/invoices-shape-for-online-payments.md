---
"@adminium/add-on-invoices": patch
"@adminium/add-on-host": patch
---

Invoices & Receipts adds the shape `invoices/invoice@2` beside `@1`, for invoices paid online: its payments carry a unique payment reference, the service the payment came through, what was refunded of it (paid counts each payment less its refunds, so a refund reopens the balance), and a card's approval code and last four digits; `online` is a way to pay. The invoice email and its reminders carry a pay button, and a printed invoice its pay link and a code to scan while something is owed. `@1` is unchanged, so no app moves until its own update. The host's document contract learns the `qr` slot type Adminium already sends.
