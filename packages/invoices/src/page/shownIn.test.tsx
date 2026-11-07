// SPDX-License-Identifier: AGPL-3.0-only
/**
 * @vitest-environment happy-dom
 *
 * "SHOWN IN" on the invoices page: where a template or an invoice is listed,
 * drawn with the host's own parts. On a server with no workspaces the page
 * draws none of it and sends no `workspaceId`; with workspaces the list is cut
 * to the tab's workspace (One at a time) or to the toolbar's Workspace filter
 * (All in one menu), each row and card says where it is listed, the New
 * modal offers only the templates listed here, and the editor writes a change
 * at once with a PATCH of `{ shownIn }` and says when the document is not
 * listed in the tab's workspace.
 */
import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import InvoicesAddOnPage from './index.js';
import type { InvoiceDetail, InvoiceDocumentKind, InvoiceSummary, ShownIn } from './api.js';
import { emptyBody } from './model/envelope.js';
import { jsonResponse, mountPage } from './testing/harness.js';
import { setShownInScope, type TestShownInScope } from './testing/host.js';
import { shownInKit } from './shownIn.js';

const HOST_PATH = '/add-ons/invoices/documents';

class FakeWebSocket {
  onopen: (() => void) | null = null;
  onmessage: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 0;
  send(): void {}
  close(): void {}
}

const NORTH = { id: 'ws_north', name: 'North shop', initials: 'NS', position: 0 };
const SOUTH = { id: 'ws_south', name: 'South shop', initials: 'SS', position: 1 };

function scope(over: Partial<TestShownInScope> = {}): TestShownInScope {
  return { workspaces: [NORTH, SOUTH], active: true, otherDatabases: false, view: 'one', currentWorkspaceId: NORTH.id, ...over };
}

const ALL: ShownIn = { mode: 'all', workspaceIds: [] };

function summary(kind: InvoiceDocumentKind, id: string, name: string, shownIn: ShownIn): InvoiceSummary {
  return {
    id,
    kind,
    name,
    status: 'live',
    topic: 'services',
    lang: 'en',
    starter: null,
    originId: null,
    createdAt: 1,
    updatedAt: Date.now() - 3_600_000,
    summary: {
      number: 'INV-1',
      customerName: 'Globex',
      title: 'INVOICE',
      logoText: 'Northwind',
      logoIcon: 'hexagon',
      accent: '#4f46e5',
      currency: '$',
      cents: true,
      totalMinor: 10_000,
      itemCount: 1,
    },
    shownIn,
  };
}

function detailOf(doc: InvoiceSummary): InvoiceDetail {
  return { ...doc, body: emptyBody(), languages: [{ id: doc.id, lang: doc.lang, name: doc.name, status: doc.status }] };
}

const TEMPLATES = [
  summary('template', 'tpl_all', 'Standard invoice', ALL),
  summary('template', 'tpl_north', 'North invoice', { mode: 'chosen', workspaceIds: [NORTH.id] }),
  summary('template', 'tpl_south', 'South invoice', { mode: 'chosen', workspaceIds: [SOUTH.id] }),
];

interface Call {
  method: string;
  url: string;
  body: unknown;
}

