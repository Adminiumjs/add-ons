# @adminium/add-on-design-studio

## 1.0.3

### Patch Changes

- 775c6a7: Every add-on now needs Adminium 0.3.1 or later. That release checks the app versions an add-on attaches to, reads the invoice and quote shapes, and draws the letterhead's tax number, payment instructions and footer.
- 775c6a7: `addOn.attaches` now names the app versions that ship. Every range said `^1.0.0`, a major no app has reached: apps are 0.x and patch-only, so each range is now the minor line its app ships on — `^0.2.0` for Clinic Desk, `^0.1.0` for every other app.

## 1.0.2

## 1.0.1

### Patch Changes

- `compatibility.minAdminiumVersion` now names the first Adminium release that can install this add-on. Every 1.0.0 file claimed 1.0.0, a version no Adminium release has reached.
