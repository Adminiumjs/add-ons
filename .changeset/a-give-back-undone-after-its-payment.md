---
'@adminiumjs/add-on-offers': patch
---

Money given back to a gift card from a payment, taken back after that payment itself was undone, is no longer taken off the card a second time. Undoing the payment already gave the card everything it took; in either order the card now ends with all of it. Before, voiding the payment first and the give-back second left the card short by what had been given back.
