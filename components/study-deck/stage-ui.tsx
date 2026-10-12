'use client';

import { createContext, useContext, useEffect, useLayoutEffect, useReducer, useRef, useState, useSyncExternalStore, type Dispatch, type ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';

import { cameraTransform, type Camera } from '@/lib/study-deck/camera';
import { assetUrl } from '@/lib/study-deck/deck';
import type { DeckImage } from '@/lib/study-deck/types';
import styles from './stage.module.css';

export { styles as motion };

/** True when the learner has asked the system for less motion. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia('(prefers-reduced-motion: reduce)');
      query.addEventListener('change', notify);

      return () => query.removeEventListener('change', notify);
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false
  );
}

/**
 * The building blocks of the presentation stage.
 *
 * A study-deck screen is drawn on a fixed design canvas (1280 x 720 for a wide viewport, a narrow flexible
 * one for a tall viewport) and the whole canvas is scaled to fit the space the browser gives it. That is how a
 * presentation works, and it is why nothing here ever scrolls: if the content cannot fit at full size, the text
 * is stepped down in size until it does. Every size inside the canvas is in `em`, so one number scales a screen.
 */

/**
 * What a learner has done on a screen, kept for the session. Moving from a slide's teaching screen to its example screen
 * and back, or going to the previous slide and returning, must not wipe the cards they opened or the path they chose,
 * so each interaction keeps its state here under a key for its slide.
 */
export const MemoryContext = createContext<Map<string, unknown> | null>(null);

export function useRememberedReducer<S, A>(key: string, reducer: (state: S, action: A) => S, init: () => S): [S, Dispatch<A>] {
  const memory = useContext(MemoryContext);
  const [state, dispatch] = useReducer(reducer, undefined, () => (memory?.has(key) ? (memory.get(key) as S) : init()));

  useEffect(() => {
    memory?.set(key, state);
  }, [memory, key, state]);

  return [state, dispatch];
}

export const StageContext = createContext<{ portrait: boolean }>({ portrait: false });
export const useStage = () => useContext(StageContext);

const LANDSCAPE = { w: 1280, h: 720, font: 20 };
const MARGIN = 8;
const MIN_FIT = 0.6;

export interface FitCanvasProps {
  children: ReactNode;
  /** Changes when the screen changes. */
  resetKey: string;
}

/** True when anything inside the canvas spills past its edges. */
function overflows(el: HTMLElement): boolean {
  return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
}

/**
 * Fits one design canvas inside whatever space it is given, shrinking text rather than ever overflowing.
 *
 * The text size is set on the element directly (it is a measurement of the DOM, not application state): start at full
 * size, step down by 5% until nothing spills, never below 60%. It is redone whenever the space or the content changes.
 */
export function FitCanvas({ children, resetKey }: FitCanvasProps) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ cw: 0, ch: 0 });

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const read = () => setSize({ cw: Math.max(0, el.clientWidth - MARGIN * 2), ch: Math.max(0, el.clientHeight - MARGIN * 2) });
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  const { cw, ch } = size;
  const ready = cw > 0;
  const portrait = cw > 0 && (cw < 640 || cw / Math.max(ch, 1) < 1.05);
  let w: number = LANDSCAPE.w;
  let h: number = LANDSCAPE.h;
  let scale = cw > 0 ? Math.min(cw / w, ch / h) : 1;
  let font: number = LANDSCAPE.font;
  if (portrait) {
    w = Math.min(520, Math.max(360, cw));
    scale = cw / w;
    h = ch / scale;
    font = 16;
  }

  useLayoutEffect(() => {
    const el = canvas.current;
    if (!el) return;

    const fit = () => {
      let level = 1;
      el.style.fontSize = `${font}px`;
      while (overflows(el) && level > MIN_FIT) {
        level = Math.round((level - 0.05) * 100) / 100;
        el.style.fontSize = `${font * level}px`;
      }
    };
    fit();

    // The content can change under a screen (a card opens, a consequence appears): fit it again. A panel that is still
    // animating in is measured smaller than it will be, so fit once more when each animation or transition ends.
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(el, { childList: true, subtree: true, characterData: true });
    el.addEventListener('animationend', schedule);
    el.addEventListener('transitionend', schedule);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      el.removeEventListener('animationend', schedule);
      el.removeEventListener('transitionend', schedule);
    };
  }, [resetKey, portrait, w, h, font, ready]);

  return (
    <div ref={box} className="relative h-full min-h-0 w-full flex-1 overflow-hidden">
      {cw > 0 ? (
        <div
          ref={canvas}
          data-portrait={portrait}
          className="absolute overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm"
          style={{
            left: MARGIN + (cw - w * scale) / 2,
            top: MARGIN + (ch - h * scale) / 2,
            width: w,
            height: h,
            transform: `scale(${scale})`,
            transformOrigin: '0 0',
          }}
        >
          <StageContext.Provider value={{ portrait }}>{children}</StageContext.Provider>
        </div>
      ) : null}
    </div>
  );
}

