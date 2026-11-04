// @vitest-environment jsdom
/**
 * A CUSTOMER'S LOGO AND PHOTO, AS THEY SEND THEM: picked or dropped, checked
 * by their bytes, read and sent, refused in the customer's words, measured in
 * the browser for the checks at their printed size, placed in their box, and
 * made one colour for the laser.
 *
 * The picture's pixels come from a page that draws (`drawsPictures`): the
 * test page itself draws nothing.
 */
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CustomiserEditor, type CustomiserEditorProps, type DesignData } from './index.ts';
import { drawn, drawsPictures, setWidth, settle, settleUntil } from './testing/render.tsx';
import { stubApi, type Stub } from './testing/stub.ts';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const HEIC = new Uint8Array([0, 0, 0, 24, ...[...'ftypheic'].map((char) => char.charCodeAt(0))]);
let restore: (() => void) | null = null;

afterEach(() => {
  cleanup();
  restore?.();
  restore = null;
});
beforeEach(() => setWidth(1280));

const lastDesign = (spy: ReturnType<typeof vi.fn>): DesignData => (spy.mock.calls.at(-1)![0] as { design: DesignData }).design;

async function ring(stub: Stub, extra: Partial<CustomiserEditorProps> = {}) {
  const onDesignChange = vi.fn();
  await drawn(<CustomiserEditor api={stub.api} base={stub.ids.coasters} product={{ name: 'Engraved walnut coasters' }} shop="Birch Row" featurePrices={{ logo: '+£1.50 a piece' }} onAddToBasket={() => {}} onDesignChange={onDesignChange} {...extra} />);
  fireEvent.click(screen.getByRole('button', { name: /^Customise the Ring design/ }));
  await settle();
  return onDesignChange;
}
async function harbour(stub: Stub, extra: Partial<CustomiserEditorProps> = {}) {
  const onDesignChange = vi.fn();
  await drawn(<CustomiserEditor api={stub.api} base={stub.ids.cards} product={{ name: 'Business cards' }} shop="Marlow Press" sides={2} onAddToBasket={() => {}} onDesignChange={onDesignChange} {...extra} />);
  fireEvent.click(screen.getByRole('button', { name: /^Customise the Harbour design/ }));
  await settle();
  return onDesignChange;
}
/** Pick a file in a part's hidden input (the first, or the one given) and wait until it is taken or refused. */
async function pick(file: File, input = document.querySelector<HTMLInputElement>('input[type="file"]')!): Promise<void> {
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } });
  });
  await settleUntil(() => document.querySelector('[role="progressbar"]') === null && (document.querySelector('.cz-file') !== null || document.querySelector('.cz-error[role="alert"]') !== null));
}
const png = (name = 'logo.png', size?: number): File => {
  const file = new File([PNG], name, { type: 'image/png' });
  if (size !== undefined) Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('sending a logo (BC-B3.upload, BC-B3.progress, MC-B3)', () => {
  it('names the kinds the part takes, so a phone converts what it can, and drops a file on the zone', async () => {
    const stub = stubApi('maker');
    await ring(stub);
    expect(document.querySelector<HTMLInputElement>('input[type="file"]')!.accept).toBe('.png,image/png,.jpg,.jpeg,image/jpeg,.pdf,application/pdf,.svg,image/svg+xml');
    const zone = document.querySelector('.cz-drop')!;
    fireEvent.dragOver(zone);
    expect(zone.className).toContain('cz-drop-over');
    await act(async () => {
      fireEvent.drop(zone, { dataTransfer: { files: [png('dropped.png')] } });
    });
    await settleUntil(() => stub.calls.some((one) => one.call === 'upload'));
    expect(stub.calls.find((one) => one.call === 'upload')!.args).toEqual(['logo_file', 'dropped.png']);
  });

  it('shows the file on its way: read first, then sent', async () => {
    const stub = stubApi('printing');
    await harbour(stub);
    const release = stub.holdUploads();
    await act(async () => {
      fireEvent.change(document.querySelector<HTMLInputElement>('input[type="file"]')!, { target: { files: [png('harbour-loaf.png')] } });
    });
    await settleUntil(() => screen.queryByRole('progressbar', { name: 'Uploading your logo' })?.getAttribute('aria-valuetext') === 'Sending');
    expect(within(screen.getByRole('progressbar')).getByText('harbour-loaf.png')).toBeTruthy();
    release();
    await settleUntil(() => screen.queryByRole('progressbar') === null);
    expect(screen.getAllByText('harbour-loaf.png').length).toBeGreaterThan(0);
    expect(screen.getByRole('radiogroup', { name: 'How the logo sits in its box' })).toBeTruthy();
  });

  it('only for a photo, a PNG or a JPEG, whatever the part says', async () => {
    const stub = stubApi('printing');
    await drawn(<CustomiserEditor api={stub.api} base={stub.ids.cards} product={{ name: 'Business cards' }} shop="Marlow Press" sides={2} onAddToBasket={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /^Customise the Photo back design/ }));
    await settle();
    fireEvent.click(screen.getByRole('radio', { name: 'Back' }));
    const photo = [...document.querySelectorAll<HTMLInputElement>('input[type="file"]')].find((one) => !one.accept.includes('svg'))!;
    expect(photo.accept).toBe('.png,image/png,.jpg,.jpeg,image/jpeg');
    expect(screen.getByText('PNG · JPEG · 10 MB')).toBeTruthy();
  });
});

