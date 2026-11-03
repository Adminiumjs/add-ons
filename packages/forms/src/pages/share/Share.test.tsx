// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formRow } from '../testing/rows.ts';
import { Refused, resetWorld, seed, world } from '../testing/host.tsx';
import Forms from '../forms/index.tsx';
import { decodeSvg } from './testing/decode.ts';
import { qrOf } from './qr.ts';

const ORIGIN = 'https://crm.meridian.example';
const LINK = `${ORIGIN}/x/forms/showroom-visit`;
const LOADER = `<${'scr'}ipt src="${ORIGIN}/x/embed.js" async></${'scr'}ipt>`;
const PLACE = '<div data-adminium-form="showroom-visit"></div>';

type Status = { publicOrigin: string | null; websites: string[]; reach: string };
const status = (more: Partial<Status> = {}): Status => ({ publicOrigin: ORIGIN, websites: ['https://www.meridian.example', 'https://shop.meridian.example'], reach: 'reachable', ...more });

/** Answers the status read with this; every other route as `others` says. */
function serve(said: Status | (() => unknown), others: (method: string, path: string) => unknown = () => ({})): void {
  world.api = (method, path) => {
    if (method === 'get' && path === '/api/v1/forms/status') {
      if (typeof said === 'function') return said();
      return { data: { mail: { sends: true, blocked: null }, reach: { state: said.reach }, notice: true, publicOrigin: said.publicOrigin, websites: said.websites, roles: [] } };
    }
    return others(method, path);
  };
}

let written: string[] = [];
let writeText: (text: string) => Promise<void> = async (text) => void written.push(text);
const toastTitles = (): string[] => world.toasts.map((toast) => String(toast.title));
const card = (title: string): HTMLElement => screen.getByText(title, { selector: '[data-slot="title"] *' }).closest('[data-part="card"]') as HTMLElement;
const open = async (splat = 'forms/showroom-visit/share'): Promise<void> => {
  world.splat = splat;
  render(<Forms />);
  await screen.findByTestId('share');
};

