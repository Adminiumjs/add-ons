/**
 * ONE production build, shared by every suite that asserts over `dist/`.
 *
 * Two suites need the artefact: `manifest.test.ts` checks that the entry points
 * the manifest names are files that exist, and `built-output.test.ts` greps the
 * built bytes. Neither may assume `dist/` is fresh — a suite that asserts over
 * whatever a previous command happened to leave behind passes on a stale
 * directory, and `npm test` runs before `npm run build` in every script that
 * matters.
 *
 * SO THE BUILD IS A VITEST `globalSetup` (wired in `vite.config.ts`) rather
 * than a `beforeAll` in one of them. Vitest runs test FILES in parallel
 * workers; two `beforeAll`s racing to empty and rewrite the same `dist/` is a
 * suite that fails one run in ten for a reason nobody can reproduce. Global
 * setup runs once, before any worker starts, and both suites then only read.
 *
 * The paths in this module are resolved against the PACKAGE ROOT, not against
 * `dist/`, because that is what the manifest's entry points are relative to:
 * `dist/client.js`, `dist/server.js` — the same convention every add-on in this
 * repo uses, so a host resolving a path does not have to know which package
 * wrote it. The package directory is what a host installs.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** The package root, resolved from this file rather than from `process.cwd()`. */
export const ROOT = fileURLToPath(new URL("../..", import.meta.url));

/** Where the build writes. Only `dist.ts` and `vite.config.ts` know this. */
const DIST = join(ROOT, "dist");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/**
 * Every emitted file, as a package-root-relative POSIX path — `dist/client.js`,
 * `dist/server.js` — so the list can be compared against manifest fields
 * directly rather than after a prefix has been stripped off one side.
 */
export function emittedFiles(): string[] {
  return walk(DIST)
    .map((file) => relative(ROOT, file).split(sep).join("/"))
    .sort();
}

/** One emitted file's bytes, named the way the manifest names it. */
export function readEmitted(file: string): string {
  return readFileSync(join(ROOT, file), "utf8");
}

/**
 * The global setup itself.
 *
 * PRODUCTION, EXPLICITLY. Vitest sets `NODE_ENV=test`, and Vite derives
 * `isProduction` from it — so a build started from inside a test run is a
 * DEVELOPMENT build unless it is told otherwise. That is not cosmetic: the
 * React plugin emits `jsxDEV` in development, which drags React's development
 * runtime and the absolute path of every `.tsx` file into the bundle, and the
 * suites would then be greping an artefact nobody ships.
 */
export default async function setup(): Promise<void> {
  const { build } = await import("vite");
  const wasNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    await build({
      configFile: join(ROOT, "vite.config.ts"),
      root: ROOT,
      mode: "production",
      logLevel: "error",
    });
  } finally {
    process.env.NODE_ENV = wasNodeEnv;
  }
}
