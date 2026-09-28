/**
 * The pack-shape assertion for this package: the npm tarball holds exactly
 * the files it should, so it cannot silently grow or lose a half.
 *
 * The suite lives in `@adminium/add-on-host/testing` so the six add-ons share
 * one implementation. This package deliberately rebuilds per-suite rather than
 * in a `globalSetup` (see `src/testing/built.ts`), so the hook is its own
 * staleness-aware build.
 */

import { describePackShape } from "@adminium/add-on-host/testing";

import { ensureFreshBuild, PACKAGE_ROOT } from "./testing/built.ts";

describePackShape({ root: PACKAGE_ROOT, buildForReal: ensureFreshBuild });