/** The server's cut: `?workspaceId=` keeps what is shown in all, or chosen there. */
function stubFetch(templates: InvoiceSummary[] = TEMPLATES) {
  const calls: Call[] = [];
  const rows = templates.map((doc) => ({ ...doc }));
  const fetchMock = vi.fn().mockImplementation((input: unknown, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
    calls.push({ method, url, body });
    if (method === 'GET' && (url === '/api/v1/invoices' || url.startsWith('/api/v1/invoices?'))) {
      const query = new URL(url, 'http://test').searchParams;
      const where = query.get('workspaceId');
      const kind = query.get('kind');
      const items = rows
        .filter((doc) => kind === null || doc.kind === kind)
        .filter((doc) => where === null || doc.shownIn?.mode !== 'chosen' || doc.shownIn.workspaceIds.includes(where));
      return Promise.resolve(jsonResponse(200, { items, counts: { template: items.length, invoice: 0 } }));
    }
    if (url === '/api/v1/invoices/starters') return Promise.resolve(jsonResponse(200, { starters: [] }));
    const one = /^\/api\/v1\/invoices\/([^/?]+)$/.exec(url);
    const found = rows.find((doc) => doc.id === one?.[1]);
    if (one !== null && found !== undefined && method === 'GET') return Promise.resolve(jsonResponse(200, detailOf(found)));
    if (one !== null && found !== undefined && method === 'PATCH') {
      // The reply is a SUMMARY, not a detail: the page must not take it for the whole document.
      Object.assign(found, body as object);
      return Promise.resolve(jsonResponse(200, { ...found }));
    }
    return Promise.resolve(jsonResponse(404, { error: { code: 'NOT_FOUND', message: `no route: ${method} ${url}` } }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls };
}

async function renderManager(path = HOST_PATH) {
  vi.stubGlobal('WebSocket', FakeWebSocket);
  const stub = stubFetch();
  mountPage(<InvoicesAddOnPage />, path);
  await screen.findByTestId('invoices-toolbar');
  await waitFor(() => {
    expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull();
  });
  return { ...stub, user: userEvent.setup() };
}

async function renderEditor(id: string) {
  vi.stubGlobal('WebSocket', FakeWebSocket);
  const stub = stubFetch();
  mountPage(<InvoicesAddOnPage />, `${HOST_PATH}/${id}`);
  await screen.findByTestId('invoices-editor-header');
  return { ...stub, user: userEvent.setup() };
}

const listCalls = (calls: Call[]) => calls.filter((call) => call.method === 'GET' && call.url.startsWith('/api/v1/invoices?'));
const cardNames = () => screen.getAllByTestId('invoices-card-name').map((el) => el.textContent);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
  // The host's own setup puts the scope back AFTER it unmounts the page: done here, it would
  // re-cut a list still on screen and send its request past the stubbed fetch.
});

describe('Shown in — a server with no workspaces', () => {
  it('draws none of it and sends no workspaceId', async () => {
    const { calls } = await renderManager();
    expect(cardNames()).toEqual(['Standard invoice', 'North invoice', 'South invoice']);
    expect(screen.queryByTestId('shown-in-all')).toBeNull();
    expect(screen.queryByTestId('shown-in-chips')).toBeNull();
    expect(screen.queryByTestId('workspace-filter')).toBeNull();
    expect(screen.queryByTestId('current-workspace-chip')).toBeNull();
    expect(listCalls(calls).every((call) => !call.url.includes('workspaceId'))).toBe(true);
  });

  it('the editor draws no control', async () => {
    await renderEditor('tpl_north');
    expect(screen.queryByTestId('invoices-shown-in')).toBeNull();
    expect(screen.queryByTestId('shown-in-control')).toBeNull();
  });
});

describe('Shown in — One at a time', () => {
  it("cuts the list to the tab's workspace, sends it as ?workspaceId=, and shows its chip", async () => {
    setShownInScope(scope());
    const { calls } = await renderManager();
    expect(cardNames()).toEqual(['Standard invoice', 'North invoice']);
    expect(listCalls(calls).at(-1)?.url).toBe('/api/v1/invoices?kind=template&workspaceId=ws_north');
    expect(screen.getByTestId('current-workspace-chip').textContent).toBe('North shop');
    // One at a time follows the tab: no filter of the list's own.
    expect(screen.queryByTestId('workspace-filter')).toBeNull();
  });

  it('each card says where it is listed', async () => {
    setShownInScope(scope());
    await renderManager();
    const cards = screen.getAllByTestId('invoices-card');
    expect(within(cards[0] as HTMLElement).getByTestId('shown-in-all').textContent).toBe('All workspaces');
    expect(within(cards[1] as HTMLElement).getByTestId('shown-in-chips').textContent).toBe('North shop');
  });

  it('the list layout adds a Shown in column before Updated', async () => {
    setShownInScope(scope());
    const { user } = await renderManager();
    await user.click(screen.getByRole('radio', { name: 'List' }));
    const headers = screen.getAllByRole('columnheader').map((el) => el.textContent);
    expect(headers).toEqual(['Name', 'Status', 'Shown in', 'Updated', 'Actions']);
    const rows = screen.getAllByTestId('invoices-row');
    expect(within(rows[1] as HTMLElement).getByTestId('invoices-row-shown-in').textContent).toBe('North shop');
  });

  it("'Other databases' is cut here, keeping only what is shown in all", async () => {
    setShownInScope(scope({ currentWorkspaceId: '~other', otherDatabases: true }));
    const { calls } = await renderManager();
    expect(cardNames()).toEqual(['Standard invoice']);
    expect(listCalls(calls).every((call) => !call.url.includes('workspaceId'))).toBe(true);
  });
});

describe('Shown in — All in one menu', () => {
  it('draws the Workspace filter, which starts at every workspace and narrows on a pick', async () => {
    setShownInScope(scope({ view: 'all', currentWorkspaceId: null }));
    const { calls, user } = await renderManager();
    expect(cardNames()).toEqual(['Standard invoice', 'North invoice', 'South invoice']);
    expect(screen.queryByTestId('current-workspace-chip')).toBeNull();
    const filter = within(screen.getByTestId('workspace-filter')).getByRole('combobox');
    await user.selectOptions(filter, SOUTH.id);
    await waitFor(() => {
      expect(cardNames()).toEqual(['Standard invoice', 'South invoice']);
    });
    expect(listCalls(calls).at(-1)?.url).toBe('/api/v1/invoices?kind=template&workspaceId=ws_south');
  });
});

describe('Shown in — the New modal', () => {
  it("offers only the templates listed in the tab's workspace", async () => {
    setShownInScope(scope({ currentWorkspaceId: SOUTH.id }));
    const { calls, user } = await renderManager(`${HOST_PATH}?kind=invoice`);
    await user.click(screen.getByTestId('invoices-new'));
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => {
      expect(within(dialog).getByText('South invoice')).toBeDefined();
    });
    expect(within(dialog).getByText('Standard invoice')).toBeDefined();
    expect(within(dialog).queryByText('North invoice')).toBeNull();
    expect(calls.some((call) => call.url === '/api/v1/invoices?kind=template&workspaceId=ws_south')).toBe(true);
  });
});

