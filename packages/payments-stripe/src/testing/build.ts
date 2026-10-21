/**
 * Builds `dist/` for real, with the package's own Vite, the way a release does.
 * Test only.
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

export const ROOT = join(new URL('../..', import.meta.url).pathname);
export const DIST = join(ROOT, 'dist');

const VITE_CLI = join(dirname(createRequire(import.meta.url).resolve('vite/package.json')), 'bin', 'vite.js');

export function buildForReal(): void {
  execFileSync(process.execPath, [VITE_CLI, 'build'], { cwd: ROOT, env: { ...process.env, NODE_ENV: 'production' }, stdio: 'pipe' });
}
