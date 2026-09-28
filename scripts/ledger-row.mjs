// SPDX-License-Identifier: AGPL-3.0-only
/**
 * One row of RELEASES.json, the ledger the marketplace reads.
 *
 * Kept apart from `publish-add-ons.mjs` so a unit test can hold the row's shape
 * without running a release: that script packs and uploads the moment it is
 * imported.
 *
 * `publishedAt` is the moment the public host says the file was written, as an
 * ISO 8601 string in UTC: the same field, and the same format, every app
 * ledger carries. It is the host's own Last-Modified for the object, never the
 * local clock, so a rerun that finds the file already in the bucket still
 * records when it was first written. Only when the host sends no readable
 * Last-Modified does it fall back to now, as the app release script does.
 */

/** An HTTP Last-Modified value (or null) as an ISO 8601 instant. */
export function publishedAtOf(lastModified, now = () => new Date()) {
  const at = typeof lastModified === 'string' ? Date.parse(lastModified) : Number.NaN;
  return Number.isNaN(at) ? now().toISOString() : new Date(at).toISOString();
}

/** The ledger row for one released file, in the order the file is written. */
export function ledgerRow({ name, key, version, integrity, shasum, fileCount }, publishedAt) {
  return { name, key, version, integrity, shasum, fileCount, publishedAt };
}