describe('what a file is refused for, in the customer’s words (BC-B3.refusals, MC-B3.refusals)', () => {
  it('a file of another kind, by its bytes not its name, tied to the button that sent it', async () => {
    const stub = stubApi('maker');
    await ring(stub);
    await pick(new File(['just words'], 'logo.png', { type: 'image/png' }));
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('That isn’t an SVG, PDF, PNG or JPEG');
    expect(screen.getByRole('button', { name: 'Upload your logo' }).getAttribute('aria-describedby')).toBe(alert.id);
    expect(stub.calls.some((one) => one.call === 'upload')).toBe(false);
  });

  it('an iPhone photo: save it as JPEG or PNG', async () => {
    const stub = stubApi('maker');
    await ring(stub);
    await pick(new File([HEIC], 'IMG_0042.heic', { type: 'image/heic' }));
    expect(screen.getByRole('alert').textContent).toBe('That photo is in HEIC, which we can’t print from. Save it as JPEG or PNG and upload it again.');
  });

  it('a file over 10 MB, before it is sent', async () => {
    const stub = stubApi('maker');
    await ring(stub);
    await pick(png('huge.png', 10 * 1024 * 1024 + 1));
    expect(screen.getByRole('alert').textContent).toBe('That file is over 10 MB');
    expect(stub.calls.some((one) => one.call === 'upload')).toBe(false);
  });

  it('an SVG the server’s cleaner will not take: its own sentence, and save it as a plain SVG', async () => {
    const stub = stubApi('printing');
    await harbour(stub);
    stub.failNextUpload(Object.assign(new Error('This SVG has a <script>, which is not taken. Save it as a plain SVG and upload it again.'), { code: 'PUBLIC_UPLOAD_REFUSED', params: { reason: 'kind' } }));
    await pick(new File(['<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'], 'harbour.svg', { type: 'image/svg+xml' }));
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('This SVG holds something we can’t print from. Save it as a plain SVG and upload it again.');
    expect(within(alert).getByText(/This SVG has a <script>/).getAttribute('lang')).toBe('en');
  });

  it('a day’s files sent, or no room just now: the server’s reasons, said plainly', async () => {
    const stub = stubApi('printing');
    await harbour(stub);
    stub.failNextUpload(Object.assign(new Error('That file was not taken.'), { code: 'PUBLIC_UPLOAD_REFUSED', params: { reason: 'cap' } }));
    await pick(png());
    expect(screen.getByRole('alert').textContent).toBe('You’ve sent as many files as we take in a day. Try again tomorrow.');
    stub.failNextUpload(Object.assign(new Error('That file was not taken.'), { code: 'PUBLIC_UPLOAD_REFUSED', params: { reason: 'quota' } }));
    await pick(png());
    expect(screen.getByRole('alert').textContent).toBe('We can’t take files just now. Try again later.');
    stub.failNextUpload(Object.assign(new Error('That file was not taken.'), { code: 'PUBLIC_UPLOAD_REFUSED', params: { reason: 'too-big' } }));
    await pick(png());
    expect(screen.getByRole('alert').textContent).toBe('That file is over 10 MB');
  });
});

