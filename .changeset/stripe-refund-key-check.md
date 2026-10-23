---
'@adminium/add-on-payments-stripe': patch
---

Card payments: the key check now sees a key that may not give refunds. It asked Stripe for an empty refund, which Stripe refuses for the missing payment before it checks the key's access, so a key without "Charges and Refunds: write" passed the check and its first refund failed. The check now asks on the charges endpoint, where Stripe checks the access first.
