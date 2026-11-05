/**
 * What an add-on's tarball must and must not hold: the rules the publish
 * script applies to every pack, in a module of their own so a test can hand
 * them a list of paths (`packages/host/src/publish-entry-points.test.ts`) and
 * pack every add-on the way the release does
 * (`packages/host/src/release-tarballs.test.ts`).
 */

/** The papers and the build every add-on ships, whatever its manifest names. */
export const FILES_FIELD = ['dist', 'manifest.json', 'TRADEMARKS.md', 'README.md', 'LICENSE'];

/** Files every tarball must carry besides its own `dist/`. */
export const REQUIRED = ['LICENSE', 'README.md', 'TRADEMARKS.md', 'manifest.json', 'package.json'];

const strings = (values) => values.filter((value) => typeof value === 'string');
const listOf = (value) => (Array.isArray(value) ? value : []);

/**
 * Every file a sample bundle names: the pictures and other files its rows use
 * (`assets`, each one a file under `seeds/`). `read` hands back the bundle's
 * parsed JSON, or undefined where it cannot be read.
 */
function sampleAssets(file, read) {
  const bundle = read?.(file);
  const assets = bundle && typeof bundle === 'object' ? bundle.assets : undefined;
  return assets && typeof assets === 'object' ? strings(Object.values(assets).map((asset) => asset?.file)) : [];
}

/**
 * Every path the manifest names, relative to the package root: the code the
 * engine loads (slots, pages, panels, server halves, events, the demo
 * transport, widgets), the starting rows of its tables (`seeds[].file`), its
 * sample data (`sampleData.file`, and the rows it names for other add-ons),
 * and the files those sample bundles name in turn. Given `read`, the sample
 * bundles are opened to find those last ones.
 */
export function declaredEntryPoints(manifest, { read } = {}) {
  const addOn = manifest.addOn ?? {};
  const samples = strings([
    manifest.sampleData?.file,
    ...Object.values(manifest.sampleData?.addOns ?? {}).map((entry) => entry?.file),
  ]);
  const paths = strings([
    ...listOf(addOn.slots).map((slot) => slot?.client),
    ...listOf(addOn.provides).map((provide) => provide?.server),
    ...listOf(addOn.events).map((event) => event?.server),
    ...listOf(addOn.pages).map((page) => page?.client),
    ...listOf(addOn.panels).map((panel) => panel?.client),
    addOn.demoTransport,
    ...listOf(manifest.widgets).map((widget) => widget?.entry),
    ...listOf(manifest.seeds).map((seed) => seed?.file),
    ...samples,
    ...samples.flatMap((file) => sampleAssets(file, read)),
  ]);
  return [...new Set(paths)];
}

/** A path inside the package: relative, forward slashes, never climbing out. */
const insidePackage = (path) => !path.startsWith('/') && !path.includes('\\') && !path.split('/').some((part) => part === '..' || part === '.' || part === '');

/**
 * The `files[]` allow-list a package is packed with, read from its manifest:
 * the whole `dist/` (the build splits shared code into chunks no manifest
 * names), then each file the manifest names outside `dist/`, by its own path,
 * so a folder never carries a file nobody named, then the papers.
 */
export function filesFor(manifest, options = {}) {
  const named = declaredEntryPoints(manifest, options);
  const outside = named.filter((path) => !path.startsWith('dist/'));
  const unsafe = outside.filter((path) => !insidePackage(path));
  if (unsafe.length > 0) throw new Error(`manifest names a path outside the package: ${unsafe.join(', ')}`);
  return ['dist', ...outside.sort(), ...FILES_FIELD.slice(1)];
}

/** The released name: the source scope mapped to the published one. */
export const mappedName = (key, scope = 'adminiumjs') => `@${scope}/add-on-${key}`;

/** The publish-time package.json: mapped name, no devDeps, no scripts, the manifest's files. */
export function publishManifest({ pkg, manifest }, { scope, read } = {}) {
  const out = structuredClone(pkg);
  out.name = mappedName(manifest.key, scope);
  delete out.private;
  delete out.devDependencies;
  delete out.scripts;
  out.files = filesFor(manifest, { read });
  return out;
}

/**
 * The X-ray. Refuses a tarball that grew, shrank, or lost a declared half.
 *
 * The rule is that "the tarball cannot silently grow or lose a half"; both
 * directions are checked here because both have already happened once in this
 * repo's history in the abstract: WITHOUT `files[]`, `npm pack` ships all of
 * `src/` — every `.test.ts` included — and NO `dist/` at all, because the root
 * `.gitignore`'s `dist` entry applies to packing. The tarball was exactly
 * inverted, and nothing would have said so. Release 1.0.16 lost the other way:
 * Holiday Calendars shipped without the starting rows its manifest names.
 *
 * `read` opens a file of the package (its sample bundles), so the files they
 * name are held too.
 */
export function xray(label, entries, { manifest, read }) {
  const problems = [];
  const paths = entries.map((path) => path.replace(/^package\//, ''));
  const named = declaredEntryPoints(manifest, { read });

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
  // declared file is invisible without this check.
  for (const entry of named) {
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
    // Outside `dist/` and the papers, only the files the manifest names ride along.
    if (!path.startsWith('dist/') && !REQUIRED.includes(path) && !named.includes(path)) {
      problems.push(`ships a file the manifest does not name: ${path}`);
    }
  }

  if (problems.length > 0) {
    throw new Error(`${label}:\n  - ${problems.join('\n  - ')}`);
  }
}