describe('a picture checked at its printed size (MC-0.LOGO.blurry, MC-B6c, BC-F11)', () => {
  it('a logo of 96 × 64 px in a 20 mm box: 122 dpi where the shop needs 150 — told, never held', async () => {
    restore = drawsPictures([96, 64]);
    const stub = stubApi('printing');
    const changes = await harbour(stub);
    await pick(png('harbour-logo-small.png'));
    // At the field, with its arithmetic, and in the checks.
    expect(screen.getAllByText('Your logo may print blurry at this size — a bigger file or an SVG will be sharper')).toHaveLength(2);
    expect(screen.getByText('96 × 64 px is 122 dpi at 20 × 20 mm — we need 150.')).toBeTruthy();
    expect(screen.getByText('PNG · 96 × 64 px · 1 KB')).toBeTruthy();
    // The picture is drawn in its box, from its address in this page, never its markup.
    expect(document.querySelector('.cz-stage image')?.getAttribute('href')).toMatch(/^blob:/);
    expect(lastDesign(changes).values.parts['logo']).toEqual({ file: 'logo_file' });
  });

  it('reads the sharpness the shop asks for from its settings: at 300 dpi a 200 px logo across 20 mm (254 dpi) is blurry', async () => {
    restore = drawsPictures([200, 150]);
    const stub = stubApi('printing', { settings: [{ min_dpi: 300, smallest_line_mm: 0.2, one_colour_threshold: 50 }] });
    await harbour(stub);
    await pick(png());
    expect(screen.getByText('200 × 150 px is 254 dpi at 20 × 20 mm — we need 300.')).toBeTruthy();
  });

  it('places a logo in its box: fit inside or fill, nudged, sized from 30 to 100 per cent, its size across in mm', async () => {
    restore = drawsPictures([400, 400]);
    const stub = stubApi('maker');
    const changes = await ring(stub);
    await pick(png('pinfold.png'));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Make it one colour' })).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Fill' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nudge right' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nudge up' }));
    expect(lastDesign(changes).values.parts['logo']).toMatchObject({ file: 'logo_file', fit: 'fill', nx: 1, ny: -1 });
    const size = screen.getByRole('slider');
    expect(size.getAttribute('aria-valuetext')).toBe('36.1 mm across');
    fireEvent.change(size, { target: { value: '40' } });
    expect(screen.getByText('14.4 mm across', { selector: '.cz-scale .cz-mono' })).toBeTruthy();
    // Under 15 mm across an engraved logo is too small to read: told, not held.
    expect(screen.getAllByText('Your logo will be 14.4 mm across — too small to read').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Centre it' }));
    expect(lastDesign(changes).values.parts['logo']).toMatchObject({ nx: 0, ny: 0, scale: 40 });
  });

  it('opens a saved design’s logo again through its own link, and draws it', async () => {
    restore = drawsPictures([200, 200]);
    const stub = stubApi('maker');
    const sent = await stub.api.upload!('logo_file', new Blob([PNG], { type: 'image/png' }), 'mine.png', null);
    const saved = await stub.api.create({ base_id: stub.ids.coasters, ready_design_id: stub.ids.ring, values: { parts: { logo: { file: 'logo_file' } } } }, null, { logo_file: sent.id });
    await drawn(<CustomiserEditor api={stub.api} base={stub.ids.coasters} product={{ name: 'Engraved walnut coasters' }} design={saved} onAddToBasket={() => {}} />);
    await settleUntil(() => document.querySelector('.cz-stage image') !== null);
    expect(stub.calls.filter((one) => one.call === 'file').map((one) => one.args)).toEqual([[saved.id, 'logo_file']]);
    expect(screen.getByText('Kept with your design')).toBeTruthy();
    expect(screen.getByText('PNG · 1 KB')).toBeTruthy();
  });
});

