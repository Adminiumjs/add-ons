/**
 * A DESIGN, DRAWN FLAT: the base's face (a page with its trim, bleed and safe
 * line, or a piece at its size and corners) with a design's parts on it.
 *
 * Millimetres are the drawing's own units (`viewBox`), so a part dragged here
 * is kept where it is drawn. Always drawn left to right: it is the thing that
 * is made, and an Arabic screen must never mirror the shop's card or piece.
 * Colours of the thing itself are the design's own (its palette, its
 * finishes); the guides and the selection are the dashboard's tokens.
 * Nothing is styled inline.
 */
import type { KeyboardEvent, PointerEvent, ReactNode, Ref } from 'react';

import type { Box, Drawn } from './parts.ts';

export interface Face {
  kind: 'page' | 'piece';
  width: number;
  height: number;
  bleed: number;
  safe: number;
  corner: number;
  /** A page's paper, where the design has one. */
  paper?: string;
}

export interface SceneProps {
  face: Face;
  drawn: readonly Drawn[];
  /** Whether the trim, bleed and safe line are drawn (a page's "Guides"). */
  guides?: boolean;
  label: string;
  /** Drawn this many pixels across; the drawing keeps its own proportions. */
  width?: number;
  selected?: string | null;
  /** Parts that stay where they are (a page's background, edge to edge): selected, never moved. */
  fixed?: ReadonlySet<string>;
  /** Set on the face a person works on: it takes the pointer and the keys. */
  interactive?: {
    describedBy: string;
    onPointerDown: (event: PointerEvent<SVGSVGElement>) => void;
    onPointerMove: (event: PointerEvent<SVGSVGElement>) => void;
    onPointerUp: (event: PointerEvent<SVGSVGElement>) => void;
    onKeyDown: (event: KeyboardEvent<SVGSVGElement>) => void;
    onSelect: (key: string) => void;
    selectLabel: (key: string) => string;
  };
  svgRef?: Ref<SVGSVGElement>;
}

/** The drawing's own box in millimetres: the face with a margin round it, as wide as the bleed on a page. */
export function viewOfFace(face: Face): Box {
  const width = Math.max(face.width, 1);
  const height = Math.max(face.height, 1);
  const pad = Math.max(face.kind === 'page' ? face.bleed : 0, Math.min(width, height) * 0.06);
  return { x: -pad, y: -pad, w: width + pad * 2, h: height + pad * 2 };
}

/** Where a pointer is on the face, in millimetres; null where the drawing has no size on screen yet. */
export function pointOnFace(svg: SVGSVGElement, clientX: number, clientY: number, view: Box): { x: number; y: number } | null {
  const rect = svg.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  // `meet`: the drawing is scaled to fit and centred, so the smaller scale holds both ways.
  const scale = Math.min(rect.width / view.w, rect.height / view.h);
  const left = rect.left + (rect.width - view.w * scale) / 2;
  const top = rect.top + (rect.height - view.h * scale) / 2;
  return { x: view.x + (clientX - left) / scale, y: view.y + (clientY - top) / scale };
}

/** The size of a part's corner handle: a twentieth of the face's smaller side. */
export const handleSize = (face: Face): number => Math.max(1.2, Math.min(face.width, face.height) / 22);

function partOf(item: Drawn, line: number): ReactNode {
  const { box } = item;
  if (item.kind === 'text') {
    const anchor = item.align === 'center' ? 'middle' : item.align === 'end' ? 'end' : 'start';
    const x = item.align === 'center' ? box.x + box.w / 2 : item.align === 'end' ? box.x + box.w : box.x;
    return (
      <text x={x} y={box.y + item.sizeMm * 0.82} fontFamily={item.font} fontSize={item.sizeMm} fontWeight={item.weight} textAnchor={anchor} fill={item.colour}>
        {item.lines.map((one, index) => (
          <tspan key={String(index)} x={x} dy={index === 0 ? 0 : item.sizeMm * 1.25}>
            {one}
          </tspan>
        ))}
      </text>
    );
  }
  if (item.kind === 'slot') {
    const size = Math.max(1.6, Math.min(box.h * 0.22, box.w / Math.max(6, item.label.length * 0.62)));
    return (
      <>
        <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={Math.min(box.w, box.h) / 14} fill="var(--surface-3)" fillOpacity={0.55} stroke="var(--fg-subtle)" strokeWidth={line} strokeDasharray={`${String(line * 4)} ${String(line * 3)}`} />
        <text x={box.x + box.w / 2} y={box.y + box.h / 2 + size * 0.35} fontSize={size} textAnchor="middle" fill="var(--fg-muted)">
          {item.label}
        </text>
      </>
    );
  }
  if (item.kind === 'image') {
    const clip = `cz-scene-clip-${item.key.replace(/[^A-Za-z0-9_-]/g, '')}`;
    return (
      <>
        {item.fill ? (
          <defs>
            <clipPath id={clip}>
              <rect x={box.x} y={box.y} width={box.w} height={box.h} />
            </clipPath>
          </defs>
        ) : null}
        <image href={item.href} x={box.x} y={box.y} width={box.w} height={box.h} preserveAspectRatio={item.fill ? 'xMidYMid slice' : 'xMidYMid meet'} {...(item.fill ? { clipPath: `url(#${clip})` } : {})} />
      </>
    );
  }
  const paint = { fill: item.fill ?? 'none', stroke: item.stroke ?? 'none', strokeWidth: item.stroke === null ? 0 : line * 1.6 };
  if (item.shape === 'rect') return <rect x={box.x} y={box.y} width={box.w} height={box.h} {...paint} />;
  return <ellipse cx={box.x + box.w / 2} cy={box.y + box.h / 2} rx={box.w / 2} ry={box.h / 2} {...paint} />;
}

