# @adminium/add-on-payments-square

## 1.0.29

## 1.0.28

### Patch Changes

- abacf9a: A new add-on, Card readers, connects to Square: the till puts the amount on a Square Terminal (`card-terminal@1`), paired by a device code typed on the Terminal. The customer may add a tip; the till sees what was taken, the tip apart, the card's brand and last four. A checkout ends taken, or cancelled with the reason Square gives. Refunds go back through Square (an Interac payment is refunded on the Terminal only), and refunds and disputes made in the Square Dashboard are read by Adminium. Needs Adminium 0.3.60.
