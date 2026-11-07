// SPDX-License-Identifier: AGPL-3.0-only
/**
 * "SHOWN IN", AS THIS PAGE TAKES IT FROM THE HOST: the host's parts and hooks
 * when it publishes them (0.3.49 on), and on an older host stand-ins that draw
 * nothing and cut nothing — which is exactly what the host itself does on a
 * server with no workspaces (`scope.active` false).
 *
 * WHY NOT A 0.3.49 FLOOR INSTEAD. A floor at or past 0.3.18 also turns on the
 * validator's page-ref rule, and this page has been addressed as
 * `/add-ons/invoices/documents` since it moved here: raising the floor would
 * mean renaming the page and moving every link and grant to it. Reading the
 * kit off the host keeps the address and installs on every host the add-on
 * already supports; a host without workspaces never had "Shown in" to draw.
 *
 * Each name is chosen ONCE, when the module loads, so a hook is always the
 * same hook for the life of the page (the rules of hooks hold).
 */
import type { ComponentType } from 'react';
import hostApp from '@adminium/add-on-contracts/runtime/app';

/*
 * The shapes, restated: they are `AddOnShownIn…` in @adminium/add-on-contracts
 * from 0.3.49, and this page builds against an older one (whose `app` is an
 * open record), so they are written here. TYPE MIRROR of the contracts'
 * `runtime/app-types.ts`; change both together.
 */

/** Where a document is listed: every workspace (`all`, the default), or the chosen ones (possibly none). */
export interface ShownIn {
  mode: 'all' | 'chosen';
  /** The chosen workspaces; empty for `all`, and for "chosen, none". */
  workspaceIds: string[];
}

export interface ShownInWorkspace {
  id: string;
  name: string;
  initials: string;
  position: number;
}

export interface ShownInScope {
  workspaces: ShownInWorkspace[];
  /** Whether "Shown in" is drawn at all: only when there is a workspace to choose. */
  active: boolean;
  otherDatabases: boolean;
  view: 'one' | 'all';
  /** The tab's workspace (an id, or `~other`); null when the tab is in none. */
  currentWorkspaceId: string | null;
}

export interface ShownInList {
  scope: ShownInScope;
  /** For the list's request, as `?workspaceId=` (it only narrows). */
  workspaceId: string | undefined;
  keeps: (shownIn: ShownIn | undefined) => boolean;
  showColumn: boolean;
  /** The Workspace filter, drawn in All in one menu only; null otherwise. */
  filter: { value: string; onChange: (next: string) => void } | null;
}

export type ShownInPicker = Pick<ShownInList, 'scope' | 'workspaceId' | 'keeps'>;

interface ShownInKit {
  CurrentWorkspaceChip: ComponentType;
  HiddenHereNote: ComponentType<{ shownIn: ShownIn }>;
  ShownInChips: ComponentType<{ shownIn: ShownIn | undefined; className?: string | undefined }>;
  ShownInField: ComponentType<{ value: ShownIn | undefined; save: (next: ShownIn) => Promise<unknown>; disabled?: boolean | undefined; className?: string | undefined }>;
  ShownInHeader: ComponentType;
  WorkspaceFilter: ComponentType<{ value: string; onChange: (next: string) => void }>;
  useShownInList: () => ShownInList;
  useShownInPicker: () => ShownInPicker;
}

const NO_SCOPE: ShownInScope = { workspaces: [], active: false, otherDatabases: false, view: 'one', currentWorkspaceId: null };
const keepsEvery = (): boolean => true;
const NO_LIST: ShownInList = { scope: NO_SCOPE, workspaceId: undefined, keeps: keepsEvery, showColumn: false, filter: null };
const NO_PICKER: ShownInPicker = { scope: NO_SCOPE, workspaceId: undefined, keeps: keepsEvery };
const Nothing = (): null => null;

/** The host's "Shown in", or what a host without it amounts to. Exported for its test. */
export function shownInKit(app: Partial<ShownInKit>): ShownInKit {
  return {
    CurrentWorkspaceChip: app.CurrentWorkspaceChip ?? Nothing,
    HiddenHereNote: app.HiddenHereNote ?? Nothing,
    ShownInChips: app.ShownInChips ?? Nothing,
    ShownInField: app.ShownInField ?? Nothing,
    ShownInHeader: app.ShownInHeader ?? Nothing,
    WorkspaceFilter: app.WorkspaceFilter ?? Nothing,
    useShownInList: app.useShownInList ?? (() => NO_LIST),
    useShownInPicker: app.useShownInPicker ?? (() => NO_PICKER),
  };
}

export const { CurrentWorkspaceChip, HiddenHereNote, ShownInChips, ShownInField, ShownInHeader, WorkspaceFilter, useShownInList, useShownInPicker } = shownInKit(
  hostApp as unknown as Partial<ShownInKit>,
);
