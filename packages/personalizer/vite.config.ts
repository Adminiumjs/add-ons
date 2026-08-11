import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { build, defineConfig, type Plugin, type UserConfig } from "vite";

/**
 * THE PACKAGE ROOT, resolved from this file rather than from `process.cwd()`,
 * so the nested build below lands in the same place whether it was started by
 * `npm run build` at the monorepo root or by `built-output.test.ts`.
 *
 * The package directory is what a host installs, so it is also what every path
 * in `manifest.json` is resolved against — `dist/client.js`, `dist/server.js`,
 * the one convention every add-on in this repo writes.
 */
const ROOT = fileURLToPath(new URL(".", import.meta.url));

export const CLIENT_BUNDLE = "client.js";
export const SERVER_HALF = "server.js";

/**
 * Emits the server half after the client bundle is written.
 *
 * `configFile: false` is load-bearing — it stops the nested build from reading
 * this file and mounting this plugin again, which would recurse forever. It
 * also means the nested pass gets NO React plugin, which is exactly right: the
 * server half has no JSX in it, and if it ever grows some the build will fail
 * rather than quietly ship a renderer in the half that must not render.
 *
 * THIS ADD-ON'S SERVER HALF HOLDS NO SECRET, because it has nothing to keep one
 * for: `connect: { kind: "none" }`, no `network.allow`, no credential of any
 * kind. What it does hold is the ENGINE — the metric table, the cut alphabet
 * and `toProductionPaths` — so a host that wants a production file without
 * mounting a React tree can have one. The split is a packaging boundary here
 * rather than a leak boundary, and `built-output.test.ts` asserts that the
 * server half carries the geometry and none of the renderer.
 */
function serverHalf(): Plugin {
  return {
    name: "personalizer:server-half",
    apply: "build",
    async closeBundle() {
      await build({
        configFile: false,
        root: ROOT,
        logLevel: "warn",
        build: {
          // The client pass empties `dist/` before it writes; this one runs
          // afterwards, into the SAME directory, so it must not empty anything.
          outDir: "dist",
          emptyOutDir: false,
          lib: {
            entry: "src/server/personalizer.ts",
            formats: ["es"],
            fileName: () => SERVER_HALF,
          },
          minify: "esbuild",
          target: "es2022",
          sourcemap: false,
        },
      });
    },
  };
}

/*
 * TYPED AS VITE'S CONFIG PLUS ONE FIELD, and assigned to a variable before it
 * is handed to `defineConfig`, which is what lets the `test` block sit in this
 * file at all. Vite's `UserConfig` has no `test` key — vitest's types add one,
 * but importing them here drags in the SECOND copy of vite that vitest carries
 * in its own `node_modules`, and every plugin above then fails to typecheck
 * against the wrong vite's `Plugin`.
 */
const config: UserConfig & { test: { globalSetup: readonly string[] } } = {
  plugins: [react(), serverHalf()],
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: () => CLIENT_BUNDLE,
      cssFileName: "client",
    },
    cssCodeSplit: false,
    minify: "esbuild",
    /*
     * NO SOURCEMAP, stated rather than inherited. A `.map` is the one file that
     * would put every source module — comments, translator notes and all — into
     * `dist/` verbatim, and the release sweep greps built output.
     * `built-output.test.ts` asserts the emitted file list exactly, so turning
     * this on is a red test rather than a quiet leak.
     */
    sourcemap: false,
    rollupOptions: {
      /*
       * React, the JSX runtime and the icon set are external because the host
       * already has them: two copies of React in one page is two reconcilers
       * arguing over one DOM tree (24 D7). `react/jsx-dev-runtime` is on the
       * list even though a production build never reaches for it — it is what
       * `@vitejs/plugin-react` emits whenever `NODE_ENV` is not `production`,
       * and leaving it off means a non-production build silently INLINES
       * React's development runtime, source paths and all.
       */
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "lucide-react",
      ],
    },
  },
  test: {
    globalSetup: ["src/testing/dist.ts"],
  },
};

export default defineConfig(config);
