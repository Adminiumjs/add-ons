import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * The editor's dev page only (`npm run dev`): the customer's editor mounted
 * against the sample rows, in both shops' looks. Kept out of `vite.config.ts`,
 * which describes what ships, so a dev root can never reach a release.
 */
export default defineConfig({
  root: 'dev',
  plugins: [react()],
  server: { port: 4910, strictPort: true, host: '127.0.0.1' },
});
