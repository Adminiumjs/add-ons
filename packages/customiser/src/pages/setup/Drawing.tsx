/**
 * THE FACE, DRAWN FLAT: a page with its trim, bleed and safe line, or a
 * piece at its size and corners, and the areas on it. Millimetres are the
 * drawing's own units (`viewBox`), so an area drawn here is kept as it is
 * drawn. Colours are the dashboard's tokens; nothing is styled inline.
 *
 * Always drawn left to right: it is the thing that is made, and an Arabic
 * screen must not mirror the shop's piece. An SVG's own coordinates never
 * follow the page's direction, so nothing here turns with it.
 */
import type { KeyboardEvent, PointerEvent, ReactNode, Ref } from 'react';

import type { Box, PageGuides, Shape, Size } from './facts.ts';

export interface DrawnArea {
  id: string;
  name: string;
  shape: Shape;
  box: Box;
}

export interface DrawingProps {
  kind: 'page' | 'piece';
  size: Size;
  guides?: PageGuides;
  corner?: number;
  areas?: readonly DrawnArea[];
  selected?: string | null;
  /** The box being drawn, dashed, while a drag draws one. */
  draft?: { box: Box; shape: Shape } | null;
  /** Words for a reader of the picture; a drawing that takes keys is labelled by its own `label`. */
  label: string;
  /** Set on the face a person draws on: it takes the pointer and the keys. */
  interactive?: {
    describedBy: string;
    onPointerDown: (event: PointerEvent<SVGSVGElement>) => void;
    onPointerMove: (event: PointerEvent<SVGSVGElement>) => void;
    onPointerUp: (event: PointerEvent<SVGSVGElement>) => void;
    onKeyDown: (event: KeyboardEvent<SVGSVGElement>) => void;
    onSelect: (id: string) => void;
    selectLabel: (name: string) => string;
  };
  svgRef?: Ref<SVGSVGElement>;
}

/** The drawing's own box in millimetres: the face with a margin round it, as wide as the bleed on a page. */
export function viewOf(kind: 'page' | 'piece', size: Size, guides?: PageGuides): { x: number; y: number; w: number; h: number } {
  const bleed = kind === 'page' ? (guides?.bleed ?? 0) : 0;
  const width = Math.max(size.width, 1);
  const height = Math.max(size.height, 1);
  const pad = Math.max(bleed, Math.min(width, height) * 0.06);
  return { x: -pad, y: -pad, w: width + pad * 2, h: height + pad * 2 };
}

/** Where a pointer is on the face, in millimetres; null where the drawing has no size on screen yet. */
export function pointOn(svg: SVGSVGElement, clientX: number, clientY: number, view: { x: number; y: number; w: number; h: number }): { x: number; y: number } | null {
  const rect = svg.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  // `meet`: the drawing is scaled to fit and centred, so the smaller scale holds both ways.
  const scale = Math.min(rect.width / view.w, rect.height / view.h);
  const left = rect.left + (rect.width - view.w * scale) / 2;
  const top = rect.top + (rect.height - view.h * scale) / 2;
  return { x: view.x + (clientX - left) / scale, y: view.y + (clientY - top) / scale };
}

/** The handle at an area's corner, a twentieth of the face's smaller side across. */
const handleOf = (size: Size): number => Math.max(1.5, Math.min(size.width, size.height) / 20);

export function Drawing({ kind, size, guides, corner, areas = [], selected = null, draft = null, label, interactive, svgRef }: DrawingProps): ReactNode {
  const bleed = kind === 'page' ? (guides?.bleed ?? 0) : 0;
  const width = Math.max(size.width, 1);
  const height = Math.max(size.height, 1);
  const view = viewOf(kind, size, guides);
  const viewBox = `${String(view.x)} ${String(view.y)} ${String(view.w)} ${String(view.h)}`;
  const radius = kind === 'page' ? (guides?.corner ?? 0) : (corner ?? 0);
  const line = Math.min(width, height) / 160;
  const handle = handleOf(size);
  const shape = (box: Box, oval: boolean, rest: Record<string, string | number>): ReactNode =>
    oval ? <ellipse cx={box.x + box.w / 2} cy={box.y + box.h / 2} rx={box.w / 2} ry={box.h / 2} {...rest} /> : <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={Math.min(box.w, box.h) / 12} {...rest} />;
  return (
    <svg
      ref={svgRef}
      viewBox={viewBox}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      {...(interactive === undefined
        ? { role: 'img', 'aria-label': label }
        : {
            role: 'application',
            tabIndex: 0,
            'aria-label': label,
            'aria-describedby': interactive.describedBy,
            onPointerDown: interactive.onPointerDown,
            onPointerMove: interactive.onPointerMove,
            onPointerUp: interactive.onPointerUp,
            onPointerCancel: interactive.onPointerUp,
            onKeyDown: interactive.onKeyDown,
          })}
      data-face=""
    >
      {kind === 'page' && bleed > 0 ? <rect x={-bleed} y={-bleed} width={width + bleed * 2} height={height + bleed * 2} fill="var(--danger-soft)" /> : null}
      <rect x={0} y={0} width={width} height={height} rx={radius} fill="var(--surface)" stroke={kind === 'page' ? 'var(--danger)' : 'var(--fg-muted)'} strokeWidth={line * 1.5} />
      {kind === 'page' && guides !== undefined && guides.safe > 0 ? (
        <rect x={guides.safe} y={guides.safe} width={Math.max(0, width - guides.safe * 2)} height={Math.max(0, height - guides.safe * 2)} fill="none" stroke="var(--info)" strokeWidth={line * 1.5} strokeDasharray={`${String(line * 6)} ${String(line * 4)}`} />
      ) : null}
      {areas.map((area) => {
        const on = area.id === selected;
        const rest = { fill: on ? 'var(--info-soft)' : 'var(--accent-soft)', stroke: on ? 'var(--info)' : 'var(--accent)', strokeWidth: line * (on ? 3 : 1.5) };
        if (interactive === undefined) return <g key={area.id}>{shape(area.box, area.shape === 'oval', rest)}</g>;
        return (
          <g
            key={area.id}
            role="button"
            tabIndex={0}
            aria-label={interactive.selectLabel(area.name)}
            aria-pressed={on}
            data-part={area.id}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                interactive.onSelect(area.id);
              }
            }}
            onFocus={() => interactive.onSelect(area.id)}
          >
            {shape(area.box, area.shape === 'oval', rest)}
            {on ? <rect data-handle="" x={area.box.x + area.box.w - handle / 2} y={area.box.y + area.box.h - handle / 2} width={handle} height={handle} fill="var(--info)" /> : null}
          </g>
        );
      })}
      {draft === null ? null : shape(draft.box, draft.shape === 'oval', { fill: 'var(--info-soft)', stroke: 'var(--info)', strokeWidth: line * 2, strokeDasharray: `${String(line * 5)} ${String(line * 3)}` })}
    </svg>
  );
}