export function Scene({ face, drawn, guides = true, label, width, selected = null, fixed, interactive, svgRef }: SceneProps): ReactNode {
  const view = viewOfFace(face);
  const w = Math.max(face.width, 1);
  const h = Math.max(face.height, 1);
  const line = Math.min(w, h) / 180;
  const handle = handleSize(face);
  const page = face.kind === 'page';
  const chosen = drawn.find((item) => item.key === selected) ?? null;
  return (
    <svg
      ref={svgRef}
      viewBox={`${String(view.x)} ${String(view.y)} ${String(view.w)} ${String(view.h)}`}
      width={width === undefined ? '100%' : String(width)}
      preserveAspectRatio="xMidYMid meet"
      direction="ltr"
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
      {page ? <rect x={-face.bleed} y={-face.bleed} width={w + face.bleed * 2} height={h + face.bleed * 2} fill={face.paper ?? '#ffffff'} /> : null}
      {page ? null : <rect x={0} y={0} width={w} height={h} rx={face.corner} fill="var(--surface)" stroke="var(--fg-muted)" strokeWidth={line * 1.5} />}
      {drawn.map((item) => {
        const body = partOf(item, line);
        if (interactive === undefined) return <g key={item.key}>{body}</g>;
        return (
          <g
            key={item.key}
            role="button"
            tabIndex={-1}
            aria-label={interactive.selectLabel(item.key)}
            aria-pressed={item.key === selected}
            data-part={item.key}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                interactive.onSelect(item.key);
              }
            }}
          >
            {/* The whole box takes the pointer, words included: a click between two letters still picks the part. */}
            <rect x={item.box.x} y={item.box.y} width={Math.max(item.box.w, 0.5)} height={Math.max(item.box.h, 0.5)} fill="transparent" />
            {body}
          </g>
        );
      })}
      {page && guides ? (
        <>
          {face.bleed > 0 ? <path d={`M${String(-face.bleed)} ${String(-face.bleed)}H${String(w + face.bleed)}V${String(h + face.bleed)}H${String(-face.bleed)}Z M0 0V${String(h)}H${String(w)}V0Z`} fill="var(--danger)" fillOpacity={0.16} fillRule="evenodd" /> : null}
          <rect x={0} y={0} width={w} height={h} rx={face.corner} fill="none" stroke="var(--danger)" strokeWidth={line * 1.5} />
          {face.safe > 0 ? <rect x={face.safe} y={face.safe} width={Math.max(0, w - face.safe * 2)} height={Math.max(0, h - face.safe * 2)} fill="none" stroke="var(--info)" strokeWidth={line * 1.5} strokeDasharray={`${String(line * 6)} ${String(line * 4)}`} /> : null}
        </>
      ) : null}
      {chosen === null ? null : (
        <g aria-hidden="true">
          <rect x={chosen.box.x} y={chosen.box.y} width={chosen.box.w} height={chosen.box.h} fill="none" stroke="var(--accent)" strokeWidth={line * 2.5} />
          {interactive === undefined || fixed?.has(chosen.key) === true ? null : <rect data-handle="" x={chosen.box.x + chosen.box.w - handle / 2} y={chosen.box.y + chosen.box.h - handle / 2} width={handle} height={handle} fill="var(--accent)" />}
        </g>
      )}
    </svg>
  );
}
