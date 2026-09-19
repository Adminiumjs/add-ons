# @adminium/add-on-invoices

## 1.0.2

### Patch Changes

- 1f493a1: The invoice manager and editor are the add-on's own page

  The surface moved out of Adminium itself: the add-on declares a page, and the
  host mounts it and gives it a navigation row. The floor rises to 0.2.12 — the
  first release whose host publishes the runtime this page calls — and the
  release tool will refuse to ship this until that version exists.

## 1.0.1

### Patch Changes

- First release. Invoices, receipts and credit notes drawn from your own records through the `document-render` contract. Needs Adminium 0.2.6 or later.
- `compatibility.minAdminiumVersion` now names the first Adminium release that can install this add-on. Every 1.0.0 file claimed 1.0.0, a version no Adminium release has reached.
