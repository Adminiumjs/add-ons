# @adminium/add-on-payments-paypal

## 1.0.13

### Patch Changes

- 6435e26: Wallet payments is a new add-on that connects to PayPal. A shop's customers pay an invoice or a record with their PayPal account on the PayPal page, and Adminium takes the money once they approve it and records the payment. It checks every PayPal webhook's signature on the shop's own server, never takes money for a checkout it has ended or one more than six hours old, and takes the 24 currencies PayPal takes (HUF, JPY and TWD in whole units). Needs Adminium 0.3.33. Its README is the setup guide: the REST app, the webhook and its ID, a sandbox test payment and going live.
