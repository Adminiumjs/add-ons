// @vitest-environment happy-dom
/**
 * The proof and the files are made only from the whole design: never before
 * every read the drawing needs has come back. A proof made sooner drew an
 * empty coaster (no ring, no words, no logo), or a one-colour logo in full
 * colour, and was sent to the customer as it was.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FlatSheet } from '../draw/flat.ts';
import { loaded, resetWorld, seed, world } from '../pages/testing/host.tsx';
import { IDS, seedCard, seedShop } from '../pages/testing/rows.ts';

/** What each proof of a piece was drawn from: the sheet, the shop's one-colour line, and the pictures' lightness. */
const drawn: { sheet: FlatSheet; threshold: number; lights: Readonly<Record<string, unknown>> }[] = [];
/** When set, the sheets come back with nothing drawn on them, as a catalogue read too soon once did. */
const sheets = { blank: false };
vi.mock('./make.ts', async (original) => {
  const real = await original<typeof import('./make.ts')>();
  return {
    ...real,
    sheetsFor: (...args: Parameters<typeof real.sheetsFor>) => real.sheetsFor(...args).map((sheet) => (sheets.blank ? { ...sheet, items: [] } : sheet)),
    makePieceProof: async (sheet: FlatSheet, _design: unknown, threshold: number, lights: Readonly<Record<string, unknown>>) => {
      drawn.push({ sheet, threshold, lights });
      return new Blob(['proof'], { type: 'image/png' });
    },
  };
});

const { default: Line, PICTURE_WAIT } = await import('./line.tsx');

const HOST = { connectionId: 'c1', table: 'public.maker_order_lines', row: 'l_6120' };
const LOGO = 'file_01HZY00000000000000000GGG1';
const settle = async (): Promise<void> => {
  for (let i = 0; i < 6; i += 1)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
};
const button = (name: string): HTMLButtonElement => screen.getByRole('button', { name }) as HTMLButtonElement;
const made = () => world.calls.filter((call) => call.kind === 'create' || call.kind === 'upload');
const texts = (sheet: FlatSheet): string[] => sheet.items.flatMap((item) => (item.kind === 'text' ? [item.lines.map((line) => line.text).join(' ')] : []));

