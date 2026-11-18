/**
 * ONE PAGE'S EDITOR: its working copy, its history and its autosave.
 *
 * Every part of the editor (the top bar, the canvas, the inspector, the
 * sheets on a phone) edits one working copy: the one held here, by the page's
 * key, for as long as the page is open.
 *
 * AUTOSAVE: each change is kept here at once and written to the page's row
 * once it has been still for {@link SAVE_DELAY_MS}: one write for a burst of
 * typing, never one per key. A change made while a write is out is written
 * after it. Leaving the editor writes what is left at once. Only the working
 * copy is written (`draft`, `name`, `language`): publishing is its own write,
 * and the address is saved on its own, so a clash on it never holds the
 * page's words back.
 *
 * UNDO: the last {@link HISTORY_MAX} changes. Typing into one field is one
 * change until the field has been still for {@link GROUP_MS}, so Undo takes
 * back a word or a sentence, not a letter.
 *
 * Another person's save (the row read again with words this copy never
 * wrote) replaces the copy only while nothing here is waiting to be written.
 */
import { useEffect, useSyncExternalStore } from 'react';

import type { DataValue } from '../shared/host.ts';
import { draftOf, stable, type Page } from './doc.ts';

/** How long a change stays still before it is written: under a second. */
export const SAVE_DELAY_MS = 600;
/** How many changes Undo can take back: the comp's 30. */
export const HISTORY_MAX = 30;
/** How long typing into one field counts as one change. */
export const GROUP_MS = 1200;

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

/** What a change may touch: the page's words and sections, its name and its language. */
export interface Copy {
  page: Page;
  name: string;
  language: string;
}

/** The row the editor opened, as it reads it. */
export interface PageRow {
  key: string;
  name: string;
  slug: string;
  state: 'draft' | 'live' | 'off';
  language: string;
  draft: unknown;
  published: unknown;
  publishedAt: string | null;
}

type Writer = (values: Readonly<Record<string, DataValue>>) => Promise<unknown>;

interface Entry {
  copy: Copy;
  /** The copy as last written (or read), to tell another person's save from our own. */
  base: string;
  /** The row as last seen. */
  seen: string;
  save: SaveState;
  timer: ReturnType<typeof setTimeout> | null;
  writing: Promise<void> | null;
  writer: Writer | null;
  past: Copy[];
  future: Copy[];
  /** The field the last change typed into, and when: the next change to it joins it. */
  group: string | null;
  groupAt: number;
  selected: string | null;
  users: number;
}

const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
let version = 0;
const changed = (): void => {
  version += 1;
  for (const listener of listeners) listener();
};

/** For the screens' own tests: forget every page. */
export function resetEditors(): void {
  for (const entry of entries.values()) if (entry.timer !== null) clearTimeout(entry.timer);
  entries.clear();
  changed();
}

const textOf = (copy: Copy): string => stable({ page: copy.page, name: copy.name, language: copy.language });

/** The copy a row holds. */
export function copyOf(row: PageRow): Copy {
  return { page: draftOf(row.draft, row.name, row.language), name: row.name, language: row.language };
}

/** The values one save writes. */
function valuesOf(copy: Copy): Record<string, DataValue> {
  const name = copy.name.trim().slice(0, 200);
  return { draft: copy.page as unknown as DataValue, language: copy.language, ...(name === '' ? {} : { name }) };
}

async function write(entry: Entry): Promise<void> {
  if (entry.timer !== null) {
    clearTimeout(entry.timer);
    entry.timer = null;
  }
  if (entry.writer === null) return;
  if (entry.writing !== null) {
    await entry.writing;
    return entry.save === 'dirty' ? write(entry) : undefined;
  }
  const sent = textOf(entry.copy);
  const values = valuesOf(entry.copy);
  entry.save = 'saving';
  changed();
  entry.writing = (async () => {
    try {
      await entry.writer?.(values);
      entry.base = sent;
      entry.save = textOf(entry.copy) === sent ? 'saved' : 'dirty';
    } catch {
      entry.save = 'error';
    } finally {
      entry.writing = null;
      changed();
    }
  })();
  await entry.writing;
  // A change made while the write was out is written after it.
  if ((entry.save as SaveState) === 'dirty') schedule(entry);
}

