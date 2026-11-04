/**
 * A DESIGN'S LOGO AND PHOTO: SENT, MEASURED, DRAWN AND KEPT.
 *
 * A design keeps at most one file a column (`logo_file`, `photo_file`). This
 * holds, for each, what the customer sent and what the browser read of it:
 *
 * - sending: the file is checked here first, by its bytes and its weight, so a
 *   wrong one is told at once; then it is read (the bar is how much of it is
 *   read), then sent through the app's client (the bar then says it is being
 *   sent: the client tells nothing of a send while it goes); a refusal the
 *   server gives is told in the customer's words;
 * - measuring: its pixels and its lightness (`files.ts`), for the checks at
 *   its printed size and the picture the laser makes;
 * - keeping: once the design is saved the file is the design's, and the next
 *   save names it no more; a design opened again reads its files back through
 *   its own link, an SVG as Adminium cleaned it, which replaces what the
 *   customer's own copy measured.
 *
 * Every address made for a picture here (`blob:`) is let go when the picture
 * is replaced, removed or the editor closes.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import type { FileFact } from '../../rules/index.ts';
import { FILE_COLUMNS, type CustomiserApi, type SavedDesign } from '../api.ts';
import { finestLine, headOf, oneColourPicture, PICTURE_MAX_BYTES, readPicture, readWithProgress, sniff, TYPE_OF, type Lightness } from '../files.ts';
import type { Translate } from '../i18n.ts';

/** One file a design holds. */
export interface Upload {
  /** What the next save names in the column: the upload's id, or the file the design already keeps. */
  id: string;
  /** Its name as sent; empty for a file a saved design kept (its name is not read back). */
  name: string;
  size: number;
  /** What its bytes are: `png`, `jpeg`, `svg` or `pdf`. */
  kind: string;
  /** Its own address in this page, to draw it; none for a PDF. */
  url?: string;
  px?: [number, number];
  light?: Lightness;
  /** Sent since the design was last saved: the next save names it. */
  fresh: boolean;
}

/** A file on its way: how much of it is read (0 to 1), or null while it is being sent. */
export interface Transfer {
  name: string;
  share: number | null;
}

/** Why a file was not taken, in the customer's words. */
export interface Problem {
  text: string;
  /** The server's own sentence, where it said what in the file is not taken (it is written in English). */
  detail?: string;
}

const LOGO_KINDS = ['svg', 'pdf', 'png', 'jpeg'];
const PHOTO_KINDS = ['png', 'jpeg'];
/** The kinds each of the design's file columns takes, as Adminium's upload of it does: the logo any of the four, the photo a PNG or a JPEG. */
export const COLUMN_KINDS: Readonly<Record<string, readonly string[]>> = { logo_file: LOGO_KINDS, photo_file: PHOTO_KINDS };
/** The kinds a picture part takes: what its rules allow that its column takes. */
export const kindsFor = (accept: readonly string[], column: string): string[] => accept.map((one) => (one === 'jpg' ? 'jpeg' : one)).filter((one, at, all) => all.indexOf(one) === at && (COLUMN_KINDS[column] ?? LOGO_KINDS).includes(one));
const sameKinds = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((one) => b.includes(one === 'jpg' ? 'jpeg' : one));

/** The size cap, as the customer reads it. */
export const CAP_WORDS = '10 MB';

/** What a file of the wrong kind is told: the kinds the part takes, named as the comps name them. */
function wrongKind(t: Translate, accept: readonly string[]): string {
  if (sameKinds(accept, LOGO_KINDS)) return t('editor.upload.kindLogo', 'That isn’t an SVG, PDF, PNG or JPEG');
  if (sameKinds(accept, PHOTO_KINDS)) return t('editor.upload.kindPhoto', 'That isn’t a PNG or JPEG');
  return t('editor.upload.kindOther', 'That kind of file can’t be used here.');
}

