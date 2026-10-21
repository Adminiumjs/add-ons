# Wallet payments

**Connects to PayPal.** Your customers pay an invoice, or any record with an
amount, with their PayPal account on the PayPal page. The payment is recorded
in Adminium, against the record, once PayPal says it went through.

Adminium is software you run. You are the seller: the account, the
credentials and the money are yours, and Adminium is not a party to any
payment. The customer pays on the PayPal page, so nothing they type there
reaches your server.

## What it needs

- A **PayPal Business account**.
- Adminium 0.3.32 or newer, on an address your customers can reach, served on
  port 443: PayPal delivers webhooks to port 443 only.
- A **REST app** in the PayPal developer dashboard, for each mode you use
  (sandbox for testing, live for real payments), with Accept payments on. Its
  **client ID** and **secret** go into Studio. The secret opens the whole
  account (PayPal has no narrower key), so keep it in Studio and nowhere else.
- A **webhook** on the same app, pointing at the address Studio shows, with
  these events: `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`,
  `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.PENDING`, `PAYMENT.CAPTURE.REFUNDED`
  and `PAYMENT.CAPTURE.REVERSED`. Its **webhook ID** goes into Studio too:
  Adminium checks every webhook's signature with it, on your server.

Set it up in **Studio → Payments**. Everything you type there is kept
encrypted, per mode, and can be replaced without disconnecting.

## How a payment goes

The customer approves the payment on the PayPal page and comes back.
Adminium then takes the money (PayPal calls this a capture) and records it.
If the customer never comes back, the webhook or Adminium's own check takes
the money instead. A payment PayPal holds, for example while an eCheck
clears, shows as processing with the reason PayPal gives.

A checkout that Adminium ends, or that is more than six hours old, is never
taken, even if the customer approves it afterwards.

## What it does not do

It holds no money, takes no fee and stores nothing a customer types on the
PayPal page. It takes the 24 currencies PayPal takes, with HUF, JPY and TWD in
whole units only. It offers one way to pay: the customer's PayPal account.

## Trademarks

PayPal is a trademark of PayPal, Inc., named here only to say which service
this add-on connects to. Adminium is not affiliated with PayPal. See
[TRADEMARKS.md](./TRADEMARKS.md).

## Licence

AGPL-3.0-only.
