/**
 * A DESIGN DRAWN FLAT: the base, its parts, the customer's words.
 *
 * Drawn from the design's flat sheet (`src/draw/flat.ts`), the same sheet the
 * shop's proof, print file and laser files are made from: every word on the
 * baseline the files put it on, every picture in the box the files put it
 * in. Every preview of the editor is drawn by it (the stage, the full-screen
 * preview, the gallery's cards, the list of saved designs).
 *
 * Always left to right: it is the thing that will be made, and an Arabic page
 * must not mirror it. Colours here are the design's own (the paper, the ink,
 * the wood), never the page's theme, so they are SVG paint, not tokens. A
 * customer's logo or photo is drawn from its file, as a picture the page
 * loads (`<image>`), never as markup in the page.
 *
 * On the stage it is also a way in: each part a customer may change is a
 * button ("Edit Your words") that takes them to its field, and the part being
 * edited is outlined. A part only the shop sets shows a padlock when pointed
 * at (the maker's look keeps it out of the Tab order, since its row in the
 * list is the stop; the print look lets it be reached, as its comp does).
 */
import { Lock } from 'lucide-react';
import type { KeyboardEvent, ReactNode } from 'react';

import { flatSheet, sheetView, type FlatItem } from '../../draw/flat.ts';
import { thresholdOf, useOneColour, type Upload } from './pictures.ts';
import type { Box } from '../../draw/parts.ts';
import { partsOf, readyOf, type Catalogue } from '../catalogue.ts';
import type { DesignData } from '../api.ts';
import { cssFamily } from './fonts.ts';
import { useShared } from './context.tsx';

export interface DrawingProps {
  catalogue: Catalogue;
  design: DesignData;
  side?: 'front' | 'back';
  /** Bleed, trim and the safe line, for a page. */
  guides?: boolean;
  /** Empty parts show their example words (a gallery card) or are dimmed (the stage). */
  empty?: 'sample' | 'dim' | 'hide';
  /** The stage: parts are buttons that take the customer to their field. */
  onPart?: (code: string) => void;
  selected?: string | null;
  lockShown?: string | null;
  onLock?: (code: string | null) => void;
  label?: string;
  className?: string;
  /** The design's logo and photo as this page holds them, by file column: drawn in their boxes; without them a box says it holds one. */
  pictures?: Readonly<Record<string, Upload>>;
  /** Where light becomes dark for a logo the laser engraves, before the customer moves the line. */
  startThreshold?: number;
}

/** The guides of a printed page: a red trim, a blue dashed safe line, the bleed tinted. The printed proof's own colours. */
const TRIM = '#cf273c';
const SAFE = '#1c59e0';