describe('“Make it one colour” for the laser (BC-B3.onecolour, BC-B7e, BC-0.LOGO)', () => {
  // A bold block, and hatching of 1 px lines in a grey of 74 % across the rest: the comp's Old Mill art.
  const mill = (x: number, y: number): number => (x < 150 && y < 150 ? 0 : x >= 200 && x % 4 === 0 ? Math.round(0.74 * 255) : 255);

  it('opens by itself once the logo is in, says what the laser does, and warns of lines too fine where the line takes the shading', async () => {
    restore = drawsPictures([400, 200], mill);
    const stub = stubApi('maker');
    const changes = await ring(stub);
    await pick(png('old-mill.png'));
    expect(screen.getByText('Your logo is in. Check how it engraves.')).toBeTruthy();
    const sheet = screen.getByRole('dialog', { name: 'Make it one colour' });
    expect(sheet.textContent).toContain('The laser cuts one colour. Everything darker than the line you set is engraved; everything lighter is left as walnut.');
    expect(within(sheet).getByRole('img', { name: 'Your logo engraved in walnut' })).toBeTruthy();
    const line = within(sheet).getByRole('slider');
    expect(line.getAttribute('value')).toBe('50');
    expect(within(sheet).queryByRole('alert')).toBeNull();
    // The line past the shading's tone: the hatching engraves, and at 36 mm across its lines are 0.09 mm.
    fireEvent.change(line, { target: { value: '82' } });
    expect(within(sheet).getByRole('alert').textContent).toContain('Some lines are too fine to engrave — they may disappear');
    expect(line.getAttribute('aria-describedby')).toBe('cz-oc-warn');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Use this' }));
    expect(screen.getByText('Set to engrave in one colour.')).toBeTruthy();
    expect(lastDesign(changes).values.parts['logo']).toMatchObject({ threshold: 82 });
    expect(screen.getByText('Some lines may be too fine')).toBeTruthy();
    expect(document.querySelector('.cz-checks')!.textContent).toContain('Some lines in your logo are too fine to engrave — they may disappear');
  });

  it('puts the line back where it was on Cancel, leaving nothing to undo', async () => {
    restore = drawsPictures([400, 200], mill);
    const stub = stubApi('maker');
    const changes = await ring(stub);
    await pick(png('old-mill.png'));
    const sheet = screen.getByRole('dialog', { name: 'Make it one colour' });
    fireEvent.change(within(sheet).getByRole('slider'), { target: { value: '90' } });
    fireEvent.change(within(sheet).getByRole('slider'), { target: { value: '70' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    expect(lastDesign(changes).values.parts['logo']!.threshold).toBeUndefined();
    // One undo takes back the logo itself, not a step of the line.
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(lastDesign(changes).values.parts['logo']).toBeUndefined();
  });

  it('starts the line where the shop’s settings start it', async () => {
    restore = drawsPictures([400, 200], mill);
    const stub = stubApi('maker', { settings: [{ min_dpi: 150, smallest_line_mm: 0.2, one_colour_threshold: 80 }] });
    await ring(stub);
    await pick(png('old-mill.png'));
    expect(within(screen.getByRole('dialog', { name: 'Make it one colour' })).getByRole('slider').getAttribute('value')).toBe('80');
    expect(within(screen.getByRole('dialog', { name: 'Make it one colour' })).getByRole('alert')).toBeTruthy();
  });

  it('a PDF: its fine detail is checked again when the proof is made', async () => {
    const stub = stubApi('maker');
    await ring(stub);
    await pick(new File(['%PDF-1.7\n/MediaBox [0 0 200 200]'], 'logo.pdf', { type: 'application/pdf' }));
    expect(within(screen.getByRole('dialog', { name: 'Make it one colour' })).getByText('We check fine detail again when we make your proof.')).toBeTruthy();
  });

  it('is never offered for a photo on a printed card', async () => {
    restore = drawsPictures([1800, 1240]);
    const stub = stubApi('printing');
    await harbour(stub);
    await pick(png());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Make it one colour' })).toBeNull();
  });
});
