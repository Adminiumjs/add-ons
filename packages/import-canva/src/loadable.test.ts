/**
 * Can a browser import this add-on's built bundle? (26-T13)
 *
 * The suite lives in `@adminium/add-on-host/testing` so all six share one
 * implementation. This package rebuilds per-suite rather than in a
 * `globalSetup` (see `src/testing/built.ts`), so the hook is its own
 * staleness-aware build.
 */

import { describeLoadable } from "@adminium/add-on-host/testing";

import manifest from "../manifest.json" with { type: "json" };
import { DIST, ensureFreshBuild } from "./testing/built.ts";

describeLoadable({
  clientBundle: `${DIST}/client.js`,
  buildForReal: ensureFreshBuild,
  key: manifest.key,
});
