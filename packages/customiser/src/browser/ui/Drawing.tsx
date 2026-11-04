/**
 * A DESIGN DRAWN FLAT: the base, its parts, the customer's words.
 *
 * A plain drawing in millimetres from the design's data, the same data the
 * shop makes the piece or the print from. It is the stand-in the previews
 * proper (both sides "As printed", the piece in 3D) replace: kept simple, one
 * function, every preview of the editor drawn by it (the stage, the gallery's
 * cards, the list of saved designs).
 *
 * Always left to right: it is the thing that will be made, and an Arabic page
 * must not mirror it. Colours here are the design's own (the paper, the ink,
 * the wood), never the page's theme, so they are SVG paint, not tokens.
 *
 * On the stage it is also a way in: each part a customer may change is a
 * button ("Edit Your words") that takes them to its field, and the part being
 * edited is outlined. A part only the shop sets shows a padlock when pointed
 * at (the maker's look keeps it out of the Tab order, since its row in the
 * list is the stop; the print look lets it be reached, as its comp does).
 */
import { Lock } from 'lucide-react';
import type { KeyboardEvent } from 'react';

import { SCALE_MAX, sizeInMm, type PartValue, type PictureRules } from '../../rules/index.ts';
import { areaMode, hexOf, liveParts, paletteOf, readyOf, valueOf, type Catalogue, type EditPart } from '../catalogue.ts';
import type { DesignData } from '../api.ts';
import { cssFamily } from './fonts.ts';
import { useShared } from './context.tsx';
import { thresholdOf, useOneColour, type Upload } from './pictures.ts';
import { drawnOfPlaced, placedOn } from '../placed.ts';
import type { Drawn } from '../../draw/parts.ts';

/** The wood, slate or plastic a piece is cut from, and the colour its engraving burns to. */
const MATERIALS: readonly { test: RegExp; face: string; edge: string; engraved: string }[] = [
  { test: /walnut/i, face: '#6b4428', edge: '#3b2413', engraved: '#24130a' },
  { test: /ply|birch/i, face: '#d9b98a', edge: '#a8845a', engraved: '#6a4321' },
  { test: /slate/i, face: '#3b4248', edge: '#272c30', engraved: '#c3cacf' },
  { test: /oak/i, face: '#c9a26b', edge: '#9a7444', engraved: '#4a2f16' },
];
const PAINT: Readonly<Record<string, string>> = { 'paint-white': '#f3f1ea', 'paint-black': '#15120e' };

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
  /** The design's logo and photo as this page holds them, drawn in their boxes; without them a box says it holds one. */
  pictures?: Readonly<Record<string, Upload>>;
  /** Where light becomes dark for a logo the laser engraves, before the customer moves the line. */
  startThreshold?: number;
}

function mix(hex: string, toward: string, share: number): string {
  const parse = (value: string) => [1, 3, 5].map((at) => parseInt(value.slice(at, at + 2), 16));
  const [a, b] = [parse(hex), parse(toward)];
  return `#${a.map((one, i) => Math.round(one + ((b[i] ?? 0) - one) * share).toString(16).padStart(2, '0')).join('')}`;
}