export function Drawing({ catalogue, design, side = 'front', guides = false, empty = 'sample', onPart, selected = null, lockShown = null, onLock, label, className, pictures, startThreshold = 50 }: DrawingProps) {
  const { t, look } = useShared();
  const sheet = flatSheet(catalogue, design, {
    side,
    empty,
    labels: { logo: t('editor.drawing.logo', 'Your logo'), photo: t('editor.drawing.photo', 'Your photo'), image: t('editor.full.image', 'Image') },
    holds: (column) => pictures?.[column] !== undefined,
  });
  const { face } = sheet;
  const page = face.kind === 'page';
  const shown = sheetView(face, guides);
  const view = `${String(shown.x - 0.6)} ${String(shown.y - 0.6)} ${String(shown.w + 1.2)} ${String(shown.h + 1.2)}`;
  const clip = `cz-clip-${String(catalogue.base.id)}-${side}-${guides ? 'g' : 'p'}`;

  const drawn = sheet.items.map((item) => {
    const body = bodyOf(item, page, pictures, `${clip}-${item.code}`, startThreshold);
    const outlined = selected === item.code;
    const keyDown = (event: KeyboardEvent<SVGGElement>): void => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onPart?.(item.code);
      }
    };
    const { box } = item;
    if (onPart === undefined) return <g key={item.key}>{body}</g>;
    if (item.live)
      return (
        <g key={item.key} role="button" tabIndex={0} aria-label={t('editor.drawing.edit', 'Edit {name}', { name: nameOf(catalogue, design, item.code) })} className="cz-part" onClick={() => onPart(item.code)} onKeyDown={keyDown} onFocus={() => onLock?.(null)}>
          <rect x={box.x - 0.6} y={box.y - 0.6} width={box.w + 1.2} height={box.h + 1.2} fill="transparent" className={outlined ? 'cz-part-on' : 'cz-part-ring'} />
          {body}
        </g>
      );
    if (item.locked)
      return (
        <g
          key={item.key}
          className="cz-part-locked"
          {...(look === 'print' ? { role: 'img', tabIndex: 0, 'aria-label': t('editor.drawing.locked', '{name} — the shop’s part. It stays as it is.', { name: nameOf(catalogue, design, item.code) }), onFocus: () => onLock?.(item.code), onBlur: () => onLock?.(null) } : { 'aria-hidden': true })}
          onMouseEnter={() => onLock?.(item.code)}
          onMouseLeave={() => onLock?.(null)}
        >
          <rect x={box.x - 0.6} y={box.y - 0.6} width={box.w + 1.2} height={box.h + 1.2} fill="transparent" className={lockShown === item.code ? 'cz-part-lock-on' : ''} />
          {body}
          {lockShown === item.code ? (
            <foreignObject x={box.x + box.w - 5} y={box.y - 2.5} width={5} height={5}>
              <span className="cz-lock-badge">
                <Lock aria-hidden="true" />
              </span>
            </foreignObject>
          ) : null}
        </g>
      );
    return <g key={item.key}>{body}</g>;
  });

  return (
    <svg direction="ltr" className={className ?? 'cz-drawing'} viewBox={view} role={onPart === undefined ? 'img' : 'group'} aria-label={label} {...(label === undefined ? { 'aria-hidden': true } : {})} preserveAspectRatio="xMidYMid meet">
      <defs>
        <clipPath id={clip}>
          <rect x={shown.x} y={shown.y} width={shown.w} height={shown.h} rx={page ? 0 : face.corner} />
        </clipPath>
      </defs>
      {page && guides ? <rect x={shown.x} y={shown.y} width={shown.w} height={shown.h} fill={TRIM} fillOpacity={0.16} /> : null}
      <rect x={0} y={0} width={face.width} height={face.height} rx={face.corner} fill={face.colour} stroke={face.edge} strokeWidth={page ? 0.2 : 0.6} />
      <g clipPath={`url(#${clip})`}>{drawn}</g>
      {page && guides ? (
        <g fill="none" pointerEvents="none">
          <rect x={0} y={0} width={face.width} height={face.height} stroke={TRIM} strokeWidth={0.3} />
          {face.safe !== null ? <rect x={face.safe} y={face.safe} width={face.width - 2 * face.safe} height={face.height - 2 * face.safe} stroke={SAFE} strokeWidth={0.3} strokeDasharray="1 0.8" /> : null}
        </g>
      ) : null}
    </svg>
  );
}

/** The name a part goes by, for the words read out on the stage. */
function nameOf(catalogue: Catalogue, design: DesignData, code: string): string {
  return partsOf(catalogue, readyOf(catalogue, design.ready_design_id)).find((one) => one.code === code)?.name ?? code;
}

