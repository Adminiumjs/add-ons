/**
 * THE HOST PARTS THIS TAB USES BEYOND WHAT `shared/host.ts` TYPES, and the
 * few small helpers its screens share.
 *
 * Nothing here is a copy of a part: `Sheet` and `DataTable` are the host's
 * own, typed with the one more prop this tab passes each (the sheet's place
 * at the end of the screen, a column that does not sort the page it shows).
 * The kit's answer to "may this reader delete an answer" is read from the
 * kit's own route, which says it per table (`can.delete`); `useAccess` says
 * read, create and update only.
 */
import { useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';

import { DataTable as HostTable, Sheet as HostSheet, SheetBody, api, lucideByName, type DataRow, type TableColumn } from '../shared/host.ts';
import { ADD_ON } from '../shared/paths.ts';

/** The host's sheet, with the class that puts it at the end of the screen, as the comp's side sheet is. */
export const Sheet = HostSheet as ComponentType<{ open: boolean; onOpenChange: (open: boolean) => void; maxWidth?: number; className?: string; children?: ReactNode }>;

/** A column of the host's table that does not sort: the list is the server's page, newest first. */
export type Column = TableColumn & { sortable?: boolean };
export const DataTable = HostTable as ComponentType<{ columns: readonly Column[]; rows: readonly DataRow[] | undefined; rowKey?: string; empty?: ReactNode; loading?: boolean }>;

/** A sheet's one column of rows, padded and scrolling (the host's body is a bare row). */
export function SheetPane({ children }: { children: ReactNode }): ReactNode {
  return (
    <SheetBody>
      <div className="min-w-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
    </SheetBody>
  );
}

export function Icon({ name }: { name: string }): ReactNode {
  const Found = lucideByName(name);
  return <Found className="size-4" aria-hidden="true" />;
}

/** A row key as the data routes take it: a number when it is one. */
export const keyValue = (key: string): string | number => (/^\d+$/.test(key) ? Number(key) : key);

/** Whether this reader may delete answers: false until the kit's read says so. */
export function useMayDelete(): boolean {
  const [may, setMay] = useState(false);
  useEffect(() => {
    let live = true;
    api
      .get<{ tables?: Record<string, { can?: { delete?: boolean } }> }>(`/api/v1/add-ons/${ADD_ON}/kit`)
      .then((reply) => {
        if (live) setMay(reply?.tables?.['answers']?.can?.delete === true);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return may;
}

/**
 * Whether the tab is drawn narrower than a phone's layout (the comp's 680):
 * then each answer is a card. A box not measured yet (width 0) is wide.
 */
export function useNarrow(below: number): [(node: HTMLDivElement | null) => void, boolean] {
  const [narrow, setNarrow] = useState(false);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      observer.current?.disconnect();
      observer.current = null;
      if (node === null) return;
      const measure = (): void => {
        const width = node.getBoundingClientRect().width;
        setNarrow(width > 0 && width < below);
      };
      measure();
      if (typeof ResizeObserver === 'undefined') return;
      observer.current = new ResizeObserver(measure);
      observer.current.observe(node);
    },
    [below],
  );
  return [ref, narrow];
}