export interface FitFrameProps {
  /** width / height of what goes inside. */
  ratio: number;
  children: ReactNode;
  className?: string;
}

/**
 * The largest box of a given shape that fits the space it is in, centred. A picture and the hotspots laid over it
 * share this box, so percentage positions on the picture stay exactly where they were drawn.
 */
export function FitFrame({ ratio, children, className = '' }: FitFrameProps) {
  const outer = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = outer.current;
    if (!el) return;
    const read = () => setRoom({ w: el.clientWidth, h: el.clientHeight });
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  const width = Math.min(room.w, room.h * ratio);

  return (
    <div ref={outer} className="flex h-full min-h-0 w-full min-w-0 items-center justify-center">
      <div className={`relative ${className}`} style={{ width, height: width / ratio, visibility: room.w > 0 ? 'visible' : 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

export interface VisualFigureProps {
  image: DeckImage;
  assetBase: string | null;
  /** Laid over the picture, positioned as a share of it. They move with the camera. */
  children?: ReactNode;
  /** Classes for the box the picture and its overlay share. */
  className?: string;
  /** Where the camera is pointed (see lib/study-deck/camera.ts): moving focus from one part of a visual to another. */
  camera?: Camera | null;
}

/**
 * The slide's picture or drawn diagram, as large as its space allows, with its credit when it is a photograph.
 *
 * It is a window onto the picture: when a `camera` is set it eases in toward that part (and back out when it is
 * cleared), so attention moves from one part of a visual to the next without the visual ever leaving the screen.
 */
export function VisualFigure({ image, assetBase, children, className = '', camera = null }: VisualFigureProps) {
  const ratio = image.width > 0 && image.height > 0 ? image.width / image.height : 16 / 9;
  const photo = image.type === 'photo' && Boolean(image.source_url);
  const still = useReducedMotion();

  const transform = cameraTransform(still ? null : camera);

  return (
    <FitFrame ratio={ratio} className={`overflow-visible ${className}`}>
      <div className="absolute inset-0 overflow-hidden rounded-[0.8em] border border-slate-200 bg-white shadow-sm">
        <div className={`absolute inset-0 ${styles.camera}`} style={{ transform, transformOrigin: '50% 50%' }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- deck images are our own stored files or local review copies */}
          <img src={assetUrl(image.url, assetBase)} alt={image.alt} width={image.width} height={image.height} className="block h-full w-full object-fill" />
          {children}
        </div>
        {photo ? (
          <p className="absolute bottom-[0.4em] right-[0.4em] max-w-[85%] rounded-[0.4em] bg-white/90 px-[0.5em] py-[0.15em] text-[0.55em] text-slate-700">
            {image.creator ?? 'Openverse'}, {image.licence}{' '}
            <a href={image.source_url ?? undefined} target="_blank" rel="noreferrer noopener" className="text-indigo-700 underline">
              Source
            </a>
          </p>
        ) : null}
      </div>
    </FitFrame>
  );
}

/**
 * The completion state, with its space held from the start. It is hidden until `show`, but it takes the room it will
 * need, so finishing a screen never changes the layout (or the size of the text) under the learner.
 */
export function CompletedSlot({ show, children }: { show: boolean; children?: ReactNode }) {
  return (
    <div className={show ? '' : 'invisible'} aria-hidden={!show}>
      <Completed>{children}</Completed>
    </div>
  );
}

/** The state a learner reaches when everything on a screen has been explored. */
export function Completed({ children }: { children?: ReactNode }) {
  return (
    <div role="status" className={`flex items-start gap-[0.5em] rounded-[0.8em] border border-emerald-200 bg-emerald-50 px-[0.8em] py-[0.5em] text-emerald-950 ${styles.settle}`}>
      <CheckCircle2 className="mt-[0.1em] h-[1.1em] w-[1.1em] shrink-0 text-emerald-600" aria-hidden="true" />
      <div className="text-[0.85em] leading-snug">
        <p className="font-semibold">All ideas explored ✓</p>
        {children ? <p className="mt-[0.15em]">{children}</p> : null}
      </div>
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[0.62em] font-semibold uppercase tracking-wider text-indigo-700">{children}</p>;
}

/** A short coloured label, like the activity tags in the reference presentation. */
export function Tag({ children, tone = 'indigo' }: { children: ReactNode; tone?: 'indigo' | 'emerald' | 'amber' | 'sky' | 'slate' }) {
  const tones = {
    indigo: 'bg-indigo-600 text-white',
    emerald: 'bg-emerald-600 text-white',
    amber: 'bg-amber-500 text-white',
    sky: 'bg-sky-600 text-white',
    slate: 'bg-slate-200 text-slate-800',
  };

  return <span className={`inline-flex items-center gap-[0.35em] rounded-full px-[0.8em] py-[0.2em] text-[0.62em] font-semibold ${tones[tone]}`}>{children}</span>;
}
