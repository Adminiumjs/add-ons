# @adminium/add-on-host

## 1.0.13

### Patch Changes

- 22b3e47: Invoices & Receipts adds the shape `invoices/invoice@2` beside `@1`, for invoices paid online: its payments carry a unique payment reference, the service the payment came through, what was refunded of it (paid counts each payment less its refunds, so a refund reopens the balance), and a card's approval code and last four digits; `online` is a way to pay. The invoice email and its reminders carry a pay button, and a printed invoice its pay link and a code to scan while something is owed. `@1` is unchanged, so no app moves until its own update. The host's document contract learns the `qr` slot type Adminium already sends.

## 1.0.12

## 1.0.11

## 1.0.10

## 1.0.9

## 1.0.8

## 1.0.7

## 1.0.6

## 1.0.5

## 1.0.4

## 1.0.3

## 1.0.2

## 1.0.1