export function Drawing({ catalogue, design, side = 'front', guides = false, empty = 'sample', onPart, selected = null, lockShown = null, onLock, label, className, pictures, startThreshold = 50 }: DrawingProps) {
  const { t, look } = useShared();
  const { base } = catalogue;
  const ready = readyOf(catalogue, design.ready_design_id);
  const palette = paletteOf(ready, design.values);
  const parts = liveParts(catalogue, ready, design.values).filter((part) => part.side === side);
  const page = base.kind === 'page';
  const material = MATERIALS.find((one) => one.test.test(base.material ?? '')) ?? { face: '#e9e4da', edge: '#b9b2a5', engraved: '#3a3530' };
  // A printed item takes the colour its colour part chose.
  const colourPart = liveParts(catalogue, ready, design.values).find((part) => part.kind === 'colour');
  const plastic = colourPart === undefined ? null : (Object.values(catalogue.shared).flat().find((one) => one.code === (valueOf(design.values, colourPart).choice ?? colourPart.start?.choice)) ?? null);
  const face = page ? (hexOf(palette, 'paper') ?? '#ffffff') : (plastic?.hex ?? material.face);
  const edge = page ? '#d0d0d6' : plastic === null ? material.edge : mix(plastic.hex, '#000000', 0.3);
  const margin = page && guides ? base.bleed : 0;
  const [w, h] = [base.width, base.height];
  const view = `${String(-margin - 0.6)} ${String(-margin - 0.6)} ${String(w + 2 * margin + 1.2)} ${String(h + 2 * margin + 1.2)}`;
  const clip = `cz-clip-${String(base.id)}-${side}-${guides ? 'g' : 'p'}`;

  const inkFor = (part: EditPart): string => {
    const value = valueOf(design.values, part);
    if (page) return hexOf(palette, value.colour ?? part.text?.colour ?? 'ink') ?? '#191920';
    if (plastic !== null) return mix(plastic.hex, '#000000', 0.42);
    const finish = value.finish ?? design.values.finish ?? part.text?.finish ?? 'engraved';
    return PAINT[finish] ?? material.engraved;
  };

  const drawn = parts.map((part) => {
    const box = part.box;
    if (box === null) return null;
    const value = valueOf(design.values, part);
    const live = onPart !== undefined && !part.locked;
    const key = `${part.code}-${part.side}`;
    let body = null;
    if (part.kind === 'shape' && part.shape !== null) {
      const fill = page ? (hexOf(palette, part.shape.fill) ?? 'none') : 'none';
      const stroke = page ? 'none' : inkFor(part);
      const line = page ? 0 : 1;
      if (part.shape.shape === 'ellipse' || part.shape.shape === 'ring') body = <ellipse cx={box.x + box.w / 2} cy={box.y + box.h / 2} rx={box.w / 2 - line / 2} ry={box.h / 2 - line / 2} fill={fill} stroke={stroke} strokeWidth={line} />;
      else if (part.shape.shape === 'door')
        body = (
          <g fill="none" stroke={stroke} strokeWidth={0.8}>
            <rect x={box.x} y={box.y} width={box.w} height={box.h} />
            <rect x={box.x + box.w * 0.15} y={box.y + box.h * 0.1} width={box.w * 0.7} height={box.h * 0.35} />
            <rect x={box.x + box.w * 0.15} y={box.y + box.h * 0.52} width={box.w * 0.7} height={box.h * 0.38} />
          </g>
        );
      else body = <rect x={box.x} y={box.y} width={box.w} height={box.h} fill={fill} stroke={stroke} strokeWidth={line} />;
    } else if (part.kind === 'text') {
      const rules = part.text!;
      const mode = areaMode(design.values, part);
      const held = rules.alsoLogo === null || value.file === undefined ? undefined : pictures?.[rules.alsoLogo.file];
      if (mode === 'logo' && held !== undefined && rules.alsoLogo !== null) body = <Mark box={box} value={value} rules={rules.alsoLogo} picture={held} ink={inkFor(part)} engraves={!page} startThreshold={startThreshold} clip={`${clip}-${part.code}`} />;
      else if (mode === 'logo') body = <Slot box={box} text={value.file === undefined ? t('editor.drawing.logo', 'Your logo') : `${t('editor.drawing.logo', 'Your logo')} ✓`} page={page} filled={value.file !== undefined} />;
      else {
        const typed = (value.text ?? '').trim();
        const shownText = typed !== '' ? typed : empty === 'hide' || (part.fromArea && mode === null && empty !== 'sample') ? '' : part.placeholder;
        const lines = (part.upper ? shownText.toLocaleUpperCase() : shownText).split(/\r?\n/);
        const size = sizeInMm(rules, value.size ?? rules.size) || box.h * 0.7;
        const anchor = rules.align === 'center' ? 'middle' : rules.align === 'end' ? 'end' : 'start';
        const x = rules.align === 'center' ? box.x + box.w / 2 : rules.align === 'end' ? box.x + box.w : box.x;
        const top = box.y + box.h / 2 - ((lines.length - 1) * size * 1.2) / 2;
        const dim = typed === '' && empty === 'dim';
        body = (
          <text x={x} y={top} fontFamily={cssFamily(value.font ?? rules.font ?? 'Manrope')} fontSize={size} fontWeight={rules.weight} fill={inkFor(part)} textAnchor={look === 'maker' && !page ? 'middle' : anchor} dominantBaseline="middle" opacity={dim ? 0.4 : 1}>
            {lines.map((line, i) => (
              <tspan key={i} x={look === 'maker' && !page ? box.x + box.w / 2 : x} dy={i === 0 ? 0 : size * 1.2}>
                {line}
              </tspan>
            ))}
          </text>
        );
        if (shownText === '' && part.fromArea) body = <Slot box={box} text={part.name} page={page} />;
      }
    } else if (part.kind === 'picture') {
      const what = part.picture?.picture === 'photo' ? t('editor.drawing.photo', 'Your photo') : t('editor.drawing.logo', 'Your logo');
      const held = value.file === undefined || part.picture === null ? undefined : pictures?.[part.picture.file];
      body = held !== undefined && part.picture !== null ? <Mark box={box} value={value} rules={part.picture} picture={held} ink={inkFor(part)} engraves={!page} startThreshold={startThreshold} clip={`${clip}-${part.code}`} /> : <Slot box={box} text={value.file === undefined ? what : `${what} ✓`} page={page} filled={value.file !== undefined} />;
    } else if (part.kind === 'choice' || part.kind === 'colour') {
      if (part.kind === 'colour') return null;
      body = (
        <g>
          <rect x={box.x + box.w * 0.2} y={box.y + box.h * 0.2} width={box.w * 0.6} height={box.h * 0.6} rx={Math.min(box.w, box.h) * 0.12} fill="none" stroke={inkFor(part)} strokeWidth={0.8} />
          <text x={box.x + box.w / 2} y={box.y + box.h / 2} fontSize={Math.min(box.h * 0.14, 4)} fill={inkFor(part)} textAnchor="middle" dominantBaseline="middle" fontFamily={cssFamily('Manrope')}>
            {value.choice ?? part.start?.choice ?? ''}
          </text>
        </g>
      );
    }
    const outlined = selected === part.code;
    const locked = part.locked && !(part.shape?.background ?? false);
    const keyDown = (event: KeyboardEvent<SVGGElement>): void => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onPart?.(part.code);
      }
    };
    if (onPart === undefined) return <g key={key}>{body}</g>;
    if (live)
      return (
        <g key={key} role="button" tabIndex={0} aria-label={t('editor.drawing.edit', 'Edit {name}', { name: part.name })} className="cz-part" onClick={() => onPart(part.code)} onKeyDown={keyDown} onFocus={() => onLock?.(null)}>
          <rect x={box.x - 0.6} y={box.y - 0.6} width={box.w + 1.2} height={box.h + 1.2} fill="transparent" className={outlined ? 'cz-part-on' : 'cz-part-ring'} />
          {body}
        </g>
      );
    if (locked)
      return (
        <g
          key={key}
          className="cz-part-locked"
          {...(look === 'print' ? { role: 'img', tabIndex: 0, 'aria-label': t('editor.drawing.locked', '{name} — the shop’s part. It stays as it is.', { name: part.name }), onFocus: () => onLock?.(part.code), onBlur: () => onLock?.(null) } : { 'aria-hidden': true })}
          onMouseEnter={() => onLock?.(part.code)}
          onMouseLeave={() => onLock?.(null)}
        >
          <rect x={box.x - 0.6} y={box.y - 0.6} width={box.w + 1.2} height={box.h + 1.2} fill="transparent" className={lockShown === part.code ? 'cz-part-lock-on' : ''} />
          {body}
          {lockShown === part.code ? (
            <foreignObject x={box.x + box.w - 5} y={box.y - 2.5} width={5} height={5}>
              <span className="cz-lock-badge">
                <Lock aria-hidden="true" />
              </span>
            </foreignObject>
          ) : null}
        </g>
      );
    return <g key={key}>{body}</g>;
  });

  // A design made in the full editor draws its own parts, back to front.
  const placed = design.values.placed === undefined ? null : drawnOfPlaced(placedOn(design.values, side), palette, pictures ?? {}, { image: t('editor.full.image', 'Image') }).map((item) => <PlacedMark key={item.key} item={item} page={page} />);

  return (
    <svg direction="ltr" className={className ?? 'cz-drawing'} viewBox={view} role={onPart === undefined ? 'img' : 'group'} aria-label={label} {...(label === undefined ? { 'aria-hidden': true } : {})} preserveAspectRatio="xMidYMid meet">
      <defs>
        <clipPath id={clip}>
          {page ? <rect x={-margin} y={-margin} width={w + 2 * margin} height={h + 2 * margin} /> : <rect x={0} y={0} width={w} height={h} rx={base.corner} />}
        </clipPath>
      </defs>
      {page && guides ? <rect x={-margin} y={-margin} width={w + 2 * margin} height={h + 2 * margin} fill="#cf273c" fillOpacity={0.16} /> : null}
      <rect x={0} y={0} width={w} height={h} rx={page ? 0 : base.corner} fill={face} stroke={edge} strokeWidth={page ? 0.2 : 0.6} />
      <g clipPath={`url(#${clip})`}>{placed ?? drawn}</g>
      {page && guides ? (
        <g fill="none" pointerEvents="none">
          <rect x={0} y={0} width={w} height={h} stroke="#cf273c" strokeWidth={0.3} />
          {base.safe !== null ? <rect x={base.safe} y={base.safe} width={w - 2 * base.safe} height={h - 2 * base.safe} stroke="#1c59e0" strokeWidth={0.3} strokeDasharray="1 0.8" /> : null}
        </g>
      ) : null}
    </svg>
  );
}

