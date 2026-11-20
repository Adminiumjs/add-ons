---
"@adminium/add-on-invoices": patch
---

Invoices gains a ninth kind, `packing-slip`: what goes in a parcel, printed for whoever packs it, with no money on it at all — the order's own number exactly as stored (`orderNumber`, never a number of its own or a series prefix), the day, whom it ships to and where, the delivery service, each line with its variant, SKU and quantity, and a note, in all eight languages, as a web page and a PDF on A4 or letter. A receipt can now map a `delivery`, printed on its own row under the subtotal so a stored total that includes it adds up on the page (and a reduction beside it prints exactly what was taken off), and the `payments` made for the sale, each live one printed on its own row under the total in its method's word — a gift card and a card — in place of the one row for what was received. A receipt that maps neither draws to the same bytes as before.