beforeEach(() => {
  resetWorld();
  written = [];
  writeText = async (text) => void written.push(text);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (text: string) => writeText(text) } });
  world.has = { 'system:settings:manage': true };
  seed('forms', [
    formRow(1, { slug: 'showroom-visit', title: 'Book a showroom visit' }),
    formRow(2, { slug: 'trade-show', state: 'draft', title: 'Trade show enquiry' }),
    formRow(3, { slug: 'fit-out', kind: 'survey', title: 'How did your fit-out go?', settings: { survey: { mode: 'named', linkNames: true } } }),
    formRow(4, { slug: 'quick', kind: 'survey', title: 'Quick feedback', settings: { survey: { mode: 'anonymous', linkNames: false } } }),
    formRow(5, { slug: 'next-year', kind: 'survey', state: 'draft', title: 'Next year', settings: { survey: { mode: 'named', linkNames: true } } }),
  ]);
  seed('invitations', [
    { id: 1, form_id: 3, email: 'a@meridian.example', rule_name: 'Ask about the fit-out' },
    { id: 2, form_id: 3, email: 'b@meridian.example', rule_name: 'Ask about the fit-out' },
    { id: 3, form_id: 4, email: null, rule_name: 'Thank-you mail' },
    { id: 4, form_id: 1, email: null, rule_name: null },
  ]);
  serve(status());
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('a form’s link', () => {
  it('is the form’s own address on the server’s public address, read only, left to right, with the comp’s note', async () => {
    await open();
    const field = screen.getByRole('textbox', { name: 'Link to the form' }) as HTMLInputElement;
    expect(field.value).toBe(LINK);
    expect(field.readOnly).toBe(true);
    expect(field.getAttribute('dir')).toBe('ltr');
    expect(screen.getByText("Anyone with the link can open the form while it's live.")).toBeTruthy();
    // It asked Adminium once, by the status read.
    expect(world.calls.filter((call) => call.kind === 'api').map((call) => call.table)).toEqual(['get /api/v1/forms/status']);
  });

  it('copies, and says so', async () => {
    await open();
    fireEvent.click(within(card('Link')).getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(toastTitles()).toEqual(['Link copied.']));
    expect(written).toEqual([LINK]);
  });

  it('says how to copy it by hand when the browser refuses, or has no clipboard', async () => {
    writeText = () => Promise.reject(new Error('denied'));
    await open();
    fireEvent.click(within(card('Link')).getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(toastTitles()).toEqual(["Couldn't copy. Select the text and copy it yourself."]));
    expect(world.toasts[0]?.variant).toBe('error');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    fireEvent.click(within(card('Link')).getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(toastTitles()).toHaveLength(2));
    expect(toastTitles()[1]).toBe("Couldn't copy. Select the text and copy it yourself.");
  });

  it('of a draft says it works once published', async () => {
    await open('forms/trade-show/share');
    expect((screen.getByRole('textbox', { name: 'Link to the form' }) as HTMLInputElement).value).toBe(`${ORIGIN}/x/forms/trade-show`);
    expect(screen.getByText('The link works once the form is published.')).toBeTruthy();
    expect(screen.queryByText("Anyone with the link can open the form while it's live.")).toBeNull();
  });

  it('is empty with no public address, says why and where it is set, and offers nothing that needs one', async () => {
    serve(status({ publicOrigin: null, websites: [], reach: 'not-set' }));
    await open();
    expect((screen.getByRole('textbox', { name: 'Link to the form' }) as HTMLInputElement).value).toBe('');
    expect((within(card('Link')).getByRole('button', { name: 'Copy' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('This server has no public address yet, so the form has no link.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Set the public address' }).getAttribute('href')).toBe('/studio/settings#email-link-origin');
    for (const gone of ['Put it on your website', 'QR code', 'Send by e-mail']) expect(screen.queryByText(gone)).toBeNull();
  });

  it('asks a reader who may not set the address to ask whoever runs Adminium', async () => {
    world.has = {};
    serve(status({ publicOrigin: null, websites: [], reach: 'not-set' }));
    await open();
    expect(screen.queryByRole('link', { name: 'Set the public address' })).toBeNull();
    expect(screen.getByText('Ask whoever runs Adminium to set it.')).toBeTruthy();
  });

  it('says why visitors cannot open it, worded from the reach answer', async () => {
    const said = async (reach: string, origin = ORIGIN): Promise<string> => {
      cleanup();
      serve(status({ reach, publicOrigin: origin }));
      await open();
      return within(card('Link')).getByRole('status').textContent ?? '';
    };
    expect(await said('proxy-hidden')).toContain('behind a proxy that hides their addresses');
    expect(await said('private-network', 'https://10.0.0.4')).toContain("the server's public address must be an https address on the internet");
    expect(await said('this-computer', 'https://localhost:4600')).toContain('Set the public address');
    expect(await said('desktop')).toContain("This server doesn't serve public pages");
    cleanup();
    serve(status());
    await open();
    expect(within(card('Link')).queryByRole('status')).toBeNull();
  });

  it('refused or failed status read: says so, and reads again on "Try again"', async () => {
    let tries = 0;
    serve(() => {
      tries += 1;
      if (tries === 1) throw new Refused('FORBIDDEN');
      return { data: { reach: { state: 'reachable' }, publicOrigin: ORIGIN, websites: [] } };
    });
    world.splat = 'forms/showroom-visit/share';
    render(<Forms />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('This could not be loaded');
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    await screen.findByTestId('share');
    expect(tries).toBe(2);
  });
});

describe('putting it on a website', () => {
  it('draws the two lines, each copied with its own name and toast', async () => {
    await open();
    const box = card('Put it on your website');
    expect(within(box).getByText(LOADER).getAttribute('dir')).toBe('ltr');
    expect(within(box).getByText(PLACE)).toBeTruthy();
    fireEvent.click(within(box).getByRole('button', { name: 'Copy the loader line' }));
    await waitFor(() => expect(toastTitles()).toEqual(['Loader line copied.']));
    fireEvent.click(within(box).getByRole('button', { name: 'Copy the form line' }));
    await waitFor(() => expect(toastTitles()).toEqual(['Loader line copied.', 'Form line copied.']));
    expect(written).toEqual([LOADER, PLACE]);
  });

  it('lists the websites it shows on by their hosts, or says none is listed', async () => {
    await open();
    expect(within(screen.getByTestId('share-shows-on')).getByText('www.meridian.example')).toBeTruthy();
    expect(within(screen.getByTestId('share-shows-on')).getByText('shop.meridian.example')).toBeTruthy();
    cleanup();
    serve(status({ websites: [] }));
    await open();
    expect(within(screen.getByTestId('share-shows-on')).getByText('No website is listed yet.')).toBeTruthy();
  });

  it('checks a website typed in, as the Privacy page’s list does', async () => {
    await open();
    const field = screen.getByLabelText('Check a website');
    const answer = (): string => within(card('Put it on your website')).queryByRole('status')?.textContent ?? '';
    fireEvent.change(field, { target: { value: 'shop.meridian.example' } });
    expect(answer()).toBe('shop.meridian.example is one of your websites. The form shows there.');
    expect(within(card('Put it on your website')).getByRole('status').getAttribute('data-tone')).toBe('pos');
    // A path after the host is let go of: a website is its origin.
    fireEvent.change(field, { target: { value: 'https://WWW.meridian.example/events/?x=1' } });
    expect(answer()).toBe('www.meridian.example is one of your websites. The form shows there.');
    fireEvent.change(field, { target: { value: 'events.meridian.example' } });
    expect(answer()).toBe("events.meridian.example isn't one of your websites: add it in Privacy & public pages.");
    expect(within(card('Put it on your website')).getByRole('link', { name: 'Privacy & public pages' }).getAttribute('href')).toBe('/studio/privacy?tab=websites');
    fireEvent.change(field, { target: { value: 'http://shop.meridian.example' } });
    expect(answer()).toBe('Only a website on https:// can show the form.');
    fireEvent.change(field, { target: { value: 'not a website' } });
    expect(answer()).toBe("That isn't a website address.");
    fireEvent.change(field, { target: { value: 'crm.meridian.example' } });
    expect(answer()).toBe("crm.meridian.example is this server's own address: the form's link opens there.");
    fireEvent.change(field, { target: { value: '   ' } });
    expect(answer()).toBe('');
  });
});

describe('the QR code', () => {
  it('is the link’s code on a white frame, and decodes back to the link', async () => {
    await open();
    const picture = screen.getByRole('img', { name: `QR code for ${LINK}` }) as HTMLImageElement;
    expect(picture.getAttribute('width')).toBe('176');
    // White in a dark theme too: the frame is white, never a surface colour.
    expect(picture.parentElement?.className).toContain('bg-white');
    const svg = decodeURIComponent(picture.getAttribute('src')!.replace(/^data:image\/svg\+xml;charset=utf-8,/, ''));
    expect(decodeSvg(svg)).toBe(LINK);
  });

  it('downloads as an SVG named after the form', async () => {
    const saved: { name: string; type: string }[] = [];
    const blobs = new Map<string, Blob>();
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      const url = `blob:${String(blobs.size)}`;
      blobs.set(url, blob as Blob);
      return url;
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      saved.push({ name: this.download, type: blobs.get(this.getAttribute('href') ?? '')?.type ?? '' });
    });
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Download SVG' }));
    expect(saved).toEqual([{ name: 'showroom-visit-qr.svg', type: 'image/svg+xml' }]);
    expect(toastTitles()).toEqual(['Downloading showroom-visit-qr.svg']);
    const svg = await [...blobs.values()][0]!.text();
    expect(decodeSvg(svg)).toBe(LINK);
  });

  it('downloads as a PNG drawn from that SVG on a canvas, 12 pixels a module', async () => {
    const saved: string[] = [];
    const drawn: { width: number; picture: string }[] = [];
    const urls = new Map<string, Blob>();
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      const url = `blob:${String(urls.size)}`;
      urls.set(url, blob as Blob);
      return url;
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      saved.push(`${this.download} ${urls.get(this.getAttribute('href') ?? '')?.type ?? ''}`);
    });
    vi.stubGlobal(
      'Image',
      class {
        onload: (() => void) | null = null;
        src = '';
        constructor() {
          queueMicrotask(() => this.onload?.());
        }
      },
    );
    const make = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (tag !== 'canvas') return make(tag);
      const canvas = { width: 0, height: 0 } as { width: number; height: number; getContext: () => unknown; toBlob: (done: (blob: Blob) => void) => void };
      canvas.getContext = () => ({ fillRect: () => undefined, drawImage: (picture: { src: string }) => drawn.push({ width: canvas.width, picture: urls.get(picture.src)?.type ?? '' }) });
      canvas.toBlob = (done) => done(new Blob(['png'], { type: 'image/png' }));
      return canvas;
    }) as typeof document.createElement);
    await open();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Download PNG' }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(drawn).toEqual([{ width: qrOf(LINK)!.modules * 12, picture: 'image/svg+xml' }]);
    expect(saved).toEqual(['showroom-visit-qr.png image/png']);
    expect(toastTitles()).toEqual(['Downloading showroom-visit-qr.png']);
  });

  it('refuses a link longer than a code carries with a line, not a crash', async () => {
    // 257 bytes of link: the origin takes what the slug's path leaves.
    const origin = `https://${'a'.repeat(257 - 'https://'.length - '.example/x/forms/showroom-visit'.length)}.example`;
    expect(new TextEncoder().encode(`${origin}/x/forms/showroom-visit`).length).toBe(257);
    serve(status({ publicOrigin: origin }));
    await open();
    expect(within(card('QR code')).getByText('This link is too long for a QR code.')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Download PNG' })).toBeNull();
  });
});

