'use client';

import { createContext, useContext, useEffect, useLayoutEffect, useReducer, useRef, useState, useSyncExternalStore, type CSSProperties, type Dispatch, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Atom, BookOpen, CheckCircle2, Dna, Droplets, Leaf, Microscope, Shapes, ShieldCheck, Split, Sprout, Target, X, Zap, type LucideIcon } from 'lucide-react';

import { cameraTransform, type Camera } from '@/lib/study-deck/camera';
import { assetUrl } from '@/lib/study-deck/deck';
import { glyphOf, type Glyph } from '@/lib/study-deck/glyph';
import { backdropUrl, THEMES, themeVars, type StageTheme } from '@/lib/study-deck/theme';
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

/** The colour family of the slide on screen (see lib/study-deck/theme.ts). Components use it where CSS variables cannot reach (a pin's colour). */
export const ThemeContext = createContext<StageTheme>(THEMES.brand);
export const useTheme = () => useContext(ThemeContext);

/** The corner artwork behind a slide: round cells, lens rings, membrane heads, depending on the topic. Decoration only. */
function StageBackdrop({ theme }: { theme: StageTheme }) {
  const { portrait } = useStage();
  const art = backdropUrl(theme.backdrop, theme.accent);
  // A wide canvas shows the artwork whole; a tall one shows its two corners, so nothing is stretched.
  const style = portrait
    ? { backgroundImage: `${art}, ${art}`, backgroundPosition: '100% 0, 0 100%', backgroundSize: '260% auto, 260% auto', backgroundRepeat: 'no-repeat' }
    : { backgroundImage: art, backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat' };

  return <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0" style={style} />;
}

export interface SlideStageProps {
  theme: StageTheme;
  children: ReactNode;
  /** Slide number and count for the corner badge; omit both on a screen that is not a slide. */
  number?: number;
  count?: number;
  /** Leave out the artwork, stripe and number (the cover is drawn edge to edge). */
  bare?: boolean;
  /**
   * A photograph behind the slide. `led`: the photograph IS the slide (shown clearly, the text on translucent panels over
   * it); otherwise it is a faint texture under the washes of colour, one of the deck's own pictures of the same topic.
   */
  photo?: { src: string; led: boolean } | null;
}

/**
 * What every slide is drawn on: the topic's colour family as two soft washes (like a watercolour), a faint photograph
 * of the topic or the slide's own photograph at full strength, the topic's corner artwork, an accent stripe along the top
 * edge and the slide number in the bottom-right corner. The family's variables are set here so every card, chip and
 * button inside takes the topic's colours. The content must leave the bottom-right corner free.
 */
export function SlideStage({ theme, children, number, count, bare = false, photo = null }: SlideStageProps) {
  const [wash0, wash1] = theme.wash;

  return (
    <ThemeContext.Provider value={theme}>
      <div data-sd-theme={theme.key} className="relative flex h-full min-h-0 flex-col overflow-hidden bg-white" style={themeVars(theme) as CSSProperties}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- deck images are our own stored files or local review copies
          <img src={photo.src} alt="" aria-hidden="true" className={`pointer-events-none absolute inset-0 z-0 h-full w-full object-cover object-top ${photo.led ? '' : 'opacity-[0.2]'}`} />
        ) : null}
        {bare ? null : (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              background: photo?.led
                ? 'linear-gradient(90deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 50%)'
                : `radial-gradient(64% 80% at 0% 0%, ${wash0}f2 0%, transparent 72%), radial-gradient(60% 76% at 100% 100%, ${wash1}f2 0%, transparent 74%)${photo ? '' : `, linear-gradient(135deg, #ffffff 0%, ${theme.softer} 100%)`}`,
            }}
          />
        )}
        {bare || photo?.led ? null : <StageBackdrop theme={theme} />}
        {bare ? null : <div aria-hidden="true" className="absolute inset-x-0 top-0 z-10 h-[0.32em]" style={{ background: `linear-gradient(90deg, ${theme.accent}, ${theme.line})` }} />}
        <div className="relative z-10 min-h-0 flex-1">{children}</div>
        {bare || number === undefined ? null : (
          <span
            aria-hidden="true"
            className="absolute bottom-[0.8em] right-[1.2em] z-30 inline-flex items-baseline gap-[0.3em] rounded-full bg-sd-accent px-[0.9em] py-[0.15em] text-[0.62em] font-bold tabular-nums text-white shadow-sm"
          >
            {String(number).padStart(2, '0')}
            {count ? <span className="font-medium">/ {count}</span> : null}
          </span>
        )}
      </div>
    </ThemeContext.Provider>
  );
}

