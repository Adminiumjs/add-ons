/**
 * ONE FORM'S BUILDER, SHARED BY THE TOP BAR AND THE QUESTIONS TAB.
 *
 * The top bar's buttons (the language, the save state, Publish) and the
 * Questions tab are drawn apart by the frame, and both edit one draft: the
 * one held here, by the form's key, for as long as the form is open.
 *
 * AUTOSAVE: each change is kept here at once and written to the form's row
 * once it has been still for {@link SAVE_DELAY_MS} — one write for a burst of
 * typing, never one per key. A change made while a write is out is written
 * after it. Leaving the form writes what is left at once.
 *
 * Another person's save (the row read again with words this draft never
 * wrote) replaces the draft only while nothing here is waiting to be written.
 */
import { useEffect, useRef, useSyncExternalStore } from 'react';

import { asJson } from '../shared/row.ts';
import type { FormRow } from '../shared/row.ts';
import type { DataValue } from '../shared/host.ts';
import { draftOf, stable, wordIn, type Draft, type Lang } from './draft.ts';

/** How long a draft stays still before it is written: under a second. */
export const SAVE_DELAY_MS = 600;

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

type Writer = (values: Readonly<Record<string, DataValue>>) => Promise<unknown>;

interface Entry {
  draft: Draft;
  /** The draft as last written (or read), to tell another person's save from our own. */
  base: string;
  /** The row as last seen. */
  seen: string;
  editing: Lang;
  selected: string | null;
  open: string | null;
  save: SaveState;
  timer: ReturnType<typeof setTimeout> | null;
  writing: Promise<void> | null;
  writer: Writer | null;
  name: string;
  users: number;
}

const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
let version = 0;
const changed = (): void => {
  version += 1;
  for (const listener of listeners) listener();
};

/** For the screens' own tests: forget every form. */
export function resetBuilders(): void {
  for (const entry of entries.values()) if (entry.timer !== null) clearTimeout(entry.timer);
  entries.clear();
  changed();
}

/** A section a link may open: any name; one no section has opens none. */
const isSection = (value: string | null): value is string => value !== null && /^[a-z][a-z-]{0,30}$/.test(value);

/** The values one save writes: the two JSON columns and the name lists show, in the form's own language. */
function valuesOf(entry: Entry): Record<string, DataValue> {
  const d = entry.draft.definition;
  const title = wordIn(d.title, d.defaultLanguage).trim().slice(0, 200);
  return { definition: asJson(d), settings: asJson(entry.draft.settings), name: title === '' ? entry.name : title };
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
  const sent = stable(entry.draft);
  const values = valuesOf(entry);
  entry.save = 'saving';
  changed();
  entry.writing = (async () => {
    try {
      await entry.writer?.(values);
      entry.base = sent;
      entry.save = stable(entry.draft) === sent ? 'saved' : 'dirty';
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

export interface Builder {
  draft: Draft;
  editing: Lang;
  selected: string | null;
  open: string | null;
  save: SaveState;
  /** Change the draft; it is written once it has been still a moment. */
  change: (next: (draft: Draft) => Draft) => void;
  setEditing: (lang: Lang) => void;
  select: (id: string | null) => void;
  setOpen: (section: string | null) => void;
  /** Write whatever waits, now; resolves once it is written (or refused). */
  flush: () => Promise<void>;
  /** The draft just written by another call (publishing): nothing waits any more. */
  written: (draft: Draft) => void;
}

/**
 * The builder of one form. Every component that edits it calls this with the
 * row the frame read; the first one makes the draft from it.
 */
export function useBuilder(form: FormRow, writer: Writer | null, locale: Lang, settings: string | null = null): Builder {
  useSyncExternalStore(
    (listener) => (listeners.add(listener), () => listeners.delete(listener)),
    () => version,
  );
  const read = draftOf(form.definition, form.settings, form.kind, locale);
  const rowText = stable(read);
  let entry = entries.get(form.id);
  if (entry === undefined) {
    entry = { draft: read, base: rowText, seen: rowText, editing: read.definition.defaultLanguage, selected: null, open: isSection(settings) ? settings : 'becomes', save: 'saved', timer: null, writing: null, writer, name: form.name, users: 0 };
    entries.set(form.id, entry);
  } else if (rowText !== entry.seen) {
    // The row was read again with something new in it: another person's save, taken while nothing here waits.
    entry.seen = rowText;
    if (rowText !== entry.base && entry.save === 'saved' && entry.timer === null && entry.writing === null) {
      entry.draft = read;
      entry.base = rowText;
      if (!read.definition.languages.includes(entry.editing)) entry.editing = read.definition.defaultLanguage;
    }
  }
  if (writer !== null) entry.writer = writer;
  entry.name = form.name;
  const held = entry;

  // A staff link that names a section opens it, also on a form already open.
  const asked = useRef(settings);
  useEffect(() => {
    if (asked.current !== settings && isSection(settings)) {
      held.open = settings;
      changed();
    }
    asked.current = settings;
  }, [settings, held]);

  // The last one to leave the form writes what is left.
  useEffect(() => {
    held.users += 1;
    return () => {
      held.users -= 1;
      if (held.users === 0 && held.timer !== null) void write(held);
    };
  }, [held]);

  return {
    draft: held.draft,
    editing: held.draft.definition.languages.includes(held.editing) ? held.editing : held.draft.definition.defaultLanguage,
    selected: held.selected,
    open: held.open,
    save: held.save,
    change: (next) => {
      held.draft = next(held.draft);
      held.save = 'dirty';
      schedule(held);
      changed();
    },
    setEditing: (lang) => {
      held.editing = lang;
      changed();
    },
    select: (id) => {
      held.selected = id;
      changed();
    },
    setOpen: (section) => {
      held.open = section;
      changed();
    },
    flush: () => (held.timer !== null || held.save === 'error' || held.save === 'dirty' ? write(held) : (held.writing ?? Promise.resolve())),
    written: (draft) => {
      if (held.timer !== null) clearTimeout(held.timer);
      held.timer = null;
      held.draft = draft;
      held.base = stable(draft);
      held.save = 'saved';
      changed();
    },
  };
}
