/**
 * Builds `dist/` for real, with the package's own Vite, the way a release
 * does: the server half, then the screens, then the record action. Test only.
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

export const ROOT = join(new URL('../..', import.meta.url).pathname);
export const DIST = join(ROOT, 'dist');

const VITE_CLI = join(dirname(createRequire(import.meta.url).resolve('vite/package.json')), 'bin', 'vite.js');

export function buildForReal(): void {
  for (const mode of [[], ['--mode', 'pages'], ['--mode', 'client']]) {
    execFileSync(process.execPath, [VITE_CLI, 'build', ...mode], { cwd: ROOT, env: { ...process.env, NODE_ENV: 'production' }, stdio: 'pipe' });
  }
}