/** A refusal the server gave, in the customer's words. */
export function uploadProblem(t: Translate, error: unknown, accept: readonly string[], sent: string): Problem {
  const { code, params, message } = (typeof error === 'object' && error !== null ? error : {}) as { code?: unknown; params?: { reason?: unknown }; message?: unknown };
  const reason = params?.reason;
  if (code === 'PUBLIC_UPLOAD_REFUSED') {
    if (reason === 'too-big') return { text: t('editor.upload.big', 'That file is over {size}', { size: CAP_WORDS }) };
    if (reason === 'kind' && sent === 'svg' && typeof message === 'string' && message.includes('SVG'))
      return { text: t('editor.upload.svgCleaned', 'This SVG holds something we can’t print from. Save it as a plain SVG and upload it again.'), detail: message };
    if (reason === 'kind') return { text: wrongKind(t, accept) };
    if (reason === 'cap') return { text: t('editor.upload.cap', 'You’ve sent as many files as we take in a day. Try again tomorrow.') };
    if (reason === 'quota') return { text: t('editor.upload.quota', 'We can’t take files just now. Try again later.') };
  }
  if (code === 'PUBLIC_RATE_LIMITED') return { text: t('editor.error.rate', 'Too many tries. Wait a minute and try again.') };
  return { text: t('editor.upload.failed', 'That file couldn’t be sent. Try again.') };
}

/** The threshold a part's value makes one colour at: its own, else the shop's start. */
export const thresholdOf = (value: { threshold?: number } | undefined, start: number): number => value?.threshold ?? start;

export interface Pictures {
  pictures: Readonly<Record<string, Upload>>;
  transfers: Readonly<Record<string, Transfer>>;
  problems: Readonly<Record<string, Problem>>;
  /** Check, read, send and measure one file: what was taken, or null when it was not. */
  send: (column: string, file: File, accept: readonly string[]) => Promise<Upload | null>;
  /** The ids the next save names: the files sent since the last one. */
  fresh: () => Record<string, string>;
  /** The design was saved: its files are its own now. */
  saved: (design: SavedDesign) => void;
  /** What the rules are told of the design's files, each measured at the threshold its part makes it one colour at. */
  facts: (kept: Readonly<Record<string, string>>, thresholds: Readonly<Record<string, number>>, accepts: Readonly<Record<string, readonly string[]>>) => FileFact[];
}

