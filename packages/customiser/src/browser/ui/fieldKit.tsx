/**
 * WHAT BOTH LOOKS' FIELDS SHARE: the part being filled, its value, its
 * checks, and the few small pieces each look draws the same way (the
 * character counter, a swatch, a picture's upload).
 */
import { CircleAlert, ImageOff, Ruler, Contrast, ScanLine, Search, TriangleAlert } from 'lucide-react';
import { useRef, useState } from 'react';

import { charCount, charLimit, sizeAllowed, type DesignValues, type PartValue } from '../../rules/index.ts';
import type { CustomiserApi, HeldSession } from '../api.ts';
import type { Catalogue, EditPart, Palette } from '../catalogue.ts';
import type { Check } from '../say.ts';
import { useShared } from './context.tsx';

export interface Upload {
  id: string;
  name: string;
  size: number;
  kind: string;
}

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
  uploads: Readonly<Record<string, Upload>>;
  upload: (part: EditPart, column: string, file: File) => Promise<void>;
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

/** A hidden file picker and the call that sends what it picked. */
export function usePicker(part: EditPart, column: string, upload: FieldsProps['upload']) {
  const input = useRef<HTMLInputElement>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const { t } = useShared();
  const accept = (part.picture ?? part.text?.alsoLogo)?.accept ?? ['svg', 'pdf', 'png', 'jpeg'];
  const types: Record<string, string> = { svg: '.svg,image/svg+xml', pdf: '.pdf,application/pdf', png: '.png,image/png', jpeg: '.jpg,.jpeg,image/jpeg', jpg: '.jpg,.jpeg,image/jpeg' };
  const element = (
    <input
      ref={input}
      type="file"
      className="cz-hidden-file"
      tabIndex={-1}
      aria-hidden="true"
      accept={accept.map((one) => types[one] ?? `.${one}`).join(',')}
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file === undefined) return;
        setBusy(true);
        setFailed(false);
        upload(part, column, file)
          .catch(() => setFailed(true))
          .finally(() => setBusy(false));
      }}
    />
  );
  return { element, pick: () => input.current?.click(), failed, busy, failedText: t('editor.upload.failed', 'That file couldn’t be sent. Try again.') };
}
