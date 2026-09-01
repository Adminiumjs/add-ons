---
'@adminium/add-on-import-canva': patch
---

Fix: this add-on's OAuth flow could never have started.

The manifest allow-listed one hostname, `api.canva.com`, while the authorize URL
points at `www.canva.com`. A host refuses to send a client secret to a hostname
an add-on never declared, so `POST /add-ons/import-canva/connect/oauth/start`
answered a refusal on the first real Adminium this package met. The guard was
right; the manifest was wrong. `network.allow` now carries both hostnames, which
is not a widening — it is the allow-list finally describing the flow this
package already declared.

**What let it through is worth more than the fix.** `manifest.test.ts` had a test
whose comment stated the rule exactly — "an authorize URL on a host the
allow-list does not carry is a call the runtime would refuse, better to fail here
than in an audit row" — and then asserted that both URLs `endsWith("canva.com")`.
A suffix test where the runtime does an exact one. It was also weaker than it
looks in a second way: `evilcanva.com` ends with `canva.com` too.

The check now asserts what the comment says: every declared URL's hostname is IN
`network.allow`. The authorize host gets a named constant beside the API one, and
its own assertion — it previously had none at all, which is why only one of the
two was ever wrong.

Found by the add-on runtime wave's acceptance round trip, against a real server,
which is the only place a manifest and a running host are in the same room.