export function usePictures(api: CustomiserApi, design: SavedDesign | null, t: Translate): Pictures {
  const [pictures, setPictures] = useState<Record<string, Upload>>({});
  const [transfers, setTransfers] = useState<Record<string, Transfer>>({});
  const [problems, setProblems] = useState<Record<string, Problem>>({});
  const urls = useRef(new Set<string>());
  const finest = useRef(new Map<string, number | undefined>());
  const asked = useRef(new Set<string>());

  const addressOf = (blob: Blob): string | undefined => {
    if (typeof URL.createObjectURL !== 'function') return undefined;
    const url = URL.createObjectURL(blob);
    urls.current.add(url);
    return url;
  };
  const letGo = (url: string | undefined): void => {
    if (url === undefined || !urls.current.has(url)) return;
    urls.current.delete(url);
    URL.revokeObjectURL?.(url);
  };
  useEffect(() => () => urls.current.forEach((url) => URL.revokeObjectURL?.(url)), []);

  const put = useCallback((column: string, next: Upload | null): void => {
    setPictures((all) => {
      letGo(all[column]?.url);
      const out = { ...all };
      if (next === null) delete out[column];
      else out[column] = next;
      return out;
    });
    for (const key of finest.current.keys()) if (key.startsWith(`${column}:`)) finest.current.delete(key);
  }, []);
  const tell = (column: string, problem: Problem | null): void =>
    setProblems((all) => {
      const out = { ...all };
      if (problem === null) delete out[column];
      else out[column] = problem;
      return out;
    });
  const moving = (column: string, transfer: Transfer | null): void =>
    setTransfers((all) => {
      const out = { ...all };
      if (transfer === null) delete out[column];
      else out[column] = transfer;
      return out;
    });

  const send = async (column: string, file: File, accept: readonly string[]): Promise<Upload | null> => {
    tell(column, null);
    const kind = sniff(await headOf(file));
    const takes = accept.map((one) => (one === 'jpg' ? 'jpeg' : one));
    if (kind === 'heic') {
      tell(column, { text: t('editor.upload.heic', 'That photo is in HEIC, which we can’t print from. Save it as JPEG or PNG and upload it again.') });
      return null;
    }
    if (kind === 'other' || !takes.includes(kind)) {
      tell(column, { text: wrongKind(t, accept) });
      return null;
    }
    if (file.size > PICTURE_MAX_BYTES) {
      tell(column, { text: t('editor.upload.big', 'That file is over {size}', { size: CAP_WORDS }) });
      return null;
    }
    if (api.upload === null) {
      tell(column, { text: t('editor.upload.off', 'This shop doesn’t take files here yet.') });
      return null;
    }
    moving(column, { name: file.name, share: 0 });
    try {
      const bytes = await readWithProgress(file, (share) => moving(column, { name: file.name, share }));
      moving(column, { name: file.name, share: null });
      const sent = await api.upload(column, file, file.name, design?.session ?? null);
      const blob = new Blob([bytes], { type: TYPE_OF[kind] ?? '' });
      const read = await readPicture(blob, kind);
      const taken: Upload = { id: sent.id, name: sent.name, size: sent.size, kind, fresh: true, ...(kind === 'pdf' ? {} : { url: addressOf(blob) }), ...read };
      put(column, taken);
      return taken;
    } catch (error) {
      tell(column, uploadProblem(t, error, accept, kind));
      return null;
    } finally {
      moving(column, null);
    }
  };

  // A design opened again: its files are read back through its own link, once each.
  useEffect(() => {
    if (design === null || design.session === null) return;
    for (const column of FILE_COLUMNS) {
      const id = design.files[column];
      const held = pictures[column];
      if (id === undefined || (held !== undefined && (held.fresh || held.kind !== 'svg') && held.id === id) || asked.current.has(`${String(design.id)}:${id}`)) continue;
      asked.current.add(`${String(design.id)}:${id}`);
      void api.file(design, column).then(async (blob) => {
        if (blob === null) return;
        const kind = sniff(await headOf(blob));
        if (kind === 'other' || kind === 'heic') return;
        const read = await readPicture(blob, kind);
        setPictures((all) => {
          const before = all[column];
          // A file sent while this was read is the one the design now takes.
          if (before !== undefined && before.fresh) return all;
          letGo(before?.url);
          return { ...all, [column]: { id, name: before?.name ?? '', size: blob.size, kind, fresh: false, ...(kind === 'pdf' ? {} : { url: addressOf(blob) }), ...read } };
        });
        for (const key of finest.current.keys()) if (key.startsWith(`${column}:`)) finest.current.delete(key);
      });
    }
    // The files are read once per design and file; the pictures held are read inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, design]);

  return {
    pictures,
    transfers,
    problems,
    send,
    fresh: () => Object.fromEntries(Object.entries(pictures).filter(([, one]) => one.fresh).map(([column, one]) => [column, one.id])),
    saved: (saved) => {
      // The files sent are the design's now, under the ids it keeps; an SVG is read again as Adminium cleaned it.
      setPictures((all) => Object.fromEntries(Object.entries(all).map(([column, one]) => [column, { ...one, fresh: false, id: saved.files[column] ?? one.id }])));
      for (const column of FILE_COLUMNS) if (pictures[column]?.kind === 'svg') asked.current.delete(`${String(saved.id)}:${saved.files[column] ?? ''}`);
    },
    facts: (kept, thresholds, accepts) =>
      FILE_COLUMNS.flatMap((column): FileFact[] => {
        const one = pictures[column];
        if (one === undefined) {
          if (kept[column] === undefined) return [];
          // A file the design keeps that is not read back yet: what it is was checked when it was sent, and the server reads it again on the order.
          return [{ column, kind: TYPE_OF[accepts[column]?.[0] ?? 'png'] ?? 'image/png', size: 1 }];
        }
        const fact: FileFact = { column, kind: TYPE_OF[one.kind] ?? one.kind, size: one.size, ...(one.px === undefined ? {} : { px: one.px }) };
        const threshold = thresholds[column];
        if (one.light === undefined || threshold === undefined) return [fact];
        const key = `${column}:${String(threshold)}`;
        if (!finest.current.has(key)) finest.current.set(key, finestLine(one.light, threshold));
        const thinnest = finest.current.get(key);
        return [thinnest === undefined ? fact : { ...fact, thinnest }];
      }),
  };
}

/**
 * A picture as the laser makes it, in the engraving's colour: drawn again a
 * moment after the line moves, its address let go when it is replaced. Null
 * until it is drawn, or where the page cannot draw one.
 */
export function useOneColour(picture: Upload | undefined, threshold: number, ink: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const light = picture?.light;
  useEffect(() => {
    if (light === undefined) {
      setUrl(null);
      return undefined;
    }
    let made: string | null = null;
    let live = true;
    const wait = setTimeout(() => {
      void oneColourPicture(light, threshold, ink).then((one) => {
        if (!live) {
          if (one !== null) URL.revokeObjectURL?.(one);
          return;
        }
        made = one;
        setUrl(one);
      });
    }, 60);
    return () => {
      live = false;
      clearTimeout(wait);
      if (made !== null) URL.revokeObjectURL?.(made);
    };
  }, [light, threshold, ink]);
  return url;
}
