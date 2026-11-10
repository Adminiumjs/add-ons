# @adminium/add-on-payments-paypal

## 1.0.24

## 1.0.23

## 1.0.22

## 1.0.21

## 1.0.20

### Patch Changes

- de98c9a: Stripe Payments and PayPal Payments are installed once for the whole server (`addOn.scope: "server"`): every database on it takes payments into the same provider account. Invoices & Receipts says where each template and invoice is listed ("Shown in"): chips on each card and row, a Workspace filter in All in one menu, the list cut to the tab's workspace in One at a time, the New modal offering only the templates listed there, a control in the editor that saves each change at once, and a note when the open document is not listed here. The payment providers need Adminium 0.3.49 or newer; Invoices draws "Shown in" on 0.3.49 and newer and installs on every release it did before.

## 1.0.19

## 1.0.18

## 1.0.17

## 1.0.16

## 1.0.15

## 1.0.14

## 1.0.13

### Patch Changes

- 6435e26: Wallet payments is a new add-on that connects to PayPal. A shop's customers pay an invoice or a record with their PayPal account on the PayPal page, and Adminium takes the money once they approve it and records the payment. It checks every PayPal webhook's signature on the shop's own server, never takes money for a checkout it has ended or one more than six hours old, and takes the 24 currencies PayPal takes (HUF, JPY and TWD in whole units). Needs Adminium 0.3.33. Its README is the setup guide: the REST app, the webhook and its ID, a sandbox test payment and going live.
