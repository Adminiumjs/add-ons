---
"@adminium/add-on-shipping-dhl": patch
"@adminium/add-on-host": patch
---

The dispatch flow hands a booking back to its host: `onBooked` on `order.dispatch.actions` is told the tracking number, the service and whether the demo carrier made it, when a collection is booked and again when the panel opens on an order already booked. A host keeps a real number with the order's shipped move and never stores or mails a demo one. An address may carry a `region`, printed after the city on the label.