describe('Shown in — the editor', () => {
  it('writes each change at once with a PATCH of { shownIn }, apart from the Save', async () => {
    setShownInScope(scope());
    const { calls, user } = await renderEditor('tpl_all');
    // The inspector is drawn twice (the aside, and the drawer below `lg`): the first is the aside.
    const [field] = await screen.findAllByTestId('invoices-shown-in');
    if (field === undefined) throw new Error('no Shown in');
    const boxes = within(field).getAllByTestId('shown-in-workspace');
    await user.click(boxes[1] as HTMLElement);
    await waitFor(() => {
      expect(calls.filter((call) => call.method === 'PATCH')).toEqual([
        { method: 'PATCH', url: '/api/v1/invoices/tpl_all', body: { shownIn: { mode: 'chosen', workspaceIds: [SOUTH.id] } } },
      ]);
    });
    expect(calls.some((call) => call.method === 'PUT')).toBe(false);
    // Now listed only in South: the note says it is not listed in North, and where it is.
    const [note] = await screen.findAllByTestId('shown-in-hidden-note');
    if (note === undefined) throw new Error('no note');
    expect(within(note).getByTestId('shown-in-chips').textContent).toBe('South shop');
    // The summary the PATCH answered with did not replace the document.
    expect((screen.getByTestId('invoices-editor-name') as HTMLInputElement).value).toBe('Standard invoice');
  });

  it("says when the document is not listed in the tab's workspace", async () => {
    setShownInScope(scope());
    await renderEditor('tpl_south');
    const [note] = await screen.findAllByTestId('shown-in-hidden-note');
    if (note === undefined) throw new Error('no note');
    expect(within(note).getByTestId('shown-in-chips').textContent).toBe('South shop');
  });

  it('draws no note for a document listed here', async () => {
    setShownInScope(scope());
    await renderEditor('tpl_north');
    await screen.findAllByTestId('shown-in-control');
    expect(screen.queryByTestId('shown-in-hidden-note')).toBeNull();
  });
});

describe('Shown in — a host before 0.3.49', () => {
  it('stands in with parts that draw nothing and cuts that keep every row', () => {
    const kit = shownInKit({});
    const draw = (part: unknown, props: object): unknown => (part as (props: object) => unknown)(props);
    expect(draw(kit.ShownInChips, { shownIn: undefined })).toBeNull();
    expect(draw(kit.CurrentWorkspaceChip, {})).toBeNull();
    expect(draw(kit.HiddenHereNote, { shownIn: ALL })).toBeNull();
    const list = kit.useShownInList();
    expect(list.scope.active).toBe(false);
    expect(list.showColumn).toBe(false);
    expect(list.filter).toBeNull();
    expect(list.workspaceId).toBeUndefined();
    expect(list.keeps({ mode: 'chosen', workspaceIds: [] })).toBe(true);
    expect(kit.useShownInPicker().keeps({ mode: 'chosen', workspaceIds: [] })).toBe(true);
  });
});
