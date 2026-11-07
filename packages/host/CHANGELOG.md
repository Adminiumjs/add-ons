# @adminium/add-on-host

## 1.0.22

## 1.0.21

### Patch Changes

- 0ad200b: Customiser: an app's role may now be given everything the set-up page reads and writes (the settings to read; the shop's bases, pieces, areas, ready-made designs and their parts, fonts, palettes, colours and features to add, change and remove, a base never removed), so a shop's owner opens the set-up without the Customiser designer role. The set-up adds the starter fonts' files into their rows the first time somebody who may change the fonts opens it. The order-line panel names each part of the design's own layout once, and a piece's proof shows a logo set to "Make it one colour" as the laser cuts it. A link to a design version is named by its number. Holiday Calendars' picker starts on the shop's own country: the set it already took, else its browser's time zone or language. `@adminium/add-on-host/testing` no longer exports `HOST_BEHAVIOURS`, which no host reads.

## 1.0.20

### Patch Changes

- de98c9a: Stripe Payments and PayPal Payments are installed once for the whole server (`addOn.scope: "server"`): every database on it takes payments into the same provider account. Invoices & Receipts says where each template and invoice is listed ("Shown in"): chips on each card and row, a Workspace filter in All in one menu, the list cut to the tab's workspace in One at a time, the New modal offering only the templates listed there, a control in the editor that saves each change at once, and a note when the open document is not listed here. The payment providers need Adminium 0.3.49 or newer; Invoices draws "Shown in" on 0.3.49 and newer and installs on every release it did before.

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