/** Where a logo or photo goes, before there is one. */
function Slot({ box, text, page, filled = false }: { box: { x: number; y: number; w: number; h: number }; text: string; page: boolean; filled?: boolean }) {
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
 * A customer's logo or photo in its box: inside it or filling it, at its size
 * in the box and nudged where they put it. A logo the laser engraves in one
 * colour is drawn as the laser makes it, in the engraving's colour. A PDF is
 * named in its box: its page is drawn on the shop's side.
 */
function Mark({ box, value, rules, picture, ink, engraves, startThreshold, clip }: { box: { x: number; y: number; w: number; h: number }; value: PartValue; rules: PictureRules; picture: Upload; ink: string; engraves: boolean; startThreshold: number; clip: string }) {
  const oneColour = engraves && rules.colour === 'one';
  const laser = useOneColour(oneColour ? picture : undefined, thresholdOf(value, startThreshold), ink);
  const k = (value.scale ?? SCALE_MAX) / 100;
  const [w, h] = [box.w * k, box.h * k];
  const [x, y] = [box.x + (box.w - w) / 2 + (value.nx ?? 0), box.y + (box.h - h) / 2 + (value.ny ?? 0)];
  const fill = (value.fit ?? rules.fit) === 'fill';
  if (picture.url === undefined) return <Slot box={{ x, y, w, h }} text={picture.name === '' ? picture.kind.toUpperCase() : picture.name} page={!engraves} filled />;
  return (
    <g>
      {fill ? (
        <defs>
          <clipPath id={clip}>
            <rect x={box.x} y={box.y} width={box.w} height={box.h} />
          </clipPath>
        </defs>
      ) : null}
      <image href={oneColour ? (laser ?? picture.url) : picture.url} x={x} y={y} width={w} height={h} preserveAspectRatio={fill ? 'xMidYMid slice' : 'xMidYMid meet'} {...(fill ? { clipPath: `url(#${clip})` } : {})} opacity={oneColour && laser === null ? 0.85 : 1} />
    </g>
  );
}

/** One part of a design made in the full editor, drawn as the full editor draws it. */
function PlacedMark({ item, page }: { item: Drawn; page: boolean }) {
  const { box } = item;
  if (item.kind === 'text') {
    const anchor = item.align === 'center' ? 'middle' : item.align === 'end' ? 'end' : 'start';
    const x = item.align === 'center' ? box.x + box.w / 2 : item.align === 'end' ? box.x + box.w : box.x;
    return (
      <text x={x} y={box.y + item.sizeMm * 0.82} fontFamily={cssFamily(item.font)} fontSize={item.sizeMm} fontWeight={item.weight} textAnchor={anchor} fill={item.colour}>
        {item.lines.map((line, i) => (
          <tspan key={i} x={x} dy={i === 0 ? 0 : item.sizeMm * 1.25}>
            {line}
          </tspan>
        ))}
      </text>
    );
  }
  if (item.kind === 'image') return <image href={item.href} x={box.x} y={box.y} width={box.w} height={box.h} preserveAspectRatio={item.fill ? 'xMidYMid slice' : 'xMidYMid meet'} />;
  if (item.kind === 'slot') return <Slot box={box} text={item.label} page={page} filled />;
  if (item.shape === 'ellipse') return <ellipse cx={box.x + box.w / 2} cy={box.y + box.h / 2} rx={box.w / 2} ry={box.h / 2} fill={item.fill ?? 'none'} />;
  return <rect x={box.x} y={box.y} width={box.w} height={box.h} fill={item.fill ?? 'none'} />;
}
