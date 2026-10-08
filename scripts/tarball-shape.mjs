/**
 * What an add-on's tarball must and must not hold: the rules the publish
 * script applies to every pack, in a module of their own so a test can hand
 * them a list of paths (`packages/host/src/publish-entry-points.test.ts`).
 */

/** The `files[]` allow-list every add-on declares, so nothing else ships. */
export const FILES_FIELD = ['dist', 'manifest.json', 'TRADEMARKS.md', 'README.md', 'LICENSE'];

/**
 * An add-on whose manifest names sample data ships its `seeds/` folder too,
 * and only such an add-on: the file is read from the installed package when
 * somebody asks for the sample.
 */
export const filesFor = (manifest) => (typeof manifest.sampleData?.file === 'string' ? ['dist', 'seeds', ...FILES_FIELD.slice(1)] : [...FILES_FIELD]);

/** Files every tarball must carry besides its own `dist/`. */
export const REQUIRED = ['LICENSE', 'README.md', 'TRADEMARKS.md', 'manifest.json', 'package.json'];

/** Every path the manifest declares, relative to the package root. */
export function declaredEntryPoints(manifest) {
  const addOn = manifest.addOn ?? {};
  const paths = [
    ...(addOn.slots ?? []).map((slot) => slot.client),
    ...(addOn.provides ?? []).map((provide) => provide.server),
    ...(addOn.pages ?? []).map((page) => page.client),
    addOn.demoTransport,
    manifest.sampleData?.file,
  ].filter((path) => typeof path === 'string');
  return [...new Set(paths)];
}

/**
 * The X-ray. Refuses a tarball that grew, shrank, or lost a declared half.
 *
 * The rule is that "the tarball cannot silently grow or lose a half"; both
 * directions are checked here because both have already happened once in this
 * repo's history in the abstract: WITHOUT `files[]`, `npm pack` ships all of
 * `src/` — every `.test.ts` included — and NO `dist/` at all, because the root
 * `.gitignore`'s `dist` entry applies to packing. The tarball was exactly
 * inverted, and nothing would have said so.
 */
export function xray(label, entries, { manifest }) {
  const problems = [];
  const paths = entries.map((path) => path.replace(/^package\//, ''));

  for (const required of REQUIRED) {
    if (!paths.includes(required)) {
      problems.push(
        required === 'LICENSE'
          ? `no LICENSE — the manifest declares "${manifest.license}" and AGPL §4 wants the text in every copy`
          : `no ${required}`,
      );
    }
  }

  // npm SILENTLY DROPS a `files[]` entry that does not exist, so a missing
  // declared entry point is invisible without this check.
  for (const entry of declaredEntryPoints(manifest)) {
    if (!paths.includes(entry)) {
      problems.push(`manifest declares "${entry}" but the tarball has no such file`);
    }
  }

  if (!paths.some((path) => path.startsWith('dist/'))) {
    problems.push('no dist/ at all — the built product is missing (see this function\'s note)');
  }
  for (const path of paths) {
    if (path.startsWith('src/')) problems.push(`ships source: ${path}`);
    if (/\.tests?\./.test(path)) problems.push(`ships a test: ${path}`);
    if (path.endsWith('.map')) problems.push(`ships a sourcemap: ${path}`);
    if (/^tsconfig|^vite\.config/.test(path)) problems.push(`ships build config: ${path}`);
    // `seeds/` holds the one file the manifest names, and nothing that rode along beside it.
    if (path.startsWith('seeds/') && path !== manifest.sampleData?.file) problems.push(`ships a seeds file the manifest does not name: ${path}`);
  }

  if (problems.length > 0) {
    throw new Error(`${label}:\n  - ${problems.join('\n  - ')}`);
  }
}
