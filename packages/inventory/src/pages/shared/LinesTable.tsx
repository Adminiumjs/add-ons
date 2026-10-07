/**
 * A SHEET'S LINES, AS THIS ADD-ON DRAWS THEM.
 *
 * The kit's table shows rows; a sheet's lines are rows of fields with a
 * second row under some of them (a batch and its expiry). So this is the
 * screens' own: a row of cells under a row of headings while there is room,
 * and one card a line — a label and its field to a line, with fields a thumb
 * can hit — below `cardsBelow` pixels of its own box. Built from the kit's
 * layout parts only: an add-on ships no stylesheet.
 *
 * A column the reader may not read is not passed in at all.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import { Card, Divider, Grid, Skeleton, Stack } from './host.ts';

export interface LineColumn<Line> {
  key: string;
  label: string;
  cell: (line: Line, index: number, narrow: boolean) => ReactNode;
}

export interface LinesTableProps<Line> {
  /** The table's name for a screen reader. */
  label: string;
  /** Up to six. The first names the line. */
  columns: readonly LineColumn<Line>[];
  lines: readonly Line[];
  lineKey: (line: Line) => string;
  /** A line's name for a screen reader: its item. */
  lineLabel: (line: Line) => string;
  /** Across the line's whole width, under its cells. */
  under?: (line: Line, index: number, narrow: boolean) => ReactNode;
  loading?: boolean;
  empty?: ReactNode;
  cardsBelow?: number;
}

const tracks = (count: number): 1 | 2 | 3 | 4 | 6 => (count <= 1 ? 1 : count === 2 ? 2 : count === 3 ? 3 : count === 4 ? 4 : 6);

export function LinesTable<Line>({ label, columns, lines, lineKey, lineLabel, under, loading, empty, cardsBelow = 1100 }: LinesTableProps<Line>): ReactNode {
  const box = useRef<HTMLDivElement | null>(null);
  const [narrow, setNarrow] = useState(false);
  // Measured before the first paint: a phone never sees the wide form flash by.
  useLayoutEffect(() => {
    const node = box.current;
    if (node === null) return;
    const measure = (): void => setNarrow(node.getBoundingClientRect().width < cardsBelow);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [cardsBelow]);

  let body: ReactNode;
  if (loading === true) {
    body = (
      <Stack gap="sm">
        <Skeleton height={44} />
        <Skeleton height={44} />
        <Skeleton height={44} />
      </Stack>
    );
  } else if (lines.length === 0) {
    body = empty ?? null;
  } else if (narrow) {
    body = (
      <Stack gap="md">
        {lines.map((line, index) => (
          <div key={lineKey(line)} role="group" aria-label={lineLabel(line)} data-part="inventory-line">
            <Card title={columns[0]?.cell(line, index, true)}>
              <Stack gap="sm">
                {columns.slice(1).map((column) => (
                  <Grid key={column.key} columns={2} gap="sm">
                    <span className="text-body-sm text-fg-muted">{column.label}</span>
                    <div className="min-w-0">{column.cell(line, index, true)}</div>
                  </Grid>
                ))}
                {under?.(line, index, true) ?? null}
              </Stack>
            </Card>
          </div>
        ))}
      </Stack>
    );
  } else {
    const across = tracks(columns.length);
    body = (
      <Stack gap="sm">
        <Grid columns={across} gap="md">
          {columns.map((column) => (
            <span key={column.key} className="text-body-sm font-semibold text-fg-muted">
              {column.label}
            </span>
          ))}
        </Grid>
        {lines.map((line, index) => (
          <div key={lineKey(line)} role="group" aria-label={lineLabel(line)} data-part="inventory-line">
            <Stack gap="sm">
              <Divider />
              <Grid columns={across} gap="md">
                {columns.map((column) => (
                  <div key={column.key} className="min-w-0">
                    {column.cell(line, index, false)}
                  </div>
                ))}
              </Grid>
              {under?.(line, index, false) ?? null}
            </Stack>
          </div>
        ))}
      </Stack>
    );
  }
  return (
    <div ref={box} role="region" aria-label={label} className="min-w-0" data-part="inventory-lines" data-layout={narrow ? 'cards' : 'rows'}>
      {body}
    </div>
  );
}
