/**
 * Reading `dist/` from a test, and making sure `dist/` is the CURRENT build.
 *
 * Two of this repo's rules are about the shipped artefact rather than the
 * sources, and neither can be checked by reading a diff:
 *
 *   · the release sweep greps BUILT output for a set of banned runs, and Vite's
 *     library build keeps comments — so a source comment that spells a banned
 *     run out is a release failure even though no user-visible string contains
 *     it (`built-output.test.ts`);
 *   · the manifest names one file per slot fill and per `provides[]`, and the
 *     installer loads exactly those paths — so a build that stops emitting one
 *     of them breaks an install nobody can reproduce from the sources
 *     (`manifest.test.ts`).
 *
 * A test that greps a STALE `dist/` is worse than no test: it passes on the
 * previous build while the current one is broken. So `ensureFreshBuild()`
 * compares the newest shipped source against the oldest build output and
 * rebuilds when the build is missing or behind. It is deliberately not a
 * `globalSetup`: a suite that fails should say which file it read, and the
 * build that produced it should have happened in the same run.
 *
 * Test-only. `add-ons.sh` never vendors `src/testing/`, so nothing here reaches
 * the host bundle.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/**
 * THE PACKAGE ROOT — this file is `src/testing/built.ts`, so two levels up.
 *
 * It used to be called the REPO root, and while this add-on was its own repo
 * the two were the same directory. They are not any more: the repo is the
 * monorepo above `packages/`, and what a host installs — and what every path in
 * `manifest.json` is resolved against — is this package's own directory. The
 * strings did not change (`dist/client.js` is still `dist/client.js`); what
 * changed is what they are relative TO, and the name now says so.
 */
export const PACKAGE_ROOT = new URL("../../", import.meta.url).pathname;
export const DIST = join(PACKAGE_ROOT, "dist");
const SRC = join(PACKAGE_ROOT, "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** Every file under `dist/`, absolute. */
export function distFiles(): string[] {
  return existsSync(DIST) ? walk(DIST) : [];
}

/** `client.js` — a path relative to `dist/`, for readable failure messages. */
export const distRelative = (file: string): string =>
  file.slice(DIST.length).replace(/^\//, "");

/**
 * `dist/client.js` — the shape the manifest and `vite.config.ts`'s `OUTPUT`
 * write their paths in, relative to the REPO ROOT. The manifest's entry points
 * are compared in this form, so the comparison is against the exact strings an
 * installer would resolve rather than a rewritten version of them.
 */
export const packageRelative = (file: string): string =>
  file.slice(PACKAGE_ROOT.length).replace(/^\//, "");

export const readDist = (file: string): string => readFileSync(file, "utf8");

/**
 * The inputs a build depends on. Test files are excluded on purpose: editing an
 * assertion is not a reason to rebuild, and including them would make every run
 * of this suite rebuild itself.
 */
function buildInputs(): string[] {
  return [
    ...walk(SRC).filter((f) => !f.includes(".test.") && !f.includes("/testing/")),
    join(PACKAGE_ROOT, "vite.config.ts"),
    join(PACKAGE_ROOT, "package.json"),
  ].filter((f) => existsSync(f));
}

const newest = (files: readonly string[]): number =>
  files.reduce((max, f) => Math.max(max, statSync(f).mtimeMs), 0);
const oldest = (files: readonly string[]): number =>
  files.reduce((min, f) => Math.min(min, statSync(f).mtimeMs), Number.POSITIVE_INFINITY);

let built = false;

/** Fresh means: every emitted file is at least as new as every input. */
const isFresh = (): boolean => {
  const out = distFiles();
  return out.length > 0 && oldest(out) >= newest(buildInputs());
};

const LOCK = join(PACKAGE_ROOT, "node_modules/.add-on-build.lock");
/** A build takes a couple of seconds; anything past this is a crashed holder. */
const LOCK_STALE_MS = 120_000;

/** Block the thread without a timer — this module runs before any test does. */
function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Build if `dist/` is missing or older than any shipped source. Idempotent.
 *
 * ACROSS PROCESSES, not only within one. Vitest runs test files in parallel
 * workers, `manifest.test.ts` and `built-output.test.ts` both need the build,
 * and a Vite build EMPTIES `dist/` before it writes. Two workers rebuilding at
 * once therefore produced a listing with the client bundle missing and only the
 * server half present — a failure that looked like a broken build config and
 * was a race, and one the two-bundle layout widened because there are now two
 * write phases to be caught between.
 *
 * So: one lock directory, `mkdir` as the atomic test-and-set, and a re-check of
 * freshness after acquiring it — the process that waited usually finds the
 * build already done and does nothing.
 */
export function ensureFreshBuild(): void {
  if (built) return;
  built = true;

  if (isFresh()) return;

  // The lock lives under this package's own `node_modules/`, which in a
  // workspace does not necessarily exist: npm hoists every shared dependency to
  // the monorepo root and writes no per-package directory at all. `mkdir` of
  // the lock then failed with ENOENT, the catch below read that as "someone
  // else is building", and the suite waited out the full stale timeout before
  // dying with a message about a lock nobody held.
  mkdirSync(dirname(LOCK), { recursive: true });

  for (let waited = 0; ; waited += 50) {
    try {
      mkdirSync(LOCK);
      break;
    } catch {
      // Someone else is building. If they have been at it for longer than any
      // build takes, they died holding the lock — take it rather than hang.
      try {
        if (Date.now() - statSync(LOCK).mtimeMs > LOCK_STALE_MS) rmSync(LOCK, { recursive: true });
      } catch {
        /* the holder finished and removed it between the two calls */
      }
      if (waited > LOCK_STALE_MS) throw new Error(`stuck waiting for ${LOCK}`);
      sleep(50);
    }
  }

  try {
    // The waiter's payoff: the holder built while we blocked, so there is
    // nothing left to do.
    if (isFresh()) return;
    runBuild();
  } finally {
    rmSync(LOCK, { recursive: true, force: true });
  }
}

/**
 * Vite's CLI entry, RESOLVED rather than assembled from a path — the same
 * change `packages/shipping-dhl`'s `build.ts` needed and for the same reason. A
 * hoisted workspace has no `<package>/node_modules/vite`, and Vite 7's
 * `exports` map does not publish `./bin/vite.js`, so the manifest is the one
 * subpath that can be resolved and walked from.
 */
const VITE_CLI = join(
  dirname(createRequire(import.meta.url).resolve("vite/package.json")),
  "bin",
  "vite.js",
);

function runBuild(): void {
  // `node node_modules/vite/bin/vite.js build` rather than `npm run build`:
  // one process, no shell, and no dependence on which package manager ran the
  // suite. `tsc -b` is the `build` script's other half and is not needed here —
  // this is about the emitted bundles, and typechecking has its own gate.
  //
  // NODE_ENV IS FORCED, and it is not a detail. Vitest sets `NODE_ENV=test`,
  // Vite honours an NODE_ENV it is given rather than assuming production, and
  // `@vitejs/plugin-react` then compiles to the DEV jsx runtime — which is not
  // in the external list, so React's development build gets inlined into the
  // bundle. The result greps very differently from what actually ships (it
  // carries React's own `…CANNOT_UPGRADE` internal and a pile of
  // `process.env.NODE_ENV` branches), and a lexicon test reading it would be
  // reporting on a bundle no user will ever load.
  execFileSync(process.execPath, [VITE_CLI, "build"], {
    cwd: PACKAGE_ROOT,
    stdio: "pipe",
    env: { ...process.env, NODE_ENV: "production" },
  });
}
