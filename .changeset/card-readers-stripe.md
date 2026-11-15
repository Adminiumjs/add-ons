---
'@adminium/add-on-payments-stripe': patch
---

Card payments runs Stripe smart readers at the counter with the same key (`card-terminal@1`): a reader is paired with the code it shows, at one of the account's Terminal locations, the till's amount is sent to it as a card-present payment, a tip may be asked on the reader, and a cancel takes it off unless the card was tapped first. Test mode pairs a simulated reader (`simulated-wpe`). The key template and the README list three permissions for readers alone (Payment Intents: write, Terminal Readers: write, Terminal Locations: read). An Interac payment is refunded on the reader only. Needs Adminium 0.3.60.
