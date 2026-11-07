---
"@adminium/add-on-invoices": patch
"@adminium/add-on-payments-stripe": patch
"@adminium/add-on-payments-paypal": patch
"@adminium/add-on-host": patch
---

Stripe Payments and PayPal Payments are installed once for the whole server (`addOn.scope: "server"`): every database on it takes payments into the same provider account. Invoices & Receipts says where each template and invoice is listed ("Shown in"): chips on each card and row, a Workspace filter in All in one menu, the list cut to the tab's workspace in One at a time, the New modal offering only the templates listed there, a control in the editor that saves each change at once, and a note when the open document is not listed here. The payment providers need Adminium 0.3.49 or newer; Invoices draws "Shown in" on 0.3.49 and newer and installs on every release it did before.
