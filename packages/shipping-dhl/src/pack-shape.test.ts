/**
 * The pack-shape assertion for this package: the npm tarball is the unit an
 * add-on ships as, and it must not silently grow or lose a half.
 *
 * The suite lives in `@adminium/add-on-host/testing` so the six add-ons share
 * one implementation; this file exists because only the owning package's suite
 * can build its own `dist/` (verification order is typecheck -> test -> build,
 * so nothing is built when tests start).
 */

import { describePackShape } from "@adminium/add-on-host/testing";

import { buildForReal, ROOT } from "./testing/build.ts";

describePackShape({ root: ROOT, buildForReal });
