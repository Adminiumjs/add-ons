# Changesets

Version bumps for the add-on packages, mirroring the main Adminium monorepo's
setup so the two repos release the same way.

**Always `patch`.** The standing policy in the main repo applies here for the
same reason: the `fixed` group below forces the HIGHEST bump among all pending
changesets onto every package in the group, so one stray `minor` promotes the
whole fleet. Grep `.changeset/*.md` before releasing.

**The `fixed` group is `@adminium/add-on-*`, not `@adminium/*`.** `host` and
`host-kit` match the wider glob but are never published (24 D7) and have no
`manifest.json`, so keeping them out of the group is what stops a version bump
from claiming to release two packages that no registry will ever see.

**A bump touches TWO files per package.** `changeset version` knows only about
`package.json`; `manifest.json` carries the same version and is what a
deployment actually installs by. `npm run version` runs
`scripts/sync-manifest-versions.mjs` straight after the bump for exactly that
reason, and the release workflow asserts parity again before packing.