const LANDSCAPE = { w: 1280, h: 720, font: 20 };
const MARGIN = 8;
const MIN_FIT = 0.6;

export interface FitCanvasProps {
  children: ReactNode;
  /** Changes when the screen changes. */
  resetKey: string;
}

/** True when an element's content spills past its own edges. */
function spills(el: HTMLElement): boolean {
  return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
}

/**
 * True when anything inside the canvas spills past its edges, or past the edges of a region that marks itself with
 * `data-fit` (the slide's own area above its explanation button: content that runs into the button is as much a spill
 * as content that runs off the slide).
 */
function overflows(el: HTMLElement): boolean {
  return spills(el) || Array.from(el.querySelectorAll<HTMLElement>('[data-fit]')).some(spills);
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
  /** Height (in design pixels) kept free under the box for something that hangs below it, such as a caption. */
  reserve?: number;
}

/**
 * The largest box of a given shape that fits the space it is in, centred. A picture and the hotspots laid over it
 * share this box, so percentage positions on the picture stay exactly where they were drawn.
 */
export function FitFrame({ ratio, children, className = '', reserve = 0 }: FitFrameProps) {
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

  const width = Math.min(room.w, Math.max(0, room.h - reserve) * ratio);

  return (
    <div ref={outer} className="flex h-full min-h-0 w-full min-w-0 items-center justify-center">
      <div className={`relative ${className}`} style={{ width, height: width / ratio, marginBottom: reserve, visibility: room.w > 0 ? 'visible' : 'hidden' }}>
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
/** Design pixels kept under a picture for its caption line. */
const CAPTION_ROOM = 40;

export function VisualFigure({ image, assetBase, children, className = '', camera = null }: VisualFigureProps) {
  const ratio = image.width > 0 && image.height > 0 ? image.width / image.height : 16 / 9;
  const photo = image.type === 'photo' && Boolean(image.source_url);
  const still = useReducedMotion();

  const transform = cameraTransform(still ? null : camera);

  return (
    <div className="h-full min-h-0 w-full min-w-0">
      <div className="h-full min-h-0">
        <FitFrame ratio={ratio} reserve={CAPTION_ROOM} className={`overflow-visible ${className}`}>
          {/* A white mat, a hairline in the topic's colour and a soft shadow: the picture sits on the slide like a printed figure. */}
          <div className="absolute inset-0 overflow-hidden rounded-[0.9em] border-[0.15em] border-white bg-white shadow-[0_0.3em_1.1em_rgba(15,23,42,0.18),0_0_0_0.06em_var(--sd-line)]">
            <div className={`absolute inset-0 ${styles.camera}`} style={{ transform, transformOrigin: '50% 50%' }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- deck images are our own stored files or local review copies */}
              <img src={assetUrl(image.url, assetBase)} alt={image.alt} width={image.width} height={image.height} className="block h-full w-full object-fill" />
              {children}
            </div>
          </div>
          <p className="absolute left-0 right-0 top-full flex items-start justify-between gap-[0.8em] px-[0.3em] pt-[0.45em] text-[0.55em] leading-tight text-slate-700">
            <span className="line-clamp-2 min-w-0">
              {image.caption ? <span className="font-semibold text-sd-strong">{trimStop(image.caption)}. </span> : null}
              {creditOf(image)}
            </span>
            {photo ? (
              <a href={image.source_url ?? undefined} target="_blank" rel="noreferrer noopener" className="shrink-0 font-semibold text-sd-strong underline">
                Source
              </a>
            ) : null}
          </p>
        </FitFrame>
      </div>
    </div>
  );
}

/**
 * A translucent panel: white at 88%, a hairline of white and a soft shadow. Text sits on these when a photograph is behind
 * it, so the picture stays visible around the words and the words stay readable (the panel is nearly opaque).
 */
export const PANEL = 'rounded-[1.1em] border border-white/70 bg-white/88 shadow-[0_0.3em_1.4em_rgba(15,23,42,0.2)]';

/** Who made a photograph and under what licence, as a small chip on top of it. Nothing for a drawn diagram. */
export function PhotoCredit({ image, className = '' }: { image: DeckImage; className?: string }) {
  if (image.type !== 'photo' || !image.source_url) return null;

  return (
    <p className={`max-w-[80%] truncate rounded-full bg-slate-950/60 px-[0.9em] py-[0.2em] text-[0.55em] text-white ${className}`}>
      {image.caption ? `${trimStop(image.caption)}. ` : ''}
      {image.creator ?? 'Openverse'}, {image.licence}{' '}
      <a href={image.source_url} target="_blank" rel="noreferrer noopener" className="font-semibold underline">
        Source
      </a>
    </p>
  );
}

/** A caption without its closing full stop, so the credit can follow it with one of its own. */
function trimStop(caption: string): string {
  return caption.replace(/[.\s]+$/, '');
}

/** Who made a picture, and under what licence; a diagram is drawn for the lesson and has neither. */
function creditOf(image: DeckImage): string {
  return image.type === 'photo' && image.source_url ? `${image.creator ?? 'Openverse'}, ${image.licence}` : 'Drawn for this lesson';
}

/**
 * The slide's picture beside a decision, a match or an order, which have no room to draw it large: a thumbnail with its
 * credit that opens the picture at full size. It fills what is left of the column; on a narrow screen there is none, and
 * it is left out.
 */
export function SideFigure({ image, assetBase }: { image: DeckImage | null | undefined; assetBase: string | null | undefined }) {
  const { portrait } = useStage();
  const [open, setOpen] = useState(false);
  if (!image) return null;
  const src = assetUrl(image.url, assetBase ?? null);

  // On a narrow screen the text stacks above the choices and nothing is left over: the lesson is drawn without it.
  if (portrait) return null;

  return (
    <>
      <div className="min-h-[7em] min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`View the picture larger: ${image.alt}`}
          className="flex h-full w-full flex-col overflow-hidden rounded-[0.9em] border-[0.15em] border-white bg-white text-left shadow-[0_0.3em_1.1em_rgba(15,23,42,0.18),0_0_0_0.06em_var(--sd-line)] transition hover:shadow-[0_0.3em_1.1em_rgba(15,23,42,0.24),0_0_0_0.12em_var(--sd-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent"
        >
          <span className="flex min-h-0 flex-1 items-center justify-center bg-slate-50">
            {/* eslint-disable-next-line @next/next/no-img-element -- deck images are our own stored files or local review copies */}
            <img src={src} alt="" className="block max-h-full max-w-full object-contain" />
          </span>
          <span className="flex items-center justify-between gap-[0.5em] border-t border-slate-100 px-[0.6em] py-[0.25em] text-[0.55em] text-slate-600">
            <span className="min-w-0 truncate">{creditOf(image)}</span>
            <span className="shrink-0 font-semibold text-sd-strong">View larger</span>
          </span>
        </button>
      </div>
      {open ? <PictureDialog image={image} src={src} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/**
 * The picture at full size over the lesson. It is drawn into the page body, not into the stage: the stage is scaled
 * with a transform, and a fixed window inside a transformed box would be placed (and sized) by that box.
 */
function PictureDialog({ image, src, onClose }: { image: DeckImage; src: string; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[330] flex items-center justify-center bg-slate-900/50 p-3" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Picture"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
          // The lesson moves on the arrow keys; a window open over it must not.
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') event.stopPropagation();
        }}
        className="flex max-h-[92dvh] w-[min(64rem,96vw)] flex-col rounded-2xl bg-white shadow-2xl outline-none"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <p className="text-base font-semibold text-slate-900">Picture</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close picture"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <figure className="min-h-0 overflow-y-auto p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- deck images are our own stored files or local review copies */}
          <img src={src} alt={image.alt} className="mx-auto block max-h-[68dvh] w-auto max-w-full rounded-lg object-contain" />
          <figcaption className="mt-3 text-sm text-slate-700">
            {image.caption ? `${trimStop(image.caption)}. ` : ''}
            {creditOf(image)}.{' '}
            {image.type === 'photo' && image.source_url ? (
              <a href={image.source_url} target="_blank" rel="noreferrer noopener" className="text-indigo-700 underline">
                Source
              </a>
            ) : null}
          </figcaption>
        </figure>
      </div>
    </div>,
    document.body
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
    <div role="status" className={`flex items-start gap-[0.5em] rounded-[0.8em] border border-emerald-300 bg-emerald-50 px-[0.8em] py-[0.5em] text-emerald-950 shadow-sm ${styles.settle}`}>
      <CheckCircle2 className="mt-[0.1em] h-[1.1em] w-[1.1em] shrink-0 text-emerald-600" aria-hidden="true" />
      <div className="text-[0.85em] leading-snug">
        <p className="font-semibold">All ideas explored ✓</p>
        {children ? <p className="mt-[0.15em]">{children}</p> : null}
      </div>
    </div>
  );
}

/**
 * Six colours for a row of cards, so neighbouring ideas read as different ideas. Each has a dark enough dot for white
 * text (4.5:1), a pale card and a dark text colour; none of them is the only carrier of meaning (cards are numbered).
 */
export const TONES = [
  { card: 'border-sky-200 bg-sky-50 hover:border-sky-500', dot: 'bg-sky-700', text: 'text-sky-950', label: 'text-sky-800' },
  { card: 'border-teal-200 bg-teal-50 hover:border-teal-500', dot: 'bg-teal-700', text: 'text-teal-950', label: 'text-teal-800' },
  { card: 'border-violet-200 bg-violet-50 hover:border-violet-500', dot: 'bg-violet-600', text: 'text-violet-950', label: 'text-violet-800' },
  { card: 'border-amber-200 bg-amber-50 hover:border-amber-500', dot: 'bg-amber-700', text: 'text-amber-950', label: 'text-amber-800' },
  { card: 'border-rose-200 bg-rose-50 hover:border-rose-500', dot: 'bg-rose-600', text: 'text-rose-950', label: 'text-rose-800' },
  { card: 'border-emerald-200 bg-emerald-50 hover:border-emerald-500', dot: 'bg-emerald-700', text: 'text-emerald-950', label: 'text-emerald-800' },
] as const;

const GLYPHS: Record<Glyph, LucideIcon> = {
  microscope: Microscope,
  membrane: ShieldCheck,
  water: Droplets,
  nucleus: Dna,
  organelle: Shapes,
  energy: Zap,
  plant: Leaf,
  division: Split,
  history: BookOpen,
  growth: Sprout,
  target: Target,
};

/** A small icon chosen from the words of the card it sits on (decoration: the card's text already says it). */
export function GlyphIcon({ text, className = '' }: { text: string; className?: string }) {
  const Icon = GLYPHS[glyphOf(text)] ?? Atom;

  return <Icon className={className} aria-hidden="true" />;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex w-fit items-center gap-[0.6em] rounded-full bg-sd-soft px-[0.9em] py-[0.25em] text-[0.62em] font-bold uppercase tracking-wider text-sd-strong">
      <span aria-hidden="true" className="h-[0.75em] w-[0.75em] rounded-full bg-sd-accent" />
      {children}
    </p>
  );
}

/** A short coloured label, like the activity tags in the reference presentation. Without a tone it takes the topic's colour. */
export function Tag({ children, tone = 'indigo' }: { children: ReactNode; tone?: 'indigo' | 'emerald' | 'amber' | 'sky' | 'slate' }) {
  const tones = {
    indigo: 'bg-sd-accent text-white',
    emerald: 'bg-emerald-600 text-white',
    amber: 'bg-amber-500 text-white',
    sky: 'bg-sky-600 text-white',
    slate: 'bg-slate-200 text-slate-800',
  };

  return <span className={`inline-flex items-center gap-[0.35em] rounded-full px-[0.8em] py-[0.2em] text-[0.62em] font-semibold ${tones[tone]}`}>{children}</span>;
}
