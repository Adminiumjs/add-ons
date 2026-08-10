/**
 * There is no build here — this package ships TypeScript sources and the
 * add-ons that import it bundle what they use. The config exists for `vitest`
 * alone.
 *
 * `environment: node`: every suite in this package reads files off disk and
 * asserts over text. Nothing renders.
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
