# @adminium/add-on-payments-stripe

## 1.0.31

## 1.0.30

## 1.0.29

## 1.0.28

### Patch Changes

- 0ed268d: Card payments runs Stripe smart readers at the counter with the same key (`card-terminal@1`): a reader is paired with the code it shows, at one of the account's Terminal locations, the till's amount is sent to it as a card-present payment, a tip may be asked on the reader, and a cancel takes it off unless the card was tapped first. Test mode pairs a simulated reader (`simulated-wpe`). The key template and the README list three permissions for readers alone (Payment Intents: write, Terminal Readers: write, Terminal Locations: read). An Interac payment is refunded on the reader only. Needs Adminium 0.3.60.

## 1.0.27

## 1.0.26

## 1.0.25

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

### Patch Changes

- f6950c0: Card payments: the key check now sees a key that may not give refunds. It asked Stripe for an empty refund, which Stripe refuses for the missing payment before it checks the key's access, so a key without "Charges and Refunds: write" passed the check and its first refund failed. The check now asks on the charges endpoint, where Stripe checks the access first.

## 1.0.13

### Patch Changes

- 15437e9: Card payments is a new add-on that connects to Stripe. A shop's customers pay an invoice or a record on the Stripe page, by card and the other ways the shop's Stripe account offers, and Adminium records the payment. It takes a restricted key only, never sends a customer anywhere but the Stripe page, and holds payments in BHD, JOD, KWD, OMR, TND and UGX until it is checked how Stripe takes them. Needs Adminium 0.3.33. It ships the template of a private Stripe App, stamped per shop, that makes the restricted key with exactly the access it needs, and its README is the setup guide for both ways to make the key.
