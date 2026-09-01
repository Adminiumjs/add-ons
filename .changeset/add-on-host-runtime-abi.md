---
'@adminium/add-on-host': patch
'@adminium/add-on-barcode-labels': patch
'@adminium/add-on-design-studio': patch
'@adminium/add-on-holiday-calendars': patch
'@adminium/add-on-import-canva': patch
'@adminium/add-on-personalizer': patch
'@adminium/add-on-shipping-dhl': patch
---

A built add-on bundle can now be imported by a browser.

It could not be. Every client bundle opened with `import { useMemo } from
"react"`, because React and the icon set were Rollup externals — the right
answer while a BUNDLER resolves the import, which is what demo mode does, and
the wrong one the moment a browser does: a bare specifier cannot be resolved by
`import()` without an import map. So the artefact 26 §6 describes the host
"`import()`ing from the server with its SRI hash" was not importable at all, and
the demo build worked only because Vite resolved those imports before one ever
saw them.

Nothing caught it, and the reason is worth keeping: every suite that read
`dist/` either read it as text or imported it through a bundler that resolved
the externals exactly as the demo build does. The gap was invisible precisely to
the tests that looked hardest at the built output.

**React now arrives through the host, not through the module graph.** A host
installs its React on a well-known global before importing any add-on; each
add-on aliases `react` and `react/jsx-runtime` to shims that read it. A built
bundle therefore contains no bare specifier at all, loads from any URL, and
still uses exactly one React — which is the identity rule D7 always stated. Only
its delivery changed.

**`lucide-react` is bundled instead**, and that asymmetry is the point: two
Reacts break hooks and context, whereas two copies of some SVG components are
just two copies of some SVG. Tree-shaking keeps only the icons an add-on
actually draws — six bundles grew by 5–10 KB.

Three things this cost, each a guard that was right and a proxy that was not:

- **A build-only alias.** A top-level `resolve.alias` applies to vitest too,
  and then an add-on's own source resolves `react` to the shim during tests and
  throws at module init because no host provided one. It lives in a plugin with
  `apply: "build"` — tests render against the real React, only the artefact a
  browser loads uses the shim.
- **The vocabulary ban caught the new error message.** `provideAddOnRuntime`
  and "provided" both carry the banned `pro` substring, and the name reaches the
  shipped bytes inside the message. Renamed to `installAddOnRuntime` rather than
  worded around, because the message's whole value is that it names the call to
  make.
- **Two nets disagreed about XML namespaces.** `scanMarkup` already treated
  `http://www.w3.org/2000/svg` as an identifier rather than an address, with a
  note that the exemption "has to be made in both or markup and the page
  disagree" — and it had been made in one. Bundling lucide put an `xmlns` in
  every add-on's dist and the stricter net fired. Now shared, scoped to the
  namespace origins rather than to `w3.org`.

Three assertions changed with the ABI. `release-shape` no longer equates "peer"
with "import": React is a peer that is deliberately not imported, and everything
else is bundled, so `lucide-react` moved to `devDependencies`. Two `dist` suites
asserted the bundle imports *something* as an anti-empty-read floor — now
literally false — so the floor moved to a proxy that is still true. And a new
suite, shared by all six, both refuses a bare specifier over the bytes AND
loads the built bundle against a real React to prove `register()` works, because
a bundle can have no bare imports and still be broken.
