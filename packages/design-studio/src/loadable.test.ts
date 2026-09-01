/**
 * Can a browser import this add-on's built bundle? (26-T13)
 *
 * The suite lives in `@adminium/add-on-host/testing` so all six share one
 * implementation. This package builds `dist/` in vitest's `globalSetup`
 * (`src/testing/dist.ts`), so the hook here is a no-op.
 */

import { describeLoadable } from "@adminium/add-on-host/testing";

import manifest from "../manifest.json" with { type: "json" };
import { ROOT } from "./testing/dist.ts";

describeLoadable({
  clientBundle: `${ROOT}/dist/client.js`,
  buildForReal: () => {},
  key: manifest.key,
});
