import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * The harness server only — `npm run dev`.
 *
 * Kept out of `vite.config.ts` on purpose: that file describes the SHIPPED
 * bundle, whose entry is `src/index.ts` and whose externals are the host's.
 * Mixing a dev root into it is how a harness ends up in a release.
 */
export default defineConfig({
  root: "dev",
  plugins: [react()],
  server: { port: 5199, strictPort: true },
});
