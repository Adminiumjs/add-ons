/**
 * A PIECE IN 3D, ON A PAGE: the canvas the stage draws into, and the stills.
 *
 * `ModelView` fetches the 3D stage's file the first time it is shown, draws
 * the piece at the view it is given and keeps to its box's size. Nothing it
 * says is words: the page around it (the customer's stage, the shop's
 * preview) names it and holds its controls. When it goes, every buffer and
 * picture the stage gave the graphics card goes with it. Where the device
 * cannot draw it, `onFail` says so and the page shows the piece flat.
 *
 * `ModelStill` is the same scene drawn once as a picture (a gallery card, a
 * record's preview), kept in memory for the page by `cacheKey`, never stored.
 */
import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react';

import type { FlatSheet } from '../draw/flat.ts';
import { hasWebGL, loadThree, type ThreeChunk } from './load.ts';
import type { Stage3d, StageModel } from './stage3d.ts';
import { usePieceModel, type OutlineSource } from './usePiece.ts';
import { startView, type View } from './view.ts';

export interface ModelViewProps {
  model: StageModel | null;
  view: View;
  className?: string;
  /** The stage itself, for the page to ask where a tap landed on the piece. */
  stageRef?: MutableRefObject<Stage3d | null>;
  onFail?: () => void;
  /** The model is drawn (a shop's model once its file is read): the stage, to be asked about it. */
  onDrawn?: (stage: Stage3d) => void;
  /** Where the stage's file comes from: a test hands in its own. */
  load?: () => Promise<Pick<ThreeChunk, 'makeStage'>>;
}

export function ModelView({ model, view, className, stageRef, onFail, onDrawn, load = loadThree }: ModelViewProps): ReactNode {
  const host = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [stage, setStage] = useState<Stage3d | null>(null);
  const failed = useRef(onFail);
  failed.current = onFail;
  const drawn = useRef(onDrawn);
  drawn.current = onDrawn;

  useEffect(() => {
    let alive = true;
    let made: Stage3d | null = null;
    let watch: ResizeObserver | null = null;
    void load()
      .then((three) => {
        if (!alive || canvas.current === null) return;
        made = three.makeStage(undefined, canvas.current);
        const fit = (): void => {
          const box = host.current?.getBoundingClientRect();
          if (box !== undefined && box.width > 0 && box.height > 0) made?.resize(Math.round(box.width), Math.round(box.height));
        };
        fit();
        if (typeof ResizeObserver !== 'undefined' && host.current !== null) {
          watch = new ResizeObserver(fit);
          watch.observe(host.current);
        }
        if (stageRef !== undefined) stageRef.current = made;
        setStage(made);
      })
      .catch(() => {
        if (alive) failed.current?.();
      });
    return () => {
      alive = false;
      watch?.disconnect();
      made?.dispose();
      if (stageRef !== undefined) stageRef.current = null;
    };
    // The stage is made once for the canvas; the piece and the view follow below.
  }, []);

  useEffect(() => {
    if (stage === null || model === null) return;
    try {
      // A shop's model is read from its file first; one this device cannot read or draw says so.
      stage.setModel(model).then(
        () => drawn.current?.(stage),
        () => failed.current?.(),
      );
    } catch {
      failed.current?.();
    }
  }, [stage, model]);

  useEffect(() => {
    stage?.setView(view);
  }, [stage, view]);

  return (
    <div ref={host} className={className} data-model-view="">
      <canvas ref={canvas} aria-hidden="true" />
    </div>
  );
}

const stills = new Map<string, string | null>();

/** Forget the page's stills, for a test that draws them again. */
export function forgetStills(): void {
  stills.clear();
}

export interface ModelStillProps {
  model: StageModel | null;
  view: View;
  /** The picture's size in pixels. */
  width: number;
  height: number;
  /** One key a scene: the same key is drawn once for the page. */
  cacheKey: string;
  alt: string;
  className?: string;
  /** Shown until the still is drawn, and where it cannot be. */
  fallback: ReactNode;
  load?: () => Promise<Pick<ThreeChunk, 'still'>>;
}

export function ModelStill({ model, view, width, height, cacheKey, alt, className, fallback, load = loadThree }: ModelStillProps): ReactNode {
  const [src, setSrc] = useState<string | null>(() => (hasWebGL() ? (stills.get(cacheKey) ?? null) : null));
  useEffect(() => {
    if (model === null || !hasWebGL()) return;
    const known = stills.get(cacheKey);
    if (known !== undefined) {
      setSrc(known);
      return;
    }
    let alive = true;
    void load()
      .then(async (three) => {
        const drawn = await three.still(model, view, width, height);
        stills.set(cacheKey, drawn);
        if (alive) setSrc(drawn);
      })
      .catch(() => stills.set(cacheKey, null));
    return () => {
      alive = false;
    };
  }, [model, view, width, height, cacheKey, load]);
  return src === null ? fallback : <img src={src} alt={alt} className={className} width={width} height={height} />;
}

export interface PieceStillProps {
  /** The design laid out flat: what the piece's top carries. */
  sheet: FlatSheet;
  thickness: number | null;
  outline: OutlineSource | null;
  /** The customer's pictures this page holds, by file column. */
  pictures?: Readonly<Record<string, string>>;
  width: number;
  height: number;
  alt: string;
  className?: string;
  fallback: ReactNode;
}

/** A flat piece's still, from where the comp first shows it; the fallback (its flat drawing) on a device without WebGL. */
export function PieceStill({ sheet, thickness, outline, pictures, width, height, alt, className, fallback }: PieceStillProps): ReactNode {
  const webgl = hasWebGL();
  const model = usePieceModel(webgl ? sheet : null, thickness, webgl ? outline : null, pictures);
  const key = `${outline?.key ?? 'plain'}|${String(thickness)}|${String(width)}x${String(height)}|${JSON.stringify(sheet)}|${JSON.stringify(pictures ?? {})}`;
  return <ModelStill model={model} view={START_PIECE} width={width} height={height} cacheKey={key} alt={alt} {...(className === undefined ? {} : { className })} fallback={fallback} />;
}

const START_PIECE = startView('piece');