function schedule(entry: Entry): void {
  if (entry.timer !== null) clearTimeout(entry.timer);
  entry.timer = setTimeout(() => void write(entry), SAVE_DELAY_MS);
}

export interface Editing {
  copy: Copy;
  save: SaveState;
  selected: string | null;
  canUndo: boolean;
  canRedo: boolean;
  /**
   * Change the copy; it is written once it has been still a moment. `group`
   * names the field being typed into: changes to one field close together are
   * one step of Undo.
   */
  change: (next: (copy: Copy) => Copy, group?: string) => void;
  undo: () => void;
  redo: () => void;
  select: (id: string | null) => void;
  /** Write whatever waits, now; resolves once it is written (or refused). */
  flush: () => Promise<void>;
  /** The copy just written by another call (publishing, Milo's draft kept): nothing waits for it any more. */
  written: (copy: Copy) => void;
}

/**
 * The editor of one page. Every part that edits it calls this with the row
 * the screen read; the first one makes the working copy from it. `writer` is
 * null for a reader who may not change pages: nothing is ever written then.
 */
export function useEditing(row: PageRow, writer: Writer | null): Editing {
  useSyncExternalStore(
    (listener) => (listeners.add(listener), () => listeners.delete(listener)),
    () => version,
  );
  const read = copyOf(row);
  const rowText = textOf(read);
  let entry = entries.get(row.key);
  if (entry === undefined) {
    entry = { copy: read, base: rowText, seen: rowText, save: 'saved', timer: null, writing: null, writer, past: [], future: [], group: null, groupAt: 0, selected: null, users: 0 };
    entries.set(row.key, entry);
  } else if (rowText !== entry.seen) {
    // The row was read again with something new in it: another person's save, taken while nothing here waits.
    entry.seen = rowText;
    if (rowText !== entry.base && entry.save === 'saved' && entry.timer === null && entry.writing === null) {
      entry.copy = read;
      entry.base = rowText;
    }
  }
  entry.writer = writer;
  const held = entry;

  // The last one to leave the page writes what is left.
  useEffect(() => {
    held.users += 1;
    return () => {
      held.users -= 1;
      if (held.users === 0 && held.timer !== null) void write(held);
    };
  }, [held]);

  const replace = (copy: Copy): void => {
    held.copy = copy;
    held.save = 'dirty';
    schedule(held);
    // A section that is gone cannot stay selected.
    if (held.selected !== null && !copy.page.blocks.some((block) => block.id === held.selected)) held.selected = null;
    changed();
  };

  return {
    copy: held.copy,
    save: held.save,
    selected: held.selected,
    canUndo: held.writer !== null && held.past.length > 0,
    canRedo: held.writer !== null && held.future.length > 0,
    change: (next, group) => {
      if (held.writer === null) return;
      const now = Date.now();
      const joins = group !== undefined && group === held.group && now - held.groupAt < GROUP_MS;
      if (!joins) held.past = [...held.past, held.copy].slice(-HISTORY_MAX);
      held.future = [];
      held.group = group ?? null;
      held.groupAt = now;
      replace(next(held.copy));
    },
    undo: () => {
      const last = held.past.at(-1);
      if (last === undefined || held.writer === null) return;
      held.past = held.past.slice(0, -1);
      held.future = [held.copy, ...held.future].slice(0, HISTORY_MAX);
      held.group = null;
      replace(last);
    },
    redo: () => {
      const next = held.future[0];
      if (next === undefined || held.writer === null) return;
      held.future = held.future.slice(1);
      held.past = [...held.past, held.copy].slice(-HISTORY_MAX);
      held.group = null;
      replace(next);
    },
    select: (id) => {
      held.selected = id;
      changed();
    },
    flush: () => (held.timer !== null || held.save === 'error' || held.save === 'dirty' ? write(held) : (held.writing ?? Promise.resolve())),
    written: (copy) => {
      if (held.timer !== null) clearTimeout(held.timer);
      held.timer = null;
      held.copy = copy;
      held.base = textOf(copy);
      held.save = 'saved';
      changed();
    },
  };
}
