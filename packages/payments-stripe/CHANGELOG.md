# @adminium/add-on-payments-stripe

## 1.0.14

### Patch Changes

- f6950c0: Card payments: the key check now sees a key that may not give refunds. It asked Stripe for an empty refund, which Stripe refuses for the missing payment before it checks the key's access, so a key without "Charges and Refunds: write" passed the check and its first refund failed. The check now asks on the charges endpoint, where Stripe checks the access first.

## 1.0.13

### Patch Changes

- 15437e9: Card payments is a new add-on that connects to Stripe. A shop's customers pay an invoice or a record on the Stripe page, by card and the other ways the shop's Stripe account offers, and Adminium records the payment. It takes a restricted key only, never sends a customer anywhere but the Stripe page, and holds payments in BHD, JOD, KWD, OMR, TND and UGX until it is checked how Stripe takes them. Needs Adminium 0.3.33. It ships the template of a private Stripe App, stamped per shop, that makes the restricted key with exactly the access it needs, and its README is the setup guide for both ways to make the key.
