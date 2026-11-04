/**
 * A KIT'S PIECES LAID FLAT (BC-B7b "Pieces", Birch Row Customiser 1667-1686).
 *
 * Every piece of the kit in rows, as the comp's `piecesScene` lays them,
 * each drawn from its own file (its cut and scored lines over the wood),
 * numbered "01" to "14", with the design's parts on the pieces that carry
 * them, drawn from the same sheet the laser's file for that piece is made
 * from. The piece being changed is outlined and named in full ("09 · Shop
 * sign"). On the customer's stage each part is a way into its field, as on
 * every drawing.
 *
 * `only` keeps the pieces that carry the design: the kit "seen flat".
 */
import type { ReactNode } from 'react';

import { layPieces, onPiece, type KitPiece } from '../../draw/kit.ts';
import type { DesignData } from '../api.ts';
import type { Catalogue } from '../catalogue.ts';
import { Drawing, type DrawingProps } from './Drawing.tsx';

export interface PiecesDrawingProps extends Pick<DrawingProps, 'pictures' | 'startThreshold' | 'empty' | 'onPart' | 'selected' | 'lockShown' | 'onLock'> {
  catalogue: Catalogue;
  design: DesignData;
  pieces: readonly KitPiece[];
  /** Each piece's own drawing, by the piece's id. */
  outlines?: Readonly<Record<string, string>>;
  /** The pieces to show; all of them otherwise. */
  only?: ReadonlySet<string>;
  /** The piece outlined and named in full. */
  highlight?: string | null;
  label: string;
  className?: string;
}

/** The room a piece's number takes above it, in millimetres. */
const TAG = 9;

export function PiecesDrawing({ catalogue, design, pieces, outlines = {}, only, highlight = null, label, className, ...drawing }: PiecesDrawingProps): ReactNode {
  const shown = only === undefined ? pieces : pieces.filter((piece) => only.has(piece.id));
  const laid = layPieces(shown, 470, 10 + TAG);
  const view = `-4 ${String(-TAG - 2)} ${String(laid.width + 8)} ${String(laid.height + TAG + 6)}`;
  return (
    <svg direction="ltr" className={className ?? 'cz-drawing'} viewBox={view} role="group" aria-label={label} preserveAspectRatio="xMidYMid meet" data-kit-pieces="">
      {laid.placed.map((piece) => {
        const on = piece.id === highlight;
        const name = `${piece.code} · ${piece.name}`;
        return (
          <g key={piece.id}>
            {/* The piece's number, and its name too when it is the one outlined. */}
            <text x={piece.x} y={piece.y - 2.4} fontSize={5.6} fontWeight={on ? 800 : 700} className={on ? 'cz-piece-tag cz-on' : 'cz-piece-tag'} fill={on ? '#1c59e0' : '#3b2a18'}>
              {on ? name : piece.code}
            </text>
            <Drawing {...drawing} catalogue={catalogue} design={design} on={onPiece(piece)} place={{ x: piece.x, y: piece.y, w: piece.width, h: piece.height }} outlineUrl={outlines[piece.id] ?? null} label={name} />
            {on ? <rect x={piece.x - 1.2} y={piece.y - 1.2} width={piece.width + 2.4} height={piece.height + 2.4} rx={1.5} fill="none" strokeWidth={1.4} stroke="#1c59e0" className="cz-piece-ring" pointerEvents="none" /> : null}
          </g>
        );
      })}
    </svg>
  );
}