/** One item of the sheet, drawn. */
function bodyOf(item: FlatItem, page: boolean, pictures: Readonly<Record<string, Upload>> | undefined, clip: string, startThreshold: number): ReactNode {
  const { box } = item;
  if (item.kind === 'text')
    return (
      <text fontFamily={cssFamily(item.font)} fontSize={item.sizeMm} fontWeight={item.weight} fill={item.colour} textAnchor={item.anchor} opacity={item.dim ? 0.4 : 1}>
        {item.lines.map((line, index) => (
          <tspan key={String(index)} x={line.x} y={line.y}>
            {line.text}
          </tspan>
        ))}
      </text>
    );
  if (item.kind === 'slot') return <Slot box={box} text={item.label} page={item.page} filled={item.filled} />;
  if (item.kind === 'picture') {
    const picture = pictures?.[item.column];
    if (picture === undefined) return <Slot box={item.drawn} text="" page={page} filled />;
    return <Mark item={item} picture={picture} clip={clip} startThreshold={startThreshold} page={page} />;
  }
  if (item.kind === 'choice')
    return (
      <g>
        <rect x={box.x + box.w * 0.2} y={box.y + box.h * 0.2} width={box.w * 0.6} height={box.h * 0.6} rx={Math.min(box.w, box.h) * 0.12} fill="none" stroke={item.colour} strokeWidth={0.8} />
        <text x={box.x + box.w / 2} y={box.y + box.h / 2} fontSize={Math.min(box.h * 0.14, 4)} fill={item.colour} textAnchor="middle" dominantBaseline="middle" fontFamily={cssFamily('Manrope')}>
          {item.label}
        </text>
      </g>
    );
  const fill = item.fill ?? 'none';
  const stroke = item.stroke ?? 'none';
  if (item.shape === 'ellipse') return <ellipse cx={box.x + box.w / 2} cy={box.y + box.h / 2} rx={box.w / 2 - item.line / 2} ry={box.h / 2 - item.line / 2} fill={fill} stroke={stroke} strokeWidth={item.line} />;
  if (item.shape === 'door')
    return (
      <g fill="none" stroke={stroke} strokeWidth={item.line}>
        <rect x={box.x} y={box.y} width={box.w} height={box.h} />
        <rect x={box.x + box.w * 0.15} y={box.y + box.h * 0.1} width={box.w * 0.7} height={box.h * 0.35} />
        <rect x={box.x + box.w * 0.15} y={box.y + box.h * 0.52} width={box.w * 0.7} height={box.h * 0.38} />
      </g>
    );
  return <rect x={box.x} y={box.y} width={box.w} height={box.h} fill={fill} stroke={stroke} strokeWidth={item.line} />;
}

/** Where a logo or photo goes, before there is one. */
function Slot({ box, text, page, filled = false }: { box: Box; text: string; page: boolean; filled?: boolean }) {
  const ink = page ? '#3a3a44' : '#2a2018';
  return (
    <g>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} fill={filled ? '#ffffff' : 'none'} fillOpacity={filled ? 0.35 : 0} stroke={ink} strokeOpacity={0.5} strokeWidth={0.35} strokeDasharray="1.2 0.9" />
      <text x={box.x + box.w / 2} y={box.y + box.h / 2} fontSize={Math.max(1.6, Math.min(box.h * 0.16, 3.4))} fill={ink} fillOpacity={0.75} textAnchor="middle" dominantBaseline="middle" fontFamily={cssFamily('Manrope')}>
        {text}
      </text>
    </g>
  );
}

/**
 * A customer's logo or photo in its box, from its file: inside it or filling
 * it, at its size in the box and nudged where they put it. A logo the laser
 * engraves in one colour is drawn as the laser makes it, in the engraving's
 * colour. A PDF is named in its box: its page is drawn on the shop's side.
 */
function Mark({ item, picture, clip, startThreshold, page }: { item: Extract<FlatItem, { kind: 'picture' }>; picture: Upload; clip: string; startThreshold: number; page: boolean }) {
  const laser = useOneColour(item.oneColour ? picture : undefined, thresholdOf(item, startThreshold), item.colour);
  const { box, drawn } = item;
  if (picture.url === undefined) return <Slot box={drawn} text={picture.name === '' ? picture.kind.toUpperCase() : picture.name} page={page} filled />;
  return (
    <g>
      {item.fill ? (
        <defs>
          <clipPath id={clip}>
            <rect x={box.x} y={box.y} width={box.w} height={box.h} />
          </clipPath>
        </defs>
      ) : null}
      <image href={item.oneColour ? (laser ?? picture.url) : picture.url} x={drawn.x} y={drawn.y} width={drawn.w} height={drawn.h} preserveAspectRatio={item.fill ? 'xMidYMid slice' : 'xMidYMid meet'} {...(item.fill ? { clipPath: `url(#${clip})` } : {})} opacity={item.oneColour && laser === null ? 0.85 : 1} />
    </g>
  );
}
