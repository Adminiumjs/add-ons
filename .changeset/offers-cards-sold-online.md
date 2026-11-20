---
"@adminium/add-on-offers": patch
---

Offers sells gift cards online. A shopper's line makes its own card: `issue` takes the recipient's name, address, message, the sender and a language, and gains a reserve phase — the card is made inactive when the order is written, loaded, made active and mailed once when it is paid, and cancelled when the order is given up unpaid. A new action, `recall`, named by the selling line and under the card's own lock, cancels a paid order's card while it is unspent and refuses with what is left when any of it was spent — read from the card's payments, so a top-up or a cancel by hand hides nothing — so a spent card's order cannot be refunded. A guest's own save never makes such a card active. The new `card-sale-online@1` shape carries both postings; a card sold online is told to be typed at checkout, and its recipient is mailed when the shop cancels it, in eight languages. A till's cards are sold, loaded and taken back as before.
