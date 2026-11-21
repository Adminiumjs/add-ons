/** The host's parts, as these screens use them. */
import app from '@adminium/add-on-contracts/runtime/app';
import dataKit from '@adminium/add-on-contracts/runtime/data';
import uiKit from '@adminium/add-on-contracts/runtime/ui';
import type { ComponentType, CSSProperties, ReactNode } from 'react';

type Part = ComponentType<Record<string, unknown>>;
const ui = uiKit as unknown as Readonly<Record<string, Part>>;
const data = dataKit as unknown as Readonly<Record<string, Part>>;

export const Button = ui['Button']!;
export const Alert = ui['Alert']!;
export const Modal = ui['Modal']!;
export const ModalHeader = ui['ModalHeader']!;
export const ModalBody = ui['ModalBody']!;
export const ModalFooter = ui['ModalFooter']!;
export const Spinner = ui['Spinner']!;
export const Input = data['Input']!;
export const Switch = data['Switch']!;
export const Checkbox = data['Checkbox']!;
export const Skeleton = data['Skeleton']!;

export const { PageSurface, PageActions, api, useLocaleTag, lucideByName } = app as unknown as {
  PageSurface: ComponentType<{ width?: string; children?: ReactNode }>;
  PageActions: ComponentType<{ title: string; documentTitle: string; subtitle?: string; backTo?: string }>;
  api: {
    get<T>(url: string): Promise<T>;
    post<T>(url: string, body?: unknown): Promise<T>;
    put<T>(url: string, body: unknown): Promise<T>;
  };
  useLocaleTag: () => string;
  lucideByName: (name: string) => ComponentType<{ size?: number; 'aria-hidden'?: boolean }> | null | undefined;
};

export const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: 'var(--shadow)', padding: 20, display: 'flex', flexDirection: 'column', gap: 10 };
export const muted: CSSProperties = { fontSize: 12.5, color: 'var(--fg-muted)', lineHeight: 1.5, margin: 0, textWrap: 'pretty' };
export const subtle: CSSProperties = { fontSize: 12, color: 'var(--fg-subtle)', lineHeight: 1.5, margin: 0 };
export const mono: CSSProperties = { fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)', fontWeight: 500 };
export const well: CSSProperties = { padding: 14, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 };

export type Tone = 'pos' | 'warn' | 'neutral' | 'danger';

const TONES: Record<Tone, { bg: string; fg: string }> = {
  pos: { bg: 'var(--pos-soft)', fg: 'var(--pos)' },
  warn: { bg: 'var(--warn-soft)', fg: 'var(--warn)' },
  neutral: { bg: 'var(--surface-3)', fg: 'var(--fg-muted)' },
  danger: { bg: 'var(--danger-soft)', fg: 'var(--danger)' },
};

export const pillStyle = (tone: Tone): CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: TONES[tone].bg, color: 'var(--fg)', whiteSpace: 'nowrap' });
export const dotStyle = (tone: Tone): CSSProperties => ({ width: 6, height: 6, borderRadius: '50%', background: TONES[tone].fg, flexShrink: 0 });
