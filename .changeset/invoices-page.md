---
'@adminium/add-on-invoices': patch
---

The invoice manager and editor are the add-on's own page

The surface moved out of Adminium itself: the add-on declares a page, and the
host mounts it and gives it a navigation row. The floor rises to 0.2.12 — the
first release whose host publishes the runtime this page calls — and the
release tool will refuse to ship this until that version exists.
