/**
 * Can a browser import this add-on's built bundle? (26-T13)
 *
 * The suite lives in `@adminium/add-on-host/testing` so all six share one
 * implementation; this file exists because only the owning package's suite can
 * build its own `dist/`.
 */

import { describeLoadable } from "@adminium/add-on-host/testing";

import manifest from "../manifest.json" with { type: "json" };
import { buildForReal, DIST } from "./testing/build.ts";

describeLoadable({
  clientBundle: `${DIST}/client.js`,
  buildForReal,
  key: manifest.key,
});
