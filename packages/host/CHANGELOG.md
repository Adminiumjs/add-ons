# @adminium/add-on-host

## 1.0.19

### Patch Changes

- 7179ee8: DHL Shipping on a real shop: the demo carrier quotes in the shop's own currency (the order's value at dispatch, the basket's total at checkout) instead of US dollars. With the demo carrier switched off and no DHL account connected, the dispatch flow and the return label say "Your DHL account is not connected" and quote nothing, and the checkout draws no rates; before, the demo carrier answered anyway. While the demo is on, the dispatch flow says before quoting that nothing reaches DHL. A host that keeps its own packed weight passes it as `parcelWeightGrams` and the flow uses it as it is, so the two weights agree. The contents line names each line by its own quantity ("2 × Stoneware mug, 1 × Engraved walnut coasters") instead of "3 × Stoneware mug and 1 more".

## 1.0.18

## 1.0.17

## 1.0.16

### Patch Changes

- 67e1dc6: `DispatchPayload` gains an optional `chosen` (`{ addOn, code }`, or a whole delivery choice): the service the order stores, which a delivery add-on preselects at dispatch.

## 1.0.15

## 1.0.14

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
