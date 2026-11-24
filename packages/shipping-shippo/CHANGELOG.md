# @adminium/add-on-shipping-shippo

## 1.0.37

## 1.0.36

### Patch Changes

- 498fd39: The customs form, the countries a shop delivers to, its customs defaults and export numbers, and the customs invoice on a label, in all eight languages. A shop that has not listed a country abroad sees no change.
- 1188375: Shipping labels can send parcels abroad: it makes the customs declaration the engine hands it, with each line's total value and weight, and sends the recipient's phone only for such a parcel.

## 1.0.35

### Patch Changes

- 01c5096: Add Shipping labels, which connects to Shippo: rates, one purchase per parcel, label files, tracking and refund requests on the shop's own account. The carrier contract gains `rateRefs` on a look-up and `duplicates` on its answer.
