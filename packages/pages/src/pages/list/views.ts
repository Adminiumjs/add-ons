/**
 * THIS MONTH'S VIEWS OF EACH PAGE, for the list.
 *
 * One read of the views route per fifty pages, for the days of this month in
 * the business's zone. Only live and switched-off pages are asked about: a
 * draft has never been seen. Null while it is being read, or when Adminium
 * would not say (a host without counts, an install it cannot find).
 */
import { useEffect, useState } from 'react';

import { readViews, totalOf, type EngineApi } from '../../engine.ts';
import { rangeOf } from '../shared/days.ts';
import type { PageRow } from '../shared/rows.ts';

export function usePageViews(engine: EngineApi, install: string | null, today: string, pages: readonly PageRow[]): ReadonlyMap<string, number> | null {
  const asked = pages
    .filter((page) => page.state !== 'draft')
    .map((page) => page.key)
    .sort();
  const keys = asked.join(',');
  const [views, setViews] = useState<ReadonlyMap<string, number> | null>(null);
  useEffect(() => {
    let live = true;
    setViews(null);
    const things = keys === '' ? [] : keys.split(',');
    if (install === null) return;
    if (things.length === 0) {
      setViews(new Map());
      return;
    }
    readViews(engine, { installId: install, kind: 'page', things, ...rangeOf('this-month', today) })
      .then((counts) => {
        if (live) setViews(new Map(things.map((thing) => [thing, totalOf(counts, thing)])));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [engine, install, today, keys]);
  return views;
}
