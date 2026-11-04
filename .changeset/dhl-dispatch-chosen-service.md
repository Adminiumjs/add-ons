---
"@adminium/add-on-shipping-dhl": patch
---

Dispatch opens with the delivery service the order stores: a host passes the shopper's checkout choice as `chosen` on `order.dispatch.actions`, and the booking flow picks that service instead of the first rate. A code another add-on made, or one no longer quoted, keeps the first rate.
