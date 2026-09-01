/**
 * D1's pack-shape assertion for this package.
 *
 * The suite lives in `@adminium/add-on-host/testing` so the six add-ons share
 * one implementation. This package builds `dist/` in vitest's `globalSetup`
 * (`src/testing/dist.ts`), so by the time any suite runs the build has already
 * happened and the hook here is a no-op.
 */

import { describePackShape } from "@adminium/add-on-host/testing";

import { ROOT } from "./testing/dist.ts";

describePackShape({ root: ROOT, buildForReal: () => {} });