describe('sending by e-mail', () => {
  it('opens a new campaign with the link in it', async () => {
    await open();
    expect(within(card('Send by e-mail')).getByText('Opens a new campaign with the link in it. Nothing is sent until you send the campaign.')).toBeTruthy();
    fireEvent.click(within(card('Send by e-mail')).getByRole('button', { name: 'Send by e-mail' }));
    expect(world.navigated).toEqual([{ to: '/email-templates', search: { kind: 'campaign', link: LINK } }]);
  });

  it('is off, with who may send campaigns, for a reader who may not', async () => {
    world.has = {};
    await open();
    const button = within(card('Send by e-mail')).getByRole('button', { name: 'Send by e-mail' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(within(card('Send by e-mail')).getByText("Campaigns are sent by people who may change Adminium's settings. Ask one of them.")).toBeTruthy();
  });

  it('is off for a link a campaign cannot carry', async () => {
    serve(status({ publicOrigin: 'http://crm.meridian.example', reach: 'not-https' }));
    await open();
    expect((within(card('Send by e-mail')).getByRole('button', { name: 'Send by e-mail' }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(card('Send by e-mail')).getByText('A campaign can carry only an https:// link.')).toBeTruthy();
  });
});

describe('a survey’s Share', () => {
  it('that keeps no names: the open link under /x/forms/, its note, and the rule that also mails it', async () => {
    await open('forms/surveys/quick/share');
    expect((screen.getByRole('textbox', { name: 'Link to the survey' }) as HTMLInputElement).value).toBe(`${ORIGIN}/x/forms/quick`);
    expect(screen.getByText('This link takes answers without a name.')).toBeTruthy();
    expect(screen.getByText('Rules that also send it: Thank-you mail.')).toBeTruthy();
    expect(screen.getByText(`<div data-adminium-form="quick"></div>`)).toBeTruthy();
    expect(screen.getByRole('img', { name: `QR code for ${ORIGIN}/x/forms/quick` })).toBeTruthy();
  });

  it('that keeps names: no open link, only the rule that invites each person, opened by its id', async () => {
    serve(status(), (method, path) => (method === 'get' && path === '/api/v1/automations' ? { rules: [{ id: 'r-7', name: 'Ask about the fit-out' }, { id: 'r-8', name: 'Other' }] } : {}));
    await open('forms/surveys/fit-out/share');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByText('Put it on your website')).toBeNull();
    expect(screen.getByText('Survey invitations go out from a rule, so each person gets their own link and shows up under Invitations.')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Open the rule "Ask about the fit-out"' }));
    expect(world.navigated).toEqual([{ to: '/automations', search: { rule: 'r-7' } }]);
    // One button for the rule, however many invitations it made.
    expect(screen.getAllByRole('button', { name: /Open the rule/ })).toHaveLength(1);
  });

  it('that keeps names and no rule has sent yet: a way to make one', async () => {
    serve(status(), (method, path) => (method === 'get' && path === '/api/v1/automations' ? { rules: [] } : {}));
    await open('forms/surveys/next-year/share');
    fireEvent.click(await screen.findByRole('button', { name: 'Make a rule that sends it' }));
    expect(world.navigated).toEqual([{ to: '/automations' }]);
  });

  it('for a reader who may not open the rules: the rule’s name, or whom to ask', async () => {
    serve(status(), (method, path) => {
      if (method === 'get' && path === '/api/v1/automations') throw new Refused('FORBIDDEN');
      return {};
    });
    await open('forms/surveys/fit-out/share');
    expect(await screen.findByText('Sent by the rule "Ask about the fit-out".')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /rule/ })).toBeNull();
    cleanup();
    await open('forms/surveys/next-year/share');
    expect(await screen.findByText('Ask someone who manages automation rules to make one that sends it.')).toBeTruthy();
  });

  it('reads whether a live survey keeps names from what is live, not from its draft', async () => {
    const live = { survey: { mode: 'anonymous', linkNames: false } };
    seed('forms', [{ ...formRow(3, { slug: 'fit-out', kind: 'survey', title: 'Fit-out', settings: { survey: { mode: 'named', linkNames: true } } }), published: JSON.stringify({ definition: {}, settings: live }) }]);
    await open('forms/surveys/fit-out/share');
    expect(screen.getByRole('textbox', { name: 'Link to the survey' })).toBeTruthy();
  });
});

describe('the tab in Arabic, dark and on a phone', () => {
  it('keeps the link, the lines and the code left to right in a right-to-left page, in Arabic words', async () => {
    world.locale = 'ar-EG';
    await open();
    expect(screen.getByRole('textbox', { name: 'رابط النموذج' }).getAttribute('dir')).toBe('ltr');
    expect(screen.getByText(LOADER).getAttribute('dir')).toBe('ltr');
    expect(screen.getByText('www.meridian.example').closest('[dir]')?.getAttribute('dir')).toBe('ltr');
    expect(screen.getByLabelText('التحقق من موقع').getAttribute('dir')).toBe('ltr');
    expect(screen.getByText('ضعه على موقعك')).toBeTruthy();
  });

  it('lays out in one column below the wide screen, and two side by side on it', async () => {
    await open();
    const grid = screen.getByTestId('share');
    expect(grid.className.split(' ')).toEqual(expect.arrayContaining(['grid', 'grid-cols-1', 'lg:grid-cols-[1.4fr_1fr]']));
    expect(grid.children).toHaveLength(2);
  });
});
