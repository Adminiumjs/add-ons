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
  `PAYMENT.CAPTURE.DECLINED`, `PAYMENT.CAPTURE.DENIED`,
  `PAYMENT.CAPTURE.PENDING`, `PAYMENT.CAPTURE.REFUNDED`,
  `PAYMENT.CAPTURE.REVERSED`, `CUSTOMER.DISPUTE.CREATED`,
  `CUSTOMER.DISPUTE.UPDATED` and `CUSTOMER.DISPUTE.RESOLVED`. Its **webhook
  ID** goes into Studio too: Adminium checks every webhook's signature with
  it, on your server.

Set it up in **Studio → Payments**. Everything you type there is kept
encrypted, per mode, and can be replaced without disconnecting.

## Set it up

Do it first in the PayPal sandbox, make a test payment, then do the same in
live mode. Studio keeps a checklist of the steps.

### 1. The REST app and its credentials

1. Sign in at developer.paypal.com with your PayPal Business account and open
   Apps & Credentials. The switch at the top chooses Sandbox or Live: start in
   Sandbox.
2. Create an app (type Merchant), with Accept payments on.
3. Copy its client ID and secret into the sandbox fields of Wallet payments in
   Studio. Studio checks them at once with PayPal.

The secret opens the whole PayPal account. Keep it in Studio and nowhere else;
if it ever leaks, make a new secret in the same place and replace it in Studio.

### 2. The webhook and its webhook ID

1. In the same app, under Webhooks, add a webhook. Paste the address Studio
   shows for that mode. It must be on port 443 (an address with no port): PayPal
   sends webhooks to port 443 only.
2. Tick these events: `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`,
   `PAYMENT.CAPTURE.DECLINED`, `PAYMENT.CAPTURE.DENIED`,
   `PAYMENT.CAPTURE.PENDING`, `PAYMENT.CAPTURE.REFUNDED`,
   `PAYMENT.CAPTURE.REVERSED`, `CUSTOMER.DISPUTE.CREATED`,
   `CUSTOMER.DISPUTE.UPDATED`, `CUSTOMER.DISPUTE.RESOLVED`.
3. Save, then copy the webhook's **ID** (not its address) into the webhook ID
   field in Studio. Adminium checks every webhook's signature with it, on your
   server, without asking PayPal.

### 3. A test payment

A sandbox payment needs a sandbox **buyer** login. On the PayPal developer
site, open Testing tools → Sandbox accounts and use the email and password of
the Personal account there. In Studio → Payments, "Send a test payment" opens
the pay page for a pretend invoice of one unit in a new tab; choose "Pay with
PayPal" and sign in as that buyer. Back in Studio you see what PayPal took,
that the webhook arrived, and what would have been recorded. Nothing is
written to your tables.

### 4. Going live

Switch Apps & Credentials to Live, create the live app and its webhook the same
way, paste the live client ID, secret and webhook ID into the live fields, and
switch Wallet payments to live in Studio. Test links stop working when you go
live.

## How a payment goes

The customer approves the payment on the PayPal page and comes back.
Adminium then takes the money (PayPal calls this a capture) and records it.
If the customer never comes back, the webhook or Adminium's own check takes
the money instead. A payment PayPal holds, for example while an eCheck
clears, shows as processing with the reason PayPal gives.

A checkout that Adminium ends, or that is more than six hours old, is never
taken, even if the customer approves it afterwards.

A dispute is matched to the payment it is about and followed until PayPal
resolves it: in your favour, in the customer's (the disputed money went back
to them), or closed with no decision. A payment PayPal reverses reads as a
dispute lost.

Every webhook's signature is checked on your server against the signing
certificate PayPal names. PayPal serves that certificate without the DigiCert
certificate it hangs from, so the add-on carries that one itself and checks it against the
roots Node trusts; it never fetches a certificate from anywhere but the PayPal
address a webhook names.

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
