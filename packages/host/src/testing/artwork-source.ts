/**
 * `describeArtworkSource`, copied verbatim from
 * `@adminium/add-on-contracts/testing`
 * (`packages/add-on-contracts/src/testing/index.ts`).
 *
 * THE SUITE IS PART OF THE CONTRACT, NOT A COURTESY (24 §5.5, D9). An
 * implementation that has not run it has claimed to implement the contract
 * without checking, and the whole point of `artwork-source@1` is that two
 * add-ons sharing no code can fill one slot. That claim rests on this file
 * running against both of them.
 *
 * IT NOW LITERALLY IS ONE FILE. Design Studio and Canva Import each carried a
 * copy, which quietly weakened the claim they exist to make: two copies of a
 * suite can be tuned apart one assertion at a time, and nothing would have
 * reported it. Do not soften an assertion here to make an implementation pass.
 * If an implementation cannot satisfy it, the implementation is wrong, or the
 * contract needs a version bump in the package these lines were copied from —
 * and then here.
 */

import { describe, expect, it } from 'vitest';

import type { ArtworkSource, JobSpec } from '../contracts/artwork-source.ts';
import { artworkRefSchema } from './schemas.ts';

export interface ArtworkSourceFixtures {
  /** A job the source can serve. */
  job: JobSpec;
  /** A job it cannot — it must decline WITH A REASON rather than throw. */
  unavailableJob?: JobSpec;
  /**
   * Drives `start()` to its cancel path. Implementations that cannot be
   * cancelled headlessly may omit it; the cancel assertion is then skipped.
   */
  cancel?: () => void;
}

export function describeArtworkSource(impl: ArtworkSource, fixtures: ArtworkSourceFixtures): void {
  describe(`artwork-source@1 conformance — ${impl.key}`, () => {
    it('has a non-empty key', () => {
      expect(impl.key).toMatch(/^[a-z][a-z0-9-]*$/);
    });

    it('labels itself for a job without throwing', () => {
      const label = impl.label(fixtures.job);
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    });

    it('reports availability as data, never as an exception', () => {
      const verdict = impl.available(fixtures.job);
      expect(verdict.ok).toBe(true);
    });

    it('declines an unservable job WITH a reason', () => {
      if (fixtures.unavailableJob === undefined) return;
      const verdict = impl.available(fixtures.unavailableJob);
      expect(verdict.ok).toBe(false);
      if (!verdict.ok) expect(verdict.reason.trim().length).toBeGreaterThan(0);
    });

    it('returns an ArtworkRef whose shape the host can check', async () => {
      const ref = await impl.start(fixtures.job);
      expect(ref).not.toBeNull();
      const parsed = artworkRefSchema.safeParse(ref);
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    });

    it('stamps the ref with its own key, so the host can trace the source', async () => {
      const ref = await impl.start(fixtures.job);
      expect(ref?.source).toBe(impl.key);
    });

    it('resolves to null when the customer backs out', async () => {
      if (fixtures.cancel === undefined) return;
      const pending = impl.start(fixtures.job);
      fixtures.cancel();
      await expect(pending).resolves.toBeNull();
    });
  });
}