beforeEach(() => {
  resetWorld();
  seedShop();
  drawn.length = 0;
  sheets.blank = false;
  PICTURE_WAIT.ms = 8000;
  world.upload = () => ({ id: 'file_01HZY00000000000000000PRF9' });
  // Ring, with the shopper's words where the coaster takes them.
  seed('designs', [{ id: 91, app: 'maker', code: null, format: 1, ready_design_id: 51, base_id: IDS.coasters, values: JSON.stringify({ format: 1, parts: { words: { text: 'The Hartleys', font: 'Manrope', size: 6 } } }), state: 'ordered', updated_at: '2026-08-05T15:01:00Z' }]);
  seed('design_versions', [{ id: 95, app: 'maker', design_id: 91, version: 1, values: JSON.stringify({ format: 1, parts: { words: { text: 'The Hartleys', font: 'Manrope', size: 6 } } }), proof_file: null, note: null, receipt_id: 3, made_at: '2026-08-05T15:01:00Z' }]);
  seed('version_files', []);
  seed('ready_parts', world.tables['ready_parts']!.map((one) => (one['id'] === 61 ? { ...one, x_mm: 11.5, y_mm: 57, w_mm: 72, h_mm: 13.5, rules: JSON.stringify({ fonts: ['Manrope'], font: 'Manrope', unit: 'mm', size: 6, chars: 24 }) } : one)));
  vi.stubGlobal('fetch', async () => new Response('', { status: 404 }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the proof and the files of an order line, before the panel has loaded', () => {
  it('makes nothing while the design’s parts, fonts and settings are still loading, and says it is loading', async () => {
    for (const table of ['ready_parts', 'fonts', 'palette_colours', 'settings', 'version_files']) world.pending.add(table);
    render(<Line {...HOST} linked="91" />);
    expect([button('Make the proof').disabled, button('Make the files').disabled]).toEqual([true, true]);
    expect(screen.getByText('Loading the design…')).toBeTruthy();
    fireEvent.click(button('Make the proof'));
    fireEvent.click(button('Make the files'));
    await settle();
    expect(made()).toEqual([]);
    expect(drawn).toEqual([]);
  });

  it('once everything is in, makes the proof with the shopper’s words on it, at the shop’s one-colour line', async () => {
    seed('settings', [{ ...world.tables['settings']![0]!, one_colour_threshold: 62 }]);
    world.pending.add('ready_parts');
    world.pending.add('settings');
    render(<Line {...HOST} linked="91" />);
    expect(button('Make the proof').disabled).toBe(true);
    loaded('ready_parts');
    // The parts are in, the shop's line is not: still nothing to make.
    expect(button('Make the proof').disabled).toBe(true);
    loaded('settings');
    await settle();
    expect(button('Make the proof').disabled).toBe(false);
    expect(screen.queryByText('Loading the design…')).toBeNull();
    fireEvent.click(button('Make the proof'));
    await settle();
    expect(drawn).toHaveLength(1);
    expect(texts(drawn[0]!.sheet)).toEqual(['The Hartleys']);
    expect(drawn[0]!.threshold).toBe(62);
    expect(world.calls.find((call) => call.kind === 'upload' && call.table === 'design_versions')?.values).toMatchObject({ column: 'proof_file', name: 'design-91-v1-proof.png' });
  });

  it('waits for a one-colour logo’s lightness before the proof can be made', async () => {
    const values = JSON.stringify({ format: 1, parts: { logo: { file: 'logo_file' }, words: { text: 'Sam' } } });
    seed('designs', [{ ...world.tables['designs']![0]!, ready_design_id: null, values, logo_file: LOGO }]);
    seed('design_versions', [{ ...world.tables['design_versions']![0]!, values }]);
    // The logo's first read (its lightness) comes back only when the test says; later reads at once.
    const answer: { now: (response: Response) => void } = { now: () => undefined };
    let asked = 0;
    const logo = (): Response => new Response(new TextEncoder().encode('GIF89a') as BlobPart);
    vi.stubGlobal('fetch', (address: string) => {
      if (address !== `/api/v1/files/${LOGO}/content`) return Promise.resolve(new Response('', { status: 404 }));
      asked += 1;
      return asked === 1 ? new Promise<Response>((resolve) => (answer.now = resolve)) : Promise.resolve(logo());
    });
    render(<Line {...HOST} linked="91" />);
    await settle();
    expect(button('Make the proof').disabled).toBe(true);
    fireEvent.click(button('Make the proof'));
    await settle();
    expect(drawn).toEqual([]);
    // The picture comes back (here, one of a kind whose lightness is not read: it is drawn as uploaded, as the shopper's editor drew it).
    answer.now(logo());
    await settle();
    expect(button('Make the proof').disabled).toBe(false);
    fireEvent.click(button('Make the proof'));
    await settle();
    expect(drawn).toHaveLength(1);
    expect(drawn[0]!.sheet.items.some((item) => item.kind === 'picture' && item.oneColour)).toBe(true);
  });
});

describe('a panel whose pictures or settings cannot be read', () => {
  const withLogo = (): void => {
    const values = JSON.stringify({ format: 1, parts: { logo: { file: 'logo_file' } } });
    seed('designs', [{ ...world.tables['designs']![0]!, ready_design_id: null, values, logo_file: LOGO }]);
    seed('design_versions', [{ ...world.tables['design_versions']![0]!, values }]);
  };

  it('opens once a logo’s read has been waited for long enough, and says the logo is drawn in full colour', async () => {
    PICTURE_WAIT.ms = 20;
    withLogo();
    vi.stubGlobal('fetch', (address: string) => (address === `/api/v1/files/${LOGO}/content` ? new Promise<Response>(() => undefined) : Promise.resolve(new Response('', { status: 404 }))));
    render(<Line {...HOST} linked="91" />);
    await settle();
    expect(button('Make the proof').disabled).toBe(true);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    await settle();
    expect(button('Make the proof').disabled).toBe(false);
    expect(screen.getByText('The logo is drawn in full colour')).toBeTruthy();
  });

  it('never waits for a picture’s lightness on a page, which is printed in colour', async () => {
    seedCard();
    seed('designs', [{ id: 92, app: 'printing', ready_design_id: 53, base_id: IDS.cards, values: JSON.stringify({ format: 1, layout: 'left', sides: 2, parts: { name: { text: 'Nell Fairweather' }, logo: { file: 'logo_file' } } }), logo_file: LOGO, state: 'ordered', updated_at: '2026-08-04T09:00:00Z' }]);
    seed('design_versions', []);
    const asked: string[] = [];
    vi.stubGlobal('fetch', (address: string) => {
      asked.push(address);
      return new Promise<Response>(() => undefined);
    });
    render(<Line {...HOST} linked="92" />);
    await settle();
    expect(button('Make the proof').disabled).toBe(false);
    expect(asked).toEqual([]);
  });

  it('says the shop’s line is unknown where the install has no settings row, or reading it failed', async () => {
    withLogo();
    seed('settings', []);
    render(<Line {...HOST} linked="91" />);
    await settle();
    expect(screen.getByText('The shop’s one-colour line is hidden from you')).toBeTruthy();
  });

  it('saves nothing, not even a version, for a proof that would leave out every choice', async () => {
    seed('design_versions', []);
    sheets.blank = true;
    render(<Line {...HOST} linked="91" />);
    await settle();
    fireEvent.click(button('Make the proof'));
    await settle();
    expect(screen.getByRole('alert').textContent).toBe('The shopper’s words and pictures are not on the proof, so it was not made. Reload the page and make it again.');
    expect(made()).toEqual([]);
  });
});

describe('the shop’s one-colour line, for a role that may not read the settings', () => {
  it('says the logo is drawn at the 50% line, not the shop’s, where the design has a one-colour logo', async () => {
    world.closed.add('settings');
    const values = JSON.stringify({ format: 1, parts: { logo: { file: 'logo_file' } } });
    seed('designs', [{ ...world.tables['designs']![0]!, ready_design_id: null, values, logo_file: LOGO }]);
    seed('design_versions', [{ ...world.tables['design_versions']![0]!, values }]);
    render(<Line {...HOST} linked="91" />);
    await settle();
    expect(screen.getByText('The shop’s one-colour line is hidden from you')).toBeTruthy();
    fireEvent.click(button('Make the proof'));
    await settle();
    expect(drawn[0]?.threshold).toBe(50);
  });

  it('says nothing of it where the design has no one-colour picture', async () => {
    world.closed.add('settings');
    render(<Line {...HOST} linked="91" />);
    await settle();
    expect(screen.queryByText('The shop’s one-colour line is hidden from you')).toBeNull();
    expect(button('Make the proof').disabled).toBe(false);
  });
});

describe('a proof that would leave out everything the shopper chose', () => {
  const sheet = (items: FlatSheet['items']): FlatSheet => ({ side: 'front', face: { width: 95, height: 95 } as FlatSheet['face'], items });
  const words = { kind: 'text', code: 'words', lines: [{ text: 'Sam', x: 0, y: 0 }] } as unknown as FlatSheet['items'][number];

  it('is refused where words were chosen and nothing is drawn, never where the shopper chose nothing', async () => {
    const { missesEveryChoice } = await import('./line.tsx');
    expect(missesEveryChoice({ parts: { words: { text: 'Sam' } } }, [sheet([])])).toBe(true);
    expect(missesEveryChoice({ parts: { logo: { file: 'logo_file' } } }, [sheet([])])).toBe(true);
    expect(missesEveryChoice({ parts: { words: { text: 'Sam' } } }, [sheet([words])])).toBe(false);
    expect(missesEveryChoice({ parts: { words: { text: '  ' } } }, [sheet([])])).toBe(false);
    expect(missesEveryChoice({ parts: {} }, [sheet([])])).toBe(false);
    // A design taken into the full editor holds its words in what it placed.
    expect(missesEveryChoice({ parts: {}, placed: [{ id: 't1', kind: 'text', text: 'Wren' }] }, [sheet([])])).toBe(true);
    expect(missesEveryChoice({ parts: {}, placed: [{ id: 's1', kind: 'rect' }] }, [sheet([])])).toBe(false);
  });
});
