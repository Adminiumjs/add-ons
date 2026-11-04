/**
 * WHAT BOTH LOOKS' FIELDS SHARE: the part being filled, its value, its
 * checks, and the few small pieces each look draws the same way (the
 * character counter, a swatch, a picture's upload).
 */
import { CircleAlert, ImageOff, Ruler, Contrast, ScanLine, Search, TriangleAlert } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';

import { charCount, charLimit, sizeAllowed, type DesignValues, type PartValue } from '../../rules/index.ts';
import type { CustomiserApi, HeldSession } from '../api.ts';
import type { Catalogue, EditPart, Palette } from '../catalogue.ts';
import type { Check } from '../say.ts';
import { useShared } from './context.tsx';
import { kindsFor, type Problem, type Transfer, type Upload } from './pictures.ts';

export type { Upload };

export interface FieldsProps {
  catalogue: Catalogue;
  parts: readonly EditPart[];
  values: DesignValues;
  palette: Palette | null;
  checks: readonly Check[];
  selected: string | null;
  /** The customer tried to add it to the basket: a needed part left empty says so at its field. */
  tried: boolean;
  setPart: (code: string, value: PartValue | null) => void;
  setDesign: (patch: Partial<Omit<DesignValues, 'parts'>>) => void;
  onSelect: (code: string | null) => void;
  /** A text field has focus: the phone hides its bar. */
  onTyping: (typing: boolean) => void;
  featurePrices: Readonly<Record<string, string>>;
  /** The design's logo and photo, by column, as the browser holds them. */
  pictures: Readonly<Record<string, Upload>>;
  /** A file on its way, by column. */
  transfers: Readonly<Record<string, Transfer>>;
  /** Why the last file was not taken, by column. */
  problems: Readonly<Record<string, Problem>>;
  upload: (part: EditPart, column: string, file: File) => void;
  /** Open "Make it one colour" for a logo the laser engraves. */
  onOneColour: (part: EditPart) => void;
  /** Where light becomes dark when the customer has not moved the line: the shop's start. */
  startThreshold: number;
  api: CustomiserApi;
  session: HeldSession | null;
}

export const fieldId = (code: string): string => `cz-f-${code}`;

/** How full a text part is, and the counter's colour: amber with 3 or fewer left, red over. */
export function fullness(part: EditPart, value: PartValue): { count: number; limit: number; state: 'ok' | 'near' | 'over' } {
  const rules = part.text!;
  const size = value.size ?? rules.size;
  const limit = charLimit(rules, sizeAllowed(rules, size) ? size : rules.size);
  const count = charCount(value.text);
  return { count, limit, state: count > limit ? 'over' : limit - count <= 3 ? 'near' : 'ok' };
}

export function CheckIcon({ icon }: { icon: Check['icon'] }) {
  if (icon === 'ruler') return <Ruler aria-hidden="true" />;
  if (icon === 'search') return <Search aria-hidden="true" />;
  if (icon === 'scan') return <ScanLine aria-hidden="true" />;
  if (icon === 'image-off') return <ImageOff aria-hidden="true" />;
  if (icon === 'contrast') return <Contrast aria-hidden="true" />;
  return <CircleAlert aria-hidden="true" />;
}

export const WarnIcon = TriangleAlert;

/** A colour shown as itself: SVG paint, so the editor's markup carries no inline style. */
export function Swatch({ hex, size = 20 }: { hex: string; size?: number }) {
  return (
    <svg className="cz-swatch" width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="9.25" fill={hex} stroke="rgba(0,0,0,.15)" strokeWidth="1" />
    </svg>
  );
}

/** The kinds of file a picture part takes: what its rules allow that its file column takes. */
export function acceptOf(part: EditPart): readonly string[] {
  const rules = part.picture ?? part.text?.alsoLogo;
  return kindsFor(rules?.accept ?? ['svg', 'pdf', 'png', 'jpeg'], rules?.file ?? 'logo_file');
}

/** A hidden file picker, a drop zone's handlers, and the call that sends what either was given. */
export function usePicker(part: EditPart, column: string, upload: FieldsProps['upload']) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const types: Record<string, string> = { svg: '.svg,image/svg+xml', pdf: '.pdf,application/pdf', png: '.png,image/png', jpeg: '.jpg,.jpeg,image/jpeg', jpg: '.jpg,.jpeg,image/jpeg' };
  const element = (
    <input
      ref={input}
      type="file"
      className="cz-hidden-file"
      tabIndex={-1}
      aria-hidden="true"
      accept={acceptOf(part).map((one) => types[one] ?? `.${one}`).join(',')}
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file !== undefined) upload(part, column, file);
      }}
    />
  );
  const drop = {
    onDragOver: (event: DragEvent) => {
      event.preventDefault();
      setOver(true);
    },
    onDragLeave: () => setOver(false),
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      setOver(false);
      const file = event.dataTransfer?.files?.[0];
      if (file !== undefined) upload(part, column, file);
    },
  };
  return { element, pick: () => input.current?.click(), drop, over };
}

/** A file's kind and weight, as the comps write them: "SVG · 48 KB". */
export function fileMeta(one: Upload, withPixels: boolean): string {
  const size = one.size >= 1024 * 1024 ? `${(one.size / (1024 * 1024)).toFixed(1)} MB` : `${String(Math.max(1, Math.round(one.size / 1024)))} KB`;
  const kind = one.kind === 'jpeg' ? 'JPEG' : one.kind.toUpperCase();
  if (!withPixels) return `${kind} · ${size}`;
  const pixels = one.kind === 'svg' || one.kind === 'pdf' ? null : one.px === undefined ? null : `${String(one.px[0])} × ${String(one.px[1])} px`;
  return [kind, pixels, size].filter((part) => part !== null).join(' · ');
}

/** How a file is moving: read first (the bar fills as it is read), then sent (the bar waits, the client tells nothing more). */
export function TransferBar({ transfer, label }: { transfer: Transfer; label: string }) {
  const { t } = useShared();
  const percent = transfer.share === null ? null : Math.round(transfer.share * 100);
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} {...(percent === null ? { 'aria-valuetext': t('editor.upload.sending', 'Sending') } : { 'aria-valuenow': percent })} className="cz-transfer">
      <span className="cz-transfer-line">
        <span className="cz-mono cz-strong cz-transfer-name">{transfer.name}</span>
        <span className="cz-mono cz-transfer-pct">{percent === null ? t('editor.upload.sending', 'Sending') : `${String(percent)}%`}</span>
      </span>
      <span className={percent === null ? 'cz-transfer-track cz-transfer-waiting' : 'cz-transfer-track'}>
        <svg className="cz-transfer-fill" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true">
          <rect x="0" y="0" width={percent === null ? 100 : percent} height="6" />
        </svg>
      </span>
    </div>
  );
}
