/**
 * One way to get `dist/` on disk, shared by the two suites that need it.
 *
 * A CHILD PROCESS, AND `NODE_ENV=production`, both on purpose. Vite decides
 * whether a build is a production one from `NODE_ENV` before it looks at the
 * mode, and under Vitest that variable is `test` — an in-process `build()` call
 * therefore produced a DIFFERENT bundle from the one that ships, complete with
 * React's development element factory inlined into it. A suite that greps a
 * bundle nobody deploys is worth nothing, so this shells out exactly as the
 * release does.
 *
 * `dist/` is gitignored and the verification order is typecheck → test → build,
 * so a suite that only read an existing `dist/` would silently pass on a clean
 * clone by grepping nothing, and would read STALE bytes everywhere else.
 */

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/** This PACKAGE's root — `src/testing/build.ts`, so two levels up. */
export const ROOT = join(new URL("../..", import.meta.url).pathname);
export const DIST = join(ROOT, "dist");

/**
 * Vite's CLI entry, RESOLVED rather than assembled from a path.
 *
 * It used to be `<root>/node_modules/.bin/vite`, which was true while this was
 * a standalone repo and stopped being true the day it became a workspace: npm
 * hoists a shared dependency to the monorepo root, the per-package `.bin` link
 * is not written, and the suite died with a bare ENOENT that read like a broken
 * install. `require.resolve` asks Node where the module actually is, which is
 * the same answer in a hoisted tree, a nested one, and a standalone clone.
 *
 * It resolves `vite/package.json` and walks to the CLI beside it rather than
 * resolving `vite/bin/vite.js` directly: Vite 7's `exports` map does not
 * publish the bin path, so asking for it is a hard resolution error. The
 * manifest is the one subpath every package exports.
 */
const VITE_CLI = join(
  dirname(createRequire(import.meta.url).resolve("vite/package.json")),
  "bin",
  "vite.js",
);

/** Run the real build, from the package root, the way the release runs it. */
export function buildForReal(): void {
  execFileSync(process.execPath, [VITE_CLI, "build"], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: "production" },
    stdio: "pipe",
  });
}
