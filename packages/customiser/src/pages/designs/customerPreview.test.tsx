// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import '../testing/host.tsx';
import type { SetupData } from '../setup/data.ts';
import type { PreviewEditorProps } from './preview.tsx';

const seen = vi.hoisted(() => [] as unknown[]);
vi.mock('../../browser/ui/Editor.tsx', () => ({
  CustomiserEditor: ({ api }: { api: unknown }) => {
    seen.push(api);
    return null;
  },
}));

const { CustomerEditorPreview } = await import('./customerPreview.tsx');

const data = (name = 'Ring'): SetupData => ({
  areas: [],
  designs: [{ id: 7, state: 'published', name }],
  parts: [],
  fonts: [],
  finishes: [],
  finishPalette: null,
  features: [],
  settings: null,
  loading: false,
  error: null,
  refetch: () => {},
});
const props = (name?: string): PreviewEditorProps => ({
  base: { id: 1, name: 'Coasters', app: 'maker', sides: 1 },
  data: data(name),
  rows: null,
  design: null,
  shop: 'the shop',
  roleNames: { paper: 'Paper', ink: 'Ink', accent: 'Accent' },
  onAddToBasket: () => {},
  onSave: () => {},
});

afterEach(() => {
  cleanup();
  seen.length = 0;
});

describe('the preview of the customer’s editor', () => {
  it('keeps its editor when the page redraws with equal rows and words, so what was typed stays', () => {
    const view = render(<CustomerEditorPreview {...props()} />);
    view.rerender(<CustomerEditorPreview {...props()} />);
    expect(seen).toHaveLength(2);
    expect(seen[1]).toBe(seen[0]);
  });

  it('starts again when what it shows has changed', () => {
    const view = render(<CustomerEditorPreview {...props()} />);
    view.rerender(<CustomerEditorPreview {...props('Ring, renamed')} />);
    expect(seen).toHaveLength(2);
    expect(seen[1]).not.toBe(seen[0]);
  });
});
