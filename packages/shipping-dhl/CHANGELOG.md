# @adminium/add-on-shipping-dhl

## 1.0.21

## 1.0.20

## 1.0.19

### Patch Changes

- 7179ee8: DHL Shipping on a real shop: the demo carrier quotes in the shop's own currency (the order's value at dispatch, the basket's total at checkout) instead of US dollars. With the demo carrier switched off and no DHL account connected, the dispatch flow and the return label say "Your DHL account is not connected" and quote nothing, and the checkout draws no rates; before, the demo carrier answered anyway. While the demo is on, the dispatch flow says before quoting that nothing reaches DHL. A host that keeps its own packed weight passes it as `parcelWeightGrams` and the flow uses it as it is, so the two weights agree. The contents line names each line by its own quantity ("2 × Stoneware mug, 1 × Engraved walnut coasters") instead of "3 × Stoneware mug and 1 more".

## 1.0.18

## 1.0.17

## 1.0.16

### Patch Changes

- 67e1dc6: Dispatch opens with the delivery service the order stores: a host passes the shopper's checkout choice as `chosen` on `order.dispatch.actions`, and the booking flow picks that service instead of the first rate. A code another add-on made, or one no longer quoted, keeps the first rate.
- 67e1dc6: Attach to Maker Shop and Print Shop at `^0.1.0 || ^0.2.0`, so a shop with the add-on attached can update to the apps' 0.2 line.

## 1.0.15

## 1.0.14

## 1.0.13

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

### Patch Changes

- 775c6a7: Every add-on now needs Adminium 0.3.1 or later. That release checks the app versions an add-on attaches to, reads the invoice and quote shapes, and draws the letterhead's tax number, payment instructions and footer.
- 775c6a7: `addOn.attaches` now names the app versions that ship. Every range said `^1.0.0`, a major no app has reached: apps are 0.x and patch-only, so each range is now the minor line its app ships on — `^0.2.0` for Clinic Desk, `^0.1.0` for every other app.

## 1.0.2

## 1.0.1

### Patch Changes

- `compatibility.minAdminiumVersion` now names the first Adminium release that can install this add-on. Every 1.0.0 file claimed 1.0.0, a version no Adminium release has reached.
- A prepaid return label from a record's actions, with the returns address kept in the add-on's settings, and Support Desk as a host app. Needs Adminium 0.2.6 or later, where those settings can be entered.
