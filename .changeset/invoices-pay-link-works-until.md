---
'@adminium/add-on-invoices': patch
---

Invoices: a printed invoice's pay link now says the day it stops opening, under its code to scan: "Works until Friday, Nov 20, 2026", the day and its weekday in the invoice's own language. The day is the link's own expiry, given with the link by Adminium 0.3.61 or later, so a copy drawn again later says the same day; with an earlier Adminium the line is not printed and the rest of the page is unchanged. The invoice kind gains an optional date slot, `payUntil`, that Adminium fills beside the link.
